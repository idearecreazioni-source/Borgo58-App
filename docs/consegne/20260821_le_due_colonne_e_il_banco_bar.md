# Le due colonne e il banco bar

**21/08/2026** · **nessuna migrazione**.

---

## 1 · 🔴 La misura che ha corretto la mia di ieri

Ieri sera avevo scritto: *«la pianta è 448 punti e ne restano 241 liberi a
destra»*, e ne avevo ricavato un vincolo.

**Misurato risalendo i contenitori: era sbagliato.** La schermata intera ha
un `max-w-md` — **448 punti** — che c'è da sempre, perché nasce come **una
colonna sola** per un tablet in verticale.

> 🔴 I 241 punti non erano *liberi a destra della pianta*: erano **margine
> vuoto ai lati della schermata**. La colonna del menu non ne avrebbe avuti
> 241 — ne avrebbe avuti **108**.

⚠️ *Una misura giusta su un numero sbagliato.* Avevo misurato la larghezza
del contenuto disponibile (689) e quella della pianta (448), e la differenza
sembrava spazio utile. Non lo era.

**La cura**: col conto aperto la larghezza massima si allarga, perché lì non
è una riga di testo da leggere ma **due pannelli affiancati**. Senza conto la
schermata torna stretta e centrata, com'era.

---

## 2 · Le due colonne

| | punti |
|---|---|
| contenuto utile | **689** |
| **pianta** (a destra) | **427** |
| **menu** (a sinistra) | **250** |
| spazio fra le due | 12 |

✅ **Il menu ha 250 punti**, più dei 241 che avevo stimato — e più del nome di
piatto più lungo misurato ieri (245), che comunque va a capo.

✅ **Nessuno scorrimento orizzontale.**

⚠️ **Le due colonne compaiono solo con un conto aperto**: senza, il menu non
esiste, e due colonne di cui una vuota sarebbero spazio buttato proprio nella
schermata che ne ha meno.

⚠️ **E la pianta non può scendere sotto la sua soglia**: il `min-width` in
centimetri veri vive dentro `PiantaSala` e vale anche qui. Se lo spazio non
bastasse, le due colonne tornerebbero una sopra l'altra invece di
rimpicciolire i tavoli.

### T4, rimisurato come chiesto

| | margine del badge dal bordo |
|---|---|
| pianta a 448 (prima) | **12 punti** |
| pianta a 427 (adesso) | **11 punti** |

✅ **Un punto in meno.** La pianta si è stretta del **5%**, non del 24% che
sarebbe servito scendendo alla soglia minima.

---

## 3 · Il banco bar

Dentro la pianta, nella zona **«Bancone»** del fondale.

⚠️ **Zona diversa da quella del pannello del Calendario** (cucina e servizi),
e non per caso: in Comande la pianta è **girata**, quindi cucina e servizi
stanno in cima — **lontano dal pollice** di chi tiene il tablet. Il bancone
sta in fondo a destra, dove il dito arriva senza spostare la presa.

**La geometria non è stata riscritta**: `riquadroDelPannello` e
`pannelloNellaPianta` esistono dal giro D3 e adesso accettano **quali zone**
come parametro. ⚠️ *Il codice è lo stesso, la scelta delle zone no* — che è
il discriminante del 17/08: due cose che direbbero esattamente la stessa cosa
si fondono, e qui la geometria la dice.

**Ereditato gratis dal meccanismo che c'era già**: il pannello **si toglie da
solo** se un tavolo finisse in quella zona. *Un tavolo nascosto sotto un
pannello non si vede che manca.*

### Cosa mostra

| il tavolo toccato | il banco bar |
|---|---|
| prenotato | ora, persone e **nome** |
| con due turni | **tutti e due**, con l'ora |
| libero | **niente** |

⚠️ **L'ambiguità si dichiara, non si risolve indovinando**: con due
prenotazioni si mostrano entrambe. Sceglierne una vorrebbe dire decidere al
posto di chi ha il cliente davanti.

