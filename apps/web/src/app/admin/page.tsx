'use client';

import { useState, useEffect } from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
} from 'recharts';

interface AdminSummary {
  totalUsers: number;
  totalOrganizations: number;
  totalSimulations: number;
  totalAnalyticsEntries: number;
  usersByPlan: { planName: string; count: number }[];
  estimatedMRR: number;
  simulationsLast30Days: number;
  topCountries: { countryCode: string; count: number }[];
  topInvestmentTypes: { investmentType: string; count: number; totalGrant: number }[];
  simulationTrend: { date: string; count: number }[];
}

const COUNTRY_FLAGS: Record<string, string> = {
  LU: 'LU', FR: 'FR', DE: 'DE', BE: 'BE', ES: 'ES', PT: 'PT',
};

const PLAN_COLORS: Record<string, string> = {
  FREEMIUM: 'hsl(var(--chart-rose))',
  STARTER: 'hsl(var(--chart-amber))',
  PROFESSIONAL: 'hsl(var(--chart-emerald))',
  ENTERPRISE: 'hsl(var(--chart-cyan))',
};

const INVESTMENT_COLORS = [
  'hsl(var(--chart-emerald))',
  'hsl(var(--chart-teal))',
  'hsl(var(--chart-cyan))',
  'hsl(var(--chart-amber))',
  'hsl(var(--chart-violet))',
];

// Demo data for when API is not available
const DEMO_DATA: AdminSummary = {
  totalUsers: 47,
  totalOrganizations: 12,
  totalSimulations: 384,
  totalAnalyticsEntries: 1_247,
  usersByPlan: [
    { planName: 'FREEMIUM', count: 4 },
    { planName: 'STARTER', count: 5 },
    { planName: 'PROFESSIONAL', count: 2 },
    { planName: 'ENTERPRISE', count: 1 },
  ],
  estimatedMRR: 149_500, // cents
  simulationsLast30Days: 89,
  topCountries: [
    { countryCode: 'FR', count: 142 },
    { countryCode: 'DE', count: 98 },
    { countryCode: 'LU', count: 67 },
    { countryCode: 'ES', count: 43 },
    { countryCode: 'BE', count: 21 },
    { countryCode: 'PT', count: 13 },
  ],
  topInvestmentTypes: [
    { investmentType: 'SOLAR', count: 312, totalGrant: 2_450_000 },
    { investmentType: 'EV', count: 198, totalGrant: 1_120_000 },
    { investmentType: 'AUDIT', count: 87, totalGrant: 640_000 },
    { investmentType: 'ENERGY_EFFICIENCY', count: 156, totalGrant: 890_000 },
  ],
  simulationTrend: Array.from({ length: 30 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (29 - i));
    return {
      date: d.toISOString().slice(0, 10),
      count: Math.floor(Math.random() * 8) + 1,
    };
  }),
};

function StatCard({ label, value, sub, color }: { label: string; value: string; sub?: string; color: string }) {
  return (
    <div className="glass-card rounded-xl p-5 border border-border/50">
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{label}</p>
      <p className={`mt-2 text-3xl font-bold ${color}`}>{value}</p>
      {sub && <p className="mt-1 text-xs text-muted-foreground">{sub}</p>}
    </div>
  );
}

