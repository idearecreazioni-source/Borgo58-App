# La giornata proposta — la seconda metà della regola delle 5

**Nessuna migrazione**: al database non serviva niente. La prima metà
(`20260819000006`) gli aveva già dato la risposta; qui la risposta arriva
dove la si guarda.
**Deciso da Alessio** il 19/08/2026: *cassa e conti propongono la giornata
operativa — la stessa risposta della funzione del database, non una regola
ricopiata in JavaScript*; prenotazioni, turni, scadenze e HACCP restano sul
calendario, **e va dichiarato dove si legge**.

---

## ⚠️ Cosa NON è verificato

1. 🔴 **Nessuna prova automatica guarda una schermata**: in questo progetto
   non c'è un ambiente DOM. Quello che è provato è **quale giornata** viene
   proposta, non che si veda. In particolare **nessuno ha visto l'avviso di
   Comande comparire**.
2. 🔴 **Nessuna mano ha aperto queste schermate dopo la modifica**, e
   nessuna delle due è mai stata usata dopo mezzanotte con dei dati dentro.
3. ⚠️ **Il predefinito del database e la proposta della schermata dicono due
   cose diverse** su `cash_movements.movement_date`: il primo è calendario
   (decisione di Alessio, perimetro stretto), la seconda è la serata. È una
   domanda per lui — vedi in fondo. Misurato che oggi **quel predefinito non
   lo usa nessuno**: tutte e quattro le funzioni che scrivono in prima nota
   passano una data esplicita, e la schermata pure.
4. ⚠️ **La data del documento fiscale (Scontrinato) va riconfrontata col
   registratore telematico** il giorno che ci sarà: lì la giornata fiscale la
   decide la macchina. È la stessa voce aperta di «chi comanda sui ricavi».

---

## Cosa abbiamo rovesciato

**Nessun rovesciamento.** In Comande la sala **continua a non cambiare da
sola** — decisione di Alessio del 18/08, *chi sta chiudendo alle 5 non deve
vedersela muovere sotto le mani* — e regge. Quello che cambia è che adesso
lo **dice**, e il passaggio lo decide chi ha il tablet in mano. La ragione di
allora non è stata smentita: era incompleta.

---

## 🔴 Il difetto: giusto sotto, sbagliato sopra

Dal 19/08 il gestionale **registra** sulla giornata giusta. Ma la schermata
**proponeva** ancora `oggiLocale()`, che alle 00:30 col locale aperto dice
**domani**. È la peggiore delle due situazioni possibili, perché il numero
sbagliato è proprio quello che Alessio conferma con le mani.

---

## Le decisioni, una per una

I punti del client che calcolano «oggi» sono stati guardati uno a uno.
⚠️ **Il conteggio girava per difetto e per eccesso insieme**: la ricerca
prendeva le parole dentro i commenti e perdeva le due schermate che scrivono
`const today = oggiLocale` e poi chiamano `today()` — cioè **Prima nota e
Sconti/Omaggi, che sono due delle schermate che contano di più**. *Un
conteggio è una fotografia, non una misura.*

### Seguono la **serata** (cassa e conti)

| schermata | cosa data |
|---|---|
| Cassa → il cassetto | la serata che si sta chiudendo *(era già così: è il gesto del perimetro)* |
| Prima nota | la giornata del movimento |
| Sconti e omaggi | la giornata dello sconto o dell'omaggio |
| Incassato e scontrinato | il periodo guardato **e** la data del documento fiscale |

⚠️ **Su «Incassato e scontrinato» non è una scelta di stile**:
`quadratura_fiscale` e `conti_da_fiscalizzare` confrontano gli estremi del
periodo con `serata_di_servizio(closed_at)`. Un «al» preso dal calendario
alle 00:30 chiedeva al database **una serata che non è ancora cominciata**.

### Restano sul **calendario**, e adesso è scritto dove

Prenotazioni, turni e ferie, scadenze e adempimenti, fatture e spese dei
fornitori, note di credito, HACCP, giorni bancari.

⚠️ **La dichiarazione sta accanto a `oggiLocale()` in `constants.js`**, non
in un documento: *uniformare quelle alla serata sarebbe un difetto, non una
pulizia*, e senza scriverlo lì il prossimo che passa lo farebbe credendo di
sistemare una dimenticanza. Più una riga sui quattro punti dove la tentazione
è più forte perché parlano di soldi (rimborso al titolare, pagamento di una
fattura, nota di credito, scadenze previste).

---

