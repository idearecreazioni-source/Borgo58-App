# Giro C — le tre fasce, e «da liberare entro le…»

**Consegna del 18/08/2026.** Mandato [«La sala e le prenotazioni»](../mandati/20260818_la_sala_e_le_prenotazioni.md),
punti **3 + 4**. Segue i giri [A](20260818_giro_a_la_sala_non_si_perde.md) e
[B](20260818_giro_b_i_coperti_dentro_il_tavolo.md), **validati e chiusi**.

- **HEAD dichiarato**: `a008c8c`
- **Working tree**: pulito
- **Migrazioni**: `20260818000004_le_tre_fasce_e_il_turno.sql`,
  `20260818000005_il_giallo_comprende_la_sua_ora.sql`,
  `20260818000006_gli_orari_veri_e_il_passo.sql`
- **Prove**: **60** pure (erano 53) + **157** sul progetto di prova (erano 151)
- **Lint**: zero avvisi · **Build**: ok
- **In produzione**: tutte e tre **applicate** — 135 migrazioni

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
5. **Restano dai giri A e B — e solo l'ESECUZIONE, non più la lettura**
   (aggiornato dopo la validazione completa del 18/08, che ha coperto anche la
   metà repo: riepiloghi confrontati col codice vero, Contratto mai toccato,
   135 file = 135 applicate, e il codice del giro A esistente e corrispondente
   a quanto dichiarato). Quello che nessuno ha ancora **visto girare**: il
   messaggio con le date degli scostamenti mai comparso a schermo, i due rami
   di `DB_URL_PRODUZIONE` mai esercitati, la guardia di `--azzera` mai
   scattata in una ricostruzione vera.

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


---

## La coda del giro C: gli orari veri, e i due numeri che non erano uno

### 🔴 «Fino a che ora si prenota» e «da che ora è arancio» sono DUE numeri

Il rilievo è nato fermandosi invece che indovinando, e la risposta stava nelle
parole di Alessio. `ultimo_ingresso` faceva **un lavoro solo** — *fin quando il
sito offre orari* — e i suoi numeri ne chiedono due:

| | si prenota fino alle | arancio dalle |
|---|---|---|
| **cena** | **22:30** | **22:00** (quindi 22:00 · 22:15 · 22:30) |
| **pranzo** | **14:00** | **14:00** — coincidono |

Con una casella sola bisognava scegliere fra **offrire meno orari** (mettendo
22:00) e **colorare meno tavoli** (mettendo 22:30). Nessuna delle due è ciò che
ha chiesto.

⚠️ **E NESSUNO DEI DUE NUMERI CHIUDE NIENTE.** Alle 22:30 si prenota, si
arriva e si viene serviti; l'ora dell'arancio serve **solo a colorare il tavolo
sulla pianta**. Per questo la colonna si chiama `ora_ultimi_arrivi` e in
schermata è **«ultimi arrivi dalle»** — un nome che somigliasse a una chiusura
(`ora_limite`, `fine_servizio`) verrebbe usato, fra tre mesi, per **impedire**
qualcosa. È la stessa forma del «verde avvisa, non blocca» che questo mandato
ripete da tre giri.

⚠️ **Facoltativa, e vuota vale quanto l'ultimo orario prenotabile** — che è il
caso del pranzo. Renderla obbligatoria vorrebbe dire, nel caso normale,
**ripetere un altro campo**: il doppione che poi si contraddice.

### Il giallo comprende la propria ora — e senza, era vuoto per costruzione

La precisazione («giallo fino all'ora del primo turno **compresa**») non era un
dettaglio di scrittura. Coi suoi orari **il primo slot prenotabile coincide con
l'ora del primo turno** (cena 20:00/20:00, pranzo 12:30/12:30): con la regola
stretta il giallo **non avrebbe mai toccato nessuno** — una fascia che esiste
nel codice ed è vuota per costruzione. Tutto acceso, e muto.

⚠️ **Provato sul bordo esatto**, che è il solo punto in cui la correzione cambia
qualcosa: un arrivo *all'ora* del primo turno era «pieno» e ora è «presto». E
anche il quarto d'ora dopo, perché un `<=` diventato per sbaglio un confronto
sempre vero passerebbe la prima. **Terzo caso in due giorni in cui il risultato
arriva dal chiedersi come far fallire una prova.**

### Il passo dei 15 minuti, e il buco delle 20:07 — chiusi insieme

Le tre misure chieste sul form pubblico:

1. **non è un campo libero**: è un **elenco** di orari generato da
   `public_reservation_options`;
2. **il passo di 15 minuti era scritto dentro quella funzione** — un numero di
   Alessio nel posto sbagliato, come la soglia dei 25 prima di ieri. Ora è
   `service_settings.passo_prenotazioni_minuti`, con un vincolo che pretende
   che **divida l'ora esatta** (altrimenti la griglia si sposterebbe di ora in
   ora);
3. **la finestra era difesa nel database, il passo no**: chi inviava a mano le
   **20:07** passava. È la stessa forma del vocabolario chiuso in tre posti —
   la schermata offre un elenco, e chi non passa dalla schermata non è tenuto a
   rispettarlo.

**Chiusi nello stesso passaggio**, ed è il criterio del rimando applicato al
contrario: la colonna «arrivati N di M» fu rimandata perché *l'avrei fatta con
meno attenzione di quanta ne merita*; qui il contesto è già aperto, e riaprirlo
fra due giorni costerebbe di più.

⚠️ **Misurato prima**: **0 orari fuori griglia** su 4 prenotazioni in
produzione. Nessuna sanatoria, nessuna riga da decidere — l'argomento per farlo
adesso invece che con le prenotazioni vere dentro.

