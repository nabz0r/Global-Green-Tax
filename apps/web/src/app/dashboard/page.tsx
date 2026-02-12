'use client';

import { useState, useMemo, useEffect } from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';
import { motion } from 'framer-motion';
import { PageTransition } from '@/components/dashboard/page-transition';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { SkeletonCard, SkeletonChart } from '@/components/ui/skeleton';
import { simulateLocally, type CountryCode } from '@/lib/engine-client';
import Link from 'next/link';

/* KPI Card animation */
const cardVariants = {
  hidden: { opacity: 0, y: 20, scale: 0.97 },
  visible: (i: number) => ({
    opacity: 1, y: 0, scale: 1,
    transition: { delay: i * 0.08, duration: 0.35, ease: 'easeOut' },
  }),
};

function formatEur(n: number) {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n);
}

/* Default simulation params for overview (LU demo) */
const DEMO_PARAMS = {
  countryCode: 'LU' as CountryCode,
  co2Tonnes: 1200,
  revenue: 8_000_000,
  employeeCount: 45,
  enterpriseType: 'SMALL_ENTERPRISE' as const,
  solarCapacityKWp: 20,
  selfConsumptionRatio: 0.60,
  evCount: 3,
  evConsumptionKWhPer100km: 15,
  evCountVans: 0,
  wallboxCount: 2,
  wallboxSmartCharging: true,
  sustainabilityAuditExpense: 30_000,
};

/* Donut chart colors */
const DONUT_COLORS = [
  'hsl(160, 84%, 39%)',
  'hsl(189, 94%, 43%)',
  'hsl(38, 92%, 50%)',
  'hsl(263, 70%, 50%)',
  'hsl(173, 80%, 40%)',
];