⚠️ **Su tavolo libero niente, non un riquadro vuoto**: un pannello che dice
«nessuno» occupa lo stesso spazio di uno che dice qualcosa.

---

## 4 · Cosa ho guardato

Sul progetto di prova, a 768 punti, con un conto aperto e un tavolo
prenotato:

| cosa | esito |
|---|---|
| il menu è a sinistra della pianta | ✅ x=32 contro x=294 |
| le categorie sono sopra il menu | ✅ y=151 contro y=252 |
| larghezze | ✅ pianta **427**, menu **250** |
| scorrimento orizzontale | ✅ nessuno |
| **il banco bar con un nome** | ✅ *«19:45 · 2 — BASE-Nicosia»*, 224×104 punti |
| il banco bar è dentro la pianta | ✅ |
| scorre dentro se l'elenco è lungo | ✅ `overflow: auto` |
| su tavolo libero | ✅ **assente** |
| **badge di T4** | ✅ **11 punti** (era 12) |

**E i conti di prova sono stati tolti.**

---

## 5 · 🔴 Un difetto che solo aprire la schermata poteva trovare

Estraendo il menu in una variabile l'avevo messo **prima** dei dati che usa.

**Lint pulito. Build riuscita.** E la schermata **completamente bianca**:

```
ReferenceError: Cannot access 'menuByCategory' before initialization
```

> ⚠️ È la **terza volta in due giorni** che una cosa passa lint e build e si
> rompe soltanto a schermo — dopo la lista della spesa e l'import mancante di
> ieri. **La differenza è che stavolta l'ho trovato io in trenta secondi**,
> invece di consegnarlo e aspettare che lo trovasse Alessio.

---

## 6 · Cosa NON è stato fatto

⚠️ **Il riepilogo e i pulsanti restano dove sono**, in fondo alla colonna
sotto le due. Il mandato li vuole «non fissi, raggiunti con una strisciata»:
**oggi è già così** — non sono fissi e si raggiungono scorrendo. Non ho
costruito nessuna strisciata perché non ce n'è bisogno: quello che il disegno
chiede è già il comportamento.

⚠️ **Non ho toccato la fascia in alto**: il mandato del giro precedente
diceva «le informazioni che ci sono già, ridistribuite meglio», e con le due
colonne quella ridistribuzione va ripensata guardando la schermata nuova.
**Da fare dopo che Alessio l'ha vista.**

---

## 7 · Cosa non è verificato

- 🔴 **Nessuna mano ha toccato le due colonne sul tablet.** So le larghezze;
  **non so se il menu a 250 punti è comodo** con le mani occupate.
- ⚠️ **Il banco bar con un elenco lungo non l'ho visto scorrere**: ha
  `overflow: auto` e la misura lo conferma, ma servirebbe un tavolo con tre o
  quattro turni.
- ⚠️ **Il caso «schermo stretto»** (telefono sotto 640 punti) non l'ho
  guardato: lì le colonne tornano una sopra l'altra per costruzione, ma non
  l'ho verificato.

---

## 8 · Cosa abbiamo rovesciato

**Uno, ed è mio.**

- **Cosa avevo concluso** (ieri sera): che restassero 241 punti liberi a
  destra della pianta.
- **La ragione di allora**: la differenza fra il contenuto utile (689) e la
  pianta (448).
- **Cosa si misura adesso**: quei 241 erano **margine vuoto ai lati**, non
  spazio utilizzabile. Col limite di larghezza in mezzo, la colonna avrebbe
  avuto **108 punti**.
- ⚠️ **Perché la ragione di allora non valeva**: avevo misurato due larghezze
  vere e sottratto, senza chiedermi **cosa ci fosse in mezzo**. C'era un
  `max-w-md` che nessuna delle due misure mostrava.

⚠️ **Non va in `decisioni_rovesciate.md`**: non era una decisione di prodotto,
era una mia conclusione — corretta prima di costruirci sopra, come quella dei
nomi dei piatti.
