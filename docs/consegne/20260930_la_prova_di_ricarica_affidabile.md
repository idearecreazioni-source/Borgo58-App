# La prova di ricarica affidabile

**30/09/2026** · mandato M20-B · ramo `claude/ricostruzione-affidabile` ·
base `slave` `609b23d` · commit sotto questo riepilogo `e0c5498` ·
**nessuna migrazione**, niente applicato su Prova né in produzione.

> 🔴 **Stato al 01/10/2026 — il modello di oggi è 10 eccezioni storiche + 1
> preparazione temporanea della prova** (la `20260826000013`). Le sezioni qui
> sotto sono in ordine di tempo e conservano i conteggi di allora (8, poi 10,
> poi 11): lo stato corrente è nell'ultimo aggiornamento, quello della corsa
> 039.

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
| `scripts/ricostruzione-regole.mjs` | nuovo: le **8 eccezioni storiche** *(prima stesura; oggi 10 + 1 preparazione)*, una per riga, ognuna col messaggio con cui deve fermarsi; il modo di applicazione; la classificazione delle fermate; l'esito del registro **per versione**; l'esito complessivo |
| `scripts/ricostruzione-verifica.mjs` | usa le regole; moncone di `storage.objects` scrivibile come su Supabase vero; referto in quattro parti; tutte le differenze di schema stampate; database usa-e-getta buttato anche se lo strumento si ferma a metà, e «buttato» detto solo dopo averlo controllato |
| `tests/unita/ricostruzione-regole.test.js` | 25 prove pure |
| `docs/decisioni_rovesciate.md` | rovesciamento n. 96, e l'indice rigenerato |

Le eccezioni:

| Versione | Come | Fermata attesa | Chi la registra |
|---|---|---|---|
| `20260820000010` | fuso di Roma, atomica | nessuna | se stessa |
| `20260822000003` | a metà | `item_has_source` (nome del vincolo, definito nella `20260804000005`) | `20260825000012` |
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

- `tests/unita/ricostruzione-regole.test.js`: 25 su 25. **Rotture provate**
  e rimesse: registro confrontato per conteggio invece che per versione → 1
  rossa (quella giusta); eccezione accettata con qualunque messaggio → 2
  rosse.
- **Provenienza dei messaggi attesi** (rilievo di Codex sulla #143, corretto
  in `e0c5498`): la prima stesura escludeva per nome `item_has_source`, che
  non sta nel file della `20260822000003`. Ora l'eccezione dichiara
  `origineAttesa: 20260804000005`, nessun messaggio è escluso, e ognuno deve
  stare nel **codice** (non in un commento) del proprio file o dell'origine
  dichiarata. Una prova segue la catena: vincolo su `order_items`, nessuna
  ridefinizione prima della `20260822000003`, ricetta presa da `select id
  from recipes limit 1`, inserimento senza nome libero, nessun `raise` prima.
  Rotture: senza origine → 2 rosse; origine sbagliata → 2 rosse.
- `npm run test`: **1934 su 1934** in 128 file. `npm run lint`: zero.
  `npm run build`: riuscita. `git diff --check`: pulito.
- `npm run ricostruzione:verifica`: **una sola corsa** (01:56 → 02:17 del
  30/09), sul codice di `51b796f`. ⚠️ Dopo quella corsa `e0c5498` ha aggiunto
  all'eccezione della `20260822000003` il solo campo `origineAttesa`, che lo
  strumento non legge: serve alla prova. **La corsa non è stata rifatta.**
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

## Aggiornamento del 30/09 pomeriggio — due eccezioni in più (M20-D, M20-E, M20-E2)

Ramo `claude/ricostruzione-due-eccezioni`, base `slave` `738b3ba`. Tre file:
`scripts/ricostruzione-regole.mjs`, `tests/unita/ricostruzione-regole.test.js`
e questo riepilogo. **Nessuna migrazione**, `ricostruzione-verifica.mjs` e
`comune.mjs` non toccati.

⚠️ **Tutto ciò che sta SOPRA questa sezione descrive la prima corsa**
(01:56 → 02:17) con 8 eccezioni, e resta com'era scritto. Quello che segue è
lo stato dopo la seconda.

**L'audit M20-D** (sola lettura) ha classificato le 4 fermate inattese:

