# Consegna del 13/08/2026 (quarta) — il referto sui soldi, e le prime tre correzioni

**Commit della consegna: `5da7b24`** (questo riepilogo è il commit
immediatamente sopra, sola documentazione). Working tree pulito.

| Commit | Cosa |
|---|---|
| `d091e55` | il referto: 6 rilievi sui moduli che toccano soldi e obblighi |
| `a37e02c` | il costo degli omaggi — migrazione `20260813000008` |
| `fb2adb7` | il settimo rilievo: il magazzino non scende mai |
| `dd2d595` | la banca esiste: due saldi separati — `…09` |
| `e363800` | le domande da fare alla banca prima di aprire il conto |
| `5da7b24` | pagare una fattura è un movimento — `…10` |

**Applicate in produzione**: `…08`, `…09`, `…10`. **82 migrazioni**.

---

## 1. Il referto, e perché non è stato corretto niente subito

Il giro che `CLAUDE.md` §7 lasciava aperto dall'audit dell'08/08. Quello
cercava **classi di difetto** su tutto il codice (date UTC, permessi,
indici, errori inghiottiti) e per costruzione non poteva trovare un
calcolo fiscale sbagliato o una regola HACCP incompleta: **il codice
funziona benissimo mentre dice una cosa falsa**.

Su richiesta di Alessio: prima il referto, poi le correzioni. Venti
modifiche mescolate avrebbero tolto a lui il modo di capire cosa era
grave, e al validatore una lista da controllare.

Sta in [`docs/referti/20260813_moduli_soldi_e_obblighi.md`](../referti/20260813_moduli_soldi_e_obblighi.md).
**Sette rilievi**, tre chiusi in questa consegna, quattro aperti.

⚠️ **Il limite del referto, dichiarato in fondo al documento**: i moduli
sono vuoti — nessun dipendente, nessun movimento di cassa, nessuna
lettura di temperatura. È lettura di codice e di schema, **non uso dal
vivo**.

---

## 2. 🔴 La banca non esisteva — *chiuso*

Il modulo si chiama «Cassa, Banca e Prima Nota» da sempre, ma dentro
c'era **solo il contante**: nessun modo di dire se un movimento era
passato dal cassetto o dal conto.

Il primo giorno vero: un bonifico da 300 € registrato — e va registrato,
è prima nota — avrebbe tolto 300 € dal cassetto, dove non era uscito
niente. La conta di fine serata non torna, **e non torna per un motivo
che non è un errore di cassa**: manda a cercare un ammanco che non
esiste. Non registrarlo avrebbe reso incompleta la prima nota. Qualunque
strada, uno dei due numeri era falso.

**Fatto adesso proprio perché il conto corrente non è ancora aperto**: la
tabella è vuota, quindi costa una migrazione. Fra sei mesi sarebbe stato
decidere cosa scrivere su trecento righe registrate senza quel dato, e la
risposta onesta sarebbe stata «non lo so» su righe che sembrano complete.

`mezzo` è un **testo con vincolo e non un enum**, di proposito: domani
arriva il POS e un incasso con carta non è contante né è già in banca.
Con un enum aggiungere un valore è una migrazione che non si può usare
nel file in cui la si scrive (§8); così è una riga. **Il caso «carta» non
è stato inventato adesso**: si aggiunge quando il POS esiste.

---

## 3. 🔴 Pagare una fattura non era un movimento — *chiuso*

Trovato **preparando il confronto banca**, e nato da una domanda di
Alessio che valeva più della risposta:

> *«Oltre a una copia dell'estratto conto, che posso già vedere
> dall'home banking, cosa otterremmo?»*

Domanda giusta: se il risultato è una copia, non vale la pena
costruirlo. Il valore sta nel confronto — e andando a vedere com'era
fatto quel confronto è saltato fuori che mancava un pezzo **prima ancora
della banca**: `pay_supplier_invoice` segnava la fattura pagata e **non
scriveva niente in prima nota**.

- la prima nota nasceva incompleta, senza i pagamenti ai fornitori;
- ribattendoli a mano, niente impediva di contarli due volte;
- i saldi erano sbagliati **sempre nella stessa direzione**: risulta più
  denaro del vero.

**La correzione è prevenire, non segnalare.** Si poteva fare una
schermata che elenca le fatture pagate senza movimento — accorgersi dopo
di una divergenza che non doveva potersi creare. Il progetto ha già
scelto un'altra strada nei casi analoghi («i doppioni diventano
impossibili per costruzione», 12/08). Ora le due scritture avvengono
insieme o non avvengono, dentro la funzione che il corridoio già chiama
(B4), e **l'indice unico rifiuta un secondo movimento per la stessa
fattura anche aggirando la funzione** (provato).

