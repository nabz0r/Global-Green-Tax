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
    employeeCount: 30,
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

  // ─── CO2 Tax ──────────────────────────────────────────────────

  it('calculates CO2 tax across progressive brackets', async () => {
    const result = await engine.calculate(makeInput({ co2Tonnes: 1000 }));
    const co2Item = result.lineItems.find((i) => i.code === 'LU-CO2-TAX-2026');

    expect(co2Item).toBeDefined();
    expect(co2Item!.amount).toBeLessThan(0);
    // 500t @ 45 = 22,500 + 500t @ 65 = 32,500 = 55,000
    expect(co2Item!.amount).toBe(-55_000);
  });

  it('handles third bracket correctly', async () => {
    const result = await engine.calculate(makeInput({ co2Tonnes: 10_000 }));
    const co2Item = result.lineItems.find((i) => i.code === 'LU-CO2-TAX-2026');
    // 500*45 + 4500*65 + 5000*85 = 22500 + 292500 + 425000 = 740000
    expect(co2Item!.amount).toBe(-740_000);
  });

  it('returns no CO2 tax for zero emissions', async () => {
    const result = await engine.calculate(makeInput({ co2Tonnes: 0 }));
    const co2Item = result.lineItems.find((i) => i.code === 'LU-CO2-TAX-2026');
    expect(co2Item).toBeUndefined();
  });

  // ─── Corporate Tax ────────────────────────────────────────────

  it('calculates corporate tax based on estimated profit margin', async () => {
    const result = await engine.calculate(makeInput({ revenue: 10_000_000 }));
    const corpItem = result.lineItems.find((i) => i.code === 'LU-CORP-TAX-2026');

    expect(corpItem).toBeDefined();
    expect(corpItem!.amount).toBeLessThan(0);
    // 10M * 10% margin = 1M profit * ~24.94% = ~249,400
    const effectiveRate = 0.17 + 0.0675 + 0.17 * 0.07;
    expect(corpItem!.amount).toBeCloseTo(-(1_000_000 * effectiveRate), 0);
  });

  // ─── Klimabonus PV ────────────────────────────────────────────

  it('calculates Klimabonus PV for qualifying installations', async () => {
    const result = await engine.calculate(makeInput({
      metadata: { solarCapacityKWp: 10, selfConsumptionRatio: 0.60 },
    }));
    const pvItem = result.lineItems.find((i) => i.code === 'LU-KB-PV-2026');

    expect(pvItem).toBeDefined();
    // 10 kWp * 800 EUR = 8000
    expect(pvItem!.amount).toBe(8_000);
  });

  it('caps PV grant at max 10,000 EUR', async () => {
    const result = await engine.calculate(makeInput({
      metadata: { solarCapacityKWp: 30, selfConsumptionRatio: 0.70 },
    }));
    const pvItem = result.lineItems.find((i) => i.code === 'LU-KB-PV-2026');
    expect(pvItem!.amount).toBe(10_000);
  });

  it('returns 0 PV grant when self-consumption below 50%', async () => {
    const result = await engine.calculate(makeInput({
      metadata: { solarCapacityKWp: 15, selfConsumptionRatio: 0.30 },
    }));
    const pvItem = result.lineItems.find((i) => i.code === 'LU-KB-PV-2026');
    expect(pvItem!.amount).toBe(0);
  });

  // ─── EV Grant ─────────────────────────────────────────────────

  it('calculates EV grant at 6000 EUR tier', async () => {
    const result = await engine.calculate(makeInput({
      metadata: { evCount: 3, evConsumptionKWhPer100km: 15 },
    }));
    const evItem = result.lineItems.find((i) => i.code === 'LU-KB-EV-2026');
    expect(evItem!.amount).toBe(18_000); // 3 * 6000
  });

  it('calculates EV grant at 3000 EUR tier', async () => {
    const result = await engine.calculate(makeInput({
      metadata: { evCount: 2, evConsumptionKWhPer100km: 17 },
    }));
    const evItem = result.lineItems.find((i) => i.code === 'LU-KB-EV-2026');
    expect(evItem!.amount).toBe(6_000); // 2 * 3000
  });

  it('returns 0 EV grant above 18 kWh threshold', async () => {
    const result = await engine.calculate(makeInput({
      metadata: { evCount: 2, evConsumptionKWhPer100km: 20 },
    }));
    const evItem = result.lineItems.find((i) => i.code === 'LU-KB-EV-2026');
    expect(evItem!.amount).toBe(0);
  });

  // ─── Wallbox ──────────────────────────────────────────────────

  it('calculates wallbox grants with smart charging bonus', async () => {
    const result = await engine.calculate(makeInput({
      metadata: { wallboxCount: 2, wallboxSmartCharging: true },
    }));
    const wbItem = result.lineItems.find((i) => i.code === 'LU-KB-WALLBOX-2026');
    // (1200 + 450) * 2 = 3300
    expect(wbItem!.amount).toBe(3_300);
  });

  it('calculates wallbox grants without smart charging', async () => {
    const result = await engine.calculate(makeInput({
      metadata: { wallboxCount: 3, wallboxSmartCharging: false },
    }));
    const wbItem = result.lineItems.find((i) => i.code === 'LU-KB-WALLBOX-2026');
    expect(wbItem!.amount).toBe(3_600); // 1200 * 3
  });

  // ─── Fit 4 Sustainability ────────────────────────────────────

  it('calculates Fit 4 Sustainability for small enterprise (80%)', async () => {
    const result = await engine.calculate(makeInput({
      employeeCount: 30,
      revenue: 5_000_000,
      metadata: { sustainabilityAuditExpense: 40_000 },
    }));
    const f4sItem = result.lineItems.find((i) => i.code === 'LU-F4S-2026');
    // Small enterprise: 80% of 40,000 = 32,000
    expect(f4sItem!.amount).toBe(32_000);
  });

  it('caps Fit 4 at max eligible expense for medium enterprise', async () => {
    const result = await engine.calculate(makeInput({
      employeeCount: 150,
      revenue: 30_000_000,
      metadata: { sustainabilityAuditExpense: 200_000 },
    }));
    const f4sItem = result.lineItems.find((i) => i.code === 'LU-F4S-2026');
    // Medium enterprise: 60% of 100,000 (capped) = 60,000
    expect(f4sItem!.amount).toBe(60_000);
  });

  it('returns 0 Fit 4 when no audit expense', async () => {
    const result = await engine.calculate(makeInput());
    const f4sItem = result.lineItems.find((i) => i.code === 'LU-F4S-2026');
    expect(f4sItem!.amount).toBe(0);
  });

  // ─── Energy Savings ───────────────────────────────────────────

  it('estimates energy savings from PV installation', async () => {
    const result = await engine.calculate(makeInput({
      metadata: { solarCapacityKWp: 20, selfConsumptionRatio: 0.50 },
    }));
    const saveItem = result.lineItems.find((i) => i.code === 'LU-ENERGY-SAVINGS-2026');
    expect(saveItem).toBeDefined();
    expect(saveItem!.amount).toBeGreaterThan(0);
    // 20 kWp * 950 kWh = 19000 kWh
    // 9500 kWh self * 0.22 = 2090
    // 9500 kWh injected * 0.1252 = 1189.40
    // Total = 3279.40
    expect(saveItem!.amount).toBeCloseTo(3279.40, 1);
  });

  // ─── Integration ──────────────────────────────────────────────

  it('computes correct net amount across all items', async () => {
    const result = await engine.calculate(makeInput({
      metadata: {
        solarCapacityKWp: 15,
        selfConsumptionRatio: 0.60,
        evCount: 2,
        evConsumptionKWhPer100km: 15,
        wallboxCount: 1,
        wallboxSmartCharging: true,
        sustainabilityAuditExpense: 25_000,
      },
    }));
    const sum = result.lineItems.reduce((s, i) => s + i.amount, 0);
    expect(result.netAmount).toBeCloseTo(sum, 2);
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
