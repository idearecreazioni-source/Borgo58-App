# Il microfono, la caparra che avanza, e l'indice che si genera

**27/08/2026 · notte** — mandato «il microfono che non parte sul telefono, e
tre pendenze corte». **Blocchi aperti e chiusi: 1, 2, 4. Blocco 3 NON aperto.**

| | |
|---|---|
| **HEAD dichiarato** | `db328bf6d9f8ffc7eb2d1063ed3c2777334a2bf0` |
| **In produzione (vero)** | 270 migrazioni, ultima `20260826000016` |
| **Sulla prova (prova)** | 273 migrazioni, ultima `20260827000001` |
| **In attesa del push** | `…26000017`, `…26000018`, `…27000001`, in quest'ordine |
| **Prove** | oxlint zero avvisi · **486 pure** (11 nuove) · **425 sull'app**, tutte verdi **(prova)** |

---

## Blocco 1 — «questo browser non sa trascrivere la voce»

### La premessa era giusta, e la causa è più profonda della frase

Il mandato la dava SUPPOSTA. **Verificata**: `index.html` ha
`apple-mobile-web-app-capable: yes` e il manifest ha `"display": "standalone"`.
Quindi dall'icona della schermata Home il gestionale gira **in una finestra
separata**, non dentro Safari — è la configurazione che l'app si è data il
18/08 quando è diventata installabile.

🔴 **Ma la causa vera non è la frase: è il ragionamento.** Il codice guardava
se la capacità c'era e, non trovandola, **deduceva il browser**. Il browser era
giusto; era il *modo in cui la pagina girava* a essere diverso. La fascia gli
diceva di fare una cosa che aveva già fatto — un vicolo cieco.

### Tre casi, tre frasi, nessun nome di browser

`statoDettatura()` in `src/lib/calcoli/voce.js` guarda **due fatti**: la
capacità c'è o no, e la pagina gira da icona o dentro un browser.

| caso | cosa vede l'utente |
|---|---|
| **Safari normale col microfono** | niente — non si dice nulla |
| **pagina aperta da icona** | «Il microfono non è disponibile perché il gestionale è aperto dall'icona salvata sulla schermata Home.» → «Apri borgo58.it nel browser — non dall'icona — e il pulsante funziona.» |
| **browser che davvero non sa trascrivere** | «Questo browser non sa trascrivere la voce.» → «Sul telefono apri con Safari, sul computer con Google Chrome.» |

⚠️ **E in tutti e due i casi senza microfono si dice la cosa che toglie
l'ansia**: *«La Scorciatoia dall'orologio non passa da qui e continua a
funzionare, e tutto il resto del gestionale anche.»* La fascia di prima
lasciava credere il contrario.

⚠️ **«Da icona» si riconosce senza nominare iOS**: una pagina installata su
Android il microfono ce l'ha e non finisce mai lì. La coppia «installata **e**
senza microfono» è già da sola il caso dell'iPhone.

⚠️ **E la proprietà che conta**: il messaggio è una *conseguenza* della
capacità mancante, mai una previsione. Se in standalone il microfono ci fosse,
il caso sarebbe «c'è» e non comparirebbe niente — quindi questa cura non può
produrre una diagnosi falsa nell'altro verso.

**7 prove pure nuove**, fra cui: la frase del caso «da icona» **non deve
nominare il browser**, le tre frasi devono essere **diverse fra loro**, e
**nessun ramo deve nominare iPhone o iOS**.

---

## Blocco 2 — la caparra che avanza, e quella su un conto omaggiato

### I tre saldi di cassa, misurati **(prova)**

```
(1) SCALATA    — conto 100,00 €, caparra 50,00:
                 saldo cassa -25.671,66 € -> -25.671,66 €   (INVARIATO)
(2) RESTITUITA — conto 10,00, caparra 200,00: 10,00 sul conto, 190,00 fuori.
                 saldo cassa -25.471,66 € -> -25.661,66 €   (-190,00)
(3) OMAGGIATA  — caparra 60,00 restituita per intero.
                 saldo cassa -25.601,66 € -> -25.661,66 €   (-60,00)
conti che non quadrano: 0 prima, 0 dopo
verifica: nessun residuo, saldo di cassa tornato a -25.721,66 €
```

⚠️ **Il saldo che non si muove sulla scalata è la cosa giusta, non una
dimenticanza**: quei contanti erano già entrati quando la caparra è stata
presa. Contarli di nuovo li conterebbe due volte.

⚠️ **Il saldo negativo della prova è la vita finta a scala vera**, non un
difetto: là dentro ci sono due mesi di spese senza incassi di sala.

### Una regola sola, in una funzione sola

`sistema_caparra_del_conto(conto, incassato)` la chiamano in due — la chiusura
pagata e quella per omaggio. Scritta due volte, fra sei mesi darebbero cifre
diverse per la stessa ragione.

