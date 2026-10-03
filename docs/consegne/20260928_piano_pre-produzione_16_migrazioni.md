# Piano pre-produzione — le migrazioni che mancano in produzione

**28/09/2026** · mandato M15 · `master` `896a883` · `slave` `c02173c`
· **aggiornato il 29/09/2026 (mandato M16-q)**: con il passo preparatorio
`20260929000001` le mancanti sono **17**, le applicabili **16**, e la
`20260921000001` resta l'unica da saltare stabilmente
· **aggiornato il 03/10/2026 (mandati M24-B e M24-D)**: sei controlli
obbligatori in sola lettura e cinque condizioni operative, dall'audit M24-A e
dal piano a gruppi M24-C — vedi
«Controlli obbligatori e condizioni operative»; i controlli **non sono stati
eseguiti**
· **NESSUNA PROMOZIONE È STATA FATTA**: niente è stato unito in `master`,
nessuna migrazione applicata, nessuna funzione online installata, nessun
sito pubblicato. Questo è un piano, non un resoconto di rilascio.

---

## ⚠️ Come sono scritte le versioni, e perché

*Sezione corretta il 29/09/2026 (mandato M16-c).* La prima stesura diceva che
la forma breve «lascia accesa» la rete dei riepiloghi e che dopo il rilascio
questa avrebbe preteso da sola il resoconto. **Era falso**: guardava soltanto
il controllo su ciò che è già applicato, e ignorava quello su ciò che sta per
entrare.

**Il fatto corretto.** `npm run migra` usa `versioniNonNominate`
(`scripts/comune.mjs`) in due punti:

- **prima dell'applicazione — il «Vincolo 0-bis»** (`scripts/migra.mjs`): se
  una versione che sta per entrare non compare **per intero** in un file di
  `docs/consegne/`, il programma **si ferma subito, anche in sola lettura**.
  Una forma breve come `0920-001` non la nomina: lascia la versione scoperta, e
  il rilascio non parte;
- **dopo**, sulle versioni già applicate.

Per questo le **nove** migrazioni che nessun altro riepilogo nominava per
intero sono scritte **per intero** nella tabella qui sotto. Le altre sei che il
rilascio passerà al motore sono già nominate per intero da altri file di
`docs/consegne/`: la `0917-001` dal riepilogo arretrato, e `0921-003`,
`0922-001`, `0923-003`, `0923-004`, `0928-001` dai propri riepiloghi. Insieme
soddisfano il Vincolo 0-bis. La `0921-001` non entra nel conto, perché il
rilascio la salta. Le forme brevi (`0920-001` = migrazione del 20/09/2026
numero 1) restano solo come abbreviazione nel testo.

🔴 **La conseguenza, dichiarata**: da qui in avanti, dopo l'applicazione, **la
rete non pretenderà più da sola il resoconto**, perché troverà queste versioni
già nominate. Il resoconto del rilascio **con i numeri veri** — versioni
registrate, righe toccate, lapidi prima e dopo, allarmi — resta però
**obbligatorio dopo M17**, per regola (CLAUDE.md §2): è un obbligo operativo
esplicito di chi applica, non un blocco automatico. Lo stesso vale per la
`0917-001`, nominata per intero nel riepilogo arretrato
[`20260917_un_promemoria_e_inviato_solo_se_arriva.md`](20260917_un_promemoria_e_inviato_solo_se_arriva.md).

## La sequenza: 17 mancanti, 16 applicabili

**Il passo preparatorio viene PRIMA, in un passaggio a parte.** La
`20260929000001` (riepilogo
[`20260929_l_indirizzo_delle_funzioni_nel_vault.md`](20260929_l_indirizzo_delle_funzioni_nel_vault.md))
crea `url_funzioni` nel Vault, che la `0917-001` pretende di trovare. Porta la
data in cui è stata scritta, quindi per numero viene **dopo** tutte le altre: si
applica da sola saltando esplicitamente le sedici già in attesa, e solo dopo
seguono le altre quindici. **Nessuna migrazione retrodatata, nessuna scrittura
diretta nel Vault.**

