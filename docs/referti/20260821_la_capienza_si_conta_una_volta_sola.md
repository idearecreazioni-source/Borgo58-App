# La capienza si conta una volta sola — misura, senza cura

**21/08/2026** · Code → validatore e Alessio

🔴 **Difetto trovato dalle mani di Alessio al collaudo**, il quarto della
notte e il più serio. **Questo documento è solo la misura**: non è stato
scritto nessun codice, come chiesto — *«non è una cosa da chiudere all'una di
notte con una toppa»*.

---

## Il difetto in una frase

Il conto dei posti si fa **una volta sola, dentro `accetta_preventivo`**, e
non si rifà **mai più**. Se dopo cambia qualcosa — quante persone vengono, o
che giorno — la spunta «sala piena» resta com'era.

---

## 1 · Le strade che cambiano una prenotazione già confermata

Misurate sul database vero e sul codice, non dedotte.

| strada | cambia persone / data? | il conto si rifà? |
|---|---|---|
| `accetta_preventivo` (accettazione, e accettazione di una **versione**) | ✅ tutte e due | ✅ **sì** |
| `updateReservation` — la scheda della prenotazione (`ReservationForm.jsx:172`) | ✅ tutte e due | 🔴 **no** |
| `salva_preventivo` — correggere un preventivo **già accettato** | 🔴 **non tocca affatto la cena** | — |
| `annulla_prenotazione` | no | ✅ (il trigger dell'annullamento) |
| `assegna_prenotazione`, `crea_prenotazione_su_tavoli`, `merge_customers`, `submit_public_reservation` | no | — |

⚠️ **E i trigger su `reservations` sono sei**: annullamento, cliente
collegato, avviso Telegram, orario sulla griglia, email di conferma,
`updated_at`. **Della capienza, nessuno.**

🔴 **La terza riga è quella che nessuno si aspetta**: correggere le persone su
un preventivo accettato **non aggiorna la cena in calendario**. Il preventivo
dice 34 e la sala continua ad aspettarne 10, senza che niente lo segnali.

---

## 2 · I tre casi, misurati costruendoli

Su una sala da 34 coperti, con un evento accettato che la riempie.

| | cosa succede | com'è | come dovrebbe essere |
|---|---|---|---|
| **A** · si accetta l'evento da 34 | spunta accesa | ✅ **1** | 1 |
| **B** · l'evento **si rimpicciolisce** a 2 persone | spunta | 🔴 **resta 1** | 0 |
| **C** · l'evento **si sposta** al giorno dopo | giorno vecchio | 🔴 **resta 1** | 0 |
| | giorno nuovo | 🔴 **0** | 1 |

⚠️ **Il caso C è doppio, e il secondo verso è il peggiore**: non solo blocca
un giorno che si è liberato — **lascia aperto un giorno che è pieno**, e lì si
prendono prenotazioni per una sera che non ha più posto.

🔴 **E il caso B non è di laboratorio**: *«il gruppo conferma per dieci e
diventa trentaquattro»* è il caso più comune della ristorazione, e il suo
inverso — trentaquattro che diventano dieci — costa **una serata intera di
sala bloccata per niente**.

---

## 3 · ⚠️ Questo NON è il prezzo dichiarato nel rovesciamento n. 21

Va detto perché la confusione sarebbe comoda e sbagliata.

Il **n. 21** dichiara un prezzo preciso: la **sottostima** dei tavoli — due
persone a un tavolo da sei lasciano quattro posti che non esistono. Lì il
conto è **giusto al momento in cui si fa**, e sbaglia per come è fatto.

**Qui il conto sarebbe esatto**: è fatto al momento sbagliato, e non rifatto
mai più. Sono due difetti diversi, e **il secondo non è dichiarato da nessuna
parte** — né nel registro dei rovesciamenti, né nel riepilogo del blocco 4.

---

## 4 · La seconda faccia: Alessio non ha nessun gesto per rimediare

A preventivo accettato la schermata sostituisce **«Il cliente ha accettato»**
con **«L'evento è in calendario»**. Non esiste nessun comando per far
ricontare i posti, e nessuna schermata dice che il conto è vecchio.

⚠️ Quindi oggi, anche accorgendosene, **l'unica strada è togliere e rimettere
la spunta a mano** — che è possibile, ma nessuno sa che serve.

---

## 5 · Cosa NON è rotto, e va scritto

- ✅ **La cena resta UNA e si aggiorna**: accettando una versione non nasce un
  secondo evento. Verificato in produzione dal validatore in tutte e due le
  metà (10 persone → 20 persone, sempre una sola cena);
- ✅ **il vincolo sui preventivi accettati regge**: un preventivo con un evento
  in calendario non si cancella, e il messaggio dice cosa fare prima;
- ✅ **l'avviso dei 25 coperti compare**, e dice di essere un avviso e non un
  divieto;
- ✅ **la regola della capienza è giusta quando viene applicata**: 10 persone su
  34 non bloccano la sala, 34 sì.

---

## 6 · Le tre strade possibili, e perché non ne ho scelta nessuna

⚠️ **Nessuna è una toppa, e nessuna è gratis.** La scelta è di Alessio.

**(a) Un trigger su `reservations` che ricalcola a ogni modifica.**
Chiude tutti e tre i casi, compreso quello che nessuno ha ancora immaginato.
🔴 **Ma tocca ogni prenotazione, non solo gli eventi**: da quel momento la
spunta «sala piena» si accenderebbe **da sola** anche per le prenotazioni
normali che riempiono la sala. È un **cambiamento di comportamento della
sala**, non una correzione — e va deciso, non fatto di notte.

**(b) Ricalcolare solo dove la cena nasce da un preventivo.**
Più stretto e più prudente: il difetto misurato sparisce, e le prenotazioni
normali restano come sono. ⚠️ Ma lascia in piedi il caso in cui la sala si
riempie **senza** un evento, che oggi è già così — quindi non peggiora niente.

**(c) Non ricalcolare, ma DIRLO.**
La schermata dell'evento mostra «il conto dei posti è di quando hai accettato:
ricontrolla», con il gesto per rifarlo. ⚠️ È la strada più fedele al modo in
cui questo gestionale tratta la sala dal 14/08 — *il sistema non decide se un
gruppo entra, lo decide Alessio* — e **non fa scattare niente da solo**.

---

## Cosa NON è verificato

- **Non è stato scritto nessun codice**: questo documento è la misura;
- **il caso della data l'ho costruito sul progetto di prova**, non osservato in
  produzione: là l'evento del 26/08 non è mai stato spostato;
- **non ho misurato cosa succede alle prenotazioni normali** con la strada (a):
  è la domanda che deciderebbe fra (a) e (b), e va fatta prima di scegliere.
