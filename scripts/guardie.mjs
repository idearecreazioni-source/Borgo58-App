// =====================================================================
// LA RETE CONTRO LA FUNZIONE RISCRITTA A MEMORIA
// 23/08/2026
// =====================================================================
// 🔴 PERCHE' ESISTE. Quattro volte in questo progetto una funzione e'
// stata riscritta ricopiandola a memoria — o dal file che l'aveva creata
// invece che dal corpo VIVO del database — e ogni volta si e' persa per
// strada una riga che nessuno voleva togliere:
//
//   18/08  `pianta_del_giorno` riscritta dal file: persa una colonna (che
//          ha fatto fallire subito) e il battito di una sentinella (che
//          sarebbe passato verde, annunciando ogni quarto d'ora un guasto
//          inesistente).
//   23/08  `registra_produzione` ricostruita a memoria: perso **il
//          portiere** (`auth.uid() is null`), cioe' la sola cosa che
//          teneva il magazzino fuori dalla portata della chiave pubblica,
//          e il nome di un campo della risposta che la schermata legge —
//          l'avviso «N ingredienti non scaricati» avrebbe detto zero per
//          sempre, senza nessun errore.
//
// ⚠️ TUTTE E QUATTRO LE VOLTE se n'e' accorto qualcuno o qualcosa **a
// valle**: una prova sui permessi diventata rossa, una colonna mancante
// che ha fatto fallire una query, un occhio. Mai un controllo costruito
// apposta. Questo e' quel controllo.
//
// COSA FA, in una riga: prima di applicare una migrazione, confronta ogni
// funzione che quella migrazione ridefinisce col **corpo vivo** che sta
// nel database in quel momento, e si ferma se il corpo nuovo ha perso
// qualcosa che c'era prima.
//
// ⚠️ NON confronta i due testi: un confronto testuale griderebbe a ogni
// modifica legittima, e un guardiano che grida sempre si impara a
// spegnere (lezione del 19/08). Confronta **cinque impronte**, scelte
// perche' sono le cose che si perdono in silenzio:
//
//   1. i messaggi di `raise exception`   — un rifiuto che sparisce
//   2. i portieri (`auth.uid()`, `is_titolare()`, `security definer`,
//      `set search_path`)                — chi puo' entrare
//   3. le parole-chiave nelle stringhe   — il patto con la schermata
//      (`'righe_non_scaricate'`) e coi vocabolari chiusi (`'consumo'`)
//   4. i nomi delle colonne di un `returns table(...)`
//   5. le chiamate ad altre funzioni del progetto — una regola che vive
//      altrove e smette di essere invocata
//
// ⚠️ E NON SI LAMENTA DI CIO' CHE SI AGGIUNGE: una colonna in piu', un
// controllo in piu', un messaggio nuovo non tolgono niente e non fanno
// scattare niente. La rete guarda **solo** cio' che c'era e non c'e' piu'.
//
// ⚠️ LA VIA D'USCITA E' UNA DICHIARAZIONE, NON UN INTERRUTTORE. A volte
// una riga si toglie apposta (un messaggio riscritto meglio, un portiere
// che si sposta a monte). In quel caso si scrive nella migrazione:
//
//     -- rete-guardie: nome_funzione — <perche' si toglie>
//
// Quella riga resta nel file per sempre e si vede nella differenza del
// commit: e' il contrario di un silenzio. La rete la stampa mentre passa
// oltre, cosi' chi legge il registro vede a cosa si e' rinunciato.
//
// ⚠️ IL LIMITE, dichiarato: la rinuncia vale per TUTTA la funzione, non
// per la singola riga. Chi dichiara di togliere un messaggio e nello
// stesso passaggio perde un portiere non viene fermato. Restringerla alla
// singola riga vorrebbe dire ricopiare il testo esatto nella
// dichiarazione, cioe' un gesto fragile che si sbaglia; la rete stampa
// comunque l'elenco intero di cio' che si perde, e quello si legge.
// =====================================================================

