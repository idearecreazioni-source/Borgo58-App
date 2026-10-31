import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import ConfermaDistruttiva from "../../components/ConfermaDistruttiva";
import { ambienteCorrente } from "../../lib/ambiente";
import {
  annullaLavoro,
  chiaviPonte,
  chiediLavoro,
  creaChiavePonte,
  elencoDispositivi,
  revocaChiavePonte,
  salvaDispositivo,
  togliDispositivo,
  ultimiLavori,
} from "../../lib/api/stampanti";

// 🔴 LE STAMPANTI E IL REGISTRATORE — 28/10/2026, chiesto da Alessio dopo
//    il fornitore: «creare l'infrastruttura per collegare l'hardware
//    tramite IP, e poi fisseremo una data per il collaudo».
//
// Il giorno del collaudo si scrive qui l'indirizzo di ogni apparecchio e si
// preme «Prova di stampa». Il gestionale non lo chiama: mette il lavoro in
// coda, e il ponte sul mini-PC del ristorante lo porta alla stampante e
// riscrive com'e' andata (ARCHITETTURA §4.2). Per questo la pagina dice
// prima di tutto se il ponte e' acceso: senza, ogni prova resta in coda.
//
// ⚠️ NIENTE SCONTRINI IN QUESTO PASSO: la coda accetta solo prove non
//    fiscali e letture di stato, ed e' il database a rifiutare il resto.

// Le «lingue» degli apparecchi, con la porta che di solito usano.
const PROTOCOLLI = {
  registratore_fiscale: [
    { value: "fpmate_http", label: "Epson FP-81 II RT (FPMate)", porta: 80 },
    { value: "simulatore", label: "Apparecchio finto, per le prove", porta: 18080 },
  ],
  stampante_comande: [
    { value: "escpos_tcp", label: "Epson TM in rete (ESC/POS)", porta: 9100 },
    { value: "epos_xml_http", label: "Epson TM in rete (ePOS)", porta: 80 },
    { value: "simulatore", label: "Apparecchio finto, per le prove", porta: 19100 },
  ],
};

// Le comande e i biglietti del turno passano dalla stessa coda (29/10).
const NOMI_DEI_LAVORI = { prova: "prova di stampa", stato: "stato", comanda: "comanda", chiamata: "biglietto del turno" };

const TIPI = [
  { value: "registratore_fiscale", label: "Registratore telematico" },
  { value: "stampante_comande", label: "Stampante delle comande" },
];

const STATI_APPARECCHIO = {
  pronto: "Pronto",
  carta_finita: "Carta finita",
  coperchio_aperto: "Coperchio aperto",
  non_risponde: "Non risponde",
  errore: "Errore",
  sconosciuto: "Mai provato",
};

const STATI_LAVORO = {
  in_coda: "Aspetta il ponte",
  in_corso: "Il ponte lo sta mandando",
  stampato: "Fatto",
  fallito: "Non riuscito",
  incerto: "Non si sa se è uscito",
  annullato: "Annullato",
};

const nuovoApparecchio = () => ({
  id: null,
  nome: "",
  tipo: "stampante_comande",
  protocollo: "escpos_tcp",
  indirizzo: "",
  porta: 9100,
  reparto: "cucina",
  attivo: true,
});