⚠️ **L'uscita porta addosso da dove viene**: `reservation_id` e
`caparra_evento_il`, esattamente come l'entrata. Dopo che la pulizia della
privacy ha portato via la prenotazione, la riga in prima nota continua a dire
di che evento era — **senza nessun nome**.

⚠️ **Sul conto omaggiato non si scrive nessuna quota di pagamento**, e non è
una dimenticanza: quelle chiusure non ne hanno mai scritte, e aggiungerne una
sola per la caparra farebbe comparire quel conto fra quelli che non quadrano.
**La verifica lo controlla invece di sperarlo**: 0 prima, 0 dopo.

### Provato per rottura **(prova)**

Tolta la creazione dell'uscita da `sistema_caparra_del_conto` — cioè rimesso il
difetto che il blocco chiude — la verifica è diventata rossa esattamente sulla
proprietà che conta: *«Restituiti 190,00 e il saldo di cassa non è sceso di
190 (-25.471,66 € → -25.471,66 €)»*.

### La frase che dice perché

*«Con la caparra scalata il conto si chiude con un mezzo di pagamento solo:
una parte è già stata pagata, e il gestionale non divide fra più mezzi quello
che resta. Per dividerlo, scegli prima "Non scalarla".»* Un limite dichiarato è
una scelta, un limite muto è un difetto.

### 🔴 Due reti hanno chiesto conto, e avevano ragione a chiederlo

La **rete delle guardie** si è fermata due volte, e tutte e due le volte la
perdita era voluta — quindi dichiarata con la riga `-- rete-guardie:` e la
ragione:
- i rifiuti sulla caparra **escono da `close_order_paid`** perché si spostano
  nella funzione unica: lasciarli anche lì vorrebbe dire due posti che
  rifiutano la stessa cosa con due frasi che fra sei mesi divergono;
- la ragione `piu_grande_del_conto` **sparisce da `caparra_del_conto`** perché
  quel caso **non è più un rifiuto**.

E la prova sulle causali di sistema — quella che ieri ho trasformato da
conteggio a elenco per nome — è diventata rossa da sola su «Caparra
restituita», che è esattamente il lavoro per cui era stata cambiata.

---

## Blocco 4 — l'indice dei rovesciamenti

**Misurato (file)**: le sezioni raccontate sono **58**, l'indice ne elencava
**19**. Trentanove rovesciamenti avevano il loro racconto per esteso e non
comparivano nella tabella — e quella tabella risponde a una domanda sola,
*«questa decisione l'abbiamo già rovesciata prima?»*, che si risponde
**contando**.

`npm run indice` lo genera leggendo le sezioni; `--verifica` dice solo se è
allineato. **Il guardiano è una prova pura**, non la disciplina di chi si
ricorda di lanciarlo.

Tre cose non ovvie, tutte trovate facendo:
- **le intestazioni hanno due forme** — la data in mezzo (`## 50 · 25/08/2026 —
  «…»`) o in fondo (`## 48 · … — 25/08/2026`). Riconoscerne una sola avrebbe
  perso le altre **in silenzio**, che è il difetto che il blocco chiude;
- **tre sezioni non hanno la data nel titolo** (23, 24, 25): la data si **cerca
  nel corpo** invece di lasciare un trattino, perché è l'unica cosa che
  distingue i numeri usati due volte. Letta dal file, non inventata;
- **il generatore si ferma** se non trova i suoi segni, invece di proseguire —
  lezione del 19/08, quando un comando che non trovava il punto che cercava si
  portò via tre sezioni di `CODA_E_DECISIONI.md`.

**I numeri doppi (18, 48, 49) e i buchi (51, 52) non sono stati rinumerati.**
L'indice li **dichiara** in fondo alla tabella invece di nasconderli.

🔴 **E la nota che segnalava il problema in `DECISIONI.md` è stata TOLTA, non
aggiornata**: diceva «48 sezioni, 18 nell'indice, un numero doppio». Erano
numeri veri il 26/08 e falsi il giorno dopo — *un numero scritto in un commento
è una frase destinata a diventare falsa*. Adesso lì non c'è nessun conteggio: lo
dice il file stesso, in cima alla sua tabella.

---

## Cosa abbiamo rovesciato

**Uno, ed è dichiarato nel corpo della migrazione**: ieri (26/08) una caparra
più grande del conto faceva **rifiutare** lo scalo. La ragione di allora era
che le tre strade possibili decidevano tutte che fine fanno i soldi che
avanzano, e non era una decisione da prendere scrivendo codice — il rifiuto era
scritto come provvisorio. Oggi si restituiscono in contanti. **Non è cambiato
il ragionamento: è arrivata la risposta che mancava.**

---

## 🔴 Rilettura obbligatoria

### (vero) o (prova), per ogni numero

