import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { archiviaVoce, cambiaApertura, collegaSpesa, leggiPiano, leggiSpeso, salvaVoce, scollegaSpesa } from "../../lib/api/pianoInvestimento";
import { formatEUR } from "../../lib/constants";
import DatoNonLetto from "../../components/DatoNonLetto";
import Didascalia from "../../components/Didascalia";
import {
  ALIQUOTE,
  DILAZIONI,
  GRUPPI,
  STATI,
  ULTIMO_MESE,
  esitoVoce,
  fabbisognoPerMese,
  importoNelCampo,
  leggiImporto,
  leggiRata,
  meseDellaRata,
  nettoDi,
  nomeDellaSpesa,
  quadra,
  spesoDelPiano,
  totaliDelPiano,
} from "../../lib/calcoli/pianoInvestimento";

// =====================================================================
// IL PIANO DELL'INVESTIMENTO — parte 2, 07/11/2026
// =====================================================================
// 🔴 LA DOMANDA: *quanto avevo previsto, voce per voce, e quando lo pago?*
//    È una simulazione (scelta di Alessio del 07/11): si aggiusta man mano,
//    e una voce con le rate che non tornano si salva lo stesso — il ✗ resta
//    in vista finché non la sistemi.
//
// 🔴 LO SPESO (parte 5, 07/11): le spese segnate «investimento» si
//    collegano a mano alla voce, dentro la voce aperta. Quelle non ancora
//    collegate stanno nella riga «da assegnare». Se lo speso non si legge,
//    o non torna col «Costo del progetto», la pagina lo dice: niente speso
//    a zero che si leggerebbe «non ho speso niente».
// ⚠️ IL «RISPARMIO» NON C'È ANCORA: serve sapere che le rate sono chiuse,
//    e arriva con le rate nello scadenziario (parte 7).
//
// ⚠️ GLI IMPORTI SI SCRIVONO ALL'ITALIANA («16.000», «1.500,50») e li legge
//    `leggiImporto`: un importo che non si capisce FERMA il salvataggio,
//    non diventa zero.
//
// ⚠️ UN MODULO ALLA VOLTA, e mentre è aperto il resto della pagina non lo
//    chiude: aprire un'altra voce, cambiare la data o riprendere una voce
//    archiviata butterebbe via, senza avviso, quello che si stava scrivendo.

const STATO_PAROLE = { stimato: "Stimato", preventivato: "Preventivato", confermato: "Confermato" };
const DILAZIONE_PAROLE = { nessuna: "Nessuna", stimata: "Stimata", confermata: "Confermata" };
const MESI_DEL_MODULO = Array.from({ length: ULTIMO_MESE + 1 }, (_, i) => i);

const inputClass =
  "w-full tocco-campo rounded-lg border border-b58-charcoal/15 bg-b58-campo px-3 py-2 testo-sala text-b58-charcoal focus:outline-none focus:ring-2 focus:ring-b58-terracotta";
const labelClass = "block testo-sala font-medium uppercase tracking-wide text-b58-charcoal-soft mb-1.5";
const bottone =
  "tocco-bottone rounded-lg border border-b58-charcoal/15 px-3 testo-sala text-b58-charcoal hover:bg-b58-cream-dark disabled:opacity-50";
const bottonePrimario =
  "tocco-bottone rounded-lg bg-b58-azione px-4 testo-sala font-medium text-white hover:opacity-90 disabled:opacity-50";

function voceVuota(gruppo) {
  return { gruppo, descrizione: "", importo_ivato: "", aliquota_iva: 22, stato: "stimato", dilazione: "nessuna", nota: "" };
}

/** Il ✓ o il ✗, con le parole per chi non vede il segno. */
function Quadra({ conto, dataProva }) {
  const parole = conto.quadra
    ? "Le rate fanno il totale"
    : conto.mancano > 0
      ? `Mancano ${formatEUR(conto.mancano)}`
      : `Le rate superano il totale di ${formatEUR(-conto.mancano)}`;
  return (
    <span data-prova={dataProva} title={parole} className={conto.quadra ? "text-b58-olive-dark-testo" : "text-b58-terracotta-dark-testo"}>
      <span aria-hidden="true">{conto.quadra ? "✓" : "✗"}</span>
      <span className="sr-only">{parole}</span>
    </span>
  );
}

