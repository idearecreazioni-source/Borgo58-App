import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import PiantaSala from "../../components/PiantaSala";
import { formatDate, oggiLocale } from "../../lib/constants";
import { useAuth } from "../../context/AuthContext";
import {
  getCopertiDelGiorno,
  getPiantaDelGiorno,
  getPostoPerLaSerata,
  getRegolePrenotazione,
  isSoldOut,
  promuoviDisposizione,
  rimuoviCorrezioneCoperti,
  riportaSagomaAllaBase,
  salvaCorrezioneCoperti,
  salvaSagoma,
  setSoldOut,
} from "../../lib/api/sala";
import {
  annullaPrenotazione,
  assegnaPrenotazione,
  creaPrenotazioneSuTavoli,
  listReservations,
  listTavoliPrenotatiPerData,
  togliAssegnazione,
  updateReservation,
} from "../../lib/api/reservations";

// LA SALA — la schermata in cui si prepara una serata, e in cui si prende
// una prenotazione al telefono.
//
// ⚠️ IL GESTO È «TOCCO LA SALA», NON «COMPILO UN MODULO». Alessio, dopo
// la prima prova: *«come faccio a sapere se c'è posto così?»*. La
// risposta non è un numero — è la sala disegnata. Quindi qui dentro si
// guarda dove c'è spazio, se serve si accostano due tavoli trascinandoli,
// si toccano quelli giusti e si scrive il nome. Uscire dalla pianta per
// compilare un modulo altrove e poi tornare a cercare dove metterli è il
// modo sicuro per non farlo mai.
//
// Un tocco su una sagoma vuol dire tre cose diverse, e non possono essere
// ambigue:
//   · c'è un lavoro in corso  → aggiunge o toglie il tavolo dalla scelta
//   · tavolo libero           → comincia una prenotazione nuova su quello
//   · tavolo già promesso     → apre QUELLA prenotazione, per cambiarla
//
// ⚠️ La pianta mostra TUTTA la serata, non un momento. Un tavolo
// prenotato alle 19:30 resta colorato anche se alle 22 si libera: non
// esistono turni né finestre temporali (§8 del mandato), quindi ogni
// sagoma occupata e' colorata secondo l'ora di arrivo, e l'ora esatta si
// legge nell'elenco sotto.

const NUOVA_VUOTA = { nome: "", telefono: "", persone: 2, ora: "20:00", note: "" };

const BOTTONE =
  "rounded-lg border border-b58-charcoal/15 hover:bg-b58-cream-dark transition-colors text-b58-charcoal text-sm font-medium px-4 py-2";
const PRINCIPALE =
  "rounded-lg bg-b58-terracotta hover:bg-b58-terracotta-dark disabled:opacity-50 transition-colors text-b58-parchment text-sm font-semibold px-4 py-2";
const SEZIONE = "rounded-xl bg-b58-parchment ring-1 ring-b58-charcoal/10 p-5 mb-5";
const CAMPO =
  "w-full rounded-lg border border-b58-charcoal/15 bg-white px-3 py-2 text-sm text-b58-charcoal focus:outline-none focus:ring-2 focus:ring-b58-terracotta";
const ETICHETTA = "block text-xs font-medium uppercase tracking-wide text-b58-charcoal-soft mb-1.5";

// ⚠️ FUORI dal componente, e non è una questione di ordine. Definita
// dentro, sarebbe un componente NUOVO a ogni render: React butterebbe via
// i campi e li rifarebbe da capo a ogni lettera digitata, e il cursore
// salterebbe fuori dalla casella dopo il primo carattere. È lo stesso
// modo di perdere ciò che si sta scrivendo del difetto del 12/08 — solo
// più veloce a farsi notare.
function CampiPrenotazione({ valori, cambia }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
      <div className="col-span-2">
        <label className={ETICHETTA}>Nome</label>
        <input value={valori.nome} onChange={(e) => cambia({ ...valori, nome: e.target.value })} className={CAMPO} />
      </div>
      <div>
        <label className={ETICHETTA}>Persone</label>
        <input
          type="number"
          min="1"
          value={valori.persone}
          onChange={(e) => cambia({ ...valori, persone: e.target.value })}
          className={CAMPO}
        />
      </div>
      <div>
        <label className={ETICHETTA}>Ora</label>
        <input
          type="time"
          value={valori.ora}
          onChange={(e) => cambia({ ...valori, ora: e.target.value })}
          className={CAMPO}
        />
      </div>
      <div className="col-span-2">
        <label className={ETICHETTA}>Telefono</label>
        <input
          value={valori.telefono}
          onChange={(e) => cambia({ ...valori, telefono: e.target.value })}
          className={CAMPO}
        />
      </div>
      <div className="col-span-2">
        <label className={ETICHETTA}>Note (allergie, occasione…)</label>
        <input value={valori.note} onChange={(e) => cambia({ ...valori, note: e.target.value })} className={CAMPO} />
      </div>
    </div>
  );
}

