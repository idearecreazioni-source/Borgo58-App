# Le quattro azioni che mancavano, il microfono, e la caparra tenuta

**27/08/2026, notte.** Blocchi 1-6 del mandato «il modulo voce ha una porta
che non porta da nessuna parte».

**HEAD dichiarato**: `737c589e640ef3505e9e88e1d88e218340acfda6`
**Working tree**: pulito al momento della scrittura di questo riepilogo.

---

## Cosa abbiamo rovesciato

**Uno, ed è una diagnosi mia sbagliata di poche ore prima.**

Registrato come **n. 59** in [`docs/decisioni_rovesciate.md`](../decisioni_rovesciate.md).

1. **Cosa era stato deciso, e quando.** La stessa notte, poche ore prima: la
   fascia che spiega perché il microfono non c'è dice che la causa è **l'icona
   della schermata Home**.
2. **La ragione di allora.** Correggeva un difetto vero — prima accusava il
   browser mentre il browser era giusto — ed era stata «verificata»: l'app *è*
   configurata per aprirsi in finestra separata.
3. **Cosa si decide adesso.** La causa è il **contesto non sicuro**: i browser
   danno il microfono solo alle pagine cifrate, e `localhost` è l'unica
   eccezione. L'indirizzo viene **prima** dell'icona nell'ordine dei casi.
4. **Perché la ragione di allora non vale più.** Era falsa, e a dimostrarlo è
   una misura di Alessio con le sue mani: stesso iPhone, stesso Safari, stessa
   icona — `http` muto, `https` che detta. 🔴 **Il modo in cui è nata è la
   lezione**: era un SUPPOSTO, e un fatto *vicino* è stato scambiato per
   conferma. Il caso dell'icona **non è stato tolto** — su un indirizzo cifrato
   è ancora vero. È la precedenza a essere cambiata.

---

## Blocco 1 — le quattro azioni che il gestionale prometteva e non faceva

**Il buco, confermato misurando** (vero): `tipi_azione_vocale` ha **11 tipi
accesi**; il corpo vivo di `fai_azione_dettata` aveva **7 rami**. I quattro
scoperti erano esattamente i quattro di natura `creazione` —
`movimento_cassa`, `carico_merce`, `prodotto_nuovo`, `ricetta`. Cioè: il
criterio del 25/08 che regge tutto il modulo era **metà costruito**.

🔴 **E la metà mancante non era solo nel database.** Il prompt che parla col
modello chiedeva, per quei quattro, il solo testo grezzo (`sentito`).
Costruire i rami senza toccarlo avrebbe prodotto quattro rifiuti «non ho
capito di quanti soldi si tratta» a ogni frase.

**Migrazione `20260827000002`** (sulla prova, non ancora in produzione):

- il **catalogo** che il modello riceve porta ora anche le **causali di prima
  nota** (numerate in un elenco solo, entrate e uscite insieme, così il numero
  porta con sé il verso) e i **fornitori**;
- `voce_risolvi_dati` sa dire cosa manca per ognuno dei quattro;
- `fai_azione_dettata` ha i quattro rami;
- **la rete**: `tipi_vocali_senza_ramo()` legge il **corpo vivo** e nomina i
  tipi accesi senza esecuzione. Provata mettendoci un tipo finto e facendosi
  dire che manca (prova).

### I casi decisi, e perché

- 🔴 **Il movimento di banca e i conti che non ci sono.** Il vincolo pretende
  un conto corrente e i conti sono **zero** (vero). Nessun conto → si rifiuta
  **dicendo dove si aggiunge**; un conto solo → si usa quello; più conti → si
  chiede quale. Lasciarlo fallire da sé darebbe a chi è in cella un errore di
  vincolo, cioè un guasto.
- ⚠️ **La causale resta facoltativa**, ed è la scelta meno ovvia: «ho pagato
  trenta euro al fornitore» non ne contiene nessuna. Il difetto peggiore è
  **dimenticare l'uscita**, non classificarla dopo — e un movimento senza
  causale è già un caso previsto (`costi_da_classificare()`).