| # | Migrazione | Oggetti | Effetto sui dati | Blocchi | Funzione online | La verifica scrive su |
|---|---|---|---|---|---|---|
| 0 | `20260929000001` l'indirizzo delle funzioni nel Vault — **passaggio a parte, per primo** | voce `url_funzioni` nel Vault, solo se manca | nessuno | — | — | il solo Vault, e solo se la voce manca |

Poi le altre, in ordine di versione, che è l'ordine in cui `npm run migra` le
applica. Ognuna va in **un'unica transazione** (nessuna contiene
`alter type … add value`) e nessuna usa `CONCURRENTLY`.

| # | Migrazione | Oggetti | Effetto sui dati | Blocchi | Funzione online | La verifica scrive su |
|---|---|---|---|---|---|---|
| 1 | `0917-001` un promemoria è inviato solo se arriva | tabelle `invii_promemoria`, `consegne_telegram`; 8 funzioni nuove; `send_due_task_reminders` riscritta; lavoro `esiti-promemoria` ogni 5 min + riga in `lavori_sorvegliati` | nessuna riga esistente toccata | solo tabelle nuove | **`notify-telegram-reservation` PRIMA** | tabelle nuove |
| 2 | `20260919000001` (`0919-001`) le prove automatiche non suonano | tabella `silenzi_notifiche`; `siamo_su_prova`, `apri/chiudi_silenzio_notifiche`, `notifiche_zittite` | nessuno | tabella nuova | la funzione di `slave` non la chiama fuori da Prova | — |
| 3 | `20260920000001` (`0920-001`) nessun ripiego verso il gestionale vero | `url_funzioni_configurato`; riscritte `chiedi_lettura_posta`, `invia_email_conferma`, `invia_preventivo_per_email`, `segnala_allarme`, `notify_reservation_telegram` | nessuno | trigger delle prenotazioni sostituito | — | — |
| 4 | `20260920000002` (`0920-002`) un mancato riscontro non è un non arrivato | `send_due_task_reminders`, `esito_di_un_invio` | nessuno | — | — | — |
| 5 | `20260920000003` (`0920-003`) la ricorrenza porta con sé l'avviso | `istante_della_scadenza`, `avviso_del_successivo`, `completa_task` | nessuno | — | — | `tasks` |
| 6 | `20260920000004` (`0920-004`) il sollecito finché non lo chiudi | `tasks` +2 colonne e 4 vincoli; `istante_sollecito`; `send_due_task_reminders`, `completa_task` | colonne nuove vuote | **`ALTER TABLE tasks`** | — | `tasks` |
| 7 | `20260920000005` (`0920-005`) il sollecito anche a ore | 2 vincoli di `tasks`; `istante_sollecito` | nessuno | **`ALTER TABLE tasks`** | — | `tasks` |
| 8 | `0921-001` il documento dalla posta tiene la società | `esegui_azione_posta` | — | — | — | — |
| 9 | `20260921000002` (`0921-002`) la società dalla posta dal corpo vivo | `esegui_azione_posta` (+1 riga rispetto alla versione applicata); registra anche la `0921-001` | nessuno | — | — | `posta_ricevuta`, `posta_azioni` |
| 10 | `0921-003` l'etichetta investimento | `cash_movements` e `anticipazioni_socio` +`e_investimento`; vincolo; 2 trigger; `costo_del_progetto`, `righe_costo_del_progetto` | colonna nuova a `false` | **`ALTER TABLE cash_movements`, `anticipazioni_socio`** | — | `cash_movements`, `anticipazioni_socio`, `tag_anticipazioni`, `suppliers`, `supplier_invoices` |
| 11 | `0922-001` la resa sulla riga di ricetta | `recipe_ingredients` +`quantita_lorda`; `ingredients.waste_percentage_default` diventa facoltativa; vincoli sostituiti; 1 trigger; 7 funzioni; 2 viste | **`UPDATE` di sanatoria su tutte le righe di `recipe_ingredients`**, poi 2 `SET NOT NULL` | **`ALTER TABLE recipe_ingredients`, `ingredients`** | — | `ingredients`, `recipes`, `recipe_ingredients` |
| 12 | `20260923000001` (`0923-001`) la vista dei costi torna a rispettare la RLS | `v_recipe_row_costs` | nessuno | — | — | — |
| 13 | `20260923000002` (`0923-002`) cambiando unità il lordo segue il netto | `converti_numeri_dell_unita` (funzione del trigger già esistente), `colonne_unita_non_classificate` | nessuno sulle righe esistenti | — | — | `ingredients`, `recipes`, `recipe_ingredients` |
| 14 | `0923-003` la chiusura dell'anno fiscale | tabella `chiusure_annuali` (RLS, 3 trigger, registro delle cancellazioni); riga in `perimetro_registro`; `misure_dell_anno`, `chiudi_anno` | nessuno | tabella nuova | — | `orders`, `chiusure_annuali` |
| 15 | `0923-004` i due vincoli della chiusura parlano italiano | frasi sui vincoli | nessuno | — | — | — |
| 16 | `0928-001` le verifiche trovate da un indice | indice `idx_deleted_records_verifiche` | nessuno | **`CREATE INDEX` non concorrente su `deleted_records`** | — | — |

