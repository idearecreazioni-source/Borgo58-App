# La regressione dello spostamento — e la domanda che non mi ero fatto

**21/08/2026** · correzione di un difetto **introdotto da me** poche ore
prima, col blocco A. Trovato da Alessio col tablet.
**Nessuna migrazione.**

---

## 1 · Cosa ho rotto

Conto aperto → «cambia tavoli» → tocco T4 → i tavoli si selezionano **e non
c'è nessun modo di confermare**. Spostare un conto era diventato impossibile.

**La causa**, in una riga: `cosaSiVede` rispondeva `"conto"` ogni volta che un
conto era aperto — e **durante uno spostamento il conto è sempre aperto**.
Quindi il ramo `"selezione"` non si raggiungeva mai, e con lui spariva la
barra col pulsante **«Sposta qui (n)»**.

Prima del blocco A la condizione era `selezione.length > 0` e funzionava.

---

## 2 · 🔴 La domanda che non mi ero fatto

Nel blocco A avevo protetto la **selezione** dall'essere azzerata durante lo
spostamento. L'avevo fatto apposta, l'avevo scritto nel riepilogo, e c'era
pure una prova.

**Ma non mi sono chiesto se la barra per confermare si vedesse ancora.**

> ⚠️ *Cosa resta selezionato* e *cosa compare* sono **due domande diverse**, e
> io ne avevo risposta a una sola.

⚠️ **Le prove del blocco A non potevano prenderlo, ed è la parte che vale.**
Misuravano `selezioneDopoIlTocco` e `esitoDelTocco` — cioè lo **stato**.
Nessuna misurava la **vista**. Ho aggiunto `cosaSiVede` nello stesso blocco e
non ho scritto nessuna prova che la interrogasse col caso più insidioso:
**spostando acceso**.

**Il caso era proprio quello che avevo dichiarato di proteggere.** Avevo
scritto: *«mentre si sposta un conto, il conto NON si lascia mai»* — e non ho
guardato cosa succedeva allo schermo in quello stesso caso.

---

## 3 · La cura: un caso in più, non un ritorno indietro

⚠️ **Non sono tornato a `selezione.length > 0`**: rimetterebbe i due pannelli
insieme, che è il difetto trovato da Alessio prima. Lo spostamento è un
**terzo caso**, e la regola deve saperlo distinguere.

`cosaSiVede` ha adesso **quattro risposte**: `spostamento`, `conto`,
`selezione`, `sala` — e lo spostamento viene per primo.

Più `siVedeLaBarraDeiTavoli(vista)`, che dice in quali viste compare la barra
di conferma: **due**, quando si sceglie dove *aprire* e quando si sceglie
dove *spostare*.

⚠️ **Quella funzione sta in `selezione.js` e non nella schermata apposta**:
è la domanda su cui la regressione è passata, quindi è la domanda che deve
avere una prova.

### Perché lo spostamento non è il difetto dei due pannelli

Il difetto era: un conto aperto su un tavolo **e la proposta di aprirne un
altro**. Durante lo spostamento la barra dice **«Sposta qui»** e il conto
sotto è **lo stesso** che si sta spostando. Nessuna ambiguità: una comanda
sola, e la barra riguarda proprio lei.

---

## 4 · Le prove nuove — e la controprova

**7 prove nuove** (24 in tutto in quel file), tutte che interrogano
`cosaSiVede` **con `spostando` acceso**.

**Rimessa la regressione esatta** (tolta la riga dello spostamento):

```
expected 'conto' not to be 'conto'
expected 'conto' to be 'spostamento'
expected false to be true          ← la barra non si vede
```

**4 prove rosse**, e la terza è il difetto di Alessio in una riga.

⚠️ **Misurato prima di correggere quanti punti dipendessero dalla selezione**:
**uno solo** in tutto il rendering, ed è quello che avevo cambiato. Gli altri
riferimenti a `selezione.length` sono guardie dentro funzioni, non decidono
cosa compare.

---

## 5 · Due cose che funzionano, dette

Dallo stesso collaudo, e vanno scritte perché un riepilogo che elenca solo i
guasti non dice come sta il lavoro:

- ✅ **La riga «‹ Lascia T3 aperto» c'è e fa il suo lavoro.**
- ✅ **«Invia comanda» è spento quando tutte le voci risultano già inviate**:
  non si manda due volte la stessa roba.

---

## 6 · Annotato per il blocco delle tre aree — NON corretto

🟡 **«Cambia tavoli» non si trova.** Alessio l'ha cercato e non l'ha visto:
sta **in cima alla pagina accanto al titolo**, cioè all'estremità opposta
rispetto al conto su cui si sta lavorando. Con la comanda aperta davanti, per
spostare un tavolo bisogna risalire tutta la schermata.

⚠️ **Non corretto adesso, per decisione del mandato**: nel disegno nuovo quel
collegamento finisce nella fascia in alto, e **lì va deciso** se resta o se
scende accanto a «‹ Lascia T3 aperto» — che è dove uno lo cerca, perché è il
posto dei gesti che riguardano *questo* conto.

---

## 7 · Cosa non è verificato

- 🔴 **Nessuna mano ha ancora rifatto uno spostamento** dopo la correzione.
  Le prove misurano che la barra *deve* comparire; che compaia davvero sul
  tablet lo dice solo l'occhio.
- ⚠️ **Non ho riprovato il caso dei due pannelli** dopo aver aggiunto il terzo
  caso: la prova dice che con un conto aperto senza spostare la barra non si
  vede, ma è una prova, non uno schermo.

---

## 8 · Cosa abbiamo rovesciato

**Niente.** La regola del blocco A non cambia: i due pannelli continuano a
non poter convivere. **Si aggiunge un caso che non era stato considerato**,
e la ragione del blocco A resta intera.

⚠️ **E la lezione, che è più larga del difetto:** ogni volta che si accentra
una decisione in una funzione sola — cosa che questo progetto fa spesso, e a
ragione — **quella funzione deve conoscere tutti gli stati del posto da cui
la decisione viene tolta**. Ne ho lasciato fuori uno, e quello era proprio lo
stato che il blocco A trattava come speciale.