| Versione | Cosa è | Dove sta scritto |
|---|---|---|
| `20260827000006` | storia nota: la verifica prende in prestito un ingrediente (`select name … from ingredients … limit 1`), in produzione è entrata **a metà** | intestazione della `20260827000017`, che rifà il controllo e **la registra** |
| `20260827000017` | effetto a catena della precedente: senza la riscrittura di `fai_azione_dettata` fatta dalla `20260827000006`, il suo controllo 5 trova l'identificativo in tabella | il suo stesso controllo 5 |
| `20260829000006` | guardia voluta: si rifiuta su un magazzino vuoto | intestazione della `20260829000022`, che reinstalla lo stesso corpo e **la registra** |
| `20260826000013` | verifica che presume un dato: un tetto di spesa già impostato. La `20260825000013` crea la riga col tetto vuoto e **nessuna migrazione lo imposta**; nessuna migrazione la registra | — |

**Le due eccezioni aggiunte** (ora sono **dieci**):

| Versione | Come | Fermata attesa | Chi la registra |
|---|---|---|---|
| `20260827000006` | a metà | «si e' fermata su un prodotto noto» | `20260827000017` |
| `20260829000006` | atomica | «nessuna partita con scadenza in giacenza» | `20260829000022` |

**Nessuna eccezione per la `20260826000013`**, e una prova lo fissa.

**Prove** — `tests/unita/ricostruzione-regole.test.js`: **34 su 34**. Le nove
nuove dimostrano che la `20260827000017` registra la `20260827000006` e se
stessa; che la `20260829000022` registra la `20260829000006`; che **ogni**
sanatrice dichiarata registra davvero la versione che sana; che un messaggio
diverso da quello atteso resta inatteso; che la `20260827000017` non è
un'eccezione; che l'elenco è chiuso a dieci. Rotture provate e rimesse:
sanatrice sbagliata → 2 rosse; messaggio atteso inesistente → 2 rosse.
`npm run test`: **1943 su 1943**. ⚠️ Al primo giro completo erano comparse 4
rosse in file non toccati (`prove-che-costano`, `prove-saltate`, `pulizie`,
`tetto-del-giro`); rilanciate da sole 32 su 32, e il giro completo ripetuto è
verde. Intermittenti: **la causa non è stata misurata**.

**La seconda corsa — una sola, 16:28 → 16:39 del 30/09**, sul codice di
questo ramo (`738b3ba` più le due modifiche). `ricostruzione_prova` assente
prima e dopo, controllato in sola lettura. **Non è stata ripetuta** dopo la
modifica di questo riepilogo.

- **Eccezioni note**: 10 applicate, **9 fermate col messaggio atteso** —
  comprese `20260827000006` e `20260829000006`; la `20260820000010` non si è
  fermata.
- **La `20260827000017` non si è fermata**: non è più un errore inatteso.
- **Errori inattesi: 1** — la `20260826000013`.
- **Registro**: 411 file, **408 righe**, incompleto. Mancano **tre**:
  `20260826000013` (inattesa), `20260917000001` e `20260920000001`
  (eccezioni note senza sanatrice).
- **Differenze di schema: 35**, tutte solo nella prova (3257 elementi contro
  3292, come nella prima corsa): **33** dalla `20260917000001`, **1** dalla
  `20260920000001` (`url_funzioni_configurato`), **1** dalla `20260826000013`
  (`chi_ha_messo_il_tetto`).
  ⚠️ **Il valore 34 non vale nello stato attuale**: varrebbe solo dopo aver
  risolto la `20260826000013`. Era il numero atteso nel mandato M20-E, e per
  quella differenza il lavoro si è fermato prima del commit.
- **Esito**: rosso, dichiarato — «1 fermate inattese, registro incompleto (3
  mancanti, 0 senza file), 35 differenze di schema».

**Frasi di questo riepilogo diventate false**, lasciate sopra perché
raccontano la prima corsa: «le **8** eccezioni storiche» e «25 prove pure»
(ora 10 e 34); «Le 4 fermate inattese non sono state indagate» (indagate
nell'M20-D). Anche il rovesciamento n. 96 dice «tranne otto eccezioni»:
**sono dieci**, e quel file qui non è stato toccato.

## Aggiornamento del 30/09 sera — la `20260826000013` a metà (M20-G)

Ramo `claude/ricostruzione-tetto`, base `slave` `5a42890`. Quattro file:
`scripts/ricostruzione-regole.mjs`, `tests/unita/ricostruzione-regole.test.js`,
questo riepilogo e `docs/decisioni_rovesciate.md` (una nota in fondo al
n. 96). **Nessuna migrazione**; `ricostruzione-verifica.mjs` e `comune.mjs`
non toccati.

**L'eccezione aggiunta** (allora diventavano **undici**; ⚠️ superato il
01/10: la `20260826000013` è uscita dall'elenco, vedi l'ultimo aggiornamento):

