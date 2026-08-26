# La caparra si scala dal conto, ma solo se glielo dici tu

**27/08/2026 · notte** — mandato «la metà mancante della caparra, più tre
pendenze corte». **Blocchi aperti e chiusi: 1, 2, 4. Blocchi 3 e 5 NON
aperti.**

> ⚠️ **Ogni affermazione con un numero porta (vero) o (prova)**, a dire su
> quale dei due gestionali vale. È la forma chiesta dal mandato, e la ragione
> era fondata: nei due riepiloghi precedenti un paragrafo passava dall'uno
> all'altro senza dirlo.

| | |
|---|---|
| **HEAD dichiarato** | `01ae85642dbcb352638a766db3ad7326aac425c1` |
| **In produzione (vero)** | 270 migrazioni, ultima `20260826000016` |
| **Sulla prova (prova)** | 272 migrazioni, ultima `20260826000018` |
| **In attesa del push** | `…000017` e `…000018`, in quest'ordine |
| **Prove** | oxlint zero avvisi · 475 pure · 425 sull'app (6 nuove), tutte verdi **(prova)** |

---

## Blocco 1 — il nome che Vite rifiutava

`server.allowedHosts` in `vite.config.js` apre **il dominio della rete
privata**, non la macchina: `.ts.net` (Tailscale) più il nome di questo
computer **chiesto a `os.hostname()` a ogni avvio**, in due forme — Windows lo
dà maiuscolo, il browser lo manda minuscolo.

⚠️ **Il nome non è scritto a mano da nessuna parte.** Il giorno che la macchina
cambia nome, la riga lo segue da sé.

⚠️ **E non si è messo `true`**, che vorrebbe dire «qualunque nome va bene»: il
controllo di Vite esiste perché un sito qualsiasi aperto nel browser non possa
farsi rispondere dal server di sviluppo.

**Misurato facendo partire Vite e chiedendogli le tre cose (locale, non è né
vero né prova — è il computer):**

| Host | risposta |
|---|---|
| `desktop-vqjknao` (quello che veniva rifiutato) | **200** |
| `desktop-vqjknao.tail1234.ts.net` | **200** |
| `sito-cattivo.example` | **«Blocked request»** — ancora rifiutato |

---

## Blocco 2 — la caparra si scala dal conto

### Le premesse, rifatte **(vero)**

| | esito |
|---|---|
| **P1** — 270 migrazioni, ultima `…016`; 29 tabelle tracciate, con `orders`, `stock_consumptions`, `rettifiche_giacenza` | ✅ regge, tutte e tre presenti per nome |
| **P2** — 17 causali, zero funzioni nominano `reservation_deposits` | ✅ regge: il lavoro sulla caparra **non è in produzione** |
| **P3** — `reservation_deposits` ha 3 sole colonne, nessun `id` proprio | ✅ regge |
| **P4** — `mezzo` solo cassa/banca, banca vuole `conto_id`, importo > 0 | ✅ regge |

🔴 **E il freno ha trovato una cosa che il mandato dava per fatta**: «Alessio ha
già pubblicato» — ma `git rev-list` diceva **HEAD 2 commit avanti a
origin/master**, e `npm run migra` si è rifiutato di applicare la `…017`
*«queste migrazioni non sono ancora su GitHub»*. La caparra non è in produzione
perché **il push manca**, non per un errore.

### La scelta che regge tutto: quota di pagamento, non sconto

Il conto fa 300, la caparra 80, il cliente ne dà 220. Se la caparra fosse uno
**sconto**, i ricavi scenderebbero a 220 — falso: quel piatto è stato venduto a
300. Come **quota di pagamento** i ricavi restano 300 e cambia solo da dove
sono arrivati i soldi. Quindi `order_payments.mezzo` accetta un terzo valore,
`caparra`, e la quadratura che regge la chiusura non si tocca.

### I quattro lettori di `order_payments`, aperti uno per uno

