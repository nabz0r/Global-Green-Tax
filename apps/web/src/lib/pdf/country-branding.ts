import type { CountryCode } from '../engine-client';

export interface CountryBranding {
  code: CountryCode;
  name: string;
  headerBg: string;
  headerAccent: string;
  headerText: string;
  taxColor: string;
  subsidyColor: string;
  chartBar: string;
  chartLine: string;
  flagStripes: [string, string, string];
  legal: string;
}

export const BRANDING: Record<CountryCode, CountryBranding> = {
  LU: {
    code: 'LU',
    name: 'Luxembourg',
    headerBg: '#1A4D8F',
    headerAccent: '#D71A28',
    headerText: '#FFFFFF',
    taxColor: '#D71A28',
    subsidyColor: '#1A8D5F',
    chartBar: '#5CBCE2',
    chartLine: '#1A4D8F',
    flagStripes: ['#EF4135', '#FFFFFF', '#00A3E0'],
    legal: 'Simulation indicative basée sur le cadre fiscal luxembourgeois 2026. Ne constitue pas un avis fiscal.',
  },
  FR: {
    code: 'FR',
    name: 'France',
    headerBg: '#002395',
    headerAccent: '#ED2939',
    headerText: '#FFFFFF',
    taxColor: '#ED2939',
    subsidyColor: '#1A8D5F',
    chartBar: '#002395',
    chartLine: '#ED2939',
    flagStripes: ['#002395', '#FFFFFF', '#ED2939'],
    legal: 'Simulation indicative basée sur le cadre fiscal français 2026. Ne constitue pas un avis fiscal.',
  },
};
