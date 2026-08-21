# Le rifiniture della tavolozza — il rosso e i badge

**21/08/2026** · dopo il collaudo di Alessio sul tablet. **Nessuna
migrazione.**

---

## 1 · Il rosso dell'ultimo turno

**`#BD301B`**, scelto da Alessio guardando il tablet in sala.

### La misura del validatore, verificata

| | ΔE |
|---|---|
| dall'ambra `#bf7536` | **33,8** ✅ |
| dall'oro `#c99a3d` | **52,9** ✅ |
| coppia più vicina di tutta la sala | **panna / crema scuro a 11,1** — c'era già ✅ |

Tutte e tre confermate.

### 🔴 E NON HO TOCCATO IL TERRACOTTA

Il mandato lo chiedeva, e la misura ha confermato che serviva: la fascia
usava `--color-b58-terracotta`, **il colore identitario del progetto** —
pulsanti, accenti, logo, in tutta l'app. Cambiarlo lì avrebbe ridipinto il
gestionale intero per una decisione presa su un tavolo.

Adesso la fascia ha **una variabile sua**: `--color-b58-turno`. ⚠️ *È lo
stesso doppio uso che questa revisione sta smontando: un colore, una cosa
sola.*

### La domanda che il mandato chiedeva di verificare — e la risposta

**Il rosso nuovo dista 17,5 dal terracotta del marchio.** Sopra la soglia,
ma è la distanza più stretta fra due colori che possono comparire insieme.

🔴 **E ho trovato un punto dove la distanza non è "vicina": è ZERO.**
Il **pallino pieno** è terracotta, e sta **sopra** il tavolo. Su un tavolo in
ultimo turno sarebbe terracotta su rosso, **a contatto diretto**.

✅ **Risolto senza dover misurare caso per caso**: il badge ha un **anello
color panna** che lo stacca da *qualunque* fondo — rosso, ambra, marrone,
bianco. ⚠️ **Il problema non si fa esistere invece di essere gestito**, ed è
anche come sono fatte le notifiche che Alessio aveva in mente.

⚠️ **Resta la domanda di Alessio**: se il rosso si distingue dall'ambra
dall'altro capo della sala, con la luce vera. Quella la prova lui.

---

## 2 · I badge

Più grandi (raggio 15 invece di 11), **sovrapposti all'angolo** in alto a
destra invece che disegnati dentro, con l'anello chiaro.

### 🔴 Un tavolone, un badge solo — regola di Alessio

Su T7·T8·T9 accostati, tre badge direbbero «tre cose da fare» dove ce n'è
**una**: il conto è uno, e il gesto che manca è uno.

⚠️ **Lo porta il tavolo più in alto a destra del gruppo**, scelto
confrontando le posizioni — **non l'ordine in cui i tavoli arrivano**:
quell'ordine lo decide il database e sposterebbe il badge senza che nessuno
l'abbia mosso.

✅ **Verificato dal vivo**: aperto un conto su **T5**, che sta nel tavolone
T5·T6. **Un solo badge, su T6.** ⚠️ E il badge sta sul tavolo che *non* ha il
conto — è corretto, perché il conto è del tavolone.

### I due gradi restano

**contorno** = conto aperto e niente ordinato, devo tornare · **pieno** =
piatti segnati e mai partiti, devo mandare.

---

## 3 · La misura chiesta: i badge sui bordi

Costruita una scena apposta sul progetto di prova — conti su **T4** e **T1**
(in alto) e sulla **Chef Table** (in basso), più una prenotazione alle 22:15
per far comparire il rosso.

**Pianta larga 448 punti. Nessun badge sborda.**

| badge | fondo | grado | da sinistra | da sopra | da destra | da sotto |
|---|---|---|---|---|---|---|
| **T4** | bianco | contorno | **12** ← il più stretto | 38 | 419 | 845 |
| **T1** | ambra | contorno | 129 | 38 | 301 | 845 |
| **T6** | **rosso** | **PIENO** | 325 | 268 | 106 | 615 |
| **Chef Table** | crema scuro | contorno | 334 | 790 | 97 | **93** |

