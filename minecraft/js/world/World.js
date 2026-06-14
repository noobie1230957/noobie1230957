// World data: chunk storage, procedural terrain generation, and block access.
import { Perlin, mulberry32 } from '../engine/Noise.js';
import { BLOCK } from './blocks.js';

export const CHUNK_SIZE = 16;
export const WORLD_HEIGHT = 128;
export const SEA_LEVEL = 40;

export function chunkKey(cx, cz) {
  return cx + ',' + cz;
}

export class Chunk {
  constructor(cx, cz) {
    this.cx = cx;
    this.cz = cz;
    this.data = new Uint8Array(CHUNK_SIZE * WORLD_HEIGHT * CHUNK_SIZE);
    this.generated = false;
    this.dirty = true; // needs (re)meshing
    this.meshes = null; // { opaque, water, glass } THREE.Mesh
  }

  static index(lx, ly, lz) {
    return lx + lz * CHUNK_SIZE + ly * CHUNK_SIZE * CHUNK_SIZE;
  }

  get(lx, ly, lz) {
    return this.data[Chunk.index(lx, ly, lz)];
  }

  set(lx, ly, lz, id) {
    this.data[Chunk.index(lx, ly, lz)] = id;
  }
}

export class World {
  constructor(seed = 1337) {
    this.seed = seed;
    this.chunks = new Map();
    this.perlin = new Perlin(seed);
    this.perlin2 = new Perlin(seed + 9991);
    this.perlin3 = new Perlin(seed + 4242);
  }

  getChunk(cx, cz) {
    return this.chunks.get(chunkKey(cx, cz));
  }

  ensureChunk(cx, cz) {
    let c = this.getChunk(cx, cz);
    if (!c) {
      c = new Chunk(cx, cz);
      this.chunks.set(chunkKey(cx, cz), c);
    }
    if (!c.generated) this.generateChunk(c);
    return c;
  }

  // ---- Global block access --------------------------------------------------
  getBlock(x, y, z) {
    if (y < 0 || y >= WORLD_HEIGHT) return BLOCK.AIR;
    const cx = Math.floor(x / CHUNK_SIZE);
    const cz = Math.floor(z / CHUNK_SIZE);
    const c = this.getChunk(cx, cz);
    if (!c || !c.generated) return BLOCK.AIR;
    const lx = x - cx * CHUNK_SIZE;
    const lz = z - cz * CHUNK_SIZE;
    return c.get(lx, y, lz);
  }

  setBlock(x, y, z, id) {
    if (y < 0 || y >= WORLD_HEIGHT) return;
    const cx = Math.floor(x / CHUNK_SIZE);
    const cz = Math.floor(z / CHUNK_SIZE);
    const c = this.ensureChunk(cx, cz);
    const lx = x - cx * CHUNK_SIZE;
    const lz = z - cz * CHUNK_SIZE;
    c.set(lx, y, lz, id);
    c.dirty = true;
    // Mark neighbor chunks dirty if we touched a border block.
    if (lx === 0) this.markDirty(cx - 1, cz);
    if (lx === CHUNK_SIZE - 1) this.markDirty(cx + 1, cz);
    if (lz === 0) this.markDirty(cx, cz - 1);
    if (lz === CHUNK_SIZE - 1) this.markDirty(cx, cz + 1);
  }

  markDirty(cx, cz) {
    const c = this.getChunk(cx, cz);
    if (c) c.dirty = true;
  }

  // ---- Terrain generation ---------------------------------------------------
  heightAt(x, z) {
    const p = this.perlin;
    // Large rolling continents
    const base = p.fbm2(x * 0.0065, z * 0.0065, 5, 2.0, 0.5);
    // Mountain ridges (only positive parts add height)
    const m = Math.max(0, this.perlin2.fbm2(x * 0.0016, z * 0.0016, 4, 2.0, 0.5));
    const detail = p.fbm2(x * 0.03, z * 0.03, 3, 2.0, 0.5) * 2.5;
    let h = SEA_LEVEL + base * 20 + Math.pow(m, 1.4) * 55 + detail;
    return Math.floor(h);
  }

  biomeAt(x, z) {
    const temp = this.perlin2.noise2(x * 0.0009 + 1000, z * 0.0009 + 1000);
    const humid = this.perlin3.noise2(x * 0.0009 - 1000, z * 0.0009 - 1000);
    if (temp < -0.32) return 'snow';
    if (temp > 0.35 && humid < -0.05) return 'desert';
    if (humid > 0.18) return 'forest';
    return 'plains';
  }

