/**
 * Client-side calculation engine for instant simulation.
 * Supports multiple jurisdictions (LU, FR, DE, BE, ES, PT) dispatched by countryCode.
 */

import type { LineItem } from './api';

export type CountryCode = 'LU' | 'FR' | 'DE' | 'BE' | 'ES' | 'PT';
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
    case 'DE': return simulateGermany(params);
    case 'BE': return simulateBelgium(params);
    case 'ES': return simulateSpain(params);
    case 'PT': return simulatePortugal(params);
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

// ═══════════════════════════════════════════════════════════════════════
//  GERMANY 2026
// ═══════════════════════════════════════════════════════════════════════

const DE_NEHS_RATE = 65;
const DE_KST = 0.15;
const DE_SOLI = 0.055;
const DE_GEWST_MESSZAHL = 0.035;
const DE_GEWST_HEBESATZ = 4.0;
const DE_KFW_RATE = 300;
const DE_KFW_MAX = 15_000;
const DE_BAFA_SME = 0.35;
const DE_BAFA_LARGE = 0.20;
const DE_BAFA_MAX = 100_000;
const DE_EV_GRANT = 3_000;
const DE_GRID = 0.38;
const DE_FEED_IN = 0.082;

function simulateGermany(p: SimulationParams): LineItem[] {
  const items: LineItem[] = [];

  // nEHS CO2
  if (p.co2Tonnes > 0) {
    const tax = p.co2Tonnes * DE_NEHS_RATE;
    items.push({ code: 'DE-NEHS-2026', label: 'nEHS CO2-Abgabe', amount: -tax, currency: 'EUR', description: `${p.co2Tonnes}t x ${DE_NEHS_RATE} EUR/t`, legalReference: 'BEHG' });
  }

  // Corporate Tax (KSt + Soli + GewSt)
  if (p.revenue > 0) {
    const profit = p.revenue * 0.10;
    const kst = profit * DE_KST;
    const soli = kst * DE_SOLI;
    const gewst = profit * DE_GEWST_MESSZAHL * DE_GEWST_HEBESATZ;
    items.push({ code: 'DE-CORP-TAX-2026', label: 'KSt + Soli + GewSt', amount: -(kst + soli + gewst), currency: 'EUR', description: `~29,83% sur ${profit.toFixed(0)} EUR bénéfice estimé` });
  }

  // KfW 270 Solar
  if (p.solarCapacityKWp > 0) {
    const grant = Math.min(p.solarCapacityKWp * DE_KFW_RATE, DE_KFW_MAX);
    items.push({ code: 'DE-KFW270-2026', label: 'KfW 270 Erneuerbare Energien', amount: grant, currency: 'EUR', description: `${p.solarCapacityKWp} kWp x ${DE_KFW_RATE} EUR`, legalReference: 'KfW-Programm 270' });
  }

  // BAFA EE
  if (p.sustainabilityAuditExpense > 0) {
    const isLarge = p.enterpriseType === 'LARGE_ENTERPRISE';
    const rate = isLarge ? DE_BAFA_LARGE : DE_BAFA_SME;
    const grant = Math.min(p.sustainabilityAuditExpense * rate, DE_BAFA_MAX);
    items.push({ code: 'DE-BAFA-EE-2026', label: 'BAFA Energieeffizienz-Bonus', amount: grant, currency: 'EUR', description: `${(rate * 100).toFixed(0)}% von ${p.sustainabilityAuditExpense.toLocaleString()} EUR`, legalReference: 'BAFA EE' });
  }

  // Umweltbonus
  if (p.evCount > 0) {
    items.push({ code: 'DE-UMWELTBONUS-2026', label: 'Umweltbonus E-Fahrzeug', amount: p.evCount * DE_EV_GRANT, currency: 'EUR', description: `${p.evCount} Fahrzeug(e) x ${DE_EV_GRANT.toLocaleString()} EUR`, legalReference: 'Umweltbonus' });
  }

  // Energy savings
  if (p.solarCapacityKWp > 0) {
    const prod = p.solarCapacityKWp * 950;
    const self = prod * p.selfConsumptionRatio;
    const surplus = prod * (1 - p.selfConsumptionRatio);
    items.push({ code: 'DE-ENERGY-SAVINGS-2026', label: 'PV-Energieeinsparungen', amount: self * DE_GRID + surplus * DE_FEED_IN, currency: 'EUR', description: `${prod.toFixed(0)} kWh/Jahr` });
  }

  return items;
}

