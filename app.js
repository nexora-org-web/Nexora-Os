(() => {
  "use strict";
  const $ = (s, root = document) => root.querySelector(s);
  const $$ = (s, root = document) => [...root.querySelectorAll(s)];
  const desktop = $("#desktop"), layer = $("#window-layer"), toast = $("#toast");
  const appMeta = {
    notes: {name:"Notes", icon:"▤", color:"icon-notes"},
    calculator: {name:"Calculator", icon:"＋", color:"icon-calc"},
    arcade: {name:"Arcade", icon:"✦", color:"icon-arcade"},
    settings: {name:"Settings", icon:"⚙", color:"icon-calc"},
    files: {name:"File Explorer", icon:"▰", color:"icon-files"},
    music: {name:"Music Player", icon:"♫", color:"icon-music"},
    paint: {name:"Paint", icon:"◒", color:"icon-paint"},
    terminal: {name:"Terminal", icon:"⌘", color:"icon-terminal"}
  };
  const state = {
    z: 10, windows: new Map(), active: null, noteId: null, filePath: [], wallpaper: 0,
    theme: "dark", sound: true, musicIndex: 0, audio: null, musicPlaying: false,
    musicStartedAt: 0, musicElapsed: 0, musicTimer: null, paintColor:"#7c6cf0", paintSize:5,
    terminalHistory: [], terminalHistoryIndex: 0, toastTimer: null
  };
  const read = (key, fallback) => { try { const v = localStorage.getItem(key); return v === null ? fallback : JSON.parse(v); } catch { return fallback; } };
  const save = (key, value) => { try { localStorage.setItem(key, JSON.stringify(value)); } catch {} };
  function notify(message) {
    toast.textContent = message; toast.classList.add("show");
    clearTimeout(state.toastTimer); state.toastTimer = setTimeout(() => toast.classList.remove("show"), 2300);
  }
  function escapeHTML(s) { return String(s).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c])); }
  function nowClock() {
    const d = new Date();
    const time = d.toLocaleTimeString([], {hour:"2-digit",minute:"2-digit"});
    $("#top-clock").textContent = time; $("#dock-clock").textContent = time;
    $("#dock-clock").title = d.toLocaleDateString([], {weekday:"long",month:"long",day:"numeric",year:"numeric"});
  }
  nowClock(); setInterval(nowClock, 10000);

  const apps = Object.keys(appMeta);
  function appButton(id, start = false) {
    const m = appMeta[id];
    return `<button class="${start ? "start-app" : "dock-app"}" data-app="${id}" title="${m.name}"><span class="${start ? "app-icon " + m.color : ""}">${m.icon}</span>${start ? `<span>${m.name}</span>` : ""}</button>`;
  }
  function renderStartApps(filter = "") {
    $("#start-app-grid").innerHTML = apps.filter(id => appMeta[id].name.toLowerCase().includes(filter.toLowerCase())).map(id => appButton(id, true)).join("");
  }
  renderStartApps();

  function openApp(id) {
    if (!appMeta[id]) return;
    $("#start-menu").classList.add("hidden"); $("#quick-panel").classList.add("hidden"); $("#context-menu").classList.add("hidden");
    if (state.windows.has(id)) {
      const existing = state.windows.get(id);
      existing.classList.remove("minimized"); focusWindow(id); return;
    }
    const meta = appMeta[id], win = document.createElement("section");
    win.className = "app-window"; win.dataset.app = id; win.style.zIndex = ++state.z;
    win.innerHTML = `<div class="window-titlebar"><div class="window-title"><span class="mini-app-icon">${meta.icon}</span><span>${meta.name}</span></div><div class="window-controls"><button data-action="minimize" title="Minimize">−</button><button data-action="maximize" title="Maximize">□</button><button class="close-window" data-action="close" title="Close">×</button></div></div><div class="window-body" id="body-${id}"></div>`;
    layer.appendChild(win); state.windows.set(id, win); focusWindow(id);
    win.addEventListener("pointerdown", () => focusWindow(id));
    win.querySelector('[data-action="close"]').addEventListener("click", () => closeApp(id));
    win.querySelector('[data-action="minimize"]').addEventListener("click", () => win.classList.add("minimized"));
    win.querySelector('[data-action="maximize"]').addEventListener("click", () => {
      win.classList.toggle("maximized");
      if (!win.classList.contains("maximized")) { win.style.left="50%";win.style.top="50%";win.style.transform="translate(-50%,-50%)"; }
    });
    makeDraggable(win);
    renderApp(id);
    renderRunningDock();
    $("#active-title").textContent = meta.name;
  }
  function focusWindow(id) {
    const win = state.windows.get(id); if (!win) return;
    state.active = id; win.style.zIndex = ++state.z;
    $$(".dock-app").forEach(b => b.classList.toggle("running", b.dataset.app === id));
    $("#active-title").textContent = appMeta[id].name;
  }
  function closeApp(id) {
    const win = state.windows.get(id); if (win) win.remove();
    state.windows.delete(id);
    if (id === "music") stopMusic();
    renderRunningDock();
    const top = [...state.windows.entries()].filter(([,w])=>!w.classList.contains("minimized")).sort((a,b)=>Number(b[1].style.zIndex)-Number(a[1].style.zIndex))[0];
    if (top) focusWindow(top[0]); else {state.active=null;$("#active-title").textContent="Your space. Your rules.";}
  }
  function renderRunningDock() {
    const running = [...state.windows.keys()].filter(id => !["notes","files","arcade","music"].includes(id));
    $("#dock-running").innerHTML = running.map(id => `<button data-app="${id}" title="${appMeta[id].name}">${appMeta[id].icon}</button>`).join("");
    $$(".dock-pinned [data-app]").forEach(b => b.classList.toggle("running",state.windows.has(b.dataset.app)));
  }
  function makeDraggable(win) {
    const bar = $(".window-titlebar", win);
    let sx=0,sy=0,left=0,top=0,dragging=false;
    bar.addEventListener("pointerdown", e => {
      if (e.target.closest("button") || win.classList.contains("maximized") || window.matchMedia("(max-width:650px)").matches) return;
      dragging=true; const r=win.getBoundingClientRect(); sx=e.clientX;sy=e.clientY;left=r.left;top=r.top;
      win.style.transform="none"; win.style.left=left+"px";win.style.top=top+"px";
      bar.setPointerCapture(e.pointerId);
    });
    bar.addEventListener("pointermove", e => {if(!dragging)return; const x=Math.max(0,Math.min(innerWidth-win.offsetWidth,left+e.clientX-sx));const y=Math.max(46,Math.min(innerHeight-100,top+e.clientY-sy));win.style.left=x+"px";win.style.top=y+"px";});
    bar.addEventListener("pointerup",()=>dragging=false);bar.addEventListener("pointercancel",()=>dragging=false);
    bar.addEventListener("dblclick", e => {if(!e.target.closest("button"))win.querySelector('[data-action="maximize"]').click();});
  }

  function renderApp(id) {
    const body = $("#body-"+id); if (!body) return;
    if (id==="notes") renderNotes(body);
    if (id==="calculator") renderCalculator(body);
    if (id==="arcade") renderArcade(body);
    if (id==="settings") renderSettings(body);
    if (id==="files") renderFiles(body);
    if (id==="music") renderMusic(body);
    if (id==="paint") renderPaint(body);
    if (id==="terminal") renderTerminal(body);
  }

  // Notes: stored only in this browser.
  function getNotes() { return read("nexora-notes", [{id:"welcome",title:"Welcome to NEXORA",content:"This is your space.\n\nCreate a note, write down an idea, or plan your next project. Your notes stay in this browser.",updated:Date.now()}]); }
  function renderNotes(body) {
    const notes=getNotes(); if(!notes.some(n=>n.id===state.noteId))state.noteId=notes[0]?.id||null;
    body.innerHTML=`<div class="note-layout"><aside class="note-sidebar"><button class="btn primary" id="new-note" style="width:100%">＋ New note</button><div class="note-list">${notes.map(n=>`<button class="note-item ${n.id===state.noteId?"active":""}" data-note="${escapeHTML(n.id)}">${escapeHTML(n.title||"Untitled")}<span>${new Date(n.updated).toLocaleDateString()}</span></button>`).join("")}</div></aside><div class="note-editor">${state.noteId?`<input id="note-title" maxlength="100" value="${escapeHTML(notes.find(n=>n.id===state.noteId)?.title||"")}" aria-label="Note title"><textarea id="note-content" placeholder="Start writing..." aria-label="Note content">${escapeHTML(notes.find(n=>n.id===state.noteId)?.content||"")}</textarea><div class="app-row"><button class="btn" id="export-note">Export .txt</button><button class="btn danger" id="delete-note">Delete note</button><span style="font-size:9px;color:var(--muted);margin-left:auto">Saved automatically</span></div>`:`<div class="empty-state">No notes yet.<br>Create one to get started.</div>`}</div></div>`;
    $("#new-note",body).onclick=()=>{const a=getNotes();const n={id:"n"+Date.now(),title:"Untitled note",content:"",updated:Date.now()};a.unshift(n);save("nexora-notes",a);state.noteId=n.id;renderNotes(body);$("#note-title",body).focus();};
    $$("[data-note]",body).forEach(b=>b.onclick=()=>{state.noteId=b.dataset.note;renderNotes(body);});
    const title=$("#note-title",body),content=$("#note-content",body);
    const persist=()=>{const a=getNotes(),n=a.find(n=>n.id===state.noteId);if(!n)return;n.title=title.value;n.content=content.value;n.updated=Date.now();save("nexora-notes",a);const active=$(`[data-note="${CSS.escape(n.id)}"]`,body);if(active)active.firstChild.textContent=n.title||"Untitled";};
    if(title&&content){title.addEventListener("input",persist);content.addEventListener("input",persist);
      $("#delete-note",body).onclick=()=>{if(!confirm("Delete this note?"))return;save("nexora-notes",getNotes().filter(n=>n.id!==state.noteId));state.noteId=null;renderNotes(body);notify("Note deleted");};
      $("#export-note",body).onclick=()=>downloadText((title.value||"note")+".txt",content.value);
    }
  }
  function downloadText(name,text) { const a=document.createElement("a");a.href=URL.createObjectURL(new Blob([text],{type:"text/plain;charset=utf-8"}));a.download=name.replace(/[\\/:*?"<>|]/g,"_");a.click();URL.revokeObjectURL(a.href); }

  // Calculator: small safe arithmetic parser, no eval.
  function calculate(expr) {
    const tokens=expr.match(/(?:\d+\.?\d*|\.\d+)|[()+\-*/%]/g);
    if(!tokens || tokens.join("")!==expr.replace(/\s/g,"")) throw Error("Invalid expression");
    let i=0;
    function primary(){const t=tokens[i++];if(t==="("){const v=add();if(tokens[i++]!==")")throw Error("Missing )");return v;}if(t==="-" )return -primary();if(t==="+")return primary();if(!t||!/^(\d+\.?\d*|\.\d+)$/.test(t))throw Error("Expected number");return Number(t);}
    function mul(){let v=primary();while(["*","/","%"].includes(tokens[i])){const op=tokens[i++],b=primary();if((op==="/"||op==="%")&&b===0)throw Error("Cannot divide by zero");v=op==="*"?v*b:op==="/"?v/b:v%b;}return v;}
    function add(){let v=mul();while(tokens[i]==="+"||tokens[i]==="-"){const op=tokens[i++],b=mul();v=op==="+"?v+b:v-b;}return v;}
    const result=add();if(i<tokens.length||!Number.isFinite(result))throw Error("Invalid calculation");return Math.round((result+Number.EPSILON)*1e10)/1e10;
  }
  function renderCalculator(body) {
    body.innerHTML=`<div class="calc"><div class="calc-display"><div class="calc-expression" id="calc-expression"></div><div class="calc-result" id="calc-result">0</div></div><div class="calc-grid">${["AC","⌫","%","÷","7","8","9","×","4","5","6","−","1","2","3","+","±","0",".","="].map(k=>`<button class="calc-key ${["÷","×","−","+","%"].includes(k)?"operator":k==="="?"equals":""}" data-key="${k}">${k}</button>`).join("")}</div></div>`;
    let expr="",fresh=false;const exp=$("#calc-expression",body),res=$("#calc-result",body);
    function update(){exp.textContent=expr;res.textContent=expr||"0";}
    function press(k){
      if(k==="AC"){expr="";update();return;}
      if(k==="⌫"){expr=expr.slice(0,-1);update();return;}
      if(k==="="){try{const normalized=expr.replace(/÷/g,"/").replace(/×/g,"*").replace(/−/g,"-");const answer=calculate(normalized);exp.textContent=expr+" =";expr=String(answer);res.textContent=expr;fresh=true;}catch{res.textContent="Error";setTimeout(update,700);}return;}
      if(k==="±"){if(expr.startsWith("-"))expr=expr.slice(1);else expr="-"+expr;update();return;}
      if(fresh&&!["÷","×","−","+","%"].includes(k))expr="";
      fresh=false;expr+=({"÷":"/","×":"*","−":"-"}[k]||k);update();
    }
    $$("[data-key]",body).forEach(b=>b.onclick=()=>press(b.dataset.key));
    body.tabIndex=0;body.onkeydown=e=>{if(/^[0-9.+\-*/%()]$/.test(e.key)){e.preventDefault();press(e.key.replace("*","×").replace("/","÷").replace("-","−"));}else if(e.key==="Enter"){e.preventDefault();press("=");}else if(e.key==="Backspace")press("⌫");else if(e.key==="Escape")press("AC");};
  }

  // Arcade mini games.
  function renderArcade(body) {
    body.innerHTML=`<h2 class="app-heading">Take a quick break.</h2><p class="app-subtitle">Tiny games, zero downloads. Your best scores are saved on this device.</p><div class="arcade-cards"><button class="game-card" data-game="reaction"><span class="game-emoji">⚡</span><b>Reaction Test</b><small>How fast can you react?</small></button><button class="game-card" data-game="memory"><span class="game-emoji">🧠</span><b>Number Memory</b><small>Remember the number sequence.</small></button><button class="game-card" data-game="typing"><span class="game-emoji">⌨</span><b>Typing Sprint</b><small>Type the phrase as quickly as you can.</small></button><button class="game-card" data-game="snake"><span class="game-emoji">🟩</span><b>Snake</b><small>The classic grid game.</small></button></div><div id="game-stage"></div>`;
    $$("[data-game]",body).forEach(b=>b.onclick=()=>startGame(b.dataset.game,$("#game-stage",body)));
  }
  function startGame(type,stage) {
    if(type==="reaction"){
      stage.innerHTML=`<div class="game-stage"><h3>Reaction Test</h3><p class="app-subtitle">Tap when the panel turns green. Don't tap too early.</p><button id="reaction-zone" class="game-playfield" style="max-width:100%;aspect-ratio:auto;height:145px;background:#26263c;color:white;font-size:14px">Tap to begin</button><div id="reaction-result" class="game-message"></div></div>`;
      let start=0,timer=null,ready=false,waiting=false;const zone=$("#reaction-zone",stage),result=$("#reaction-result",stage);
      zone.onclick=()=>{if(!waiting&&!ready){waiting=true;zone.textContent="Wait for green…";zone.style.background="#b04c6a";timer=setTimeout(()=>{ready=true;start=performance.now();zone.style.background="#1ca77a";zone.textContent="TAP NOW!";},900+Math.random()*2800);}else if(waiting&&!ready){clearTimeout(timer);waiting=false;zone.style.background="#26263c";zone.textContent="Too soon! Tap to try again.";result.textContent="False start. Patience is part of the test.";}else if(ready){const ms=Math.round(performance.now()-start);waiting=false;ready=false;zone.style.background="#26263c";zone.textContent="Tap to try again";result.textContent=`${ms} ms · ${ms<220?"Lightning fast!":ms<320?"Nice reflexes.":"Keep practicing."}`;const best=read("nexora-reaction-best",null);if(best===null||ms<best){save("nexora-reaction-best",ms);result.textContent+=" New personal best!";}}};
    } else if(type==="memory"){
      let level=3,sequence="",showing=false;
      stage.innerHTML=`<div class="game-stage"><h3>Number Memory</h3><p class="app-subtitle">Memorize the number, then type it back.</p><div id="memory-number" class="game-big">Ready?</div><input id="memory-answer" class="field" inputmode="numeric" placeholder="Type the number" style="max-width:240px;text-align:center"><div class="game-message" id="memory-message"></div><button class="btn primary" id="memory-start">Start round</button></div>`;
      const num=$("#memory-number",stage),ans=$("#memory-answer",stage),msg=$("#memory-message",stage);
      $("#memory-start",stage).onclick=()=>{if(showing)return;sequence=Array.from({length:level},()=>Math.floor(Math.random()*10)).join("");showing=true;num.textContent=sequence;ans.value="";ans.disabled=true;msg.textContent="Remember it…";setTimeout(()=>{num.textContent="••••••";ans.disabled=false;ans.focus();msg.textContent="Now enter the number.";showing=false;},Math.max(1300,level*420));};
      ans.onkeydown=e=>{if(e.key==="Enter"&&!showing){if(ans.value===sequence){level++;msg.textContent=`Correct! Next round: ${level} digits.`;num.textContent="✓";}else{msg.textContent=`Not quite. The number was ${sequence}. Starting over.`;level=3;num.textContent="↻";}ans.disabled=true;}};
    } else if(type==="typing"){
      const phrases=["small steps still move you forward","make something worth sharing","focus on what you can control","ideas become real when you build"];
      const phrase=phrases[Math.floor(Math.random()*phrases.length)];const start=performance.now();
      stage.innerHTML=`<div class="game-stage"><h3>Typing Sprint</h3><p class="app-subtitle">Type this phrase exactly, then press Enter.</p><div class="settings-section" style="font-size:15px;line-height:1.7">${escapeHTML(phrase)}</div><input id="typing-input" class="field" placeholder="Start typing..." autocomplete="off"><div id="typing-result" class="game-message"></div></div>`;
      const input=$("#typing-input",stage);input.focus();input.onkeydown=e=>{if(e.key==="Enter"){if(input.value===phrase){const sec=(performance.now()-start)/1000,wpm=Math.round(phrase.split(" ").length/sec*60);$("#typing-result",stage).textContent=`Done in ${sec.toFixed(1)} seconds · approx. ${wpm} WPM`;save("nexora-typing-best",Math.max(wpm,read("nexora-typing-best",0)));}else $("#typing-result",stage).textContent="Not quite. Check the phrase and try again."; }};
    } else if(type==="snake") startSnake(stage);
  }
  function startSnake(stage) {
    stage.innerHTML=`<div class="game-stage"><h3>Snake</h3><p class="app-subtitle">Use arrow keys or WASD. On mobile, use the direction buttons.</p><canvas class="game-playfield" id="snake-canvas" width="300" height="300"></canvas><div class="app-row" style="justify-content:center"><button class="btn" data-dir="up">↑</button><button class="btn" data-dir="left">←</button><button class="btn" data-dir="down">↓</button><button class="btn" data-dir="right">→</button><button class="btn primary" id="snake-start">Start / restart</button></div><div id="snake-score" class="game-message">Score: 0</div></div>`;
    const c=$("#snake-canvas",stage),ctx=c.getContext("2d"),scoreEl=$("#snake-score",stage);let snake,food,dir,next,score,timer,alive=false;
    const reset=()=>{clearInterval(timer);snake=[{x:7,y:7},{x:6,y:7},{x:5,y:7}];food={x:12,y:10};dir={x:1,y:0};next={...dir};score=0;alive=true;draw();timer=setInterval(tick,130);};
    const draw=()=>{ctx.fillStyle="#080b17";ctx.fillRect(0,0,300,300);ctx.fillStyle="#9b8cff";snake.forEach(p=>ctx.fillRect(p.x*15+1,p.y*15+1,13,13));ctx.fillStyle="#65e9ce";ctx.beginPath();ctx.arc(food.x*15+7.5,food.y*15+7.5,6,0,Math.PI*2);ctx.fill();scoreEl.textContent="Score: "+score;};
    function tick(){dir=next;const h={x:snake[0].x+dir.x,y:snake[0].y+dir.y};if(h.x<0||h.x>=20||h.y<0||h.y>=20||snake.some(p=>p.x===h.x&&p.y===h.y)){clearInterval(timer);alive=false;scoreEl.textContent=`Game over · Score: ${score}`;save("nexora-snake-best",Math.max(score,read("nexora-snake-best",0)));return;}snake.unshift(h);if(h.x===food.x&&h.y===food.y){score++;food={x:Math.floor(Math.random()*20),y:Math.floor(Math.random()*20)};}else snake.pop();draw();}
    const setDir=d=>{if(d.x!==-dir.x||d.y!==-dir.y)next=d;};
    stage.onkeydown=e=>{const map={ArrowUp:{x:0,y:-1},w:{x:0,y:-1},ArrowDown:{x:0,y:1},s:{x:0,y:1},ArrowLeft:{x:-1,y:0},a:{x:-1,y:0},ArrowRight:{x:1,y:0},d:{x:1,y:0}};if(map[e.key]){e.preventDefault();setDir(map[e.key]);}};
    $$("[data-dir]",stage).forEach(b=>b.onclick=()=>setDir(({up:{x:0,y:-1},down:{x:0,y:1},left:{x:-1,y:0},right:{x:1,y:0}})[b.dataset.dir]));
    $("#snake-start",stage).onclick=reset;reset();
  }

  // Settings.
  function applyPrefs() {
    state.theme=read("nexora-theme","dark");state.wallpaper=read("nexora-wallpaper",0);
    desktop.classList.toggle("light",state.theme==="light");
    desktop.classList.remove("wallpaper-1","wallpaper-2","wallpaper-3");
    if(state.wallpaper)desktop.classList.add("wallpaper-"+state.wallpaper);
  }
  function renderSettings(body) {
    const theme=read("nexora-theme","dark"),wall=read("nexora-wallpaper",0),sound=read("nexora-sound",true);
    body.innerHTML=`<h2 class="app-heading">Make it yours.</h2><p class="app-subtitle">Personalize your NEXORA desktop. Changes are saved in this browser.</p><div class="settings-section"><h3>Appearance</h3><p>Choose the mood of your desktop.</p><div class="setting-row"><span>Interface theme</span><select class="field" id="setting-theme" style="width:125px"><option value="dark">Dark</option><option value="light">Light</option></select></div><div class="setting-row"><span>Desktop wallpaper</span><span style="font-size:10px;color:var(--muted)">Select below</span></div><div class="wallpaper-options">${[0,1,2,3].map(n=>`<button class="wallpaper-choice ${n===wall?"active":""}" data-wall="${n}" aria-label="Wallpaper ${n+1}"></button>`).join("")}</div></div><div class="settings-section"><h3>Experience</h3><p>Control small details of the desktop.</p><label class="setting-row"><span>Sound effects</span><input id="setting-sound" type="checkbox" ${sound?"checked":""}></label><label class="setting-row"><span>Show desktop welcome tip</span><input id="setting-tip" type="checkbox" ${read("nexora-tip",true)?"checked":""}></label></div><div class="settings-section"><h3>About NEXORA OS</h3><p>Version 1.0 · A small browser desktop built with HTML, CSS and vanilla JavaScript. No account, server, or AI API required.</p><button class="btn" id="reset-prefs">Reset preferences</button> <button class="btn danger" id="clear-data">Clear local app data</button></div>`;
    $("#setting-theme",body).value=theme;$("#setting-theme",body).onchange=e=>{save("nexora-theme",e.target.value);applyPrefs();};
    $$("[data-wall]",body).forEach(b=>b.onclick=()=>{save("nexora-wallpaper",Number(b.dataset.wall));applyPrefs();renderSettings(body);});
    $("#setting-sound",body).onchange=e=>save("nexora-sound",e.target.checked);
    $("#setting-tip",body).onchange=e=>save("nexora-tip",e.target.checked);
    $("#reset-prefs",body).onclick=()=>{["nexora-theme","nexora-wallpaper","nexora-sound","nexora-tip"].forEach(k=>localStorage.removeItem(k));applyPrefs();renderSettings(body);notify("Preferences reset");};
    $("#clear-data",body).onclick=()=>{if(!confirm("Clear NEXORA notes, scores, and preferences from this browser? This cannot be undone."))return;Object.keys(localStorage).filter(k=>k.startsWith("nexora-")).forEach(k=>localStorage.removeItem(k));state.noteId=null;applyPrefs();renderSettings(body);notify("Local NEXORA data cleared");};
  }
  applyPrefs();

  // A simulated file explorer with safe in-app actions.
  const virtualFiles = {
    "": [{name:"Documents",type:"folder",emoji:"📁",path:"Documents"},{name:"Pictures",type:"folder",emoji:"🖼️",path:"Pictures"},{name:"Music",type:"folder",emoji:"🎵",path:"Music"},{name:"Read me.txt",type:"file",emoji:"📄",content:"Welcome to NEXORA OS.\nThis is a simulated file explorer. It does not access your actual computer files."}],
    "Documents":[{name:"Ideas.txt",type:"file",emoji:"📝",content:"Ideas start small.\nWrite them down, then build something."},{name:"Study plan.txt",type:"file",emoji:"📄",content:"1. Pick one goal.\n2. Break it into small tasks.\n3. Start today."}],
    "Pictures":[{name:"Nebula wallpaper.png",type:"file",emoji:"🌌",content:"This is a demo item, not an actual image file."}],
    "Music":[{name:"Midnight Drive.demo",type:"file",emoji:"🎧",content:"Demo music library item. Use Music Player for the built-in synthesizer."}]
  };
  function renderFiles(body) {
    const path=state.filePath.join("/"),items=virtualFiles[path]||[];
    body.innerHTML=`<div class="file-toolbar"><button class="btn" id="file-back" ${state.filePath.length?"":"disabled"}>← Back</button><button class="btn" id="file-home">⌂ Home</button><button class="btn" id="file-new">＋ New text file</button></div><div class="file-breadcrumb">NEXORA / ${state.filePath.map(escapeHTML).join(" / ")||"Home"}</div><div class="file-grid">${items.map((f,i)=>`<button class="file-item" data-file="${i}"><span class="file-emoji">${f.emoji}</span><span>${escapeHTML(f.name)}</span><small>${f.type==="folder"?"Folder":"Text document"}</small></button>`).join("")}</div>`;
    $("#file-back",body).onclick=()=>{state.filePath.pop();renderFiles(body);};
    $("#file-home",body).onclick=()=>{state.filePath=[];renderFiles(body);};
    $("#file-new",body).onclick=()=>{const name=prompt("Name your text file:","New file.txt");if(!name)return;const arr=virtualFiles[path]||(virtualFiles[path]=[]);arr.push({name,type:"file",emoji:"📄",content:""});renderFiles(body);notify("File created in this demo session");};
    $$("[data-file]",body).forEach(b=>b.ondblclick=()=>{const f=items[Number(b.dataset.file)];if(f.type==="folder"){state.filePath.push(f.path);renderFiles(body);}else{const content=prompt(f.name,f.content);if(content!==null){f.content=content;notify("Changes kept for this session");}}});
    $$("[data-file]",body).forEach(b=>b.onclick=()=>{ $$(".file-item",body).forEach(x=>x.style.background="");b.style.background="var(--panel-soft)";});
  }

  // Built-in tiny synthesizer, no remote audio files required.
  const tracks=[
    {title:"Nebula Drift",artist:"NEXORA Radio",notes:[261.63,329.63,392,493.88,392,329.63],wave:"sine"},
    {title:"Pixel Dawn",artist:"NEXORA Radio",notes:[220,261.63,329.63,293.66,261.63,196],wave:"triangle"},
    {title:"After Hours",artist:"NEXORA Radio",notes:[174.61,220,261.63,349.23,293.66,220],wave:"sine"}
  ];
  function stopMusic(){state.musicPlaying=false;if(state.musicTimer)clearInterval(state.musicTimer);state.musicTimer=null;if(state.audio){try{state.audio.oscillators.forEach(o=>{try{o.stop()}catch{}});state.audio.ctx.close();}catch{}state.audio=null;}}
  function playSynth() {
    if(state.musicPlaying){stopMusic();renderMusic($("#body-music"));return;}
    const Ctx=window.AudioContext||window.webkitAudioContext;
    if(!Ctx){notify("This browser does not support Web Audio.");return;}
    try{
      const ctx=new Ctx(),gain=ctx.createGain();gain.gain.value=.055;gain.connect(ctx.destination);
      const oscillators=[];const track=tracks[state.musicIndex];
      track.notes.forEach((freq,i)=>{const o=ctx.createOscillator(),g=ctx.createGain();o.type=track.wave;o.frequency.value=freq;g.gain.value=0;o.connect(g);g.connect(gain);o.start();g.gain.setValueAtTime(0,ctx.currentTime+i*.55);g.gain.linearRampToValueAtTime(.7,ctx.currentTime+i*.55+.08);g.gain.linearRampToValueAtTime(0,ctx.currentTime+i*.55+.48);oscillators.push(o);});
      state.audio={ctx,oscillators};state.musicPlaying=true;state.musicStartedAt=Date.now();state.musicElapsed=0;
      state.musicTimer=setTimeout(()=>{stopMusic();const b=$("#body-music");if(b)renderMusic(b);},track.notes.length*550+600);
      renderMusic($("#body-music"));
    }catch{notify("Could not start audio. Tap play again.");}
  }
  function renderMusic(body) {
    if(!body)return;const t=tracks[state.musicIndex];
    body.innerHTML=`<div class="music-player"><div class="album-art"><span>♫</span></div><div class="track-title">${t.title}</div><div class="track-artist">${t.artist} · Generated in your browser</div><input class="track-progress" type="range" min="0" max="${t.notes.length*.55}" value="0" disabled><div class="track-times"><span>LIVE DEMO</span><span>${state.musicPlaying?"Playing":"Ready"}</span></div><div class="music-controls"><button id="music-prev" title="Previous track">⏮</button><button class="play-button" id="music-play" title="Play or stop">${state.musicPlaying?"Ⅱ":"▶"}</button><button id="music-next" title="Next track">⏭</button></div><div class="track-list">${tracks.map((tr,i)=>`<button class="track-row ${i===state.musicIndex?"active":""}" data-track="${i}"><span class="track-number">${String(i+1).padStart(2,"0")}</span><span>${tr.title}<small>${tr.artist}</small></span><span style="margin-left:auto;color:var(--muted)">♫</span></button>`).join("")}</div><p class="app-subtitle" style="margin-top:12px">Short synthesized previews, not commercial songs or streaming tracks.</p></div>`;
    $("#music-play",body).onclick=playSynth;
    $("#music-prev",body).onclick=()=>{stopMusic();state.musicIndex=(state.musicIndex+tracks.length-1)%tracks.length;renderMusic(body);};
    $("#music-next",body).onclick=()=>{stopMusic();state.musicIndex=(state.musicIndex+1)%tracks.length;renderMusic(body);};
    $$("[data-track]",body).forEach(b=>b.onclick=()=>{stopMusic();state.musicIndex=Number(b.dataset.track);renderMusic(body);playSynth();});
  }

  // Paint app. Export is real PNG download.
  function renderPaint(body) {
    body.innerHTML=`<div class="paint-tools"><label class="btn">Color <input id="paint-color" type="color" value="${state.paintColor}" aria-label="Brush color"></label><label class="btn">Size <input id="paint-size" type="range" min="1" max="32" value="${state.paintSize}" aria-label="Brush size"></label><button class="btn" id="paint-undo">Undo</button><button class="btn" id="paint-clear">Clear</button><button class="btn primary" id="paint-save">Export PNG</button></div><div class="paint-canvas-wrap"><canvas id="paint-canvas"></canvas></div>`;
    const canvas=$("#paint-canvas",body),wrap=$(".paint-canvas-wrap",body),ctx=canvas.getContext("2d");let drawing=false,strokes=[],current=null;
    function resize(){const old=document.createElement("canvas");old.width=canvas.width;old.height=canvas.height;old.getContext("2d").drawImage(canvas,0,0);const r=wrap.getBoundingClientRect();canvas.width=Math.max(1,Math.round(r.width*devicePixelRatio));canvas.height=Math.max(1,Math.round(r.height*devicePixelRatio));ctx.setTransform(devicePixelRatio,0,0,devicePixelRatio,0,0);ctx.fillStyle="#f7f7fb";ctx.fillRect(0,0,r.width,r.height);if(old.width&&old.height)ctx.drawImage(old,0,0,old.width,old.height,0,0,r.width,r.height);redraw();}
    function redraw(){const r=wrap.getBoundingClientRect();ctx.clearRect(0,0,r.width,r.height);ctx.fillStyle="#f7f7fb";ctx.fillRect(0,0,r.width,r.height);strokes.forEach(s=>{ctx.strokeStyle=s.color;ctx.lineWidth=s.size;ctx.lineCap="round";ctx.lineJoin="round";ctx.beginPath();s.points.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.stroke();});}
    function point(e){const r=canvas.getBoundingClientRect();return{x:e.clientX-r.left,y:e.clientY-r.top};}
    canvas.onpointerdown=e=>{drawing=true;canvas.setPointerCapture(e.pointerId);current={color:state.paintColor,size:state.paintSize,points:[point(e)]};strokes.push(current);redraw();};
    canvas.onpointermove=e=>{if(!drawing)return;current.points.push(point(e));redraw();};
    canvas.onpointerup=()=>{drawing=false;current=null;};canvas.onpointercancel=()=>{drawing=false;current=null;};
    $("#paint-color",body).oninput=e=>state.paintColor=e.target.value;
    $("#paint-size",body).oninput=e=>state.paintSize=Number(e.target.value);
    $("#paint-undo",body).onclick=()=>{strokes.pop();redraw();};
    $("#paint-clear",body).onclick=()=>{if(confirm("Clear the canvas?")){strokes=[];redraw();}};
    $("#paint-save",body).onclick=()=>{const a=document.createElement("a");a.download="nexora-art.png";a.href=canvas.toDataURL("image/png");a.click();};
    resize();if("ResizeObserver"in window)new ResizeObserver(resize).observe(wrap);else window.addEventListener("resize",resize);
  }

  // Terminal is a safe command simulator, not a system shell.
  function renderTerminal(body) {
    body.innerHTML=`<div class="terminal"><div class="terminal-output" id="terminal-output">NEXORA Terminal [Version 1.0]\nA friendly command simulator. It cannot access your operating system.\nType <b>help</b> to see available commands.\n\n</div><form class="terminal-line" id="terminal-form"><span class="terminal-prompt">guest@nexora:~$</span><input id="terminal-input" class="terminal-input" autocomplete="off" spellcheck="false" aria-label="Terminal command"></form></div>`;
    const out=$("#terminal-output",body),input=$("#terminal-input",body),form=$("#terminal-form",body);
    const write=s=>{out.innerHTML+=escapeHTML(s)+"\n";out.scrollTop=out.scrollHeight;};
    form.onsubmit=e=>{e.preventDefault();const raw=input.value.trim();if(!raw)return;write("guest@nexora:~$ "+raw);const [cmd,...args]=raw.split(" "),arg=args.join(" ");
      const commands={
        help:()=>write("Commands: help, date, time, whoami, about, apps, echo <text>, clear, neofetch, theme <dark|light>, open <app>"),
        date:()=>write(new Date().toLocaleDateString()),
        time:()=>write(new Date().toLocaleTimeString()),
        whoami:()=>write("guest · browser-only session"),
        about:()=>write("NEXORA OS is a fictional desktop environment running in your browser."),
        apps:()=>write(Object.values(appMeta).map(a=>a.name).join(" · ")),
        echo:()=>write(arg),
        clear:()=>{out.textContent="";},
        neofetch:()=>write("  _   _  NEXORA OS\n | \\\\ | | Browser desktop\n |  \\\\| | HTML · CSS · JS\n | |\\\\  | No server required\n |_| \\\\_|"),
        theme:()=>{if(["dark","light"].includes(arg)){save("nexora-theme",arg);applyPrefs();write("Theme changed to "+arg+".");}else write("Usage: theme dark|light");},
        open:()=>{const id=Object.keys(appMeta).find(k=>k===arg.toLowerCase()||appMeta[k].name.toLowerCase()===arg.toLowerCase());if(id){openApp(id);write("Opening "+appMeta[id].name+"…");}else write("App not found. Try: open notes");}
      };
      if(commands[cmd])commands[cmd]();else write("Command not found: "+cmd+". Type help.");
      input.value="";
    };
    input.focus();
  }

  // Global controls.
  document.addEventListener("click",e=>{
    const app=e.target.closest("[data-app]");if(app){openApp(app.dataset.app);return;}
    if(!e.target.closest("#start-menu")&&!e.target.closest("#start-button"))$("#start-menu").classList.add("hidden");
    if(!e.target.closest("#quick-panel")&&!e.target.closest("#tray-toggle")&&!e.target.closest("#quick-settings"))$("#quick-panel").classList.add("hidden");
    if(!e.target.closest("#context-menu"))$("#context-menu").classList.add("hidden");
  });
  $("#start-button").onclick=e=>{e.stopPropagation();$("#start-menu").classList.toggle("hidden");$("#quick-panel").classList.add("hidden");$("#app-search").value="";renderStartApps();};
  $("#app-search").oninput=e=>renderStartApps(e.target.value);
  $("#quick-settings").onclick=()=>{$("#quick-panel").classList.toggle("hidden");$("#start-menu").classList.add("hidden");};
  $("#tray-toggle").onclick=()=>{$("#quick-panel").classList.toggle("hidden");$("#start-menu").classList.add("hidden");};
  $("#close-quick").onclick=()=>$("#quick-panel").classList.add("hidden");
  $("#toggle-theme").onclick=()=>{const next=read("nexora-theme","dark")==="dark"?"light":"dark";save("nexora-theme",next);applyPrefs();notify("Switched to "+next+" mode");};
  $("#quick-wallpaper").onclick=()=>{const n=(read("nexora-wallpaper",0)+1)%4;save("nexora-wallpaper",n);applyPrefs();notify("Wallpaper changed");};
  $("#restart-ui").onclick=()=>{state.windows.forEach(w=>w.remove());state.windows.clear();state.filePath=[];renderRunningDock();$("#start-menu").classList.add("hidden");notify("Desktop refreshed");};
  desktop.addEventListener("contextmenu",e=>{if(e.target.closest(".app-window"))return;e.preventDefault();const menu=$("#context-menu");menu.classList.remove("hidden");menu.style.left=Math.min(e.clientX,innerWidth-200)+"px";menu.style.top=Math.min(e.clientY,innerHeight-140)+"px";});
  $("#context-menu").onclick=e=>{const b=e.target.closest("[data-context]");if(!b)return;const c=b.dataset.context;menuClose();if(c==="settings")openApp("settings");if(c==="wallpaper"){$("#quick-wallpaper").click();}if(c==="refresh")notify("Desktop refreshed");};
  function menuClose(){$("#context-menu").classList.add("hidden");}
  document.addEventListener("keydown",e=>{if(e.key==="Escape"){ $("#start-menu").classList.add("hidden");$("#quick-panel").classList.add("hidden");$("#context-menu").classList.add("hidden");}if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==="k"){e.preventDefault();$("#start-menu").classList.remove("hidden");$("#app-search").focus();}});
  if(read("nexora-tip",true))setTimeout(()=>notify("Tip: open the Start menu to explore your apps."),900);
})();