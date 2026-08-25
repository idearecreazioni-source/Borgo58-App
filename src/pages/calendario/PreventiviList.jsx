import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { listPreventivi, salvaPreventivo } from "../../lib/api/preventivi";
import { getEntities } from "../../lib/api/entities";
import { formatDate, oggiLocale } from "../../lib/constants";

const STATI = {
  bozza: "Bozza",
  inviato: "Inviato",
  accettato: "Accettato",
  rifiutato: "Rifiutato",
  annullato: "Annullato",
};

export default function PreventiviList() {
  const navigate = useNavigate();
  const [preventivi, setPreventivi] = useState(null);
  const [errore, setErrore] = useState("");
  const [creando, setCreando] = useState(false);

  const carica = async () => {
    setErrore("");
    try {
      setPreventivi(await listPreventivi());
    } catch (e) {
      // ⚠️ Non si disegna un elenco vuoto quando la lettura è fallita:
      // «nessun preventivo» e «non lo so» sono due cose diverse.
      setPreventivi(null);
      setErrore(e.message);
    }
  };

  useEffect(() => {
    carica();
  }, []);

  const nuovo = async () => {
    setCreando(true);
    setErrore("");
    try {
      const entita = await getEntities();
      // 🔴 QUI C'ERA `entita[0]?.id`, ED È ARRIVATO NULL AL DATABASE.
      // `getEntities()` restituisce un OGGETTO `{ srls, agricola }`, non un
      // array: `entita[0]` è undefined, **e l'optional chaining l'ha lasciato
      // passare zitto**. Trovato da Alessio al primo «Nuovo preventivo».
      //
      // ⚠️ E LA LEZIONE È PIÙ LARGA DELLA RIGA: a ingoiare non è stato un
      // `catch` — quelli sono curati — ma un `?.` **su un dato che DEVE
      // esserci**. `?.` trasforma «non l'ho trovato» in undefined senza
      // dirlo: è la stessa famiglia della sala disegnata vuota, con un'altra
      // faccia. Su un dato obbligatorio non si scrive `?.`, si scrive il
      // percorso vero — e se quello non c'è, deve rompersi.
      //
      // ⚠️ I preventivi sono della S.r.l.s.: è l'azienda che fa gli eventi.
      const id = await salvaPreventivo({
        testata: {
          entity_id: entita.srls.id,
          cliente_nome: "Nuovo preventivo",
          // ⚠️ oggiLocale(), non new Date().toISOString(): quello è il
          // giorno UTC, e fra mezzanotte e le due restituisce IERI. È la
          // trappola dell audit dell 08/08, e l ho appena riscritta.
          data_evento: oggiLocale(),
          persone: 10,
        },
        righe: [],
      });
      navigate(`/calendario-eventi/preventivi/${id}`);
    } catch (e) {
      setErrore(e.message);
    } finally {
      setCreando(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto pb-16">
      <Link to="/calendario-eventi" className="tocco-bottone inline-flex items-center testo-sala-grande text-b58-charcoal-soft hover:text-b58-terracotta">
        ← Calendario eventi
      </Link>
      <div className="flex items-center justify-between gap-4 mt-1 mb-6">
        <h1 className="font-display text-2xl text-b58-charcoal">Preventivi</h1>
        <button
          onClick={nuovo}
          disabled={creando}
          className="rounded-lg bg-b58-terracotta hover:bg-b58-terracotta-dark disabled:opacity-60 text-b58-parchment testo-sala-grande px-4 py-2"
        >
          {creando ? "…" : "Nuovo preventivo"}
        </button>
      </div>

      {errore && (
        <div className="testo-sala-grande text-b58-terracotta-dark bg-b58-terracotta/10 rounded-lg px-3 py-2 mb-4">
          <p>{errore}</p>
          <button onClick={carica} className="underline testo-sala mt-1">
            Riprova
          </button>
        </div>
      )}

      {preventivi === null && !errore && <p className="testo-sala-grande text-b58-charcoal-soft">Sto guardando…</p>}
      {preventivi?.length === 0 && (
        <p className="testo-sala-grande text-b58-charcoal-soft">Nessun preventivo, per ora.</p>
      )}

      {preventivi?.length > 0 && (
        <div className="rounded-xl bg-b58-parchment ring-1 ring-b58-charcoal/10 divide-y divide-b58-charcoal/10">
          {preventivi.map((p) => (
            <Link
              key={p.id}
              to={`/calendario-eventi/preventivi/${p.id}`}
              className="tocco-riga flex items-center gap-3 px-4 hover:bg-b58-cream-dark/40"
            >
              <div className="flex-1 min-w-0">
                <div className="text-b58-charcoal truncate">
                  {p.cliente_nome}
                  {/* ⚠️ Una versione dice di esserlo: senza, due preventivi
                      quasi identici nell'elenco sono indistinguibili. */}
                  {p.versione_di && (
                    <span className="testo-sala text-b58-charcoal-soft bg-b58-cream-dark rounded-full px-2 py-0.5 ml-1.5">
                      versione nuova
                    </span>
                  )}
                </div>
                <div className="testo-sala text-b58-charcoal-soft">
                  {formatDate(p.data_evento)} · {p.persone}{" "}
                  {p.persone === 1 ? "persona" : "persone"}
                </div>
              </div>
              <span className="testo-sala text-b58-charcoal-soft shrink-0">{STATI[p.stato] ?? p.stato}</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
