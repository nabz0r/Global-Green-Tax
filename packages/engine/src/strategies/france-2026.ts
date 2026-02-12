import type {
  CalculationInput,
  CalculationLineItem,
} from '@ggt/shared';
import type { JurisdictionStrategy } from '../jurisdiction-strategy';

/** Enterprise size for French fiscal rules */
type FrEnterpriseSize = 'SMALL_ENTERPRISE' | 'MEDIUM_ENTERPRISE' | 'LARGE_ENTERPRISE';

/**
 * France 2026 Green Tax Strategy
 *
 * Implements the French green fiscal framework:
 * - Contribution Climat Énergie (CCE): flat-rate carbon tax at 44.60 EUR/t
 * - IS (Impôt sur les Sociétés): 25% standard / 15% PME reduced rate + CVAE
 * - Prime à l'Autoconsommation PV: tiered solar self-consumption subsidy
 * - Bonus Écologique: EV purchase grants (cars + vans)
 * - ADEME Tremplin: decarbonation subsidy for SMEs
 * - Energy savings estimate from PV installations
 *
 * Based on FR-2026.json data schema.
 */
export class France2026Strategy implements JurisdictionStrategy {
  readonly countryCode = 'FR';
  readonly name = 'France 2026 – Taxes & Aides Vertes';
  readonly fiscalYear = 2026;
  readonly currency = 'EUR' as const;

  // --- CCE (Contribution Climat Énergie) ---
  private readonly cceRatePerTonne = 44.60;

  // --- Corporate Tax (IS) ---
  private readonly isStandardRate = 0.25;
  private readonly isReducedRatePME = 0.15;
  private readonly isReducedRateThreshold = 42_500; // Profit threshold for 15%
  private readonly pmeRevenueThreshold = 10_000_000; // CA < 10M for PME rate
  private readonly cvaeRate = 0.0009;

  // --- Prime Autoconsommation PV (tiered) ---
  private readonly pvTiers = [
    { maxKWp: 9, ratePerKWp: 80 },
    { maxKWp: 36, ratePerKWp: 140 },
    { maxKWp: 100, ratePerKWp: 70 },
  ];
  private readonly pvFeedInSurplus = 0.0536; // EUR/kWh surplus

  // --- Bonus Écologique ---
  private readonly evGrantCar = 3_000;
  private readonly evGrantVan = 4_000;

  // --- ADEME Tremplin ---
  private readonly ademeRates: Record<string, number> = {
    SMALL_ENTERPRISE: 0.50,
    MEDIUM_ENTERPRISE: 0.30,
  };
  private readonly ademeMaxGrant = 200_000;

  // --- Energy rates ---
  private readonly gridElectricityAvg = 0.24;

  async calculate(input: CalculationInput): Promise<CalculationLineItem[]> {
    const items: CalculationLineItem[] = [];
    const meta = (input.metadata ?? {}) as Record<string, any>;

    items.push(...this.calculateCCE(input));
    items.push(...this.calculateCorporateTax(input));
    items.push(...this.calculatePrimeAutoconsommation(meta));
    items.push(...this.calculateBonusEcologique(meta));
    items.push(...this.calculateAdemeTreemplin(input, meta));
    items.push(...this.calculateEnergySavings(meta));

    return items;
  }

  // ─── CCE (Carbon Tax) ───────────────────────────────────────────────

  private calculateCCE(input: CalculationInput): CalculationLineItem[] {
    const { co2Tonnes } = input;
    if (co2Tonnes <= 0) return [];

    const tax = co2Tonnes * this.cceRatePerTonne;

    return [{
      code: 'FR-CCE-2026',
      label: 'Contribution Climat Énergie (CCE)',
      amount: -tax,
      currency: this.currency,
      description: `${co2Tonnes}t CO2 x ${this.cceRatePerTonne} EUR/t = ${tax.toFixed(0)} EUR`,
      legalReference: 'Art. 265 du Code des douanes – Composante carbone',
    }];
  }

  // ─── Corporate Tax (IS + CVAE) ──────────────────────────────────────

