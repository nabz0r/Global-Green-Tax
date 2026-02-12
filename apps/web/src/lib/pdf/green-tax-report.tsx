import React from 'react';
import {
  Document,
  Page,
  View,
  Text,
  Svg,
  Rect,
  Line,
  Circle,
  StyleSheet,
  Font,
} from '@react-pdf/renderer';
import type { LineItem } from '../api';
import type { CountryBranding } from './country-branding';

// ─── Types ─────────────────────────────────────────────────────────────────

export interface ReportData {
  branding: CountryBranding;
  fiscalYear: number;
  lineItems: LineItem[];
  params: {
    co2Tonnes: number;
    revenue: number;
    employeeCount: number;
    enterpriseType: string;
    solarCapacityKWp: number;
    selfConsumptionRatio: number;
  };
}

// ─── Helpers ───────────────────────────────────────────────────────────────

function formatEur(amount: number): string {
  const abs = Math.abs(amount);
  const sign = amount < 0 ? '-' : amount > 0 ? '+' : '';
  if (abs >= 1_000_000) return `${sign}${(abs / 1_000_000).toFixed(2)}M EUR`;
  if (abs >= 1_000) return `${sign}${(abs / 1_000).toFixed(1)}k EUR`;
  return `${sign}${abs.toFixed(0)} EUR`;
}

