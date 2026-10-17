interface OptimisticUpdateOptions<T> {
  update: (data: T) => void;
  revert: () => void;
  onSuccess?: (response: unknown) => void;
  onError?: (error: Error) => void;
  onComplete?: () => void;
}

export async function withOptimisticUpdate<T>(
  data: T,
  apiCall: () => Promise<unknown>,
  options: OptimisticUpdateOptions<T>
): Promise<unknown> {
  const { update, revert, onSuccess, onError, onComplete } = options;

  try {
    update(data);

    const response = await apiCall();

    onSuccess?.(response);
    return response;
  } catch (error) {
    revert();

    const errorObj = error instanceof Error ? error : new Error(String(error));
    onError?.(errorObj);
    throw errorObj;
  } finally {
    onComplete?.();
  }
}
