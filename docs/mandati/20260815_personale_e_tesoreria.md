# Mandato — Il personale e la tesoreria

**Destinatario**: sessione Code
**Origine**: decisioni di Alessio del 15/08/2026
**Precede**: nulla di deciso dopo — è il prossimo blocco di lavoro
**Consegna**: a blocchi ordinati, con un riepilogo per blocco (vedi §10)

---

## 0. Cosa cambia, in una frase

Oggi il conto economico non conosce **la voce di spesa più grossa
dell'anno**: il costo del personale non passa da nessun modulo — lo
dichiara la migrazione stessa dei consuntivi. E la tesoreria sa dire
quanto c'è in cassa solo a metà, e della banca non sa niente.

Questo mandato chiude tutti e due i buchi, e aggiunge gli strumenti
che ci girano intorno.

---

## 1. Il vincolo che attraversa tutto il mandato

**L'app legge e mostra. Non ricalcola mai le paghe.**

Il motore paghe è quello del Consulente del Lavoro (Gianna). Se l'app
ricalcolasse ferie maturate, contributi o netti, esisterebbero due
verità sullo stesso numero — esattamente il difetto appena chiuso
sulle imposte, dove il Simulatore calcolava per conto proprio.

Quindi: l'app **riporta** ciò che i documenti dicono e, se qualcosa
non torna, **lo segnala** invece di correggerlo.

**Unica eccezione dichiarata**: il simulatore di assunzione (§5), che
è una stima, si chiama così, e mostra la data dei propri parametri.

---

## 2. Blocco 1 — Il costo del personale entra nel conto economico

⚠️ **È il blocco più importante del mandato.** Se se ne fa uno solo,
è questo.

### La distinzione che regge tutto: due documenti, due destinazioni

| Documento | Contiene | Va a |
|---|---|---|
| **Prospetto mensile del costo aziendale** (da Gianna) | lordo + contributi datore + INAIL + TFR + ratei 13ª/14ª | **conto economico** |
| **Cedolino** | lordo, netto, ferie e permessi maturati/goduti/residui, malattia, TFR accantonato | **scheda individuale** |

Il cedolino **non contiene** il numero che serve al conto economico:
mostra il mondo visto dal dipendente. Su un lordo di 1.500 € il costo
azienda sta intorno ai 2.100. Portare il lordo nel conto economico
sottostima la voce più grossa del 35-40% — peggio che lasciarla
vuota, perché un numero sbagliato fa prendere decisioni.

### Cosa costruire

1. **Porta d'ingresso per il prospetto**: una riga per dipendente per
   mese, con il costo aziendale. Da lì il consuntivo mensile prende
   la voce personale.
2. **Lettura del documento fotografato**, riusando il meccanismo già
   in uso per le etichette HACCP: si fotografa il prospetto, i dati
   si propongono compilati, **Alessio conferma prima che entrino**.
   Mai un'acquisizione automatica non confermata.
3. **Ripiego dichiarato**: se il prospetto non arriva, il costo si
   stima dal lordo con un coefficiente che Alessio imposta (glielo
   darà Gianna) — e la voce è **etichettata "stimata"**, come già
   fa la Proiezione col food cost previsto. Mai un numero presunto
   mescolato a uno vero senza etichetta.
4. **Scheda individuale alimentata dal cedolino**: ferie maturate,
   godute e **residue**; permessi e ROL; giorni di malattia; **TFR
   accantonato progressivo**; premi erogati. Valori **letti**, mai
   ricalcolati (§1).

### Correzioni all'esistente, trovate provando

- Nel form delle buste paga il campo del mese **non ha etichetta** —
  mostra solo i trattini — ed è l'unico obbligatorio: il pulsante
  resta spento senza dire perché. Serve l'etichetta ("Mese di
  competenza") e un messaggio che dica cosa manca.
- Oggi si può salvare una busta paga **senza alcun importo**: almeno
  uno fra lordo e netto va richiesto.
- Va deciso con Alessio se continuare ad archiviare i cedolini nel
  gestionale una volta che il costo arriva dal prospetto: sono dati
  personali che potrebbero non servire più (quesito GDPR aperto).

