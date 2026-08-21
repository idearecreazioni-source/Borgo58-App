# I nomi vanno a capo, e le categorie filtrano

**21/08/2026** · **nessuna migrazione**.

---

## 1 · Il vincolo di ieri sera era mio, e Alessio l'ha smontato

Avevo misurato che *«il nome di piatto più lungo è 245 punti, più largo
dell'intera colonna»* e ne avevo tratto un vincolo.

🔴 **Quel nome non esiste.** Il gestionale vero ha **zero ricette, zero menu,
zero voci di bar**: la larghezza veniva da nomi di prova, col prefisso
`BASE-` che i piatti veri non avranno.

> ⚠️ **La misura era giusta come metodo e priva di dati veri come contenuto.**
> È la stessa forma dei conteggi scritti a mano che questo progetto ha già
> corretto tre volte — ma spostata su una misura *appena fatta*, che sembrava
> quindi affidabile.

**E il vincolo si scioglie per una ragione che la misura non poteva vedere**,
ed è di Alessio: **le categorie filtrano**. Il menu è di una quindicina di
portate, ma con una categoria scelta ne restano tre o quattro per volta — non
una lista da scorrere. *Un nome su due righe costa **altezza**, e di altezza
ce n'è.*

---

## 2 · Fatto

### Le categorie filtrano

Prima erano intestazioni dentro una lista unica: per arrivare ai dolci si
scorreva tutto il menu. Adesso sono **pulsanti**, e si vede una portata per
volta.

⚠️ **«Tutte» resta ed è il valore di partenza**: chi non conosce ancora la
carta non deve dover scegliere per vedere.

⚠️ **La categoria non si ricorda fra un conto e l'altro**: chi apre un tavolo
nuovo comincia dagli antipasti, non da dove era rimasto.

⚠️ E **col filtro acceso il nome della categoria non si ripete** sopra
l'elenco: sarebbe la stessa parola due volte a due centimetri, che è il
difetto di «Sala» corretto stamattina.

### I nomi vanno a capo

La riga cresce in altezza quando serve. ⚠️ **La riga che lo rende possibile è
`min-w-0`**: dentro un contenitore flessibile un elemento non si stringe sotto
la larghezza del suo contenuto, quindi senza quella un nome lungo
**spingerebbe fuori il prezzo** invece di andare a capo.

⚠️ E funziona perché `.tocco-riga` fissa un'altezza **minima**, non fissa: il
target di tocco resta 1,05 cm e la riga può crescere.

---

## 3 · Le due misure chieste

Misurate **restringendo la colonna del menu a 241 punti**, che è lo spazio che
avrebbe accanto alla pianta.

### Quanti piatti restano visibili insieme?

| | |
|---|---|
| categoria scelta | Antipasto (3 piatti) |
| altezza di una riga | **44 punti** (con nome su 2 righe) |
| **quanti ci stanno insieme in 600 punti** | **13** |

✅ **I tre antipasti stanno tutti e tre insieme**, in 132 punti. Il mandato
chiedeva di dirlo se ne fossero stati **meno di tre**: ne stanno **tredici**.

⚠️ **E la misura è prudente**: i nomi provati hanno il prefisso `BASE-`, sei
caratteri che i piatti veri non avranno. Senza, molti starebbero su **una**
riga e ne entrerebbero di più. **44 punti è il caso peggiore.**

### Dove finisce il prezzo?

✅ **Accanto alla prima riga del nome**, in alto a destra — **non su una riga
sua**.

Misurato dentro la riga: nome e prezzo cominciano tutti e due a **y = 0**; il
nome occupa da x=8 a ~148, il prezzo parte da **x=156**, il «+» resta in
fondo.

⚠️ **È così perché il prezzo si allinea in alto** (`self-start`): centrato
sarebbe finito **in mezzo alle due righe**, cioè accanto a niente. L'ho
guardato e corretto lì.

---

## 4 · Cosa ho guardato

