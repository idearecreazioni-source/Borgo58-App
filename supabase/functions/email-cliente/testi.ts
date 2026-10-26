// =====================================================================
// I TESTI DELLE EMAIL AI CLIENTI — la parte pura di `email-cliente`
// 26/10/2026
// =====================================================================
// Separata da `index.ts` per poterla provare senza rete né chiavi
// (`tests/unita/email-cliente-testi.test.js`), come `ricetta-da-link/lettura.ts`.
//
// 🔴 OGNI VALORE CHE ENTRA NELL'HTML PASSA DA `esc()`. Il nome della
//    conferma arriva dal modulo pubblico di prenotazione, che chiunque può
//    compilare: scritto così com'è dentro l'HTML, un «nome» come
//    `<a href="…">clicca qui</a>` diventava un link vero, in una mail che
//    parte dal dominio del locale. Il testo semplice (`testo`) non ha
//    questo problema e resta com'è.
// =====================================================================

export type Prenotazione = {
  id?: string;
  nome?: string;
  email?: string;
  data?: string;
  ora?: string;
  coperti?: number;
};

/** Il testo diventa testo anche dentro l'HTML: niente tag, niente attributi. */
export function esc(valore: unknown): string {
  return String(valore ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** 2027-03-15 → 15/03/2027. Il formato americano confonde chi legge in fretta. */
export function dataItaliana(iso: string): string {
  const [anno, mese, giorno] = iso.split("-");
  return `${giorno}/${mese}/${anno}`;
}

export function euro(n: number): string {
  return new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" }).format(n ?? 0);
}

export function testoConferma(p: Prenotazione): { oggetto: string; testo: string; html: string } {
  const data = p.data ? dataItaliana(p.data) : "";
  const ora = (p.ora ?? "").slice(0, 5);
  const coperti = p.coperti ?? 0;
  const nome = p.nome ?? "";

  const oggetto = `Prenotazione confermata — ${data} alle ${ora}`;

  const righe = [
    `Gentile ${nome},`,
    "",
    "la sua prenotazione è confermata.",
    "",
    `Quando: ${data} alle ${ora}`,
    `Persone: ${coperti}`,
    "",
    "Se qualcosa cambia — anche solo il numero di persone — risponda a",
    "questa email: ci permette di liberare il tavolo per qualcun altro.",
    "",
    "A presto,",
    "Borgo 58 — Osteria Contemporanea",
  ];

  const html = `<div style="font-family: Georgia, serif; font-size: 16px; line-height: 1.6; color: #2b2b2b;">
  <p>Gentile ${esc(nome)},</p>
  <p><strong>la sua prenotazione è confermata.</strong></p>
  <p style="background:#f6f3ee; padding:16px; border-radius:8px;">
    <strong>Quando:</strong> ${esc(data)} alle ${esc(ora)}<br>
    <strong>Persone:</strong> ${esc(coperti)}
  </p>
  <p>Se qualcosa cambia — anche solo il numero di persone — risponda a questa
  email: ci permette di liberare il tavolo per qualcun altro.</p>
  <p>A presto,<br><em>Borgo 58 — Osteria Contemporanea</em></p>
</div>`;

  return { oggetto, testo: righe.join("\n"), html };
}

// IL FOGLIO DEL PREVENTIVO (20/08/2026, blocco 3 del mandato).
//
// 🔴 IL CONTENUTO ARRIVA GIÀ COMPOSTO DAL DATABASE (`foglio_preventivo`), e
// qui si impagina soltanto. Non si legge niente dal database e non si
// aggiunge nessun numero: **il foglio viaggia**, finisce nella posta del
// cliente e magari lo gira a qualcun altro, e comporlo in due posti sarebbe
// due occasioni di lasciarci dentro un costo.
export function testoPreventivo(v: Record<string, unknown>) {
  const persone = Number(v.persone ?? 0);
  const menu = (v.menu as { nome: string }[] ?? []).map((r) => `· ${r.nome}`).join("\n");
  const extra = (v.extra as { descrizione: string; importo: number }[] ?? [])
    .map((r) => `· ${r.descrizione} — ${euro(r.importo)}`)
    .join("\n");
  const data = v.data_evento ? dataItaliana(String(v.data_evento)) : "";
  const scadenza = v.valido_fino_al ? dataItaliana(String(v.valido_fino_al)) : "";

  const oggetto = `Borgo 58 — preventivo per il ${data}`;
  const testo = [
    `Gentile ${v.cliente ?? ""},`,
    "",
    `ecco il preventivo per il ${data}, per ${persone} ${persone === 1 ? "persona" : "persone"}.`,
    "",
    menu ? "IL MENU\n" + menu : "",
    extra ? "\nIN PIÙ\n" + extra : "",
    "",
    `Prezzo a persona: ${euro(Number(v.prezzo_a_persona))}`,
    `Totale: ${euro(Number(v.totale))}`,
    "",
    // ⚠️ La scadenza è la riga che impedisce a questo foglio di restare
    // valido per sempre in mano a chi lo riceve.
    `Questo preventivo è valido fino al ${scadenza}.`,
    "",
    "A presto,",
    "Borgo 58 — Osteria Contemporanea",
  ]
    .filter((r) => r !== "")
    .join("\n");

  // ⚠️ L'HTML si ricava dal testo riga per riga: il cliente, i piatti e le
  // voci in più ci entrano come testo, mai come markup.
  const html = testo
    .split("\n")
    .map((r) => `<p style="margin:0 0 8px">${esc(r) || "&nbsp;"}</p>`)
    .join("");

  return { oggetto, testo, html };
}
