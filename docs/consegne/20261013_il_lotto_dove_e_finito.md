# Il lotto dove è finito: la tracciabilità guarda a valle (N6)

**13/10/2026.** Riepilogo per il validatore. Copre la proposta
idearecreazioni-source/Borgo58-App#183 (ramo `claude/align-prod-staging-data-zym1ue`
→ `slave`).

Scritto PRIMA di applicare in produzione, perché `npm run migra` lo
pretende; la voce § 7 è stata completata dopo l'applicazione, coi numeri
veri.

---

* **HEAD del codice coperto da questo riepilogo**: `27ccd8f`. Questo documento
  è il commit sopra, ed è sola documentazione.
* **Working tree**: pulito dopo questo commit.
* **Controlli su GitHub**: su `ad69dd1` (il codice prima della ricerca) tutti
  verdi — codice, prove pure e compilazione; prove visive in Chrome; prove
  contro il progetto di prova; cancello della filiera. Su `27ccd8f`, al momento
  di scrivere: codice e cancello verdi, prove visive e prove sul progetto di
  prova **ancora in corso**. Non li dichiaro verdi finché non lo sono.

## 1 · Migrazioni (versioni per intero)

| versione | cosa | Prova | Produzione |
|---|---|---|---|
| `20261012000001` | `uscite_lotto` scritta da un trigger su `stock_lots`; `stock_consumptions.transazione`; il trigger che collega le uscite al movimento; `dove_e_finito_il_lotto(uuid)` col portiere | applicata il 13/10 alle 12:18 da Alessio: verifica «Fatto», **420** migrazioni registrate sulla prova | da applicare |

Nessuna va saltata. Comando previsto: `npm run migra -- --conferma`, dopo
l'unione su `master`.

## 2 · Funzioni online

Nessuna.

## 3 · Cosa c'è dentro, in breve

* **Il dato non esisteva** (misurato leggendo i corpi delle migrazioni): cinque
  funzioni abbassano i lotti — `record_stock_consumption`, `chiudi_partita`,
  `scarica_magazzino_conto`, `registra_produzione`, `allinea_giacenza` — e
  scrivono un movimento **per prodotto**, non per lotto.
* **La forma è un trigger, non cinque riscritture**: `trg_traccia_uscita_lotto`
  (AFTER UPDATE su `stock_lots`, **senza** filtro `OF`) scrive un'uscita a ogni
  calo. La sesta funzione che scaricherà un lotto viene vista da sola. Nessun
  corpo vivo è stato toccato.
* **Il collegamento al movimento** è per transazione + prodotto, con la regola
  della **copertura**: un'uscita si attacca a un movimento non ancora coperto
  per intero. Regge i due ordini che esistono (lotto-poi-movimento in quattro
  funzioni, movimento-poi-lotto in `chiudi_partita`). Tolleranza di 0,0001, il
  decimo di grammo dell'arrotondamento dei movimenti.
* **Il cambio di unità non è un'uscita**: se cambia anche `quantity_received`
  le uscite del lotto si convertono con lo stesso rapporto e nessuna ne nasce.
* `stock_consumptions.transazione` nasce **senza** predefinito e lo riceve
  dopo: le righe vecchie restano vuote (trappola del 14/08).
* `dove_e_finito_il_lotto`: conti con serata (`serata_di_servizio`) e piatti
  (da `fabbisogno_conto`, quindi con sostituzioni e finger); produzioni
  seguite fino al lotto nato, livello per livello (tetto 10, niente cicli);
  sprechi, resi, vitto, rettifiche; le uscite senza movimento dichiarate come
  tali; **il prima del 12/10/2026 come riga `non_annotato`** con la sua
  quantità (ricevuto − rimasto − annotato). Portiere che **rifiuta** lo staff.
* `uscite_lotto`: RLS titolare in sola lettura, nessuna scrittura dal browser,
  `perimetro_registro` **fuori** (è un riflesso). Tutti i vincoli hanno la
  loro frase. Le due funzioni di trigger non sono eseguibili da nessuno.
* Schermata `/haccp/tracciabilita/:id` (`LottoDestinazioni.jsx`), aperta
  toccando un lotto (solo titolare); si stampa.
