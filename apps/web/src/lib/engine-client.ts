/**
 * Client-side calculation engine for instant simulation.
 * Supports multiple jurisdictions (LU, FR) dispatched by countryCode.
 */

import type { LineItem } from './api';

export type CountryCode = 'LU' | 'FR';
export type EnterpriseType = 'SMALL_ENTERPRISE' | 'MEDIUM_ENTERPRISE' | 'LARGE_ENTERPRISE';

export interface SimulationParams {
  countryCode: CountryCode;
  co2Tonnes: number;
  revenue: number;
  employeeCount: number;
  enterpriseType: EnterpriseType;
  solarCapacityKWp: number;
  selfConsumptionRatio: number;
  evCount: number;
  evConsumptionKWhPer100km: number;
  evCountVans: number;
  wallboxCount: number;
  wallboxSmartCharging: boolean;
  sustainabilityAuditExpense: number;
}

/** Dispatch to the right country engine */
export function simulateLocally(params: SimulationParams): LineItem[] {
  switch (params.countryCode) {
    case 'LU': return simulateLuxembourg(params);
    case 'FR': return simulateFrance(params);
    default:   return [];
  }
}

// ═══════════════════════════════════════════════════════════════════════
//  LUXEMBOURG 2026
// ═══════════════════════════════════════════════════════════════════════

const LU_CO2_BRACKETS = [
  { min: 0, max: 500, rate: 45 },
  { min: 500, max: 5_000, rate: 65 },
  { min: 5_000, max: 25_000, rate: 85 },
  { min: 25_000, max: Infinity, rate: 120 },
];
const LU_CORP_RATE = 0.17 + 0.0675 + 0.17 * 0.07;
const LU_PV_RATE = 800;
const LU_PV_MAX = 10_000;
const LU_PV_MAX_KWP = 30;
const LU_PV_MIN_SELF = 0.50;
const LU_EV_TIERS = [{ max: 16, amount: 6_000 }, { max: 18, amount: 3_000 }];
const LU_WALLBOX = 1_200;
const LU_WALLBOX_SMART = 450;
const LU_FIT4_RATES: Record<string, number> = { SMALL_ENTERPRISE: 0.80, MEDIUM_ENTERPRISE: 0.60, LARGE_ENTERPRISE: 0.50 };
const LU_FIT4_MAX: Record<string, number> = { SMALL_ENTERPRISE: 50_000, MEDIUM_ENTERPRISE: 100_000, LARGE_ENTERPRISE: 200_000 };
const LU_GRID = 0.22;
const LU_FEED_IN = 0.1252;