function formatEurFull(amount: number): string {
  const abs = Math.abs(amount);
  const formatted = abs.toLocaleString('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  const sign = amount < 0 ? '-' : amount > 0 ? '+' : '';
  return `${sign}${formatted} EUR`;
}

function classifyItems(items: LineItem[]) {
  const taxes = items.filter((i) => i.amount < 0);
  const subsidies = items.filter((i) => i.amount > 0);
  const totalTaxes = taxes.reduce((s, i) => s + i.amount, 0);
  const totalSubsidies = subsidies.reduce((s, i) => s + i.amount, 0);
  return { taxes, subsidies, totalTaxes, totalSubsidies, net: totalTaxes + totalSubsidies };
}

/**
 * Build a 5-year ROI projection.
 * One-time items: PV prime, EV grants, ADEME/Fit4S, wallbox
 * Recurring items: CO2 tax, corporate tax, energy savings
 */
function buildRoiProjection(items: LineItem[]): { year: number; annual: number; cumulative: number }[] {
  const oneTimeCodes = [
    'LU-KB-PV-2026', 'LU-KB-EV-2026', 'LU-KB-WALLBOX-2026', 'LU-F4S-2026',
    'FR-PV-PRIME-2026', 'FR-BONUS-ECO-2026', 'FR-ADEME-TREMPLIN-2026',
  ];

  let oneTimeTotal = 0;
  let recurringTotal = 0;

  for (const item of items) {
    if (oneTimeCodes.includes(item.code)) {
      oneTimeTotal += item.amount;
    } else {
      recurringTotal += item.amount;
    }
  }

  const projection: { year: number; annual: number; cumulative: number }[] = [];
  let cumulative = 0;

  for (let y = 1; y <= 5; y++) {
    const annual = (y === 1 ? oneTimeTotal : 0) + recurringTotal;
    cumulative += annual;
    projection.push({ year: y, annual, cumulative });
  }

  return projection;
}

// ─── Styles ────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  page: {
    fontFamily: 'Helvetica',
    fontSize: 9,
    padding: 40,
    color: '#1a1a1a',
  },
  // Header
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
    borderRadius: 6,
    padding: 16,
  },
  flagBox: {
    width: 48,
    height: 32,
    marginRight: 14,
    borderRadius: 3,
    overflow: 'hidden',
  },
  headerTitleGroup: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontFamily: 'Helvetica-Bold',
    color: '#FFFFFF',
    marginBottom: 2,
  },
  headerSubtitle: {
    fontSize: 10,
    color: '#FFFFFFCC',
  },
  headerBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: '#FFFFFF22',
  },
  headerBadgeText: {
    fontSize: 9,
    fontFamily: 'Helvetica-Bold',
    color: '#FFFFFF',
  },
  // Summary cards
  summaryRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 20,
  },
  summaryCard: {
    flex: 1,
    borderRadius: 6,
    padding: 12,
    borderWidth: 1,
  },
  summaryLabel: {
    fontSize: 8,
    color: '#666666',
    marginBottom: 4,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
  },
  summaryValue: {
    fontSize: 16,
    fontFamily: 'Helvetica-Bold',
  },
  summaryCaption: {
    fontSize: 7,
    color: '#999999',
    marginTop: 3,
  },
  // Section
  sectionTitle: {
    fontSize: 12,
    fontFamily: 'Helvetica-Bold',
    marginBottom: 8,
    paddingBottom: 4,
    borderBottomWidth: 2,
  },
  // Table
  tableHeader: {
    flexDirection: 'row',
    paddingVertical: 6,
    paddingHorizontal: 8,
    backgroundColor: '#F5F5F5',
    borderRadius: 4,
    marginBottom: 2,
  },
  tableHeaderText: {
    fontSize: 7,
    fontFamily: 'Helvetica-Bold',
    color: '#666666',
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderBottomWidth: 0.5,
    borderBottomColor: '#EEEEEE',
  },
  tableRowAlt: {
    backgroundColor: '#FAFAFA',
  },
  colCode: { width: '18%' },
  colLabel: { width: '30%' },
  colDesc: { width: '32%' },
  colAmount: { width: '20%', textAlign: 'right' as const },
  cellText: { fontSize: 8 },
  cellTextBold: { fontSize: 8, fontFamily: 'Helvetica-Bold' },
  cellTextSmall: { fontSize: 7, color: '#888888' },
  // ROI
  roiContainer: {
    marginTop: 16,
  },
  roiTable: {
    marginBottom: 16,
  },
  roiRow: {
    flexDirection: 'row',
    paddingVertical: 5,
    paddingHorizontal: 8,
    borderBottomWidth: 0.5,
    borderBottomColor: '#EEEEEE',
  },
  roiColYear: { width: '15%' },
  roiColAnnual: { width: '30%', textAlign: 'right' as const },
  roiColCumulative: { width: '30%', textAlign: 'right' as const },
  roiColBar: { width: '25%', justifyContent: 'center' as const },
  // Chart
  chartContainer: {
    marginTop: 8,
    padding: 12,
    backgroundColor: '#FAFAFA',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#EEEEEE',
  },
  chartTitle: {
    fontSize: 10,
    fontFamily: 'Helvetica-Bold',
    marginBottom: 10,
    color: '#333333',
  },
  // Footer
  footer: {
    position: 'absolute' as const,
    bottom: 30,
    left: 40,
    right: 40,
  },
  footerLine: {
    borderTopWidth: 1,
    borderTopColor: '#DDDDDD',
    paddingTop: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  footerText: {
    fontSize: 7,
    color: '#999999',
  },
  // Params table
  paramsRow: {
    flexDirection: 'row',
    marginBottom: 12,
    gap: 10,
  },
  paramBox: {
    flex: 1,
    padding: 8,
    borderRadius: 4,
    backgroundColor: '#F8F8F8',
    borderWidth: 0.5,
    borderColor: '#E0E0E0',
  },
  paramLabel: {
    fontSize: 7,
    color: '#888888',
    marginBottom: 2,
  },
  paramValue: {
    fontSize: 10,
    fontFamily: 'Helvetica-Bold',
    color: '#333333',
  },
});

// ─── Flag Component ────────────────────────────────────────────────────────

function FlagIcon({ stripes }: { stripes: [string, string, string] }) {
  return (
    <Svg viewBox="0 0 48 32" style={s.flagBox}>
      <Rect x="0" y="0" width="16" height="32" fill={stripes[0]} />
      <Rect x="16" y="0" width="16" height="32" fill={stripes[1]} />
      <Rect x="32" y="0" width="16" height="32" fill={stripes[2]} />
    </Svg>
  );
}

// ─── ROI Bar Chart (SVG) ───────────────────────────────────────────────────

