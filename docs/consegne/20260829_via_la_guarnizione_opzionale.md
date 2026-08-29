# Via la guarnizione opzionale

**Blocco 3 del mandato del 29/08.** Commit `282bda4`.
**Migrazione `20260829000023`**, applicata al progetto di prova.

---

## Cosa abbiamo rovesciato

**Niente.** Nessuna voce in vigore contraddetta. La spunta «Guarnizione
opzionale» non era una decisione registrata da nessuna parte: era un campo
nato con la scheda ricetta e mai discusso.

---

## Il numero che il mandato chiedeva: nessun food cost si muove

Misurato **prima** di toccare qualunque cosa, su tutti e due i database:

| | produzione | progetto di prova |
|---|---|---|
| righe di ricetta | **0** | 320 |
| di queste, «opzionali» | **0** | **0** |

Non c'era nessun costo che potesse muoversi, perché non c'era nessuna riga che
fosse esclusa. **La verifica lo dimostra invece di dirlo**: fotografa il costo
di ogni ricetta prima, e lo riconfronta dopo — **106 ricette, scostamenti
zero**.

⚠️ E c'è una **guardia** prima di tutto il resto, che è una proprietà e non
una fotografia: se un giorno qualcuno rilanciasse questa migrazione su un
database dove qualche riga *è* esclusa, si ferma e lo dice. Quel caso vuole
una decisione di una persona, non un `drop`.

---

## Non era una casella isolata

Misurato: `is_optional` era letta da **nove funzioni** e da **quattro viste in
catena**.

```
recipe_ingredients_display          ← la vista che legge lo staff
v_recipe_row_costs                  ← il costo di ogni riga
  └─ v_recipe_costs                 ← il food cost di una ricetta
       └─ v_menu_item_economics     ← il margine di una voce di menu
```

⚠️ **La catena l'ho scoperta perché Postgres ha rifiutato il primo
tentativo**, non perché l'avessi dedotta. Le viste vanno tolte dall'alto verso
il basso e rifatte dal basso verso l'alto.

---

## Si toglie, non si spegne

È la regola decisa il 14/08 con la pianta viva: *una colonna spenta, fra tre
mesi, qualcuno la riaccende credendo di riparare qualcosa*. Una colonna che
nessuna schermata può scrivere e che sei funzioni continuano a interrogare non
è un residuo innocuo: è un invito a rimetterci una casella sopra.

---

## Le tre trappole incontrate

**1 · `create or replace view` sa solo AGGIUNGERE colonne in fondo.** Per
toglierne una in mezzo rifiuta con `42P16`: tutte e quattro le viste vanno
tolte e rifatte.

**2 · Una vista o una funzione rifatta nasce APERTA A CHIUNQUE abbia la chiave
pubblica.** I permessi scritti nella migrazione sono quelli **letti da
`pg_proc.proacl` e `pg_class.relacl` prima di toccarle**, non ricopiati a
memoria dalle funzioni accanto — è l'errore già fatto tre volte in questo
progetto, l'ultima il 27/08. La verifica li ricontrolla nei due versi: chiuso
alla chiave pubblica **e** ancora aperto a chi usa il gestionale.

**3 · Togliere una colonna NON rompe una funzione che la nomina, finché
nessuno la esegue.** Postgres controlla le firme, non i corpi (trappola del
27/08). Per questo **la verifica le CHIAMA tutte e nove**, su un esempio
costruito da lei: un ingrediente, una preparazione e un piatto che la usa —
3 kg di preparazione × 2 kg a dose × 10 €/kg = **60 €**, controllato.

---

## E la rete del progetto ha chiesto conto della colonna tolta

`npm run prova:migra` si è rifiutato di applicare, dicendo che
`espansione_costo_ricetta` «perde per strada» una colonna rispetto al corpo
vivo. Era giusto che lo chiedesse: la rinuncia è **dichiarata nella
migrazione** invece di essere aggirata.

---

## Rotta in tre modi, tre controlli diversi

⚠️ Estraendo il **solo blocco di verifica**: rilanciare la migrazione curerebbe
da sé la rottura, perché la rimette a posto prima di verificarla (lezione del
26/08).

| rottura | errore |
|---|---|
| permesso aperto alla chiave pubblica | «rifacendola è rimasta una porta aperta» |
| un prezzo cambiato fra la foto e il confronto | «il costo di **28** ricette è cambiato» |
| una funzione che torna a nominare la colonna | «ci sono ancora **1** funzioni» |

Nessuna delle tre ha lasciato residui: lapidi **8283** prima e dopo.

---

## Guardato a schermo

Aperta la scheda della **Caponata** sul progetto di prova: 7 righe, i costi si
vedono (0,39 / 2,53 / 0,45 €), **nessun errore in console**, e «Guarnizione
opzionale» ed «escluso» non compaiono più.

---

## Rilettura

**Cosa NON ho verificato con gli occhi**
- 🔴 **La scheda ricetta vista dallo STAFF** (`StaffRicettaDetail`): si apre
  solo con l'accesso della sala, che non ho. Lì ho tolto una riga —
  l'etichetta «(opzionale)» — e la vista che alimenta quella schermata è
  provata dentro la migrazione, ma **nessuno l'ha aperta**.
- Il **menu** e la **simulazione prezzi** sono stati chiamati dalla verifica,
  non aperti come schermate.

**Cosa ho contato senza leggerlo**
- Le nove funzioni e le quattro viste vengono da una query sul catalogo, non
  dalla lettura di ogni corpo. Ho letto le **22 righe** che nominavano la
  colonna, una per una.

**Quali mie affermazioni sono diventate false mentre lavoravo**
- Avevo scritto che le viste erano **due**: sono **quattro**, in catena.
  Corretto dal rifiuto di Postgres.

**Cosa ho lasciato sul progetto di prova**
- Niente di questo blocco: la verifica cancella per identificativo quello che
  ha creato, e toglie anche le proprie lapidi. Contate: 8283 prima, 8283 dopo.

---

## Domande

Nessuna su questo blocco.
