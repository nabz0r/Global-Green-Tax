'use client';

import { useState, useMemo, useCallback } from 'react';
import { motion } from 'framer-motion';
import { PageTransition } from '@/components/dashboard/page-transition';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ResultCard } from '@/components/result-card';
import { simulateLocally, type SimulationParams, type CountryCode } from '@/lib/engine-client';
import { exportPdf } from '@/lib/pdf/export-pdf';

const COUNTRIES = [
  { code: 'LU' as const, name: 'Luxembourg', flag: '\u{1F1F1}\u{1F1FA}' },
  { code: 'FR' as const, name: 'France', flag: '\u{1F1EB}\u{1F1F7}' },
  { code: 'DE' as const, name: 'Allemagne', flag: '\u{1F1E9}\u{1F1EA}' },
  { code: 'BE' as const, name: 'Belgique', flag: '\u{1F1E7}\u{1F1EA}' },
  { code: 'ES' as const, name: 'Espagne', flag: '\u{1F1EA}\u{1F1F8}' },
  { code: 'PT' as const, name: 'Portugal', flag: '\u{1F1F5}\u{1F1F9}' },
];

const ENTERPRISE_TYPES = [
  { value: 'SMALL_ENTERPRISE', label: 'Petite entreprise', desc: '< 50 emp., < 10M EUR' },
  { value: 'MEDIUM_ENTERPRISE', label: 'Moyenne entreprise', desc: '< 250 emp., < 50M EUR' },
  { value: 'LARGE_ENTERPRISE', label: 'Grande entreprise', desc: '250+ emp. ou 50M+ EUR' },
] as const;

