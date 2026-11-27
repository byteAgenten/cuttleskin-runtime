export type Task = () => void;

/** Removes a scheduled task before it runs. */
export type Unschedule = () => void;

/**
 * Frame scheduler with three phases executed in order once per animation frame:
 * reset (restore DOM), transform (compute values), render (write DOM).
 * Within a phase, higher priorities run first.
 */
export interface TaskScheduler {
  scheduleReset(task: Task, priority?: number): Unschedule;
  scheduleTransform(task: Task, priority?: number): Unschedule;
  scheduleRender(task: Task, priority?: number): Unschedule;
}