| funzione | cosa fa con la caparra | è giusto? |
|---|---|---|
| `saldo_tesoreria` | filtra `= 'contante'` → **la esclude** | **Sì, ed è il punto**: quei contanti sono entrati giorni fa e stanno già nel saldo di prima nota. Contarli qui li conterebbe **due volte**, e ogni conteggio del cassetto mostrerebbe un'eccedenza che nessuno sa spiegare |
| `pos_in_transito` | filtra `= 'carta'` → la esclude | Sì |
| `conti_senza_quadratura` | somma **tutte** le quote | Sì: col la caparra dentro il conto torna |
| `riflette_mezzo_pagamento` | **va cambiato** | vedi sotto |

### Il riflesso salta la caparra — e la rottura l'ha dimostrato duramente

`orders.payment_method` risponde a «come ha pagato il cliente quella sera».
Senza correzione, un conto saldato con caparra + contanti si leggerebbe
**«misto»**, cioè una cosa che non è successa.

🔴 **Rotto apposta per vedere se il filtro serve davvero (prova)**: rimesso il
riflesso a contare anche la caparra, la chiusura **non sbaglia l'etichetta — 
fallisce**: `invalid input value for enum order_payment_method: "caparra"`. In
sala vorrebbe dire un conto che non si chiude col cliente davanti.

⚠️ E `caparra` **non entra** nell'enum: se ci entrasse, prima o poi qualcuno lo
sceglierebbe come se fosse un modo di pagare al tavolo.

⚠️ Prezzo dichiarato: un conto coperto **interamente** dalla caparra resta senza
mezzo di pagamento. È vero — quella sera il cliente non ha pagato niente.

### Dove vive «già usata»

`cash_movements.caparra_usata_su_conto`, **sul movimento e non sulla caparra**:
la caparra sparisce a cascata con la prenotazione quando passa la pulizia della
privacy, il movimento no. Uno stato su una riga che può sparire è uno stato che
prima o poi non c'è più.

### I casi che decidono, misurati **(prova)**

```
(a) conto senza caparra: la proposta non restituisce nessuna riga
(b) caparra 200,00 su un conto da 10,00 €: scalo rifiutato, conto chiuso lo stesso
(proposta) Questo cliente ha già versato 200,00 € di caparra il 27/08/2026.
           Il conto fa 520,00 €: da incassare adesso 320,00 €.
(c/d) conto da 520,00 €: quota caparra 200,00 + contante 320,00 €,
      mezzo di pagamento «contante»
(c) stesso conto chiuso due volte: la seconda è respinta, la quota resta una
(d) secondo conto sulla stessa prenotazione:
    «Questa caparra di 200,00 € è già stata scalata su un altro conto.»
verifica: nessun residuo, lapidi tornate a 3033
```

🔴 **Rottura sulla guardia del doppio uso (prova)**: tolta la lettura di
`caparra_usata_su_conto` dalla proposta, il caso (d) è diventato rosso — *«La
ragione è "piu_grande_del_conto" invece di "gia_usata"»*.

### La caparra più grande del conto — misurato, non deciso

**Cosa fa il gestionale adesso**: rifiuta lo scalo dicendo i due numeri e quanto
avanzerebbe, e **il conto si chiude lo stesso senza scalare** — quindi non è un
vicolo cieco in servizio. Che fine facciano i soldi che avanzano **non è
deciso**: è la domanda 1.

### In sala: impossibile da non vedere, per costruzione

Non un avviso colorato che si salta premendo il pulsante accanto: **finché non
ha scelto «Scala la caparra» o «Non scalarla», i pulsanti di pagamento sono
spenti.** Poi la banda dice cosa ha scelto, con «cambia».

⚠️ Limite dichiarato: **con la caparra scalata il conto si chiude con un mezzo
di pagamento solo.** «Pagano in due modi» e «Alla romana» restano spenti, con la
riga che dice perché e come averli. Sommare tre quote di cui una già incassata
è aritmetica che non ho voluto improvvisare.

### 🔴 Due reti sono diventate rosse da sole, e hanno trovato roba vera

1. **I vocabolari** — `close_order_paid(p_payment_method)` accetta {contante,
   carta} mentre il vincolo ora ne ammette tre. **La differenza è voluta**:
   `caparra` non è un modo di pagare che un cameriere possa scegliere, lo scrive
   solo il gestionale quando Alessio conferma. Dichiarata in `GUARDIE_ESENTI`
   con la ragione e col verso del rischio.
