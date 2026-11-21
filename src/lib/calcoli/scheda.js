// =====================================================================
// LA SCHEDA DI BORGO 58 — le regole pure della pagina (21/11/2026, pezzo S3)
// =====================================================================
// La Scheda sono gli appunti brevi di Alessio sul locale che MEMO può usare
// (fornitori, abitudini, decisioni già prese). Vive nel database di work; la
// pagina `/memo/scheda` serve a rileggerla e correggerla.
//
// ⚠️ I LIMITI NON SI FANNO RISPETTARE QUI: li fa rispettare il database
//    (60 voci attive, 10.000 caratteri di testo composto, 300 per voce). Qui
//    si mostrano e si traducono i suoi rifiuti in parole semplici. Un limite
//    scritto solo nella pagina si aggira da un'altra strada.
// ⚠️ NIENTE SI CANCELLA: una voce si SPEGNE e si può riaccendere. Lo storico
//    di cosa è cambiato resta sempre.
// ⚠️ LE PAROLE DELICATE (debiti, salute, cause…) AVVISANO, NON BLOCCANO: la
//    decisione di scrivere resta di Alessio.

export const VOCI_MASSIME = 60;
export const CARATTERI_MASSIMI = 10000;
export const TESTO_MASSIMO = 300;

// Nello stesso ordine in cui il database compone il testo per MEMO.
export const SEZIONI = [
  { valore: "titolare", etichetta: "Il titolare", aiuto: "Chi è Alessio e come preferisce lavorare." },
  { valore: "societa", etichetta: "La società", aiuto: "Le società, come sono divise le cose." },
  { valore: "locale", etichetta: "Il locale", aiuto: "Com'è fatto Borgo 58 e come funziona." },
  { valore: "concept", etichetta: "Il concept", aiuto: "L'idea del ristorante, la cucina, lo stile." },
  { valore: "fornitori", etichetta: "I fornitori", aiuto: "Chi consegna cosa, quando e come si ordina." },
  { valore: "consulenti", etichetta: "I consulenti", aiuto: "Commercialista, tecnici e chi aiuta Alessio." },
  { valore: "decisioni", etichetta: "Le decisioni già prese", aiuto: "Cose decise: MEMO non deve riproporle." },
  { valore: "come_rispondere", etichetta: "Come deve rispondere MEMO", aiuto: "Il modo in cui Alessio vuole le risposte." },
];

export const FONTI = [
  { valore: "documentato", etichetta: "Documentato", aiuto: "C'è un documento che lo dice." },
  { valore: "confermato", etichetta: "Confermato da te", aiuto: "L'hai verificato tu." },
  { valore: "riferito", etichetta: "Riferito", aiuto: "Te l'hanno detto, non l'hai verificato." },
  { valore: "da_verificare", etichetta: "Da verificare", aiuto: "Non sei sicuro: MEMO lo dirà." },
];

export const etichettaSezione = (valore) => SEZIONI.find((s) => s.valore === valore)?.etichetta ?? valore;
export const etichettaFonte = (valore) => FONTI.find((f) => f.valore === valore)?.etichetta ?? valore;

/** «[S12]»: il numero stabile con cui MEMO cita una voce. */
export const riferimentoVoce = (voce) => `[S${voce.numero}]`;

/** Quanto resta del testo di una voce. `oltre` = quanti caratteri sono di troppo. */
export function contatoreTesto(testo) {
  const n = String(testo ?? "").length;
  return { scritti: n, restanti: Math.max(0, TESTO_MASSIMO - n), oltre: Math.max(0, n - TESTO_MASSIMO) };
}

/** Le voci attive per sezione, nell'ordine della Scheda; le spente stanno a parte. */
export function raggruppaVoci(voci) {
  const ordina = (a, b) => (a.ordine ?? 0) - (b.ordine ?? 0) || a.numero - b.numero;
  const attive = (voci ?? []).filter((v) => v.attiva);
  const spente = (voci ?? []).filter((v) => !v.attiva).sort((a, b) => a.numero - b.numero);
  const sezioni = SEZIONI.map((s) => ({ ...s, voci: attive.filter((v) => v.sezione === s.valore).sort(ordina) }));
  return { sezioni, spente };
}

/** Il prossimo `ordine` per una voce nuova: in fondo alla sua sezione. */
export function ordineInFondo(voci, sezione) {
  const dellaSezione = (voci ?? []).filter((v) => v.sezione === sezione);
  return dellaSezione.reduce((massimo, v) => Math.max(massimo, v.ordine ?? 0), 0) + 10;
}

