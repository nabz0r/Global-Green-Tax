import { describe, it, expect, beforeEach } from 'vitest';
import { GreenTaxEngine } from '../engine';
import { StrategyRegistry } from '../strategy-registry';
import { Belgium2026Strategy } from '../strategies/belgium-2026';
import type { CalculationInput } from '@ggt/shared';
import { EmissionScope } from '@ggt/shared';

function makeInput(overrides: Partial<CalculationInput> = {}): CalculationInput {
  return {
    organizationId: '550e8400-e29b-41d4-a716-446655440000',
    countryCode: 'BE',
    fiscalYear: 2026,
    co2Tonnes: 500,
    revenue: 5_000_000,
    employeeCount: 30,
    energyConsumptionKwh: 300_000,
    renewableEnergyPercent: 35,
    emissionsByScope: {
      [EmissionScope.SCOPE_1]: 300,
      [EmissionScope.SCOPE_2]: 150,
      [EmissionScope.SCOPE_3]: 50,
    },
    ...overrides,
  };
}

describe('Belgium2026Strategy', () => {
  let engine: GreenTaxEngine;

  beforeEach(() => {
    const registry = new StrategyRegistry();
    registry.register(new Belgium2026Strategy());
    engine = new GreenTaxEngine(registry);
  });

  // Corporate Tax (ISOC)
  it('applies SME rate for small companies', async () => {
    const result = await engine.calculate(makeInput({ revenue: 2_000_000 }));
    const isoc = result.lineItems.find((i) => i.code === 'BE-ISOC-2026');
    expect(isoc).toBeDefined();
    expect(isoc!.amount).toBeLessThan(0);
  });

  it('applies standard rate for large companies', async () => {
    const result = await engine.calculate(makeInput({ revenue: 20_000_000 }));
    const isoc = result.lineItems.find((i) => i.code === 'BE-ISOC-2026');
    expect(isoc).toBeDefined();
    expect(isoc!.amount).toBeLessThan(0);
  });

  // Green Investment Deduction
  it('calculates green investment tax deduction', async () => {
    const result = await engine.calculate(makeInput({
      metadata: { solarCapacityKWp: 20 },
    }));
    const deduct = result.lineItems.find((i) => i.code === 'BE-INVEST-DEDUCT-2026');
    expect(deduct).toBeDefined();
    // investment = 20 * 1500 = 30k, deduction = 30k * 0.275 = 8250
    // tax saved = 8250 * 0.20 (SME) = 1650
    expect(deduct!.amount).toBeCloseTo(1_650, 0);
  });

  // Ecologiepremie Plus
  it('calculates Ecologiepremie at 50% for small enterprise', async () => {
    const result = await engine.calculate(makeInput({
      employeeCount: 20,
      revenue: 3_000_000,
      metadata: { solarCapacityKWp: 20 },
    }));
    const eco = result.lineItems.find((i) => i.code === 'BE-ECOPREMIE-2026');
    expect(eco).toBeDefined();
    // investment = 20 * 1500 = 30k, grant = 30k * 50% = 15k
    expect(eco!.amount).toBe(15_000);
  });

  it('calculates Ecologiepremie at 15% for large enterprise', async () => {
    const result = await engine.calculate(makeInput({
      employeeCount: 500,
      revenue: 100_000_000,
      metadata: { solarCapacityKWp: 20 },
    }));
    const eco = result.lineItems.find((i) => i.code === 'BE-ECOPREMIE-2026');
    // investment = 30k, grant = 30k * 15% = 4500
    expect(eco!.amount).toBe(4_500);
  });

  // AMURE
  it('calculates AMURE at 75%', async () => {
    const result = await engine.calculate(makeInput({
      metadata: { sustainabilityAuditExpense: 40_000 },
    }));
    const amure = result.lineItems.find((i) => i.code === 'BE-AMURE-2026');
    expect(amure!.amount).toBe(30_000); // 40k * 75%
  });

  it('caps AMURE at 50,000 EUR', async () => {
    const result = await engine.calculate(makeInput({
      metadata: { sustainabilityAuditExpense: 100_000 },
    }));
    const amure = result.lineItems.find((i) => i.code === 'BE-AMURE-2026');
    expect(amure!.amount).toBe(50_000);
  });

  // Fleet EV
  it('calculates fleet EV prime', async () => {
    const result = await engine.calculate(makeInput({
      metadata: { evCount: 4 },
    }));
    const ev = result.lineItems.find((i) => i.code === 'BE-FLEET-EV-2026');
    expect(ev!.amount).toBe(20_000); // 4 * 5000
  });

  // Energy Savings
  it('estimates energy savings with Belgian insolation (900 kWh/kWp)', async () => {
    const result = await engine.calculate(makeInput({
      metadata: { solarCapacityKWp: 20, selfConsumptionRatio: 0.50 },
    }));
    const savings = result.lineItems.find((i) => i.code === 'BE-ENERGY-SAVINGS-2026');
    expect(savings).toBeDefined();
    // 20 * 900 = 18000, self = 9000 * 0.32 = 2880, surplus = 9000 * 0.09 = 810
    expect(savings!.amount).toBeCloseTo(3690, 1);
  });

  // Integration
  it('returns correct metadata', async () => {
    const result = await engine.calculate(makeInput());
    expect(result.countryCode).toBe('BE');
    expect(result.fiscalYear).toBe(2026);
    expect(result.currency).toBe('EUR');
  });

  it('computes correct net amount', async () => {
    const result = await engine.calculate(makeInput({
      metadata: { solarCapacityKWp: 20, selfConsumptionRatio: 0.50, evCount: 2, sustainabilityAuditExpense: 30_000 },
    }));
    const sum = result.lineItems.reduce((s, i) => s + i.amount, 0);
    expect(result.netAmount).toBeCloseTo(sum, 2);
  });
});
