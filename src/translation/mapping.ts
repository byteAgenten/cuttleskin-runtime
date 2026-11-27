import type { Frames } from '../model/frames';
import type { Translation } from './translation';

/** Discrete lookup of the frame located exactly at the variable value (boolean and text variables). */
export function mapping<V>(frames: Frames<V>): Translation<V> {
  return (index, fallback) => {
    if (index == null) return fallback;
    return frames.byIndex.get(index)?.value ?? fallback;
  };
}
