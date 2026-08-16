# Consegna del 16/08/2026 (settima) — Blocco 3 del mandato di correzione

**Commit della consegna: `126f108`.** Questo riepilogo è il commit
immediatamente sopra, sola documentazione. Working tree pulito.

| Commit | Cosa |
|---|---|
| `126f108` | le scritture che devono passare dal corridoio — migrazione `20260816000007` |

⚠️ **Ordine seguito** (CLAUDE.md §2, regola 4): commit → push di Alessio →
`npm run migra -- --conferma` → questo riepilogo → secondo push. La
migrazione **`20260816000007` è già applicata in produzione** (numeri in
§6). La Edge Function `operazioni-atomiche` (5 operazioni nuove) è
installata **dopo** questo riepilogo: la rete si è rifiutata di toccare la
produzione finché la migrazione non era documentata — seconda volta oggi
che interviene su un caso vero.

⚠️ Questa consegna **non modifica** `docs/CONTRATTO.md`.

---

## 1. «Ha disdetto» — e la porta era più di una

Il mandato segnalava `PiantaGiornata.jsx`: due scritture separate dal
browser — prima lo stato ad «annullata», poi i tavoli liberati. Forma
vietata da B4, e **il modo in cui fallisce è quello brutto**: al
fallimento a metà resta una prenotazione annullata che tiene i suoi
tavoli, e quella riga **non si vede da nessuna schermata** — l'elenco
della giornata mostra le prenotazioni attive, e quei tavoli risultano
occupati da qualcuno che non verrà. Al telefono, la sera, si dice «non c'è
posto» per un tavolo libero.

🔴 **Guardando per correggere è emerso che lo stesso gesto esiste anche in
`ReservationForm.jsx`** — il pulsante «Annulla» sulla scheda della
prenotazione, e «Rifiuta» su una richiesta — dove si faceva un `update`
diretto **senza liberare niente**. Lì i tavoli restavano attaccati
**sempre**, non solo in caso di guasto: non è una finestra di rischio, è
il comportamento normale. Curare la sola porta che il mandato nomina
avrebbe lasciato aperta la peggiore delle due.

`annulla_prenotazione(id, stato)` serve entrambe. ⚠️ **Non è un `delete`
più un `update` messi insieme per forma**: il legame fra i due fatti è che
*una prenotazione che non ci sarà non deve tenere niente*. Chi scriverà
domani una terza porta trova la funzione, non due istruzioni da ricopiare
nell'ordine giusto.

Respinge anche l'annullamento di ciò che è già annullato (chi preme due
volte deve saperlo) e qualunque stato che non chiuda la prenotazione.

---

## 2. Il censimento (3.2), fatto a mano come chiesto

Il mandato avverte: *«il censimento automatico non è affidabile: i blocchi
di verifica dentro le migrazioni inquinano l'estrazione, e ho contato 48
chiamate senza poterne garantire l'elenco»*.

**Il filtro che lo rende affidabile è contare solo i nomi che sono davvero
TABELLE di `public`.** Con quello, `update … loop`, i cursori e il testo
dei commenti escono dal conto — ed è la differenza fra 48 numeri di cui
non ci si fida e un elenco che si può leggere.

**Partenza:** 58 funzioni distinte chiamate con `.rpc(` dal codice del
sito. **43 sono `stable`**, cioè Postgres stesso vieta loro di scrivere —
non è una lettura del codice, è una proprietà che il motore fa rispettare.
Restano **15 volatili**:

