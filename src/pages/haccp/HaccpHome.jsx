import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import Icon from "../../components/Icon";
import { listNonConformities, listTemperatureLogs } from "../../lib/api/haccp";

const isToday = (dateStr) => new Date(dateStr).toDateString() === new Date().toDateString();

export default function HaccpHome() {
  const [openNc, setOpenNc] = useState(0);
  const [nonCompliantToday, setNonCompliantToday] = useState(0);
  const [errore, setErrore] = useState("");

  useEffect(() => {
    // Un errore qui non va ingoiato: "0 fuori range" per un problema di
    // rete è indistinguibile da una giornata a posto — e questo è un
    // modulo di sicurezza alimentare.
    listNonConformities()
      .then((rows) => setOpenNc(rows.filter((r) => !r.resolved).length))
      .catch((e) => setErrore(e.message));
    listTemperatureLogs()
      .then((rows) =>
        setNonCompliantToday(rows.filter((r) => isToday(r.recorded_at) && !r.is_compliant).length)
      )
      .catch((e) => setErrore(e.message));
  }, []);

  const cards = [
    {
      to: "/haccp/temperature",
      icon: "leaf",
      title: "Registro temperature",
      desc: "Attrezzature a temperatura controllata e rilevazioni.",
      alert: nonCompliantToday > 0 ? `${nonCompliantToday} fuori range oggi` : null,
    },
    {
      to: "/haccp/ricevimento",
      icon: "box",
      title: "Ricevimento merci",
      desc: "Controlli alla consegna: temperatura, imballaggio, conformità.",
    },
    {
      to: "/haccp/pulizia",
      icon: "leaf",
      title: "Pulizia e disinfestazione",
      desc: "Attività di sanificazione e controllo infestanti.",
    },
    {
      to: "/haccp/non-conformita",
      icon: "receipt",
      title: "Non conformità",
      desc: "Segnalazioni e azioni correttive.",
      alert: openNc > 0 ? `${openNc} aperte` : null,
    },
    {
      to: "/haccp/raccolta-propria",
      icon: "leaf",
      title: "Raccolta propria",
      desc: "Erbe spontanee e prodotti autoraccolti (§3.17).",
    },
  ];

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-start justify-between gap-4 flex-wrap mb-8">
        <div>
          <h1 className="font-display text-2xl md:text-3xl text-b58-charcoal">HACCP</h1>
          <p className="text-b58-charcoal-soft mt-1">Piano di autocontrollo.</p>
        </div>
        <Link
          to="/haccp/manuale"
          className="rounded-lg border border-b58-charcoal/15 hover:bg-b58-cream-dark transition-colors text-b58-charcoal text-sm font-medium px-4 py-2"
        >
          Manuale completo (PDF)
        </Link>
      </div>

      {errore && (
        <p className="text-sm text-b58-terracotta-dark bg-b58-terracotta/10 rounded-lg px-3 py-2 mb-4">
          Contatori non aggiornati: {errore}. I numeri qui sotto potrebbero essere incompleti.
        </p>
      )}

      <p className="text-xs text-b58-terracotta-dark bg-b58-terracotta/10 rounded-lg px-3 py-2 mb-6">
        Struttura pronta all'uso, ma le soglie di temperatura e le attività di pulizia vanno
        impostate — e validate con un consulente alimentare/tecnico HACCP — prima di affidarcisi
        in produzione.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {cards.map((c) => (
          <Link
            key={c.to}
            to={c.to}
            className="rounded-xl bg-b58-parchment p-6 ring-1 ring-b58-charcoal/10 hover:ring-b58-terracotta/50 hover:shadow-sm transition-all"
          >
            <div className="flex items-start justify-between">
              <div className="w-10 h-10 rounded-lg bg-b58-cream-dark flex items-center justify-center text-b58-terracotta mb-3">
                <Icon name={c.icon} className="w-5 h-5" />
              </div>
              {c.alert && (
                <span className="text-[11px] text-b58-terracotta-dark bg-b58-terracotta/10 rounded-full px-2 py-0.5">
                  {c.alert}
                </span>
              )}
            </div>
            <h3 className="font-display text-base text-b58-charcoal">{c.title}</h3>
            <p className="text-sm text-b58-charcoal-soft mt-1">{c.desc}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
