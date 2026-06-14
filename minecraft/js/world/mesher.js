// Converts chunk voxel data into THREE geometry.
// Only faces exposed to air/transparent neighbors are emitted. Per-vertex
// ambient occlusion and directional face shading are baked into vertex colors.
import * as THREE from 'three';
import { CHUNK_SIZE, WORLD_HEIGHT } from './World.js';
import {
  BLOCK,
  isSolid,
  isTransparent,
  isLiquid,
  tileFor,
  ATLAS_COLS,
  ATLAS_ROWS,
  TILE_PX,
} from './blocks.js';

// Canonical cube face data (CCW winding when viewed from outside).
const FACES = [
  {
    dir: [-1, 0, 0], uvFace: 'side', shade: 0.72,
    corners: [
      { pos: [0, 1, 0], uv: [0, 1] },
      { pos: [0, 0, 0], uv: [0, 0] },
      { pos: [0, 1, 1], uv: [1, 1] },
      { pos: [0, 0, 1], uv: [1, 0] },
    ],
  },
  {
    dir: [1, 0, 0], uvFace: 'side', shade: 0.72,
    corners: [
      { pos: [1, 1, 1], uv: [0, 1] },
      { pos: [1, 0, 1], uv: [0, 0] },
      { pos: [1, 1, 0], uv: [1, 1] },
      { pos: [1, 0, 0], uv: [1, 0] },
    ],
  },
  {
    dir: [0, -1, 0], uvFace: 'bottom', shade: 0.5,
    corners: [
      { pos: [1, 0, 1], uv: [1, 0] },
      { pos: [0, 0, 1], uv: [0, 0] },
      { pos: [1, 0, 0], uv: [1, 1] },
      { pos: [0, 0, 0], uv: [0, 1] },
    ],
  },
  {
    dir: [0, 1, 0], uvFace: 'top', shade: 1.0,
    corners: [
      { pos: [0, 1, 1], uv: [1, 1] },
      { pos: [1, 1, 1], uv: [0, 1] },
      { pos: [0, 1, 0], uv: [1, 0] },
      { pos: [1, 1, 0], uv: [0, 0] },
    ],
  },
  {
    dir: [0, 0, -1], uvFace: 'side', shade: 0.86,
    corners: [
      { pos: [1, 0, 0], uv: [0, 0] },
      { pos: [0, 0, 0], uv: [1, 0] },
      { pos: [1, 1, 0], uv: [0, 1] },
      { pos: [0, 1, 0], uv: [1, 1] },
    ],
  },
  {
    dir: [0, 0, 1], uvFace: 'side', shade: 0.86,
    corners: [
      { pos: [0, 0, 1], uv: [0, 0] },
      { pos: [1, 0, 1], uv: [1, 0] },
      { pos: [0, 1, 1], uv: [0, 1] },
      { pos: [1, 1, 1], uv: [1, 1] },
    ],
  },
];

const TILE_U = 1 / ATLAS_COLS;
const TILE_V = 1 / ATLAS_ROWS;
const EPS_U = 0.5 / (ATLAS_COLS * TILE_PX);
const EPS_V = 0.5 / (ATLAS_ROWS * TILE_PX);

function tileUV(tile, uu, vv) {
  const col = tile % ATLAS_COLS;
  const row = Math.floor(tile / ATLAS_COLS);
  const u = (col + EPS_U / TILE_U + uu * (1 - 2 * EPS_U / TILE_U)) * TILE_U;
  const tt = 1 - vv; // fraction from top of tile
  const v = 1 - (row + EPS_V / TILE_V + tt * (1 - 2 * EPS_V / TILE_V)) * TILE_V;
  return [u, v];
}

// A block occludes AO only if it's an opaque solid (transparent foliage/glass doesn't).
function occludes(id) {
  return id !== BLOCK.AIR && isSolid(id) && !isTransparent(id);
}

function groupFor(id) {
  if (isLiquid(id)) return 'water';
  if (id === BLOCK.GLASS) return 'glass';
  return 'opaque';
}