## Una regola vive in un posto solo

`useGiornataOperativa()` in `src/lib/giornataOperativa.js` è **l'unico posto**
dove una schermata chiede che serata è. Non ricopia niente: chiama
`serataDiServizio()`, la funzione **pura** scritta il 18/08 apposta, e l'ora
la legge da `service_settings.ora_fine_serata` — che è l'unico posto dove
quell'ora vive.

🔴 **Fino a stasera quella lettura era scritta a mano dentro `CassaHome`**,
ed era l'unica corretta di tutta la Cassa. Finché viveva lì, le altre
schermate non potevano che averne una diversa.

⚠️ **Finché la lettura non è arrivata, la serata è `null`** e la schermata
tiene la propria proposta di partenza. Non si mette «oggi» al suo posto:
sarebbe indistinguibile da una risposta, e per un istante la schermata direbbe
«questa è la serata» proponendo il calendario.

⚠️ **E non sovrascrive mai ciò che si sta scrivendo**: la proposta si corregge
solo se è ancora quella di partenza. È la trappola del 12/08.

---

## Si vede, e si può correggere

`<CampoGiornata>` è un componente solo, usato da tutte e quattro le
schermate: il campo, e sotto la frase — *«Questo movimento va sulla serata di
sabato 22. Fino alle 05:00 è ancora la sera prima»*.

⚠️ **Perché un componente e non quattro campi uguali**: quella frase non è
decorazione, è la sola cosa che distingue «il gestionale ha scelto per me» da
«il gestionale ha sbagliato». Scritta a mano in quattro schermate, alla quinta
manca — ed è la schermata in cui qualcuno si accorgerà del numero tre giorni
dopo.

⚠️ **Su «Incassato e scontrinato» la riga compare solo fra mezzanotte e le
5**, cioè solo quando serata e calendario non coincidono. *Una spiegazione che
c'è sempre si smette di leggere; questa sta dove sta il dubbio* — è il
criterio del 18/08.

---

## L'avviso sul tablet delle Comande

Alle 5 compare una riga: *«È cominciata una giornata nuova. Questa è ancora la
sala della serata di …»*, con il gesto per passare a quella di oggi.

⚠️ **Compare senza che nessuno tocchi niente**, e questa è la condizione che
lo rende utile: si appoggia all'orologio che batte ogni minuto per il ritardo.
Se aspettasse un gesto, coprirebbe tutti i casi **tranne quello per cui
esiste** — il tablet in carica sul bancone, ripreso la mattina.

⚠️ **Ed è la stessa forma dei tavoli di ieri sotto la data di oggi** (19/08):
non una schermata vuota, che si nota, ma una **plausibile**.

---

## Le prove, e la controprova

**7 prove pure nuove** (`tests/unita/giornata-proposta.test.js`), e provano la
cosa che le prove sui bordi non potevano provare: che le **due domande danno
due risposte diverse**, e che ognuna resta dove deve stare.

- alle **00:30** le due divergono (serata: ieri · calendario: oggi);
- alle **21** coincidono — ed è il motivo per cui il difetto non si vedeva;
- fra **04:59 e 05:01** si sposta la serata **e non si sposta il calendario**:
  senza questa seconda metà, una funzione che spostasse tutte e due passerebbe;
- l'avviso di Comande usa **l'ora di Alessio**, non un numero scritto nel
  file: con le 02:00 al posto delle 05:00 lo stesso istante è già scaduto.

**La controprova**: invertito il confronto dentro `serataScaduta` — 3 prove
rosse su 3 che la riguardano, e nessun'altra. La prova che il database e il
client dicano la **stessa** serata sugli stessi nove istanti c'era già dal
19/08 mattina e continua a passare.

---

## Per Alessio, in una riga

Se registri un movimento o uno sconto all'una di notte, il gestionale ti
propone la serata appena finita e te lo scrive sotto il campo; e se il tablet
delle comande resta acceso fino alla mattina, ti dice che la sala che stai
guardando è quella di ieri.

---

---

**Commit del lavoro**: `584ba15` — «La giornata proposta — la seconda metà della regola delle 5».
**Working tree**: pulito al momento del commit del lavoro.
**Migrazioni**: nessuna.

---

## Le domande

1. In prima nota il gestionale ora **propone la serata**, ma se una riga
   venisse scritta senza data il database ci metterebbe **il giorno di
   calendario**. Oggi non succede mai (tutte le strade passano una data). Va
   allineato anche quello, o va lasciato com'è?
