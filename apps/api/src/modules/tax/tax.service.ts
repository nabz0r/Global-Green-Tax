import { Injectable, Logger } from '@nestjs/common';
import {
  GreenTaxEngine,
  StrategyRegistry,
  Luxembourg2026Strategy,
  France2026Strategy,
  Germany2026Strategy,
  Belgium2026Strategy,
  Spain2026Strategy,
  Portugal2026Strategy,
} from '@ggt/engine';
import type { CalculationInput, CalculationResult } from '@ggt/shared';
import { PrismaService } from '../../common/prisma.service';
import { RedisService } from '../../common/redis.service';

@Injectable()
export class TaxService {
  private engine: GreenTaxEngine;
  private readonly logger = new Logger(TaxService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {
    const registry = new StrategyRegistry();
    registry.register(new Luxembourg2026Strategy());
    registry.register(new France2026Strategy());
    registry.register(new Germany2026Strategy());
    registry.register(new Belgium2026Strategy());
    registry.register(new Spain2026Strategy());
    registry.register(new Portugal2026Strategy());
    this.engine = new GreenTaxEngine(registry);
  }

  async calculate(
    organizationId: string,
    countryCode: string,
    input: Omit<CalculationInput, 'organizationId' | 'countryCode'>,
    userId?: string,
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

    // ─── Ingest into MarketAnalytic data lake ─────────────────────
    try {
      const org = await this.prisma.organization.findUnique({
        where: { id: organizationId },
        select: { sector: true },
      });

      // Classify investment types from line items
      const lineItems = result.lineItems || [];
      const investmentTypes = this.classifyInvestmentTypes(lineItems);
      const totalGrants = lineItems
        .filter((li: any) => li.amount > 0)
        .reduce((sum: number, li: any) => sum + li.amount, 0);

      for (const investmentType of investmentTypes) {
        await this.prisma.marketAnalytic.create({
          data: {
            countryCode,
            sector: org?.sector ?? null,
            investmentType,
            amount: result.netAmount,
            estimatedGrant: totalGrants,
            co2Tonnes: (input as any).co2Tonnes ?? null,
            employeeCount: (input as any).employeeCount ?? null,
            revenue: (input as any).revenue ?? null,
            userId: userId ?? null,
          },
        });
      }

      this.logger.debug(
        `Ingested ${investmentTypes.length} analytics entries for ${countryCode}`,
      );
    } catch (err) {
      // Analytics ingestion should never block the main calculation
      this.logger.warn(`Analytics ingestion failed: ${err}`);
    }

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

  /**
   * Classify line item codes into investment categories for analytics.
   */
  private classifyInvestmentTypes(lineItems: any[]): string[] {
    const types = new Set<string>();

    for (const li of lineItems) {
      const code = (li.code || '').toUpperCase();
      if (code.includes('PV') || code.includes('SOLAR') || code.includes('KFW') || code.includes('EDIFICIO')) {
        types.add('SOLAR');
      }
      if (code.includes('EV') || code.includes('MOVES') || code.includes('BONUS-ECO') || code.includes('UMWELT') || code.includes('FLEET') || code.includes('VE')) {
        types.add('EV');
      }
      if (code.includes('F4S') || code.includes('ADEME') || code.includes('BAFA') || code.includes('AMURE') || code.includes('AUDIT') || code.includes('IAPMEI')) {
        types.add('AUDIT');
      }
      if (code.includes('ENERGY') || code.includes('IBI') || code.includes('ECOPREMIE')) {
        types.add('ENERGY_EFFICIENCY');
      }
    }

    // If nothing matched, label as GENERAL
    if (types.size === 0) types.add('GENERAL');

    return Array.from(types);
  }
}
