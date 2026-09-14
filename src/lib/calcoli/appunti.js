import { formatDate } from "../constants";

// =====================================================================
// COME SI LEGGE UN APPUNTO VOCALE — SPEC-0013
// =====================================================================
// 🔴 UN APPUNTO DEVE DIRE LA VERITA' OPERATIVA, non una promessa generica.
// La specifica lo scrive con un esempio, ed e' l'esempio a definire la
// forma: *«Spesa spicciola → parmigiano; shampoo»*. Non «2 cose da
// aggiungere», non «una spesa»: la destinazione e **cosa verrebbe scritto
// davvero**.
//
// ⚠️ IL MOTIVO NON E' L'ELEGANZA, E' CHE «APPROVA» E' UNA FIRMA. Chi preme
// approva sta autorizzando una scrittura che non ha visto, se l'appunto
// gliela riassume. Un riassunto giusto al 90% e' peggio di nessun
// riassunto: si impara a fidarsi, e il 10% passa.
//
// ⚠️ QUI NON SI DECIDE NIENTE DI CIO' CHE SUCCEDERA'. Questo file mette in
// italiano dei dati che il database ha gia' deciso — se una destinazione e'
// eseguibile, se un appunto raggruppa, cosa verra' scritto. Se decidesse
// anche qui, prima o poi la schermata mostrerebbe un numero e il database
// ne scriverebbe un altro.

/** I campi che non si mostrano: sono impalcatura, non contenuto. */
// ⚠️ `dove` e' il collegamento che l'appunto si porta dietro (Agenda,
//    07/09): e' impalcatura per la schermata, non una cosa che verrebbe
//    scritta approvando — e mostrarlo fra i dati concreti direbbe a chi
//    firma che sta autorizzando un indirizzo.
// ⚠️ `impegni_possibili` e' l'elenco degli impegni che il gestionale non ha
//    saputo distinguere fra loro (Agenda, 09/09/2026): si mostra, ma NON qui
//    in mezzo ai dati concreti — quelli sono «cosa verrebbe scritto
//    approvando», e questi sono l'esatto contrario: la ragione per cui non si
//    scrive niente. Metterli li' direbbe a chi firma che sta autorizzando due
//    impegni invece di nessuno.
// 🔴 E NON SI CHIAMA `candidati`, che sarebbe stato il nome ovvio: quella
//    parola in questo sistema E' GIA' OCCUPATA — per giacenza, temperatura e
//    pulizia vuol dire «i numeri di catalogo fra cui scegliere», e da li'
//    nascono i pulsanti da toccare. Sono due cose diverse (quella si tocca,
//    questa si legge), e col discriminante del 17/08 due cose diverse
//    vogliono due nomi. ⚠️ Riusarlo non dava un errore di nome: faceva
//    fallire la lettura di TUTTI gli appunti insieme.
// ⚠️ `indistinguibili` e `scelto_a_mano` sono due DICHIARAZIONI sul modo in
//    cui si e' arrivati al dato, non dati da scrivere: la schermata le usa
//    per dire la verita' su cosa e' successo, e approvando non finiscono
//    da nessuna parte.
const DI_SERVIZIO = new Set([
  "nome_sentito",
  "sentito",
  "lista",
  "dove",
  "impegni_possibili",
  "indistinguibili",
  "scelto_a_mano",
]);

/**
 * Come si scrive un valore dentro un appunto.
 *
 * ⚠️ Lo ZERO e il FALSO si scrivono, il vuoto no. In questo progetto e' una
 * regola pagata piu' volte: 0 gradi e' la temperatura del pesce fresco, e
 * saltarlo perche' «e' falso» toglierebbe dall'appunto proprio il dato che
 * si sta approvando.
 */
function valore(v) {
  if (v === null || v === undefined) return null;
  if (typeof v === "boolean") return v ? "sì" : "no";
  if (typeof v === "number") return String(v);
  if (typeof v === "string") return v.trim() === "" ? null : v.trim();
  if (Array.isArray(v)) {
    const dentro = v.map(valore).filter(Boolean);
    return dentro.length > 0 ? dentro.join(", ") : null;
  }
  if (typeof v === "object") {
    const dentro = datiInChiaro(v);
    return dentro === "" ? null : dentro;
  }
  return null;
}