| Funzione | Tabelle scritte | Dal corridoio? | Azione |
|---|---|---|---|
| `record_stock_consumption` | 2 — `stock_consumptions`, `stock_lots` | no | **spostata nel corridoio** |
| `close_shopping_list_item` | 2 — `shopping_list_items`, `stock_lots` | no | **spostata nel corridoio** |
| `merge_customers` | 2 — `customers`, `reservations` | no | **spostata nel corridoio** |
| `update_ingredient_price` | 2 — `ingredients`, `price_history` | no | **spostata nel corridoio** |
| `completa_task` | 1 — `tasks` (update + insert della ricorrenza) | no | **resta diretta**: una tabella sola. È «tutto o niente» per il senso, non per il numero di tabelle, e la transazione è già dentro la funzione |
| `riapri_task` | 1 — `tasks` (update + delete) | no | **resta diretta**, stessa ragione |
| `collega_articoli` | 1 — `articoli_fornitore` | no | resta diretta |
| `add_below_threshold_items` | 1 — `shopping_list_items` | no | resta diretta |
| `add_shopping_list_item` | 1 — `shopping_list_items` | no | resta diretta |
| `remove_shopping_list_item` | 1 — `shopping_list_items` | no | resta diretta |
| `register_stock_delivery` | 1 — `stock_lots` | no | resta diretta |
| `chiudi_mese` | 1 — `consuntivi_mensili` | no | resta diretta |
| `conferma_allergeni` | 1 — `ingredients` | no | resta diretta |
| `conferma_allergeni_tutti` | 1 — via `conferma_allergeni` | no | resta diretta |
| `submit_public_reservation` | 1 — `reservations` | no | resta diretta — **ed è voluto**: è l'unico varco del ruolo `anon`, e il corridoio pretende un utente autenticato |

**Le quattro trovate sono esattamente le quattro che il mandato
nominava: nessuna in più.** È il risultato che vale la pena dichiarare —
l'elenco del mandato era completo.

Nel database le funzioni multi-tabella sono **42** in tutto: le altre 38 o
sono già nel corridoio, o sono lavori notturni (`pulisci_richieste_scadute`,
`pulisci_posta_scaduta`, `send_due_task_reminders`) che nessun browser
chiama, o sono chiamate da altre funzioni (`scarica_magazzino_conto`, che
lavora dentro `close_order_paid`).

---

## 3. La regola non è imponibile con un permesso — e si dichiara

⚠️ **Non esiste un `revoke` che obblighi il browser a passare dal
corridoio.** Il corridoio chiama le funzioni **col token dell'utente
vero**: ha esattamente i diritti `authenticated` che ha il browser.
Togliere il permesso al browser lo toglierebbe anche a lui.

Quindi la rete è una **prova automatica**, fatta come quella del 13/08
sulle funzioni aperte ad `anon`: `tests/app/scritture-dal-corridoio.test.js`
**non ha l'elenco scritto dentro** — se lo costruisce chiamando
`funzioni_multi_tabella()` a ogni esecuzione, e confronta col risultato di
una scansione dei file di `src/`. Una funzione multi-tabella nuova,
chiamata direttamente, **fa diventare rossa la prova senza che nessuno si
sia ricordato di aggiornarla**.

⚠️ **La prova ha un controllo su sé stessa**: pretende di aver trovato
almeno venti chiamate `rpc(` nel codice. Senza, il giorno in cui
l'espressione non combaciasse più — codice spostato, forma cambiata —
passerebbe sempre, dicendo «tutto a posto» dopo aver guardato niente. È la
forma dello zero al posto del buco.

**E l'elenco vive nel database, non nel file della prova**, per la ragione
per cui il mandato diffida del censimento automatico: un elenco scritto a
mano in un file di prova invecchia in silenzio, e chi aggiunge una
funzione non ha nessun motivo per ricordarsene.

---

## 4. Una prova buttata perché mentiva

Avevo scritto un terzo controllo — «ogni operazione ammessa dal corridoio
esiste davvero nel database» — e **dava sette falsi allarmi su funzioni
perfettamente sane** (`close_order_paid`, `create_intercompany_cession`,
`set_active_menu`, `swap_recipe_steps`, `archivia_posta`, `versa_in_banca`,
`delete_anticipazione`).

Il motivo è che **PostgREST risponde «Could not find the function» sia
quando la funzione non esiste sia quando esiste e gli argomenti non
combaciano**: dal client le due cose sono indistinguibili. È stata tolta
invece che ammorbidita — *una prova che grida sempre viene spenta, e con
lei si spegne l'attenzione per quelle che gridano a ragione.* Il buco che
lascia (un nome scritto male nell'elenco del corridoio resta invisibile
finché qualcuno non usa quella schermata) è **dichiarato dentro il file**
insieme a cosa servirebbe per chiuderlo.

---

## 5. Cosa è stato verificato, e come

Dentro la migrazione, col ruolo vero del titolare, su **due sagome create
dalla verifica** — non su tavoli veri: una prenotazione di prova su un
tavolo vero lascerebbe la sala di stasera occupata da nessuno se qualcosa
andasse storto a metà.

