import { Link, Navigate, useParams } from "react-router-dom";
import Icon from "../components/Icon";
import { PHASES, getModule } from "../data/modules";

export default function ModulePlaceholder() {
  const { moduleId } = useParams();
  const module = getModule(moduleId);

  if (!module) return <Navigate to="/dashboard" replace />;

  const phase = PHASES[module.phase];

  return (
    <div className="max-w-3xl mx-auto">
      <Link
        to="/dashboard"
        className="tocco-bottone inline-flex items-center gap-1.5 testo-sala-grande text-b58-charcoal-soft hover:text-b58-terracotta mb-6"
      >
        ← Torna alla dashboard
      </Link>

      <div className="rounded-2xl bg-b58-parchment ring-1 ring-b58-charcoal/10 p-8 md:p-10">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 shrink-0 rounded-xl bg-b58-cream-dark flex items-center justify-center text-b58-terracotta">
            <Icon name={module.icon} className="w-6 h-6" />
          </div>
          <div>
            <span
              className={`inline-flex items-center gap-1.5 rounded-full ${phase.colorClass} text-b58-parchment testo-sala font-medium px-2.5 py-1 mb-2`}
            >
              {phase.label}
            </span>
            <h1 className="font-display text-2xl text-b58-charcoal">
              {module.name}
            </h1>
            <p className="text-b58-charcoal-soft mt-1">{module.description}</p>
          </div>
        </div>

        {/* 🔴 UN MODULO CHE C'È NON SI DICE «NON SVILUPPATO» — 27/08/2026.
            Chi arriva qui a mano su un modulo che ha le sue porte altrove
            deve trovarci le porte, non una frase che è diventata falsa.
            ⚠️ Per gli altri due — Ricerca Ricorrente e Monitoraggio Social —
               la frase è ancora VERA: misurato, non hanno nessuna schermata.
               Si corregge quello che è diventato falso, non tutto. */}
        {module.porte ? (
          <div className="mt-8 rounded-xl border border-b58-charcoal/15 p-6">
            <p className="text-b58-charcoal-soft">
              Questo modulo si usa da due porte, in cima al menu:
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {module.porte.map((p) => (
                <Link
                  key={p.a}
                  to={p.a}
                  className="tocco-bottone rounded-lg bg-b58-charcoal px-4 testo-sala text-b58-parchment inline-flex items-center"
                >
                  {p.nome} →
                </Link>
              ))}
            </div>
          </div>
        ) : (
          <div className="mt-8 rounded-xl border border-dashed border-b58-charcoal/20 p-8 text-center">
            <p className="text-b58-charcoal-soft">
              {module.next
                ? "Questo sarà il prossimo modulo su cui lavoreremo, a partire dalla prossima sessione."
                : "Modulo non ancora sviluppato — arriverà seguendo la sequenza definita nel brief tecnico."}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