- ⚠️ **Il fornitore non si inventa**, come il frigo. Ma non ferma niente: su
  `cash_movements` non esiste una colonna fornitore, quindi il nome
  riconosciuto si scrive in chiaro in `business_purpose`.
- 🔴 **La data è la SERATA**, mai il calendario.
- **`prodotto_nuovo` fa la cosa minima**: nome, categoria, unità. Niente
  scheda — quella la riscriverà la separazione fra prodotto e ingrediente. Il
  **doppione si rifiuta** (prova).
- **`ricetta` crea lo scheletro** e conserva per intero il testo dettato nelle
  note. **Nessuna riga di ingredienti**, ed è una scelta dichiarata: una
  quantità di riga sbagliata sposta il food cost *in silenzio*, che è l'errore
  che il criterio del 25/08 esiste per evitare.

### Provato dettando davvero, sul progetto di prova, con l'API vera

Quattro frasi, quattro azioni confermate, conteggi prima e dopo (prova):

| detto | nata | prima → dopo |
|---|---|---|
| «Ho pagato trenta euro in contanti al fornitore per la spesa alimentare» | movimento di cassa, causale «Spesa alimentare» | movimenti **57 → 58** |
| «Prodotto nuovo: bottarga di muggine, si misura a chili, è pesce» | ingrediente (pesce, kg) | ingredienti **133 → 134** |
| «Ricetta nuova: spaghetti alla bottarga, primo, quattro porzioni…» | ricetta, testo nelle note | ricette **116 → 117** |
| «Sono arrivati due chili di Bottarga di muggine» | lotto da 2 kg | lotti **498 → 499** |

Il movimento è nato con `movement_date = 2026-08-26` mentre il calendario
diceva **27** (vero): la serata, non il giorno.

🔴 **Un difetto trovato provando e non rileggendo**: al primo giro il modello
ha riempito `"data": "2026-08-27"` da sé — il giorno di calendario —
**scavalcando la serata**. Corretto nel prompt col perché scritto accanto; al
secondo giro `data: null` (prova).

**Rotto apposta, due volte, con due errori diversi e giusti** (prova):
togliendo il ramo del movimento di cassa la rete ha detto *«1 tipo acceso che
il gestionale non sa eseguire: movimento_cassa»*; mettendo il calendario al
posto della serata, *«non porta la data della serata di servizio»*.

**Doppio invio**: confermata due volte la stessa azione, la seconda è
**rifiutata** dal database sotto blocco (prova).

Tutti i dati di prova **cancellati per identificativo**, conteggi tornati a
57 / 133 / 116 / 498 (vero).

---

## Blocco 2 — la diagnosi del microfono, rifatta

Vedi «Cosa abbiamo rovesciato». Ora i casi sono **quattro**, in quest'ordine:
`c_e` · `non_cifrato` · `da_icona` · `browser`.

- `inContestoSicuro()` crede a `isSecureContext` quando c'è e guarda il
  protocollo quando manca; **`localhost` resta sicuro** — è l'eccezione che ha
  tenuto il difetto nascosto per giorni, perché dal computer funzionava.
- **La parte buona è stata tenuta**: in tutti i casi si dice che la Scorciatoia
  dall'orologio non passa dal browser e continua a funzionare.
- **11 prove** in `tests/unita/stato-dettatura.test.js`, fra cui quella che
  congela **l'ordine**: da icona *e* in chiaro insieme → comanda l'indirizzo.
  🔴 Rotto apposta l'ordine, **3 prove rosse** (prova); rimesso, 15 verdi.

---

## Blocco 3 — il pulsante che non diceva niente

- **`unaVoltaSola()`** in `src/lib/calcoli/voce.js`: una guardia **sincrona**,
  perché il pulsante spento arriva al render dopo e fra il tocco e il render
  ci passano cinque tocchi. Il database resta l'ultima parola; questa serve al
  **gesto**.
- **L'esito sta sulla riga toccata**, non in cima alla pagina.
- **«…» è diventato «Lo sto facendo…»** e poi «✓ Fatto»: chi non capisce che
  sta succedendo qualcosa ripreme.
