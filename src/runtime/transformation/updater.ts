import type { TransitionConfig } from '@cuttleskin/config';
import { animate, type Animation } from '../../util/animate';
import { resolveEasing } from '../../util/easing';

/** Applies new transformation values, either immediately or animated. */
export interface Updater<V> {
  update(next: V): void;
  destroy(): void;
}

/** Applies every value immediately. */
export function discreteUpdater<V>(apply: (value: V) => void): Updater<V> {
  return {
    update: apply,
    destroy: () => undefined,
  };
}

/**
 * Animates from the currently displayed value to the next one. The first value is applied immediately;
 * a new value during a running animation starts from the intermediate value reached so far.
 */
export function transitionUpdater<V>(
  transition: TransitionConfig,
  interpolate: (from: V, to: V, t: number) => V,
  apply: (value: V) => void,
): Updater<V> {
  const easing = resolveEasing(transition.easing);
  let animation: Animation | undefined;
  let current: { value: V } | undefined;

  return {
    update(next) {
      animation?.stop();

      if (!current) {
        current = { value: next };
        apply(next);
        return;
      }

      const from = current.value;
      const state = current;
      animation = animate({
        duration: transition.duration,
        easing,
        onUpdate: (progress) => {
          state.value = interpolate(from, next, progress);
          apply(state.value);
        },
      });
    },
    destroy() {
      animation?.stop();
    },
  };
}
