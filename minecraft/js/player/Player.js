// Player physics: AABB collision against the voxel world, gravity, jumping,
// sprinting, flying, and swimming.
import { isSolid, isLiquid } from '../world/blocks.js';

const WIDTH = 0.6;
const HEIGHT = 1.8;
const EYE = 1.62;
const HALF = WIDTH / 2;

const GRAVITY = 28;
const JUMP_SPEED = 9.2;
const WALK_SPEED = 4.6;
const SPRINT_SPEED = 7.0;
const FLY_SPEED = 12.0;
const WATER_DRAG = 0.78;

export class Player {
  constructor(world, x, y, z) {
    this.world = world;
    this.pos = { x, y, z }; // feet position; horizontally centered
    this.vel = { x: 0, y: 0, z: 0 };
    this.onGround = false;
    this.flying = false;
    this.inWater = false;
  }

  get eyeY() {
    return this.pos.y + EYE;
  }

  solidAt(x, y, z) {
    const id = this.world.getBlock(Math.floor(x), Math.floor(y), Math.floor(z));
    return id !== 0 && isSolid(id) && !isLiquid(id);
  }

  // Is any solid voxel overlapping the player's AABB at the given feet position?
  collides(px, py, pz) {
    const minX = Math.floor(px - HALF);
    const maxX = Math.floor(px + HALF);
    const minY = Math.floor(py);
    const maxY = Math.floor(py + HEIGHT);
    const minZ = Math.floor(pz - HALF);
    const maxZ = Math.floor(pz + HALF);
    for (let y = minY; y <= maxY; y++) {
      for (let z = minZ; z <= maxZ; z++) {
        for (let x = minX; x <= maxX; x++) {
          if (this.solidAt(x + 0.5, y + 0.5, z + 0.5)) return true;
        }
      }
    }
    return false;
  }

  checkWater() {
    const id = this.world.getBlock(
      Math.floor(this.pos.x),
      Math.floor(this.pos.y + 0.9),
      Math.floor(this.pos.z)
    );
    this.inWater = isLiquid(id);
  }

  // move: {forward, right} unit-ish horizontal vector in world space.
  // flags: { jump, sprint, up, down }
  update(dt, move, flags) {
    this.checkWater();
    dt = Math.min(dt, 0.05); // clamp to avoid tunneling on lag spikes

    const speed = this.flying ? FLY_SPEED : flags.sprint ? SPRINT_SPEED : WALK_SPEED;

    if (this.flying) {
      this.vel.x = move.x * speed;
      this.vel.z = move.z * speed;
      this.vel.y = 0;
      if (flags.jump || flags.up) this.vel.y = speed;
      if (flags.down) this.vel.y = -speed;
    } else {
      // Horizontal control with a little inertia.
      const accel = this.onGround ? 0.35 : 0.12;
      this.vel.x += (move.x * speed - this.vel.x) * accel;
      this.vel.z += (move.z * speed - this.vel.z) * accel;

      if (this.inWater) {
        this.vel.y -= GRAVITY * 0.3 * dt;
        this.vel.x *= WATER_DRAG;
        this.vel.z *= WATER_DRAG;
        this.vel.y *= WATER_DRAG;
        if (flags.jump) this.vel.y = 4.5; // swim up
      } else {
        this.vel.y -= GRAVITY * dt;
        if (flags.jump && this.onGround) {
          this.vel.y = JUMP_SPEED;
          this.onGround = false;
        }
      }
    }

    // Integrate with per-axis collision resolution.
    // onGround is recomputed each frame: cleared here, set true if a downward
    // move is blocked inside moveAxis.
    this.onGround = false;
    this.moveAxis('x', this.vel.x * dt);
    this.moveAxis('y', this.vel.y * dt);
    this.moveAxis('z', this.vel.z * dt);
  }

  moveAxis(axis, delta) {
    if (delta === 0) return;
    const np = { ...this.pos };
    np[axis] += delta;
    if (!this.collides(np.x, np.y, np.z)) {
      this.pos[axis] = np[axis];
      return;
    }
    // Collision on this axis: stop and resolve.
    if (axis === 'y') {
      if (delta < 0) this.onGround = true;
      this.vel.y = 0;
    } else {
      this.vel[axis] = 0;
    }
  }

  teleportToSurface() {
    // Drop from the top until we find ground beneath the spawn column.
    const x = this.pos.x;
    const z = this.pos.z;
    for (let y = 120; y > 1; y--) {
      if (this.solidAt(x, y, z)) {
        this.pos.y = y + 1;
        return;
      }
    }
  }
}
