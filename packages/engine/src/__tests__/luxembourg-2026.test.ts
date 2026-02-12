import { describe, it, expect, beforeEach } from 'vitest';
import { GreenTaxEngine } from '../engine';
import { StrategyRegistry } from '../strategy-registry';
import { Luxembourg2026Strategy } from '../strategies/luxembourg-2026';
import type { CalculationInput } from '@ggt/shared';
import { EmissionScope } from '@ggt/shared';

function makeInput(overrides: Partial<CalculationInput> = {}): CalculationInput {
  return {
    organizationId: '550e8400-e29b-41d4-a716-446655440000',
    countryCode: 'LU',
    fiscalYear: 2026,
    co2Tonnes: 1000,
    revenue: 5_000_000,
    employeeCount: 50,
    energyConsumptionKwh: 500_000,
    renewableEnergyPercent: 60,
    emissionsByScope: {
      [EmissionScope.SCOPE_1]: 600,
      [EmissionScope.SCOPE_2]: 300,
      [EmissionScope.SCOPE_3]: 100,
    },
    ...overrides,
  };
}

describe('Luxembourg2026Strategy', () => {
  let engine: GreenTaxEngine;

  beforeEach(() => {
    const registry = new StrategyRegistry();
    registry.register(new Luxembourg2026Strategy());
    engine = new GreenTaxEngine(registry);
  });

  it('calculates CO2 tax across brackets', async () => {
    const result = await engine.calculate(makeInput({ co2Tonnes: 1000 }));
    const co2Item = result.lineItems.find((i) => i.code === 'LU-CO2-TAX-2026');

    expect(co2Item).toBeDefined();
    expect(co2Item!.amount).toBeLessThan(0); // tax is negative

    // 500t @ €45 = €22,500 + 500t @ €65 = €32,500 = €55,000
    expect(co2Item!.amount).toBe(-55_000);
  });

  it('calculates Klimabonus for qualifying orgs', async () => {
    const result = await engine.calculate(makeInput({ renewableEnergyPercent: 70 }));
    const klimaItem = result.lineItems.find((i) => i.code === 'LU-KLIMABONUS-2026');

    expect(klimaItem).toBeDefined();
    expect(klimaItem!.amount).toBeGreaterThan(0); // subsidy is positive
    // Base 10,000 + 20% above threshold × 800 = 10,000 + 16,000 = 26,000
    expect(klimaItem!.amount).toBe(26_000);
  });

  it('returns 0 Klimabonus when below renewable threshold', async () => {
    const result = await engine.calculate(makeInput({ renewableEnergyPercent: 30 }));
    const klimaItem = result.lineItems.find((i) => i.code === 'LU-KLIMABONUS-2026');

    expect(klimaItem).toBeDefined();
    expect(klimaItem!.amount).toBe(0);
  });

  it('caps Klimabonus at max amount', async () => {
    const result = await engine.calculate(makeInput({ renewableEnergyPercent: 100 }));
    const klimaItem = result.lineItems.find((i) => i.code === 'LU-KLIMABONUS-2026');

    expect(klimaItem).toBeDefined();
    // Base 10,000 + 50% × 800 = 10,000 + 40,000 = 50,000 (equals max)
    expect(klimaItem!.amount).toBeLessThanOrEqual(50_000);
  });

  it('calculates Fit 4 Sustainability for eligible SMEs', async () => {
    const result = await engine.calculate(
      makeInput({ employeeCount: 100, revenue: 10_000_000 })
    );
    const fit4Item = result.lineItems.find((i) => i.code === 'LU-FIT4-SUSTAIN-2026');

    expect(fit4Item).toBeDefined();
    expect(fit4Item!.amount).toBeGreaterThan(0);
    // Base 25,000 + 100 × 500 = 75,000
    expect(fit4Item!.amount).toBe(75_000);
  });

  it('returns 0 Fit 4 for large enterprises', async () => {
    const result = await engine.calculate(
      makeInput({ employeeCount: 500, revenue: 100_000_000 })
    );
    const fit4Item = result.lineItems.find((i) => i.code === 'LU-FIT4-SUSTAIN-2026');

    expect(fit4Item).toBeDefined();
    expect(fit4Item!.amount).toBe(0);
  });

  it('computes correct net amount', async () => {
    const result = await engine.calculate(makeInput());
    const sum = result.lineItems.reduce((s, i) => s + i.amount, 0);
    expect(result.netAmount).toBe(sum);
  });

  it('throws for unknown jurisdiction', async () => {
    await expect(
      engine.calculate(makeInput({ countryCode: 'XX' }))
    ).rejects.toThrow(/No strategy registered/);
  });

  it('returns correct metadata in result', async () => {
    const result = await engine.calculate(makeInput());
    expect(result.countryCode).toBe('LU');
    expect(result.fiscalYear).toBe(2026);
    expect(result.currency).toBe('EUR');
    expect(result.engineVersion).toBe('0.1.0');
    expect(result.calculatedAt).toBeInstanceOf(Date);
  });
});