### 🔴 La `0921-001` NON va applicata: va saltata

La `0921-002` la dichiara superata e, **dopo** i propri controlli, la registra
come applicata. Applicarla da sola in produzione fallirebbe comunque, e l'ha
misurato la sessione in sola lettura del 28/09:

- la sua guardia cerca la funzione con `pg_get_function_identity_arguments(…)
  = 'uuid, jsonb'`, ma in produzione quella funzione restituisce anche i nomi
  dei parametri: la guardia **non troverebbe la funzione**;
- una delle sue quattro impronte (`p_file_name` seguito da quattro spazi) **non
  c'è** nel corpo vivo di produzione. Nel file della `0828-009`, l'ultima
  versione applicata, la stessa riga ha sei spazi invece di quattro.

Quindi: `npm run migra` con **`--salta` seguito dalla versione intera della
`0921-001`**.

## Le funzioni online e il loro ordine

1. **`notify-telegram-reservation` PRIMA di qualunque migrazione** — regola
   «funzione prima, migrazione dopo» della `0917-001`. Letto nel codice di
   `slave`: deduplica solo se la richiesta porta `chiave_consegna`, che il
   database manda soltanto dopo la `0917-001`; fuori da Prova non chiama
   `notifiche_zittite`. Installata col database vecchio si comporta come prima.
2. **`telegram-prova-test` ESCLUSA dalla produzione**: il suo codice rifiuta
   con 403 fuori da Borgo58-Prova (`prova.ts`), e installarla in produzione non
   serve a niente.
3. Nessun'altra funzione online cambia fra `master` e `slave`.

⚠️ In produzione `npm run funzione` installa solo file committati e identici a
`origin/master` (`scripts/funzione.mjs`): anche la funzione si installa
**dopo** il merge su `master`. La versione oggi installata in produzione **non
è stata misurata**.

## Rischi misurati (28/09, sessione `READ ONLY` sulla produzione)

- **Righe incompatibili coi vincoli nuovi: zero** su tutti i predicati ricavati
  dai file — quantità non positive, scarto negativo, lordo che non riproduce lo
  scarto (la guardia della sanatoria della `0922-001`), scarto standard
  negativo. Il ruolo di lettura scavalca la RLS, quindi il conteggio vede tutte
  le righe. Le colonne nuove di `tasks` e `cash_movements` non esistono ancora:
  i loro vincoli sono soddisfatti per costruzione.