export default function AdminDashboardPage() {
  const [data, setData] = useState<AdminSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Try to fetch from API, fallback to demo data
    async function load() {
      try {
        const res = await fetch('/api/admin/analytics/summary');
        if (res.ok) {
          setData(await res.json());
        } else {
          setData(DEMO_DATA);
        }
      } catch {
        setData(DEMO_DATA);
      } finally {
        setLoading(false);
      }
    }
    const timer = setTimeout(load, 500);
    return () => clearTimeout(timer);
  }, []);

  if (loading || !data) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Admin Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-1">Vue d&apos;ensemble de la plateforme</p>
        </div>
        <div className="grid grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="glass-card rounded-xl p-5 border border-border/50 animate-pulse">
              <div className="h-3 w-20 rounded bg-muted" />
              <div className="mt-3 h-8 w-24 rounded bg-muted" />
            </div>
          ))}
        </div>
        <div className="glass-card rounded-xl p-6 border border-border/50 h-80 animate-pulse" />
      </div>
    );
  }

  const mrrEuro = (data.estimatedMRR / 100).toLocaleString('fr-FR', { minimumFractionDigits: 0 });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Admin Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-1">Vue d&apos;ensemble de la plateforme Global Green Tax</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="MRR Estim&eacute;"
          value={`${mrrEuro} \u20AC`}
          sub={`${data.totalOrganizations} organisations actives`}
          color="text-emerald-500"
        />
        <StatCard
          label="Utilisateurs"
          value={String(data.totalUsers)}
          sub={`${data.usersByPlan.length} plans actifs`}
          color="text-cyan-500"
        />
        <StatCard
          label="Simulations (30j)"
          value={String(data.simulationsLast30Days)}
          sub={`${data.totalSimulations} total`}
          color="text-amber-500"
        />
        <StatCard
          label="Data Lake"
          value={data.totalAnalyticsEntries.toLocaleString('fr-FR')}
          sub="enregistrements analytiques"
          color="text-violet-500"
        />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Simulation Trend */}
        <div className="lg:col-span-2 glass-card rounded-xl p-5 border border-border/50">
          <h3 className="text-sm font-semibold mb-4">Tendance des simulations (30 jours)</h3>
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={data.simulationTrend}>
              <defs>
                <linearGradient id="adminGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(160, 84%, 39%)" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="hsl(160, 84%, 39%)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis
                dataKey="date"
                tickFormatter={(v) => v.slice(8)}
                tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
                stroke="hsl(var(--border))"
              />
              <YAxis
                tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
                stroke="hsl(var(--border))"
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'hsl(var(--card))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px',
                  fontSize: '12px',
                }}
              />
              <Area
                type="monotone"
                dataKey="count"
                stroke="hsl(160, 84%, 39%)"
                strokeWidth={2}
                fill="url(#adminGrad)"
                name="Simulations"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Users by Plan - Pie */}
        <div className="glass-card rounded-xl p-5 border border-border/50">
          <h3 className="text-sm font-semibold mb-4">Organisations par plan</h3>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie
                data={data.usersByPlan}
                cx="50%"
                cy="50%"
                innerRadius={50}
                outerRadius={80}
                paddingAngle={3}
                dataKey="count"
                nameKey="planName"
              >
                {data.usersByPlan.map((entry) => (
                  <Cell
                    key={entry.planName}
                    fill={PLAN_COLORS[entry.planName] ?? 'hsl(var(--muted))'}
                  />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  backgroundColor: 'hsl(var(--card))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px',
                  fontSize: '12px',
                }}
              />
            </PieChart>
          </ResponsiveContainer>
          <div className="flex flex-wrap gap-3 justify-center mt-2">
            {data.usersByPlan.map((entry) => (
              <div key={entry.planName} className="flex items-center gap-1.5 text-xs">
                <div
                  className="h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: PLAN_COLORS[entry.planName] ?? 'hsl(var(--muted))' }}
                />
                <span className="text-muted-foreground">{entry.planName}</span>
                <span className="font-medium">{entry.count}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Bottom Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Top Investment Types */}
        <div className="glass-card rounded-xl p-5 border border-border/50">
          <h3 className="text-sm font-semibold mb-4">Investissements les plus simul&eacute;s</h3>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={data.topInvestmentTypes} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis
                type="number"
                tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
                stroke="hsl(var(--border))"
              />
              <YAxis
                type="category"
                dataKey="investmentType"
                width={120}
                tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
                stroke="hsl(var(--border))"
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'hsl(var(--card))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px',
                  fontSize: '12px',
                }}
                formatter={(value: number, name: string) =>
                  name === 'totalGrant'
                    ? [`${(value / 1000).toFixed(0)}k \u20AC`, 'Subventions']
                    : [value, 'Simulations']
                }
              />
              <Bar dataKey="count" name="Simulations" radius={[0, 4, 4, 0]}>
                {data.topInvestmentTypes.map((_, idx) => (
                  <Cell key={idx} fill={INVESTMENT_COLORS[idx % INVESTMENT_COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Top Countries */}
        <div className="glass-card rounded-xl p-5 border border-border/50">
          <h3 className="text-sm font-semibold mb-4">Volume par pays</h3>
          <div className="space-y-3">
            {data.topCountries.map((country, idx) => {
              const max = data.topCountries[0]?.count || 1;
              const pct = (country.count / max) * 100;
              return (
                <div key={country.countryCode} className="flex items-center gap-3">
                  <span className="w-8 text-sm font-mono text-muted-foreground">
                    {COUNTRY_FLAGS[country.countryCode] ?? country.countryCode}
                  </span>
                  <div className="flex-1 h-7 rounded-md bg-muted/50 relative overflow-hidden">
                    <div
                      className="h-full rounded-md transition-all duration-500"
                      style={{
                        width: `${pct}%`,
                        backgroundColor: INVESTMENT_COLORS[idx % INVESTMENT_COLORS.length],
                        opacity: 0.7,
                      }}
                    />
                    <span className="absolute inset-y-0 right-2 flex items-center text-xs font-medium">
                      {country.count}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
