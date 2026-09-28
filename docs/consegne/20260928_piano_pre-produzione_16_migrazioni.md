# Piano pre-produzione — le 16 migrazioni che mancano in produzione

**28/09/2026** · mandato M15 · `master` `896a883` · `slave` `c02173c`
· **NESSUNA PROMOZIONE È STATA FATTA**: niente è stato unito in `master`,
nessuna migrazione applicata, nessuna funzione online installata, nessun
sito pubblicato. Questo è un piano, non un resoconto di rilascio.

---

## ⚠️ Come sono scritte le versioni, e perché

In questo file le migrazioni sono indicate **in forma breve** — `0920-001`
sta per la migrazione del 20/09/2026 numero 1 — e **mai col numero di
versione intero**. Non è una svista.

La rete dei riepiloghi (`versioniNonNominate` in `scripts/comune.mjs`, provata
da `tests/unita/riepiloghi.test.js`) considera documentata una migrazione
applicata quando la sua versione compare **per intero** in un file di
`docs/consegne/`. Se questo piano le scrivesse per intero, dopo il rilascio la
rete le troverebbe già «documentate» e **non chiederebbe più il riepilogo con i
numeri veri dell'applicazione** — cioè il piano spegnerebbe il controllo che
deve seguirlo. La forma breve lascia la rete accesa: dopo il rilascio
continuerà a pretendere un riepilogo che le nomini per intero.

L'unica eccezione è la `0917-001`, che il riepilogo arretrato
[`20260917_un_promemoria_e_inviato_solo_se_arriva.md`](20260917_un_promemoria_e_inviato_solo_se_arriva.md)
nomina per intero per mandato: per lei la rete **non** chiederà più il
riepilogo dopo l'applicazione, ed è dichiarato in quel file.

## La sequenza delle 16 migrazioni

Ordine di versione, che è l'ordine in cui `npm run migra` le applica. Ognuna
va in **un'unica transazione** (nessuna contiene `alter type … add value`) e
nessuna usa `CONCURRENTLY`.

| # | Migrazione | Oggetti | Effetto sui dati | Blocchi | Funzione online | La verifica scrive su |
|---|---|---|---|---|---|---|
| 1 | `0917-001` un promemoria è inviato solo se arriva | tabelle `invii_promemoria`, `consegne_telegram`; 8 funzioni nuove; `send_due_task_reminders` riscritta; lavoro `esiti-promemoria` ogni 5 min + riga in `lavori_sorvegliati` | nessuna riga esistente toccata | solo tabelle nuove | **`notify-telegram-reservation` PRIMA** | tabelle nuove |
| 2 | `0919-001` le prove automatiche non suonano | tabella `silenzi_notifiche`; `siamo_su_prova`, `apri/chiudi_silenzio_notifiche`, `notifiche_zittite` | nessuno | tabella nuova | la funzione di `slave` non la chiama fuori da Prova | — |
| 3 | `0920-001` nessun ripiego verso il gestionale vero | `url_funzioni_configurato`; riscritte `chiedi_lettura_posta`, `invia_email_conferma`, `invia_preventivo_per_email`, `segnala_allarme`, `notify_reservation_telegram` | nessuno | trigger delle prenotazioni sostituito | — | — |
| 4 | `0920-002` un mancato riscontro non è un non arrivato | `send_due_task_reminders`, `esito_di_un_invio` | nessuno | — | — | — |
| 5 | `0920-003` la ricorrenza porta con sé l'avviso | `istante_della_scadenza`, `avviso_del_successivo`, `completa_task` | nessuno | — | — | `tasks` |
| 6 | `0920-004` il sollecito finché non lo chiudi | `tasks` +2 colonne e 4 vincoli; `istante_sollecito`; `send_due_task_reminders`, `completa_task` | colonne nuove vuote | **`ALTER TABLE tasks`** | — | `tasks` |
| 7 | `0920-005` il sollecito anche a ore | 2 vincoli di `tasks`; `istante_sollecito` | nessuno | **`ALTER TABLE tasks`** | — | `tasks` |
| 8 | `0921-001` il documento dalla posta tiene la società | `esegui_azione_posta` | — | — | — | — |
| 9 | `0921-002` la società dalla posta dal corpo vivo | `esegui_azione_posta` (+1 riga rispetto alla versione applicata); registra anche la `0921-001` | nessuno | — | — | `posta_ricevuta`, `posta_azioni` |
| 10 | `0921-003` l'etichetta investimento | `cash_movements` e `anticipazioni_socio` +`e_investimento`; vincolo; 2 trigger; `costo_del_progetto`, `righe_costo_del_progetto` | colonna nuova a `false` | **`ALTER TABLE cash_movements`, `anticipazioni_socio`** | — | `cash_movements`, `anticipazioni_socio`, `tag_anticipazioni`, `suppliers`, `supplier_invoices` |
| 11 | `0922-001` la resa sulla riga di ricetta | `recipe_ingredients` +`quantita_lorda`; `ingredients.waste_percentage_default` diventa facoltativa; vincoli sostituiti; 1 trigger; 7 funzioni; 2 viste | **`UPDATE` di sanatoria su tutte le righe di `recipe_ingredients`**, poi 2 `SET NOT NULL` | **`ALTER TABLE recipe_ingredients`, `ingredients`** | — | `ingredients`, `recipes`, `recipe_ingredients` |
| 12 | `0923-001` la vista dei costi torna a rispettare la RLS | `v_recipe_row_costs` | nessuno | — | — | — |
| 13 | `0923-002` cambiando unità il lordo segue il netto | `converti_numeri_dell_unita` (funzione del trigger già esistente), `colonne_unita_non_classificate` | nessuno sulle righe esistenti | — | — | `ingredients`, `recipes`, `recipe_ingredients` |
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
  segreto. Se manca, la `0917-001` si ferma prima di toccare qualunque cosa. Se
  invece c'è ma è sbagliato, dopo la `0920-001` le cinque funzioni chiamano
  l'indirizzo sbagliato: prenotazioni e allarmi **non notificati**, invio dei
  preventivi in errore.
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
1. `master` contiene le 16 migrazioni: `npm run migra` rifiuta ciò che non è su
   `origin/master`. Quindi il merge `slave → master` viene prima, e **il sito
   non deve andare online prima delle migrazioni**: l'approvazione della
   pubblicazione si trattiene fino al passo 7.
