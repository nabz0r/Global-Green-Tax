import type { CountryCode } from '@ggt/shared';
import type { JurisdictionStrategy } from './jurisdiction-strategy';

/**
 * Registry that maps country codes to their calculation strategies.
 * Supports multiple strategies per country (versioned by fiscal year).
 */
export class StrategyRegistry {
  private strategies = new Map<string, JurisdictionStrategy>();

  private key(countryCode: CountryCode, fiscalYear: number): string {
    return `${countryCode.toUpperCase()}:${fiscalYear}`;
  }

  /** Register a jurisdiction strategy */
  register(strategy: JurisdictionStrategy): void {
    const k = this.key(strategy.countryCode, strategy.fiscalYear);
    if (this.strategies.has(k)) {
      throw new Error(
        `Strategy already registered for ${strategy.countryCode} fiscal year ${strategy.fiscalYear}`
      );
    }
    this.strategies.set(k, strategy);
  }

  /** Retrieve a strategy for a given country and fiscal year */
  get(countryCode: CountryCode, fiscalYear: number): JurisdictionStrategy | undefined {
    return this.strategies.get(this.key(countryCode, fiscalYear));
  }

  /** Check if a strategy exists */
  has(countryCode: CountryCode, fiscalYear: number): boolean {
    return this.strategies.has(this.key(countryCode, fiscalYear));
  }

  /** List all registered strategy keys */
  listRegistered(): string[] {
    return Array.from(this.strategies.keys());
  }
}
