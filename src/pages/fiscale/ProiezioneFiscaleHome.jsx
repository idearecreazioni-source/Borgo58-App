import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import Icon from "../../components/Icon";
import { getFiscalSettings, listDeductibleExpenses, listFiscalTools } from "../../lib/api/fiscal";
import { getEntities } from "../../lib/api/entities";
import { computeDeducibility } from "../../lib/deducibility";
import { formatEUR } from "../../lib/constants";

const currentYear = new Date().getFullYear();

export default function ProiezioneFiscaleHome() {
  const [deductibleTotal, setDeductibleTotal] = useState(null);
  const [toolsInUse, setToolsInUse] = useState(0);
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const ent = await getEntities();
        const [expenses, settings, tools] = await Promise.all([
          listDeductibleExpenses({ entityId: ent.srls.id, year: currentYear }),
          getFiscalSettings(ent.srls.id),
          listFiscalTools(),
        ]);
        const res = computeDeducibility(expenses, { annualRevenue: settings?.annual_revenue_estimate });
        setDeductibleTotal(res.totalDeductible);
        setToolsInUse(tools.filter((t) => t.in_use).length);
      } catch (e) {
        setError(e.message);
      }
    })();
  }, []);

  const cards = [
    {
      to: "/fiscale/previsioni",
      icon: "chart",
      title: "Le previsioni",
      desc: "Il tuo piano caricato dal foglio, chiuso e non più ritoccabile. Le riproiezioni si confrontano con la prima.",
      stat: null,
    },
    {
      to: "/fiscale/andamento",
      icon: "clock",
      title: "Come sta andando",
      desc: "Il mese vero contro il previsto, scomposto: coperti, scontrino, food cost, fissi. E quanti omaggi ti puoi permettere.",
      stat: null,
    },
    {
      to: "/fiscale/deduzioni",
      icon: "percent",
      title: "Deduzioni fiscali",
      desc: "Spese documentate per categoria, regola contanti 2025, plafond rappresentanza.",
      stat: deductibleTotal != null ? `${formatEUR(deductibleTotal)} deducibili ${currentYear}` : null,
    },
    {
      to: "/fiscale/strumenti",
      icon: "search",
      title: "Catalogo strumenti",
      desc: "Deduzioni, crediti d'imposta, bandi e incentivi rilevanti.",
      stat: toolsInUse > 0 ? `${toolsInUse} in uso` : null,
    },
    {
      to: "/fiscale/simulatore",
      icon: "cash",
      title: "Simulatore what-if",
      desc: "Stima trasparente di IVA, IRES e IRAP dai tuoi input.",
      stat: null,
    },
  ];

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="font-display text-2xl md:text-3xl text-b58-charcoal">Proiezione Fiscale</h1>
        <p className="text-b58-charcoal-soft mt-1">Deduzioni, strumenti fiscali, stime.</p>
      </div>

      <p className="text-xs text-b58-terracotta-dark bg-b58-terracotta/10 rounded-lg px-3 py-2 mb-6">
        Tutto in questo modulo è una <strong>stima interna</strong> che assiste le decisioni, mai un dato
        fiscale definitivo: la validazione resta sempre alla commercialista (§6).
      </p>

      {error && <p className="text-sm text-b58-terracotta-dark mb-4">{error}</p>}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {cards.map((c) => (
          <Link
            key={c.to}
            to={c.to}
            className="rounded-xl bg-b58-parchment p-6 ring-1 ring-b58-charcoal/10 hover:ring-b58-terracotta/50 hover:shadow-sm transition-all"
          >
            <div className="w-10 h-10 rounded-lg bg-b58-cream-dark flex items-center justify-center text-b58-terracotta mb-3">
              <Icon name={c.icon} className="w-5 h-5" />
            </div>
            <h3 className="font-display text-base text-b58-charcoal">{c.title}</h3>
            <p className="text-sm text-b58-charcoal-soft mt-1">{c.desc}</p>
            {c.stat && <p className="text-xs text-b58-olive-dark mt-2 font-medium">{c.stat}</p>}
          </Link>
        ))}
      </div>
    </div>
  );
}