// 🔴 COME SI CHIAMANO IN ITALIANO I CAMPI CHE NON SI SPIEGANO DA SOLI —
//    10/09/2026, Blocco 3 del mandato.
//
// Il nome del campo con gli underscore tolti funziona quasi sempre
// («quanto ce», «nome libero»), e su due cose no: il promemoria che avvisa
// ha **due date**, e chiamarle «data» e «avviso data» le fa sembrare la
// stessa cosa scritta due volte. Sono l'una il giorno in cui la cosa
// succede e l'altra il giorno in cui il telefono suona.
//
// ⚠️ Qui non si decide niente: si mettono in italiano dei dati che il
// database ha gia' deciso. Un campo che non e' in questo elenco continua a
// comparire col suo nome — non sparisce, che sarebbe il difetto peggiore.
const ETICHETTE = {
  data: "giorno",
  // ⚠️ L'ora dell'impegno (11/09/2026) e l'ora dell'avviso sono due cose:
  //    la prima dice quando succede, la seconda quando suona il telefono.
  ora: "ora",
  // Un'ora detta e non capita si MOSTRA, non si butta: chi firma deve
  // sapere che l'impegno nascerà senza ora, e perché.
  ora_non_capita: "ora non capita (non la scrivo)",
  avviso_data: "ti avviso il",
  avviso_ora: "alle",
  data_nuova: "nuovo giorno",
  data_precedente: "adesso è",
};

// ⚠️ E UNA DATA SI SCRIVE COME LA SCRIVE IL RESTO DEL GESTIONALE. Una
//    «2026-09-13» in mezzo a una frase italiana e' un dato che chi legge
//    deve tradurre, e chi traduce a mente sbaglia — su una firma.
const SOLO_DATA = /^\d{4}-\d{2}-\d{2}$/;
const SOLO_ORA = /^\d{2}:\d{2}(:\d{2})?$/;

function inChiaro(v) {
  if (SOLO_DATA.test(v)) return formatDate(v);
  // Un'ora arriva a volte coi secondi: «15:00:00» si legge peggio di
  // «15:00» e non dice niente di piu'.
  if (SOLO_ORA.test(v)) return v.slice(0, 5);
  return v;
}

/**
 * I dati concreti di un elemento, in una riga leggibile.
 *
 * Torna stringa vuota quando non c'e' niente da dire — e chi chiama deve
 * distinguere quel caso, perche' «nessun dato» e' un'informazione: vuol
 * dire che approvando non si scriverebbe nessun valore.
 */
export function datiInChiaro(dati) {
  if (!dati || typeof dati !== "object" || Array.isArray(dati)) return "";
  const pezzi = [];
  for (const [chiave, grezzo] of Object.entries(dati)) {
    if (DI_SERVIZIO.has(chiave)) continue;
    const v = valore(grezzo);
    if (v === null) continue;
    pezzi.push(`${ETICHETTE[chiave] ?? chiave.replaceAll("_", " ")}: ${inChiaro(v)}`);
  }
  return pezzi.join(" · ");
}

/**
 * L'AVVISO CHE UN APPUNTO PROMETTE, se ne promette uno.
 *
 * 🔴 SERVE PERCHE' «APPROVA» E' UNA FIRMA, e quello che si firma qui non e'
 * un dato in tabella: e' **un telefono che suonera'**. Chi preme deve
 * vedere quando, scritto per intero, prima di premere.
 *
 * ⚠️ E CI SI METTE ANCHE IL LIMITE: il lavoro che manda le notifiche gira
 * ogni cinque minuti, quindi il messaggio arriva all'ora scelta **o entro i
 * cinque minuti dopo**. Non e' un difetto da correggere — e' un fatto, e un
 * fatto che chi aspetta un avviso alle 15:00 spaccate deve sapere.
 *
 * ⚠️ Restituisce `null` quando non c'e' nessun avviso, che e' il caso
 * normale: un impegno senza notifica e' la maggioranza.
 */
export function avvisoDellElemento(elemento) {
  const dati = elemento?.dati ?? {};
  const giorno = valore(dati.avviso_data);
  const ora = valore(dati.avviso_ora);
  if (!giorno || !ora) return null;
  if (!SOLO_DATA.test(giorno) || !SOLO_ORA.test(ora)) return null;
  return { giorno: formatDate(giorno), ora: ora.slice(0, 5) };
}

/**
 * Come si chiama un elemento nell'elenco corto dell'appunto.
 *
 * ⚠️ Si preferisce il NOME SENTITO alla frase costruita: sulla lista della
 * spesa e' esattamente cio' che diventera' la riga, quindi e' anche il solo
 * modo di accorgersi che si e' capito «parmigiano» dove lui aveva detto
 * «parmareggio».
 */
