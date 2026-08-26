# Il conto entra nel registro, e la caparra che non arriva in cassa

**26/08/2026 · sera** — mandato «chiudere il perimetro del registro delle
cancellazioni, e la caparra che forse non arriva in cassa», quattro blocchi.

| | |
|---|---|
| **HEAD dichiarato** | `9d55235e6959711bde06c76cf51a88656cae2de0` |
| **Working tree** | pulito al momento del commit; questo riepilogo è il commit successivo |
| **Migrazioni applicate in produzione** | **9**, dalla `20260826000007` alla `20260826000015` |
| **Migrazione nuova, NON in produzione** | `20260826000016_le_tre_che_entrano_e_le_nove_che_restano_fuori.sql` — applicata solo alla prova, aspetta il push |
| **Prove** | oxlint zero avvisi · 475 pure · 419 sull'app, tutte verdi |

---

## Blocco 1 — le nove in attesa

**Erano su GitHub**: `origin/master` e `HEAD` coincidevano (`075433b`), working
tree pulito, e i sei controlli di `npm run migra` sono passati tutti — compreso
quello che pretende il passaggio dal progetto di prova e quello che pretende un
riepilogo per ogni migrazione già applicata. Applicate: **9 su 9**.

### I numeri, misurati DOPO e non attesi

| cosa | prima | dopo |
|---|---|---|
| migrazioni in produzione | 260 | **269** |
| ultima | `20260826000006` | **`20260826000015`** |
| tabelle che scrivono nel registro | 21 | **26** |
| conti bancari | 0 | **0** |
| ricette | 14 | **14** |
| impegni | 8 | **8** |
| menu | 1 | **1** |
| tavoli | 13 | **13** |
| lapidi | 0 | **0** |
| previsioni | 1 | **1** |
| tetto di spesa | 10,00 | **10,00** |
| movimenti di cassa | 0 | **0** |
| conti | 0 | **0** |

**La Previsione di partenza è intatta**: `congelato_il = 2026-08-15
20:29:38.087382+00`, letto dalla riga e non dedotto.

**`registra_dettatura_da_chiave` adesso tocca la chiave.** Misurato leggendo il
corpo vivo dal database, prima e dopo:

| funzione | `ultimo_uso` | `scritture` | usa `voce_limite_dettature` |
|---|---|---|---|
| `registra_dettatura_da_chiave` **prima** | no | no | (non esisteva) |
| `registra_dettatura_da_chiave` **dopo** | **sì** | **sì** | **sì** |
| `voce_apri_sessione` dopo | sì | no | **sì** |

`chiavi_voce` ha ora nove colonne, `scritture integer default 0` compresa: il
contatore che prima mentiva stando fermo adesso ha il suo posto.

### Le 26 tabelle nel registro, per nome

`anticipazioni_socio` · `cash_movements` · `consuntivi_mensili` ·
`conteggi_cassa` · **`conti_bancari`** · `deductible_expenses` ·
`discounts_gifts` · `documents` · `employee_documents` · `employee_leaves` ·
`employees` · `foraged_items` · `intercompany_cessions` · `note_credito` ·
**`note_credito_utilizzi`** · `order_items` · `order_payments` · `payslips` ·
**`prestiti_privati`** · **`restituzioni_prestito`** · `scenari_proiezione` ·
**`segnalazioni_fiscali`** · `supplier_invoices` · `tip_distribution_lines` ·
`tip_distributions` · `tips_collected`

Le cinque in grassetto sono quelle entrate con la `…011`.

---

## Blocco 2 — le classificazioni decise

### Le premesse del mandato, rifatte

| | esito |
|---|---|
| **P1** — `orders` ha `documento_fiscale`, `documento_numero`, `documento_emesso_il`, `coperto_unit_price`, `payment_method` | ✅ **regge**, tutte e cinque presenti (22 colonne in tutto) |
| **P2** — `stock_consumptions.costo` e `rettifiche_giacenza.valore` | ✅ **regge**, entrambe `numeric` |
| **P3** — `ordini_fornitore` non ha alcuna colonna di importo | ✅ **regge sulla testata** — ⚠️ ma vedi sotto |
| **P4** — le tre hanno la colonna `id` | ✅ **regge**, tutte e tre |
| **P5** — zero funzioni nominano `reservation_deposits` | ✅ **regge**, con la controprova: 18 nominano `cash_movements`, 18 nominano `reservations` |

