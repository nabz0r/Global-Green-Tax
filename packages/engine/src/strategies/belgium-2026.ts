import type {
  CalculationInput,
  CalculationLineItem,
} from '@ggt/shared';
import type { JurisdictionStrategy } from '../jurisdiction-strategy';

type BeEnterpriseSize = 'SMALL_ENTERPRISE' | 'MEDIUM_ENTERPRISE' | 'LARGE_ENTERPRISE';

/**
 * Belgium 2026 Green Tax Strategy
 *
 * - ISOC Corporate Tax: 25% standard / 20% SME (first 100k profit)
 * - Green Investment Deduction: 27.5% of green investment deducted from taxable income
 * - Ecologiepremie Plus (Flanders): 50/30/15% by enterprise size
 * - AMURE Audit Aid (Wallonie): 75% of energy audit expenses (max 50k)
 * - Fleet EV Prime: 5,000 EUR per vehicle
 * - Energy savings from PV (900 kWh/kWp, grid at 0.32 EUR/kWh)
 */
export class Belgium2026Strategy implements JurisdictionStrategy {
  readonly countryCode = 'BE';
  readonly name = 'Belgium 2026 – Taxes & Aides Vertes';
  readonly fiscalYear = 2026;
  readonly currency = 'EUR' as const;

  // Corporate Tax (ISOC)
  private readonly isocStandard = 0.25;
  private readonly isocSME = 0.20;
  private readonly isocSMEThreshold = 100_000;
  private readonly smeRevenueMax = 9_000_000;

  // Green Investment Deduction
  private readonly investDeductionRate = 0.275;

  // Ecologiepremie Plus (Flanders)
  private readonly ecoRates: Record<string, number> = {
    SMALL_ENTERPRISE: 0.50,
    MEDIUM_ENTERPRISE: 0.30,
    LARGE_ENTERPRISE: 0.15,
  };
  private readonly ecoMaxGrant = 250_000;

  // AMURE (Wallonie)
  private readonly amureRate = 0.75;
  private readonly amureMax = 50_000;

  // Fleet EV
  private readonly evGrant = 5_000;

  // Energy
  private readonly gridElectricity = 0.32;
  private readonly feedInTariff = 0.09;

  async calculate(input: CalculationInput): Promise<CalculationLineItem[]> {
    const items: CalculationLineItem[] = [];
    const meta = (input.metadata ?? {}) as Record<string, any>;

    items.push(...this.calculateCorporateTax(input, meta));
    items.push(...this.calculateEcologiepremie(input, meta));
    items.push(...this.calculateAMURE(meta));
    items.push(...this.calculateFleetEV(meta));
    items.push(...this.calculateEnergySavings(meta));

    return items;
  }

  private calculateCorporateTax(input: CalculationInput, meta: Record<string, any>): CalculationLineItem[] {
    if (input.revenue <= 0) return [];
    const profit = input.revenue * 0.10;
    const isSME = input.revenue < this.smeRevenueMax;

    // Green investment deduction reduces taxable profit
    const solarKWp = Number(meta.solarCapacityKWp ?? 0);
    const greenInvestment = solarKWp * 1_500; // estimated 1,500 EUR/kWp investment cost
    const deduction = greenInvestment * this.investDeductionRate;
    const taxableProfit = Math.max(0, profit - deduction);

    let tax: number;
    let desc: string;

    if (isSME && taxableProfit <= this.isocSMEThreshold) {
      tax = taxableProfit * this.isocSME;
      desc = `PME: 20% sur ${taxableProfit.toFixed(0)} EUR`;
    } else if (isSME) {
      tax = this.isocSMEThreshold * this.isocSME + (taxableProfit - this.isocSMEThreshold) * this.isocStandard;
      desc = `PME: 20% sur ${this.isocSMEThreshold.toLocaleString()} + 25% sur surplus`;
    } else {
      tax = taxableProfit * this.isocStandard;
      desc = `Taux normal 25% sur ${taxableProfit.toFixed(0)} EUR`;
    }

    const items: CalculationLineItem[] = [{
      code: 'BE-ISOC-2026',
      label: 'ISOC (Impôt des Sociétés)',
      amount: -tax,
      currency: this.currency,
      description: `${desc}${deduction > 0 ? ` (après déduction investissement vert: -${deduction.toFixed(0)} EUR)` : ''}`,
      legalReference: 'CIR/92 – Art. 69 Déduction pour investissement',
    }];

    // Show the deduction as a separate positive line item if applicable
    if (deduction > 0) {
      const taxSaved = deduction * (isSME ? this.isocSME : this.isocStandard);
      items.push({
        code: 'BE-INVEST-DEDUCT-2026',
        label: 'Déduction investissement vert',
        amount: taxSaved,
        currency: this.currency,
        description: `27,5% de ${greenInvestment.toLocaleString()} EUR d'investissement PV = ${deduction.toFixed(0)} EUR de déduction → ${taxSaved.toFixed(0)} EUR d'économie d'impôt`,
        legalReference: 'CIR/92 – Art. 69 Déduction pour investissement',
      });
    }

    return items;
  }

