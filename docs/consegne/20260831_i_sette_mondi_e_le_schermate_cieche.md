# I sette mondi, le quattro schermate cieche, e le reti che mi hanno preso

**Notte del 31/08/2026.** Riepilogo per il validatore.

* **HEAD dichiarato**: `081727c9265781ea81a4f9f3ed5bc4e671c2bb11` — il commit che sta sotto questo file.
* **Working tree**: pulito al momento della scrittura.
* **Migrazioni**: 361 nel repository, 361 sul progetto di prova, **356 in
  produzione** (le cinque nuove aspettano il push di Alessio).
* **Prove**: 657 pure verdi (58 file), **458 sull'app verdi** (66 file),
  lint pulito.

### Le cinque migrazioni che entrano, per intero

⚠️ **Aggiunte il 31/08 alle 11:47, e il difetto era mio**: questo riepilogo
diceva «cinque migrazioni nuove aspettano il push» **senza nominarne
nessuna**. A prenderlo è stato il freno di `npm run migra`, che si rifiuta di
toccare la produzione finché un riepilogo non dice **quali versioni**
entrano — e la regola vuole il numero **scritto per intero**, perché una
forma abbreviata («…001 → …005») nomina i due estremi e lascia mute quelle in
mezzo.

* `20260831000001` — i sette mondi del magazzino
* `20260831000002` — l'annata è un campo suo, e il segno «va in carta»
* `20260831000003` — l'ordine dice l'annata, e la carta dice da quanto è ferma
* `20260831000004` — la bottiglia aperta, quella buttata, e l'inventario
* `20260831000005` — i vincoli nuovi parlano italiano, le porzioni si classificano

---

## Cosa abbiamo rovesciato

**Un rovesciamento, dichiarato e voluto da Alessio.**

* **Cosa era stato deciso, e quando** — 30/08: *«le bottiglie aperte e non
  finite non hanno un gesto apposta: le sistema il conteggio
  dell'Allineamento, che esiste per questo»*.
* **La ragione di allora** — l'Allineamento *sistema* davvero una bottiglia
  mezza vuota: il conteggio la riporta al numero giusto, e costruire un gesto
  in più per una cosa già coperta è codice che nessuno usa.
* **Cosa si decide adesso** — i due gesti si costruiscono: «bottiglia aperta»
  e «bottiglia buttata», chiesti da lui stanotte insieme agli altri due punti
  dei vini.
* **Perché la ragione di allora non vale più** — ⚠️ **vale ancora per metà, e
  la metà che manca è quella che conta.** L'Allineamento *sistema* la
  giacenza ma non **distingue** un fondo buttato da un calice venduto: nei
  conti finiscono uguali, e sono due fatti diversi — uno è ricavo, l'altro è
  perdita. A fine anno, senza il gesto, non si sa quanto vino è finito nel
  lavandino. Registrato in [`decisioni_rovesciate.md`](../decisioni_rovesciate.md)
  e in [`DECISIONI.md`](../DECISIONI.md), con la ragione del 30/08 lasciata
  scritta accanto.

---

## Blocco 0 — il backup, e il freno che non ha frenato

Backup del gestionale vero: **126 tabelle, 983 righe**, più il controllo di
completezza. E **rimesso su davvero** in un database usa-e-getta: 126/126
tabelle, 983/983 righe, 4 utenti coi loro ruoli. *Un file generato non è un
backup: è un file.*

Poi le due migrazioni ferme da ieri notte sono entrate in produzione. Misurato
dopo, letto dal database vero:

| | prima | dopo |
|---|---|---|
| migrazioni | 354 | **356** |
| ultima | `20260830000011` | **`20260830000013`** |
| soggetti | 2 | **3** (Borgo 58 · Orto Borgo 58 · **La tasca di Alessio**) |
| tipo del documento | testo libero | **legame** a `sezioni_archivio` (8 sezioni) |

🔴 **IL FRENO SUL BACKUP NON MI HA FERMATO, E VA DETTO PERCHÉ.** Il mandato
chiedeva di dichiarare se fosse la sua prima volta vera: **non lo è stata**.
Il freno ha letto la copia e l'ha dichiarata («*copia di sicurezza:
2026-08-31_0101 (0.1 ore fa)*»), ma non ha avuto niente da rifiutare — e
**non avrebbe rifiutato nemmeno senza il mio backup**: l'ultimo era del 30/08
alle 20:59, cioè **quattro ore prima**, dentro il limite delle 24.
⚠️ Quindi il freno ha lavorato nel senso che ha guardato e ha lasciato
passare. *Non ha ancora mai detto di no a nessuno.*

