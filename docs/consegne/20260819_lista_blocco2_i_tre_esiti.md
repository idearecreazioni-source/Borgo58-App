# Lista della spesa — blocco 2: i tre esiti, e l'uscita che esce davvero

**Mandato**: [`20260817_la_lista_non_scrive_uscite.md`](../mandati/20260817_la_lista_non_scrive_uscite.md),
deciso da Alessio il 17/08; ampiezza confermata il 19/08.
**Migrazione**: `20260819000003_i_tre_esiti_e_l_uscita_vera.sql` — **applicata
sul progetto di prova, NON in produzione** (aspetta il push).
**Corridoio**: versione **13**, installata sul progetto di prova.
**Contratto**: **modificato** (§5, riga del Magazzino) — vedi sotto.

---

## ⚠️ Cosa NON è verificato

1. 🔴 **Nessuna mano ha toccato questa schermata.** I tre pulsanti, il menu
   del mezzo, la causale, la frase che dice cosa succederà: tutto è provato
   da 7 prove sui dati veri e da 20 controlli dentro la migrazione, **nessuna
   prova di questo progetto guarda una schermata**.
2. 🔴 **In produzione non è mai uscito un euro da qui**: zero movimenti di
   prima nota, zero righe chiuse. Il giro «chiudo la riga → il cassetto cala
   davvero» non l'ha mai fatto nessuno.
3. ⚠️ **Il regalo non è mai stato provato su un ingrediente con uno storico
   prezzi vero**: le prove creano un ingrediente proprio, quindi lo storico è
   vuoto per costruzione. Quello che è provato è che **non ci scrive niente**
   — non che convive bene con uno storico pieno.
4. ⚠️ **La causale è una proposta della schermata**, non del database: se
   Alessio non ne sceglie una, il movimento nasce **senza causale** e finirà
   fra i costi da classificare. È un comportamento voluto (nessuna causale
   inventata), ma nessuno l'ha ancora visto in Cassa.
5. ⚠️ **Il prezzo di listino non si aggiorna nemmeno quando compri davvero.**
   Comprando 10 kg a 40 €, il lotto costa 4 €/kg ma `current_price` resta
   quello di prima. **Era già così** prima di questo blocco — non è una
   regressione — ma adesso che la strada è la via normale vale la pena
   deciderlo: oggi il food cost segue solo i prezzi che arrivano dalle
   fatture.