✅ **Il margine minimo è 12 punti**, su T4 a sinistra. Stretto ma **dentro**.

✅ **Non ho dovuto rimpicciolire niente**: la pianta è rimasta a 448 punti,
sopra la larghezza minima che la tiene toccabile. La soglia non è stata
toccata.

⚠️ **Il caso peggiore possibile è T4**, che è il tavolo più in alto a
sinistra: 12 punti di margine. Se un domani un tavolo venisse spostato più
verso il bordo, quel margine si assottiglierebbe. **Non è protetto da niente**
— oggi sta dentro, e l'ho misurato invece di sperarlo.

---

## 4 · Cosa ho guardato — l'elenco

Col nuovo accesso di collaudo, a 768 punti, sul progetto di prova:

| cosa | esito |
|---|---|
| **le tre fasce insieme** | ✅ T3 **oro**, T1·T2 **ambra**, T5·T6 **rosso** |
| il rosso è la variabile nuova | ✅ `turno`, non `terracotta` |
| badge **contorno** | ✅ su T4, T1, Chef Table |
| badge **pieno** | ✅ su T6, con una riga mai inviata |
| l'anello chiaro | ✅ `parchment` su tutti e quattro |
| **un tavolone → un badge** | ✅ conto su T5, badge solo su T6 |
| i badge sui bordi | ✅ tutti dentro, minimo 12 punti |

⚠️ **Il servizio era SPENTO sul progetto di prova** per venerdì, e senza le
fasce non si calcolano: tutto ricadeva su «ambra». L'ho acceso per guardare
**e rimesso spento dopo** — ⚠️ *una prova rimette lo stato, non lo cancella*
(lezione del 14/08). Verificato: `cena attiva: false`.

**E la scena è stata tolta**: 4 conti, la prenotazione di scena, tutto via.
**0 conti aperti, 0 scene.**

---

## 5 · 🔴 DA FARE, e non posso farlo io

**Alessio ha tre prenotazioni di prova sul gestionale VERO** — 20:00, 21:00 e
22:15 di venerdì 21/08 — create per giudicare i colori.

⚠️ **Vanno annullate da lui.** Se restano lì, domani i conti del gestionale
non tornano: sono prenotazioni confermate per una sera in cui non viene
nessuno, e il locale non è nemmeno aperto.

⚠️ **Non le tocco io**: sono righe sue sul database vero, e stasera il
database vero non si tocca.

---

## 6 · Cosa non è verificato

- 🔴 **Il rosso con la luce della sala.** So che dista 33,8 dall'ambra.
  **Non so se Alessio li distingue** dall'altro capo del locale.
- ⚠️ **Non vedo il disegno**: so che il badge è grande 20 punti di raggio, in
  quel punto, con quell'anello. **Non so se "sembra una notifica"** — è un
  giudizio.
- ⚠️ **Il caso «misto»** (due fasce sullo stesso tavolone) continua a non
  essere stato visto.
- ⚠️ **Il badge su un tavolone di TRE** (T7·T8·T9) non l'ho provato: ho
  verificato la regola su un tavolone di due. La regola è la stessa e non
  distingue, ma il caso a tre non è stato guardato.

---

## 7 · Cosa abbiamo rovesciato

**Niente**, e va spiegato perché nessuno dei due cambi lo è.

⚠️ **Il rosso non rovescia il terracotta**: il terracotta resta esattamente
dov'era, in tutta l'app. **Quello che cambia è che la fascia smette di
prenderlo in prestito** — cioè si chiude un doppio uso, che è il contrario di
rovesciare una decisione.

⚠️ **I badge non rovesciano i pallini**: sono gli stessi due gradi, con la
stessa forma e lo stesso significato, disegnati più grandi e in un punto
diverso. Il rovesciamento n. 25 (il marrone) resta l'unico di questa
revisione della tavolozza.
