import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

let _generationLimiter: Ratelimit | null = null;
let _checkoutLimiter: Ratelimit | null = null;

function getRedis() {
  return new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL!,
    token: process.env.UPSTASH_REDIS_REST_TOKEN!,
  });
}

export function getGenerationLimiter(): Ratelimit {
  if (!_generationLimiter) {
    _generationLimiter = new Ratelimit({
      redis: getRedis(),
      limiter: Ratelimit.slidingWindow(10, "1 m"),
      prefix: "ratelimit:generate",
    });
  }
  return _generationLimiter;
}

export function getCheckoutLimiter(): Ratelimit {
  if (!_checkoutLimiter) {
    _checkoutLimiter = new Ratelimit({
      redis: getRedis(),
      limiter: Ratelimit.slidingWindow(5, "1 m"),
      prefix: "ratelimit:checkout",
    });
  }
  return _checkoutLimiter;
}
