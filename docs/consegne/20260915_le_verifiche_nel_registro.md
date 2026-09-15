# 15/09/2026 — Le verifiche nel registro, senza scaricarlo tutto

Ramo `lapidi-delle-verifiche`, da master `e2e76b2422b10a10b6ccf344406dfbe81dc255dc`.
Commit del codice sotto questo riepilogo: **`b39b11222deec91f25ee2ca2b949b94e536cec77`**
(i commit successivi toccano solo questo file); copia di lavoro pulita al momento della scrittura.

> ⚠️ **Migrazioni `20260915000001` e `20260915000002`: applicate SOLO sul progetto di prova**
> (15/09, 12:41:49 e 13:24:45 UTC, autorizzazioni di Alessio). **NON in produzione**: quella resta un
> passo separato, dopo il merge, con una sua autorizzazione. Il commit della 002 sta sopra quello del
> codice indicato qui sotto.

## Perché

Master `e2e76b2` (unione della #76) è rosso sulla prova contro il database di prova. Rilanciato una
volta il 15/09 (giro 34917192057, tentativo 2), è tornato rosso su:

```
tests/app/registri-esibibili.test.js > il registro delle cancellazioni non conserva le righe delle verifiche
→ 57014 «canceling statement due to statement timeout»   (riga 166: titolare.rpc("lapidi_di_prova"))
```

Misurato sul progetto di prova, **in sola lettura**, il 15/09:

| misura | valore |
|---|---|
| `statement_timeout` di `authenticated` | 8 s |
| righe in `deleted_records` | 68.891 (49 MB) |
| righe restituite da `lapidi_di_prova()` | 65.818 — 11 MB di risposta |
| righe che la prova usava («verifica di una migrazione») | **0** |
| `lapidi_di_prova()` + impacchettamento JSON, come fa PostgREST | 5,28 s |
| la stessa prova nei registri di GitHub | 4,4 s (12/09) · 5–6 s (notte 14–15/09) · **8,26 s** (15/09, interrotta) |
| crescita del registro | 1.118 – 6.497 righe al giorno dal 02 al 14/09, lasciate dalle prove stesse |
| solo il filtro «verifica» (`count(*)`) | 0,80 – 1,06 s, zero righe |

La #76 non c'entra: tocca `ritardo.js`, `PiantaGiornata.jsx`, `SalaEOrari.jsx`.

## Cosa cambia

- **`supabase/migrations/20260915000001_le_verifiche_nel_registro_senza_scaricarlo.sql`** —
  nuova `lapidi_delle_verifiche()`: solo la prima categoria di `lapidi_di_prova()`, **stesso
  filtro** (`record::text ilike '%verifica%'`) e stessa firma leggibile. `security invoker` — il
  registro lo legge già solo il titolare per RLS — con un portiere che **rifiuta** chi titolare non
  è. `revoke` a `public, anon, authenticated`, `grant` al solo `authenticated`.
  Blocco di verifica: la forma (non definer, chiusa ad `anon`, aperta ad `authenticated`); due
  lapidi costruite **direttamente nel registro** (una con «verifica», una di prova senza), la prima
  restituita e la seconda no; accordo con `lapidi_di_prova()` sulle due lapidi e nel conteggio
  totale; lo staff riceve un rifiuto; pulizia per identificativo e `pretendi_nessun_residuo`.
  `lapidi_di_prova()` **non è toccata**.
- **`tests/app/registri-esibibili.test.js`** — la prova chiede `lapidi_delle_verifiche()`; nuova
  prova: lo staff riceve un rifiuto, non un elenco vuoto.
- **`tests/app/funzioni-senza-schermata.test.js`** — la funzione nuova dichiarata fra le reti.

Nessuna schermata, nessun codice dell'app, nessuna funzione online.

## L'applicazione sul progetto di prova (15/09, 12:41 UTC)

- **Collegamento controllato prima**: `DB_URL_PROVA` nomina `bnwqgpuyzmzujxfbtyvs` e non
  `oudjuqbqszisdtwzbxdo`; messo in un `.env` **temporaneo** della copia, con quella sola riga,
  ignorato da git e **cancellato subito dopo**.
- **Una sola migrazione, per nome**: `npm run prova:migra -- 20260915000001`. Prima di applicare,
  in sola lettura: 391 migrazioni sul disco, 390 sul progetto di prova, l'unica mancante era questa.
- **Esito**: `NOTICE: Verifica passata: la domanda stretta vede la verifica, non la prova, e conta
  come lapidi_di_prova.` — il blocco di verifica è arrivato in fondo, quindi anche
  `pretendi_nessun_residuo`. Il progetto di prova ha **391** migrazioni registrate.
- **Dopo, in sola lettura**: `20260915000001` registrata alle 12:41:49 UTC; la funzione è
  `security_definer = false`, `search_path=public`, **non** eseguibile da `anon`, eseguibile da
  `authenticated`; nessuna lapide della verifica rimasta nel registro.
- **Tempo**: `lapidi_delle_verifiche()` chiamata coi claims del titolare risponde **0 righe in
  0,93 s** (contro i 5,28 s della domanda larga).

## Il primo giro dei controlli (commit `dd85a7c`) e la correzione `20260915000002`

- **Esito del primo giro: rosso su una prova sola, 566 / 567.** `registri-esibibili` è passata
  (la prova delle lapidi in **3,19 s**, era 8,26 s e interrotta). È diventata rossa
  `funzioni-senza-schermata`: «Queste hanno una porta adesso: toglile da ORFANE_NOTE» →
  `['lapidi_di_prova']`.
- **Causa, misurata in sola lettura sul progetto di prova:** il corpo di `lapidi_delle_verifiche()`
  nominava `lapidi_di_prova` **in un commento**, e `funzioni_senza_chiamante()` cerca il nome a
  parola intera (`~ '\m<nome>\M'`) nel testo delle funzioni, commenti compresi. Difetto della 001.
- **Correzione: `20260915000002_un_nome_in_un_commento_non_e_una_chiamata.sql`.** Ricrea la
  funzione dal corpo vivo del progetto di prova cambiando solo quel commento (la 001, già applicata,
  non si riscrive). Nessun `grant` riscritto: `create or replace` non tocca i permessi, e la
  verifica li controlla. La verifica pretende con **lo stesso criterio della rete** che nessun altro
  corpo nomini `lapidi_di_prova`, che `funzioni_senza_chiamante()` la veda di nuovo orfana (e veda
  orfana anche la nuova), e che il comportamento non cambi (due lapidi apposta, accordo con
  `lapidi_di_prova()`, rifiuto allo staff, nessun residuo).
- 🔴 **Il primo tentativo della 002 si è fermato sulla sua stessa verifica** (13:21 UTC): cercava il
  nome con `like`, dove `_` vale «un carattere qualunque», e le parole «lapidi di prova» del commento
  nuovo combaciavano. **Annullato per intero** (`npm run prova:migra` usa una transazione sola):
  misurato dopo dal catalogo, corpo ancora quello della 001, 002 non registrata, nessuna lapide
  rimasta. Il file è stato corretto — non era mai stato registrato né spinto — con il criterio della
  rete.
- **Secondo tentativo (15/09, 13:24:42–13:25:03 UTC), solo sul progetto di prova**, con lo stesso
  metodo della 001 (collegamento controllato, `.env` temporaneo con la sola `DB_URL_PROVA` e
  cancellato subito dopo, 392 sul disco e 391 sul progetto, l'unica mancante per nome):
  `NOTICE: Verifica passata: nessun altro corpo nomina lapidi_di_prova, che torna fra le orfane;
  il comportamento non cambia.` — **392** migrazioni registrate. **Non in produzione.**

## Verifiche fatte (locali)

- `npm run lint`: 0 avvisi · `npm run build`: riuscita.
- `npm run test`: **1391 / 1393**. Le 2 rosse — `indice-richieste`, `indice-rovesciamenti` —
  leggono documenti di `docs/` che questa consegna non tocca, e che in questa copia hanno i fine riga
  di Windows; nell'ultima copia a fine riga Unix (audit del 15/09 notte) erano 1393 / 1393.

## Cosa NON è verificato

- **Le prove sul database**: partono con il commit di questo riepilogo (i due precedenti erano
  `[skip ci]`, perché senza la funzione sul progetto di prova sarebbero state rosse per costruzione).
  L'esito sta nella proposta, non qui.
- Il tempo **attraverso PostgREST, col token vero** del titolare: misurato solo coi claims, come
  `postgres`.
- **Il tetto si sposta, non sparisce**: il costo resta proporzionale al registro (una parola invece
  di sei, nessuna riga da spedire). Quando si riavvicinerà agli 8 s **non è misurato**. Toglierlo
  davvero vuol dire decidere del registro del progetto di prova (una pulizia, cioè una scrittura), e
  quella decisione è di Alessio.
- Revisione Codex del diff: non fatta.
- Il rosso della notte precedente (`tesoreria.test.js`, corridoio dato per assente) resta non
  spiegato: questa consegna non lo tocca, e può ripresentarsi.

## Cosa manca per il merge

Controlli di GitHub verdi sulla testa della proposta → ok di Alessio al merge → **il merge pubblica
da solo** (la pubblicazione automatica è accesa: insieme alla #87 va online anche la #76) →
`npm run migra -- --conferma` in produzione, con un'autorizzazione separata, secondo §2. La funzione
nuova la usa solo una prova, quindi il sito pubblicato non dipende dalla migrazione in produzione.

## Cosa abbiamo rovesciato

- **Cosa era stato deciso e quando:** niente di già deciso viene cambiato.
- **La ragione di allora:** —
- **Cosa si decide adesso:** la prova fa la stessa domanda di prima in forma più stretta;
  `lapidi_di_prova()` resta com'è.
- **Perché la ragione di allora non vale più:** — (sezione vuota, dichiarata vuota).