2. **«Nessuna lettura resta muta»** — ⚠️ **e questo era un difetto mio, vero.**
   Avevo scritto `.catch(() => setCaparra(null))`: se la lettura fosse fallita,
   la schermata avrebbe detto **«non c'è caparra»** e il conto si sarebbe chiuso
   a prezzo pieno su un cliente che aveva già versato. Nessun errore rosso, solo
   la cosa sbagliata detta con calma. Ora è `NON_LETTO`, si vede a schermo
   («Non sono riuscito a controllare… chiudere adesso potrebbe fargli pagare due
   volte») con **«Riprova»**, e i pulsanti restano spenti.

---

## Blocco 4 — le undici ancora da classificare **(vero)**

Colonne aperte, non nomi dedotti. Nessuna decisa: solo segnalate.

| tabella | cosa contiene davvero | importo? | `id`? |
|---|---|---|---|
| `order_tables` | `order_id`, `dining_table_id`, `etichetta_al_momento`, `conto_aperto` — quali tavoli stanno su un conto | **no** | 🔴 **no** |
| `reservation_deposits` | `reservation_id`, `amount`, `created_at` | **sì** (`amount`) | 🔴 **no** |
| `price_history` | `ingredient_id`, `price`, `supplier_id`, `source`, `recorded_at`, `articolo_id` — lo storico dei prezzi d'acquisto | **sì** (`price`) | sì |
| `storico_costi_ricetta` | `recipe_id`, `progressivo`, `food_cost_base`, `food_cost_portion`, `causa`, `righe_senza_prezzo` | **sì** (due food cost) | sì |
| `preventivi` | cliente (nome, telefono, email), data e ora evento, persone, stato, `costo_cibo`, `prezzo_a_persona_scavalcato`, `accettato_il` | **sì** (due) | sì |
| `preventivo_righe` | `natura`, `recipe_id`, `descrizione`, `porzioni_per_persona`, `quantita`, `prezzo`, `posizione` | **sì** (`prezzo`) | sì |
| `preventivo_fogli` | `preventivo_id`, `prodotto_il`, `canale`, `destinatario`, `contenuto` — cosa diceva il foglio che il cliente ha in mano | **no** come colonna (il contenuto è testo) | sì |
| `scadenze_previste` | `descrizione`, `importo`, `scade_il`, `ogni_mesi`, `mezzo`, `chiusa_il` | **sì** (`importo`) | sì |
| `dettature` | `testo`, `provenienza`, `modello`, i due token, `costo_euro` | **sì** (`costo_euro`) | sì |
| `letture_foto` | `genere`, `riconosciuto`, `modello`, i due token, `costo_euro`, `bytes_immagine`, `ingredient_id` | **sì** (`costo_euro`) | sì |
| `azioni_dettate` | `dettatura_id`, `tipo`, `dati`, `sicuro`, `stato`, `eseguita_il`, `risultato`, `errore` | **no** | sì |

⚠️ **Due tabelle non hanno un identificativo proprio** — `order_tables` e
`reservation_deposits`. Se entrassero così come sono, la lapide nascerebbe
**senza il riferimento** che serve a ritrovare la riga: la copia jsonb ci
sarebbe, ma il registro sarebbe mutilato in silenzio.

⚠️ **`preventivi` porta dentro nome, telefono ed email di un cliente**: lì il
criterio del registro tira contro la privacy, come per `customers` e
`reservations` che sono fuori proprio per quello.

---

## 🔴 Rilettura obbligatoria

### (vero) o (prova), per ogni numero

- **(vero)**: 270 migrazioni · ultima `…016` · 29 tabelle tracciate · 17 causali
  · 0 funzioni nominano `reservation_deposits` · 0 caparre · 0 movimenti di
  cassa · 0 lapidi · 11 tabelle da decidere · `reservation_deposits` con 3
  colonne.
- **(prova)**: 272 migrazioni · ultima `…018` · 3033 lapidi · 57 movimenti ·
  425 prove verdi · tutti i numeri delle verifiche (200, 10, 520, 320).
- **(computer, né vero né prova)**: le tre risposte di Vite.

### Cosa NON ho verificato con gli occhi

