import type {
  CalculationInput,
  CalculationLineItem,
} from '@ggt/shared';
import type { JurisdictionStrategy } from '../jurisdiction-strategy';

type DeEnterpriseSize = 'SMALL_ENTERPRISE' | 'MEDIUM_ENTERPRISE' | 'LARGE_ENTERPRISE';

/**
 * Germany 2026 Green Tax Strategy
 *
 * - nEHS (National Emissions Trading): 65 EUR/t CO2
 * - KSt + GewSt corporate tax (~29.83% effective)
 * - KfW 270 solar subsidy: 300 EUR/kWp (max 15,000 EUR)
 * - BAFA EE Efficiency Bonus: 35% SME / 20% Large on audit expenses
 * - Umweltbonus: 3,000 EUR per EV
 * - Energy savings from PV (950 kWh/kWp, grid at 0.38 EUR/kWh)
 */
export class Germany2026Strategy implements JurisdictionStrategy {
  readonly countryCode = 'DE';
  readonly name = 'Germany 2026 – Grüne Steuern & Förderungen';
  readonly fiscalYear = 2026;
  readonly currency = 'EUR' as const;

  // nEHS Carbon Tax
  private readonly nehsRatePerTonne = 65.00;

  // Corporate Tax (KSt + Soli + GewSt)
  private readonly kstRate = 0.15;
  private readonly soliRate = 0.055; // on KSt
  private readonly gewstMesszahl = 0.035;
  private readonly gewstHebesatz = 4.0; // 400%
  private readonly effectiveCorpRate = 0.2983;

  // KfW 270 Solar
  private readonly kfwRatePerKWp = 300;
  private readonly kfwMaxGrant = 15_000;

  // BAFA EE Bonus
  private readonly bafaRates: Record<string, number> = {
    SMALL_ENTERPRISE: 0.35,
    MEDIUM_ENTERPRISE: 0.35,
    LARGE_ENTERPRISE: 0.20,
  };
  private readonly bafaMaxGrant = 100_000;

  // Umweltbonus
  private readonly evGrant = 3_000;

  // Energy
  private readonly gridElectricity = 0.38;
  private readonly feedInTariff = 0.082;

  async calculate(input: CalculationInput): Promise<CalculationLineItem[]> {
    const items: CalculationLineItem[] = [];
    const meta = (input.metadata ?? {}) as Record<string, any>;

    items.push(...this.calculateNEHS(input));
    items.push(...this.calculateCorporateTax(input));
    items.push(...this.calculateKfW270(meta));
    items.push(...this.calculateBafaEE(input, meta));
    items.push(...this.calculateUmweltbonus(meta));
    items.push(...this.calculateEnergySavings(meta));

    return items;
  }

  private calculateNEHS(input: CalculationInput): CalculationLineItem[] {
    if (input.co2Tonnes <= 0) return [];
    const tax = input.co2Tonnes * this.nehsRatePerTonne;
    return [{
      code: 'DE-NEHS-2026',
      label: 'nEHS CO2-Abgabe',
      amount: -tax,
      currency: this.currency,
      description: `${input.co2Tonnes}t CO2 x ${this.nehsRatePerTonne} EUR/t = ${tax.toFixed(0)} EUR`,
      legalReference: 'BEHG – Brennstoffemissionshandelsgesetz',
    }];
  }

  private calculateCorporateTax(input: CalculationInput): CalculationLineItem[] {
    if (input.revenue <= 0) return [];
    const profit = input.revenue * 0.10;
    const kst = profit * this.kstRate;
    const soli = kst * this.soliRate;
    const gewst = profit * this.gewstMesszahl * this.gewstHebesatz;
    const total = kst + soli + gewst;

    return [{
      code: 'DE-CORP-TAX-2026',
      label: 'KSt + Soli + GewSt',
      amount: -total,
      currency: this.currency,
      description: `KSt ${kst.toFixed(0)} + Soli ${soli.toFixed(0)} + GewSt ${gewst.toFixed(0)} = ${total.toFixed(0)} EUR`,
      legalReference: 'KStG / GewStG / SolZG',
    }];
  }

