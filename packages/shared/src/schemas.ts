import { z } from 'zod';

/** Zod schema for validating calculation input */
export const CalculationInputSchema = z.object({
  organizationId: z.string().uuid(),
  countryCode: z.string().length(2).toUpperCase(),
  fiscalYear: z.number().int().min(2020).max(2100),
  co2Tonnes: z.number().nonnegative(),
  revenue: z.number().nonnegative(),
  employeeCount: z.number().int().nonnegative(),
  energyConsumptionKwh: z.number().nonnegative(),
  renewableEnergyPercent: z.number().min(0).max(100),
  emissionsByScope: z.object({
    SCOPE_1: z.number().nonnegative(),
    SCOPE_2: z.number().nonnegative(),
    SCOPE_3: z.number().nonnegative(),
  }),
  metadata: z.record(z.unknown()).optional(),
});

/** Zod schema for validating a country tax schema JSON file */
export const CountryTaxSchemaValidator = z.object({
  countryCode: z.string().length(2),
  countryName: z.string().min(1),
  currency: z.enum(['EUR', 'USD', 'GBP', 'CHF']),
  effectiveDate: z.string().date(),
  version: z.string(),
  co2TaxBrackets: z.array(
    z.object({
      minTonnes: z.number().nonnegative(),
      maxTonnes: z.number().positive().nullable(),
      ratePerTonne: z.number().nonnegative(),
      description: z.string(),
    })
  ),
  subsidies: z.array(
    z.object({
      code: z.string(),
      name: z.string(),
      maxAmount: z.number().nonnegative(),
      conditions: z.array(
        z.object({
          field: z.string(),
          operator: z.enum(['gte', 'lte', 'gt', 'lt', 'eq']),
          value: z.number(),
        })
      ),
      description: z.string(),
    })
  ),
  thresholds: z.record(z.number()),
});

/** Zod schema for creating an organization */
export const CreateOrganizationSchema = z.object({
  name: z.string().min(1).max(255),
  countryCode: z.string().length(2).toUpperCase(),
  vatNumber: z.string().optional(),
  sector: z.string().optional(),
});

/** Zod schema for tax calculation API request */
export const TaxCalculationRequestSchema = z.object({
  fiscalYear: z.number().int().min(2020).max(2100),
  co2Tonnes: z.number().nonnegative(),
  revenue: z.number().nonnegative(),
  employeeCount: z.number().int().nonnegative(),
  energyConsumptionKwh: z.number().nonnegative(),
  renewableEnergyPercent: z.number().min(0).max(100),
  emissionsByScope: z.object({
    SCOPE_1: z.number().nonnegative(),
    SCOPE_2: z.number().nonnegative(),
    SCOPE_3: z.number().nonnegative(),
  }),
  metadata: z.record(z.unknown()).optional(),
});