| Versione | Come | Fermata attesa | Chi la registra |
|---|---|---|---|
| `20260826000013` | a metà | «Il tetto senza autore dice» | **nessuna** |

⚠️ **Non è una storia documentata come le altre a metà.** Per quelle, la
migrazione che le sana racconta che in produzione erano entrate a metà. Per
la `20260826000013` il riepilogo del 26/08 documenta **solo la prova**; come
sia andata in produzione **non è verificato** (il mandato vietava di
collegarsi). «A metà» è una **rappresentazione decisa** nel mandato M20-G,
per tenere nel database usa-e-getta la funzione che crea prima della
verifica.

**Prova statica** (prove pure, dal testo delle migrazioni):
- nel file della `20260826000013` l'ordine è: `create or replace function
  chi_ha_messo_il_tetto()` → `do $verifica$` → «Il tetto senza autore dice» →
  `insert into applied_migrations`;
- con il tetto vuoto la funzione risponde «Nessun tetto: le letture non si
  fermano mai da sole.», che è il messaggio con cui la verifica si ferma;
- **nessuna** migrazione successiva ricrea la funzione o nomina la versione,
  e nessuna eccezione la dichiara sanata.

**Prove**: `tests/unita/ricostruzione-regole.test.js` **38 su 38** (5 nuove).
Rotture provate e rimesse: resa atomica → 1 rossa; messaggio atteso
sbagliato → 2 rosse. ⚠️ La prova vecchia che usava la `20260826000013` come
esempio di «migrazione senza eccezione» ora usa la `20260827000017`.
`npm run test` prima della corsa: al primo giro **1 rossa per tempo scaduto**
(`letture.test.js`, oltre i 5 secondi, in un file non toccato), da sola 8 su
8; al secondo giro completo **1947 su 1947**. Lint zero, compilazione
riuscita, spazi puliti.

**La terza corsa — una sola, 21:11 → 21:22 del 30/09**, sul codice di
`5a42890` più le due modifiche. `ricostruzione_prova` assente prima e dopo,
controllato in sola lettura.
- **Eccezioni**: 11 applicate, **10 fermate col messaggio atteso**
  (`20260822000003`, `20260823000024`, `20260824000033`, `20260826000013`,
  `20260827000006`, `20260827000018`, `20260829000006`, `20260917000001`,
  `20260920000001`, `20260921000001`); la `20260820000010` non si è fermata.
- **Errori inattesi: nessuno.**
- **Registro**: 411 file, **408 righe**, incompleto. Mancano **tre**, tutte
  eccezioni note senza sanatrice: `20260826000013`, `20260917000001`,
  `20260920000001`.
- **Differenze di schema: 34**, tutte solo nella prova (3258 elementi contro
  3292): **33** dalla `20260917000001`, **1** dalla `20260920000001`
  (`url_funzioni_configurato`). `chi_ha_messo_il_tetto` **non è più** fra le
  differenze.
- **Esito**: rosso, dichiarato **solo** per registro incompleto e differenze
  di schema — «registro incompleto (3 mancanti, 0 senza file), 34 differenze
  di schema». **Nessuna fermata inspiegata.**

**Frasi di questo riepilogo diventate false**, lasciate sopra perché
raccontano le corse precedenti: «Nessuna eccezione per la `20260826000013`, e
una prova lo fissa»; «ora sono **dieci**»; «Errori inattesi: 1 — la
`20260826000013`»; «Differenze di schema: 35»; «La `20260826000013` resta
aperta: nessuna strada è stata scelta».

## Aggiornamento del 01/10 — la `20260826000013` è una preparazione della prova, non un'eccezione (M20-H, corsa 039, M20-Q)

Stesso ramo `claude/ricostruzione-tetto`, base `slave` `5a42890`, sopra
`512d470`. Cinque file: `scripts/ricostruzione-regole.mjs`,
`scripts/ricostruzione-verifica.mjs` (**toccato per la prima volta in questa
proposta**), `tests/unita/ricostruzione-regole.test.js`, questo riepilogo e
`docs/decisioni_rovesciate.md`. **Nessuna migrazione**; `comune.mjs` non
toccato. Il codice e questa sezione stanno nello **stesso commit**.

**Perché cambia (M20-H).** Della produzione si sa solo che
`chi_ha_messo_il_tetto()` esiste e che la versione è registrata: non il
valore del tetto, né come la migrazione ci sia arrivata. Chiamarla «a metà»
dichiarava una storia che nessuno ha misurato. Quindi esce dalle eccezioni.

**Il modello di oggi: 10 eccezioni storiche + 1 preparazione temporanea.**

| Versione | Che cos'è | Come si applica |
|---|---|---|
| le **10** della tabella del 30/09 pomeriggio (`20260820000010`, `20260822000003`, `20260823000024`, `20260824000033`, `20260827000006`, `20260827000018`, `20260829000006`, `20260917000001`, `20260920000001`, `20260921000001`) | eccezioni storiche | cinque a metà, una col fuso di Roma, quattro atomiche con fermata attesa |
| `20260826000013` | **preparazione della prova** (`PREPARAZIONI_PROVA`), **non** un'eccezione | atomica come in produzione; **subito prima**, e solo nel database usa-e-getta `ricostruzione_prova`, `update impostazioni_ai set tetto_mensile_euro = 10 where id;` |

- **Perché serve**: la verifica (A) della migrazione pretende una riga di
  `impostazioni_ai` col tetto **valorizzato** e `tetto_da` **vuoto** (con il
  tetto vuoto la funzione risponde «Nessun tetto…» e la verifica si ferma).
  La riga nasce dalla `20260825000013` col tetto vuoto, e nessuna migrazione
  lo imposta.
- **Cosa scrive**: solo la colonna del tetto, sull'unica riga della tabella
  (`id` è un booleano chiave primaria). Il valore 10 sta nel vincolo
  `tetto_sensato` (1..1000) ed è lo stesso ripiego che usa la verifica.
  `tetto_da`, `tetto_il` e i campi di sblocco restano vuoti. **È un valore
  finto della prova**: nessun valore di produzione è noto, letto, copiato o
  citato.
- **Dove scrive**: attraverso `applica()`, che usa `url` — l'indirizzo della
  Prova con il nome del database sostituito da `ricostruzione_prova`, il
  database usa-e-getta che lo strumento crea all'inizio e butta alla fine.
  Mai sul database `postgres` della Prova, mai in produzione.

**`--senza-produzione`** (in `scripts/ricostruzione-verifica.mjs`):
l'elenco degli argomenti è chiuso, e un argomento sconosciuto ferma lo
strumento. Con l'argomento, ogni chiave di configurazione che contiene
«PRODUZIONE» viene scartata appena letto `.env`, e il referto stampa
«produzione: esclusa». Lo strumento legge una sola chiave (`DB_URL_PROVA`,
che passa da `soloProva()`), e ogni collegamento usa soltanto quella o il
database usa-e-getta derivato. Nessun collegamento, credenziale o indirizzo
nuovo.

**Prove**: `tests/unita/ricostruzione-regole.test.js` **44 su 44**. Fissano:
- l'elenco chiuso a dieci, e la `20260826000013` **assente**;
- la preparazione presente **solo** per quella versione, uguale alla riga
  sopra, senza campi di autore, date o inserimenti, dichiarata «fixture»;
- che soddisfa il prerequisito della verifica (A);
- che nello strumento viene **prima** della migrazione, con una sola
  chiamata;
- che una fermata della `20260826000013`, senza eccezione, resta
  **inattesa**;
- `--senza-produzione`: argomenti chiusi, chiavi di produzione scartate,
  nessun'altra lettura della configurazione, ogni collegamento solo verso la
  Prova o il database usa-e-getta.

⚠️ In questo giro **nessuna rottura è stata provata**: il mandato M20-Q
vietava di modificare codice e prove. Che diventino rosse è letto dal loro
testo, non misurato.

**Le corse.** La 035 e la 037 non hanno prodotto referto. La 037 è stata
uccisa alle 00:35 del 01/10, quando la sessione che l'aveva lanciata ha
chiuso il turno (il suo file d'uscita dice solo `[killed]`), e ha lasciato
`ricostruzione_prova` sulla Prova: l'ha tolta il mandato M20-N, con una sola
istruzione e senza modalità forzata. **Nessuna delle due è stata ripresa.**

**La corsa 039 — una sola, 12:07:23 → 12:26:40 del 01/10**, lanciata da
un'attività pianificata di Windows (utente corrente, senza privilegi di
amministratore), sul codice di `512d470` più le tre modifiche di questo
commit. `ricostruzione_prova` era assente prima, controllato in sola
lettura. Dal referto sanitizzato:
- **Produzione**: «esclusa (--senza-produzione)».
- **Eccezioni**: 10 applicate, **9 fermate col messaggio atteso**; la
  `20260820000010` non si è fermata, come previsto.
- **Preparazioni della prova**: `20260826000013`.
- **Errori inattesi: nessuno.**
- **Registro**: 411 file, **409 righe**. Mancano **solo** `20260917000001` e
  `20260920000001`, eccezioni note senza sanatrice. La `20260826000013` è
  registrata.
- **Differenze di schema: 34**, tutte solo nella prova (3258 elementi
  contro 3292): **33** dalla `20260917000001` (sette funzioni, le tabelle
  `invii_promemoria` e `consegne_telegram` con colonne, indici, vincoli e
  policy), **1** dalla `20260920000001` (`url_funzioni_configurato`).
  Origine controllata cercando quale migrazione crea ciascun oggetto.
- **Pulizia**: «Il database usa-e-getta e' stato buttato (controllato: non
  esiste piu')», e un controllo in sola lettura fatto dopo ha confermato
  **0** basi `ricostruzione_prova`.
- **Codice di uscita: 1, ed è l'esito atteso.** Lo strumento esce con 1
  quando il registro è incompleto o restano differenze di schema. Qui
  restano le due migrazioni note e le loro 34 differenze. **Non è
  un'interruzione**: la corsa ha camminato tutte le 411 migrazioni, ha
  stampato il referto completo e ha controllato la pulizia. Esito
  dichiarato: «registro incompleto (2 mancanti, 0 senza file), 34
  differenze di schema».

**Prova e produzione non sono state modificate**: sul motore della Prova lo
strumento ha creato e buttato il solo database usa-e-getta; in produzione
nessun collegamento.

**Frasi di questo riepilogo diventate false**, lasciate sopra perché
raccontano le corse precedenti: «L'eccezione aggiunta (ora sono
**undici**)»; «11 applicate, **10 fermate col messaggio atteso**»;
«Registro: 411 file, **408 righe** … Mancano **tre** … `20260826000013`»;
«`ricostruzione-verifica.mjs` … non toccati» (vero fino al M20-G);
«Adesso vale per tutte tranne otto eccezioni» (corretto qui sotto).

## Cosa non è verificato

- **Che l'esito non dipenda dall'ora non è stato visto in una corsa dentro la
  finestra 00–02**: la corsa ha applicato la `20260820000010` dopo le 02:00.
  È dimostrato il meccanismo (misura delle 01:50) e che la sessione di quella
  migrazione riceve il fuso di Roma (prova pura), non una corsa notturna.
- *(corsa del pomeriggio)* **La `20260826000013` resta aperta**: nessuna strada è stata scelta. → superata dal M20-G (a metà), poi dal M20-H: oggi è una preparazione della prova, non un'eccezione.
- **Come sia andata la `20260826000013` in produzione** (intera o a metà) non è verificato, ed è il motivo per cui non è più un'eccezione storica.
- **Il valore del tetto in produzione** non è noto: i 10 € della preparazione sono finti, e la prova non dice niente sul tetto vero.
- **La ricostruzione resta rossa**: `20260917000001` e `20260920000001`
  restano fuori dal registro per il limite di ordine (corsa 039: 409/411,
  34 differenze).
- **Le rotture delle prove del M20-H non sono state provate** in questo
  giro (vedi l'aggiornamento del 01/10).
- *(prima corsa)* **Le 4 fermate inattese non sono state indagate**: due sono
  verifiche che presumono dati, due non le ho classificate. → superata
  dall'aggiornamento qui sopra.
- La `20260827000018` si ferma col messaggio atteso, ma **il perché del
  12,00** è quello scritto nella `20260828000007`, non rimisurato qui.

## Cosa abbiamo rovesciato

Il n. 96 in `docs/decisioni_rovesciate.md`: dal 28/08 la prova di ricarica
applicava ogni migrazione con la regola della produzione. Adesso vale per
tutte tranne **dieci** eccezioni storiche elencate (otto nella prima
stesura, undici al M20-G), più **una preparazione temporanea della prova**
per la `20260826000013`, che non è un'eccezione. La ragione di allora vale
ancora per ogni migrazione nuova, ed è il motivo per cui le eccezioni sono un
elenco chiuso e non una data di taglio.
