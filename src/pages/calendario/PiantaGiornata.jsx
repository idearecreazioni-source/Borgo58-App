import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import PiantaSala from "../../components/PiantaSala";
import { formatDate, oggiLocale } from "../../lib/constants";
import { serataDiServizio } from "../../lib/calcoli/serata";
import { insiemiPerTavolo, ritardiDellaSerata, segniDellaSala } from "../../lib/calcoli/ritardo";
import { listContiPerPrenotazioni } from "../../lib/api/orders";
import { useAuth } from "../../context/AuthContext";
import {
  getCopertiDelGiorno,
  getPiantaDelGiorno,
  getPostoPerLaSerata,
  getRegolePrenotazione,
  getTurniDelGiorno,
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
// ⚠️ COSA VUOL DIRE UN TOCCO — e la risposta è cambiata due volte il 18/08,
// quindi vale la pena scriverla per intero.
//   · Fino al giro D3 ne voleva dire TRE, a seconda di cosa c'era sotto il
//     dito. La ragione, del 14/08, era che le tre cose «non possono essere
//     ambigue» — ma tre esiti per lo stesso gesto sono ambigui per
//     costruzione, perché chi tocca deve ricordarsi cosa c'era sotto.
//   · Col giro D3 ne voleva dire UNA: apriva il riquadro del tavolo, e le
//     strade stavano lì dentro.
//   · Provandolo, Alessio ha chiesto che su un tavolo LIBERO si arrivi
//     «direttamente ai campi da compilare»: lì il riquadro non faceva
//     scegliere niente, era una tappa. Quindi gli esiti tornano a essere DUE.
//
// ⚠️ E DUE ESITI SI REGGONO SOLO SE LA CONDIZIONE SI VEDE PRIMA DI TOCCARE.
// Qui si vede: **un tavolo bianco è libero, uno colorato ha qualcuno**, e il
// colore è il segno più leggibile di questa schermata. Il modulo lo dichiara
// comunque a parole, una volta, nel posto dove la regola agisce.
// (Resta fuori il lavoro in corso: mentre si sceglie dove far sedere
// qualcuno il tocco aggiunge e toglie, e lì il gesto è già dichiarato da un
// riquadro aperto sopra la pianta.)
//
// ⚠️ E il riquadro ha ASSORBITO l'elenco dei tavoli che stava sotto la
// pianta: i coperti si correggono da lì, dove si è appena toccato il tavolo,
// invece che da una seconda lista con la sua riga da cercare. **Sul tavolo
// libero la stessa casella sta nel modulo della prenotazione** — senza,
// correggere il numero di un tavolo libero non si potrebbe più fare da
// nessuna parte.
//
// ⚠️ La pianta mostra TUTTA la serata, non un momento. Un tavolo
// prenotato alle 19:30 resta colorato anche se alle 22 si libera: non
// esistono turni né finestre temporali (§8 del mandato), quindi ogni
// sagoma occupata e' colorata secondo l'ora di arrivo, e l'ora esatta si
// legge nell'elenco sotto.

const NUOVA_VUOTA = { nome: "", telefono: "", persone: 2, ora: "20:00", note: "" };

// C'è del lavoro dentro il modulo? Serve a decidere se il modulo può sparire
// da solo quando resta senza tavoli. ⚠️ Si confronta con lo stato di partenza
// per INTERO e non solo col nome: chi ha già messo «6 persone alle 21» ha
// scritto qualcosa, anche se non ha ancora digitato una lettera.
const moduloScritto = (v) =>
  Object.keys(NUOVA_VUOTA).some((k) => String(v?.[k] ?? "") !== String(NUOVA_VUOTA[k]));

const BOTTONE =
  "rounded-lg border border-b58-charcoal/15 hover:bg-b58-cream-dark transition-colors text-b58-charcoal text-sm font-medium px-4 py-2";
const PRINCIPALE =
  "rounded-lg bg-b58-terracotta hover:bg-b58-terracotta-dark disabled:opacity-50 transition-colors text-b58-parchment text-sm font-semibold px-4 py-2";
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

// I COPERTI DI UN TAVOLONE, con la loro casella — e sta FUORI dal componente
// per la stessa ragione di `CampiPrenotazione`: definita dentro sarebbe un
// componente nuovo a ogni render, e il cursore salterebbe fuori dalla casella
// a ogni cifra digitata.
//
// ⚠️ ED È UNA SOLA, USATA IN DUE POSTI: il riquadro del tavolo (tavolo
// occupato) e il modulo della prenotazione nuova (tavolo libero). Dal 18/08 il
// tocco su un tavolo libero salta il riquadro e va dritto ai campi — richiesta
// di Alessio — e senza portare la casella anche lì, correggere i coperti di un
// tavolo libero non si potrebbe più fare da nessuna parte: è il gesto che
// faceva l'elenco sotto la pianta, che questo giro ha tolto.
// Due copie della stessa casella sarebbero due posti che divergono.
function CopertiDelGruppo({ gruppo, mostraNumero, correzione, setCorrezione, salvando, salva, azzeraCorrezione }) {
  if (!gruppo) return null;
  const chiave = (gruppo.tavoli ?? []).join(",");
  const inCorrezione = correzione?.chiave === chiave;
  const piuTavoli = (gruppo.tavoli ?? []).length > 1;
  return (
    <div className="mb-3">
      {/* ⚠️ IL NUMERO SI MOSTRA SOLO DOVE SERVE A DECIDERE, cioè mentre si
          prende una prenotazione («ci stanno in sei?»). Nel riquadro del
          tavolo è stato tolto da Alessio il 18/08: lì la cifra è già scritta
          **dentro la sagoma** che si è appena toccata (giro B), e ridirla
          accanto era la stessa cosa detta due volte.
          ⚠️ Insieme se n'è andata la frase che distingueva tavolo e tavolone
          («è il numero di T7 · T8 · T9 insieme, non del solo T8»). Il contesto
          resta nel TITOLO del riquadro — «T8 — accostato a T7 · T9» — che è il
          posto dove l'informazione sta: senza quel titolo il rischio
          tornerebbe intero, ed è il motivo per cui non si tocca. */}
      {mostraNumero && (
        <p className="text-sm text-b58-charcoal">
          {piuTavoli && (
            <span className="text-b58-charcoal-soft">{(gruppo.etichette ?? []).join(" · ")}: </span>
          )}
          Ci stanno <strong>{gruppo.coperti}</strong>
          {gruppo.corretto && (
            <span className="text-b58-charcoal-soft">
              {" "}
              — corretto a mano{gruppo.ragione ? ` · ${gruppo.ragione}` : ""}
            </span>
          )}
        </p>
      )}

      {inCorrezione ? (
        <div className="flex flex-wrap items-center gap-2 mt-2">
          <input
            type="number"
            min="0"
            value={correzione.coperti}
            onChange={(e) => setCorrezione((c) => ({ ...c, coperti: e.target.value }))}
            className="w-20 rounded-lg ring-1 ring-b58-charcoal/20 px-2 py-1 text-sm"
          />
          <input
            type="text"
            placeholder="perché (es. uno contro il muro)"
            value={correzione.ragione}
            onChange={(e) => setCorrezione((c) => ({ ...c, ragione: e.target.value }))}
            className="flex-1 min-w-[10rem] rounded-lg ring-1 ring-b58-charcoal/20 px-2 py-1 text-sm"
          />
          <button
            type="button"
            disabled={salvando || correzione.coperti === ""}
            onClick={() => salva(gruppo)}
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
                coperti: String(gruppo.coperti),
                ragione: gruppo.ragione ?? "",
              })
            }
            className="text-[12px] text-b58-charcoal-soft underline"
          >
            Correggi il numero
          </button>
          {gruppo.corretto && (
            <button
              type="button"
              disabled={salvando}
              onClick={() => azzeraCorrezione(gruppo)}
              className="text-[12px] text-b58-charcoal-soft underline"
            >
              Torna al calcolato ({gruppo.coperti_calcolati})
            </button>
          )}
        </div>
      )}
      {/* ⚠️ «Chi ha corretto e quando» NON è più a schermo — Alessio lo
          considera superfluo qui (giro D3, rovesciamento n. 8). Resta scritto
          nel database dal trigger, ed è quello che permette di spiegare un
          numero tre giorni dopo. */}
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
  // ⚠️ L'ora che separa le fasce NON è più uno stato di questa schermata.
  // Fino al 18/08 era una sola per tutto il locale e si confrontava qui;
  // dal giro C appartiene al SERVIZIO (una domenica è pranzo) e la fascia
  // la calcola il database, che è anche l'unico posto dove sta la regola.
  // I tavoloni della giornata coi loro coperti, e la risposta a «c'è
  // posto?». Vengono dal database — la pianta e il conteggio devono dire
  // lo stesso numero, quindi il calcolo è uno solo e non sta qui.
  const [gruppi, setGruppi] = useState([]);
  // Le fasce e «da liberare entro le…», calcolate dal database sugli orari
  // di QUEL servizio. Non si ricalcolano qui: due posti direbbero due cose.
  const [turni, setTurni] = useState([]);
  const [posto, setPosto] = useState(null);
  // I conti che nominano le prenotazioni di questa data, e i parametri della
  // sala: servono al ritardo, che è calcolato e non scritto.
  const [contiDellaSerata, setContiDellaSerata] = useState([]);
  const [regole, setRegole] = useState(null);
  // ⚠️ L'orologio batte anche qui, e non è una copia inutile di quello delle
  // Comande: questa schermata resta aperta sul telefono mentre si prendono
  // prenotazioni, e un tavolo che sfora mentre la si guarda deve sbarrarsi da
  // sé. Un minuto — la tolleranza è di trenta.
  const [adesso, setAdesso] = useState(() => new Date());
  // Quale tavolone si sta correggendo a mano, e con che numero.
  const [correzione, setCorrezione] = useState(null);
  const [caricamento, setCaricamento] = useState(true);
  // La sala è stata letta davvero? Vedi la nota in fondo a `ricarica`.
  const [letta, setLetta] = useState(false);
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
  // La sagoma toccata: da qui nasce il riquadro del tavolo, e da lì si fa
  // tutto quello che riguarda quel tavolo.
  const [toccato, setToccato] = useState(null);

  // ⚠️ I DUE APPIGLI DELL'EVIDENZIAZIONE INCROCIATA. Accendere una riga che
  // sta fuori schermo non è evidenziare: è nascondere meglio. Sul telefono la
  // pianta e l'elenco non ci stanno insieme, quindi al tocco la pagina va
  // dove sta la cosa accesa — verso l'elenco se si è toccato un tavolo, verso
  // la pianta se si è toccata una prenotazione.
  const piantaRef = useRef(null);
  const righeRef = useRef({});
  // Il modulo della prenotazione: sta sotto la pianta, e sul telefono dopo un
  // tocco resta fuori schermo. Stessa ragione degli altri due appigli.
  const moduloRef = useRef(null);

  const ricarica = useCallback(async () => {
    const [p, r, a, s, g, po, tu, reg] = await Promise.all([
      getPiantaDelGiorno(data),
      listReservations({ date: data }),
      listTavoliPrenotatiPerData(data),
      isSoldOut(data),
      getCopertiDelGiorno(data),
      getPostoPerLaSerata(data),
      getTurniDelGiorno(data),
      getRegolePrenotazione(),
    ]);
    setSagome(p);
    setGruppi(g);
    setPosto(po);
    setTurni(tu);
    setRegole(reg);
    // I conti che nominano le prenotazioni di questa giornata: è così che si
    // sa chi è già arrivato, senza chiedere a nessuno di segnarlo. La stessa
    // domanda che si fa la sala, con la stessa risposta.
    setContiDellaSerata(await listContiPerPrenotazioni([...new Set(tu.map((t) => t.reservation_id))]));
    setPrenotazioni(r.filter((x) => x.status === "richiesta_in_attesa" || x.status === "confermata"));
    setAssegnazioni(a);
    setPieno(s);
    // 🔴 SOLO QUI LA SALA È LETTA DAVVERO, e questa riga esiste per un errore
    // vero: il 18/08 alle 23:55 una di queste nove letture è fallita
    // («TypeError: Load failed», una volta sola) e la schermata ha disegnato
    // **la sala vuota** — nessun tavolo, solo le zone. Ha mostrato una
    // striscia rossa, ma sotto ha continuato a disegnare.
    //
    // ⚠️ E UNA SALA VUOTA È UN'INFORMAZIONE, non l'assenza di
    // un'informazione: chi guarda legge «stasera non ha prenotato nessuno» —
    // e in quel momento era falso. È la stessa famiglia dell'elenco allergeni
    // vuoto che si legge «non contiene allergeni» (13/08): il caso in cui il
    // gestionale non sa deve **dirlo**, non disegnare il contenitore.
    //
    // ⚠️ E la stessa riga copre il caso più insidioso: cambiando giorno, se la
    // lettura fallisce, senza questo segno resterebbero a schermo **i tavoli
    // di ieri sotto la data di oggi**.
    setLetta(true);
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
    setLetta(false);
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
  // Il colore però dice la cosa che serve a colpo d'occhio: **giallo**
  // primo giro, **verde** occupa la serata, **arancio** ultimo giro (dopo
  // l'ultimo ingresso), **mezzo e mezzo** un tavolo che ha più di una
  // fascia — tipicamente un giallo e un arancio, cioè il secondo giro.
  // ⚠️ Le fasce arrivano dal database: i loro confini sono gli orari **di
  // quel servizio**, e una domenica di pranzo non ha gli stessi di una
  // cena. Ricalcolarle qui darebbe due risposte alla stessa domanda.
  //
  // ⚠️ E dal 18/08 porta anche la CIFRA dei coperti. Il numero è quello
  // del tavolone: tre tavoli accostati mostrano tutti e tre il numero del
  // rettangolo, perché è quello il posto che c'è — non un terzo a testa.
  const fasciaPerPrenotazione = useMemo(
    () => new Map(turni.map((t) => [t.reservation_id, t.fascia])),
    [turni]
  );

  useEffect(() => {
    const battito = setInterval(() => setAdesso(new Date()), 60_000);
    return () => clearInterval(battito);
  }, []);

  // L'ALTRO VERSO DELL'EVIDENZIAZIONE: toccato un tavolo, la pagina scorre
  // fino alla riga di chi ci siede.
  //
  // ⚠️ `block: "nearest"` e non `"center"`: se la riga è già visibile la
  // pagina non si muove affatto. Sul computer sta tutto sullo stesso schermo,
  // e una pagina che salta a ogni tocco sarebbe un difetto introdotto per
  // curare un problema che lì non esiste.
  useEffect(() => {
    if (!toccato) return;
    const primo = assegnazioniDelGruppo(toccato)[0];
    const riga = primo && righeRef.current[primo.reservation.id];
    riga?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [toccato]);

  // E lo stesso per il modulo: toccato un tavolo libero si è già nei campi,
  // ma sul telefono i campi stanno sotto la pianta — cioè fuori schermo.
  // Arrivarci «direttamente» vuol dire anche vederli.
  useEffect(() => {
    if (!modo) return;
    moduloRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [modo]);

  // IL RITARDO, E LA SOLA GIORNATA IN CUI HA SENSO.
  //
  // ⚠️ Questa schermata visita QUALUNQUE data — è il suo mestiere: alle 00:30
  // si prepara domani. Ma «in ritardo» è un'affermazione sull'adesso: su una
  // sera di tre settimane fa nessuno può più arrivare, e ogni prenotazione
  // senza conto risulterebbe in ritardo per sempre. Sarebbe un allarme che
  // grida su tutto lo storico, cioè un allarme che si spegne.
  // Quindi il ritardo si calcola solo quando la data guardata È la serata in
  // corso, e la serata in corso si chiede alla funzione unica — non a
  // `oggiLocale()`, che alle 00:30 dice già domani.
  const ritardi = useMemo(() => {
    const vuoto = { perPrenotazione: new Map(), tavoli: new Set() };
    if (!regole?.ora_fine_serata) return vuoto;
    if (serataDiServizio(adesso, regole.ora_fine_serata) !== data) return vuoto;
    return ritardiDellaSerata({
      prenotazioni: turni,
      conti: contiDellaSerata,
      adesso,
      minutiTolleranza: regole.minuti_tolleranza_ritardo,
      serata: data,
      oraFineSerata: regole.ora_fine_serata,
    });
  }, [regole, adesso, data, turni, contiDellaSerata]);

  // ⚠️ IL COLORE LO DECIDE `segnoDelTavolo()`, non questa schermata — la
  // stessa funzione che usano le Comande. Due schermate che tengono ciascuna
  // la propria precedenza finiscono per colorare due sale diverse, ed è lo
  // stesso motivo per cui la pianta si chiede a una funzione sola.
  const stato = useMemo(() => {
    const s = {};
    for (const g of gruppi) {
      for (const id of g.tavoli ?? []) {
        s[id] = { coperti: g.coperti, corretto: g.corretto };
      }
    }
    // Quello che si sa del singolo tavolo; il segno si decide per INSIEME —
    // tre tavoli accostati sono un tavolone, e un tavolone si colora intero
    // (richiesta di Alessio, 18/08). «Selezionato» non passa di qui: la
    // scelta in corso la disegna la pianta da sé, ed è del singolo tavolo.
    const fatti = {};
    for (const sagoma of sagome) {
      const altri = (perTavolo.get(sagoma.id) ?? []).filter((a) => a.reservation.id !== evidenziata);
      fatti[sagoma.id] = {
        fasce: altri.map((a) => fasciaPerPrenotazione.get(a.reservation.id)),
        inRitardo: ritardi.tavoli.has(sagoma.id),
      };
    }
    for (const [id, segno] of Object.entries(segniDellaSala({ sagome, gruppi, fatti }))) {
      if (!segno.colore && !segno.barrato) continue;
      s[id] = { ...s[id], ...segno };
    }
    return s;
  }, [sagome, perTavolo, evidenziata, fasciaPerPrenotazione, gruppi, ritardi]);

  // ⚠️ UN TOCCO, UN RIQUADRO — e non più tre esiti diversi a seconda di cosa
  // c'è sotto il dito (giro D3, richiesta di Alessio). Prima un tavolo libero
  // avviava una prenotazione, uno prenotato apriva la scheda, e i coperti si
  // correggevano da un elenco che stava da un'altra parte. Adesso il tocco fa
  // sempre la stessa cosa — apre il riquadro di quel tavolo — e dentro ci
  // sono tutte e tre le strade, con le parole che dicono quale fa cosa.
  const tocca = (sagoma) => {
    setAvviso("");
    setError("");

    // Lavoro in corso: il tocco aggiunge o toglie, sempre. Anche su un
    // tavolo già promesso — è il secondo giro della serata, che al
    // telefono si fa: il sistema non lo impedisce e non avvisa.
    if (modo) {
      const dopo = scelti.includes(sagoma.id)
        ? scelti.filter((x) => x !== sagoma.id)
        : [...scelti, sagoma.id];
      setScelti(dopo);
      // 🔴 IL MODULO SENZA TAVOLI SE NE VA — difetto trovato da Alessio:
      // togliendo l'ultimo tavolo il modulo restava lì, intitolato
      // «Prenotazione su nessun tavolo». *«Mi sembra poco sensato»*, ed è
      // giusto: quel modulo esiste perché ha toccato un tavolo, e senza
      // tavolo non ha più oggetto. È la famiglia della schermata che continua
      // a proporre un gesto che non ha più senso.
      //
      // ⚠️ MA SOLO SE NON CI HA GIÀ SCRITTO DENTRO, ed è la parte misurata
      // invece che decisa a priori: far sparire un modulo con dentro un nome e
      // un telefono digitati sarebbe **peggio del difetto** — è la stessa
      // perdita silenziosa del 12/08. Se c'è del testo il modulo resta, e la
      // riga qui sotto dice cosa manca; il pulsante di conferma è già spento
      // da sé, perché senza tavoli non si conferma niente.
      if (modo === "nuova" && dopo.length === 0 && !moduloScritto(nuova)) azzera();
      return;
    }

    setAperta(null);
    setModifica(null);
    setCorrezione(null);

    // ⚠️ TAVOLO LIBERO → DRITTO AI CAMPI, senza passare dal riquadro
    // (richiesta di Alessio, 18/08: *«l'ideale sarebbe che si arrivasse
    // direttamente ai campi da compilare non appena si tocca un tavolo»*).
    // Su un tavolo libero il riquadro non aveva niente da far scegliere: era
    // una tappa, e una tappa che non decide niente è un tocco in più.
    //
    // ⚠️ QUINDI IL TOCCO HA DI NUOVO DUE ESITI, e la condizione dev'essere
    // prevedibile: lo è, e si vede **prima di toccare** — un tavolo bianco è
    // libero, uno colorato ha qualcuno. Il modulo lo dichiara comunque a
    // parole, perché una regola che si deduce da un colore va detta almeno
    // una volta nel posto dove agisce.
    // ⚠️ «Libero» si chiede al TAVOLONE, non alla sagoma: toccando T7 di un
    // tavolone dove qualcuno ha prenotato su T8, il tavolo è occupato — e si
    // vede, perché dal giro D2 il colore si propaga a tutto il gruppo. Chiedere
    // per sagoma faceva contraddire il tocco col colore.
    if (assegnazioniDelGruppo(sagoma.id).length === 0) {
      setToccato(null);
      setModo("nuova");
      setScelti([sagoma.id]);
      return;
    }

    setToccato(sagoma.id);
  };

  // La correzione dei coperti, dai due posti da cui si può fare (il riquadro
  // del tavolo e il modulo della prenotazione nuova). Una funzione sola: due
  // strade che scrivono lo stesso numero sono due strade che possono
  // scriverlo diverso.
  const salvaCoperti = (gruppo) => {
    const n = Number(correzione.coperti);
    // ⚠️ Il vuoto non è zero (lezione del 17/08): un campo svuotato non deve
    // diventare «questo tavolo non tiene nessuno».
    if (!Number.isFinite(n) || correzione.coperti === "") return;
    esegui(async () => {
      await salvaCorrezioneCoperti({
        data,
        tavoli: gruppo.tavoli,
        coperti: n,
        ragione: correzione.ragione,
      });
      setCorrezione(null);
    });
  };

  const tornaAlCalcolato = (gruppo) =>
    esegui(() => rimuoviCorrezioneCoperti({ data, tavoli: gruppo.tavoli }));

  // Aprire la scheda di una prenotazione — dal riquadro del tavolo o
  // dall'elenco sotto. Una funzione sola: due strade che riempiono a mano
  // gli stessi campi finirebbero per riempirli diversi.
  const apriPrenotazione = (p) => {
    setAvviso("");
    setError("");
    setAperta(p);
    setModifica({
      nome: p.customer_name ?? "",
      telefono: p.customer_phone ?? "",
      persone: p.party_size ?? 1,
      ora: p.reservation_time?.slice(0, 5) ?? "",
      note: p.notes ?? "",
    });
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
  // La fascia della prenotazione aperta, letta dal database e non
  // ricalcolata: la regola vive in un posto solo.
  const turnoDi = (id) => turni.find((t) => t.reservation_id === id);

  // --- IL TAVOLO TOCCATO, e cosa gli sta attorno ---
  const sagomaToccata = sagome.find((s) => s.id === toccato) ?? null;
  // ⚠️ Il gruppo lo dice il DATABASE (`coperti_del_giorno`), non una seconda
  // regola qui: chi è accostato con chi è la stessa risposta che colora la
  // pianta e che conta i coperti della serata.
  const gruppoDelToccato = toccato
    ? (gruppi.find((g) => (g.tavoli ?? []).includes(toccato)) ?? null)
    : null;
  // ⚠️ CHI C'È SU UN TAVOLO SI CHIEDE AL TAVOLONE, non alla sagoma.
  // Tre tavoli accostati sono un tavolo solo: una prenotazione agganciata a T8
  // occupa anche T7 e T9, e dal giro D2 li colora. Chiedere per sagoma faceva
  // dire «libero» a un tavolo che si vede colorato — vedi `insiemiPerTavolo`.
  const insiemeDi = useMemo(() => insiemiPerTavolo(sagome, gruppi), [sagome, gruppi]);
  const assegnazioniDelGruppo = (sagomaId) => {
    if (!sagomaId) return [];
    const insieme = insiemeDi.get(sagomaId) ?? [sagomaId];
    // Le stesse prenotazioni non si contano due volte quando un gruppo ha più
    // tavoli e la prenotazione ne occupa più d'uno.
    const viste = new Set();
    return insieme
      .flatMap((id) => perTavolo.get(id) ?? [])
      .filter((a) => !viste.has(a.reservation.id) && viste.add(a.reservation.id));
  };

  const prenotazioniDelToccato = assegnazioniDelGruppo(toccato)
    .map((a) => prenotazioni.find((p) => p.id === a.reservation.id))
    .filter(Boolean);

  // I tavoloni toccati dalla scelta in corso, senza doppioni: toccando due
  // tavoli dello stesso tavolone il numero è uno, e va mostrato una volta.
  const gruppiScelti = gruppi.filter((g) => (g.tavoli ?? []).some((id) => scelti.includes(id)));

  // «È arrivato o no» in tre parole — il dato del giro D2, che nell'elenco
  // non c'era mai stato. ⚠️ Non è un campo scritto da nessuno: si deduce dal
  // conto aperto, e vuoto vuol dire «deve ancora arrivare, ed è presto».
  const statoArrivo = (id) => {
    const r = ritardi.perPrenotazione.get(id);
    if (!r) return "";
    if (r.arrivata) return "arrivati";
    if (r.inRitardo) return `in ritardo di ${r.minuti} min`;
    return "attesi";
  };

  // --- L'EVIDENZIAZIONE INCROCIATA, nei due versi (giro D3, punto 5) ---
  //
  // ⚠️ Fino a oggi per accompagnare qualcuno al tavolo bisognava **incrociare
  // due elenchi con gli occhi** — la pianta sopra e le prenotazioni sotto — ed
  // è la causa principale della fatica che Alessio ha descritto.
  //
  // ⚠️ E si riusa il segno che c'è già: «selezionato» significa, per la
  // precedenza dei colori, *la risposta al tuo tocco*. Un colore nuovo apposta
  // per l'evidenziazione direbbe una quarta cosa con un quarto segno, mentre
  // questa È quella cosa lì.
  const tavoliEvidenziati = modo
    ? scelti
    : aperta
      ? tavoliDi(aperta.id).map((a) => a.dining_table_id)
      : toccato
        ? [toccato]
        : [];
  const prenotazioniEvidenziate = new Set(
    aperta ? [aperta.id] : prenotazioniDelToccato.map((p) => p.id)
  );

  // Le prenotazioni già presenti sui tavoli che si stanno scegliendo — e sui
  // loro TAVOLONI: scegliendo T7 si sta scegliendo anche il tavolo su cui
  // qualcuno ha già prenotato, se T7 è accostato a T8.
  const giaPromessi = (() => {
    const viste = new Set();
    return scelti
      .flatMap((id) => assegnazioniDelGruppo(id))
      .filter((a) => a.reservation.id !== evidenziata)
      .filter((a) => !viste.has(a.reservation.id) && viste.add(a.reservation.id));
  })();

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
      {/* ⚠️ QUI C'ERA IL PARAGRAFO CHE SPIEGAVA COSA FA IL TOCCO, tolto da
          Alessio il 18/08 insieme alle legende e alle altre due spiegazioni.
          Non era sbagliato: era rivolto a chi non sapeva, e lui ormai sa.
          La regola generale sta in CLAUDE.md §6 — *la documentazione a
          schermo ha un destinatario, e il destinatario cambia*. Il giorno che
          entrerà personale nuovo va rimessa, e non nella stessa forma. */}
      <h1 className="font-display text-2xl text-b58-charcoal mt-1 mb-4">La sala</h1>

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
        {/* «SIAMO AL COMPLETO» — un interruttore piccolo sulla riga della
            data, non più un riquadro (Alessio, 18/08). ⚠️ È l'unico freno
            alle richieste dal sito e il rifiuto sta **dentro** la funzione
            pubblica, non qui: una casella spenta nella schermata non è un
            freno. E resta una cosa diversa da «siamo chiusi», che si mette da
            Sala e orari — sono due fatti diversi e due tabelle diverse. */}
        <label className="flex items-center gap-2 text-sm text-b58-charcoal-soft">
          <input
            type="checkbox"
            checked={pieno}
            disabled={!isTitolare}
            onChange={(e) => esegui(() => setSoldOut(data, e.target.checked))}
            className="h-4 w-4"
          />
          al completo
        </label>
      </div>

      {caricamento ? (
        <p className="text-sm text-b58-charcoal-soft">Caricamento…</p>
      ) : !letta ? (
        /* 🔴 LA SALA NON SI DISEGNA SE NON È STATA LETTA. Prima qui si
           disegnava lo stesso, e con nessun tavolo dentro: una sala vuota che
           chi guarda legge «non ha prenotato nessuno».
           ⚠️ E il rifiuto ha la sua via d'uscita (regola del 16/08: un rifiuto
           senza gesto d'uscita è un vicolo cieco), perché quell'errore è
           passeggero — a lui è capitato una volta sola, e riaprendo la pagina
           era tornato tutto. */
        <div className="rounded-xl border border-dashed border-b58-terracotta/40 p-8 text-center">
          <p className="text-b58-charcoal font-medium mb-1">Non sono riuscito a leggere la sala.</p>
          <p className="text-sm text-b58-charcoal-soft mb-4">
            Non vuol dire che è vuota: vuol dire che non lo so. Di solito è la connessione.
          </p>
          <button
            type="button"
            onClick={() => {
              setError("");
              setCaricamento(true);
              ricarica()
                .catch((e) => setError(e.message))
                .finally(() => setCaricamento(false));
            }}
            className={PRINCIPALE}
          >
            Riprova
          </button>
        </div>
      ) : (
        <>

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
                {/* ⚠️ Qui c'era la scomposizione («31 in questa disposizione ·
                    6 prenotati»), tolta da Alessio il 18/08. Il numero grande
                    resta — è la risposta a «c'è posto stasera?» che aveva
                    chiesto lui nel giro B.
                    ⚠️ E resta anche il suo limite, che ora **non è più scritto
                    da nessuna parte a schermo**: quel numero conta i soli
                    TAVOLI, e lascia fuori divani e Chef Table (sono due
                    formule diverse: chi chiama per cenare vuole un tavolo).
                    Finché lo legge Alessio va bene, perché la regola l'ha
                    decisa lui; per chi verrà dopo è un numero che sembra dire
                    «la sala tiene 25» e non lo dice. */}
                {posto.in_attesa > 0 && (
                  <span className="text-[13px] text-b58-charcoal-soft">
                    {posto.in_attesa} da confermare
                  </span>
                )}
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
              {/* 🔴 QUI C'ERA L'AVVERTENZA CHE ARRIVA DAL DATABASE INSIEME AL
                  NUMERO — «il conteggio guarda i soli tavoli: divani e Chef
                  Table restano fuori» — tolta da Alessio il 18/08.
                  ⚠️ È un rovesciamento di un principio, non solo di una riga
                  (n. 13): dal 15/08 in questo progetto **il numero e la frase
                  che ne dichiara il limite viaggiano insieme**, e la frase
                  arriva dal database proprio perché una schermata non possa
                  separarla dal numero. Adesso è separata.
                  ⚠️ `posto.avvertenza` **continua ad arrivare** e nessuna
                  seconda schermata che mostrasse questo totale resterebbe
                  scoperta: si è smesso di stamparla qui, non di calcolarla. */}
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

          <div ref={piantaRef}>
          <PiantaSala
            sagome={sagome}
            selezione={tavoliEvidenziati}
            stato={stato}
            gruppi={gruppi}
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
          </div>

          {/* 🔴 QUI C'ERA LA RIGA CHE SPIEGAVA PERCHÉ IN COMANDE LA SALA È
              GIRATA — tolta da Alessio il 18/08, ed è un ROVESCIAMENTO
              (n. 11 in docs/decisioni_rovesciate.md): quella riga nasce da
              una sua decisione del 17/08, che l'aveva voluta su ENTRAMBE le
              schermate perché chi confronta le due sale non sospetti due
              disposizioni diverse.
              ⚠️ Il prezzo, accettato e dichiarato: sul telefono la riga non
              spiegava più niente (lì la pianta si gira da sola e le due
              schermate mostrano la stessa cosa), ma **sul computer la ragione
              vale ancora** — chi aprirà le due schermate su un monitor largo
              vedrà due sale girate diversamente, senza niente che glielo
              spieghi. Gli era stato proposto di tenerla solo lì; ha deciso di
              toglierla ovunque. */}

          {/* IL RIQUADRO DEL TAVOLO (giro D3, richiesta di Alessio).
              ⚠️ ASSORBE il tocco, non gli si affianca: prima toccare un
              tavolo prenotato apriva direttamente la prenotazione, e i
              coperti si correggevano da un elenco separato sotto la pianta.
              Due strade per due pezzi della stessa cosa — e l'elenco è
              sparito con questo riquadro.
              ⚠️ E QUI DENTRO CONVIVONO DUE COSE DI NATURA DIVERSA, che vanno
              dichiarate o si sbaglia in silenzio: **il tocco è del tavolo**
              (hai toccato T8), **il numero dei coperti è del TAVOLONE** (la
              correzione ha per chiave l'insieme, dal giro B). Correggere il
              numero di un tavolone credendo di correggere un tavolo è un
              errore che poi decide se si accetta gente. */}
          {toccato && !modo && (
            <div className="mt-3 rounded-xl bg-b58-parchment ring-1 ring-b58-terracotta/40 p-4">
              <div className="flex items-baseline justify-between gap-3 mb-2">
                <p className="text-b58-charcoal font-medium">
                  {sagomaToccata?.label}
                  {gruppoDelToccato && (gruppoDelToccato.tavoli ?? []).length > 1 && (
                    <span className="text-sm font-normal text-b58-charcoal-soft">
                      {" "}
                      — accostato a {(gruppoDelToccato.etichette ?? [])
                        .filter((e) => e !== sagomaToccata?.label)
                        .join(" · ")}
                    </span>
                  )}
                </p>
                <button
                  type="button"
                  onClick={azzera}
                  className="text-sm text-b58-charcoal-soft underline shrink-0"
                >
                  Chiudi
                </button>
              </div>

              {/* I COPERTI — la stessa casella che compare nel modulo della
                  prenotazione nuova, scritta una volta sola. */}
              <CopertiDelGruppo
                gruppo={gruppoDelToccato}
                correzione={correzione}
                setCorrezione={setCorrezione}
                salvando={salvando}
                salva={salvaCoperti}
                azzeraCorrezione={tornaAlCalcolato}
              />

              {/* CHI C'È SU QUESTO TAVOLO — e da qui si apre la sua scheda.
                  Il riquadro non ripete la scheda: la introduce. */}
              {prenotazioniDelToccato.length > 0 ? (
                <ul className="divide-y divide-b58-charcoal/10 rounded-lg ring-1 ring-b58-charcoal/10 mb-2">
                  {prenotazioniDelToccato.map((p) => (
                    <li key={p.id} className="px-3 py-2 flex flex-wrap items-center gap-x-3 gap-y-1">
                      <span className="text-sm text-b58-charcoal-soft w-12">
                        {p.reservation_time?.slice(0, 5)}
                      </span>
                      <span className="text-sm text-b58-charcoal flex-1 min-w-[8rem]">
                        {p.customer_name}
                        <span className="text-b58-charcoal-soft"> · {p.party_size}</span>
                      </span>
                      <span className="text-[11px] text-b58-charcoal-soft">{statoArrivo(p.id)}</span>
                      <button type="button" onClick={() => apriPrenotazione(p)} className={BOTTONE}>
                        Apri
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-b58-charcoal-soft mb-2">Nessuno, per ora.</p>
              )}

              <button
                type="button"
                onClick={() => {
                  setAperta(null);
                  setModo("nuova");
                  setScelti([toccato]);
                }}
                className={PRINCIPALE}
              >
                Prendi una prenotazione qui
              </button>
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
          {/* ⚠️ QUI C'ERA LA LEGENDA DEI COLORI, TOLTA DA ALESSIO il 18/08
              perché la considera superflua. La conseguenza, detta invece che
              subita: **la precedenza dei segni resta dichiarata solo nel
              codice** (`segnoDelTavolo` in lib/calcoli/ritardo.js) **e nel
              riepilogo del giro D2** — è di lì che va ripescata il giorno che
              entrerà in sala qualcuno che non conosce i colori a memoria. */}

          <div className="flex flex-wrap items-center gap-3 mt-2 mb-6 text-[11px] text-b58-charcoal-soft">
            <span>
              {scostamenti > 0
                ? `${scostamenti} ${scostamenti === 1 ? "tavolo spostato" : "tavoli spostati"} solo per questo giorno`
                : "Sala nella disposizione di sempre"}
            </span>
            {/* ⚠️ UN SOLO COMANDO al posto di un collegamento per tavolo
                (Alessio, 18/08). Prima, con sei tavoli spostati, questa riga
                era sei pulsanti. Il gesto fine — rimettere a posto un tavolo
                solo — si fa trascinandolo, che è come lo si è mosso. */}
            {isTitolare && scostamenti > 0 && (
              <button
                type="button"
                onClick={() =>
                  esegui(async () => {
                    for (const s of sagome.filter((x) => x.spostato)) {
                      await riportaSagomaAllaBase({ data, sagomaId: s.id });
                    }
                  })
                }
                className="underline hover:text-b58-terracotta-dark"
              >
                rimetti tutti a posto
              </button>
            )}
          </div>

          {/* PRENOTAZIONE NUOVA — il gesto principale di questa pagina */}
          {modo === "nuova" && (
            <div ref={moduloRef} className="rounded-xl bg-b58-terracotta/10 ring-1 ring-b58-terracotta/30 p-5 mb-5">
              {/* ⚠️ Qui c'erano due spiegazioni — come si aggiungono i tavoli
                  e perché si è arrivati qui — tolte da Alessio il 18/08
                  insieme alle altre cinque. Le regole restano: il tocco
                  aggiunge e toglie, e il cliente non riceve nessuna email
                  (l'invio parte su un cambio di stato, e qui non ce n'è
                  nessuno — verificato il 14/08, non dedotto). */}
              <p className="text-b58-charcoal font-medium mb-3">
                Prenotazione su{" "}
                {etichetteScelte || (
                  // Resta possibile solo quando c'è già del lavoro dentro:
                  // senza testo scritto il modulo si chiude da sé.
                  <em className="text-b58-terracotta-dark">nessun tavolo — toccane uno</em>
                )}
              </p>

              {/* I COPERTI DEI TAVOLI SCELTI — la stessa casella del riquadro.
                  ⚠️ Senza di lei, dopo che il tocco sul tavolo libero salta il
                  riquadro, il numero di un tavolo libero non si potrebbe più
                  correggere da nessuna parte: era il gesto dell'elenco sotto
                  la pianta, che questo giro ha tolto. E qui serve davvero —
                  è il numero su cui si decide se accettare la prenotazione
                  che si sta scrivendo. */}
              {gruppiScelti.map((g) => (
                <CopertiDelGruppo
                  key={(g.tavoli ?? []).join(",")}
                  gruppo={g}
                  mostraNumero
                  correzione={correzione}
                  setCorrezione={setCorrezione}
                  salvando={salvando}
                  salva={salvaCoperti}
                  azzeraCorrezione={tornaAlCalcolato}
                />
              ))}

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
              {/* ⚠️ Qui c'erano due cose, tolte da Alessio il 18/08: la riga
                  «Su T8. Cambia quello che serve…» e il riquadro del ritardo
                  in parole. Il ritardo resta dove si guarda davvero — nella
                  riga dell'elenco, dove c'è già — e qui era la stessa cosa
                  detta due volte con più parole. Le regole non cambiano: su
                  quali tavoli sta questa prenotazione si legge sulla pianta,
                  che è accesa proprio su quelli.
                  ⚠️ Con la riga se ne va anche la frase della FASCIA, che
                  era l'unico posto in cui si leggeva a parole: il colore del
                  tavolo la dice, e la sua precedenza vive nel codice. */}

              {/* ⚠️ «DA LIBERARE ENTRO LE…», ed è il punto che fa valere le
                  fasce. Senza, si accetta gente alle 19:30 «purché liberi
                  per le 22» e quella nota resta nella scheda: in servizio
                  non la vede nessuno, il tavolo non si libera e il secondo
                  turno salta. L'ora non è scritta a mano — si legge dalla
                  prenotazione successiva, quindi la segue se si sposta e
                  sparisce se viene annullata. */}
              {turnoDi(aperta.id)?.liberare_entro && (
                <p className="rounded-lg bg-b58-gold/20 ring-1 ring-b58-gold px-3 py-2 text-sm mb-4">
                  <strong>Da liberare entro le {turnoDi(aperta.id).liberare_entro.slice(0, 5)}</strong> —
                  su questo tavolo c'è un altro turno dopo.
                </p>
              )}

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
                    // ⚠️ Aprendo la prenotazione DALL'ELENCO non c'è nessun
                    // tavolo toccato: senza questa seconda strada il pulsante
                    // partirebbe con nessun tavolo scelto, cioè direbbe «su
                    // questo tavolo» e non ne prenderebbe nessuno.
                    setScelti(
                      toccato ? [toccato] : tavoliDi(aperta.id).map((a) => a.dining_table_id)
                    );
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
            /* ⚠️ RIORDINATA PER IL TELEFONO (giro D3, punto 6). Prima era
               piatta e **i comandi pesavano quanto le informazioni**: «Cambia
               tavolo» era un riquadro grande ripetuto su ogni riga, mentre
               quello che si legge mille volte è *ora → nome → quanti → dove*.
               Adesso le informazioni stanno in prima riga, e i comandi
               compaiono **solo sulla riga evidenziata** — cioè dopo un tocco.
               ⚠️ E c'è lo stato che mancava: **chi è arrivato e chi tarda**.
               Alle 21:15, con due tavoli liberi e uno che non si è visto, è la
               prima domanda che ci si fa. */
            <ul className="rounded-xl bg-b58-parchment ring-1 ring-b58-charcoal/10 divide-y divide-b58-charcoal/5">
              {prenotazioni.map((p) => {
                const suoi = tavoliDi(p.id);
                const accesa = prenotazioniEvidenziate.has(p.id);
                return (
                  <li
                    key={p.id}
                    ref={(el) => {
                      righeRef.current[p.id] = el;
                    }}
                    // ⚠️ SENZA TAVOLO SI FA NOTARE, e non è un vezzo: sua
                    // richiesta — *«serve qualcosa che evidenzi le
                    // prenotazioni che non hanno ancora un tavolo altrimenti
                    // si rischia che rimangano senza»*. È il caso in cui
                    // l'app deve farsi notare invece di essere discreta, e ha
                    // una ragione che le altre righe non hanno: **una
                    // prenotazione senza tavolo non compare da nessuna parte
                    // sulla pianta**, quindi questo elenco è l'unico posto
                    // dove può essere vista. Se sfugge qui, sfugge e basta.
                    className={`p-4 transition-colors ${
                      accesa ? "bg-b58-terracotta/10" : ""
                    } ${suoi.length === 0 ? "border-l-4 border-b58-terracotta" : ""}`}
                  >
                    {/* Tutta la riga è tappabile: tocco = «fammi vedere dov'è»,
                        ed è il verso opposto dell'evidenziazione incrociata. */}
                    <button
                      type="button"
                      onClick={() => {
                        apriPrenotazione(p);
                        setToccato(null);
                        // Sul telefono la pianta sta sopra e fuori schermo:
                        // senza questo, il tavolo si accende dove non si vede.
                        piantaRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
                      }}
                      className="w-full text-left flex flex-wrap items-baseline gap-x-3 gap-y-1"
                    >
                      <span className="text-sm text-b58-charcoal-soft w-12 shrink-0">
                        {p.reservation_time?.slice(0, 5)}
                      </span>
                      <span className="text-b58-charcoal font-medium flex-1 min-w-[8rem]">
                        {p.customer_name}
                        <span className="text-b58-charcoal-soft font-normal">
                          {" "}
                          · {p.party_size} persone
                        </span>
                      </span>
                      <span className="text-sm">
                        {suoi.length > 0 ? (
                          <span className="text-b58-olive-dark font-medium">
                            {suoi.map((a) => a.etichetta_al_momento).join(" · ")}
                          </span>
                        ) : (
                          <span className="rounded-full bg-b58-terracotta text-b58-parchment text-[11px] font-medium px-2.5 py-1">
                            senza tavolo
                          </span>
                        )}
                      </span>
                      {statoArrivo(p.id) && (
                        <span className="text-[11px] text-b58-charcoal-soft">
                          {statoArrivo(p.id)}
                        </span>
                      )}
                      {p.status === "richiesta_in_attesa" && (
                        <span className="inline-flex items-center rounded-full bg-b58-gold text-b58-parchment text-[11px] font-medium px-2.5 py-1">
                          da confermare
                        </span>
                      )}
                    </button>

                    {accesa && (
                      <div className="flex flex-wrap items-center gap-3 mt-2">
                        <button
                          type="button"
                          onClick={() => iniziaAssegnazione(p)}
                          className={BOTTONE}
                        >
                          {suoi.length > 0 ? "Cambia tavolo" : "Dai un tavolo"}
                        </button>
                        {suoi.length > 0 && isTitolare && (
                          <button
                            type="button"
                            onClick={() => esegui(() => togliAssegnazione(p.id))}
                            className="text-xs text-b58-charcoal-soft hover:text-b58-terracotta-dark underline"
                          >
                            togli il tavolo
                          </button>
                        )}
                      </div>
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
