# Minimal Darklike Prototype

This is a pure frontend mini game project (`HTML`, `CSS`, `JavaScript`) that can be deployed directly to GitHub Pages without any backend service.

## Project Introduction
- Pure static site, no server required.
- Game homepage is `index.html`.
- Desktop controls: `WASD` move, `Space` attack.
- Mobile controls: virtual joystick + attack button.
- Includes a built-in QR generator panel in `index.html`.
- Includes standalone `qr-generator.html` for generating QR codes from any URL.

## Project Structure
```text
.
- index.html
- style.css
- game.js
- qr-generator.html
- qrcode.png
- README.md
- .gitignore
```

## Run Locally
### Option 1: Open directly
Open `index.html` in your browser.

### Option 2: Use a local static server
Run in project folder:
```bash
python -m http.server 8000
```

Then open:
```text
http://localhost:8000/
```

## GitHub Upload Steps
1. Create a new repository on GitHub.
2. Upload all project files in this folder to the repository root.
3. Make sure `index.html` stays at repository root.
4. Commit and push to `main`.

## GitHub Pages Enable Steps
1. Open repository `Settings`.
2. Go to `Pages`.
3. In `Build and deployment`:
   - `Source`: `Deploy from a branch`
   - `Branch`: `main`
   - `Folder`: `/ (root)`
4. Save and wait for deployment.

## GitHub Pages URL Format
```text
https://your-username.github.io/your-repo-name/
```

## QR Generator Usage
1. Open `qr-generator.html` (or the QR panel in `index.html`).
2. Paste your public URL.
3. Click `Generate QR`.
4. Click `Download PNG`.

