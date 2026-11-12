// L'AVVISO DELLA COPIA DI SICUREZZA — 12/11/2026
//
// 🔴 PERCHE' ESISTE (revisione dell'11/11, punto 10): la copia della sera
//    la fa un'operazione pianificata di Windows, e quando non riusciva non
//    lo sapeva nessuno. Il 10/11 alle 21:30 non e' partita; e' partita la
//    mattina dopo alle 9:47, e se la password del database fosse cambiata
//    non sarebbe partita per giorni, in silenzio.
//
// Qui ci sono solo le parti che DECIDONO e che SCRIVONO l'avviso, senza
// rete e senza disco: si provano in tests/unita/avviso-copia.test.js. Chi
// le usa e' `backup-sera.mjs`, che lancia la copia e manda il messaggio.
//
// ⚠️ L'AVVISO VA SU TELEGRAM DIRETTAMENTE, con il token del bot e la chat
//    scritti in `.env` (TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID: gli stessi
//    valori dei Secrets della funzione online delle notifiche). Non passa
//    dal database apposta: uno dei guasti da segnalare e' proprio «il
//    database non risponde» o «la sua password e' cambiata».

/** Dopo quante ore senza una copia completa si avvisa (due giorni). */
export const ORE_AVVISO_COPIA = 48;

/**
 * Il limite scritto in `.env` (BACKUP_AVVISO_ORE), oppure due giorni.
 * ⚠️ Un valore che non e' un numero positivo NON diventa «avvisa sempre»
 *    (con NaN ogni confronto e' falso): si torna ai due giorni.
 */
export function oreAvviso(scritto) {
  const n = Number(scritto);
  return String(scritto ?? "").trim() !== "" && Number.isFinite(n) && n > 0 ? n : ORE_AVVISO_COPIA;
}

/** Ogni quanto si puo' ripetere lo stesso avviso «copia vecchia» (non a ogni accesso). */
export const ORE_TRA_DUE_AVVISI = 12;

/**
 * Si avvisa di nuovo? Si', se non si e' mai avvisato, se l'ultima volta
 * e' illeggibile o «nel futuro», o se sono passate abbastanza ore.
 *
 * @param {Date|null} ultimoAvviso
 * @param {Date} adesso
 */
export function daRipetere(ultimoAvviso, adesso, ore = ORE_TRA_DUE_AVVISI) {
  if (!(ultimoAvviso instanceof Date) || Number.isNaN(ultimoAvviso.getTime())) return true;
  const passate = (adesso.getTime() - ultimoAvviso.getTime()) / 3_600_000;
  return passate < 0 || passate >= ore;
}

const INTESTAZIONE = "💾 COPIA DI SICUREZZA";

/** Quanto e' vecchia una copia, detto a parole: «5 ore», «2 giorni e 3 ore». */
export function etaAParole(ore) {
  const h = Math.max(0, Math.floor(ore));
  if (h < 24) return h === 1 ? "1 ora" : `${h} ore`;
  const g = Math.floor(h / 24);
  const resto = h % 24;
  const giorni = g === 1 ? "1 giorno" : `${g} giorni`;
  if (!resto) return giorni;
  return `${giorni} e ${resto === 1 ? "1 ora" : `${resto} ore`}`;
}

/** Cosa dire dell'ultima copia buona, in una riga. */
function rigaUltima(ultima, adesso) {
  if (!ultima) return "Sul PC non c'e' nessuna copia completa.";
  const ore = (adesso.getTime() - ultima.quando.getTime()) / 3_600_000;
  return `L'ultima copia completa e' ${ultima.nome} (${etaAParole(ore)} fa).`;
}

/**
 * Le ultime righe dell'uscita del backup, quelle che dicono cosa non va.
 *
 * 🔴 SENZA INDIRIZZI DEL DATABASE: un errore di collegamento puo' ripetere
 *    la stringa di connessione, che contiene la password. Su Telegram non
 *    ci va: al suo posto «[indirizzo del database]».
 */
