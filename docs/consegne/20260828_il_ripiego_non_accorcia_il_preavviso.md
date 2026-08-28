# Blocco 4 — il ripiego non accorcia mai il preavviso

**28/08/2026** · Blocco 4 del mandato. È una **decisione di Alessio**: gli era
stato proposto di sistemare a mano i prodotti colpiti, ha rifiutato e ha
chiesto la correzione del telaio.

| | |
|---|---|
| **HEAD dichiarato** | `e897469` — *Il ripiego non accorcia mai il preavviso* |
| **Working tree** | pulito al momento del commit |
| **Migrazioni introdotte** | `20260828000008` |
| **In produzione** | 🔴 **no** — applicata solo al progetto di prova, aspetta il push |
| **Sul progetto di prova** | applicata: **312** migrazioni |

---

## La decisione

> Quando la durata manca, il calcolo del preavviso ripiega sul valore **più
> prudente**, mai sul più corto.

---

## Cosa succedeva, misurato prima di correggere

Tolta la durata dai prodotti comprati (`20260828000004`), il ripiego è rimasto
a decidere in base a **dove si conserva**: due giorni per il frigo, quattordici
per tutto il resto. Ma la conservazione da sola **non sa distinguere il pesce
fresco — dove due giorni sono giusti — dal burro, dal caciocavallo e dalla
crema di pistacchio, che in frigo stanno mesi.** Era la durata a distinguerli,
e la durata non c'è più.

I numeri veri sul progetto di prova, **prima**:

| | |
|---|---|
| prodotti | **133** |
| con un preavviso scritto a mano | **0** — quindi **ripiegano tutti** |
| in frigo → ricevevano il ripiego **corto**, 2 giorni | **18** |
| altrove → 14 giorni | 115 |

Fra i diciotto: **Burro, Caciocavallo ragusano, Crema di pistacchio** — i tre
che il mandato nominava.

⚠️ **Il verso conta, ed è la ragione della decisione.** Un preavviso troppo
**lungo** su un prodotto fresco è un fastidio: lo si vede in elenco prima del
necessario. Un preavviso troppo **corto** su un prodotto che dura mesi è
**merce buttata**, perché quando compare è già tardi. I due errori non si
pagano allo stesso prezzo, quindi il ripiego non sta in mezzo: **sta dalla
parte che costa meno sbagliare.**

⚠️ **E sul gestionale vero pesa di più, non di meno**: qui i prodotti sono 133
e finti; a marzo saranno centinaia e veri, e i più colpiti sarebbero **freschi
e latticini**.

---

## Come è scritta, e perché non è «metti 14»

Il ripiego resta espresso come una **regola**, non come un numero: si prende il
**più lungo** fra quello che la conservazione suggerirebbe e la base prudente.

Così il giorno che qualcuno aggiungesse una conservazione che ne chiede trenta,
il calcolo prenderebbe trenta **da solo** — mentre scrivere `14` e basta
l'avrebbe accorciata in silenzio, che è esattamente il difetto che questa
migrazione chiude.

⚠️ **Il numero scritto a mano da Alessio vince sempre, anche se è corto**: la
prudenza è il ripiego di chi non sa, **non un tetto imposto a chi sa**.

⚠️ **Il parametro della conservazione è rimasto.** Toglierlo avrebbe rotto la
rete dei vocabolari, che lo dichiara in
[`src/lib/calcoli/vocabolari.js`](../../src/lib/calcoli/vocabolari.js).

---

## I 133 rimisurati dopo

| direzione | quanti |
|---|---|
| **si allunga** (più prudente) | **18** |
| invariato | 115 |
| **si accorcia** | 🔴 **zero** |

Burro, Caciocavallo ragusano e Crema di pistacchio: **14 giorni**.

---

## Rotta in due modi, con due messaggi diversi

| rottura | messaggio |
|---|---|
| tolto il ripiego prudente (com'era prima) | *«Il ripiego del frigo accorcia ancora: 2 invece di 14»* |
| ignorato il numero scritto a mano | *«Un preavviso scritto a mano non viene rispettato: 14 invece di 2»* |
| nessuna rottura | il racconto di cosa ha controllato |

⚠️ **Il quinto controllo è una proprietà, non quattro casi**: cammina l'elenco
vero delle conservazioni e pretende che **nessuna** ripieghi sotto la base
prudente. Una conservazione nuova entra da sola nel controllo, invece di
restare fuori finché qualcuno se ne ricorda.

E `partite_in_scadenza()`, unico chiamante nel database, **risponde** — 202
righe, chiesto al database e non dedotto dal fatto che la funzione è stata
riscritta.

---

## Cosa abbiamo rovesciato

**Niente.** Il ripiego per conservazione non era una decisione scritta in
`docs/DECISIONI.md`: era il comportamento residuo lasciato dalla `…004` quando
la durata è uscita di scena. Questa migrazione lo completa, non lo contraddice.

---

## Cosa NON è verificato

- 🔴 **Non è in produzione**: aspetta il push di Alessio.
- 🔴 **Nessuna schermata è stata aperta.** Lo scadenziario con i 18 prodotti
  allungati non l'ha guardato nessuno — so che la funzione risponde, non come
  si legge l'elenco.
- ⚠️ **Il prezzo, dichiarato**: con 14 giorni per tutti, un prodotto fresco
  comparirà nello scadenziario **appena arriva**. Alessio può accorciarlo per
  singolo prodotto, e nessuno l'ha ancora fatto su nessuno dei 133. Se
  l'elenco diventasse rumoroso, la cura è quel campo — non tornare al ripiego
  corto. **È la domanda 3 del riepilogo di sessione.**
- ⚠️ **Il conteggio del mandato («7 su 133 cambiano, 3 si accorciano») non l'ho
  potuto rifare**: si appoggiava alla durata, che non esiste più, quindi il
  «prima» non è più calcolabile. Ho misurato lo stato di adesso — **18** che
  ripiegano corto — che è il numero su cui si decide.
