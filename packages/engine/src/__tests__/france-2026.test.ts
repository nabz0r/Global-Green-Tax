import { describe, it, expect, beforeEach } from 'vitest';
import { GreenTaxEngine } from '../engine';
import { StrategyRegistry } from '../strategy-registry';
import { France2026Strategy } from '../strategies/france-2026';
import type { CalculationInput } from '@ggt/shared';
import { EmissionScope } from '@ggt/shared';

function makeInput(overrides: Partial<CalculationInput> = {}): CalculationInput {
  return {
    organizationId: '550e8400-e29b-41d4-a716-446655440000',
    countryCode: 'FR',
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

describe('France2026Strategy', () => {
  let engine: GreenTaxEngine;

  beforeEach(() => {
    const registry = new StrategyRegistry();
    registry.register(new France2026Strategy());
    engine = new GreenTaxEngine(registry);
  });

  // ─── CCE (Carbon Tax) ─────────────────────────────────────────

  it('calculates CCE at flat rate 44.60 EUR/t', async () => {
    const result = await engine.calculate(makeInput({ co2Tonnes: 1000 }));
    const cce = result.lineItems.find((i) => i.code === 'FR-CCE-2026');

    expect(cce).toBeDefined();
    expect(cce!.amount).toBe(-44_600); // 1000 * 44.60
  });

  it('returns no CCE for zero emissions', async () => {
    const result = await engine.calculate(makeInput({ co2Tonnes: 0 }));
    const cce = result.lineItems.find((i) => i.code === 'FR-CCE-2026');
    expect(cce).toBeUndefined();
  });

  // ─── Corporate Tax (IS + CVAE) ────────────────────────────────

  it('applies reduced PME rate for small companies', async () => {
    // Revenue 2M => profit 200k, PME rate
    // First 42,500 at 15% = 6,375, rest 157,500 at 25% = 39,375 => IS = 45,750
    // CVAE = 2M * 0.09% = 1,800
    const result = await engine.calculate(makeInput({ revenue: 2_000_000 }));
    const is = result.lineItems.find((i) => i.code === 'FR-IS-2026');

    expect(is).toBeDefined();
    expect(is!.amount).toBeLessThan(0);
    const expectedIS = 42_500 * 0.15 + (200_000 - 42_500) * 0.25;
    const expectedCVAE = 2_000_000 * 0.0009;
    expect(is!.amount).toBeCloseTo(-(expectedIS + expectedCVAE), 0);
  });

  it('applies standard rate for large companies', async () => {
    // Revenue 20M => profit 2M, standard rate 25%
    const result = await engine.calculate(makeInput({ revenue: 20_000_000 }));
    const is = result.lineItems.find((i) => i.code === 'FR-IS-2026');

    const expectedIS = 2_000_000 * 0.25;
    const expectedCVAE = 20_000_000 * 0.0009;
    expect(is!.amount).toBeCloseTo(-(expectedIS + expectedCVAE), 0);
  });

  it('applies full reduced rate when profit under threshold', async () => {
    // Revenue 400k => profit 40k < 42,500 threshold, full 15%
    const result = await engine.calculate(makeInput({ revenue: 400_000 }));
    const is = result.lineItems.find((i) => i.code === 'FR-IS-2026');

    const expectedIS = 40_000 * 0.15;
    const expectedCVAE = 400_000 * 0.0009;
    expect(is!.amount).toBeCloseTo(-(expectedIS + expectedCVAE), 0);
  });

  // ─── Prime Autoconsommation PV ────────────────────────────────

  it('calculates PV prime in first tier only (< 9 kWp)', async () => {
    const result = await engine.calculate(makeInput({
      metadata: { solarCapacityKWp: 6 },
    }));
    const pv = result.lineItems.find((i) => i.code === 'FR-PV-PRIME-2026');

    expect(pv).toBeDefined();
    // 6 kWp * 80 EUR = 480
    expect(pv!.amount).toBe(480);
  });

  it('calculates PV prime across two tiers', async () => {
    const result = await engine.calculate(makeInput({
      metadata: { solarCapacityKWp: 20 },
    }));
    const pv = result.lineItems.find((i) => i.code === 'FR-PV-PRIME-2026');

    // 9 kWp * 80 = 720, 11 kWp * 140 = 1,540 => total 2,260
    expect(pv!.amount).toBe(2_260);
  });

  it('calculates PV prime across all three tiers', async () => {
    const result = await engine.calculate(makeInput({
      metadata: { solarCapacityKWp: 50 },
    }));
    const pv = result.lineItems.find((i) => i.code === 'FR-PV-PRIME-2026');

    // 9 * 80 = 720, 27 * 140 = 3,780, 14 * 70 = 980 => total 5,480
    expect(pv!.amount).toBe(5_480);
  });

  it('returns 0 PV prime when no solar', async () => {
    const result = await engine.calculate(makeInput());
    const pv = result.lineItems.find((i) => i.code === 'FR-PV-PRIME-2026');
    expect(pv!.amount).toBe(0);
  });

  // ─── Bonus Écologique ─────────────────────────────────────────

  it('calculates car EV grant', async () => {
    const result = await engine.calculate(makeInput({
      metadata: { evCount: 5 },
    }));
    const bonus = result.lineItems.find((i) => i.code === 'FR-BONUS-ECO-2026');

    expect(bonus!.amount).toBe(15_000); // 5 * 3000
  });

  it('calculates van EV grant', async () => {
    const result = await engine.calculate(makeInput({
      metadata: { evCountVans: 3 },
    }));
    const bonus = result.lineItems.find((i) => i.code === 'FR-BONUS-ECO-2026');

    expect(bonus!.amount).toBe(12_000); // 3 * 4000
  });

  it('combines car and van grants', async () => {
    const result = await engine.calculate(makeInput({
      metadata: { evCount: 2, evCountVans: 3 },
    }));
    const bonus = result.lineItems.find((i) => i.code === 'FR-BONUS-ECO-2026');

    // 2 * 3000 + 3 * 4000 = 18,000
    expect(bonus!.amount).toBe(18_000);
  });

  // ─── ADEME Tremplin ───────────────────────────────────────────

  it('calculates ADEME at 50% for small enterprise', async () => {
    const result = await engine.calculate(makeInput({
      employeeCount: 20,
      revenue: 3_000_000,
      metadata: { sustainabilityAuditExpense: 80_000 },
    }));
    const ademe = result.lineItems.find((i) => i.code === 'FR-ADEME-TREMPLIN-2026');

    expect(ademe!.amount).toBe(40_000); // 80k * 50%
  });

  it('calculates ADEME at 30% for medium enterprise', async () => {
    const result = await engine.calculate(makeInput({
      employeeCount: 150,
      revenue: 30_000_000,
      metadata: { sustainabilityAuditExpense: 100_000 },
    }));
    const ademe = result.lineItems.find((i) => i.code === 'FR-ADEME-TREMPLIN-2026');

    expect(ademe!.amount).toBe(30_000); // 100k * 30%
  });

  it('caps ADEME at 200,000 EUR', async () => {
    const result = await engine.calculate(makeInput({
      employeeCount: 20,
      revenue: 3_000_000,
      metadata: { sustainabilityAuditExpense: 500_000 },
    }));
    const ademe = result.lineItems.find((i) => i.code === 'FR-ADEME-TREMPLIN-2026');

    expect(ademe!.amount).toBe(200_000); // capped
  });

  it('returns 0 ADEME for large enterprise', async () => {
    const result = await engine.calculate(makeInput({
      employeeCount: 500,
      revenue: 100_000_000,
      metadata: { sustainabilityAuditExpense: 50_000 },
    }));
    const ademe = result.lineItems.find((i) => i.code === 'FR-ADEME-TREMPLIN-2026');

    expect(ademe!.amount).toBe(0);
  });

  // ─── Energy Savings ───────────────────────────────────────────

  it('estimates energy savings with France insolation (1100 kWh/kWp)', async () => {
    const result = await engine.calculate(makeInput({
      metadata: { solarCapacityKWp: 20, selfConsumptionRatio: 0.60 },
    }));
    const savings = result.lineItems.find((i) => i.code === 'FR-ENERGY-SAVINGS-2026');

    expect(savings).toBeDefined();
    // 20 * 1100 = 22000 kWh
    // 13200 * 0.24 = 3168 (self)
    // 8800 * 0.0536 = 471.68 (surplus)
    // total = 3639.68
    expect(savings!.amount).toBeCloseTo(3639.68, 1);
  });

  // ─── Integration ──────────────────────────────────────────────

  it('computes correct net amount across all French items', async () => {
    const result = await engine.calculate(makeInput({
      metadata: {
        solarCapacityKWp: 20,
        selfConsumptionRatio: 0.60,
        evCount: 3,
        evCountVans: 2,
        sustainabilityAuditExpense: 50_000,
      },
    }));
    const sum = result.lineItems.reduce((s, i) => s + i.amount, 0);
    expect(result.netAmount).toBeCloseTo(sum, 2);
  });

  it('returns correct metadata', async () => {
    const result = await engine.calculate(makeInput());
    expect(result.countryCode).toBe('FR');
    expect(result.fiscalYear).toBe(2026);
    expect(result.currency).toBe('EUR');
  });
});
