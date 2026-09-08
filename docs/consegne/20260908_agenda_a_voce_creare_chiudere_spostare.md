# MEMO operativo — Agenda, fase 1: creare, chiudere, spostare

**08/09/2026.** Riepilogo di consegna.

* **HEAD dichiarato**: `066f263` — l'unico commit di lavoro del ramo, aperto da `fdfea8d` (la cima di `master`).
* **Ramo**: `memo-agenda`.
* **Migrazioni**: **nessuna.** È un vincolo del mandato, ed è anche ciò che
  decide la forma della consegna (vedi «Il confine, misurato»).
* **Funzione online**: `ascolta-voce` — installata **solo sul progetto di
  prova** (v29 → v30). In produzione non è stato toccato niente.
* **Prove**: 1.224 pure · 70 sulle schermate · 559 contro il progetto di
  prova · lint pulito · compilazione pulita.
  ⚠️ **Tre prove restano rosse in locale e sono PREESISTENTI su `master`**
  (2 sugli indici dei documenti, 1 sulle schermate `rotte-chiuse`):
  rimisurate sul ramo `master` non toccato, stesse tre. Non dipendono da
  questo lavoro.
* **Chiamate live al modello**: **5** delle 8 concesse, per **0,49 €** sul
  progetto di prova (35.300 token di domanda l'una, ~135 di risposta).

## Che cosa cambia

Sull'Agenda Alessio dice **tre cose diverse**, e finora il gestionale ne
capiva una:

| quello che dice | che cos'è | prima |
|---|---|---|
| «Ricordami di chiamare Tiziana domani» | un impegno **nuovo** | funzionava |
| «Segna come fatto il rinnovo della firma digitale» | un impegno che **esiste** e si chiude | 🔴 nasceva un impegno NUOVO |
| «Sposta a venerdì l'ordine delle verdure» | un impegno che **esiste** e si sposta | 🔴 nasceva un impegno NUOVO |

🔴 **Il difetto era silenzioso e produttivo, che è la combinazione peggiore.**
Il modello riconduceva le ultime due alla cosa più vicina che conosce — un
promemoria — quindi nasceva un impegno intitolato «Segna come fatto il
rinnovo della firma digitale», **approvabile**, accanto a quello vero che
restava aperto. Due righe per lo stesso fatto, nessun errore da nessuna
parte, e l'Agenda che si riempie di doppioni proprio quando la si usa di più.
È la stessa forma del difetto del 06/09 sulle due liste della spesa.

**Adesso** le tre cose restano tre. La prima si approva e scrive in Agenda
come sempre; le altre due producono un appunto che **non si può approvare** e
che dichiara qual è il gesto che manca, con il collegamento all'Agenda per
farlo a mano.

## Il confine, misurato — e perché la consegna finisce lì

Il mandato vieta le migrazioni, e la misura dice che senza migrazione le
ultime due non si possono **eseguire**:

1. **la catena vocale non sa risolvere un impegno che esiste**: `voce_catalogo`
   — l'elenco che il gestionale passa al modello — contiene causali, pulizie,
   prodotti, fornitori, vocabolari, frigoriferi, preparazioni e conti
   correnti, e **non contiene gli impegni**;
2. **non esiste nessun ramo che chiuda o sposti un impegno**: il catalogo
   `tipi_azione_vocale` ha 14 tipi accesi, `promemoria` fra questi, e nessuno
   per «segna fatto» o «sposta».

Aggiungere l'esecuzione vuol dire **una riga nel catalogo e un ramo in
`fai_azione_dettata`**, cioè una migrazione. Quindi non è stata fatta.

⚠️ **E il guadagno vero non è rimandato**: oggi quelle due frasi scrivono una
riga sbagliata; dopo questo lavoro non ne scrivono nessuna e dicono cosa
fare. *Togliere un doppione che nasce da solo vale più di aggiungere un gesto
che si può fare a mano in due tocchi.*

## Come fa a non essere approvabile

🔴 **Non c'è nessun controllo nuovo da ricordare, ed è il punto.**
`siPuoApprovare()` guarda `appunto.eseguibile`, che il **database** ricava dal
catalogo delle azioni vocali. I tre tipi nuovi
(`agenda_da_segnare_fatto`, `agenda_da_spostare`, `agenda_quale_impegno`) nel
catalogo non ci sono, quindi nascono non approvabili **per costruzione** —
lo stesso meccanismo con cui, il 07/09, un anticipo da rimborsare non è
potuto finire nella tasca.

⚠️ **E se un giorno uno dei tre entrasse nel catalogo col suo ramo,
diventerebbe approvabile da solo**: è la strada per costruirlo, non un
ostacolo. La prova end-to-end diventa rossa in quel momento, ed è il momento
giusto per riscriverla.

## Chi decide: il dettato, non il riassunto del modello

Il modulo nuovo `supabase/functions/ascolta-voce/agenda.ts` è la **terza rete
deterministica** dopo `destinazioni.ts` (le liste) e `tasca.ts` (di chi sono
i soldi), e si applica nello stesso ordine dentro `index.ts`.

Due strade, e la deterministica ha l'ultima parola:

* al **modello** si chiede di distinguere le tre cose, con la ragione scritta
  accanto (`istruzioniAgenda()`) — perché una riga senza il suo perché viene
  tolta dal primo che la trova ridondante;
* la **rete** guarda le parole della frase **detta**, non il riassunto del
  modello: *un riassunto scritto da chi interpreta non è una fonte, è già
  un'interpretazione* (lezione del 07/09).

⚠️ **È un elenco di parole, e regge perché sbaglia in un verso solo.** Una
frase che l'elenco non riconosce resta quello che il modello aveva capito
(di solito un promemoria): rumore, si butta in un tocco. Il verso pericoloso
— un impegno nuovo scambiato per una chiusura — non può capitare, perché
«segna come fatto» e «sposta» in una frase che crea qualcosa non ci sono.

## Quello che non si inventa

* **La data non si mette al posto suo.** «Sposta l'ordine delle verdure»,
  senza dire a quando, produce un appunto che **chiede** — mettere «domani»
  sarebbe decidere su una scadenza, e la riga entrerebbe plausibile senza
  nessun errore. Stessa cosa se manca il nome dell'impegno.
* **Le cose che mancano si nominano tutte insieme**, non una per volta:
  dirne una fa scoprire la seconda dopo aver rimediato alla prima, e alla
  terza si smette di leggere.
* **Una data che non ha la forma di una data non è una data**: `dataNuova()`
  accetta solo `AAAA-MM-GG`, altrimenti dichiara di non aver capito.
* 🔴 **Il giorno PRECEDENTE non c'è, e non è una dimenticanza.** Il mandato
  chiede di mostrare «data precedente e nuova quando esistono»: qui la
  precedente **non esiste**, perché il gestionale non sa quale impegno sia.
  Scriverla vorrebbe dire inventarla.

## Il collegamento all'Agenda

🔴 **Un rifiuto senza via d'uscita è un vicolo cieco** (16/08), e qui il
rifiuto è per costruzione. La via d'uscita normale — «fallo a mano coi campi
già compilati» — arriva da `azione_percorso` **nel database**, che per un tipo
fuori catalogo risponde giustamente niente; aggiungercelo sarebbe una
migrazione.

⚠️ **Una mappa scritta nel browser sarebbe peggio**, ed è la ragione scritta
accanto a quel collegamento dal 27/08: il giorno che nasce un tipo nuovo
porterebbe da nessuna parte, e nessuna verifica se ne accorgerebbe. Quindi il
posto lo dichiara **chi decide il tipo** — `agenda.ts` — e la schermata si
limita a mostrarlo: la stessa forma del `DOVE` delle risposte consultive. Un
tipo nuovo o porta il suo posto, o non mostra nessun collegamento; mai uno
che porta altrove.

⚠️ **E non è la stessa cosa di «coi campi già compilati»**: lì c'è un modulo
da riempire, qui c'è un impegno da **cercare**. Promettere campi compilati su
una cosa che il gestionale non sa nemmeno trovare sarebbe una bugia.

⚠️ L'indirizzo **non compare fra i dati concreti** dell'appunto (`dove` entra
fra i campi di servizio): mostrarlo direbbe a chi firma che sta autorizzando
un indirizzo.

## Un dettaglio piccolo che si legge prima di firmare

Il modello chiama il nome dell'impegno in tre modi (`impegno`, `titolo`,
`nome`) e l'appunto li mostrerebbe **tutti**, uno accanto all'altro, con lo
stesso valore: chi legge prima di approvare si chiederebbe quali sono le due
cose. Il nome resta **uno solo**. ⚠️ Si tolgono i doppioni del nome, non i
dati: una descrizione detta resta, perché è roba sua.

