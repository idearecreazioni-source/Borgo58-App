import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  addDraftItem,
  apriConto,
  cancelOrder,
  getOrder,
  getServiceSettings,
  listContiPerPrenotazioni,
  listMenuForOrder,
  listOpenOrders,
  orderTotals,
  removeDraftItem,
  sendDraftItems,
  setOrderCoperti,
  spostaConto,
  updateCopertoPrice,
  updateDraftItemQuantity,
  updateItemNote,
  updateOrderNote,
  voidSentItem,
} from "../../lib/api/orders";
import { getCopertiDelGiorno, getPiantaDelGiorno, getTurniDelGiorno } from "../../lib/api/sala";
import { listReservations } from "../../lib/api/reservations";
import { FASCE, serataDiServizio, serataScaduta } from "../../lib/calcoli/serata";
import {
  insiemiPerTavolo,
  ritardiDellaSerata,
  segniDellaSala,
  statoDelConto,
} from "../../lib/calcoli/ritardo";
import { cosaSiVede, esitoDelTocco, siVedeLaBarraDeiTavoli } from "../../lib/calcoli/selezione";
import { listBarItems } from "../../lib/api/barItems";
import { RECIPE_CATEGORIES, formatDate, formatEUR } from "../../lib/constants";
import { useAuth } from "../../context/AuthContext";
import CalibrazioneTocco from "./CalibrazioneTocco";
import CloseOrderModal from "./CloseOrderModal";
import CampoAutosalvato from "../../components/CampoAutosalvato";
import PiantaSala from "../../components/PiantaSala";
import PrecontoModal from "./PrecontoModal";

const lineLabel = (item) => item.recipe?.name || item.free_text_name;
const lineTotal = (item) => item.quantity * Number(item.unit_price);