---

## 3. Blocco 2 — I premi in denaro

Premi che Alessio decide di dare ai collaboratori. **Sono
retribuzione premiale**, non mance: IRPEF e contributi pieni, nessun
regime agevolato, e **il pagamento in contanti è vietato** (L.
205/2017) — passano dal cedolino e dal bonifico.

### Il ciclo

1. **Decisione** registrata nell'app: chi, quanto, mese di
   competenza, motivo.
2. **Comunicazione**: l'elenco del mese esce nel **pacchetto per
   Gianna**, entro la data di chiusura paghe che indicherà lei.
3. **Cedolino**: Gianna lo inserisce come voce variabile; il premio
   arriva col bonifico dello stipendio.
4. **Ritorno**: il prospetto del mese contiene il premio, e chiude
   il cerchio.

### La riconciliazione interna

> *ogni premio registrato per il mese X ↔ risulta nel prospetto del
> mese X?*

Combacia → riga chiusa. Manca o differisce → **resta aperta e
visibile** finché non viene sistemata. Stessa logica della
riconciliazione ordine-fattura già in casa.

### Registrazione

Si registra il **lordo** (o il costo pieno — da confermare con
Alessio). Al ritorno del prospetto la scheda mostra le **tre cifre
affiancate**: lordo, netto al dipendente, costo per l'azienda.

Viste richieste: quanto ha preso ciascuno **mese per mese** e
**nell'anno**.

---

## 4. Blocco 3 — La voce libera sulla scheda del dipendente

Servono **tre** tipi di riga, e vanno tenuti separati perché due di
essi non devono mai finire nel totale d'impresa.

### a) Voce libera che CREA un costo

Per ciò che sta fuori dal cedolino: rimborsi spese documentati, un
corso pagato di persona, scarpe antinfortunistiche, un compenso
occasionale a un extra.

Tre condizioni, non negoziabili:

1. **Porta un documento di riferimento.** Se non c'è, la voce si
   registra ma è **marcata senza documento** e quindi
   **indeducibile** (vedi §8).
2. **Genera il movimento reale** — cassa, banca o fondi personali del
   titolare. Non è un numero digitato in una casella: è una
   registrazione vera che parte dalla scheda invece che dal modulo
   cassa. Se il conto economico cresce e la tesoreria no, le due
   viste divergono.
3. **Le categorie disponibili escludono ciò che il prospetto già
   copre** — stipendio, contributi, TFR, ratei. Altrimenti si conta
   due volte, ed è un errore invisibile: due numeri veri sommati due
   volte.

### b) Attribuzione di un costo che esiste già

Aggancia a una persona una fattura già registrata altrove (corso
sicurezza, divise, medico competente). **Non crea denaro nuovo**:
assegna.

### c) Annotazione extra-aziendale

Importo che **non è un costo della società** — per esempio un
prestito personale fra Alessio e il collaboratore. Visibile sulla
scheda, **mai sommato al totale d'impresa**, mai nel conto economico.

### Come si legge la scheda

Tre blocchi separati e mai mescolati — **costo aziendale** (dal
prospetto), **costi attribuiti**, **fuori azienda** — e in cima il
totale annuo della persona, con la certezza che non contenga somme
doppie.

### Etichette

Testo libero la prima volta, poi riutilizzabile. Quando un'etichetta
ricorre tre o quattro volte, l'app propone di promuoverla a voce
fissa. Il vocabolario cresce dall'uso.

---

## 5. Blocco 4 — Il simulatore di assunzione

Da usare **in fase di colloquio**, prima di una decisione costosa.

### La parte solida: il costo

- **Ingresso**: livello CCNL pubblici esercizi, ore settimanali, tipo
  di contratto. Non un lordo digitato a mano.
- **Uscita**: lordo mensile, **costo azienda mensile e annuo**,
  comprensivo di tredicesima, quattordicesima, TFR e contributi.

### La parte fragile: le agevolazioni

