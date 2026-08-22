# Il primo giro — le otto dove un gesto che cancella stava attaccato al vicino

**Mandato**: la frase della pagina pubblica **subito**, poi il primo giro
delle otto schermate. **Nessuna migrazione.**
Tutto misurato a **800 × 1280**, calibrazione **74**, aprendo ogni schermata.

---

## 0 · La frase pubblica — fatta e basta

**`/prenota`**: mentre cercava gli orari diceva *«Cerco i posti liberi…»*, e
il calcolo dei posti liberi **non esiste dal 14/08** (`posti_liberi()` e
`dining_tables.seats` rimossi con la pianta viva). Adesso dice *«Cerco gli
orari disponibili…»*, che è quello che fa davvero.

⚠️ Era l'unica frase diventata falsa che **leggono i clienti**: prometteva un
conteggio di posti che nessuno fa più. Commit a sé, fuori da ogni giro.

---

## 1 · Le otto, prima e dopo

| schermata | testo | bersaglio | gesti pericolosi vicini |
|---|---|---|---|
| **`/personale/mance`** | 1,49 → **3,20** | 2,70 → **8,50** | **0,54 → 5,00** |
| **`/magazzino/scadenze`** | 1,89 → **3,20** | 2,30 → **8,50** | **1,08 → 5,00** |
| **`/cassa`** | 1,49 → **3,20** | 2,16 → **8,50** | 1,08 → *(vedi §4)* |
| **`/cassa/prima-nota`** | 1,49 → **3,20** | 2,70 → **8,50** | **2,30 → 13,80** |
| **`/fatture-fornitori`** | 1,49 → **3,20** | 2,16 → **8,50** | **1,62 → 5,00** |
| **`/magazzino/lista-spesa`** | 1,49 → **3,20** | 2,16 → **8,50** | **1,62 → 5,00** |
| **`/fiscale/previsioni`** | 1,62 → **3,20** | 2,16 → **8,50** | **1,62 → 5,00** |
| **`/agenda`** | 1,35 → **3,20** | 2,03 → **8,50** | 1,62 → *(vedi §4)* |

**Otto su otto**: testo e bersagli ai criteri. **Sei su otto** hanno anche la
distanza; le altre due non ne avevano bisogno, ed è §4.

---

## 2 · 🔴 «Buttata» e «finita»: la distanza non bastava

Il mandato aveva ragione a insistere. Due parole corte, che si somigliano, e
fanno cose opposte: **«finita» toglie dalla giacenza; «buttata» toglie E
scrive nel registro HACCP** che un'ispezione guarda. Allontanarle di 5 mm non
le rende distinguibili con la coda dell'occhio.

**Adesso ognuna dice la sua conseguenza sotto il verbo:**

```
┌──────────────────────┐    ┌──────────────────────────┐
│ Finita               │    │ Buttata                  │  ← rosso, bordo doppio
│ usata, esce e basta  │    │ va nel registro HACCP    │
└──────────────────────┘    └──────────────────────────┘
        ← 5 mm veri →
```

⚠️ **E la spiegazione è entrata NEL gesto**, che è la regola del 18/08: sopra
c'era un paragrafo che spiegava la differenza, e un paragrafo si legge una
volta e poi diventa arredamento. **Quel paragrafo è stato tolto**, tranne la
riga che è un **avviso** e non una spiegazione — *«non si chiede conferma e
non si torna indietro»* — perché quella non è scritta da nessun'altra parte.

⚠️ **Il gesto resta senza conferma**, per decisione di Alessio del 13/08:
proprio per questo le parole devono bastare da sole.

---

## 3 · Le altre parole

- **`/fatture-fornitori`**: il tasto del pagamento diceva **«Annulla»**
  quando il modulo era aperto, a 1,62 mm da **«Rimuovi»**, che *cancella la
  fattura*. Due parole che in italiano possono voler dire la stessa cosa, e
  una delle due la cancella davvero. Adesso dice **«Lascia perdere»**.
- ✅ Nessun «Chiudi» solitario è ricomparso.

---

## 4 · Le due distanze rimaste — e sono un difetto della MIA misura

Il censimento di stamattina segnalava otto coppie pericolose. **Due non lo
erano**, e l'ho scoperto solo andando a guardare cosa fanno quei pulsanti:

- **`/cassa` — «Incassato e scontrinato» / «Comande» a 1,08 mm**: sono due
  **riquadri di navigazione**, non gesti. Il peggio che può succedere è
  aprire la pagina sbagliata. Il mio setaccio le aveva prese perché il nome
  contiene *«incass»*.
- **`/agenda` — «Pagare fattura…» / «★» a 1,62 mm**: il primo è **il titolo
  di un impegno**, cioè una frase che ha scritto Alessio; il secondo è la
  stella «per me conta». Nessuno dei due cancella niente.

