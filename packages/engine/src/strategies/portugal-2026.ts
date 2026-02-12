import type {
  CalculationInput,
  CalculationLineItem,
} from '@ggt/shared';
import type { JurisdictionStrategy } from '../jurisdiction-strategy';

/**
 * Portugal 2026 Green Tax Strategy
 *
 * - IRC Corporate Tax: 21% standard / 17% PME (first 25k profit)
 * - IVA Reduzido: 6% instead of 23% on renewable energy equipment (savings)
 * - Fundo Ambiental: 85% reimbursement on sustainable building expenses (max 7,500 EUR)
 * - Incentivo Veículos Elétricos: 4,000 EUR per EV
 * - Energy savings from PV (1,500 kWh/kWp – excellent Portuguese insolation)
 */
export class Portugal2026Strategy implements JurisdictionStrategy {
  readonly countryCode = 'PT';
  readonly name = 'Portugal 2026 – Impostos & Incentivos Verdes';
  readonly fiscalYear = 2026;
  readonly currency = 'EUR' as const;

  // Corporate Tax (IRC)
  private readonly ircStandard = 0.21;
  private readonly ircPME = 0.17;
  private readonly pmeThreshold = 25_000;
  private readonly pmeRevenueMax = 50_000_000;

  // IVA Reduzido
  private readonly ivaStandard = 0.23;
  private readonly ivaReduced = 0.06;

  // Fundo Ambiental
  private readonly fundoRate = 0.85;
  private readonly fundoMax = 7_500;

  // EV Incentive
  private readonly evGrant = 4_000;

  // Energy
  private readonly gridElectricity = 0.23;
  private readonly feedInTariff = 0.055;

  async calculate(input: CalculationInput): Promise<CalculationLineItem[]> {
    const items: CalculationLineItem[] = [];
    const meta = (input.metadata ?? {}) as Record<string, any>;

    items.push(...this.calculateCorporateTax(input));
    items.push(...this.calculateIVAReduced(meta));
    items.push(...this.calculateFundoAmbiental(meta));
    items.push(...this.calculateEVIncentive(meta));
    items.push(...this.calculateEnergySavings(meta));

    return items;
  }

  private calculateCorporateTax(input: CalculationInput): CalculationLineItem[] {
    if (input.revenue <= 0) return [];
    const profit = input.revenue * 0.10;
    const isPME = input.revenue < this.pmeRevenueMax && input.employeeCount <= 250;

    let tax: number;
    let desc: string;

    if (isPME && profit <= this.pmeThreshold) {
      tax = profit * this.ircPME;
      desc = `PME: ${(this.ircPME * 100).toFixed(0)}% sobre ${profit.toFixed(0)} EUR`;
    } else if (isPME) {
      tax = this.pmeThreshold * this.ircPME + (profit - this.pmeThreshold) * this.ircStandard;
      desc = `PME: 17% sobre ${this.pmeThreshold.toLocaleString()} EUR + 21% sobre excedente`;
    } else {
      tax = profit * this.ircStandard;
      desc = `Taxa normal ${(this.ircStandard * 100).toFixed(0)}% sobre ${profit.toFixed(0)} EUR`;
    }

    return [{
      code: 'PT-IRC-2026',
      label: 'IRC (Imposto sobre Rendimento)',
      amount: -tax,
      currency: this.currency,
      description: desc,
      legalReference: 'Código do IRC – Art. 87.º',
    }];
  }

  private calculateIVAReduced(meta: Record<string, any>): CalculationLineItem[] {
    const solarKWp = Number(meta.solarCapacityKWp ?? 0);
    if (solarKWp <= 0) {
      return [{
        code: 'PT-IVA-GREEN-2026',
        label: 'IVA Reduzido Renováveis',
        amount: 0,
        currency: this.currency,
        description: 'Sem instalação renovável declarada',
      }];
    }

    const investmentCost = solarKWp * 1_200; // estimated 1,200 EUR/kWp
    const savings = investmentCost * (this.ivaStandard - this.ivaReduced);

    return [{
      code: 'PT-IVA-GREEN-2026',
      label: 'IVA Reduzido Renováveis',
      amount: savings,
      currency: this.currency,
      description: `Poupança IVA: ${(this.ivaStandard * 100).toFixed(0)}% → ${(this.ivaReduced * 100).toFixed(0)}% sobre ${investmentCost.toLocaleString()} EUR = ${savings.toFixed(0)} EUR`,
      legalReference: 'CIVA – Art. 18.º Taxa reduzida equipamentos renováveis',
    }];
  }

  private calculateFundoAmbiental(meta: Record<string, any>): CalculationLineItem[] {
    const expense = Number(meta.sustainabilityAuditExpense ?? 0);
    if (expense <= 0) {
      return [{
        code: 'PT-FUNDO-AMB-2026',
        label: 'Fundo Ambiental',
        amount: 0,
        currency: this.currency,
        description: 'Sem despesas elegíveis declaradas',
      }];
    }

    const grant = Math.min(expense * this.fundoRate, this.fundoMax);
    return [{
      code: 'PT-FUNDO-AMB-2026',
      label: 'Fundo Ambiental',
      amount: grant,
      currency: this.currency,
      description: `${(this.fundoRate * 100).toFixed(0)}% de ${expense.toLocaleString()} EUR = ${grant.toFixed(0)} EUR (máx. ${this.fundoMax.toLocaleString()} EUR)`,
      legalReference: 'Fundo Ambiental – Edifícios Mais Sustentáveis',
    }];
  }

  private calculateEVIncentive(meta: Record<string, any>): CalculationLineItem[] {
    const evCount = Number(meta.evCount ?? 0);
    if (evCount <= 0) {
      return [{
        code: 'PT-EV-INCENTIVO-2026',
        label: 'Incentivo Veículos Elétricos',
        amount: 0,
        currency: this.currency,
        description: 'Sem veículos elétricos declarados',
      }];
    }
    const grant = evCount * this.evGrant;
    return [{
      code: 'PT-EV-INCENTIVO-2026',
      label: 'Incentivo Veículos Elétricos',
      amount: grant,
      currency: this.currency,
      description: `${evCount} veículo(s) x ${this.evGrant.toLocaleString()} EUR = ${grant.toLocaleString()} EUR`,
      legalReference: 'Fundo Ambiental – Incentivo VE',
    }];
  }

  private calculateEnergySavings(meta: Record<string, any>): CalculationLineItem[] {
    const solarKWp = Number(meta.solarCapacityKWp ?? 0);
    if (solarKWp <= 0) return [];

    const annualProd = solarKWp * 1_500; // Excellent Portuguese insolation
    const selfRatio = Number(meta.selfConsumptionRatio ?? 0.5);
    const selfKwh = annualProd * selfRatio;
    const surplusKwh = annualProd * (1 - selfRatio);
    const savings = selfKwh * this.gridElectricity + surplusKwh * this.feedInTariff;

    return [{
      code: 'PT-ENERGY-SAVINGS-2026',
      label: 'Poupança energética PV (anual)',
      amount: savings,
      currency: this.currency,
      description: `${annualProd.toFixed(0)} kWh/ano → Autoconsumo: ${selfKwh.toFixed(0)} kWh x ${this.gridElectricity} EUR + Excedente: ${surplusKwh.toFixed(0)} kWh x ${this.feedInTariff} EUR`,
      legalReference: 'DL 162/2019 – Autoconsumo energia renovável',
    }];
  }
}