export default function OverviewPage() {
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const t = setTimeout(() => setLoading(false), 800);
    return () => clearTimeout(t);
  }, []);

  const lineItems = useMemo(() => simulateLocally(DEMO_PARAMS), []);

  const taxes = lineItems.filter((i) => i.amount < 0);
  const subsidies = lineItems.filter((i) => i.amount > 0);
  const totalTaxes = taxes.reduce((s, i) => s + i.amount, 0);
  const totalSubsidies = subsidies.reduce((s, i) => s + i.amount, 0);
  const netAmount = totalTaxes + totalSubsidies;

  /* 10-year ROI projection */
  const roiData = useMemo(() => {
    const oneTimeSubs = subsidies.filter((i) =>
      !i.code.includes('ENERGY') && !i.code.includes('IBI'),
    );
    const recurringSubs = subsidies.filter((i) =>
      i.code.includes('ENERGY') || i.code.includes('IBI'),
    );
    const oneTimeTotal = oneTimeSubs.reduce((s, i) => s + i.amount, 0);
    const recurringAnnual = recurringSubs.reduce((s, i) => s + i.amount, 0);
    const annualTax = totalTaxes;

    return Array.from({ length: 11 }, (_, year) => {
      const cumSubsidies = oneTimeTotal + recurringAnnual * year;
      const cumTaxes = Math.abs(annualTax) * year;
      const cumNet = cumSubsidies - cumTaxes;
      return {
        year: `Y${year}`,
        Subventions: Math.round(cumSubsidies),
        Taxes: Math.round(cumTaxes),
        'ROI Net': Math.round(cumNet),
      };
    });
  }, [subsidies, totalTaxes]);

  /* Donut data: group subsidies by category */
  const donutData = useMemo(() => {
    const categories: Record<string, number> = {};
    for (const item of subsidies) {
      let cat = 'Autre';
      if (item.code.includes('PV') || item.code.includes('KB-PV') || item.code.includes('SOLAR') || item.code.includes('KFW') || item.code.includes('NEXTGEN') || item.code.includes('FA-EDIF') || item.code.includes('IVA')) {
        cat = 'Solaire';
      } else if (item.code.includes('EV') || item.code.includes('UMWELT') || item.code.includes('MOVES') || item.code.includes('WALLBOX') || item.code.includes('BONUS-ECO') || item.code.includes('FLEET') || item.code.includes('FA-VE')) {
        cat = 'Mobilite';
      } else if (item.code.includes('F4S') || item.code.includes('ADEME') || item.code.includes('BAFA') || item.code.includes('AMURE') || item.code.includes('ECOPREMIE')) {
        cat = 'Audit & Efficacite';
      } else if (item.code.includes('ENERGY') || item.code.includes('IBI')) {
        cat = 'Economies energie';
      } else if (item.code.includes('INVEST-DEDUCT')) {
        cat = 'Deduction fiscale';
      }
      categories[cat] = (categories[cat] ?? 0) + item.amount;
    }
    return Object.entries(categories).map(([name, value]) => ({ name, value: Math.round(value) }));
  }, [subsidies]);

  /* KPIs */
  const kpis = [
    { label: 'Position Nette', value: formatEur(netAmount), delta: netAmount >= 0 ? '+' : '', color: netAmount >= 0 ? 'text-primary' : 'text-destructive', bgColor: netAmount >= 0 ? 'border-primary/20 bg-primary/5' : 'border-destructive/20 bg-destructive/5' },
    { label: 'Subventions totales', value: formatEur(totalSubsidies), delta: '+', color: 'text-primary', bgColor: 'border-primary/20 bg-primary/5' },
    { label: 'Charges fiscales', value: formatEur(Math.abs(totalTaxes)), delta: '-', color: 'text-destructive', bgColor: 'border-destructive/20 bg-destructive/5' },
    { label: 'Postes eligibles', value: `${subsidies.length}`, delta: '', color: 'text-chart-cyan', bgColor: 'border-chart-cyan/20 bg-chart-cyan/5' },
  ];

  /* Recent activity mock */
  const recentActivity = [
    { country: 'LU', label: 'Simulation Luxembourg 2026', date: '12 Fev 2026', net: -16_000 },
    { country: 'FR', label: 'Simulation France 2026', date: '10 Fev 2026', net: -16_420 },
    { country: 'DE', label: 'Simulation Allemagne 2026', date: '08 Fev 2026', net: -72_000 },
    { country: 'BE', label: 'Simulation Belgique 2026', date: '05 Fev 2026', net: 67_500 },
  ];

  return (
    <PageTransition>
      <div className="p-8 space-y-8 max-w-[1400px] mx-auto">
        {/* Header */}
        <div className="flex items-end justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">
              Tableau de bord
            </h1>
            <p className="mt-1 text-muted-foreground">
              Vue d'ensemble de votre position fiscale verte
            </p>
          </div>
          <Link href="/dashboard/simulate">
            <Button className="gap-2 glow-primary">
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
              </svg>
              Nouvelle simulation
            </Button>
          </Link>
        </div>

        {/* KPI Cards */}
        {loading ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {[...Array(4)].map((_, i) => <SkeletonCard key={i} />)}
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {kpis.map((kpi, i) => (
              <motion.div
                key={kpi.label}
                custom={i}
                variants={cardVariants}
                initial="hidden"
                animate="visible"
              >
                <Card className={`${kpi.bgColor} transition-shadow hover:shadow-md`}>
                  <CardHeader className="pb-2">
                    <CardDescription className="text-xs uppercase tracking-wider font-medium">
                      {kpi.label}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <p className={`text-2xl font-bold tabular-nums ${kpi.color}`}>
                      {kpi.delta}{kpi.value}
                    </p>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        )}

        {/* Charts Row */}
        <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
          {/* 10-Year ROI Area Chart */}
          {loading ? (
            <SkeletonChart />
          ) : (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3, duration: 0.4 }}>
              <Card className="glass-card">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>ROI cumule sur 10 ans</CardTitle>
                      <CardDescription>Projection subventions vs charges fiscales</CardDescription>
                    </div>
                    <Badge variant="outline" className="text-xs">Luxembourg 2026</Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={320}>
                    <AreaChart data={roiData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                      <defs>
                        <linearGradient id="gradSub" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="hsl(160, 84%, 39%)" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="hsl(160, 84%, 39%)" stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="gradTax" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="hsl(0, 72%, 51%)" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="hsl(0, 72%, 51%)" stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="gradNet" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="hsl(189, 94%, 43%)" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="hsl(189, 94%, 43%)" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(215, 20%, 25%)" strokeOpacity={0.3} />
                      <XAxis dataKey="year" tick={{ fontSize: 12 }} stroke="hsl(215, 10%, 46%)" />
                      <YAxis tick={{ fontSize: 11 }} stroke="hsl(215, 10%, 46%)" tickFormatter={(v: number) => `${(v / 1000).toFixed(0)}k`} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: 'hsl(215, 25%, 10%)',
                          border: '1px solid hsl(215, 20%, 18%)',
                          borderRadius: '8px',
                          color: 'hsl(210, 15%, 93%)',
                          fontSize: '12px',
                        }}
                        formatter={(value: number) => formatEur(value)}
                      />
                      <Area type="monotone" dataKey="Subventions" stroke="hsl(160, 84%, 39%)" fill="url(#gradSub)" strokeWidth={2} />
                      <Area type="monotone" dataKey="Taxes" stroke="hsl(0, 72%, 51%)" fill="url(#gradTax)" strokeWidth={2} />
                      <Area type="monotone" dataKey="ROI Net" stroke="hsl(189, 94%, 43%)" fill="url(#gradNet)" strokeWidth={2.5} strokeDasharray="6 3" />
                    </AreaChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* Donut Chart */}
          {loading ? (
            <SkeletonChart />
          ) : (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4, duration: 0.4 }}>
              <Card className="glass-card">
                <CardHeader>
                  <CardTitle>Repartition des aides</CardTitle>
                  <CardDescription>Par categorie d'investissement vert</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={320}>
                    <PieChart>
                      <Pie
                        data={donutData}
                        cx="50%"
                        cy="45%"
                        innerRadius={60}
                        outerRadius={100}
                        paddingAngle={3}
                        dataKey="value"
                        stroke="none"
                      >
                        {donutData.map((_, idx) => (
                          <Cell key={idx} fill={DONUT_COLORS[idx % DONUT_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          backgroundColor: 'hsl(215, 25%, 10%)',
                          border: '1px solid hsl(215, 20%, 18%)',
                          borderRadius: '8px',
                          color: 'hsl(210, 15%, 93%)',
                          fontSize: '12px',
                        }}
                        formatter={(value: number) => formatEur(value)}
                      />
                      <Legend
                        verticalAlign="bottom"
                        iconType="circle"
                        iconSize={8}
                        wrapperStyle={{ fontSize: '11px', paddingTop: '16px' }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </motion.div>
          )}
        </div>

        {/* Recent Activity */}
        {!loading && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5, duration: 0.4 }}>
            <Card className="glass-card">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Activite recente</CardTitle>
                    <CardDescription>Dernieres simulations effectuees</CardDescription>
                  </div>
                  <Link href="/dashboard/simulate">
                    <Button variant="outline" size="sm">Voir tout</Button>
                  </Link>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-1">
                  {recentActivity.map((act, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.6 + i * 0.05 }}
                      className="flex items-center justify-between rounded-lg px-4 py-3 transition-colors hover:bg-accent/50"
                    >
                      <div className="flex items-center gap-3">
                        <Badge variant="outline" className="text-xs font-mono w-8 justify-center">
                          {act.country}
                        </Badge>
                        <div>
                          <p className="text-sm font-medium">{act.label}</p>
                          <p className="text-xs text-muted-foreground">{act.date}</p>
                        </div>
                      </div>
                      <span className={`text-sm font-mono font-semibold tabular-nums ${act.net >= 0 ? 'text-primary' : 'text-destructive'}`}>
                        {act.net >= 0 ? '+' : ''}{formatEur(act.net)}
                      </span>
                    </motion.div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Country coverage */}
        {!loading && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.7 }}>
            <Card className="glass-card">
              <CardHeader>
                <CardTitle>Couverture juridictionnelle</CardTitle>
                <CardDescription>6 pays actifs avec moteurs de calcul complets</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                  {[
                    { code: 'LU', name: 'Luxembourg', flag: '\u{1F1F1}\u{1F1FA}', modules: 6 },
                    { code: 'FR', name: 'France', flag: '\u{1F1EB}\u{1F1F7}', modules: 6 },
                    { code: 'DE', name: 'Allemagne', flag: '\u{1F1E9}\u{1F1EA}', modules: 6 },
                    { code: 'BE', name: 'Belgique', flag: '\u{1F1E7}\u{1F1EA}', modules: 5 },
                    { code: 'ES', name: 'Espagne', flag: '\u{1F1EA}\u{1F1F8}', modules: 5 },
                    { code: 'PT', name: 'Portugal', flag: '\u{1F1F5}\u{1F1F9}', modules: 5 },
                  ].map((c) => (
                    <div
                      key={c.code}
                      className="flex flex-col items-center gap-2 rounded-lg border border-border bg-card p-4 text-center transition-all hover:border-primary/40 hover:shadow-sm"
                    >
                      <span className="text-2xl">{c.flag}</span>
                      <p className="text-xs font-semibold">{c.name}</p>
                      <Badge variant="secondary" className="text-[10px]">
                        {c.modules} modules
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </div>
    </PageTransition>
  );
}
