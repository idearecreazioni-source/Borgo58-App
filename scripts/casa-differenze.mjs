// COSA PORTA UN AGGIORNAMENTO A CASA (01/11/2026) — la parte che DECIDE di
// `npm run casa:aggiorna`, tenuta senza disco e senza git perche' si provi
// a tavolino (tests/unita/casa-differenze.test.js).
//
// Casa e' il gestionale vero con meno pezzi accesi: le funzioni del server
// sono tutte spente tranne FUNZIONI_DI_CASA, i lavori pianificati sono
// spenti, il cloud e' chiuso. Un aggiornamento puo' funzionare nel
// gestionale vero e restare a meta' su Casa: e' successo con «Colloca» il
// 01/11, arrivato senza la funzione che gli serviva. Qui si guarda PRIMA,
// e si dice ad Alessio cosa non funzionera' e perche'.
//
// ⚠️ Non ferma niente da solo: un avviso e' un'informazione, la decisione
//    di adattare Casa resta di Alessio (decisione del 01/11).

/**
 * Le funzioni del server nominate da righe di codice dell'app.
 * ⚠️ Le righe si leggono INSIEME: in src/lib/api il nome sta spesso sulla
 *    riga dopo `chiamaFunzione(`.
 */
export function funzioniChiamate(righe) {
  const testo = righe.join("\n");
  const nomi = new Set();
  const modi = [
    /chiamaFunzione\w*\(\s*["'`]([a-z0-9-]+)["'`]/g,
    /functions\.invoke\(\s*["'`]([a-z0-9-]+)["'`]/g,
    /\/functions\/v1\/([a-z0-9-]+)/g,
  ];
  for (const modo of modi) for (const m of testo.matchAll(modo)) nomi.add(m[1]);
  return [...nomi].sort();
}

/** Le righe aggiunte da un diff unificato, per file: { file: [righe] }. */
export function righeAggiunte(diff) {
  const perFile = {};
  let file = null;
  for (const riga of String(diff ?? "").split(/\r?\n/)) {
    // ⚠️ Un'intestazione e' «+++ b/…» o «+++ /dev/null» (file tolto): una
    //    riga aggiunta che comincia con «++» resta una riga.
    const nome = /^\+\+\+ (?:b\/(.+)|\/dev\/null)$/.exec(riga);
    if (nome) {
      file = nome[1] ?? null;
      if (file) perFile[file] ??= [];
    } else if (file && riga.startsWith("+")) {
      perFile[file].push(riga.slice(1));
    }
  }
  return perFile;
}

const senzaCommentiSql = (testo) => testo.replace(/--[^\n]*/g, "").replace(/\/\*[\s\S]*?\*\//g, "");

/**
 * Cosa cambia per Casa.
 *
 * @param file            i percorsi cambiati (git diff --name-only)
 * @param fileNuovi       i percorsi aggiunti (git diff --name-only --diff-filter=A)
 * @param aggiunte        le righe aggiunte per file (righeAggiunte)
 * @param migrazioniNuove { nome, testo } delle migrazioni da applicare
 * @param funzioniDiCasa  le funzioni accese su Casa
 * @returns {{ migrazioni: string[], funzioniDaRiavviare: string[], npmCi: boolean, avvisi: string[] }}
 */
export function differenzePerCasa({ file, fileNuovi = [], aggiunte, migrazioniNuove, funzioniDiCasa }) {
  const avvisi = [];
  const accese = new Set(funzioniDiCasa);

  for (const { nome, testo } of migrazioniNuove) {
    const sql = senzaCommentiSql(testo);
    if (/\bcron\s*\.\s*(schedule\w*|alter_job)\s*\(/i.test(sql)) {
      avvisi.push(`${nome}: programma un lavoro automatico. Su Casa i lavori restano spenti: quello che fa, su Casa non succede da solo.`);
    }
    if (/\bnet\s*\.\s*http_\w+\s*\(/i.test(sql)) {
      avvisi.push(`${nome}: fa chiamate di rete dal database. Su Casa il cloud è chiuso: quella parte non risponderà.`);
    }
  }

  const funzioniCambiate = new Set(
    file.map((f) => /^supabase\/functions\/([^/]+)\//.exec(f)?.[1]).filter((n) => n && n !== "_shared"),
  );
  const condiviseCambiate = file.some((f) => f.startsWith("supabase/functions/_shared/"));
  const funzioniDaRiavviare = funzioniDiCasa.filter((n) => funzioniCambiate.has(n) || condiviseCambiate);
  // Una funzione NUOVA nasce spenta su Casa: va detto anche se l'app non la chiama ancora.
  for (const nome of [...new Set(fileNuovi.map((f) => /^supabase\/functions\/([^/]+)\/index\.ts$/.exec(f)?.[1]))].filter(Boolean).sort()) {
    if (nome !== "_shared" && !accese.has(nome)) avvisi.push(`supabase/functions/${nome}: funzione nuova, su Casa resta spenta.`);
  }
  if (file.includes("supabase/config.toml")) {
    avvisi.push("supabase/config.toml: la configurazione del gestionale è cambiata; quella di Casa (C:\\Casa\\supabase) no. Va guardata a mano.");
  }

  const perFunzione = new Map();
  for (const [percorso, righe] of Object.entries(aggiunte)) {
    if (!/^src\//.test(percorso)) continue;
    for (const nome of funzioniChiamate(righe)) {
      if (accese.has(nome)) continue;
      if (!perFunzione.has(nome)) perFunzione.set(nome, []);
      perFunzione.get(nome).push(percorso);
    }
  }
  for (const [nome, dove] of [...perFunzione].sort(([a], [b]) => a.localeCompare(b))) {
    avvisi.push(`${dove.join(", ")}: usa la funzione «${nome}», che su Casa è spenta. Quella parte su Casa risponderà con un errore.`);
  }

  return {
    migrazioni: migrazioniNuove.map((m) => m.nome),
    funzioniDaRiavviare,
    npmCi: file.includes("package-lock.json"),
    avvisi,
  };
}

/** I titoli delle PR unite, dai messaggi dei merge (git log --merges --format=%s%x1f%b%x1e). */
export function titoliDellePr(log) {
  return String(log ?? "")
    .split("\x1e")
    .map((voce) => voce.trim())
    .filter(Boolean)
    .map((voce) => {
      const [oggetto, corpo = ""] = voce.split("\x1f");
      const numero = /#(\d+)/.exec(oggetto)?.[1];
      // Senza titolo nel merge resta il nome del ramo, che di solito dice cosa fa.
      const titolo = corpo.trim().split(/\r?\n/)[0]?.trim() || / from [^/\s]+\/(\S+)/.exec(oggetto)?.[1];
      return numero ? `#${numero} ${titolo || oggetto.trim()}` : oggetto.trim();
    });
}