---

## Blocco 1 — le quattro schermate cieche

Il mandato ne diceva tre. Trovate dai commit di ieri notte, **sono quattro**:
Prima nota, Archivio Documenti, scheda di un documento, Posta in arrivo.

**Sei difetti, tutti trovati da un dito su un pulsante.** Nessuno da una
rilettura.

1. 🔴 **La tasca mostrava un DEBITO.** La decisione del 30/08 dice che
   `speso_dalla_tasca()` non si chiama «saldo», perché da lì escono soldi e
   basta e un saldo sarebbe sempre negativo. La funzione esisteva ed era
   chiusa col portiere giusto: **nessuna schermata la chiamava.** Misurato
   aprendo, con un'uscita da 40 € dentro: **«Contante in cassa: −40,00 €»**.
   Ora dice *«Speso dalla tasca: 17,50 € — Spesa alimentare 17,50 €»*, cioè
   quanto e per cosa. Famiglia del 13/08: *tutto acceso, e muto*.
2. 🔴 **La tasca offriva «Banca», e il rifiuto mandava fuori strada.**
   Misurato: il database risponde *«non c'è nessun conto corrente registrato:
   aprilo da Cassa → Conti correnti»* — cioè manda ad **aprire un conto in
   banca** per una spesa fatta in contanti di tasca propria. La tasca *è* il
   contante, e lo dice la frase due righe sopra il pulsante.
3. 🔴 **La tabella della Prima nota sbordava di 43 punti** dentro il riquadro,
   dove la decisione del 21/08 sembrava rispettata. Portata su
   `ElencoAdattivo`. ⚠️ **Il debito era scritto «58 punti» e ne faceva 43**:
   rimisurato, non creduto.
4. 🔴 **L'Archivio faceva scorrere la PAGINA** di 11 punti (non un riquadro):
   l'input del file arrivava a 401 su 390, perché il pulsante «Scegli file» lo
   disegna il browser con una larghezza sua. Ed era alto **5,29 mm**.
5. Due bersagli preesistenti sotto soglia: la riga di un documento (**6,53
   mm**) e il titolo nella sua scheda (**6,19**).
6. 🔴 **La Posta offriva «Conferma "Senza titolo"»** su un'azione di tipo
   `nessuna`, sotto una frase che diceva «Nessuna azione qui». ⚠️ Misurato sul
   database: «Senza titolo» **è** il titolo di ripiego che il gestionale
   scrive davvero su quelle azioni — il difetto era offrire di *confermarlo*.
   Famiglia del 27/08: *un «sì» a una domanda che nessuno ha fatto*. Il gesto
   vero c'era già: «togli la mail».

**Il vincolo della tasca provato in tre modi**, in una transazione annullata:
entrata **rifiutata**, regola diversa da «Indeducibile» **rifiutata**, uscita
normale che passa e nasce «Indeducibile» scritta dal trigger. Poi **con le
mani dalla schermata**: 17,50 registrati, ricomparsi nel conto, riga tolta per
identificativo — **10849 lapidi prima e 10849 dopo**.

---

## Blocco 2 — la premessa che non reggeva

[MISURATO nel mandato] *«`conti_senza_documento` non ha il controllo sul
titolare»*. **Vero, e irrilevante: non è scoperta.**

Provato con utenti veri invece di dedurlo dal corpo:

| chi | esito |
|---|---|
| anonimo (chiave pubblica) | **RIFIUTATO 42501** |
| staff (cameriere) | **RIFIUTATO 42501** |
| titolare (Alessio) | **RIFIUTATO 42501** |

Nessun ruolo la può eseguire, e le due funzioni che la chiamano —
`conti_da_fiscalizzare`, `registra_conteggio_cassa` — hanno **entrambe** il
portiere. È la cura **(a)** della regola del 27/08: *nessun utente la chiama →
si chiude la porta, e non serve nessun portiere*. **La porta era già chiusa.**

⚠️ E la rete `permessi.test.js` ha ragione a non nominarla: filtra per
`has_function_privilege('authenticated', …)`, e quella lì non ce l'ha.

**Non ho costruito niente**, come il mandato prescrive quando una premessa
MISURATO non regge.

---

## Blocco 3 — le due piccole

* **`posta-leggi` installata** in produzione, versione **17 → 18**. Verificato
  dopo: le otto sezioni ci sono, tutte accese, **nell'ordine di Alessio** — non
  alfabetico e non per quantità, come dice la decisione.
