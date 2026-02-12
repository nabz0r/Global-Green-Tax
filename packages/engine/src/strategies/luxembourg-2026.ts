import type {
  CalculationInput,
  CalculationLineItem,
} from '@ggt/shared';
import type { JurisdictionStrategy } from '../jurisdiction-strategy';

/**
 * Luxembourg 2026 Green Tax Strategy
 *
 * Implements:
 * - CO2 Tax (taxe carbone): progressive brackets on emissions
 * - Klimabonus: household/corporate climate bonus for renewable energy adoption
 * - Fit 4 Sustainability: government subsidy for SMEs investing in sustainability
 *
 * Legal references based on Luxembourg's Pacte Climat and national energy plan.
 */
export class Luxembourg2026Strategy implements JurisdictionStrategy {
  readonly countryCode = 'LU';
  readonly name = 'Luxembourg 2026 Green Tax & Subsidies';
  readonly fiscalYear = 2026;
  readonly currency = 'EUR' as const;

  // --- CO2 Tax brackets (EUR per tonne) ---
  private readonly co2Brackets = [
    { minTonnes: 0, maxTonnes: 500, ratePerTonne: 45 },
    { minTonnes: 500, maxTonnes: 5000, ratePerTonne: 65 },
    { minTonnes: 5000, maxTonnes: 25000, ratePerTonne: 85 },
    { minTonnes: 25000, maxTonnes: Infinity, ratePerTonne: 120 },
  ];

  // --- Klimabonus thresholds ---
  private readonly klimabonusBaseAmount = 10_000; // EUR base for qualifying orgs
  private readonly klimabonusRenewableThreshold = 50; // % renewable to qualify
  private readonly klimabonusMaxAmount = 50_000;
  private readonly klimabonusBonusPerPercent = 800; // EUR per % above threshold

  // --- Fit 4 Sustainability ---
  private readonly fit4MaxSubsidy = 150_000; // EUR
  private readonly fit4MaxEmployees = 250; // SME cap
  private readonly fit4RevenueCapEur = 50_000_000; // 50M EUR
  private readonly fit4BaseSubsidy = 25_000;
  private readonly fit4PerEmployeeBonus = 500;

  async calculate(input: CalculationInput): Promise<CalculationLineItem[]> {
    const items: CalculationLineItem[] = [];

    items.push(...this.calculateCo2Tax(input));
    items.push(...this.calculateKlimabonus(input));
    items.push(...this.calculateFit4Sustainability(input));

    return items;
  }

  /**
   * CO2 Tax: progressive rate per tonne based on total emissions.
   * Calculated across brackets (marginal rate system).
   */
  private calculateCo2Tax(input: CalculationInput): CalculationLineItem[] {
    const { co2Tonnes } = input;
    if (co2Tonnes <= 0) return [];

    let totalTax = 0;
    let remaining = co2Tonnes;
    const breakdown: string[] = [];

    for (const bracket of this.co2Brackets) {
      if (remaining <= 0) break;

      const bracketWidth = bracket.maxTonnes === Infinity
        ? remaining
        : bracket.maxTonnes - bracket.minTonnes;

      const taxableInBracket = Math.min(remaining, bracketWidth);
      const bracketTax = taxableInBracket * bracket.ratePerTonne;
      totalTax += bracketTax;
      remaining -= taxableInBracket;

      breakdown.push(
        `${taxableInBracket.toFixed(1)}t @ €${bracket.ratePerTonne}/t = €${bracketTax.toFixed(2)}`
      );
    }

    return [
      {
        code: 'LU-CO2-TAX-2026',
        label: 'Taxe CO2 Luxembourg',
        amount: -totalTax, // Negative = tax liability
        currency: this.currency,
        description: `Progressive CO2 tax on ${co2Tonnes}t emissions: ${breakdown.join('; ')}`,
        legalReference: 'Loi du 23 décembre 2004 modifiée – Taxe CO2 nationale',
      },
    ];
  }

  /**
   * Klimabonus: climate bonus for organizations meeting renewable energy thresholds.
   * Base bonus + extra per percentage point above the threshold.
   */
  private calculateKlimabonus(input: CalculationInput): CalculationLineItem[] {
    const { renewableEnergyPercent } = input;

    if (renewableEnergyPercent < this.klimabonusRenewableThreshold) {
      return [
        {
          code: 'LU-KLIMABONUS-2026',
          label: 'Klimabonus',
          amount: 0,
          currency: this.currency,
          description: `Not eligible: renewable energy at ${renewableEnergyPercent}% (minimum ${this.klimabonusRenewableThreshold}% required)`,
          legalReference: 'Pacte Climat 2.0 – Klimabonus entreprises',
        },
      ];
    }

    const percentAbove = renewableEnergyPercent - this.klimabonusRenewableThreshold;
    const bonus = Math.min(
      this.klimabonusBaseAmount + percentAbove * this.klimabonusBonusPerPercent,
      this.klimabonusMaxAmount
    );

    return [
      {
        code: 'LU-KLIMABONUS-2026',
        label: 'Klimabonus',
        amount: bonus, // Positive = subsidy
        currency: this.currency,
        description: `Climate bonus: base €${this.klimabonusBaseAmount} + ${percentAbove}% above threshold × €${this.klimabonusBonusPerPercent} = €${bonus.toFixed(2)}`,
        legalReference: 'Pacte Climat 2.0 – Klimabonus entreprises',
      },
    ];
  }

  /**
   * Fit 4 Sustainability: government subsidy for SMEs
   * investing in sustainable practices.
   * Requires: ≤250 employees AND ≤€50M revenue.
   */
  private calculateFit4Sustainability(input: CalculationInput): CalculationLineItem[] {
    const { employeeCount, revenue } = input;

    // Eligibility check: SME criteria
    if (employeeCount > this.fit4MaxEmployees || revenue > this.fit4RevenueCapEur) {
      return [
        {
          code: 'LU-FIT4-SUSTAIN-2026',
          label: 'Fit 4 Sustainability',
          amount: 0,
          currency: this.currency,
          description: `Not eligible: exceeds SME criteria (max ${this.fit4MaxEmployees} employees, max €${(this.fit4RevenueCapEur / 1_000_000).toFixed(0)}M revenue)`,
          legalReference: 'Luxinnovation – Fit 4 Sustainability Programme',
        },
      ];
    }

    const subsidy = Math.min(
      this.fit4BaseSubsidy + employeeCount * this.fit4PerEmployeeBonus,
      this.fit4MaxSubsidy
    );

    return [
      {
        code: 'LU-FIT4-SUSTAIN-2026',
        label: 'Fit 4 Sustainability',
        amount: subsidy, // Positive = subsidy
        currency: this.currency,
        description: `SME sustainability subsidy: base €${this.fit4BaseSubsidy} + ${employeeCount} employees × €${this.fit4PerEmployeeBonus} = €${subsidy.toFixed(2)}`,
        legalReference: 'Luxinnovation – Fit 4 Sustainability Programme',
      },
    ];
  }
}
