export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col justify-center gap-6 px-6 py-16">
      <div className="space-y-2">
        <p className="text-sm font-medium uppercase tracking-[0.2em] text-slate-500">IndSure</p>
        <h1 className="text-4xl font-semibold tracking-tight text-slate-900">Dashboard review build</h1>
        <p className="max-w-2xl text-lg text-slate-600">
          This duplicate dashboard app is retained as a buildable review artifact and no longer ships starter content.
        </p>
      </div>
      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-6 text-sm text-slate-700">
        <p>Use the navigation routes in this app to inspect the review variant.</p>
      </div>
    </main>
  );
}
