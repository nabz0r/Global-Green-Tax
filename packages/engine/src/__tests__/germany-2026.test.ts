import { describe, it, expect, beforeEach } from 'vitest';
import { GreenTaxEngine } from '../engine';
import { StrategyRegistry } from '../strategy-registry';
import { Germany2026Strategy } from '../strategies/germany-2026';
import type { CalculationInput } from '@ggt/shared';
import { EmissionScope } from '@ggt/shared';

function makeInput(overrides: Partial<CalculationInput> = {}): CalculationInput {
  return {
    organizationId: '550e8400-e29b-41d4-a716-446655440000',
    countryCode: 'DE',
    fiscalYear: 2026,
    co2Tonnes: 1000,
    revenue: 5_000_000,
    employeeCount: 30,
    energyConsumptionKwh: 400_000,
    renewableEnergyPercent: 40,
    emissionsByScope: {
      [EmissionScope.SCOPE_1]: 600,
      [EmissionScope.SCOPE_2]: 300,
      [EmissionScope.SCOPE_3]: 100,
    },
    ...overrides,
  };
}

describe('Germany2026Strategy', () => {
  let engine: GreenTaxEngine;

  beforeEach(() => {
    const registry = new StrategyRegistry();
    registry.register(new Germany2026Strategy());
    engine = new GreenTaxEngine(registry);
  });

  // nEHS Carbon Tax
  it('calculates nEHS at 65 EUR/t', async () => {
    const result = await engine.calculate(makeInput({ co2Tonnes: 1000 }));
    const nehs = result.lineItems.find((i) => i.code === 'DE-NEHS-2026');
    expect(nehs).toBeDefined();
    expect(nehs!.amount).toBe(-65_000);
  });

  it('returns no nEHS for zero emissions', async () => {
    const result = await engine.calculate(makeInput({ co2Tonnes: 0 }));
    const nehs = result.lineItems.find((i) => i.code === 'DE-NEHS-2026');
    expect(nehs).toBeUndefined();
  });

  // Corporate Tax
  it('calculates KSt + Soli + GewSt correctly', async () => {
    const result = await engine.calculate(makeInput({ revenue: 10_000_000 }));
    const corp = result.lineItems.find((i) => i.code === 'DE-CORP-TAX-2026');
    expect(corp).toBeDefined();
    // profit = 1M, KSt = 150k, Soli = 8250, GewSt = 1M * 0.035 * 4 = 140k
    // total = 298,250
    const profit = 1_000_000;
    const kst = profit * 0.15;
    const soli = kst * 0.055;
    const gewst = profit * 0.035 * 4;
    expect(corp!.amount).toBeCloseTo(-(kst + soli + gewst), 0);
  });

  // KfW 270
  it('calculates KfW 270 solar subsidy', async () => {
    const result = await engine.calculate(makeInput({
      metadata: { solarCapacityKWp: 20 },
    }));
    const kfw = result.lineItems.find((i) => i.code === 'DE-KFW270-2026');
    expect(kfw!.amount).toBe(6_000); // 20 * 300
  });

  it('caps KfW 270 at 15,000 EUR', async () => {
    const result = await engine.calculate(makeInput({
      metadata: { solarCapacityKWp: 100 },
    }));
    const kfw = result.lineItems.find((i) => i.code === 'DE-KFW270-2026');
    expect(kfw!.amount).toBe(15_000);
  });

  // BAFA EE
  it('calculates BAFA EE at 35% for SME', async () => {
    const result = await engine.calculate(makeInput({
      employeeCount: 30,
      revenue: 5_000_000,
      metadata: { sustainabilityAuditExpense: 50_000 },
    }));
    const bafa = result.lineItems.find((i) => i.code === 'DE-BAFA-EE-2026');
    expect(bafa!.amount).toBe(17_500); // 50k * 35%
  });

  it('calculates BAFA EE at 20% for large enterprise', async () => {
    const result = await engine.calculate(makeInput({
      employeeCount: 500,
      revenue: 100_000_000,
      metadata: { sustainabilityAuditExpense: 80_000 },
    }));
    const bafa = result.lineItems.find((i) => i.code === 'DE-BAFA-EE-2026');
    expect(bafa!.amount).toBe(16_000); // 80k * 20%
  });

  it('caps BAFA EE at 100,000 EUR', async () => {
    const result = await engine.calculate(makeInput({
      metadata: { sustainabilityAuditExpense: 500_000 },
    }));
    const bafa = result.lineItems.find((i) => i.code === 'DE-BAFA-EE-2026');
    expect(bafa!.amount).toBe(100_000);
  });

  // Umweltbonus
  it('calculates Umweltbonus EV grant', async () => {
    const result = await engine.calculate(makeInput({
      metadata: { evCount: 5 },
    }));
    const ev = result.lineItems.find((i) => i.code === 'DE-UMWELTBONUS-2026');
    expect(ev!.amount).toBe(15_000); // 5 * 3000
  });

  // Energy Savings
  it('estimates energy savings with German insolation (950 kWh/kWp)', async () => {
    const result = await engine.calculate(makeInput({
      metadata: { solarCapacityKWp: 20, selfConsumptionRatio: 0.60 },
    }));
    const savings = result.lineItems.find((i) => i.code === 'DE-ENERGY-SAVINGS-2026');
    expect(savings).toBeDefined();
    // 20 * 950 = 19000 kWh, self = 11400 * 0.38 = 4332, surplus = 7600 * 0.082 = 623.2
    expect(savings!.amount).toBeCloseTo(4955.2, 1);
  });

  // Integration
  it('returns correct metadata', async () => {
    const result = await engine.calculate(makeInput());
    expect(result.countryCode).toBe('DE');
    expect(result.fiscalYear).toBe(2026);
    expect(result.currency).toBe('EUR');
  });

  it('computes correct net amount', async () => {
    const result = await engine.calculate(makeInput({
      metadata: { solarCapacityKWp: 20, selfConsumptionRatio: 0.60, evCount: 3, sustainabilityAuditExpense: 40_000 },
    }));
    const sum = result.lineItems.reduce((s, i) => s + i.amount, 0);
    expect(result.netAmount).toBeCloseTo(sum, 2);
  });
});