/* Country-specific config for dynamic UI */
const COUNTRY_CONFIG: Record<CountryCode, {
  co2Label: string;
  co2Desc: string;
  solarLabel: string;
  solarDesc: string;
  solarMax: number;
  evLabel: string;
  evDesc: string;
  subsidyLabel: string;
  subsidyDesc: string;
  subsidyHint: (et: string) => string;
  hasCO2: boolean;
  hasWallbox: boolean;
  hasVans: boolean;
  hasEvConsumption: boolean;
}> = {
  LU: {
    co2Label: 'Taxe CO2 progressive Luxembourg',
    co2Desc: '45-120 EUR/t par tranche',
    solarLabel: 'Klimabonus Photovoltaique',
    solarDesc: 'PRIMe House – 800 EUR/kWp (min. 50% autoconsommation)',
    solarMax: 30,
    evLabel: 'PRIMe Car-e',
    evDesc: 'PRIMe Car-e – Vehicules et bornes',
    subsidyLabel: 'Fit 4 Sustainability',
    subsidyDesc: 'Subvention audit & conseil developpement durable',
    subsidyHint: (et) =>
      et === 'SMALL_ENTERPRISE' ? '50 000 EUR (80% rembourse)' :
      et === 'MEDIUM_ENTERPRISE' ? '100 000 EUR (60% rembourse)' :
      '200 000 EUR (50% rembourse)',
    hasCO2: true,
    hasWallbox: true,
    hasVans: false,
    hasEvConsumption: true,
  },
  FR: {
    co2Label: 'Contribution Climat Energie (CCE)',
    co2Desc: '44,60 EUR/t – Art. 265 Code des douanes',
    solarLabel: 'Prime Autoconsommation PV',
    solarDesc: 'Bareme degressif: 80/140/70 EUR/kWp',
    solarMax: 100,
    evLabel: 'Bonus Ecologique',
    evDesc: 'Bonus Ecologique Entreprises – VP et VUL',
    subsidyLabel: 'ADEME Tremplin',
    subsidyDesc: 'Aide transition ecologique pour TPE/PME',
    subsidyHint: (et) =>
      et === 'SMALL_ENTERPRISE' ? 'TPE/PE: 50% rembourse (max 200 000 EUR)' :
      et === 'MEDIUM_ENTERPRISE' ? 'ME: 30% rembourse (max 200 000 EUR)' :
      'Non eligible: ADEME Tremplin reserve aux PME/TPE',
    hasCO2: true,
    hasWallbox: false,
    hasVans: true,
    hasEvConsumption: false,
  },
  DE: {
    co2Label: 'nEHS CO2-Abgabe',
    co2Desc: '65 EUR/t – Brennstoffemissionshandelsgesetz (BEHG)',
    solarLabel: 'KfW 270 Erneuerbare Energien',
    solarDesc: '300 EUR/kWp (max 15 000 EUR)',
    solarMax: 100,
    evLabel: 'Umweltbonus',
    evDesc: 'Umweltbonus – 3 000 EUR par vehicule electrique',
    subsidyLabel: 'BAFA Energieeffizienz',
    subsidyDesc: 'Bundesforderung fur Energieeffizienz',
    subsidyHint: (et) =>
      et === 'LARGE_ENTERPRISE' ? 'Grossunternehmen: 20% (max 100 000 EUR)' :
      'KMU: 35% (max 100 000 EUR)',
    hasCO2: true,
    hasWallbox: false,
    hasVans: false,
    hasEvConsumption: false,
  },
  BE: {
    co2Label: 'ISOC + Deduction investissement',
    co2Desc: 'Deduction verte 27,5% sur investissements PV',
    solarLabel: 'Ecologiepremie Plus',
    solarDesc: '50/30/15% selon taille (Flandre)',
    solarMax: 100,
    evLabel: 'Prime Flotte EV',
    evDesc: 'Fiscalite verte flotte entreprises – 5 000 EUR/vehicule',
    subsidyLabel: 'Aide AMURE (Wallonie)',
    subsidyDesc: '75% depenses audit energetique (max 50 000 EUR)',
    subsidyHint: () => '75% des depenses d\'audit (max 50 000 EUR)',
    hasCO2: false,
    hasWallbox: false,
    hasVans: false,
    hasEvConsumption: false,
  },
  ES: {
    co2Label: 'Impuesto de Sociedades',
    co2Desc: '25% estandar / 23% PYME',
    solarLabel: 'Programa Autoconsumo + IBI',
    solarDesc: 'NextGen 600 EUR/kWp + Bonificacion IBI 50%',
    solarMax: 100,
    evLabel: 'Plan MOVES III',
    evDesc: 'Plan MOVES III – 5 000 EUR par vehicule electrique',
    subsidyLabel: 'Subvenciones verdes',
    subsidyDesc: 'Programa de incentivos espanol',
    subsidyHint: () => 'MOVES III + Autoconsumo',
    hasCO2: false,
    hasWallbox: false,
    hasVans: false,
    hasEvConsumption: false,
  },
  PT: {
    co2Label: 'IRC (Imposto sobre Rendimento)',
    co2Desc: '21% estandar / 17% PME (primeiro 25k EUR)',
    solarLabel: 'Fundo Ambiental + IVA Reduzido',
    solarDesc: '85% max 7 500 EUR + IVA 6% vs 23%',
    solarMax: 100,
    evLabel: 'Incentivo Veiculos Eletricos',
    evDesc: 'Fundo Ambiental VE – 4 000 EUR par vehicule',
    subsidyLabel: 'Apoio Sustentabilidade',
    subsidyDesc: 'Programa Apoio Edificios Mais Sustentaveis',
    subsidyHint: () => '85% des depenses (max 7 500 EUR)',
    hasCO2: false,
    hasWallbox: false,
    hasVans: false,
    hasEvConsumption: false,
  },
};

