// Block type registry and procedural texture atlas.
// Each tile in the atlas is drawn procedurally so the game needs no external image assets.

import { mulberry32 } from '../engine/Noise.js';

export const ATLAS_COLS = 8;
export const ATLAS_ROWS = 4;
export const TILE_PX = 16;

// Tile indices into the atlas (col + row*ATLAS_COLS)
export const TILE = {
  GRASS_TOP: 0,
  GRASS_SIDE: 1,
  DIRT: 2,
  STONE: 3,
  SAND: 4,
  LOG_SIDE: 5,
  LOG_TOP: 6,
  LEAVES: 7,
  WATER: 8,
  COBBLE: 9,
  PLANKS: 10,
  GLASS: 11,
  SNOW: 12,
  BEDROCK: 13,
  GRAVEL: 14,
  COAL_ORE: 15,
  IRON_ORE: 16,
  GOLD_ORE: 17,
  DIAMOND_ORE: 18,
  BRICK: 19,
  SNOW_GRASS: 20,
  PUMPKIN_SIDE: 21,
  PUMPKIN_TOP: 22,
  CACTUS_SIDE: 23,
  CACTUS_TOP: 24,
};

// Block ids. 0 is always air.
export const BLOCK = {
  AIR: 0,
  GRASS: 1,
  DIRT: 2,
  STONE: 3,
  SAND: 4,
  LOG: 5,
  LEAVES: 6,
  WATER: 7,
  COBBLE: 8,
  PLANKS: 9,
  GLASS: 10,
  SNOW: 11,
  BEDROCK: 12,
  GRAVEL: 13,
  COAL_ORE: 14,
  IRON_ORE: 15,
  GOLD_ORE: 16,
  DIAMOND_ORE: 17,
  BRICK: 18,
  PUMPKIN: 19,
  CACTUS: 20,
};

// Per-block definitions. tiles: {top, side, bottom}
export const BLOCKS = {
  [BLOCK.AIR]: { name: 'Air', solid: false, transparent: true },
  [BLOCK.GRASS]: { name: 'Grass', tiles: { top: TILE.GRASS_TOP, side: TILE.GRASS_SIDE, bottom: TILE.DIRT } },
  [BLOCK.DIRT]: { name: 'Dirt', tiles: all(TILE.DIRT) },
  [BLOCK.STONE]: { name: 'Stone', tiles: all(TILE.STONE) },
  [BLOCK.SAND]: { name: 'Sand', tiles: all(TILE.SAND) },
  [BLOCK.LOG]: { name: 'Wood Log', tiles: { top: TILE.LOG_TOP, side: TILE.LOG_SIDE, bottom: TILE.LOG_TOP } },
  [BLOCK.LEAVES]: { name: 'Leaves', tiles: all(TILE.LEAVES), transparent: true, foliage: true },
  [BLOCK.WATER]: { name: 'Water', tiles: all(TILE.WATER), solid: false, transparent: true, liquid: true },
  [BLOCK.COBBLE]: { name: 'Cobblestone', tiles: all(TILE.COBBLE) },
  [BLOCK.PLANKS]: { name: 'Wood Planks', tiles: all(TILE.PLANKS) },
  [BLOCK.GLASS]: { name: 'Glass', tiles: all(TILE.GLASS), transparent: true },
  [BLOCK.SNOW]: { name: 'Snow Block', tiles: { top: TILE.SNOW, side: TILE.SNOW_GRASS, bottom: TILE.DIRT } },
  [BLOCK.BEDROCK]: { name: 'Bedrock', tiles: all(TILE.BEDROCK) },
  [BLOCK.GRAVEL]: { name: 'Gravel', tiles: all(TILE.GRAVEL) },
  [BLOCK.COAL_ORE]: { name: 'Coal Ore', tiles: all(TILE.COAL_ORE) },
  [BLOCK.IRON_ORE]: { name: 'Iron Ore', tiles: all(TILE.IRON_ORE) },
  [BLOCK.GOLD_ORE]: { name: 'Gold Ore', tiles: all(TILE.GOLD_ORE) },
  [BLOCK.DIAMOND_ORE]: { name: 'Diamond Ore', tiles: all(TILE.DIAMOND_ORE) },
  [BLOCK.BRICK]: { name: 'Bricks', tiles: all(TILE.BRICK) },
  [BLOCK.PUMPKIN]: { name: 'Pumpkin', tiles: { top: TILE.PUMPKIN_TOP, side: TILE.PUMPKIN_SIDE, bottom: TILE.PUMPKIN_TOP } },
  [BLOCK.CACTUS]: { name: 'Cactus', tiles: { top: TILE.CACTUS_TOP, side: TILE.CACTUS_SIDE, bottom: TILE.CACTUS_TOP }, transparent: true },
};

