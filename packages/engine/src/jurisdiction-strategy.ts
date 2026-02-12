import type {
  CalculationInput,
  CalculationLineItem,
  CountryCode,
  CurrencyCode,
} from '@ggt/shared';

/**
 * Abstract interface that every country module must implement.
 * Each jurisdiction provides its own tax/subsidy calculation logic.
 */
export interface JurisdictionStrategy {
  /** ISO 3166-1 alpha-2 country code this strategy handles */
  readonly countryCode: CountryCode;

  /** Human-readable name */
  readonly name: string;

  /** Fiscal year(s) this strategy covers */
  readonly fiscalYear: number;

  /** Currency used for all amounts */
  readonly currency: CurrencyCode;

  /**
   * Core calculation method.
   * Takes validated input and returns an array of line items
   * (taxes as negative amounts, subsidies/credits as positive).
   */
  calculate(input: CalculationInput): Promise<CalculationLineItem[]>;

  /**
   * Optional: validate that the input has all jurisdiction-specific
   * fields needed (beyond the base schema validation).
   * Throws if invalid.
   */
  validateInput?(input: CalculationInput): void;
}