🔴 **P3 regge alla lettera e la ragione della decisione no.**
`ordini_fornitore_righe` **ha un importo**: `prezzo_atteso numeric`. La
decisione di Alessio («ordini ai fornitori fuori») **non è stata scavalcata**,
perché regge sull'altra sua ragione — un prezzo *atteso* è una previsione
scritta quando l'ordine parte, non denaro che si è mosso, e quanto si è pagato
lo dice la fattura, dentro dall'08/08. Ma la ragione scritta in tabella adesso
**nomina la colonna**, così chi vorrà rovesciarla avrà il fatto e non una frase
generica.

### Le tre che entrano

`orders`, `stock_consumptions`, `rettifiche_giacenza` — trigger `trg_log_delete`
+ classificazione `dentro = true`.

### Le nove che restano fuori, con `dentro = false` esplicito

`ordini_fornitore` · `ordini_fornitore_righe` · `spesa_spicciola` ·
`posta_ricevuta` · `posta_allegati` · `posta_azioni` · `stock_lots` ·
`produzioni` · `trasformazioni_dichiarate`

⚠️ Le ultime sei portano **«per ora»** scritto nella ragione: un «fuori»
definitivo e un «fuori» in attesa di un lavoro sono due cose diverse, e fra sei
mesi non si distinguerebbero più.

### Come si giudica, dai fallimenti — tre rotture, tre errori diversi

Il blocco di verifica è stato estratto (`sed -n '/^do \$verifica\$/,/^end
\$verifica\$;/p'`) e lanciato **contro un database rotto apposta**, perché
rilanciare la migrazione intera rimetterebbe a posto la rottura prima di
verificarla.

| rottura | risposta |
|---|---|
| tolto `trg_log_delete` da `orders` | `Il perimetro non torna su 1 voci: orders (manca il registro)` |
| messo `trg_log_delete` su `spesa_spicciola`, decisa FUORI | `Il perimetro non torna su 1 voci: spesa_spicciola (registro di troppo)` |
| `log_deleted_record` che scrive `record_id` nullo | `Cancellato un conto e la sua lapide non c'e' (o e' senza riferimento)` |

🔴 **E la seconda rottura ha insegnato qualcosa sul metodo.** Togliendo il
trigger da `orders` volevo mettere alla prova il controllo *«la lapide c'è e ha
il riferimento»*: quel controllo **non è mai stato raggiunto**, perché il
guardiano del perimetro sta prima e ha risposto lui. La rottura che raggiunge il
controllo in esame è la terza — quella che lascia il perimetro coerente e rompe
il *contenuto* della lapide. *Una prova per rottura vale solo se la rottura
arriva fino al controllo che si vuole provare.* Messo in `CLAUDE.md` §8.

### I conteggi della verifica, sul progetto di prova

```
le tre che entrano: lapidi 2820 -> 2823, tutte col riferimento
spesa_spicciola resta fuori: lapidi 2823 prima, 2823 dopo
restano da decidere: 11 tabelle
verifica: nessun residuo, lapidi tornate a 2820
```

La verifica controlla anche il **contenuto** delle lapidi, non solo che ci
siano: `documento_numero = '1-0001'` sul conto, `costo = 4.20` sullo scarico,
`valore = -5.60` sulla rettifica. E controlla di **non** aver deciso le caparre.

Perimetro della verifica: ingrediente proprio creato apposta, identificativi in
un array, lapidi finte tolte per identificativo, `pretendi_nessun_residuo()`
alla fine. Stato della prova dopo le tre rotture e il ripristino: **2820 lapidi,
0 senza riferimento, 0 voci da sistemare, 29 dentro = 29 trigger, nessun
residuo `VERIFICA`**.

---

## Blocco 3 — la caparra NON arriva in cassa

⚠️ **Misurato, non riparato**, come il mandato chiede.

### Il percorso, guardato dalla schermata al database