* 🔴 **V3 era una riga invecchiata**: diceva che `ascolta-voce` «non è
  installata da nessuna parte». Misurato: è installata **dal 29/08**, e il
  deploy è posteriore all'ultimo commit del file (15:24 UTC contro 14:09).
  Era chiusa e nessuno l'aveva segnata.
* **Le frasi sullo stato**: strada **(b)**, scelta da Alessio. La rete non
  chiede più niente a nessun database — *«quella frase non si scrive»*.
  Tre ragioni per cui regge meglio: **non esiste più nessuna finestra** fra
  prova e produzione; la (a) avrebbe messo le credenziali della **produzione**
  dentro una prova automatica; e senza database diventa una **prova pura**,
  che gira a ogni commit invece che solo con `test:app`.
  ⚠️ **Cosa si perde, dichiarato**: prima diceva *«questa frase è FALSA»*,
  adesso *«questa frase non si scrive»*. Più severa e sa meno.

---

## L'aggiunta al mandato (A–E)

**Non avevo ancora aperto il blocco 4**, quindi è entrata prima, come chiesto.

### A · I sette mondi

Misurato prima di scrivere: i mondi erano **due** — `alimenti` (15 categorie)
e `materiali` (6) — quindi un vino finiva dentro la categoria «Bevande» del
mondo alimenti, **in mezzo alla farina e al pesce**.

⚠️ **Si è fatto adesso perché adesso costa zero**: in produzione **zero
ingredienti, zero confezioni, zero voci di carta, zero ordini**. Fra un mese
la stessa modifica avrebbe dentro una decisione su ogni riga già scritta.

⚠️ **«Bevande» non si spegne e non si duplica: CAMBIA MONDO.** Spegnerla e
crearne una gemella lascerebbe due parole per la stessa cosa — il difetto
chiuso il 30/08 con «Varie ed eventuali» e «Altro».

⚠️ **Vini e Liquori nascono con categorie PROPOSTE** (5 e 3), da correggere
leggendo: senza, quei due mondi nascerebbero vuoti e un vino non avrebbe dove
stare. Precedente del 29/08 sui materiali. **È la domanda 3 in fondo.**

### B · L'annata, e C · il segno «va in carta»

L'annata esce dalla descrizione e diventa un campo suo, con un vincolo che
respinge il `12` e accetta il vuoto — *vuoto non è zero: quasi niente ha
un'annata*. E **l'ordine al fornitore la dice**: con due annate a catalogo,
«Nero d'Avola Contrada Sole — 6 bottiglie» è un ordine che il fornitore non sa
evadere, e **sbaglia in silenzio**.

⚠️ **Solo sulla dicitura sua**: sul nome interno l'annata non si attacca, o
quel nome somiglierebbe a una dicitura vera mentre la riga è marcata «non so
come lo chiama lui».

Il segno «va in carta» è a sé, e **i sette mondi non bastano**: dentro «Vini»
ci sono il vino da cucina e le bottiglie del personale. **Il mondo dice che
cosa è, il segno dice se si vende.** Nasce falso per tutti — la prudenza nel
verso giusto: un prodotto che manca dal menu si vede subito, uno che non
doveva starci **si vende a un cliente**.

### D · L'editor della carta

🔴 **Visto aprendo la schermata**: il menu «Prodotto» di ogni riga elencava
**tutti i 133 alimenti** — aglio, agnello, baccalà, basilico. **Ventisei menu
da 116 voci ciascuno.** Adesso ne ha quelle segnate, ognuna col suo mondo
accanto.

⚠️ **Un prodotto NON è una riga di carta**: la stessa bottiglia ci sta due
volte, al calice e alla bottiglia. `prodotti_per_la_carta` dice cosa si *può*
mettere, col conto di quante righe ne escono già, e `porzioni_per_unita` non
è stata toccata.

⚠️ **L'elenco vuoto non resta muto**: con zero prodotti segnati dice «nessun
prodotto segnato "va in carta"» invece di «non collegata». Visto cancellando i
miei tre prodotti e riguardando.

### E · Le tre allerte

🔴 **La premessa di E1 ed E2 non reggeva.** Il mandato dava per mancante *«il
pezzo che dalle etichette sotto scorta arriva all'ordine e ne riempie il
testo»*. Misurato costruendo un vino sotto scorta e seguendolo per tutta la
catena, in una transazione annullata:

```
add_below_threshold_items()  lo mette in lista da sé   → 1 riga
lista_spesa()                lo mostra                 → 1 riga
bozza_ordine(fornitore)      lo raccoglie              → 1 riga
testo: «Buongiorno, ordine per Borgo 58 — 31/08/2026 · … — 6 pz · Grazie!»
```

