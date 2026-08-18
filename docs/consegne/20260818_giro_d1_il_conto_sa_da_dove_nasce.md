# Giro D1 — il conto sa da quale prenotazione nasce

**Consegna del 18/08/2026.** Mandato [«La sala e le prenotazioni»](../mandati/20260818_la_sala_e_le_prenotazioni.md),
**punto 1** del perimetro del giro D. Segue il giro
[E](20260818_giro_e_la_sala_entra_nel_telefono.md), chiuso e validato.

- **HEAD dichiarato**: `9597a9a`
- **Working tree**: pulito
- **Migrazione**: `20260818000008_il_conto_sa_chi_e_arrivato.sql`
- **Prove**: **78** pure + **167** sul progetto di prova (erano 163)
- **Lint**: zero avvisi · **Build**: ok
- **In produzione**: **applicata** — 137 migrazioni
- **Contratto**: non toccato · **Corridoio**: non ridistribuito (l'elenco delle
  operazioni non cambia, i parametri passano di lì senza essere letti)

---

## ⚠️ Cosa NON è verificato

1. **Il legame non si può vedere sui dati veri.** In produzione ci sono
   **4 conti** e **nessuno agganciato**, e la ragione è precisa: sono tutti
   stati aperti **prima** della migrazione (14/08, 15/08, e uno oggi alle
   19:09 — la migrazione è delle 20:56). Tutto ciò che è provato sta nella
   verifica della migrazione e nelle 4 prove nuove.
   ✅ **Ma il caso è a un gesto di distanza**: le due prenotazioni confermate
   di stasera sono intatte — **le 20:00 «prova» su T3** e **le 21:00 «mario»
   su T8** — e c'è già **un conto aperto su T5**. Il prossimo conto che
   Alessio apre su T3 o su T8 nasce agganciato, ed è la prima volta che si
   vede.
2. 🔴 **La controprova sulla regola della fascia NON è stata eseguita**, ed è
   il buco più importante di questa consegna: è proprio il punto in cui il
   legame può attaccare lo scontrino al cliente sbagliato. Volevo rompere la
   regola nel database (farle scegliere «la prima che trovi») e il giro
   attraverso `psql` si è rotto sugli accenti dei commenti della funzione.
   Quindi lì la discriminazione è **ragionata, non misurata**: le due
   prenotazioni della prova stanno a cavallo dell'istante in cui gira, quindi
   un'implementazione che ordinasse per orario prenderebbe quella sbagliata.
   **Da rifare prima di chiudere il giro D**, con un metodo che regga gli
   accenti.
3. **Nessuna mano ha toccato il giro C.**
4. **La mezzanotte in servizio non è mai capitata dal vivo.**
5. **La domenica a pranzo non ha prenotazioni vere.**
6. **La guardia di `--azzera` non è mai scattata in una ricostruzione vera.**
7. **I due rami di `DB_URL_PRODUZIONE` non sono mai stati esercitati.**
8. **Il messaggio con le date degli scostamenti non è mai comparso a schermo.**

---

## Cosa abbiamo rovesciato

**Niente.** Nessuna decisione motivata di questo progetto è stata cambiata da
questa consegna: il legame è una cosa che non c'era, non una che c'era in
un'altra forma.

---

## Perché il giro D è stato spezzato in TRE

Era annunciato in due (D1 = legame + ritardo + prenotazioni in Comande). Il
taglio si è stretto arrivando in fondo al legame, e la ragione è una regola di
questa stessa giornata:

**il ritardo vuole una funzione pura chiamata da DUE schermate.** Consegnarla
adesso, con le schermate ferme, vorrebbe dire mettere in produzione una
funzione che nessuno chiama — cioè **codice morto**, che è esattamente quello
che poche ore prima è stato tolto insieme alla riga della misura. Il ritardo
arriva insieme alle schermate che lo mostrano, o non arriva.

| | |
|---|---|
| **D1** | il legame conto↔prenotazione — *questa consegna* |
| **D2** | il ritardo e le prenotazioni in Comande (punti 2 e 3) |
| **D3** | le schermate (punti 4, 5, 6, 7) |

---

## Cosa è stato costruito

### Il legame, e perché adesso

`orders` aveva 19 colonne e **nessuna nominava una prenotazione**: le uniche
chiavi esterne verso `reservations` erano caparre, email inviate e tavoli
prenotati. Conto e prenotazione condividevano **solo il tavolo e l'ora**.

⚠️ **Si fa adesso perché i conti veri sono quattro**: oggi è una migrazione,
fra sei mesi sono migliaia di conti senza padrone e una decisione su ognuno
che non ha una risposta giusta. È la stessa aritmetica con cui si è deciso di
convertire subito la regola delle 5.

