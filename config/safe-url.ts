/** URL schemes allowed in links and image references of graphics; relative URLs have none. */
const SAFE_SCHEMES = new Set(['http', 'https', 'blob']);

/** Images as data URLs; an SVG image runs no script when shown through `<image>`. */
const SAFE_DATA_URL = /^data:image\/(?:png|jpe?g|gif|webp|avif|bmp|svg\+xml)[;,]/i;

/**
 * Whether a URL may be used as `href` in a graphic: relative URLs and fragments, `http(s):`,
 * `blob:` and data URLs of images. Everything else, in particular `javascript:`, is refused.
 * Whitespace and control characters are ignored like browsers do (`java\tscript:`).
 */
export function isSafeUrl(value: string): boolean {
  // eslint-disable-next-line no-control-regex -- control characters are what browsers skip
  const url = value.replace(/[\u0000- \u007f]/g, '');
  const scheme = /^([a-z][a-z\d+.-]*):/i.exec(url)?.[1]?.toLowerCase();
  if (scheme === undefined) return true;
  if (scheme === 'data') return SAFE_DATA_URL.test(url);
  return SAFE_SCHEMES.has(scheme);
}
