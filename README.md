# Othello: GitHub Copilot Agent Mode Build

This repository is a single-player browser implementation of Othello (Reversi), built with React, TypeScript, and Vite. Play online here: https://nickallan-kerv.github.io/othello/

![Othello gameplay](docs/Gameplay.png)

## Development Approach

This project was developed entirely using GitHub Copilot Agent mode.

- No Ask mode was used during development.
- No Plan mode was used during development.

This project was not developed using a Specification-Driven workflow.

## Features

- Full 8x8 Othello rules, including legal-move detection, disc flipping, pass turns, and game-over detection
- Play as Black against AI-controlled White
- Three AI levels:
  - `Easy`: random legal move
  - `Medium`: greedy move that maximizes immediate flips
  - `Hard`: minimax with alpha-beta pruning and positional evaluation
- Legal-move hints and hover preview for pending flips
- Move history with preview-on-hover and jump-back on earlier checkpoints
- Undo, redo, and full reset controls
- Animated flip effects and highlighted last move

## Gameplay Notes

- You play as Black and move first.
- If a side has no legal moves, that side automatically passes.
- The game ends when neither side has a legal move.
- Final score is total black discs versus white discs.

## Running Locally

Install dependencies:

```bash
npm install
```

Run the dev server:

```bash
npm run dev
```

Open `http://localhost:5173`.

Launch and debug tasks are documented in `.vscode/launch.json`.

## GitHub Pages Freshness Check

- Each Pages deployment stamps a unique build ID into the app UI and publishes `version.txt`.
- After pushing to `master`, wait for the `Deploy to GitHub Pages` workflow to complete.
- Verify the live deployment by checking:
  - App UI line near the score: `Build <id>`
  - `https://nickallan-kerv.github.io/othello/version.txt`
- If the build ID and `version.txt` match the latest workflow run, users are seeing the newest release.

## Testing

Tests in this repository were added retrospectively after core gameplay features were implemented.

Run unit tests:

```bash
npm run test
```

Optional coverage run:

```bash
npx vitest run --coverage
```
