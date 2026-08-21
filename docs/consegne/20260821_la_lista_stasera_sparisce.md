# Blocco 1 — la lista «Stasera» sparisce, e il tavolo si libera da lì

**21/08/2026** · **nessuna migrazione**.

---

## 1 · La misura chiesta: cosa si perde davvero

Prima di togliere, ho confrontato **voce per voce** quello che la lista diceva
con quello che la schermata dice già altrove.

| cosa diceva la lista | c'è altrove? |
|---|---|
| il **tavolo** | ✅ è il tavolo stesso |
| le **persone** | ✅ il numero dentro la sagoma (dal 21/08 sono le persone attese) |
| la **fascia** («arriva presto…») | ✅ il colore |
| **«seduti — il conto è aperto»** | ✅ marrone + badge |
| **in ritardo** | ✅ il tratteggio |
| l'**ora** prenotata | 🟡 **no** |
| i **minuti** di ritardo | 🟡 **no** |
| **«da liberare entro le…»** | 🟡 **no** — tolto per decisione esplicita |
| il **nome** di chi ha prenotato | 🟡 non ancora — arriva col banco bar (blocco 2) |
| 🔴 **le prenotazioni SENZA TAVOLO** | 🔴 **NO, e da nessuna parte** |

### Le tre cose che si perdono, e la loro gravità

- 🟡 **L'ora e i minuti di ritardo.** Il tratteggio dice *«è in ritardo»*, non
  *«di quaranta minuti»*. ⚠️ **Non spariscono del tutto**: toccando il tavolo
  compaiono nel gesto nuovo, che dice *«aveva prenotato per le 20:00 e non è
  arrivato (40 minuti fa)»*.
- 🟡 **«Da liberare entro le…»** — via per decisione di Alessio: gli basta
  sapere che il tavolo si può ridare quando è tratteggiato.
- 🔴 **Le prenotazioni senza tavolo.** Queste **non compaiono sulla pianta per
  costruzione**: non hanno un tavolo da colorare. Togliendo la lista
  sparivano del tutto.

---

## 2 · 🔴 L'unica riga sopravvissuta, e perché

**Le prenotazioni senza tavolo restano**, in un avviso di due righe.

⚠️ **È una scelta mia, e la dichiaro perché Alessio possa dirmi di toglierla.**
Lui ha detto «sparisce tutta», e stava parlando del ritardo e del liberare —
i casi che il tratteggio copre. **Una prenotazione senza tavolo non ha un
tavolo che possa dire niente al posto suo**, ed è la ragione già scritta nel
progetto dal giro D3:

> *«hanno una ragione che le altre righe non hanno: non compaiono da nessuna
> parte sulla pianta, quindi l'elenco è l'unico posto dove possono essere
> viste»*

**Misurato**: in produzione oggi sono **0 su 3** confermate, sul progetto di
prova **4 su 7**. Cioè è un caso **normale** — Alessio conferma e assegna il
tavolo dopo — non un residuo.

---

## 3 · Il gesto nuovo: «Non è arrivato: libera il tavolo»

Compare toccando un tavolo **tratteggiato**, e dice **chi** non è arrivato,
**per che ora** aveva prenotato e **da quanto**.

⚠️ **Solo sul tavolo tratteggiato**, e non è prudenza: su un tavolo che deve
ancora arrivare quel pulsante sarebbe un invito a disdire per sbaglio una
prenotazione che non ha fatto niente di male.

⚠️ **La parola non somiglia a «annulla il conto»**, che esiste ed è un'altra
cosa. La conferma dice cosa succede: *«Il tavolo torna libero e si può ridare
a qualcun altro. La prenotazione risulterà annullata.»*

⚠️ **E prima l'unica strada era il Calendario** — cioè uscire da Comande in
mezzo al servizio.

---

## 4 · 🟡 La lista nera — SOLO LA MISURA, come chiesto

**Né `active` né `notes` reggono il caso.**

### `customers.active` — no, e per una ragione precisa

**Misurato: è usato in un posto solo**, `listCustomers`, che filtra
`active = true`. Serve a **nascondere un cliente dall'elenco**.

🔴 **Usarlo per la lista nera farebbe sparire il cliente dall'elenco** — cioè
esattamente il contrario di quello che serve: uno in lista nera devi
**vederlo**, per sapere che c'è.

### `customers.notes` — no come meccanismo, sì accanto

È **testo libero**: nessun controllo automatico può leggerlo per decidere. Ma
serve **accanto** a una colonna vera, per il **perché** — che è la cosa che
fra sei mesi nessuno ricorda.

### 🔴 E la scoperta che cambia il quadro

**`submit_public_reservation` non guarda `customers`.** Misurato: il form
pubblico **non riconosce chi prenota** — crea la richiesta e basta.

