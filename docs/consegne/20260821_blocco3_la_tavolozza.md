# Blocco 3 — la tavolozza e i due pallini

**21/08/2026** · **nessuna migrazione**: il database sapeva già tutto quello
che serviva.

---

## 1 · Il colore nuovo — misurato, non scelto

**`#bf7536`** («ambra»), per la **fascia di mezzo**.

Distanza percettiva (Lab, CIE76): sotto 2 due colori sono indistinguibili,
sopra 10 si distinguono **a colpo d'occhio**, sopra 20 la differenza è netta.

**Oro `#c99a3d` e terracotta `#b5502e` distano 39,3.** Provati sette
candidati sul segmento fra i due:

| candidato | da oro | da terracotta | **il più debole** |
|---|---|---|---|
| `#c28038` | 14,3 | 25,0 | 14,3 |
| `#c07936` | 17,9 | 21,4 | 17,9 |
| **`#bf7536`** | **20,3** | **19,0** | **19,0** ← |
| `#be7135` | 22,4 | 16,9 | 16,9 |
| `#bc6a33` | 26,0 | 13,3 | 13,3 |

⚠️ **Il punto medio è l'ottimo, e non per caso**: è quello che **massimizza
la distanza dal vicino più vicino**. Spostandolo verso l'uno o verso l'altro
il minimo scende — si guadagna dove non serve e si perde dove serve.

### E non mi sono fermato ai due vicini

Il mandato chiedeva il confronto con oro e terracotta. **Provato contro tutti
i colori della sala**, perché distinguersi da due non basta se ci si confonde
con un terzo:

| vs | ΔE |
|---|---|
| libero (panna) | 62,8 |
| tavolo fisso (crema scuro) | 52,4 |
| **primo giro (oro)** | **20,3** |
| **ultimo giro (terracotta)** | **19,0** ← il più vicino |
| comanda inviata (marrone) | 52,6 |
| selezionato (oliva) | 46,6 |

**Il minimo assoluto è 19,0**, quasi il doppio della soglia.

⚠️ **Verificato anche il marrone**, che cambia significato: il suo vicino più
prossimo è l'oliva a **20,5**. Sopra soglia.

🔴 **IL LIMITE, dichiarato**: ΔE misura la differenza in condizioni standard.
**Se si distingua in sala, con la luce del ristorante, resta una domanda di
Alessio** — è una delle due che il mio strumento non chiude.

---

## 2 · Perché il colore serviva

Non è una preferenza: è **meccanicamente necessario**. Il verde oliva passa a
significare «tavolo selezionato», e il verde **era la fascia di mezzo**.
Senza un colore nuovo, la fascia di mezzo e il tavolo toccato sarebbero stati
lo stesso colore — cioè l'ambiguità che questo blocco toglie.

⚠️ **UNA DIFFERENZA DI NOME CHE NON HO DECISO IO.** Il mandato chiama quel
colore **«PRENOTATO»**; nel progetto quella fascia si chiama **«occupa la
serata»** (`pieno`), e le tre fasce sono definite in `lib/calcoli/serata.js`
dal giro C. Nella lista del mandato il colore nuovo sta **esattamente fra oro
e terracotta**, cioè dov'è la fascia di mezzo, e l'ho messo lì.
**Se «prenotato» voleva dire un quarto stato diverso dalle fasce, va detto**:
sarebbe un lavoro diverso.

---

## 3 · I due significati che cambiano

| | prima | adesso |
|---|---|---|
| **marrone scuro** | «ci sono seduti adesso» | **la comanda è partita per la cucina** |
| **verde oliva** | fascia «occupa la serata» | **tavolo selezionato** |
| **terracotta** | fascia «ultimo giro» **e** selezionato | solo fascia «ultimo giro» |

⚠️ **Il terracotta era doppio**, e il commento nel codice diceva che
l'ambiguità *«si scioglie da sé — il tavolo selezionato è al massimo uno»*.
**Non è più vero da stamattina**: dal blocco 1 la selezione prende un
tavolone intero, quindi tre tavoli terracotta possono essere tre selezionati
o tre ultimo-giro.

---

## 4 · I due pallini

| segno | dice | il gesto che manca |
|---|---|---|
| **contorno** | conto aperto, **niente ordinato** | tornare al tavolo |
| **pieno terracotta** | piatti segnati, **mai partiti** | mandare in cucina |

⚠️ **Stessa forma apposta**: sono due gradi della stessa cosa, non due fatti
scollegati. Il pieno è più forte perché costa di più — un tavolo che aspetta
e una cucina che non sa.

⚠️ **Il pieno vince sul vuoto**, anche quando una parte è già partita: il
gesto che manca resta quello.