- **(vero)**: 270 migrazioni · ultima `20260826000016` · nessuna delle tre
  migrazioni della caparra è in produzione.
- **(prova)**: 273 migrazioni · ultima `20260827000001` · tutti i saldi di
  cassa e i tre casi · 425 prove dell'app.
- **(file, né vero né prova)**: 58 sezioni di rovesciamento, 19 nell'indice
  vecchio · 486 prove pure · le tre risposte di Vite del blocco precedente.

### Cosa NON ho verificato con gli occhi

- 🔴 **Non ho un iPhone.** Che una pagina in standalone su iOS non esponga il
  riconoscimento vocale **non l'ho misurato**: ho verificato che l'app *sia*
  configurata standalone, e ho reso il messaggio una conseguenza della capacità
  mancante — quindi non può mentire nell'altro verso. **Ma la conferma la può
  dare solo Alessio col telefono in mano.**
- **Nessuna schermata aperta**, di nuovo: la fascia della voce, la banda della
  caparra, i pulsanti spenti — nessuno li ha visti.
- **Nessuna mano ha chiuso un conto con una caparra**, né scalandola né
  restituendola.

### Cosa ho contato senza leggerlo

- **Le 425 prove dell'app e le 486 pure**: letto il totale.
- **Le 58 sezioni dei rovesciamenti**: contate dal generatore, non rilette una
  per una. ⚠️ Quindi **i titoli nell'indice sono quelli che il file scrive**, e
  se una sezione ha un titolo poco chiaro l'indice lo eredita.
- **I 3254 lapidi della prova**: contati prima e dopo.

### Quali mie affermazioni sono diventate false mentre lavoravo

- Ho scritto la verifica pulendo `discounts_gifts` senza portarne via la
  lapide: quella tabella è tracciata, e a prenderlo è stato il guardiano dei
  residui — non una rilettura. **Seconda volta in due giorni** che è lui a
  trovare una mia pulizia incompleta.
- Nel riepilogo di ieri avevo scritto che «la decisione sul residuo resta di
  Alessio». È rimasta sua per meno di un'ora: l'ha presa, e oggi il gestionale
  la applica.

### Quali blocchi non ho aperto

🔴 **BLOCCO 3 — la caparra trattenuta.** Non aperto, **e non per preferenza**:
non ci stava intero nella finestra rimasta, e vuole una migrazione, un gesto in
schermata e un quesito per il commercialista. Il Blocco 4 è quello che il
mandato stesso marca «se resta finestra», ed è mechanico. **Nessun quesito
scritto in `docs/quesiti/`**, perché la parte fiscale si tocca lì.

### Quali voci di `docs/DECISIONI.md` ho toccato

Nella sezione *Caparre*: la voce aperta sul residuo diventa **due voci decise**
(restituzione in contanti, e la stessa regola sull'omaggio) più la nota che su
uno **sconto** la cosa non è decisa; la voce sul mezzo unico dice ora che la
schermata spiega perché. **Sezione nuova** *Rovesciamenti — come si tiene
l'elenco*, con le due decisioni del 27/08. E la nota coi conteggi fissi è stata
tolta. **Nessuna voce contraddetta.**

### Quali migrazioni restano in attesa, e in che ordine i comandi

1. `20260826000017_la_caparra_entra_in_cassa.sql`
2. `20260826000018_la_caparra_si_scala_dal_conto.sql`
3. `20260827000001_la_caparra_che_avanza_torna_al_cliente.sql`

Dopo il push, **in quest'ordine esatto**:

1. `npm run migra -- --conferma`
2. `npm run funzione operazioni-atomiche -- --conferma`

🔴 **Al contrario si rompe la sala**: il corridoio accetterebbe
`registra_caparra` e il database non l'avrebbe.

### Quali lezioni nuove ho messo nel file delle trappole

**Nessuna nuova.** Le due cose che sono andate storte — la lapide di
`discounts_gifts` non ripulita, e i rifiuti usciti da una funzione riscritta —
sono **esemplari di trappole già scritte** (§8: «una variabile riusata non è un
promemoria», e la rete delle guardie). Aggiungerne una copia le indebolirebbe:
sono documentate dentro la migrazione, dove servono.

---

## Cosa resta scoperto, dichiarato

- 🔴 **La caparra trattenuta non esiste** (Blocco 3).
- 🔴 **Il microfono non è stato provato da un iPhone dopo la correzione.**
- ⚠️ **Su uno SCONTO la caparra non fa niente**: la regola nuova copre il
  conto pagato e quello omaggiato. Su uno sconto il cliente paga qualcosa, e
  quanto della caparra vada sul conto e quanto torni indietro **nessuno l'ha
  deciso**.
- ⚠️ **Le prove sporcano il registro di prova** (Blocco 5 del mandato
  precedente, mai aperto).
