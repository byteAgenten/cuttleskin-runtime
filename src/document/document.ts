import { assert } from '../util/assert';
import { createAssetResolver, type AssetResolver } from '../util/assets';
import type { Box } from '../util/geometry';
import { Observable, type EventSink } from '../util/observable';
import { sanitizeSvg } from './sanitize';

const SVG_NS = 'http://www.w3.org/2000/svg';
const XLINK_NS = 'http://www.w3.org/1999/xlink';

/** Events of the document; bubbled to the parent as `document.<event>`. */
export type DocumentEvents = {
  contentChange: [];
};

/** Content accepted by `load` and `append`: SVG markup or DOM nodes. */
export type DocumentContent = string | Node;

/** Size of the container in CSS pixels. */
export interface ViewSize {
  readonly width: number;
  readonly height: number;
}

/** Parses SVG markup; markup with several root elements is parsed as children of a wrapper. */
function parseMarkup(markup: string): Node[] {
  const parser = new DOMParser();
  const document = parser.parseFromString(markup, 'image/svg+xml');
  if (!document.querySelector('parsererror')) return [document.documentElement];

  const wrapped = parser.parseFromString(
    `<svg xmlns="${SVG_NS}" xmlns:xlink="${XLINK_NS}">${markup}</svg>`,
    'image/svg+xml',
  );
  const error = wrapped.querySelector('parsererror');
  assert(!error, `Invalid SVG markup: ${error?.textContent ?? ''}`);
  return [...wrapped.documentElement.childNodes];
}

/** First `<svg>` element among or inside the nodes. */
function findSvg(nodes: readonly Node[]): SVGSVGElement | null {
  for (const node of nodes) {
    if (node instanceof SVGSVGElement) return node;
    if (node instanceof Element || node instanceof Document || node instanceof DocumentFragment) {
      const found = node.querySelector('svg');
      if (found instanceof SVGSVGElement) return found;
    }
  }
  return null;
}

/** Length in pixels for unitless or `px` values, otherwise `null`. */
function pixelSize(value: string | null): number | null {
  return value && /^\s*[\d.]+(px)?\s*$/.test(value) ? parseFloat(value) : null;
}

/** Bounds declared by an SVG root via `viewBox` or pixel `width`/`height`. */
function declaredBounds(svg: SVGSVGElement): Box | null {
  const viewBox = svg.getAttribute('viewBox');
  if (viewBox) {
    const [x = 0, y = 0, width = 0, height = 0] = viewBox
      .trim()
      .split(/[\s,]+/)
      .map(Number);
    if ([x, y, width, height].every(Number.isFinite)) return { x, y, width, height };
  }
  const width = pixelSize(svg.getAttribute('width'));
  const height = pixelSize(svg.getAttribute('height'));
  return width && height ? { x: 0, y: 0, width, height } : null;
}

/**
 * The SVG content of a graphic inside its container.
 * - Owns the content layer (`<svg>`) that view and runtime work on
 * - Loads markup, adapts nested SVGs and resolves image URLs against the asset root
 * - Provides content bounds (declared by the SVG or measured) and the container size
 */
export class GraphicDocument extends Observable<DocumentEvents> implements AssetResolver {
  readonly container: HTMLElement;
  readonly contentLayer: SVGSVGElement;
  #assets: AssetResolver = createAssetResolver();
  #assetRoot = '';
  #assetUrls: Readonly<Record<string, string>> = {};
  #bounds: Box | null = null;

  /** Removes all existing children of `container`. */
  constructor(container: HTMLElement, parent?: EventSink) {
    super(parent, 'document');
    this.container = container;
    this.contentLayer = container.ownerDocument.createElementNS(SVG_NS, 'svg');
    // Prevent drawing outside the container; display as block to avoid inline layout overflow
    this.contentLayer.setAttribute('overflow', 'hidden');
    this.contentLayer.style.display = 'block';
    container.replaceChildren(this.contentLayer);
  }

  /**
   * Replaces the content with an SVG document. Its `viewBox` or pixel size becomes the document bounds.
   * Throws if the content is not and does not contain an `<svg>` element.
   */
  load(content: DocumentContent): void {
    const nodes = typeof content === 'string' ? parseMarkup(content) : [content];
    const svg = findSvg(nodes);
    assert(svg, 'Content must be or contain an SVG element');

    this.contentLayer.replaceChildren();
    this.#bounds = declaredBounds(svg);
    this.append(svg);
  }