⚠️ **Il pallino non si perde selezionando**: è un canale a sé, come la
sbarratura del ritardo.

⚠️ **E le righe ANNULLATE non contano** (`statoDelConto`): un piatto stornato
non è né qualcosa da mandare né qualcosa che è partito. È la regola del 16/08
applicata a un posto nuovo.

---

## 5 · 🔴 UN DIFETTO TROVATO GUARDANDO, che nessuna prova avrebbe preso

Segnando un piatto, **il pallino restava vuoto**. Diventava pieno solo
ricaricando la pagina.

**Causa misurata**: la sala si costruisce da `openOrders`, che è la
**fotografia dell'ultima lettura** e non sa niente di quello che si sta
scrivendo adesso.

⚠️ **In servizio vorrebbe dire che il cameriere segna i piatti e la sala
continua a dire «non c'è niente da mandare»** — cioè il pallino, che esiste
apposta per non far dimenticare l'invio, **mentirebbe proprio nel momento in
cui serve**.

**Cura**: il conto che si sta servendo si prende da `order`, che è fresco;
gli altri tavoli restano sulla fotografia, perché cambiano per mano d'altri.

✅ **Verificato dal vivo dopo la correzione: il pallino diventa pieno
subito.**

> ⚠️ **Nessuna prova automatica l'avrebbe preso**, e non per una lacuna delle
> prove: la regola era giusta, il dato che le arrivava era vecchio. È un
> difetto che vive **fra** il dato e la schermata, e lì guarda solo un occhio.

---

## 6 · Le persone attese

Sul tavolo prenotato il numero è **quante persone arrivano**, non quanti ce
ne stanno.

✅ **Misurato dal vivo, e i numeri combaciano con l'elenco delle
prenotazioni**:

| tavolo | dice | la prenotazione |
|---|---|---|
| T1 | **4** | Famiglia Grasso, 4 persone |
| T2 | **2** | Nicosia, 2 persone — *e T2 è un tavolo da 4* |
| T3 | **6** | Tavolo Amato, 6 persone |
| T4 | 4 | nessuna prenotazione → la capienza |

⚠️ **CON DUE TURNI SULLO STESSO TAVOLO IL NUMERO RESTA LA CAPIENZA**, ed è una
scelta dichiarata: le persone attese sarebbero **due numeri diversi**, e in
una cifra sola non ci stanno. Sceglierne uno vorrebbe dire inventare quale
dei due gruppi «è» quel tavolo.

---

## 7 · Cosa ho guardato — l'elenco

Col nuovo accesso di collaudo, a 768 punti, sul progetto di prova:

| cosa | esito |
|---|---|
| l'ambra si disegna | ✅ su 3 tavoli |
| il verde = tavolo toccato | ✅ dopo il tocco su T4 |
| pallino **vuoto** su conto aperto senza ordini | ✅ contorno, senza riempimento |
| pallino **pieno** dopo aver segnato un piatto | ✅ terracotta, **senza ricaricare** dopo la cura |
| il numero = persone attese | ✅ T1→4, T2→2, T3→6 |
| la riga «‹ Lascia T4 aperto» | ✅ presente |

**E il conto di prova è stato cancellato**: 1 tolto, **0 conti aperti
rimasti** sul progetto di prova.

---

## 8 · Cosa non è verificato

- 🔴 **Il colore in sala, con la luce vera.** So che dista 19,0 dal vicino più
  prossimo. **Non so se Alessio lo distingue** dall'altro capo della sala.
- ⚠️ **Il caso «misto»** (due fasce sullo stesso tavolone) non l'ho visto:
  serve una sera con due prenotazioni in fasce diverse sullo stesso gruppo.
- ⚠️ **Il marrone «comanda inviata» non l'ho visto disegnato**: avrei dovuto
  mandare una comanda in cucina. La regola è provata, il colore è misurato,
  **il disegno no**.
- ⚠️ **Non vedo il disegno**: misuro tinte e posizioni, non guardo immagini.

---

## 9 · Cosa abbiamo rovesciato

**Uno**, ed è il n. 25 in [`decisioni_rovesciate.md`](../decisioni_rovesciate.md):
il marrone non dice più «ci sono seduti adesso».

⚠️ Il verde e il terracotta **non sono rovesciamenti**: il verde era stato
scelto per la fascia di mezzo senza una ragione dichiarata, e il doppio uso
del terracotta era **già dichiarato come accettato con una condizione** — che
la selezione fosse al massimo un tavolo. Quella condizione è caduta stamattina
col blocco 1, quindi non si rovescia una decisione: **si prende atto che il
suo presupposto non c'è più.**
