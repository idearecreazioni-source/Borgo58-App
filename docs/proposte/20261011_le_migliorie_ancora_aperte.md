# Le migliorie ancora aperte — relazione consegnata da Alessio l'11/10/2026

> Testo consegnato da Alessio in chat l'11/10/2026 e riportato qui com'è, perché
> non resti solo dentro una conversazione. Le voci sono state riportate in
> [`RICHIESTE.md`](../RICHIESTE.md) (righe nuove `U1`, `C12`, `R14`, `N19`,
> `N20`, `N21`, `N22`; aggiornate `R12`, `C5`, `C11`). La relazione **non
> autorizza** modifiche, migrazioni, rilasci o unioni: ogni voce parte con un
> suo mandato.
>
> ⚠️ Lo stato delle tre voci «già fatte» con una migrazione (R12, C5, C11) è
> stato ricontrollato l'11/10 sul ramo `master`: le loro migrazioni ci sono
> (`20260922000001`, `20260923000002`, `20260923000003`, `20260923000004`,
> `20260921000003`). Le altre voci di «già fatto» non sono state ricontrollate
> una per una.

---

## Scopo

Questa relazione chiarisce quali migliorie risultano ancora da progettare o realizzare, separandole da quelle già presenti nel codice. Non autorizza modifiche, migrazioni, deploy, merge o collegamenti a Prova/produzione.

Il registro storico `RICHIESTE.md` non è aggiornato rispetto agli ultimi merge: prima di aprire un lavoro, lo stato va ricontrollato sul ramo di riferimento e nei resoconti più recenti.

## Già fatto e da non duplicare

Le seguenti richieste non vanno riprese come nuove migliorie:

* Importazione ricette da link Clove: il link genera una bozza, si leggono i dati esposti dalla pagina e la ricetta entra nel Ricettario solo dopo conferma.
* Agenda: vista settimanale, task ricorrenti anche ogni N giorni, dicitura "task", minuti selezionabili a quarti d'ora, promemoria che segue la ricorrenza e solleciti Telegram ripetuti fino alla chiusura.
* Correzioni responsive già affrontate: campi data/ora, filtri affiancati, comportamento touch del "?", collegamento improprio da Cassa/Banca/Prima nota a Comande.
* R12: resa delle ricette espressa come lordo → netto.
* C5: chiusura annuale fiscale, lato codice.
* C11: costo del progetto con etichetta investimento, separato per Borgo 58, Tasca e totale.

## 1. Restyling e audit estetico trasversale

**Obiettivo.** Rendere il gestionale ordinato, coerente e leggibile su telefono e computer, eliminando disallineamenti, spaziature casuali, pulsanti sproporzionati, form troppo densi o troppo vuoti e differenze ingiustificate fra moduli.

**Cosa deve fare davvero**

* Effettuare un censimento visivo, non una correzione casuale schermata per schermata.
* Verificare desktop e telefono sulle componenti riusabili: intestazioni e toolbar; filtri; form; bottoni principali e secondari; card; tabelle ed elenchi; modali e avvisi; menu laterale e componenti comuni.
* Individuare le regole CSS o componenti condivisi che causano i difetti, privilegiando correzioni riusabili.
* Misurare e documentare le anomalie prima della modifica e mostrare il prima/dopo per le aree toccate.
* Evitare spiegazioni superflue: una didascalia resta solo quando previene un errore economico, legale, irreversibile o un'ambiguità reale.

**Palette da sperimentare prima nella Dashboard.** La prima prova va eseguita solo sulla Dashboard, senza propagare automaticamente il cambiamento all'intera app.

* Beige di fondo: più chiaro dell'attuale.
* Verde del logo: sostituisce l'attuale arancione scuro per azioni principali, elementi attivi e stati positivi.
* Terracotta/arancione: resta come accento, non come colore dominante dell'azione principale.
* La prova deve essere valutata sia su desktop sia su telefono, con contrasto e leggibilità verificati.

**Fuori scope.** Non rifare la struttura funzionale dei moduli. Non cambiare nomi, comportamenti o flussi solo per ragioni estetiche. Non applicare subito il nuovo tema a tutto il gestionale.

**Criteri di accettazione**

* Nessun campo, bottone o etichetta sborda o appare sovrapposto alle larghezze di prova.
* Gli elementi della stessa famiglia hanno allineamenti e misure coerenti.
* La Dashboard con la nuova palette è confrontabile visivamente con l'attuale su telefono e computer.
* Il desktop non peggiora per risolvere il telefono, e viceversa.
* Il risultato viene sottoposto ad Alessio prima dell'estensione al resto dell'app.

## 2. Spese "da collocare"

**Obiettivo.** Consentire ad Alessio di registrare al volo una spesa detta a MEMO o fotografata, senza trasformarla subito in un movimento contabile o fiscale. Esempi: "Segna 100 euro di spesa in cartolibreria"; foto di uno scontrino; foto di una ricevuta Temu; nota vocale relativa a carburante, acquisto personale o spesa societaria non ancora classificata.

**Cosa deve fare davvero**

