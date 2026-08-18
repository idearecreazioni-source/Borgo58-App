# Giro C — le tre fasce, e «da liberare entro le…»

**Consegna del 18/08/2026.** Mandato [«La sala e le prenotazioni»](../mandati/20260818_la_sala_e_le_prenotazioni.md),
punti **3 + 4**. Segue i giri [A](20260818_giro_a_la_sala_non_si_perde.md) e
[B](20260818_giro_b_i_coperti_dentro_il_tavolo.md), **validati e chiusi**.

- **HEAD dichiarato**: `a008c8c`
- **Working tree**: pulito
- **Migrazione**: `20260818000004_le_tre_fasce_e_il_turno.sql`
- **Prove**: **60** pure (erano 53) + **157** sul progetto di prova (erano 151)
- **Lint**: zero avvisi · **Build**: ok
- **In produzione**: ⏳ non ancora applicata

---

## ⚠️ Cosa NON è verificato

1. **Nessuna mano ha toccato il giro C.** Le tre fasce, la nota del turno e
   la sala di Comande dopo mezzanotte non sono mai state usate da una persona.
2. **Il caso che conta di più non è mai capitato dal vivo**: mezzanotte in
   servizio. È provato ai bordi (00:30, 04:59, 05:00, 05:01) ma solo da prove
   automatiche, mai da un tablet acceso all'una di notte.
3. **La domenica a pranzo non esiste ancora in produzione** con prenotazioni
   vere: la prova sul pranzo gira sul progetto di prova, accendendo il
   servizio e rimettendolo com'era.
4. **Il lato SQL delle 5 non c'è**: vedi «l'orologio», qui sotto. Finché non
   c'è, il gestionale ha due nozioni di «oggi» che divergono fra mezzanotte e
   le cinque.
5. **Restano dal giro A**: il messaggio con le date degli scostamenti mai
   comparso a schermo, i due rami di `DB_URL_PRODUZIONE` mai esercitati, la
   guardia di `--azzera` mai scattata in una ricostruzione vera.

---

## Cosa abbiamo rovesciato

### «L'ora del primo giro sta nelle impostazioni del locale» (14/08)

**Cosa era stato deciso, e quando.** Il 14/08, insieme ai due colori:
`service_settings.ora_primo_turno`, **una per tutto il locale**.

**La ragione di allora.** *«D'estate o di sabato cambia, e non deve servire
una modifica al programma»* — cioè: è un dato di Alessio, non una costante.

**Cosa si decide adesso.** L'ora del primo giro sta **sulla riga del
servizio** (`service_hours.ora_primo_turno`), dove sta già il suo gemello
`ultimo_ingresso`. E si **sposta**, non si copia.

**Vale ancora, ed è per questo che la forma nuova è diversa.** La ragione del
14/08 non era «una sola per il locale»: era **«è un dato suo»** — e questa
forma la serve meglio, perché adesso può essere diversa per la cena e per il
pranzo. Con due colori l'ora unica bastava; con tre no: **la domenica è
pranzo** (12:00 → 14:00), e tre fasce calcolate su un 20:00 buono per la cena
direbbero «il tavolo può servire una seconda volta» a chiunque pranzi —
**anche a chi si siede alle 13:45 e occupa fino alla chiusura**.

