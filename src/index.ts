export type Result<T> =
  | { data: T; error: null }
  | { data: null; error: Error };

export function result<T>(fn: () => Promise<T>): Promise<Result<T>>;
export function result<T>(fn: () => T): Result<T>;
export function result<T>(
  fn: () => T | Promise<T>,
): Result<T> | Promise<Result<T>> {
  try {
    const value = fn();

    if (value instanceof Promise) {
      return value.then(
        (data): Result<T> => ({ data, error: null }),
        (error): Result<T> => ({
          data: null,
          error: error instanceof Error ? error : new Error(String(error)),
        }),
      );
    }

    return { data: value, error: null };
  } catch (error) {
    return {
      data: null,
      error: error instanceof Error ? error : new Error(String(error)),
    };
  }
}
