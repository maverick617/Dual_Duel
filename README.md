# Dual Duel

A local 2-player browser fighting game.

## Rules

- Two players control one character each.
- Each player starts with **10 blood**.
- Hit your opponent to remove **1 blood**.
- Blood drops appear on the map and can be collected to heal **+1 blood** (up to 10).
- First player to reduce the opponent to 0 blood wins.

## Features

- Sprite-style character rendering with movement and attack animation
- Attack cooldown indicators in the HUD
- Configurable controls (stored in browser localStorage)
- Blood pickup/heal system

## Default Controls

- **Player 1**: Move `W A S D`, Attack `F`
- **Player 2**: Move `↑ ↓ ← →`, Attack `L`

You can remap keys in the **Configurable Controls** section in-game.

## Run locally (terminal)

Clone the repository first, then enter the project folder:

```zsh
git clone https://github.com/maverick617/Dual_Duel.git
cd Dual_Duel
```

### Option A: with Node.js + npm

```zsh
npm run start
```

Then open `http://localhost:8080`.

### Option B: with Python (if npm is not available)

```zsh
python3 -m http.server 8080
```

Then open `http://localhost:8080`.

## Test

```zsh
npm test
```

## Deploy to GitHub Pages

This project is static, so you can deploy directly from the repository.

1. Push the project to GitHub.
2. In GitHub: **Repository Settings → Pages**.
3. Under **Build and deployment**, set:
	- **Source**: `Deploy from a branch`
	- **Branch**: `main` (or your default branch)
	- **Folder**: `/ (root)`
4. Save, wait for deployment, then open the generated Pages URL.

### Important for GitHub Pages

- Keep file paths relative (already configured, e.g. `./src/main.js`).
- If you rename the default branch (`main`/`master`), update Pages settings accordingly.