⚠️ **`on delete restrict`, mai `set null`**: è la regola del 16/08 — un
documento che ha generato un effetto o è respinto o storna, mai scollegato in
silenzio. E il 16/08 il difetto era proprio **nello schema**: due legami verso
le fatture erano `set null`, quindi cancellare non falliva, **scollegava**.
Nessuna funzione può curarlo finché lo schema dice il contrario.

### La serata arriva da fuori

Serve sapere «quali prenotazioni sono di stasera», e calcolarlo dentro la
funzione SQL avrebbe scritto il **dodicesimo punto** dell'elenco dei posti in
cui il database chiede da sé che giorno è — quello che il giro C ha misurato
(18 punti, 11 dei quali intendono la serata) e si è **vietato di allungare**.

Chi chiama la serata la sa già: gliela dice `serataDiServizio()`, che è il
posto unico e nominato. **Un parametro in più è meglio di un dodicesimo
orologio.**

⚠️ E un parametro in più fa una funzione **nuova**: due funzioni sovrapposte
renderebbero ambigua ogni chiamata per nome (42725, a tempo di esecuzione, sul
gesto che oggi funziona). Quindi la vecchia si cancella — e dopo un `drop` i
permessi tornano aperti al mondo, quindi la revoca fa parte della migrazione.

### La regola, scritta e non dedotta

Fra le prenotazioni **confermate** di quella serata su uno di quei tavoli si
prende quella la cui **ora è più vicina a adesso**; a pari distanza, la più
tarda.

⚠️ **Perché per fascia e non «la prima che trovi»**: dal giro C un tavolo può
avere **due turni** nella stessa sera (un giallo alle 19:30 e un arancio alle
22:30). Prendere la prima attaccherebbe il conto delle 22:30 al cliente delle
19:30 — e con lui il suo scontrino.

⚠️ **E se non ce n'è nessuna il legame resta VUOTO**, che è la cosa giusta ed è
scritta nel codice perché fra sei mesi nessuno la «corregga»: un conto senza
prenotazione è **normale** — è uno che entra senza prenotare — e riempirlo a
forza attaccherebbe **lo scontrino di un passante a un cliente che non c'era**.

### I minuti di tolleranza

`service_settings.minuti_tolleranza_ritardo`, predefinito **30**. Il
predefinito c'è perché **30 è la risposta di Alessio**, non perché è un numero
comodo: la lezione del 14/08 è che un predefinito risponde al posto di chi non
ha risposto, e qui la risposta esiste. Si cambia da *Sala e orari*, come la
soglia dei 25 coperti. Lo userà il D2.

---

## 🔴 La trappola che il legame apriva, chiusa nella stessa migrazione

`pulisci_richieste_scadute()` — il lavoro delle **4:30** — cancella le
prenotazioni rifiutate e annullate dopo sei mesi. Con la chiave esterna nuova
in `restrict`, **la prima annullata che avesse avuto un conto avrebbe fatto
fallire il lavoro INTERO**, portandosi via anche le cancellazioni legittime.

⚠️ **E sarebbe stato invisibile per sei mesi**: un lavoro notturno che
fallisce non produce nessun sintomo se non i dati che restano dove non
dovrebbero. Ora quelle prenotazioni si saltano, con la ragione scritta: *una
prenotazione annullata su cui però un conto è stato aperto vuol dire che
quella gente è venuta* — non è una richiesta scaduta, è un incasso con un nome
sopra.

### La forma generale, perché tornerà

**Ogni chiave esterna nuova verso una tabella che qualcuno ripulisce è un
potenziale blocco di quella pulizia.** Non è una proprietà del legame di oggi:
è una proprietà della coppia *legame + lavoro periodico che cancella*, e i
lavori periodici di questo progetto sono **sei**.

⚠️ **Voce di coda**, non lavoro di adesso: misurare se esistono **altri**
lavori che cancellano righe verso cui il progetto ha aggiunto legami dopo che
quei lavori erano stati scritti. Il rischio ha la stessa forma — silenzioso
finché non morde, e quando morde porta via anche il resto.

---

## 🔴 Difetto mio, e la seconda perdita valeva più della prima

Per aggiungere quella condizione ho riscritto `pulisci_richieste_scadute()`
**copiandola dalla migrazione che l'aveva creata**. Così facendo ho annullato
in silenzio due cose che erano state aggiunte dopo:

| cosa ho perso | cosa sarebbe successo |
|---|---|
| la colonna dei mesi nel registro delle pulizie | la migrazione è fallita **subito**, sul progetto di prova |
| **il battito in `stato_lavori`** (aggiunto il 12/08) | **niente**: sarebbe passata verde |

### La regola

**Una funzione si riscrive dal DATABASE, mai dal file che l'ha creata.** Fra i
due ci stanno tutte le migrazioni che l'hanno toccata da allora, e sono
invisibili guardando il file.

### E la forma della seconda perdita, che il progetto non aveva mai incontrata

