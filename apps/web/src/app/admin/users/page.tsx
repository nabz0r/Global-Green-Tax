'use client';

import { useState, useEffect, useCallback } from 'react';

interface UserRow {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  role: string;
  createdAt: string;
  organization: {
    id: string;
    name: string;
    countryCode: string;
    planName: string;
    simulationsUsed: number;
  };
}

interface UsersResponse {
  users: UserRow[];
  total: number;
  page: number;
  totalPages: number;
}

const PLAN_BADGE_COLORS: Record<string, string> = {
  FREEMIUM: 'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300',
  STARTER: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
  PROFESSIONAL: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300',
  ENTERPRISE: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-300',
};

const PLANS = ['FREEMIUM', 'STARTER', 'PROFESSIONAL', 'ENTERPRISE'];

// Demo data
const DEMO_USERS: UsersResponse = {
  users: [
    { id: '1', email: 'demo@global-green-tax.com', firstName: 'Demo', lastName: 'User', role: 'OWNER', createdAt: '2026-01-15T10:00:00Z', organization: { id: 'o1', name: 'GreenTech Luxembourg SARL', countryCode: 'LU', planName: 'PROFESSIONAL', simulationsUsed: 12 } },
    { id: '2', email: 'marie@ecosolutions.fr', firstName: 'Marie', lastName: 'Dupont', role: 'ADMIN', createdAt: '2026-01-20T14:30:00Z', organization: { id: 'o2', name: 'EcoSolutions France SAS', countryCode: 'FR', planName: 'PROFESSIONAL', simulationsUsed: 8 } },
    { id: '3', email: 'hans@gruntech.de', firstName: 'Hans', lastName: 'Müller', role: 'OWNER', createdAt: '2026-02-01T09:15:00Z', organization: { id: 'o3', name: 'GrünTech Deutschland GmbH', countryCode: 'DE', planName: 'ENTERPRISE', simulationsUsed: 34 } },
    { id: '4', email: 'jan@ecovlaanderen.be', firstName: 'Jan', lastName: 'Peeters', role: 'MEMBER', createdAt: '2026-02-03T11:00:00Z', organization: { id: 'o4', name: 'EcoVlaanderen NV', countryCode: 'BE', planName: 'STARTER', simulationsUsed: 3 } },
    { id: '5', email: 'carlos@solenergia.es', firstName: 'Carlos', lastName: 'Garcia', role: 'OWNER', createdAt: '2026-02-05T16:45:00Z', organization: { id: 'o5', name: 'SolEnergia España SL', countryCode: 'ES', planName: 'STARTER', simulationsUsed: 2 } },
    { id: '6', email: 'ana@verdeportugal.pt', firstName: 'Ana', lastName: 'Silva', role: 'OWNER', createdAt: '2026-02-07T13:20:00Z', organization: { id: 'o6', name: 'VerdePortugal Lda', countryCode: 'PT', planName: 'FREEMIUM', simulationsUsed: 1 } },
    { id: '7', email: 'sophie@greenaudit.lu', firstName: 'Sophie', lastName: 'Kremer', role: 'MEMBER', createdAt: '2026-02-08T08:30:00Z', organization: { id: 'o1', name: 'GreenTech Luxembourg SARL', countryCode: 'LU', planName: 'PROFESSIONAL', simulationsUsed: 12 } },
    { id: '8', email: 'pierre@ecosolutions.fr', firstName: 'Pierre', lastName: 'Martin', role: 'VIEWER', createdAt: '2026-02-10T10:00:00Z', organization: { id: 'o2', name: 'EcoSolutions France SAS', countryCode: 'FR', planName: 'PROFESSIONAL', simulationsUsed: 8 } },
  ],
  total: 8,
  page: 1,
  totalPages: 1,
};

export default function AdminUsersPage() {
  const [data, setData] = useState<UsersResponse | null>(null);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [changingPlan, setChangingPlan] = useState<string | null>(null);

  const loadUsers = useCallback(async (searchTerm?: string) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (searchTerm) params.set('search', searchTerm);
      const res = await fetch(`/api/admin/users?${params}`);
      if (res.ok) {
        setData(await res.json());
      } else {
        setData(DEMO_USERS);
      }
    } catch {
      setData(DEMO_USERS);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => loadUsers(search), 300);
    return () => clearTimeout(timer);
  }, [search, loadUsers]);

  const handleChangePlan = async (userId: string, planName: string) => {
    setChangingPlan(userId);
    try {
      await fetch(`/api/admin/users/${userId}/toggle-plan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planName }),
      });
      await loadUsers(search);
    } catch {
      // silently handle
    } finally {
      setChangingPlan(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">User Management</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {data ? `${data.total} utilisateurs` : 'Chargement...'}
          </p>
        </div>
      </div>

      {/* Search */}
      <div className="glass-card rounded-xl border border-border/50 p-4">
        <input
          type="text"
          placeholder="Rechercher par email, nom..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full rounded-lg border border-border bg-background px-4 py-2.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
        />
      </div>

      {/* DataTable */}
      <div className="glass-card rounded-xl border border-border/50 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Utilisateur</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Organisation</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Pays</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Role</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Plan</th>
                <th className="px-4 py-3 text-center font-medium text-muted-foreground">Simulations</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Inscrit le</th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="border-b border-border/50">
                    {Array.from({ length: 8 }).map((_, j) => (
                      <td key={j} className="px-4 py-3">
                        <div className="h-4 w-20 animate-pulse rounded bg-muted" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : (
                data?.users.map((user) => (
                  <tr
                    key={user.id}
                    className="border-b border-border/50 hover:bg-muted/20 transition-colors"
                  >
                    <td className="px-4 py-3">
                      <div>
                        <p className="font-medium">
                          {user.firstName} {user.lastName}
                        </p>
                        <p className="text-xs text-muted-foreground">{user.email}</p>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {user.organization.name}
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center rounded-md bg-muted px-2 py-0.5 text-xs font-mono">
                        {user.organization.countryCode}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-medium ${
                        user.role === 'OWNER' ? 'text-emerald-500' :
                        user.role === 'ADMIN' ? 'text-cyan-500' :
                        'text-muted-foreground'
                      }`}>
                        {user.role}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                        PLAN_BADGE_COLORS[user.organization.planName] ?? PLAN_BADGE_COLORS.FREEMIUM
                      }`}>
                        {user.organization.planName}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center font-mono text-xs">
                      {user.organization.simulationsUsed}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {new Date(user.createdAt).toLocaleDateString('fr-FR')}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <select
                        value={user.organization.planName}
                        onChange={(e) => handleChangePlan(user.id, e.target.value)}
                        disabled={changingPlan === user.id}
                        className="rounded-md border border-border bg-background px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-primary/50 disabled:opacity-50"
                      >
                        {PLANS.map((plan) => (
                          <option key={plan} value={plan}>
                            {plan}
                          </option>
                        ))}
                      </select>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination footer */}
        {data && data.totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-border px-4 py-3">
            <p className="text-xs text-muted-foreground">
              Page {data.page} sur {data.totalPages} ({data.total} r&eacute;sultats)
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