⚠️ **Il simulatore non emette verdetti.** Gli incentivi cambiano a
ogni legge di bilancio e dipendono da età, condizione precedente,
stato di disoccupazione, DURC, rapporti pregressi. Un'app che dice
«hai diritto allo sgravio» sarà falsa entro pochi mesi, e su questo
si perdono soldi veri.

Quello che fa: dai dati del candidato produce una **lista di
verifica** — *«potrebbe rientrare in apprendistato / incentivo
giovani / sgravio Sud: **verifica con Gianna prima di firmare**»*.
Segnala una pista, non decide.

**L'apprendistato è il primo caso da mettere in lista**: per un
ristorante che apre è la leva più grossa.

### I parametri

Aliquote, coefficienti ed elenco delle agevolazioni **stanno nel
database e li governa Alessio** — mai scritti nel codice. È lo stesso
principio del motore fiscale.

Ogni parametro porta la **data dell'ultima verifica**, e il
simulatore la mostra: *«parametri aggiornati al …»*. Una stima di cui
si conosce l'età vale il doppio di una stima muta.

### Aggancio a Ricerca Ricorrente

Il modulo che già scandaglia il web per opportunità e aggiornamenti
sorveglia anche il mondo del lavoro. Quando trova qualcosa:

- **crea un impegno in Agenda** — *«verifica con Gianna: sembra
  cambiato lo sgravio X»*
- **non aggiorna nulla da sé**

Un'app che si riscrive le aliquote leggendo il web è la ricetta per
un simulatore che sbaglia di migliaia di euro senza che nessuno sappia
perché.

---

## 6. Blocco 5 — Mance e vitto del personale

### Mance separate dai corrispettivi

Il modulo mance esiste già (raccolta e distribuzione). Manca
l'aggancio alla **chiusura di serata**: se il totale del POS è 1.510 €
di cui 60 di mance, i **ricavi del giorno sono 1.450**.

Senza questa separazione la cassa sballa ogni sera e la Proiezione
gonfia i ricavi esattamente del valore delle mance.

Le mance non sono ricavi né costi della società: sono redditi di
lavoro dipendente dei lavoratori, e per l'azienda una **partita di
giro** — debito verso il personale finché non sono distribuite.

### Vitto del personale

La brigata mangia ogni giorno: è **food cost che non genera ricavo**.
Se lo scarico non lo distingue, gonfia il food cost dei piatti
venduti e fa cercare un problema in cucina che non esiste.

Serve una **causale di scarico dedicata** — "vitto personale" — così
il consumo resta tracciato, il food cost dei piatti resta pulito, e la
Proiezione lo legge come costo del personale.

*(Il trattamento fiscale dei pasti al personale è un quesito aperto
per Laura: la causale si costruisce comunque.)*

---

## 7. Blocco 6 — La tesoreria

**Nessun modulo nuovo**: si fa crescere «Cassa, Banca e Prima Nota»,
che ha già l'ossatura — saldo cassa e saldo banca — con dentro poca
vita.

### Il concetto da non perdere: un costo non è un'uscita

| | Quando | Dove si vede |
|---|---|---|
| Costo del personale di agosto | agosto | conto economico / Proiezione |
| Uscita dello stipendio | ~10 settembre | tesoreria |
| Uscita di F24 | 16 settembre | tesoreria |

Chi guarda solo la cassa crede che agosto sia leggerissimo e settembre
un disastro. Chi guarda solo il conto economico sa se guadagna ma non
**se arriva al 16 con i soldi sul conto** — ed è la seconda domanda
quella che chiude i ristoranti.

**Due viste distinte, alimentate dagli stessi fatti.** Non una sola
che prova a rispondere a entrambe: non risponderebbe bene a nessuna.

### a) Cassa

- Gli **incassi contanti della chiusura di serata entrano nel saldo**,
  come categoria propria. È l'evoluzione della decisione del
  04/08/2026 che li teneva fuori: giusta per la prima nota spese,
  insufficiente per rispondere a *«quanto contante ho nel cassetto?»*.
- **Conteggio periodico del cassetto**: se il teorico dice 430 e se ne
  contano 425, la differenza si registra **come differenza di cassa,
  dichiarata** — mai aggiustata in silenzio. Le differenze croniche
  sono un'informazione.
