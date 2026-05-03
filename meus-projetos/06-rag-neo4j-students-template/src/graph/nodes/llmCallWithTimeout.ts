type StructuredResult<T> = {
  success: boolean;
  data?: T;
  error?: string;
};

export async function callStructuredWithTimeout<T>(
  operation: Promise<StructuredResult<T>>,
  timeoutMs: number,
  timeoutMessage: string,
): Promise<StructuredResult<T>> {
  let timeoutHandle: ReturnType<typeof setTimeout> | undefined;

  const timeoutPromise = new Promise<StructuredResult<T>>((resolve) => {
    timeoutHandle = setTimeout(() => {
      resolve({
        success: false,
        error: timeoutMessage,
      });
    }, timeoutMs);
  });

  const result = await Promise.race([operation, timeoutPromise]);

  if (timeoutHandle) {
    clearTimeout(timeoutHandle);
  }

  return result;
}