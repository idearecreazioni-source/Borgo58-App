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
const DI_SERVIZIO = new Set(["nome_sentito", "sentito", "lista"]);

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
    pezzi.push(`${chiave.replaceAll("_", " ")}: ${v}`);
  }
  return pezzi.join(" · ");
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
