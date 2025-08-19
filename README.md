# AstroLingua

A retro-style Asteroids game where players learn Chinese by shooting the asteroid labeled with the correct translation of a given English word.

## Features
- Multiple levels with increasing difficulty
- Score, lives, hits, misses, and accuracy HUD
 - Teacher-uploaded vocabulary lists (CSV or JSON)
- Game Over overlay with accuracy stats
- Keyboard controls: WASD/Arrows to move, Space to shoot

## Use your own vocabulary
- CSV format: each line `english, chinese`
- JSON format: array of objects: `[{"en":"hello","zh":"你好"}, ...]`

## Run locally
Just open `index.html` in your browser.

On macOS, you can also serve locally to avoid any file URL issues:

```bash
python3 -m http.server 8000
```

Then open http://localhost:8000/ in your browser.

## Notes
- The canvas is sized 960x600 for a retro arcade feel and scales responsively.
- The game ensures at least one correct asteroid per wave. Clearing the wave advances the level.
- Accuracy = hits / (hits + misses).
