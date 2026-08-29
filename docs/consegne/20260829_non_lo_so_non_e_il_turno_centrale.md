# «Non lo so» non è «è del turno centrale», e la legenda torna

**Blocco 6 del mandato del 29/08 — DUE PUNTI SU QUATTRO.** Commit `926f089`.
**Migrazione `20260829000026`**, applicata al progetto di prova.

🔴 **6b e 6c non sono stati aperti**, e il perché è in fondo.

---

## Cosa abbiamo rovesciato

**Sì, una cosa, e l'ha chiesta Alessio.** Le due legende dei colori erano state
**tolte** il 18/08 (rovesciamento n. 7). Tornano — solo quella della pianta, e
dietro un tocco. Registrato per esteso come **rovesciamento n. 66** in
[`decisioni_rovesciate.md`](../decisioni_rovesciate.md), con la ragione di
allora, che **non era sbagliata**, e cosa è cambiato da allora.

---

## 6a · Quando il gestionale non sa in che fascia cade una prenotazione

Alessio l'ha misurato **due volte**, e la seconda è quella che conta: coi
servizi configurati bene, su una prenotazione delle **19:29** mentre il locale
apre alle **20:00**. Quel tavolo prendeva **lo stesso identico colore** del
turno centrale. Spostandola alle 20:00 diventava giallo come deve.

⚠️ **Non è un caso di collaudo**: succederà a locale funzionante ogni volta
che qualcuno prenota prima dell'orario di apertura — e succederà mentre lui è
in servizio.

### La causa, letta nel corpo vivo

```sql
case
  when c.inizio_ultimi is not null and c.ora >= c.inizio_ultimi then 'tardi'
  when c.primo_turno is null then 'pieno'   -- ← «non lo so» finiva qui
  when c.ora <= c.primo_turno then 'presto'
  else 'pieno'                              -- ← e il turno centrale vero, qui
end
```

Quando nessun servizio combacia con l'ora, **tre valori restano vuoti
insieme** e la scelta cadeva sull'ultimo ramo. Due fatti diversi con lo stesso
valore: chi guarda non ha modo di distinguerli.

È la regola **«uno zero non è una risposta»** nella sua forma più pura — qui
non manca un numero, manca un'**informazione**, e il gestionale la sostituiva
con una plausibile.

### ⚠️ Il discriminante è il SERVIZIO, non l'ora del primo turno

Un servizio che esiste ma non ha quell'ora è il caso del **pranzo**, dove la
colonna è vuota **apposta** perché quel servizio ha due fasce invece di tre
(18/08). Lì «pieno» è la risposta giusta e non un non-so: guardando la colonna
sbagliata si sarebbe marcato «non lo so» **ogni domenica**.

### E non è una quarta fascia

Le fasce restano tre. Il segno nuovo è un **rigato grigio** che si vede che
*non* è una fascia, invece di sembrarne una. È in diagonale nel verso opposto
alla sbarratura del ritardo, così i due si distinguono anche sullo stesso
tavolo — e vogliono dire due cose diverse.

### Visto a schermo, non dedotto

Costruita una prenotazione delle 19:29 sul 15 dicembre, aperta la pianta: il
motivo `fasciaIgnota` risulta usato **esattamente una volta**, su T1. Poi tolta
per identificativo: **zero residui**, lapidi **8847** prima e dopo.

⚠️ E per trovarla ho dovuto correggere il mio stesso metro: stavo misurando la
**prima icona della pagina** invece della pianta, e mi rispondeva che nessuno
usava il motivo.

### Rotta in due modi opposti

Estraendo il **solo blocco di verifica**:

| rottura | errore |
|---|---|
| il discriminante torna quello di prima | «risulta **pieno** invece di ignota» |
| il discriminante troppo largo | «risulta **ignota** invece di pieno» |

Controlli diversi, **e nei due versi**: uno troppo stretto lascia il difetto,
uno troppo largo spegne i colori.

---

## 6d · La legenda dei colori

Sotto la pianta, dietro un tocco: *«Cosa vogliono dire i colori?»*.

**Perché torna**, e la ragione del 18/08 non era sbagliata: *una spiegazione
che il lettore ha già in testa è ingombro*. Quello che è cambiato sono **i
segni**, non il fastidio — il 18/08 erano tre fasce, oggi sono **otto**, e tre
di questi (i due pallini e il rigato di stanotte) sono nati **dopo** che le
legende erano state tolte, cioè non sono mai stati scritti da nessuna parte.