/** Una chiave interna stabile, che Alessio non deve mai scrivere né vedere. */
export function chiaveNuova(sezione, testo, casuale = Math.random()) {
  const parole = String(testo ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40)
    .replace(/-+$/g, "");
  const coda = Math.floor(casuale * 36 ** 4).toString(36).padStart(4, "0");
  return `${sezione}:${parole || "voce"}-${coda}`;
}

/** Il giorno da rivedere è già passato? (`oggi` è «AAAA-MM-GG»). */
export function daRivedere(voce, oggi) {
  return Boolean(voce?.attiva && voce?.rivedere_entro && voce.rivedere_entro < oggi);
}

export const dataItaliana = (iso) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso ?? ""));
  return m ? `${m[3]}/${m[2]}/${m[1]}` : "";
};

/** Il riquadro dei limiti: voci attive e caratteri, con quanto manca e se è quasi pieno. */
export function riquadroLimiti(contatori) {
  if (!contatori) return null;
  const voci = Number(contatori.voci) || 0;
  const caratteri = Number(contatori.caratteri) || 0;
  const quasiPiena = voci >= VOCI_MASSIME * 0.9 || caratteri >= CARATTERI_MASSIMI * 0.9;
  return {
    voci,
    caratteri,
    vociMassime: VOCI_MASSIME,
    caratteriMassimi: CARATTERI_MASSIMI,
    quasiPiena,
    frase: quasiPiena
      ? "La Scheda è quasi piena: spegni le voci che non servono più prima di aggiungerne altre."
      : null,
  };
}

/**
 * Il rifiuto del database, in parole semplici.
 *
 * ⚠️ I messaggi che il database scrive da sé sono già in italiano e si
 * mostrano com'erano: tradurli qui sarebbe una seconda copia che diverge.
 * Si traducono solo quelli che arrivano come errori tecnici (vincoli).
 */
export function messaggioDelDatabase(errore) {
  const testo = String(errore?.message ?? "");
  const tutto = `${testo} ${errore?.details ?? ""}`;
  if (/scheda_voci_chiave_attiva_unica/.test(tutto)) {
    return "C'è già una voce attiva uguale a questa. Modifica quella, oppure spegnila prima.";
  }
  if (/scheda_voce_testo_corto/.test(tutto)) return `Il testo di una voce può avere al massimo ${TESTO_MASSIMO} caratteri.`;
  if (/scheda_voce_testo_presente/.test(tutto)) return "Scrivi il testo della voce: non può restare vuoto.";
  if (/scheda_voce_sezione_nota/.test(tutto)) return "Quella sezione non esiste nella Scheda.";
  if (/scheda_voce_fonte_nota/.test(tutto)) return "Scegli una delle fonti dell'elenco.";
  if (/row-level security|permission denied|insufficient_privilege/i.test(tutto)) {
    return "Solo il titolare può modificare la Scheda.";
  }
  // Un messaggio che il database ha scritto per noi, in italiano.
  if (/La Scheda|Il testo composto|Spegni la voce|Lo storico|Solo il titolare/.test(testo)) return testo;
  return "Non è stato salvato. Riprova tra un momento.";
}

/** Le parole delicate trovate, in una frase che avvisa senza vietare. */
export function avvisoParoleDelicate(parole) {
  const elenco = (parole ?? []).filter(Boolean);
  if (!elenco.length) return null;
  const lista = elenco.length === 1 ? elenco[0] : `${elenco.slice(0, -1).join(", ")} e ${elenco[elenco.length - 1]}`;
  return `Qui compaiono parole delicate (${lista}). Puoi salvare lo stesso, ma MEMO le leggerà a ogni domanda: se non serve, meglio non scriverle.`;
}

/** Una riga dello storico, in parole: cosa è cambiato in una voce. */
export function frasiDelloStorico(riga) {
  const frasi = [];
  if (riga.testo_prima == null && riga.testo_dopo != null) frasi.push("Voce creata.");
  else if (riga.testo_prima !== riga.testo_dopo) frasi.push("Testo cambiato.");
  if (riga.fonte_prima != null && riga.fonte_prima !== riga.fonte_dopo) {
    frasi.push(`Fonte: da «${etichettaFonte(riga.fonte_prima)}» a «${etichettaFonte(riga.fonte_dopo)}».`);
  }
  if (riga.attiva_prima != null && riga.attiva_prima !== riga.attiva_dopo) {
    frasi.push(riga.attiva_dopo ? "Riaccesa." : "Spenta.");
  }
  if (riga.sezione_prima != null && riga.sezione_prima !== riga.sezione_dopo) {
    frasi.push(`Sezione: da «${etichettaSezione(riga.sezione_prima)}» a «${etichettaSezione(riga.sezione_dopo)}».`);
  }
  return frasi.length ? frasi : ["Modificata."];
}