export function nomeElemento(elemento) {
  const dati = elemento?.dati ?? {};
  return (
    valore(dati.nome_sentito) ||
    valore(dati.nome_libero) ||
    valore(dati.nome) ||
    valore(dati.titolo) ||
    valore(elemento?.frase) ||
    "una cosa senza nome"
  );
}

/**
 * La riga che riassume l'appunto: destinazione e cosa ci finisce dentro.
 *
 * `Spesa spicciola → parmigiano; shampoo`
 */
export function riassunto(appunto) {
  const titolo = valore(appunto?.titolo) || "Destinazione sconosciuta";
  const elementi = Array.isArray(appunto?.elementi) ? appunto.elementi : [];
  if (elementi.length === 0) return titolo;
  return `${titolo} → ${elementi.map(nomeElemento).join("; ")}`;
}

/**
 * Da quanto e' aperto, in parole.
 *
 * ⚠️ SOTTO IL GIORNO SI CONTANO LE ORE, e non e' pignoleria: un appunto
 * fatto stamattina e uno di venti minuti fa direbbero tutt'e due «di oggi»,
 * e SPEC-0013 chiede l'eta' proprio perche' si distingua cosa e' rimasto
 * indietro. Con un giorno o piu' l'ora non serve piu'.
 */
export function eta(ore, giorni) {
  const g = Number(giorni);
  const o = Number(ore);
  if (Number.isFinite(g) && g >= 1) {
    if (g === 1) return "da ieri";
    if (g < 7) return `da ${g} giorni`;
    if (g < 14) return "da più di una settimana";
    if (g < 31) return `da ${Math.floor(g / 7)} settimane`;
    return "da più di un mese";
  }
  if (!Number.isFinite(o) || o < 1) return "da poco";
  if (o === 1) return "da un'ora";
  return `da ${o} ore`;
}

/**
 * Quanti elementi, in parole.
 *
 * ⚠️ Il numero c'e' SEMPRE, anche quando e' uno: SPEC-0013 lo chiede, e
 * mostrarlo solo da due in su farebbe sembrare l'appunto singolo una cosa
 * di natura diversa — mentre e' lo stesso oggetto con un elemento solo.
 */
export function quantiElementi(n) {
  const q = Number(n);
  if (!Number.isFinite(q) || q <= 0) return "niente dentro";
  return q === 1 ? "1 cosa" : `${q} cose`;
}

/**
 * Cosa dire della certezza.
 *
 * 🔴 TRE STATI, NON DUE, ed e' la stessa forma che questo progetto usa per
 * gli allergeni e per le versioni: «sicuro», «incerto», e **«il gestionale
 * non sa ancora farlo»**. I due «no» si comportano diversamente e non si
 * dicono uguale: nel primo caso MEMO non ha capito bene, nel secondo ha
 * capito benissimo e manca il gesto. Confonderli farebbe cercare ad Alessio
 * un errore di ascolto che non c'e'.
 */
export function certezza(appunto) {
  if (appunto?.eseguibile === false) return "senza_destinazione";
  return appunto?.incerto ? "incerto" : "sicuro";
}

/**
 * PERCHE' QUESTO APPUNTO NON SI PUO' APPROVARE, con le parole di chi lo sa.
 *
 * 🔴 NASCE DA UN COLLAUDO A MANO (07/09/2026). Dettando una riga di lista
 * senza dire in quale delle due, la schermata rispondeva *«il gestionale
 * non sa ancora farlo»* — ed e' falso: le due liste il gestionale le sa
 * scrivere tutt'e due. Quello che manca non e' un gesto, e' un'informazione
 * che ha lui: **quale**.
 *
 * ⚠️ LA FRASE GIUSTA ESISTEVA GIA', e nessuno la vedeva: ogni elemento
 * porta il suo `motivo`, scritto dove il caso si conosce, e la schermata
 * mostrava al suo posto una frase fissa. *Un messaggio scritto bene in un
 * posto che nessuno legge e' un messaggio che non c'e'.*
 *
 * ⚠️ E VALE SOLO SE TUTTI GLI ELEMENTI DICONO LA STESSA COSA: un appunto
 * additivo puo' raccoglierne piu' d'uno, e mostrare il motivo del primo
 * come se fosse di tutti sarebbe una frase vera per una riga e falsa per
 * le altre. Se non concordano si torna alla frase generale, che almeno non
 * dice niente di sbagliato.
 */
