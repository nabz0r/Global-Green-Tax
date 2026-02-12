import { Injectable } from '@nestjs/common';
import {
  GreenTaxEngine,
  StrategyRegistry,
  Luxembourg2026Strategy,
  France2026Strategy,
} from '@ggt/engine';
import type { CalculationInput, CalculationResult } from '@ggt/shared';
import { PrismaService } from '../../common/prisma.service';
import { RedisService } from '../../common/redis.service';

@Injectable()
export class TaxService {
  private engine: GreenTaxEngine;

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {
    const registry = new StrategyRegistry();
    registry.register(new Luxembourg2026Strategy());
    registry.register(new France2026Strategy());
    this.engine = new GreenTaxEngine(registry);
  }

  async calculate(
    organizationId: string,
    countryCode: string,
    input: Omit<CalculationInput, 'organizationId' | 'countryCode'>,
  ): Promise<CalculationResult> {
    // Check cache first
    const cacheKey = this.redis.buildCacheKey(
      organizationId,
      countryCode,
      input.fiscalYear,
    );
    const cached = await this.redis.getCachedResult<CalculationResult>(cacheKey);
    if (cached) return cached;

    // Run calculation
    const fullInput: CalculationInput = {
      ...input,
      organizationId,
      countryCode,
    };

    const result = await this.engine.calculate(fullInput);

    // Persist to database
    await this.prisma.calculation.create({
      data: {
        organizationId,
        countryCode,
        fiscalYear: input.fiscalYear,
        input: fullInput as any,
        result: result as any,
        netAmount: result.netAmount,
        currency: result.currency,
        engineVersion: result.engineVersion,
      },
    });

    // Cache the result
    await this.redis.cacheResult(cacheKey, result);

    return result;
  }

  async getHistory(organizationId: string, limit = 20) {
    return this.prisma.calculation.findMany({
      where: { organizationId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }
}
