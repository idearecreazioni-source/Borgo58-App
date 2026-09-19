// =====================================================================
// TELEGRAM «TEST PROVA» — UNA CONSEGNA MANUALE, SOLO SU BORGO58-PROVA
// =====================================================================
// ⚠️ QUESTA FUNZIONE NON PARTE DA SOLA. Nessun trigger, lavoro pianificato o
//    funzione del database la chiama: si avvia soltanto con una richiesta
//    manuale che porta la chiave di attivazione della prova.
//
// 🔴 PROTEZIONE LIMITATA, PER SCELTA DELL'UTENTE: durante i test usa lo stesso
//    bot e lo stesso canale personale della produzione. Per questo il testo e'
//    FISSO (comincia con «TEST PROVA», non viene mai dal chiamante) e la
//    funzione rifiuta di girare fuori da Prova. La chiave del bot va ruotata
//    finita la prova.
//
// 🔴 UNA VOLTA SOLA. La memoria e' quella gia' esistente delle consegne
//    (`consegne_telegram`, `prendi_consegna`/`conferma_consegna`/
//    `rilascia_consegna`): la presa e' una scrittura con chiave primaria, quindi
//    per la stessa chiave `manda()` puo' essere chiamata una volta sola. Nessuna
//    migrazione. ⚠️ LIMITE: se Telegram accetta e la conferma non si scrive, o
//    la chiamata si interrompe, la chiave resta «presa» e la prova NON si
//    ripete da sola — si preferisce un invio mancante a uno doppio.

export const REF_PROVA = "bnwqgpuyzmzujxfbtyvs";
export const CHIAVE_DELLA_PROVA = "telegram-prova-test-013";
export const MESSAGGIO_DI_PROVA =
  "TEST PROVA — messaggio di prova del gestionale Borgo58, inviato a mano dal progetto di Prova. Nessuna azione richiesta.";
export const INTESTAZIONE_CHIAVE = "x-borgo58-prova";

export type Risposta = { stato: number; corpo: Record<string, unknown> };
type EsitoPresa = "manda" | "gia_consegnata" | "in_corso" | "ignota";

/** Il progetto in cui gira e' Prova? Si guarda l'ambiente, mai il chiamante. */
export function siamoSuProva(supabaseUrl: string | undefined | null): boolean {
  try {
    return new URL(String(supabaseUrl ?? "")).hostname === `${REF_PROVA}.supabase.co`;
  } catch {
    return false;
  }
}

/** Confronto a tempo costante; un valore vuoto non coincide mai con niente. */
export function chiaveGiusta(attesa: string | undefined | null, ricevuta: string | null | undefined): boolean {
  const a = new TextEncoder().encode(String(attesa ?? ""));
  const b = new TextEncoder().encode(String(ricevuta ?? ""));
  if (a.length === 0 || b.length === 0) return false;
  let diff = a.length ^ b.length;
  for (let i = 0; i < Math.max(a.length, b.length); i++) diff |= (a[i] ?? 0) ^ (b[i] ?? 0);
  return diff === 0;
}

export async function eseguiLaProva(opz: {
  metodo: string;
  supabaseUrl: string | undefined;
  chiaveAttesa: string | undefined;
  chiaveRicevuta: string | null | undefined;
  botPresente: boolean;
  memoriaPresente: boolean;
  prendi: (chiave: string) => Promise<EsitoPresa>;
  conferma: (chiave: string) => Promise<void>;
  rilascia: (chiave: string) => Promise<void>;
  manda: (testo: string) => Promise<{ riuscito: boolean; dettaglio?: string }>;
}): Promise<Risposta> {
  const no = (stato: number, error: string): Risposta => ({ stato, corpo: { ok: false, error } });

  if (opz.metodo !== "POST") return no(405, "Solo POST");
  if (!siamoSuProva(opz.supabaseUrl)) return no(403, "Questa funzione gira solo su Borgo58-Prova");
  if (!chiaveGiusta(opz.chiaveAttesa, opz.chiaveRicevuta)) return no(401, "Chiamante non riconosciuto");
  if (!opz.botPresente) return no(500, "Bot Telegram non configurato");
  if (!opz.memoriaPresente) return no(500, "Senza la memoria delle consegne non si manda");

  const presa = await opz.prendi(CHIAVE_DELLA_PROVA);
  if (presa === "gia_consegnata") return { stato: 200, corpo: { ok: true, gia_consegnato: true } };
  if (presa !== "manda") return { stato: 409, corpo: { ok: false, esito: presa === "in_corso" ? "in_corso" : "ignoto" } };

  let esito: { riuscito: boolean; dettaglio?: string };
  try {
    esito = await opz.manda(MESSAGGIO_DI_PROVA);
  } catch {
    return { stato: 502, corpo: { ok: false, esito: "ignoto", error: "Invio interrotto a meta'" } };
  }
  if (!esito.riuscito) {
    await opz.rilascia(CHIAVE_DELLA_PROVA);
    return no(502, "Invio Telegram fallito");
  }
  await opz.conferma(CHIAVE_DELLA_PROVA);
  return { stato: 200, corpo: { ok: true } };
}