* MEMO foto e MEMO voce creano un appunto di spesa provvisorio quando non sono disponibili abbastanza informazioni per una registrazione corretta.
* L'appunto conserva ciò che MEMO ha capito: importo, data eventuale, esercente o controparte, possibile natura della spesa, testo originale, foto e grado di incertezza.
* L'appunto non deve creare: un movimento in Prima nota; una spesa della Tasca; una registrazione fiscale; un costo deducibile; un rimborso o anticipo.
* Deve esistere un elenco chiaro, separato dalla contabilità, con un nome da decidere fra "Da collocare", "Spese da collocare" o equivalente.
* Da PC, Alessio deve poter aprire un appunto e scegliere consapevolmente la destinazione corretta: Tasca; Prima nota della società; anticipo/rimborso; Archivio documenti; ignorare/eliminare l'appunto.
* La collocazione finale deve avvenire una sola volta, senza doppio conteggio.

**Decisione ancora necessaria.** Scegliere il nome definitivo dell'area e le esatte azioni disponibili nella schermata di collocazione.

**Criteri di accettazione**

* Una foto o frase incompleta lascia una traccia consultabile, non una registrazione sbagliata.
* L'appunto mostra chiaramente che non è ancora contabilità.
* L'utente può risalire all'originale prima di decidere.
* Collocare l'appunto in una destinazione genera un solo dato definitivo.

## 3. Ricettario: "Estrapola" e lista della spesa

**Obiettivo.** Usare le ricette per aiutare a preparare la lista della spesa, senza fare acquisti automatici né confondere fabbisogno teorico e ordine al fornitore.

**Cosa deve fare davvero**

* Aggiungere un gesto "Estrapola" nel punto appropriato del Ricettario.
* Consentire di selezionare ricette, quantità o porzioni e ottenere gli ingredienti necessari.
* Consolidare ingredienti uguali e rispettare unità e quantità.
* Mostrare il risultato come proposta controllabile prima di inserirlo nella lista della spesa.
* Segnalare dati mancanti, quantità non confrontabili o ingredienti non collegati, senza inventare conversioni.

**Fuori scope.** Nessun ordine automatico. Nessuna modifica automatica di magazzino. Nessuna previsione di consumi non richiesta.

**Criteri di accettazione**

* Da ricette diverse lo stesso ingrediente appare una sola volta con quantità consolidata quando possibile.
* Ogni riga mantiene il collegamento alle ricette che l'hanno generata.
* L'utente può controllare e modificare la proposta prima dell'inserimento nella lista.

## 4. MEMO voce: conferma parlata dell'allineamento

**Obiettivo.** Quando MEMO registra con successo una giacenza o un allineamento dettato, deve poter rispondere anche a voce.

**Stato.** Da fare. In passato non è stato chiuso perché nell'ambiente disponibile mancava un modo affidabile per provare l'ascolto reale.

**Cosa deve fare davvero**

* Dopo una registrazione vocale riuscita, offrire una risposta parlata breve e inequivocabile.
* La risposta deve ripetere solo gli elementi utili alla verifica: prodotto, quantità e unità, oppure errore concreto.
* Non sostituire la conferma visiva.
* Essere disattivabile se risulta fastidiosa.

**Rischi.** Browser e dispositivi diversi gestiscono in modo diverso la sintesi vocale. Non va dichiarata affidabile senza una prova manuale su telefono reale.

## 5. Carta vini: forma dell'editor e carta da ristampare

**5.1 Editor della carta vini.** La selezione dei prodotti idonei è già presente. Resta da rendere l'editor della carta vini coerente, nella forma e nell'esperienza, con l'editor del menu. Deve mantenere una distinzione fondamentale: un prodotto di magazzino non è automaticamente una riga della carta. La stessa bottiglia può comparire in più forme, per esempio al calice e in bottiglia.

**5.2 Schermata "Carta da ristampare".** Il gestionale sa già calcolare se una carta è invecchiata rispetto all'ultima stampa, considerando data di stampa e cambiamenti delle voci. Manca la schermata che espone questo risultato e consente di registrare una nuova stampa. Deve: mostrare quali sezioni richiedono attenzione; spiegare in modo sintetico il perché; permettere di segnare la carta come stampata; non generare allarmi automatici invasivi.

## 6. Elementi non pronti perché richiedono decisioni o dati esterni

Questi punti non sono semplici migliorie eseguibili immediatamente:

* collegamento bancario ed importazione estratti conto: prima scelta della banca;
* registratore telematico: prima scelta dell'apparecchio e risposta del fornitore sulla segnalazione della carta esaurita;
* report per commercialista e confronto con la sua chiusura: serve la forma richiesta dalla commercialista e il primo documento reale;
* fatture cloud: richiedono piano Complete e accesso;
* costo del personale e simulatore di assunzione: servono documenti e dati reali;
* autoprodotti agricoli: rinviati all'apertura dell'azienda agricola;
* sito pubblico e posta clienti: da riprendere come progetti separati;
* scheda ingrediente unica, doppio turno nel tavolo, storico affidabile dei task completati e decisione sulle tabelle del registro cancellazioni.

## 7. Blocco tecnico distinto dalle migliorie

Il percorso protetto per il preflight di produzione non è un intervento grafico né una funzione utente, ma resta aperto.

È già progettata la soluzione: identità dedicata, funzioni di misura ristrette e adattatore che permetta solo letture previste. Prima di misurare o rilasciare migrazioni in produzione occorrono decisioni su credenziali, collaudo su Prova e utilizzo del programma protetto.

Non va confuso con i lavori dell'interfaccia e non deve rallentare la progettazione delle migliorie elencate sopra.