1. `src/pages/calendario/ReservationForm.jsx:445` — campo «Caparra €», visibile
   **solo al titolare e solo sugli eventi**.
2. Riga 198: `if (isTitolare && isEvent) await setReservationDeposit(targetId, deposit)`.
3. `src/lib/api/reservations.js:201` — `setReservationDeposit` fa un `upsert`
   diretto su `reservation_deposits`. **E finisce lì.**
4. Sulla tabella: **zero trigger**. Nel database: **zero funzioni la nominano**.

**Nessun movimento di cassa nasce. Mai.**

### Quanto è grande

| | gestionale VERO | progetto di PROVA |
|---|---|---|
| caparre | **0** | **3** |
| somma | — | **245,00 €** (80 + 85 + 80) |
| movimenti di cassa con quegli importi | — | **0** |
| causali che nominano una caparra | **0** | **0** |

**3 su 3 senza movimento.** In produzione oggi non morde perché non c'è ancora
nessun evento; morde il giorno del primo.

⚠️ **E non è che il movimento sia scritto con la causale sbagliata: non esiste
nessuna causale per una caparra.** Le entrate disponibili sono *Incasso
giornaliero*, *Altro incasso* e due di sistema. Il buco è completo — non si
scrive niente, e non c'è dove scriverlo.

### 🔴 Altri due buchi nello stesso punto, trovati guardando chi legge quel numero

- **Nessuno la scala dal conto.** `getReservationDeposit` è chiamata **da un
  solo posto**: la scheda che l'ha scritta. Nessun conto, nessun saldo, «Ce la
  faccio?» non la conosce. Il cliente versa 80 € di caparra e alla serata paga
  il conto pieno.
- **Sparisce da sola dopo sei mesi.**
  `reservation_deposits_reservation_id_fkey` è `ON DELETE CASCADE`, e
  `pulisci_richieste_scadute()` cancella le prenotazioni rifiutate o annullate
  dopo sei mesi. Sul progetto di prova una delle tre caparre è proprio su una
  `richiesta_in_attesa`, da **85,00 €**.

### Conseguenza sul Blocco 2

`reservation_deposits` **resta VUOTA** nel perimetro, e la verifica lo pretende
esplicitamente. Finché il denaro non ha una strada, decidere se conservarne la
lapide risponde alla domanda sbagliata. ⚠️ E la tabella **non ha una colonna
`id`** — è `reservation_id`, `amount`, `created_at` — quindi messa dentro così
com'è la lapide nascerebbe senza riferimento.

Tutto in [`docs/CODA_E_DECISIONI.md`](../CODA_E_DECISIONI.md), voce `0-caparra`.

---

## Blocco 4 — il controllo segnala e basta

Provato su un caso di cui conoscevo già la risposta: **una tabella nuova creata
apposta** sul progetto di prova, e poi portata attraverso tutti e cinque gli
stati.

| stato | risposta del controllo | da sistemare | da decidere |
|---|---|---|---|
| tabella nuova, non classificata | `non classificata` | 1 | 11 |
| classificata DA DECIDERE | *tace* | 0 | **12** |
| DA DECIDERE + trigger addosso | `decisa di fatto` | 1 | 12 |
| decisa FUORI + trigger addosso | `registro di troppo` | 1 | 11 |
| **decisa FUORI senza trigger** | *tace — sparisce da entrambi* | **0** | **11** |
| classificata ma tabella sparita | `classificata ma non esiste piu'` | 1 | 11 |

✅ **Le tre cose che il mandato chiede reggono tutte**: una «da decidere» resta
segnalata finché non la classifica qualcuno, una decisa FUORI non compare più, e
una tabella nuova non classificata compare da subito. E fra un giro e l'altro il
controllo **tace**: 0 voci da sistemare, 11 da decidere. Non diventa rumore
mentre Alessio guarda le altre.

Tabella di prova e classificazione tolte: la prova è tornata a 0 / 11.

### Le undici ancora da decidere, con le colonne aperte

