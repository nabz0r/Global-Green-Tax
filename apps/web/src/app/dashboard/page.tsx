import Link from 'next/link';
import { UserButton } from '@clerk/nextjs';

export default function DashboardPage() {
  return (
    <div className="min-h-screen">
      <header className="flex items-center justify-between border-b border-border px-6 py-4">
        <h1 className="text-xl font-semibold text-primary">
          Global Green Tax
        </h1>
        <UserButton />
      </header>

      <main className="mx-auto max-w-5xl p-6">
        <h2 className="text-2xl font-bold">Dashboard</h2>
        <p className="mt-2 text-muted-foreground">
          Calculez vos obligations carbone et subventions vertes disponibles
          à travers plusieurs juridictions.
        </p>

        <div className="mt-8 grid gap-6 md:grid-cols-3">
          <div className="rounded-lg border border-border bg-card p-6">
            <h3 className="text-sm font-medium text-muted-foreground">
              Position Nette
            </h3>
            <p className="mt-2 text-3xl font-bold">--</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Lancez une simulation pour voir les résultats
            </p>
          </div>

          <div className="rounded-lg border border-border bg-card p-6">
            <h3 className="text-sm font-medium text-muted-foreground">
              Taxe CO2
            </h3>
            <p className="mt-2 text-3xl font-bold text-destructive">--</p>
          </div>

          <div className="rounded-lg border border-border bg-card p-6">
            <h3 className="text-sm font-medium text-muted-foreground">
              Subventions
            </h3>
            <p className="mt-2 text-3xl font-bold text-primary">--</p>
          </div>
        </div>

        <div className="mt-8">
          <Link
            href="/dashboard/simulate"
            className="inline-flex items-center justify-center rounded-md bg-primary px-8 py-3 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition"
          >
            Lancer une simulation Luxembourg 2026
          </Link>
        </div>
      </main>
    </div>
  );
}