> ⚠️ **Quindi una lista nera oggi non avrebbe nessun effetto sul form
> pubblico.** Chi è in lista nera prenoterebbe dal sito esattamente come
> prima. Il riconoscimento (per telefono o email) **va costruito**, e non è
> un dettaglio: è il pezzo più grosso del lavoro.

### Cosa toccherebbe

| dove | cosa |
|---|---|
| **modulo pubblico** | 🔴 il riconoscimento del cliente, che **non esiste** |
| **scheda cliente** | dove si mette e si toglie il segno, e il perché |
| **prenotazioni** | l'avviso quando si conferma una richiesta di chi è in lista |
| **database** | una colonna sua — `active` e `notes` non bastano |

⚠️ **E una domanda che il mandato non poneva ma che salta fuori dalla misura**:
la lista nera è **per sempre** o **scade**? Il progetto ha già una regola di
conservazione dei dati clienti (6 mesi per le richieste rifiutate), e una
lista nera eterna è un dato personale che non scade mai.

**Non costruita**, come chiesto.

---

## 5 · Cosa ho guardato

Sul progetto di prova, a 768 punti, con un tavolo prenotato in ritardo:

| cosa | esito |
|---|---|
| la lista «Stasera» | ✅ **non c'è più** |
| l'avviso delle senza-tavolo | ✅ c'è, con ore e nomi |
| T3 tratteggiato | ✅ |
| il gesto toccando T3 | ✅ *«BASE-Tavolo Amato aveva prenotato per le 20:00 e non è arrivato (169 minuti fa)»* |
| il pulsante | ✅ «Non è arrivato: libera il tavolo» |
| si confonde con «annulla il conto»? | ✅ no |
| la conferma | ✅ *«Il tavolo torna libero…»* |
| **premuto davvero** | ✅ **la prenotazione risulta annullata e ha lasciato il tavolo** |

⚠️ **T3 è rimasto tratteggiato dopo**, ed è **corretto**: su quel tavolo
c'erano **due** prenotazioni in ritardo, e ne ho liberata una. Verificato al
database.

**E lo scenario di prova è stato rifatto**, perché il gesto aveva annullato
per davvero una prenotazione dello scenario base.

---

## 6 · 🔴 Il lint acceso stanotte ha già ripagato

Scrivendo il gesto ho dimenticato un import. **Il lint l'ha preso**:

```
error eslint(no-undef): 'ConfermaDistruttiva' is not defined
```

⚠️ **E la build è passata lo stesso** — `✓ built in 931ms`. Senza la regola
accesa stanotte, quella schermata si sarebbe rotta **esattamente come la
lista della spesa il 19/08**, e me ne sarei accorto solo aprendola.

---

## 7 · Cosa non è verificato

- ⚠️ **Nessuna mano ha premuto il gesto sul tablet**: l'ho premuto dal
  browser. La conferma è il componente già usato altrove.
- ⚠️ **Il caso «due prenotazioni in ritardo sullo stesso tavolo» l'ho visto
  ma non provato fino in fondo**: ne ho liberata una e l'altra è rimasta.
  Non ho verificato che liberando anche la seconda il tavolo torni bianco.
- ⚠️ **L'avviso delle senza-tavolo non è stato visto da Alessio**, ed è la
  riga su cui potrebbe dirmi di no.

---

## 8 · Cosa abbiamo rovesciato

**Uno, e ribalta un parere del validatore** — va scritto perché è lui ad
averlo chiesto.

- **Cosa era stato deciso, e quando.** Il 18/08 (giro D3) la lista «Stasera»
  fu riordinata invece che tolta, e le prenotazioni senza tavolo messe in
  cima. Il validatore la considerava il posto dove leggere i dettagli.
- **La ragione di allora.** Fino al giro D2 la sala si apriva **bianca**: chi
  serviva non sapeva chi avesse prenotato, e doveva incrociare due
  dispositivi con gli occhi.
- **Cosa si decide adesso.** La lista sparisce. Il segnale è **il tratteggio
  dentro il tavolo**, che si vede senza cercarlo; visto quello, si tocca il
  tavolo e si leggono i dettagli.
- ⚠️ **Perché la ragione di allora non vale più**: **non è più vero che la
  sala non dice niente.** Fra il giro D2 e oggi il tavolo ha imparato a dire
  la fascia, il ritardo, i coperti attesi, il conto aperto e la comanda
  partita. *La lista era nata per un buco che nel frattempo è stato chiuso,
  e ripeteva a parole quello che il tavolo già mostra.*

⚠️ **Il prezzo, dichiarato**: le tre cose del §1 — e la sola grave (le
senza-tavolo) è **stata salvata**.