- **Nessuna schermata aperta, di nuovo.** La banda della caparra, i pulsanti
  spenti, il messaggio «Riprova»: **non li ha visti nessuno**. So che il codice
  li produce, non come si vedono su un tablet in servizio.
- **Nessuna mano ha chiuso un conto con una caparra.** Tutto è provato dentro la
  migrazione e dal client, mai da un dito.
- **Alessio non ha provato Tailscale col nome dopo la modifica**: le tre
  risposte le ha date `curl`, non il suo telefono.

### Cosa ho contato senza leggerlo

- **Le 425 prove dell'app**: letto il totale.
- **Le 29 tabelle tracciate (vero)**: contate, e verificate per nome solo le
  tre che mi interessavano.
- **I 3033 lapidi (prova)**: contati prima e dopo, non letti.

### Quali mie affermazioni sono diventate false mentre lavoravo

- Nel riepilogo di ieri avevo scritto che la caparra «adesso entra in cassa»
  senza dire dove: **era vero solo sulla prova**, e in produzione le causali
  sono ancora 17. Il rilievo era giusto e questa è la correzione.
- Ho scritto la verifica pulendo `cash_movements` **prima** di
  `reservation_deposits`: il vincolo `restrict` scritto ieri l'ha respinta.
  L'ordine era sbagliato, non il vincolo.
- La prima stesura della migrazione si è fermata **dopo** aver creato la
  funzione nuova, e al rilancio il `drop` della vecchia non trovava niente
  mentre il `create` inciampava su quella che c'era già — la trappola «fallisce
  dopo le DDL». Corretta togliendo **tutt'e due** le firme.

### Quali blocchi non ho aperto

- 🔴 **BLOCCO 3 — la caparra trattenuta.** Non aperto. Nessun quesito scritto in
  `docs/quesiti/`, perché la parte fiscale si tocca lì.
- 🔴 **BLOCCO 5 — le prove che sporcano il registro di prova.** Non aperto. ⚠️ E
  con questo lavoro **è peggiorato**: la prova nuova crea e cancella anche
  `orders`, quindi lascia altre lapidi per giro.

### Quali voci di `docs/DECISIONI.md` ho toccato

Nella sezione *Caparre*: la voce «alla chiusura si propone e conferma lui» passa
da ⏳ a ✅ con il limite del mezzo di pagamento unico, e **si aggiunge una voce
aperta** — che fine fanno i soldi quando la caparra è più grande del conto.
Nessuna voce contraddetta.

### Quali migrazioni restano in attesa, e in che ordine si lanciano i comandi

1. `20260826000017_la_caparra_entra_in_cassa.sql`
2. `20260826000018_la_caparra_si_scala_dal_conto.sql`

Dopo il push, **in quest'ordine esatto**:

1. `npm run migra -- --conferma` — le due migrazioni;
2. `npm run funzione operazioni-atomiche -- --conferma` — la funzione online.

🔴 **Al contrario si rompe la sala**: il corridoio accetterebbe
`registra_caparra` e il database non l'avrebbe.

### Quali lezioni nuove ho messo nel file delle trappole

**Nessuna nuova questa notte.** Le due cose che sono andate storte —
`close_order_paid` che si ferma dopo le DDL, e l'ordine di pulizia contro un
vincolo `restrict` — sono **esemplari di trappole già scritte** (§8, «una
migrazione che fallisce dopo le DDL lascia il lavoro a metà»), e aggiungerne una
copia le indebolirebbe. Sono documentate dentro la migrazione, dove servono.

---

## Cosa resta scoperto, dichiarato

- 🔴 **La caparra trattenuta non esiste** (Blocco 3).
- 🔴 **Le prove sporcano il registro di prova, e adesso di più** (Blocco 5).
- ⚠️ **Con la caparra scalata il conto si chiude con un mezzo solo**: niente
  «due modi» né «alla romana».
- ⚠️ **La caparra si propone solo nella chiusura normale.** Su «sconto» e
  «omaggio» la banda si vede ma non c'è nessuno scalo: un conto omaggiato non
  incassa, quindi non c'è niente da scalare — ma **nessuno ha deciso** che fine
  faccia una caparra su un conto omaggiato.
