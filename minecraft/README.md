# Craftbox — Minecraft from scratch

A playable, browser-based voxel sandbox inspired by Minecraft, written from
scratch in vanilla JavaScript (ES modules). The voxel engine — procedural world
generation, chunk meshing, physics, collision, and block interaction — is all
hand-written; [Three.js](https://threejs.org/) is used only as the WebGL
rendering layer.

## Play

It's a static site — no build step. Serve the folder and open it:

```bash
cd minecraft
python3 -m http.server 8080
# then open http://localhost:8080
```

(Any static file server works. Opening `index.html` directly via `file://`
will not work because ES modules require HTTP.)

Three.js is loaded from a CDN via an import map, so an internet connection is
needed the first time you load the page.

## Controls

| Input | Action |
| --- | --- |
| `W` `A` `S` `D` | Move |
| Mouse | Look around |
| `Space` | Jump / swim up |
| `Shift` | Sprint |
| Left click | Break block |
| Right click | Place selected block |
| `1`–`9` / scroll | Select hotbar block |
| `E` | Open inventory (assign any block to the selected slot) |
| `F` | Toggle fly mode |
| `Ctrl` | Descend (while flying) |

## Features

- **Infinite procedural terrain** — fractal Perlin noise drives continents,
  mountains, and rolling hills, with carved 3D-noise caves.
- **Biomes** — plains, forest, desert, and snow, each with their own surface
  blocks, foliage, and decoration density.
- **Chunk streaming** — 16×16×128 chunks generate and mesh around the player on
  a per-frame budget, and unload when far away.
- **Optimized meshing** — only block faces exposed to air/transparent neighbors
  are emitted, with baked-in ambient occlusion and directional face shading.
- **Full block physics** — AABB collision, gravity, jumping, sprinting,
  flying, and buoyant swimming.
- **Build & mine** — DDA voxel raycasting for precise block targeting; break and
  place 20 block types including ores, glass, water, and pumpkins.
- **Day/night cycle** — moving sun and moon, drifting clouds, and a sky that
  shifts through dawn, day, dusk, and night with matching fog.
- **Procedural textures** — every block texture is drawn at runtime onto a
  texture atlas, so the game ships with zero image assets.

## Project layout

```
minecraft/
├── index.html              # entry point + import map
├── css/style.css           # HUD / overlay / inventory styling
└── js/
    ├── main.js             # boots the game
    ├── Game.js             # scene, renderer, chunk streaming, interaction, day/night
    ├── engine/Noise.js     # seedable Perlin noise + fBm
    ├── world/
    │   ├── blocks.js       # block registry + procedural texture atlas
    │   ├── World.js        # chunk storage + terrain/biome/cave/ore generation
    │   └── mesher.js       # voxel → geometry with ambient occlusion
    ├── player/
    │   ├── Player.js       # physics + AABB collision
    │   └── Controls.js     # pointer-lock mouse-look + keyboard input
    └── ui/HUD.js           # hotbar + inventory picker + block icons
```