function all(t) {
  return { top: t, side: t, bottom: t };
}

export function isSolid(id) {
  const b = BLOCKS[id];
  return b ? b.solid !== false : false;
}

export function isTransparent(id) {
  const b = BLOCKS[id];
  return b ? b.transparent === true : false;
}

export function isLiquid(id) {
  const b = BLOCKS[id];
  return b ? b.liquid === true : false;
}

export function tileFor(id, face) {
  // face: 'top' | 'bottom' | 'side'
  const b = BLOCKS[id];
  if (!b || !b.tiles) return 0;
  return b.tiles[face] ?? b.tiles.side;
}

// ---- Procedural texture atlas -------------------------------------------------

function shade(hex, amt) {
  const r = Math.max(0, Math.min(255, ((hex >> 16) & 255) + amt));
  const g = Math.max(0, Math.min(255, ((hex >> 8) & 255) + amt));
  const b = Math.max(0, Math.min(255, (hex & 255) + amt));
  return `rgb(${r},${g},${b})`;
}

function noisyFill(ctx, x0, y0, color, speckle = 18, seed = 1) {
  const rand = mulberry32(seed);
  ctx.fillStyle = shade(color, 0);
  ctx.fillRect(x0, y0, TILE_PX, TILE_PX);
  for (let py = 0; py < TILE_PX; py++) {
    for (let px = 0; px < TILE_PX; px++) {
      const n = (rand() - 0.5) * 2 * speckle;
      ctx.fillStyle = shade(color, Math.round(n));
      ctx.fillRect(x0 + px, y0 + py, 1, 1);
    }
  }
}

function tilePos(index) {
  const col = index % ATLAS_COLS;
  const row = Math.floor(index / ATLAS_COLS);
  return { x: col * TILE_PX, y: row * TILE_PX };
}

