import { Link } from "react-router-dom";
import Icon from "./Icon";
import { PHASES } from "../data/modules";

export default function ModuleCard({ module }) {
  const phase = PHASES[module.phase];

  return (
    <Link
      to={module.route ?? `/moduli/${module.id}`}
      className="group relative flex flex-col gap-3 rounded-xl bg-b58-parchment p-5 ring-1 ring-b58-charcoal/10 hover:ring-b58-terracotta/50 hover:shadow-sm transition-all"
    >
      {module.next && (
        <span className="absolute -top-2.5 right-4 rounded-full bg-b58-gold text-b58-parchment text-[10px] font-medium uppercase tracking-wide px-2.5 py-1">
          Prossimo modulo
        </span>
      )}

      <div className="flex items-center justify-between">
        <div className="w-10 h-10 rounded-lg bg-b58-cream-dark flex items-center justify-center text-b58-terracotta group-hover:text-b58-terracotta-dark transition-colors">
          <Icon name={module.icon} className="w-5 h-5" />
        </div>
        <span className="text-[11px] text-b58-charcoal-soft/60">
          {String(module.number).padStart(2, "0")}
        </span>
      </div>

      <div>
        <h3 className="font-display text-base text-b58-charcoal">{module.name}</h3>
        <p className="text-sm text-b58-charcoal-soft mt-1 leading-snug">
          {module.description}
        </p>
      </div>

      <span
        className={`inline-flex w-fit items-center gap-1.5 rounded-full ${phase.colorClass} text-b58-parchment text-[10px] font-medium px-2.5 py-1`}
      >
        {phase.label}
      </span>
    </Link>
  );
}
