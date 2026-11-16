# MEMO sa che giorno è (15/11/2026)

## Perché
Alessio ha chiesto alla chat «che impegni ho domani?» e MEMO ha risposto che non poteva dirlo «senza sapere la data di oggi». Vero: il modello non riceveva mai la data. In più la risposta aveva due difetti:
- la riga «Dove l'ho letto» compariva due volte (una scritta dal modello, una dal server);
- «Controllalo: alcuni numeri non arrivano dai dati letti» era un falso allarme: la guardia leggeva le date scritte come 30/08/2026 come numeri inventati.

## Cosa cambia (solo la funzione `memo-chat` e la guardia dei numeri)
- A ogni richiesta il modello riceve **oggi e domani a Roma** (giorno della settimana, data per esteso e AAAA-MM-GG, ora), con l'istruzione di calcolare «domani», «questa settimana» da quella data.
- La riga «Dove l'ho letto» scritta dal modello si toglie: resta solo quella del server.
- La guardia dei numeri ignora le date gg/mm/aaaa e le ore e accetta i numeri della data di oggi.

## Come si è provato
Prove unitarie nuove per la guardia. Su Prova, stessa domanda: ora risponde «domani, lunedì 16 novembre 2026», nessun doppione. Resta un «Controllalo» legittimo quando il modello conta a mente («34 impegni»).

## Su work
Solo la funzione `memo-chat`. Nessuna migrazione.

## Seconda correzione dello stesso pacchetto: «Non riesco a leggere i dati» (15/11 sera)
Alessio ha chiesto sul telefono «Quanto ho speso finora sul piano per le attrezzature della cucina?» e la chat si è fermata con «Non riesco a leggere i dati in questo momento. [P1]–[P17] (17 righe)», due volte.

**Causa (riprodotta su Prova con 17 sottovoci)**: per sommare lo speso delle 17 sottovoci di «Attrezzature cucina» il modello usa lo strumento di calcolo, che accettava al massimo 12 numeri; con 17 sollevava un errore, e l'errore buttava via tutta la risposta (e non lasciava traccia: la funzione inghiottiva ogni errore). Su Prova non era mai comparso perché lì lo speso è zero e il modello non calcola.

**Correzione**: il calcolo accetta fino a 500 numeri; un errore di uno strumento torna al modello come errore (`is_error`) invece di far fallire la risposta; ogni errore resta nei registri della funzione (`console.error`) e nel registro del messaggio (`strumenti`). Provato su Prova con la stessa situazione: ora risponde (somma 1.853 € corretta).

## Terza correzione: le prove di Alessio del 16/11 (30 domande)
Alessio ha provato 20 + 10 domande sul telefono (liste in `LISTA_prove_chat_MEMO_15-11.md` e `..._2_16-11.md`; risultati Prova in `RISULTATI_venti_domande_Prova_15-11.md`). Esito su work: 3 giuste, 2 a metà, 5 sbagliate; mai un dato inventato. Cause e correzioni (tutte in questo pacchetto, tranne la lettura libera, che è un lavoro a parte):
- **Il ragionamento mangiava la risposta**: il modello «ragiona» prima di rispondere e il ragionamento conta nello stesso tetto delle parole in uscita (1.500): con tante righe finiva tutto a ragionare → risposta vuota (agenda) o ferma a «controllo i dati» (la seconda spesa più grande). Ora il tetto è 8.000, la risposta tagliata lo dice, e il registro (`strumenti`) salva come è finito ogni giro del modello (fine, blocchi, token).
- **Taglio a 50 righe**: il piano ha 63 voci, e per pescare le altre MEMO finiva gli 8 passaggi. Ora le letture arrivano a **150 righe** (migrazione `20261115000018`) e i passaggi sono 20 (giri 10, tetto per domanda 0,50 €).
- **Messaggio sbagliato**: il pannello diceva «Il tetto della chat è stato raggiunto» invece del motivo vero; ora mostra il motivo che manda la funzione.
- **Descrizioni incomplete**: MEMO non sapeva che esiste il campo «stato» e disse che non c'è. Ora ogni strumento elenca tutti i suoi campi e dice che la ricerca filtra solo il testo.
- **Regole nuove**: mai annunciare un controllo senza farlo né lasciare risposte vuote; «non l'ho trovato con questa ricerca» e non «non esiste»; previsto non è speso (per «la spesa più grande» guarda le uscite di cassa); per classifiche leggere tutto e dichiarare quanti elementi.
- **«Controllalo» finto**: il costo di apertura di un documento (0,20 €) è scritto dal server e non conta come numero inventato.

## Come si è provato
Su Prova: 8 domande che prima fallivano (magazzino, fornitori, spesa più grande e la seconda nella stessa conversazione, agenda, riepilogo piano, SCIA, cosa non va nei conti) ora completano tutte, con risposte coerenti (costo medio 0,12 €). Su work serve il rilascio.

## Su work
Migrazione `20261115000018` e funzione `memo-chat`, più il sito (pannello). Copia prima.