- **Il segno che ascolta** (decisione in vigore del 24/08 e del 25/08, non
  rispettata): riquadro colorato, pallino, «Ti sto ascoltando» a **6 mm**, e
  il **contatore delle cose sentite finora** — che è l'unico dei tre a
  dimostrare che sta capendo, perché un'animazione va avanti uguale anche se
  il microfono è morto.

**Guardato a schermo, sul progetto di prova** (prova): premuto **cinque volte**
«Sì, fallo» su un movimento di cassa → **una riga sola** (movimenti 57 → 58) e
nessun errore. Su una temperatura senza frigo il rifiuto compare **sulla riga**:
«Non si è fatta: Non hai detto quale frigo: dimmelo e la scrivo.»

**Misurato dal DOM a 390 punti** (prova): sbordo **zero**, bersagli 8,50 /
12,00 / 10,50 mm. ⚠️ Resta sotto soglia «Il tetto si cambia da qui →» a
**7,97 mm**, preesistente e fuori perimetro.

---

## Blocco 4 — l'indirizzo cifrato

🔴 **La premessa del mandato era più larga del vero, e l'ho corretta invece di
seguirla.** Misurato: `tailscaled` gira come **servizio di Windows** e la
configurazione di `tailscale serve` è salvata nello stato del nodo — quindi
**l'indirizzo cifrato riparte da solo** (vero). Quello che non sopravvive a un
riavvio è il **server del gestionale**.

Quindi la cura non è un servizio in più: **`npm run dev:prova` fa tutte e due
le cose**. Guarda la pubblicazione, la mette sulla porta di *questo* avvio se
punta altrove, e stampa l'indirizzo con scritto perché serve.

- ✅ **Il nome cifrato non viene rifiutato** (vero): `allowedHosts` contiene
  già `.ts.net`, e l'indirizzo risponde **200** col gestionale, senza «Blocked
  request».
- 🔴 **Trovata una frase diventata falsa**: le righe che stampavano gli
  indirizzi scrivevano **5173 a mano**, quindi con `--port 5199` mandavano il
  telefono su un gestionale **diverso** da quello appena aperto — senza nessun
  errore. Ora la porta si legge da quella vera.
- ⚠️ Riguarda **solo il gestionale di prova**. La pubblicazione è stata
  rimessa sulla 5173 com'era.

---

## Blocco 5 — la caparra trattenuta

**Migrazioni `20260827000003` e `20260827000004`** (sulla prova).

🔴 **Qui non esce e non entra un euro**, ed è la ragione del disegno: i soldi
sono in cassa da quando la caparra è stata presa. Cambia la **natura** — da
acconto su una cena che ci sarà a incasso per una cena che non c'è stata — e
senza un segno che lo dica quel denaro resterebbe indistinguibile da una
caparra che aspetta ancora il suo conto.

- `caparra_trattenuta_il` e `caparra_trattenuta_perche` su `cash_movements`;
- **vincolo `caparra_una_fine_sola`**: o scalata su un conto, o trattenuta.
  Mai tutte e due — sarebbe la stessa somma contata due volte;
- **la via di ritorno**: `annulla_trattenuta_caparra` (il cliente che telefona
  il giorno dopo);
- `caparre_trattenute()` — **senza nomi e senza la ragione scritta a mano**:
  è l'elenco che si guarda per i conti, e lì chi non è venuto non c'entra;
- `stato_caparra()` — a che punto è, in un posto solo.

**Sopravvive alla pulizia della privacy** (prova): tenuta la caparra e
cancellata la prenotazione come fa la pulizia notturna, la riga continua a
dire **di che serata era** e resta nell'elenco.

**Rotto apposta, due volte** (prova): tolto il vincolo → *«non ha impedito le
due fini insieme»*; fatta muovere la cassa → *«Tenere la caparra ha mosso la
cassa: i soldi erano già dentro»*.

**Guardato a schermo** (prova): il riquadro compare solo su una prenotazione
segnata «non si è presentato» **con** una caparra non finita su un conto.

