import ModuleCard from "../components/ModuleCard";
import { MODULES } from "../data/modules";
import { useAuth } from "../context/AuthContext";

export default function Dashboard() {
  const { isTitolare, isStaff } = useAuth();
  const visibleModules = MODULES.filter((m) => isTitolare || m.staffVisible);

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-8">
        <h1 className="font-display text-2xl md:text-3xl text-b58-charcoal">
          {isStaff ? "Benvenuto." : "Bentornato, Alessio."}
        </h1>
        <p className="text-b58-charcoal-soft mt-1">
          {isStaff
            ? "Le sezioni operative di Borgo 58."
            : "Panoramica dei moduli del gestionale Borgo 58."}
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {visibleModules.map((m) => (
          <ModuleCard key={m.id} module={m} />
        ))}
      </div>
    </div>
  );
}