  /**
   * Adds content to the content layer or to `parent`. The content is sanitized first: scripts,
   * event handlers, HTML and unsafe links are removed (see `sanitizeSvg`).
   */
  append(content: DocumentContent, parent: Element = this.contentLayer): void {
    const nodes = typeof content === 'string' ? parseMarkup(content) : [content];
    for (const node of nodes) {
      const imported =
        node.ownerDocument === this.contentLayer.ownerDocument
          ? node
          : this.contentLayer.ownerDocument.importNode(node, true);
      // Before it is connected: graphics may come from third parties
      if (!sanitizeSvg(imported)) continue;
      this.#prepare(imported);
      parent.append(imported);
    }
    this.emit('contentChange');
  }

  remove(node: Node): void {
    node.parentNode?.removeChild(node);
    this.emit('contentChange');
  }

  clear(): void {
    this.contentLayer.replaceChildren();
    this.#bounds = null;
    this.emit('contentChange');
  }

  /** First element in the content matching a CSS selector. */
  find(selector: string): Element | null {
    return this.contentLayer.querySelector(selector);
  }

  /** Graphics element with the given ID inside the content. */
  getElement(id: string): SVGGraphicsElement | null {
    const element = this.find(`#${CSS.escape(id)}`);
    return element instanceof SVGGraphicsElement ? element : null;
  }

  /** Topmost content element at a viewport position. */
  elementAt(clientX: number, clientY: number): Element | null {
    const element = this.contentLayer.ownerDocument.elementFromPoint(clientX, clientY);
    return element && element !== this.contentLayer && this.contentLayer.contains(element)
      ? element
      : null;
  }

  /** Root for relative image URLs, e.g. `assets/`; a trailing slash is added if missing. */
  setAssetRoot(root: string): void {
    this.#assetRoot = root && !root.endsWith('/') ? `${root}/` : root;
    this.#assets = createAssetResolver(this.#assetRoot, this.#assetUrls);
  }

  /**
   * URLs of individual images by file name; they take precedence over the asset root. Takes
   * effect for markup loaded afterwards and for all values set by transformations.
   */
  setAssetUrls(urls: Readonly<Record<string, string>>): void {
    this.#assetUrls = { ...urls };
    this.#assets = createAssetResolver(this.#assetRoot, this.#assetUrls);
  }

  resolve(nameOrUrl: string): string {
    return this.#assets.resolve(nameOrUrl);
  }

  nameOf(url: string): string {
    return this.#assets.nameOf(url);
  }

  /** Overrides the bounds declared by the loaded SVG; `null` uses the measured content bounds. */
  setDocumentBounds(bounds: Box | null): void {
    this.#bounds = bounds;
  }

  /** Declared or explicitly set bounds, otherwise the bounding box of the content. */
  contentBounds(): Box {
    if (this.#bounds) return this.#bounds;
    const { x, y, width, height } = this.contentLayer.getBBox();
    return { x, y, width, height };
  }

  /** Inner size of the container. */
  viewSize(): ViewSize {
    const style = getComputedStyle(this.container);
    return { width: parseFloat(style.width) || 0, height: parseFloat(style.height) || 0 };
  }

  override destroy(): void {
    this.contentLayer.remove();
    super.destroy();
  }

  /**
   * Adapts content for display:
   * - Nested SVGs lose their `viewBox` (conflicts with zooming) and get `overflow: visible` (no clipping)
   * - Relative image URLs are resolved against the asset root
   */
  #prepare(node: Node): void {
    if (!(node instanceof Element)) return;
    const svgs = [...node.querySelectorAll('svg'), ...(node.localName === 'svg' ? [node] : [])];
    for (const svg of svgs) {
      svg.setAttribute('overflow', 'visible');
      svg.removeAttribute('viewBox');
    }
    const images = [
      ...node.querySelectorAll('image'),
      ...(node.localName === 'image' ? [node] : []),
    ];
    for (const image of images) {
      for (const [namespace, name] of [
        [null, 'href'],
        [XLINK_NS, 'href'],
      ] as const) {
        const url = image.getAttributeNS(namespace, name);
        if (url)
          image.setAttributeNS(namespace, namespace ? 'xlink:href' : 'href', this.resolve(url));
      }
    }
  }
}
