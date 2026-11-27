import { createLogger } from '../util/logger';
import { Observable, type EventSink } from '../util/observable';
import type { Task, TaskScheduler, Unschedule } from './scheduling';

/** Lifecycle events of a frame; bubbled to the parent as `scheduler.<event>`. */
export type SchedulerEvents = {
  start: [];
  reset: [];
  transform: [];
  render: [];
  complete: [];
};

type Phase = 'reset' | 'transform' | 'render';

const PHASES: readonly Phase[] = ['reset', 'transform', 'render'];

interface Entry {
  readonly task: Task;
  readonly priority: number;
}

const log = createLogger('cuttleskin.scheduler');

/**
 * Executes scheduled tasks once per animation frame in the phases reset, transform and render.
 * - Higher priorities run first; equal priorities keep their scheduling order
 * - Tasks scheduled while a frame runs are executed in the same frame if their phase has not passed yet,
 *   otherwise in the next frame
 * - A failing task is logged and does not affect other tasks
 */
export class Scheduler extends Observable<SchedulerEvents> implements TaskScheduler {
  readonly #queues: Record<Phase, Entry[]> = { reset: [], transform: [], render: [] };
  #frameId: number | undefined;
  #running = false;

  constructor(parent?: EventSink) {
    super(parent, 'scheduler');
  }

  scheduleReset(task: Task, priority = 0): Unschedule {
    return this.#schedule('reset', task, priority);
  }

  scheduleTransform(task: Task, priority = 0): Unschedule {
    return this.#schedule('transform', task, priority);
  }

  scheduleRender(task: Task, priority = 0): Unschedule {
    return this.#schedule('render', task, priority);
  }

  /** Number of tasks waiting for execution. */
  get pending(): number {
    return PHASES.reduce((sum, phase) => sum + this.#queues[phase].length, 0);
  }

  /** Executes all pending tasks synchronously instead of waiting for the next animation frame. */
  flush(): void {
    this.#cancelFrame();
    this.#execute();
  }

  override destroy(): void {
    this.#cancelFrame();
    for (const phase of PHASES) this.#queues[phase] = [];
    super.destroy();
  }

  #schedule(phase: Phase, task: Task, priority: number): Unschedule {
    const entry: Entry = { task, priority };
    const queue = this.#queues[phase];
    // Insert after all entries with the same or a higher priority
    const index = queue.findIndex((other) => other.priority < priority);
    queue.splice(index < 0 ? queue.length : index, 0, entry);
    this.#requestFrame();

    return () => {
      const position = this.#queues[phase].indexOf(entry);
      if (position >= 0) this.#queues[phase].splice(position, 1);
    };
  }

  #requestFrame(): void {
    if (this.#frameId !== undefined || this.#running) return;
    this.#frameId = requestAnimationFrame(() => {
      this.#frameId = undefined;
      this.#execute();
    });
  }

  #cancelFrame(): void {
    if (this.#frameId !== undefined) cancelAnimationFrame(this.#frameId);
    this.#frameId = undefined;
  }

  #execute(): void {
    if (this.#running) return;
    this.#running = true;
    try {
      this.emit('start');
      for (const phase of PHASES) {
        this.#executePhase(phase);
        this.emit(phase);
      }
      this.emit('complete');
    } finally {
      this.#running = false;
    }
    // Tasks scheduled for an already finished phase run in the next frame
    if (this.pending > 0) this.#requestFrame();
  }

  #executePhase(phase: Phase): void {
    const queue = this.#queues[phase];
    for (let entry = queue.shift(); entry; entry = queue.shift()) {
      try {
        entry.task();
      } catch (error) {
        log.error(`Error executing task in ${phase} phase`, error);
      }
    }
  }
}
