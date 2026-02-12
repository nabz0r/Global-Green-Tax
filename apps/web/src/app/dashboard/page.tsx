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
          Calculate your carbon tax obligations and available green subsidies
          across multiple jurisdictions.
        </p>

        <div className="mt-8 grid gap-6 md:grid-cols-3">
          <div className="rounded-lg border border-border bg-card p-6">
            <h3 className="text-sm font-medium text-muted-foreground">
              Net Position
            </h3>
            <p className="mt-2 text-3xl font-bold">--</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Run a calculation to see results
            </p>
          </div>

          <div className="rounded-lg border border-border bg-card p-6">
            <h3 className="text-sm font-medium text-muted-foreground">
              CO2 Tax
            </h3>
            <p className="mt-2 text-3xl font-bold text-destructive">--</p>
          </div>

          <div className="rounded-lg border border-border bg-card p-6">
            <h3 className="text-sm font-medium text-muted-foreground">
              Subsidies
            </h3>
            <p className="mt-2 text-3xl font-bold text-primary">--</p>
          </div>
        </div>
      </main>
    </div>
  );
}
