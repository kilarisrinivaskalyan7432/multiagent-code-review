import { describe, expect, it, vi } from 'vitest';
import {
  ErrorCodes,
  ReviewError,
  formatError,
  isReviewError,
  withRetry,
  withTimeout,
} from '../src/utils/error-handler.js';

describe('error-handler', () => {
  it('retries a failing operation and eventually succeeds', async () => {
    let attempts = 0;

    const result = await withRetry(
      async () => {
        attempts += 1;

        if (attempts < 3) {
          throw new Error('temporary failure');
        }

        return 'success';
      },
      3,
      1
    );

    expect(result).toBe('success');
    expect(attempts).toBe(3);
  });

  it('throws RETRY_EXHAUSTED after retries are exhausted', async () => {
    await expect(
      withRetry(
        async () => {
          throw new Error('always fails');
        },
        2,
        1
      )
    ).rejects.toMatchObject({
      code: ErrorCodes.RETRY_EXHAUSTED,
    });
  });

  it('times out a slow operation', async () => {
    await expect(
      withTimeout(
        async () => {
          await new Promise((resolve) => setTimeout(resolve, 50));
          return 'finished';
        },
        5
      )
    ).rejects.toMatchObject({
      code: ErrorCodes.AGENT_TIMEOUT,
    });
  });

  it('identifies ReviewError correctly', () => {
    const error = new ReviewError(
      'Something failed',
      ErrorCodes.AGENT_FAILED
    );

    expect(isReviewError(error)).toBe(true);
    expect(formatError(error)).toBe(
      '[AGENT_FAILED] Something failed'
    );
  });

  it('formats normal errors', () => {
    expect(formatError(new Error('normal failure'))).toBe(
      'normal failure'
    );
  });
});