- **Dimensioni**: `tasks`, `cash_movements`, `anticipazioni_socio`,
  `recipe_ingredients`, `ingredients` e `deleted_records` occupano ciascuna
  poche pagine. Le scansioni sotto blocco esclusivo e l'indice su
  `deleted_records` durano quindi un tempo trascurabile **una volta ottenuto il
  blocco**.
- **Guardie**: soddisfatte in produzione quelle della `0917-001` (corpo vivo
  atteso, colonne di `net._http_response`) e della `0920-003`
  (`completa_task` conosce la ricorrenza e non l'avviso). Il corpo vivo di
  `esegui_azione_posta` porta i quattro segni che la `0921-002` conserva e non
  ha ancora la società.
- **Registro**: le migrazioni registrate in produzione sono le stesse di
  `master` meno la `0917-001`, e nessuna è estranea al repository.

## Rischi NON misurabili con le sole letture

- 🔴 **Il segreto `url_funzioni` nel Vault di produzione.** Non letto: è un
  segreto. Dal 29/09 lo gestisce la `20260929000001`: se manca lo crea, se c'è
  ed è giusto non lo tocca, se c'è ma è diverso **si ferma senza correggere**.
  Resta non misurabile ciò da cui quella migrazione ricava l'indirizzo: la
  `chiave_anon` nel Vault di produzione. Se manca, è doppia o non è un JWT del
  gestionale vero, la migrazione si ferma senza scrivere, e il rilascio non va
  avanti.
- **Transazioni aperte al momento dell'applicazione**: `npm run migra` non
  imposta un `lock_timeout`, quindi un `ALTER TABLE` o l'indice aspettano
  senza limite dietro una transazione lunga, e le scritture del gestionale si
  mettono in coda dietro di loro.
- **Le verifiche che scrivono su tabelle reali** (vedi la tabella): righe
  create e tolte nella stessa transazione, invisibili agli altri. Quali lapidi
  lascino e se qualche trigger accodi una chiamata di rete non è misurabile
  senza eseguirle.
- **Il lavoro `esiti-promemoria`** e la sentinella dal vivo; `cron.job` non è
  stato interrogato.
- **La pubblicazione del sito dopo il merge su `master`**: dipende dalla
  variabile `PUBBLICAZIONE_DA_GITHUB` e dall'approvazione dell'ambiente
  `produzione`, non lette. Il sito di `slave` usa colonne e tabelle che
  esistono solo dopo le migrazioni.
- **`lapidi_di_prova()`**: non misurata.

## Il rilascio futuro, passo per passo

Richiede un **mandato separato**. Si fa **fuori dall'uso del gestionale**, in
una sola finestra.

**Prima**
1. `master` contiene le 17 migrazioni: `npm run migra` rifiuta ciò che non è su
   `origin/master`. Quindi il merge `slave → master` viene prima, e **il sito
   non deve andare online prima delle migrazioni**: l'approvazione della
   pubblicazione si trattiene fino al passo 8.
2. Copia di sicurezza: `npm run backup`. Il piano Supabase attuale non ne fa.
3. Nessuna corsa GitHub, prova o migrazione in corso.
4. **Passaggio A, in sola lettura** — senza `--conferma`, saltando
   esplicitamente le sedici già in attesa, deve elencare **soltanto** la
   `20260929000001`:

   ```
   npm run migra -- --salta 20260917000001 --salta 20260919000001 --salta 20260920000001 --salta 20260920000002 --salta 20260920000003 --salta 20260920000004 --salta 20260920000005 --salta 20260921000001 --salta 20260921000002 --salta 20260921000003 --salta 20260922000001 --salta 20260923000001 --salta 20260923000002 --salta 20260923000003 --salta 20260923000004 --salta 20260928000001
   ```

**Durante**

5. Lo stesso comando del passo 4 **con `--conferma`**: applica la sola
   `20260929000001`. Il messaggio della migrazione dice se ha creato la voce o
   se c'era già; in nessun caso mostra il valore.
6. `npm run funzione notify-telegram-reservation -- --conferma`. Non
   `telegram-prova-test`.
7. **Passaggio B** — `npm run migra -- --salta 20260921000001`, prima **senza
   `--conferma`**: deve elencare esattamente le 15 migrazioni applicabili,
   nell'ordine della tabella; la `20260921000001` è volutamente esclusa. Poi lo
   stesso comando **con `--conferma`**.
8. Solo dopo, approvare la pubblicazione del sito.

**Dopo**

9. Le versioni registrate in produzione coincidono con i file di
   `supabase/migrations/` su `master`, compresa la `0921-001` registrata dalla
   `0921-002` e la `20260929000001`.
10. Esistono `invii_promemoria`, `consegne_telegram`, `silenzi_notifiche`,
    `chiusure_annuali` e `idx_deleted_records_verifiche`; il lavoro
    `esiti-promemoria` è pianificato, iscritto in `lavori_sorvegliati`, e ha un
    battito recente in `stato_lavori`.
11. Nessun allarme nuovo nel quarto d'ora successivo, e le lapidi in
    `deleted_records` contate prima e dopo.
12. Riepilogo del rilascio in `docs/consegne/` con **tutte le versioni per
    intero e i numeri veri**. **Nessuna rete lo pretenderà**: tutte le versioni
    risultano già nominate da questo piano e dai riepiloghi della `0917-001` e
    della `20260929000001`. È un obbligo operativo esplicito di M17, per regola.

## Condizioni di stop

Ci si ferma, senza correggere e senza riprovare, se:

- il passaggio A in sola lettura elenca qualcosa di diverso dalla sola
  `20260929000001`;
- la `20260929000001` si ferma: **non si fa il passaggio B** (la `0917-001`
  si fermerebbe comunque sulla sua guardia);
- `npm run migra -- --salta 20260921000001` in sola lettura elenca un insieme
  o un ordine diverso dalle 15 migrazioni applicabili indicate nella tabella;
- una guardia o una verifica si ferma: le migrazioni già applicate restano
  applicate, ognuna è una transazione a sé;
- l'installazione di `notify-telegram-reservation` non riesce: **non si
  applica la `0917-001`**;
- un'applicazione resta in attesa di un blocco oltre qualche secondo;
- arriva un allarme su Telegram durante o subito dopo;
- il sito va online prima che le migrazioni siano finite.

## Controlli obbligatori e condizioni operative

*Aggiunta il 03/10/2026 (mandato M24-B), dai risultati dell'audit statico
M24-A; completata lo stesso giorno (mandato M24-D) coi due controlli trovati
dal piano a gruppi M24-C.* Le stesse voci sono in
`scripts/contratto-preflight-rilascio.mjs` (`CONTROLLI_OBBLIGATORI`,
`CONDIZIONI_OPERATIVE`), e una prova pura le tiene d'accordo con questa
sezione.

🔴 **I SEI CONTROLLI NON SONO STATI ESEGUITI.** Il contratto li richiede:
finché non risultano verdi, misurati in sola lettura sulla produzione,
nessuna fase parte. Qui c'è **cosa** va accertato, non come.

| Controllo | Prima di | Cosa deve risultare | Se non è vero |
|---|---|---|---|
| `funzioni_che_nominano_la_produzione` | `20260920000001` | le funzioni vive che contengono l'identificativo del progetto di produzione sono al più le sei che la `20260917000001` e la `20260920000001` riscrivono: `chiedi_lettura_posta`, `invia_email_conferma`, `invia_preventivo_per_email`, `notify_reservation_telegram`, `segnala_allarme`, `send_due_task_reminders` | la verifica della `20260920000001` si ferma (righe 377-383) |
| `vincoli_senza_frase` | `20260923000004` | nessun vincolo che rifiuta, fuori dall'elenco congelato, è privo della frase italiana | la verifica della `20260923000004` si ferma (righe 172-176) |
| `soggetti_e_utenti_presenti` | `20260919000001`, `20260921000003`, `20260923000003` | esistono un utente titolare e uno staff, e i soggetti `srls`, `tasca`, `azienda_agricola` | le tre verifiche si fermano (righe 185-189, 601-607, 490-502) |
| `modulo_di_rete_con_tempo_massimo` | `20260920000002` | la funzione di invio del modulo di rete installato accetta il parametro `timeout_milliseconds` | la migrazione passa, e l'errore comparirebbe solo inviando i promemoria (riga 135; la verifica guarda solo il testo, riga 274) |
| `causali_di_uscita_presenti` | `20260921000003` | fra le causali di cassa esiste almeno una di tipo uscita, attiva e non di sistema, e almeno una di tipo uscita e di sistema, attiva o no | la verifica della `20260921000003` si ferma (righe 610-616) |
| `conti_del_1996_senza_documento` | `20260923000003` | per il soggetto `srls` la regola `conti_senza_documento`, sulle serate dal 01/01/1996 al 31/12/1996, non trova nessun conto | la verifica della `20260923000003` si ferma (righe 509-512) |

⚠️ **Le sei funzioni ammesse sono ricavate dai sorgenti, non dalla
produzione**: sono quelle la cui ultima definizione fino alla
`20260916000002` contiene l'identificativo. Una funzione creata a mano in
produzione, fuori dalle migrazioni, non comparirebbe in questo elenco: è
proprio ciò che il controllo deve scoprire.

⚠️ **`vincoli_senza_frase()` ha il portiere del titolare**: chi misura in sola
lettura non può chiamarla, e deve ottenere lo stesso risultato da una lettura
del catalogo. Come, lo decide il mandato che costruisce lo strumento di
misura.

**Condizioni operative non aggirabili.** Non sono misure: sono vincoli sul
modo di fare il rilascio. Nessuna risulta già soddisfatta, e ciascuna vuole
una risposta scritta nel mandato di rilascio.

- `esclusa_resta_esclusa` — la `20260921000001` non si applica mai
  direttamente: si passa sempre `--salta 20260921000001`, e la registra la
  `20260921000002` dopo la propria verifica.
- `finestra_della_vista_dei_costi` — la `20260922000001` ricrea la vista dei
  costi per riga di ricetta **senza** la protezione per ruolo, e solo la
  `20260923000001` la rimette. Sono due transazioni separate: fra le due,
  chi è collegato come staff potrebbe vedere i costi. Serve una protezione
  operativa esplicita per quella finestra.
- `nessun_tempo_massimo_sui_blocchi` — `npm run migra` non imposta oggi
  nessun tempo massimo di attesa sui blocchi: un `ALTER TABLE` o l'indice
  aspettano senza limite dietro una transazione lunga, e le scritture del
  gestionale si accodano. Un'attesa va interrotta a mano.
- `storico_dei_costi_riga_per_riga` — la sanatoria della `20260922000001`
  aggiorna le righe di ricetta una per una, e ogni aggiornamento fa scattare
  il trigger dello storico dei costi (`20260820000003`, righe 374-376). È
  una modifica di dati che si annulla solo da una copia: serve una strategia
  di ripristino **già verificata**, non solo una copia fatta.
- `righe_temporanee_nell_agenda` — le verifiche della `20260920000003`,
  `20260920000004` e `20260920000005` creano e cancellano impegni veri
  dell'agenda della produzione, dentro la propria transazione. L'agenda non è
  nel registro delle cancellazioni, quindi non lasciano lapidi.

## Cosa non è verificato

- i sei controlli obbligatori qui sopra: richiesti, mai eseguiti;
- tutto l'elenco dei «rischi non misurabili» qui sopra;
- lo stato di queste migrazioni su Borgo58-Prova: in questo lavoro Prova non è
  stata interrogata a mano.

## Cosa abbiamo rovesciato

Niente.
