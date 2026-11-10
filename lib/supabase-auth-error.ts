type SupabaseAuthError = {
  name?: string;
  status?: number;
  message?: string;
} | null;

export function getAuthFailureStatus(
  error: SupabaseAuthError
): 401 | 503 {
  if (!error) return 401;

  const isTemporaryFailure =
    error.name === "AuthRetryableFetchError" ||
    error.status === 0 ||
    error.name === "AbortError";

  return isTemporaryFailure ? 503 : 401;
}

export function getAuthFailureMessage(status: 401 | 503): string {
  return status === 503
    ? "Authentication service is temporarily unavailable. Please try again."
    : "Unauthorized. Please log in again.";
}