Col nuovo accesso di collaudo, a 768 punti, con un conto aperto su T4 e la
colonna del menu ristretta a 241:

| cosa | esito |
|---|---|
| i filtri delle categorie | ✅ Tutte · Antipasto · Primo · Secondo · Dolce |
| scegliendo «Antipasto» | ✅ restano i suoi 3 piatti |
| i nomi vanno a capo | ✅ **2 righe di testo**, riga alta 44 punti |
| il prezzo | ✅ accanto alla prima riga, non su una riga sua |
| il nome copre il prezzo? | ✅ no: si ferma a 148, il prezzo comincia a 156 |

**E il conto di prova è stato tolto.**

---

## 5 · Cosa NON è stato fatto, e perché

🔴 **La disposizione a due colonne** — menu a sinistra, pianta a destra — e il
**banco bar dentro la pianta**.

⚠️ **Non è una dimenticanza: è un lavoro più grosso di quanto sembri, e
fermarsi è la regola.** Nella schermata la pianta e il blocco del conto sono
due parti separate, e il blocco del conto contiene **anche** il riepilogo e i
pulsanti — che secondo il disegno devono finire in fondo, raggiunti con una
strisciata. Affiancarli vuol dire riorganizzare come la schermata è costruita,
non spostare un pezzo.

⚠️ **E il banco bar dipende da quella scelta**: vive **dentro** la pianta, e
se la pianta cambia larghezza va rifatto. Farlo adesso vorrebbe dire farlo due
volte.

✅ **Quello che è stato fatto adesso però serve comunque**: le categorie che
filtrano e i nomi a capo valgono in una colonna sola come in due, e sono
**quello che rende possibile** la colonna stretta. Senza, la disposizione a
due colonne non starebbe in piedi.

---

## 6 · Annotato per la coda, non fatto

🟡 **La barra di ricerca per la carta dei vini.** Alessio prevede che la carta
dei vini sia **più lunga del menu**, e propone una barra di ricerca.

⚠️ **Non costruita, per sua decisione**: prima vuole vedere come viene il
resto. Sta qui perché non si perda.

⚠️ **E una cosa da tenere presente quando si farà**: i vini hanno già una
**schermata separata** (§3.2.1: incolonnati nel menu lo allungavano troppo),
quindi la ricerca andrebbe lì e non nel menu dei piatti.

---

## 7 · Cosa non è verificato

- 🔴 **Nessuna mano ha toccato i filtri.** Ho verificato che ci siano, che
  filtrino e che i nomi vadano a capo — **non che siano comodi da premere in
  servizio**, che è un giudizio di Alessio.
- ⚠️ **I nomi provati sono di prova**: la misura è prudente (col prefisso), ma
  **come stanno i nomi veri lo si vedrà quando ci saranno le ricette vere**.
  In gestionale ce ne sono zero.
- ⚠️ **La colonna a 241 punti l'ho simulata**, non costruita: ho ristretto il
  contenitore per misurare. Quando le due colonne esisteranno davvero, la
  misura va rifatta.

---

## 8 · Cosa abbiamo rovesciato

**Una cosa mia di ieri sera, e va detta.**

- **Cosa avevo concluso**: che con 241 punti il menu non ci stesse, e che
  servisse una scelta fra tre strade con altrettanti prezzi.
- **La ragione di allora**: il nome di piatto più lungo misurava 245 punti.
- **Cosa si decide adesso**: i nomi vanno a capo, la pianta non si stringe.
- ⚠️ **Perché la ragione di allora non vale**: **quel nome era inventato**, e
  il vincolo si scioglie perché le categorie filtrano — una cosa che nel
  disegno c'era già e che la mia misura non aveva considerato. *Avevo misurato
  bene una schermata che non esiste.*

⚠️ **Non lo metto in `decisioni_rovesciate.md`**: quel registro raccoglie le
decisioni di prodotto rovesciate, e questa non era una decisione — era una
mia conclusione sbagliata, corretta prima di costruirci sopra.
