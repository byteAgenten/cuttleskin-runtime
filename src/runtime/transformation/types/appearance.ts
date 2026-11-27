import type { Settings } from '@cuttleskin/config';
import type { TransformationModel } from '../../../model/transformation';
import { createTranslation } from '../../../translation/factory';
import {
  interpolateCssColor,
  interpolateDiscrete,
  interpolateNumber,
} from '../../../util/interpolate';
import type { TransformType } from '../transform-type';

/**
 * Sets the opacity. At opacity 0 the element is also hidden (`visibility: hidden`) so it no longer receives
 * pointer events; this is skipped in the editor to keep the visibility defined in the markup.
 */
export function opacity(
  model: TransformationModel<number>,
  settings: Settings,
): TransformType<number, 'opacity' | 'visibility'> {
  const translation = createTranslation(model.variable.type, model.frames, interpolateNumber);
  const toggleVisibility = settings.mode !== 'editor';
  return {
    attributes: ['opacity', 'visibility'],
    calculate: (value, defaults) => translation(value, model.defaultValue(defaults.opacity)),
    interpolate: interpolateNumber,
    apply: (value) =>
      toggleVisibility
        ? { opacity: value, visibility: value === 0 ? 'hidden' : 'inherit' }
        : { opacity: value },
  };
}

/** Sets the fill paint. */
export function fillColor(model: TransformationModel<string>): TransformType<string, 'fill'> {
  const translation = createTranslation(model.variable.type, model.frames, interpolateCssColor);
  return {
    attributes: ['fill'],
    calculate: (value, defaults) => translation(value, model.defaultValue(defaults.fill)),
    interpolate: interpolateCssColor,
    apply: (fill) => ({ fill }),
  };
}

/** Sets the stroke paint. */
export function strokeColor(model: TransformationModel<string>): TransformType<string, 'stroke'> {
  const translation = createTranslation(model.variable.type, model.frames, interpolateCssColor);
  return {
    attributes: ['stroke'],
    calculate: (value, defaults) => translation(value, model.defaultValue(defaults.stroke)),
    interpolate: interpolateCssColor,
    apply: (stroke) => ({ stroke }),
  };
}

/** Sets the stroke width in user units. */
export function strokeWidth(
  model: TransformationModel<number>,
): TransformType<number, 'stroke-width'> {
  const translation = createTranslation(model.variable.type, model.frames, interpolateNumber);
  return {
    attributes: ['stroke-width'],
    calculate: (value, defaults) =>
      translation(value, model.defaultValue(defaults['stroke-width'])),
    interpolate: interpolateNumber,
    apply: (width) => ({ 'stroke-width': width }),
  };
}

/** Replaces the text content; supports `bind` to show the formatted variable value. */
export function text(model: TransformationModel<string>): TransformType<string, 'text'> {
  const translation = createTranslation(model.variable.type, model.frames, interpolateDiscrete);
  return {
    attributes: ['text'],
    calculate: (value, defaults) => translation(value, model.defaultValue(defaults.text)),
    interpolate: interpolateDiscrete,
    apply: (content) => ({ text: content }),
    fromText: (content) => content,
  };
}

/** Replaces the image of an `<image>` element by asset name; supports `bind`. */
export function imageUrl(model: TransformationModel<string>): TransformType<string, 'href'> {
  const translation = createTranslation(model.variable.type, model.frames, interpolateDiscrete);
  return {
    attributes: ['href'],
    calculate: (value, defaults) => translation(value, model.defaultValue(defaults.href)),
    interpolate: interpolateDiscrete,
    apply: (href) => ({ href }),
    fromText: (name) => name,
  };
}