  private calculateCorporateTax(input: CalculationInput): CalculationLineItem[] {
    const { revenue } = input;
    if (revenue <= 0) return [];

    const estimatedProfit = revenue * 0.10;
    const isPME = revenue < this.pmeRevenueThreshold;

    let isTax: number;
    let description: string;

    if (isPME && estimatedProfit <= this.isReducedRateThreshold) {
      // Full reduced rate
      isTax = estimatedProfit * this.isReducedRatePME;
      description = `PME: taux réduit ${(this.isReducedRatePME * 100).toFixed(0)}% sur ${estimatedProfit.toFixed(0)} EUR`;
    } else if (isPME) {
      // Blended: 15% on first 42,500, 25% on rest
      const reducedPart = this.isReducedRateThreshold * this.isReducedRatePME;
      const standardPart = (estimatedProfit - this.isReducedRateThreshold) * this.isStandardRate;
      isTax = reducedPart + standardPart;
      description = `PME: 15% sur ${this.isReducedRateThreshold.toLocaleString()} EUR + 25% sur le surplus`;
    } else {
      isTax = estimatedProfit * this.isStandardRate;
      description = `Taux normal ${(this.isStandardRate * 100).toFixed(0)}% sur ${estimatedProfit.toFixed(0)} EUR`;
    }

    // CVAE
    const cvae = revenue * this.cvaeRate;
    const totalTax = isTax + cvae;

    return [{
      code: 'FR-IS-2026',
      label: 'Impôt sur les Sociétés + CVAE',
      amount: -totalTax,
      currency: this.currency,
      description: `${description} + CVAE ${(this.cvaeRate * 100).toFixed(2)}% = ${totalTax.toFixed(0)} EUR`,
      legalReference: 'Art. 219 CGI – Impôt sur les sociétés / Art. 1586 ter CGI – CVAE',
    }];
  }

  // ─── Prime à l'Autoconsommation PV ──────────────────────────────────

  private calculatePrimeAutoconsommation(meta: Record<string, any>): CalculationLineItem[] {
    const solarKWp = Number(meta.solarCapacityKWp ?? 0);

    if (solarKWp <= 0) {
      return [{
        code: 'FR-PV-PRIME-2026',
        label: 'Prime Autoconsommation PV',
        amount: 0,
        currency: this.currency,
        description: 'Aucune installation PV déclarée',
      }];
    }

    // Calculate tiered prime
    let totalPrime = 0;
    let remaining = Math.min(solarKWp, 100);
    let prevMax = 0;
    const breakdown: string[] = [];

    for (const tier of this.pvTiers) {
      if (remaining <= 0) break;
      const tierWidth = tier.maxKWp - prevMax;
      const inTier = Math.min(remaining, tierWidth);
      const amount = inTier * tier.ratePerKWp;
      totalPrime += amount;
      remaining -= inTier;
      prevMax = tier.maxKWp;
      if (inTier > 0) {
        breakdown.push(`${inTier.toFixed(1)} kWp x ${tier.ratePerKWp} EUR`);
      }
    }

    return [{
      code: 'FR-PV-PRIME-2026',
      label: 'Prime Autoconsommation PV',
      amount: totalPrime,
      currency: this.currency,
      description: `Prime dégressive: ${breakdown.join(' + ')} = ${totalPrime.toFixed(0)} EUR`,
      legalReference: 'Arrêté tarifaire S21 – Prime à l\'autoconsommation',
    }];
  }

  // ─── Bonus Écologique ───────────────────────────────────────────────

  private calculateBonusEcologique(meta: Record<string, any>): CalculationLineItem[] {
    const items: CalculationLineItem[] = [];

    const evCars = Number(meta.evCountCars ?? meta.evCount ?? 0);
    const evVans = Number(meta.evCountVans ?? 0);

    const carGrant = evCars * this.evGrantCar;
    const vanGrant = evVans * this.evGrantVan;
    const totalGrant = carGrant + vanGrant;

    if (totalGrant > 0) {
      const parts: string[] = [];
      if (evCars > 0) parts.push(`${evCars} VP x ${this.evGrantCar.toLocaleString()} EUR`);
      if (evVans > 0) parts.push(`${evVans} VUL x ${this.evGrantVan.toLocaleString()} EUR`);

      items.push({
        code: 'FR-BONUS-ECO-2026',
        label: 'Bonus Écologique Entreprises',
        amount: totalGrant,
        currency: this.currency,
        description: `${parts.join(' + ')} = ${totalGrant.toLocaleString()} EUR (TVA déductible 100%)`,
        legalReference: 'Décret n°2024-102 – Bonus écologique véhicules entreprises',
      });
    } else {
      items.push({
        code: 'FR-BONUS-ECO-2026',
        label: 'Bonus Écologique Entreprises',
        amount: 0,
        currency: this.currency,
        description: 'Aucun véhicule électrique déclaré',
      });
    }

    return items;
  }