export default function PiantaGiornata() {
  const { isTitolare } = useAuth();
  // Da dove si arriva: la scheda di una prenotazione può mandare qui la
  // sua data e sé stessa, per farsi dare un tavolo (difetti n. 1 e n. 10).
  const [ricerca, setRicerca] = useSearchParams();
  const daAssegnare = ricerca.get("assegna");

  const [data, setData] = useState(ricerca.get("data") || oggiLocale());
  const [sagome, setSagome] = useState([]);
  const [prenotazioni, setPrenotazioni] = useState([]);
  const [assegnazioni, setAssegnazioni] = useState([]);
  const [pieno, setPieno] = useState(false);
  // L'ora che separa il primo giro dal secondo: sta nelle impostazioni,
  // perche' d'estate o di sabato cambia e non deve servire una modifica al
  // programma. Formato del database (HH:MM:SS), per confrontarla con
  // reservation_time senza tagliare stringhe.
  const [soglia, setSoglia] = useState("20:00:00");
  // I tavoloni della giornata coi loro coperti, e la risposta a «c'è
  // posto?». Vengono dal database — la pianta e il conteggio devono dire
  // lo stesso numero, quindi il calcolo è uno solo e non sta qui.
  const [gruppi, setGruppi] = useState([]);
  const [posto, setPosto] = useState(null);
  // Quale tavolone si sta correggendo a mano, e con che numero.
  const [correzione, setCorrezione] = useState(null);
  const [caricamento, setCaricamento] = useState(true);
  const [error, setError] = useState("");
  const [avviso, setAvviso] = useState("");
  const [salvando, setSalvando] = useState(false);

  // Cosa si sta facendo adesso. Vive solo qui: finché non si conferma,
  // nel database non cambia niente.
  const [modo, setModo] = useState(null); // null | "nuova" | "assegna"
  const [inCorso, setInCorso] = useState(null); // la prenotazione da assegnare
  const [scelti, setScelti] = useState([]);
  const [nuova, setNuova] = useState(NUOVA_VUOTA);

  // La prenotazione aperta toccando un tavolo già promesso.
  const [aperta, setAperta] = useState(null);
  const [modifica, setModifica] = useState(null);
  // La sagoma da cui si e aperta: serve al pulsante che aggiunge una
  // seconda prenotazione proprio su quel tavolo.
  const [toccato, setToccato] = useState(null);

  const ricarica = useCallback(async () => {
    const [p, r, a, s, reg, g, po] = await Promise.all([
      getPiantaDelGiorno(data),
      listReservations({ date: data }),
      listTavoliPrenotatiPerData(data),
      isSoldOut(data),
      getRegolePrenotazione(),
      getCopertiDelGiorno(data),
      getPostoPerLaSerata(data),
    ]);
    setSagome(p);
    setGruppi(g);
    setPosto(po);
    setPrenotazioni(r.filter((x) => x.status === "richiesta_in_attesa" || x.status === "confermata"));
    setAssegnazioni(a);
    setPieno(s);
    if (reg?.ora_primo_turno) setSoglia(reg.ora_primo_turno);
  }, [data]);

  const azzera = () => {
    setModo(null);
    setInCorso(null);
    setScelti([]);
    setNuova(NUOVA_VUOTA);
    setAperta(null);
    setModifica(null);
    setToccato(null);
  };

  useEffect(() => {
    setCaricamento(true);
    azzera();
    ricarica()
      .catch((e) => setError(e.message))
      .finally(() => setCaricamento(false));
  }, [ricarica]);

  // Arrivando da una prenotazione senza tavolo, l'assegnazione parte da
  // sola: la pianta si apre già in attesa di sapere dove far sedere quella
  // gente, invece di essere una pianta qualunque su cui ricominciare.
  //
  // ⚠️ Passa dallo STESSO `iniziaAssegnazione` del pulsante interno, non da
  // una scorciatoia sua: due modi di avviare la stessa cosa sono due modi
  // di avviarla diversa.
  //
  // ⚠️ E l'indirizzo si ripulisce appena l'assegnazione è partita: senza,
  // ogni ricarica della pagina la farebbe ripartire — anche dopo che il
  // tavolo è stato dato, anche dopo aver cambiato giorno.
  useEffect(() => {
    if (!daAssegnare || caricamento) return;
    const p = prenotazioni.find((x) => x.id === daAssegnare);
    if (p) iniziaAssegnazione(p);
    else setAvviso("Quella prenotazione non è fra quelle di questo giorno.");
    const senza = new URLSearchParams(ricerca);
    senza.delete("assegna");
    setRicerca(senza, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [daAssegnare, caricamento, prenotazioni]);

  const esegui = async (azione) => {
    setError("");
    setAvviso("");
    setSalvando(true);
    try {
      await azione();
      await ricarica();
    } catch (e) {
      setError(e.message);
    } finally {
      setSalvando(false);
    }
  };

  // Chi tiene quale tavolo, per colorare la pianta.
  const perTavolo = useMemo(() => {
    const m = new Map();
    for (const a of assegnazioni) {
      const elenco = m.get(a.dining_table_id) ?? [];
      elenco.push(a);
      m.set(a.dining_table_id, elenco);
    }
    return m;
  }, [assegnazioni]);

  const tavoliDi = (reservationId) => assegnazioni.filter((a) => a.reservation.id === reservationId);

  const evidenziata = inCorso?.id ?? aperta?.id ?? null;

  // ⚠️ SULLA SAGOMA VA SOLO IL COLORE, e chi c'è si legge nell'elenco
  // sotto. Dentro un quadrato di 90 cm un nome e un'ora non ci stanno a
  // una dimensione leggibile: sul telefono le righe si accavallavano, sul
  // computer l'ora usciva tagliata.
  //
  // Il colore però dice la cosa che serve a colpo d'occhio: **giallo** chi
  // arriva entro l'ora di soglia (il tavolo può liberarsi per un secondo
  // giro), **verde** chi arriva dopo (ultimo giro), **mezzo e mezzo** un
  // tavolo che ha già tutt'e due.
  //
  // ⚠️ E dal 18/08 porta anche la CIFRA dei coperti. Il numero è quello
  // del tavolone: tre tavoli accostati mostrano tutti e tre il numero del
  // rettangolo, perché è quello il posto che c'è — non un terzo a testa.
  const stato = useMemo(() => {
    const s = {};
    for (const g of gruppi) {
      for (const id of g.tavoli ?? []) {
        s[id] = { coperti: g.coperti, corretto: g.corretto };
      }
    }
    for (const sagoma of sagome) {
      const altri = (perTavolo.get(sagoma.id) ?? []).filter((a) => a.reservation.id !== evidenziata);
      if (altri.length === 0) continue;
      const presto = altri.some((a) => (a.reservation.reservation_time ?? "") <= soglia);
      const tardi = altri.some((a) => (a.reservation.reservation_time ?? "") > soglia);
      s[sagoma.id] = {
        ...s[sagoma.id],
        colore: presto && tardi ? "misto" : presto ? "presto" : "tardi",
      };
    }
    return s;
  }, [sagome, perTavolo, evidenziata, soglia, gruppi]);

  const tocca = (sagoma) => {
    setAvviso("");
    setError("");

    // Lavoro in corso: il tocco aggiunge o toglie, sempre. Anche su un
    // tavolo già promesso — è il secondo giro della serata, che al
    // telefono si fa: il sistema non lo impedisce e non avvisa.
    if (modo) {
      setScelti((s) => (s.includes(sagoma.id) ? s.filter((x) => x !== sagoma.id) : [...s, sagoma.id]));
      return;
    }

    const sopra = perTavolo.get(sagoma.id) ?? [];
    if (sopra.length > 0) {
      const p = prenotazioni.find((x) => x.id === sopra[0].reservation.id);
      // Quale sagoma è stata toccata, per poterci aggiungere una seconda
      // prenotazione da qui: il pulsante sta dove sta il gesto.
      setToccato(sagoma.id);
      setAperta(p ?? null);
      setModifica(
        p
          ? {
              nome: p.customer_name ?? "",
              telefono: p.customer_phone ?? "",
              persone: p.party_size ?? 1,
              ora: p.reservation_time?.slice(0, 5) ?? "",
              note: p.notes ?? "",
            }
          : null
      );
      return;
    }

    setModo("nuova");
    setScelti([sagoma.id]);
  };

  const iniziaAssegnazione = (p) => {
    setAvviso("");
    setAperta(null);
    setModo("assegna");
    setInCorso(p);
    setScelti(tavoliDi(p.id).map((a) => a.dining_table_id));
  };

  // La prenotazione aperta arriva dopo la soglia? Allora quel tavolo non
  // servirà una seconda volta — e vale la pena dirlo lì, accanto al
  // pulsante che ne aggiungerebbe un'altra.
  const ultimoGiro = Boolean(aperta && (aperta.reservation_time ?? "") > soglia);

  // Le prenotazioni già presenti sui tavoli che si stanno scegliendo.
  const giaPromessi = scelti.flatMap((id) =>
    (perTavolo.get(id) ?? []).filter((a) => a.reservation.id !== evidenziata)
  );

  const etichetteScelte = sagome
    .filter((s) => scelti.includes(s.id))
    .map((s) => s.label)
    .join(" · ");

  const confermaAssegnazione = () =>
    esegui(async () => {
      await assegnaPrenotazione(inCorso.id, scelti, { conferma: true });
      azzera();
    });

  const confermaNuova = () =>
    esegui(async () => {
      await creaPrenotazioneSuTavoli({
        data,
        ora: nuova.ora,
        persone: nuova.persone,
        nome: nuova.nome,
        telefono: nuova.telefono,
        note: nuova.note,
        tavoliIds: scelti,
      });
      azzera();
    });

  const salvaModifica = () =>
    esegui(async () => {
      await updateReservation(aperta.id, {
        customer_name: modifica.nome.trim(),
        customer_phone: modifica.telefono.trim() || null,
        party_size: Number(modifica.persone),
        reservation_time: modifica.ora,
        notes: modifica.note.trim() || null,
      });
      azzera();
    });

  const scostamenti = sagome.filter((s) => s.spostato).length;
  const sagomeGirevoli = sagome.filter((s) => s.spostabile && s.larghezza_cm !== s.profondita_cm);
  const copertiDelGiorno = prenotazioni.reduce((t, p) => t + (p.party_size || 0), 0);

  return (
    <div className="max-w-5xl mx-auto pb-16">
      <Link to="/calendario-eventi" className="text-sm text-b58-charcoal-soft hover:text-b58-terracotta">
        ← Calendario Eventi
      </Link>
      <h1 className="font-display text-2xl text-b58-charcoal mt-1 mb-1">La sala</h1>
      <p className="text-sm text-b58-charcoal-soft mb-5">
        Guarda dove c'è spazio, accosta i tavoli se serve, poi <strong>tocca i tavoli</strong>: se
        sono liberi ci prendi una prenotazione, se sono già promessi apri quella che c'è. Quello che
        sposti oggi vale <strong>solo per oggi</strong>.
      </p>

      {error && (
        <p className="text-sm text-b58-terracotta-dark bg-b58-terracotta/10 rounded-lg px-3 py-2 mb-4">{error}</p>
      )}
      {avviso && <p className="text-sm text-b58-charcoal bg-b58-gold/15 rounded-lg px-3 py-2 mb-4">{avviso}</p>}

      {/* Il giorno */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <input
          type="date"
          value={data}
          onChange={(e) => setData(e.target.value)}
          className="rounded-lg border border-b58-charcoal/15 bg-white px-3 py-2 text-sm text-b58-charcoal"
        />
        <button type="button" onClick={() => setData(oggiLocale())} className={BOTTONE}>
          Oggi
        </button>
        <span className="text-sm text-b58-charcoal-soft">
          {formatDate(data)}
          {prenotazioni.length > 0 && (
            <>
              {" · "}
              <strong className="text-b58-charcoal">{prenotazioni.length}</strong> prenotazion
              {prenotazioni.length === 1 ? "e" : "i"} ·{" "}
              <strong className="text-b58-charcoal">{copertiDelGiorno}</strong> persone
            </>
          )}
        </span>
      </div>

      {caricamento ? (
        <p className="text-sm text-b58-charcoal-soft">Caricamento…</p>
      ) : (
        <>
          {/* La serata al completo — l'unico freno alle richieste dal sito */}
          <div className={SEZIONE}>
            <label className="flex items-start gap-3">
              <input
                type="checkbox"
                checked={pieno}
                disabled={!isTitolare}
                onChange={(e) => esegui(() => setSoldOut(data, e.target.checked))}
                className="mt-1 h-5 w-5"
              />
              <span>
                <span className="block text-b58-charcoal font-medium">
                  Per questa sera siamo al completo
                </span>
                <span className="block text-sm text-b58-charcoal-soft mt-1">
                  Acceso: dal sito non arrivano più richieste per questo giorno, e al cliente compare
                  che siamo pieni. Si toglie quando vuoi. <strong>Non è una chiusura</strong>: quella
                  si mette da Sala e orari e resta un'altra cosa.
                </span>
              </span>
            </label>
          </div>

          {/* «C'È POSTO?» — la domanda del telefono, prima della pianta.
              ⚠️ AVVISA, NON IMPEDISCE: qui non c'è niente che si spenga o
              rifiuti. Decide Alessio guardando la sala; questo riquadro
              gli dice solo cosa sta guardando. */}
          {posto && (
            <div className="rounded-xl bg-b58-cream ring-1 ring-b58-charcoal/10 p-3 mb-3">
              <div className="flex flex-wrap items-baseline gap-x-5 gap-y-1">
                <span className="text-sm">
                  <strong className="text-lg">{posto.restanti}</strong> posti liberi
                </span>
                <span className="text-[13px] text-b58-charcoal-soft">
                  {posto.capienza} in questa disposizione · {posto.prenotati} prenotati
                  {posto.in_attesa > 0 && ` · ${posto.in_attesa} da confermare`}
                </span>
              </div>
              {posto.oltre_soglia && (
                <p className="text-[13px] mt-1.5 font-medium text-b58-terracotta">
                  Sei oltre i {posto.soglia} coperti che ti sei dato per la serata. Puoi accettare
                  lo stesso: è un avviso, non un divieto.
                </p>
              )}
              {/* ⚠️ Il numero e la frase che ne dichiara il limite viaggiano
                  insieme, e la frase arriva dal database insieme al numero:
                  un avviso scritto qui dentro non proteggerebbe la seconda
                  schermata che mostrasse lo stesso totale. */}
              <p className="text-[11px] text-b58-charcoal-soft/70 mt-1.5">{posto.avvertenza}</p>
            </div>
          )}

          {/* La pianta */}
          <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
            <p className="text-[11px] uppercase tracking-wide font-semibold text-b58-charcoal-soft/70">
              La sala del {formatDate(data)}
            </p>
            {isTitolare && scostamenti > 0 && (
              <button
                type="button"
                onClick={() => {
                  if (
                    !window.confirm(
                      `Vuoi che questa diventi la disposizione normale della sala, da qui in avanti?\n\n` +
                        `${scostamenti} ${scostamenti === 1 ? "tavolo spostato" : "tavoli spostati"}. ` +
                        `Da domani la sala riparte da questa, non da quella di prima.`
                    )
                  )
                    return;
                  esegui(() => promuoviDisposizione(data));
                }}
                className="rounded-lg bg-b58-olive hover:bg-b58-olive-dark transition-colors text-b58-parchment text-sm font-medium px-4 py-2"
              >
                Questa diventa la sala di sempre
              </button>
            )}
          </div>

          <PiantaSala
            sagome={sagome}
            selezione={scelti}
            stato={stato}
            onSeleziona={tocca}
            onSposta={
              isTitolare
                ? (sagoma, x, y) =>
                    esegui(() =>
                      salvaSagoma({ data, sagomaId: sagoma.id, x, y, ruotato: sagoma.ruotato })
                    )
                : undefined
            }
          />

          {/* ⚠️ La stessa riga sta anche in Comande, e sta QUI soprattutto:
              chi si accorge della discrepanza parte da questa schermata,
              perché è quella dove si sta seduti a ragionare (rilievo di
              Alessio, 17/08). Dirlo solo di là servirebbe a chi ha già
              capito. */}
          <p className="text-[11px] text-b58-charcoal-soft/70 mt-1.5">
            In Comande questa stessa sala è disegnata in piedi, per il tablet tenuto
            verticale: è lo stesso locale girato — non un&apos;altra disposizione.
          </p>

          {/* I TAVOLONI, e il numero corretto a mano.
              ⚠️ Sulla sagoma c'è la cifra col punto; qui ci sono le parole.
              Le due cose non si ripetono: il segno si legge a colpo
              d'occhio, la spiegazione si legge quando serve. */}
          {gruppi.length > 0 && (
            <div className="mt-3">
              <p className="text-[11px] uppercase tracking-wide font-semibold text-b58-charcoal-soft/70 mb-1.5">
                Quanti ne tengono
              </p>
              <ul className="divide-y divide-b58-charcoal/10 rounded-xl ring-1 ring-b58-charcoal/10">
                {gruppi.map((g) => {
                  const chiave = (g.tavoli ?? []).join(",");
                  const inCorrezione = correzione?.chiave === chiave;
                  return (
                    <li key={chiave} className="px-3 py-2">
                      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                        <span className="text-sm font-medium">
                          {(g.etichette ?? []).join(" · ")}
                          {g.giunzioni > 0 && (
                            <span className="text-[11px] font-normal text-b58-charcoal-soft">
                              {" "}
                              — accostati
                            </span>
                          )}
                        </span>
                        <span className="text-sm">
                          <strong>{g.coperti}</strong>
                          {g.corretto ? (
                            <span className="text-[12px] text-b58-charcoal-soft">
                              {" "}
                              corretto a mano · la regola direbbe {g.coperti_calcolati}
                              {g.ragione ? ` · ${g.ragione}` : ""}
                              {/* ⚠️ CHI e QUANDO, perché una correzione senza
                                  autore è un numero che nessuno può spiegare
                                  tre giorni dopo — e quel numero decide se si
                                  accetta gente. «Un altro accesso» e non un
                                  nome: oggi si entra per ruolo e non per
                                  persona, e dire un nome sarebbe inventarlo. */}
                              {g.corretto_il &&
                                ` · ${g.corretto_da_me ? "l'hai messo tu" : "da un altro accesso"} il ${formatDate(g.corretto_il.slice(0, 10))}`}
                            </span>
                          ) : (
                            <span className="text-[12px] text-b58-charcoal-soft"> calcolato</span>
                          )}
                        </span>
                      </div>

                      {inCorrezione ? (
                        <div className="flex flex-wrap items-center gap-2 mt-2">
                          <input
                            type="number"
                            min="0"
                            value={correzione.coperti}
                            onChange={(e) =>
                              setCorrezione((c) => ({ ...c, coperti: e.target.value }))
                            }
                            className="w-20 rounded-lg ring-1 ring-b58-charcoal/20 px-2 py-1 text-sm"
                          />
                          <input
                            type="text"
                            placeholder="perché (es. uno contro il muro)"
                            value={correzione.ragione}
                            onChange={(e) =>
                              setCorrezione((c) => ({ ...c, ragione: e.target.value }))
                            }
                            className="flex-1 min-w-[12rem] rounded-lg ring-1 ring-b58-charcoal/20 px-2 py-1 text-sm"
                          />
                          <button
                            type="button"
                            disabled={salvando || correzione.coperti === ""}
                            onClick={() => {
                              const n = Number(correzione.coperti);
                              // ⚠️ Il vuoto non è zero (lezione del 17/08):
                              // un campo svuotato non deve diventare «questo
                              // tavolo non tiene nessuno».
                              if (!Number.isFinite(n) || correzione.coperti === "") return;
                              esegui(async () => {
                                await salvaCorrezioneCoperti({
                                  data,
                                  tavoli: g.tavoli,
                                  coperti: n,
                                  ragione: correzione.ragione,
                                });
                                setCorrezione(null);
                              });
                            }}
                            className="rounded-lg bg-b58-olive hover:bg-b58-olive-dark transition-colors text-b58-parchment text-sm px-3 py-1"
                          >
                            Salva
                          </button>
                          <button
                            type="button"
                            onClick={() => setCorrezione(null)}
                            className="text-sm text-b58-charcoal-soft underline"
                          >
                            Lascia stare
                          </button>
                        </div>
                      ) : (
                        <div className="flex flex-wrap items-center gap-3 mt-1">
                          <button
                            type="button"
                            onClick={() =>
                              setCorrezione({
                                chiave,
                                coperti: String(g.coperti),
                                ragione: g.ragione ?? "",
                              })
                            }
                            className="text-[12px] text-b58-charcoal-soft underline"
                          >
                            Correggi il numero
                          </button>
                          {g.corretto && (
                            <button
                              type="button"
                              disabled={salvando}
                              onClick={() =>
                                esegui(() => rimuoviCorrezioneCoperti({ data, tavoli: g.tavoli }))
                              }
                              className="text-[12px] text-b58-charcoal-soft underline"
                            >
                              Torna al calcolato ({g.coperti_calcolati})
                            </button>
                          )}
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
              {/* ⚠️ LA SPARIZIONE SI DICE — e per intero. La prima stesura
                  diceva solo «decade», ed era una mezza verità: la riga non
                  si cancella, quindi rifacendo lo stesso accostamento nello
                  stesso giorno il numero TORNA. Detta a metà, la schermata
                  prometteva una cosa e il gestionale ne faceva un'altra
                  (rilievo della validazione del 18/08). La scelta di non
                  cancellare resta — un trascinamento per sbaglio non deve
                  distruggere un numero scritto a mano — ma va detta. */}
              <p className="text-[11px] text-b58-charcoal-soft/70 mt-1.5">
                Se sciogli o cambi un tavolone il numero corretto a mano non vale più e torna
                quello calcolato: si riferiva a quei tavoli messi così. Non lo perdi — se
                rimetti insieme <strong>gli stessi</strong> tavoli oggi stesso, torna anche il
                tuo numero.
              </p>
            </div>
          )}

          {isTitolare && sagomeGirevoli.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 mt-2">
              <span className="text-[11px] text-b58-charcoal-soft">Gira per questo giorno:</span>
              {sagomeGirevoli.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() =>
                    esegui(() =>
                      salvaSagoma({ data, sagomaId: s.id, x: s.x, y: s.y, ruotato: !s.ruotato })
                    )
                  }
                  className="rounded-lg border border-b58-charcoal/15 hover:bg-b58-cream-dark transition-colors text-b58-charcoal text-xs px-3 py-1.5"
                >
                  ⟳ {s.label} {s.ruotato ? "(in piedi)" : "(di traverso)"}
                </button>
              ))}
            </div>
          )}

          {/* La legenda dei colori: la scritta che non sta dentro il
              tavolo, detta una volta invece che su ognuno. */}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-[11px] text-b58-charcoal-soft">
            <span>
              <span className="inline-block w-2.5 h-2.5 rounded-sm bg-b58-gold align-middle mr-1" />
              arriva entro le {soglia.slice(0, 5)} — il tavolo può liberarsi per una seconda serata
            </span>
            <span>
              <span className="inline-block w-2.5 h-2.5 rounded-sm bg-b58-olive align-middle mr-1" />
              arriva dopo — è l'ultimo giro di quel tavolo
            </span>
            <span>
              <span className="inline-block w-2.5 h-2.5 rounded-sm align-middle mr-1 bg-gradient-to-r from-b58-gold from-50% to-b58-olive to-50%" />
              tutti e due
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-3 mt-2 mb-6 text-[11px] text-b58-charcoal-soft">
            <span>
              {scostamenti > 0
                ? `${scostamenti} ${scostamenti === 1 ? "tavolo spostato" : "tavoli spostati"} solo per questo giorno`
                : "Sala nella disposizione di sempre"}
            </span>
            {isTitolare &&
              sagome
                .filter((s) => s.spostato)
                .map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => esegui(() => riportaSagomaAllaBase({ data, sagomaId: s.id }))}
                    className="underline hover:text-b58-terracotta-dark"
                  >
                    rimetti {s.label} a posto
                  </button>
                ))}
          </div>

          {/* PRENOTAZIONE NUOVA — il gesto principale di questa pagina */}
          {modo === "nuova" && (
            <div className="rounded-xl bg-b58-terracotta/10 ring-1 ring-b58-terracotta/30 p-5 mb-5">
              <p className="text-b58-charcoal font-medium mb-1">
                Prenotazione su {etichetteScelte || <em className="text-b58-charcoal-soft">nessun tavolo</em>}
              </p>
              <p className="text-sm text-b58-charcoal-soft mb-3">
                Tocca i tavoli per aggiungerli o toglierli — <strong>anche quelli già promessi a
                qualcun altro</strong>. Se sono in tanti, accostali prima e poi toccali tutti. Il
                cliente <strong>non riceve nessuna email</strong>: gliel'hai appena detto tu.
              </p>

              {/* Chi c'è già su quei tavoli. Non è un avviso e non blocca
                  niente: è il secondo giro, e la sola cosa che serve è
                  sapere a che ora se ne vanno gli altri. */}
              {giaPromessi.length > 0 && (
                <p className="text-sm text-b58-charcoal bg-b58-gold/15 rounded-lg px-3 py-2 mb-3">
                  Su questi tavoli c'è già:{" "}
                  {giaPromessi
                    .map(
                      (a) =>
                        `${a.etichetta_al_momento} — ${a.reservation.customer_name} alle ${a.reservation.reservation_time?.slice(0, 5)}`
                    )
                    .join(" · ")}
                  .
                </p>
              )}

              <CampiPrenotazione valori={nuova} cambia={setNuova} />

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={salvando || scelti.length === 0 || !nuova.nome.trim()}
                  onClick={confermaNuova}
                  className={PRINCIPALE}
                >
                  {salvando ? "Salvo…" : `Prenota ${scelti.length || "…"} ${scelti.length === 1 ? "tavolo" : "tavoli"}`}
                </button>
                <button type="button" onClick={azzera} className={BOTTONE}>
                  Lascia stare
                </button>
              </div>
            </div>
          )}

          {/* ASSEGNAZIONE di una richiesta arrivata dal sito */}
          {modo === "assegna" && inCorso && (
            <div className="rounded-xl bg-b58-terracotta/10 ring-1 ring-b58-terracotta/30 p-5 mb-5">
              <p className="text-b58-charcoal font-medium mb-1">
                {inCorso.customer_name} · {inCorso.party_size} persone ·{" "}
                {inCorso.reservation_time?.slice(0, 5)}
              </p>
              <p className="text-sm text-b58-charcoal-soft mb-3">
                Tocca sulla pianta i tavoli dove li fai sedere.
              </p>
              <p className="text-sm text-b58-charcoal mb-3">
                {scelti.length === 0 ? (
                  <em className="text-b58-charcoal-soft">Nessun tavolo scelto.</em>
                ) : (
                  <>
                    Tavoli scelti: <strong>{etichetteScelte}</strong>
                  </>
                )}
              </p>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={salvando || scelti.length === 0}
                  onClick={confermaAssegnazione}
                  className={PRINCIPALE}
                >
                  Conferma su {scelti.length || "…"} {scelti.length === 1 ? "tavolo" : "tavoli"}
                </button>
                <button type="button" onClick={azzera} className={BOTTONE}>
                  Lascia stare
                </button>
              </div>
            </div>
          )}

          {/* PRENOTAZIONE APERTA toccando un tavolo già promesso */}
          {aperta && modifica && (
            <div className="rounded-xl bg-b58-olive/10 ring-1 ring-b58-olive/30 p-5 mb-5">
              <p className="text-b58-charcoal font-medium mb-1">
                {aperta.customer_name}
                {aperta.status === "richiesta_in_attesa" && (
                  <span className="ml-2 inline-flex items-center rounded-full bg-b58-gold text-b58-parchment text-[11px] font-medium px-2.5 py-1">
                    da confermare
                  </span>
                )}
              </p>
              <p className="text-sm text-b58-charcoal-soft mb-4">
                Su {tavoliDi(aperta.id).map((a) => a.etichetta_al_momento).join(" · ")}. Cambia quello
                che serve, oppure spostali su altri tavoli.{" "}
                {ultimoGiro ? (
                  <strong>
                    Arriva dopo le {soglia.slice(0, 5)}: è l'ultimo giro di questo tavolo.
                  </strong>
                ) : (
                  <>Arriva entro le {soglia.slice(0, 5)}: il tavolo può servire una seconda volta.</>
                )}
              </p>

              <CampiPrenotazione valori={modifica} cambia={setModifica} />

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={salvando || !modifica.nome.trim()}
                  onClick={salvaModifica}
                  className={PRINCIPALE}
                >
                  {salvando ? "Salvo…" : "Salva le modifiche"}
                </button>
                {/* ⚠️ IL PULSANTE STA DOVE STA IL GESTO. Prima era fisso in
                    cima alla pianta, ed era la cosa giusta nel posto
                    sbagliato: chiesto da Alessio di portarlo qui, dentro il
                    tavolo che ha appena toccato.
                    Compare anche sui tavoli VERDI, e non è una svista: la
                    sua decisione è che il verde avvisa e non blocca. Lì
                    accanto c'è scritto che è l'ultimo giro — poi decide
                    lui, come per tutto il resto di questa sala. */}
                <button
                  type="button"
                  onClick={() => {
                    setAperta(null);
                    setModifica(null);
                    setModo("nuova");
                    setScelti(toccato ? [toccato] : []);
                  }}
                  className={BOTTONE}
                >
                  + Aggiungi una prenotazione su questo tavolo
                </button>
                <button type="button" onClick={() => iniziaAssegnazione(aperta)} className={BOTTONE}>
                  Spostali su altri tavoli
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (!window.confirm(`Il cliente ha disdetto? La prenotazione di ${aperta.customer_name} verrà annullata e i tavoli tornano liberi.`))
                      return;
                    esegui(async () => {
                      // Una cosa sola, non due: annullare e liberare i
                      // tavoli non possono riuscire a metà.
                      await annullaPrenotazione(aperta.id);
                      azzera();
                    });
                  }}
                  className="rounded-lg border border-b58-terracotta/40 text-b58-terracotta-dark hover:bg-b58-terracotta/10 transition-colors text-sm font-medium px-4 py-2"
                >
                  Ha disdetto
                </button>
                <button type="button" onClick={azzera} className={BOTTONE}>
                  Chiudi
                </button>
              </div>
            </div>
          )}

          {/* Le prenotazioni del giorno */}
          <p className="text-[11px] uppercase tracking-wide font-semibold text-b58-charcoal-soft/70 mb-2">
            Prenotazioni del giorno
          </p>
          {prenotazioni.length === 0 ? (
            <div className="rounded-xl border border-dashed border-b58-charcoal/20 p-8 text-center">
              <p className="text-b58-charcoal-soft text-sm">
                Nessuna prenotazione per questo giorno. Tocca un tavolo libero sulla pianta per
                prenderne una.
              </p>
            </div>
          ) : (
            <ul className="rounded-xl bg-b58-parchment ring-1 ring-b58-charcoal/10 divide-y divide-b58-charcoal/5">
              {prenotazioni.map((p) => {
                const suoi = tavoliDi(p.id);
                return (
                  <li key={p.id} className="p-4 flex flex-wrap items-center gap-x-4 gap-y-2">
                    <span className="text-sm text-b58-charcoal-soft w-12">
                      {p.reservation_time?.slice(0, 5)}
                    </span>
                    <span className="text-b58-charcoal font-medium flex-1 min-w-[140px]">
                      {p.customer_name}
                      <span className="text-b58-charcoal-soft font-normal"> · {p.party_size} persone</span>
                    </span>
                    <span className="text-sm">
                      {suoi.length > 0 ? (
                        <span className="text-b58-olive-dark font-medium">
                          {suoi.map((a) => a.etichetta_al_momento).join(" · ")}
                        </span>
                      ) : (
                        <span className="text-b58-terracotta-dark">senza tavolo</span>
                      )}
                    </span>
                    {p.status === "richiesta_in_attesa" && (
                      <span className="inline-flex items-center rounded-full bg-b58-gold text-b58-parchment text-[11px] font-medium px-2.5 py-1">
                        da confermare
                      </span>
                    )}
                    <button type="button" onClick={() => iniziaAssegnazione(p)} className={BOTTONE}>
                      {suoi.length > 0 ? "Cambia tavolo" : "Dai un tavolo"}
                    </button>
                    {suoi.length > 0 && isTitolare && (
                      <button
                        type="button"
                        onClick={() => esegui(() => togliAssegnazione(p.id))}
                        className="text-xs text-b58-charcoal-soft hover:text-b58-terracotta-dark underline"
                      >
                        togli
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </>
      )}
    </div>
  );
}
