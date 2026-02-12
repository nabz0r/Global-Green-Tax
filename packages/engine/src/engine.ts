import {
  CalculationInputSchema,
} from '@ggt/shared';
import type {
  CalculationInput,
  CalculationResult,
} from '@ggt/shared';
import { StrategyRegistry } from './strategy-registry';

const ENGINE_VERSION = '0.1.0';

/**
 * Core calculation engine.
 * Validates input, delegates to the appropriate JurisdictionStrategy,
 * and assembles the final CalculationResult.
 */
export class GreenTaxEngine {
  constructor(private readonly registry: StrategyRegistry) {}

  async calculate(rawInput: CalculationInput): Promise<CalculationResult> {
    // 1. Validate input with Zod
    const input = CalculationInputSchema.parse(rawInput);

    // 2. Resolve strategy
    const strategy = this.registry.get(input.countryCode, input.fiscalYear);
    if (!strategy) {
      throw new Error(
        `No strategy registered for country "${input.countryCode}" fiscal year ${input.fiscalYear}. ` +
        `Available: [${this.registry.listRegistered().join(', ')}]`
      );
    }

    // 3. Run jurisdiction-specific validation if provided
    if (strategy.validateInput) {
      strategy.validateInput(input);
    }

    // 4. Execute calculation
    const lineItems = await strategy.calculate(input);

    // 5. Compute net amount
    const netAmount = lineItems.reduce((sum, item) => sum + item.amount, 0);

    return {
      organizationId: input.organizationId,
      countryCode: input.countryCode,
      fiscalYear: input.fiscalYear,
      calculatedAt: new Date(),
      currency: strategy.currency,
      lineItems,
      netAmount,
      engineVersion: ENGINE_VERSION,
    };
  }
}