**Il confronto vero** è `quadratura_pagamenti()`: mostra solo ciò che
nessun vincolo può impedire — fatture pagate prima che il collegamento
esistesse, uscite battute a mano che non agganciano niente. È lo stesso
elenco che si riempirà con le righe dell'estratto conto: per questo si
costruisce adesso, **non dipende da quale banca sceglierà**. In schermata
compare **solo quando c'è qualcosa**: un riquadro che dice «tutto a
posto» ogni giorno si impara a non guardare.

---

## 4. 🟠 Il costo degli omaggi — *chiuso*

L'unico dei sette rilievi **con una scadenza**: gli altri si correggono
fra un mese senza perdere niente, questo no. Il costo di un piatto si
calcola **nell'istante in cui succede**, coi prezzi e con la ricetta di
quel giorno; fra sei mesi non si ricostruisce più.

Alessio ha chiesto perché mai dovrebbe pagare imposte su un pasto
regalato, ed è la domanda giusta: **non si paga un'imposta sul guadagno
mancato, si restituisce l'IVA già recuperata sulla materia prima**. Per
questo la base è il costo (11 €) e non il listino (40 €): dargli il
numero sbagliato significherebbe fargliene restituire quattro volte
tanto. *La qualificazione vera — cessione gratuita o spesa di
rappresentanza — resta a Laura (domanda L1).*

⚠️ **La regola che vale più del calcolo**: una voce libera non ha
ricetta, una ricetta senza ingredienti dà **zero** — che sembra un piatto
gratis. Il totale sarebbe più basso del vero e sembrerebbe a posto.
Quindi si contano le righe non valorizzate e il riepilogo scrive
«parziale: N conti». È la lezione dello scarto a zero, di nuovo.

**Decisione di Alessio messa a verbale**: vuole registrare gli omaggi in
ogni caso e sapere quanto sono costati; se poi l'IVA si scomputi o no lo
dirà Laura. Il gestionale **registra sempre** e non decide.

---

## 5. Il settimo rilievo, trovato da una sua domanda

*«Il magazzino non cala perché non abbiamo ancora ricette, o non lo
farebbe a prescindere?»* — **a prescindere**. Nessun trigger su
`orders`/`order_items`: chiudere un conto non tocca la giacenza. Con le
ricette perfette, servire cento coperti la lascerebbe com'era.

La conseguenza peggiore non è la giacenza sbagliata: **la Fase A della
filiera della spesa**, messa in coda un'ora prima, fa comparire un
ingrediente in lista quando scende sotto soglia. Se la giacenza non
scende, la lista sarebbe costruita, funzionante e **muta per sempre**.

Non è una correzione ma un lavoro da progettare (ricette precise, voci
libere, sprechi). In coda in §10, **prima** della Fase A.

---

## 6. Verifica

| Cosa | Stato |
|---|---|
| le tre migrazioni sul progetto di prova | **applicate due volte**: idempotenti |
| un bonifico non muove il contante | **provato** |
| un incasso in contante non muove la banca | **provato** |
| un mezzo di pagamento inventato | **rifiutato** |
| pagare scrive l'uscita col mezzo giusto e aggancia la fattura | **provato** |
| stessa fattura pagata due volte | **rifiutata**, anche aggirando la funzione |
| lo staff continua a non poter pagare fatture | **provato** (impersonato) |
| la quadratura tace quando torna, e parla nei due casi previsti | **provato** |
| costo di un omaggio: 2 porzioni × 6,00 con scarto 20% = 12,00 € | **provato** |
| righe non valorizzabili contate, non ignorate | **provato** |
| prove automatiche | **30 verdi** |
| lint, build | puliti |
| **produzione** | **82 migrazioni** |

---

## 7. Cosa resta aperto del referto

- 🟠 **L'IRAP è calcolata sull'utile** come l'IRES. Da confermare con
  Laura quale base usare; nel frattempo va scritto in schermata che è una
  semplificazione.
- 🟠 **Temperatura fuori range** senza azione correttiva obbligatoria e
  senza non conformità.
- 🟠 **Merce non conforme al ricevimento** senza conseguenza né traccia
  della decisione.
- 🟡 **Le ferie** sono un numero scritto a mano che può contraddire le
  date, senza residuo né controllo di sovrapposizione.
- 🔴 **Il magazzino non scende mai da solo** (§5).

## 8. E cosa NON è verificato

- **Niente di tutto questo è stato usato dal vivo**: non c'è un movimento
  di cassa vero, una fattura fornitore vera, un conto chiuso vero. Le
  verifiche sono quelle dentro le migrazioni.
- **Il messaggio delle 10:00 dello scadenziario** non è ancora mai
  partito: dopo le schede compilate sarà vuoto, quindi per vederlo
  servirà un prodotto davvero vicino alla scadenza.
- **I dati di collaudo** sono ancora in produzione, per scelta di
  Alessio. **`/prova-voce`** è ancora lì.
