# La pianta ferma, i pulsanti dentro la pianta, e una carta per vedere

**21/08/2026** · **nessuna migrazione**.

---

## 1 · La pianta sta a destra sempre

Alessio l'ha notato al primo tocco: *«swicha da destra al centro in base a
cosa si tocca»*. Era l'**ultimo residuo** della schermata a colonna singola —
senza conto la pianta stava al centro, appena si apriva un conto saltava a
destra.

### La misura chiesta

| | pianta | badge di T4 dal bordo |
|---|---|---|
| **prima**, senza conto | 448, **al centro** | 12 |
| **prima**, col conto | 427, a destra | 11 |
| **adesso**, senza conto | **427, a destra** | **11** |
| **adesso**, col conto | **427, a destra** | **11** |

✅ **Identiche.** La pianta non si muove più di un punto, e il badge di T4
resta **11** nei due casi.

⚠️ **Senza conto la colonna di sinistra resta vuota, ed è voluto**: lo spazio
resta suo, così quando il menu compare la pianta non si sposta.

---

## 2 · I pulsanti dentro la pianta

Nell'area di **cucina e servizi** — la stessa che il Calendario usa per il
modulo di prenotazione.

**Contestuali al tavolo toccato:**

| tavolo | cosa compare |
|---|---|
| **libero, selezionato** | «Apri il tavolo» |
| **con un conto** | «Invia», «Preconto», «Chiudi», e sotto il riepilogo |

### 🔴 La misura chiesta: quante righe ci stanno

| | |
|---|---|
| riquadro | **214 × 581** punti |
| una riga di riepilogo | **14** punti |
| con 3 piatti segnati usa | **157** punti |
| spazio libero | **423** punti |
| **righe che ci stanno in tutto** | 🔴 **33** |

✅ **Il caso che il mandato temeva — «un tavolo da otto con venti righe» — ci
sta comodamente.** E oltre le 33 **scorre dentro**, come il bancone
(`overflow: auto`): **non serve altro.**

⚠️ **Il riepilogo qui NON ha i gesti** per togliere o annotare: quelli
restano nella lista sotto la pianta, dove c'è lo spazio per premerli. Non è
un doppione — *qui si LEGGE cosa è stato segnato, lì si CORREGGE*.

### Il meccanismo non è stato riscritto

`ZONE_DEL_PANNELLO` e `pannelloNellaPianta` esistono dal giro D3. ⚠️ **Eredita
la sua rete**: se un tavolo finisse in quell'area, il pannello **sparisce
invece di coprirlo**.

⚠️ **L'unica cosa cambiata nel componente**: `PiantaSala` accettava **un**
pannello, adesso ne accetta **un elenco** — in Comande ne servono due (il
bancone coi nomi, e questo). I due chiamanti sono stati aggiornati entrambi.

---

## 3 · La carta di prova

**Non è inserita in produzione.** Vedi §5.

`node scripts/menu-di-prova.mjs` — in **sola lettura** stampa cosa
inserirebbe; con `--conferma` scrive.

### 🔴 Cosa inserisce, per intero, così è togliibile senza cercarlo

| | |
|---|---|
| **1 menu** | «Carta di prova», struttura 4-4-4-2, **attivato** |
| **14 ricette** | 4 antipasti, 4 primi, 4 secondi, 2 dolci |
| **14 righe di menu** | una per ricetta, col prezzo |
| ingredienti, lotti, costi | **nessuno** — le ricette nascono senza componenti, quindi non toccano il magazzino |

**I piatti**: Sarde a beccafico (12), Caponata di melanzane (10), Crudo di
gambero rosso (18), Sformato di broccoli e ricotta (11) · Busiate al pesto
trapanese (14), Anelletti al forno (15), Spaghetti con le vongole (16),
Risotto agli agrumi (15) · Tonno in crosta di pistacchio (22), Involtini di
pesce spada (20), Maialino nero dei Nebrodi (21), Parmigiana di melanzane
(14) · Cassata siciliana (8), Cannolo scomposto (7).

### 🔴 UNA CONSEGUENZA DA NON DIMENTICARE