## Il collaudo dal vivo, cinque frasi sul progetto di prova

| frase | esito misurato |
|---|---|
| «Ricordami di chiamare Tiziana domani» | `promemoria` · titolo «Chiamare Tiziana» · data **2026-09-09** |
| «Aggiungi il rinnovo della firma digitale per venerdì» | `promemoria` · data **2026-09-11** |
| «Segna come fatto il rinnovo della firma digitale» | `agenda_da_segnare_fatto` · titolo **nudo** («rinnovo della firma digitale», senza il verbo) · non approvabile |
| «Sposta a venerdì l'ordine delle verdure» | `agenda_da_spostare` · titolo «ordine delle verdure» · **data_nuova 2026-09-11** · non approvabile |
| «Quanto ho in cassa?» | **domanda** · 0 azioni · 0 appunti |

⚠️ **La quinta è quella che discrimina in un secondo verso**: una regola che
dirottasse tutto romperebbe le domande consultive, e le prime quattro
passerebbero lo stesso. Le righe di prova sono state **cancellate** subito
dopo, per identificativo.

## Le prove, e cosa dimostrano

* **27 pure** (`tests/unita/agenda-a-voce.test.js`): le tre intenzioni, le
  parole, quello che manca, la data che non si inventa, il collegamento, il
  nome scritto una volta sola, e — la metà che discrimina — **un promemoria
  che resta un promemoria**.
