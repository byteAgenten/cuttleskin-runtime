import { isSafeUrl } from '@cuttleskin/config';

const SVG_NS = 'http://www.w3.org/2000/svg';

/** SVG elements that can run script or embed HTML; removed with their content. */
const BLOCKED_ELEMENTS = new Set(['script', 'foreignobject', 'handler', 'listener']);

/** SMIL elements that could set an event handler or a link at runtime. */
const ANIMATION_ELEMENTS = new Set(['animate', 'set', 'animatetransform', 'animatemotion']);

/** Whether an attribute name is an event handler (`onload`, `onclick`, …). */
function isEventHandler(name: string): boolean {
  return name.toLowerCase().startsWith('on');
}

/** Whether a SMIL animation targets an event handler or a link. */
function animatesUnsafeAttribute(element: Element): boolean {
  const target = (element.getAttribute('attributeName') ?? '').trim().toLowerCase();
  const name = target.includes(':') ? target.slice(target.indexOf(':') + 1) : target;
  return isEventHandler(name) || name === 'href';
}

/** Whether the element must be removed with its content. */
function isBlocked(element: Element): boolean {
  // HTML, MathML and foreign metadata (Inkscape, RDF) are not needed to show a graphic
  if (element.namespaceURI !== SVG_NS) return true;
  const name = element.localName.toLowerCase();
  if (BLOCKED_ELEMENTS.has(name)) return true;
  return ANIMATION_ELEMENTS.has(name) && animatesUnsafeAttribute(element);
}

/** Removes event handlers and unsafe links from the attributes of one element. */
function cleanAttributes(element: Element): void {
  for (const attribute of [...element.attributes]) {
    const name = attribute.localName;
    if (isEventHandler(name) || (name.toLowerCase() === 'href' && !isSafeUrl(attribute.value))) {
      element.removeAttributeNode(attribute);
    }
  }
}

/**
 * Removes everything from SVG content that could run script in the page that shows it:
 * - elements outside the SVG namespace (HTML, MathML, editor metadata), `<script>` and
 *   `<foreignObject>`
 * - event handler attributes (`onload`, `onclick`, …)
 * - links and image references with other schemes than `http(s):`, `blob:`, relative URLs and
 *   image data URLs, e.g. `javascript:`
 * - SMIL animations that would set an event handler or a link
 *
 * Works in place on `root` and its descendants; call it before the content is inserted into a
 * live document. Returns `false` if `root` itself must not be inserted at all.
 */
export function sanitizeSvg(root: Node): boolean {
  const visit = (node: Node): void => {
    for (const child of [...node.childNodes]) {
      if (child.nodeType === Node.PROCESSING_INSTRUCTION_NODE) {
        child.remove();
      } else if (child instanceof Element) {
        if (isBlocked(child)) {
          child.remove();
        } else {
          cleanAttributes(child);
          visit(child);
        }
      }
    }
  };

  if (root instanceof Element) {
    if (isBlocked(root)) return false;
    cleanAttributes(root);
  } else if (root.nodeType === Node.PROCESSING_INSTRUCTION_NODE) {
    return false;
  }
  visit(root);
  return true;
}
