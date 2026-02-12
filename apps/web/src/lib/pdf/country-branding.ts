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
  DE: {
    code: 'DE',
    name: 'Germany',
    headerBg: '#000000',
    headerAccent: '#DD0000',
    headerText: '#FFFFFF',
    taxColor: '#DD0000',
    subsidyColor: '#1A8D5F',
    chartBar: '#DD0000',
    chartLine: '#FFCC00',
    flagStripes: ['#000000', '#DD0000', '#FFCC00'],
    legal: 'Indikative Simulation auf Grundlage des deutschen Steuerrahmens 2026. Keine steuerliche Beratung.',
  },
  BE: {
    code: 'BE',
    name: 'Belgium',
    headerBg: '#2D2926',
    headerAccent: '#FDDA24',
    headerText: '#FFFFFF',
    taxColor: '#DD0000',
    subsidyColor: '#1A8D5F',
    chartBar: '#FDDA24',
    chartLine: '#2D2926',
    flagStripes: ['#2D2926', '#FDDA24', '#DD0000'],
    legal: 'Simulation indicative basée sur le cadre fiscal belge 2026. Ne constitue pas un avis fiscal.',
  },
  ES: {
    code: 'ES',
    name: 'Spain',
    headerBg: '#AA151B',
    headerAccent: '#F1BF00',
    headerText: '#FFFFFF',
    taxColor: '#AA151B',
    subsidyColor: '#1A8D5F',
    chartBar: '#F1BF00',
    chartLine: '#AA151B',
    flagStripes: ['#AA151B', '#F1BF00', '#AA151B'],
    legal: 'Simulación indicativa basada en el marco fiscal español 2026. No constituye asesoramiento fiscal.',
  },
  PT: {
    code: 'PT',
    name: 'Portugal',
    headerBg: '#006600',
    headerAccent: '#FF0000',
    headerText: '#FFFFFF',
    taxColor: '#FF0000',
    subsidyColor: '#006600',
    chartBar: '#006600',
    chartLine: '#FF0000',
    flagStripes: ['#006600', '#FF0000', '#FF0000'],
    legal: 'Simulação indicativa com base no quadro fiscal português de 2026. Não constitui aconselhamento fiscal.',
  },
};
