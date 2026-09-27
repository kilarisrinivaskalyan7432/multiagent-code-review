import { describe, expect, it } from 'vitest';
import {
  RateLimiter,
  withRateLimit,
} from '../src/utils/rate-limiter.js';

describe('RateLimiter', () => {
  it('allows requests within configured limits', async () => {
    const limiter = new RateLimiter({
      maxRequestsPerMinute: 2,
      maxTokensPerMinute: 1000,
      maxConcurrent: 1,
    });

    expect(limiter.canProceed(100)).toBe(true);

    await limiter.acquire(100);

    expect(limiter.getStatus().requestsInWindow).toBe(1);
    expect(limiter.getStatus().tokensInWindow).toBe(100);
  });

  it('rejects negative token estimates', async () => {
    const limiter = new RateLimiter();

    await expect(limiter.acquire(-1)).rejects.toThrow(
      'Estimated tokens cannot be negative.'
    );
  });

  it('enforces request-per-minute limits', async () => {
    const limiter = new RateLimiter({
      maxRequestsPerMinute: 1,
      maxTokensPerMinute: 10000,
      maxConcurrent: 2,
    });

    await limiter.acquire(100);

    expect(limiter.canProceed(100)).toBe(false);

    limiter.release();

    expect(limiter.getStatus().requestsInWindow).toBe(1);
  });

  it('enforces token-per-minute limits', async () => {
    const limiter = new RateLimiter({
      maxRequestsPerMinute: 10,
      maxTokensPerMinute: 1000,
      maxConcurrent: 2,
    });

    await limiter.acquire(900);

    expect(limiter.canProceed(200)).toBe(false);

    limiter.release();
  });

  it('releases a concurrent request after withRateLimit completes', async () => {
    const limiter = new RateLimiter({
      maxRequestsPerMinute: 10,
      maxTokensPerMinute: 10000,
      maxConcurrent: 1,
    });

    await withRateLimit(
      limiter,
      async () => {
        expect(limiter.getStatus().activeRequests).toBe(1);
      },
      100
    );

    expect(limiter.getStatus().activeRequests).toBe(0);
  });

  it('does not allow more concurrent requests than configured', async () => {
    const limiter = new RateLimiter({
      maxRequestsPerMinute: 10,
      maxTokensPerMinute: 10000,
      maxConcurrent: 1,
    });

    let releaseFirst!: () => void;

    const firstRequest = limiter.acquire(100).then(
      () =>
        new Promise<void>((resolve) => {
          releaseFirst = resolve;
        })
    );

    await new Promise((resolve) => setTimeout(resolve, 5));

    expect(limiter.getStatus().activeRequests).toBe(1);

    let secondAcquired = false;

    const secondRequest = limiter.acquire(100).then(() => {
      secondAcquired = true;
      limiter.release();
    });

    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(secondAcquired).toBe(false);

    releaseFirst();
    await firstRequest;
    limiter.release();

    await secondRequest;

    expect(secondAcquired).toBe(true);
    expect(limiter.getStatus().activeRequests).toBe(0);
  });
});
