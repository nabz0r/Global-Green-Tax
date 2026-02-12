import type { LineItem } from '../api';
import type { CountryCode } from '../engine-client';
import { BRANDING } from './country-branding';
import type { ReportData } from './green-tax-report';

interface ExportParams {
  countryCode: CountryCode;
  fiscalYear: number;
  lineItems: LineItem[];
  co2Tonnes: number;
  revenue: number;
  employeeCount: number;
  enterpriseType: string;
  solarCapacityKWp: number;
  selfConsumptionRatio: number;
}

export async function exportPdf(params: ExportParams): Promise<void> {
  // Dynamic import to avoid SSR issues and reduce bundle size
  const [{ pdf }, { GreenTaxReport }, React] = await Promise.all([
    import('@react-pdf/renderer'),
    import('./green-tax-report'),
    import('react'),
  ]);

  const data: ReportData = {
    branding: BRANDING[params.countryCode],
    fiscalYear: params.fiscalYear,
    lineItems: params.lineItems,
    params: {
      co2Tonnes: params.co2Tonnes,
      revenue: params.revenue,
      employeeCount: params.employeeCount,
      enterpriseType: params.enterpriseType,
      solarCapacityKWp: params.solarCapacityKWp,
      selfConsumptionRatio: params.selfConsumptionRatio,
    },
  };

  const blob = await pdf(
    React.createElement(GreenTaxReport, { data }),
  ).toBlob();

  // Trigger download
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `rapport-fiscal-vert-${params.countryCode}-${params.fiscalYear}.pdf`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
