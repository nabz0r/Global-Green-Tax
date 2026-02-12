'use client';

import { useState, useMemo } from 'react';
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
import { simulateLocally, type SimulationParams } from '@/lib/engine-client';

const ENTERPRISE_TYPES = [
  { value: 'SMALL_ENTERPRISE', label: 'Petite entreprise', desc: '< 50 emp., < 10M EUR' },
  { value: 'MEDIUM_ENTERPRISE', label: 'Moyenne entreprise', desc: '< 250 emp., < 50M EUR' },
  { value: 'LARGE_ENTERPRISE', label: 'Grande entreprise', desc: '250+ emp. ou 50M+ EUR' },
] as const;

export default function SimulatePage() {
  // ─── Form state ─────────────────────────────────────────────
  const [co2Tonnes, setCo2Tonnes] = useState(500);
  const [revenue, setRevenue] = useState(5_000_000);
  const [employeeCount, setEmployeeCount] = useState(30);
  const [enterpriseType, setEnterpriseType] = useState<SimulationParams['enterpriseType']>('SMALL_ENTERPRISE');

  // Solar
  const [solarKWp, setSolarKWp] = useState(15);
  const [selfConsumption, setSelfConsumption] = useState(60);

  // Mobility
  const [evCount, setEvCount] = useState(2);
  const [evConsumption, setEvConsumption] = useState(15);
  const [wallboxCount, setWallboxCount] = useState(1);
  const [smartCharging, setSmartCharging] = useState(true);

  // Fit 4 Sustainability
  const [auditExpense, setAuditExpense] = useState(25_000);

  // ─── Compute results in real-time ──────────────────────────
  const lineItems = useMemo(() => {
    return simulateLocally({
      co2Tonnes,
      revenue,
      employeeCount,
      enterpriseType,
      solarCapacityKWp: solarKWp,
      selfConsumptionRatio: selfConsumption / 100,
      evCount,
      evConsumptionKWhPer100km: evConsumption,
      wallboxCount,
      wallboxSmartCharging: smartCharging,
      sustainabilityAuditExpense: auditExpense,
    });
  }, [
    co2Tonnes, revenue, employeeCount, enterpriseType,
    solarKWp, selfConsumption,
    evCount, evConsumption, wallboxCount, smartCharging,
    auditExpense,
  ]);

  return (
    <div className="min-h-screen bg-background">
      {/* ─── Header ─────────────────────────────────────────────── */}
      <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-3">
          <div className="flex items-center gap-4">
            <Link href="/dashboard" className="text-xl font-semibold text-primary">
              Global Green Tax
            </Link>
            <Badge variant="secondary">Luxembourg 2026</Badge>
          </div>
          <UserButton />
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
              </CardContent>
            </Card>

            {/* Emissions */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-destructive/10 text-destructive text-xs font-bold">2</span>
                  Émissions CO2
                </CardTitle>
                <CardDescription>Volume annuel d'émissions en tonnes</CardDescription>
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
                <CardDescription>Klimabonus Photovoltaïque - PRIMe House</CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                <Slider
                  label="Capacité PV installée"
                  value={solarKWp}
                  onValueChange={setSolarKWp}
                  min={0}
                  max={30}
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
                {selfConsumption < 50 && solarKWp > 0 && (
                  <p className="text-xs text-destructive">
                    Minimum 50% d'autoconsommation requis pour le Klimabonus PV
                  </p>
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
                <CardDescription>PRIMe Car-e - Véhicules et bornes</CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                <Slider
                  label="Véhicules électriques"
                  value={evCount}
                  onValueChange={setEvCount}
                  min={0}
                  max={20}
                  step={1}
                  formatValue={(v) => `${v}`}
                />
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
              </CardContent>
            </Card>

            {/* Fit 4 Sustainability */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-bold">5</span>
                  Fit 4 Sustainability
                </CardTitle>
                <CardDescription>Subvention audit & conseil développement durable</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <Label>Dépenses d'audit/conseil (EUR)</Label>
                  <Input
                    type="number"
                    value={auditExpense}
                    onChange={(e) => setAuditExpense(Math.max(0, Number(e.target.value)))}
                    min={0}
                    max={200_000}
                    step={1000}
                  />
                  <p className="text-xs text-muted-foreground">
                    Plafond éligible:{' '}
                    {enterpriseType === 'SMALL_ENTERPRISE' && '50 000 EUR (80% remboursé)'}
                    {enterpriseType === 'MEDIUM_ENTERPRISE' && '100 000 EUR (60% remboursé)'}
                    {enterpriseType === 'LARGE_ENTERPRISE' && '200 000 EUR (50% remboursé)'}
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* ─── RIGHT: Results ─────────────────────────────────── */}
          <div className="lg:sticky lg:top-20 lg:self-start space-y-6">
            <ResultCard lineItems={lineItems} />
          </div>
        </div>
      </main>
    </div>
  );
}