⚠️ **La lezione**: il setaccio legge **l'etichetta**, e un impegno che si
chiama «Pagare fattura» sembra un gesto di pagamento. *Un censimento
automatico dice dove guardare, non cosa è vero* — e le due volte che l'ho
preso per buono avrei allontanato pulsanti che non ne avevano bisogno.

---

## 5 · Com'è stato fatto, e i tre difetti miei per strada

Le taglie si sono spostate sulle classi in centimetri veri (`testo-sala`,
`tocco-bottone`), e la distanza dei gesti pericolosi è una **classe nuova**:

```css
.gesti-pericolosi { display: flex; align-items: center; gap: calc(var(--pxcm) * 0.5); }
```

⚠️ **Sta in `index.css` e non in ogni schermata perché è una regola, non uno
stile**: il giorno che si decide che 5 mm sono pochi, si cambia in un posto
solo. E il nome dice **a cosa serve**, così chi scrive una riga nuova con
dentro una cancellazione la trova cercando «pericolosi», non «gap».

**Tre cose che ho sbagliato, e che ha trovato la misura:**

1. **La classe di tocco finita su una `<ul>`** in Mance: la sostituzione
   automatica guardava indietro sei righe e ha trovato un `<button` che non
   c'entrava. *Una lista con l'altezza minima di un pulsante.*
2. **Due volte un commento JSX come primo figlio di `{condizione && (`** —
   che non è codice valido. La compilazione l'ha preso subito tutte e due le
   volte.
3. **Il testo senza classe restava a 2,16 mm**: eredita i 16 punti del
   browser, e nessuna sostituzione poteva vederlo perché **non c'era niente
   da sostituire**. Risolto mettendo la taglia sulla **radice** di ogni
   schermata: quello che non ha una classe propria parte già giusto.

⚠️ **E il punto 3 è quello che vale per il resto del lavoro**: le altre 58
schermate hanno lo stesso problema di fondo, e la radice è il modo per
chiuderlo in una riga per schermata invece che in cinquanta.

---

## ⚠️ Cosa NON è verificato

1. 🔴 **Non l'ha visto un occhio**: sono misure prese interrogando la pagina.
   Se «Finita / usata, esce e basta» su due righe *si legga meglio* di
   «finita» da solo, lo dice una mano.
2. ⚠️ **Le schermate le ho guardate come si presentano**: i moduli che si
   aprono dentro (registrazione di un movimento, pagamento di una fattura)
   non sono stati misurati riga per riga.
3. ⚠️ **Le liste erano quasi vuote**: sul progetto di prova ci sono poche
   righe, e la distanza fra due «Rimuovi» di righe adiacenti l'ho misurata
   dove le righe c'erano (mance, prima nota). Con venti fatture la geometria
   è la stessa, ma non l'ho vista.
4. ⚠️ **`/cassa` e `/agenda` restano sotto i 5 mm** per le due coppie del §4:
   **non le ho toccate**, perché non sono gesti pericolosi. Se Alessio
   preferisce comunque distanziarle, è un ritocco di un minuto.

---

## Cosa abbiamo rovesciato

**Uno, piccolo e dichiarato**: in `/magazzino/scadenze` il paragrafo che
spiegava «finita» e «buttata» è stato **tolto**, e la spiegazione è entrata
dentro i due pulsanti.

- **cosa era stato deciso**: 13/08, la differenza fra i due gesti si spiega
  in una riga sotto il titolo, *«che è dove si legge davvero»*;
- **la ragione di allora**: il gesto non chiede conferma, quindi la
  differenza va detta;
- **cosa si decide adesso**: la differenza la dicono **i pulsanti stessi**;
- **perché la ragione di allora non vale più — ⚠️ e in realtà vale ancora,
  ed è per questo che il cambiamento è questo e non «togliere»**: la
  differenza *deve* essere detta, e adesso è detta **più vicino al dito**.
  Quello che è stato tolto è la ripetizione, non l'informazione. La riga
  sull'irreversibilità è rimasta dov'era.

---

## 6 · Cosa ho guardato

Aperte tutte e otto, una per una, prima e dopo. In `/cassa` e `/agenda` ho
anche **guardato cosa fanno** i due pulsanti segnalati, invece di fidarmi del
setaccio — ed è così che ho scoperto che erano falsi allarmi.

**Suite**: 258 prove pure, 303 sui dati veri. Tutte verdi.

**Restano** i due giri successivi del referto di stamattina: le schermate che
si usano con le mani (≈12) e il resto (≈45), che aspetta le crocette di
Alessio su cosa si guarda solo dal computer.