- I **versamenti in banca non sono un'uscita**: sono un trasferimento
  da uno specchio all'altro.

### b) Banca

- **Import dell'estratto conto** (CSV dall'home banking), con
  riconciliazione **movimento per movimento**.
- Il collegamento diretto al conto (open banking) resta una strada
  aperta per dopo, non ora.
- ⚠️ **POS in transito**: l'incasso elettronico di stasera non è in
  banca stasera — arriva dopo uno o due giorni, **al netto delle
  commissioni**. Senza questa voce il saldo banca teorico non tornerà
  mai, e Alessio smetterà di guardarlo in una settimana. Va previsto
  dal primo giorno.

### c) Attesi vs avvenuti

L'app **sa** cosa deve succedere: il prospetto dice quanto usciranno
gli stipendi, le fatture dicono i pagamenti ai fornitori, il
calendario imposte dice l'F24 del 16. Quando l'estratto arriva, ogni
movimento atteso trova il suo movimento vero — **o non lo trova, e
resta visibile**.

---

## 8. Blocco 7 — La sezione personale del titolare

Non è «lo spazio dei soldi personali di Alessio»: è il **registro dei
pagamenti che lui fa con i propri fondi per conto della società**. Il
suo conto privato e le sue spese personali **non entrano nel
gestionale**.

### Cosa fa

- **«Ho messo di tasca mia»**: importo, **tag** dal vocabolario,
  riferimento facoltativo al documento, nota libera facoltativa.
- La nota resta **aperta** finché non si segna il pareggio.
- **Il pareggio genera il movimento di cassa vero** — il rimborso esce
  dalla cassa — perché il cassetto deve quadrare col conteggio fisico.
- **Saldo sempre in vista**: *«in questo momento la società ti deve
  45 €»*.

Il verso opposto (prendere dalla cassa per spese personali) **è stato
escluso da Alessio: non va costruito.**

### I tag

**Vocabolario chiuso governato da Alessio** — aggiunge voci quando
serve, ma si sceglie sempre dall'elenco. Testo libero no: diventerebbe
"fornitore", "Fornitori" e "pagam. fornit.", e i totali smetterebbero
di sommarsi. Stesso pattern delle causali omaggi.

**Un tag per nota**, più la nota libera. Al pareggio **il tag viaggia
nella causale del movimento di cassa**, così la prima nota resta
leggibile da sola.

**Totali per tag**: sono la diagnosi. Se «fornitore urgente» domina la
classifica, il problema non sono le anticipazioni — è la cassa tenuta
troppo scarica.

### Le tre eccezioni che fanno scattare la comunicazione a Laura

Automatiche, dentro il pacchetto mensile:

1. **pagamento dal conto bancario personale** invece che in contanti
   (pagamento da mezzi di terzi: nei registri la fattura risulterebbe
   pagata da un conto che non è della società)
2. **importo oltre la soglia** che Alessio fisserà con Laura
3. **nota ancora aperta a fine mese** — ciò che sopravvive al mese non
   è più un dettaglio operativo: è un credito alla data del bilancino

Regola: *ciò che si chiude nel mese resta un promemoria, ciò che
sopravvive al mese diventa formale da solo.*

### Fuori perimetro

Il **compenso amministratore non passa da qui**: va deliberato, sconta
contributi, passa dal cedolino, e **non può essere pagato in
contanti**. In tesoreria comparirà solo come movimento atteso.

---

## 9. Trasversale — L'attributo di deducibilità

Serve a questo mandato e serve alla Proiezione, e va costruito una
volta sola: **ogni voce di costo porta un attributo che dice se è
fiscalmente deducibile.**

Non è un espediente: multe, sanzioni, quote di rappresentanza e costi
senza documento sono casi ordinari. La Proiezione lavora su due basi —
l'utile gestionale e l'imponibile — e senza questa distinzione produce
stime sbagliate su situazioni del tutto normali.

L'elenco dei casi ricorrenti lo darà Laura (quesito aperto): la
**struttura** si costruisce comunque.

---

## 10. Vincoli, dipendenze, consegna

### Vincoli di contratto — non negoziabili

