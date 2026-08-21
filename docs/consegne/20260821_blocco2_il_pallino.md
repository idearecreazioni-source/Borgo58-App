# Blocco 2 — la striscia esce dalle pagine dei clienti e diventa un pallino

**21/08/2026** · **nessuna migrazione**.

---

## 1 · Il difetto, raccontato per quello che è

Aprendo `/prenota` — il modulo con cui **un cliente prenota un tavolo** — in
cima campeggiava:

> **DATI VERI** — quello che scrivi qui conta davvero.

⚠️ **Ed era voluto**: il commento in `App.jsx` diceva *«vale anche sulle
Comande e sulla pagina pubblica, che il Layout non lo usano»*. La ragione era
buona; **il destinatario era sbagliato**.

⚠️ **Precisazione sull'identificativo del progetto**, perché il difetto vada
raccontato giusto: `oudjuqbqszisdtwzbxdo` **non era stampato a schermo** —
sta nell'attributo `title`, cioè si vede solo passandoci sopra col mouse. Era
già stato tolto dal testo visibile il 17/08. **Il difetto resta**, ma è la
frase, non la sigla.

---

## 2 · La cura, e dove vive la regola

L'elenco delle pagine che vedono i clienti sta in **`src/lib/ambiente.js`**,
non dentro il segnale: *«questa pagina la vede un cliente?»* è una domanda che
tornerà, e il posto per cercarla dev'essere uno solo. **7 prove.**

⚠️ **La pagina di accesso NON è nell'elenco**, ed è voluto: chi digita il PIN
sta per scrivere nel gestionale, ed è il momento in cui sapere su quale
database si entra conta di più.

⚠️ **Il confine è controllato**: `/prenotazioni` non è `/prenota`. Senza,
una schermata interna erediterebbe il silenzio di una pubblica — e la prova
lo verifica.

**Rotta apposta** (elenco svuotato): **4 prove rosse**.

---

## 3 · Il pallino, e la condizione che resta intera

Striscia in cima → **pallino 16×16 fisso in basso a destra**.

🔴 **La condizione non negoziabile è rispettata per costruzione**: nel
componente esiste **un solo `return null`**, ed è quello delle pagine dei
clienti. **Nei tre stati il pallino c'è sempre** — cambiano solo il colore e
le parole del suggerimento.

| stato | colore |
|---|---|
| produzione | scuro (`b58-charcoal`) |
| prova | terracotta |
| sconosciuto | oro |

⚠️ **Lo sconosciuto ha preso un colore suo.** Prima era terracotta come la
prova: due stati diversi con lo stesso colore sono un segno che non
discrimina, ed è precisamente ciò che il 16/08 si è finito di correggere.

---

## 4 · 🔴 Cosa ho GUARDATO — la regola nuova, applicata

Non è dedotto dal codice: è misurato sulla schermata viva, col nuovo accesso
di collaudo, a 768 punti.

### Sulla pagina del cliente (`/prenota`)

| | |
|---|---|
| la pagina dice «DATI VERI»? | **no** |
| la pagina dice «DATABASE»? | **no** |
| il pallino c'è? | **assente** ✅ |
| come comincia la pagina | *«Richiedi un tavolo»* |

### Nel gestionale (`/comande`)

| | |
|---|---|
| pallino | **16×16**, `position: fixed`, **visibile** ✅ |
| dove | **12 punti da sotto**, 27 da destra (12 + la barra di scorrimento) |
| colore | `rgb(181, 80, 46)` — terracotta, cioè «prova» ✅ |
| cosa dice al passaggio del mouse | *«DATABASE DI PROVA — quello che scrivi qui non è vero… (progetto bnwqgpuyzmzujxfbtyvs)»* |
| la striscia c'è ancora? | **no** |

### E una verifica che non era chiesta

**Il pallino copre qualche comando?** Tolto di mezzo per un istante e chiesto
alla pagina cosa ci sia sotto: **il `main` e nient'altro**. Nessun pulsante
coperto.

⚠️ **Ma il pallino intercetta il tocco**, e va detto adesso: nel disegno delle
tre aree «invia comanda» e «chiudi conto» finiscono **in fondo**, dove sta il
pallino. **Da verificare in quel blocco.** Registrato anche nel rovesciamento
n. 23.

---

## 5 · Cosa non è verificato

- ⚠️ **Lo stato «produzione» non l'ho visto**: per vederlo dovrei puntare il
  gestionale al database vero, e stasera non lo tocco. Che ci sia è garantito
  dal codice (un solo `return null`), non da un occhio.
- ⚠️ **Non vedo il disegno**: so che il pallino è largo 16, in quel punto, di
  quel colore. **Non so se a Alessio "si vede bene"** — è una delle due
  domande che restano sue.
- ⚠️ **Il suggerimento al tocco su un tablet**: `title` funziona col mouse.
  Su un tablet un tocco prolungato di solito lo mostra, **ma non l'ho
  provato** e non ho un dito vero.

---

## 6 · Cosa abbiamo rovesciato

**Due cose, entrambe scritte in [`decisioni_rovesciate.md`](../decisioni_rovesciate.md)
ai numeri 23 e 24.**

- **n. 23 — la striscia non è più una striscia.** ⚠️ La ragione del 16/08
  vale **intera, e non è il prezzo: è il vincolo**. Il pallino non sparisce
  mai e ha sempre la stessa forma, perché serve accorgersi *quando cambia*.
- **n. 24 — il segnale esce dalle pagine dei clienti.** ⚠️ La ragione di
  allora («sta fuori dal Layout perché Comande e pagina pubblica non lo
  usano») **non era sbagliata: era incompleta.** Diceva *dove* mettere il
  segnale, non *chi lo legge*.
