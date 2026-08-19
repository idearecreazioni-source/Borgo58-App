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
//
// ⚠️ MA IL RICONOSCIMENTO È UN'EURISTICA, e va detto qui invece che
// scoperto il giorno che serve. `funzioni_col_portiere()` riconosce DUE
// forme, e solo quelle:
//
//     if not is_titolare() then …          →  'not\s+is_titolare\s*\(\s*\)'
//     if auth.uid() is null then …         →  'auth\.uid\s*\(\s*\)\s+is\s+null'
//
// Sono le due che il progetto usa oggi, in tutte le sue funzioni. **Un
// portiere scritto in un'altra forma non verrebbe riconosciuto**, e questa
// prova direbbe «tutto a posto» dopo aver guardato solo una parte — che è
// il modo di fallire peggiore, lo stesso dello zero al posto del buco.
//
// Esempi che oggi le sfuggirebbero, non per chiuderli adesso ma perché la
// frase sia già scritta quando capiterà:
//   · `if is_titolare() = false then …` — confronto invece di negazione;
//   · `if coalesce(auth.uid(), …) …` — la chiamata avvolta in altro;
//   · un portiere delegato a una funzione terza (`solo_il_titolare()`),
//     che questa ricerca non seguirebbe.
//
// La forma definitiva sarebbe marcare le funzioni nel database con
// un'etichetta che si portano dietro, invece di dedurre il portiere dal
// testo. È la stessa strada indicata per il corridoio se l'eccezione
// mono-tabella si ripresentasse: costa lavoro vero e oggi non lo vale,
// ma è quella giusta.
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
      // 🔴 UNA REGIONE ANNIDATA NON È UNA REGIONE, e ignorarlo produceva un
      // allarme falso — il difetto peggiore per un guardiano, che infatti
      // questa stessa prova nomina due volte più sotto. Una verifica che
      // crea una funzione finta per rompere apposta una regola
      // (`execute 'create function … as $x$ … $x$'`) contiene un blocco
      // dentro il proprio blocco: chiudendolo, il testo che lo precedeva
      // veniva spacciato per SQL «di primo livello» e risultava senza
      // claims, mentre i claims erano impostati in cima al blocco che lo
      // contiene. Quello che conta è il blocco PIÙ ESTERNO: il suo testo
      // comprende anche gli annidati, quindi niente sfugge.
      if (aperti.length > 0) continue;
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
        // ⚠️ LIMITE TROVATO IL 19/08, e va dichiarato invece che scoperto:
        // qui si guarda SE i claims compaiono, non QUANDO. Ogni blocco di
        // verifica finisce con `set_config(…, null, …)` per ripulirsi, e
        // quella riga da sola basta a zittire il guardiano. Un blocco che
        // chiamasse una funzione col portiere **prima** di impostare i
        // claims passerebbe. È la stessa voce di coda del controllo che
        // guarda la forma invece del comportamento.
        const haIClaims = /set_config\s*\(\s*'request\.jwt\.claims'/.test(regione.testo);
        if (haIClaims) continue;
        // ⚠️ CI SONO TRE MODI DI NOMINARE UNA FUNZIONE SENZA CHIAMARLA, e
        // tutti e tre compaiono per forza in una migrazione che ne scrive
        // una: la dichiarazione (`create or replace function nome(…)`), la
        // cancellazione (`drop function nome(…)`) e i permessi
        // (`revoke`/`grant`/`comment on function`, obbligatori per §8).
        //
        // Senza questa depurazione l'euristica accusava la migrazione del
        // 17/08 di «chiamare `movimenti_attesi()` al primo livello»: era la
        // sua stessa intestazione. Un guardiano che grida sul gesto
        // obbligatorio viene spento al secondo allarme falso — ed è
        // esattamente il motivo per cui questa prova esiste con una soglia
        // dichiarata invece di gridare su 62 migrazioni vecchie.
        const testo = regione.testo
          .replace(/\b(revoke|grant|comment)\b[^;]*;/gi, " ")
          // ⚠️ `if exists` sta FRA `function` e il nome (`drop function if
          // exists nome(…)`): senza prevederlo, la depurazione mancava
          // proprio la riga che cancella la firma vecchia — ed è la riga
          // obbligatoria ogni volta che una funzione cambia parametri.
          .replace(
          // ⚠️ E IL NOME PUÒ ESSERE QUALIFICATO DALLO SCHEMA (`public.nome`),
          // che è come lo scrive Postgres quando una funzione viene RIPRESA
          // DAL DATABASE con `pg_get_functiondef` — la strada obbligata dal
          // 18/08 per non annullare in silenzio le migrazioni che l'hanno
          // toccata dopo. Senza il pezzo dello schema, la depurazione mancava
          // proprio quelle intestazioni, e il guardiano accusava una
          // migrazione di «chiamare» la funzione che stava scrivendo.
          // Trovato il 19/08, ed è un allarme falso: quelli spengono i
          // guardiani.
            /\b(create|drop)\s+(or\s+replace\s+)?function\s+(if\s+exists\s+)?(\w+\.)?\w+\s*\([^)]*\)/gi,
            " "
          );
        for (const nome of guardiane) {
          const chiamata = new RegExp(`\\b${nome}\\s*\\(`);
          if (chiamata.test(testo)) {
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