export function perche(appunto) {
  const elementi = Array.isArray(appunto?.elementi) ? appunto.elementi : [];
  const motivi = [...new Set(elementi.map((e) => (e?.motivo ?? "").trim()).filter(Boolean))];
  if (motivi.length !== 1) return null;
  return elementi.every((e) => (e?.motivo ?? "").trim() === motivi[0]) ? motivi[0] : null;
}

/** Se questo appunto si puo' approvare adesso. */
export function siPuoApprovare(appunto) {
  return appunto?.eseguibile === true && Number(appunto?.quanti) > 0;
}

/**
 * GLI IMPEGNI CHE POTREBBERO ESSERE QUELLO DETTO, quando sono piu' d'uno.
 *
 * 🔴 NASCE DAL COLLAUDO COL TELEFONO (09/09/2026). Quando MEMO trova due
 * impegni ugualmente plausibili non ne sceglie nessuno — e fa bene, perche'
 * fra due candidati altrettanto buoni non esiste nessun criterio onesto per
 * preferirne uno. Ma la frase che compariva diceva soltanto «quale dei 2»,
 * e chi la leggeva doveva andare in Agenda a cercarli per sapere di quali
 * due si parlasse: cioe' rifare a mano il lavoro che il gestionale aveva
 * appena fatto.
 *
 * ⚠️ IL GIORNO C'E' SEMPRE, ed e' la meta' che serve: due impegni che si
 * chiamano quasi uguale si distinguono per QUANDO scadono, quasi mai per
 * come sono scritti. Un elenco di soli titoli somiglianti non aiuta a
 * scegliere — sarebbe la stessa domanda, scritta piu' lunga.
 *
 * ⚠️ E «senza scadenza» SI SCRIVE, non si lascia vuoto: un impegno senza
 * data e' una delle cose che lo distinguono dagli altri, e una riga muta si
 * legge «non l'ho guardato». E' la regola del vuoto che non e' zero, sulle
 * date.
 *
 * ⚠️ QUI NON SI DECIDE NIENTE: quali candidati siano, e quanti, l'ha gia'
 * deciso il database guardando l'Agenda. Questa funzione li mette in
 * italiano.
 */
export function candidatiDellElemento(elemento) {
  const grezzi = elemento?.dati?.impegni_possibili;
  if (!Array.isArray(grezzi)) return [];
  return grezzi
    .map((c) => ({
      titolo: typeof c?.titolo === "string" ? c.titolo.trim() : "",
      quando: c?.data ? formatDate(c.data) : null,
    }))
    .filter((c) => c.titolo !== "");
}

/**
 * L'IMPEGNO CHE ALESSIO HA SCELTO COL DITO, quando c'e' stata una scelta.
 *
 * 🔴 SOLO QUANDO C'E' STATA DAVVERO — 09/09/2026. Il segno `scelto_a_mano`
 * lo scrive il database nel momento in cui il dito tocca un candidato. Senza
 * quel segno, questa frase comparirebbe anche sul caso a candidato unico,
 * dove nessuno ha scelto niente: sarebbe una frase che dice il falso su come
 * si e' arrivati al dato, ed e' peggio di nessuna frase.
 *
 * ⚠️ Torna il TITOLO DI AGENDA, non le parole dette: e' quello che verrebbe
 * toccato approvando, ed e' l'unica cosa che chi firma deve poter leggere.
 */
export function impegnoScelto(elemento) {
  const d = elemento?.dati;
  if (!d || d.scelto_a_mano !== true) return null;
  const titolo = typeof d.titolo === "string" ? d.titolo.trim() : "";
  return titolo === "" ? null : titolo;
}

/**
 * I candidati si leggono uguali, e il gestionale lo DICHIARA.
 *
 * 🔴 E' il caso senza scampo: stesso nome, stesso giorno, e nessun altro
 * campo che li separi. Mostrare due righe gemelle e lasciar credere che si
 * stia scegliendo sarebbe far tirare a sorte credendo di decidere — la
 * forma di *«assenza di informazione scambiata per informazione»* che questo
 * progetto insegue dal 19/08.
 *
 * ⚠️ I pulsanti restano lo stesso: chi guarda puo' sapere lui quale sia. Cio'
 * che non si fa e' fingere che l'elenco basti.
 */
export function nonDistinguibili(elemento) {
  return elemento?.dati?.indistinguibili === true;
}
