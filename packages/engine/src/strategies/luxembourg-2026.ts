import type {
  CalculationInput,
  CalculationLineItem,
} from '@ggt/shared';
import type { JurisdictionStrategy } from '../jurisdiction-strategy';

/** Enterprise size classification */
export type EnterpriseSize = 'SMALL_ENTERPRISE' | 'MEDIUM_ENTERPRISE' | 'LARGE_ENTERPRISE';

/**
 * Luxembourg 2026 Green Tax Strategy
 *
 * Implements the full Luxembourg green fiscal framework:
 * - CO2 Tax: progressive marginal brackets on fossil fuel emissions
 * - Klimabonus Photovoltaïque: subsidy for solar panel installations
 * - Klimabonus Mobilité: EV purchase and wallbox grants
 * - Fit 4 Sustainability: audit/consulting subsidy by enterprise size
 * - Corporate Tax impact: effective combined rate
 *
 * Based on actual LU-2026.json data schema.
 */
export class Luxembourg2026Strategy implements JurisdictionStrategy {
  readonly countryCode = 'LU';
  readonly name = 'Luxembourg 2026 – Taxes & Subventions Vertes';
  readonly fiscalYear = 2026;
  readonly currency = 'EUR' as const;

  // --- CO2 Tax brackets (progressive marginal) ---
  private readonly co2Brackets = [
    { minTonnes: 0, maxTonnes: 500, ratePerTonne: 45 },
    { minTonnes: 500, maxTonnes: 5_000, ratePerTonne: 65 },
    { minTonnes: 5_000, maxTonnes: 25_000, ratePerTonne: 85 },
    { minTonnes: 25_000, maxTonnes: Infinity, ratePerTonne: 120 },
  ];

  // --- Corporate tax rates ---
  private readonly corporateStandardRate = 0.17;
  private readonly municipalBusinessTax = 0.0675;
  private readonly contributionEmploymentFund = 0.07;

  // --- Klimabonus PV ---
  private readonly pvRatePerKWp = 800;
  private readonly pvMaxGrant = 10_000;
  private readonly pvMaxCapacityKWp = 30;
  private readonly pvSelfConsumptionMin = 0.50;

  // --- Klimabonus Mobilité ---
  private readonly evGrants = [
    { maxConsumption: 16, amount: 6_000, label: '≤ 16 kWh/100km' },
    { maxConsumption: 18, amount: 3_000, label: '≤ 18 kWh/100km' },
  ];
  private readonly wallboxMaxGrant = 1_200;
  private readonly wallboxSmartBonus = 450;

  // --- Fit 4 Sustainability ---
  private readonly fit4Rates: Record<EnterpriseSize, number> = {
    SMALL_ENTERPRISE: 0.80,
    MEDIUM_ENTERPRISE: 0.60,
    LARGE_ENTERPRISE: 0.50,
  };
  private readonly fit4MaxExpense: Record<EnterpriseSize, number> = {
    SMALL_ENTERPRISE: 50_000,
    MEDIUM_ENTERPRISE: 100_000,
    LARGE_ENTERPRISE: 200_000,
  };

  // --- Energy rates ---
  private readonly feedInTariff = 0.1252;
  private readonly gridElectricityAvg = 0.22;

  async calculate(input: CalculationInput): Promise<CalculationLineItem[]> {
    const items: CalculationLineItem[] = [];
    const meta = (input.metadata ?? {}) as Record<string, any>;

    items.push(...this.calculateCo2Tax(input));
    items.push(...this.calculateCorporateTax(input));
    items.push(...this.calculateKlimabonusSolar(meta));
    items.push(...this.calculateKlimabonusMobility(meta));
    items.push(...this.calculateFit4Sustainability(input, meta));
    items.push(...this.calculateEnergySavings(input, meta));

    return items;
  }

  // ─── CO2 Tax ────────────────────────────────────────────────────────

  private calculateCo2Tax(input: CalculationInput): CalculationLineItem[] {
    const { co2Tonnes } = input;
    if (co2Tonnes <= 0) return [];

    let totalTax = 0;
    let remaining = co2Tonnes;
    const breakdown: string[] = [];

    for (const bracket of this.co2Brackets) {
      if (remaining <= 0) break;
      const width = bracket.maxTonnes === Infinity
        ? remaining
        : bracket.maxTonnes - bracket.minTonnes;
      const taxable = Math.min(remaining, width);
      const tax = taxable * bracket.ratePerTonne;
      totalTax += tax;
      remaining -= taxable;
      breakdown.push(`${taxable.toFixed(0)}t x ${bracket.ratePerTonne} EUR/t`);
    }

    return [{
      code: 'LU-CO2-TAX-2026',
      label: 'Taxe CO2 Luxembourg',
      amount: -totalTax,
      currency: this.currency,
      description: `Taxe carbone progressive sur ${co2Tonnes}t: ${breakdown.join(' + ')}`,
      legalReference: 'Loi du 23 décembre 2004 modifiée – Taxe CO2 nationale',
    }];
  }

