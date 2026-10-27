# NEXORA OS

A browser-based desktop simulation built with plain HTML, CSS, and vanilla JavaScript. It runs as a static site on GitHub Pages and requires no API keys, server, database, package manager, or build step.

## Features

- Desktop with app icons, Start menu, taskbar, clock, quick settings, and right-click menu
- App windows with minimize, maximize, close, focus order, and desktop dragging
- Notes with automatic browser-local saving and `.txt` export
- Calculator with arithmetic parsing and keyboard support
- Arcade: reaction test, number memory, typing sprint, and Snake
- Settings for light/dark theme, wallpapers, sound preference, and local data reset
- Simulated File Explorer with sample folders and text files
- Music Player with short synthesized previews using the Web Audio API
- Paint app with brush color/size, undo, clear, and PNG export
- Safe simulated Terminal with commands such as `help`, `date`, `apps`, `open notes`, and `theme light`
- Responsive layout for desktop and mobile

## Project structure

```text
nexora-os/
├── index.html
├── style.css
├── app.js
└── README.md
```

## Run locally

You can open `index.html` directly in a modern browser. For the best experience, use a small local static server or a code editor's Live Server extension, though no build step is needed.

## Deploy to GitHub Pages

1. Create a new repository on GitHub, for example `nexora-os`.
2. Upload `index.html`, `style.css`, `app.js`, and `README.md` to the repository root.
3. Open **Settings → Pages** in the repository.
4. Under **Build and deployment**, choose **Deploy from a branch**.
5. Select your main branch (usually `main`) and the `/(root)` folder, then save.
6. Wait for GitHub Pages to publish the site. The URL will look like `https://YOUR-USERNAME.github.io/nexora-os/`.

If using a project repository under an organization, the same steps apply. For a custom domain, configure it under Pages after DNS is set up.

## Browser storage and privacy

- Notes, scores, themes, and wallpaper settings use `localStorage` on the current browser/device.
- They do not sync between devices and can be cleared by browser settings or the app's **Settings → Clear local app data** action.
- File Explorer is simulated and cannot read or write actual computer files.
- Terminal is a command simulator, not a system shell.
- Music Player creates short synthesized sound previews in the browser; it does not stream commercial music.
- No analytics, external API calls, or third-party libraries are included.

## Notes

This is a frontend desktop simulation, not a real operating system. It cannot access operating-system functions or provide cloud accounts, multiplayer, or cross-device sync without adding a backend or external service.