  generateChunk(chunk) {
    const { cx, cz } = chunk;
    const ox = cx * CHUNK_SIZE;
    const oz = cz * CHUNK_SIZE;
    const treeSpots = [];

    for (let lx = 0; lx < CHUNK_SIZE; lx++) {
      for (let lz = 0; lz < CHUNK_SIZE; lz++) {
        const wx = ox + lx;
        const wz = oz + lz;
        const h = Math.max(1, Math.min(WORLD_HEIGHT - 1, this.heightAt(wx, wz)));
        const biome = this.biomeAt(wx, wz);

        for (let y = 0; y <= h; y++) {
          let id = BLOCK.STONE;
          if (y === 0) {
            id = BLOCK.BEDROCK;
          } else if (y === h) {
            // surface block
            if (biome === 'desert') id = BLOCK.SAND;
            else if (biome === 'snow') id = h <= SEA_LEVEL + 1 ? BLOCK.GRAVEL : BLOCK.SNOW;
            else if (h <= SEA_LEVEL) id = BLOCK.SAND; // beaches / underwater
            else id = BLOCK.GRASS;
          } else if (y > h - 4) {
            id = biome === 'desert' ? BLOCK.SAND : BLOCK.DIRT;
          } else {
            id = this.oreAt(wx, y, wz);
          }

          // Cave carving (don't carve near surface or bedrock)
          if (y > 3 && y < h - 2) {
            const cave = this.perlin3.noise3(wx * 0.045, y * 0.06, wz * 0.045);
            const cave2 = this.perlin.noise3(wx * 0.045 + 100, y * 0.06, wz * 0.045 + 100);
            if (cave > 0.55 && cave2 > 0.3) id = BLOCK.AIR;
          }

          if (id !== BLOCK.AIR) chunk.set(lx, y, lz, id);
        }

        // Water fill up to sea level
        for (let y = h + 1; y <= SEA_LEVEL; y++) {
          chunk.set(lx, y, lz, BLOCK.WATER);
        }

        // Surface decorations (kept inside chunk margins so canopies don't cross borders)
        if (h > SEA_LEVEL && chunk.get(lx, h, lz) === (biome === 'desert' ? BLOCK.SAND : BLOCK.GRASS)) {
          if (lx >= 2 && lx <= CHUNK_SIZE - 3 && lz >= 2 && lz <= CHUNK_SIZE - 3) {
            const r = this.hash01(wx, wz);
            if (biome === 'forest' && r > 0.86) treeSpots.push([lx, h + 1, lz, 'tree']);
            else if (biome === 'plains' && r > 0.975) treeSpots.push([lx, h + 1, lz, 'tree']);
            else if (biome === 'snow' && r > 0.97) treeSpots.push([lx, h + 1, lz, 'tree']);
            else if (biome === 'desert' && r > 0.985) treeSpots.push([lx, h + 1, lz, 'cactus']);
            else if (biome !== 'desert' && r < 0.01) treeSpots.push([lx, h + 1, lz, 'pumpkin']);
          }
        }
      }
    }

    for (const [lx, ly, lz, kind] of treeSpots) {
      if (kind === 'tree') this.placeTree(chunk, lx, ly, lz);
      else if (kind === 'cactus') this.placeCactus(chunk, lx, ly, lz);
      else if (kind === 'pumpkin') chunk.set(lx, ly, lz, BLOCK.PUMPKIN);
    }

    chunk.generated = true;
    chunk.dirty = true;
  }

  oreAt(wx, y, wz) {
    // Ore distribution by depth using 3D noise veins.
    const vein = (off, scale) => this.perlin2.noise3((wx + off) * scale, (y + off) * scale, (wz + off) * scale);
    if (y < 16 && vein(500, 0.12) > 0.78) return BLOCK.DIAMOND_ORE;
    if (y < 28 && vein(900, 0.11) > 0.74) return BLOCK.GOLD_ORE;
    if (y < 48 && vein(1300, 0.1) > 0.7) return BLOCK.IRON_ORE;
    if (vein(1700, 0.09) > 0.66) return BLOCK.COAL_ORE;
    if (vein(2100, 0.08) > 0.8) return BLOCK.GRAVEL;
    return BLOCK.STONE;
  }

  placeTree(chunk, lx, ly, lz) {
    const trunk = 4 + Math.floor(this.hash01(lx * 7 + chunk.cx, lz * 13 + chunk.cz) * 3);
    const top = ly + trunk;
    // Leaves canopy
    for (let dy = -2; dy <= 1; dy++) {
      const radius = dy <= -1 ? 2 : 1;
      for (let dx = -radius; dx <= radius; dx++) {
        for (let dz = -radius; dz <= radius; dz++) {
          if (Math.abs(dx) === radius && Math.abs(dz) === radius && dy >= 0) continue;
          const x = lx + dx;
          const z = lz + dz;
          const y = top + dy;
          if (x < 0 || x >= CHUNK_SIZE || z < 0 || z >= CHUNK_SIZE || y >= WORLD_HEIGHT) continue;
          if (chunk.get(x, y, z) === BLOCK.AIR) chunk.set(x, y, z, BLOCK.LEAVES);
        }
      }
    }
    // Trunk
    for (let y = ly; y < top; y++) {
      if (y < WORLD_HEIGHT) chunk.set(lx, y, lz, BLOCK.LOG);
    }
  }

  placeCactus(chunk, lx, ly, lz) {
    const height = 2 + Math.floor(this.hash01(lx + chunk.cx * 3, lz + chunk.cz * 5) * 3);
    for (let i = 0; i < height; i++) {
      if (ly + i < WORLD_HEIGHT) chunk.set(lx, ly + i, lz, BLOCK.CACTUS);
    }
  }

  hash01(a, b) {
    // Deterministic hash → [0,1)
    const r = mulberry32((a * 73856093) ^ (b * 19349663) ^ this.seed);
    return r();
  }
}
