import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { clientAutenticato, credenziali } from "./aiuto";

// Dentro una migrazione non si chiamano le funzioni dell'app che hanno un
// portiere.
//
// ⚠️ Nasce da un difetto vero, il 16/08/2026: la sanatoria del Blocco 9
// chiamava `incasso_conto()` → `totale_conto()`, che controlla il ruolo di
// chi chiama. **Una migrazione non ha un utente: ha un proprietario**,
// quindi `auth.uid()` è nullo e la funzione rifiuta. La migrazione si è
// fermata due volte in produzione — la seconda su una riga di riepilogo
// che stampava un numero.
//
// ⚠️ E la diagnosi giusta è questa, non «sul progetto di prova mancava un
// conto chiuso»: quella chiamata avrebbe rifiutato anche con dieci conti
// chiusi. Lo stato di partenza avrebbe reso il difetto visibile prima,
// non inesistente — è una differenza che decide quale cura viene prima.
//
// La cura: una sanatoria LEGGE LE TABELLE. Se la funzione serve davvero,
// si impostano i claims con `set_config('request.jwt.claims', …)` come già
// fanno i blocchi di verifica — e allora va bene.
//
// ⚠️ L'elenco delle funzioni col portiere NON è scritto qui: si costruisce
// interrogando il database a ogni esecuzione, come la rete del corridoio e
// quella delle funzioni aperte ad `anon`. Una funzione col portiere nuova,
// chiamata da una migrazione futura, fa diventare rossa questa prova senza
// che nessuno si sia ricordato di aggiornarla.
const CARTELLA = "supabase/migrations";

// ⚠️ Le migrazioni anteriori alla regola non si riscrivono (Contratto §8),
// quindi la soglia si dichiara invece di essere aggirata. Da qui in avanti
// il controllo vale per tutte.
const DA_QUESTA_IN_POI = "20260816000013";

// Divide un file SQL in regioni. Quelle delimitate da `$tag$` precedute da
// `as` sono CORPI DI FUNZIONE — non vengono eseguiti al momento della
// migrazione, quindi non c'entrano. Quelle precedute da `do` e il testo
// fuori da ogni regione sono invece eseguiti adesso, ed è lì che il
// portiere fa male.
function regioniEseguiteOra(sql) {
  const senzaCommenti = sql.replace(/--[^\n]*/g, "");
  const regioni = [];
  const delimitatore = /\$([a-z_]*)\$/g;
  let m;
  let ultimoFine = 0;
  const aperti = [];
  while ((m = delimitatore.exec(senzaCommenti)) !== null) {
    const tag = m[1];
    if (aperti.length && aperti[aperti.length - 1].tag === tag) {
      const apertura = aperti.pop();
      const prima = senzaCommenti.slice(Math.max(0, apertura.inizio - 60), apertura.inizio).toLowerCase();
      const corpoDiFunzione = /\bas\s*$/.test(prima.trimEnd() + " ") || /\bas\s+$/.test(prima);
      regioni.push({
        testo: senzaCommenti.slice(apertura.fine, m.index),
        eseguitaOra: !corpoDiFunzione,
        // Fuori dal corpo di funzione, ciò che conta è se il blocco ha
        // impostato i claims prima di chiamare.
      });
      // Il testo fra la fine del blocco precedente e l'inizio di questo è
      // SQL di primo livello: eseguito adesso, senza nessun claim.
      regioni.push({
        testo: senzaCommenti.slice(ultimoFine, apertura.inizio),
        eseguitaOra: true,
        primoLivello: true,
      });
      ultimoFine = m.index + m[0].length;
    } else {
      aperti.push({ tag, inizio: m.index, fine: m.index + m[0].length });
    }
  }
  regioni.push({ testo: senzaCommenti.slice(ultimoFine), eseguitaOra: true, primoLivello: true });
  return regioni.filter((r) => r.eseguitaOra);
}

const titolare = await clientAutenticato(credenziali().titolare);

describe("le migrazioni non chiamano le funzioni col portiere", () => {
  afterAll(async () => {
    await titolare.auth.signOut({ scope: "local" });
  });

  it("nessuna sanatoria chiama una funzione che controlla chi sei, senza impostare i claims", async () => {
    const { data, error } = await titolare.rpc("funzioni_col_portiere");
    expect(error).toBeNull();
    expect(data.length, "nessuna funzione col portiere: la prova non sta provando niente").toBeGreaterThan(5);
    const guardiane = data.map((f) => f.nome);

    const colpevoli = [];
    for (const file of readdirSync(CARTELLA).filter((f) => f.endsWith(".sql")).sort()) {
      if (file.slice(0, 14) < DA_QUESTA_IN_POI) continue;
      const sql = readFileSync(join(CARTELLA, file), "utf8");
      for (const regione of regioniEseguiteOra(sql)) {
        const haIClaims = /set_config\s*\(\s*'request\.jwt\.claims'/.test(regione.testo);
        if (haIClaims) continue;
        for (const nome of guardiane) {
          const chiamata = new RegExp(`\\b${nome}\\s*\\(`);
          if (chiamata.test(regione.testo)) {
            colpevoli.push(
              `${file}: chiama ${nome}() ${regione.primoLivello ? "al primo livello" : "in un blocco"} senza impostare i claims`
            );
          }
        }
      }
    }

    expect(colpevoli, colpevoli.join("\n")).toEqual([]);
  });
});