/** Il pannello per scrivere o cambiare una voce, con l'acconto e le rate. */
function ModuloVoce({ iniziale, rateIniziali, meseApertura, onSalvato, onAnnulla, onArchivia, blocco }) {
  const [voce, setVoce] = useState(() => ({ ...iniziale, importo_ivato: importoNelCampo(iniziale.importo_ivato) }));
  const [rate, setRate] = useState(() =>
    Object.fromEntries((rateIniziali ?? []).map((r) => [r.mese_rel, importoNelCampo(r.importo)]))
  );
  const [errore, setErrore] = useState("");
  const [salvo, setSalvo] = useState(false);
  const proprio = useRef(false);
  // Lo stesso blocco dei collegamenti della voce, quando c'è.
  const occupato = blocco ?? proprio;

  const importo = leggiImporto(voce.importo_ivato);
  // Una rata è un importo o una percentuale del previsto (07/11): la
  // percentuale si mostra in euro accanto, e al salvataggio va l'importo.
  const letture = MESI_DEL_MODULO.map((m) => {
    const testo = rate[m] ?? "";
    const letta = leggiRata(testo, importo);
    return { mese_rel: m, testo, importo: letta?.importo ?? null, percentuale: letta?.percentuale ?? null };
  });
  const rateSbagliate = letture.filter((r) => r.testo.trim() !== "" && r.importo === null);
  const elencoRate = letture.map((r) => ({ mese_rel: r.mese_rel, importo: r.importo ?? 0 }));
  const conto = quadra({ importo_ivato: importo ?? 0 }, elencoRate);

  async function salva(e) {
    e.preventDefault();
    if (occupato.current) return;
    if (!voce.descrizione.trim()) return setErrore("Scrivi il nome della voce.");
    if (importo === null) return setErrore("Scrivi quanto prevedi di spendere, IVA inclusa (per esempio 16.000 oppure 1.500,50).");
    if (rateSbagliate.length > 0) {
      const nomi = rateSbagliate.map((r) => meseDellaRata(meseApertura, r.mese_rel).etichetta).join(", ");
      return setErrore(
        `Non capisco la rata di: ${nomi}. Scrivi un importo (2.000 oppure 1.500,50) o una percentuale del previsto (50%), fino al 100%.`
      );
    }
    occupato.current = true;
    setSalvo(true);
    setErrore("");
    try {
      await salvaVoce({ ...voce, importo_ivato: importo }, elencoRate);
      onSalvato();
    } catch (err) {
      // La voce nuova esiste già anche se le rate si sono fermate: da qui in
      // poi si riprova con un aggiornamento, non con una voce doppia.
      if (err.idVoce && !voce.id) setVoce((v) => ({ ...v, id: err.idVoce }));
      setErrore(`Non ho salvato tutto: ${err.message}. Controlla le rate e premi di nuovo «Salva la voce».`);
    } finally {
      occupato.current = false;
      setSalvo(false);
    }
  }

  return (
    <form onSubmit={salva} data-prova="modulo-voce" className="rounded-xl bg-b58-campo ring-1 ring-b58-charcoal/15 p-4 space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className={labelClass} htmlFor="voce-nome">Voce</label>
          {/* oxlint-disable-next-line jsx-a11y/no-autofocus -- si apre con un tocco su «Modifica»: il fuoco va dove si scrive */}
          <input id="voce-nome" autoFocus className={inputClass} value={voce.descrizione} onChange={(e) => setVoce({ ...voce, descrizione: e.target.value })} />
        </div>
        <div>
          <label className={labelClass} htmlFor="voce-gruppo">Gruppo</label>
          <select id="voce-gruppo" className={inputClass} value={voce.gruppo} onChange={(e) => setVoce({ ...voce, gruppo: e.target.value })}>
            {GRUPPI.map((g) => <option key={g.codice} value={g.codice}>{g.codice}. {g.nome}</option>)}
          </select>
        </div>
        <div>
          <label className={labelClass} htmlFor="voce-importo">Previsto, IVA inclusa (€)</label>
          <input id="voce-importo" inputMode="decimal" className={inputClass} value={voce.importo_ivato} onChange={(e) => setVoce({ ...voce, importo_ivato: e.target.value })} />
        </div>
        <div>
          <label className={labelClass} htmlFor="voce-iva">IVA</label>
          <select id="voce-iva" className={inputClass} value={voce.aliquota_iva} onChange={(e) => setVoce({ ...voce, aliquota_iva: Number(e.target.value) })}>
            {ALIQUOTE.map((a) => <option key={a} value={a}>{a === 0 ? "Senza IVA" : `${a}%`}</option>)}
          </select>
          <p className="testo-sala text-b58-charcoal-soft mt-1" data-prova="netto">
            Netto: {importo === null ? "—" : formatEUR(nettoDi(importo, voce.aliquota_iva))}
          </p>
        </div>
        <div>
          <label className={labelClass} htmlFor="voce-stato">Stato</label>
          <select id="voce-stato" className={inputClass} value={voce.stato} onChange={(e) => setVoce({ ...voce, stato: e.target.value })}>
            {STATI.map((s) => <option key={s} value={s}>{STATO_PAROLE[s]}</option>)}
          </select>
        </div>
        <div>
          <label className={labelClass} htmlFor="voce-dilazione">Dilazione</label>
          <select id="voce-dilazione" className={inputClass} value={voce.dilazione} onChange={(e) => setVoce({ ...voce, dilazione: e.target.value })}>
            {DILAZIONI.map((d) => <option key={d} value={d}>{DILAZIONE_PAROLE[d]}</option>)}
          </select>
        </div>
      </div>

      <fieldset>
        <legend className={labelClass}>Come la paghi</legend>
        <p className="testo-sala text-b58-charcoal-soft mb-2">In euro (2.000) oppure in percentuale del previsto (50%).</p>
        <div className="grid gap-2 grid-cols-2 sm:grid-cols-4">
          {letture.map((r) => (
            <div key={r.mese_rel}>
              <label className="block testo-sala text-b58-charcoal-soft mb-1" htmlFor={`rata-${r.mese_rel}`}>{meseDellaRata(meseApertura, r.mese_rel).etichetta}</label>
              {/* inputMode «text» e non «decimal»: sul telefono la tastiera dei numeri non ha il «%». */}
              <input
                id={`rata-${r.mese_rel}`}
                inputMode="text"
                className={inputClass}
                value={rate[r.mese_rel] ?? ""}
                onChange={(e) => setRate({ ...rate, [r.mese_rel]: e.target.value })}
              />
              {r.percentuale !== null && (
                <p data-prova="rata-in-euro" className="testo-sala text-b58-charcoal-soft mt-1">= {formatEUR(r.importo)}</p>
              )}
            </div>
          ))}
        </div>
        <p data-prova="quadra-modulo" aria-live="polite" className={`mt-2 testo-sala ${conto.quadra ? "text-b58-olive-dark-testo" : "text-b58-terracotta-dark-testo"}`}>
          {conto.quadra
            ? "✓ Le rate fanno il totale."
            : conto.mancano > 0
              ? `✗ Da distribuire ancora ${formatEUR(conto.mancano)}. Puoi salvare lo stesso.`
              : `✗ Le rate superano il totale di ${formatEUR(-conto.mancano)}. Puoi salvare lo stesso.`}
        </p>
      </fieldset>

      <div>
        <label className={labelClass} htmlFor="voce-nota">Nota</label>
        <input id="voce-nota" className={inputClass} value={voce.nota ?? ""} onChange={(e) => setVoce({ ...voce, nota: e.target.value })} />
      </div>

      {errore && <p role="alert" className="testo-sala text-b58-terracotta-dark-testo">{errore}</p>}
      <div className="flex gap-2 flex-wrap">
        <button type="submit" className={bottonePrimario} disabled={salvo}>{salvo ? "Salvo…" : "Salva la voce"}</button>
        <button type="button" className={bottone} onClick={onAnnulla} disabled={salvo}>Annulla</button>
        {/* Archiviare si disfa con «Riprendi»: niente conferma (ConfermaDistruttiva, punto 2). */}
        {voce.id && onArchivia && (
          <button type="button" className={`${bottone} ml-auto`} onClick={() => onArchivia(voce.id)} disabled={salvo}>Archivia la voce</button>
        )}
      </div>
    </form>
  );
}

