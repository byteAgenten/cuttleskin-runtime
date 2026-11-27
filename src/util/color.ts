/** sRGB color, channels 0-255, opacity 0-1. */
export interface Rgba {
  readonly r: number;
  readonly g: number;
  readonly b: number;
  readonly opacity: number;
}

/** `null` represents "no color" (`none` or an unparseable value). */
export type Color = Rgba | null;

const cache = new Map<string, Color>();
let context: OffscreenCanvasRenderingContext2D | null | undefined;

function getContext(): OffscreenCanvasRenderingContext2D | null {
  context ??= new OffscreenCanvas(1, 1).getContext('2d');
  return context;
}

const HEX = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i;
const RGBA = /^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*(?:,\s*([\d.]+)\s*)?\)$/i;

function parseSerialized(value: string): Color {
  const hex = HEX.exec(value);
  if (hex) {
    const [, r = '', g = '', b = ''] = hex;
    return { r: parseInt(r, 16), g: parseInt(g, 16), b: parseInt(b, 16), opacity: 1 };
  }
  const rgba = RGBA.exec(value);
  if (rgba) {
    const [, r = '', g = '', b = '', a] = rgba;
    return { r: Number(r), g: Number(g), b: Number(b), opacity: a === undefined ? 1 : Number(a) };
  }
  return null;
}

/**
 * Parses any CSS color (hex, rgb(), hsl(), named colors, ...) using the browser's canvas color parser.
 * Returns `null` for `none` and invalid values.
 */
export function parseColor(value: string): Color {
  const key = value.trim().toLowerCase();
  const cached = cache.get(key);
  if (cached !== undefined) return cached;

  let result: Color = null;
  const ctx = getContext();
  if (ctx && key !== '' && key !== 'none') {
    // An invalid assignment is ignored, so differing results for two sentinels mean "invalid"
    ctx.fillStyle = '#000000';
    ctx.fillStyle = key;
    const first = ctx.fillStyle;
    ctx.fillStyle = '#ffffff';
    ctx.fillStyle = key;
    if (first === ctx.fillStyle) result = parseSerialized(first);
  }

  cache.set(key, result);
  return result;
}

function hex(channel: number): string {
  return Math.round(Math.min(255, Math.max(0, channel)))
    .toString(16)
    .padStart(2, '0');
}

/** Formats as `#rrggbb`, or `rgba(...)` when translucent; `null` becomes `none`. */
export function formatColor(color: Color): string {
  if (!color) return 'none';
  if (color.opacity < 1) {
    const opacity = Math.max(0, Number(color.opacity.toFixed(3)));
    return `rgba(${String(Math.round(color.r))}, ${String(Math.round(color.g))}, ${String(Math.round(color.b))}, ${String(opacity)})`;
  }
  return `#${hex(color.r)}${hex(color.g)}${hex(color.b)}`;
}

/**
 * Linear RGB interpolation. A missing color fades in/out using the other color's channels with opacity 0.
 */
export function interpolateColor(from: Color, to: Color, t: number): Color {
  if (t === 0) return from;
  if (t === 1) return to;
  if (!from && !to) return null;

  const start = from ?? { ...(to as Rgba), opacity: 0 };
  const end = to ?? { ...start, opacity: 0 };

  return {
    r: Math.round(start.r + t * (end.r - start.r)),
    g: Math.round(start.g + t * (end.g - start.g)),
    b: Math.round(start.b + t * (end.b - start.b)),
    opacity: start.opacity + t * (end.opacity - start.opacity),
  };
}
