/**
 * Client-side calculation engine for instant simulation.
 * Mirrors Luxembourg2026Strategy logic so results are shown
 * immediately without waiting for API round-trip.
 */

import type { LineItem } from './api';

export interface SimulationParams {
  co2Tonnes: number;
  revenue: number;
  employeeCount: number;
  enterpriseType: 'SMALL_ENTERPRISE' | 'MEDIUM_ENTERPRISE' | 'LARGE_ENTERPRISE';
  solarCapacityKWp: number;
  selfConsumptionRatio: number;
  evCount: number;
  evConsumptionKWhPer100km: number;
  wallboxCount: number;
  wallboxSmartCharging: boolean;
  sustainabilityAuditExpense: number;
}

const CO2_BRACKETS = [
  { min: 0, max: 500, rate: 45 },
  { min: 500, max: 5_000, rate: 65 },
  { min: 5_000, max: 25_000, rate: 85 },
  { min: 25_000, max: Infinity, rate: 120 },
];

const CORP_EFFECTIVE_RATE = 0.17 + 0.0675 + 0.17 * 0.07; // ~24.94%

const PV_RATE_PER_KWP = 800;
const PV_MAX_GRANT = 10_000;
const PV_MAX_KWP = 30;
const PV_SELF_CONSUMPTION_MIN = 0.50;

const EV_TIERS = [
  { max: 16, amount: 6_000 },
  { max: 18, amount: 3_000 },
];
const WALLBOX_BASE = 1_200;
const WALLBOX_SMART = 450;

const FIT4_RATES: Record<string, number> = {
  SMALL_ENTERPRISE: 0.80,
  MEDIUM_ENTERPRISE: 0.60,
  LARGE_ENTERPRISE: 0.50,
};
const FIT4_MAX_EXPENSE: Record<string, number> = {
  SMALL_ENTERPRISE: 50_000,
  MEDIUM_ENTERPRISE: 100_000,
  LARGE_ENTERPRISE: 200_000,
};

const GRID_PRICE = 0.22;
const FEED_IN = 0.1252;

export function simulateLocally(params: SimulationParams): LineItem[] {
  const items: LineItem[] = [];

  // CO2 Tax
  if (params.co2Tonnes > 0) {
    let total = 0;
    let remaining = params.co2Tonnes;
    for (const b of CO2_BRACKETS) {
      if (remaining <= 0) break;
      const width = b.max === Infinity ? remaining : b.max - b.min;
      const taxable = Math.min(remaining, width);
      total += taxable * b.rate;
      remaining -= taxable;
    }
    items.push({
      code: 'LU-CO2-TAX-2026',
      label: 'Taxe CO2 Luxembourg',
      amount: -total,
      currency: 'EUR',
      description: `Taxe carbone progressive sur ${params.co2Tonnes}t d'émissions CO2`,
    });
  }

  // Corporate Tax
  if (params.revenue > 0) {
    const profit = params.revenue * 0.10;
    const tax = profit * CORP_EFFECTIVE_RATE;
    items.push({
      code: 'LU-CORP-TAX-2026',
      label: 'IRC + Taxe Commerciale',
      amount: -tax,
      currency: 'EUR',
      description: `Taux effectif ${(CORP_EFFECTIVE_RATE * 100).toFixed(2)}% sur bénéfice estimé`,
    });
  }

  // Klimabonus PV
  if (params.solarCapacityKWp > 0 && params.selfConsumptionRatio >= PV_SELF_CONSUMPTION_MIN) {
    const kwp = Math.min(params.solarCapacityKWp, PV_MAX_KWP);
    const grant = Math.min(kwp * PV_RATE_PER_KWP, PV_MAX_GRANT);
    items.push({
      code: 'LU-KB-PV-2026',
      label: 'Klimabonus Photovoltaïque',
      amount: grant,
      currency: 'EUR',
      description: `${kwp} kWp x ${PV_RATE_PER_KWP} EUR/kWp`,
      legalReference: 'PRIMe House',
    });
  }

  // EV Grant
  if (params.evCount > 0 && params.evConsumptionKWhPer100km > 0) {
    let perVehicle = 0;
    for (const tier of EV_TIERS) {
      if (params.evConsumptionKWhPer100km <= tier.max) {
        perVehicle = tier.amount;
        break;
      }
    }
    if (perVehicle > 0) {
      items.push({
        code: 'LU-KB-EV-2026',
        label: 'Prime Véhicule Électrique',
        amount: perVehicle * params.evCount,
        currency: 'EUR',
        description: `${params.evCount} véhicule(s) x ${perVehicle.toLocaleString()} EUR`,
        legalReference: 'PRIMe Car-e',
      });
    }
  }

  // Wallbox
  if (params.wallboxCount > 0) {
    const per = WALLBOX_BASE + (params.wallboxSmartCharging ? WALLBOX_SMART : 0);
    items.push({
      code: 'LU-KB-WALLBOX-2026',
      label: 'Prime Borne de Recharge',
      amount: per * params.wallboxCount,
      currency: 'EUR',
      description: `${params.wallboxCount} borne(s)${params.wallboxSmartCharging ? ' + smart charging' : ''}`,
      legalReference: 'PRIMe Car-e',
    });
  }

  // Fit 4 Sustainability
  if (params.sustainabilityAuditExpense > 0) {
    const rate = FIT4_RATES[params.enterpriseType];
    const maxExp = FIT4_MAX_EXPENSE[params.enterpriseType];
    const eligible = Math.min(params.sustainabilityAuditExpense, maxExp);
    const subsidy = eligible * rate;
    items.push({
      code: 'LU-F4S-2026',
      label: 'Fit 4 Sustainability',
      amount: subsidy,
      currency: 'EUR',
      description: `${(rate * 100).toFixed(0)}% de ${eligible.toLocaleString()} EUR éligibles`,
      legalReference: 'Luxinnovation',
    });
  }

  // Energy savings from PV
  if (params.solarCapacityKWp > 0) {
    const prod = params.solarCapacityKWp * 950;
    const selfKwh = prod * params.selfConsumptionRatio;
    const injKwh = prod * (1 - params.selfConsumptionRatio);
    const savings = selfKwh * GRID_PRICE + injKwh * FEED_IN;
    items.push({
      code: 'LU-ENERGY-SAVINGS-2026',
      label: 'Économies énergie PV',
      amount: savings,
      currency: 'EUR',
      description: `${prod.toFixed(0)} kWh/an estimés`,
    });
  }

  return items;
}