/**
 * La prima migrazione soggetta a questa rete.
 *
 * ⚠️ PERCHE' C'E' UNA SOGLIA, ed e' lo stesso motivo di
 * `PRIMA_CON_RIEPILOGO` in comune.mjs: una rete nuova non puo' pretendere
 * una dichiarazione da file scritti prima che esistesse. Applicata
 * all'indietro, la misura del 23/08 dice che griderebbe su **23
 * ridefinizioni su 163** — e un controllo che grida su cose che nessuno
 * puo' piu' correggere (sono committate e su GitHub, e non si corregge un
 * file gia' applicato) viene spento al primo uso.
 *
 * ⚠️ E LE DICIANNOVE IN ATTESA SONO STATE GUARDATE UNA PER UNA, non
 * saltate per comodita'. Confrontando il corpo VIVO della produzione con
 * quello della prova — cioe' l'effetto netto di tutte e diciannove — le
 * cose perse sono **tre, e tutte e tre volute**: il messaggio di
 * `chiudi_partita`, che si e' allargato per far entrare «resa al
 * fornitore», e la parola `scarto` in `prodotti_da_compilare` e
 * `applica_scheda_prodotto`, tolta apposta col Blocco 5. `registra_produzione`
 * arriva intera: la migrazione …005 ripara per intero cio' che la …002
 * aveva perso.
 */
export const PRIMA_CON_RETE = "20260823000020";

/** I portieri: le parole che dicono chi puo' entrare in una funzione. */
const PORTIERI = [
  "auth.uid()",
  "is_titolare()",
  "auth.role()",
  "security definer",
  "set search_path",
];

/**
 * Toglie i commenti `--` rispettando le stringhe.
 *
 * ⚠️ Si tolgono da TUTTI E DUE i testi, e il verso conta: se si
 * togliessero solo dal corpo vivo, una guardia commentata via nel corpo
 * nuovo passerebbe per presente — cioe' il difetto piu' facile da fare.
 */
export function spogliaCommenti(sql) {
  let out = "";
  let i = 0;
  let inStringa = false;
  while (i < sql.length) {
    const c = sql[i];
    if (inStringa) {
      out += c;
      if (c === "'") inStringa = false;
      i += 1;
      continue;
    }
    if (c === "'") {
      inStringa = true;
      out += c;
      i += 1;
      continue;
    }
    if (c === "-" && sql[i + 1] === "-") {
      while (i < sql.length && sql[i] !== "\n") i += 1;
      continue;
    }
    out += c;
    i += 1;
  }
  return out;
}

/** Minuscole e spazi compressi: una riga mandata a capo non e' una riga persa. */
export function normalizza(testo) {
  return testo.toLowerCase().replace(/\s+/g, " ");
}

/**
 * La stessa frase scritta in due modi diversi resta la stessa frase.
 *
 * ⚠️ SERVE SOLO PER I MESSAGGI, e nasce da una misura: applicando la rete
 * alle diciannove migrazioni in attesa, `quadratura_fiscale` risultava aver
 * perso il messaggio del portiere — e invece il portiere era intatto: in
 * produzione la frase e' scritta `e'' riservata` (apostrofo raddoppiato,
 * senza accenti) e nella migrazione nuova `è riservata`. Stessa frase,
 * stesso rifiuto, due modi di battere la tastiera.
 *
 * Toglie accenti e apostrofi: quel che resta e' cio' che la frase DICE.
 * Non si applica alle parole-chiave e ai nomi di colonna, dove un
 * carattere diverso e' un nome diverso.
 */
export function piega(testo) {
  return normalizza(testo)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/'/g, "");
}

/**
 * Le funzioni che una migrazione (ri)definisce, col loro testo intero —
 * intestazione compresa, perche' `security definer` e `set search_path`
 * stanno li' e non nel corpo.
 *
 * @returns {{nome: string, testo: string}[]}
 */
export function funzioniRidefinite(sqlMigrazione) {
  const trovate = [];
  const inizio = /create\s+(?:or\s+replace\s+)?function\s+(?:public\.)?([a-z_][a-z0-9_]*)\s*\(/gi;
  let m;
  while ((m = inizio.exec(sqlMigrazione)) !== null) {
    const dollaro = /\$([a-z0-9_]*)\$/gi;
    dollaro.lastIndex = m.index;
    const apre = dollaro.exec(sqlMigrazione);
    if (!apre) continue;
    const tag = apre[0];
    const fine = sqlMigrazione.indexOf(tag, apre.index + tag.length);
    if (fine === -1) continue;
    trovate.push({
      nome: m[1].toLowerCase(),
      testo: sqlMigrazione.slice(m.index, fine + tag.length),
    });
    inizio.lastIndex = fine + tag.length;
  }
  return trovate;
}

/** Le stringhe scritte dentro un testo SQL, gia' senza gli apici. */
function stringhe(sql) {
  const out = [];
  const re = /'((?:[^']|'')*)'/g;
  let m;
  while ((m = re.exec(sql)) !== null) out.push(m[1]);
  return out;
}

