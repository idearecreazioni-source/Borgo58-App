# Niente date riempite da sole — gli otto predefiniti tolti

**Migrazione**: `20260819000009_niente_date_riempite_da_sole.sql`
— applicata sul progetto di prova, **NON ancora in produzione** (aspetta il
push, vedi in fondo).
**Deciso da Alessio** il 19/08/2026, scartando l'alternativa che gli era
stata proposta: *«togliamole per ora»*.

---

## ⚠️ Cosa NON è verificato

1. 🔴 **Non è in produzione**: `npm run migra` si rifiuta finché le
   migrazioni non sono su GitHub, e il push lo fa Alessio.
2. 🔴 **Nessuna mano ha chiuso un conto in sala dopo questa modifica.** È
   provato dentro la migrazione, che apre un conto vero e lo omaggia — ma
   con i claims impostati, non con un tablet.
3. ⚠️ **La chiusura in sala cambia comportamento fra mezzanotte e le 5**, ed
   è la voce da tenere d'occhio: prima quell'omaggio prendeva il giorno di
   calendario, adesso prende la serata. È un cambiamento voluto (sotto la
   ragione), ma nessuno l'ha ancora visto succedere davvero.
4. ⚠️ **Le otto colonne sono quelle del censimento del 19/08.** Se ne
   esistesse una nona con un predefinito di data che quel censimento non ha
   preso, questa migrazione non la tocca.

---

## Cosa abbiamo rovesciato

**Un rovesciamento c'è, ed è di poche ore fa.** La migrazione
`20260819000006` (la mattina) aveva **rifatto** tutti e otto i predefiniti,
cambiandone il fuso: sette a `oggi_a_roma()`, uno a `serata_di_servizio()`.

- **Cosa era stato deciso**: che un predefinito sbagliato si corregge.
- **La ragione di allora**: erano tutti a `current_date`, cioè a Greenwich —
  fra mezzanotte e le due scrivevano *ieri* a chiunque. Correggerli era
  meglio che lasciarli.
- **Cosa si decide adesso**: si tolgono.
- **Perché la ragione di allora non vale più**: non è che fosse sbagliata —
  è che era **una cura a metà**, e si vede solo adesso che la schermata è
  stata sistemata. Finché la schermata proponeva una data sbagliata, il
  predefinito era l'ultima difesa; ora che la schermata propone la risposta
  giusta, il predefinito è **una seconda regola che decide una giornata al
  posto di Alessio, in silenzio** — e sarebbe stata la **terza copia** della
  stessa regola (la funzione del database, la schermata, il predefinito).

Parole sue, e valgono come criterio oltre questa colonna: *allineare il
predefinito lo renderebbe meno sbagliato, ma resterebbe una regola che
decide al posto suo senza dirlo.* È la famiglia dei **33 posti silenziosi**
del 17/08.

Registrato in [`decisioni_rovesciate.md`](../decisioni_rovesciate.md).

---

## La misura, una colonna per volta

Guardati **funzioni SQL, schermate, prove automatiche, comandi di servizio e
Edge Function**. Per ciascuna colonna la domanda era una sola: *chi la scrive
oggi passa sempre una data esplicita?*

| colonna | chi la scrive | esito |
|---|---|---|
| `anticipazioni_socio.pagata_il` | `createAnticipazione` (schermata Sezione personale) | esplicita → **tolto** |
| `cash_movements.movement_date` | 5 funzioni SQL + `createCashMovement` da Prima nota | esplicita → **tolto** |
| `conteggi_cassa.contato_il` | solo `registra_conteggio_cassa`, e la schermata le passa la **serata confermata** | esplicita → **tolto** |
| `daily_menus.service_date` | `createDailyMenu` (Piatti del giorno) | esplicita → **tolto** |
| `deductible_expenses.expense_date` | `createDeductibleExpense` (Deduzioni) | esplicita → **tolto** |
| `discounts_gifts.movement_date` | `createDiscountGift` (registro manuale) **e `close_order_as_discount_gift` (sala)** | 🔴 **la sala NON la passava** |
| `foraged_items.harvest_date` | `createForagedItem` (Raccolta propria) | esplicita → **tolto** |
| `tips_collected.collected_date` | `payloadMancia` → `createTipCollected` (Mance) | esplicita → **tolto** |

⚠️ **Su `conteggi_cassa` la domanda era più stretta**, ed era una condizione
di Alessio: quella colonna deve ricevere la serata **confermata da lui nella
schermata**, non una data qualsiasi. La passa: `CassaHome` manda il valore
del campo «Serata che stai chiudendo». Il predefinito era quindi già morto.

---

## 🔴 L'ottava, e perché l'ordine dei gesti non era un dettaglio