// Should a face be drawn between current block `id` and `neighbor`?
function faceVisible(id, neighbor) {
  if (neighbor === BLOCK.AIR) return true;
  if (!isTransparent(neighbor)) return false;
  return neighbor !== id; // hide internal faces between identical transparent blocks
}

export function buildChunkGeometry(world, chunk) {
  const ox = chunk.cx * CHUNK_SIZE;
  const oz = chunk.cz * CHUNK_SIZE;

  const groups = {
    opaque: newBuffers(),
    water: newBuffers(),
    glass: newBuffers(),
  };

  for (let ly = 0; ly < WORLD_HEIGHT; ly++) {
    for (let lz = 0; lz < CHUNK_SIZE; lz++) {
      for (let lx = 0; lx < CHUNK_SIZE; lx++) {
        const id = chunk.get(lx, ly, lz);
        if (id === BLOCK.AIR) continue;
        const wx = ox + lx;
        const wy = ly;
        const wz = oz + lz;
        const grp = groups[groupFor(id)];

        for (const face of FACES) {
          const nx = wx + face.dir[0];
          const ny = wy + face.dir[1];
          const nz = wz + face.dir[2];
          const neighbor = world.getBlock(nx, ny, nz);
          if (!faceVisible(id, neighbor)) continue;

          emitFace(grp, world, id, face, wx, wy, wz);
        }
      }
    }
  }

  return {
    opaque: toGeometry(groups.opaque),
    water: toGeometry(groups.water),
    glass: toGeometry(groups.glass),
  };
}

function newBuffers() {
  return { positions: [], normals: [], uvs: [], colors: [], indices: [], count: 0 };
}

function emitFace(buf, world, id, face, wx, wy, wz) {
  const tile = tileFor(id, face.uvFace);
  const base = buf.count;
  const isWater = isLiquid(id);
  // Lower the top of water blocks so the surface sits just below full height.
  const waterDrop = isWater ? 0.12 : 0;

  // AO axes: the two axes perpendicular to the face normal.
  const nAxis = face.dir[0] !== 0 ? 0 : face.dir[1] !== 0 ? 1 : 2;
  const inPlane = [0, 1, 2].filter((a) => a !== nAxis);
  const baseN = [wx + face.dir[0], wy + face.dir[1], wz + face.dir[2]];

  for (const c of face.corners) {
    const px = wx + c.pos[0];
    const py = wy + c.pos[1] - (c.pos[1] === 1 ? waterDrop : 0);
    const pz = wz + c.pos[2];

    buf.positions.push(px, py, pz);
    buf.normals.push(face.dir[0], face.dir[1], face.dir[2]);

    const [u, v] = tileUV(tile, c.uv[0], c.uv[1]);
    buf.uvs.push(u, v);

    // Ambient occlusion from the two in-plane neighbors + their corner.
    const s0 = c.pos[inPlane[0]] === 1 ? 1 : -1;
    const s1 = c.pos[inPlane[1]] === 1 ? 1 : -1;
    const a0 = [...baseN]; a0[inPlane[0]] += s0;
    const a1 = [...baseN]; a1[inPlane[1]] += s1;
    const ac = [...baseN]; ac[inPlane[0]] += s0; ac[inPlane[1]] += s1;
    const o0 = occludes(world.getBlock(a0[0], a0[1], a0[2])) ? 1 : 0;
    const o1 = occludes(world.getBlock(a1[0], a1[1], a1[2])) ? 1 : 0;
    const oc = occludes(world.getBlock(ac[0], ac[1], ac[2])) ? 1 : 0;
    const aoLevel = o0 && o1 ? 0 : 3 - (o0 + o1 + oc);
    const ao = 0.45 + aoLevel * (0.55 / 3);

    const b = face.shade * ao;
    buf.colors.push(b, b, b);
  }

  buf.indices.push(base, base + 1, base + 2, base + 2, base + 1, base + 3);
  buf.count += 4;
}

function toGeometry(buf) {
  if (buf.count === 0) return null;
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(buf.positions, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(buf.normals, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(buf.uvs, 2));
  g.setAttribute('color', new THREE.Float32BufferAttribute(buf.colors, 3));
  g.setIndex(buf.indices);
  return g;
}
