export default function HomePage() {
  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-6 px-6 py-16">
      <header className="space-y-2">
        <p className="text-sm font-medium text-neutral-500">
          Bulk Promotional Email Dashboard
        </p>
        <h1 className="text-3xl font-semibold tracking-tight">
          Next.js skeleton
        </h1>
        <p className="text-neutral-600">
          CSV import, contacts, campaigns, and ESP integration will plug into
          this app per <code className="rounded bg-neutral-100 px-1.5 py-0.5 text-sm">design-flow.md</code>.
        </p>
      </header>
      <section className="rounded-xl border border-neutral-200 bg-white p-6 shadow-sm">
        <h2 className="text-sm font-medium uppercase tracking-wide text-neutral-500">
          Stack
        </h2>
        <ul className="mt-3 list-inside list-disc text-neutral-700">
          <li>Next.js App Router + TypeScript</li>
          <li>Drizzle ORM + SQLite (see <code className="rounded bg-neutral-100 px-1 py-0.5 text-xs">src/db/schema.ts</code>)</li>
          <li>Copy <code className="rounded bg-neutral-100 px-1 py-0.5 text-xs">.env.example</code> to{" "}
          <code className="rounded bg-neutral-100 px-1 py-0.5 text-xs">.env.local</code></li>
        </ul>
      </section>
    </main>
  );
}
