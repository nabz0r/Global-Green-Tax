import { describe, it, expect, beforeEach } from 'vitest';
import { GreenTaxEngine } from '../engine';
import { StrategyRegistry } from '../strategy-registry';
import { Spain2026Strategy } from '../strategies/spain-2026';
import type { CalculationInput } from '@ggt/shared';
import { EmissionScope } from '@ggt/shared';

function makeInput(overrides: Partial<CalculationInput> = {}): CalculationInput {
  return {
    organizationId: '550e8400-e29b-41d4-a716-446655440000',
    countryCode: 'ES',
    fiscalYear: 2026,
    co2Tonnes: 500,
    revenue: 5_000_000,
    employeeCount: 30,
    energyConsumptionKwh: 300_000,
    renewableEnergyPercent: 50,
    emissionsByScope: {
      [EmissionScope.SCOPE_1]: 300,
      [EmissionScope.SCOPE_2]: 150,
      [EmissionScope.SCOPE_3]: 50,
    },
    ...overrides,
  };
}

describe('Spain2026Strategy', () => {
  let engine: GreenTaxEngine;

  beforeEach(() => {
    const registry = new StrategyRegistry();
    registry.register(new Spain2026Strategy());
    engine = new GreenTaxEngine(registry);
  });

  // Corporate Tax
  it('applies PYME rate for small revenue', async () => {
    const result = await engine.calculate(makeInput({ revenue: 800_000 }));
    const is = result.lineItems.find((i) => i.code === 'ES-IS-2026');
    expect(is).toBeDefined();
    // profit = 80k, rate = 23%
    expect(is!.amount).toBeCloseTo(-(80_000 * 0.23), 0);
  });

  it('applies standard rate for large revenue', async () => {
    const result = await engine.calculate(makeInput({ revenue: 5_000_000 }));
    const is = result.lineItems.find((i) => i.code === 'ES-IS-2026');
    // profit = 500k, rate = 25%
    expect(is!.amount).toBeCloseTo(-(500_000 * 0.25), 0);
  });

  // IBI Bonificación
  it('calculates IBI solar bonificación', async () => {
    const result = await engine.calculate(makeInput({
      metadata: { solarCapacityKWp: 20 },
    }));
    const ibi = result.lineItems.find((i) => i.code === 'ES-IBI-SOLAR-2026');
    expect(ibi).toBeDefined();
    expect(ibi!.amount).toBe(1_000); // 2000 * 50%
  });

  it('returns 0 IBI without solar', async () => {
    const result = await engine.calculate(makeInput());
    const ibi = result.lineItems.find((i) => i.code === 'ES-IBI-SOLAR-2026');
    expect(ibi!.amount).toBe(0);
  });

  // Programa Autoconsumo
  it('calculates NextGen solar subsidy', async () => {
    const result = await engine.calculate(makeInput({
      metadata: { solarCapacityKWp: 15 },
    }));
    const solar = result.lineItems.find((i) => i.code === 'ES-NEXTGEN-SOLAR-2026');
    expect(solar!.amount).toBe(9_000); // 15 * 600
  });

  it('caps NextGen at 12,000 EUR', async () => {
    const result = await engine.calculate(makeInput({
      metadata: { solarCapacityKWp: 50 },
    }));
    const solar = result.lineItems.find((i) => i.code === 'ES-NEXTGEN-SOLAR-2026');
    expect(solar!.amount).toBe(12_000);
  });

  // MOVES III
  it('calculates MOVES EV grant', async () => {
    const result = await engine.calculate(makeInput({
      metadata: { evCount: 4 },
    }));
    const moves = result.lineItems.find((i) => i.code === 'ES-MOVES-2026');
    expect(moves!.amount).toBe(20_000); // 4 * 5000
  });

  // Energy Savings
  it('estimates energy savings with Spanish insolation (1500 kWh/kWp)', async () => {
    const result = await engine.calculate(makeInput({
      metadata: { solarCapacityKWp: 20, selfConsumptionRatio: 0.70 },
    }));
    const savings = result.lineItems.find((i) => i.code === 'ES-ENERGY-SAVINGS-2026');
    expect(savings).toBeDefined();
    // 20 * 1500 = 30000, self = 21000 * 0.21 = 4410, surplus = 9000 * 0.06 = 540
    expect(savings!.amount).toBeCloseTo(4950, 1);
  });

  // Integration
  it('returns correct metadata', async () => {
    const result = await engine.calculate(makeInput());
    expect(result.countryCode).toBe('ES');
    expect(result.fiscalYear).toBe(2026);
    expect(result.currency).toBe('EUR');
  });

  it('computes correct net amount', async () => {
    const result = await engine.calculate(makeInput({
      metadata: { solarCapacityKWp: 20, selfConsumptionRatio: 0.70, evCount: 3 },
    }));
    const sum = result.lineItems.reduce((s, i) => s + i.amount, 0);
    expect(result.netAmount).toBeCloseTo(sum, 2);
  });
});
