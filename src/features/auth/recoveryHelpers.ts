export const RESET_PATH = '/auth/reset-password';
export const FORGOT_PATH = '/auth/forgot-password';

// Capture only routing flags before the Auth SDK consumes and clears the URL.
// Tokens stay with the SDK and are never copied into application state or logs.
export function recoveryLocation(href: string) {
  const url = new URL(href);
  const hash = new URLSearchParams(url.hash.slice(1));
  const hasError = ['error', 'error_code', 'error_description'].some(
    (key) => hash.has(key) || url.searchParams.has(key),
  );
  return {
    requested:
      url.pathname === RESET_PATH ||
      hash.get('type') === 'recovery' ||
      url.searchParams.get('type') === 'recovery',
    hasError,
  };
}

export function passwordProblem(password: string, confirmation: string) {
  if (password.length < 8 || !password.trim())
    return 'Use at least 8 characters for your new password.';
  if (password !== confirmation) return 'The passwords do not match.';
  return '';
}

export const invalidRecoveryMessage =
  'This reset link is missing, expired, or no longer valid. Request a new link below.';