⚠️ **Non sta sempre a schermo**, e lì la ragione del 18/08 resta intera: si
apre da un gesto e si richiude.

### E non può raccontare una sala diversa da quella disegnata

I colori li legge dalla **stessa mappa** che la pianta usa per disegnare, e
l'**ordine** dalla funzione che decide la precedenza — che sta accanto
all'elenco, così chi cambia una delle due ha l'altra sotto gli occhi.

Una prova pura lo tiene fermo **nei due versi**, ed è l'unica ragione per cui
esiste: il difetto di una legenda non è che sia brutta, è che **invecchia in
silenzio**.

| rottura | prove che diventano rosse |
|---|---|
| si toglie la voce di «non lo so» | «ogni colore della pianta è spiegato» + quella del segno nuovo |
| la legenda spiega un colore inventato | tutte e tre |

**Guardata a schermo**: 11 voci, 8 colori distinti, il rigato nuovo c'è,
pulsante **8,50 mm**, **nessuno scorrimento laterale** a 375 punti.

---

## 🔴 6b e 6c: non aperti, e perché

**6b — il doppio colore a parità di fascia.** L'ho cercato e **non l'ho
chiuso**. Quello che ho misurato: la funzione che decide il colore dà già
«misto» quando su un tavolo c'è **più di una** fascia, comprese due uguali —
quindi tre prenotazioni alla stessa ora *dovrebbero* accenderlo. Il che vuol
dire che la causa è **altrove**, e non l'ho trovata: serve riprodurre la scena
esatta di Alessio con tre prenotazioni vere sullo stesso tavolo e guardare cosa
arriva alla sagoma.
⚠️ E c'è una cosa che ho **visto** e che va detta comunque, perché è vicina:
**«misto» disegna sempre un mezzo giallo e mezzo verde oliva**, scritti a mano
— ma dal 21/08 il verde oliva vuol dire «tavolo selezionato» e non è più una
fascia. Quindi due fasce arancio+giallo si vedono giallo+verde. **Non l'ho
toccato**: è la stessa famiglia della sua richiesta, e vanno decise insieme —
anche perché la seconda metà («servono più di due tinte per dire che sono
tre») è una decisione di disegno, non una correzione.

**6c — il riquadro delle informazioni.** Misurato il perché: il riquadro è
disegnato in **centimetri di sala** e scala con la pianta, ma **il testo che ci
sta dentro è in centimetri veri dello schermo** e non scala. Da qui le sue due
frasi opposte — «troppo grande da cellulare e troppo piccolo da pc» — che sono
lo stesso difetto visto dai due lati. La cura non è una riga: o il testo entra
nella scala del disegno, o il riquadro esce dall'SVG. È **un lavoro di misura a
sé**, e farlo di corsa in coda a una notte lunga sarebbe stato il modo di
rifarlo domani.

Tutti e due sono **in attesa** in [`RICHIESTE.md`](../RICHIESTE.md), voci S1 e
S3.

---

## Rilettura

**Cosa NON ho verificato con gli occhi**
- 🔴 **Il rigato di «non lo so» su un telefono vero**, e soprattutto **con la
  luce del ristorante**: che si distingua a colpo d'occhio da una fascia è un
  giudizio, non una misura, e resta di Alessio.
- La legenda **nelle Comande**: la richiesta diceva «raggiungibile dalla
  pianta», e l'ho messa nella pianta del Calendario. In Comande **non c'è**.
- Il caso in cui su un tavolo ci sono **insieme** il rigato e la sbarratura del
  ritardo: costruito nel disegno, mai visto.

**Cosa ho contato senza leggerlo**
- Gli «otto segni» sono le voci della mappa dei colori più i due pallini e la
  sbarratura: contati, non misurati su una schermata piena.

**Quali mie affermazioni sono diventate false mentre lavoravo**
- Avevo concluso che «nessuno usa il motivo nuovo»: stavo misurando l'SVG
  sbagliato. Con quello giusto era usato una volta, sul tavolo giusto.

**Cosa ho lasciato sul progetto di prova**
- Niente: la prenotazione costruita per guardare è stata tolta per
  identificativo, con la sua lapide. Contate: 8847 prima, 8847 dopo.
- ⚠️ **La migrazione tocca gli orari di un giorno** per costruire il suo
  esempio, e li **rimette interi** (riga intera salvata e riscritta, regola del
  14/08); se quel giorno non aveva una riga, la toglie.

**Quali blocchi non ho aperto**
- **6b** e **6c**, sopra, col perché.

---

## Domande

Vedi il messaggio finale, domande **4** e **5**.
