import type { Settings } from '@cuttleskin/config';
import type { TransformationModel } from '../../model/transformation';
import { assert } from '../../util/assert';
import type { Point } from '../../util/geometry';
import type { TransformType } from './transform-type';
import { fillColor, imageUrl, opacity, strokeColor, strokeWidth, text } from './types/appearance';
import { motionPath, rotate, scale, translate } from './types/geometric';

/**
 * Creates the behaviour for the model's transformation type.
 * Frame values are trusted to match the type; validating them is the job of the config parser.
 */
export function createTransformType(
  model: TransformationModel,
  settings: Settings,
  /** Followed path of `motion-path`. */
  path?: SVGGeometryElement,
): TransformType<unknown> {
  switch (model.type) {
    case 'translate':
      return translate(model as TransformationModel<Point>);
    case 'rotate':
      return rotate(model as TransformationModel<number>);
    case 'scale':
      return scale(model as TransformationModel<Point>);
    case 'opacity':
      return opacity(model as TransformationModel<number>, settings);
    case 'fill-color':
      return fillColor(model as TransformationModel<string>);
    case 'stroke-color':
      return strokeColor(model as TransformationModel<string>);
    case 'stroke-width':
      return strokeWidth(model as TransformationModel<number>);
    case 'text':
      return text(model as TransformationModel<string>);
    case 'image-url':
      return imageUrl(model as TransformationModel<string>);
    case 'motion-path':
      assert(path, `Path element missing: ${String(model.config.path)}`);
      return motionPath(model as TransformationModel<number>, path);
  }
}