⚠️ **La vecchia colonna è stata TOLTA, non lasciata lì.** Lasciarla sarebbe
un secondo posto dove vive lo stesso fatto: si contraddirebbero al primo
cambiamento, e servirebbe una precedenza inventata da chi scrive il codice.
Sanatoria dichiarata: **7 righe di cena** messe a 20:00, il valore che c'era.
⚠️ **Sul pranzo non si è inventato niente**: resta **vuoto**, che vuol dire
«non l'ha ancora detto nessuno» — e quel servizio ha **due fasce invece di
tre** (lezione del 14/08 sui valori predefiniti che rispondono al posto
dell'utente).

---

## L'orologio: un numero, due lettori

Alessio ha esteso la regola delle 5 **a tutto**: *«se voglio sapere quanto ho
incassato ieri e un conto è stato emesso dopo la mezzanotte, non va
conteggiato nel giorno dopo»*. Quindi gli 11 punti SQL non sono più un debito
da dichiarare: sono **una cosa decisa**, e resta da stabilire quando.

**Le 5 NON sono un numero in un file JavaScript.** Stanno in
`service_settings.ora_fine_serata`, accanto agli altri parametri suoi. Il file
`src/lib/calcoli/serata.js` **lo riceve** invece di contenerlo, ed è per
questo che `serataDiServizio()` è una funzione **pura** che prende l'ora come
argomento. Il giorno in cui gli 11 punti verranno convertiti, la funzione SQL
leggerà **lo stesso valore**. *Un numero, due lettori — mai due copie che
possono divergere.*

⚠️ **CONDIZIONE D'INGRESSO DEL GIRO SUCCESSIVO, dichiarata qui**: quando ci
sarà anche il lato SQL, serve la prova che **sullo stesso istante le due
strade diano la stessa serata**, misurata **ai bordi** (00:30, 04:59, 05:01).
Finché quella prova non esiste, il lato SQL non è finito.

⚠️ **E fino ad allora le due nozioni divergono**, fra mezzanotte e le cinque:
le schermate della sala dicono «è ancora ieri sera», i punti SQL scrivono col
giorno di calendario. Un conto chiuso all'una comparirebbe nella serata di
ieri e il suo movimento di cassa nascerebbe datato oggi. **La divergenza
esisteva già prima del giro C — solo al contrario e in silenzio.**

### Quanto costa convertire adesso: misurato

Chiesto dal validatore perché Alessio decida con un dato invece che a
sensazione. Righe in produzione nelle tabelle toccate dagli 11 punti:

| tabella | righe |
|---|---|
| `cash_movements`, `tips_collected`, `discounts_gifts`, `conteggi_cassa`, `daily_menus` | **0** |
| `supplier_invoices`, `deductible_expenses`, `anticipazioni_socio`, `foraged_items` | **0** |
| `orders` chiusi (di collaudo) | 3 |

**Zero righe scritte col criterio vecchio.** Oggi la conversione è **una
migrazione e basta**: 6 funzioni e 5 valori predefiniti, nessuna sanatoria,
nessuna decisione su cosa fare dei dati esistenti. Fra sei mesi sarebbe la
stessa migrazione **più** la decisione su ogni riga già scritta — e quella
decisione non ha una risposta giusta, perché nessuno saprà a che ora fu
registrata.

---

## 🔴 Il difetto trovato, e la sua famiglia — terza volta

In Comande la pianta si caricava con `oggiLocale()`, e sopra c'era scritto:

> *«Data locale, non UTC — fra mezzanotte e le due la sala di ieri è ancora
> quella giusta.»*

**È il contrario di quello che il codice faceva.** `oggiLocale()` cura la
trappola del fuso — la data UTC che di notte dà ieri — ed è giusta per il
**giorno di calendario**. Ma alle 00:30, col locale ancora aperto, dice
**domani**: la sala cambiava sotto le mani dei camerieri a mezzanotte, e se
Alessio aveva già preparato la disposizione del giorno dopo se la vedevano
comparire in servizio. **E il commento rassicurava che non succedesse.**

⚠️ **È la terza volta in due giorni per questa famiglia** — *un testo che
descrive male il proprio programma*:
1. il manuale HACCP che stampava «conforme» dove il database apriva una non
   conformità (documento esibibile);
2. la schermata dei coperti che dichiarava una perdita che non avveniva
   (messaggio di interfaccia, giro B);
3. questo commento, che descriveva la proprietà **opposta** a quella del
   codice sotto (commento nel sorgente).

La terza è la più insidiosa delle tre, perché **il lettore è chi manutiene**:
un commento che promette una garanzia è il motivo per cui nessuno va a
guardare se c'è.

---

## Cosa è stato costruito

### Le tre fasce, senza nessun parametro nuovo

I confini esistevano già ed erano dati di Alessio: **apertura**,
**`ora_primo_turno`** (ora sul servizio) e **`ultimo_ingresso`**.

| fascia | quando | colore |
|---|---|---|
| **presto** | prima dell'ora del primo giro | giallo — il tavolo può servire una seconda volta |
| **pieno** | fra il primo giro e l'ultimo ingresso | verde — il tavolo resta suo |
| **tardi** | dall'ultimo ingresso in poi | arancio — è l'ultimo turno |

⚠️ **Il servizio si cerca, non si assume**: per ogni prenotazione si prende il
servizio attivo di quel giorno la cui apertura precede l'ora. È il pezzo che
rende il pranzo giusto, e **la prova che lo tiene gira su una domenica**.

⚠️ **L'arancio nasce quasi vuoto e va detto**: il form pubblico non offre
orari dopo l'ultimo ingresso, quindi una prenotazione arancio può nascere
**solo dalla pianta**, da chi risponde al telefono. Il gesto per aggiungerne
una su un tavolo già prenotato **esisteva già** dal 14/08 e non è stato
toccato: nessun vincolo lo impedisce (misurato: su `prenotazione_tavoli`
l'unico indice unico è `(reservation_id, dining_table_id)`), ed è quello che
Alessio voleva — *un tavolo già prenotato dopo le 22 si può dare a chi accetta
di venire presto e liberarlo in tempo*. Quello che mancava non era il
permesso: era **che si vedesse**.

### «Da liberare entro le…» — una conseguenza, non un dato

Si legge dalla **prenotazione successiva** su un tavolo in comune, meno
`minuti_fra_turni`. Non è scritta a mano da nessuno, e questo è tutto il
disegno:

- se la seconda prenotazione **si sposta**, la nota la segue;
- se viene **annullata**, la nota **sparisce da sé**;
- non c'è un secondo posto dove possa restare indietro.

⚠️ **La nota non guarda la fascia**: è un fatto, non un consiglio. Se dopo di
te c'è qualcuno su quel tavolo, quel tavolo va liberato — giallo, verde o
arancio. La fascia decide il **colore**; la nota decide **cosa deve sapere chi
serve**.

⚠️ **`minuti_fra_turni` è zero, ed è la sua risposta, non uno zero nel
codice.** Alessio: *«riapparecchiare costa due o tre minuti, irrilevante»*. È
un campo in *Sala e orari*, così il giorno che cambia idea non serve una
modifica al programma — stessa forma della soglia dei 25.

### Dove arriva, e dove NON arriva

**Nella pianta** (la scheda della prenotazione aperta) e **in Comande**, sopra
la comanda del tavolo — che è il punto per cui il punto 3 vale soldi: senza,
la regola vivrebbe solo dove si prendono le prenotazioni.

⚠️ **Non sul preconto del cliente e non sul ticket di cucina**, per decisione
esplicita: il primo va in mano a chi sta cenando — «liberare entro le 22:15»
stampato lì è un modo per far alzare qualcuno — e il secondo va a chi cucina,
che non serve ai tavoli. **Dichiarato come scelta, non lasciato implicito.**

---

## Le prove, e la controprova

6 prove nuove sul progetto di prova (`tests/app/turni-sala.test.js`) e 7 pure
(`tests/unita/serata.test.js`).

**Sulla serata, ai bordi e nei due versi**: 00:30 → ieri, 04:59 → ieri, 05:00
→ oggi, 05:01 → oggi. ⚠️ Un solo verso non discrimina: una funzione che
restituisse sempre «ieri» passerebbe la prima. E una prova **al contrario**
cambia il parametro (`"02:00"`) e pretende che il risultato cambi — se l'ora
fosse dentro la funzione, passerebbe lo stesso.

**Sui turni**: le tre fasce a cena; la nota dove c'è un turno dopo **e solo
lì**; la nota che **segue** uno spostamento; la nota che **sparisce** con
l'annullamento; le fasce **su un pranzo**; e le richieste non confermate che
non entrano.

⚠️ **La prova prenota con la funzione VERA dell'app**, non scrivendo nelle
tabelle — e si è scoperto passando di lì che `prenotazione_tavoli` è chiusa in
scrittura diretta dalla RLS, e che la funzione **rifiuta una data passata**.
Due cose che una prova che scrive in tabella non avrebbe mai visto.

### Rotte apposta, viste diventare rosse

| cosa è stato rotto | esito |
|---|---|
| le fasce lette con **un'ora sola del locale** invece che del servizio | **1 rossa**, ed è esattamente quella del **pranzo** |
| la nota che conta anche le **richieste non confermate** | **1 rossa**, ed è esattamente quella delle richieste |

Poi la migrazione è stata riapplicata per rimettere a posto, e lo script
usa-e-getta cancellato.

---

## Per Alessio, in una riga

I tavoli prenotati adesso hanno tre colori invece di due, e dove c'è un
secondo turno la sala legge **entro che ora liberare** — anche in Comande. E
dopo mezzanotte il gestionale sa che è ancora la sera prima.