function simulateLuxembourg(p: SimulationParams): LineItem[] {
  const items: LineItem[] = [];

  // CO2 Tax
  if (p.co2Tonnes > 0) {
    let total = 0, remaining = p.co2Tonnes;
    for (const b of LU_CO2_BRACKETS) {
      if (remaining <= 0) break;
      const w = b.max === Infinity ? remaining : b.max - b.min;
      const t = Math.min(remaining, w);
      total += t * b.rate;
      remaining -= t;
    }
    items.push({ code: 'LU-CO2-TAX-2026', label: 'Taxe CO2 Luxembourg', amount: -total, currency: 'EUR', description: `Taxe carbone progressive sur ${p.co2Tonnes}t` });
  }

  // Corporate Tax
  if (p.revenue > 0) {
    items.push({ code: 'LU-CORP-TAX-2026', label: 'IRC + Taxe Commerciale', amount: -(p.revenue * 0.10 * LU_CORP_RATE), currency: 'EUR', description: `Taux effectif ${(LU_CORP_RATE * 100).toFixed(2)}% sur marge estimée` });
  }

  // PV
  if (p.solarCapacityKWp > 0 && p.selfConsumptionRatio >= LU_PV_MIN_SELF) {
    const kwp = Math.min(p.solarCapacityKWp, LU_PV_MAX_KWP);
    items.push({ code: 'LU-KB-PV-2026', label: 'Klimabonus Photovoltaïque', amount: Math.min(kwp * LU_PV_RATE, LU_PV_MAX), currency: 'EUR', description: `${kwp} kWp x ${LU_PV_RATE} EUR/kWp`, legalReference: 'PRIMe House' });
  }

  // EV
  if (p.evCount > 0 && p.evConsumptionKWhPer100km > 0) {
    let per = 0;
    for (const t of LU_EV_TIERS) { if (p.evConsumptionKWhPer100km <= t.max) { per = t.amount; break; } }
    if (per > 0) items.push({ code: 'LU-KB-EV-2026', label: 'Prime Véhicule Électrique', amount: per * p.evCount, currency: 'EUR', description: `${p.evCount} véhicule(s) x ${per.toLocaleString()} EUR`, legalReference: 'PRIMe Car-e' });
  }

  // Wallbox
  if (p.wallboxCount > 0) {
    const per = LU_WALLBOX + (p.wallboxSmartCharging ? LU_WALLBOX_SMART : 0);
    items.push({ code: 'LU-KB-WALLBOX-2026', label: 'Prime Borne de Recharge', amount: per * p.wallboxCount, currency: 'EUR', description: `${p.wallboxCount} borne(s)${p.wallboxSmartCharging ? ' + smart charging' : ''}`, legalReference: 'PRIMe Car-e' });
  }

  // Fit 4
  if (p.sustainabilityAuditExpense > 0) {
    const rate = LU_FIT4_RATES[p.enterpriseType]; const max = LU_FIT4_MAX[p.enterpriseType];
    const eligible = Math.min(p.sustainabilityAuditExpense, max);
    items.push({ code: 'LU-F4S-2026', label: 'Fit 4 Sustainability', amount: eligible * rate, currency: 'EUR', description: `${(rate * 100).toFixed(0)}% de ${eligible.toLocaleString()} EUR éligibles`, legalReference: 'Luxinnovation' });
  }

  // Energy savings
  if (p.solarCapacityKWp > 0) {
    const prod = p.solarCapacityKWp * 950;
    items.push({ code: 'LU-ENERGY-SAVINGS-2026', label: 'Économies énergie PV', amount: prod * p.selfConsumptionRatio * LU_GRID + prod * (1 - p.selfConsumptionRatio) * LU_FEED_IN, currency: 'EUR', description: `${prod.toFixed(0)} kWh/an estimés` });
  }

  return items;
}

// ═══════════════════════════════════════════════════════════════════════
//  FRANCE 2026
// ═══════════════════════════════════════════════════════════════════════

const FR_CCE_RATE = 44.60;
const FR_IS_STANDARD = 0.25;
const FR_IS_PME = 0.15;
const FR_IS_PME_THRESHOLD = 42_500;
const FR_PME_REVENUE_CAP = 10_000_000;
const FR_CVAE = 0.0009;
const FR_PV_TIERS = [{ maxKWp: 9, rate: 80 }, { maxKWp: 36, rate: 140 }, { maxKWp: 100, rate: 70 }];
const FR_PV_FEED_SURPLUS = 0.0536;
const FR_EV_CAR = 3_000;
const FR_EV_VAN = 4_000;
const FR_ADEME_RATES: Record<string, number> = { SMALL_ENTERPRISE: 0.50, MEDIUM_ENTERPRISE: 0.30 };
const FR_ADEME_MAX = 200_000;
const FR_GRID = 0.24;