// ═══════════════════════════════════════════════════════════════════════
//  BELGIUM 2026
// ═══════════════════════════════════════════════════════════════════════

const BE_ISOC_STANDARD = 0.25;
const BE_ISOC_SME = 0.20;
const BE_ISOC_SME_THRESHOLD = 100_000;
const BE_SME_REVENUE_MAX = 9_000_000;
const BE_INVEST_DEDUCTION = 0.275;
const BE_ECO_RATES: Record<string, number> = { SMALL_ENTERPRISE: 0.50, MEDIUM_ENTERPRISE: 0.30, LARGE_ENTERPRISE: 0.15 };
const BE_ECO_MAX = 250_000;
const BE_AMURE_RATE = 0.75;
const BE_AMURE_MAX = 50_000;
const BE_EV_GRANT = 5_000;
const BE_GRID = 0.32;
const BE_FEED_IN = 0.09;

function simulateBelgium(p: SimulationParams): LineItem[] {
  const items: LineItem[] = [];

  // ISOC Corporate Tax with green investment deduction
  if (p.revenue > 0) {
    const profit = p.revenue * 0.10;
    const isSME = p.revenue < BE_SME_REVENUE_MAX;
    const greenInvestment = p.solarCapacityKWp * 1_500;
    const deduction = greenInvestment * BE_INVEST_DEDUCTION;
    const taxableProfit = Math.max(0, profit - deduction);

    let tax: number;
    if (isSME && taxableProfit <= BE_ISOC_SME_THRESHOLD) {
      tax = taxableProfit * BE_ISOC_SME;
    } else if (isSME) {
      tax = BE_ISOC_SME_THRESHOLD * BE_ISOC_SME + (taxableProfit - BE_ISOC_SME_THRESHOLD) * BE_ISOC_STANDARD;
    } else {
      tax = taxableProfit * BE_ISOC_STANDARD;
    }
    items.push({ code: 'BE-ISOC-2026', label: 'ISOC (Impôt des Sociétés)', amount: -tax, currency: 'EUR', description: `${isSME ? 'PME' : 'Taux normal'} sur ${taxableProfit.toFixed(0)} EUR` });

    if (deduction > 0) {
      const taxSaved = deduction * (isSME ? BE_ISOC_SME : BE_ISOC_STANDARD);
      items.push({ code: 'BE-INVEST-DEDUCT-2026', label: 'Déduction investissement vert', amount: taxSaved, currency: 'EUR', description: `27,5% de ${greenInvestment.toLocaleString()} EUR → ${taxSaved.toFixed(0)} EUR économie`, legalReference: 'CIR/92 Art. 69' });
    }
  }

  // Ecologiepremie Plus
  if (p.solarCapacityKWp > 0) {
    const greenInvestment = p.solarCapacityKWp * 1_500;
    const rate = BE_ECO_RATES[p.enterpriseType] ?? 0.15;
    const grant = Math.min(greenInvestment * rate, BE_ECO_MAX);
    items.push({ code: 'BE-ECOPREMIE-2026', label: 'Ecologiepremie Plus', amount: grant, currency: 'EUR', description: `${(rate * 100).toFixed(0)}% de ${greenInvestment.toLocaleString()} EUR`, legalReference: 'VLAIO' });
  }

  // AMURE
  if (p.sustainabilityAuditExpense > 0) {
    const grant = Math.min(p.sustainabilityAuditExpense * BE_AMURE_RATE, BE_AMURE_MAX);
    items.push({ code: 'BE-AMURE-2026', label: 'Aide AMURE (Wallonie)', amount: grant, currency: 'EUR', description: `75% de ${p.sustainabilityAuditExpense.toLocaleString()} EUR (max ${BE_AMURE_MAX.toLocaleString()})`, legalReference: 'SPW Énergie' });
  }

  // Fleet EV
  if (p.evCount > 0) {
    items.push({ code: 'BE-FLEET-EV-2026', label: 'Prime Flotte EV', amount: p.evCount * BE_EV_GRANT, currency: 'EUR', description: `${p.evCount} véhicule(s) x ${BE_EV_GRANT.toLocaleString()} EUR` });
  }

  // Energy savings
  if (p.solarCapacityKWp > 0) {
    const prod = p.solarCapacityKWp * 900;
    const self = prod * p.selfConsumptionRatio;
    const surplus = prod * (1 - p.selfConsumptionRatio);
    items.push({ code: 'BE-ENERGY-SAVINGS-2026', label: 'Économies énergie PV', amount: self * BE_GRID + surplus * BE_FEED_IN, currency: 'EUR', description: `${prod.toFixed(0)} kWh/an` });
  }

  return items;
}

