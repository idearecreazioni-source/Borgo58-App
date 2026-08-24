import { useEffect, useMemo, useRef, useState } from "react";
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
  chiamaProssimoTurno,
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
import { annullaPrenotazione, listReservations } from "../../lib/api/reservations";
import { serataDiServizio, serataScaduta } from "../../lib/calcoli/serata";
import {
  fascePerIlTavolo,
  insiemiPerTavolo,
  ritardiDellaSerata,
  segniDellaSala,
  statoDelConto,
} from "../../lib/calcoli/ritardo";
import { esitoDelTocco } from "../../lib/calcoli/selezione";
import { etichettaTurno, righePerTurno } from "../../lib/calcoli/turni";
import { listBarItems } from "../../lib/api/barItems";
import { RECIPE_CATEGORIES, formatDate, formatEUR } from "../../lib/constants";
import { useAuth } from "../../context/AuthContext";
import CalibrazioneTocco from "./CalibrazioneTocco";
import CloseOrderModal from "./CloseOrderModal";
import CampoAutosalvato from "../../components/CampoAutosalvato";
import ClientePagante from "../../components/ClientePagante";
import RiquadroDelTavolo from "../../components/RiquadroDelTavolo";
import ConfermaDistruttiva from "../../components/ConfermaDistruttiva";
import PiantaSala from "../../components/PiantaSala";
import {
  ZONE_DEL_BANCO,
  ZONE_DEL_PANNELLO,
  ZONE_FONDALE,
  pannelloNellaPianta,
} from "../../lib/calcoli/sala";
import PrecontoModal from "./PrecontoModal";
import DatoNonLetto from "../../components/DatoNonLetto";

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
  // Il pannello di chi paga: si apre dal riquadro accanto al tavolo.
  const [clienteAperto, setClienteAperto] = useState(false);
  const [busy, setBusy] = useState(false);
  const [loadingOrder, setLoadingOrder] = useState(false);

  const [showFreeForm, setShowFreeForm] = useState(false);
  const [freeForm, setFreeForm] = useState({ name: "", price: "", destination: "bar" });

  const [showPrecon, setShowPrecon] = useState(false);
  const [showClose, setShowClose] = useState(false);
  // Si sta cambiando l'insieme dei tavoli di questo conto: unire,
  // separare, spostare. È lo «sposta» del 09/08, che ora sa fare tutt'e tre.
  const [spostando, setSpostando] = useState(false);
  // 🔴 APRENDO UN TAVOLO LA SCHERMATA SCENDE SUL MENU (21/08, chiesto da
  // Alessio). Col menu sotto la pianta, dopo aver aperto un tavolo si
  // scorreva di mille punti ogni volta — ed è il gesto che viene subito
  // dopo, sempre.
  //
  // ⚠️ SOLO SU «APRI IL TAVOLO», e i due casi passano da due funzioni
  // DIVERSE, quindi non c'è niente da separare: `apriSelezione` apre un
  // tavolo nuovo, `apriConoscendoIlConto` entra in un conto che esiste già
  // — e lì non si scende, perché chi tocca un tavolo aperto può volere il
  // riepilogo o i pulsanti, non i piatti.
  //
  // ⚠️ E NON SI SCENDE A OGNI TOCCO: guardando un tavolo per leggere chi
  // c'è, la sala scapperebbe via sotto le dita.
  const [scendiAlMenu, setScendiAlMenu] = useState(false);
  const [esitoChiamata, setEsitoChiamata] = useState("");
  // 🔴 IL TURNO CHE SI STA SEGNANDO (21/08, deciso da Alessio). Le pietanze
  // che si aggiungono adesso finiscono in questo turno; «Prossimo turno» lo
  // fa avanzare di uno.
  //
  // ⚠️ NON SI DEDUCE MAI DALLA CATEGORIA DEL PIATTO: nel primo turno di
  // Alessio ci sono due antipasti E una pasta. Li compone lui, secondo come
  // vuole far mangiare quel tavolo.
  //
  // ⚠️ E RIPARTE DA UNO A OGNI CONTO: è una proprietà della comanda che si
  // sta scrivendo, non dello schermo.
  const [turnoCorrente, setTurnoCorrente] = useState(1);
  const menuRef = useRef(null);

  const [panel, setPanel] = useState(null); // null | "coperto" | "calibrazione"
  const [priceDraft, setPriceDraft] = useState("");

  // Quale portata si sta guardando. Nasce vuota: la prima volta si vedono
  // tutte, poi si sceglie. ⚠️ NON si ricorda fra un conto e l'altro — chi
  // apre un tavolo nuovo comincia dagli antipasti, non da dove era rimasto.
  const [categoriaScelta, setCategoriaScelta] = useState(null);

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
      // ⚠️ E DAL 21/08 anche le SERVITE, che è come si chiama una
      // prenotazione onorata: senza, chi ha già mangiato spariva dal nome
      // dell'elenco e restava una riga «—». Il colore e le persone attese
      // le escludono comunque, perché passano da `prenotazioniPerTavolo`.
      setPrenotati((pr ?? []).filter((r) => ["confermata", "servita"].includes(r.status)));
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
          `Impostazioni di sala non leggibili (${e.message}): il coperto non verrà conteggiato su questo conto. Riprova, e se continua avvisa Alessio.`
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
  // ⚠️ CHI DEVE ANCORA ARRIVARE SU QUESTO TAVOLO — e le servite non ci sono.
  // Da qui passano due cose: le fasce del colore e il numero delle persone
  // attese. Lasciandoci una servita, un tavolo dove hanno già mangiato e
  // pagato continuerebbe a dire «arrivano in due».
  const prenotazioniPerTavolo = useMemo(() => {
    const m = new Map();
    for (const t of turni) {
      if (t.servita) continue;
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

  // 🔴 CHI È GIÀ STATO SERVITO. Il database lo dice da quando chiudere un
  // conto marca la sua prenotazione (21/08): qui serve per applicare la
  // regola di Alessio — **il tavolo mostra la fascia che deve ancora
  // arrivare, non quella già passata**.
  const servite = useMemo(
    () => new Set(turni.filter((t) => t.servita).map((t) => t.reservation_id)),
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
        // 🔴 «IL TAVOLO MOSTRA LA FASCIA CHE DEVE ANCORA ARRIVARE, NON QUELLA
        // GIÀ PASSATA» — regola di Alessio, e la funzione porta il suo nome
        // per esteso in `ritardo.js`. Si tolgono DUE cose: chi si è già
        // seduto (aveva il conto aperto: ha smesso di essere un'ora e ha
        // cominciato a essere un tavolo da servire) e chi è già stato
        // **servito** — cioè ha mangiato e se n'è andato.
        //
        // ⚠️ È da qui che il tavolo del primo giro torna bianco a conto
        // chiuso, **e resta rosso se stasera ci arriva un secondo turno.**
        // I due casi non sono scritti da nessuna parte: li produce la regola.
        fasce: fascePerIlTavolo(
          sopra.filter((id) => !ritardi.perPrenotazione.get(id)?.arrivata),
          fasciaDi,
          servite
        ),
        inRitardo: ritardi.tavoli.has(sagoma.id),
      };
    }
    for (const [id, segno] of Object.entries(segniDellaSala({ sagome, gruppi, fatti }))) {
      s[id] = { ...s[id], ...segno };
    }
    return s;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sagome, gruppi, openOrders, order, prenotati, prenotazioniPerTavolo, fasciaDi, servite, ritardi]);

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
          tavoli: t.tavoli ?? [],
          nome: r?.customer_name ?? "—",
          persone: r?.party_size ?? null,
          ritardo: ritardi.perPrenotazione.get(t.reservation_id),
          conto: openOrders.find((o) => o.reservation_id === t.reservation_id) ?? null,
        };
      }),
    [turni, prenotati, ritardi, openOrders]
  );

  // Le sole prenotazioni che la pianta NON può mostrare: quelle a cui nessuno
  // ha ancora dato un tavolo. Sono l'unica riga rimasta dell'elenco.
  const senzaTavolo = useMemo(
    () => elencoSerata.filter((p) => p.etichette.length === 0 && !p.ritardo?.arrivata),
    [elencoSerata]
  );

  // 🔴 CHI HA PRENOTATO IL TAVOLO CHE SI STA TOCCANDO. Serve al riquadro del
  // banco bar dentro la pianta, e al gesto «non sono arrivati».
  const prenotazioniDeiTavoli = (ids = []) =>
    elencoSerata.filter((p) => (p.tavoli ?? []).some((t) => ids.includes(t)));

  // 🔴 IL BANCO BAR: chi ha prenotato il tavolo che si sta toccando.
  //
  // ⚠️ La scena che l'ha fatto nascere, e spiega perché **il nome** e non
  // altro: *il cliente arriva e dice «ho prenotato a nome tale per due», il
  // cameriere non se lo ricorda, tocca il tavolo e legge lì.*
  //
  // ⚠️ E L'AMBIGUITÀ SI DICHIARA, non si risolve indovinando: se sul tavolo
  // toccato c'è più di una prenotazione — due turni — si mostrano **tutte**,
  // con l'ora. Sceglierne una vorrebbe dire decidere al posto di chi ha il
  // cliente davanti.
  //
  // ⚠️ Tavolo libero → **niente**, non un riquadro vuoto: un pannello che
  // dice «nessuno» occupa lo stesso spazio di uno che dice qualcosa.
  const riquadroBanco = useMemo(
    () => pannelloNellaPianta(ZONE_FONDALE, sagome, ZONE_DEL_BANCO),
    [sagome]
  );
  const nomiDelTavolo = prenotazioniDeiTavoli(selezione);
  // 🔴 CON UN CONTO APERTO IL RIQUADRO PARLA DI CHI PAGA (23/08, blocco 5).
  //
  // ⚠️ E FINO A OGGI, CON IL CONTO APERTO, QUESTO RIQUADRO SPARIVA — misurato,
  // non dedotto: aprendo il tavolo l'unico posto dove compariva ancora il nome
  // era un paragrafo a **3136 punti dall'alto**, cioè sotto tutto il menu. È
  // la stessa forma del difetto del 21/08 (i gesti a 1279 punti: «c'erano e
  // non li trovava nessuno»), ed è il motivo per cui Alessio lo chiama
  // illeggibile.
  //
  // ⚠️ La prenotazione resta scritta sopra quando c'è: chi arriva dice «ho
  // prenotato a nome tale», e quel nome serve **prima** di sapere chi paga.
  // 🔴 IL RIQUADRO NON SCORRE PIU' (23/08, correzione chiesta da Alessio).
  //
  // ⚠️ MISURATO: dentro la pianta quel riquadro e' 53,8 × 25,1 mm sul mini
  // tablet — 161 punti d'altezza — e col cliente pagante da scrivere il
  // contenuto ne chiedeva 222. Scorreva, cioe' non si vedeva tutto insieme.
  //
  // La sua regola: *pagante, orario e coperti visibili subito, il resto si
  // apre al tocco*. Qui resta cio' che si LEGGE mentre si serve; tutto cio'
  // che si SCRIVE sta nel pannello che si apre — perche' espandere dentro un
  // riquadro da 25 mm rimetterebbe lo scorrimento da cui si scappa.
  const bancoBar =
    order || (selezione.length > 0 && nomiDelTavolo.length > 0) ? (
      <RiquadroDelTavolo
        prenotazioni={
          nomiDelTavolo.length > 0
            ? nomiDelTavolo
            : order?.prenotazione
              ? [
                  {
                    id: order.prenotazione.id,
                    ora: order.prenotazione.reservation_time,
                    persone: order.prenotazione.party_size,
                    nome: order.prenotazione.customer_name,
                  },
                ]
              : []
        }
        order={order}
        onApri={() => setClienteAperto(true)}
      />
    ) : null;

  // 🔴 I GESTI DEL TAVOLO, DENTRO LA PIANTA (21/08, disegno di Alessio).
  //
  // ⚠️ ROVESCIA UNA SUA DECISIONE DI POCHE ORE PRIMA, e va detto: aveva
  // scelto che riepilogo e pulsanti si raggiungessero con una **strisciata**,
  // rifiutando la proposta del validatore di tenerli fissi. La ragione era
  // buona — *un pulsante fisso in fondo sta dove poggiano i pollici quando si
  // tiene il tablet con due mani*. Adesso c'è una colonna sua **al centro
  // della pianta**, lontana dai bordi: la ragione di allora non vale più.
  //
  // ⚠️ SONO CONTESTUALI AL TAVOLO TOCCATO, ed è il punto: tavolo libero →
  // «Apri il tavolo»; tavolo con un conto → i tre gesti del conto. Chi guarda
  // non deve scegliere fra pulsanti che non c'entrano.
  //
  // ⚠️ L'area è quella di cucina e servizi (`ZONE_DEL_PANNELLO`), la stessa
  // che il Calendario usa per il modulo di prenotazione — ed **eredita la
  // sua rete**: se un tavolo finisse là dentro, il pannello sparisce invece
  // di coprirlo.
  const riquadroGesti = useMemo(
    () => pannelloNellaPianta(ZONE_FONDALE, sagome, ZONE_DEL_PANNELLO),
    [sagome]
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
      setScendiAlMenu(true);
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

  useEffect(() => {
    // Il turno riparte da uno su ogni tavolo che si apre.
    setTurnoCorrente(1);
  }, [order?.id]);

  useEffect(() => {
    if (!scendiAlMenu || !order || !menuRef.current) return;
    // ⚠️ `behavior: auto`, non `smooth`: in servizio un movimento che dura
    // mezzo secondo si legge come un ritardo dell'app.
    menuRef.current.scrollIntoView({ block: "start", behavior: "auto" });
    setScendiAlMenu(false);
  }, [scendiAlMenu, order]);

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
        turno: turnoCorrente,
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
        turno: turnoCorrente,
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
        turno: turnoCorrente,
      })
    ).then(() => setFreeForm({ name: "", price: "", destination: "bar" }));
  };

  const handleCoperti = (n) => withBusy(() => setOrderCoperti(order.id, n));

  // Le note (del piatto e del tavolo) si salvano da sole mentre si scrive,
  // quindi qui non c'e' niente da ricordarsi di salvare prima dell'invio.
  // Si mandano SOLO le righe visibili su questo schermo: se il Bar sta
  // componendo un altro giro sullo stesso tavolo, il suo non parte.
  // 🔴 «AVANTI COL PROSSIMO TURNO»: il biglietto che esce dalla stampante
  // della cucina, con la frase e il numero del tavolo.
  //
  // ⚠️ GENERICO E SENZA LIMITAZIONI, deciso da Alessio: non conta i turni,
  // non si spegne quando sono finiti, non impedisce di premerlo due volte.
  // **La cucina ha già la comanda completa e vede da sé cosa resta da
  // cucinare** — il biglietto dice solo «adesso». La versione che dichiarava
  // quale turno stava chiamando e si spegneva alla fine è stata scartata da
  // lui, e non si rimette da qui.
  const handleChiamaTurno = () =>
    withBusy(() => chiamaProssimoTurno(order.id)).then(() =>
      setEsitoChiamata(`Mandato in cucina: avanti col prossimo turno per ${order.table_label}.`)
    );

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
  // Le righe della comanda divise per turno. ⚠️ Si guarda l'insieme di
  // inviate E da segnare: un turno che è già tutto partito deve continuare
  // a comparire, altrimenti il «2° turno» che si sta scrivendo sembrerebbe
  // il primo.
  const gruppiComanda = righePerTurno([...sentItems, ...draftItems]);
  const { coperti, copertoTotal, total } = orderTotals(order, copertoPrice);

  // Menu raggruppato per portata, nell'ordine in cui si mangia — non in
  // ordine alfabetico, che in sala non serve a nessuno.
  const menuByCategory = RECIPE_CATEGORIES.map((c) => ({
    ...c,
    items: menu.filter((mi) => mi.category === c.value),
  })).filter((c) => c.items.length > 0);

  // 🔴 LE CATEGORIE FILTRANO, non fanno più solo da intestazione (21/08,
  // disegno di Alessio). Ed è **la ragione per cui il menu ci sta in una
  // colonna stretta**: il menu intero è di una quindicina di portate, ma con
  // una categoria scelta ne restano tre o quattro per volta — non una lista
  // da scorrere.
  //
  // ⚠️ E questo scioglie il vincolo che avevo misurato la sera prima. Avevo
  // trovato che «il nome di piatto più lungo è più largo della colonna», ma
  // quel nome era **inventato**: il gestionale vero ha zero ricette e zero
  // menu, e la larghezza veniva da nomi di prova. *La misura era giusta come
  // metodo e priva di dati veri come contenuto* — ed è il motivo per cui i
  // nomi adesso vanno a capo invece di stringere la pianta: **un nome lungo
  // costa altezza, e di altezza ce n'è.**
  const raggruppaPerCategoria = (voci) => {
    const categorie = [...new Set(voci.map((v) => v.category))];
    return categorie.map((nome) => ({ nome, voci: voci.filter((v) => v.category === nome) }));
  };

  // I vini stanno in una schermata separata (§3.2.1); le altre bevande
  // vivono qui accanto ai piatti. ⚠️ Il raggruppamento si calcola PRIMA
  // dei filtri, che da oggi lo usano.
  const vini = raggruppaPerCategoria(barItems.filter((b) => b.section === "vini"));
  const bevande = raggruppaPerCategoria(barItems.filter((b) => b.section === "bevande"));

  // 🔴 «BEVERAGE» E' UNA CATEGORIA COME LE ALTRE (24/08/2026, richiesta di
  // Alessio dal collaudo). Fino a qui i filtri in cima valevano **solo per
  // il cibo**: scegliendo «Primo» restavano visibili anche acqua, amari,
  // analcoliche, birre e caffetteria, perche' le bevande erano un blocco a
  // se' sotto la lista. ⚠️ Un filtro che lascia visibile meta' della roba
  // non e' un filtro — e' un ordinamento.
  //
  // ⚠️ E' UN MODO DI GUARDARE, NON UNA RICLASSIFICAZIONE (condizione sua):
  // nessun prodotto cambia categoria, niente si tocca nel database. Food
  // cost e beverage cost restano due cose separate nella Proiezione, e
  // continuano a leggere da dove leggevano prima.
  const CHIAVE_BEVERAGE = "__beverage";
  // Le bevande si vedono con «Tutte» e con «Beverage», non con «Primo».
  const mostraBevande =
    categoriaScelta === null || categoriaScelta === CHIAVE_BEVERAGE;
  const categorieDelMenu = [
    ...menuByCategory.map((c) => ({ chiave: c.value, nome: c.label })),
    ...(bevande.length > 0 ? [{ chiave: CHIAVE_BEVERAGE, nome: "Beverage" }] : []),
  ];

  // I vini stanno in una schermata separata (§3.2.1: incolonnati nel menu
  // lo allungavano troppo), le altre bevande restano nell'elenco
  // principale accanto ai piatti.

  // Riga di un vino o di una bevanda: stesso target di tocco dei piatti.
  const RigaBar = ({ v }) => (
    <button
      type="button"
      disabled={busy}
      onClick={() => handleAddBarItem(v)}
      className="tocco-riga w-full flex items-center gap-2 px-2 rounded-lg text-left hover:bg-b58-cream-dark/70 active:bg-b58-cream-dark disabled:opacity-50 border-b border-b58-charcoal/5"
    >
      <span className="flex-1 min-w-0 testo-sala-grande text-b58-charcoal leading-tight">
        {v.name}
        {v.serving && <span className="text-b58-charcoal-soft"> · {v.serving}</span>}
        {v.producer && <span className="block testo-sala text-b58-charcoal-soft/70">{v.producer}</span>}
      </span>
      <span className="testo-sala text-b58-charcoal-soft shrink-0">{formatEUR(v.selling_price)}</span>
      <span className="tocco-bottone shrink-0 rounded-lg bg-b58-terracotta text-b58-parchment flex items-center justify-center testo-sala-grande pointer-events-none">
        +
      </span>
    </button>
  );

  const inputClass =
    "w-full rounded-lg border border-b58-charcoal/15 bg-white px-3 py-2 text-sm text-b58-charcoal focus:outline-none focus:ring-2 focus:ring-b58-terracotta";
  const sectionLabel =
    "testo-sala uppercase tracking-wide font-semibold text-b58-charcoal-soft/70 mb-1.5";

  // Il contenuto del pannello dei gesti. Cambia con quello che si sta
  // toccando, e per questo non ha un titolo: il titolo sarebbe sempre lo
  // stesso mentre il contenuto cambia.
  // 🔴 «INVIA» ESISTE IN DUE POSTI, ED È VOLUTO (22/08, chiesto da
  // Alessio). Due giorni fa i pulsanti doppi sono stati tolti, e questo
  // **non è lo stesso caso**: là erano quattro gesti ripetuti a caso in
  // fondo alla pagina, qui è **lo stesso gesto dove finiscono i due
  // percorsi** — chi guarda la sala lo trova nella colonna, chi finisce
  // di segnare i piatti è già in fondo alla lista, col dito lì.
  //
  // ⚠️ E PER QUESTO È UNA FUNZIONE SOLA, non due pulsanti gemelli:
  // devono spegnersi insieme, contare le stesse righe e dire la stessa
  // parola. Due copie divergono al primo ritocco — è la regola che questo
  // progetto applica ai numeri, e vale per i gesti.
  const bottoneInvia = (classi = "") => (
    <button
      type="button"
      disabled={busy || draftItems.length === 0}
      onClick={handleSend}
      className={`tocco-bottone w-full rounded-lg bg-b58-olive disabled:opacity-40 text-b58-parchment font-semibold px-2 ${classi}`}
    >
      Invia{draftItems.length > 0 ? ` (${draftItems.length})` : ""}
    </button>
  );

  const pannelloGesti = order ? (
    <div className="h-full overflow-auto p-1.5 flex flex-col gap-1.5">
      <p className="testo-sala font-semibold text-b58-charcoal-soft leading-none">
        {order.table_label}
      </p>

      {/* 🔴 UNA COSA, UN POSTO SOLO (21/08, deciso da Alessio guardando la
          schermata in scala reale). Gli stessi quattro gesti stavano anche
          in un riquadro sotto la pianta: due pulsanti che fanno la stessa
          cosa a mezzo metro di distanza sono due cose da imparare, non una
          comodità. Il posto è QUESTO, dentro la pianta, dove li ha visti e
          approvati.
          ⚠️ E sono IMPILATI a tutta larghezza, non affiancati a due a due:
          la colonna è larga 368 punti sul suo tablet e alta mille, quindi
          l'altezza c'è — mentre affiancati «Lascia aperto» non ci starebbe
          con le scritte ingrandite. */}
      {bottoneInvia("testo-sala")}
      <button
        type="button"
        disabled={sentItems.length === 0}
        onClick={() => setShowPrecon(true)}
        className="tocco-bottone w-full rounded-lg border border-b58-charcoal/15 bg-white disabled:opacity-40 text-b58-charcoal testo-sala px-2"
      >
        Preconto
      </button>
      {/* ⚠️ «CHIUDI CONTO», MAI «CHIUDI»: in sala «chiudere» vuol dire
          incassare, ed è la ragione per cui l'uscita dal conto si chiama
          «Lascia il tavolo aperto». */}
      <button
        type="button"
        disabled={sentItems.length === 0}
        onClick={() => setShowClose(true)}
        className="tocco-bottone w-full rounded-lg bg-b58-terracotta disabled:opacity-40 text-b58-parchment testo-sala font-semibold px-2"
      >
        Chiudi conto
      </button>

      {/* 🔴 «AVANTI COL PROSSIMO TURNO» (21/08, deciso da Alessio): manda in
          cucina un biglietto con la frase e il numero del tavolo, e sta fra i
          gesti del tavolo aperto perché è un gesto del tavolo, non del menu.
          ⚠️ GENERICO E SENZA LIMITAZIONI, per sua decisione: non conta i
          turni, non si spegne quando sono finiti, non impedisce di premerlo
          due volte. La cucina ha già la comanda completa e vede da sé cosa
          resta da cucinare — il biglietto dice solo «adesso».
          ⚠️ E NON DIPENDE DALL'AVER INVIATO: si può chiamare il prossimo
          turno di una comanda mandata in cucina tutta insieme all'inizio,
          che è precisamente il caso per cui esiste. */}
      <button
        type="button"
        disabled={busy}
        onClick={handleChiamaTurno}
        className="tocco-bottone w-full rounded-lg bg-b58-gold disabled:opacity-40 text-b58-charcoal testo-sala font-semibold px-2"
      >
        Avanti prossimo turno
      </button>
      {esitoChiamata && (
        <p className="testo-sala text-b58-olive-dark leading-tight">{esitoChiamata}</p>
      )}

      {/* 🔴 «ANNULLA TAVOLO» STA COI GRANDI (21/08, deciso da Alessio).
          Era un link piccolo in fondo alla pagina: è un gesto definitivo
          come gli altri tre e merita lo stesso peso.
          ⚠️ LA CONDIZIONE NON CAMBIA: si può solo se non è stato inviato
          niente in cucina — dopo, un conto si chiude, non si annulla.
          Cambia dove sta e quanto è grande. */}
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
            withBusy(() => cancelOrder(order.id, "aperto per sbaglio, nessun ordine inviato")).then(() => {
              setOrder(null);
              setSelezione([]);
              loadBoard();
            });
          }}
          className="tocco-bottone w-full rounded-lg border border-b58-terracotta/40 bg-white text-b58-terracotta-dark testo-sala px-2"
        >
          Annulla tavolo
        </button>
      )}

      <button
        type="button"
        onClick={() => {
          setSpostando(true);
          setSelezione((order.tavoli ?? []).map((t) => t.dining_table_id));
        }}
        className="tocco-bottone w-full rounded-lg border border-b58-charcoal/15 bg-white text-b58-charcoal-soft testo-sala px-2"
      >
        Cambia tavoli
      </button>
      <button
        type="button"
        onClick={() => {
          setOrder(null);
          setSelezione([]);
          setError("");
        }}
        className="tocco-bottone w-full rounded-lg border border-b58-charcoal/15 bg-white text-b58-charcoal testo-sala px-2"
      >
        &lsaquo; Lascia aperto
      </button>

      {/* Qui si LEGGE cosa è stato segnato; si corregge nella lista sotto
          la pianta, dove c'è lo spazio per premere. */}
      {(draftItems.length > 0 || sentItems.length > 0) && (
        <div className="testo-sala leading-tight border-t border-b58-charcoal/10 pt-1">
          {gruppiComanda.map(({ turno, items }) => (
            <div key={turno}>
              {/* Nel riepilogo dentro la pianta il turno si dice in una riga
                  sola e solo se ce n'è più di uno: la colonna è stretta. */}
              {gruppiComanda.length > 1 && (
                <p className="font-semibold text-b58-charcoal-soft">{etichettaTurno(turno)}</p>
              )}
              {items.map((it) => (
                <p
                  key={it.id}
                  className={it.sent_at ? "text-b58-charcoal-soft/70" : "text-b58-terracotta-dark"}
                >
                  {it.quantity}× {lineLabel(it)}
                </p>
              ))}
            </div>
          ))}
          <p className="mt-1 font-semibold text-b58-charcoal">{formatEUR(total)}</p>
        </div>
      )}
    </div>
  ) : selezione.length > 0 ? (
    // 🔴 ANCHE LA SCELTA DEI TAVOLI STA QUI DENTRO (21/08). Prima compariva
    // in un riquadro SOTTO la pianta, e «Apri il tavolo» era in due posti.
    // Alessio: *«preferisco farli comparire di fianco a sinistra, non
    // sotto»* — ed è dove questa colonna sta già, nello spazio di cucina e
    // servizi.
    // 🔴 I DUE PANNELLI PARTONO DALLO STESSO PUNTO (22/08, da un rilievo
    // di Alessio in scala reale). Questo aveva `justify-center` e l'altro
    // no: misurato, «Apri il tavolo» cominciava a **442 punti** su 980 di
    // colonna, mentre «Invia» del tavolo aperto sta in cima.
    // ⚠️ Non è una questione di gusto: **in servizio il dito impara una
    // posizione**, e trovarne un'altra a seconda dello stato costa un
    // secondo ogni volta e un tocco sbagliato ogni tanto. I gesti dei due
    // stati adesso cominciano allo stesso posto.
    <div className="h-full overflow-auto p-1.5 flex flex-col gap-1.5">
      <p className="testo-sala font-semibold text-b58-charcoal leading-tight">
        {sagome
          .filter((s) => selezione.includes(s.id))
          .map((s) => s.label)
          .join(" · ")}
      </p>
      {error && (
        <p className="testo-sala text-b58-terracotta-dark bg-b58-terracotta/10 rounded px-2 py-1 leading-tight">
          {error}
        </p>
      )}
      <button
        type="button"
        disabled={loadingOrder}
        onClick={spostando ? confermaSpostamento : apriSelezione}
        className="tocco-bottone w-full rounded-lg bg-b58-olive disabled:opacity-40 text-b58-parchment testo-sala font-semibold px-2"
      >
        {spostando
          ? `Sposta qui (${selezione.length})`
          : `Apri ${selezione.length === 1 ? "il tavolo" : `${selezione.length} tavoli`}`}
      </button>
      <button
        type="button"
        onClick={() => {
          setSelezione([]);
          setSpostando(false);
        }}
        className="tocco-bottone w-full rounded-lg border border-b58-charcoal/15 bg-white text-b58-charcoal testo-sala px-2"
      >
        Annulla
      </button>

      {/* ⚠️ «NON SONO ARRIVATI» COMPARE SOLO SUL TAVOLO TRATTEGGIATO: su un
          tavolo che deve ancora arrivare sarebbe un invito a disdire per
          sbaglio. E la parola dice CHI non è arrivato e COSA succede al
          tavolo — non deve somigliare ad «annulla il conto», che è un'altra
          cosa. */}
      {!spostando &&
        prenotazioniDeiTavoli(selezione)
          .filter((p) => p.ritardo?.inRitardo)
          .map((p) => (
            <div key={p.id} className="border-t border-b58-charcoal/10 pt-1.5">
              <ConfermaDistruttiva
                etichetta={`${p.nome} non è arrivato`}
                domanda="Il tavolo torna libero e si può ridare a qualcun altro. La prenotazione risulterà annullata."
                etichettaConferma="Sì, libera il tavolo"
                disabilitato={busy}
                onConferma={() =>
                  withBusy(() => annullaPrenotazione(p.id)).then(() => {
                    setSelezione([]);
                    loadBoard();
                  })
                }
              />
            </div>
          ))}
    </div>
  ) : null;


  // 🔴 IL MENU È UNA VARIABILE, non un pezzo di JSX in mezzo al conto — ed è
  // quello che permette di metterlo ACCANTO alla pianta invece che sotto.
  // ⚠️ Non è un rimescolamento estetico: durante la comanda si cercano i
  // piatti che il cliente sceglie, mentre quello che è già segnato si guarda
  // di rado. Il menu è la cosa che si guarda più spesso, e stava in fondo.
  const pannelloMenu = !order ? null : (
    <>
      {/* 🔴 «PROSSIMO TURNO» (21/08, disegno di Alessio): si segnano i piatti,
          si preme, e da lì in poi quello che si segna va nel turno dopo. Sta
          accanto al menu perché è lì che si compone la comanda.
          ⚠️ IL TURNO IN CORSO SI VEDE SEMPRE: senza, dopo due tocchi non si
          sa più in quale turno stanno finendo i piatti — ed è la cosa che
          chi serve deve sapere mentre il cliente parla.
          ⚠️ E NON C'È UN «TORNA INDIETRO»: un turno sbagliato si corregge
          togliendo la riga e rimettendola, che è il gesto che già esiste.
          Aggiungerne uno nuovo non è stato chiesto. */}
      <div className="flex items-center gap-2 mb-2">
        <span className="testo-sala font-semibold text-b58-charcoal">
          {etichettaTurno(turnoCorrente)}
        </span>
        <button
          type="button"
          onClick={() => setTurnoCorrente((t) => t + 1)}
          className="tocco-bottone rounded-lg border border-b58-charcoal/15 bg-white text-b58-charcoal testo-sala px-3"
        >
          Prossimo turno
        </button>
      </div>
      {/* MENU ------------------------------------------------------ */}
      {/* 🔴 LE CATEGORIE IN CIMA, E FILTRANO (21/08, disegno di Alessio).
          Prima erano intestazioni dentro una lista sola: si scorreva
          tutto il menu per arrivare ai dolci. Adesso si sceglie la
          portata e restano i suoi tre o quattro piatti.
          ⚠️ «Tutte» resta, ed è il valore di partenza: chi non conosce
          ancora la carta non deve dover scegliere per vedere. */}
      {categorieDelMenu.length > 1 && (
        <div className="flex flex-wrap gap-1.5 mb-2">
          <button
            type="button"
            onClick={() => setCategoriaScelta(null)}
            className={`tocco-bottone rounded-full px-3 testo-sala font-medium border ${
              categoriaScelta === null
                ? "bg-b58-charcoal text-b58-parchment border-b58-charcoal"
                : "border-b58-charcoal/15 text-b58-charcoal-soft"
            }`}
          >
            Tutte
          </button>
          {categorieDelMenu.map((c) => (
            <button
              key={c.chiave}
              type="button"
              onClick={() => setCategoriaScelta(c.chiave)}
              className={`tocco-bottone rounded-full px-3 testo-sala font-medium border ${
                categoriaScelta === c.chiave
                  ? "bg-b58-charcoal text-b58-parchment border-b58-charcoal"
                  : "border-b58-charcoal/15 text-b58-charcoal-soft"
              }`}
            >
              {c.nome}
            </button>
          ))}
        </div>
      )}
      {menuByCategory.length === 0 ? (
        <p className="testo-sala text-b58-charcoal-soft/60 mb-3">Nessun menu attivo.</p>
      ) : (
        <div className="mb-3">
          {menuByCategory
            .filter(
              (cat) =>
                categoriaScelta !== CHIAVE_BEVERAGE &&
                (categoriaScelta === null || cat.value === categoriaScelta)
            )
            .map((cat) => (
            <div key={cat.value} className="mb-2">
              {/* Con una categoria scelta il suo nome è già nel filtro
                  acceso: ripeterlo qui sarebbe la stessa parola due
                  volte a due centimetri, come «Sala» stamattina. */}
              {categoriaScelta === null && (
              <p className="testo-sala font-semibold text-b58-terracotta-dark border-b border-dashed border-b58-charcoal/15 pb-1 mb-0.5">
                {cat.label}
              </p>
              )}
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
                  {/* 🔴 IL NOME VA A CAPO (21/08, scelta di Alessio fra
                      le tre strade). `min-w-0` è la riga che lo rende
                      possibile: dentro un contenitore flessibile un
                      elemento non si stringe sotto la larghezza del suo
                      contenuto, quindi senza quella un nome lungo
                      spingerebbe fuori il prezzo invece di andare a
                      capo. La riga cresce in altezza perché
                      `.tocco-riga` fissa un'altezza MINIMA, non fissa.
                      ⚠️ E il prezzo si allinea in alto (`self-start`):
                      con un nome su due righe, centrato finirebbe in
                      mezzo alle due — accanto a niente. */}
                  <span className="flex-1 min-w-0 testo-sala-grande text-b58-charcoal leading-tight py-1">
                    {mi.recipe_name}
                  </span>
                  <span className="testo-sala text-b58-charcoal-soft shrink-0 self-start pt-1.5">
                    {formatEUR(mi.selling_price)}
                  </span>
                  <span className="tocco-bottone shrink-0 rounded-lg bg-b58-terracotta text-b58-parchment flex items-center justify-center testo-sala-grande pointer-events-none">
                    +
                  </span>
                </button>
              ))}
            </div>
          ))}
        </div>
      )}

      {/* BEVANDE --------------------------------------------------- */}
      {/* ⚠️ I SOTTOGRUPPI RESTANO (condizione di Alessio): dentro
          «Beverage» si continuano a vedere Acqua, Birre, Caffetteria…
          Appiattirli darebbe un elenco lungo e indistinto, che e'
          esattamente il difetto da cui i filtri sono nati. */}
      {bevande.length > 0 && mostraBevande && (
        <div className="mb-3">
          {bevande.map((cat) => (
            <div key={cat.nome} className="mb-2">
              <p className="testo-sala font-semibold text-b58-terracotta-dark border-b border-dashed border-b58-charcoal/15 pb-1 mb-0.5">
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
        className="tocco-bottone testo-sala text-b58-charcoal-soft underline hover:text-b58-terracotta-dark mb-2"
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
            className="w-full rounded-lg border border-b58-charcoal/15 hover:bg-b58-cream-dark disabled:opacity-60 text-b58-charcoal testo-sala-grande font-medium py-2"
          >
            + Aggiungi alla comanda
          </button>
        </form>
      )}

    </>
  );


  return (
    // 🔴 LA LARGHEZZA MASSIMA È QUELLA CHE SERVE ALLA PIANTA (21/08, dopo
    // la prova in scala reale di Alessio).
    //
    // ⚠️ `max-w-md` (448 punti) c'era da sempre, ed era giusto finché questa
    // schermata era una colonna di testo. **Non lo è più**: la pianta in
    // piedi, alla calibrazione vera di un tablet (74 punti per centimetro),
    // chiede **667 punti**. Con 448 sborderebbe di duecento.
    //
    // ⚠️ E NON SI TORNA INDIETRO PIÙ DI COSÌ. Le due colonne di ieri sera
    // sono sparite (misurate con la lente sbagliata), ma **questa larghezza
    // resta**: serviva anche a loro, e serve alla pianta da sola. Tornare a
    // 448 «come prima» rimetterebbe il difetto che si sta chiudendo.
    //
    // Su un Android da 8 pollici (800 punti, meno 32 per lato) restano 736
    // punti utili: la pianta ne chiede 667 e ne avanzano 69.
    <div className="max-w-3xl mx-auto pb-6">
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
          <p className="testo-sala-grande text-b58-charcoal">
            È cominciata una giornata nuova. Questa è ancora la sala della serata di{" "}
            <strong>{formatDate(serata)}</strong>.
          </p>
          <button
            type="button"
            onClick={() => setSerata(serataDiServizio(new Date(), oraFineSerata))}
            className="mt-1 testo-sala-grande underline text-b58-terracotta-dark hover:text-b58-charcoal tocco-bottone"
          >
            Passa alla serata di oggi
          </button>
        </div>
      )}

      <div className="flex items-center justify-between gap-2 mb-3">
        <div>
          <h1 className="font-display text-2xl text-b58-charcoal leading-none">Sala</h1>
          <p className="testo-sala text-b58-charcoal-soft/70 mt-1">
            {/* 🔴 «CAMBIA TAVOLI» NON STA PIÙ QUI (21/08, deciso da Alessio).
                Stava in cima alla pagina, all'estremità opposta rispetto al
                conto su cui si sta lavorando: con la comanda aperta davanti,
                per spostare un tavolo bisognava risalire tutta la schermata.
                **Lui l'ha cercato accanto al conto e non l'ha trovato.**
                Adesso è accanto a «‹ Lascia … aperto»: sono i due gesti che
                riguardano lo stesso conto, e stanno insieme. */}
            {order ? `${order.table_label} aperto` : "Nessun tavolo aperto"}
          </p>
        </div>
        <div className="flex gap-1.5">
          <Link
            to="/comande/bar"
            className="rounded-lg border border-b58-charcoal/15 hover:bg-b58-cream-dark transition-colors text-b58-charcoal testo-sala font-medium px-3 py-2"
          >
            Bar
          </Link>
          <Link
            to="/comande/cucina"
            className="rounded-lg border border-b58-charcoal/15 hover:bg-b58-cream-dark transition-colors text-b58-charcoal testo-sala font-medium px-3 py-2"
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
            className="rounded-lg border border-b58-charcoal/15 hover:bg-b58-cream-dark transition-colors text-b58-charcoal testo-sala font-medium px-3 py-2"
          >
            Scontrini
          </Link>
          {isTitolare && (
            <button
              type="button"
              onClick={() => setPanel((p) => (p ? null : "tavoli"))}
              className="tocco-bottone rounded-lg border border-b58-charcoal/15 hover:bg-b58-cream-dark transition-colors text-b58-charcoal testo-sala font-medium px-3"
            >
              {/* ⚠️ «CHIUDI IMPOSTAZIONI», non «Chiudi» (22/08). In sala
                  «chiudere» vuol dire **incassare**: è la regola per cui il
                  gesto del conto si chiama «Chiudi conto» e l'uscita dal
                  tavolo «Lascia il tavolo aperto». Un «Chiudi» solitario, a
                  due dita da un tavolo aperto, è la parola sbagliata nel
                  posto peggiore. */}
              {panel ? "Chiudi impostazioni" : "Impostazioni"}
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
        <p className="testo-sala-grande text-b58-terracotta-dark bg-b58-terracotta/10 rounded-lg px-3 py-2 mb-3">{error}</p>
      )}

      {panel && isTitolare && (
        <div className="space-y-3 mb-4">
          <div className="flex gap-1.5">
            <button
              type="button"
              onClick={() => setPanel("coperto")}
              className={`testo-sala rounded-full px-3 py-1.5 border ${panel === "coperto" ? "bg-b58-terracotta text-b58-parchment border-b58-terracotta" : "border-b58-charcoal/15 text-b58-charcoal-soft"}`}
            >
              Coperto
            </button>
            <button
              type="button"
              onClick={() => setPanel("calibrazione")}
              className={`testo-sala rounded-full px-3 py-1.5 border ${panel === "calibrazione" ? "bg-b58-terracotta text-b58-parchment border-b58-terracotta" : "border-b58-charcoal/15 text-b58-charcoal-soft"}`}
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
                  <span className="testo-sala-grande text-b58-charcoal-soft">€ a persona</span>
                  <button
                    type="button"
                    onClick={handleSavePrice}
                    className="rounded-lg bg-b58-terracotta hover:bg-b58-terracotta-dark transition-colors text-b58-parchment testo-sala-grande font-medium px-4 py-2"
                  >
                    Salva
                  </button>
                </div>

              </div>


            </div>
          )}
        </div>
      )}

      {/* 🔴 LE DUE COLONNE (21/08, disegno di Alessio area per area sul suo
          tablet in verticale): a SINISTRA il menu, a DESTRA la pianta.

          ⚠️ Il menu a sinistra e in basso non e' una preferenza: **e' la cosa
          che si guarda piu' spesso**. Durante la comanda si cercano i piatti
          che il cliente sceglie, mentre quello che e' gia' segnato si guarda
          di rado — e stava in fondo alla pagina.

          ⚠️ SI DIVIDE SOLO CON UN CONTO APERTO, e a schermo largo abbastanza.
          Senza conto il menu non esiste, e la pianta si prende tutto: due
          colonne di cui una vuota sarebbero spazio buttato proprio nella
          schermata che ne ha meno.

          ⚠️ E LA PIANTA NON SI STRINGE SOTTO LA SUA SOGLIA: il `min-width` in
          centimetri veri che la tiene toccabile vive dentro `PiantaSala` e
          vale anche qui. Se lo spazio non basta, le due colonne tornano una
          sopra l'altra invece di rimpicciolire i tavoli. */}
      {/* 🔴 LA PIANTA STA A DESTRA SEMPRE, con conto o senza (21/08).
          Prima le due colonne comparivano solo col conto aperto, e Alessio
          l'ha notato al primo tocco: **«swicha da destra al centro in base
          a cosa si tocca»**. Era l'ultimo residuo della schermata a colonna
          singola — e una sala che si sposta sotto gli occhi mentre si lavora
          costringe a ricercarla ogni volta.
          ⚠️ Senza conto la colonna di sinistra e' vuota, ed e' voluto: lo
          spazio resta suo, cosi' quando il menu compare la pianta non si
          muove di un punto. */}
      {/* 🔴 LE DUE COLONNE SONO SPARITE (21/08, dopo la prova in SCALA
          REALE di Alessio su un Android da 8 pollici). Non erano sbagliate
          nel principio: erano **misurate con la lente sbagliata** — la
          calibrazione da computer (37,8 punti per centimetro) invece di
          quella vera del tablet (74). In scala reale menu e pianta
          affiancati non ci stanno in 10,8 cm di schermo, e la pianta
          sbordava di lato.

          🔴 LA REGOLA CHE NE ESCE, ed è di Alessio: **quello che si vede
          deve entrare in larghezza. Mai scorrimento laterale — se serve
          scorrere, si scorre in verticale.**

          ⚠️ E la lente sbagliata era di tutti, validatore compreso: le
          larghezze su cui il disegno fu approvato (menu 250, pianta 427)
          erano numeri da monitor. Rovesciamento n. 18 nel registro.

          ⚠️ LA SOGLIA DEL TAVOLO RESTA A 10,5 mm. Era stato proposto di
          abbassarla a 7 per far stare due colonne: adesso non servono più
          affiancate, e a tutta larghezza la pianta chiede 667 punti sui
          736 utili. *Un numero si abbassa quando serve, non per prudenza.* */}
      <div>
        <div>
      {/* LA SALA ------------------------------------------------------ */}
      {/* La stessa pianta del Calendario: se stasera tre tavoli sono
          accostati, qui si vedono accostati — e si aprono insieme, con UN
          conto solo. */}
      {/* ⚠️ «SALA» NON SI SCRIVE DUE VOLTE. C'è già il titolo in cima alla
          schermata, e questa riga diceva la stessa cosa a due centimetri di
          distanza. Resta solo quando ha qualcosa di DIVERSO da dire — cioè
          mentre si scelgono i tavoli di uno spostamento, dove è una domanda
          e non un'etichetta. */}
      {spostando && <p className={sectionLabel}>Su quali tavoli lo sposti?</p>}
      {!letta ? (
        /* 🔴 «NON LO SO» INVECE DI «NON C'È NIENTE». Prima qui compariva
           «Nessun tavolo configurato» anche quando la lettura era fallita —
           una frase sicura di sé, e falsa. In servizio è la peggiore che si
           possa leggere. Il rifiuto ha la sua via d'uscita, perché l'errore
           che l'ha prodotto è passeggero. */
        /* ⚠️ Era la seconda copia a mano di <DatoNonLetto>: vedi la nota
           gemella in PiantaGiornata. La frase adesso è una sola, e nomina la
           connessione anche qui — che è la causa vera nove volte su dieci, e
           in servizio è l'unica informazione che permette di fare qualcosa. */
        <DatoNonLetto
          cosa="la sala"
          nonVuolDire="Non vuol dire che è vuota: vuol dire che non lo so. Di solito è la connessione."
          onRiprova={() => {
            setError("");
            loadBoard().catch((e) => setError(e.message));
          }}
          className="mb-3"
        />
      ) : sagome.length === 0 ? (
        <p className="testo-sala text-b58-charcoal-soft/60 py-4">Nessun tavolo configurato.</p>
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
            pannelli={[
              { contenuto: bancoBar, riquadro: riquadroBanco },
              { contenuto: pannelloGesti, riquadro: riquadroGesti },
            ]}
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
        </div>
        {/* ⚠️ IL MENU STA SOTTO LA PIANTA, e ci si arriva scorrendo IN
            GIU' — che e' la regola di Alessio del 21/08. Misurato a 800
            punti con la calibrazione vera: la pianta e' alta 1479 punti,
            quindi i primi piatti compaiono scorrendo di circa mille.
            ⚠️ E i GESTI del conto non chiedono quello scorrimento: stanno
            dentro la pianta, e la loro colonna comincia a 479 punti da
            dove la pianta comincia — cioe' si vedono sul primo schermo. */}
        {order && <div ref={menuRef}>{pannelloMenu}</div>}
      </div>

      {/* 🔴 LA LISTA «STASERA» È SPARITA (21/08, deciso da Alessio), e la
          ragione ribalta un parere del validatore: **il segnale del ritardo è
          il tratteggio dentro il tavolo**, che si vede senza cercarlo. Visto
          quello, si tocca il tavolo e si leggono i dettagli. La lista
          ripeteva a parole quello che il tavolo già dice — e in servizio una
          ripetizione si paga in secondi e in spazio.
          ⚠️ Via anche «da liberare entro le…»: a lui basta sapere che il
          tavolo si può ridare quando è tratteggiato.

          ⚠️ COSA SI PERDE DAVVERO — misurato prima di toglierla, e sono
          TRE cose (il riepilogo le elenca per intero):
          l'ORA prenotata, i MINUTI di ritardo, e — la sola grave — le
          prenotazioni SENZA TAVOLO.

          🔴 Quelle restano, ed è l'unica riga sopravvissuta: **una
          prenotazione senza tavolo non compare sulla pianta per
          costruzione**, quindi togliendo la lista sparirebbe del tutto.
          Misurato: in produzione oggi sono 0 su 3, sul progetto di prova 4
          su 7 — cioè è un caso normale, non un residuo. Il nome è quello
          che serve a chi apre la porta. */}
      {senzaTavolo.length > 0 && (
        <div className="mb-4 rounded-lg bg-b58-gold/10 ring-1 ring-b58-gold/40 px-3 py-2">
          <p className="testo-sala font-semibold text-b58-gold-dark mb-0.5">
            {senzaTavolo.length === 1 ? "Una prenotazione senza tavolo" : `${senzaTavolo.length} prenotazioni senza tavolo`}
          </p>
          <p className="testo-sala-grande text-b58-charcoal leading-snug">
            {senzaTavolo
              .map((p) => `${p.ora?.slice(0, 5)} · ${p.nome}${p.persone ? ` (${p.persone})` : ""}`)
              .join(" — ")}
          </p>
        </div>
      )}

      {/* 🔴 LA BARRA DEI TAVOLI SOTTO LA PIANTA È SPARITA (21/08, deciso da
          Alessio): diceva le stesse cose della colonna dei gesti dentro la
          pianta — «Apri il tavolo», «Annulla», «non è arrivato» — a mezzo
          metro di distanza. **Una cosa, un posto solo**, e il posto è dentro
          la pianta, dove lui li ha visti e approvati. */}

      {loadingOrder && <p className="testo-sala text-b58-charcoal-soft">Apro il tavolo…</p>}

      {!loadingOrder && !order && selezione.length === 0 && (
        <p className="testo-sala-grande text-b58-charcoal-soft/70 text-center py-6">
          Tocca un tavolo per aprirlo.

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
          {/* 🔴 I DUE GESTI SI SONO SPOSTATI DENTRO LA COLONNA DEI GESTI
              (21/08, deciso da Alessio guardando la schermata in scala
              reale). Qui sotto cadevano a **1279 punti dall'alto**, cioè
              oltre tutta la pianta: c'erano e non li trovava nessuno.
              Adesso stanno accanto a Invia / Preconto / Chiudi conto, che
              è dove stanno **tutti** i gesti di questo conto. */}

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
            <p className="rounded-lg bg-b58-parchment ring-1 ring-b58-charcoal/10 px-3 py-2 testo-sala-grande mb-3">
              <strong>{order.prenotazione.customer_name}</strong>
              {order.prenotazione.party_size ? ` · ${order.prenotazione.party_size} persone` : ""}
              {order.prenotazione.reservation_time
                ? ` · prenotato per le ${order.prenotazione.reservation_time.slice(0, 5)}`
                : ""}
              {order.prenotazione.notes && (
                <span className="block testo-sala text-b58-charcoal-soft mt-0.5">
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
            <p className="rounded-lg bg-b58-gold/25 ring-1 ring-b58-gold px-3 py-2 testo-sala-grande mb-4">
              <strong>Da liberare entro le {liberareEntro.slice(0, 5)}</strong>
            </p>
          )}

          {/* COPERTI --------------------------------------------------- */}
          <p className={sectionLabel}>Coperti</p>
          <div className="flex items-center gap-2 mb-4">
            <button
              type="button"
              disabled={busy || coperti === 0}
              onClick={() => handleCoperti(coperti - 1)}
              className="tocco-bottone rounded-lg bg-white ring-1 ring-b58-charcoal/15 testo-sala-grande text-b58-charcoal disabled:opacity-40"
            >
              −
            </button>
            <input
              type="number"
              min="0"
              value={coperti}
              onChange={(e) => handleCoperti(e.target.value)}
              className="tocco-bottone w-16 text-center rounded-lg border border-b58-charcoal/15 bg-white testo-sala-grande"
            />
            <button
              type="button"
              disabled={busy}
              onClick={() => handleCoperti(coperti + 1)}
              className="tocco-bottone rounded-lg bg-white ring-1 ring-b58-charcoal/15 testo-sala-grande text-b58-charcoal disabled:opacity-40"
            >
              +
            </button>
            <span className="testo-sala text-b58-charcoal-soft/70 ml-1">
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
              className="tocco-riga w-full flex items-center justify-between px-3 mb-4 rounded-lg bg-b58-gold/10 ring-1 ring-b58-gold-dark/25 text-b58-gold-dark font-semibold testo-sala-grande"
            >
              <span>🍷 Carta dei vini</span>
              <span className="testo-sala-grande">›</span>
            </button>
          )}

          {/* COMANDA IN CORSO ----------------------------------------- */}
          <p className={sectionLabel}>Comanda in corso — {order.table_label}</p>
          <div className="rounded-xl bg-white ring-1 ring-b58-charcoal/10 p-3 mb-3">
            {draftItems.length === 0 && sentItems.length === 0 && (
              <p className="testo-sala text-b58-charcoal-soft/60 text-center py-3">Nessun piatto selezionato.</p>
            )}

            {/* 🔴 I TURNI SI SEPARANO CON UNA RIGA DI STACCO (21/08, disegno
                di Alessio): «2° turno», «3° turno».
                ⚠️ SOLO QUANDO I TURNI SONO PIÙ DI UNO: su una comanda che
                esce tutta insieme — il caso normale fino a ieri — un «1°
                turno» solitario sarebbe una parola in più che non separa
                niente.
                ⚠️ E DENTRO IL TURNO VENGONO PRIMA LE RIGHE GIÀ INVIATE:
                quello che si sta segnando adesso resta in fondo al suo turno,
                che è dove sta il dito. Prima del 21/08 l'ordine era
                «tutte le bozze, poi tutte le inviate»: con i turni quella
                separazione racconterebbe una comanda che non esiste. */}
            {gruppiComanda.map(({ turno, items }) => (
              <div key={turno}>
                {gruppiComanda.length > 1 && (
                  // 🔴 UNA RIGA DI STACCO, NON UN'ETICHETTA (22/08, chiesto
                  // da Alessio in scala reale). Era una scritta grigia in
                  // mezzo alle righe: si leggeva solo cercandola.
                  //
                  // ⚠️ E LA RAGIONE DECIDE LA FORMA: quella divisione è la
                  // stessa che finisce **sul biglietto stampato**. Quindi si
                  // separa come separerebbe la carta — una banda piena, a
                  // tutta larghezza, che si legge da lontano — invece di un
                  // titoletto che si legge da vicino.
                  <p className="testo-sala-grande uppercase tracking-wide font-bold text-b58-parchment bg-b58-charcoal-soft rounded px-2 py-1 mt-3 mb-1.5 first:mt-0">
                    {etichettaTurno(turno)}
                  </p>
                )}

                {items.filter((i) => i.sent_at).map((it) => (
                  <div key={it.id} className="flex items-center gap-2 py-1.5 border-b border-b58-charcoal/5 last:border-0 opacity-70">
                    <span className="flex-1 min-w-0 testo-sala-grande text-b58-charcoal leading-tight">
                      {it.quantity}× {lineLabel(it)}
                      <span className="testo-sala text-b58-charcoal-soft"> · inviata</span>
                      {it.note && <span className="block testo-sala italic text-b58-charcoal-soft">↳ {it.note}</span>}
                    </span>
                    <span className="testo-sala text-b58-charcoal-soft shrink-0">{formatEUR(lineTotal(it))}</span>
                    <button
                      type="button"
                      onClick={() => handleVoid(it.id)}
                      // 🔴 4,0 mm, ed e' il gesto che STORNA un piatto gia'
                      // andato in cucina (22/08). Un bersaglio piccolo su
                      // una cosa che si disfa e' fastidio; su una che non
                      // si disfa e' un'altra cosa.
                      className="tocco-bottone testo-sala text-b58-charcoal-soft hover:text-b58-terracotta-dark px-2"
                    >
                      annulla
                    </button>
                  </div>
                ))}

                {items.filter((i) => !i.sent_at).map((it) => (
                  <div key={it.id} className="border-b border-b58-charcoal/5 last:border-0 py-1.5">
                    <div className="flex items-center gap-1.5">
                      <span className="flex-1 min-w-0 testo-sala-grande text-b58-charcoal leading-tight">{lineLabel(it)}</span>
                      <button
                        type="button"
                        onClick={() => withBusy(() => updateDraftItemQuantity(it.id, it.quantity - 1))}
                        className="tocco-bottone rounded-lg ring-1 ring-b58-charcoal/15 text-b58-charcoal"
                      >
                        −
                      </button>
                      <b className="w-5 text-center testo-sala-grande">{it.quantity}</b>
                      <button
                        type="button"
                        onClick={() => withBusy(() => updateDraftItemQuantity(it.id, it.quantity + 1))}
                        className="tocco-bottone rounded-lg ring-1 ring-b58-charcoal/15 text-b58-charcoal"
                      >
                        +
                      </button>
                      <span className="w-14 text-right testo-sala text-b58-charcoal-soft shrink-0">{formatEUR(lineTotal(it))}</span>
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
                      className="w-full mt-1 rounded-md border border-dashed border-b58-charcoal/20 bg-b58-cream/40 px-2 py-1.5 testo-sala text-b58-charcoal-soft"
                    />
                  </div>
                ))}
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

          {/* IL TOTALE. 🔴 I QUATTRO PULSANTI CHE STAVANO QUI SONO SPARITI
              (21/08): Invia comanda, Preconto, Chiudi conto e «Annulla il
              tavolo» esistevano **anche** nella colonna dei gesti dentro la
              pianta. Due pulsanti che fanno la stessa cosa sono due cose da
              imparare, non una comodità.
              ⚠️ Il totale invece RESTA: non è un gesto, è un numero — e qui
              sta sotto le righe da cui nasce. */}
          <div className="rounded-xl bg-b58-parchment ring-1 ring-b58-charcoal/10 p-3 space-y-2">
            {coperti > 0 && (
              <div className="flex justify-between testo-sala text-b58-charcoal-soft">
                <span>{coperti} coperti</span>
                <span>{formatEUR(copertoTotal)}</span>
              </div>
            )}
            <div className="flex justify-between testo-sala-grande font-semibold text-b58-charcoal">
              <span>Totale</span>
              <span>{formatEUR(total)}</span>
            </div>
          </div>

          {/* ⚠️ SOTTO IL TOTALE, dove finisce chi ha appena segnato i
              piatti. È lo stesso pezzo del pulsante nella colonna dei
              gesti — stessa parola, stesso conteggio, si spengono
              insieme — e qui è più grande, perché è il gesto che chiude
              una lista lunga. */}
          <div className="mt-2">{bottoneInvia("testo-sala-grande py-1")}</div>
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
            className="tocco-riga shrink-0 flex items-center gap-2 px-4 bg-b58-gold-dark text-b58-parchment font-semibold testo-sala-grande uppercase tracking-wide"
          >
            <span className="testo-sala-grande">‹</span> Torna al menu — {order.table_label}
          </button>
          <div className="flex-1 overflow-y-auto p-3 max-w-md mx-auto w-full">
            {vini.map((cat) => (
              <div key={cat.nome} className="mb-3">
                <p className="testo-sala font-semibold text-b58-terracotta-dark border-b border-dashed border-b58-charcoal/15 pb-1 mb-0.5">
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
              className="tocco-azione w-full rounded-lg bg-b58-olive text-b58-parchment testo-sala-grande font-semibold"
            >
              Fatto — torna alla comanda
            </button>
          </div>
        </div>
      )}

      {/* CHI PAGA QUESTO TAVOLO — si apre dal riquadro accanto al tavolo.
          ⚠️ Un pannello che prende spazio, non un'espansione dentro il
          riquadro: li' ci sono 25 mm d'altezza, e due campi da scrivere non
          ci stanno senza far scorrere — che e' proprio quello che questa
          correzione toglie. */}
      {clienteAperto && order && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-b58-charcoal/50 p-4">
          <div className="w-full max-w-md rounded-xl bg-b58-cream p-4 shadow-xl">
            <div className="mb-3 flex items-baseline justify-between gap-3">
              <h2 className="font-display testo-sala-grande text-b58-charcoal">
                Chi paga — {order.table_label}
              </h2>
              <button
                type="button"
                onClick={() => setClienteAperto(false)}
                className="tocco-bottone rounded border border-b58-charcoal/15 px-3 testo-sala text-b58-charcoal-soft"
              >
                Chiudi
              </button>
            </div>
            {/* ⚠️ Chi ha prenotato resta scritto qui: serve mentre si decide
                chi paga, ed e' l'unico posto in cui le due cose si vedono
                una accanto all'altra. */}
            {order.prenotazione && (
              <p className="mb-3 testo-sala text-b58-charcoal-soft">
                Ha prenotato <strong>{order.prenotazione.customer_name}</strong>
                {order.prenotazione.party_size ? ` · ${order.prenotazione.party_size} persone` : ""}
                {order.prenotazione.reservation_time
                  ? ` · per le ${order.prenotazione.reservation_time.slice(0, 5)}`
                  : ""}
              </p>
            )}
            <ClientePagante
              order={order}
              onFatto={() => reloadOrder()}
              onErrore={setError}
            />
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
