# Pixel Runner

A retro pixel-art sci-fi endless runner built with TanStack Start and HTML5 Canvas.

## Overview

Play as an auto-running astronaut on an alien planet, jumping over obstacles and dodging hazards. Collect energy cells for bonus points and chase the high score — all rendered in crunchy pixel art with no external sprite assets.

## Tech Stack

- **Framework:** TanStack Start (React + Vite)
- **Styling:** Tailwind CSS v4
- **Rendering:** HTML5 Canvas (`image-rendering: pixelated`)
- **Font:** Press Start 2P (`@fontsource/press-start-2p`)
- **Language:** TypeScript
- **Leaderboard:** Supabase (Postgres + REST API)



## How to Play

| Input | Action |
|-------|--------|
| `Space` / `Up Arrow` / `W` | Jump (hold for higher jump) |
| `Down Arrow` / `S` | Slide (duck under drones, UFOs, missiles) |
| `Tap` (mobile) | Jump |
| `Swipe down` (mobile) | Slide |

## Obstacles

| Type | Behavior |
|------|----------|
| **Rock** | Ground hazard — jump over |
| **Crystal** | Tall ground spike — jump over |
| **Spikes** | Low ground hazard — jump over |
| **Alien** | 4-legged walker — jump over |
| **Drone** | Hovers at head height — slide under |
| **UFO** | Flies overhead — slide under |
| **Missile** | Fast projectile at head height — slide under |

Collectibles (cyan energy cells) float above the ground and award +50 points each.

## Scoring

- **Distance:** +0.15 × current speed per frame
- **Energy cells:** +50 each
- **Speed increases** as score rises (base 2.2, +1 per 500 points, capped at +4)

## Leaderboard

- Enter your name on the title screen before starting
- Submit your score after game over (score + run duration)
- View the top 15 scores in the leaderboard overlay
- Player name persists across sessions via localStorage

## Visual Style

- **Palette:** deep space indigo `#0b0b2a`, magenta `#ff2e88`, cyan `#3ef0ff`, alien ground `#2a1b4a` with `#7a3cff` highlights
- **Parallax:** 3 layers — distant stars (twinkling), mid mountains + planet + stations, foreground mountains
- **Effects:** CRT scanline overlay, screen shake on death, particle bursts, shooting stars, animated jetpack flame
- **HUD:** pixel font score (top-left), high score (top-right)

## License

MIT