Valgono tutti quelli di `docs/CONTRATTO.md`. Quelli che questo mandato
tocca da vicino:

1. **B4** — ogni scrittura multi-tabella passa da un server e, dentro,
   da **una singola funzione Postgres**. Qui riguarda almeno: il
   pareggio di un'anticipazione (nota + movimento di cassa), la voce
   libera che crea costo (voce + movimento), l'import dell'estratto
   con riconciliazione.
2. **RLS su ogni tabella nuova.** I dati del personale e la sezione
   personale del titolare sono **solo del titolare**: policy vera sul
   ruolo, non una voce nascosta dal menu.
3. Ogni funzione `security definer` con `set search_path = public`.
4. Ogni migrazione **idempotente**, con blocco `raise exception` che
   verifica l'effetto dichiarato, auto-registrata in
   `applied_migrations`.
5. Nessuna chiave `service_role`.
6. Migrazioni prima su Borgo58-Prova; annuncio prima di applicare in
   produzione, numeri reali dopo.
7. **`git push` solo Alessio.**
8. **Nessun importo del piano economico nei riepiloghi**: gli esiti si
   dichiarano, le cifre no.
9. Il **Contratto non si modifica** in questo mandato. Se una riga
   risultasse non più vera, si propone ad Alessio un commit separato
   **dopo** la consegna, dichiarato al validatore.

### Dipendenze — leggere prima di pianificare

⚠️ **I blocchi 1 e 2 si progettano sui documenti veri di Gianna**: il
prospetto del costo aziendale e il calendario di chiusura paghe. Se le
risposte non sono ancora arrivate, **non si indovina la forma del
documento**: si costruisce il resto e si aspetta.

**Si può partire subito con**: Blocco 4 (simulatore, parte costo),
Blocco 5 (mance e vitto), Blocco 6 (tesoreria), Blocco 7 (sezione
personale), §9 (attributo di deducibilità).

### Consegna

**Un riepilogo per blocco** in `docs/consegne/`, non uno solo alla
fine: il mandato è lungo e i blocchi sono indipendenti. Ogni riepilogo
dichiara cosa è stato provato e con quali ruoli.

Ordine consigliato: §9 → Blocco 6 → Blocco 7 → Blocco 5 → Blocco 4 →
Blocchi 1 e 2 quando Gianna risponde.

### Collaudo — criteri di accettazione

1. Il costo del personale del mese compare nel consuntivo, e **la sua
   fonte è il prospetto**, non il cedolino.
2. In assenza di prospetto la voce è **etichettata «stimata»** e non
   si confonde con un dato misurato.
3. Un premio registrato e **non presente** nel prospetto del mese
   resta **aperto e visibile**.
4. Una voce libera senza documento risulta **indeducibile**, e
   **genera comunque il movimento** di cassa o banca.
5. Un'attribuzione **non aumenta** il totale dei costi d'impresa.
6. Un'annotazione extra-aziendale **non compare** in nessun totale
   d'impresa.
7. Il simulatore **non afferma** che un'agevolazione spetta: la
   propone come verifica, e mostra la data dei parametri.
8. La chiusura di serata separa le mance dai corrispettivi: **i ricavi
   del giorno non le contengono**.
9. Lo scarico «vitto personale» **non entra** nel food cost dei piatti
   venduti.
10. Il conteggio del cassetto produce una **differenza dichiarata**,
    non un aggiustamento silenzioso.
11. L'import dell'estratto riconcilia i movimenti attesi e **lascia
    aperti** quelli non trovati; il POS in transito non fa sballare il
    saldo.
12. Il pareggio di un'anticipazione muove la cassa e chiude la nota
    **nella stessa operazione**: non esiste uno stato in cui una
    avviene e l'altra no.
13. Una nota aperta a fine mese **compare da sola** nel pacchetto per
    Laura.
14. Nessuna funzione dell'app **ricalcola** ferie, contributi o netti.

---

*Mandato preparato il 15/08/2026 sulla base delle decisioni di Alessio
del 15/08/2026. Vive in
`docs/mandati/20260815_personale_e_tesoreria.md`.*
