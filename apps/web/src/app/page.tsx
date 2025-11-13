export default function Home() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-50 to-primary-100">
      <div className="text-center space-y-6">
        <div className="space-y-2">
          <h1 className="text-5xl font-bold text-primary-900">HEX Ops</h1>
          <p className="text-xl text-primary-700">Automatisez votre chiffrage CVC/Plomberie</p>
        </div>

        <div className="space-y-4 pt-8">
          <p className="text-neutral-600 max-w-md mx-auto">
            Import DPGF • Mapping Catalogue • Calcul MO/PV • Exports PDF/Excel
          </p>

          <div className="flex gap-4 justify-center">
            <button className="btn-primary">Connexion</button>
            <button className="btn-secondary">Démo</button>
          </div>
        </div>

        <div className="pt-8 text-sm text-neutral-500">
          MVP Sprint 0 - Stack: Next.js 16 + React 19 + Tailwind v4 + Supabase
        </div>
      </div>
    </main>
  );
}
