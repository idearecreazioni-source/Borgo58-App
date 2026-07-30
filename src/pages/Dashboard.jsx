import ModuleCard from "../components/ModuleCard";
import { MODULES } from "../data/modules";

export default function Dashboard() {
  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-8">
        <h1 className="font-display text-2xl md:text-3xl text-b58-charcoal">
          Bentornato, Alessio.
        </h1>
        <p className="text-b58-charcoal-soft mt-1">
          Panoramica dei moduli del gestionale Borgo 58. Lavoreremo su un
          modulo alla volta, a partire dal ricettario.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {MODULES.map((m) => (
          <ModuleCard key={m.id} module={m} />
        ))}
      </div>
    </div>
  );
}