  private calculateKfW270(meta: Record<string, any>): CalculationLineItem[] {
    const solarKWp = Number(meta.solarCapacityKWp ?? 0);
    if (solarKWp <= 0) {
      return [{
        code: 'DE-KFW270-2026',
        label: 'KfW 270 Erneuerbare Energien',
        amount: 0,
        currency: this.currency,
        description: 'Keine PV-Anlage angegeben',
      }];
    }
    const grant = Math.min(solarKWp * this.kfwRatePerKWp, this.kfwMaxGrant);
    return [{
      code: 'DE-KFW270-2026',
      label: 'KfW 270 Erneuerbare Energien',
      amount: grant,
      currency: this.currency,
      description: `${solarKWp} kWp x ${this.kfwRatePerKWp} EUR = ${grant.toFixed(0)} EUR (max ${this.kfwMaxGrant.toLocaleString()} EUR)`,
      legalReference: 'KfW-Programm 270 – Erneuerbare Energien',
    }];
  }

  private calculateBafaEE(input: CalculationInput, meta: Record<string, any>): CalculationLineItem[] {
    const size = this.classifyEnterprise(input.employeeCount, input.revenue);
    const expense = Number(meta.sustainabilityAuditExpense ?? 0);

    if (expense <= 0) {
      return [{
        code: 'DE-BAFA-EE-2026',
        label: 'BAFA Energieeffizienz-Bonus',
        amount: 0,
        currency: this.currency,
        description: 'Keine förderfähigen Ausgaben angegeben',
      }];
    }

    const rate = this.bafaRates[size] ?? 0.20;
    const grant = Math.min(expense * rate, this.bafaMaxGrant);
    const sizeLabel = size === 'LARGE_ENTERPRISE' ? 'Großunternehmen' : 'KMU';

    return [{
      code: 'DE-BAFA-EE-2026',
      label: 'BAFA Energieeffizienz-Bonus',
      amount: grant,
      currency: this.currency,
      description: `${sizeLabel}: ${(rate * 100).toFixed(0)}% von ${expense.toLocaleString()} EUR = ${grant.toLocaleString()} EUR`,
      legalReference: 'BAFA – Bundesförderung für Energieeffizienz',
    }];
  }

  private calculateUmweltbonus(meta: Record<string, any>): CalculationLineItem[] {
    const evCount = Number(meta.evCount ?? 0);
    if (evCount <= 0) {
      return [{
        code: 'DE-UMWELTBONUS-2026',
        label: 'Umweltbonus E-Fahrzeug',
        amount: 0,
        currency: this.currency,
        description: 'Keine Elektrofahrzeuge angegeben',
      }];
    }
    const grant = evCount * this.evGrant;
    return [{
      code: 'DE-UMWELTBONUS-2026',
      label: 'Umweltbonus E-Fahrzeug',
      amount: grant,
      currency: this.currency,
      description: `${evCount} Fahrzeug(e) x ${this.evGrant.toLocaleString()} EUR = ${grant.toLocaleString()} EUR`,
      legalReference: 'Umweltbonus – BAFA Elektromobilität',
    }];
  }

  private calculateEnergySavings(meta: Record<string, any>): CalculationLineItem[] {
    const solarKWp = Number(meta.solarCapacityKWp ?? 0);
    if (solarKWp <= 0) return [];

    const annualProd = solarKWp * 950;
    const selfRatio = Number(meta.selfConsumptionRatio ?? 0.5);
    const selfKwh = annualProd * selfRatio;
    const surplusKwh = annualProd * (1 - selfRatio);
    const savings = selfKwh * this.gridElectricity + surplusKwh * this.feedInTariff;

    return [{
      code: 'DE-ENERGY-SAVINGS-2026',
      label: 'PV-Energieeinsparungen (jährlich)',
      amount: savings,
      currency: this.currency,
      description: `${annualProd.toFixed(0)} kWh/Jahr → Eigenverbrauch: ${selfKwh.toFixed(0)} kWh x ${this.gridElectricity} EUR + Einspeisung: ${surplusKwh.toFixed(0)} kWh x ${this.feedInTariff} EUR`,
      legalReference: 'EEG 2023 – Einspeisevergütung',
    }];
  }

  private classifyEnterprise(employees: number, revenue: number): DeEnterpriseSize {
    if (employees <= 50 && revenue <= 10_000_000) return 'SMALL_ENTERPRISE';
    if (employees <= 250 && revenue <= 50_000_000) return 'MEDIUM_ENTERPRISE';
    return 'LARGE_ENTERPRISE';
  }
}
