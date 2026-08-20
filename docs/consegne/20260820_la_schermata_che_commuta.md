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
2. 🔴 **LA PROTEZIONE DEL PASSAGGIO AI COSTI È PROVVISORIA** e aspetta una
   decisione di Alessio. Vedi sotto — è la domanda in fondo.
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

## 🔴 Il passaggio ai costi è protetto, e le due direzioni NON sono simmetriche

Tornare alla vista del cliente è **libero**; andare ai costi passa da un
**gesto protetto**. È voluto: *il rischio è tutto da una parte.*

### ⚠️ Ma la protezione di adesso è PROVVISORIA, e la scelta è di Alessio

Oggi c'è una **conferma esplicita** («Mostrare i costi? Se hai il cliente
davanti, non farlo»). È sicura — **non si apre mai per sbaglio** — ma non è
la sua scelta: quel gesto lo farà lui, davanti a un cliente, e la protezione
va misurata **sul suo modo di lavorare**, non su quello che sembra
ragionevole a me.

✅ **E si sostituisce cambiando una funzione sola**: `chiediPermessoCosti`, in
cima al file. Il giorno che decide, si tocca lì e basta.

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

Il preventivo si compila da una schermata sola: «Per il cliente» mostra il
menu e il prezzo, «Per me» mostra i costi, le porzioni e cosa comprare — e per
passare ai costi devi confermare, così non ci finisci per sbaglio col cliente
davanti.

---

## 🔴 La domanda, in fondo perché è l'unica

**Come vuoi che si protegga il passaggio alla vista dei costi?**

Oggi c'è una finestrella che chiede conferma. Funziona, ma la scelta è tua
perché quel gesto lo farai tu, in piedi, con qualcuno davanti.

---

**Nessuna migrazione**: il blocco è tutto nelle schermate.