🔴 **Difetto trovato guardando, non rileggendo**: premuto cinque volte «Tengo
la caparra», il dato ha retto ma **compariva un errore rosso in cima** — il
gesto riusciva e sembrava fallito. È la stessa famiglia del Blocco 3, in una
schermata dove non avevo messo la guardia. Corretto e riprovato: cinque
pressioni, nessun errore (prova).

**Fiscalità**: non decisa qui. Quesito **L18** in
[`docs/quesiti/QUESITI_CONSULENTI.md`](../quesiti/QUESITI_CONSULENTI.md),
senza importi.

---

## Blocco 6 — le undici da classificare

Colonne **aperte**, non dedotte dal nome. «Importo» = una colonna che contiene
denaro.

| tabella | cosa contiene davvero | importo? |
|---|---|---|
| `azioni_dettate` | cosa la voce ha capito, con che stato è finita, e i parametri già risolti (`dati`, jsonb) | 🔴 **sì, da stanotte**: il payload di un movimento dettato contiene `importo` |
| `dettature` | ogni comando vocale col suo testo, i token e `costo_euro` | **sì** (spesa dell'assistente) |
| `letture_foto` | ogni foto mandata all'assistente, `costo_euro`, byte dell'immagine | **sì** (spesa dell'assistente) |
| `order_tables` | quali tavoli stanno su un conto, l'etichetta fotografata, `conto_aperto` | **no** — nessuna colonna numerica |
| `preventivi` | il preventivo di un evento: cliente, data, persone, `costo_cibo` fotografato, `prezzo_a_persona_scavalcato` | **sì, due** |
| `preventivo_fogli` | il foglio consegnato al cliente, in `contenuto` (jsonb) | **sì, dentro il jsonb** — è la prova di cosa gli è stato promesso |
| `preventivo_righe` | le voci di un preventivo: `quantita`, `porzioni_per_persona`, `prezzo` | **sì** |
| `price_history` | lo storico dei prezzi d'acquisto: `price`, fornitore, versione comprata | **sì** |
| `reservation_deposits` | le caparre: `amount` per prenotazione | **sì** |
| `scadenze_previste` | le uscite future non deducibili da sole: `importo`, quando, ogni quanto | **sì** |
| `storico_costi_ricetta` | quanto costava una ricetta a ogni cambiamento: `food_cost_base`, `food_cost_portion`, la causa e il dettaglio in parole | **sì, due** |

**Dieci su undici hanno un importo dentro. L'unica senza è `order_tables`.**
Non ho deciso niente: le guarda lui.

⚠️ **Due note che non stanno nei nomi**: `reservation_deposits` **non ha una
colonna `id`** (la lapide nascerebbe senza riferimento) e sparisce a cascata
con la prenotazione, che la pulizia notturna cancella **per privacy**;
`azioni_dettate` è entrata nella colonna «sì» **stanotte**, per un lavoro di
questa consegna.

---

## La rete che ha funzionato — e ha trovato due difetti miei

🔴 Lanciata la suite completa, **`tests/app/permessi.test.js` è diventata
rossa da sola**: conta le funzioni che scavalcano la RLS senza chiedere chi
sei, e ne trovava **25 dove ne aspettava 23** (prova). Le due nuove erano di
questa stessa notte, tutte e due mie.

- **`caparre_trattenute`** aveva `is_titolare()` **dentro la clausola
  `where`**. Sembra la stessa cosa di un portiere e non lo è: chi non deve
  vedere riceveva **un elenco vuoto** — che si legge «non ce n'è nessuna», ed
  è la rassicurazione falsa che questo progetto ha già nominato il 13/08.
  ⚠️ E lo stesso filtro è la ragione per cui, interrogandola da `psql`, mi
  rispondeva **zero righe mentre la schermata mostrava la caparra tenuta**:
  col filtro sembra un difetto dei dati, col rifiuto lo dice.
- **`tipi_vocali_senza_ramo`** — la rete del Blocco 1 — era concessa a
  chiunque fosse autenticato senza chiedere chi.

**Migrazione `20260827000005`**: portiere esplicito a tutte e due, e la
verifica **chiede al catalogo** che non compaiano più fra le scoperte (prova).

⚠️ **Le due migrazioni che le avevano create non sono state riscritte**: erano
già applicate sulla prova, e un file che racconta cosa è successo quel giorno
non si corregge. Si aggiunge.

**Dopo**: prove pure **494 su 494**, prove sull'app **427 su 427**, lint
pulito, build che passa (prova).

---

## RILETTURA

**Cosa NON ho verificato con gli occhi**
- **Nessuna immagine**: lo screenshot non funziona in questo ambiente (provato:
  *«the Browser pane is not displayed»*). Tutto ciò che è «visto» è **letto dal
  DOM**.
- **Il segno che sta ascoltando non l'ha visto nessuno acceso**: per accenderlo
  serve il microfono vero, e dal Browser pane non si può. Ne ho misurato le
  classi, non l'effetto.
- **Niente da un telefono vero**: né la fascia del microfono, né il riquadro
  della caparra, né i nuovi rami della voce.
- **Il biglietto della cucina e i colori** con la luce del locale: mai.

**Cosa ho contato senza leggerlo**
- Le **494 prove pure** e le prove sull'app: ho letto il totale del comando,
  non le singole.
- **`tailscale serve` sopravvive a un riavvio**: dedotto da due fatti misurati
  (il servizio Windows è `RUNNING`, la configurazione è nello stato del nodo) —
  **non ho riavviato il computer**.

**Quali mie affermazioni sono diventate false mentre lavoravo**
- «La schermata del Blocco 3 è a posto»: lo era per la voce, **non** per la
  caparra, dove ho scoperto lo stesso difetto un'ora dopo averlo chiuso
  altrove. Corretto in tutte e due.
- «Il server sulla 5199 è quello di prova»: **falso**, punta alla produzione.
  Constatato dal DOM.
- La premessa del mandato «il comando che pubblica l'indirizzo cifrato non
  sopravvive a un riavvio»: **non regge** per la parte Tailscale.

**Quali blocchi non ho aperto**
Nessuno: tutti e sei sono stati affrontati.

**Quali conteggi sono pavimenti e non totali**
- I **quattro tipi senza ramo** sono un totale (la rete li conta tutti).
- Le **undici tabelle da classificare** sono un totale letto dal database.
- I **bersagli misurati** sulla schermata della voce sono un totale di *quella*
  schermata, non del gestionale.

**Voci di `docs/DECISIONI.md` toccate**
- *Assistente — voce*: il criterio misura/creazione del 25/08 (ora **onorato**,
  non contraddetto); il segno visibile che sta ascoltando (24/08 e 25/08, era
  **una decisione in vigore non rispettata**).
- Sezione nuova **Caparra**, con le decisioni del 27/08.

**Migrazioni in attesa, e l'ordine dei comandi**
In produzione ci sono **270** migrazioni, ultima `20260826000016` (vero). Sul
progetto di prova ce ne sono **277** (vero). Ne aspettano **sette**:

`20260826000017` · `20260826000018` · `20260827000001` · `20260827000002` ·
`20260827000003` · `20260827000004` · `20260827000005`

L'ordine è quello di sempre: **commit → push di Alessio → `npm run migra --
--conferma` → riepilogo → secondo push.**

⚠️ E **due funzioni online** vanno reinstallate in produzione dopo il push:
`ascolta-voce` (il prompt nuovo) e `operazioni-atomiche` (le due operazioni
della caparra tenuta). Senza, i quattro rami esistono nel database e il
modello non manda i dati per usarli.

**Lezioni nuove nel file delle trappole** (`CLAUDE.md` §8)
- un tipo acceso in un elenco può non avere nessuna esecuzione, e non lo dice
  nessuno;
- un modello riempie la data di oggi anche quando nessuno gliel'ha detta;
- **un fatto vicino alla causa non è la causa**;
- un pulsante spento non protegge dal doppio tocco: si spegne al render dopo;
- **un filtro nella `where` non è un portiere**: risponde vuoto invece di
  rifiutare;
- una funzione con portiere interrogata da `psql` risponde vuoto, e non è un
  difetto;
- un dev server attivo non è necessariamente quello che credi.
