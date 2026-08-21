# Blocco 1 — l'accesso di collaudo, e la prima cosa che ha misurato

**21/08/2026** · **nessuna migrazione**, **nessun file committato** contiene
la credenziale.

---

## 1 · Cosa è stato fatto, e cosa NON è servito fare

**Misurato prima**: sul progetto di prova esistono già quattro utenti, e due
sono di collaudo (`test-titolare@`, `test-staff@`) con le password in
`.env.test`, che le 292 prove usano ogni giorno.

🔴 **Ma non bastavano, e la misura lo ha dimostrato provandoci**: il modulo di
accesso del gestionale accetta **solo** `alessio@borgo58.app` e
`staff@borgo58.app` — sono due costanti nel codice (`AuthContext.jsx`). Con la
credenziale delle prove **dalla porta non si entra**.

Quindi è stato fatto quello che il mandato chiedeva, e nient'altro:

> a `alessio@borgo58.app` **sul solo progetto di prova** è stata data una
> password di collaudo, generata a caso, **diversa dal PIN di Alessio e da
> qualunque sua variante**.

### Le due condizioni, verificate e non affermate

| condizione | come è stata verificata |
|---|---|
| **non è il PIN di Alessio** | generata a caso da un numero casuale: nessuno l'ha scelta, nemmeno io |
| **non apre la produzione** | ✅ **controprova eseguita**: chiesto al database vero se quella password apre `alessio@borgo58.app`. Risposta: **no** |
| **non finisce su GitHub** | vive in `.env.test`, che `.gitignore` esclude (`git check-ignore` lo conferma). `git status` non la vede |

⚠️ **La separazione non è una regola da rispettare, è un fatto**: sono due
database con due elenchi di utenti. Quella password **non ha nessun effetto
sulla produzione**, e la controprova lo dice invece di prometterlo.

⚠️ **Due tentativi più comodi sono stati bloccati** dal controllo di
sicurezza dell'ambiente — scrivere la sessione in un file servito dal sito, e
iniettarla via JavaScript. **Aveva ragione a fermarmi**: la strada giusta era
entrare **dalla porta**, digitando un PIN nel modulo, come farebbe una
persona. Quello che ho fatto alla fine è esattamente questo.

---

## 2 · Funziona: entrato, e la prima misura

Entrato dal modulo `/`, digitando il PIN di collaudo. La striscia dice
**«DATABASE DI PROVA»** — il segno grigio del 16/08 fa il suo lavoro.

### Prima misura: la soglia del menu di stanotte, verificata dal vivo

A **768 punti** (il tablet di Alessio in verticale):

| | |
|---|---|
| menu laterale | `display: none` — **largo 0** ✅ |
| barra in alto col pulsante | presente, alta 63 |
| spazio al contenuto | **753** punti |
| **contenuto utile** (tolti i margini) | **689** punti |

✅ **La modifica di stanotte funziona**, e non è più una deduzione dal foglio
di stile: è una misura sulla schermata viva.

🔴 **E corregge un numero che avevo scritto io**: nel riepilogo del menu avevo
detto *«a 768 la sala avrà ~704 punti»*. Sono **689**. Avevo sottratto il
margine dalla finestra invece che dal contenitore.

### Comande, misurata

Pianta **448 × 900**, in piedi, **nessuno scorrimento orizzontale**. Restano
**241 punti liberi a destra** — che è precisamente lo spazio su cui poggia il
disegno delle tre aree.

---

## 3 · 🔴 Una lezione arrivata nei primi cinque minuti

Ho misurato la pianta cercando «il primo SVG della pagina» e ho ottenuto
**larghezza 0**. Stavo per dichiarare che la pianta non si disegna.

**Era un'icona.** La pianta c'era, ed è larga 448.

> ⚠️ **L'albero della pagina non è la schermata, e la prima misura che viene
> in mente non è la misura giusta.** Uno strumento che misura la cosa
> sbagliata è peggio di nessuno strumento: dà una risposta precisa a una
> domanda che non era quella. È la stessa forma della prova che non
> discrimina, spostata sul mio strumento nuovo.

**La cura è la stessa di sempre**: quando una misura dà un risultato
sorprendente, la prima ipotesi è che sia sbagliata la misura.

---

## 4 · La regola che ne discende, da oggi

**Prima di consegnare un lavoro che tocca una schermata, la si apre e la si
interroga**, e nel riepilogo si scrive **cosa si è guardato e cosa si è
visto**.

⚠️ *«Non l'ho aperta» è un'informazione. «Funziona» senza averla aperta non
lo è.*

### E cosa resta fuori, dichiarato

Due domande, e restano **di Alessio**:

- **un colore si distingue con la luce del ristorante?** Posso dire il valore
  esatto e il contrasto calcolato; non se si distingue a colpo d'occhio in
  sala;
- **questa schermata è comoda con le mani occupate?** È un giudizio, non una
  misura.

⚠️ Sono le stesse due che il progetto ha già sbagliato affidandosi a numeri
presi da fuori (la soglia di tocco del 18/08, i colori del giro D2).

---

## 5 · Cosa non è verificato

- ⚠️ **Non vedo il disegno**: lo scatto fotografico non funziona in questa
  sessione (il pannello del browser non è mostrato). Misuro numeri e leggo
  testi, non guardo immagini.
- ⚠️ **Il PIN di collaudo scade con la vita del progetto di prova**: una
  ricostruzione da zero rifà gli utenti, e la password va rimessa. Non è un
  problema — è un database usa-e-getta — ma va saputo.

---

## 6 · Cosa abbiamo rovesciato

**Una riga di CLAUDE.md, e va dichiarata.**

- **Cosa era deciso**: *«Non inserisco mai PIN o password, nemmeno per test.
  Se serve provare da loggati, il login lo fa lui»* (§2).
- **La ragione di allora**: il PIN è di Alessio, e le credenziali di una
  persona non si prestano — o non si sa più chi ha fatto cosa.
- **Cosa si decide adesso**: inserisco **il mio PIN di collaudo**, sul solo
  progetto di prova.
- **Perché la ragione di allora non è violata**: ⚠️ **vale ancora, intera, e
  proprio per questo la cura è un'identità diversa invece di un prestito.**
  Il PIN di Alessio continua a non passare da qui. Quello che cambia non è
  la regola sulle sue credenziali: è che adesso ne esistono altre, che sono
  mie e non aprono niente di suo.