| tabella | cosa contiene davvero | denaro dentro | ha `id` |
|---|---|---|---|
| `order_tables` | `order_id`, `dining_table_id`, `etichetta_al_momento`, `conto_aperto` — quali tavoli stanno su un conto | no | 🔴 **NO** |
| `reservation_deposits` | `reservation_id`, `amount`, `created_at` | **`amount`** | 🔴 **NO** |
| `price_history` | `ingredient_id`, `price`, `supplier_id`, `source`, `recorded_at`, `articolo_id` — lo storico dei prezzi d'acquisto | **`price`** | sì |
| `storico_costi_ricetta` | `recipe_id`, `progressivo`, `food_cost_base`, `food_cost_portion`, `causa`, `righe_senza_prezzo` | **due food cost** | sì |
| `preventivi` | cliente, data evento, persone, stato, `costo_cibo`, `prezzo_a_persona_scavalcato`, `accettato_il` | **due importi** | sì |
| `preventivo_righe` | `quantita`, `porzioni_per_persona`, `prezzo` | **`prezzo`** | sì |
| `preventivo_fogli` | `prodotto_il`, `canale`, `destinatario`, `contenuto` — cosa diceva il foglio che il cliente ha in mano | no (il contenuto sì, come testo) | sì |
| `scadenze_previste` | `descrizione`, `importo`, `scade_il`, `ogni_mesi`, `mezzo`, `chiusa_il` | **`importo`** | sì |
| `dettature` | `testo`, `modello`, `token_domanda`, `token_risposta`, `costo_euro` | **`costo_euro`** | sì |
| `letture_foto` | `genere`, `riconosciuto`, `modello`, i token, `costo_euro`, `bytes_immagine` | **`costo_euro`** | sì |
| `azioni_dettate` | `dettatura_id`, `tipo`, `dati`, `sicuro`, `stato`, `eseguita_il`, `risultato`, `errore` | no | sì |

⚠️ **`price_history` e `storico_costi_ricetta` NON sono magazzino** — sono lo
storico dei prezzi d'acquisto e quello dei costi di ricetta — quindi «il resto
del magazzino» del mandato non le nomina, e attribuirgliele sarebbe stato
decidere al posto suo.

⚠️ **Due tabelle senza `id`.** Se `order_tables` o `reservation_deposits`
entrassero così come sono, la lapide nascerebbe **senza il riferimento** che
serve a ritrovare la riga. La copia `jsonb` ci sarebbe lo stesso: il registro
non sarebbe vuoto, sarebbe **mutilato in silenzio**.

---

## Cosa abbiamo rovesciato

- **Cosa era stato deciso e quando**: l'08/08/2026, costruendo il registro delle
  cancellazioni, `orders` fu lasciata deliberatamente FUORI. Sta scritto negli
  appunti del progetto: *«`orders` NON è fra queste, e la distinzione conta
  quando una verifica deve ripulirsi»*.
- **La ragione di allora**: un conto nasce e muore in sala, e le prove ne creano
  e ne cancellano di continuo — tracciarlo avrebbe riempito di lapidi finte un
  registro che nessuno può ripulire dall'app.
- **Cosa si decide adesso**: `orders` entra nel perimetro. Decisione di Alessio
  del 26/08/2026.
- **Perché la ragione di allora non vale più**: l'08/08 il conto era una testata
  con un totale. Da allora si è preso addosso il riferimento allo scontrino
  emesso, il prezzo del coperto fotografato e il mezzo di pagamento — è
  diventato **il documento che dice se un incasso è stato fiscalizzato**. E la
  comodità delle prove non è mai stata un buon criterio per decidere cosa il
  gestionale conserva: il modo giusto è che le prove si ripuliscano, non che il
  registro sia più corto.

Registrato anche in [`docs/decisioni_rovesciate.md`](../decisioni_rovesciate.md).

---

## 🔴 Rilettura obbligatoria

### Cosa NON ho verificato con gli occhi

- **Nessuna schermata è stata aperta.** Il campo «Caparra €» l'ho letto nel
  codice sorgente, non a video: non so come si vede, se è leggibile, né cosa
  succede visivamente quando lo si compila.
- **Nessuna mano ha cancellato un conto dall'app dopo questa modifica.** Che
  `orders` lasci la lapide è provato dentro la migrazione (che gira come
  proprietaria) e non dal gesto vero di un utente col suo token.