2. Copia di sicurezza: `npm run backup`. Il piano Supabase attuale non ne fa.
3. Nessuna corsa GitHub, prova o migrazione in corso.
4. `npm run migra` **senza `--conferma`**: deve elencare esattamente le 16, in
   quest'ordine.

**Durante**

5. `npm run funzione notify-telegram-reservation -- --conferma`. Non
   `telegram-prova-test`.
6. `npm run migra -- --salta <versione intera della 0921-001> --conferma`.
7. Solo dopo, approvare la pubblicazione del sito.

**Dopo**

8. Le versioni registrate in produzione coincidono con i file di
   `supabase/migrations/` su `master`, compresa la `0921-001` registrata dalla
   `0921-002`.
9. Esistono `invii_promemoria`, `consegne_telegram`, `silenzi_notifiche`,
   `chiusure_annuali` e `idx_deleted_records_verifiche`; il lavoro
   `esiti-promemoria` è pianificato, iscritto in `lavori_sorvegliati`, e ha un
   battito recente in `stato_lavori`.
10. Nessun allarme nuovo nel quarto d'ora successivo, e le lapidi in
    `deleted_records` contate prima e dopo.
11. Riepilogo del rilascio in `docs/consegne/` con **tutte le versioni per
    intero e i numeri veri**. La rete lo pretenderà per le 15; per la
    `0917-001` è dovuto per regola.

## Condizioni di stop

Ci si ferma, senza correggere e senza riprovare, se:

- `npm run migra` in sola lettura elenca migrazioni diverse da queste 16;
- una guardia o una verifica si ferma: le migrazioni già applicate restano
  applicate, ognuna è una transazione a sé;
- l'installazione di `notify-telegram-reservation` non riesce: **non si
  applica la `0917-001`**;
- un'applicazione resta in attesa di un blocco oltre qualche secondo;
- arriva un allarme su Telegram durante o subito dopo;
- il sito va online prima che le migrazioni siano finite.

## Cosa non è verificato

- tutto l'elenco dei «rischi non misurabili» qui sopra;
- lo stato di queste migrazioni su Borgo58-Prova: in questo lavoro Prova non è
  stata interrogata a mano.

## Cosa abbiamo rovesciato

Niente.
