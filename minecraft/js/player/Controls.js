// Mouse-look + keyboard input with pointer lock.
import * as THREE from 'three';

export class Controls {
  constructor(camera, domElement) {
    this.camera = camera;
    this.dom = domElement;
    this.yaw = 0;
    this.pitch = 0;
    this.locked = false;
    this.sensitivity = 0.0022;

    this.keys = new Set();
    this.onSelectSlot = null; // (index) => void
    this.onScrollSlot = null; // (delta) => void
    this.onToggleFly = null;
    this.justPressed = new Set();

    this._bind();
  }

  _bind() {
    this.dom.addEventListener('click', () => {
      if (!this.locked) this.dom.requestPointerLock();
    });

    document.addEventListener('pointerlockchange', () => {
      this.locked = document.pointerLockElement === this.dom;
      document.getElementById('overlay')?.classList.toggle('hidden', this.locked);
    });

    document.addEventListener('mousemove', (e) => {
      if (!this.locked) return;
      this.yaw -= e.movementX * this.sensitivity;
      this.pitch -= e.movementY * this.sensitivity;
      const lim = Math.PI / 2 - 0.01;
      this.pitch = Math.max(-lim, Math.min(lim, this.pitch));
    });

    document.addEventListener('keydown', (e) => {
      const code = e.code;
      if (!this.keys.has(code)) this.justPressed.add(code);
      this.keys.add(code);

      if (code.startsWith('Digit')) {
        const n = parseInt(code.slice(5), 10);
        if (n >= 1 && n <= 9) this.onSelectSlot?.(n - 1);
      }
      if (code === 'KeyF') this.onToggleFly?.();
      // Prevent page scroll on space / arrows while playing.
      if (this.locked && (code === 'Space' || code.startsWith('Arrow'))) e.preventDefault();
    });

    document.addEventListener('keyup', (e) => this.keys.delete(e.code));

    document.addEventListener('wheel', (e) => {
      if (!this.locked) return;
      this.onScrollSlot?.(Math.sign(e.deltaY));
    }, { passive: true });

    window.addEventListener('blur', () => this.keys.clear());
  }

  isDown(code) {
    return this.keys.has(code);
  }

  consumePressed(code) {
    if (this.justPressed.has(code)) {
      this.justPressed.delete(code);
      return true;
    }
    return false;
  }

  endFrame() {
    this.justPressed.clear();
  }

  // Apply current yaw/pitch to the camera.
  applyToCamera() {
    const q = new THREE.Quaternion();
    const qy = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), this.yaw);
    const qx = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), this.pitch);
    q.multiply(qy).multiply(qx);
    this.camera.quaternion.copy(q);
  }

  // Horizontal movement vector from WASD relative to yaw.
  getMoveVector() {
    let f = 0;
    let r = 0;
    if (this.isDown('KeyW') || this.isDown('ArrowUp')) f += 1;
    if (this.isDown('KeyS') || this.isDown('ArrowDown')) f -= 1;
    if (this.isDown('KeyD') || this.isDown('ArrowRight')) r += 1;
    if (this.isDown('KeyA') || this.isDown('ArrowLeft')) r -= 1;

    if (f === 0 && r === 0) return { x: 0, z: 0 };

    const sin = Math.sin(this.yaw);
    const cos = Math.cos(this.yaw);
    // Forward in world space for yaw (camera looks down -Z at yaw 0).
    const fx = -sin * f;
    const fz = -cos * f;
    const rx = cos * r;
    const rz = -sin * r;
    let x = fx + rx;
    let z = fz + rz;
    const len = Math.hypot(x, z) || 1;
    return { x: x / len, z: z / len };
  }
}
