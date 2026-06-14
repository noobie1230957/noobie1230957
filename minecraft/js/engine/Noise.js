// Seedable pseudo-random number generator (mulberry32)
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Classic improved Perlin noise (Ken Perlin), seedable.
export class Perlin {
  constructor(seed = 1337) {
    const rand = mulberry32(seed);
    const p = new Uint8Array(256);
    for (let i = 0; i < 256; i++) p[i] = i;
    // Fisher-Yates shuffle
    for (let i = 255; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      const t = p[i];
      p[i] = p[j];
      p[j] = t;
    }
    this.perm = new Uint8Array(512);
    this.permMod12 = new Uint8Array(512);
    for (let i = 0; i < 512; i++) {
      this.perm[i] = p[i & 255];
    }
  }

  static fade(t) {
    return t * t * t * (t * (t * 6 - 15) + 10);
  }

  static lerp(a, b, t) {
    return a + t * (b - a);
  }

  static grad(hash, x, y, z) {
    const h = hash & 15;
    const u = h < 8 ? x : y;
    const v = h < 4 ? y : h === 12 || h === 14 ? x : z;
    return ((h & 1) === 0 ? u : -u) + ((h & 2) === 0 ? v : -v);
  }

  noise3(x, y, z) {
    const p = this.perm;
    const X = Math.floor(x) & 255;
    const Y = Math.floor(y) & 255;
    const Z = Math.floor(z) & 255;
    x -= Math.floor(x);
    y -= Math.floor(y);
    z -= Math.floor(z);
    const u = Perlin.fade(x);
    const v = Perlin.fade(y);
    const w = Perlin.fade(z);
    const A = p[X] + Y;
    const AA = p[A] + Z;
    const AB = p[A + 1] + Z;
    const B = p[X + 1] + Y;
    const BA = p[B] + Z;
    const BB = p[B + 1] + Z;

    return Perlin.lerp(
      Perlin.lerp(
        Perlin.lerp(Perlin.grad(p[AA], x, y, z), Perlin.grad(p[BA], x - 1, y, z), u),
        Perlin.lerp(Perlin.grad(p[AB], x, y - 1, z), Perlin.grad(p[BB], x - 1, y - 1, z), u),
        v
      ),
      Perlin.lerp(
        Perlin.lerp(Perlin.grad(p[AA + 1], x, y, z - 1), Perlin.grad(p[BA + 1], x - 1, y, z - 1), u),
        Perlin.lerp(Perlin.grad(p[AB + 1], x, y - 1, z - 1), Perlin.grad(p[BB + 1], x - 1, y - 1, z - 1), u),
        v
      ),
      w
    );
  }

  noise2(x, z) {
    return this.noise3(x, 0, z);
  }

  // Fractal Brownian Motion — layered noise for natural-looking terrain.
  fbm2(x, z, octaves = 4, lacunarity = 2.0, persistence = 0.5) {
    let amp = 1;
    let freq = 1;
    let sum = 0;
    let max = 0;
    for (let i = 0; i < octaves; i++) {
      sum += amp * this.noise2(x * freq, z * freq);
      max += amp;
      amp *= persistence;
      freq *= lacunarity;
    }
    return sum / max;
  }
}
