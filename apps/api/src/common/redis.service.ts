import { Injectable, OnModuleDestroy } from '@nestjs/common';
import Redis from 'ioredis';

@Injectable()
export class RedisService implements OnModuleDestroy {
  private client: Redis;

  constructor() {
    this.client = new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379');
  }

  /** Cache a calculation result with TTL (default 1 hour) */
  async cacheResult(key: string, value: unknown, ttlSeconds = 3600): Promise<void> {
    await this.client.set(key, JSON.stringify(value), 'EX', ttlSeconds);
  }

  /** Retrieve cached calculation result */
  async getCachedResult<T>(key: string): Promise<T | null> {
    const raw = await this.client.get(key);
    return raw ? (JSON.parse(raw) as T) : null;
  }

  /** Invalidate cache for a specific key */
  async invalidate(key: string): Promise<void> {
    await this.client.del(key);
  }

  /** Build a cache key for a calculation */
  buildCacheKey(orgId: string, countryCode: string, fiscalYear: number): string {
    return `calc:${orgId}:${countryCode}:${fiscalYear}`;
  }

  async onModuleDestroy() {
    await this.client.quit();
  }
}