**La catena c'era già intera.** Reinventarla sarebbe stato costruire due volte
la stessa cosa. Quello che mancava davvero era **l'annata nell'ordine**.

**E3 — l'allerta è sulla carta, non sulla giacenza**, e la ragione è sua: la
giacenza zero capita ogni settimana, e un'allerta che suona sempre si impara a
ignorare. Quello che invecchia è **il foglio stampato**.
⚠️ **Una carta mai stampata non è «ferma da zero giorni»**: resta vuota, così
chi legge distingue «non l'hai ancora stampata» da «l'hai stampata
stamattina». E il gestionale **non dice se ristampare**: mostra i numeri.

---

## Blocco 4 — la bottiglia aperta e l'inventario

Misurato prima di scrivere, e **metà era già in casa**: vendere un calice
scarica già `1/porzioni_per_unita`, `reason` ammette già `spreco` distinto da
`consumo`, e `allinea_giacenza` registra già differenza **e** valore in euro.
Niente di questo è stato rifatto.

**Aprire non scarica niente, e la schermata lo DICE** invece di lasciarlo
sottinteso: senza quella riga, il primo che stappa e non vede cambiare la
giacenza pensa che il gestionale si sia rotto.

**Buttare il fondo scarica come SPRECO** e chiede quanti calici restavano:
senza quel numero la perdita non si può contare, e il vino sparirebbe dentro la
rettifica del conteggio — cioè dentro «non torna» invece che dentro «l'ho
buttato».

**L'inventario dice bottiglie E euro**, com'è stato chiesto. Rilegge le
rettifiche dell'Allineamento senza scriverne nessuna.

**La schermata è stata costruita e USATA con le mani** (*Magazzino → Cantina*):
stappata una bottiglia vera, comparsa fra le aperte, provato il rifiuto. Due
difetti visti usandola:

* 🔴 **il rifiuto compariva in cima alla pagina** mentre il pulsante stava a
  metà schermata — il difetto del 17/08, già pagato due volte. Ora è a **41
  punti** dal pulsante, misurato;
* 🔴 **il menu delle bottiglie sbordava la pagina** di 4 punti con un nome
  lungo (394 su 390). Dopo: zero.

---

## Blocco 5 — «il cliente vuole fattura»

Misurato prima di costruire, e **metà era già in casa**: da *Cassa → Incassato
e scontrinato* si poteva già segnare «Vuole fattura» e poi chiudere col numero
vero. **Mancava solo il gesto in sala.**

La spunta sta **sopra i pulsanti di pagamento**, perché è lì che il cliente lo
dice. E spuntandola **lo scontrino non esce**: emettere tutti e due
documenterebbe due volte lo stesso incasso, ed è la stessa ragione per cui non
stampano l'annullamento e l'omaggio (22/08).

⚠️ **Non emette e non trasmette niente**: al tavolo esce il preconto, questo è
uno stato interno, e la fattura la fa Alessio da Fatture in Cloud.

---

## Le reti che mi hanno preso — quattro volte

Questa è la parte che vale di più della notte: **quattro difetti miei trovati
da guardiani scritti nei giorni scorsi, nessuno da una rilettura.**

1. 🔴 **La rete delle guardie, in flagrante.** Avevo ricostruito la coda di
   `bozza_ordine` **a memoria**, perché il mio comando l'aveva troncata a
   metà — e così perdevo `supplier_id`, `telefono_scritto` e `oggetto`, cioè
   tre campi che le schermate leggono. È **esattamente la trappola del 18/08**
   che quella rete esiste per chiudere. Rifatta col corpo vivo intero.
2. 🔴 **`larghezza.test.js`**: avevo curato un debito senza toglierlo
   dall'elenco.
3. 🔴 **`vincoli-che-parlano` e `cambio-unita`**: cinque vincoli muti e due
   colonne che non dichiaravano se seguono l'unità del prodotto.
4. 🔴 **Il gancio pre-commit**: il mio `catch` ingoiava un guasto senza
   dichiarare perché.

⚠️ **E uno dei cinque vincoli muti il commento CE L'AVEVA: l'ho perso io.**
Provando la migrazione per rottura avevo tolto e rimesso il vincolo a mano — e
un `drop`/`add` porta via il commento **in silenzio**, senza nessun errore.
**La lezione vale oltre il caso**: *rimettere a posto dopo una rottura vuol
dire rimettere TUTTO*. Stessa famiglia del `grant` ricopiato a memoria (24/08
e 27/08).