`close_order_as_discount_gift` — **la chiusura di un conto come sconto o
omaggio, in sala** — inseriva in `discounts_gifts` senza nominare
`movement_date`: si appoggiava al predefinito. Togliere il predefinito e
basta **avrebbe rotto quel gesto in servizio**, con un errore incomprensibile
davanti al cliente.

La regola di Alessio dice cosa fare: *prima passa la data esplicita in quel
punto, poi togli.* Fatto in quest'ordine, dentro la stessa migrazione.

### E la data giusta lì è la SERATA, non il calendario

Non è una scelta di gusto, ed è la parte che merita di essere letta:

- uno sconto o un omaggio è **la traccia economica di un conto**;
- il giorno di un conto è la sua **serata** dappertutto —
  `conti_da_fiscalizzare`, `quadratura_fiscale`, `misure_del_mese` e
  `ricavi_non_fiscalizzati` leggono tutte `serata_di_servizio(closed_at)`;
- datandolo a calendario, un omaggio dell'una di notte finirebbe su un
  **giorno diverso dal conto che l'ha generato** — e l'ultima notte del mese,
  su un **mese diverso**: il budget degli omaggi e i ricavi direbbero due
  cose diverse sullo stesso fatto.

⚠️ **E i due non possono divergere**: dentro una transazione `now()` è un
istante solo, quindi `serata_di_servizio()` e `closed_at = now()` parlano
dello stesso momento.

⚠️ **Non allarga il perimetro di Alessio**: il suo primo gesto è «il conto
incassato dopo mezzanotte», e questo è un conto chiuso dopo mezzanotte.
L'alternativa scartata era passare `oggi_a_roma()` per non cambiare niente:
avrebbe conservato il comportamento di oggi e lasciato **la stessa tabella
scritta con due regole diverse dalle sue due porte**.

---

## Le prove, e le due rotture

**Dieci controlli dentro la migrazione**, in due famiglie:

1. **Il catalogo**: nessuna delle otto ha più un predefinito, **e tutte e
   otto sono ancora obbligatorie**. ⚠️ La seconda metà non è un di più: se
   una colonna diventasse facoltativa, togliere il predefinito smetterebbe
   di dare errore e scriverebbe un **NULL in silenzio** — il contrario di
   quello che si vuole.
2. **Il comportamento**: otto inserimenti senza data, e ognuno deve dare
   l'errore **giusto** — `not_null_violation` **sulla colonna attesa**, letta
   dalle diagnostiche. Un vincolo diverso che scattasse prima farebbe passare
   la prova senza aver provato niente. ⚠️ Quelle scritture non lasciano nulla
   dietro di sé **per costruzione**: sono tutte destinate a fallire.
3. **Il gesto vero**: la migrazione apre un conto su un tavolo libero, lo
   omaggia, controlla che l'omaggio porti la serata e che il conto risulti
   omaggiato, poi ripulisce tutto e **controlla il registro delle
   cancellazioni prima e dopo**.

| rottura | cosa è diventato rosso |
|---|---|
| la chiusura in sala **non** passa la data | *«null value in column "movement_date" violates not-null constraint»* — cioè esattamente il gesto rotto in servizio che l'ordine dei passi evita |
| un predefinito resta al suo posto | *«Restano 1 colonne con un predefinito: foraged_items.harvest_date»* |

🔴 **E la seconda rottura al primo tentativo NON ha discriminato**, il che
vale più della rottura stessa: commentare l'`alter table` non rimetteva il
predefinito, perché il database era **già** nello stato giusto. La prova
passava senza provare niente — la trappola del «caso vuoto» (17/08), stavolta
sulla controprova. Rimesso il predefinito a mano sul progetto di prova, la
verifica è diventata rossa con il nome della colonna.

---

## Il Contratto non cambia — constatato prima

Richiesta esplicita di Alessio. Constatato: **[`CONTRATTO.md`](../CONTRATTO.md)
non nomina i predefiniti di colonna in nessun punto**; la §4 (contratto
RLS/Postgres) elenca RLS, portieri, viste `_display`, verifica e
registrazione delle migrazioni, registro delle cancellazioni e freni sul form
pubblico. `discounts_gifts` compare **solo** nella regola B4 (atomicità della
chiusura conto), che questa migrazione rispetta: la scrittura resta dentro
l'unica funzione Postgres di sempre, chiamata dal corridoio.

Nessuna modifica al Contratto, quindi nessun commit separato.

---

## Per Alessio, in una riga

Da adesso il gestionale non mette più una data al posto tuo quando qualcuno
si dimentica di scriverla: si ferma e lo dice. E l'omaggio che chiudi in sala
alle due di notte finisce sulla serata giusta, la stessa del conto.

---

**Commit del lavoro**: `18e4b15` — «Niente date riempite da sole: gli otto
predefiniti si tolgono».
**Working tree**: pulito al momento del commit del lavoro.
**Migrazione**: `20260819000009` — sul progetto di prova sì, in produzione
**no**, in attesa del `git push`.
