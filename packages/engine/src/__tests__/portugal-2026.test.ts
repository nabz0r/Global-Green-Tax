import { describe, it, expect, beforeEach } from 'vitest';
import { GreenTaxEngine } from '../engine';
import { StrategyRegistry } from '../strategy-registry';
import { Portugal2026Strategy } from '../strategies/portugal-2026';
import type { CalculationInput } from '@ggt/shared';
import { EmissionScope } from '@ggt/shared';

function makeInput(overrides: Partial<CalculationInput> = {}): CalculationInput {
  return {
    organizationId: '550e8400-e29b-41d4-a716-446655440000',
    countryCode: 'PT',
    fiscalYear: 2026,
    co2Tonnes: 300,
    revenue: 5_000_000,
    employeeCount: 25,
    energyConsumptionKwh: 250_000,
    renewableEnergyPercent: 45,
    emissionsByScope: {
      [EmissionScope.SCOPE_1]: 180,
      [EmissionScope.SCOPE_2]: 90,
      [EmissionScope.SCOPE_3]: 30,
    },
    ...overrides,
  };
}

describe('Portugal2026Strategy', () => {
  let engine: GreenTaxEngine;

  beforeEach(() => {
    const registry = new StrategyRegistry();
    registry.register(new Portugal2026Strategy());
    engine = new GreenTaxEngine(registry);
  });

  // IRC Corporate Tax
  it('applies PME blended rate', async () => {
    const result = await engine.calculate(makeInput({ revenue: 5_000_000 }));
    const irc = result.lineItems.find((i) => i.code === 'PT-IRC-2026');
    expect(irc).toBeDefined();
    // profit = 500k, PME: 25k * 17% + 475k * 21%
    const expected = 25_000 * 0.17 + 475_000 * 0.21;
    expect(irc!.amount).toBeCloseTo(-expected, 0);
  });

  it('applies full PME rate when profit under threshold', async () => {
    const result = await engine.calculate(makeInput({ revenue: 200_000 }));
    const irc = result.lineItems.find((i) => i.code === 'PT-IRC-2026');
    // profit = 20k < 25k threshold, full 17%
    expect(irc!.amount).toBeCloseTo(-(20_000 * 0.17), 0);
  });

  it('applies standard rate for large enterprise', async () => {
    const result = await engine.calculate(makeInput({
      revenue: 100_000_000,
      employeeCount: 500,
    }));
    const irc = result.lineItems.find((i) => i.code === 'PT-IRC-2026');
    // profit = 10M, standard 21%
    expect(irc!.amount).toBeCloseTo(-(10_000_000 * 0.21), 0);
  });

  // IVA Reduzido
  it('calculates IVA savings for solar', async () => {
    const result = await engine.calculate(makeInput({
      metadata: { solarCapacityKWp: 20 },
    }));
    const iva = result.lineItems.find((i) => i.code === 'PT-IVA-GREEN-2026');
    expect(iva).toBeDefined();
    // investment = 20 * 1200 = 24k, savings = 24k * (0.23 - 0.06) = 4,080
    expect(iva!.amount).toBeCloseTo(4_080, 0);
  });

  it('returns 0 IVA savings without solar', async () => {
    const result = await engine.calculate(makeInput());
    const iva = result.lineItems.find((i) => i.code === 'PT-IVA-GREEN-2026');
    expect(iva!.amount).toBe(0);
  });

  // Fundo Ambiental
  it('calculates Fundo Ambiental at 85%', async () => {
    const result = await engine.calculate(makeInput({
      metadata: { sustainabilityAuditExpense: 5_000 },
    }));
    const fundo = result.lineItems.find((i) => i.code === 'PT-FUNDO-AMB-2026');
    expect(fundo!.amount).toBeCloseTo(4_250, 0); // 5k * 85%
  });

  it('caps Fundo Ambiental at 7,500 EUR', async () => {
    const result = await engine.calculate(makeInput({
      metadata: { sustainabilityAuditExpense: 20_000 },
    }));
    const fundo = result.lineItems.find((i) => i.code === 'PT-FUNDO-AMB-2026');
    expect(fundo!.amount).toBe(7_500);
  });

  // EV Incentive
  it('calculates EV incentive', async () => {
    const result = await engine.calculate(makeInput({
      metadata: { evCount: 3 },
    }));
    const ev = result.lineItems.find((i) => i.code === 'PT-EV-INCENTIVO-2026');
    expect(ev!.amount).toBe(12_000); // 3 * 4000
  });

  // Energy Savings
  it('estimates energy savings with Portuguese insolation (1500 kWh/kWp)', async () => {
    const result = await engine.calculate(makeInput({
      metadata: { solarCapacityKWp: 10, selfConsumptionRatio: 0.50 },
    }));
    const savings = result.lineItems.find((i) => i.code === 'PT-ENERGY-SAVINGS-2026');
    expect(savings).toBeDefined();
    // 10 * 1500 = 15000, self = 7500 * 0.23 = 1725, surplus = 7500 * 0.055 = 412.5
    expect(savings!.amount).toBeCloseTo(2137.5, 1);
  });

  // Integration
  it('returns correct metadata', async () => {
    const result = await engine.calculate(makeInput());
    expect(result.countryCode).toBe('PT');
    expect(result.fiscalYear).toBe(2026);
    expect(result.currency).toBe('EUR');
  });

  it('computes correct net amount', async () => {
    const result = await engine.calculate(makeInput({
      metadata: { solarCapacityKWp: 10, selfConsumptionRatio: 0.50, evCount: 2, sustainabilityAuditExpense: 5_000 },
    }));
    const sum = result.lineItems.reduce((s, i) => s + i.amount, 0);
    expect(result.netAmount).toBeCloseTo(sum, 2);
  });
});
