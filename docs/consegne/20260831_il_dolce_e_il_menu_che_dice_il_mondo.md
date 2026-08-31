# «Dolce e da meditazione» ai liquori, e il menu che dice in che mondo si finisce

**31/08/2026, pomeriggio.** Riepilogo per il validatore.

* **HEAD dichiarato**: `bfccb7ed42ff7dbacb5bc3249eed724baa95200e` — il commit che sta sotto questo file.
* **Prove**: 657 pure verdi (58 file), **459 sull'app verdi** (67 file), lint
  e build puliti.

### La migrazione che entra, per intero

* `20260831000011` — il menu delle categorie dice a quale mondo appartengono

---

## Cosa abbiamo rovesciato

**Niente.**

---

## 1 · Lo spostamento è in produzione

**Letto dalla produzione dopo aver applicato, non dedotto:**

| | |
|---|---|
| migrazioni | **366** |
| ultima | **`20260831000010`** |
| Vini | **4** — Rosso · Bianco · Rosato · Bollicine |
| Liquori e distillati | **4** — Amari · Distillati · Liquori dolci · Dolce e da meditazione |
| prodotti orfani | **zero** |

È esattamente il risultato che Alessio aveva chiesto.

---

## 2 · Le porte del Magazzino — guardate, e **non si sono mosse**

🔴 **Il mandato diceva «è la prima volta che si muovono». Non si sono mosse, e
non dovevano.** Guardate a 390 punti dopo lo spostamento:

```
Tutti · Alimentari (126) · Vini (0) · Bevande (3) · Liquori e distillati (0)
· Materiale di consumo (0) · Pulizia e sanificazione (0) · Varie ed eventuali (4)
```

⚠️ **Identiche a stamattina, e la ragione è che contano i PRODOTTI, non le
categorie.** Lo spostamento ha mosso una **categoria**, e nei mondi Vini e
Liquori i prodotti sono zero su tutti e due i database. *Un conteggio che non
cambia quando si sposta una categoria non è rotto: sta rispondendo a
un'altra domanda.*

⚠️ **Dirlo conta più che averlo guardato**: se avessi scritto «viste
cambiare» avrei confermato un'attesa invece di misurarla.

---

## 3 · 🔴 E guardando è saltato fuori un difetto vero

Aperta la scheda di un prodotto per vedere **dove** lo spostamento si
notasse, il menu delle categorie mostrava **ventiquattro voci piatte**:
Verdura, Frutta, … Bevande, Rosso, Bianco, Rosato, Bollicine, Amari,
Distillati, Liquori dolci, Dolce e da meditazione, Altro.

⚠️ **L'ordine era giusto** — «Dolce e da meditazione» compariva dopo «Liquori
dolci», quindi lo spostamento *si vedeva*. **Ma il mondo no**: chi sceglie una
categoria non sapeva in quale dei sette mondi sarebbe finito il prodotto.

🔴 **È la famiglia di questi due giorni in una forma più sottile**: il dato
**esiste** (`categorie_ingrediente.mondo`), **decide** dove il prodotto
comparirà nel Magazzino, e **la schermata dove lo si sceglie non lo dice**.
Non è un errore che il gestionale segnala: è un prodotto che finisce nel
mondo sbagliato **senza che nessuno se ne accorga**.

**Curato:**
* `categorie_proponibili()` restituisce anche il mondo, e **ordina per mondo**
  — così il menu esce già raggruppato come Alessio ha deciso, e la schermata
  non riordina niente per conto suo (sarebbe un secondo posto dove
  quell'ordine può divergere dal suo);
* il wrapper client **lo passa** — senza quelle due righe il dato si sarebbe
  fermato lì, che è di nuovo *il valore che esiste e non arriva*;
* il menu è raggruppato con `optgroup`.

✅ **Visto**, e questo è il menu di adesso:

```
Alimentari            Verdura, Frutta, Carne rossa, … , Altro
Vini                  Rosso, Bianco, Rosato, Bollicine
Bevande               Bevande
Liquori e distillati  Amari, Distillati, Liquori dolci, Dolce e da meditazione
```

⚠️ **I tre mondi non alimentari non compaiono, ed è giusto**: quella scheda
chiede le categorie dell'ambito `alimenti`, e la scheda di un alimento non
deve offrire «Detersivi».

⚠️ **Una categoria senza mondo non sparirebbe**: finirebbe in un gruppo
«Senza mondo» invece di uscire dal menu in silenzio.

🔴 **E il `drop` è stato necessario, non una scelta**: cambiare le colonne che
una funzione restituisce non si può fare con `create or replace` — Postgres
lo rifiuta. Dopo un `drop` i permessi tornano aperti al mondo, quindi si
richiudono a mano **e la verifica lo controlla** invece di darlo per fatto.

---

## 4 · Il codice interno

`vino_dolce` **resta com'è** dentro il mondo dei liquori, per decisione di
Alessio. La nota dentro la migrazione resta al suo posto: serve proprio a
impedire che qualcuno lo «raddrizzi» credendo di sistemare qualcosa.

---

## RILETTURA

### Schermate APERTE E GUARDATE
**Magazzino** (le sette porte, lette una per una) e **scheda di un prodotto**
(il menu delle categorie, coi quattro gruppi letti dal DOM).

### Consegnate senza vederle
Nessuna.

### Cosa ho contato senza leggerlo
Niente. I conteggi vengono dal database vero con una query; il menu e le
porte dal DOM. ⚠️ **Nessuna immagine è stata guardata**: lo screenshot non
funziona in questo ambiente.

### 🔴 Mie affermazioni diventate false mentre lavoravo
**Una, e l'ha smentita la misura**: avevo proposto io stesso di «riaprire il
Magazzino e guardare le porte cambiare». **Non cambiano**, perché contano i
prodotti e non le categorie. L'attesa era mia, e sarebbe stato facile
scrivere «viste cambiare» senza contarle.

### 🔴 Un misuratore che ha mentito — la quinta volta in tre sessioni
Il mio setaccio dei «campi sotto i 16 punti CSS» ne segnalava **quattro**:
erano tutte **checkbox**. La quarta soglia del 29/08 riguarda i **campi in
cui si scrive** — Safari ingrandisce toccando un campo di testo, non una
casella. Zero campi veri sotto soglia.

### Cosa ho visto e NON curato, dichiarato
Un collegamento dentro una frase — «Quanto ce n'è davvero?» — è alto **5,00
mm**, sotto la soglia degli 8,5. È **preesistente**, è largo 85,6 mm, e in
questo progetto esiste una regola apposta sui collegamenti dentro una frase
(26/08). Non l'ho toccato: potrebbe essere la forma voluta, e deciderlo non
era nel perimetro di oggi. **È la domanda 1.**

### Blocchi non aperti
Restano quelli di stanotte: **etichetta «investimento»**, **chiusura
dell'anno fiscale**, **il pacchetto per la commercialista**, la **coda di
`RICHIESTE.md`**.

### Conteggi che sono pavimenti
Le misure della scheda prodotto valgono a **390 punti** e a una densità sola.
