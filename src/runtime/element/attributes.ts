import { isSafeUrl } from '@cuttleskin/config';
import type { AssetResolver } from '../../util/assets';
import type { Box } from '../../util/geometry';

/** Transform state of an element. */
export interface TransformValue {
  /** The element's own `transform`. */
  readonly local: DOMMatrixReadOnly;
  /** Transforms of all ancestors up to the nearest `<svg>` multiplied with `local`. */
  readonly total: DOMMatrixReadOnly;
}

/** Attributes a transformation can read and write, with their value types. */
export interface AttributeTypes {
  transform: TransformValue;
  /** Read-only: `getBBox()` in the element's user space. */
  bbox: Box;
  text: string;
  /** Asset name of an image; empty string removes the reference. */
  href: string;
  /** Computed paint (`rgb(...)`, `none`, `url(...)`). */
  fill: string;
  stroke: string;
  'stroke-width': number;
  opacity: number;
  display: string;
  visibility: string;
}

export type AttributeName = keyof AttributeTypes;

/** Typed subset of attribute values. */
export type AttributeValues<A extends AttributeName> = { readonly [K in A]: AttributeTypes[K] };

/** Read/write access to one attribute of a DOM element. */
export interface Accessor<T> {
  /** Current effective value (computed styles, resolved transforms). */
  read(): T;
  write(value: T): void;
  /** Captures the original markup state and returns a function restoring it. */
  capture(): () => void;
}

type AccessorFactory<T> = (node: SVGGraphicsElement, assets: AssetResolver) => Accessor<T>;

const XLINK_NS = 'http://www.w3.org/1999/xlink';

function localMatrix(node: Element): DOMMatrix {
  if (!(node instanceof SVGGraphicsElement)) return new DOMMatrix();
  const consolidated = node.transform.baseVal.consolidate();
  return consolidated ? DOMMatrix.fromMatrix(consolidated.matrix) : new DOMMatrix();
}

/** Transforms of the node and its ancestors up to the nearest `<svg>`. */
export function totalMatrix(node: SVGGraphicsElement): DOMMatrix {
  let matrix = localMatrix(node);
  for (
    let parent = node.parentElement;
    parent && !(parent instanceof SVGSVGElement);
    parent = parent.parentElement
  ) {
    matrix = localMatrix(parent).multiply(matrix);
  }
  return matrix;
}

function attributeRestorer(
  node: Element,
  name: string,
  namespace: string | null = null,
): () => void {
  const value = node.getAttributeNS(namespace, name);
  return () => {
    if (value === null) node.removeAttributeNS(namespace, name);
    else node.setAttributeNS(namespace, name, value);
  };
}

/** Accessor for a CSS property; writes inline styles so they override attributes and stylesheet rules. */
function styleAccessor<T>(
  property: string,
  parse: (computed: string) => T,
  serialize: (value: T) => string,
): AccessorFactory<T> {
  return (node) => ({
    read: () => parse(getComputedStyle(node).getPropertyValue(property)),
    write: (value) => {
      node.style.setProperty(property, serialize(value));
    },
    capture: () => {
      const value = node.style.getPropertyValue(property);
      const priority = node.style.getPropertyPriority(property);
      return () => {
        if (value) node.style.setProperty(property, value, priority);
        else node.style.removeProperty(property);
      };
    },
  });
}

const identity = (value: string): string => value;

const ACCESSORS: { readonly [K in AttributeName]: AccessorFactory<AttributeTypes[K]> } = {
  transform: (node) => ({
    read: () => ({ local: localMatrix(node), total: totalMatrix(node) }),
    write: (value) => {
      node.setAttribute('transform', value.local.toString());
    },
    capture: () => attributeRestorer(node, 'transform'),
  }),
  bbox: (node) => ({
    read: () => {
      const { x, y, width, height } = node.getBBox();
      return { x, y, width, height };
    },
    write: () => {
      // Read-only
    },
    capture: () => () => {
      // Nothing to restore
    },
  }),
  text: (node) => ({
    read: () => node.textContent,
    write: (value) => {
      node.textContent = value;
    },
    capture: () => {
      const text = node.textContent;
      return () => {
        node.textContent = text;
      };
    },
  }),
  href: (node, assets) => ({
    read: () => {
      const url = node.getAttribute('href') ?? node.getAttributeNS(XLINK_NS, 'href') ?? '';
      return url ? assets.nameOf(url) : '';
    },
    write: (value) => {
      const url = value ? assets.resolve(value) : '';
      // Values come from outside (e.g. entity states): `javascript:` and the like are dropped
      if (url && isSafeUrl(url)) {
        // SVG 2 `href` takes precedence over `xlink:href`
        node.setAttribute('href', url);
      } else {
        node.removeAttribute('href');
        node.removeAttributeNS(XLINK_NS, 'href');
      }
    },
    capture: () => {
      const restoreHref = attributeRestorer(node, 'href');
      const restoreXlink = attributeRestorer(node, 'href', XLINK_NS);
      return () => {
        restoreHref();
        restoreXlink();
      };
    },
  }),
  fill: styleAccessor('fill', identity, identity),
  stroke: styleAccessor('stroke', identity, identity),
  // Units are ignored, values are treated as user units
  'stroke-width': styleAccessor('stroke-width', parseFloat, (value) => `${String(value)}px`),
  opacity: styleAccessor('opacity', parseFloat, String),
  display: styleAccessor('display', identity, identity),
  visibility: styleAccessor('visibility', identity, identity),
};

export function createAccessor<K extends AttributeName>(
  node: SVGGraphicsElement,
  attribute: K,
  assets: AssetResolver,
): Accessor<AttributeTypes[K]> {
  return ACCESSORS[attribute](node, assets);
}