function RoiChart({
  projection,
  branding,
}: {
  projection: { year: number; annual: number; cumulative: number }[];
  branding: CountryBranding;
}) {
  const chartW = 460;
  const chartH = 160;
  const padL = 60;
  const padR = 20;
  const padT = 10;
  const padB = 30;
  const plotW = chartW - padL - padR;
  const plotH = chartH - padT - padB;

  const allValues = projection.flatMap((p) => [p.annual, p.cumulative]);
  const maxVal = Math.max(...allValues.map(Math.abs), 1);
  const yScale = plotH / (maxVal * 2);
  const zeroY = padT + plotH / 2;
  const barW = plotW / 5 * 0.5;
  const gap = plotW / 5;

  return (
    <Svg viewBox={`0 0 ${chartW} ${chartH}`} style={{ width: chartW, height: chartH }}>
      {/* Zero axis */}
      <Line
        x1={String(padL)}
        y1={String(zeroY)}
        x2={String(chartW - padR)}
        y2={String(zeroY)}
        stroke="#CCCCCC"
        strokeWidth="0.5"
      />
      {/* Zero label */}
      <SvgText x={padL - 6} y={zeroY + 3} text="0" size={7} color="#999" anchor="end" />

      {/* Max / min labels */}
      <SvgText x={padL - 6} y={padT + 5} text={formatEur(maxVal)} size={6} color="#BBB" anchor="end" />
      <SvgText x={padL - 6} y={padT + plotH + 3} text={formatEur(-maxVal)} size={6} color="#BBB" anchor="end" />

      {/* Bars + cumulative dots */}
      {projection.map((p, i) => {
        const cx = padL + gap * i + gap / 2;
        const barH = Math.abs(p.annual) * yScale;
        const barY = p.annual >= 0 ? zeroY - barH : zeroY;
        const dotY = zeroY - p.cumulative * yScale;

        return (
          <React.Fragment key={i}>
            {/* Bar */}
            <Rect
              x={String(cx - barW / 2)}
              y={String(barY)}
              width={String(barW)}
              height={String(Math.max(barH, 1))}
              fill={p.annual >= 0 ? branding.subsidyColor : branding.taxColor}
              rx="2"
            />
            {/* Year label */}
            <SvgText x={cx} y={chartH - 8} text={`A${p.year}`} size={8} color="#666" anchor="middle" />
            {/* Cumulative dot */}
            <Circle cx={String(cx)} cy={String(dotY)} r="3" fill={branding.chartLine} />
            {/* Cumulative line to next */}
            {i < projection.length - 1 && (
              <Line
                x1={String(cx)}
                y1={String(dotY)}
                x2={String(padL + gap * (i + 1) + gap / 2)}
                y2={String(zeroY - projection[i + 1].cumulative * yScale)}
                stroke={branding.chartLine}
                strokeWidth="1.5"
              />
            )}
            {/* Cumulative value label */}
            <SvgText
              x={cx}
              y={dotY - 7}
              text={formatEur(p.cumulative)}
              size={7}
              color={branding.chartLine}
              anchor="middle"
            />
          </React.Fragment>
        );
      })}
    </Svg>
  );
}

/** Wrapper for SVG text since react-pdf Text inside Svg needs special handling */
function SvgText({
  x,
  y,
  text,
  size,
  color,
  anchor = 'start',
  bold = false,
}: {
  x: number;
  y: number;
  text: string;
  size: number;
  color: string;
  anchor?: 'start' | 'middle' | 'end';
  bold?: boolean;
}) {
  // react-pdf doesn't support <text> inside SVG, so we use positioned View+Text
  // We'll approximate positioning with absolute views overlaid on the SVG
  return null; // Handled via overlay approach below
}