/** Lo speso di una voce e come sta rispetto al previsto, in parole. */
function SpesoDellaVoce({ voce, conto }) {
  // Una fattura pagata il cui pagamento non è collegato non conta: si dice.
  const avviso = conto?.scollegate > 0 && (
    <span data-prova="fattura-scollegata" className="block testo-sala text-b58-terracotta-dark-testo">
      {conto.scollegate === 1 ? "Una fattura collegata è già pagata" : `${conto.scollegate} fatture collegate sono già pagate`}: collega anche il pagamento, se no non conta.
    </span>
  );
  if (!conto || (conto.speso === 0 && conto.impegnato === 0)) {
    return (
      <>
        <span data-prova="speso-voce" className="testo-sala text-b58-charcoal-soft">niente speso</span>
        {avviso}
      </>
    );
  }
  const e = esitoVoce({ previsto: voce.importo_ivato, speso: conto.speso, impegnato: conto.impegnato });
  const parole = {
    sforato: `sforato di ${formatEUR(e.differenza)}`,
    a_rischio: `con le fatture da pagare supera di ${formatEUR(e.differenza)}`,
    in_linea: `restano ${formatEUR(e.differenza)}`,
    risparmio: `risparmio di ${formatEUR(e.differenza)}`,
  }[e.esito];
  const colore = e.esito === "sforato" || e.esito === "a_rischio" ? "text-b58-terracotta-dark-testo" : "text-b58-charcoal-soft";
  return (
    <>
      <span data-prova="speso-voce" data-esito={e.esito} className={`testo-sala ${colore}`}>
        spesi {formatEUR(conto.speso)}
        {conto.impegnato > 0 && ` + ${formatEUR(conto.impegnato)} da pagare`} · {parole}
      </span>
      {avviso}
    </>
  );
}

/**
 * Le spese vere collegate a una voce, e il modo di collegarne un'altra.
 * 🔴 SEMPRE A MANO (scelta di Alessio del 07/11): si sceglie una spesa fra
 *    quelle segnate «investimento» con qualcosa ancora da assegnare, e
 *    quanta parte va su questa voce. I controlli veri li fa il database.
 */
