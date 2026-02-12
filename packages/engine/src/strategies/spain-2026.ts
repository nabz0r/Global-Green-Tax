import type {
  CalculationInput,
  CalculationLineItem,
} from '@ggt/shared';
import type { JurisdictionStrategy } from '../jurisdiction-strategy';

/**
 * Spain 2026 Green Tax Strategy
 *
 * - Impuesto de Sociedades: 25% standard / 23% PYME
 * - IBI Bonificación: 50% property tax reduction for solar (annualized)
 * - Programa Autoconsumo (NextGen): 600 EUR/kWp (max 12,000 EUR)
 * - Plan MOVES III: 5,000 EUR per EV
 * - Energy savings from PV (1,500 kWh/kWp – excellent Spanish insolation)
 */
export class Spain2026Strategy implements JurisdictionStrategy {
  readonly countryCode = 'ES';
  readonly name = 'Spain 2026 – Impuestos & Subvenciones Verdes';
  readonly fiscalYear = 2026;
  readonly currency = 'EUR' as const;

  // Corporate Tax
  private readonly isStandard = 0.25;
  private readonly isPYME = 0.23;
  private readonly pymeRevenueMax = 1_000_000;

  // IBI Solar Bonificación
  private readonly ibiBonificacion = 0.50;
  private readonly ibiDurationYears = 5;
  private readonly averageAnnualIBI = 2_000;

  // NextGen Autoconsumo
  private readonly solarRatePerKWp = 600;
  private readonly solarMaxGrant = 12_000;

  // MOVES III
  private readonly evGrant = 5_000;

  // Energy
  private readonly gridElectricity = 0.21;
  private readonly feedInTariff = 0.06;

  async calculate(input: CalculationInput): Promise<CalculationLineItem[]> {
    const items: CalculationLineItem[] = [];
    const meta = (input.metadata ?? {}) as Record<string, any>;

    items.push(...this.calculateCorporateTax(input));
    items.push(...this.calculateIBIBonificacion(meta));
    items.push(...this.calculateAutoconsumo(meta));
    items.push(...this.calculateMOVES(meta));
    items.push(...this.calculateEnergySavings(meta));

    return items;
  }

  private calculateCorporateTax(input: CalculationInput): CalculationLineItem[] {
    if (input.revenue <= 0) return [];
    const profit = input.revenue * 0.10;
    const isPyme = input.revenue < this.pymeRevenueMax;
    const rate = isPyme ? this.isPYME : this.isStandard;
    const tax = profit * rate;

    return [{
      code: 'ES-IS-2026',
      label: 'Impuesto de Sociedades',
      amount: -tax,
      currency: this.currency,
      description: `${isPyme ? 'PYME' : 'Estándar'}: ${(rate * 100).toFixed(0)}% sobre ${profit.toFixed(0)} EUR beneficio estimado`,
      legalReference: 'Ley 27/2014 – Impuesto sobre Sociedades',
    }];
  }

  private calculateIBIBonificacion(meta: Record<string, any>): CalculationLineItem[] {
    const solarKWp = Number(meta.solarCapacityKWp ?? 0);
    if (solarKWp <= 0) {
      return [{
        code: 'ES-IBI-SOLAR-2026',
        label: 'Bonificación IBI Solar',
        amount: 0,
        currency: this.currency,
        description: 'Sin instalación solar declarada',
      }];
    }

    const annualSaving = this.averageAnnualIBI * this.ibiBonificacion;
    return [{
      code: 'ES-IBI-SOLAR-2026',
      label: 'Bonificación IBI Solar',
      amount: annualSaving,
      currency: this.currency,
      description: `${(this.ibiBonificacion * 100).toFixed(0)}% reducción IBI = ${annualSaving.toFixed(0)} EUR/año (durante ${this.ibiDurationYears} años)`,
      legalReference: 'RDL 7/2019 – Bonificación IBI instalaciones solares',
    }];
  }

  private calculateAutoconsumo(meta: Record<string, any>): CalculationLineItem[] {
    const solarKWp = Number(meta.solarCapacityKWp ?? 0);
    if (solarKWp <= 0) {
      return [{
        code: 'ES-NEXTGEN-SOLAR-2026',
        label: 'Programa Autoconsumo',
        amount: 0,
        currency: this.currency,
        description: 'Sin instalación solar declarada',
      }];
    }

    const grant = Math.min(solarKWp * this.solarRatePerKWp, this.solarMaxGrant);
    return [{
      code: 'ES-NEXTGEN-SOLAR-2026',
      label: 'Programa Autoconsumo',
      amount: grant,
      currency: this.currency,
      description: `${solarKWp} kWp x ${this.solarRatePerKWp} EUR = ${grant.toFixed(0)} EUR (máx. ${this.solarMaxGrant.toLocaleString()} EUR)`,
      legalReference: 'IDAE – Programa de Incentivos Autoconsumo (NextGen EU)',
    }];
  }

  private calculateMOVES(meta: Record<string, any>): CalculationLineItem[] {
    const evCount = Number(meta.evCount ?? 0);
    if (evCount <= 0) {
      return [{
        code: 'ES-MOVES-2026',
        label: 'Plan MOVES III',
        amount: 0,
        currency: this.currency,
        description: 'Sin vehículos eléctricos declarados',
      }];
    }
    const grant = evCount * this.evGrant;
    return [{
      code: 'ES-MOVES-2026',
      label: 'Plan MOVES III',
      amount: grant,
      currency: this.currency,
      description: `${evCount} vehículo(s) x ${this.evGrant.toLocaleString()} EUR = ${grant.toLocaleString()} EUR`,
      legalReference: 'RD 266/2021 – Plan MOVES III',
    }];
  }

  private calculateEnergySavings(meta: Record<string, any>): CalculationLineItem[] {
    const solarKWp = Number(meta.solarCapacityKWp ?? 0);
    if (solarKWp <= 0) return [];

    const annualProd = solarKWp * 1_500; // Excellent Spanish insolation
    const selfRatio = Number(meta.selfConsumptionRatio ?? 0.5);
    const selfKwh = annualProd * selfRatio;
    const surplusKwh = annualProd * (1 - selfRatio);
    const savings = selfKwh * this.gridElectricity + surplusKwh * this.feedInTariff;

    return [{
      code: 'ES-ENERGY-SAVINGS-2026',
      label: 'Ahorro energético PV (anual)',
      amount: savings,
      currency: this.currency,
      description: `${annualProd.toFixed(0)} kWh/año → Autoconsumo: ${selfKwh.toFixed(0)} kWh x ${this.gridElectricity} EUR + Excedente: ${surplusKwh.toFixed(0)} kWh x ${this.feedInTariff} EUR`,
      legalReference: 'RD 244/2019 – Autoconsumo eléctrico',
    }];
  }
}