export default function SimulatePage() {
  // ─── Country selector ──────────────────────────────────────────
  const [countryCode, setCountryCode] = useState<CountryCode>('LU');
  const country = COUNTRIES.find((c) => c.code === countryCode)!;
  const cfg = COUNTRY_CONFIG[countryCode];

  // ─── Form state ────────────────────────────────────────────────
  const [co2Tonnes, setCo2Tonnes] = useState(500);
  const [revenue, setRevenue] = useState(5_000_000);
  const [employeeCount, setEmployeeCount] = useState(30);
  const [enterpriseType, setEnterpriseType] = useState<SimulationParams['enterpriseType']>('SMALL_ENTERPRISE');

  // Solar
  const [solarKWp, setSolarKWp] = useState(15);
  const [selfConsumption, setSelfConsumption] = useState(60);

  // Mobility — shared
  const [evCount, setEvCount] = useState(2);
  const [evConsumption, setEvConsumption] = useState(15);
  // LU-specific
  const [wallboxCount, setWallboxCount] = useState(1);
  const [smartCharging, setSmartCharging] = useState(true);
  // FR-specific
  const [evCountVans, setEvCountVans] = useState(0);

  // Sustainability audit
  const [auditExpense, setAuditExpense] = useState(25_000);

  // ─── Compute results in real-time ──────────────────────────────
  const lineItems = useMemo(() => {
    return simulateLocally({
      countryCode,
      co2Tonnes,
      revenue,
      employeeCount,
      enterpriseType,
      solarCapacityKWp: solarKWp,
      selfConsumptionRatio: selfConsumption / 100,
      evCount,
      evConsumptionKWhPer100km: evConsumption,
      evCountVans,
      wallboxCount: cfg.hasWallbox ? wallboxCount : 0,
      wallboxSmartCharging: cfg.hasWallbox ? smartCharging : false,
      sustainabilityAuditExpense: auditExpense,
    });
  }, [
    countryCode, co2Tonnes, revenue, employeeCount, enterpriseType,
    solarKWp, selfConsumption,
    evCount, evConsumption, evCountVans,
    wallboxCount, smartCharging,
    auditExpense, cfg.hasWallbox,
  ]);

  // ─── PDF export ──────────────────────────────────────────────
  const [exporting, setExporting] = useState(false);

  const handleExportPdf = useCallback(async () => {
    setExporting(true);
    try {
      await exportPdf({
        countryCode,
        fiscalYear: 2026,
        lineItems,
        co2Tonnes,
        revenue,
        employeeCount,
        enterpriseType,
        solarCapacityKWp: solarKWp,
        selfConsumptionRatio: selfConsumption / 100,
      });
    } finally {
      setExporting(false);
    }
  }, [countryCode, lineItems, co2Tonnes, revenue, employeeCount, enterpriseType, solarKWp, selfConsumption]);

  return (
    <PageTransition>
      <div className="p-8 max-w-[1400px] mx-auto">
        {/* ─── Page Header ─────────────────────────────────────── */}
        <div className="mb-8 flex items-end justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Simulation fiscale verte</h1>
            <p className="mt-1 text-muted-foreground">
              Ajustez les parametres et visualisez instantanement l'impact fiscal de vos investissements verts.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Badge variant="secondary" className="text-sm">{country.name} 2026</Badge>
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportPdf}
              disabled={exporting || lineItems.length === 0}
              className="gap-2"
            >
              {exporting ? (
                <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" className="opacity-25" />
                  <path d="M4 12a8 8 0 018-8" className="opacity-75" />
                </svg>
              ) : (
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                  <line x1="12" y1="18" x2="12" y2="12" />
                  <polyline points="9 15 12 18 15 15" />
                </svg>
              )}
              {exporting ? 'Generation...' : 'Exporter PDF'}
            </Button>
          </div>
        </div>

        <div className="grid gap-8 lg:grid-cols-[1fr_1fr]">
          {/* ─── LEFT: Form ────────────────────────────────────── */}
          <div className="space-y-6">

            {/* Country Selector */}
            <Card className="border-primary/30">
              <CardHeader>
                <CardTitle className="text-lg">Juridiction</CardTitle>
                <CardDescription>Selectionnez le pays pour la simulation</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-3">
                  {COUNTRIES.map((c) => (
                    <button
                      key={c.code}
                      onClick={() => setCountryCode(c.code)}
                      className={`flex items-center gap-2 rounded-lg border-2 p-3 transition-all ${
                        countryCode === c.code
                          ? 'border-primary bg-primary/5 shadow-sm'
                          : 'border-border hover:border-primary/40 hover:bg-accent/50'
                      }`}
                    >
                      <span className="text-xl">{c.flag}</span>
                      <div className="text-left">
                        <p className="text-xs font-semibold">{c.name}</p>
                        <p className="text-[10px] text-muted-foreground">FY 2026</p>
                      </div>
                      {countryCode === c.code && (
                        <svg className="ml-auto h-4 w-4 text-primary" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      )}
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Enterprise Profile */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-bold">1</span>
                  Profil de l'entreprise
                </CardTitle>
                <CardDescription>Informations de base de votre organisation</CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="space-y-2">
                  <Label>Type d'entreprise</Label>
                  <Select value={enterpriseType} onValueChange={(v) => setEnterpriseType(v as SimulationParams['enterpriseType'])}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ENTERPRISE_TYPES.map((t) => (
                        <SelectItem key={t.value} value={t.value}>
                          {t.label} ({t.desc})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <Slider
                  label="Chiffre d'affaires annuel"
                  value={revenue}
                  onValueChange={setRevenue}
                  min={100_000}
                  max={100_000_000}
                  step={100_000}
                  formatValue={(v) => `${(v / 1_000_000).toFixed(1)}M EUR`}
                />

                <Slider
                  label="Nombre d'employes"
                  value={employeeCount}
                  onValueChange={setEmployeeCount}
                  min={1}
                  max={500}
                  step={1}
                  formatValue={(v) => `${v}`}
                />
              </CardContent>
            </Card>

            {/* Emissions */}
            {cfg.hasCO2 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-destructive/10 text-destructive text-xs font-bold">2</span>
                    Emissions CO2
                  </CardTitle>
                  <CardDescription>{cfg.co2Desc}</CardDescription>
                </CardHeader>
                <CardContent>
                  <Slider
                    label="Emissions CO2 (tonnes/an)"
                    value={co2Tonnes}
                    onValueChange={setCo2Tonnes}
                    min={0}
                    max={50_000}
                    step={50}
                    formatValue={(v) => `${v.toLocaleString()}t`}
                  />
                  <div className="mt-3 flex gap-2">
                    {[100, 500, 2000, 10000].map((v) => (
                      <Button
                        key={v}
                        variant={co2Tonnes === v ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setCo2Tonnes(v)}
                      >
                        {v >= 1000 ? `${v / 1000}k` : v}t
                      </Button>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Solar Investment */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-amber-100 text-amber-700 text-xs font-bold">3</span>
                  Investissement Solaire
                </CardTitle>
                <CardDescription>{cfg.solarDesc}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                <Slider
                  label="Capacite PV installee"
                  value={solarKWp}
                  onValueChange={setSolarKWp}
                  min={0}
                  max={cfg.solarMax}
                  step={1}
                  formatValue={(v) => `${v} kWp`}
                />
                <Slider
                  label="Taux d'autoconsommation"
                  value={selfConsumption}
                  onValueChange={setSelfConsumption}
                  min={0}
                  max={100}
                  step={5}
                  formatValue={(v) => `${v}%`}
                />
                {countryCode === 'LU' && selfConsumption < 50 && solarKWp > 0 && (
                  <p className="text-xs text-destructive">
                    Minimum 50% d'autoconsommation requis pour le Klimabonus PV
                  </p>
                )}
                {countryCode === 'FR' && solarKWp > 0 && (
                  <div className="text-xs text-muted-foreground space-y-1 rounded-md bg-accent/50 p-3">
                    <p className="font-medium">Bareme France 2026 :</p>
                    <p>0-9 kWp: 80 EUR/kWp | 9-36 kWp: 140 EUR/kWp | 36-100 kWp: 70 EUR/kWp</p>
                    <p>Surplus injecte: 0,0536 EUR/kWh (tarif EDF OA)</p>
                  </div>
                )}
                {countryCode === 'DE' && solarKWp > 0 && (
                  <div className="text-xs text-muted-foreground space-y-1 rounded-md bg-accent/50 p-3">
                    <p className="font-medium">KfW 270 :</p>
                    <p>300 EUR/kWp (max 15 000 EUR) + Einspeisevergutung 0,082 EUR/kWh</p>
                  </div>
                )}
                {countryCode === 'BE' && solarKWp > 0 && (
                  <div className="text-xs text-muted-foreground space-y-1 rounded-md bg-accent/50 p-3">
                    <p className="font-medium">Belgique :</p>
                    <p>Ecologiepremie: 50/30/15% + Deduction investissement vert 27,5%</p>
                  </div>
                )}
                {countryCode === 'ES' && solarKWp > 0 && (
                  <div className="text-xs text-muted-foreground space-y-1 rounded-md bg-accent/50 p-3">
                    <p className="font-medium">Espagne :</p>
                    <p>Autoconsumo: 600 EUR/kWp (max 12 000 EUR) + IBI -50% + 1 500 kWh/kWp</p>
                  </div>
                )}
                {countryCode === 'PT' && solarKWp > 0 && (
                  <div className="text-xs text-muted-foreground space-y-1 rounded-md bg-accent/50 p-3">
                    <p className="font-medium">Portugal :</p>
                    <p>Fundo Ambiental: 85% (max 7 500 EUR) + IVA 6% vs 23% + 1 500 kWh/kWp</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Mobility */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-blue-100 text-blue-700 text-xs font-bold">4</span>
                  Mobilite Electrique
                </CardTitle>
                <CardDescription>{cfg.evDesc}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                <Slider
                  label={cfg.hasVans ? 'Voitures particulieres (VP) electriques' : 'Vehicules electriques'}
                  value={evCount}
                  onValueChange={setEvCount}
                  min={0}
                  max={20}
                  step={1}
                  formatValue={(v) => `${v}`}
                />

                {cfg.hasEvConsumption && (
                  <>
                    <Slider
                      label="Consommation EV"
                      value={evConsumption}
                      onValueChange={setEvConsumption}
                      min={10}
                      max={25}
                      step={0.5}
                      formatValue={(v) => `${v} kWh/100km`}
                    />
                    {evConsumption > 18 && evCount > 0 && (
                      <p className="text-xs text-destructive">
                        Au-dela de 18 kWh/100km, aucune prime n'est accordee
                      </p>
                    )}
                  </>
                )}

                {cfg.hasWallbox && (
                  <>
                    <Separator />

                    <Slider
                      label="Bornes de recharge (Wallbox)"
                      value={wallboxCount}
                      onValueChange={setWallboxCount}
                      min={0}
                      max={10}
                      step={1}
                      formatValue={(v) => `${v}`}
                    />
                    <div className="flex items-center justify-between">
                      <div>
                        <Label>Smart Charging</Label>
                        <p className="text-xs text-muted-foreground">
                          Bonus +450 EUR par borne
                        </p>
                      </div>
                      <Switch checked={smartCharging} onCheckedChange={setSmartCharging} />
                    </div>
                  </>
                )}

                {cfg.hasVans && (
                  <>
                    <Slider
                      label="Vehicules utilitaires legers (VUL) electriques"
                      value={evCountVans}
                      onValueChange={setEvCountVans}
                      min={0}
                      max={20}
                      step={1}
                      formatValue={(v) => `${v}`}
                    />
                    <div className="text-xs text-muted-foreground rounded-md bg-accent/50 p-3">
                      <p className="font-medium">Bonus Ecologique 2026 :</p>
                      <p>VP electrique: 3 000 EUR | VUL electrique: 4 000 EUR</p>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            {/* Sustainability Subsidy */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-bold">5</span>
                  {cfg.subsidyLabel}
                </CardTitle>
                <CardDescription>{cfg.subsidyDesc}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <Label>Depenses audit/conseil (EUR)</Label>
                  <Input
                    type="number"
                    value={auditExpense}
                    onChange={(e) => setAuditExpense(Math.max(0, Number(e.target.value)))}
                    min={0}
                    max={200_000}
                    step={1000}
                  />
                  <p className="text-xs text-muted-foreground">
                    {cfg.subsidyHint(enterpriseType)}
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* ─── RIGHT: Results ─────────────────────────────────── */}
          <div className="lg:sticky lg:top-20 lg:self-start space-y-6">
            <ResultCard lineItems={lineItems} />

            {/* Export PDF button (secondary placement) */}
            <Button
              className="w-full gap-2"
              size="lg"
              onClick={handleExportPdf}
              disabled={exporting || lineItems.length === 0}
            >
              {exporting ? (
                <svg className="h-5 w-5 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" className="opacity-25" />
                  <path d="M4 12a8 8 0 018-8" className="opacity-75" />
                </svg>
              ) : (
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                  <line x1="12" y1="18" x2="12" y2="12" />
                  <polyline points="9 15 12 18 15 15" />
                </svg>
              )}
              {exporting ? 'Generation du rapport...' : 'Exporter le rapport PDF'}
            </Button>
          </div>
        </div>
      </div>
    </PageTransition>
  );
}