// ═══════════════════════════════════════════════════════════════════════
//  SPAIN 2026
// ═══════════════════════════════════════════════════════════════════════

const ES_IS_STANDARD = 0.25;
const ES_IS_PYME = 0.23;
const ES_PYME_REVENUE_MAX = 1_000_000;
const ES_IBI_BONIFICACION = 0.50;
const ES_IBI_ANNUAL = 2_000;
const ES_SOLAR_RATE = 600;
const ES_SOLAR_MAX = 12_000;
const ES_EV_GRANT = 5_000;
const ES_GRID = 0.21;
const ES_FEED_IN = 0.06;

function simulateSpain(p: SimulationParams): LineItem[] {
  const items: LineItem[] = [];

  // Impuesto de Sociedades
  if (p.revenue > 0) {
    const profit = p.revenue * 0.10;
    const isPyme = p.revenue < ES_PYME_REVENUE_MAX;
    const rate = isPyme ? ES_IS_PYME : ES_IS_STANDARD;
    items.push({ code: 'ES-IS-2026', label: 'Impuesto de Sociedades', amount: -(profit * rate), currency: 'EUR', description: `${isPyme ? 'PYME' : 'Estándar'}: ${(rate * 100).toFixed(0)}% sobre ${profit.toFixed(0)} EUR`, legalReference: 'Ley 27/2014' });
  }

  // IBI Bonificación Solar
  if (p.solarCapacityKWp > 0) {
    const saving = ES_IBI_ANNUAL * ES_IBI_BONIFICACION;
    items.push({ code: 'ES-IBI-SOLAR-2026', label: 'Bonificación IBI Solar', amount: saving, currency: 'EUR', description: `50% reducción IBI = ${saving.toFixed(0)} EUR/año`, legalReference: 'RDL 7/2019' });
  }

  // NextGen Autoconsumo
  if (p.solarCapacityKWp > 0) {
    const grant = Math.min(p.solarCapacityKWp * ES_SOLAR_RATE, ES_SOLAR_MAX);
    items.push({ code: 'ES-NEXTGEN-SOLAR-2026', label: 'Programa Autoconsumo', amount: grant, currency: 'EUR', description: `${p.solarCapacityKWp} kWp x ${ES_SOLAR_RATE} EUR`, legalReference: 'IDAE NextGen EU' });
  }

  // MOVES III
  if (p.evCount > 0) {
    items.push({ code: 'ES-MOVES-2026', label: 'Plan MOVES III', amount: p.evCount * ES_EV_GRANT, currency: 'EUR', description: `${p.evCount} vehículo(s) x ${ES_EV_GRANT.toLocaleString()} EUR`, legalReference: 'RD 266/2021' });
  }

  // Energy savings
  if (p.solarCapacityKWp > 0) {
    const prod = p.solarCapacityKWp * 1_500; // Excellent Spanish insolation
    const self = prod * p.selfConsumptionRatio;
    const surplus = prod * (1 - p.selfConsumptionRatio);
    items.push({ code: 'ES-ENERGY-SAVINGS-2026', label: 'Ahorro energético PV', amount: self * ES_GRID + surplus * ES_FEED_IN, currency: 'EUR', description: `${prod.toFixed(0)} kWh/año` });
  }

  return items;
}