// Schermata SALA — tablet 8,7" in verticale, tenuto in mano fra i tavoli
// (§3.2.1, disegno validato con Alessio sul simulatore a grandezza reale).
//
// Perche' e' una colonna sola e non le tre di prima: la Cucina non ha
// schermo (solo stampante, scelta deliberata) e il Bar ha un tablet suo,
// orizzontale, con un layout da cassa. Un'unica schermata a tre colonne
// non e' una versione compatta di quel disegno: e' un disegno diverso.
//
// Le misure dei tocchi sono in CENTIMETRI REALI (classi .tocco-*), non in
// pixel: durante un servizio pieno la differenza fra 1 cm e 6 mm e'
// mandare in cucina il piatto sbagliato.
export default function Sala() {
  const { isTitolare } = useAuth();

  const [sagome, setSagome] = useState([]);
  // I tavoloni della serata. Servono al DISEGNO: senza, in Comande tre
  // tavoli accostati si vedrebbero come tre quadrati e in Calendario come
  // un tavolone — la stessa sala disegnata in due modi, che è il rilievo
  // che Alessio aveva già fatto il 17/08. Chi sta con chi lo dice il
  // database, qui non si ricalcola niente.
  const [gruppi, setGruppi] = useState([]);
  const [openOrders, setOpenOrders] = useState([]);
  // I tavoli toccati e non ancora aperti: tre sagome accostate fanno UN
  // conto, non tre — è il motivo per cui questa schermata è cambiata.
  const [selezione, setSelezione] = useState([]);
  const [menu, setMenu] = useState([]);
  const [barItems, setBarItems] = useState([]);
  const [showWines, setShowWines] = useState(false);
  const [copertoPrice, setCopertoPrice] = useState(null);
  // Quale sera è questa. Resta nullo finché non si sa: senza, la pianta
  // si caricherebbe per il giorno sbagliato e poi si correggerebbe sotto
  // gli occhi di chi sta servendo.
  const [serata, setSerata] = useState(null);
  // I turni di stasera: servono per «da liberare entro le…», che senza
  // questa schermata resterebbe una nota che vede solo chi prenota.
  const [turni, setTurni] = useState([]);
  // CHI HA PRENOTATO STASERA, e su quale tavolo. Fino al giro D2 questa
  // schermata non lo sapeva: la sala si apriva bianca, senza coperti, senza
  // colori e senza nomi, e chi serviva doveva tenere le prenotazioni su un
  // altro dispositivo o a memoria.
  const [prenotati, setPrenotati] = useState([]);
  // I conti che nominano quelle prenotazioni — di QUALUNQUE stato. È l'unico
  // modo di sapere chi è già arrivato senza chiedere a nessuno di segnarlo.
  const [contiDellaSerata, setContiDellaSerata] = useState([]);
  // I minuti dopo i quali un tavolo prenotato e senza comanda si sbarra.
  // Numero di Alessio, letto dal database.
  const [tolleranza, setTolleranza] = useState(null);
  const [oraFineSerata, setOraFineSerata] = useState(null);
  // ⚠️ L'OROLOGIO DEVE BATTERE, altrimenti il ritardo si vedrebbe solo
  // riaprendo la pagina. Un tavolo che diventa in ritardo mentre il tablet è
  // acceso sul tavolino è precisamente il caso per cui questa cosa esiste.
  // Un minuto: la tolleranza è di trenta, un battito più fitto non
  // aggiungerebbe niente e ridisegnerebbe la sala sotto le mani.
  const [adesso, setAdesso] = useState(() => new Date());
  // La sala è stata letta davvero? Vedi la nota in fondo a `loadBoard`.
  const [letta, setLetta] = useState(false);
  const [order, setOrder] = useState(null);

  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [loadingOrder, setLoadingOrder] = useState(false);

  const [showFreeForm, setShowFreeForm] = useState(false);
  const [freeForm, setFreeForm] = useState({ name: "", price: "", destination: "bar" });

  const [showPrecon, setShowPrecon] = useState(false);
  const [showClose, setShowClose] = useState(false);
  // Si sta cambiando l'insieme dei tavoli di questo conto: unire,
  // separare, spostare. È lo «sposta» del 09/08, che ora sa fare tutt'e tre.
  const [spostando, setSpostando] = useState(false);

  const [panel, setPanel] = useState(null); // null | "coperto" | "calibrazione"
  const [priceDraft, setPriceDraft] = useState("");

  // La pianta è quella di STASERA: se Alessio ha accostato dei tavoli per
  // il servizio, in sala si vedono accostati.
  //
  // 🔴 E fino al 18/08/2026 qui c'era `oggiLocale()`, col commento che
  // diceva *«fra mezzanotte e le due la sala di ieri è ancora quella
  // giusta»* — cioè **il contrario di quello che il codice faceva**.
  // `oggiLocale()` cura la trappola del fuso, non quella della serata:
  // alle 00:30, col locale aperto, dice **domani**. La sala cambiava sotto
  // le mani dei camerieri a mezzanotte, e il commento rassicurava che non
  // succedesse. È la stessa famiglia della frase sulla correzione dei
  // coperti trovata ieri: un testo che descrive male il proprio programma.
  //
  // ⚠️ `serataDiServizio()` decide il giorno PREDEFINITO, non l'unico
  // visitabile: la pianta del Calendario ha il suo selettore di data e
  // resta libera, così alle 00:30 si può comunque preparare domani.
  const loadBoard = () =>
    Promise.all([
      getPiantaDelGiorno(serata),
      listOpenOrders(),
      getTurniDelGiorno(serata),
      getCopertiDelGiorno(serata),
      listReservations({ date: serata }),
    ]).then(async ([p, o, t, g, pr]) => {
      setSagome(p);
      setOpenOrders(o);
      setTurni(t);
      setGruppi(g);
      // ⚠️ SOLO LE CONFERMATE. Una richiesta ancora in attesa non tiene
      // nessun tavolo (decisione del 14/08): mostrarla in sala prometterebbe
      // un posto che nessuno ha promesso, e la farebbe risultare in ritardo
      // per qualcuno che non è stato invitato.
      //
      // ⚠️ E I NOMI SI PRENDONO DALLE PRENOTAZIONI, non dai tavoli
      // prenotati: una confermata a cui Alessio non ha ancora assegnato un
      // tavolo esiste eccome — arriva stasera — e chiedendo l'elenco per
      // tavolo sarebbe sparita dalla lista senza che niente lo dicesse. Chi
      // sta con chi lo dicono i turni, che portano già i tavoli.
      setPrenotati((pr ?? []).filter((r) => r.status === "confermata"));
      // I conti si chiedono DOPO, perché servono gli id delle prenotazioni.
      // Senza nessuna prenotazione non si chiede niente al database.
      const ids = [...new Set(t.map((x) => x.reservation_id))];
      setContiDellaSerata(await listContiPerPrenotazioni(ids));
      // 🔴 SOLO QUI LA SALA È LETTA DAVVERO. Queste cinque letture partono
      // insieme: se una fallisce, **nessuna** delle altre viene applicata, e
      // prima del 18/08 la schermata rispondeva «Nessun tavolo configurato»
      // — una frase sicura di sé, e falsa. È l'errore che Alessio ha visto in
      // Calendario alle 23:55 («TypeError: Load failed»), e qui morderebbe di
      // sera, con la rete del locale, mentre si serve.
      setLetta(true);
    });

  useEffect(() => {
    listMenuForOrder().then(setMenu).catch((e) => setError(e.message));
    listBarItems().then(setBarItems).catch((e) => setError(e.message));
    getServiceSettings()
      .then((s) => {
        setCopertoPrice(Number(s.coperto_price));
        setPriceDraft(String(s.coperto_price));
        setTolleranza(s.minuti_tolleranza_ritardo);
        setOraFineSerata(s.ora_fine_serata);
        setSerata(serataDiServizio(new Date(), s.ora_fine_serata));
      })
      .catch((e) =>
        // Messaggio esplicito invece di un fallback silenzioso: un conto
        // calcolato senza coperto sembrerebbe giusto e sarebbe sbagliato.
        setError(
          `Impostazioni di sala non leggibili (${e.message}). Se la migrazione dei coperti non è ancora stata applicata, il coperto non verrà conteggiato.`
        )
      );
  }, []);

  // La pianta si carica quando si sa che sera è, non prima.
  //
  // ⚠️ `setLetta(false)` PRIMA DI LEGGERE, e la ragione va scritta perché il
  // difetto oggi **non è vivo**: qui la serata si decide una volta sola,
  // all'apertura della schermata, e non cambia più (voce dichiarata nel
  // riepilogo del giro D2). Quindi il caso «serata nuova, lettura fallita,
  // resta a schermo la sala di prima» non può presentarsi.
  // Ma il giorno che la serata si aggiornerà da sola alle 5 — che è una voce
  // aperta — quella trappola sarebbe **armata**, e sarebbe la peggiore delle
  // due: non una sala vuota, che si nota, ma **la sala di ieri sotto la
  // serata di oggi**, che è plausibile. Costa una riga chiuderla adesso.
  //
  // 🔴 E VALE LA PENA DIRE PERCHÉ ERA RIMASTA APERTA: la cura è nata nella
  // schermata dove il difetto è stato **visto** (il Calendario, in una
  // fotografia), non in quella dove morde di più. *Un difetto curato dove lo
  // si è visto lascia scoperto lo stesso difetto dove nessuno ha guardato.*
  useEffect(() => {
    if (!serata) return;
    setLetta(false);
    loadBoard().catch((e) => setError(e.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serata]);

  // L'orologio che fa scattare il ritardo senza che nessuno ricarichi la
  // pagina. ⚠️ Fa battere il RITARDO, non la serata: se il tablet resta
  // acceso oltre l'ora di fine serata, la sala mostrata resta quella di
  // stanotte finché non si ricarica — com'era prima di questo giro.
  useEffect(() => {
    const battito = setInterval(() => setAdesso(new Date()), 60_000);
    return () => clearInterval(battito);
  }, []);

  // Quale conto sta su quale sagoma. Il legame è una chiave esterna, non
  // il nome del tavolo: «T5 · T6 · T7» non è un tavolo.
  // 🔴 E IL CONTO CHE SI STA SERVENDO SI PRENDE DA `order`, NON DA QUI.
  // Trovato il 21/08 guardando la schermata viva: segnando un piatto il
  // pallino restava **vuoto**, perché `openOrders` è la fotografia
  // dell'ultima lettura della sala e non sa niente di quello che si sta
  // scrivendo adesso. In servizio vorrebbe dire che il cameriere segna i
  // piatti e la sala continua a dire «non c'è niente da mandare» — cioè il
  // pallino, che esiste apposta per non far dimenticare l'invio, mentirebbe
  // proprio mentre serve.
  //
  // ⚠️ Solo per QUEL conto: gli altri tavoli cambiano per mano d'altri, e
  // per quelli la fotografia della sala è la cosa giusta.
  const orderForTable = (sagomaId) => {
    const dallaSala = openOrders.find((o) =>
      (o.tavoli ?? []).some((t) => t.dining_table_id === sagomaId)
    );
    return dallaSala && order?.id === dallaSala.id ? order : dallaSala;
  };

  // CHI È IN RITARDO. Il calcolo è la funzione pura, la stessa che usa il
  // Calendario: due schermate che decidessero per conto proprio quando un
  // tavolo è in ritardo finirebbero per sbarrarne di diversi, e quella su cui
  // si agisce è questa.
  const ritardi = useMemo(
    () =>
      ritardiDellaSerata({
        prenotazioni: turni,
        conti: contiDellaSerata,
        adesso,
        minutiTolleranza: tolleranza,
        serata,
        oraFineSerata,
      }),
    [turni, contiDellaSerata, adesso, tolleranza, serata, oraFineSerata]
  );

  // Chi siede (o siederà) su quale tavolo, per nome. Il nome non entra nella
  // sagoma — in un quadrato di 90 cm non ci sta (decisione del 14/08) — ma
  // entra nell'elenco qui sotto e sulla scheda del conto aperto.
  const prenotazioniPerTavolo = useMemo(() => {
    const m = new Map();
    for (const t of turni) {
      for (const id of t.tavoli ?? []) {
        const elenco = m.get(id) ?? [];
        elenco.push(t.reservation_id);
        m.set(id, elenco);
      }
    }
    return m;
  }, [turni]);

  const fasciaDi = useMemo(
    () => new Map(turni.map((t) => [t.reservation_id, t.fascia])),
    [turni]
  );

  // LO STATO DI OGNI SAGOMA — coperti, colore e sbarratura, decisi in un
  // posto solo (`segnoDelTavolo`). Fino al giro D2 qui arrivava soltanto
  // «occupato / selezionato»: la sala in servizio era bianca proprio nelle
  // ore in cui serve sapere chi arriva e quanti sono.
  const statoSagome = useMemo(() => {
    const s = {};
    for (const g of gruppi) {
      for (const id of g.tavoli ?? []) s[id] = { coperti: g.coperti, corretto: g.corretto };
    }
    // 🔴 SUL TAVOLO PRENOTATO IL NUMERO DIVENTA LE PERSONE ATTESE (21/08,
    // deciso da Alessio). Prima T4 diceva «4» — la sua capienza — anche se la
    // prenotazione era per due, e su quel numero si regge il gesto di
    // cercare chi è arrivato: davanti a due persone, un tavolo che dice «4»
    // non aiuta a riconoscerle.
    //
    // ⚠️ CON DUE TURNI SULLO STESSO TAVOLO IL NUMERO RESTA LA CAPIENZA, ed è
    // una scelta dichiarata: le persone attese sarebbero due numeri diversi,
    // e in una cifra sola non ci stanno. Sceglierne uno vorrebbe dire
    // inventare quale dei due gruppi «è» quel tavolo.
    for (const [id, ids] of prenotazioniPerTavolo) {
      if (ids.length !== 1) continue;
      const p = prenotati.find((r) => r.id === ids[0]);
      if (p?.party_size && s[id]) s[id] = { ...s[id], coperti: p.party_size, attese: true };
    }
    // Quello che si sa del SINGOLO tavolo. Il segno però si decide per
    // insieme: tre tavoli accostati sono un tavolone, e un tavolone si
    // colora intero (richiesta di Alessio, 18/08).
    const fatti = {};
    for (const sagoma of sagome) {
      const conto = orderForTable(sagoma.id);
      const sopra = prenotazioniPerTavolo.get(sagoma.id) ?? [];
      fatti[sagoma.id] = {
        // ⚠️ Solo il conto che si sta servendo: la selezione col dito la
        // disegna già la pianta, e propagarla al gruppo prometterebbe di
        // aprire tre tavoli mentre se ne apre uno.
        selezionato: Boolean(conto) && conto.id === order?.id,
        contoAperto: Boolean(conto),
        // I due fatti da cui nascono i pallini. La regola sta in
        // `statoDelConto`, non qui: le righe annullate non contano, ed è
        // esattamente il genere di dettaglio che si dimentica ricopiandolo.
        ...statoDelConto(conto),
        // Le fasce dei soli clienti che devono ancora sedersi: chi ha già il
        // conto aperto ha smesso di essere un'ora e ha cominciato a essere un
        // tavolo da servire.
        fasce: sopra
          .filter((id) => !ritardi.perPrenotazione.get(id)?.arrivata)
          .map((id) => fasciaDi.get(id)),
        inRitardo: ritardi.tavoli.has(sagoma.id),
      };
    }
    for (const [id, segno] of Object.entries(segniDellaSala({ sagome, gruppi, fatti }))) {
      s[id] = { ...s[id], ...segno };
    }
    return s;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sagome, gruppi, openOrders, order, prenotati, prenotazioniPerTavolo, fasciaDi, ritardi]);

  // L'elenco della serata, in ordine di ora: quello che chi serve guarda
  // quando suona il campanello. Porta il tavolo, che è il dato che manca di
  // più a chi accompagna qualcuno al posto.
  const elencoSerata = useMemo(
    () =>
      turni.map((t) => {
        const r = prenotati.find((p) => p.id === t.reservation_id);
        return {
          id: t.reservation_id,
          ora: t.ora,
          fascia: t.fascia,
          liberareEntro: t.liberare_entro,
          etichette: t.etichette ?? [],
          nome: r?.customer_name ?? "—",
          persone: r?.party_size ?? null,
          ritardo: ritardi.perPrenotazione.get(t.reservation_id),
          conto: openOrders.find((o) => o.reservation_id === t.reservation_id) ?? null,
        };
      }),
    [turni, prenotati, ritardi, openOrders]
  );

  const apriConoscendoIlConto = async (orderId) => {
    setError("");
    setLoadingOrder(true);
    try {
      const full = await getOrder(orderId);
      setOrder(full);
      setSelezione([]);
      await loadBoard();
    } catch (e) {
      setError(e.message);
    } finally {
      setLoadingOrder(false);
    }
  };

  // Un tocco sulla pianta: se il tavolo ha già un conto lo apre, altrimenti
  // lo aggiunge (o lo toglie) a quelli che si stanno per aprire insieme.
  // 🔴 SI SELEZIONA UN TAVOLO O UN TAVOLONE, MAI DUE TAVOLI LONTANI.
  //
  // Prima ogni tocco SOMMAVA: si potevano prendere T1 e T9, che stanno ai due
  // capi della sala, e aprirci sopra una comanda sola. Un conto unico su due
  // tavoli distanti non e' una comanda: e' un errore che nessuno vede finche'
  // non arriva il preconto.
  //
  // ⚠️ CHE COSA SIA UN TAVOLONE NON SI DECIDE QUI. Lo conta il database
  // (`coperti_del_giorno`) e lo ridice `insiemiPerTavolo` — **la stessa mappa
  // che COLORA la sala**. E' l'unica scelta che tiene: se il tocco usasse una
  // definizione sua, tornerebbe il difetto del 18/08, dove **il tocco
  // contraddiceva il colore** — un tavolo si vedeva colorato e si comportava
  // da libero. Tutto il disegno di questa schermata poggia su *bianco e'
  // libero, colorato ha qualcuno*.
  //
  // ⚠️ E NON e' la tolleranza geometrica di `sala.js`: quella e' il magnete
  // che aggancia i tavoli mentre si trascinano. Usarla qui vorrebbe dire
  // avere due definizioni di «accostati» che possono discordare.
  const toccaSagoma = (sagoma) => {
    const conto = orderForTable(sagoma.id);
    const insieme = insiemiPerTavolo(sagome, gruppi).get(sagoma.id) ?? [sagoma.id];
    const esito = esitoDelTocco({
      contoAperto: order?.id ?? null,
      contoDelTavolo: conto?.id ?? null,
      selezione,
      insieme,
      spostando,
    });

    if (esito.azione === "rifiuta")
      return setError("Quel tavolo ha già un conto aperto: scegline un altro.");
    if (esito.azione === "resta") return;

    setError("");
    // ⚠️ IL CONTO SI LASCIA PRIMA, mai dopo: e' la condizione della modalita'
    // veloce. Il pannello vecchio deve sparire prima che compaia il nuovo —
    // due comande davanti agli occhi in servizio e' il modo piu' diretto per
    // mandare i piatti di un tavolo a un altro.
    if (esito.lasciaIlConto) setOrder(null);

    if (esito.azione === "apri-conto") return apriConoscendoIlConto(esito.contoId);
    setSelezione(esito.selezione);
  };

  // Il vuoto della sala annulla la scelta: e' l'altra meta' del gesto.
  const toccaSfondo = () => {
    if (selezione.length > 0) setSelezione([]);
  };

  // L'elenco dei tavoli occupati che ha in mano questa schermata può
  // essere vecchio di qualche secondo. La garanzia che lo stesso tavolo
  // non finisca su due conti è un indice unico nel database: qui si
  // traduce solo il suo rifiuto in una frase per chi sta servendo.
  const apriSelezione = async () => {
    if (selezione.length === 0) return;
    setError("");
    setLoadingOrder(true);
    try {
      const orderId = await apriConto(selezione, { serata });
      const full = await getOrder(orderId);
      setOrder(full);
      setSelezione([]);
      await loadBoard();
    } catch (e) {
      setError(e.message);
    } finally {
      setLoadingOrder(false);
    }
  };

  // L'ora entro cui questo tavolo va liberato: la più stretta fra quelle
  // dei turni che insistono sui suoi tavoli.
  const liberareEntro = (() => {
    if (!order) return null;
    const miei = new Set((order.tavoli ?? []).map((t) => t.dining_table_id));
    const ore = turni
      .filter((t) => (t.tavoli ?? []).some((id) => miei.has(id)) && t.liberare_entro)
      .map((t) => t.liberare_entro)
      .sort();
    return ore[0] ?? null;
  })();

  const reloadOrder = () => (order ? getOrder(order.id).then(setOrder) : Promise.resolve());

  const withBusy = async (fn) => {
    setBusy(true);
    setError("");
    try {
      await fn();
      await reloadOrder();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const handleAddMenuItem = (mi) =>
    withBusy(() =>
      addDraftItem(order.id, {
        recipeId: mi.recipe_id,
        destination: "cucina",
        quantity: 1,
        unitPrice: mi.selling_price,
      })
    );

  // Vini e bevande non sono ricette: sulla riga della comanda finiscono
  // come testo, col formato accanto al nome ("Grillo · calice"), perche' in
  // cucina e al bar la differenza fra un calice e una bottiglia conta.
  const handleAddBarItem = (item) =>
    withBusy(() =>
      addDraftItem(order.id, {
        freeTextName: item.serving ? `${item.name} · ${item.serving}` : item.name,
        destination: "bar",
        quantity: 1,
        unitPrice: item.selling_price,
      })
    );

  const handleAddFree = (e) => {
    e.preventDefault();
    if (!freeForm.name.trim() || !freeForm.price) return;
    withBusy(() =>
      addDraftItem(order.id, {
        freeTextName: freeForm.name.trim(),
        destination: freeForm.destination,
        quantity: 1,
        unitPrice: Number(freeForm.price),
      })
    ).then(() => setFreeForm({ name: "", price: "", destination: "bar" }));
  };

  const handleCoperti = (n) => withBusy(() => setOrderCoperti(order.id, n));

  // Le note (del piatto e del tavolo) si salvano da sole mentre si scrive,
  // quindi qui non c'e' niente da ricordarsi di salvare prima dell'invio.
  // Si mandano SOLO le righe visibili su questo schermo: se il Bar sta
  // componendo un altro giro sullo stesso tavolo, il suo non parte.
  const handleSend = () =>
    withBusy(() => sendDraftItems(order.id, draftItems.map((i) => i.id))).then(loadBoard);

  const handleVoid = (itemId) => {
    const reason = window.prompt("Motivo dell'annullamento (obbligatorio):");
    if (reason === null) return;
    if (!reason.trim()) return setError("Serve un motivo per annullare una riga già inviata.");
    withBusy(() => voidSentItem(itemId, reason.trim()));
  };

  const confermaSpostamento = async () => {
    if (selezione.length === 0) return;
    setError("");
    try {
      await spostaConto(order.id, selezione);
      setSpostando(false);
      setSelezione([]);
      await reloadOrder();
      await loadBoard();
    } catch (e) {
      setError(e.message);
    }
  };

  const handleSavePrice = () =>
    updateCopertoPrice(priceDraft)
      .then(() => setCopertoPrice(Number(priceDraft)))
      .catch((e) => setError(e.message));

  const draftItems = order?.items.filter((i) => !i.sent_at && !i.voided_at) ?? [];
  const sentItems = order?.items.filter((i) => i.sent_at && !i.voided_at) ?? [];
  const { coperti, copertoTotal, total } = orderTotals(order, copertoPrice);

  // Menu raggruppato per portata, nell'ordine in cui si mangia — non in
  // ordine alfabetico, che in sala non serve a nessuno.
  const menuByCategory = RECIPE_CATEGORIES.map((c) => ({
    ...c,
    items: menu.filter((mi) => mi.category === c.value),
  })).filter((c) => c.items.length > 0);

  // I vini stanno in una schermata separata (§3.2.1: incolonnati nel menu
  // lo allungavano troppo), le altre bevande restano nell'elenco
  // principale accanto ai piatti.
  const raggruppaPerCategoria = (voci) => {
    const categorie = [...new Set(voci.map((v) => v.category))];
    return categorie.map((nome) => ({ nome, voci: voci.filter((v) => v.category === nome) }));
  };
  const vini = raggruppaPerCategoria(barItems.filter((b) => b.section === "vini"));
  const bevande = raggruppaPerCategoria(barItems.filter((b) => b.section === "bevande"));

  // Riga di un vino o di una bevanda: stesso target di tocco dei piatti.
  const RigaBar = ({ v }) => (
    <button
      type="button"
      disabled={busy}
      onClick={() => handleAddBarItem(v)}
      className="tocco-riga w-full flex items-center gap-2 px-2 rounded-lg text-left hover:bg-b58-cream-dark/70 active:bg-b58-cream-dark disabled:opacity-50 border-b border-b58-charcoal/5"
    >
      <span className="flex-1 min-w-0 text-sm text-b58-charcoal leading-tight">
        {v.name}
        {v.serving && <span className="text-b58-charcoal-soft"> · {v.serving}</span>}
        {v.producer && <span className="block text-[11px] text-b58-charcoal-soft/70">{v.producer}</span>}
      </span>
      <span className="text-xs text-b58-charcoal-soft shrink-0">{formatEUR(v.selling_price)}</span>
      <span className="tocco-bottone shrink-0 rounded-lg bg-b58-terracotta text-b58-parchment flex items-center justify-center text-lg pointer-events-none">
        +
      </span>
    </button>
  );

  const inputClass =
    "w-full rounded-lg border border-b58-charcoal/15 bg-white px-3 py-2 text-sm text-b58-charcoal focus:outline-none focus:ring-2 focus:ring-b58-terracotta";
  const sectionLabel =
    "text-[11px] uppercase tracking-wide font-semibold text-b58-charcoal-soft/70 mb-1.5";

  return (
    <div className="max-w-md mx-auto pb-6">
      {/* 🔴 LA SERATA È FINITA, E LA SALA NON CAMBIA DA SOLA.
          È una decisione di Alessio: chi sta chiudendo alle 5 non deve
          vedersi muovere la sala sotto le mani. Ma tacere del tutto lascia
          scoperto il caso vero — il tablet in carica sul bancone, ripreso
          la mattina, che mostra la sala di stanotte con l'aria di essere
          quella di oggi. ⚠️ È la stessa forma dei tavoli di ieri sotto la
          data di oggi (19/08): non una schermata vuota, che si nota, ma una
          plausibile.
          ⚠️ E COMPARE SENZA CHE NESSUNO TOCCHI NIENTE: si appoggia
          all'orologio che batte ogni minuto per il ritardo — se aspettasse
          un gesto, coprirebbe tutti i casi tranne quello per cui esiste. */}
      {serataScaduta(serata, adesso, oraFineSerata) && (
        <div className="mb-3 rounded-lg bg-b58-terracotta/10 ring-1 ring-b58-terracotta/40 px-3 py-2">
          <p className="text-sm text-b58-charcoal">
            È cominciata una giornata nuova. Questa è ancora la sala della serata di{" "}
            <strong>{formatDate(serata)}</strong>.
          </p>
          <button
            type="button"
            onClick={() => setSerata(serataDiServizio(new Date(), oraFineSerata))}
            className="mt-1 text-sm underline text-b58-terracotta-dark hover:text-b58-charcoal tocco-bottone"
          >
            Passa alla serata di oggi
          </button>
        </div>
      )}

      <div className="flex items-center justify-between gap-2 mb-3">
        <div>
          <h1 className="font-display text-2xl text-b58-charcoal leading-none">Sala</h1>
          <p className="text-xs text-b58-charcoal-soft/70 mt-1">
            {order ? (
              <>
                {order.table_label} aperto
                {" · "}
                <button
                  type="button"
                  onClick={() => {
                    setSpostando(true);
                    setSelezione((order.tavoli ?? []).map((t) => t.dining_table_id));
                  }}
                  className="underline hover:text-b58-terracotta-dark"
                >
                  cambia tavoli
                </button>
              </>
            ) : (
              "Nessun tavolo aperto"
            )}
          </p>
        </div>
        <div className="flex gap-1.5">
          <Link
            to="/comande/bar"
            className="rounded-lg border border-b58-charcoal/15 hover:bg-b58-cream-dark transition-colors text-b58-charcoal text-xs font-medium px-3 py-2"
          >
            Bar
          </Link>
          <Link
            to="/comande/cucina"
            className="rounded-lg border border-b58-charcoal/15 hover:bg-b58-cream-dark transition-colors text-b58-charcoal text-xs font-medium px-3 py-2"
          >
            Cucina
          </Link>
          {/* 🔴 QUESTA SCHERMATA NON AVEVA NESSUNA PORTA — misurato il
              20/08 insieme a quella dei preventivi: la rotta esisteva e
              nessun file la nominava. E il posto è QUESTO, non un menu:
              chi si accorge che lo scontrino non è uscito è chi ha il
              tavolo davanti. */}
          <Link
            to="/comande/scontrini"
            className="rounded-lg border border-b58-charcoal/15 hover:bg-b58-cream-dark transition-colors text-b58-charcoal text-xs font-medium px-3 py-2"
          >
            Scontrini
          </Link>
          {isTitolare && (
            <button
              type="button"
              onClick={() => setPanel((p) => (p ? null : "tavoli"))}
              className="rounded-lg border border-b58-charcoal/15 hover:bg-b58-cream-dark transition-colors text-b58-charcoal text-xs font-medium px-3 py-2"
            >
              {panel ? "Chiudi" : "Impostazioni"}
            </button>
          )}
        </div>
      </div>

      {/* 🔴 IL MESSAGGIO STA IN CIMA, e con la barra dei tavoli in fondo alla
          sala i due si trovano a **1556 punti** di distanza su uno schermo
          alto 1024 — misurato il 21/08 facendo cadere la rete. Cioè: si preme
          «Apri 2 tavoli insieme», non succede niente, e la spiegazione è
          fuori schermo. È il difetto del 17/08 («un rifiuto lontano dal gesto
          è un rifiuto che non c'è»), qui su una distanza che si può contare.
          ⚠️ Resta anche qui, perché gli altri gesti di questa schermata sono
          in cima: quello che si aggiunge è una COPIA accanto alla barra, non
          uno spostamento — vedi sotto. */}
      {error && (
        <p className="text-sm text-b58-terracotta-dark bg-b58-terracotta/10 rounded-lg px-3 py-2 mb-3">{error}</p>
      )}

      {panel && isTitolare && (
        <div className="space-y-3 mb-4">
          <div className="flex gap-1.5">
            <button
              type="button"
              onClick={() => setPanel("coperto")}
              className={`text-xs rounded-full px-3 py-1.5 border ${panel === "coperto" ? "bg-b58-terracotta text-b58-parchment border-b58-terracotta" : "border-b58-charcoal/15 text-b58-charcoal-soft"}`}
            >
              Coperto
            </button>
            <button
              type="button"
              onClick={() => setPanel("calibrazione")}
              className={`text-xs rounded-full px-3 py-1.5 border ${panel === "calibrazione" ? "bg-b58-terracotta text-b58-parchment border-b58-terracotta" : "border-b58-charcoal/15 text-b58-charcoal-soft"}`}
            >
              Dimensione dei tocchi
            </button>
          </div>

          {panel === "calibrazione" && <CalibrazioneTocco onClose={() => setPanel(null)} />}

          {panel === "coperto" && (
            <div className="rounded-xl bg-b58-parchment ring-1 ring-b58-charcoal/10 p-4 space-y-4">
              <div>
                <p className={sectionLabel}>Prezzo del coperto</p>
                <div className="flex gap-2 items-center">
                  <input
                    type="number"
                    step="0.50"
                    min="0"
                    value={priceDraft}
                    onChange={(e) => setPriceDraft(e.target.value)}
                    className={`${inputClass} w-28`}
                  />
                  <span className="text-sm text-b58-charcoal-soft">€ a persona</span>
                  <button
                    type="button"
                    onClick={handleSavePrice}
                    className="rounded-lg bg-b58-terracotta hover:bg-b58-terracotta-dark transition-colors text-b58-parchment text-sm font-medium px-4 py-2"
                  >
                    Salva
                  </button>
                </div>
                <p className="text-[11px] text-b58-charcoal-soft/70 mt-1.5 leading-relaxed">
                  Vale dai conti aperti da adesso in poi: i conti già chiusi conservano
                  il prezzo che avevano quando sono stati pagati.
                </p>
              </div>

              <p className="text-[11px] text-b58-charcoal-soft/70 leading-relaxed">
                I tavoli si spostano e si rinominano dalla pianta, in Calendario Eventi →
                La sala.
              </p>
            </div>
          )}
        </div>
      )}

      {/* LA SALA ------------------------------------------------------ */}
      {/* La stessa pianta del Calendario: se stasera tre tavoli sono
          accostati, qui si vedono accostati — e si aprono insieme, con UN
          conto solo. */}
      <p className={sectionLabel}>
        {spostando ? "Su quali tavoli lo sposti?" : "Sala"}
      </p>
      {!letta ? (
        /* 🔴 «NON LO SO» INVECE DI «NON C'È NIENTE». Prima qui compariva
           «Nessun tavolo configurato» anche quando la lettura era fallita —
           una frase sicura di sé, e falsa. In servizio è la peggiore che si
           possa leggere. Il rifiuto ha la sua via d'uscita, perché l'errore
           che l'ha prodotto è passeggero. */
        <div className="rounded-xl border border-dashed border-b58-terracotta/40 p-6 text-center mb-3">
          <p className="text-b58-charcoal font-medium mb-1">Non riesco a leggere la sala.</p>
          <p className="text-xs text-b58-charcoal-soft mb-3">
            Non vuol dire che è vuota: vuol dire che non lo so.
          </p>
          <button
            type="button"
            onClick={() => {
              setError("");
              loadBoard().catch((e) => setError(e.message));
            }}
            className="tocco-azione rounded-lg bg-b58-olive hover:bg-b58-olive-dark transition-colors text-b58-parchment text-base font-semibold px-6"
          >
            Riprova
          </button>
        </div>
      ) : sagome.length === 0 ? (
        <p className="text-xs text-b58-charcoal-soft/60 py-4">Nessun tavolo configurato.</p>
      ) : (
        <div className="mb-3">
          {/* In piedi, non sdraiata: la sala è larga il doppio di quanto è
              profonda, e su un tablet tenuto in verticale sdraiata si
              vedeva a metà (detto da Alessio dopo il primo tavolo aperto
              dal vivo). Girata ci sta in larghezza e scorre in giù, che è
              il verso in cui si scorre con un dito. */}
          <PiantaSala
            inPiedi
            sagome={sagome}
            gruppi={gruppi}
            onSfondo={toccaSfondo}
            selezione={selezione}
            onSeleziona={toccaSagoma}
            // Nessuna scritta dentro la sagoma oltre alla cifra dei coperti:
            // dentro un quadrato di 90 cm girato non ci sta niente di
            // leggibile. Chi c'è si legge nell'elenco qui sotto, dove lo
            // spazio c'è; il colore e la sbarratura si leggono senza leggere.
            stato={statoSagome}
          />
          {/* 🔴 QUI C'ERA LA RIGA CHE SPIEGAVA PERCHÉ QUESTA SALA È GIRATA
              rispetto a quella del Calendario — tolta da Alessio il 18/08
              (rovesciamento n. 11). Era una sua decisione del 17/08, presa
              perché chi confronta le due schermate non sospetti due
              disposizioni diverse: **è lo stesso locale**, e le due schermate
              chiedono la pianta alla stessa funzione. Il fatto resta vero,
              sparisce la frase che lo diceva. */}
          {/* ⚠️ QUI C'ERA LA LEGENDA DEI COLORI, TOLTA DA ALESSIO il 18/08
              perché la considera superflua — conosce i suoi colori. Gli era
              stata proposta anche la via di mezzo (nasconderla dietro un
              tocco, per chi lavorerà in sala e non li ha imparati), e ha
              scelto di toglierla.
              ⚠️ La conseguenza va detta invece di essere subita: **la
              precedenza dei segni resta dichiarata solo nel codice**
              (`segnoDelTavolo` in lib/calcoli/ritardo.js) **e nel riepilogo
              del giro D2**. Il giorno che entrerà personale nuovo, è di lì
              che va ripescata — non da questa schermata. */}
        </div>
      )}

      {/* CHI ARRIVA STASERA -------------------------------------------- */}
      {/* ⚠️ Fino al giro D2 questa schermata NON SAPEVA CHI AVEVA PRENOTATO:
          la sala si apriva bianca, e chi serviva doveva incrociare due
          dispositivi con gli occhi. Le informazioni vanno a capo invece di
          scorrere di lato, perché qui si guarda da un tablet tenuto in
          verticale — e il tavolo è la prima cosa che serve, non l'ultima. */}
      {elencoSerata.length > 0 && (
        <div className="mb-4">
          <p className={sectionLabel}>Stasera</p>
          <div className="space-y-1.5">
            {elencoSerata.map((p) => (
              <div
                key={p.id}
                className={`rounded-lg px-3 py-2 ring-1 ${
                  p.ritardo?.inRitardo
                    ? "bg-b58-parchment ring-b58-charcoal/40"
                    : "bg-b58-parchment ring-b58-charcoal/10"
                }`}
              >
                <p className="text-sm text-b58-charcoal">
                  <strong>{p.ora?.slice(0, 5)}</strong> · {p.nome}
                  {p.persone ? ` · ${p.persone} pers.` : ""}
                  {" · "}
                  {p.etichette.length > 0 ? (
                    <strong>{p.etichette.join(" · ")}</strong>
                  ) : (
                    // ⚠️ Detto, non taciuto: una confermata senza tavolo
                    // arriva lo stesso, e chi apre la porta deve saperlo
                    // prima di trovarsela davanti.
                    <em className="text-b58-charcoal-soft">tavolo da assegnare</em>
                  )}
                </p>
                <p className="text-[11px] text-b58-charcoal-soft/80 leading-relaxed">
                  {p.ritardo?.arrivata
                    ? p.conto
                      ? "seduti — il conto è aperto"
                      : "arrivati"
                    : p.ritardo?.inRitardo
                      ? `non ancora arrivati — ${p.ritardo.minuti} minuti oltre l'ora`
                      : FASCE[p.fascia]?.spiega}
                  {p.liberareEntro && (
                    <>
                      {" · "}
                      <strong>da liberare entro le {p.liberareEntro.slice(0, 5)}</strong>
                    </>
                  )}
                </p>
              </div>
            ))}
          </div>
          {tolleranza != null && (
            <p className="text-[11px] text-b58-charcoal-soft/70 mt-1.5 leading-relaxed">
              Un tavolo si sbarra quando passano più di {tolleranza} minuti dall&apos;ora
              prenotata e nessuno ha aperto la comanda. <strong>Avvisa soltanto</strong>: se
              ridare via il tavolo lo decidi tu.
            </p>
          )}
        </div>
      )}

      {/* La barra che compare solo quando c'è qualcosa da decidere. */}
      {siVedeLaBarraDeiTavoli(cosaSiVede({ conto: order, selezione, spostando })) && (
        <div className="mb-4 rounded-xl bg-b58-parchment ring-1 ring-b58-charcoal/10 p-3">
          {/* Lo stesso messaggio, ma DOVE STA IL DITO. Non è un doppione per
              distrazione: chi preme qui non vede la cima della pagina, e
              senza questa riga il gesto sembra non aver fatto niente. */}
          {error && (
            <p className="text-sm text-b58-terracotta-dark bg-b58-terracotta/10 rounded-lg px-3 py-2 mb-2">
              {error}
            </p>
          )}
          <p className="text-sm text-b58-charcoal mb-2">
            {sagome
              .filter((s) => selezione.includes(s.id))
              .map((s) => s.label)
              .join(" · ")}
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={loadingOrder}
              onClick={spostando ? confermaSpostamento : apriSelezione}
              className="tocco-azione flex-1 rounded-lg bg-b58-olive hover:bg-b58-olive-dark disabled:opacity-50 transition-colors text-b58-parchment text-base font-semibold"
            >
              {spostando
                ? `Sposta qui (${selezione.length})`
                : `Apri ${selezione.length === 1 ? "il tavolo" : `${selezione.length} tavoli insieme`}`}
            </button>
            <button
              type="button"
              onClick={() => {
                setSelezione([]);
                setSpostando(false);
              }}
              className="tocco-azione rounded-lg border border-b58-charcoal/15 bg-white text-b58-charcoal text-sm font-medium px-4"
            >
              Annulla
            </button>
          </div>
          {!spostando && selezione.length > 1 && (
            <p className="text-[11px] text-b58-charcoal-soft/70 mt-2 leading-relaxed">
              Un conto solo per tutti e {selezione.length}: una comanda, un totale, un
              preconto.
            </p>
          )}
        </div>
      )}

      {loadingOrder && <p className="text-xs text-b58-charcoal-soft">Apro il tavolo…</p>}

      {!loadingOrder && !order && selezione.length === 0 && (
        <p className="text-sm text-b58-charcoal-soft/70 text-center py-6">
          Tocca un tavolo per aprirlo.
          <br />
          <span className="text-xs">
            Se hanno accostato più tavoli, toccali tutti: si apre un conto solo.
            <br />
            I tavoli scuri hanno già un conto aperto; i colorati aspettano qualcuno.
          </span>
        </p>
      )}

      {order && (
        <>
          {/* 🔴 L'USCITA DAL CONTO. Fino al 21/08 NON ESISTEVA: il conto
              lasciava lo schermo solo incassando o annullando, e annullare
              non si puo' piu' appena qualcosa e' andato in cucina. Chi
              apriva il tavolo sbagliato in servizio aveva una via sola:
              **incassare**.

              ⚠️ E' UNA RIGA IN CIMA, non il tocco sul pavimento (decisione
              di Alessio): tenendo il tablet con due mani il pavimento e' a
              portata di gomito, e **un'uscita accidentale da un conto in
              corso costa piu' di un gesto in piu'**.

              ⚠️ E LA PAROLA E' «LASCIA … APERTO», mai «chiudi»: in sala
              «chiudere» vuol dire incassare, e la parola sbagliata su
              quel pulsante costa un incasso. Il tavolo e' nominato perche'
              chi legge sappia da cosa sta uscendo. */}
          <button
            type="button"
            onClick={() => {
              setOrder(null);
              setSelezione([]);
              setError("");
            }}
            className="tocco-riga w-full flex items-center gap-2 px-3 mb-2 rounded-lg border border-b58-charcoal/15 bg-b58-parchment text-b58-charcoal text-sm font-medium print:hidden"
          >
            <span className="text-lg leading-none">&lsaquo;</span>
            Lascia {order.table_label} aperto
          </button>

          {/* CHI STA A QUESTO TAVOLO. ⚠️ Il legame fra il conto e la sua
              prenotazione è scritto dal 18/08 (giro D1) e fino a qui NON LO
              MOSTRAVA NESSUNA SCHERMATA — rilievo di Alessio la sera stessa:
              *«non ho visto l'associazione con la prenotazione»*. Per chi usa
              l'app, un dato scritto che nessuno può vedere è indistinguibile
              da un dato non scritto.
              ⚠️ E il vuoto è NORMALE, quindi non si scrive niente: un conto
              senza prenotazione è qualcuno entrato senza prenotare, non un
              errore da segnalare. */}
          {order.prenotazione && (
            <p className="rounded-lg bg-b58-parchment ring-1 ring-b58-charcoal/10 px-3 py-2 text-sm mb-3">
              <strong>{order.prenotazione.customer_name}</strong>
              {order.prenotazione.party_size ? ` · ${order.prenotazione.party_size} persone` : ""}
              {order.prenotazione.reservation_time
                ? ` · prenotato per le ${order.prenotazione.reservation_time.slice(0, 5)}`
                : ""}
              {order.prenotazione.notes && (
                <span className="block text-[11px] text-b58-charcoal-soft mt-0.5">
                  {order.prenotazione.notes}
                </span>
              )}
            </p>
          )}

          {/* ⚠️ «DA LIBERARE ENTRO LE…», ED È QUI CHE VALE SOLDI. Il punto 3
              del mandato (le tre fasce) senza questo è una regola che vive
              solo dove si prendono le prenotazioni: chi serve non la vede,
              il tavolo non si libera e il secondo turno salta. L'ora arriva
              dallo stesso calcolo della pianta — non è ricopiata qui, e non
              è scritta a mano da nessuno: se la seconda prenotazione si
              sposta o viene annullata, questa riga la segue. */}
          {liberareEntro && (
            <p className="rounded-lg bg-b58-gold/25 ring-1 ring-b58-gold px-3 py-2 text-base mb-4">
              <strong>Da liberare entro le {liberareEntro.slice(0, 5)}</strong> — su questo tavolo
              c&apos;è un altro turno dopo.
            </p>
          )}

          {/* COPERTI --------------------------------------------------- */}
          <p className={sectionLabel}>Coperti</p>
          <div className="flex items-center gap-2 mb-4">
            <button
              type="button"
              disabled={busy || coperti === 0}
              onClick={() => handleCoperti(coperti - 1)}
              className="tocco-bottone rounded-lg bg-white ring-1 ring-b58-charcoal/15 text-lg text-b58-charcoal disabled:opacity-40"
            >
              −
            </button>
            <input
              type="number"
              min="0"
              value={coperti}
              onChange={(e) => handleCoperti(e.target.value)}
              className="tocco-bottone w-16 text-center rounded-lg border border-b58-charcoal/15 bg-white text-base"
            />
            <button
              type="button"
              disabled={busy}
              onClick={() => handleCoperti(coperti + 1)}
              className="tocco-bottone rounded-lg bg-white ring-1 ring-b58-charcoal/15 text-lg text-b58-charcoal disabled:opacity-40"
            >
              +
            </button>
            <span className="text-xs text-b58-charcoal-soft/70 ml-1">
              {copertoPrice != null ? `${formatEUR(copertoPrice)} a persona` : "prezzo non disponibile"}
            </span>
          </div>

          {/* CARTA DEI VINI ------------------------------------------- */}
          {/* Riquadro dedicato, non un elenco incolonnato nel menu: e' la
              correzione emersa dal simulatore. Compare solo se in carta
              c'e' davvero qualcosa. */}
          {vini.length > 0 && (
            <button
              type="button"
              onClick={() => setShowWines(true)}
              className="tocco-riga w-full flex items-center justify-between px-3 mb-4 rounded-lg bg-b58-gold/10 ring-1 ring-b58-gold-dark/25 text-b58-gold-dark font-semibold text-sm"
            >
              <span>🍷 Carta dei vini</span>
              <span className="text-lg">›</span>
            </button>
          )}

          {/* MENU ------------------------------------------------------ */}
          <p className={sectionLabel}>Menu</p>
          {menuByCategory.length === 0 ? (
            <p className="text-xs text-b58-charcoal-soft/60 mb-3">Nessun menu attivo.</p>
          ) : (
            <div className="mb-3">
              {menuByCategory.map((cat) => (
                <div key={cat.value} className="mb-2">
                  <p className="text-xs font-semibold text-b58-terracotta-dark border-b border-dashed border-b58-charcoal/15 pb-1 mb-0.5">
                    {cat.label}
                  </p>
                  {cat.items.map((mi) => (
                    // Riga INTERA tappabile, non un "+" da centrare: e' la
                    // correzione numero uno emersa dalla prova del simulatore.
                    <button
                      key={mi.id}
                      type="button"
                      disabled={busy}
                      onClick={() => handleAddMenuItem(mi)}
                      className="tocco-riga w-full flex items-center gap-2 px-2 rounded-lg text-left hover:bg-b58-cream-dark/70 active:bg-b58-cream-dark disabled:opacity-50 border-b border-b58-charcoal/5"
                    >
                      <span className="flex-1 text-sm text-b58-charcoal leading-tight">{mi.recipe_name}</span>
                      <span className="text-xs text-b58-charcoal-soft shrink-0">{formatEUR(mi.selling_price)}</span>
                      <span className="tocco-bottone shrink-0 rounded-lg bg-b58-terracotta text-b58-parchment flex items-center justify-center text-lg pointer-events-none">
                        +
                      </span>
                    </button>
                  ))}
                </div>
              ))}
            </div>
          )}

          {/* BEVANDE --------------------------------------------------- */}
          {bevande.length > 0 && (
            <div className="mb-3">
              {bevande.map((cat) => (
                <div key={cat.nome} className="mb-2">
                  <p className="text-xs font-semibold text-b58-terracotta-dark border-b border-dashed border-b58-charcoal/15 pb-1 mb-0.5">
                    {cat.nome}
                  </p>
                  {cat.voci.map((v) => (
                    <RigaBar key={v.id} v={v} />
                  ))}
                </div>
              ))}
            </div>
          )}

          {/* VOCE LIBERA ---------------------------------------------- */}
          {/* Finche' vini e bevande non vivono nell'Editor Menu (deciso
              l'08/08, ancora da costruire) questa e' l'unica strada per
              metterli in comanda: si tiene, ma chiusa. */}
          <button
            type="button"
            onClick={() => setShowFreeForm((v) => !v)}
            className="text-xs text-b58-charcoal-soft underline hover:text-b58-terracotta-dark mb-2"
          >
            {showFreeForm ? "Nascondi voce libera" : "+ Voce libera (bevande, fuori menu)"}
          </button>
          {showFreeForm && (
            <form onSubmit={handleAddFree} className="space-y-1.5 mb-3">
              <input
                required
                value={freeForm.name}
                onChange={(e) => setFreeForm((f) => ({ ...f, name: e.target.value }))}
                placeholder={'Es. "Calice Nero d\'Avola"'}
                className={inputClass}
              />
              <div className="flex gap-1.5">
                <input
                  required
                  type="number"
                  step="0.01"
                  min="0"
                  value={freeForm.price}
                  onChange={(e) => setFreeForm((f) => ({ ...f, price: e.target.value }))}
                  placeholder="€"
                  className={inputClass}
                />
                <select
                  value={freeForm.destination}
                  onChange={(e) => setFreeForm((f) => ({ ...f, destination: e.target.value }))}
                  className={inputClass}
                >
                  <option value="bar">Bar</option>
                  <option value="cucina">Cucina</option>
                </select>
              </div>
              <button
                type="submit"
                disabled={busy}
                className="w-full rounded-lg border border-b58-charcoal/15 hover:bg-b58-cream-dark disabled:opacity-60 text-b58-charcoal text-sm font-medium py-2"
              >
                + Aggiungi alla comanda
              </button>
            </form>
          )}

          {/* COMANDA IN CORSO ----------------------------------------- */}
          <p className={sectionLabel}>Comanda in corso — {order.table_label}</p>
          <div className="rounded-xl bg-white ring-1 ring-b58-charcoal/10 p-3 mb-3">
            {draftItems.length === 0 && sentItems.length === 0 && (
              <p className="text-xs text-b58-charcoal-soft/60 text-center py-3">Nessun piatto selezionato.</p>
            )}

            {draftItems.map((it) => (
              <div key={it.id} className="border-b border-b58-charcoal/5 last:border-0 py-1.5">
                <div className="flex items-center gap-1.5">
                  <span className="flex-1 min-w-0 text-sm text-b58-charcoal leading-tight">{lineLabel(it)}</span>
                  <button
                    type="button"
                    onClick={() => withBusy(() => updateDraftItemQuantity(it.id, it.quantity - 1))}
                    className="tocco-bottone rounded-lg ring-1 ring-b58-charcoal/15 text-b58-charcoal"
                  >
                    −
                  </button>
                  <b className="w-5 text-center text-sm">{it.quantity}</b>
                  <button
                    type="button"
                    onClick={() => withBusy(() => updateDraftItemQuantity(it.id, it.quantity + 1))}
                    className="tocco-bottone rounded-lg ring-1 ring-b58-charcoal/15 text-b58-charcoal"
                  >
                    +
                  </button>
                  <span className="w-14 text-right text-xs text-b58-charcoal-soft shrink-0">{formatEUR(lineTotal(it))}</span>
                  <button
                    type="button"
                    onClick={() => withBusy(() => removeDraftItem(it.id))}
                    className="text-b58-charcoal-soft hover:text-b58-terracotta-dark px-1"
                  >
                    ✕
                  </button>
                </div>
                {/* Nota del SINGOLO piatto, distinta da quella del tavolo:
                    "senza glutine" riguarda un piatto, non tutti. */}
                <CampoAutosalvato
                  value={it.note ?? ""}
                  onSave={(testo) =>
                    updateItemNote(it.id, testo).catch((err) => setError(err.message))
                  }
                  placeholder="nota per questo piatto (es. senza glutine)"
                  className="w-full mt-1 rounded-md border border-dashed border-b58-charcoal/20 bg-b58-cream/40 px-2 py-1.5 text-xs text-b58-charcoal-soft"
                />
              </div>
            ))}

            {sentItems.map((it) => (
              <div key={it.id} className="flex items-center gap-2 py-1.5 border-b border-b58-charcoal/5 last:border-0 opacity-70">
                <span className="flex-1 min-w-0 text-sm text-b58-charcoal leading-tight">
                  {it.quantity}× {lineLabel(it)}
                  <span className="text-xs text-b58-charcoal-soft"> · inviata</span>
                  {it.note && <span className="block text-xs italic text-b58-charcoal-soft">↳ {it.note}</span>}
                </span>
                <span className="text-xs text-b58-charcoal-soft shrink-0">{formatEUR(lineTotal(it))}</span>
                <button
                  type="button"
                  onClick={() => handleVoid(it.id)}
                  className="text-xs text-b58-charcoal-soft hover:text-b58-terracotta-dark px-1"
                >
                  annulla
                </button>
              </div>
            ))}

            <CampoAutosalvato
              key={order.id}
              value={order.note ?? ""}
              onSave={(testo) => updateOrderNote(order.id, testo).catch((e) => setError(e.message))}
              placeholder="Nota del tavolo (allergie, tempi…)"
              className={`${inputClass} mt-2`}
            />
          </div>

          {/* TOTALE E AZIONI ------------------------------------------ */}
          <div className="rounded-xl bg-b58-parchment ring-1 ring-b58-charcoal/10 p-3 space-y-2">
            {coperti > 0 && (
              <div className="flex justify-between text-xs text-b58-charcoal-soft">
                <span>{coperti} coperti</span>
                <span>{formatEUR(copertoTotal)}</span>
              </div>
            )}
            <div className="flex justify-between text-base font-semibold text-b58-charcoal">
              <span>Totale</span>
              <span>{formatEUR(total)}</span>
            </div>

            <button
              type="button"
              disabled={busy || draftItems.length === 0}
              onClick={handleSend}
              className="tocco-azione w-full rounded-lg bg-b58-olive hover:bg-b58-olive-dark disabled:opacity-40 transition-colors text-b58-parchment text-base font-semibold"
            >
              Invia comanda{draftItems.length > 0 && ` (${draftItems.length})`}
            </button>

            <div className="flex gap-2">
              <button
                type="button"
                disabled={sentItems.length === 0}
                onClick={() => setShowPrecon(true)}
                className="tocco-azione flex-1 rounded-lg border border-b58-charcoal/15 bg-white hover:bg-b58-cream-dark disabled:opacity-40 transition-colors text-b58-charcoal text-sm font-medium"
              >
                Preconto
              </button>
              <button
                type="button"
                disabled={sentItems.length === 0}
                onClick={() => setShowClose(true)}
                className="tocco-azione flex-1 rounded-lg bg-b58-terracotta hover:bg-b58-terracotta-dark disabled:opacity-40 transition-colors text-b58-parchment text-sm font-semibold"
              >
                Chiudi conto
              </button>
            </div>

            {/* ⚠️ IL VICOLO CIECO, trovato da Alessio con un tavolo aperto
                per sbaglio che non riusciva a togliere.
                «Annulla tavolo» esisteva, ma viveva DENTRO la finestra di
                chiusura — che si apre dal pulsante «Chiudi conto», che è
                spento finché non è stato inviato niente. Quindi un tavolo
                aperto e mai usato non si poteva chiudere né annullare: **in
                nessun modo**. E dal 14/08 pesa il doppio, perché quel conto
                tiene occupati i suoi tavoli e impedisce di riaprirli.
                Regola generale: se un pulsante si spegne, va guardato cosa
                resta raggiungibile da lì — spegnerlo non deve chiudere
                l'unica porta. */}
            {sentItems.length === 0 && (
              <button
                type="button"
                onClick={() => {
                  if (
                    !window.confirm(
                      `Annullare ${order.table_label}?\n\nNon è stato inviato niente in cucina, quindi non si butta via nessun ordine. I tavoli tornano liberi.`
                    )
                  )
                    return;
                  withBusy(() => cancelOrder(order.id, "aperto per sbaglio, nessun ordine inviato")).then(
                    () => {
                      setOrder(null);
                      setSelezione([]);
                      loadBoard();
                    }
                  );
                }}
                className="w-full text-xs text-b58-charcoal-soft hover:text-b58-terracotta-dark py-1"
              >
                Annulla il tavolo (non è stato ordinato niente)
              </button>
            )}
          </div>
        </>
      )}

      {/* Schermata separata della carta dei vini: copre la sala senza
          farle perdere il tavolo selezionato, si torna indietro da una
          barra sempre visibile in alto. */}
      {showWines && order && (
        <div className="fixed inset-0 z-50 bg-b58-cream flex flex-col">
          <button
            type="button"
            onClick={() => setShowWines(false)}
            className="tocco-riga shrink-0 flex items-center gap-2 px-4 bg-b58-gold-dark text-b58-parchment font-semibold text-sm uppercase tracking-wide"
          >
            <span className="text-lg">‹</span> Torna al menu — {order.table_label}
          </button>
          <div className="flex-1 overflow-y-auto p-3 max-w-md mx-auto w-full">
            {vini.map((cat) => (
              <div key={cat.nome} className="mb-3">
                <p className="text-xs font-semibold text-b58-terracotta-dark border-b border-dashed border-b58-charcoal/15 pb-1 mb-0.5">
                  {cat.nome}
                </p>
                {cat.voci.map((v) => (
                  <RigaBar key={v.id} v={v} />
                ))}
              </div>
            ))}
          </div>
          <div className="shrink-0 p-3 border-t border-b58-charcoal/10 bg-b58-parchment">
            <button
              type="button"
              onClick={() => setShowWines(false)}
              className="tocco-azione w-full rounded-lg bg-b58-olive text-b58-parchment text-base font-semibold"
            >
              Fatto — torna alla comanda
            </button>
          </div>
        </div>
      )}

      {showPrecon && order && (
        <PrecontoModal order={order} copertoPrice={copertoPrice} onClose={() => setShowPrecon(false)} />
      )}

      {showClose && order && (
        <CloseOrderModal
          order={order}
          copertoPrice={copertoPrice}
          onClose={() => setShowClose(false)}
          onDone={() => {
            setShowClose(false);
            setOrder(null);
            setSelezione([]);
            loadBoard();
          }}
        />
      )}
    </div>
  );
}