  private calculateEcologiepremie(input: CalculationInput, meta: Record<string, any>): CalculationLineItem[] {
    const size = this.classifyEnterprise(input.employeeCount, input.revenue);
    const solarKWp = Number(meta.solarCapacityKWp ?? 0);
    const greenInvestment = solarKWp * 1_500;

    if (greenInvestment <= 0) {
      return [{
        code: 'BE-ECOPREMIE-2026',
        label: 'Ecologiepremie Plus',
        amount: 0,
        currency: this.currency,
        description: 'Aucun investissement écologique déclaré',
      }];
    }

    const rate = this.ecoRates[size] ?? 0.15;
    const grant = Math.min(greenInvestment * rate, this.ecoMaxGrant);
    const sizeLabel = size === 'SMALL_ENTERPRISE' ? 'PE' : size === 'MEDIUM_ENTERPRISE' ? 'ME' : 'GE';

    return [{
      code: 'BE-ECOPREMIE-2026',
      label: 'Ecologiepremie Plus',
      amount: grant,
      currency: this.currency,
      description: `${sizeLabel}: ${(rate * 100).toFixed(0)}% de ${greenInvestment.toLocaleString()} EUR = ${grant.toLocaleString()} EUR`,
      legalReference: 'VLAIO – Ecologiepremie+',
    }];
  }

  private calculateAMURE(meta: Record<string, any>): CalculationLineItem[] {
    const expense = Number(meta.sustainabilityAuditExpense ?? 0);
    if (expense <= 0) {
      return [{
        code: 'BE-AMURE-2026',
        label: 'Aide AMURE (Wallonie)',
        amount: 0,
        currency: this.currency,
        description: 'Aucune dépense d\'audit énergétique déclarée',
      }];
    }

    const grant = Math.min(expense * this.amureRate, this.amureMax);
    return [{
      code: 'BE-AMURE-2026',
      label: 'Aide AMURE (Wallonie)',
      amount: grant,
      currency: this.currency,
      description: `75% de ${expense.toLocaleString()} EUR = ${grant.toLocaleString()} EUR (max ${this.amureMax.toLocaleString()} EUR)`,
      legalReference: 'SPW Énergie – Programme AMURE',
    }];
  }

  private calculateFleetEV(meta: Record<string, any>): CalculationLineItem[] {
    const evCount = Number(meta.evCount ?? 0);
    if (evCount <= 0) {
      return [{
        code: 'BE-FLEET-EV-2026',
        label: 'Prime Flotte EV',
        amount: 0,
        currency: this.currency,
        description: 'Aucun véhicule électrique déclaré',
      }];
    }
    const grant = evCount * this.evGrant;
    return [{
      code: 'BE-FLEET-EV-2026',
      label: 'Prime Flotte EV',
      amount: grant,
      currency: this.currency,
      description: `${evCount} véhicule(s) x ${this.evGrant.toLocaleString()} EUR = ${grant.toLocaleString()} EUR`,
      legalReference: 'Fiscalité verte flotte entreprises',
    }];
  }

  private calculateEnergySavings(meta: Record<string, any>): CalculationLineItem[] {
    const solarKWp = Number(meta.solarCapacityKWp ?? 0);
    if (solarKWp <= 0) return [];

    const annualProd = solarKWp * 900;
    const selfRatio = Number(meta.selfConsumptionRatio ?? 0.5);
    const selfKwh = annualProd * selfRatio;
    const surplusKwh = annualProd * (1 - selfRatio);
    const savings = selfKwh * this.gridElectricity + surplusKwh * this.feedInTariff;

    return [{
      code: 'BE-ENERGY-SAVINGS-2026',
      label: 'Économies énergie PV (annuel)',
      amount: savings,
      currency: this.currency,
      description: `${annualProd.toFixed(0)} kWh/an → Autoconsommation: ${selfKwh.toFixed(0)} kWh x ${this.gridElectricity} EUR + Injection: ${surplusKwh.toFixed(0)} kWh x ${this.feedInTariff} EUR`,
      legalReference: 'CWaPE / VREG – Tarif prosumer',
    }];
  }

  private classifyEnterprise(employees: number, revenue: number): BeEnterpriseSize {
    if (employees <= 50 && revenue <= 10_000_000) return 'SMALL_ENTERPRISE';
    if (employees <= 250 && revenue <= 50_000_000) return 'MEDIUM_ENTERPRISE';
    return 'LARGE_ENTERPRISE';
  }
}