// Since react-pdf SVG doesn't support <text>, we use an overlay approach
function RoiChartWithLabels({
  projection,
  branding,
}: {
  projection: { year: number; annual: number; cumulative: number }[];
  branding: CountryBranding;
}) {
  const chartW = 460;
  const chartH = 160;
  const padL = 60;
  const padR = 20;
  const padT = 10;
  const padB = 30;
  const plotW = chartW - padL - padR;
  const plotH = chartH - padT - padB;

  const allValues = projection.flatMap((p) => [p.annual, p.cumulative]);
  const maxVal = Math.max(...allValues.map(Math.abs), 1);
  const yScale = plotH / (maxVal * 2);
  const zeroY = padT + plotH / 2;
  const barW = plotW / 5 * 0.5;
  const gap = plotW / 5;

  return (
    <View style={{ position: 'relative', width: chartW, height: chartH + 10 }}>
      {/* SVG layer: bars, lines, dots */}
      <Svg viewBox={`0 0 ${chartW} ${chartH}`} style={{ width: chartW, height: chartH }}>
        {/* Grid lines */}
        <Line x1={String(padL)} y1={String(padT)} x2={String(padL)} y2={String(chartH - padB)} stroke="#EEEEEE" strokeWidth="0.5" />
        <Line x1={String(padL)} y1={String(zeroY)} x2={String(chartW - padR)} y2={String(zeroY)} stroke="#AAAAAA" strokeWidth="0.75" strokeDasharray="4,2" />

        {projection.map((p, i) => {
          const cx = padL + gap * i + gap / 2;
          const barH = Math.abs(p.annual) * yScale;
          const barY = p.annual >= 0 ? zeroY - barH : zeroY;
          const dotY = zeroY - p.cumulative * yScale;

          return (
            <React.Fragment key={i}>
              <Rect
                x={String(cx - barW / 2)}
                y={String(barY)}
                width={String(barW)}
                height={String(Math.max(barH, 1))}
                fill={p.annual >= 0 ? branding.subsidyColor : branding.taxColor}
                opacity="0.75"
                rx="2"
              />
              <Circle cx={String(cx)} cy={String(dotY)} r="4" fill={branding.chartLine} />
              {i < projection.length - 1 && (
                <Line
                  x1={String(cx)}
                  y1={String(dotY)}
                  x2={String(padL + gap * (i + 1) + gap / 2)}
                  y2={String(zeroY - projection[i + 1].cumulative * yScale)}
                  stroke={branding.chartLine}
                  strokeWidth="1.5"
                />
              )}
            </React.Fragment>
          );
        })}
      </Svg>

      {/* Text overlay layer */}
      {/* Zero axis label */}
      <Text style={{ position: 'absolute', left: padL - 28, top: zeroY - 4, fontSize: 7, color: '#999' }}>
        0 EUR
      </Text>

      {/* Year labels + cumulative values */}
      {projection.map((p, i) => {
        const cx = padL + gap * i + gap / 2;
        const dotY = zeroY - p.cumulative * yScale;

        return (
          <React.Fragment key={`lbl-${i}`}>
            <Text style={{
              position: 'absolute',
              left: cx - 10,
              top: chartH - 18,
              fontSize: 8,
              color: '#555',
              fontFamily: 'Helvetica-Bold',
              textAlign: 'center',
              width: 20,
            }}>
              A{p.year}
            </Text>
            <Text style={{
              position: 'absolute',
              left: cx - 30,
              top: dotY - 14,
              fontSize: 7,
              color: branding.chartLine,
              fontFamily: 'Helvetica-Bold',
              textAlign: 'center',
              width: 60,
            }}>
              {formatEur(p.cumulative)}
            </Text>
          </React.Fragment>
        );
      })}
    </View>
  );
}

// ─── Legend ─────────────────────────────────────────────────────────────────

function ChartLegend({ branding }: { branding: CountryBranding }) {
  return (
    <View style={{ flexDirection: 'row', gap: 20, marginTop: 6 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
        <View style={{ width: 12, height: 8, backgroundColor: branding.subsidyColor, borderRadius: 2, opacity: 0.75 }} />
        <Text style={{ fontSize: 7, color: '#666' }}>Flux annuel net</Text>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
        <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: branding.chartLine }} />
        <Text style={{ fontSize: 7, color: '#666' }}>Cumul ROI</Text>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
        <View style={{ width: 12, height: 8, backgroundColor: branding.taxColor, borderRadius: 2, opacity: 0.75 }} />
        <Text style={{ fontSize: 7, color: '#666' }}>Charge nette</Text>
      </View>
    </View>
  );
}

// ─── Main Document ─────────────────────────────────────────────────────────