- **Nessuna misura di schermo, nessun bersaglio di tocco, nessuna stampa.**
  Questo mandato non ha toccato nessuna interfaccia.

### Cosa ho contato senza leggerlo

- **Le 71 tabelle classificate FUORI dalla `…011`**: ho contato la riga, non ho
  riaperto le colonne di ognuna. Ho aperto per intero solo le 12 che ho deciso e
  le 11 rimaste.
- **I 57 movimenti di cassa della prova**: ho verificato che nessuno abbia gli
  importi delle tre caparre e che nessuna causale le nomini. Non li ho letti uno
  per uno.
- **Le 419 prove dell'app**: ho letto il totale verde, non il contenuto di
  ciascuna.

### Quali mie affermazioni sono diventate false mentre lavoravo

- Il file della migrazione è nato
  `..._le_tre_che_entrano_e_le_sei_che_restano_fuori.sql`, e **«sei» era già
  sbagliato quando l'ho scritto**: le tabelle sono nove, raggruppate in quattro
  decisioni. Rinominato prima del commit, insieme al nome in
  `applied_migrations`.
- Ho scritto nel corpo della migrazione «ne ha decise nove» e poi «ne ha decise
  dodici»: il numero giusto è **dodici** (3 dentro + 9 fuori), e le rimaste sono
  **undici**, non quattordici. Corretto prima del commit.

### Quali blocchi non ho aperto

**Nessuno**: tutti e quattro aperti e chiusi.

### Quali conteggi sono pavimenti e non totali

- **Le ~97 lapidi lasciate da un giro di `npm run test:app`** sono la misura di
  *un* giro sul database di prova com'era stasera. Cambia con le prove che si
  aggiungono.
- **I 245,00 € di caparre** sono quello che c'è sulla prova adesso: è la vita
  finta di due mesi, non una previsione di quante caparre ci saranno.
- **Le 11 tabelle da decidere** sono quelle che esistono oggi. Ogni tabella
  nuova ne aggiunge una, ed è il punto del guardiano.

### Quali voci di `docs/DECISIONI.md` ho toccato

Ne ho **aggiunta una sezione nuova**, *Registro delle cancellazioni — il
perimetro*, con le sette decisioni di stasera. **Non ne ho modificata né
contraddetta nessuna esistente.**

### Quali migrazioni restano in attesa, in ordine

1. `20260826000016_le_tre_che_entrano_e_le_nove_che_restano_fuori.sql`

Applicata solo al progetto di prova. Entra in produzione dopo il push di
Alessio, con `npm run migra -- --conferma`.

### Quali lezioni nuove ho messo nel file delle trappole

Due, in `CLAUDE.md` §8:

1. **Una rottura che fa scattare il primo guardiano non prova i controlli che
   vengono dopo.** Per mettere alla prova un controllo bisogna guardare *quale
   guardiano scatta per primo su quella rottura*.
2. **Un commento dentro una prova può essere falso dal giorno in cui è stato
   scritto.** In `comande.test.js` c'era che `order_items` non è sorvegliata:
   lo è dall'08/08, con **1035 lapidi misurate**. La regola «un numero in un
   commento è una frase destinata a diventare falsa» vale anche per le
   affermazioni **senza numeri**.

---

## Cosa resta scoperto, dichiarato

- 🔴 **Il buco della caparra è aperto e non riparato.** È la prima domanda.
- 🔴 **`tests/app/LEGGIMI.md` vieta di creare-e-cancellare righe nelle tabelle
  sorvegliate, e quel divieto è violato** da tutte le prove che cancellano un
  conto. Era già violato prima di stasera (`order_items`, 1035 lapidi); da
  stasera lo è anche sulla testata (**36 lapidi per giro**). Ho corretto il
  commento falso, **non ho sanato le prove**: la cura è farle ripulire le
  proprie lapidi per identificativo con `righeMie()`, ed è un lavoro a sé.
- ⚠️ **`perimetro_da_sistemare()` non è chiamabile dall'app**: la `…015` ha
  tolto i permessi apposta, così la funzione torna chiamabile da una migrazione.
  Il guardiano quindi vive **dentro le migrazioni**, non in una schermata.
  Nessuno lo vedrà finché non gira una migrazione nuova.
