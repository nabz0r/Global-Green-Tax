const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

export interface SimulationInput {
  fiscalYear: number;
  co2Tonnes: number;
  revenue: number;
  employeeCount: number;
  energyConsumptionKwh: number;
  renewableEnergyPercent: number;
  emissionsByScope: {
    SCOPE_1: number;
    SCOPE_2: number;
    SCOPE_3: number;
  };
  metadata?: Record<string, unknown>;
}

export interface LineItem {
  code: string;
  label: string;
  amount: number;
  currency: string;
  description: string;
  legalReference?: string;
}

export interface CalculationResult {
  organizationId: string;
  countryCode: string;
  fiscalYear: number;
  calculatedAt: string;
  currency: string;
  lineItems: LineItem[];
  netAmount: number;
  engineVersion: string;
}

export async function calculateTax(
  input: SimulationInput,
  token?: string,
): Promise<CalculationResult> {
  const res = await fetch(`${API_URL}/api/v1/tax/calculate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(input),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: 'API error' }));
    throw new Error(err.message ?? `HTTP ${res.status}`);
  }

  return res.json();
}
