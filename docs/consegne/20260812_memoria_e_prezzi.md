# Consegna del 12/08/2026 — la memoria delle diciture e i prezzi sorvegliati

**Commit della consegna: `de28df2`** (questo riepilogo è il commit
immediatamente sopra, sola documentazione). Working tree pulito.

**Migrazioni `20260812000013` e `…14` già applicate in produzione** (68
registrate). Nessuna funzione online da reinstallare.

---

## 1. Due obiezioni che hanno cambiato il senso del modulo

Alessio, sul carico da fattura, prima ancora di provarlo:

> *«Lo stesso ingrediente posso comprarlo da due fornitori diversi, o lo
> stesso fornitore può cambiare marca o dicitura sulla fattura. Non devono
> nascere doppioni né ambiguità.»*

> *«La giacenza mi interessa poco, il locale è piccolo e vedo a occhio cosa
> c'è. Ma se un fornitore aumenta un prezzo senza dirmelo, voglio che il
> sistema me lo segnali. E vorrei poter chiedere all'assistente quanto sto
> pagando un prodotto.»*

La seconda riorienta il modulo, e vale più di quanto sembri:

> **Il valore non è il magazzino. È il prezzo.**

Il dato che conta non è «quanto ne ho» — quello lo vede lui aprendo la
cella — ma **«quanto l'ho pagato, quando, da chi»**. Da lì vengono
l'avviso sui rincari, la risposta a *«quanto sto pagando il ciliegino»*,
e domani il costo dei piatti. Avevo costruito un modulo di magazzino con
la sorveglianza dei prezzi come effetto collaterale; è il contrario.

---

## 2. Due livelli invece di uno

| | |
|---|---|
| **ingrediente** | cosa cucini: `Pomodoro ciliegino`, uno solo |
| **articolo del fornitore** | come lo chiama la fattura: «Pomodori ciliegini Pachino cassa 6 kg», «CILIEGINO PACHINO IGP», … |

Un ingrediente ha tante diciture, di fornitori diversi. La prima volta che
una compare, il gestionale chiede; **dopo la riconosce e non chiede più.**

**I doppioni diventano impossibili per costruzione**: non decide il
modello, decide una riga scritta da Alessio una volta sola. Copre i suoi
tre casi — due fornitori per lo stesso prodotto, cambio di marca, cambio
di dicitura.

L'abbinamento vive in un **trigger del database**, non dentro
`posta-leggi`: domani il carico arriverà da Fatture in Cloud, e una copia
della logica nella funzione della posta divergerebbe dall'altra. Come
sempre.

Si ricorda anche il **«questa riga non è merce»** (trasporto, contributo
CONAI, sconti): è la differenza fra un sistema che impara e uno che ogni
mese rifà la stessa domanda.

---

## 3. La trappola che avrebbe reso inutile tutto il resto

> «Cassa da 6 kg — quantità 12»: sono 12 kg o 12 casse?

Con l'interpretazione sbagliata il prezzo al chilo è errato **di sei
volte**. E la conseguenza non è un numero brutto in una schermata: è che
la sorveglianza dei prezzi darebbe allarmi falsi **o tacerebbe su rincari
veri** — il modo peggiore di fallire, perché sembra funzionare.

Quindi l'articolo ricorda anche **come lo conta il fornitore** e il
fattore verso l'unità dell'ingrediente. Chiesto una volta sola.

Verificato: 2 casse da 6 → **12 kg**, e 19,20 a cassa → **3,20 al chilo**
nello storico prezzi.

---

## 4. ⚠️ Il prezzo si confronta prima di scriverlo

Se lo storico si scrivesse per primo, il confronto **troverebbe se stesso**
e non ci sarebbe mai nessun rincaro. È un errore che non lascia tracce: il
sistema tace, e sembra semplicemente che i prezzi non salgano mai.

L'ordine è: confronta → carica → scrivi lo storico → avvisa.

---

## 5. Quando suona, e dove

- **Soglia 10%**, in `service_settings` — dato, non codice.
- **`ingredients.prezzo_stagionale`** zittisce l'avviso su ortofrutta e
  pesce. Non è un vezzo: senza, a novembre suonerebbe metà della spesa, e
  un avviso che suona sempre si smette di leggere. È la lezione della
  sentinella di stamattina, applicata **prima** di sbagliare invece che
  dopo.
- **Confronto con l'ultimo prezzo dello stesso fornitore**, che è la
  domanda di Alessio. Il confronto *fra* fornitori è un'altra domanda —
  «chi me lo fa meglio» — e si risponde guardando lo storico, non con un
  allarme: due fornitori hanno prezzi diversi per mille ragioni lecite.
- **Due posti** (deciso da lui): nella schermata **prima** della conferma
  — se il fornitore ha sbagliato la fattura ci si accorge mentre non
  registrarla è ancora gratis — e su Telegram dopo. Una sola regola,
  `variazione_prezzo()`, che **decide e non avvisa nessuno**; due
  chiamanti. Stessa forma della sentinella e dell'email di conferma.

---

## 6. Il materiale di consumo

Stessa anagrafica degli alimenti, con `ingredients.alimentare = false`
(scelta di Alessio): il Ricettario mostra solo gli alimenti, ma **la
sorveglianza dei prezzi è una sola** e un rincaro sullo sgrassante arriva
come quello sui pomodori.

Un booleano e non una categoria nuova, perché `ingredient_category` è un
enum e `alter type … add value` non è usabile nella stessa migrazione che
lo aggiunge (§8) — e perché su quell'enum poggiano già tutte le schermate.

---

## 7. Verifica

| Cosa | Stato |
|---|---|
| progetto di prova | **applicate due volte**: idempotenti |
| dicitura riconosciuta a maiuscole/punteggiatura diverse | **provato** |
| il fattore arriva nella riga proposta, dalla memoria | **provato** |
| conversione quantità e prezzo (2 casse → 12 kg, 19,20 → 3,20) | **provato** |
| storico prezzi in unità dell'ingrediente, `source = 'fattura'` | **provato** |
| ingrediente creato dalla riga | **provato** |
| «non è merce» ricordato | **provato** |
| primo acquisto → nessun confronto | **provato** |
| +5% sotto soglia, +20% sopra, prodotto stagionale muto | **provato** |
| rincaro del 25% al secondo carico → un avviso | **provato** |
| pulizia (ingredienti, fornitori, articoli, storico, **allarmi**) | **verificata** |
| prove automatiche | **29 verdi** |
| **produzione** | **applicate**: 68 migrazioni, soglia 10, zero residui |
| lint, build | puliti |

**Non verificato, e dichiarato**: nessuna fattura vera è ancora passata di
qui, e con il Ricettario vuoto (vedi il riepilogo `haccp_alla_porta` §5)
la prima prova servirà soprattutto a vedere **come il modello legge le
righe** e quanto sono usabili le diciture che propone. La memoria si
riempirà da lì.