6. ⚠️ **La raccolta propria non entra**, per decisione di Alessio (si farà
   con l'azienda agricola). Vedi sotto come si è evitato che «gratis»
   diventasse la strada sbagliata.

---

## Cosa abbiamo rovesciato

**Un rovesciamento**, il n. 17 del
[registro](../decisioni_rovesciate.md): *«la lista della spesa ha un
vocabolario dei pagamenti tutto suo»* (17/08).

- **Cosa era stato deciso**: `PAYMENT_METHODS_SPESA` separato da
  `PAYMENT_METHODS`, nato da un difetto vero — il menu offriva «assegno» e il
  database lo rifiutava.
- **La ragione di allora**: non allargare un vincolo per far tornare un
  conto. *Quale sia il vocabolario della sua spesa lo decide Alessio.*
- **Cosa si decide adesso**: un elenco solo, assegno compreso.
- **Perché la ragione non vale più**: la separazione poggiava su un fatto che
  è cambiato — quella schermata **non sapeva cosa farsene del mezzo**. Da
  oggi il mezzo decide da dove escono i soldi, quindi la domanda è la stessa
  delle fatture e la risposta anche.

---

## Il buco che questo blocco chiude

> 40 € in contanti al contadino, riga chiusa senza scrivere niente. La sera
> il conteggio del cassetto mostra un **ammanco di 40 € che non esiste**, e
> quella differenza finisce in prima nota come rettifica di un errore mai
> avvenuto.

**È lo stesso meccanismo delle mance su carta** (16/08): un movimento vero
che nessuna schermata registra, e un conteggio che poi accusa il cassetto.
Per questo «l'ho comprato e pagato» **non è un di più: è la via normale**, ed
è il pulsante già selezionato quando il modulo si apre.

---

## I tre esiti, e perché sono tre

| esito | riga | magazzino | prima nota |
|---|---|---|---|
| **L'ho comprato e pagato** | chiusa, con importo e mezzo | entra col suo costo | **uscita vera** |
| **Me l'hanno regalato** | chiusa, importo 0 | **entra, a costo zero** | niente |
| **Non l'ho preso** | **cancellata** | niente | niente |

⚠️ **Confondere gli ultimi due mette in magazzino merce mai arrivata**, ed è
il motivo per cui il terzo esiste come esito e non come «annulla». La
schermata lo dice dove serve: scegliendo «non l'ho preso» compare *«niente
merce in magazzino: se invece te l'hanno regalata, scegli Avuta gratis»*.

⚠️ **Il regalo vale zero per quella volta, non per sempre**: il lotto nasce a
costo zero — ed è vero, quello che si consuma da lì è gratis — ma
`price_history` e `ingredients.current_price` **non si toccano**. Da lì nasce
il food cost su cui Alessio decide i prezzi del menu: un regalo che abbassa
il listino li abbassa **tutti**. Provato in tutti e due i modi: il listino
resta dov'era, e nello storico non compare niente.

⚠️ **«Gratis» non è la porta di servizio dell'erba spontanea.** La raccolta
propria ha la sua strada (`foraged_items`, il registro HACCP con specie,
luogo, chi ha raccolto) e non si costruisce adesso. Qui l'esito si chiama
**«Me l'hanno regalato»**, non «gratis», e il lotto porta scritto *«Omaggio
del fornitore»*: chi cerca dove registrare l'erba spontanea non trova una
strada che sembra quella giusta. *Se la strada giusta non c'è, quella
sbagliata non deve nemmeno sembrare disponibile.*

---

## Il mezzo si vede, e lì si cambia

Contante di partenza — il caso normale è il mercato — ma **visibile nel
momento della conferma**, insieme alla causale. È la stessa forma della
scelta della riga (blocco 1-bis) e della regola del 17/08:

> *Un predefinito che si vede è una comodità; uno che riempie un campo che
> nessuno guarda è la famiglia dei 33 posti silenziosi.*

E la schermata dice **cosa succederà prima che succeda**: «esce un'uscita di
prima nota dalla cassa, e la merce entra in magazzino».

---

## Una regola sola su dove vanno a finire i soldi

`mezzo_del_pagamento(metodo)` — contante → cassa, tutto il resto → banca.

⚠️ **Esiste per togliere un doppione, non per comodità**: lo stesso `case`
stava dentro `pay_supplier_invoice` e sarebbe stato riscritto qui. Il
discriminante del 17/08 risponde secco: le due copie direbbero
**esattamente** la stessa cosa → doppione da togliere, non caso da
sorvegliare. `pay_supplier_invoice` è stata **ripresa dal database** (regola
del 18/08) e adesso la chiama.

⚠️ **Restano due concetti distinti**: il **metodo** è lo strumento con cui si
paga, il **mezzo** è dove i soldi stanno. Questa funzione è il ponte, ed è
l'unico. La verifica controlla che nel corpo di `pay_supplier_invoice` il
vecchio `case` non ci sia più.

---

## La vecchia porta è stata chiusa, non lasciata accanto

`close_shopping_list_item` è stata **cancellata dal database**, tolta
dall'elenco del corridoio e dal client. ⚠️ Lasciarla in piedi avrebbe
significato **due modi di chiudere una riga**, uno dei quali col vocabolario
vecchio e **senza uscita in prima nota**: cioè il difetto che questo blocco
chiude, ancora raggiungibile da chi conoscesse il nome.

---

## 🔴 Il Contratto è stato modificato — §5, riga del Magazzino

**Autorizzato da Alessio il 19/08** (Sezione 0), su un fatto misurato dalla
validazione, e **dichiarato qui** come impone la condizione del 14/08.

- **Il testo precedente resta scritto**: `| Magazzino | Costruito | A |`.
- **Il fatto**: `register_stock_delivery` scrive **due** tabelle
  (`stock_lots` e `shopping_list_items`) dal blocco 1 di oggi, e resta
  chiamata **direttamente via RPC**. La riga «A» non descriveva più il fatto.
- **Constatazione, non lasciapassare**: la riga dice cosa fa il codice, non
  cosa gli è permesso fare.
- **L'atomicità c'è**: le due scritture stanno in **una sola** funzione, in
  **una sola** transazione — o entrano entrambe o nessuna.
- ⚠️ **Quello che manca non è l'atomicità: è l'osservabilità.** Il corridoio
  è anche il punto unico dove un'operazione fallita si vede, si registra e si
  ritenta, e l'elenco che rende controllabili le scritture multi-tabella.
  Passando per RPC diretta, un fallimento non compare lì.
- ⚠️ **Non è una deriva di oggi**: `esegui_azione_posta` scrive **sei**
  tabelle (`documents`, `tasks`, `articoli_fornitore`,
  `haccp_goods_receiving`, `posta_azioni`, `posta_ricevuta`) ed è invocata
  via RPC diretta, col modulo elencato «A».
- **La condizione di Alessio**, parole sue: quando il discorso si affronterà
  per intero, *si dovrà ricontrollare che questa eccezione non causi
  problemi*. Il lavoro non è spostare due funzioni: è **decidere cosa il
  corridoio debba coprire**, e verificarlo su tutte le operazioni nella
  stessa condizione.

---

## Le prove, e la controprova

**7 prove nuove sui dati veri** (`tests/app/tre-esiti-lista.test.js`), più 20
controlli dentro la migrazione.

⚠️ **Si entra dal corridoio, non dalla funzione**: è la strada che usa il
gestionale, e un'operazione dimenticata nell'elenco risponde 404 senza che
nessuna prova SQL se ne accorga.

⚠️ **Ogni prova parte pulita** (`beforeEach`): le prime due contavano i
movimenti e fallivano **per il residuo della precedente**, non per un
difetto. *Chi conta i rossi conta i difetti solo se le prove sono
indipendenti.*

### La controprova — tre rotture sulla funzione viva

| rottura | prove rosse |
|---|---|
| «comprata» non scrive più il movimento in prima nota | **2** (comprata, assegno) |
| il regalo aggiorna il prezzo di listino | **1** |
| «non presa» prosegue e carica il lotto | **1** |

⚠️ Fatte **scrivendo direttamente sul database di prova**, cioè scavalcando
il file della migrazione: se le prove guardassero solo ciò che la migrazione
dichiara, non se ne sarebbero accorte.

⚠️ **Una quarta rottura non è stata fatta e va detto**: il primo tentativo di
rompere «non presa» non compilava, quindi **non ha deployato niente e le
prove sono rimaste verdi**. Una rottura che non arriva al database non è una
controprova — è un verde che sembra una conferma. È stata rifatta.

### Due prove esistenti sono state girate, non aggirate

- **`tests/app/scritture-dal-corridoio.test.js`** nominava
  `close_shopping_list_item`: adesso nomina `chiudi_riga_lista`. Una prova
  che sorveglia una porta che non esiste non sorveglia niente.
- **`tests/app/vocabolari.test.js`** difendeva la *separazione* dei due
  vocabolari. Adesso difende l'*unione*: i due elenchi devono essere uguali,
  e `PAYMENT_METHODS_SPESA` non deve esistere. ⚠️ La rete non è stata
  indebolita — è stata **girata**, e il commento dice perché.

### Un'esenzione dichiarata nella rete dei vocabolari

`chiudi_riga_lista(p_esito)` accetta *comprata, gratis, non_presa*; la colonna
`esito` ammette *comprata, gratis, arrivata_con_documento*. ⚠️ **Non è un
disallineamento**: sono due elenchi che rispondono a due domande diverse —
cosa si può *scegliere* chiudendo a mano, e cosa si può *scrivere* in quella
colonna. «non_presa» cancella la riga; «arrivata_con_documento» lo scrive il
gestionale. Dichiarata in `GUARDIE_ESENTI` con la sua ragione, come la rete
prevede.

---

## Per Alessio, in una riga

Chiudendo una riga della lista adesso scegli **come è andata**: comprata e
pagata (e i soldi escono davvero dalla cassa), regalata (la roba entra ma non
esce un euro), oppure non l'ho presa (la riga sparisce e non entra niente).

---

**Commit**: dichiarato al momento del commit finale di questa consegna.