/**
 * Le cinque impronte di un corpo di funzione.
 *
 * @param {string} testo il testo della funzione, gia' spogliato dei commenti
 * @param {Set<string>} funzioniDelProgetto i nomi delle funzioni di `public`
 */
export function impronte(testo, funzioniDelProgetto = new Set()) {
  const piatto = normalizza(testo);
  const out = [];

  // 1. I messaggi di rifiuto.
  const rifiuti = /raise\s+(?:exception|warning)\s+'((?:[^']|'')*)'/gi;
  let m;
  while ((m = rifiuti.exec(testo)) !== null) {
    out.push({ tipo: "messaggio", testo: m[1], cerca: piega(m[1]), piegata: true });
  }

  // 2. I portieri.
  for (const p of PORTIERI) {
    if (piatto.includes(p)) out.push({ tipo: "portiere", testo: p, cerca: p });
  }

  // 3. Le parole-chiave: le stringhe che sono un identificatore. Sono i
  //    nomi dei campi di una risposta e i valori di un vocabolario chiuso.
  //
  // ⚠️ `public` e' escluso, ed e' l'unico falso allarme SISTEMATICO che la
  // misura del 23/08 ha trovato: il database restituisce sempre
  // `SET search_path TO 'public'` con gli apici, mentre nelle migrazioni si
  // scrive `set search_path = public` senza. Ogni singola ridefinizione
  // sembrerebbe aver perso la parola «public». Quel controllo non sparisce:
  // lo fa gia' il portiere `set search_path`, che guarda la clausola invece
  // della stringa.
  for (const s of new Set(stringhe(testo))) {
    if (s !== "public" && /^[a-z][a-z0-9_]{2,}$/.test(s)) {
      out.push({ tipo: "parola", testo: s, cerca: normalizza(`'${s}'`) });
    }
  }

  // 4. Le colonne di un `returns table(...)`.
  const tabella = testo.match(/returns\s+table\s*\(([\s\S]*?)\)\s*(?:language|as\s|security|set\s|stable|immutable|volatile)/i);
  if (tabella) {
    for (const riga of tabella[1].split(",")) {
      const nome = (riga.trim().split(/\s+/)[0] || "").toLowerCase();
      if (/^[a-z_][a-z0-9_]*$/.test(nome)) {
        out.push({ tipo: "colonna", testo: nome, cerca: nome });
      }
    }
  }

  // 5. Le chiamate ad altre funzioni del progetto.
  const chiamata = /([a-z_][a-z0-9_]*)\s*\(/gi;
  const viste = new Set();
  while ((m = chiamata.exec(testo)) !== null) {
    const nome = m[1].toLowerCase();
    if (!funzioniDelProgetto.has(nome) || viste.has(nome)) continue;
    viste.add(nome);
    out.push({ tipo: "chiamata", testo: nome, cerca: nome });
  }

  return out;
}

/**
 * Cosa il corpo NUOVO ha perso rispetto a quello VIVO.
 *
 * Il verso e' tutto: si guarda solo cio' che c'era prima e adesso non
 * c'e'. Aggiungere non fa scattare niente.
 */
export function guardieSmarrite(vivo, nuovo, funzioniDelProgetto = new Set()) {
  const vivoPulito = spogliaCommenti(vivo);
  const nuovoSpoglio = spogliaCommenti(nuovo);
  const nuovoPiatto = normalizza(nuovoSpoglio);
  const nuovoPiegato = piega(nuovoSpoglio);
  const smarrite = [];
  const gia = new Set();
  for (const i of impronte(vivoPulito, funzioniDelProgetto)) {
    const chiave = `${i.tipo}|${i.testo}`;
    if (gia.has(chiave)) continue;
    if (!(i.piegata ? nuovoPiegato : nuovoPiatto).includes(i.cerca)) {
      gia.add(chiave);
      smarrite.push(i);
    }
  }
  return smarrite;
}

