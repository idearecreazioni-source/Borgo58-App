# Giro D3 — la sala si tocca in un gesto solo, e le prenotazioni si leggono

**Consegna del 18/08/2026.** Mandato [«La sala e le prenotazioni»](../mandati/20260818_la_sala_e_le_prenotazioni.md),
**punti 5 e 6** più i punti **3 e 4** del perimetro deciso per il giro D.
È **l'ultimo giro del mandato**: A, B, C, E, D1 e D2 sono chiusi e validati.

- **HEAD dichiarato**: `8222222`
- **Working tree**: pulito
- **Migrazione**: **nessuna** — nessun dato nuovo, solo dati già scritti che
  arrivano dove non arrivavano
- **Prove**: **107** pure (erano 102) + **174** sul progetto di prova (erano 172)
- **Lint**: zero avvisi · **Build**: ok
- **In produzione**: **niente da applicare**
- **Contratto**: non toccato · **Corridoio**: non ridistribuito

---

## ⚠️ Cosa NON è verificato

1. 🟡 **Nessuna mano ha toccato il giro C in condizioni di servizio vero** —
   le tre fasce e «da liberare entro le…» sono state guardate ferme, mai
   durante un servizio.
2. 🟡 **La mezzanotte in servizio non è mai capitata dal vivo.**
3. 🟡 **La domenica a pranzo non ha prenotazioni vere**, quindi le fasce
   calcolate sugli orari del pranzo non sono mai state guardate su dati veri.
4. 🟡 **Una sala con più conti aperti insieme non è mai esistita**, ed è la
   condizione normale di un servizio: tutto quello che si è visto finora è
   sempre stato **un conto per volta**.
5. 🟡 **La guardia di `--azzera` non è mai scattata in una ricostruzione vera.**
6. 🟡 **I due rami di `DB_URL_PRODUZIONE` non sono mai stati esercitati** —
   con la precisazione del giro D2: il ramo di **lettura** è stato usato per
   misurare il canarino, quello della **guardia** no.
7. 🟡 **Il messaggio con le date degli scostamenti non è mai comparso a
   schermo.**

E quelle che apre questo giro:

8. 🔴 **NESSUNA MANO HA ANCORA TOCCATO IL RIQUADRO DEL TAVOLO.** È il pezzo
   che cambia il gesto più frequente di quella schermata, e **nessuna prova
   automatica di questo progetto guarda una schermata**: quello che è provato
   è che i dati arrivano, non che il riquadro si apra dove serve e ci stia sul
   telefono. ⚠️ Il caso peggiore è misurabile in anticipo e va dichiarato: su
   un tavolo con **una** prenotazione ci vuole adesso **un tocco in più** per
   arrivare alla sua scheda.
9. 🔴 **L'EVIDENZIAZIONE E LO SCORRIMENTO NON SONO PROVATI DA NIENTE.** Lo
   scorrimento fino alla riga esiste proprio perché sul telefono la pianta e
   l'elenco non stanno insieme — cioè **il caso in cui serve è quello che qui
   non si può riprodurre**. Va guardato da un occhio, su un telefono vero.
10. 🟡 **I blocchetti del Calendario Eventi sono stati visti solo compilando**:
    la soglia fra telefono e computer è quella che il progetto già usa per il
    menu principale, ma **nessuno ha guardato la pagina stretta**.
11. 🟡 **Il riquadro non è mai stato aperto su un tavolo con DUE turni** — il
    caso che il giro C ha reso possibile. I dati per farlo esistono (elenca
    tutte le prenotazioni di quel tavolo), ma non è mai successo.
12. 🔴 **«Chi ha corretto e quando» non si legge più da nessuna schermata**
    (rovesciamento n. 8): il dato continua a essere **scritto** dal trigger, e
    la metà che sparisce è quella visibile. ⚠️ Il giorno che ci saranno accessi
    **per persona** quella riga va rimessa a schermo — e diventerà leggibile
    all'indietro, perché nel frattempo è stata scritta lo stesso.

---

## Cosa abbiamo rovesciato

**Due rovesciamenti**, entrambi nell'elenco
([`decisioni_rovesciate.md`](../decisioni_rovesciate.md), nn. **8** e **9**),
dove stanno per esteso con le quattro righe.

### 8 · «chi ha corretto i coperti, e quando, si vede a schermo»

⚠️ **Va guardato con attenzione perché non l'avevamo deciso noi**: è la
**condizione posta dal validatore** nel giro B per lasciare la correzione dei
coperti a tutto lo staff invece che al solo titolare — *«Con una condizione:
registra chi e quando, e si vede»*.

