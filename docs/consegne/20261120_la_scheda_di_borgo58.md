# La Scheda di Borgo 58 — S1 (20/11/2026)

## Cosa entra

- La migrazione `20261120000002_la_scheda_di_borgo58.sql`, riscritta prima di qualunque applicazione.
- `scheda_voci`: numero stabile per i riferimenti `[S#]`, otto sezioni chiuse, testo breve, fonte, date, documento facoltativo e spegnimento invece della cancellazione.
- `scheda_storico`: scritto dal solo trigger della voce, in sola lettura per il titolare; conserva testo, fonte, attivazione e, se mutano, chiave e sezione.
- Privacy su chiave, testo e dettaglio della fonte: rifiuta IBAN internazionali, CF anche omocodici e carte con Luhn. P.IVA, codice destinatario, date, importi e telefoni restano ammessi anche dentro testo continuo, senza doverli separare con punteggiatura; i confini di parola e i separatori sono riconosciuti solo dentro gli identificativi sensibili.
- `scheda_parole_delicate()`: include plurali e varianti di debiti, prestiti, cause nei contesti legali, avvocati e malattie, senza scambiare «a causa di» per un contesto delicato.
- Freno serializzato a 60 voci attive e 10.000 caratteri: il limite è calcolato sul **testo composto che passa a MEMO**, inclusa la voce che si sta scrivendo.
- `scheda_per_memo()`: solo titolare, testo ordinato e identico finché la Scheda non cambia, con versione, numero di voci e caratteri.
- Prove unitarie aggiornate: eseguono in Node le stesse regex della migrazione, traducendo `\m`/`\M` di PostgreSQL in `\b` di JavaScript per gli identificativi ASCII delimitati.

## Errori corretti dal revisore

1. `scheda_controlla_privacy()` è ora `security definer` con `search_path = public`: il trigger può usare l'helper privato anche come titolare e durante l'`ON DELETE SET NULL` di `documento_id`.
2. `scheda_compone_testo()` include il record in scrittura verificando `(p_includi).id is not null`; quindi il limite misura davvero quel testo completo.
3. Prima dei grant, `authenticated` perde ogni privilegio sulle due tabelle; recupera select/insert/update su `scheda_voci` e solo select su `scheda_storico`. La verifica interroga anche insert, update, delete e truncate dello storico, e delete/truncate delle voci.
4. Il controllo dello storico usa `pg_trigger_depth() < 2`; la verifica prova anche l'inserimento manuale dal proprietario della tabella e conta le righe toccate.
5. La verifica interna è monouso: se `scheda_voci` contiene già righe emette un `notice` e non assume una tabella vuota. I controlli di privacy e limiti fermano subito lo staff con `insufficient_privilege`; l'aggiornamento che spegne una voce non riesamina i suoi campi personali invariati.
6. `scheda_controlla_privacy()` esce prima di `is_titolare()` se un UPDATE lascia invariati chiave, testo, dettaglio fonte, sezione e attivazione; `scheda_controlla_limiti()` richiede inoltre fonte, data di validità e data di verifica immutate. L'`ON DELETE SET NULL` di `documents` puo' quindi aggiornare soltanto `documento_id` anche fuori dalla sessione del titolare, senza aggirare il limite MEMO. La verifica interna simula questo UPDATE e controlla anche che una sola modifica alla fonte sia rifiutata quando farebbe superare i 10.000 caratteri; il test Node distingue i campi dei due trigger.
7. Nel calcolo interno del limite MEMO la verifica riprende temporaneamente il ruolo proprietario per leggere la sequenza e chiamare `scheda_compone_testo()`, poi torna `authenticated`. I claim JWT restano quelli del titolare; staff e anon usano soltanto oggetti concessi o operazioni che devono fallire per prova.

## Cosa non entra

- Nessuna schermata, nessuna voce vera e nessuna modifica a `memo-chat`.
- Nessun caricamento della bozza e nessun collegamento al database vivo.
- La migrazione **non è stata eseguita su un database vero** in questa consegna.

## Verifiche eseguite

- `npm.cmd run lint`: superato.
- `npx.cmd vitest run tests/unita/scheda-borgo58.test.js`: superato, 1 file e 11 prove.
- `npx.cmd vitest run -c vitest.schermate.config.js tests/schermate`: non superato; fallisce la prova estranea `investimento.test.jsx` n. 11 (dettaglio tagliato), poi il runner è stato interrotto mentre completava le altre prove.
- `npm.cmd run build`: superato.
- `npm.cmd run indice`: superato, indice rigenerato.

## Non verificato

- Nessuna migrazione o prova interna è stata eseguita su un database: la verifica SQL resta da eseguire nel collaudo autorizzato.
- La suite schermate completa non è verificata per il fallimento estraneo sopra indicato.

## Nota per S2

`scheda_per_memo()` rifiuta `service_role`, perché `is_titolare()` usa `auth.uid()`. In S2 `memo-chat` va quindi chiamata con il token dell'utente titolare.

## Cosa abbiamo rovesciato

Niente: sono correzioni della migrazione non ancora applicata, non un cambio di decisione di prodotto.