⚠️ **E la trappola del 26/08 presa in diretta**: la seconda rottura della
migrazione dell'annata cadeva sul guardiano della prima, perché non avevo
rimesso a posto `bozza_ordine` — **due errori identici che sembravano due
conferme**. Rimessa la prima, la seconda ha fatto scattare il *suo* controllo.

---

## I misuratori che hanno mentito — tre volte

Regola del 26/08, e stanotte è servita tre volte:

1. Il setaccio dei **numeri col punto inglese** contava `25.721`, che è il
   separatore delle migliaia italiano. Corretto e provato su quattro casi noti.
2. Il setaccio dei **bersagli** contava le `<label>` che sono didascalie.
3. Il setaccio dei **bersagli**, di nuovo: misurava il **lato minore** anche
   sui campi di testo, dove il bersaglio è l'**altezza**. Dava nove bersagli
   sotto soglia; tarato su un caso di risposta nota (`.tocco-campo` = 8,50 mm
   esatti) ne dà **zero**. *I nove erano miei.*

Da quel momento ogni misura è stata presa **dopo** aver confermato il
misuratore su un valore di risposta nota.

---

## RILETTURA — quello che non ho fatto o non ho visto

### Schermate che ho APERTO E GUARDATO
Prima nota (tasca e Borgo 58) · Archivio Documenti · scheda di un documento ·
Posta in arrivo · Editor carta vini e bevande · **Magazzino → Cantina** (usata
con le mani: stappata una bottiglia, provato il rifiuto) · Comande (sala e
apertura tavolo).

### Schermate consegnate SENZA vederle
🔴 **La spunta «il cliente vuole fattura» in Comande.** Il modale di chiusura
conto **non si è aperto** col click programmatico (§9: i click su questa app
React sono già noti come inaffidabili). Ho aperto un tavolo vero, aggiunto un
piatto, inviato la comanda — e il modale non si è aperto. **Quella spunta non
l'ha vista nessuno**: c'è nel codice, compila, ma non è stata premuta.

### Cosa ho contato senza leggerlo
* **Nessuna misura di schermo**: tutte prese dal DOM col misuratore tarato.
  ⚠️ **Nessuna immagine è stata guardata** — lo screenshot non funziona in
  questo ambiente. Colori, contrasto e leggibilità con la luce del locale non
  li ha visti nessuno.
* Le prove sull'app: **letto il totale del comando**, 458/458, exit 0.

### Affermazioni mie diventate false MENTRE lavoravo
* Avevo scritto che le schermate cieche erano tre (dal mandato): **sono
  quattro**, e me ne sono accorto guardando i commit.
* Avevo dato per buono il debito «58 punti» della Prima nota: misurato, ne
  faceva **43**.
* Ho scritto una cura per lo sbordo dell'editor carta (mandare a capo il
  pulsante) e **non curava**: l'ho tolta invece di lasciarla. Il pulsante non
  era il colpevole.

### Conteggi che sono PAVIMENTI, non censimenti
* I **sei difetti** del Blocco 1 sono quelli che ho trovato aprendo quattro
  schermate. Non ho misurato le altre sessanta.
* **Zero bersagli sotto soglia** vale sulle schermate che ho aperto, a **390
  punti** e a una densità sola.
* L'inventario della cantina è stato provato su **un** prodotto costruito da
  me, non su un magazzino pieno.

### Blocchi che NON ho aperto
* **Blocco 6** — l'etichetta «investimento».
* **Blocco 7** — la chiusura dell'anno fiscale.
* **Blocco 8** — produrre per la commercialista.
* **Blocco 9** — pescare da `RICHIESTE.md`.
* Dell'aggiunta, il punto **D** è fatto solo per metà: i prodotti vengono dal
  magazzino, ma **la somiglianza di forma con l'editor del menu non è stata
  fatta**.
* **E3 non ha una schermata**: il gestionale sa dire da quanti giorni la carta
  è ferma, e nessuno glielo chiede ancora. È la stessa famiglia del difetto
  che ho curato all'inizio della notte.

### Il freno sul backup
**Non mi ha fermato, e non era la sua prima volta vera.** Ha letto la copia e
l'ha dichiarata; non avrebbe rifiutato nemmeno senza il mio backup, perché
l'ultimo era di quattro ore prima. *Non ha ancora mai detto di no a nessuno.*

### Residui
Prova: **zero** prodotti `ZZPROVA`/`__prova`, zero bottiglie aperte, zero
stampe di carta, zero voci di carta di prova. Il conto aperto per guardare le
Comande è stato **annullato** e non cancellato — lapidi **11224 prima e 11224
dopo**. Produzione: **zero lapidi**, zero ingredienti, zero conti.
