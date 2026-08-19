import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { clientAutenticato, credenziali } from "./aiuto";

// Blocco 3 del mandato di correzione: ogni scrittura su più di una tabella
// passa dal corridoio (Contratto B4).
//
// ⚠️ QUESTA REGOLA NON È IMPONIBILE CON UN PERMESSO, ed è il motivo per
// cui esiste questo file. Il corridoio chiama le funzioni **col token
// dell'utente vero**: ha esattamente i diritti che avrebbe il browser.
// Togliere il permesso al browser lo toglierebbe anche al corridoio.
//
// Quindi la rete è qui, ed è fatta come quella del 13/08 sull'elenco delle
// funzioni aperte ad `anon`: **l'elenco non è scritto in questo file** — si
// costruisce interrogando il database a ogni esecuzione. Una funzione
// multi-tabella nuova, chiamata direttamente dal browser, fa diventare
// rossa questa prova senza che nessuno si sia ricordato di aggiornarla.
const RADICI = ["src/lib", "src/pages", "src/components"];

function fileJs(dir, trovati = []) {
  for (const nome of readdirSync(dir)) {
    const percorso = join(dir, nome);
    if (statSync(percorso).isDirectory()) fileJs(percorso, trovati);
    else if (/\.(js|jsx)$/.test(nome)) trovati.push(percorso);
  }
  return trovati;
}

// Ogni `rpc("nome")` scritto nel codice del sito, con il file in cui sta:
// il nome del file serve a dire DOVE, perché un elenco di funzioni senza
// il posto in cui sono chiamate non si sa da dove cominciare a curarlo.
function chiamateDirette() {
  const trovate = new Map();
  for (const radice of RADICI) {
    for (const file of fileJs(radice)) {
      const testo = readFileSync(file, "utf8");
      for (const m of testo.matchAll(/\.rpc\(\s*"([a-z_0-9]+)"/g)) {
        if (!trovate.has(m[1])) trovate.set(m[1], []);
        trovate.get(m[1]).push(file);
      }
    }
  }
  return trovate;
}

const titolare = await clientAutenticato(credenziali().titolare);

describe("le scritture su più tabelle passano dal corridoio", () => {
  afterAll(async () => {
    await titolare.auth.signOut({ scope: "local" });
  });

  it("nessuna funzione multi-tabella è chiamata direttamente dal browser", async () => {
    const { data, error } = await titolare.rpc("funzioni_multi_tabella");
    expect(error).toBeNull();
    expect(data.length).toBeGreaterThan(0); // se fosse 0, la prova non starebbe provando niente

    const dirette = chiamateDirette();
    // ⚠️ Senza questo, una prova che non trova più nessuna chiamata —
    // perché il codice si è spostato, perché l'espressione non combacia
    // più — passerebbe sempre, dicendo «tutto a posto» dopo aver guardato
    // niente. È la forma dello zero al posto del buco.
    expect(dirette.size, "il censimento non ha trovato NESSUNA chiamata rpc: sta guardando nel posto sbagliato").toBeGreaterThan(20);

    const colpevoli = data
      .filter((f) => dirette.has(f.nome))
      .map((f) => `${f.nome} (scrive ${f.quali}) — chiamata in ${dirette.get(f.nome).join(", ")}`);

    expect(colpevoli, colpevoli.join("\n")).toEqual([]);
  });

  // ⚠️ ECCEZIONI DICHIARATE, e il perché sta qui e non solo nel riepilogo.
  // `completa_task` e `riapri_task` scrivono UNA tabella sola (`tasks`),
  // quindi questa rete non le vede e non deve vederle: la sua domanda è
  // «scrive più di una tabella?», che il database sa calcolare. Passano
  // comunque dal corridoio perché sono tutto-o-niente **per senso** —
  // chiudere un impegno ricorrente genera il successivo, riaprirlo toglie
  // quello già nato (decisione di Alessio, 16/08/2026).
  //
  // ⚠️ Il Contratto §B4 NON è stato allargato a «ogni operazione
  // tutto-o-niente», ed è la ragione per cui questa rete continua a
  // esistere: «più di una tabella» è misurabile, «tutto-o-niente» è un
  // giudizio che nessuna query calcola. Con la regola larga l'elenco
  // tornerebbe scritto a mano in questo file — cioè invecchierebbe in
  // silenzio, che è esattamente ciò che questa prova evita.
  //
  // Se il caso si ripresentasse una terza volta, la strada pulita esiste:
  // marcare le funzioni nel database con un'etichetta che si portano
  // dietro, così l'elenco resta calcolabile.
  it("le eccezioni dichiarate sono nel corridoio, e restano eccezioni", async () => {
    const corridoio = readFileSync("supabase/functions/operazioni-atomiche/index.ts", "utf8");
    for (const nome of ["completa_task", "riapri_task"]) {
      expect(corridoio, `${nome} manca dall'elenco del corridoio`).toContain(`"${nome}"`);
    }
    // E non devono comparire fra le multi-tabella: se ci comparissero,
    // vorrebbe dire che qualcuno ha cambiato cosa scrivono, e allora
    // l'eccezione non è più un'eccezione.
    const { data } = await titolare.rpc("funzioni_multi_tabella");
    const multi = data.map((f) => f.nome);
    expect(multi).not.toContain("completa_task");
    expect(multi).not.toContain("riapri_task");
  });

  it("le cinque del Blocco 3 sono nell'elenco delle operazioni del corridoio", () => {
    // Il corridoio ha un elenco CHIUSO: un nome che non c'è riceve 404, e
    // una schermata che chiama un'operazione non ammessa fallisce solo
    // quando qualcuno la usa. Qui si controlla che ci siano.
    const corridoio = readFileSync("supabase/functions/operazioni-atomiche/index.ts", "utf8");
    for (const nome of [
      "annulla_prenotazione",
      "merge_customers",
      // ⚠️ Era `close_shopping_list_item`, cancellata dal database il
      // 19/08 e sostituita da questa: la stessa cosa piu' i tre esiti e
      // l'uscita in prima nota. Se la prova nominasse ancora la vecchia,
      // sorveglierebbe una porta che non esiste.
      "chiudi_riga_lista",
      "record_stock_consumption",
      "update_ingredient_price",
    ]) {
      expect(corridoio, `${nome} manca dall'elenco del corridoio`).toContain(`"${nome}"`);
    }
  });

});

// ⚠️ COSA QUESTO FILE NON CONTROLLA, e perché non è una dimenticanza: un
// nome scritto male nell'elenco del corridoio resta invisibile finché
// qualcuno non usa quella schermata. Il controllo sembrava facile —
// chiamare ogni nome e vedere se il database lo conosce — ma PostgREST
// risponde «Could not find the function» sia quando la funzione non
// esiste sia quando esiste e gli argomenti non combaciano: dal client le
// due cose sono indistinguibili, e una prova che non sa distinguerle dà
// sette falsi allarmi (provato). Servirebbe una funzione del database
// scritta apposta per essere interrogata da qui, e non vale il prezzo
// finché l'elenco lo si tocca una volta per blocco di lavoro.