function simulateFrance(p: SimulationParams): LineItem[] {
  const items: LineItem[] = [];

  // CCE
  if (p.co2Tonnes > 0) {
    items.push({ code: 'FR-CCE-2026', label: 'Contribution Climat Énergie', amount: -(p.co2Tonnes * FR_CCE_RATE), currency: 'EUR', description: `${p.co2Tonnes}t x ${FR_CCE_RATE} EUR/t`, legalReference: 'Art. 265 Code des douanes' });
  }

  // IS + CVAE
  if (p.revenue > 0) {
    const profit = p.revenue * 0.10;
    const isPME = p.revenue < FR_PME_REVENUE_CAP;
    let isTax: number;
    if (isPME && profit <= FR_IS_PME_THRESHOLD) {
      isTax = profit * FR_IS_PME;
    } else if (isPME) {
      isTax = FR_IS_PME_THRESHOLD * FR_IS_PME + (profit - FR_IS_PME_THRESHOLD) * FR_IS_STANDARD;
    } else {
      isTax = profit * FR_IS_STANDARD;
    }
    const cvae = p.revenue * FR_CVAE;
    items.push({ code: 'FR-IS-2026', label: 'IS + CVAE', amount: -(isTax + cvae), currency: 'EUR', description: `${isPME ? 'PME' : 'Taux normal'}: IS ${isTax.toFixed(0)} EUR + CVAE ${cvae.toFixed(0)} EUR`, legalReference: 'Art. 219 CGI' });
  }

  // Prime Autoconsommation PV (tiered)
  if (p.solarCapacityKWp > 0) {
    let total = 0, remaining = Math.min(p.solarCapacityKWp, 100), prev = 0;
    for (const t of FR_PV_TIERS) {
      if (remaining <= 0) break;
      const w = t.maxKWp - prev;
      const inT = Math.min(remaining, w);
      total += inT * t.rate;
      remaining -= inT;
      prev = t.maxKWp;
    }
    items.push({ code: 'FR-PV-PRIME-2026', label: 'Prime Autoconsommation PV', amount: total, currency: 'EUR', description: `Prime dégressive sur ${Math.min(p.solarCapacityKWp, 100)} kWp = ${total.toFixed(0)} EUR`, legalReference: 'Arrêté tarifaire S21' });
  }

  // Bonus Écologique
  const carGrant = (p.evCount ?? 0) * FR_EV_CAR;
  const vanGrant = (p.evCountVans ?? 0) * FR_EV_VAN;
  const totalEv = carGrant + vanGrant;
  if (totalEv > 0) {
    const parts: string[] = [];
    if (p.evCount > 0) parts.push(`${p.evCount} VP x ${FR_EV_CAR.toLocaleString()} EUR`);
    if (p.evCountVans > 0) parts.push(`${p.evCountVans} VUL x ${FR_EV_VAN.toLocaleString()} EUR`);
    items.push({ code: 'FR-BONUS-ECO-2026', label: 'Bonus Écologique', amount: totalEv, currency: 'EUR', description: parts.join(' + '), legalReference: 'Décret bonus écologique' });
  }

  // ADEME Tremplin
  if (p.sustainabilityAuditExpense > 0 && p.enterpriseType !== 'LARGE_ENTERPRISE') {
    const rate = FR_ADEME_RATES[p.enterpriseType] ?? 0;
    const grant = Math.min(p.sustainabilityAuditExpense * rate, FR_ADEME_MAX);
    items.push({ code: 'FR-ADEME-TREMPLIN-2026', label: 'ADEME Tremplin', amount: grant, currency: 'EUR', description: `${(rate * 100).toFixed(0)}% de ${p.sustainabilityAuditExpense.toLocaleString()} EUR`, legalReference: 'ADEME Tremplin' });
  }

  // Energy savings
  if (p.solarCapacityKWp > 0) {
    const prod = p.solarCapacityKWp * 1_100; // France avg
    const self = prod * p.selfConsumptionRatio;
    const surplus = prod * (1 - p.selfConsumptionRatio);
    items.push({ code: 'FR-ENERGY-SAVINGS-2026', label: 'Économies énergie PV', amount: self * FR_GRID + surplus * FR_PV_FEED_SURPLUS, currency: 'EUR', description: `${prod.toFixed(0)} kWh/an estimés` });
  }

  return items;
}