export function ultimeRighe(uscita, quante = 8, segreti = []) {
  let testo = String(uscita ?? "");
  // Prima i valori esatti di `.env` (chiavi, password, token): qualunque
  // forma abbiano, non escono.
  for (const s of segreti) {
    if (typeof s === "string" && s.length >= 6) testo = testo.split(s).join("[nascosto]");
  }
  return testo
    .replace(/postgres(?:ql)?:\/\/\S+/gi, "[indirizzo del database]")
    .replace(/(password|passwd|service_role|apikey|secret|token)\s*[=:]\s*("[^"]*"|'[^']*'|\S+)/gi, "$1=[nascosto]")
    .replace(/\beyJ[\w-]+\.[\w-]+\.[\w-]+/g, "[nascosto]")
    .replace(/\bsb_(secret|publishable)_\S+/g, "[nascosto]")
    .replace(/\bBearer\s+\S+/gi, "Bearer [nascosto]")
    .replace(/\b\d{6,}:[\w-]{30,}/g, "[nascosto]")
    // Il nome utente del database porta il codice del progetto.
    .replace(/\bpostgres\.[a-z0-9]{10,}/gi, "postgres.[progetto]")
    .split(/\r?\n/)
    .map((r) => r.trim())
    .filter(Boolean)
    .slice(-quante)
    .join("\n")
    .slice(-1500);
}

/**
 * Il messaggio quando la copia della sera NON e' riuscita.
 *
 * ⚠️ Se la copia di stasera ha il timbro (`fattaOra`) i dati e i documenti
 *    ci sono e sono controllati: e' mancato solo lo zip. Dirlo «NON
 *    riuscita» accanto a «l'ultima copia completa e' di 0 ore fa» sarebbe
 *    un messaggio che si contraddice.
 *
 * @param {{uscita?: string, ultima: {nome: string, quando: Date}|null, adesso: Date, fattaOra?: boolean, segreti?: string[]}} dati
 * @returns {string}
 */
export function avvisoCopiaFallita({ uscita = "", ultima, adesso, fattaOra = false, segreti = [] }) {
  const righe = ultimeRighe(uscita, 8, segreti);
  if (fattaOra) {
    return [
      INTESTAZIONE,
      "",
      `La copia di stasera (${ultima?.nome ?? "?"}) e' fatta e controllata, ma senza lo zip.`,
      "Per portarla fuori serve la CARTELLA intera, oppure rifai: npm run backup",
      "",
      righe ? `Cosa ha detto:\n${righe}` : "",
    ].join("\n").trim();
  }
  return [
    INTESTAZIONE,
    "",
    "La copia di stasera NON e' riuscita.",
    rigaUltima(ultima, adesso),
    "",
    righe ? `Cosa ha detto:\n${righe}` : "Non ha detto niente: forse non e' nemmeno partita.",
    "",
    "Sul PC: npm run backup, e guarda l'errore.",
  ].join("\n");
}

/**
 * Il messaggio quando l'ultima copia completa e' troppo vecchia; null se va bene.
 *
 * ⚠️ «Nessuna copia» e «copia vecchia» sono due frasi diverse, come nel
 *    freno delle migrazioni: mandano a guardare in due posti diversi.
 *
 * @param {{nome: string, quando: Date}|null} ultima
 * @param {Date} adesso
 * @param {number} [oreMassime]
 * @returns {string|null}
 */
export function avvisoCopiaVecchia(ultima, adesso, oreMassime = ORE_AVVISO_COPIA) {
  if (ultima) {
    const ore = (adesso.getTime() - ultima.quando.getTime()) / 3_600_000;
    // Una copia «del futuro» (orologio spostato) non e' una copia fresca:
    // si avvisa invece di far finta di sapere.
    if (ore >= 0 && ore <= oreMassime) return null;
    if (ore < 0) {
      return [
        INTESTAZIONE,
        "",
        `L'ultima copia (${ultima.nome}) risulta fatta nel futuro: l'orologio del PC non torna.`,
        "Controlla data e ora del PC, poi: npm run backup",
      ].join("\n");
    }
  }
  return [
    INTESTAZIONE,
    "",
    `Da piu' di ${etaAParole(oreMassime)} non c'e' una copia nuova.`,
    rigaUltima(ultima, adesso),
    "",
    "Il PC era spento, o la copia della sera non parte. Sul PC: npm run backup",
  ].join("\n");
}

/**
 * Manda un messaggio su Telegram. Non lancia mai: restituisce l'esito.
 *
 * @param {{token?: string, chatId?: string, testo: string, fetch?: typeof fetch}} dati
 * @returns {Promise<{ok: boolean, dettaglio: string}>}
 */
export async function mandaTelegram({ token, chatId, testo, fetch: chiama = globalThis.fetch }) {
  if (!token || !chatId) {
    return { ok: false, dettaglio: "mancano TELEGRAM_BOT_TOKEN o TELEGRAM_CHAT_ID in .env (docs/BACKUP.md)" };
  }
  try {
    const r = await chiama(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text: testo.slice(0, 4000) }),
      // Con la rete a meta' l'operazione pianificata non deve restare appesa.
      signal: AbortSignal.timeout(15_000),
    });
    if (r.ok) return { ok: true, dettaglio: "mandato" };
    // ⚠️ Il dettaglio di Telegram si dice, ma senza il token, che sta nell'indirizzo.
    return { ok: false, dettaglio: `Telegram ha risposto ${r.status}` };
  } catch (e) {
    const perche = String(e?.code ?? e?.message ?? "errore sconosciuto").split(token).join("[token]");
    return { ok: false, dettaglio: `Telegram non raggiungibile (${perche})` };
  }
}
