import { describe, expect, it } from 'vitest';
import { passwordProblem, recoveryLocation } from '../../src/features/auth/recoveryHelpers';

describe('Recovery routing and validation', () => {
  it('recognizes recovery callbacks without retaining their tokens', () => {
    expect(
      recoveryLocation(
        'https://example.test/home#type=recovery&access_token=private&refresh_token=private',
      ),
    ).toEqual({ requested: true, hasError: false });
    expect(
      recoveryLocation(
        'https://example.test/auth/reset-password#error_code=otp_expired&error_description=untrusted',
      ),
    ).toEqual({ requested: true, hasError: true });
    expect(
      recoveryLocation('https://example.test/auth/reset-password?error=access_denied'),
    ).toEqual({ requested: true, hasError: true });
    expect(recoveryLocation('https://example.test/home')).toEqual({
      requested: false,
      hasError: false,
    });
  });
  it('rejects short, blank and mismatched passwords without trimming valid passwords', () => {
    expect(passwordProblem('short', 'short')).toContain('8 characters');
    expect(passwordProblem('        ', '        ')).toContain('8 characters');
    expect(passwordProblem('long-enough', 'different')).toContain('do not match');
    expect(passwordProblem('  long-enough  ', '  long-enough  ')).toBe('');
  });
});