// ═══════════════════════════════════════════════════════════════════════
//  PORTUGAL 2026
// ═══════════════════════════════════════════════════════════════════════

const PT_IRC_STANDARD = 0.21;
const PT_IRC_PME = 0.17;
const PT_PME_THRESHOLD = 25_000;
const PT_IVA_STANDARD = 0.23;
const PT_IVA_REDUCED = 0.06;
const PT_FA_RATE = 0.85;
const PT_FA_MAX = 7_500;
const PT_EV_GRANT = 4_000;
const PT_GRID = 0.23;
const PT_FEED_IN = 0.055;

function simulatePortugal(p: SimulationParams): LineItem[] {
  const items: LineItem[] = [];

  // IRC Corporate Tax
  if (p.revenue > 0) {
    const profit = p.revenue * 0.10;
    let tax: number;
    let desc: string;
    if (profit <= PT_PME_THRESHOLD) {
      tax = profit * PT_IRC_PME;
      desc = `PME: 17% sobre ${profit.toFixed(0)} EUR`;
    } else {
      tax = PT_PME_THRESHOLD * PT_IRC_PME + (profit - PT_PME_THRESHOLD) * PT_IRC_STANDARD;
      desc = `PME: 17% sobre 25k + 21% sobre excedente`;
    }
    items.push({ code: 'PT-IRC-2026', label: 'IRC (Imposto sobre Rendimento)', amount: -tax, currency: 'EUR', description: desc, legalReference: 'CIRC Art. 87' });
  }

  // IVA Reduzido (savings on solar investment)
  if (p.solarCapacityKWp > 0) {
    const investmentPerKWp = 1_200;
    const totalInvest = p.solarCapacityKWp * investmentPerKWp;
    const saving = totalInvest * (PT_IVA_STANDARD - PT_IVA_REDUCED);
    items.push({ code: 'PT-IVA-SOLAR-2026', label: 'Poupança IVA Reduzido', amount: saving, currency: 'EUR', description: `IVA 6% vs 23% sobre ${totalInvest.toLocaleString()} EUR = ${saving.toFixed(0)} EUR`, legalReference: 'CIVA – Lista I' });
  }

  // Fundo Ambiental
  if (p.solarCapacityKWp > 0) {
    const investmentPerKWp = 1_200;
    const totalInvest = p.solarCapacityKWp * investmentPerKWp;
    const grant = Math.min(totalInvest * PT_FA_RATE, PT_FA_MAX);
    items.push({ code: 'PT-FA-EDIFICIOS-2026', label: 'Fundo Ambiental – Edifícios', amount: grant, currency: 'EUR', description: `85% de ${totalInvest.toLocaleString()} EUR (máx. ${PT_FA_MAX.toLocaleString()} EUR)`, legalReference: 'Fundo Ambiental' });
  }

  // EV Incentivo
  if (p.evCount > 0) {
    items.push({ code: 'PT-FA-VE-2026', label: 'Incentivo Veículos Elétricos', amount: p.evCount * PT_EV_GRANT, currency: 'EUR', description: `${p.evCount} veículo(s) x ${PT_EV_GRANT.toLocaleString()} EUR`, legalReference: 'Fundo Ambiental VE' });
  }

  // Energy savings
  if (p.solarCapacityKWp > 0) {
    const prod = p.solarCapacityKWp * 1_500;
    const self = prod * p.selfConsumptionRatio;
    const surplus = prod * (1 - p.selfConsumptionRatio);
    items.push({ code: 'PT-ENERGY-SAVINGS-2026', label: 'Poupança energia PV', amount: self * PT_GRID + surplus * PT_FEED_IN, currency: 'EUR', description: `${prod.toFixed(0)} kWh/ano` });
  }

  return items;
}
