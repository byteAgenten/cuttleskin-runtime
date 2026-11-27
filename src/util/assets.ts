/** Translates between asset names stored in markup/config and the URLs they are served from. */
export interface AssetResolver {
  /** URL for an asset name; absolute URLs (`http:`, `data:`, ...) are returned unchanged. */
  resolve(nameOrUrl: string): string;
  /** Asset name (file name) of a URL. */
  nameOf(url: string): string;
}

const SCHEME = /^[a-z][\w.+-]*:/i;

export function assetName(url: string): string {
  return url.split('/').at(-1) ?? url;
}

/**
 * Resolves asset names relative to `root` (e.g. `assets/`). Names listed in `urls` resolve to
 * their own URL instead, e.g. content-addressed URLs that do not end with the name.
 */
export function createAssetResolver(
  root = '',
  urls: Readonly<Record<string, string>> = {},
): AssetResolver {
  const byName = new Map(Object.entries(urls));
  const byUrl = new Map([...byName].map(([name, url]) => [url, name]));
  return Object.freeze({
    resolve(nameOrUrl: string) {
      if (SCHEME.test(nameOrUrl)) return nameOrUrl;
      // Also for references with a path like `assets/car.png`
      const name = assetName(nameOrUrl);
      return byName.get(name) ?? root + name;
    },
    nameOf: (url: string) => byUrl.get(url) ?? assetName(url),
  });
}
