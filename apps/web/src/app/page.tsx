import Link from 'next/link';

export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-8 p-8">
      <div className="text-center">
        <h1 className="text-5xl font-bold tracking-tight text-primary">
          Global Green Tax
        </h1>
        <p className="mt-4 text-lg text-muted-foreground max-w-xl">
          Multi-jurisdictional carbon tax and subsidy calculation platform.
          Each country is a pluggable module — add new jurisdictions without
          touching the code.
        </p>
      </div>

      <div className="flex gap-4">
        <Link
          href="/sign-in"
          className="rounded-md bg-primary px-6 py-3 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition"
        >
          Sign In
        </Link>
        <Link
          href="/sign-up"
          className="rounded-md border border-border px-6 py-3 text-sm font-medium hover:bg-accent transition"
        >
          Get Started
        </Link>
      </div>
    </main>
  );
}
