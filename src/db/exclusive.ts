const queues = new WeakMap<object, Promise<unknown>>();

/**
 * Runs `task` after any earlier task for the same database has finished. Transactions on one
 * connection cannot overlap, so two taps or an approval racing a completion are lined up
 * instead of colliding. A failing task does not block the ones behind it.
 */
export function runExclusive<T>(db: object, task: () => Promise<T>): Promise<T> {
  const previous = queues.get(db) ?? Promise.resolve();
  const next = previous.then(task, task);
  queues.set(
    db,
    next.catch(() => undefined),
  );
  return next;
}
