# La schermata che commuta — blocco 2 dei preventivi

**Nessuna migrazione**: al database non serviva niente, i numeri c'erano già
tutti dal blocco 1.
**Schermate nuove**: `/calendario-eventi/preventivi` e
`…/preventivi/:id`, **titolare-only**.
**Mandato**: [`20260820_i_preventivi_per_gli_eventi.md`](../mandati/20260820_i_preventivi_per_gli_eventi.md).

---

## ⚠️ Cosa NON è verificato

1. 🔴 **Nessuna mano ha aperto la schermata**, e nessuna prova di questo
   progetto guarda un disegno: quello che è provato sono i numeri sotto.
2. ✅ **Il passaggio fra le due viste l'ha deciso Alessio: nessuna
   protezione.** Vedi sotto — restano due cose che non sono protezioni.
3. ⚠️ **In produzione non ci sono ricette**, quindi l'elenco dei piatti da
   aggiungere è vuoto e il costo è zero: la schermata non ha mai incontrato
   dati veri.
4. ⚠️ **Il PDF, la mail e WhatsApp non ci sono**: sono il blocco 3.

---

## Cosa abbiamo rovesciato

**Nessun rovesciamento.**

---

## 🔴 Una sola schermata, due viste

È il motivo per cui Alessio l'ha chiesta così: **gli stessi dati, letti dagli
stessi numeri del database**, mostrati in due modi. Non due schermate che
possono divergere.

### La vista del cliente

Il menu concordato, gli extra col loro prezzo, **il prezzo a persona e il
totale**. E basta.

🔴 **Non compare nessun costo, nessuna percentuale, e nemmeno la parola «food
cost»** — richiesta esplicita: *al cliente si mostra il prezzo, non come è
stato costruito*. La frase che il database restituisce ad Alessio («10,00 € di
cibo diventano 40,00 €») **in questa vista non si scrive**.

⚠️ **E se il prezzo non c'è ancora, si dice** invece di scrivere zero: *«Il
prezzo non è ancora stato deciso»*. Uno zero davanti a un cliente si legge
«gratis».

### La vista di Alessio

Costo del cibo, costo a persona, extra, prezzo proposto; le **porzioni
dell'evento** modificabili riga per riga; gli extra da aggiungere; e **cosa
serve comprare**, con lo stesso conto che il magazzino usa per scaricare.

⚠️ **L'avvertenza esce dal database**, non è scritta nella schermata: così la
regola del ricarico sul solo cibo non può divergere fra le due.

⚠️ **Sotto le porzioni c'è la riga che dice il dubbio**: *«1 = come in carta.
Cambiarlo qui non tocca la ricetta.»* — dove sta il dubbio, non in cima alla
pagina.

---

## 🔴 Il passaggio fra le due viste: nessuna protezione

**Deciso da Alessio**: *«mi sembra un eccesso di prudenza. Basterà qualcosa di
generico che mi consenta di switchare da una schermata all'altra»*. Via la
conferma, niente PIN, niente tenere premuto — **un comando semplice**.

⚠️ **Ma due cose restano, e non sono protezioni: sono il modo in cui il comando
è fatto.**

**1 · Il comando è NEUTRO a schermo.** Le due parole sono «Per il cliente» e
«Per me»: dicono **quale vista è attiva**, non cosa contiene l'altra. Niente
«vedi i costi», niente «food cost» — quel comando sta sulla schermata che
Alessio apre **davanti al cliente**, e una parola del genere *si legge anche
senza toccarla*.

**2 · La vista del cliente è quella di PARTENZA, sempre**, anche riaprendo il
preventivo di ieri. ⚠️ *Non è prudenza: è il valore iniziale giusto.* Se la
schermata ricordasse l'ultima vista usata, un preventivo riaperto davanti a un
ospite si aprirebbe **sui costi**. Nel codice non c'è nessuna memoria — niente
`localStorage`, niente parametro nell'indirizzo — **ed è scritto che è
deliberato**, così nessuno lo aggiunge fra sei mesi credendo di fare una
comodità.

⚠️ **Nessuna prova è caduta con la decisione**: la conferma non era asseritata
da nessuna parte — era un gesto della schermata, e in questo progetto nessuna
prova guarda una schermata. Non c'è quindi niente da togliere né da lasciare
rosso, ed è dichiarato qui perché la domanda era legittima.

---

## Un difetto che ho riscritto io, e corretto subito

🔴 Creando un preventivo nuovo avevo scritto
`new Date().toISOString().slice(0, 10)` — **la data UTC**, che fra mezzanotte
e le due restituisce **ieri**.

⚠️ È la trappola dell'audit dell'08/08, corretta in 14 punti, con la funzione
giusta (`oggiLocale()`) che esiste da allora. **L'ho riaperta in un posto
nuovo**, esattamente come era successo il 17/08 in uno script di servizio.
*Una trappola scritta non è una trappola chiusa* — e stavolta l'ho trovata
rileggendo il file appena scritto, prima che uscisse.

---

## Il nome del piatto arriva insieme alle righe

Non con una seconda interrogazione: due letture che si incontrano nel browser
possono raccontare stati diversi.

⚠️ **E c'è una prova, per come fallirebbe**: se l'incorporamento smettesse di
funzionare **non ci sarebbe nessun errore rosso** — comparirebbe un trattino
su ogni riga, cioè una schermata che dice con calma che il menu è vuoto. È la
stessa forma del difetto del 18/08 sulle prenotazioni senza tavolo.

---

## Le prove

**9 prove col token di un utente vero** sul file dei preventivi — 152 pure +
**254** sull'app in tutto.

⚠️ **Quello che le prove NON coprono qui è il disegno**: che la vista del
cliente non mostri i costi è vero **perché quel componente non li riceve
nemmeno** — ma nessuna prova lo guarda. È il limite strutturale di questo
progetto, e su questa schermata pesa più del solito.

---

## Per Alessio, in una riga

Il preventivo si compila da una schermata sola: «Per il cliente» mostra il menu
e il prezzo, «Per me» mostra i costi, le porzioni e cosa comprare — si passa
da una all'altra con un tocco, e aprendo un preventivo si comincia sempre da
quella del cliente.

---

**Nessuna migrazione**: il blocco è tutto nelle schermate.