- **La ragione di allora.** *Una correzione senza autore è un numero che
  nessuno può spiegare tre giorni dopo* — e quel numero decide se si accetta
  gente.
- **Cosa si decide adesso.** Quella riga **esce dalla schermata**. Restano la
  ragione scritta a mano e il numero calcolato accanto a quello corretto.
- **Perché — anzi: la ragione vale ancora per intero, e questo è il prezzo.**
  ⚠️ **La condizione era doppia** (*registrare* e *far vedere*) e **la metà
  che pesa di più resta intatta**: il trigger continua a scrivere chi e
  quando, e nessuna schermata può impedirglielo. Cambia **dove si legge**.
  ⚠️ E il caso in cui quella riga serviva **non è oggi**: si entra per
  **ruolo** e non per persona, quindi a schermo poteva dire soltanto «l'hai
  messo tu» oppure «da un altro accesso» — che con un accesso condiviso per
  tutto lo staff non identifica nessuno.

### 9 · «un tocco sulla sagoma vuol dire tre cose diverse»

- **Cosa era stato deciso.** Il 14/08, con la pianta viva: il tocco significa
  una cosa diversa a seconda di cosa c'è sotto il dito.
- **La ragione di allora.** Le tre cose *«non possono essere ambigue»*.
- **Cosa si decide adesso.** Il tocco fa sempre la stessa cosa: apre il
  **riquadro di quel tavolo**.
- **Perché — anzi: la ragione vale ancora, e la forma nuova la serve meglio.**
  Il problema del 14/08 non era «tre gesti», era **l'ambiguità** — e tre esiti
  diversi per lo stesso gesto sono ambigui *per costruzione*, perché chi tocca
  deve ricordarsi cosa c'era sotto. Un esito solo la toglie alla radice.

---

## ⚠️ Le due cose di natura diversa dentro lo stesso riquadro

È il rilievo posto dal validatore **prima** che il riquadro esistesse, ed è la
cosa più delicata di questa consegna:

- **il TOCCO è del tavolo** — hai toccato T8;
- **il NUMERO DEI COPERTI è del TAVOLONE** — la correzione ha per chiave
  l'**insieme** di tavoli, dal giro B.

Sono due cose che stanno nello stesso riquadro e si somigliano abbastanza da
confondersi. **Correggere il numero di un tavolone credendo di correggere un
tavolo** è un errore che poi decide se si accetta gente — e non darebbe nessun
segnale, perché il numero cambierebbe come atteso.

**Come è chiusa**: quando il gruppo è di più di un tavolo il riquadro lo dice
in chiaro, due volte e con parole diverse — nell'intestazione (*«T8 — accostato
a T7 · T9»*) e accanto alla casella (*«È il numero di T7 · T8 · T9 insieme, non
del solo T8: correggendolo cambi il tavolone»*). ⚠️ Su un tavolo singolo quelle
frasi **non compaiono**: una spiegazione che c'è sempre si smette di leggere, e
questa deve farsi notare proprio nel caso in cui serve.

---

## Cosa è stato costruito

### 1. Il riquadro del tavolo, che assorbe il tocco