| # | Controllo | Esito |
|---|---|---|
| 3a | «Ha disdetto»: stato **e** tavoli, insieme | stato `annullata`, 2 tavoli liberati, esito dichiarato coerente |
| 3b | Annullare due volte | respinto |
| 3c | Uno stato che non chiude (`confermata`) | respinto |
| 3d | Il censimento vede `annulla_prenotazione` fra le multi-tabella | sì |
| 3d | Il censimento **non** conta `register_stock_delivery` (una tabella sola) | corretto |
| 3d | Il censimento trova tutte e 4 le funzioni nominate dal mandato | 4 su 4 |

⚠️ **Il trigger delle notifiche su `reservations` è stato spento durante la
prova e riacceso — e il riaccendimento è verificato dentro la migrazione**
(trappola dell'11/08): lasciarlo spento non dà nessun errore, semplicemente
le richieste dei clienti non arrivano più a nessuno. Controllato anche dal
connettore dopo l'applicazione: `tgenabled = 'O'`, acceso.

Nessun gestore d'eccezione sul blocco esterno; perimetro fatto solo di roba
creata dalla verifica; `reservations` e `dining_tables` non sono fra le
tabelle sorvegliate da `deleted_records`, quindi non restano lapidi.

**Prove automatiche:** 2 nuove. Suite intera: **18 pure + 107 sul progetto
di prova, tutte verdi.** Lint a zero, build ok. **Idempotenza:** applicata
due volte di fila sul progetto di prova.

---

## 6. I numeri veri dell'applicazione in produzione

```
applicate e registrate: 1 su 1
totale migrazioni in produzione: 114
funzioni_multi_tabella: 42 | prenotazioni_annullate: 4 | tavoli_tenuti_da_chi_non_viene: 0
```

| Controllo (connettore in sola lettura, dopo) | Valore |
|---|---|
| Prenotazioni in produzione | 4, **tutte annullate** |
| Righe `prenotazione_tavoli` di prenotazioni annullate o rifiutate | **0** |
| Sagome in sala | 13, **nessuna residua** della prova |
| Trigger delle notifiche su `reservations` | acceso (`O`) |
| Funzioni di `public` eseguibili col solo `anon` | **12, invariate** |

**Nessuna riga orfana da sanare**: le 4 prenotazioni annullate non tengono
nessun tavolo.

🔴 **Errore mio nel testo della migrazione, dichiarato perché resta scritto
lì.** Nell'intestazione di `20260816000007` si legge *«2 prenotazioni di
prova in produzione, una sola con un tavolo assegnato. Nessuna è annullata
— verificato, non supposto»*. **Quel numero l'ho preso da `CLAUDE.md`, non
dal connettore**, e non era più vero: in produzione ce ne sono 4 e sono
tutte annullate. **La conclusione regge ed è ora verificata davvero** (0
tavoli orfani, riga qui sopra), ma la frase «verificato, non supposto» era
falsa nel momento in cui l'ho scritta — ed è precisamente il tipo di
affermazione su cui poi si costruisce. Il file applicato non si corregge
(Contratto §8): la correzione vive qui.

---

## 7. Cosa NON è verificato

- **Nessuna mano vera ha annullato una prenotazione** da nessuna delle due
  porte. Il giro è provato dentro la migrazione coi ruoli veri e dalla
  suite, mai da un dito su un tablet.
- **Le quattro funzioni spostate nel corridoio non sono state riesercitate
  dalle schermate**: scaricare a mano dal magazzino, chiudere una riga
  della lista della spesa, fondere due schede cliente e cambiare il prezzo
  di un ingrediente passano ora da una strada diversa, e quella strada è
  provata solo dalle prove automatiche esistenti (che però la percorrono:
  la suite è verde).
- **Il buco dichiarato al §4**: un nome scritto male nell'elenco del
  corridoio resta invisibile finché non lo si usa.
- **`completa_task` e `riapri_task` restano fuori dal corridoio** per una
  scelta: scrivono una tabella sola. Se la regola dovesse diventare «ogni
  operazione tutto-o-niente passa dal corridoio, anche a tabella sola»,
  quelle due sono le prime da spostare — ed è una decisione di Alessio, non
  una svista da correggere in silenzio.