Il battito non avrebbe fatto fallire niente. Sarebbe passata verde, e la
**sentinella avrebbe cominciato ad annunciare su Telegram, ogni quarto d'ora,
che «la pulizia dei dati dei clienti non viene più eseguita»** — mentre veniva
eseguita benissimo.

⚠️ **Un allarme falso ripetuto è peggio di nessun allarme**, perché addestra a
ignorarlo: dopo tre giorni quel messaggio si salta con gli occhi, e il giorno
in cui la pulizia si ferma davvero nessuno lo legge. Il progetto aveva già
incontrato *l'allarme che tace quando dovrebbe parlare* (il freno anti-tempesta
che zittiva i rincari, 13/08); **questa è la prima volta che incontra il
contrario** — un guasto che avrebbe fatto gridare un guardiano sano.

### La domanda che ne discende, da misurare in coda

Se quel metodo — riscrivere partendo dal file — è stato il mio abituale,
**questa non è la prima volta che è successo: è la prima volta che me ne sono
accorto.** Un confronto fra il corpo delle funzioni vive in produzione e
l'ultima migrazione che le nomina direbbe se ci sono **altre perdite
silenziose**. Voce di coda, dichiarata.

---

## Le prove, e la controprova

**Quattro prove nuove**, che passano dal **corridoio** e dalla **porta vera**.

⚠️ **La prova prenota come prenota Alessio**, e non per eleganza: provato,
`prenotazione_tavoli` **rifiuta l'inserimento diretto** (la RLS vuole che si
passi dall'operazione del corridoio). Una prova che si costruisce lo stato con
una scorciatoia non esercita la strada che percorre lui.

⚠️ **E la data non può essere nel passato**, che è una cosa che ha detto il
database e non io: la porta vera risponde *«Quella data è già passata»*. Le
altre prove di questo progetto marcano il proprio perimetro con anni lontani
nel passato; qui si usa **domani**, e il perimetro lo tiene la pulizia.

Sono discriminanti **solo insieme**: tavolo senza prenotazioni → vuoto ·
tavolo prenotato → pieno · due turni → sceglie quello dell'ora giusta · serata
non passata → vuoto invece di indovinare.

✅ **Rottura 1 eseguita**: tolto il passaggio della serata dalla schermata →
**tre prove rosse**, e correttamente resta verde quella del tavolo senza
prenotazioni.

⚠️ **Rottura 2 non eseguita** — vedi il punto 2 di ciò che non è verificato.

---

## L'applicazione in produzione — i numeri

**Prima**: 136 migrazioni. **Dopo**: 137.

### Il canarino tiene, e va letto sul numero CALCOLATO

| tavolone | calcolati | veri |
|---|---|---|
| T1 | 6 | **5** — corretto a mano da Alessio, ragione «Contro il muro» |
| T2 | 6 | 6 |
| T3 · T4 | 4 e 4 | 4 e 4 |
| T5+T6 | 6 | 6 |
| T7+T8+T9 | 8 | 8 |
| **somma** | **34** | **33** |

⚠️ **La somma vera è 33 e non è una regressione**: è la correzione a mano di
Alessio delle ore precedenti, cioè il meccanismo che funziona. **Il canarino
va guardato sul numero calcolato** — 34, identico — perché quello è ciò che
dipende dal codice; il numero vero dipende anche da lui, e leggere lì
scambierebbe una sua scelta legittima per un guasto. *È la stessa distinzione
fra un guardiano di proprietà e una fotografia.* I gruppi sono identici: T1 e
T2 soli, T5·T6 e T7·T8·T9 accostati.

### Il resto

| | |
|---|---|
| sagome | **13**, nessuna toccata |
| conti | **4**, agganciati **0** (tutti aperti prima della migrazione) |
| prenotazioni di stasera | **2**, intatte — 20:00 «prova» su T3, 21:00 «mario» su T8 |
| tolleranza | **30** minuti |
| lapidi | **26** — una in più, **prevista dalla verifica**, che la controlla come proprietà: è la riga che la pulizia notturna scrive nel registro quando cancella la prenotazione di prova senza conto |

### Il lavoro notturno che stavo per rompere

| | |
|---|---|
| `pulizia-richieste-scadute` | pianificato `30 4 * * *`, **attivo** |
| battito in `stato_lavori` | **fresco**, scritto dalla verifica stessa |
| sorvegliato | **sì** — tolleranza 1560 minuti, e la frase che dichiara cosa smette: *«le richieste rifiutate non vengono più cancellate: i dati dei clienti restano oltre il termine dichiarato nell'informativa»* |

---

## Per Alessio, in una riga

Da adesso, quando apre una comanda su un tavolo prenotato, il conto **sa di chi
è** — e il prossimo che apre su T3 o su T8 stasera è il primo a saperlo.
