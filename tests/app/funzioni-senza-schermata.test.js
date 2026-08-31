import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { clientAutenticato, credenziali } from "./aiuto";

const titolare = await clientAutenticato(credenziali().titolare);

// 🔴 COSTRUITO E SENZA UNA PORTA — 31/08/2026
//
// PERCHE' ESISTE, e non e' una precauzione teorica: e' una famiglia che
// questo progetto ha incontrato **quattro volte in due giorni**.
//   · 13/08 — la soglia di magazzino esisteva e nessuna schermata la
//     scriveva: la lista della spesa non poteva riempirsi, e sembrava che
//     funzionasse;
//   · 31/08 notte — `speso_dalla_tasca()` esisteva, era chiusa col portiere
//     giusto, ed **era chiamata da nessuno**: la Prima nota mostrava un saldo
//     negativo, cioe' proprio la cosa che quella funzione doveva evitare;
//   · 31/08 notte — `mondi_del_magazzino()` e la migrazione dei sette mondi:
//     provate, applicate, e **il Magazzino restava a due mondi**;
//   · 31/08 notte — `carta_da_ristampare()` e `segna_carta_stampata()`:
//     costruite e dichiarate «senza schermata» in un riepilogo, cioe' un
//     debito scritto invece che un difetto trovato.
//
// 🔴 E LA COSA CHE CONTA: le prime tre le ha trovate **Alessio con gli
// occhi**, non io rileggendo. Tre volte non e' distrazione — e' che il
// metodo di verifica non aveva un modo di accorgersene. *Questo file e'
// quel modo.*
//
// ---------------------------------------------------------------------
// COME FUNZIONA
// ---------------------------------------------------------------------
// Una funzione del database e' **raggiungibile** se almeno una di queste e'
// vera:
//   1. la chiama un'altra funzione del database (e' un pezzo interno);
//   2. la usa un trigger;
//   3. il suo nome compare in `src/` — cioe' una schermata ci arriva.
// Quelle che non soddisfano nessuna delle tre sono **orfane**: esistono,
// costano manutenzione, e nessuno le puo' usare.
//
// ⚠️ NON TUTTE LE ORFANE SONO UN DIFETTO, e per questo l'elenco di partenza
// e' **congelato** invece che preteso vuoto: ce ne sono che vivono nelle
// funzioni online, nelle reti di prova o negli script, e sono legittime.
// Come per i vincoli muti (25/08): si congela quello che c'e' e si sorveglia
// che **non cresca**. Un controllo che grida su 26 righe legittime verrebbe
// spento al secondo giorno.
//
// ⚠️ IL LIMITE, DICHIARATO. Questa rete guarda se il **nome** compare in
// `src/`, non se una schermata la chiami davvero: un wrapper in
// `src/lib/api/` che nessuna pagina importa la fa risultare raggiungibile.
// E' un **pavimento**, non un censimento — e il pavimento prende comunque il
// caso che si e' presentato quattro volte, che e' *la funzione che non
// compare da nessuna parte*.

const CARTELLE = [
  ["src", /\.(jsx?|ts)$/],
  ["supabase/functions", /\.ts$/],
  ["tests", /\.js$/],
  ["scripts", /\.mjs$/],
];

function testoDi(dir, filtro) {
  let out = "";
  const cammina = (d) => {
    for (const e of readdirSync(d)) {
      const f = path.join(d, e);
      if (statSync(f).isDirectory()) cammina(f);
      else if (filtro.test(e)) out += readFileSync(f, "utf8") + "\n";
    }
  };
  try { cammina(dir); } catch { /* una cartella che non c'e' non e' un difetto */ }
  return out;
}

const nomina = (nome, testo) => new RegExp(`\\b${nome}\\b`).test(testo);

