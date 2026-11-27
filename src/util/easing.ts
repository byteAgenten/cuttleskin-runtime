import { EASING_NAMES, type EasingName } from '@cuttleskin/config';

/** Maps linear progress `t` in [0, 1] to eased progress. */
export type Easing = (t: number) => number;

const BACK_OVERSHOOT = 1.70158;

function cubeRoot(value: number): number {
  return Math.sign(value) * Math.pow(Math.abs(value), 1 / 3);
}

/** Curves match the former Snap.svg `mina` easings so existing graphics animate identically. */
export const EASINGS: Readonly<Record<EasingName, Easing>> = Object.freeze({
  step: () => 0,
  linear: (t) => t,
  easein: (t) => Math.pow(t, 1.7),
  easeout: (t) => Math.pow(t, 0.48),
  easeinout: (t) => {
    // The cubic approximation is off by ~1e-6 at the bounds
    if (t === 0 || t === 1) return t;
    const q = 0.48 - t / 1.04;
    const root = Math.sqrt(0.1734 + q * q);
    const x = cubeRoot(root - q) + cubeRoot(-root - q) + 0.5;
    return (1 - x) * 3 * x * x + x * x * x;
  },
  backin: (t) => {
    if (t === 1) return 1;
    return t * t * ((BACK_OVERSHOOT + 1) * t - BACK_OVERSHOOT);
  },
  backout: (t) => {
    if (t === 0) return 0;
    const u = t - 1;
    return u * u * ((BACK_OVERSHOOT + 1) * u + BACK_OVERSHOOT) + 1;
  },
  elastic: (t) => {
    if (t === 0 || t === 1) return t;
    return Math.pow(2, -10 * t) * Math.sin(((t - 0.075) * (2 * Math.PI)) / 0.3) + 1;
  },
  bounce: (t) => {
    const s = 7.5625;
    const p = 2.75;
    if (t < 1 / p) return s * t * t;
    if (t < 2 / p) {
      const u = t - 1.5 / p;
      return s * u * u + 0.75;
    }
    if (t < 2.5 / p) {
      const u = t - 2.25 / p;
      return s * u * u + 0.9375;
    }
    const u = t - 2.625 / p;
    return s * u * u + 0.984375;
  },
  easeoutqart: (t) => {
    const u = t - 1;
    return 1 - u * u * u * u;
  },
});

export function isEasingName(name: unknown): name is EasingName {
  return (EASING_NAMES as readonly unknown[]).includes(name);
}

/** Resolves an easing by name; unknown or missing names fall back to `linear`. */
export function resolveEasing(name: string | null | undefined): Easing {
  return isEasingName(name) ? EASINGS[name] : EASINGS.linear;
}
