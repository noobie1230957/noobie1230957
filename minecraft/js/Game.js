import * as THREE from 'three';
import { World, CHUNK_SIZE, SEA_LEVEL } from './world/World.js';
import { buildChunkGeometry } from './world/mesher.js';
import { buildAtlasCanvas, BLOCK, isSolid, isLiquid } from './world/blocks.js';
import { Player } from './player/Player.js';
import { Controls } from './player/Controls.js';
import { HUD } from './ui/HUD.js';

const RENDER_RADIUS = 7;
const GEN_BUDGET = 2;   // chunks generated per frame
const MESH_BUDGET = 2;  // chunks meshed per frame
const REACH = 6;        // block interaction distance

export class Game {
  constructor() {
    this.canvas = document.getElementById('game');
    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: false });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    this.renderer.setSize(window.innerWidth, window.innerHeight);

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);

    this.world = new World((Math.random() * 1e9) | 0);

    this._setupSky();
    this._setupMaterials();

    this.controls = new Controls(this.camera, this.canvas);
    this.hud = new HUD(this.atlasCanvas);

    this.player = new Player(this.world, 8.5, 100, 8.5);
    this._spawn();

    this._setupHighlight();
    this._bindActions();

    this.time = 0;        // seconds
    this.dayLength = 600; // seconds per full day
    this.dayTime = 0.28;  // start mid-morning
    this.clock = new THREE.Clock();

    this.frames = 0;
    this.fpsTimer = 0;
    this.fps = 0;

    window.addEventListener('resize', () => this._onResize());
  }

  _setupSky() {
    this.skyColor = new THREE.Color(0x88bbee);
    this.scene.background = this.skyColor.clone();
    this.scene.fog = new THREE.Fog(this.skyColor.clone(), RENDER_RADIUS * CHUNK_SIZE * 0.5, RENDER_RADIUS * CHUNK_SIZE);

    this.sun = new THREE.DirectionalLight(0xffffff, 1.0);
    this.scene.add(this.sun);
    this.scene.add(new THREE.AmbientLight(0xffffff, 0.6));

    // Sun disc + clouds for atmosphere.
    const sunGeo = new THREE.SphereGeometry(8, 12, 12);
    this.sunMesh = new THREE.Mesh(sunGeo, new THREE.MeshBasicMaterial({ color: 0xfff2cc, fog: false }));
    this.scene.add(this.sunMesh);
    this.moonMesh = new THREE.Mesh(sunGeo, new THREE.MeshBasicMaterial({ color: 0xdfe6ff, fog: false }));
    this.scene.add(this.moonMesh);

    this._buildClouds();
  }

  _buildClouds() {
    this.clouds = new THREE.Group();
    const mat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.8, fog: false });
    for (let i = 0; i < 40; i++) {
      const w = 8 + Math.random() * 16;
      const d = 8 + Math.random() * 16;
      const geo = new THREE.BoxGeometry(w, 3, d);
      const m = new THREE.Mesh(geo, mat);
      m.position.set((Math.random() - 0.5) * 600, 130 + Math.random() * 30, (Math.random() - 0.5) * 600);
      this.clouds.add(m);
    }
    this.scene.add(this.clouds);
  }

  _setupMaterials() {
    this.atlasCanvas = buildAtlasCanvas();
    const tex = new THREE.CanvasTexture(this.atlasCanvas);
    tex.magFilter = THREE.NearestFilter;
    tex.minFilter = THREE.NearestFilter;
    tex.generateMipmaps = false;
    this.atlasTexture = tex;

    this.matOpaque = new THREE.MeshBasicMaterial({ map: tex, vertexColors: true });
    this.matWater = new THREE.MeshBasicMaterial({
      map: tex, vertexColors: true, transparent: true, opacity: 0.72, depthWrite: false,
    });
    this.matGlass = new THREE.MeshBasicMaterial({
      map: tex, vertexColors: true, transparent: true, alphaTest: 0.3, side: THREE.DoubleSide,
    });
  }

  _setupHighlight() {
    const box = new THREE.BoxGeometry(1.002, 1.002, 1.002);
    const edges = new THREE.EdgesGeometry(box);
    this.highlight = new THREE.LineSegments(
      edges,
      new THREE.LineBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.5 })
    );
    this.highlight.visible = false;
    this.scene.add(this.highlight);
  }

  _spawn() {
    // Find a dry spawn column (surface above sea level), searching outward.
    let sx = 8, sz = 8;
    outer: for (let r = 0; r < 64; r += 2) {
      for (let a = 0; a < 8; a++) {
        const x = 8 + Math.round(Math.cos((a / 8) * Math.PI * 2) * r);
        const z = 8 + Math.round(Math.sin((a / 8) * Math.PI * 2) * r);
        if (this.world.heightAt(x, z) > SEA_LEVEL + 1) { sx = x; sz = z; break outer; }
      }
    }
    this.player.pos.x = sx + 0.5;
    this.player.pos.z = sz + 0.5;

    // Ensure spawn-area chunks exist, then drop the player onto the surface.
    const pcx = Math.floor(sx / CHUNK_SIZE);
    const pcz = Math.floor(sz / CHUNK_SIZE);
    for (let dx = -1; dx <= 1; dx++) {
      for (let dz = -1; dz <= 1; dz++) this.world.ensureChunk(pcx + dx, pcz + dz);
    }
    this.player.teleportToSurface();
  }

  _bindActions() {
    this.controls.onSelectSlot = (i) => this.hud.select(i);
    this.controls.onScrollSlot = (d) => this.hud.scroll(d);
    this.controls.onToggleFly = () => {
      this.player.flying = !this.player.flying;
      this.player.vel.y = 0;
    };
    // Re-lock the pointer after picking a block from the inventory.
    this.hud.onClose = () => this.canvas.requestPointerLock();

    this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    this.canvas.addEventListener('mousedown', (e) => {
      if (!this.controls.locked) return;
      if (e.button === 0) this._breakBlock();
      else if (e.button === 2) this._placeBlock();
    });

    document.addEventListener('keydown', (e) => {
      if (e.code === 'KeyE') {
        this.hud.toggleInventory();
        if (this.hud.inventoryOpen) {
          if (document.pointerLockElement) document.exitPointerLock();
        } else {
          this.canvas.requestPointerLock();
        }
      }
    });
  }

  // ---- Block interaction (DDA voxel raycast) --------------------------------
  raycast() {
    const origin = new THREE.Vector3(this.player.pos.x, this.player.eyeY, this.player.pos.z);
    const dir = new THREE.Vector3(0, 0, -1).applyQuaternion(this.camera.quaternion).normalize();

    let x = Math.floor(origin.x);
    let y = Math.floor(origin.y);
    let z = Math.floor(origin.z);
    const stepX = Math.sign(dir.x);
    const stepY = Math.sign(dir.y);
    const stepZ = Math.sign(dir.z);

    const tDeltaX = dir.x !== 0 ? Math.abs(1 / dir.x) : Infinity;
    const tDeltaY = dir.y !== 0 ? Math.abs(1 / dir.y) : Infinity;
    const tDeltaZ = dir.z !== 0 ? Math.abs(1 / dir.z) : Infinity;

    const distToBoundary = (o, s) => (s > 0 ? Math.ceil(o) - o : o - Math.floor(o));
    let tMaxX = dir.x !== 0 ? distToBoundary(origin.x, stepX) * tDeltaX : Infinity;
    let tMaxY = dir.y !== 0 ? distToBoundary(origin.y, stepY) * tDeltaY : Infinity;
    let tMaxZ = dir.z !== 0 ? distToBoundary(origin.z, stepZ) * tDeltaZ : Infinity;

    let nx = 0, ny = 0, nz = 0;
    let t = 0;
    while (t <= REACH) {
      const id = this.world.getBlock(x, y, z);
      if (id !== BLOCK.AIR && isSolid(id) && !isLiquid(id)) {
        return { x, y, z, nx, ny, nz };
      }
      if (tMaxX < tMaxY && tMaxX < tMaxZ) {
        x += stepX; t = tMaxX; tMaxX += tDeltaX; nx = -stepX; ny = 0; nz = 0;
      } else if (tMaxY < tMaxZ) {
        y += stepY; t = tMaxY; tMaxY += tDeltaY; nx = 0; ny = -stepY; nz = 0;
      } else {
        z += stepZ; t = tMaxZ; tMaxZ += tDeltaZ; nx = 0; ny = 0; nz = -stepZ;
      }
    }
    return null;
  }

  _breakBlock() {
    const hit = this.raycast();
    if (!hit) return;
    if (this.world.getBlock(hit.x, hit.y, hit.z) === BLOCK.BEDROCK) return;
    this.world.setBlock(hit.x, hit.y, hit.z, BLOCK.AIR);
  }

  _placeBlock() {
    const hit = this.raycast();
    if (!hit) return;
    const px = hit.x + hit.nx;
    const py = hit.y + hit.ny;
    const pz = hit.z + hit.nz;
    const existing = this.world.getBlock(px, py, pz);
    if (existing !== BLOCK.AIR && !isLiquid(existing)) return;
    // Don't place a block inside the player's body.
    if (this._overlapsPlayer(px, py, pz)) return;
    this.world.setBlock(px, py, pz, this.hud.currentBlock());
  }

  _overlapsPlayer(bx, by, bz) {
    const p = this.player.pos;
    const half = 0.3;
    const minX = p.x - half, maxX = p.x + half;
    const minZ = p.z - half, maxZ = p.z + half;
    const minY = p.y, maxY = p.y + 1.8;
    return (
      maxX > bx && minX < bx + 1 &&
      maxY > by && minY < by + 1 &&
      maxZ > bz && minZ < bz + 1
    );
  }

  // ---- Chunk streaming ------------------------------------------------------
  updateChunks() {
    const pcx = Math.floor(this.player.pos.x / CHUNK_SIZE);
    const pcz = Math.floor(this.player.pos.z / CHUNK_SIZE);

    // Generate nearby chunks (closest first), budgeted per frame.
    const coords = [];
    for (let dx = -RENDER_RADIUS; dx <= RENDER_RADIUS; dx++) {
      for (let dz = -RENDER_RADIUS; dz <= RENDER_RADIUS; dz++) {
        if (dx * dx + dz * dz > RENDER_RADIUS * RENDER_RADIUS) continue;
        coords.push([pcx + dx, pcz + dz, dx * dx + dz * dz]);
      }
    }
    coords.sort((a, b) => a[2] - b[2]);

    let generated = 0;
    for (const [cx, cz] of coords) {
      const c = this.world.getChunk(cx, cz);
      if (!c || !c.generated) {
        if (generated >= GEN_BUDGET) continue;
        this.world.ensureChunk(cx, cz);
        // New neighbors invalidate adjacent chunk borders.
        this.world.markDirty(cx + 1, cz);
        this.world.markDirty(cx - 1, cz);
        this.world.markDirty(cx, cz + 1);
        this.world.markDirty(cx, cz - 1);
        generated++;
      }
    }

    // Mesh dirty chunks (closest first), budgeted per frame.
    let meshed = 0;
    for (const [cx, cz] of coords) {
      if (meshed >= MESH_BUDGET) break;
      const c = this.world.getChunk(cx, cz);
      if (c && c.generated && c.dirty) {
        this._remeshChunk(c);
        meshed++;
      }
    }

    // Unload distant chunks to free memory.
    const maxDist = (RENDER_RADIUS + 3) * (RENDER_RADIUS + 3);
    for (const [key, c] of this.world.chunks) {
      const dx = c.cx - pcx;
      const dz = c.cz - pcz;
      if (dx * dx + dz * dz > maxDist) {
        this._disposeChunkMeshes(c);
        this.world.chunks.delete(key);
      }
    }
  }

  _remeshChunk(chunk) {
    this._disposeChunkMeshes(chunk);
    const geo = buildChunkGeometry(this.world, chunk);
    const meshes = {};
    if (geo.opaque) meshes.opaque = new THREE.Mesh(geo.opaque, this.matOpaque);
    if (geo.water) meshes.water = new THREE.Mesh(geo.water, this.matWater);
    if (geo.glass) meshes.glass = new THREE.Mesh(geo.glass, this.matGlass);
    for (const m of Object.values(meshes)) {
      m.frustumCulled = true;
      this.scene.add(m);
    }
    chunk.meshes = meshes;
    chunk.dirty = false;
  }

  _disposeChunkMeshes(chunk) {
    if (!chunk.meshes) return;
    for (const m of Object.values(chunk.meshes)) {
      this.scene.remove(m);
      m.geometry.dispose();
    }
    chunk.meshes = null;
  }

  // ---- Day / night ----------------------------------------------------------
  updateSky(dt) {
    this.dayTime = (this.dayTime + dt / this.dayLength) % 1;
    const angle = this.dayTime * Math.PI * 2;
    const sunDir = new THREE.Vector3(Math.cos(angle), Math.sin(angle), 0.3).normalize();

    const cx = this.player.pos.x;
    const cz = this.player.pos.z;
    this.sunMesh.position.set(cx + sunDir.x * 300, sunDir.y * 300, cz + sunDir.z * 300);
    this.moonMesh.position.set(cx - sunDir.x * 300, -sunDir.y * 300, cz - sunDir.z * 300);
    this.sun.position.copy(sunDir);

    // Daylight factor: 1 at noon, ~0.12 at night, smooth twilight.
    const elev = Math.max(0, sunDir.y);
    const light = 0.12 + 0.88 * Math.sqrt(elev);

    const day = new THREE.Color(0x88bbee);
    const night = new THREE.Color(0x05060f);
    const dawn = new THREE.Color(0xec8b4b);
    let sky = night.clone().lerp(day, Math.min(1, elev * 2.2));
    // Warm tint near the horizon (sunrise / sunset).
    const horizon = Math.exp(-Math.pow(sunDir.y / 0.18, 2));
    sky.lerp(dawn, horizon * 0.5);

    this.scene.background = sky;
    this.scene.fog.color = sky;
    this.matOpaque.color.setScalar(light);
    this.matWater.color.setScalar(light);
    this.matGlass.color.setScalar(light);
    this.sunMesh.visible = sunDir.y > -0.1;
    this.moonMesh.visible = sunDir.y < 0.1;

    // Drift clouds and wrap them around the player so they never run out.
    this.clouds.children.forEach((c) => {
      c.position.x += dt * 1.2;
      if (c.position.x > cx + 320) c.position.x -= 640;
      if (c.position.x < cx - 320) c.position.x += 640;
    });
  }

  _onResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }

  updateHUDText() {
    const p = this.player.pos;
    const hh = Math.floor(((this.dayTime * 24) + 6) % 24);
    const debug = document.getElementById('debug');
    if (debug) {
      debug.textContent =
        `FPS ${this.fps}  |  XYZ ${p.x.toFixed(1)} ${p.y.toFixed(1)} ${p.z.toFixed(1)}  |  ` +
        `Time ${hh.toString().padStart(2, '0')}:00  |  ${this.player.flying ? 'FLY' : (this.player.inWater ? 'SWIM' : 'WALK')}  |  ` +
        `Chunks ${this.world.chunks.size}`;
    }
  }

  start() {
    const loop = () => {
      const dt = Math.min(this.clock.getDelta(), 0.1);
      this.time += dt;

      const move = this.controls.getMoveVector();
      const flags = {
        jump: this.controls.isDown('Space'),
        sprint: this.controls.isDown('ShiftLeft') || this.controls.isDown('ShiftRight'),
        up: this.controls.isDown('Space'),
        down: this.controls.isDown('ControlLeft') || this.controls.isDown('ControlRight'),
      };

      if (this.controls.locked) {
        this.player.update(dt, move, flags);
      }

      this.controls.applyToCamera();
      this.camera.position.set(this.player.pos.x, this.player.eyeY, this.player.pos.z);

      // Block targeting highlight.
      const hit = this.raycast();
      if (hit) {
        this.highlight.visible = true;
        this.highlight.position.set(hit.x + 0.5, hit.y + 0.5, hit.z + 0.5);
      } else {
        this.highlight.visible = false;
      }

      this.updateChunks();
      this.updateSky(dt);

      // FPS
      this.frames++;
      this.fpsTimer += dt;
      if (this.fpsTimer >= 0.5) {
        this.fps = Math.round(this.frames / this.fpsTimer);
        this.frames = 0;
        this.fpsTimer = 0;
        this.updateHUDText();
      }

      this.controls.endFrame();
      this.renderer.render(this.scene, this.camera);
      requestAnimationFrame(loop);
    };
    loop();
  }
}