const ora = (t) =>
  t ? new Date(t).toLocaleString("it-IT", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" }) : "mai";

export default function Stampanti() {
  // Si arriva da due porte: la Sala e le Impostazioni (30/10/2026). Il
  // tasto per tornare riporta da dove si è venuti.
  const daImpostazioni = useLocation().state?.da === "impostazioni";
  const [apparecchi, setApparecchi] = useState(null);
  const [lavori, setLavori] = useState([]);
  const [chiavi, setChiavi] = useState(null);
  const [nuovaChiave, setNuovaChiave] = useState(null);
  const [scheda, setScheda] = useState(null);
  const [errore, setErrore] = useState("");
  // ⚠️ L'errore di una lettura è separato da quello di un gesto: una lettura
  // riuscita cancella il primo, ma non deve far sparire dopo pochi secondi il
  // secondo (es. un «Togli» non riuscito).
  const [erroreLettura, setErroreLettura] = useState("");
  const [inCorso, setInCorso] = useState(false);
  const dove = ambienteCorrente();

  // ⚠️ Le letture si numerano, come in Cucina: una partita prima e tornata
  // dopo non deve coprirne una più nuova, né col risultato né con l'errore.
  const ultimaLettura = useRef(0);
  const rileggi = useCallback(async () => {
    const questa = ++ultimaLettura.current;
    try {
      const [a, l, c] = await Promise.all([elencoDispositivi(), ultimiLavori(), chiaviPonte()]);
      if (questa !== ultimaLettura.current) return; // ne è già partita una più nuova
      setApparecchi(a);
      setLavori(l);
      setChiavi(c);
      setErroreLettura("");
    } catch (e) {
      if (questa !== ultimaLettura.current) return;
      setErroreLettura(e.message);
    }
  }, []);

  useEffect(() => {
    rileggi();
  }, [rileggi]);

  // Finché un lavoro aspetta, si guarda spesso; altrimenti ogni 15
  // secondi, quanto basta per vedere il ponte accendersi o spegnersi.
  const aperti = lavori.some((l) => l.stato === "in_coda" || l.stato === "in_corso");
  useEffect(() => {
    const t = setInterval(rileggi, aperti ? 3000 : 15000);
    return () => clearInterval(t);
  }, [aperti, rileggi]);

  const gesto = async (azione) => {
    setErrore("");
    setInCorso(true);
    try {
      await azione();
      await rileggi();
      return true;
    } catch (e) {
      setErrore(e.message);
      return false;
    } finally {
      setInCorso(false);
    }
  };

  const chiaviAttive = (chiavi ?? []).filter((c) => !c.revocata_il);
  const ponte = chiaviAttive.find((c) => c.acceso) ?? chiaviAttive[0] ?? null;
  const nomeDi = (id) => apparecchi?.find((a) => a.id === id)?.nome ?? "—";

  return (
    <div className="testo-sala max-w-3xl mx-auto space-y-6">
      <div>
        <Link
          to={daImpostazioni ? "/impostazioni" : "/comande"}
          className="tocco-riga inline-flex items-center testo-sala text-b58-azione-testo hover:underline"
        >
          {daImpostazioni ? "← Impostazioni" : "← Sala"}
        </Link>
        <h1 className="font-display text-2xl text-b58-charcoal mt-1">Stampanti e registratore</h1>
        <p className="testo-sala text-b58-charcoal-soft mt-1">
          Scrivi qui l'indirizzo di ogni apparecchio e prova a stampare. Il gestionale manda il lavoro al
          ponte, il programma sul mini-PC del ristorante, che lo porta alla stampante.
        </p>
      </div>

      {errore && (
        <p role="alert" className="testo-sala text-b58-terracotta-dark-testo">
          Errore: {errore}
        </p>
      )}
      {erroreLettura && (
        <p role="alert" className="testo-sala text-b58-terracotta-dark-testo">
          Errore: {erroreLettura}
        </p>
      )}

      <section data-ponte className="rounded-xl bg-b58-parchment ring-1 ring-b58-charcoal/10 p-4 space-y-3">
        <h2 className="testo-sala font-medium uppercase tracking-wide text-b58-charcoal-soft">1 · Il ponte</h2>
        {chiavi === null ? (
          <p className="testo-sala text-b58-charcoal-soft">Controllo…</p>
        ) : ponte?.acceso ? (
          <p data-stato-ponte="acceso" className="testo-sala text-b58-charcoal">
            <span className="font-medium text-b58-azione-testo">● Acceso</span> — «{ponte.nome}»
            {ponte.host ? ` su ${ponte.host}` : ""}, ultimo segnale {ora(ponte.ultimo_battito)}.
          </p>
        ) : (
          <p data-stato-ponte="spento" className="testo-sala text-b58-terracotta-dark-testo">
            ● Spento{ponte ? ` — ultimo segnale ${ora(ponte.ultimo_battito)}` : " — non è ancora stato installato"}.
            Finché è spento, le prove restano in coda.
          </p>
        )}

        <p
          className={`testo-sala rounded-lg px-3 py-2 ${
            dove.datiVeri ? "bg-b58-charcoal/10 text-b58-charcoal" : "bg-b58-terracotta/10 text-b58-terracotta-dark-testo"
          }`}
        >
          La chiave che crei qui fa entrare il ponte in <b>{dove.nome}</b>, e solo lì. Va scritta una volta sul
          mini-PC durante l'installazione.
        </p>

        {nuovaChiave && (
          <div data-chiave-nuova className="rounded-lg border border-b58-terracotta bg-b58-terracotta/5 p-3">
            <p className="testo-sala font-medium text-b58-charcoal">
              Ecco la chiave «{nuovaChiave.nome}». Copiala adesso: non si vedrà più.
            </p>
            <code className="mt-2 block break-all rounded bg-b58-campo px-2 py-2 testo-sala">{nuovaChiave.chiave}</code>
          </div>
        )}

        {chiaviAttive.length > 0 ? (
          <ul className="space-y-1">
            {chiaviAttive.map((c) => (
              <li
                key={c.id}
                className="tocco-riga flex flex-wrap items-center justify-between gap-2 rounded-lg bg-b58-cream px-3 testo-sala text-b58-charcoal"
              >
                <span className="min-w-0">
                  {c.nome} — {c.ultimo_battito ? `ultimo segnale ${ora(c.ultimo_battito)}` : "mai collegato"}
                  {c.versione ? ` · versione ${c.versione}` : ""}
                </span>
                <button
                  type="button"
                  disabled={inCorso}
                  onClick={() => gesto(() => revocaChiavePonte(c.id)).then(() => setNuovaChiave(null))}
                  className="tocco-riga rounded-lg px-3 text-b58-terracotta-dark-testo"
                >
                  Togli
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <button
            type="button"
            disabled={inCorso}
            onClick={() => gesto(async () => setNuovaChiave(await creaChiavePonte("Mini-PC ristorante")))}
            className="tocco-riga rounded-lg bg-b58-azione hover:bg-b58-azione-dark px-4 testo-sala font-medium text-b58-sul-colore"
          >
            Crea la chiave del ponte
          </button>
        )}
      </section>

      <section className="rounded-xl bg-b58-parchment ring-1 ring-b58-charcoal/10 p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="testo-sala font-medium uppercase tracking-wide text-b58-charcoal-soft">2 · Gli apparecchi</h2>
          {!scheda && (
            <button
              type="button"
              onClick={() => setScheda(nuovoApparecchio())}
              className="tocco-riga rounded-lg bg-b58-azione hover:bg-b58-azione-dark px-4 testo-sala font-medium text-b58-sul-colore"
            >
              Aggiungi un apparecchio
            </button>
          )}
        </div>

        {scheda && (
          <SchedaApparecchio
            valore={scheda}
            onCambia={setScheda}
            inCorso={inCorso}
            onSalva={() => gesto(() => salvaDispositivo(scheda)).then((ok) => ok && setScheda(null))}
            onAnnulla={() => setScheda(null)}
          />
        )}

        {apparecchi === null ? (
          <p className="testo-sala text-b58-charcoal-soft">Carico…</p>
        ) : apparecchi.length === 0 ? (
          <p className="testo-sala text-b58-charcoal-soft">
            Nessun apparecchio. Il giorno del collaudo il fornitore ti dice l'indirizzo di ognuno.
          </p>
        ) : (
          <ul className="space-y-2">
            {apparecchi.map((a) => (
              <li key={a.id} data-apparecchio={a.nome} className="rounded-lg bg-b58-cream p-3 space-y-2">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="min-w-0 font-medium text-b58-charcoal">
                    {a.nome}
                    {!a.attivo && <span className="ml-2 text-b58-charcoal-soft">(spento nel gestionale)</span>}
                  </span>
                  <span data-stato-apparecchio={a.ultimo_stato} className="text-b58-charcoal-soft">
                    {STATI_APPARECCHIO[a.ultimo_stato] ?? a.ultimo_stato} · ultimo contatto {ora(a.ultimo_contatto_il)}
                  </span>
                </div>
                <p className="text-b58-charcoal-soft break-words">
                  {TIPI.find((t) => t.value === a.tipo)?.label}
                  {a.reparto ? ` · ${a.reparto}` : ""} · {a.indirizzo}:{a.porta} ·{" "}
                  {PROTOCOLLI[a.tipo]?.find((p) => p.value === a.protocollo)?.label ?? a.protocollo}
                </p>
                {a.ultimo_stato_testo && <p className="text-b58-terracotta-dark-testo">{a.ultimo_stato_testo}</p>}
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={inCorso || !a.attivo}
                    onClick={() => gesto(() => chiediLavoro(a.id, "prova"))}
                    className="tocco-riga rounded-lg bg-b58-azione hover:bg-b58-azione-dark px-4 font-medium text-b58-sul-colore disabled:opacity-50"
                  >
                    Prova di stampa
                  </button>
                  <button
                    type="button"
                    disabled={inCorso || !a.attivo}
                    onClick={() => gesto(() => chiediLavoro(a.id, "stato"))}
                    className="tocco-riga rounded-lg ring-1 ring-b58-charcoal/20 px-4 text-b58-charcoal disabled:opacity-50"
                  >
                    Leggi lo stato
                  </button>
                  <button
                    type="button"
                    onClick={() => setScheda({ ...a, indirizzo: String(a.indirizzo) })}
                    className="tocco-riga rounded-lg px-3 text-b58-azione-testo"
                  >
                    Modifica
                  </button>
                  <ConfermaDistruttiva
                    etichetta="Togli"
                    cosaSparisce={`«${a.nome}» e le sue prove`}
                    etichettaConferma="Sì, togli"
                    disabilitato={inCorso}
                    onConferma={() => gesto(() => togliDispositivo(a.id))}
                  />
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-xl bg-b58-parchment ring-1 ring-b58-charcoal/10 p-4 space-y-3">
        <h2 className="testo-sala font-medium uppercase tracking-wide text-b58-charcoal-soft">3 · Le ultime prove</h2>
        {lavori.length === 0 ? (
          <p className="testo-sala text-b58-charcoal-soft">Ancora nessuna prova.</p>
        ) : (
          <ul className="space-y-1">
            {lavori.map((l) => (
              <li
                key={l.id}
                data-lavoro={l.stato}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-b58-cream px-3 py-2 text-b58-charcoal"
              >
                <span className="min-w-0">
                  {ora(l.creato_il)} · {nomeDi(l.dispositivo_id)} · {NOMI_DEI_LAVORI[l.tipo] ?? l.tipo} —{" "}
                  <b>{STATI_LAVORO[l.stato] ?? l.stato}</b>
                  {l.errore_testo && <span className="block text-b58-terracotta-dark-testo">{l.errore_testo}</span>}
                </span>
                {(l.stato === "in_coda" || l.stato === "incerto") && (
                  <button
                    type="button"
                    disabled={inCorso}
                    onClick={() => gesto(() => annullaLavoro(l.id))}
                    className="tocco-riga rounded-lg px-3 text-b58-terracotta-dark-testo"
                  >
                    {l.stato === "incerto" ? "Ho guardato, chiudi" : "Annulla"}
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function SchedaApparecchio({ valore, onCambia, onSalva, onAnnulla, inCorso }) {
  const metti = (campi) => onCambia({ ...valore, ...campi });
  const protocolli = PROTOCOLLI[valore.tipo];

  const cambiaTipo = (tipo) => {
    const p = PROTOCOLLI[tipo][0];
    metti({ tipo, protocollo: p.value, porta: p.porta, reparto: tipo === "stampante_comande" ? valore.reparto ?? "cucina" : null });
  };
  const cambiaProtocollo = (protocollo) => {
    const p = protocolli.find((x) => x.value === protocollo);
    metti({ protocollo, porta: p.porta, indirizzo: protocollo === "simulatore" && !valore.indirizzo ? "127.0.0.1" : valore.indirizzo });
  };

  const campo = "tocco-riga w-full min-w-0 rounded-lg border border-b58-charcoal/15 bg-b58-campo px-3 testo-sala text-b58-charcoal";

  return (
    <form
      data-scheda-apparecchio
      className="rounded-lg border border-b58-charcoal/15 bg-b58-cream p-3 space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        onSalva();
      }}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block space-y-1">
          <span className="text-b58-charcoal-soft">Nome</span>
          <input
            required
            value={valore.nome}
            onChange={(e) => metti({ nome: e.target.value })}
            placeholder="Stampante cucina"
            className={campo}
          />
        </label>
        <label className="block space-y-1">
          <span className="text-b58-charcoal-soft">Che cos'è</span>
          <select value={valore.tipo} onChange={(e) => cambiaTipo(e.target.value)} className={campo}>
            {TIPI.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </label>
        <label className="block space-y-1">
          <span className="text-b58-charcoal-soft">Modello</span>
          <select value={valore.protocollo} onChange={(e) => cambiaProtocollo(e.target.value)} className={campo}>
            {protocolli.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </select>
        </label>
        {valore.tipo === "stampante_comande" && (
          <label className="block space-y-1">
            <span className="text-b58-charcoal-soft">Stampa i biglietti di</span>
            <select value={valore.reparto ?? "cucina"} onChange={(e) => metti({ reparto: e.target.value })} className={campo}>
              <option value="cucina">Cucina</option>
              <option value="bar">Bar</option>
            </select>
          </label>
        )}
        <label className="block space-y-1">
          <span className="text-b58-charcoal-soft">Indirizzo IP</span>
          <input
            required
            inputMode="decimal"
            value={valore.indirizzo}
            onChange={(e) => metti({ indirizzo: e.target.value })}
            placeholder="192.168.1.50"
            className={campo}
          />
        </label>
        <label className="block space-y-1">
          <span className="text-b58-charcoal-soft">Porta</span>
          <input
            required
            inputMode="numeric"
            value={valore.porta}
            onChange={(e) => metti({ porta: e.target.value })}
            className={campo}
          />
        </label>
      </div>
      <label className="flex items-center gap-2 text-b58-charcoal">
        <input type="checkbox" checked={valore.attivo} onChange={(e) => metti({ attivo: e.target.checked })} />
        Acceso nel gestionale
      </label>
      <div className="flex flex-wrap gap-2">
        <button
          type="submit"
          disabled={inCorso}
          className="tocco-riga rounded-lg bg-b58-azione hover:bg-b58-azione-dark px-4 font-medium text-b58-sul-colore"
        >
          {valore.id ? "Salva le modifiche" : "Aggiungi"}
        </button>
        <button type="button" onClick={onAnnulla} className="tocco-riga rounded-lg px-3 text-b58-charcoal">
          Annulla
        </button>
      </div>
    </form>
  );
}