// 🔴 LO STATO DI PARTENZA, misurato il 31/08/2026 e congelato.
//
// ⚠️ QUESTE NON SONO ASSOLTE: sono **fotografate**. Una riga si toglie da qui
// quando la funzione riceve la sua porta — e toglierla e' il gesto che
// dichiara che il debito e' stato pagato.
const ORFANE_NOTE = {
  // Vivono in una funzione online: la porta c'e', passa da un'altra strada.
  archivia_posta: "chiamata da posta-leggi",
  documenti_per_domanda: "chiamata da assistente-archivio",
  registra_dettatura: "chiamata da ascolta-voce",
  registra_dettatura_da_chiave: "chiamata da ascolta-voce (la Scorciatoia)",
  registra_lettura_foto: "chiamata da leggi-foto",
  voce_apri_sessione: "chiamata da ascolta-voce",

  // Sono RETI: esistono per essere interrogate da una prova, non da una
  // schermata. Una porta a schermo non avrebbe senso.
  colonne_unita_non_classificate: "rete: il censimento delle unita'",
  confronti_storti: "rete: i confronti di data col fuso sbagliato",
  funzioni_aperte_ad_anon: "rete: chi puo' bussare da fuori",
  funzioni_col_portiere: "rete: chi controlla chi chiama",
  funzioni_con_data_utc: "rete: le date chieste a Greenwich",
  funzioni_multi_tabella: "rete: le scritture che devono passare dal corridoio",
  lapidi_di_prova: "rete: le tracce finte nel registro",
  tipi_vocali_senza_ramo: "rete: i comandi vocali che il gestionale non sa eseguire",
  vincoli_senza_frase: "rete: i rifiuti che non parlano italiano",
  funzioni_senza_chiamante: "rete: questa stessa — chi non ha un chiamante nel database",

  // Lavoro pianificato: lo chiama pg_cron, non una persona.
  send_due_task_reminders: "lavoro pianificato: i promemoria dell'Agenda",

  // Interrogata da uno script a riga di comando.
  numeri_sospetti: "interrogata da `npm run numeri`",

  // ⚠️ RIMANDATE DA ALESSIO il 31/08: l allerta della carta vecchia si
  //    costruisce quando ci saranno etichette vere — su una carta vuota
  //    direbbe sempre la stessa cosa. Il debito e SCRITTO, non nascosto.
  carta_da_ristampare: "DEBITO rimandato da Alessio: la schermata si fa con etichette vere",
  segna_carta_stampata: "DEBITO rimandato da Alessio: la schermata si fa con etichette vere",

  // 🔴 DEBITI VERI, e sono quelli per cui questa rete esiste. Ognuno e' una
  //    cosa che il gestionale sa fare e che nessuno puo' chiedergli.
  conti_senza_quadratura: "DEBITO: nessuna schermata mostra i conti che non quadrano",
  coperti_per_linea: "DEBITO: i coperti divisi per linea di ricavo non si vedono",
  numeri_fuori_intervallo: "DEBITO: i numeri fuori scala non hanno una schermata",
  scale_che_non_tornano: "DEBITO: le scale incoerenti non hanno una schermata",
  sprechi_e_resi: "DEBITO: sprechi e resi non hanno una schermata che li elenchi",
  tipi_vocali_senza_uscita: "DEBITO: nessuna schermata mostra i comandi vocali senza via d'uscita",
};

describe("nessuna funzione del database resta senza una porta", () => {
  it("le funzioni orfane sono quelle congelate, e non una di più", async () => {
    // Chi NON e' chiamato da un'altra funzione e non e' usato da un trigger.
    const { data, error } = await titolare.rpc("funzioni_senza_chiamante");
    expect(error).toBeNull();
    expect(Array.isArray(data)).toBe(true);

    const codice = Object.fromEntries(CARTELLE.map(([d, f]) => [d, testoDi(d, f)]));

    // ⚠️ TARATURA su casi di risposta nota (regola del 26/08): senza, un
    //    setaccio rotto direbbe «zero orfane» e sembrerebbe una conferma.
    //    `close_order_paid` la chiama la sala, `set_updated_at` e' un
    //    trigger interno che in `src/` non compare.
    expect(nomina("close_order_paid", codice.src), "il setaccio non trova ciò che c'è").toBe(true);
    expect(nomina("questa_funzione_non_esiste_davvero", codice.src)).toBe(false);

    const orfane = data
      .map((r) => r.nome)
      .filter((n) => !nomina(n, codice.src))
      .sort();

    const nuove = orfane.filter((n) => !(n in ORFANE_NOTE));
    expect(
      nuove,
      "Queste funzioni esistono nel database e NESSUNA schermata ci arriva.\n" +
        "O si costruisce la porta, oppure si aggiunge la riga in ORFANE_NOTE\n" +
        "dicendo da dove passa (una funzione online, una rete, un lavoro\n" +
        "pianificato) — e se e' un debito, si scrive DEBITO e perché."
    ).toEqual([]);

    // ⚠️ E ALLO SPECCHIO: una riga che resta nell'elenco dopo che la porta e'
    //    stata costruita fa credere che il debito ci sia ancora. E' lo stesso
    //    difetto dell'elenco delle schermate larghe, che il 31/08 e' diventato
    //    rosso proprio per questo.
    const sistemate = Object.keys(ORFANE_NOTE).filter((n) => !orfane.includes(n));
    expect(
      sistemate,
      "Queste hanno una porta adesso: toglile da ORFANE_NOTE, o l'elenco\n" +
        "racconta un debito che è già stato pagato."
    ).toEqual([]);
  });
});
