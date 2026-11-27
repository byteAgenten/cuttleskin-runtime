import type { VariableType } from '@cuttleskin/config';
import type { Frames } from '../model/frames';
import type { Interpolator } from '../util/interpolate';
import { mapping } from './mapping';
import { transition } from './transition';
import type { Translation } from './translation';

export function createTranslation<V>(
  indexType: VariableType,
  frames: Frames<V>,
  interpolate: Interpolator<V>,
): Translation<V> {
  switch (indexType) {
    case 'number':
      return transition(frames, interpolate);
    case 'boolean':
    case 'text':
      return mapping(frames);
  }
}
