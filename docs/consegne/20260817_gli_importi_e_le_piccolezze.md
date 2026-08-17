# Consegna del 17/08/2026 (quinta) — un importo si scrive in un modo solo

**Commit della consegna: `3af8d85`** (`Le piccolezze: il gergo, i numeri nudi,
e lo spazio a chi lo usa`). Working tree pulito prima di questo riepilogo.
Questa consegna **non modifica** `docs/CONTRATTO.md`.

Copre la migrazione `20260817000005` e quattro delle piccolezze rimaste.
⚠️ **Due non sono state fatte, ed è dichiarato**: vedi §6.

---

## 1. Il difetto, e perché non è estetica

Alessio, leggendo un rifiuto: dentro il messaggio gli importi erano
«25.69 euro» e «10.00» — col punto decimale e la parola «euro» — mentre due
righe più sotto la stessa schermata scriveva «195,69 €».

⚠️ **L'incoerenza si nota proprio dove si sta leggendo con attenzione.** Un
rifiuto è il momento in cui qualcuno si ferma a capire cosa è andato storto:
è il posto peggiore in cui far sospettare che il numero venga da un'altra
parte.

**La cura è un posto solo**: `euro()`. Ogni messaggio se lo scriveva da sé,
con la sua maschera e la parola «euro» a mano. Ora nessuno formatta più
niente — e il controllo è una **proprietà**, non un conteggio: *zero*
funzioni contengono ancora una maschera di importo. Quattordici riscritte.

---

## 2. 🔴 Tre difetti miei, nessuno trovato leggendo

**`euro(0)` scriveva «,00 €».** Con quella maschera le cifre non
significative spariscono: l'ultima dev'essere uno `0` e non un `9`. È il caso
limite che in un gestionale capita **il primo giorno** — un saldo a zero, una
nota di credito usata per intero — non fra un anno. L'ha preso la verifica.

**L'espressione regolare inghiottiva un `to_char` di DATE** che la
precedeva sulla stessa riga:

```
to_char(v_data,'DD/MM/YYYY') || … || to_char(v_mance,'FM999999990.00')
      ↓
euro(v_data,'DD/MM/YYYY')   || … || to_char(v_mance)
```

cioè una chiamata a due argomenti che **non esiste**. Due funzioni della
tesoreria hanno smesso di rispondere.

> ⚠️ **Un corpo che si crea non è un corpo che funziona.** Postgres accetta
> una funzione che ne chiama un'altra inesistente: non risolve le chiamate
> finché non le esegue. Quindi «la funzione è stata riscritta» e «la funzione
> risponde» sono due cose diverse, e finora le verifiche controllavano solo
> la prima.

La cura è doppia: il pezzo catturato **non può contenere un apostrofo** —
un'espressione non ne ha mai, una maschera di formato sì, quindi lo sbaglio
diventa impossibile invece che improbabile — e la verifica **chiama** le tre
funzioni della tesoreria invece di fidarsi che esistano.

**E la suite ha fatto il lavoro per cui esiste.** Due prove rosse con
*«Cannot read properties of null»* — che è come si presenta una funzione del
database che non risponde più, e non parla di formattazione. Senza quelle
prove le due funzioni sarebbero rimaste mute, e Alessio se ne sarebbe accorto
la prima volta che apriva la Cassa.

---

## 3. Il progetto di prova rifatto da zero

Le funzioni rotte erano state riscritte **in memoria del database** e non
c'era modo di sapere con certezza quali: rattoppare avrebbe voluto dire
indovinare. Quindi `npm run prova:ricostruisci --azzera` — **129 migrazioni
riapplicate in ordine dal nulla**, poi lo scenario di collaudo.

⚠️ **E ha un secondo valore che vale la pena mettere agli atti**: quelle 129
migrazioni riapplicate dal nulla sono la prova che **la catena regge
dall'inizio**. È una cosa che nessuno verifica mai finché non serve, e di
solito serve nel giorno peggiore.