**La pulizia dei dati di collaudo (`20260820000012`) si ferma se trova
ricette** — è un guardiano scritto apposta. **Con questa carta dentro, la
prossima pulizia va rimisurata prima di applicarla.**

⚠️ E la carta **va tolta prima dei dati veri**, come le prenotazioni di
collaudo.

### E i nomi veri hanno confermato la correzione di Alessio

| | punti |
|---|---|
| il nome più lungo **coi nomi di prova** (ieri) | 245 |
| il nome più lungo **coi nomi veri** | **192** |

✅ **Il vincolo di ieri era gonfiato del 28% dal prefisso `BASE-`.**

---

## 4 · Cosa ho guardato

Sul progetto di prova, a 768 punti, con la carta nuova:

| cosa | esito |
|---|---|
| la pianta senza conto | ✅ **427, a destra** |
| la pianta col conto | ✅ **427, a destra** — identica |
| badge di T4 | ✅ **11** nei due casi |
| colonna del menu | ✅ **250** punti |
| i 14 piatti e i 5 filtri | ✅ Tutte · Antipasto · Primo · Secondo · Dolce |
| quanti nomi vanno a capo | 9 su 14 |
| il pannello dei gesti | ✅ 214×581, dentro la pianta |
| tavolo con conto | ✅ «T4 · Invia (3) · Preconto · Chiudi» |
| il riepilogo dentro | ✅ «1× Sarde a beccafico, 1× Caponata…» |
| righe che ci stanno | ✅ **33** |
| oltre le 33 | ✅ scorre dentro |

**E i conti di prova sono stati tolti.**

---

## 5 · 🔴 Quello che NON ho potuto fare

**La carta NON è in produzione.**

Lo script è scritto, provato **e applicato sul progetto di prova** (14 piatti,
menu attivo). Ma per scrivere in produzione serve entrare come il titolare —
cioè **il PIN di Alessio**, che non inserisco mai.

⚠️ **Non è un limite tecnico, è la regola di §2 di CLAUDE.md**, e vale anche
quando sarebbe comodo aggirarla: le credenziali di una persona non si
prestano.

**Il comando che deve lanciare lui**, con le sue variabili:

```bash
MENU_EMAIL=alessio@borgo58.app MENU_PIN=<il suo PIN> node scripts/menu-di-prova.mjs --conferma
```

⚠️ **In sola lettura può guardarlo prima**, senza credenziali:
`node scripts/menu-di-prova.mjs`

---

## 6 · Cosa non è verificato

- 🔴 **Nessuna mano ha toccato i pulsanti dentro la pianta.** So che ci sono,
  quanto sono grandi e cosa contengono. **Non so se si premono bene** con le
  mani occupate — il pannello è largo 214 punti e i tre pulsanti stanno in
  132 di questi.
- ⚠️ **Il caso «riepilogo oltre le 33 righe» non l'ho visto scorrere**: la
  misura dice che scorre, ma servirebbe un conto da quaranta piatti.
- ⚠️ **La carta di prova non è stata vista in produzione**, per il motivo
  sopra.
- ⚠️ **Non ho toccato la fascia in alto**: con i pulsanti dentro la pianta va
  ripensata di nuovo, e ha senso farlo dopo che Alessio ha guardato.

---

## 7 · Cosa abbiamo rovesciato

**Uno, ed è una decisione di Alessio di poche ore prima.**

- **Cosa era stato deciso, e quando.** Stasera stessa: riepilogo e pulsanti
  **non fissi**, raggiunti con una **strisciata verso l'alto**. Scelto
  esplicitamente **contro** la proposta del validatore di tenerli fissi.
- **La ragione di allora**, ed era buona: *un pulsante fisso in fondo sta
  dove poggiano i pollici quando si tiene il tablet con due mani* — cioè si
  preme per sbaglio.
- **Cosa si decide adesso.** I pulsanti stanno **dentro la pianta**, sempre
  visibili.
- ⚠️ **Perché la ragione di allora non vale più**: **non sono più in fondo.**
  Stanno in una colonna al **centro** della pianta, lontana da tutti i bordi
  — e il rischio che quella decisione evitava era *il bordo*, non *l'essere
  fissi*. La ragione non era sbagliata: **è cambiato il posto**.