export function GreenTaxReport({ data }: { data: ReportData }) {
  const { branding, fiscalYear, lineItems, params } = data;
  const { taxes, subsidies, totalTaxes, totalSubsidies, net } = classifyItems(lineItems);
  const projection = buildRoiProjection(lineItems);
  const generatedAt = new Date().toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  const enterpriseLabel = {
    SMALL_ENTERPRISE: 'Petite entreprise',
    MEDIUM_ENTERPRISE: 'Moyenne entreprise',
    LARGE_ENTERPRISE: 'Grande entreprise',
  }[params.enterpriseType] ?? params.enterpriseType;

  return (
    <Document>
      {/* ─── PAGE 1: Summary + Line Items ─────────────────────────── */}
      <Page size="A4" style={s.page}>
        {/* Header */}
        <View style={[s.headerBar, { backgroundColor: branding.headerBg }]}>
          <FlagIcon stripes={branding.flagStripes} />
          <View style={s.headerTitleGroup}>
            <Text style={s.headerTitle}>Rapport Fiscal Vert</Text>
            <Text style={s.headerSubtitle}>
              Global Green Tax — {branding.name} {fiscalYear}
            </Text>
          </View>
          <View style={s.headerBadge}>
            <Text style={s.headerBadgeText}>FY {fiscalYear}</Text>
          </View>
        </View>

        {/* Generated date */}
        <Text style={{ fontSize: 8, color: '#999', marginBottom: 16 }}>
          Rapport généré le {generatedAt}
        </Text>

        {/* Params summary */}
        <View style={s.paramsRow}>
          <View style={s.paramBox}>
            <Text style={s.paramLabel}>TYPE</Text>
            <Text style={s.paramValue}>{enterpriseLabel}</Text>
          </View>
          <View style={s.paramBox}>
            <Text style={s.paramLabel}>CHIFFRE D'AFFAIRES</Text>
            <Text style={s.paramValue}>{(params.revenue / 1_000_000).toFixed(1)}M EUR</Text>
          </View>
          <View style={s.paramBox}>
            <Text style={s.paramLabel}>EFFECTIF</Text>
            <Text style={s.paramValue}>{params.employeeCount}</Text>
          </View>
          <View style={s.paramBox}>
            <Text style={s.paramLabel}>CO2</Text>
            <Text style={s.paramValue}>{params.co2Tonnes.toLocaleString()}t</Text>
          </View>
        </View>
        <View style={[s.paramsRow, { marginBottom: 20 }]}>
          <View style={s.paramBox}>
            <Text style={s.paramLabel}>CAPACITÉ PV</Text>
            <Text style={s.paramValue}>{params.solarCapacityKWp} kWp</Text>
          </View>
          <View style={s.paramBox}>
            <Text style={s.paramLabel}>AUTOCONSOMMATION</Text>
            <Text style={s.paramValue}>{(params.selfConsumptionRatio * 100).toFixed(0)}%</Text>
          </View>
        </View>

        {/* Summary Cards */}
        <View style={s.summaryRow}>
          <View style={[s.summaryCard, { borderColor: branding.taxColor + '44', backgroundColor: branding.taxColor + '08' }]}>
            <Text style={s.summaryLabel}>Taxes & Charges</Text>
            <Text style={[s.summaryValue, { color: branding.taxColor }]}>
              {formatEurFull(totalTaxes)}
            </Text>
            <Text style={s.summaryCaption}>{taxes.length} poste(s) fiscal(aux)</Text>
          </View>
          <View style={[s.summaryCard, { borderColor: branding.subsidyColor + '44', backgroundColor: branding.subsidyColor + '08' }]}>
            <Text style={s.summaryLabel}>Subventions & Économies</Text>
            <Text style={[s.summaryValue, { color: branding.subsidyColor }]}>
              {formatEurFull(totalSubsidies)}
            </Text>
            <Text style={s.summaryCaption}>{subsidies.length} aide(s) éligible(s)</Text>
          </View>
          <View style={[
            s.summaryCard,
            {
              borderColor: net >= 0 ? branding.subsidyColor + '66' : branding.taxColor + '66',
              backgroundColor: net >= 0 ? branding.subsidyColor + '10' : branding.taxColor + '10',
            },
          ]}>
            <Text style={s.summaryLabel}>Position Nette</Text>
            <Text style={[s.summaryValue, { color: net >= 0 ? branding.subsidyColor : branding.taxColor }]}>
              {formatEurFull(net)}
            </Text>
            <Text style={s.summaryCaption}>
              {net >= 0 ? 'Gain net' : 'Charge nette'}
            </Text>
          </View>
        </View>

        {/* ─── Line Items Table ──────────────────────────────────── */}
        <View>
          <Text style={[s.sectionTitle, { borderBottomColor: branding.headerBg }]}>
            Détail des postes
          </Text>

          {/* Header */}
          <View style={s.tableHeader}>
            <View style={s.colCode}><Text style={s.tableHeaderText}>Code</Text></View>
            <View style={s.colLabel}><Text style={s.tableHeaderText}>Intitulé</Text></View>
            <View style={s.colDesc}><Text style={s.tableHeaderText}>Description</Text></View>
            <View style={s.colAmount}><Text style={s.tableHeaderText}>Montant</Text></View>
          </View>

          {/* Tax rows */}
          {taxes.map((item, i) => (
            <View key={item.code} style={[s.tableRow, i % 2 === 1 && s.tableRowAlt]}>
              <View style={s.colCode}>
                <Text style={[s.cellText, { color: branding.taxColor }]}>{item.code}</Text>
              </View>
              <View style={s.colLabel}>
                <Text style={s.cellTextBold}>{item.label}</Text>
                {item.legalReference && <Text style={s.cellTextSmall}>{item.legalReference}</Text>}
              </View>
              <View style={s.colDesc}>
                <Text style={s.cellText}>{item.description}</Text>
              </View>
              <View style={s.colAmount}>
                <Text style={[s.cellTextBold, { color: branding.taxColor }]}>
                  {formatEurFull(item.amount)}
                </Text>
              </View>
            </View>
          ))}

          {/* Subtotal taxes */}
          {taxes.length > 0 && (
            <View style={[s.tableRow, { backgroundColor: branding.taxColor + '0A', borderBottomWidth: 1, borderBottomColor: branding.taxColor + '33' }]}>
              <View style={s.colCode} />
              <View style={s.colLabel}><Text style={[s.cellTextBold, { color: branding.taxColor }]}>Sous-total Taxes</Text></View>
              <View style={s.colDesc} />
              <View style={s.colAmount}>
                <Text style={[s.cellTextBold, { color: branding.taxColor, fontSize: 10 }]}>
                  {formatEurFull(totalTaxes)}
                </Text>
              </View>
            </View>
          )}

          {/* Subsidy rows */}
          {subsidies.map((item, i) => (
            <View key={item.code} style={[s.tableRow, i % 2 === 1 && s.tableRowAlt]}>
              <View style={s.colCode}>
                <Text style={[s.cellText, { color: branding.subsidyColor }]}>{item.code}</Text>
              </View>
              <View style={s.colLabel}>
                <Text style={s.cellTextBold}>{item.label}</Text>
                {item.legalReference && <Text style={s.cellTextSmall}>{item.legalReference}</Text>}
              </View>
              <View style={s.colDesc}>
                <Text style={s.cellText}>{item.description}</Text>
              </View>
              <View style={s.colAmount}>
                <Text style={[s.cellTextBold, { color: branding.subsidyColor }]}>
                  {formatEurFull(item.amount)}
                </Text>
              </View>
            </View>
          ))}

          {/* Subtotal subsidies */}
          {subsidies.length > 0 && (
            <View style={[s.tableRow, { backgroundColor: branding.subsidyColor + '0A', borderBottomWidth: 1, borderBottomColor: branding.subsidyColor + '33' }]}>
              <View style={s.colCode} />
              <View style={s.colLabel}><Text style={[s.cellTextBold, { color: branding.subsidyColor }]}>Sous-total Subventions</Text></View>
              <View style={s.colDesc} />
              <View style={s.colAmount}>
                <Text style={[s.cellTextBold, { color: branding.subsidyColor, fontSize: 10 }]}>
                  {formatEurFull(totalSubsidies)}
                </Text>
              </View>
            </View>
          )}

          {/* NET TOTAL */}
          <View style={[s.tableRow, {
            backgroundColor: branding.headerBg + '10',
            borderBottomWidth: 2,
            borderBottomColor: branding.headerBg,
            marginTop: 4,
          }]}>
            <View style={s.colCode} />
            <View style={s.colLabel}>
              <Text style={{ fontSize: 10, fontFamily: 'Helvetica-Bold', color: branding.headerBg }}>
                POSITION NETTE
              </Text>
            </View>
            <View style={s.colDesc} />
            <View style={s.colAmount}>
              <Text style={{
                fontSize: 12,
                fontFamily: 'Helvetica-Bold',
                color: net >= 0 ? branding.subsidyColor : branding.taxColor,
              }}>
                {formatEurFull(net)}
              </Text>
            </View>
          </View>
        </View>

        {/* Footer */}
        <View style={s.footer}>
          <View style={s.footerLine}>
            <Text style={s.footerText}>Global Green Tax — {branding.name} {fiscalYear}</Text>
            <Text style={s.footerText}>Page 1/2</Text>
          </View>
          <Text style={[s.footerText, { marginTop: 3 }]}>{branding.legal}</Text>
        </View>
      </Page>

      {/* ─── PAGE 2: ROI Projection ───────────────────────────────── */}
      <Page size="A4" style={s.page}>
        {/* Mini header */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, paddingBottom: 10, borderBottomWidth: 2, borderBottomColor: branding.headerBg }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <FlagIcon stripes={branding.flagStripes} />
            <Text style={{ fontSize: 14, fontFamily: 'Helvetica-Bold', color: branding.headerBg }}>
              Projection ROI sur 5 ans
            </Text>
          </View>
          <Text style={{ fontSize: 8, color: '#999' }}>
            {branding.name} — FY {fiscalYear}
          </Text>
        </View>

        {/* Methodology note */}
        <View style={{ padding: 10, backgroundColor: '#F0F4FF', borderRadius: 4, marginBottom: 16, borderLeftWidth: 3, borderLeftColor: branding.headerBg }}>
          <Text style={{ fontSize: 8, fontFamily: 'Helvetica-Bold', color: branding.headerBg, marginBottom: 3 }}>
            Méthodologie
          </Text>
          <Text style={{ fontSize: 7, color: '#555', lineHeight: 1.5 }}>
            Subventions ponctuelles (primes PV, bonus VE, aides ADEME) comptabilisées en année 1. Taxes et économies d'énergie projetées à taux constant sur 5 ans. Les montants sont en EUR courants, hors inflation et variation de tarifs.
          </Text>
        </View>

        {/* ROI Table */}
        <View style={s.roiContainer}>
          <Text style={[s.sectionTitle, { borderBottomColor: branding.headerBg }]}>
            Tableau de projection
          </Text>

          {/* Table header */}
          <View style={[s.tableHeader, { marginBottom: 0 }]}>
            <View style={s.roiColYear}><Text style={s.tableHeaderText}>Année</Text></View>
            <View style={s.roiColAnnual}><Text style={[s.tableHeaderText, { textAlign: 'right' }]}>Flux annuel</Text></View>
            <View style={s.roiColCumulative}><Text style={[s.tableHeaderText, { textAlign: 'right' }]}>Cumul</Text></View>
            <View style={s.roiColBar}><Text style={[s.tableHeaderText, { textAlign: 'center' }]}>Tendance</Text></View>
          </View>

          {projection.map((p, i) => {
            const maxAbs = Math.max(...projection.map((r) => Math.abs(r.cumulative)), 1);
            const barPct = Math.abs(p.cumulative) / maxAbs * 100;
            return (
              <View key={i} style={[s.roiRow, i % 2 === 1 && s.tableRowAlt]}>
                <View style={s.roiColYear}>
                  <Text style={s.cellTextBold}>Année {p.year}</Text>
                  <Text style={s.cellTextSmall}>{fiscalYear + p.year - 1}</Text>
                </View>
                <View style={s.roiColAnnual}>
                  <Text style={[s.cellTextBold, {
                    color: p.annual >= 0 ? branding.subsidyColor : branding.taxColor,
                    textAlign: 'right',
                  }]}>
                    {formatEurFull(p.annual)}
                  </Text>
                </View>
                <View style={s.roiColCumulative}>
                  <Text style={[s.cellTextBold, {
                    color: p.cumulative >= 0 ? branding.subsidyColor : branding.taxColor,
                    textAlign: 'right',
                    fontSize: 9,
                  }]}>
                    {formatEurFull(p.cumulative)}
                  </Text>
                </View>
                <View style={s.roiColBar}>
                  <View style={{ height: 10, backgroundColor: '#F0F0F0', borderRadius: 5, overflow: 'hidden', width: '100%' }}>
                    <View style={{
                      height: '100%',
                      width: `${Math.max(barPct, 3)}%`,
                      backgroundColor: p.cumulative >= 0 ? branding.subsidyColor : branding.taxColor,
                      borderRadius: 5,
                      opacity: 0.7,
                    }} />
                  </View>
                </View>
              </View>
            );
          })}

          {/* Summary row */}
          <View style={[s.roiRow, {
            backgroundColor: branding.headerBg + '10',
            borderTopWidth: 2,
            borderTopColor: branding.headerBg,
            marginTop: 2,
          }]}>
            <View style={s.roiColYear}>
              <Text style={{ fontSize: 9, fontFamily: 'Helvetica-Bold', color: branding.headerBg }}>
                Total 5 ans
              </Text>
            </View>
            <View style={s.roiColAnnual} />
            <View style={s.roiColCumulative}>
              <Text style={{
                fontSize: 11,
                fontFamily: 'Helvetica-Bold',
                color: projection[4].cumulative >= 0 ? branding.subsidyColor : branding.taxColor,
                textAlign: 'right',
              }}>
                {formatEurFull(projection[4].cumulative)}
              </Text>
            </View>
            <View style={s.roiColBar} />
          </View>
        </View>

        {/* ROI Chart */}
        <View style={s.chartContainer}>
          <Text style={s.chartTitle}>Graphique ROI — Flux annuel net vs Cumul</Text>
          <RoiChartWithLabels projection={projection} branding={branding} />
          <ChartLegend branding={branding} />
        </View>

        {/* Key insights */}
        <View style={{ marginTop: 16, padding: 12, backgroundColor: '#FAFAFA', borderRadius: 6, borderWidth: 1, borderColor: '#EEE' }}>
          <Text style={{ fontSize: 10, fontFamily: 'Helvetica-Bold', color: '#333', marginBottom: 6 }}>
            Points clés
          </Text>
          <View style={{ gap: 4 }}>
            <Text style={{ fontSize: 8, color: '#555' }}>
              {'\u2022'} Position nette annuelle récurrente: {formatEurFull(projection[1]?.annual ?? 0)} /an
            </Text>
            <Text style={{ fontSize: 8, color: '#555' }}>
              {'\u2022'} Impact cumulé à 5 ans: {formatEurFull(projection[4]?.cumulative ?? 0)}
            </Text>
            {projection[4]?.cumulative > 0 && (
              <Text style={{ fontSize: 8, color: branding.subsidyColor }}>
                {'\u2022'} Retour sur investissement positif sur la période
              </Text>
            )}
            {projection[4]?.cumulative < 0 && (
              <Text style={{ fontSize: 8, color: branding.taxColor }}>
                {'\u2022'} Les charges fiscales excèdent les subventions sur la période — optimisez vos investissements verts
              </Text>
            )}
          </View>
        </View>

        {/* Footer */}
        <View style={s.footer}>
          <View style={s.footerLine}>
            <Text style={s.footerText}>Global Green Tax — {branding.name} {fiscalYear}</Text>
            <Text style={s.footerText}>Page 2/2</Text>
          </View>
          <Text style={[s.footerText, { marginTop: 3 }]}>{branding.legal}</Text>
        </View>
      </Page>
    </Document>
  );
}
