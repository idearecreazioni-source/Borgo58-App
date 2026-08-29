import { TASK_CATEGORIES, formatDate, labelFor } from "../constants";

// COME SI LEGGE L'AGENDA — 30/08/2026, Blocco 3 del mandato.
//
// 🔴 IL DIFETTO, dalla schermata di Alessio: **16 impegni, 14 in ritardo**.
// Il testo andava a capo cinque volte per riga («BASE-Portare i
// corrispettivi di luglio a Laura» occupava sei righe in una colonna larga
// un terzo dello schermo, con spazio vuoto a destra), «rimanda» stava in
// tre posizioni diverse a seconda della riga, e le stelle — due grigie e
// una gialla — non dicevano cosa volessero dire.
//
// ⚠️ E NON È UN PROBLEMA DI OGGI: con quattordici scaduti l'elenco è già
// illeggibile, e a marzo sarà peggio. È la stessa trappola dello
// scadenziario — *un elenco che dice tutto non dice niente*.

/**
 * LE SEZIONI, nell'ordine in cui si leggono.
 *
 * 🔴 LE STELLATE VANNO IN TESTA, ed è la decisione di Alessio che dà un
 * senso alla stella: non è un'etichetta «importante sì/no» — è
 * **l'ordinamento**. Una stella che colora e basta è un gesto che non
 * cambia niente, e infatti nessuno sapeva cosa volesse dire.
 *
 * ⚠️ UNA RIGA STELLATA ESCE DALLA SUA CORSIA, non compare in tutt'e due.
 * Una riga che sta in due elenchi fa credere di averla sistemata anche dove
 * non si è guardato — la stessa ragione per cui una selezione di finger non
 * compare più fra i piatti.
 *
 * ⚠️ «In ritardo» e «Più avanti» si CHIUDONO, le altre no. Il criterio non
 * è la lunghezza: è che quelle due sono le uniche in cui *stare dentro
 * l'elenco non è una notizia*. Quattordici scadute non si leggono una per
 * una — si guarda il numero, e si apre quando si ha tempo. Quello che va
 * fatto adesso è già in cima, perché lui ci ha messo la stella.
 */
export const SEZIONI = [
  {
    key: "per_me_conta",
    titolo: "Per me conta",
    // Non si chiude: è la ragione per cui esiste la stella.
    // ⚠️ E sparisce quando è vuota, come «in ritardo»: un titoletto vuoto
    // in cima ogni giorno è rumore che si impara a saltare.
    nascondiSeVuota: true,
    forte: true,
  },
  { key: "in_ritardo", titolo: "In ritardo", nascondiSeVuota: true, chiudibile: true, chiusaDiSuo: true, allarme: true },
  { key: "questa_settimana", titolo: "Questa settimana", perGiorno: true },
  { key: "piu_avanti", titolo: "Più avanti", chiudibile: true, chiusaDiSuo: true, perMese: true },
  { key: "quando_capita", titolo: "Quando capita" },
];

/**
 * Da quale sezione entra una riga. Una sola risposta per riga.
 */
export const sezioneDi = (t) => (t.preferito ? "per_me_conta" : t.corsia);

/**
 * Le righe di ogni sezione, contate una volta sola.
 * ⚠️ Restituisce anche le sezioni vuote: chi disegna decide se nasconderle,
 * e il conteggio dev'essere sempre disponibile.
 */
export function sezioniDellAgenda(righe) {
  const per = Object.fromEntries(SEZIONI.map((s) => [s.key, []]));
  (righe ?? []).forEach((t) => {
    const k = sezioneDi(t);
    (per[k] ?? per.quando_capita).push(t);
  });
  return SEZIONI.map((s) => ({ ...s, righe: per[s.key] }));
}

/**
 * QUANTI IMPEGNI CHIEDONO ATTENZIONE ADESSO — il numero accanto al titolo.
 *
 * ⚠️ Conta SOLO ritardo e oggi, e «quando capita» non ci entra mai: un
 * numero fermo su venti smette di essere un'informazione e si impara a
 * ignorarlo. La regola c'era già; qui si sposta accanto alle altre perché
 * viveva dentro la schermata, cioè in un posto dove nessuna prova la
 * guardava.
 * ⚠️ E una riga stellata continua a contare: la stella cambia dove si
 * legge, non se è in ritardo.
 */
export const daFareAdesso = (righe) =>
  (righe ?? []).filter((t) => t.corsia === "in_ritardo" || t.giorni_alla_scadenza === 0).length;

/**
 * I CAMPI DI UN IMPEGNO NEL QUADROTTO, scritti una volta sola.
 *
 * ⚠️ Il titolo NON è fra i campi: è il titolo del quadrotto, si legge da
 * lontano e non ha etichetta. È la stessa forma di `campiRicetta` e
 * `campiPrenotazione`.
 *
 * ⚠️ E L'IMPORTO NON È UN CAMPO PERCHÉ NON È UNA COLONNA: in questo
 * gestionale un impegno non ha un importo suo — quando c'è, sta **dentro il
 * titolo**, come nell'impegno nato da una fattura archiviata («Pagare
 * fattura #2026/003 — Ittica dello Stretto (2.268,93 €)»). Aggiungere una
 * colonna vuota su tutte le righe tranne quelle sarebbe una riga in meno di
 * quelle che servono.
 */
export function campiImpegno(t) {
  if (!t) return [];
  return [
    {
      chiave: "scadenza",
      etichetta: "Scadenza",
      valore: t.due_date ? formatDate(t.due_date) : "",
      vuoto: "quando capita",
      forte: t.corsia === "in_ritardo",
    },
    {
      chiave: "categoria",
      etichetta: "Tipo",
      valore: labelFor(TASK_CATEGORIES, t.category),
    },
    {
      chiave: "da",
      etichetta: "Da",
      valore: t.origine_modulo === "posta" ? "Posta" : t.origine_modulo ? "Archivio documenti" : "",
      vuoto: "scritto a mano",
    },
    // ⚠️ L'anzianità è ciò che impedisce a «quando capita» di diventare un
    // cimitero: senza, una voce ferma da tre mesi sembra scritta ieri.
    // Compare solo dove serve — su una riga con la scadenza il dato c'è già.
    ...(!t.due_date && t.giorni_in_lista > 13
      ? [{ chiave: "eta", etichetta: "In lista da", valore: anzianita(t.giorni_in_lista) }]
      : []),
  ];
}

function anzianita(giorni) {
  const mesi = Math.round(giorni / 30);
  if (mesi >= 1) return `${mesi} mes${mesi === 1 ? "e" : "i"}`;
  return `${giorni} giorni`;
}
