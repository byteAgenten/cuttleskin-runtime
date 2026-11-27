import { EASINGS, type Easing } from './easing';

/** Parameters of a single progress animation from 0 to 1. */
export interface AnimateOptions {
  /** Duration in milliseconds. Values <= 0 complete synchronously. */
  readonly duration: number;
  readonly easing?: Easing;
  /** Receives eased progress (may overshoot for back/elastic easings); the last update is always 1. */
  readonly onUpdate: (progress: number) => void;
  readonly onComplete?: () => void;
}

/** Handle of a running animation. */
export interface Animation {
  /** Stops the animation without a final update and without calling `onComplete`. */
  stop(): void;
  /** `false` once the animation has completed or was stopped. */
  readonly running: boolean;
}

export function animate(options: AnimateOptions): Animation {
  const { duration, easing = EASINGS.linear, onUpdate, onComplete } = options;

  let frameId: number | undefined;
  let running = true;

  const finish = (): void => {
    running = false;
    // Always end exactly at the target, also for easings like `step` that never reach 1
    onUpdate(1);
    onComplete?.();
  };

  if (!(duration > 0)) {
    finish();
  } else {
    const start = performance.now();
    const tick = (now: number): void => {
      // The frame timestamp can lie before `start` if the animation was started during the frame;
      // easings like `easeout` (fractional power) return NaN for negative progress
      const t = Math.min(Math.max((now - start) / duration, 0), 1);
      if (t >= 1) {
        frameId = undefined;
        finish();
        return;
      }
      onUpdate(easing(t));
      frameId = requestAnimationFrame(tick);
    };
    frameId = requestAnimationFrame(tick);
  }

  return {
    stop() {
      running = false;
      if (frameId !== undefined) cancelAnimationFrame(frameId);
      frameId = undefined;
    },
    get running() {
      return running;
    },
  };
}