  // ─── Corporate Tax ──────────────────────────────────────────────────

  private calculateCorporateTax(input: CalculationInput): CalculationLineItem[] {
    const { revenue } = input;
    if (revenue <= 0) return [];

    const effectiveRate = this.corporateStandardRate
      + this.municipalBusinessTax
      + (this.corporateStandardRate * this.contributionEmploymentFund);
    const estimatedProfit = revenue * 0.10; // Conservative 10% margin estimate
    const tax = estimatedProfit * effectiveRate;

    return [{
      code: 'LU-CORP-TAX-2026',
      label: 'IRC + Taxe Commerciale Communale',
      amount: -tax,
      currency: this.currency,
      description: `Taux effectif combiné ${(effectiveRate * 100).toFixed(2)}% sur bénéfice estimé de ${estimatedProfit.toFixed(0)} EUR (marge 10%)`,
      legalReference: 'Art. 174 LIR – Impôt sur le revenu des collectivités',
    }];
  }

  // ─── Klimabonus Photovoltaïque ──────────────────────────────────────

  private calculateKlimabonusSolar(meta: Record<string, any>): CalculationLineItem[] {
    const solarKWp = Number(meta.solarCapacityKWp ?? 0);
    const selfConsumption = Number(meta.selfConsumptionRatio ?? 0);

    if (solarKWp <= 0) {
      return [{
        code: 'LU-KB-PV-2026',
        label: 'Klimabonus Photovoltaïque',
        amount: 0,
        currency: this.currency,
        description: 'Aucune installation PV déclarée',
      }];
    }

    if (selfConsumption < this.pvSelfConsumptionMin) {
      return [{
        code: 'LU-KB-PV-2026',
        label: 'Klimabonus Photovoltaïque',
        amount: 0,
        currency: this.currency,
        description: `Non éligible: autoconsommation ${(selfConsumption * 100).toFixed(0)}% < ${(this.pvSelfConsumptionMin * 100).toFixed(0)}% requis`,
      }];
    }

    const eligibleKWp = Math.min(solarKWp, this.pvMaxCapacityKWp);
    const grant = Math.min(eligibleKWp * this.pvRatePerKWp, this.pvMaxGrant);

    return [{
      code: 'LU-KB-PV-2026',
      label: 'Klimabonus Photovoltaïque',
      amount: grant,
      currency: this.currency,
      description: `${eligibleKWp} kWp x ${this.pvRatePerKWp} EUR/kWp = ${grant.toFixed(0)} EUR (max ${this.pvMaxGrant} EUR)`,
      legalReference: 'Règlement grand-ducal PRIMe House – Volet photovoltaïque',
    }];
  }

  // ─── Klimabonus Mobilité (EV + Wallbox) ─────────────────────────────

  private calculateKlimabonusMobility(meta: Record<string, any>): CalculationLineItem[] {
    const items: CalculationLineItem[] = [];

    // EV grant
    const evConsumption = Number(meta.evConsumptionKWhPer100km ?? 0);
    const evCount = Number(meta.evCount ?? 0);

    if (evCount > 0 && evConsumption > 0) {
      let grantPerVehicle = 0;
      let grantLabel = '';
      for (const tier of this.evGrants) {
        if (evConsumption <= tier.maxConsumption) {
          grantPerVehicle = tier.amount;
          grantLabel = tier.label;
          break;
        }
      }

      const totalEvGrant = grantPerVehicle * evCount;
      items.push({
        code: 'LU-KB-EV-2026',
        label: 'Prime Véhicule Électrique',
        amount: totalEvGrant,
        currency: this.currency,
        description: totalEvGrant > 0
          ? `${evCount} véhicule(s) (${grantLabel}): ${evCount} x ${grantPerVehicle} EUR = ${totalEvGrant} EUR`
          : `Consommation ${evConsumption} kWh/100km dépasse le seuil de 18 kWh/100km`,
        legalReference: 'Régime d\'aides PRIMe Car-e',
      });
    } else {
      items.push({
        code: 'LU-KB-EV-2026',
        label: 'Prime Véhicule Électrique',
        amount: 0,
        currency: this.currency,
        description: 'Aucun véhicule électrique déclaré',
      });
    }

    // Wallbox grant
    const wallboxCount = Number(meta.wallboxCount ?? 0);
    const hasSmartCharging = Boolean(meta.wallboxSmartCharging ?? false);

    if (wallboxCount > 0) {
      const perWallbox = this.wallboxMaxGrant + (hasSmartCharging ? this.wallboxSmartBonus : 0);
      const totalWallbox = perWallbox * wallboxCount;

      items.push({
        code: 'LU-KB-WALLBOX-2026',
        label: 'Prime Borne de Recharge',
        amount: totalWallbox,
        currency: this.currency,
        description: `${wallboxCount} borne(s): ${this.wallboxMaxGrant} EUR${hasSmartCharging ? ` + ${this.wallboxSmartBonus} EUR smart charging` : ''} = ${totalWallbox} EUR`,
        legalReference: 'Régime d\'aides PRIMe Car-e – Bornes de recharge',
      });
    } else {
      items.push({
        code: 'LU-KB-WALLBOX-2026',
        label: 'Prime Borne de Recharge',
        amount: 0,
        currency: this.currency,
        description: 'Aucune borne de recharge déclarée',
      });
    }

    return items;
  }

