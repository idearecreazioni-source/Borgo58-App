// Attrezzi condivisi dai comandi di copia, ricostruzione e confronto.
//
// Regola non negoziabile di questo file: NESSUNA credenziale nel
// repository. Tutto viene letto da `.env`, che vive solo sul PC di
// Alessio ed e' escluso da git (.gitignore copre `.env`).
//
// Seconda regola: i comandi che scrivono o cancellano puntano SOLO al
// progetto di prova. Il controllo non e' una raccomandazione scritta in
// un documento — e' la funzione `soloProva()` qui sotto, che ferma il
// programma se nella stringa di collegamento compare il progetto vero.

import { existsSync, readdirSync, readFileSync, writeFileSync, unlinkSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { homedir, tmpdir } from "node:os";

/** Il progetto di produzione. Se compare dove non deve, si interrompe tutto. */
export const REF_PRODUZIONE = "oudjuqbqszisdtwzbxdo";

/**
 * Il progetto di prova, usa-e-getta e ricostruibile da zero.
 * Serve a installarci le funzioni online PRIMA della produzione: senza,
 * un'operazione nuova del corridoio potrebbe arrivare in produzione senza
 * essere mai stata esercitata da nessuna prova automatica.
 */
export const REF_PROVA = "bnwqgpuyzmzujxfbtyvs";

/**
 * La prima migrazione soggetta alla rete dei riepiloghi (16/08/2026).
 *
 * ⚠️ PERCHE' C'E' UNA SOGLIA, e perche' e' questa. Il controllo qui sotto
 * cerca il numero di versione COMPLETO dentro i file di
 * `docs/consegne/`. Le migrazioni piu' vecchie non lo passerebbero, per
 * due motivi che non sono difetti:
 *   - quelle fino al 09/08/2026 sono precedenti alla convenzione stessa
 *     dei riepiloghi, che nasce il 10/08;
 *   - quelle fra il 10/08 e il 15/08 SONO documentate, ma i riepiloghi le
 *     nominano in forma abbreviata («…09», «…14») invece che per intero.
 * Applicare il controllo all'indietro produrrebbe 62 falsi allarmi e la
 * rete verrebbe disattivata al primo uso — che e' il modo in cui muoiono
 * i controlli.
 *
 * Da questa versione in avanti la regola e': **il numero completo va
 * scritto nel riepilogo**. La soglia e' la prima migrazione del debito
 * rilevato dal validatore il 16/08.
 */
export const PRIMA_CON_RIEPILOGO = "20260815000006";

/**
 * Le migrazioni gia' applicate che nessun riepilogo nomina.
 *
 * ⚠️ IL SENSO DELLA RETE, detto una volta. La regola «nessun push senza
 * riepilogo» il 15/08 e' stata violata quattro volte di fila, e nessuno se
 * n'e' accorto fino al controllo del validatore: era un'intenzione, e le
 * intenzioni si degradano quando il lavoro e' lungo. Qui diventa una
 * condizione che ferma il programma.
 *
 * ⚠️ E CONTROLLA CIO' CHE E' GIA' APPLICATO, non cio' che sta per esserlo.
 * Sembra un dettaglio ed e' la scelta che rende la rete usabile: il
 * riepilogo contiene i NUMERI VERI dell'applicazione — quante migrazioni
 * ci sono adesso, quanti avvisi sono partiti, cosa dice il connettore —
 * che si conoscono solo dopo. Pretenderlo prima costringerebbe a scrivere
 * un documento con dei buchi da riempire, cioe' a fingere. Cosi' invece il
 * debito non puo' ACCUMULARSI: la volta dopo non si applica niente finche'
 * la precedente non e' documentata.
 *
 * @param {Set<string>} versioniApplicate versioni presenti in produzione
 * @returns {string[]} le versioni scoperte, in ordine
 */
export function migrazioniSenzaRiepilogo(versioniApplicate) {
  return versioniNonNominate(versioniApplicate, testoDeiRiepiloghi());
}

/** Tutto il testo di `docs/consegne/`, in un pezzo solo. */
export function testoDeiRiepiloghi() {
  const cartella = "docs/consegne";
  if (!existsSync(cartella)) return "";
  return readdirSync(cartella)
    .filter((f) => f.endsWith(".md"))
    .map((f) => readFileSync(path.join(cartella, f), "utf8"))
    .join("\n");
}

/**
 * Quali di queste versioni non compaiono PER INTERO nei riepiloghi.
 *
 * ⚠️ LA PARTE PURA, separata apposta il 28/08: finche' la ricerca era
 * dentro la funzione che legge la cartella, l'unico modo di provarla era
 * avere davvero quei file — quindi non si poteva provare **il caso che
 * conta**, cioe' una versione nominata a meta'.
 *
 * 🔴 E IL CASO CHE CONTA E' L'INTERVALLO. Un riepilogo che scrive
 * «`…026` → `…032`» nomina i due estremi e lascia mute le cinque in mezzo:
 * la ricerca trova `20260827000026` e `20260827000032` e non trova le
 * altre — che e' il comportamento giusto, ma **nessuno lo scopriva**,
 * perche' fino a oggi il controllo guardava solo cio' che era GIA'
 * applicato. Il 28/08 quattro migrazioni su quindici erano in quello
 * stato. La forma abbreviata era gia' nominata nel commento della soglia
 * qui sopra come il motivo per cui le migrazioni fra il 10/08 e il 15/08
 * non passerebbero: era una trappola descritta e mai chiusa.
 *
 * @param {Iterable<string>} versioni
 * @param {string} testo il contenuto dei riepiloghi
 * @returns {string[]} le versioni scoperte, in ordine
 */
export function versioniNonNominate(versioni, testo) {
  return [...versioni]
    .filter((v) => v >= PRIMA_CON_RIEPILOGO)
    .filter((v) => !String(testo).includes(v))
    .sort();
}

/**
 * 🔴 DUE MIGRAZIONI CON LO STESSO NUMERO DI VERSIONE — la rete nata dal
 * difetto del 22/08/2026, e la forma del difetto vale piu' del caso.
 *
 * `applied_migrations` ha per chiave la VERSIONE, non il nome del file.
 * Il 21/08 sono nati due file con lo stesso prefisso
 * (`20260821000001_una_percentuale…` e `20260821000001_i_turni_dei_pasti`):
 * applicato il primo, il secondo risultava **gia' applicato** e `npm run
 * migra` rispondeva «non manca niente». La migrazione dei turni non e' mai
 * girata in produzione, e nessuno strumento lo diceva — la schermata delle
 * Comande e' andata online chiedendo una colonna che nel database vero non
 * c'era.
 *
 * ⚠️ E il suo `insert into applied_migrations … on conflict do nothing`
 * **non ha fatto niente**: la riga c'era gia', col nome dell'altra. Il
 * registro non ha mentito su una cosa che non sapeva — ha detto una cosa
 * falsa con l'aria di essere vera, che e' la famiglia di §8.
 *
 * ⚠️ Per questo il controllo si fa PRIMA di guardare cosa manca: e' una
 * proprieta' della cartella, non uno stato del database, e vale anche sul
 * progetto di prova (dove lo stesso difetto aveva lasciato il registro a
 * 166 con 167 file applicati).
 *
 * @param {{file: string, versione: string}[]} elenco le migrazioni sul disco
 * @returns {string[]} le righe da mostrare, vuoto se e' tutto a posto
 */
export function versioniDoppie(elenco) {
  const per = new Map();
  for (const m of elenco) {
    if (!per.has(m.versione)) per.set(m.versione, []);
    per.get(m.versione).push(m.file);
  }
  return [...per.entries()]
    .filter(([, file]) => file.length > 1)
    .sort()
    .map(([versione, file]) => `  ${versione}: ${file.join("  +  ")}`);
}

export function leggiConfigurazione(file = ".env") {
  if (!existsSync(file)) {
    fermati(
      `Manca il file ${file}.`,
      "Copia `.env.example` in `.env` e completalo seguendo docs/BACKUP.md."
    );
  }
  const out = {};
  for (const riga of readFileSync(file, "utf8").split(/\r?\n/)) {
    const m = riga.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
    if (m) out[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
  }
  return out;
}

export function obbligatorio(config, nome, aiuto) {
  const v = config[nome];
  if (!v) fermati(`Manca ${nome} nel file .env.`, aiuto);
  return v;
}

/**
 * Barriera di sicurezza: usata da ogni comando che SCRIVE.
 * Un errore di copia-incolla nella stringa di collegamento non deve
 * poter riscrivere il database vero.
 */
export function soloProva(url) {
  if (url.includes(REF_PRODUZIONE)) {
    fermati(
      "FERMO: questa stringa di collegamento punta al database VERO.",
      "I comandi di ricostruzione e ripristino lavorano solo sul progetto di prova.",
      "Controlla DB_URL_PROVA in .env."
    );
  }
  return url;
}

/**
 * Trova pg_dump/psql: prima nel PATH, poi nelle cartelle standard di
 * PostgreSQL su Windows (l'installazione non aggiunge il PATH da sola).
 */
export function strumento(nome) {
  const eseguibile = process.platform === "win32" ? `${nome}.exe` : nome;
  if (spawnSync(eseguibile, ["--version"], { encoding: "utf8" }).status === 0) return eseguibile;

  for (const base of ["C:/Program Files/PostgreSQL", "C:/Program Files (x86)/PostgreSQL"]) {
    if (!existsSync(base)) continue;
    const versioni = readdirSync(base).sort().reverse();
    for (const v of versioni) {
      const candidato = path.join(base, v, "bin", eseguibile);
      if (existsSync(candidato)) return candidato;
    }
  }

  fermati(
    `Non trovo ${nome} su questo computer.`,
    "Vanno installati una volta sola gli strumenti a riga di comando di PostgreSQL 17:",
    "le istruzioni passo passo sono in docs/BACKUP.md, paragrafo 1."
  );
}

/**
 * Esegue un programma mostrandone l'uscita. Restituisce true se e' andato
 * bene.
 *
 * `opzioni.shell` serve su Windows per i comandi che non sono veri
 * eseguibili ma file `.cmd` — `npx` e' uno di questi. Da Node 24 un
 * `.cmd` non si avvia piu' senza shell e l'errore che si vede e'
 * `ENOENT`, cioe' "non trovo il programma": indistinguibile da "non e'
 * installato". Trovato il 13/08/2026, quando l'installazione di una
 * funzione online falliva dando la colpa alla chiave d'accesso.
 *
 * `errore` distingue "non sono riuscito ad AVVIARE il programma" da "il
 * programma ha risposto male": sono due guasti diversi e mandano a
 * cercare in due posti diversi.
 */
export function esegui(programma, argomenti, opzioni = {}) {
  const r = spawnSync(programma, argomenti, {
    stdio: opzioni.silenzioso ? ["ignore", "pipe", "pipe"] : "inherit",
    encoding: "utf8",
    shell: opzioni.shell === true,
    env: { ...process.env, PGCLIENTENCODING: "UTF8", ...(opzioni.env || {}) },
  });
  const errore = r.error ? r.error.code || String(r.error.message) : null;
  if (opzioni.silenzioso) {
    return { ok: r.status === 0, uscita: (r.stdout || "") + (r.stderr || ""), errore };
  }
  return { ok: r.status === 0, uscita: "", errore };
}

/**
 * Interroga un database e restituisce il risultato come testo grezzo.
 *
 * 🔴 LA SQL PASSA DA UN FILE, NON DALLA RIGA DI COMANDO (23/08/2026), e non
 * e' un dettaglio di forma: `psql -c "…"` fa passare il testo dalla riga di
 * comando, dove su Windows gli accenti e tutto cio' che non e' ASCII
 * arrivano storti — `invalid byte sequence for encoding "UTF8": 0xab`, cioe'
 * una virgoletta «. Misurato stanotte: basta un `--` di commento con dentro
 * una freccia o un punto esclamativo dentro un triangolo e l'interrogazione
 * non parte.
 *
 * ⚠️ Era gia' scritto negli appunti dal 18/08 («la SQL con gli accenti si
 * applica da file, mai come argomento») ed era rimasta **una regola da
 * ricordare** invece di una proprieta' dello strumento: chi scriveva una
 * query nuova doveva sapersela. Adesso lo strumento la rispetta da solo, e
 * il posto dove la regola era gia' onorata — le migrazioni, che si applicano
 * con `-f` — smette di essere un'eccezione fortunata.
 */
export function interroga(url, sql) {
  const psql = strumento("psql");
  const file = path.join(
    tmpdir(),
    `borgo58-interroga-${process.pid}-${sqlProgressivo++}.sql`
  );
  writeFileSync(file, sql, "utf8");
  try {
    const r = esegui(psql, ["-v", "ON_ERROR_STOP=1", "-A", "-t", "-d", url, "-f", file], {
      silenzioso: true,
    });
    if (!r.ok) fermati("Il database non ha risposto:", r.uscita.trim());
    return r.uscita.trim();
  } finally {
    try {
      unlinkSync(file);
    } catch {
      // Se il file resta, resta: non e' una ragione per far fallire una lettura.
    }
  }
}

let sqlProgressivo = 0;

export function fermati(...righe) {
  console.error("");
  for (const r of righe) console.error(`  ${r}`);
  console.error("");
  process.exit(1);
}

export function titolo(testo) {
  console.log("");
  console.log(`── ${testo}`);
}

/** Data e ora locali in formato ordinabile, per i nomi delle cartelle. */
export function timbroLocale() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}`;
}

/**
 * Confronta due elenchi di «elementi di forma» di un database — colonne,
 * vincoli, indici, funzioni, trigger, policy — ignorando SOLO le parentesi.
 *
 * 🔴 PERCHE' LE PARENTESI SI IGNORANO (25/08/2026, misurato). La prova di
 * ricarica confronta lo schema ricostruito da zero con quello vero, e tre
 * `check` identici uscivano diversi da `pg_get_constraintdef`:
 *
 *     ((A AND B) AND (C AND D))     dal database ricostruito
 *     (A AND B AND (C AND D))       dal progetto di prova
 *
 * Non e' una regola diversa: e' come il motore ha memorizzato l'albero
 * dell'espressione, e `AND` e' associativo. Confrontarle alla lettera
 * darebbe tre differenze false — e tre differenze false in un controllo
 * che deve dire «zero» sono il modo in cui quel controllo viene spento.
 *
 * ⚠️ E SI TOLGONO SOLO LE PARENTESI: operatori, numeri, nomi di colonna e
 * di funzione restano. Un vincolo che cambiasse `>=` in `>`, o 12 in 13,
 * o `prima_scadenza_mese` in un'altra colonna, resterebbe una differenza.
 * E' la ragione per cui questa funzione ha una prova al contrario.
 *
 * @param {string} testo l'uscita di psql, una riga per elemento
 * @returns {Set<string>} gli elementi, normalizzati
 */
export function formaDelDatabase(testo) {
  return new Set(
    String(testo)
      .split(/\r?\n/)
      .map((l) => l.replace(/[()]/g, "").replace(/\s+/g, " ").trim())
      .filter(Boolean)
  );
}

/**
 * Come si applica UNA migrazione con psql: atomica, salvo eccezione
 * riconosciuta dal file.
 *
 * IL DIFETTO CHE CHIUDE, misurato il 28/08/2026 sul gestionale vero.
 * Fino a oggi le migrazioni si applicavano con `psql -f` e basta. Senza
 * `--single-transaction` psql chiude una transazione per ogni istruzione,
 * quindi una migrazione che fallisce NELLA SUA VERIFICA lascia in
 * produzione tutte le DDL che l'hanno preceduta e NON scrive la sua riga
 * in `applied_migrations` — la registrazione e' l'ultima istruzione del
 * file, e `ON_ERROR_STOP` si ferma prima.
 * E' successo alla `20260827000018`: tredici oggetti su tredici gia' nel
 * gestionale vero, zero righe nel registro, e lo strumento che stampava
 * «una migrazione che fallisce non lascia niente a meta'».
 * Il danno non e' lo stato a meta': e' che NESSUNO POTEVA SAPERLO. Il
 * registro diceva 289 e il catalogo diceva un'altra cosa.
 *
 * L'ECCEZIONE SI RICONOSCE DAL FILE, NON SI RICORDA. Il valore aggiunto a
 * un enum sta dentro una transazione, ma non e' usabile finche' quella
 * transazione non e' chiusa (misurato il 19/08/2026). Quelle migrazioni
 * girano per istruzioni, come prima — e lo DICONO, invece di farlo in
 * silenzio. Misurate il 28/08: sono 8 su 310, tutte gia' applicate da
 * settimane, e nessuna delle 21 in attesa.
 *
 * Il setaccio TOGLIE I COMMENTI prima di guardare: cercando la forma nel
 * testo grezzo si trovano anche i commenti che ne parlano, e il 28/08 il
 * conto grezzo diceva 11 invece di 8 — fra i tre falsi c'era proprio una
 * delle migrazioni in attesa.
 */
export function argomentiMigrazione(url, percorso) {
  const senzaCommenti = readFileSync(percorso, "utf8").replace(/--[^\n]*/g, "");
  const perIstruzioni = /alter\s+type\s+[^;]*\badd\s+value\b/i.test(senzaCommenti);
  const argomenti = ["-v", "ON_ERROR_STOP=1"];
  if (!perIstruzioni) argomenti.push("--single-transaction");
  argomenti.push("-d", url, "-f", percorso);
  return { argomenti, atomica: !perIstruzioni };
}

// --- QUANDO E' STATA FATTA L'ULTIMA COPIA DI SICUREZZA ----------------
//
// 🔴 Serve al sesto freno di `npm run migra` (30/08/2026): non si tocca il
// database vero se la copia e' vecchia. Qui c'e' la parte che GUARDA il
// disco; la parte che DECIDE e' `backupTroppoVecchio()`, tenuta separata
// apposta — cosi' si puo' provare a tavolino, senza dover invecchiare un
// backup vero per vedere il rifiuto. E' la stessa separazione con cui in
// questo progetto l'email di conferma e la sentinella si provano senza
// spedire niente a nessuno.

/** Quante ore puo' avere la copia prima che le migrazioni si fermino. */
export const ORE_MASSIME_BACKUP = Number(process.env.BACKUP_MASSIMO_ORE || 24);

/**
 * L'ora locale scritta nel NOME di una cartella di backup, o null.
 * Il formato e' quello di `timbroLocale()`: `2026-08-30_2059`.
 *
 * ⚠️ Si legge dal nome e non dalla data del file: il nome e' l'ora in cui
 * la copia e' stata presa, e resta vera anche se la cartella viene
 * copiata su una chiavetta. La data del file no.
 */
export function quandoDalNome(nome) {
  const m = /^(\d{4})-(\d{2})-(\d{2})_(\d{2})(\d{2})$/.exec(nome);
  if (!m) return null;
  const [, a, me, g, h, mi] = m.map(Number);
  const d = new Date(a, me - 1, g, h, mi, 0, 0);
  // Una data impossibile (13 come mese, 32 come giorno) scivolerebbe nel
  // mese dopo: si controlla che torni uguale invece di fidarsi.
  if (d.getFullYear() !== a || d.getMonth() !== me - 1 || d.getDate() !== g) return null;
  return d;
}

/**
 * La copia di sicurezza piu' recente e COMPLETA, o null.
 *
 * ⚠️ «Completa» vuol dire che contiene `05_conteggi.txt`, che il backup
 * scrive verso la fine: una cartella lasciata da un backup interrotto ha
 * il nome con l'ora giusta e dentro non ha niente su cui contare le
 * righe. Sarebbe **una copia recente che non e' una copia**, cioe' la
 * cosa peggiore — un freno che si lascia soddisfare da un guscio.
 */
export function copiaPiuRecente(cartella) {
  const radice = cartella || path.join(homedir(), "Desktop", "Backup Borgo 58");
  if (!existsSync(radice)) return null;
  let migliore = null;
  for (const voce of readdirSync(radice, { withFileTypes: true })) {
    if (!voce.isDirectory()) continue;
    const quando = quandoDalNome(voce.name);
    if (!quando) continue;
    if (!existsSync(path.join(radice, voce.name, "05_conteggi.txt"))) continue;
    if (!migliore || quando > migliore.quando) {
      migliore = { nome: voce.name, quando, dove: path.join(radice, voce.name) };
    }
  }
  return migliore;
}

/**
 * Decide se si puo' procedere. Restituisce **null se va bene**, altrimenti
 * la frase che dice cosa non va — in italiano, perche' finisce davanti a
 * chi lancia il comando.
 *
 * ⚠️ I casi sono TRE e non due, ed e' la differenza che conta: «non c'e'
 * nessuna copia» e «la copia e' vecchia» sono due guai diversi e mandano
 * a guardare in due posti diversi. Un rifiuto unico li confonderebbe.
 */
export const oreTonde = (ore) => Math.round(ore * 10) / 10;

export function backupTroppoVecchio(copia, adesso, oreMassime) {
  if (!copia) {
    return "Non trovo nessuna copia di sicurezza completa sul Desktop.";
  }
  const ore = (adesso.getTime() - copia.quando.getTime()) / 3_600_000;
  if (ore < 0) {
    // Una copia «del futuro» non e' un caso da scuola: succede se l'orologio
    // del computer e' stato spostato, e allora tutti i conti sull'eta' sono
    // senza senso. Si rifiuta invece di far finta di sapere.
    return `La copia piu' recente (${copia.nome}) risulta fatta nel futuro: l'orologio del computer non torna.`;
  }
  if (ore > oreMassime) {
    // ⚠️ Un decimale, non l'intero: con l'arrotondamento in giu' una copia di
    //    mezz'ora si legge «ha 0 ore, e il limite e' 0», che sembra un errore
    //    del programma invece di un rifiuto.
    return `La copia piu' recente (${copia.nome}) ha ${oreTonde(ore)} ore, e il limite e' ${oreMassime}.`;
  }
  return null;
}