  // ─── ADEME Tremplin ─────────────────────────────────────────────────

  private calculateAdemeTreemplin(
    input: CalculationInput,
    meta: Record<string, any>,
  ): CalculationLineItem[] {
    const size = this.classifyEnterprise(input.employeeCount, input.revenue);
    const decarbExpense = Number(meta.sustainabilityAuditExpense ?? 0);

    // Large enterprises not eligible for ADEME Tremplin
    if (size === 'LARGE_ENTERPRISE') {
      return [{
        code: 'FR-ADEME-TREMPLIN-2026',
        label: 'ADEME Tremplin',
        amount: 0,
        currency: this.currency,
        description: 'Non éligible: réservé aux PME/TPE',
        legalReference: 'ADEME – Programme Tremplin pour la transition écologique',
      }];
    }

    if (decarbExpense <= 0) {
      return [{
        code: 'FR-ADEME-TREMPLIN-2026',
        label: 'ADEME Tremplin',
        amount: 0,
        currency: this.currency,
        description: 'Aucune dépense de décarbonation déclarée',
        legalReference: 'ADEME – Programme Tremplin pour la transition écologique',
      }];
    }

    const rate = this.ademeRates[size] ?? 0;
    const rawGrant = decarbExpense * rate;
    const grant = Math.min(rawGrant, this.ademeMaxGrant);

    const sizeLabel = size === 'SMALL_ENTERPRISE' ? 'TPE/PE' : 'ME';

    return [{
      code: 'FR-ADEME-TREMPLIN-2026',
      label: 'ADEME Tremplin',
      amount: grant,
      currency: this.currency,
      description: `${sizeLabel}: ${(rate * 100).toFixed(0)}% de ${decarbExpense.toLocaleString()} EUR = ${grant.toLocaleString()} EUR (max ${this.ademeMaxGrant.toLocaleString()} EUR)`,
      legalReference: 'ADEME – Programme Tremplin pour la transition écologique',
    }];
  }

  // ─── Energy Savings ─────────────────────────────────────────────────

  private calculateEnergySavings(meta: Record<string, any>): CalculationLineItem[] {
    const solarKWp = Number(meta.solarCapacityKWp ?? 0);
    if (solarKWp <= 0) return [];

    // France average: 1,100 kWh/kWp (better insolation than Luxembourg)
    const annualProductionKwh = solarKWp * 1_100;
    const selfConsumption = Number(meta.selfConsumptionRatio ?? 0.5);

    const selfConsumedKwh = annualProductionKwh * selfConsumption;
    const surplusKwh = annualProductionKwh * (1 - selfConsumption);

    const savingsSelf = selfConsumedKwh * this.gridElectricityAvg;
    const revenueSurplus = surplusKwh * this.pvFeedInSurplus;
    const totalSavings = savingsSelf + revenueSurplus;

    return [{
      code: 'FR-ENERGY-SAVINGS-2026',
      label: 'Économies énergie PV (estimation annuelle)',
      amount: totalSavings,
      currency: this.currency,
      description: `Production ${annualProductionKwh.toFixed(0)} kWh/an → Autoconsommation: ${selfConsumedKwh.toFixed(0)} kWh x ${this.gridElectricityAvg} EUR + Surplus: ${surplusKwh.toFixed(0)} kWh x ${this.pvFeedInSurplus} EUR`,
      legalReference: 'Tarif d\'achat EDF OA Solaire 2026',
    }];
  }

  // ─── Helpers ────────────────────────────────────────────────────────

  private classifyEnterprise(employees: number, revenue: number): FrEnterpriseSize {
    if (employees <= 50 && revenue <= 10_000_000) return 'SMALL_ENTERPRISE';
    if (employees <= 250 && revenue <= 50_000_000) return 'MEDIUM_ENTERPRISE';
    return 'LARGE_ENTERPRISE';
  }
}