function CollegamentiVoce({ voce, rate, collegamenti, spese, daAssegnare, meseApertura, onCambiato, blocco }) {
  const [sceltaScritta, setScelta] = useState("");
  const [importo, setImporto] = useState("");
  const [rata, setRata] = useState("");
  const [errore, setErrore] = useState("");
  const [lavoro, setLavoro] = useState(false);
  // 🔴 UN GESTO ALLA VOLTA IN TUTTA LA VOCE (revisione ecc:react-reviewer
  //    del 07/11): il blocco è lo stesso di «Salva la voce», così un
  //    collegamento non parte mentre la voce si salva e si chiude.
  const occupato = blocco;

  const perId = useMemo(() => new Map((spese ?? []).map((s) => [`${s.fonte}:${s.id}`, s])), [spese]);
  const disponibili = daAssegnare ?? [];
  const spesaScelta = disponibili.find((s) => `${s.fonte}:${s.id}` === sceltaScritta);
  // Se la spesa scelta non c'è più (riletta, assegnata altrove), la scelta si azzera.
  const scelta = spesaScelta ? sceltaScritta : "";

  function nomeDelCollegamento(c) {
    if (c.cash_movement_id) return nomeDellaSpesa(perId.get(`prima_nota:${c.cash_movement_id}`) ?? { fonte: "prima_nota" });
    if (c.anticipazione_id) return nomeDellaSpesa(perId.get(`anticipazione:${c.anticipazione_id}`) ?? { fonte: "anticipazione" });
    return "Fattura da pagare";
  }

  async function gesto(fn) {
    if (occupato.current) return;
    occupato.current = true;
    setLavoro(true);
    setErrore("");
    try {
      await fn();
      // Si aspetta la rilettura: fino ad allora i pulsanti restano fermi, e
      // nessuno tocca una riga già tolta o un resto vecchio.
      await onCambiato();
      return true;
    } catch (e) {
      setErrore(e.message);
      return false;
    } finally {
      occupato.current = false;
      setLavoro(false);
    }
  }

  async function collega(e) {
    e.preventDefault();
    if (!spesaScelta) return setErrore("Scegli la spesa da collegare.");
    const quanto = leggiImporto(importo);
    if (quanto === null || quanto <= 0) return setErrore("Scrivi quanta parte della spesa va su questa voce (per esempio 1.500,50).");
    if (quanto > spesaScelta.resto) {
      return setErrore(`Di questa spesa restano da assegnare ${formatEUR(spesaScelta.resto)}: non puoi metterne ${formatEUR(quanto)}.`);
    }
    const fatto = await gesto(() => collegaSpesa({ voceId: voce.id, rataId: rata, spesa: spesaScelta, importo: quanto }));
    if (fatto) {
      setScelta("");
      setImporto("");
      setRata("");
    }
  }

  const etichettaRata = (id) => {
    const r = (rate ?? []).find((x) => x.id === id);
    return r ? meseDellaRata(meseApertura, r.mese_rel).etichetta : null;
  };

  return (
    <section data-prova="collegamenti" aria-label={`Spese collegate a ${voce.descrizione}`} className="mt-3 rounded-xl ring-1 ring-b58-charcoal/15 p-4 space-y-3">
      <h3 className="font-display text-b58-charcoal">Spese collegate</h3>
      {collegamenti.length === 0 ? (
        <p className="testo-sala text-b58-charcoal-soft">Nessuna spesa collegata a questa voce.</p>
      ) : (
        <ul className="divide-y divide-b58-charcoal/10">
          {collegamenti.map((c) => (
            <li key={c.id} data-prova="collegamento" className="py-2 flex items-center justify-between gap-3 flex-wrap">
              <span className="min-w-0 text-b58-charcoal">
                {nomeDelCollegamento(c)}
                {c.rata_id && etichettaRata(c.rata_id) && <span className="text-b58-charcoal-soft"> · rata di {etichettaRata(c.rata_id)}</span>}
              </span>
              <span className="flex items-center gap-3">
                <span className="text-b58-charcoal">{formatEUR(c.importo_attribuito)}</span>
                {/* Togliere si disfa ricollegando: niente conferma (ConfermaDistruttiva, punto 2). */}
                <button type="button" className={bottone} disabled={lavoro} onClick={() => gesto(() => scollegaSpesa(c.id))}>
                  Togli<span className="sr-only"> {nomeDelCollegamento(c)}</span>
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}

      {disponibili.length === 0 ? (
        <p className="testo-sala text-b58-charcoal-soft">
          Non ci sono spese segnate «investimento» ancora da assegnare. Una spesa si segna in Prima nota o negli Anticipi.
        </p>
      ) : (
        <form onSubmit={collega} data-prova="collega" className="grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className={labelClass} htmlFor={`spesa-${voce.id}`}>Spesa da collegare</label>
            <select
              id={`spesa-${voce.id}`}
              className={inputClass}
              value={scelta}
              aria-describedby={errore ? `errore-coll-${voce.id}` : undefined}
              onChange={(e) => {
                setErrore("");
                setScelta(e.target.value);
                const s = disponibili.find((x) => `${x.fonte}:${x.id}` === e.target.value);
                setImporto(s ? importoNelCampo(s.resto) : "");
              }}
            >
              <option value="">Scegli…</option>
              {disponibili.map((s) => (
                <option key={`${s.fonte}:${s.id}`} value={`${s.fonte}:${s.id}`}>
                  {nomeDellaSpesa(s)} · da assegnare {formatEUR(s.resto)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass} htmlFor={`parte-${voce.id}`}>Parte su questa voce (€)</label>
            <input
              id={`parte-${voce.id}`}
              inputMode="decimal"
              className={inputClass}
              value={importo}
              aria-describedby={errore ? `errore-coll-${voce.id}` : undefined}
              onChange={(e) => {
                setErrore("");
                setImporto(e.target.value);
              }}
            />
          </div>
          <div>
            <label className={labelClass} htmlFor={`rata-coll-${voce.id}`}>Quale rata paga</label>
            <select id={`rata-coll-${voce.id}`} className={inputClass} value={rata} onChange={(e) => setRata(e.target.value)}>
              <option value="">Nessuna in particolare</option>
              {(rate ?? []).filter((r) => r.id).map((r) => (
                <option key={r.id} value={r.id}>{meseDellaRata(meseApertura, r.mese_rel).etichetta} · {formatEUR(r.importo)}</option>
              ))}
            </select>
          </div>
          <div className="sm:col-span-2">
            <button type="submit" className={bottonePrimario} disabled={lavoro}>{lavoro ? "Collego…" : "Collega la spesa"}</button>
          </div>
        </form>
      )}
      {errore && <p role="alert" id={`errore-coll-${voce.id}`} className="testo-sala text-b58-terracotta-dark-testo">{errore}</p>}
    </section>
  );
}

/** La data dell'apertura: si cambia con il suo pulsante, non uscendo dal campo. */
function MeseApertura({ salvato, bloccato, onCambia }) {
  const [valore, setValore] = useState(String(salvato).slice(0, 7));
  const cambiato = valore && `${valore}-01` !== salvato;
  return (
    <div>
      <label className={labelClass} htmlFor="mese-apertura">Mese dell'apertura</label>
      <div className="flex gap-2">
        <input
          id="mese-apertura"
          type="month"
          placeholder="2027-04"
          className={`${inputClass} campo-mese`}
          value={valore}
          disabled={bloccato}
          onChange={(e) => setValore(e.target.value)}
        />
        {cambiato && (
          <button
            type="button"
            className={bottone}
            disabled={bloccato || !/^\d{4}-\d{2}$/.test(valore)}
            onClick={() => onCambia(`${valore}-01`, () => setValore(String(salvato).slice(0, 7)))}
          >
            Salva la data
          </button>
        )}
      </div>
      {bloccato && <p className="testo-sala text-b58-charcoal-soft mt-1">Chiudi prima la voce che stai scrivendo.</p>}
    </div>
  );
}

export default function PianoInvestimento() {
  const [piano, setPiano] = useState(null);
  const [error, setError] = useState("");
  const [giro, setGiro] = useState(0);
  const [aperta, setAperta] = useState(null); // la voce in modifica, o una nuova
  const [avviso, setAvviso] = useState("");
  const occupato = useRef(false);

  useEffect(() => {
    let vivo = true;
    setError("");
    leggiPiano()
      .then((p) => vivo && setPiano(p))
      .catch((e) => {
        if (!vivo) return;
        setPiano(null);
        setError(e.message);
      });
    return () => {
      vivo = false;
    };
  }, [giro]);

  // Lo speso si legge a parte: se non arriva, il previsto resta in vista e
  // la pagina dice che lo speso non è stato letto (non che è zero).
  const [letturaSpeso, setLetturaSpeso] = useState(null);
  const [erroreSpeso, setErroreSpeso] = useState("");
  const [giroSpeso, setGiroSpeso] = useState(0);
  // Chi ha chiesto una rilettura (un collegamento appena fatto) aspetta qui
  // che finisca: vedi CollegamentiVoce.
  const inAttesa = useRef([]);
  // Il blocco unico della voce aperta: salvare la voce, collegare, togliere.
  const bloccoVoce = useRef(false);
  useEffect(() => {
    let vivo = true;
    setErroreSpeso("");
    const sveglia = () => {
      for (const r of inAttesa.current.splice(0)) r();
    };
    leggiSpeso()
      .then((s) => vivo && setLetturaSpeso(s))
      .catch((e) => {
        if (!vivo) return;
        setLetturaSpeso(null);
        setErroreSpeso(e.message);
      })
      .finally(() => vivo && sveglia());
    return () => {
      vivo = false;
    };
  }, [giro, giroSpeso]);
  const rileggiSpeso = () =>
    new Promise((risolvi) => {
      inAttesa.current.push(risolvi);
      setGiroSpeso((g) => g + 1);
    });
  const conti = useMemo(() => (letturaSpeso ? spesoDelPiano(letturaSpeso) : null), [letturaSpeso]);
  const collegamentiPerVoce = useMemo(() => {
    const m = new Map();
    for (const c of letturaSpeso?.collegamenti ?? []) m.set(c.voce_id, [...(m.get(c.voce_id) ?? []), c]);
    return m;
  }, [letturaSpeso]);

  const ratePerVoce = useMemo(() => {
    const m = new Map();
    for (const r of piano?.rate ?? []) m.set(r.voce_id, [...(m.get(r.voce_id) ?? []), r]);
    return m;
  }, [piano]);
  const vive = useMemo(() => (piano?.voci ?? []).filter((v) => !v.archiviata_il), [piano]);
  const archiviate = useMemo(() => (piano?.voci ?? []).filter((v) => v.archiviata_il), [piano]);
  const totali = useMemo(
    () => totaliDelPiano(vive.map((v) => ({ ...v, speso: conti?.perVoce.get(v.id)?.speso ?? 0, impegnato: conti?.perVoce.get(v.id)?.impegnato ?? 0 }))),
    [vive, conti]
  );
  const nonQuadrano = useMemo(() => vive.filter((v) => !quadra(v, ratePerVoce.get(v.id)).quadra), [vive, ratePerVoce]);
  const mesi = useMemo(() => (piano ? fabbisognoPerMese(piano.meseApertura, vive, piano.rate) : []), [piano, vive]);

  // ⚠️ Il piano vecchio resta in vista mentre si rilegge: niente pagina che
  //    lampeggia e niente scorrimento perso dopo ogni salvataggio.
  const ricarica = () => setGiro((g) => g + 1);
  const chiudiERicarica = () => {
    setAperta(null);
    ricarica();
  };

  async function gesto(fn, seFallisce) {
    if (occupato.current) return;
    occupato.current = true;
    setAvviso("");
    try {
      await fn();
      ricarica();
    } catch (e) {
      setAvviso(e.message);
      seFallisce?.();
    } finally {
      occupato.current = false;
    }
  }

  const inModifica = aperta !== null;

  return (
    <div className="testo-sala max-w-5xl mx-auto pb-16">
      <div className="flex items-start justify-between gap-4 flex-wrap mb-4">
        <Link to="/cassa/costo-progetto" className="tocco-bottone inline-flex items-center testo-sala text-b58-charcoal-soft hover:text-b58-terracotta-testo">
          ← Quanto è costato il progetto
        </Link>
      </div>

      <h1 className="font-display text-2xl text-b58-charcoal mb-4 inline-flex items-start gap-2 flex-wrap">
        Piano dell'investimento
        <Didascalia etichetta="Come si legge questa pagina">
          È la tua simulazione: quanto prevedi di spendere per ogni voce, IVA inclusa, e quando
          lo paghi. L'<strong>acconto</strong> è quello che paghi prima di aprire; poi i mesi
          dall'apertura. Se l'apertura slitta, cambia la data qui sotto e tutte le rate si spostano.
          <br />
          <br />
          Il <strong>✓</strong> dice che l'acconto e le rate fanno il totale della voce; il
          <strong> ✗</strong> che manca qualcosa o c'è di troppo.
          <br />
          <br />
          Lo <strong>speso</strong> sono le spese segnate «investimento» che hai collegato alla voce:
          apri la voce con «Modifica» e scegli la spesa. Quelle non ancora collegate stanno in
          «Spese da assegnare».
        </Didascalia>
      </h1>

      {!piano && !error && <p className="testo-sala text-b58-charcoal-soft">Caricamento…</p>}

      {error && (
        <DatoNonLetto
          cosa="il piano dell'investimento"
          nonVuolDire="Non vuol dire che il piano è vuoto: vuol dire che non l'ho letto."
          onRiprova={ricarica}
        />
      )}

      {!error && piano && (
        <div className="space-y-6">
          {avviso && <p role="alert" className="testo-sala text-b58-terracotta-dark-testo bg-b58-terracotta/10 rounded-lg px-3 py-2">{avviso}</p>}

          <div className="rounded-xl bg-b58-parchment ring-1 ring-b58-charcoal/10 p-6 grid gap-4 sm:grid-cols-3">
            <div>
              <p className="text-b58-charcoal-soft">Previsto in tutto</p>
              <p data-prova="previsto-totale" className="font-display text-2xl text-b58-charcoal">{formatEUR(totali.totale.previsto)}</p>
              <p className="testo-sala text-b58-charcoal-soft">IVA inclusa · {totali.totale.voci} voci</p>
            </div>
            <div>
              <p className="text-b58-charcoal-soft">Voci che non quadrano</p>
              <p data-prova="non-quadrano" className={`font-display text-2xl ${nonQuadrano.length ? "text-b58-terracotta-dark-testo" : "text-b58-olive-dark-testo"}`}>
                {nonQuadrano.length ? `✗ ${nonQuadrano.length}` : "✓ nessuna"}
              </p>
            </div>
            <MeseApertura
              key={piano.meseApertura}
              salvato={piano.meseApertura}
              bloccato={inModifica}
              onCambia={(nuovo, rimetti) => gesto(() => cambiaApertura(nuovo), rimetti)}
            />
          </div>

          {erroreSpeso ? (
            <DatoNonLetto
              cosa="lo speso del piano"
              nonVuolDire="Non vuol dire che non hai speso niente: vuol dire che non l'ho letto."
              onRiprova={() => setGiroSpeso((g) => g + 1)}
            />
          ) : !conti ? (
            <p role="status" className="testo-sala text-b58-charcoal-soft">Leggo lo speso…</p>
          ) : (
            <div data-prova="riquadro-speso" className="rounded-xl bg-b58-parchment ring-1 ring-b58-charcoal/10 p-6 grid gap-4 sm:grid-cols-3">
              <div>
                <p className="text-b58-charcoal-soft">Speso sulle voci</p>
                {/* Lo speso di tutte le voci, anche archiviate: la spesa c'è stata (revisione del 07/11). */}
                <p data-prova="speso-totale" className="font-display text-2xl text-b58-charcoal">{formatEUR(conti.spesoTotale)}</p>
                {conti.spesoTotale !== totali.totale.speso && (
                  <p data-prova="speso-archiviate" className="testo-sala text-b58-charcoal-soft">
                    di cui {formatEUR(Math.round((conti.spesoTotale - totali.totale.speso) * 100) / 100)} su voci archiviate
                  </p>
                )}
                {totali.totale.impegnato > 0 && (
                  <p className="testo-sala text-b58-charcoal-soft">più {formatEUR(totali.totale.impegnato)} di fatture da pagare</p>
                )}
              </div>
              <div>
                {/* Due numeri, non uno: un risparmio su una voce non nasconde lo sforamento di un'altra. */}
                <p className="text-b58-charcoal-soft">Voci sopra il budget</p>
                <p data-prova="sforamenti" className={`font-display text-2xl ${totali.totale.sforamenti > 0 ? "text-b58-terracotta-dark-testo" : "text-b58-olive-dark-testo"}`}>
                  {totali.totale.sforamenti > 0 ? `+ ${formatEUR(totali.totale.sforamenti)}` : "✓ nessuna"}
                </p>
              </div>
              <div>
                <p className="text-b58-charcoal-soft">Spese da assegnare</p>
                <p data-prova="da-assegnare-totale" className={`font-display text-2xl ${conti.daAssegnare.totale > 0 ? "text-b58-terracotta-dark-testo" : "text-b58-olive-dark-testo"}`}>
                  {conti.daAssegnare.totale > 0 ? formatEUR(conti.daAssegnare.totale) : "✓ nessuna"}
                </p>
              </div>
              {!conti.controllo.torna && (
                <p role="alert" data-prova="controllo-non-torna" className="sm:col-span-3 testo-sala text-b58-terracotta-dark-testo">
                  Attenzione: il «Costo del progetto» dice {formatEUR(conti.controllo.costo)}, mentre speso sulle voci più spese da
                  assegnare fa {formatEUR(conti.controllo.piano)}. Lo speso qui sotto potrebbe non essere giusto: dimmelo.
                </p>
              )}
            </div>
          )}

          {GRUPPI.map((g) => {
            const qui = vive.filter((v) => v.gruppo === g.codice);
            const t = totali.perGruppo[g.codice];
            const nuova = aperta && !aperta.id && aperta.gruppo === g.codice;
            return (
              <section key={g.codice} data-prova={`gruppo-${g.codice}`} className="rounded-xl bg-b58-parchment ring-1 ring-b58-charcoal/10 p-4 sm:p-6">
                <div className="flex items-baseline justify-between gap-3 flex-wrap mb-3">
                  <h2 className="font-display testo-sala-grande text-b58-charcoal">{g.codice}. {g.nome}</h2>
                  <span className="testo-sala text-b58-charcoal-soft">{formatEUR(t.previsto)}</span>
                </div>
                {qui.length === 0 && !nuova && <p className="testo-sala text-b58-charcoal-soft mb-3">Nessuna voce in questo gruppo.</p>}
                <ul className="divide-y divide-b58-charcoal/10">
                  {qui.map((v) => {
                    const rateVoce = ratePerVoce.get(v.id) ?? [];
                    if (aperta?.id === v.id) {
                      return (
                        <li key={v.id} className="py-3">
                          <ModuloVoce
                            iniziale={v}
                            rateIniziali={rateVoce}
                            meseApertura={piano.meseApertura}
                            onSalvato={chiudiERicarica}
                            onAnnulla={() => setAperta(null)}
                            onArchivia={(id) => gesto(async () => {
                              await archiviaVoce(id, true);
                              setAperta(null);
                            })}
                            blocco={bloccoVoce}
                          />
                          {!conti && (
                            <p role="status" className="mt-3 testo-sala text-b58-charcoal-soft">
                              {erroreSpeso ? "Lo speso non si è letto: i collegamenti tornano quando lo rileggo (vedi sopra)." : "Leggo le spese collegate…"}
                            </p>
                          )}
                          {conti && (
                            <CollegamentiVoce
                              voce={v}
                              rate={rateVoce}
                              collegamenti={collegamentiPerVoce.get(v.id) ?? []}
                              spese={letturaSpeso.spese}
                              daAssegnare={conti.daAssegnare.righe}
                              meseApertura={piano.meseApertura}
                              onCambiato={rileggiSpeso}
                              blocco={bloccoVoce}
                            />
                          )}
                        </li>
                      );
                    }
                    return (
                      <li key={v.id} data-prova="voce" className="py-3 flex items-start justify-between gap-3 flex-wrap">
                        <div className="min-w-0">
                          <p className="text-b58-charcoal font-medium">{v.descrizione}</p>
                          <p className="testo-sala text-b58-charcoal-soft">
                            {STATO_PAROLE[v.stato]} · dilazione {DILAZIONE_PAROLE[v.dilazione].toLowerCase()} · {Number(v.aliquota_iva) === 0 ? "senza IVA" : `IVA ${Number(v.aliquota_iva)}%`} · netto {formatEUR(v.netto)}
                          </p>
                          {conti && <SpesoDellaVoce voce={v} conto={conti.perVoce.get(v.id)} />}
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-b58-charcoal">{formatEUR(v.importo_ivato)}</span>
                          <Quadra conto={quadra(v, rateVoce)} dataProva="quadra-voce" />
                          <button type="button" className={bottone} disabled={inModifica} onClick={() => setAperta(v)}>
                            Modifica<span className="sr-only"> {v.descrizione}</span>
                          </button>
                        </div>
                      </li>
                    );
                  })}
                </ul>
                {nuova ? (
                  <div className="mt-3">
                    <ModuloVoce iniziale={aperta} rateIniziali={[]} meseApertura={piano.meseApertura} onSalvato={chiudiERicarica} onAnnulla={() => setAperta(null)} />
                  </div>
                ) : (
                  <button type="button" className={`${bottone} mt-3`} disabled={inModifica} onClick={() => setAperta(voceVuota(g.codice))}>
                    + Aggiungi una voce<span className="sr-only"> in {g.nome}</span>
                  </button>
                )}
              </section>
            );
          })}

          {conti && conti.daAssegnare.righe.length > 0 && (
            <section data-prova="da-assegnare" className="rounded-xl bg-b58-parchment ring-1 ring-b58-charcoal/10 p-4 sm:p-6">
              <div className="flex items-baseline justify-between gap-3 flex-wrap mb-1">
                <h2 className="font-display testo-sala-grande text-b58-charcoal">Spese da assegnare</h2>
                <span className="testo-sala text-b58-charcoal-soft">{formatEUR(conti.daAssegnare.totale)}</span>
              </div>
              <p className="testo-sala text-b58-charcoal-soft mb-3">
                Sono segnate «investimento» ma non ancora collegate a una voce, o solo in parte. Apri la voce giusta con «Modifica» e collegale lì.
              </p>
              <ul className="divide-y divide-b58-charcoal/10">
                {conti.daAssegnare.righe.map((s) => (
                  <li key={`${s.fonte}:${s.id}`} data-prova="spesa-da-assegnare" className="py-2 flex items-baseline justify-between gap-3 flex-wrap">
                    <span className="min-w-0 text-b58-charcoal">{nomeDellaSpesa(s)}</span>
                    <span className="text-b58-charcoal">
                      {formatEUR(s.resto)}
                      {Number(s.assegnato) > 0 && <span className="text-b58-charcoal-soft"> di {formatEUR(s.importo)}</span>}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section data-prova="scadenziario" className="rounded-xl bg-b58-parchment ring-1 ring-b58-charcoal/10 p-4 sm:p-6">
            <h2 className="font-display testo-sala-grande text-b58-charcoal mb-3">Quanto paghi ogni mese</h2>
            {mesi.every((m) => m.importo === 0) ? (
              <p className="testo-sala text-b58-charcoal-soft">Nessuna rata scritta: aggiungile nelle voci.</p>
            ) : (
              <ul className="divide-y divide-b58-charcoal/10">
                {mesi.map((m) => (
                  <li key={m.mese_rel} data-prova="mese" className="py-2 flex items-baseline justify-between gap-3">
                    <span className="text-b58-charcoal-soft">{m.etichetta}</span>
                    <span className="text-b58-charcoal">{formatEUR(m.importo)}</span>
                  </li>
                ))}
              </ul>
            )}
            <p className="testo-sala text-b58-charcoal-soft mt-3">
              Sono solo le rate del piano: le fatture da pagare e le altre scadenze restano nella previsione di cassa.
            </p>
          </section>

          {archiviate.length > 0 && (
            <section className="rounded-xl ring-1 ring-b58-charcoal/15 p-4">
              <h2 className="font-display text-b58-charcoal-soft mb-2">Voci archiviate</h2>
              <ul className="space-y-2">
                {archiviate.map((v) => (
                  <li key={v.id} className="flex items-center justify-between gap-3 flex-wrap">
                    <span className="text-b58-charcoal-soft">{v.descrizione} · {formatEUR(v.importo_ivato)}</span>
                    <button type="button" className={bottone} disabled={inModifica} onClick={() => gesto(() => archiviaVoce(v.id, false))}>
                      Riprendi<span className="sr-only"> {v.descrizione}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