---

## 4. Le piccolezze fatte

| | perché non è solo forma |
|---|---|
| «Questo mese»: «+0,00» e «−152,94» diventano «entrati» e «usciti» | un numero senza la sua parola si capisce alla seconda lettura, e in prima nota il **verso** è ciò che si vuole a colpo d'occhio |
| «Omaggi (base TD27)» → «Omaggi» | TD27 è il codice della fattura per autoconsumo: in una schermata che si guarda ogni giorno non dice niente |
| La striscia colorata non stampa più il riferimento del progetto | «oudjuqbqszisdtwzbxdo» accanto a «DATI VERI» insegna che quell'avviso è roba da tecnici — il contrario di ciò per cui la striscia esiste. Resta nel titolo al passaggio del mouse |
| «Nuova fattura» nasce **chiusa** | occupava il posto più visibile pur essendo il gesto più raro: lo spazio in alto va a cosa c'è da pagare |

---

## 5. Numeri veri dell'applicazione in produzione

```
NOTICE:  Funzioni che scrivevano un importo per conto proprio, corrette: 14.
NOTICE:  Un importo si scrive in un modo solo: 1.234,56 €, anche dentro un messaggio.

 funzioni_che_formattano_da_sole | funzioni_che_usano_euro
                               0 |                      15

  applicate e registrate: 1 su 1
  totale migrazioni in produzione: 129
```

**La sanatoria ha toccato 14 funzioni** — dichiarato, non sottinteso.

| Controllo | Valore |
|---|---|
| Migrazioni in produzione | **129** |
| Funzioni che formattano un importo da sole | **0** (proprietà, non conteggio) |
| `euro()` sui casi limite | `25,69 €` · `0,00 €` · `1.234,50 €` · `—` |
| Le tre funzioni della tesoreria rispondono | **sì**, chiamate dalla verifica |
| Prove automatiche | 49 pure + 144 sul progetto di prova, verdi |

---

## 6. Cosa NON è fatto, e cosa non è verificato

- **Due piccolezze su cinque restano**: il **riepilogo in cima al Magazzino**
  («3 sotto soglia, 1 scade fra due giorni») e le **spunte dell'Editor Menu
  Cartaceo**. ⚠️ La seconda **va disegnata, non aggiustata** — la cura non è
  ingrandire la nota, è che la spunta somigli a ciò che fa — e non è una cosa
  da fare di corsa in coda a un giro lungo.
- **Nessuna mano vera ha riletto i messaggi riformattati**: Alessio li aveva
  appena letti tutti uno per uno prima della correzione, e ha detto che per
  questa non serve un giro.
- **`euro()` non ha una prova dal client**: è esercitata dalla verifica della
  migrazione e attraverso i messaggi di rifiuto che le prove sul progetto di
  prova leggono.

## 7. Due cose messe in coda, insieme

Sono **due facce dello stesso problema — un controllo che guarda la forma
invece del comportamento** — e vanno affrontate insieme:

1. **Quante funzioni sono riscritte da una migrazione senza che nessuna
   verifica le abbia mai chiamate?** Se sono poche si guardano a mano; se
   sono tante è una rete: *ogni funzione che una migrazione riscrive va
   eseguita almeno una volta nella sua verifica*. È la generalizzazione del
   difetto del §2.
2. **I 33 posti dove una dimenticanza è silenziosa** (vocabolari su una
   colonna con predefinito): misurati il 17/08, mai camminati.
   `createCashMovement` ha ancora la forma vulnerabile.

## 8. Stato finale

| | |
|---|---|
| Migrazioni in produzione | **129** |
| Migrazioni nel repository / sul progetto di prova | 129 / 129 |
| Prove automatiche | 49 pure + 144 sul progetto di prova |
| Piccolezze del collaudo | **8 su 10** |
| Prossimo | le due piccolezze rimaste, poi la lista della spesa (§ mandato) |
