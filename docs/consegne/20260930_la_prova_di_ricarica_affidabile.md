# La prova di ricarica affidabile

**30/09/2026** · mandato M20-B · ramo `claude/ricostruzione-affidabile` ·
base `slave` `609b23d` · commit sotto questo riepilogo `633e72a` ·
**nessuna migrazione**, niente applicato su Prova né in produzione.

---

## Il problema, misurato

`npm run ricostruzione:verifica` del 30/09 notte (M19-E): **72 fermate**,
registro di **342 righe su 411 file**, e il referto diceva comunque «il
registro qui sopra risulta completo». L'audit M20-A ha trovato due cause
primarie e 62 effetti a catena:

1. dal 28/08 (`733ed25`) lo strumento applica ogni migrazione in **una
   transazione**: le migrazioni che nella storia vera erano entrate **a
   metà**, sanate più tardi, ora sparivano per intero, e tutto ciò che le
   seguiva si fermava a catena;
2. la verifica della `20260820000010` confronta `current_date` (fuso della
   sessione, UTC) con la data italiana della riga. **Misurato il 30/09 alle
   01:50** in sola lettura su Prova: `current_date` = 2026-09-29, data
   italiana = 2026-09-30; con `set local timezone = 'Europe/Rome'`,
   `current_date` = 2026-09-30.

## Cosa cambia

| File | Che cosa |
|---|---|
| `scripts/ricostruzione-regole.mjs` | nuovo: le **8 eccezioni storiche**, una per riga, ognuna col messaggio con cui deve fermarsi; il modo di applicazione; la classificazione delle fermate; l'esito del registro **per versione**; l'esito complessivo |
| `scripts/ricostruzione-verifica.mjs` | usa le regole; moncone di `storage.objects` scrivibile come su Supabase vero; referto in quattro parti; tutte le differenze di schema stampate; database usa-e-getta buttato anche se lo strumento si ferma a metà, e «buttato» detto solo dopo averlo controllato |
| `tests/unita/ricostruzione-regole.test.js` | 23 prove pure |
| `docs/decisioni_rovesciate.md` | rovesciamento n. 96, e l'indice rigenerato |

Le eccezioni:

| Versione | Come | Fermata attesa | Chi la registra |
|---|---|---|---|
| `20260820000010` | fuso di Roma, atomica | nessuna | se stessa |
| `20260822000003` | a metà | `item_has_source` | `20260825000012` |
| `20260823000024` | a metà | «Sono sparite le ricette» | `20260825000012` |
| `20260824000033` | a metà | «Nessuna previsione libera» | `20260825000012` |
| `20260827000018` | a metà | «Il pareggio di istante sceglie a caso» | `20260828000007` |
| `20260917000001` | atomica | «manca il segreto «url_funzioni»» | nessuna |
| `20260920000001` | atomica | «nominano ancora il gestionale vero» | nessuna |
| `20260921000001` | atomica | «nella forma uuid + jsonb, non esiste» | `20260921000002` |

**I comandi veri non cambiano**: `argomentiMigrazione()` in `comune.mjs` non
è toccato, e una prova lo controlla.

Il moncone del deposito: misurato in sola lettura su Prova, `anon`,
`authenticated` e `service_role` hanno `select/insert/update/delete` su
`storage.objects` e `storage.buckets`. Il moncone dava solo `select`, e la
`20260910000003` si fermava su «permission denied for table objects».

## Prove

- `tests/unita/ricostruzione-regole.test.js`: 23 su 23. **Rotture provate**
  e rimesse: registro confrontato per conteggio invece che per versione → 1
  rossa (quella giusta); eccezione accettata con qualunque messaggio → 2
  rosse.
- `npm run test`: **1932 su 1932** in 128 file. `npm run lint`: zero.
  `npm run build`: riuscita. `git diff --check`: pulito.
- `npm run ricostruzione:verifica`: **una sola corsa** (01:56 → 02:17 del
  30/09), sul codice di `51b796f`, identico per gli script a questo commit.
  `ricostruzione_prova` assente prima e dopo, controllato in sola lettura.

## L'esito della corsa — rosso, e dice perché

- **Eccezioni note**: 8 applicate; **7 fermate col messaggio atteso**; la
  `20260820000010` **non si è fermata**.
- **Errori inattesi: 4**, riportati e **non** trasformati in eccezioni:
  - `20260826000013` — «Il tetto senza autore dice «Nessun tetto…»»: la
    verifica presume un tetto già impostato;
  - `20260827000006` — «La lista della spesa si e' fermata su un prodotto
    noto»;
  - `20260827000017` — «Un identificativo passato a mano e' arrivato in
    tabella»;
  - `20260829000006` — «Verifica impossibile: nessuna partita con scadenza
    in giacenza»: la verifica presume partite in magazzino.
- **Registro**: 411 file, 406 righe, **incompleto**: mancano
  `20260826000013`, `20260827000006`, `20260827000017` (inattese),
  `20260917000001`, `20260920000001` (eccezioni note).
- **Differenze di schema: 35**, tutte **solo nella prova**, e ognuna viene
  da una migrazione che qui non è entrata: 33 dalla `20260917000001` (sette
  funzioni, le tabelle `invii_promemoria` e `consegne_telegram` con colonne,
  indici, vincoli e policy), 1 dalla `20260920000001`
  (`url_funzioni_configurato`), 1 dalla `20260826000013`
  (`chi_ha_messo_il_tetto`). Origine controllata cercando dove ciascun
  oggetto viene creato.

## Cosa non è verificato

- **Che l'esito non dipenda dall'ora non è stato visto in una corsa dentro la
  finestra 00–02**: la corsa ha applicato la `20260820000010` dopo le 02:00.
  È dimostrato il meccanismo (misura delle 01:50) e che la sessione di quella
  migrazione riceve il fuso di Roma (prova pura), non una corsa notturna.
- **Le 4 fermate inattese non sono state indagate**: due sono verifiche che
  presumono dati, due non le ho classificate.
- La `20260827000018` si ferma col messaggio atteso, ma **il perché del
  12,00** è quello scritto nella `20260828000007`, non rimisurato qui.

## Cosa abbiamo rovesciato

Il n. 96 in `docs/decisioni_rovesciate.md`: dal 28/08 la prova di ricarica
applicava ogni migrazione con la regola della produzione. Adesso vale per
tutte tranne otto eccezioni storiche elencate. La ragione di allora vale
ancora per ogni migrazione nuova, ed è il motivo per cui le eccezioni sono un
elenco chiuso e non una data di taglio.
