/** Rendered bounds of an element in several screen coordinate systems. */
export interface ScreenBBox {
  /** Position relative to the outermost SVG element. */
  readonly x: number;
  readonly y: number;
  /** Size in screen pixels, including element and viewBox transforms. */
  readonly width: number;
  readonly height: number;
  /** Position relative to the browser viewport. */
  readonly clientX: number;
  readonly clientY: number;
  /** Position relative to the document. */
  readonly pageX: number;
  readonly pageY: number;
}

function outermostSvg(element: Element): Element {
  let result = element;
  let owner = element instanceof SVGElement ? element.ownerSVGElement : null;
  while (owner) {
    result = owner;
    owner = owner.ownerSVGElement;
  }
  return result;
}

export function screenBBox(element: Element): ScreenBBox {
  const bounds = element.getBoundingClientRect();
  const containerBounds = outermostSvg(element).getBoundingClientRect();

  return {
    x: bounds.left - containerBounds.left,
    y: bounds.top - containerBounds.top,
    width: bounds.width,
    height: bounds.height,
    clientX: bounds.left,
    clientY: bounds.top,
    pageX: bounds.left + window.scrollX,
    pageY: bounds.top + window.scrollY,
  };
}