/**
 * Le funzioni per cui la migrazione dichiara di togliere qualcosa apposta.
 * Forma della riga:  `-- rete-guardie: nome_funzione — motivo`
 */
export function rinunceDichiarate(sqlMigrazione) {
  const out = new Map();
  const re = /--\s*rete-guardie\s*:\s*([a-z_][a-z0-9_]*)\s*(.*)/gi;
  let m;
  while ((m = re.exec(sqlMigrazione)) !== null) {
    out.set(m[1].toLowerCase(), (m[2] || "").trim());
  }
  return out;
}

/**
 * Il controllo intero su una migrazione.
 *
 * @param {string} sqlMigrazione il testo del file
 * @param {(nome: string) => string|null} corpoVivo come si chiede al database
 * @param {Set<string>} funzioniDelProgetto i nomi delle funzioni di `public`
 * @returns {{nome: string, smarrite: object[], rinuncia: string|null}[]}
 */
export function controllaMigrazione(sqlMigrazione, corpoVivo, funzioniDelProgetto = new Set()) {
  const rinunce = rinunceDichiarate(sqlMigrazione);
  const esiti = [];
  for (const f of funzioniRidefinite(sqlMigrazione)) {
    const vivo = corpoVivo(f.nome);
    // Una funzione che nel database non c'e' ancora non puo' aver perso
    // niente: e' nuova.
    if (!vivo) continue;
    const smarrite = guardieSmarrite(vivo, f.testo, funzioniDelProgetto);
    if (smarrite.length === 0) continue;
    esiti.push({
      nome: f.nome,
      smarrite,
      rinuncia: rinunce.has(f.nome) ? rinunce.get(f.nome) : null,
    });
  }
  return esiti;
}

/**
 * Chiede al database i corpi VIVI di tutte le funzioni di `public`.
 *
 * ⚠️ E' il cuore della rete: il confronto si fa con cio' che gira
 * ADESSO, non col file che quella funzione l'aveva creata. Fra i due ci
 * stanno tutte le migrazioni che l'hanno toccata dopo — ed e' esattamente
 * li' che si sono perse le quattro cose del 18 e del 23/08.
 *
 * ⚠️ Limite dichiarato: se una funzione ha piu' versioni con parametri
 * diversi, i corpi si sommano. Un'impronta che sopravvive in una qualunque
 * delle versioni conta come presente — la rete preferisce tacere che
 * gridare a torto.
 */
export async function corpiVivi(url) {
  const { interroga } = await import("./comune.mjs");
  // ⚠️ Le definizioni vanno a capo e psql scrive una riga per risultato:
  // gli a-capo si sostituiscono con due caratteri di controllo che nel
  // codice non compaiono mai, e si rimettono qui.
  const SEP = String.fromCharCode(1);
  const ACAPO = String.fromCharCode(2);
  const righe = interroga(
    url,
    "select p.proname || chr(1) || replace(pg_get_functiondef(p.oid), chr(10), chr(2))" +
      " from pg_proc p join pg_namespace n on n.oid = p.pronamespace" +
      " where n.nspname = 'public' and p.prokind = 'f';"
  );
  const per = new Map();
  for (const riga of righe.split("\n")) {
    const taglio = riga.indexOf(SEP);
    if (taglio === -1) continue;
    const nome = riga.slice(0, taglio).trim().toLowerCase();
    const def = riga.slice(taglio + 1).split(ACAPO).join("\n");
    per.set(nome, per.has(nome) ? per.get(nome) + "\n" + def : def);
  }
  return {
    corpoVivo: (nome) => per.get(nome) ?? null,
    funzioniDelProgetto: new Set(per.keys()),
    quante: per.size,
  };
}

/** Come si racconta a schermo cio' che una funzione ha perso. */
export function raccontaSmarrite(esito) {
  const per = {
    portiere: "PORTIERE",
    messaggio: "messaggio di rifiuto",
    parola: "parola-chiave",
    colonna: "colonna",
    chiamata: "chiamata",
  };
  return esito.smarrite.map((s) => {
    const corto = s.testo.length > 70 ? `${s.testo.slice(0, 70)}…` : s.testo;
    return `    · ${per[s.tipo] ?? s.tipo}: ${corto}`;
  });
}
