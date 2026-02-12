'use client';

import { useState, useMemo, useCallback } from 'react';
import Link from 'next/link';
import { UserButton } from '@clerk/nextjs';
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
  { code: 'LU' as const, name: 'Luxembourg', flag: 'LU' },
  { code: 'FR' as const, name: 'France', flag: 'FR' },
];

const ENTERPRISE_TYPES = [
  { value: 'SMALL_ENTERPRISE', label: 'Petite entreprise', desc: '< 50 emp., < 10M EUR' },
  { value: 'MEDIUM_ENTERPRISE', label: 'Moyenne entreprise', desc: '< 250 emp., < 50M EUR' },
  { value: 'LARGE_ENTERPRISE', label: 'Grande entreprise', desc: '250+ emp. ou 50M+ EUR' },
] as const;

export default function SimulatePage() {
  // ─── Country selector ──────────────────────────────────────────
  const [countryCode, setCountryCode] = useState<CountryCode>('LU');
  const country = COUNTRIES.find((c) => c.code === countryCode)!;
  const isFR = countryCode === 'FR';
  const isLU = countryCode === 'LU';

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
      wallboxCount: isLU ? wallboxCount : 0,
      wallboxSmartCharging: isLU ? smartCharging : false,
      sustainabilityAuditExpense: auditExpense,
    });
  }, [
    countryCode, co2Tonnes, revenue, employeeCount, enterpriseType,
    solarKWp, selfConsumption,
    evCount, evConsumption, evCountVans,
    wallboxCount, smartCharging,
    auditExpense, isLU,
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
    <div className="min-h-screen bg-background">
      {/* ─── Header ─────────────────────────────────────────────── */}
      <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-3">
          <div className="flex items-center gap-4">
            <Link href="/dashboard" className="text-xl font-semibold text-primary">
              Global Green Tax
            </Link>
            <Badge variant="secondary">{country.name} 2026</Badge>
          </div>
          <div className="flex items-center gap-3">
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
              {exporting ? 'Génération...' : 'Exporter PDF'}
            </Button>
            <UserButton />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-6 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight">Simulation fiscale verte</h1>
          <p className="mt-2 text-muted-foreground">
            Ajustez les paramètres et visualisez instantanément l'impact fiscal de vos investissements verts.
          </p>
        </div>

        <div className="grid gap-8 lg:grid-cols-[1fr_1fr]">
          {/* ─── LEFT: Form ────────────────────────────────────── */}
          <div className="space-y-6">

            {/* Country Selector */}
            <Card className="border-primary/30">
              <CardHeader>
                <CardTitle className="text-lg">Juridiction</CardTitle>
                <CardDescription>Sélectionnez le pays pour la simulation</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-3">
                  {COUNTRIES.map((c) => (
                    <button
                      key={c.code}
                      onClick={() => setCountryCode(c.code)}
                      className={`flex items-center gap-3 rounded-lg border-2 p-4 transition-all ${
                        countryCode === c.code
                          ? 'border-primary bg-primary/5 shadow-sm'
                          : 'border-border hover:border-primary/40 hover:bg-accent/50'
                      }`}
                    >
                      <span className="text-2xl">{c.code === 'LU' ? '\u{1F1F1}\u{1F1FA}' : '\u{1F1EB}\u{1F1F7}'}</span>
                      <div className="text-left">
                        <p className="text-sm font-semibold">{c.name}</p>
                        <p className="text-xs text-muted-foreground">FY 2026</p>
                      </div>
                      {countryCode === c.code && (
                        <svg className="ml-auto h-5 w-5 text-primary" viewBox="0 0 20 20" fill="currentColor">
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
                  label="Nombre d'employés"
                  value={employeeCount}
                  onValueChange={setEmployeeCount}
                  min={1}
                  max={500}
                  step={1}
                  formatValue={(v) => `${v}`}
                />

                {isFR && revenue < 10_000_000 && (
                  <p className="text-xs text-primary">
                    PME: taux réduit IS 15% applicable (premier 42 500 EUR de bénéfice)
                  </p>
                )}
              </CardContent>
            </Card>

            {/* Emissions */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-destructive/10 text-destructive text-xs font-bold">2</span>
                  Émissions CO2
                </CardTitle>
                <CardDescription>
                  {isLU ? 'Taxe CO2 progressive Luxembourg' : 'Contribution Climat Énergie (CCE) à 44,60 EUR/t'}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Slider
                  label="Émissions CO2 (tonnes/an)"
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

            {/* Solar Investment */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-amber-100 text-amber-700 text-xs font-bold">3</span>
                  Investissement Solaire
                </CardTitle>
                <CardDescription>
                  {isLU ? 'Klimabonus Photovoltaïque - PRIMe House' : 'Prime à l\'Autoconsommation PV (dégressive par tranche)'}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                <Slider
                  label="Capacité PV installée"
                  value={solarKWp}
                  onValueChange={setSolarKWp}
                  min={0}
                  max={isFR ? 100 : 30}
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
                {isLU && selfConsumption < 50 && solarKWp > 0 && (
                  <p className="text-xs text-destructive">
                    Minimum 50% d'autoconsommation requis pour le Klimabonus PV
                  </p>
                )}
                {isFR && solarKWp > 0 && (
                  <div className="text-xs text-muted-foreground space-y-1 rounded-md bg-accent/50 p-3">
                    <p className="font-medium">Barème France 2026 :</p>
                    <p>0-9 kWp: 80 EUR/kWp | 9-36 kWp: 140 EUR/kWp | 36-100 kWp: 70 EUR/kWp</p>
                    <p>Surplus injecté: 0,0536 EUR/kWh (tarif EDF OA)</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Mobility */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-blue-100 text-blue-700 text-xs font-bold">4</span>
                  Mobilité Électrique
                </CardTitle>
                <CardDescription>
                  {isLU ? 'PRIMe Car-e – Véhicules et bornes' : 'Bonus Écologique Entreprises – VP et VUL'}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                <Slider
                  label={isFR ? 'Voitures particulières (VP) électriques' : 'Véhicules électriques'}
                  value={evCount}
                  onValueChange={setEvCount}
                  min={0}
                  max={20}
                  step={1}
                  formatValue={(v) => `${v}`}
                />

                {isLU && (
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
                        Au-delà de 18 kWh/100km, aucune prime n'est accordée
                      </p>
                    )}

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

                {isFR && (
                  <>
                    <Slider
                      label="Véhicules utilitaires légers (VUL) électriques"
                      value={evCountVans}
                      onValueChange={setEvCountVans}
                      min={0}
                      max={20}
                      step={1}
                      formatValue={(v) => `${v}`}
                    />
                    <div className="text-xs text-muted-foreground rounded-md bg-accent/50 p-3">
                      <p className="font-medium">Bonus Écologique 2026 :</p>
                      <p>VP électrique: 3 000 EUR | VUL électrique: 4 000 EUR</p>
                      <p>TVA déductible à 100%</p>
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
                  {isLU ? 'Fit 4 Sustainability' : 'ADEME Tremplin'}
                </CardTitle>
                <CardDescription>
                  {isLU
                    ? 'Subvention audit & conseil développement durable'
                    : 'Aide à la transition écologique pour TPE/PME'}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <Label>
                    {isLU ? "Dépenses d'audit/conseil (EUR)" : 'Dépenses de décarbonation (EUR)'}
                  </Label>
                  <Input
                    type="number"
                    value={auditExpense}
                    onChange={(e) => setAuditExpense(Math.max(0, Number(e.target.value)))}
                    min={0}
                    max={200_000}
                    step={1000}
                  />
                  {isLU && (
                    <p className="text-xs text-muted-foreground">
                      Plafond éligible:{' '}
                      {enterpriseType === 'SMALL_ENTERPRISE' && '50 000 EUR (80% remboursé)'}
                      {enterpriseType === 'MEDIUM_ENTERPRISE' && '100 000 EUR (60% remboursé)'}
                      {enterpriseType === 'LARGE_ENTERPRISE' && '200 000 EUR (50% remboursé)'}
                    </p>
                  )}
                  {isFR && (
                    <p className="text-xs text-muted-foreground">
                      {enterpriseType === 'SMALL_ENTERPRISE' && 'TPE/PE: 50% remboursé (max 200 000 EUR)'}
                      {enterpriseType === 'MEDIUM_ENTERPRISE' && 'ME: 30% remboursé (max 200 000 EUR)'}
                      {enterpriseType === 'LARGE_ENTERPRISE' && 'Non éligible: ADEME Tremplin réservé aux PME/TPE'}
                    </p>
                  )}
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
              {exporting ? 'Génération du rapport...' : 'Exporter le rapport PDF'}
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
}
