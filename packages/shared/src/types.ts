/** ISO 3166-1 alpha-2 country code */
export type CountryCode = string;

/** Supported currency codes */
export type CurrencyCode = 'EUR' | 'USD' | 'GBP' | 'CHF';

/** Emission scope as per GHG Protocol */
export enum EmissionScope {
  SCOPE_1 = 'SCOPE_1', // Direct emissions
  SCOPE_2 = 'SCOPE_2', // Indirect from energy
  SCOPE_3 = 'SCOPE_3', // Value chain
}

/** Input to the calculation engine */
export interface CalculationInput {
  organizationId: string;
  countryCode: CountryCode;
  fiscalYear: number;
  /** Annual CO2 emissions in metric tonnes */
  co2Tonnes: number;
  /** Revenue in local currency */
  revenue: number;
  /** Number of employees */
  employeeCount: number;
  /** Energy consumption in kWh */
  energyConsumptionKwh: number;
  /** Percentage of energy from renewables (0-100) */
  renewableEnergyPercent: number;
  /** Scope breakdown */
  emissionsByScope: Record<EmissionScope, number>;
  /** Arbitrary additional data for jurisdiction-specific calculations */
  metadata?: Record<string, unknown>;
}

/** A single line item from a calculation */
export interface CalculationLineItem {
  code: string;
  label: string;
  /** Positive = subsidy/credit, Negative = tax/levy */
  amount: number;
  currency: CurrencyCode;
  description: string;
  /** Reference to the legal basis */
  legalReference?: string;
}

/** Full result of a jurisdiction calculation */
export interface CalculationResult {
  organizationId: string;
  countryCode: CountryCode;
  fiscalYear: number;
  calculatedAt: Date;
  currency: CurrencyCode;
  lineItems: CalculationLineItem[];
  /** Net amount: positive = net benefit, negative = net cost */
  netAmount: number;
  /** Engine version that produced this result */
  engineVersion: string;
}

/** Schema definition for a country's tax brackets (loaded from JSON) */
export interface CountryTaxSchema {
  countryCode: CountryCode;
  countryName: string;
  currency: CurrencyCode;
  effectiveDate: string;
  version: string;
  co2TaxBrackets: TaxBracket[];
  subsidies: SubsidyDefinition[];
  thresholds: Record<string, number>;
}

export interface TaxBracket {
  minTonnes: number;
  maxTonnes: number | null;
  ratePerTonne: number;
  description: string;
}

export interface SubsidyDefinition {
  code: string;
  name: string;
  maxAmount: number;
  conditions: SubsidyCondition[];
  description: string;
}

export interface SubsidyCondition {
  field: string;
  operator: 'gte' | 'lte' | 'gt' | 'lt' | 'eq';
  value: number;
}