* **La ricerca** (chiesta da Alessio provando): casella in cima a
  «Tracciabilità lotti» su prodotto, fornitore e numero di lotto, senza
  accenti né maiuscole (`normalizza` del MEMO), più parole tutte presenti.
  Un foglio stampato con la ricerca accesa lo dice sul foglio.

## 4 · Cosa si è visto

* **In locale, su uno stub con l'ordine delle scritture delle funzioni vere**:
  la verifica passa, si rilancia due volte, e **quattro rotture** danno quattro
  rossi giusti — copertura ignorata → «(2) i 9 kg resi sono attaccati a
  «spreco»»; cambio d'unità trattato come uscita → «(5)»; portiere tolto →
  «(7)»; catena non seguita → «(4)».
* **Sul progetto di prova, con le funzioni vere**: la verifica dentro la
  migrazione (record_stock_consumption, chiudi_partita, scarica_magazzino_conto,
  registra_produzione, cambio d'unità, vuoto dichiarato, portiere) ha detto
  «Fatto … zero residui».
* **Con le mani, da Alessio, sul gestionale di prova**: chiusa come «buttata»
  la partita di Calamaro (3 kg, BASE-Ortofrutta PROVA), la sua pagina dice
  «Buttato 3 kg · 13 ott 2026 · Partita buttata». La ricerca «calamaro» lascia
  solo quel lotto.
* Prove: pure 2236 verdi, schermate 442 verdi, lint pulito, build riuscita.

## 5 · Cosa NON è verificato

* **Un conto e una produzione veri a schermo**: provati solo dentro la
  verifica della migrazione, non guardati da una mano.
* **La riga «non annotato» a schermo** su un lotto vecchio: provata nella
  verifica e nella prova di schermata, non guardata dal vivo.
* **Il foglio stampato**: non stampato da nessuno.
* **Il telefono**: la pagina non è stata misurata a 390 punti.
* **I piatti di un conto** si leggono dalla ricetta di **oggi**: se è cambiata
  dopo, la riga del conto resta e i piatti restano vuoti (lo dice la
  schermata). È un limite scelto, non misurato su un caso vero.
* **Le prove di `tests/app/`** che creano e poi cancellano lotti: le uscite se
  ne vanno a cascata col lotto, ma una prova che cancellasse un movimento
  lasciando il lotto lascerebbe un'uscita senza movimento. Il giro su GitHub
  lo dirà; non l'ho misurato prima.

## 6 · Cosa abbiamo rovesciato

Niente.

## 7 · Applicazione in produzione

Fatto da Alessio il 13/10/2026 alle 20:16, dopo l'unione su `master`
(idearecreazioni-source/Borgo58-App#184, commit di unione `45073d5`).

* **Copia di sicurezza** fatta prima (`npm run backup`), come pretende
  `npm run migra`.
* **`npm run migra -- --conferma`**: «applicate e registrate: 1 su 1» —
  `20261012000001_il_lotto_dove_e_finito.sql` — verifica «Fatto … zero
  residui», **totale migrazioni in produzione: 420**. Le tre NOTICE «does not
  exist, skipping» sono i `drop … if exists` della prima applicazione.
* **Misurato dopo, dal connettore in sola lettura sulla produzione**:
  `applied_migrations` = **420**, ultima `20261012000001`; `uscite_lotto` =
  **0** righe; movimenti con `transazione` valorizzata = **0**; i due trigger
  (`trg_traccia_uscita_lotto`, `trg_collega_uscite_al_movimento`) **accesi**.
  Zero è lo stato di partenza atteso: il gestionale vero comincia ad annotare
  dal primo calo di un lotto dopo l'applicazione, e tutto ciò che è uscito
  prima compare come riga «non annotato».
* **Sito**: il passaggio «Manda in produzione» della corsa 38404004650 è
  riuscito dopo l'approvazione di Alessio.
* **Funzioni online**: nessuna da installare.
* ⚠️ **Non guardato**: nessuno ha riportato di aver aperto la pagina «Dove è
  finito» sul gestionale vero.
