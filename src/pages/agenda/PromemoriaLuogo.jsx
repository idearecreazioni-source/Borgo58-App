import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { TASK_LUOGHI } from "../../lib/constants";
import { ambienteCorrente } from "../../lib/ambiente";
import {
  chiaviLuogo,
  creaChiaveLuogo,
  indirizzoPromemoriaLuogo,
  revocaChiaveLuogo,
} from "../../lib/api/luoghi";

// 🔴 I PROMEMORIA PER LUOGO — 28/10/2026, chiesto da Alessio: «ricordami di
//    fare questo quando arrivo a casa».
//
// Il gestionale e' un sito, e un sito chiuso non sa dove sei. Lo sa
// l'iPhone: un'automazione dell'app Comandi, all'arrivo in un posto, chiede
// al gestionale cosa c'e' da fare li' e lo mostra in una notifica. Qui si
// crea la chiave che quell'automazione usa, e si leggono i dati da copiarci.
//
// ⚠️ La guida dice solo cio' che e' gia' stato verificato sul telefono di
//    Alessio con la Scorciatoia della voce («Ottieni contenuto di URL»,
//    metodo, corpo JSON). I passaggi dell'automazione «Quando arrivo» e
//    della notifica si scrivono dopo averli visti sulle sue schermate
//    (CLAUDE.md §2: una schermata che da qui non si apre si chiede).
export default function PromemoriaLuogo() {
  const [chiavi, setChiavi] = useState(null);
  const [nome, setNome] = useState("iPhone");
  const [nuova, setNuova] = useState(null);
  const [errore, setErrore] = useState("");
  const dove = ambienteCorrente();

  const rileggi = () =>
    chiaviLuogo()
      .then(setChiavi)
      .catch((e) => setErrore(e.message));

  useEffect(() => {
    rileggi();
  }, []);

  const crea = async () => {
    setErrore("");
    try {
      setNuova(await creaChiaveLuogo(nome));
      rileggi();
    } catch (e) {
      setErrore(e.message);
    }
  };

  const togli = async (id) => {
    setErrore("");
    try {
      await revocaChiaveLuogo(id);
      setNuova(null);
      rileggi();
    } catch (e) {
      setErrore(e.message);
    }
  };

  const attive = (chiavi ?? []).filter((c) => !c.revocata_il);

  return (
    <div className="testo-sala max-w-2xl mx-auto space-y-6">
      <div>
        <Link to="/agenda" className="tocco-riga inline-flex items-center testo-sala text-b58-azione-testo hover:underline">
          ← Agenda
        </Link>
        <h1 className="font-display text-2xl text-b58-charcoal mt-1">Quando arrivo…</h1>
        <p className="testo-sala text-b58-charcoal-soft mt-1">
          Un impegno con «Ricordamelo quando arrivo» te lo ricorda il telefono quando arrivi in quel
          posto, ogni volta, finché non lo spunti. Se lì non c'è niente da fare, il telefono resta zitto.
        </p>
      </div>

      {errore && <p className="testo-sala text-b58-terracotta-dark-testo">Errore: {errore}</p>}

      <section className="rounded-xl bg-b58-parchment ring-1 ring-b58-charcoal/10 p-4 space-y-3">
        <h2 className="testo-sala font-medium uppercase tracking-wide text-b58-charcoal-soft">1 · La chiave del telefono</h2>
        <p
          className={`testo-sala rounded-lg px-3 py-2 ${
            dove.produzione ? "bg-b58-charcoal/10 text-b58-charcoal" : "bg-b58-terracotta/10 text-b58-terracotta-dark-testo"
          }`}
        >
          La chiave che crei qui vale per <b>{dove.nome}</b>, e solo per quello. Serve solo a leggere i
          promemoria di un luogo: non scrive niente e non usa la voce.
        </p>

        {nuova && (
          <div data-chiave-nuova className="rounded-lg border border-b58-terracotta bg-b58-terracotta/5 p-3">
            <p className="testo-sala font-medium text-b58-charcoal">
              Ecco la chiave «{nuova.nome}». Copiala adesso: non si vedrà più.
            </p>
            <code className="mt-2 block break-all rounded bg-b58-campo px-2 py-2 testo-sala">{nuova.chiave}</code>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2">
          <input
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            aria-label="A che telefono la dai"
            className="tocco-riga flex-1 min-w-0 rounded-lg border border-b58-charcoal/15 bg-b58-campo px-3 testo-sala text-b58-charcoal"
            placeholder="A che telefono la dai"
          />
          <button
            type="button"
            onClick={crea}
            className="tocco-riga rounded-lg bg-b58-azione hover:bg-b58-azione-dark px-4 testo-sala font-medium text-b58-sul-colore"
          >
            Crea una chiave
          </button>
        </div>

        {attive.length > 0 && (
          <ul className="space-y-1">
            {attive.map((c) => (
              <li
                key={c.id}
                className="tocco-riga flex flex-wrap items-center justify-between gap-2 rounded-lg bg-b58-cream px-3 testo-sala text-b58-charcoal"
              >
                <span>
                  {c.nome} — {c.usi === 0 ? "mai usata" : `usata ${c.usi} volte`}
                </span>
                <button
                  type="button"
                  onClick={() => togli(c.id)}
                  className="tocco-riga rounded-lg px-3 text-b58-terracotta-dark-testo"
                >
                  Togli
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-xl bg-b58-parchment ring-1 ring-b58-charcoal/10 p-4 space-y-3">
        <h2 className="testo-sala font-medium uppercase tracking-wide text-b58-charcoal-soft">
          2 · Cosa chiede il telefono
        </h2>
        <p className="testo-sala text-b58-charcoal">
          Nell'automazione, l'azione <b>Ottieni contenuto di URL</b> con <b>Metodo: POST</b> e{" "}
          <b>Corpo richiesta: JSON</b>, all'indirizzo di questo gestionale:
        </p>
        <code data-indirizzo-luogo className="block break-all rounded bg-b58-campo px-2 py-2 testo-sala">
          {indirizzoPromemoriaLuogo()}
        </code>
        <p className="testo-sala text-b58-charcoal">Nel corpo, due campi di testo:</p>
        <ul className="testo-sala text-b58-charcoal space-y-1">
          <li>
            • <b>chiave</b> → la chiave che hai copiato qui sopra
          </li>
          <li>
            • <b>luogo</b> →{" "}
            {TASK_LUOGHI.map((l, i) => (
              <span key={l.value}>
                {i > 0 && " oppure "}
                <code className="rounded bg-b58-campo px-1">{l.value}</code> ({l.label})
              </span>
            ))}
          </li>
        </ul>
        <p className="testo-sala text-b58-charcoal">
          La risposta è già il testo della notifica, per esempio «Casa: 1 cosa da fare · pesare la
          mamma». Quando non c'è niente da fare la risposta è vuota.
        </p>
        <p className="testo-sala text-b58-charcoal-soft">
          I passaggi dell'automazione «Quando arrivo» e della notifica li costruiamo insieme sulle
          schermate del tuo telefono: mandamele in chat mentre lo fai.
        </p>
      </section>
    </div>
  );
}
