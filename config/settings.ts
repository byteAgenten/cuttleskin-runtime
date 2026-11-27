export const MODES = ['embedded', 'editor'] as const;

/** Host environment the runtime is embedded in. */
export type Mode = (typeof MODES)[number];

export const IMAGE_RENDERINGS = ['quality', 'speed'] as const;

/** `speed` renders images pixelated (nearest neighbour), `quality` uses the browser default. */
export type ImageRendering = (typeof IMAGE_RENDERINGS)[number];

/** Runtime options provided by the host when creating a graphic. */
export interface Settings {
  readonly mode: Mode;
  readonly imageRendering: ImageRendering;
}

export const DEFAULT_SETTINGS: Settings = Object.freeze({
  mode: 'embedded',
  imageRendering: 'quality',
});

export function resolveSettings(overrides: Partial<Settings> = {}): Settings {
  return Object.freeze({ ...DEFAULT_SETTINGS, ...overrides });
}