  // ─── Fit 4 Sustainability ───────────────────────────────────────────

  private calculateFit4Sustainability(
    input: CalculationInput,
    meta: Record<string, any>,
  ): CalculationLineItem[] {
    const size = this.classifyEnterprise(input.employeeCount, input.revenue);
    const auditExpense = Number(meta.sustainabilityAuditExpense ?? 0);

    if (auditExpense <= 0) {
      return [{
        code: 'LU-F4S-2026',
        label: 'Fit 4 Sustainability',
        amount: 0,
        currency: this.currency,
        description: 'Aucune dépense d\'audit/conseil déclarée',
        legalReference: 'Luxinnovation – Fit 4 Sustainability Programme',
      }];
    }

    const rate = this.fit4Rates[size];
    const maxExpense = this.fit4MaxExpense[size];
    const eligible = Math.min(auditExpense, maxExpense);
    const subsidy = eligible * rate;

    const sizeLabel = size.replace('_', ' ').toLowerCase()
      .replace(/\b\w/g, c => c.toUpperCase());

    return [{
      code: 'LU-F4S-2026',
      label: 'Fit 4 Sustainability',
      amount: subsidy,
      currency: this.currency,
      description: `${sizeLabel}: ${(rate * 100).toFixed(0)}% de ${eligible.toFixed(0)} EUR de dépenses éligibles = ${subsidy.toFixed(0)} EUR`,
      legalReference: 'Luxinnovation – Fit 4 Sustainability Programme',
    }];
  }

  // ─── Energy Savings Estimate ────────────────────────────────────────

  private calculateEnergySavings(
    input: CalculationInput,
    meta: Record<string, any>,
  ): CalculationLineItem[] {
    const solarKWp = Number(meta.solarCapacityKWp ?? 0);
    if (solarKWp <= 0) return [];

    // Estimated annual production: 950 kWh/kWp in Luxembourg
    const annualProductionKwh = solarKWp * 950;
    const selfConsumption = Number(meta.selfConsumptionRatio ?? 0.5);

    const selfConsumedKwh = annualProductionKwh * selfConsumption;
    const injectedKwh = annualProductionKwh * (1 - selfConsumption);

    const savingsFromSelfConsumption = selfConsumedKwh * this.gridElectricityAvg;
    const revenueFromInjection = injectedKwh * this.feedInTariff;
    const totalSavings = savingsFromSelfConsumption + revenueFromInjection;

    return [{
      code: 'LU-ENERGY-SAVINGS-2026',
      label: 'Économies énergie PV (estimation annuelle)',
      amount: totalSavings,
      currency: this.currency,
      description: `Production estimée ${annualProductionKwh.toFixed(0)} kWh/an → Autoconsommation: ${selfConsumedKwh.toFixed(0)} kWh x ${this.gridElectricityAvg} EUR + Injection: ${injectedKwh.toFixed(0)} kWh x ${this.feedInTariff} EUR`,
      legalReference: 'Tarif d\'injection ILR 2026',
    }];
  }

  // ─── Helpers ────────────────────────────────────────────────────────

  private classifyEnterprise(employees: number, revenue: number): EnterpriseSize {
    if (employees <= 50 && revenue <= 10_000_000) return 'SMALL_ENTERPRISE';
    if (employees <= 250 && revenue <= 50_000_000) return 'MEDIUM_ENTERPRISE';
    return 'LARGE_ENTERPRISE';
  }
}
