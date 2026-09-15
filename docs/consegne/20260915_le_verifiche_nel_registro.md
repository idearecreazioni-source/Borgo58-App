# 15/09/2026 — Le verifiche nel registro, senza scaricarlo tutto

Ramo `lapidi-delle-verifiche`, da master `e2e76b2422b10a10b6ccf344406dfbe81dc255dc`.
Commit sotto questo riepilogo: **`b39b11222deec91f25ee2ca2b949b94e536cec77`**; copia di lavoro
pulita al momento della scrittura.

> ⚠️ **Migrazione `20260915000001` SCRITTA E NON APPLICATA** — né sul progetto di prova né in
> produzione. Deciso da Alessio il 15/09: l'applicazione richiede una sua autorizzazione separata.

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

## Verifiche fatte (locali, nessun database)

- `npm run lint`: 0 avvisi · `npm run build`: riuscita.
- `npm run test`: **1391 / 1393**. Le 2 rosse — `indice-richieste`, `indice-rovesciamenti` —
  leggono documenti di `docs/` che questa consegna non tocca, e che in questa copia hanno i fine riga
  di Windows; nell'ultima copia a fine riga Unix (audit del 15/09 notte) erano 1393 / 1393.
- Progetto di prova, sola lettura, dopo il commit: `20260915000001` assente da `applied_migrations`,
  `lapidi_delle_verifiche` assente dal catalogo.

## Cosa NON è verificato

- **Il blocco di verifica della migrazione non è mai stato eseguito**: nessun database a
  disposizione. Applicare sul progetto di prova è vietato fino all'autorizzazione, e
  `npm run ricostruzione:verifica` crea il suo database sullo **stesso motore** del progetto di
  prova, quindi escluso anch'esso.
- **Le tre prove toccate non sono mai girate.** Finché la migrazione non è sul progetto di prova sono
  **rosse per costruzione** (la funzione non esiste; `funzioni-senza-schermata` la troverebbe
  dichiarata e assente). Per questo i due commit portano `[skip ci]` e i controlli di GitHub non
  sono partiti.
- Il tempo della funzione nuova **chiamata col token del titolare** non è misurato: misurato solo il
  filtro equivalente, come `postgres`.
- **Il tetto si sposta, non sparisce**: il costo resta proporzionale al registro (una parola invece
  di sei, nessuna riga da spedire). Quando si riavvicinerà agli 8 s **non è misurato**. Toglierlo
  davvero vuol dire decidere del registro del progetto di prova (una pulizia, cioè una scrittura), e
  quella decisione è di Alessio.
- Revisione Codex del diff: non fatta.
- Il rosso della notte precedente (`tesoreria.test.js`, corridoio dato per assente) resta non
  spiegato: questa consegna non lo tocca.

## Ordine, quando Alessio autorizzerà

Commit → push (fatto) → `npm run prova:migra` → controlli di GitHub verdi (rilanciati togliendo
`[skip ci]`) → merge → `npm run migra -- --conferma` in produzione, secondo §2. Nessuno di questi
passi è stato fatto.

## Cosa abbiamo rovesciato

- **Cosa era stato deciso e quando:** niente di già deciso viene cambiato.
- **La ragione di allora:** —
- **Cosa si decide adesso:** la prova fa la stessa domanda di prima in forma più stretta;
  `lapidi_di_prova()` resta com'è.
- **Perché la ragione di allora non vale più:** — (sezione vuota, dichiarata vuota).