Dentro c'è tutto quello che riguarda quel tavolo: **i coperti** con la casella
per correggerli e la ragione, **le prenotazioni** che ci stanno sopra (con
l'ora, il nome, quanti sono e se sono arrivati) da aprire con un tocco, e
**«Prendi una prenotazione qui»**.

⚠️ **Assorbe, non si affianca**: l'elenco dei tavoli sotto la pianta è
**sparito**, e con lui la seconda strada per correggere i coperti. Era già la
regola del progetto — due strade per lo stesso numero vogliono una precedenza
inventata da chi scrive il codice.

### 2. L'evidenziazione incrociata, nei due versi

Tocchi un tavolo → la sua prenotazione si accende nell'elenco **e la pagina ci
scorre**. Tocchi una prenotazione → si accende il suo tavolo **e la pagina
torna alla pianta**.

⚠️ **Lo scorrimento non è un di più**: sul telefono la pianta e l'elenco non
stanno sullo stesso schermo, e *accendere una riga che sta fuori schermo non è
evidenziare — è nascondere meglio*.
⚠️ **E sul computer non si muove niente**: lo scorrimento chiede la distanza
*minima*, quindi se la riga è già visibile la pagina resta ferma. Una pagina
che salta a ogni tocco sarebbe un difetto introdotto per curare un problema
che lì non esiste.

⚠️ **Si riusa il segno che c'è già** invece di inventarne uno: «selezionato»
significa, nella precedenza dei colori del giro D2, *la risposta al tuo tocco*
— che è esattamente cosa fa l'evidenziazione. Un colore nuovo apposta avrebbe
detto una quarta cosa con un quarto segno, su una schermata che ne ha già
cinque.

### 3. La lista prenotazioni, riordinata

L'informazione in prima riga — **ora, nome, quanti, dove** — e i comandi
(«Cambia tavolo», «togli il tavolo») **solo sulla riga accesa**, cioè dopo un
tocco. Prima «Cambia tavolo» era un riquadro grande ripetuto su ogni riga: *i
comandi pesavano quanto le informazioni*.

⚠️ **E c'è lo stato che mancava**: *arrivati · attesi · in ritardo di N
minuti*. È il dato del giro D2 — calcolato, mai scritto da nessuno — e
nell'elenco non compariva. Il mandato lo diceva: *«alle 21:15, con due tavoli
liberi e uno che tarda, è la prima domanda che ci si fa»*.

### 4. Calendario Eventi: il telefono legge, il computer tabella

Sul telefono ogni prenotazione è un **blocchetto coi dati a capo**; sul
computer la **tabella resta** — lì funziona, e *si cura dove fa male*, che è la
stessa distinzione con cui le due colonne sono state rimandate.

🔴 **E il tavolo entra fra le informazioni. Prima non c'era affatto, e non per
una dimenticanza della schermata: il dato non veniva chiesto al database.**
Adesso arriva **insieme** alle prenotazioni, senza una seconda interrogazione,
perché il legame è una vera chiave esterna.

⚠️ **I campi vivono in un posto solo** (`src/lib/calcoli/prenotazioni.js`), e
non è pignoleria: due elenchi di colonne — uno per la tabella, uno per i
blocchetti — sono due posti che divergono in silenzio. Si aggiunge un dato alla
tabella, ci si dimentica dei blocchetti, e **il telefono resta indietro senza
che niente lo dica** — proprio il telefono, che per le prenotazioni è la strada
maestra.

⚠️ **Il campo vuoto ha una parola sua**: «da assegnare», non un trattino.
Nessuno gliel'ha ancora dato, ed è un fatto — non un dato che non esiste.

---

## Le prove, e la controprova

**107 pure** (+5) e **174 sul progetto di prova** (+2).

La prova sui dati veri esiste per **un modo preciso di fallire**: i tavoli
arrivano alle prenotazioni con un *incorporamento*, e il database può smettere
di concederlo senza che nessuno se ne accorga (una regola di permessi diversa,
una chiave esterna rinominata). ⚠️ **E il modo in cui fallirebbe non è un
errore rosso: è «da assegnare» su ogni riga**, cioè una schermata che dice con
calma che nessuna prenotazione ha un tavolo. È la forma del difetto del 16/08
letta al contrario — lì un campo non arrivava al database, qui non arriva alla
schermata.

### La controprova, fatta e non promessa

| rottura | prove rosse |
|---|---|
| i tavoli non si chiedono più al database (com'era stamattina) | 1 — *«una prenotazione su DUE tavoli li porta tutti e due fino alla schermata»* |
| il campo vuoto perde la sua parola | 1 — *«senza tavolo il campo resta VUOTO, e ha una parola sua»* |

⚠️ **E nella prima rottura la gemella al contrario è rimasta verde**, che è la
metà che conta: dimostra che *«senza tavolo dice da assegnare»* non dipende
dall'incorporamento, quindi le due prove misurano cose diverse. Se fossero
diventate rosse tutte e due, una delle due non starebbe provando niente.

Poi tutto rimesso a posto: **107 verdi**.

---

## Il canarino, e una cosa che ha detto da sé

Misurato in **produzione** con `psql` in sola lettura, a giro finito:

| gruppo | calcolati | veri |
|---|---|---|
| T1 | 6 | **5** (corretto a mano, «Contro il muro») |
| T2 | 6 | 6 |
| T3 · T4 | 6 | 6 |
| T5 · T6 | 6 | 6 |
| T7 · T8 · T9 | 8 | 8 |
| **totale** | **32** | **31** |

⚠️ **Stamattina erano 34 e 33 su 6 gruppi.** Non è un guasto: Alessio ha
**accostato T3 e T4** durante il collaudo del D2, e due tavoli da 4 accostati
fanno 6. È la proprietà che il giro B doveva garantire — *stessa sera,
disposizione diversa, totale diverso* — vista funzionare **senza che nessuno
l'avesse apparecchiata**.

---

## Per Alessio, in una riga

Tocca un tavolo sulla pianta: si apre un riquadro con dentro tutto — quanti ne
tiene, chi c'è, e il pulsante per prendere una prenotazione. **L'elenco dei
tavoli che stava sotto la pianta non c'è più**: quello che facevi lì lo fai
adesso toccando il tavolo.