* **11 sulle schermate** (`tests/schermate/appunto-agenda.test.jsx`): ciò che
  si vede **prima di firmare**, costruito dalla regola vera e non a mano.
  Niente pulsante «Approva», la frase che dice cosa fare in Agenda, il
  collegamento con il suo indirizzo.
* **7 contro il progetto di prova** (`tests/app/agenda-a-voce.test.js`): il
  catalogo che non conosce i tre tipi, l'Agenda **contata** prima e dopo, il
  corridoio che **rifiuta** l'approvazione, e il promemoria che approvato
  crea davvero l'impegno con la sua data.

⚠️ **Si conta l'Agenda invece di leggere lo stato scritto sulla riga**: «in
attesa» e «non ha prodotto niente» sono due affermazioni diverse, ed è la
seconda che SPEC-0013 pretende.

## Cosa abbiamo rovesciato

**Niente.** Le regole dell'Agenda sono quelle che ci sono, il calendario è
quello che c'è, il gesto del promemoria non cambia di una virgola. L'unica
decisione che si tocca è **dove nasce il collegamento a mano di un appunto**:
dal 27/08 arriva dal database, e per due tipi che nel database non esistono
arriva dal modulo che li decide. ⚠️ La ragione del 27/08 — *«una mappa nel
browser porterebbe da nessuna parte»* — **vale ancora**, ed è proprio quella
che ha deciso la forma: il posto viaggia dentro l'appunto, non dentro la
schermata.

Nessuna riga in `docs/decisioni_rovesciate.md`.

## Cosa NON è verificato

1. **Nessun occhio ha guardato la schermata**: l'appunto e il collegamento
   sono provati dal codice, non visti. Sul telefono non li ha ancora aperti
   nessuno.
2. **Il modello è provato su cinque frasi.** Che capisca tutte le
   formulazioni possibili non lo dimostra nessuna prova; quello che è
   dimostrato è che, qualunque cosa dichiari, sono **le parole di Alessio** a
   decidere.
3. **Gli elenchi di parole invecchiano**, ed è dichiarato: un sinonimo che
   manca lascia un promemoria come prima, non un impegno chiuso per sbaglio.
4. **Non è stato provato con un impegno vero in Agenda** che si chiamasse
   come quello detto — e non lo sarebbe comunque, perché il gestionale non lo
   cerca: il confine di questa consegna è esattamente lì.
5. **In produzione non è stato installato niente** e non è stata fatta
   nessuna dettatura sul gestionale vero.