// Draws the full atlas onto a canvas and returns it.
export function buildAtlasCanvas() {
  const canvas = document.createElement('canvas');
  canvas.width = ATLAS_COLS * TILE_PX;
  canvas.height = ATLAS_ROWS * TILE_PX;
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;

  const draw = (idx, fn) => {
    const { x, y } = tilePos(idx);
    fn(x, y);
  };

  draw(TILE.GRASS_TOP, (x, y) => noisyFill(ctx, x, y, 0x5fae3b, 22, 11));
  draw(TILE.GRASS_SIDE, (x, y) => {
    noisyFill(ctx, x, y, 0x8b6239, 16, 12); // dirt base
    // grass overhang on top
    const rand = mulberry32(99);
    for (let px = 0; px < TILE_PX; px++) {
      const h = 3 + Math.floor(rand() * 3);
      for (let py = 0; py < h; py++) {
        ctx.fillStyle = shade(0x5fae3b, Math.round((rand() - 0.5) * 30));
        ctx.fillRect(x + px, y + py, 1, 1);
      }
    }
  });
  draw(TILE.DIRT, (x, y) => noisyFill(ctx, x, y, 0x8b6239, 20, 13));
  draw(TILE.STONE, (x, y) => noisyFill(ctx, x, y, 0x888888, 16, 14));
  draw(TILE.SAND, (x, y) => noisyFill(ctx, x, y, 0xe0d6a0, 14, 15));
  draw(TILE.LOG_SIDE, (x, y) => {
    noisyFill(ctx, x, y, 0x6b4a2b, 10, 16);
    ctx.fillStyle = shade(0x4a3320, 0);
    for (let py = 0; py < TILE_PX; py += 4) ctx.fillRect(x, y + py, TILE_PX, 1);
  });
  draw(TILE.LOG_TOP, (x, y) => {
    noisyFill(ctx, x, y, 0xb08850, 10, 17);
    ctx.strokeStyle = shade(0x6b4a2b, 0);
    for (let r = 6; r > 0; r -= 2) {
      ctx.beginPath();
      ctx.arc(x + 8, y + 8, r, 0, Math.PI * 2);
      ctx.stroke();
    }
  });
  draw(TILE.LEAVES, (x, y) => noisyFill(ctx, x, y, 0x3f7d2e, 30, 18));
  draw(TILE.WATER, (x, y) => noisyFill(ctx, x, y, 0x3a6fb0, 10, 19));
  draw(TILE.COBBLE, (x, y) => {
    noisyFill(ctx, x, y, 0x7a7a7a, 8, 20);
    const rand = mulberry32(21);
    for (let i = 0; i < 8; i++) {
      ctx.fillStyle = shade(0x5a5a5a, 0);
      const px = Math.floor(rand() * 12);
      const py = Math.floor(rand() * 12);
      ctx.fillRect(x + px, y + py, 3, 3);
    }
  });
  draw(TILE.PLANKS, (x, y) => {
    noisyFill(ctx, x, y, 0xc09255, 8, 22);
    ctx.fillStyle = shade(0x6b4a2b, 0);
    for (let py = 0; py < TILE_PX; py += 5) ctx.fillRect(x, y + py, TILE_PX, 1);
    ctx.fillRect(x + 7, y, 1, TILE_PX);
  });
  draw(TILE.GLASS, (x, y) => {
    ctx.clearRect(x, y, TILE_PX, TILE_PX);
    ctx.strokeStyle = 'rgba(220,240,255,0.9)';
    ctx.strokeRect(x + 0.5, y + 0.5, TILE_PX - 1, TILE_PX - 1);
    ctx.strokeStyle = 'rgba(200,230,255,0.5)';
    ctx.beginPath();
    ctx.moveTo(x + 2, y + 12);
    ctx.lineTo(x + 12, y + 2);
    ctx.stroke();
  });
  draw(TILE.SNOW, (x, y) => noisyFill(ctx, x, y, 0xf4f8ff, 6, 24));
  draw(TILE.SNOW_GRASS, (x, y) => {
    noisyFill(ctx, x, y, 0x8b6239, 16, 25);
    for (let px = 0; px < TILE_PX; px++) ctx.fillStyle = shade(0xf4f8ff, 0), ctx.fillRect(x + px, y, 1, 4);
  });
  draw(TILE.BEDROCK, (x, y) => {
    noisyFill(ctx, x, y, 0x444444, 40, 26);
  });
  draw(TILE.GRAVEL, (x, y) => noisyFill(ctx, x, y, 0x9a9088, 24, 27));
  const ore = (idx, base, spot, seed) =>
    draw(idx, (x, y) => {
      noisyFill(ctx, x, y, 0x888888, 12, seed);
      const rand = mulberry32(seed + 1);
      for (let i = 0; i < 6; i++) {
        ctx.fillStyle = shade(spot, 0);
        const px = Math.floor(rand() * 13);
        const py = Math.floor(rand() * 13);
        ctx.fillRect(x + px, y + py, 2, 2);
      }
    });
  ore(TILE.COAL_ORE, 0x888888, 0x2a2a2a, 30);
  ore(TILE.IRON_ORE, 0x888888, 0xc8a17a, 31);
  ore(TILE.GOLD_ORE, 0x888888, 0xf0d040, 32);
  ore(TILE.DIAMOND_ORE, 0x888888, 0x60e0e0, 33);
  draw(TILE.BRICK, (x, y) => {
    noisyFill(ctx, x, y, 0xa84b3a, 8, 34);
    ctx.fillStyle = shade(0xdddddd, 0);
    for (let py = 0; py < TILE_PX; py += 4) ctx.fillRect(x, y + py, TILE_PX, 1);
    for (let py = 0; py < TILE_PX; py += 8) {
      ctx.fillRect(x + 7, y + py, 1, 4);
      ctx.fillRect(x + 0, y + py + 4, 1, 4);
      ctx.fillRect(x + 15, y + py + 4, 1, 4);
    }
  });
  draw(TILE.PUMPKIN_SIDE, (x, y) => {
    noisyFill(ctx, x, y, 0xe08a20, 10, 35);
    ctx.fillStyle = shade(0xb06010, 0);
    for (let px = 2; px < TILE_PX; px += 4) ctx.fillRect(x + px, y, 1, TILE_PX);
  });
  draw(TILE.PUMPKIN_TOP, (x, y) => noisyFill(ctx, x, y, 0xc87818, 10, 36));
  draw(TILE.CACTUS_SIDE, (x, y) => noisyFill(ctx, x, y, 0x4f8f3f, 12, 37));
  draw(TILE.CACTUS_TOP, (x, y) => noisyFill(ctx, x, y, 0x6fae5f, 12, 38));

  return canvas;
}