⚠️ **La difesa è un TRIGGER e vale solo per il varco pubblico.** Sulla tabella
e non dentro la funzione, così vale anche per una funzione futura che
dimenticasse il controllo. **Provato nei due versi** — respinto da fuori,
accettato da dentro.

⚠️ **L'ASIMMETRIA È LA SCELTA, NON UN BUCO — e la ragione va scritta accanto,
o fra due mesi qualcuno «chiude anche l'altra porta» credendo di correggere un
difetto.** Il sito **propone orari**; Alessio **registra fatti**. Se un cliente
arriva alle 20:07, quello **è successo davvero**, e il gestionale non deve
discutere con la realtà: deve poterlo scrivere. Il freno esiste dove qualcuno
potrebbe inventarsi un orario che non gli è mai stato offerto — cioè su un
indirizzo pubblico, dove l'invio automatico è la norma.
*È la stessa forma del rifiuto della data anteriore alla fattura, tolto il
17/08 per l'acconto: una regola giusta sul caso normale che, applicata anche a
chi registra un fatto, gli impedisce di scrivere la verità.*

### Gli orari veri, scritti una volta sola

Cena **20:00 → 22:30** (primo giro 20:00, ultimi arrivi 22:00), pranzo
**12:30 → 14:00** (primo giro 12:30). ⚠️ **La sanatoria si applica una volta e
basta**, e la guardia è il registro delle migrazioni: questi sono **dati suoi**,
e rieseguirli a ogni riapplicazione riporterebbe indietro un orario cambiato
dalla schermata — lo stesso difetto del giro A, dove una ricostruzione gli
buttava via la sala.

---

## L'app sull'iPhone — misurato, e l'ipotesi regge

Alessio ha messo il gestionale sulla schermata iniziale; toccando l'icona si
apre in Safari e rientrando riparte dalla pagina iniziale.

**Misurato**: **nessun manifest**, **nessun meta iOS**, **nessuna icona** in
`public/` né in `index.html` (c'è solo il `viewport`). È **un segnalibro, non
un'app**: il sintomo è spiegato per intero.

⚠️ **E la parte che si temeva non c'è**: il collegamento principale usa i
valori predefiniti di Supabase (`persistSession`, `autoRefreshToken`), quindi la
sessione si conserva già — e **da installata dura di più**, perché iOS smette di
ripulire lo spazio delle app aggiunte alla schermata. Alessio rifarà l'accesso
**una volta**, non a ogni rientro.

Quindi l'installabile **può stare nel giro E**, con la sequenza già decisa:
**prima si misura lo spazio verticale guadagnato**, poi si dimensiona la pianta
— altrimenti la si dimensiona su un'area che sta per cambiare. Restano da fare
in quel giro: ricordare l'ultima schermata e riaprirla (**verificato forzando
la chiusura**, non solo passando a un'altra app), perché iOS può chiudere l'app
quando ha bisogno di memoria.

⚠️ **Da dire ad Alessio quando sarà pronto**: deve **togliere il collegamento
vecchio** dalla schermata iniziale e rifarlo.

---

## Un buco dichiarato, e NON colmato

**Non esiste nessuna eccezione per una data precisa.** Si può cambiare solo la
griglia settimanale: chiusura per ferie, festa con orario diverso, evento
privato con orari suoi non hanno dove essere scritti. Per il **periodo** la
griglia basta — ed è ciò che Alessio ha chiesto; per il **singolo giorno** no.

Non è stato colmato di proposito: **allargare il giro C sarebbe il difetto che
continuiamo a evitare.** Voce a sé negli appunti.


---

## L'applicazione in produzione — i numeri

Applicate **3 su 3** in due passaggi (la `…004` prima, poi `…005` e `…006`).
Totale in produzione: **135**.

**Gli orari, che sono la cosa da controllare:**

| servizio | righe | finestra | primo giro | ultimi arrivi | accesi |
|---|---|---|---|---|---|
| **cena** | 7 | **20:00 → 22:30** | **20:00** | **22:00** | 5 — martedì‑sabato |
| **pranzo** | 7 | **12:30 → 14:00** | **12:30** | **(vuota)** | 1 — solo domenica |

Le righe del pranzo esistono su **tutti** i giorni e l'interruttore resta in
mano ad Alessio: la settimana tipo è un suo dato.

**I parametri**: passo **15** · fine serata **05:00** · minuti fra i turni **0**
· soglia **25**. Zero prenotazioni di verifica rimaste.

**Il canarino del giro B tiene: la sala dice ancora 34**, con le giunzioni
`T5·T6`, `T8·T9`, `T8·T7` — cioè {T5,T6} = 6 e {T7,T8,T9} = 8. Una migrazione
degli orari non dovrebbe toccare la sala, ed è esattamente per questo che si
guarda.

### Le quattro prenotazioni in produzione: misurate, e non sono mie

Rilievo del validatore su un numero che non tornava (nel briefing ne avevo
contate due). **Sono quattro, e sono tutte di Alessio**: create il **14/08**
fra le 16:09 e le 20:01 (`alessio`, `Alessio`, `franco`, `simona`), tutte
`source = 'interno'`, e **annullate da lui stesso** fra le 20:15 e le 20:16
dello stesso giorno. **Zero tavoli assegnati.** Nessuna è nata dalle verifiche
delle migrazioni — quelle si ripuliscono e il controllo lo dichiara.

⚠️ **Il numero «2» del briefing veniva da una riga di `CLAUDE.md` rimasta
indietro** («2 prenotazioni di prova, di cui una sola con un tavolo
assegnato»): corretta. È il tipo di riga che fa progettare male.

⚠️ **Restano dati di collaudo**, e vanno nell'elenco delle cose che Alessio
cancella prima della prima fattura vera (§5 punto 8) — non le tolgo io: sono
righe sue.
