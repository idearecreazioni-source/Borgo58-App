# MEMO consultivo, fase 1 — MEMO risponde alle domande

**07/09/2026.** Riepilogo di consegna.

* **HEAD dichiarato**: `7f226c6` — il commit che sta sotto questo file.
  ⚠️ La prima stesura di questo riepilogo dichiarava `bb16932`: era vero
  allora, e il collaudo a mano di Alessio ha aggiunto un secondo giro
  (§ «Il secondo giro»). Il riepilogo è uno solo perché la consegna è una
  sola — la proposta #35 — e due riepiloghi per la stessa proposta si
  contraddicono al primo ritocco.
* **Ramo**: `memo-consultivo-fase-1`, aperto da `798d41a` (master). Proposta #35.
* **Migrazioni**: **nessuna.** Nessuna tabella, nessun permesso, nessuna
  funzione del database toccata. L'unica funzione online cambiata è
  `ascolta-voce`.
* **Prove**: 1.067 pure · 42 sulle schermate · 505 contro il progetto
  di prova · lint pulito · compilazione pulita.
  ⚠️ **Due prove pure restano rosse, e sono PREESISTENTI su `master`**
  (`indice-richieste`, `indice-rovesciamenti`): misurato mettendo da parte
  questo lavoro con `git stash -u` — falliscono uguale. Fuori perimetro, non
  toccate. Si rigenerano con `npm run richieste` e `npm run indice`.
  ⚠️ **E il 07/09 se n'è misurata la causa**: falliscono **solo su questa
  macchina**. I due documenti stanno nell'indice con gli a-capo di Unix e
  nella copia di lavoro con quelli di Windows (`git ls-files --eol` dice
  `i/lf w/crlf`), mentre il blocco che il comando rigenera li scrive di
  Unix: il confronto cade sugli a-capo, non sul contenuto. **Su GitHub
  sono verdi.** Non è stato toccato niente: la cura sta nei due file, che
  sono fuori da questo perimetro.
* **Copia di lavoro**: un albero separato (`Desktop\Borgo58-App-memo`). I
  documenti locali non salvati di Alessio — `docs/DECISIONI.md` e
  `docs/specifiche/` — vivono nell'altra copia e non sono stati toccati.

## Il secondo giro — i cinque difetti trovati col collaudo a mano

Alessio ha usato MEMO e ha chiesto «Quando scade l'astice?». Da lì sono
usciti cinque difetti, **tutti della stessa famiglia**: due parti dello
stesso gestionale che raccontano cose diverse dello stesso fatto. Nessuno
dei cinque dava un errore; tutti e cinque davano una risposta plausibile.

1. 🔴 **«Quando scade l'astice?» cercava un IMPEGNO chiamato astice**, e
   rispondeva che non lo trovava. In un'osteria «scadere» vuol dire due
   cose — una partita in cella e un adempimento — e sono vere tutt'e due.
   Adesso guarda prima il magazzino e poi l'Agenda; **a decidere l'ordine è
   la frase detta, non il modello** (`nominaLAgenda`), e chi non trova
   niente nel posto scelto **guarda comunque nell'altro**: la precedenza
   decide l'ordine, mai l'esito. «Non lo trovo» si può dire solo dopo aver
   guardato in tutt'e due i posti, e la risposta lo dichiara.

2. 🔴 **«Cosa devo fare oggi?» contava anche gli impegni SENZA scadenza.**
   La regola era scritta in due posti: l'Agenda diceva
   `giorni_alla_scadenza === 0`, MEMO `Number(giorni_alla_scadenza) === 0`,
   e `Number(null)` **vale zero**. Misurato sul progetto di prova:
   **l'Agenda ne contava 0, MEMO ne annunciava 15** — tutta la corsia
   «quando capita». Ora la regola è una sola (`eDiOggi`), e la usano
   tutt'e due.
   ⚠️ **La prova che avrebbe dovuto prenderlo ripeteva l'errore**: filtrava
   con lo stesso `Number(...) === 0` della regola che stava provando. E la
   regola dell'Agenda una prova col caso `null` ce l'aveva **dal giorno in
   cui è nata**: a non averne una era la copia.

3. 🔴 **«Quanto astice ho?» raccontava al futuro una partita già scaduta**
   («la prima partita scade il 2 ago 2026», e siamo a settembre) — mentre
   lo stesso MEMO, da un'altra porta, rispondeva «è già scaduta». Ora la
   giornata arriva alla regola dalla lettura, come in «quando scade …».

4. 🔴 **L'intestazione del Magazzino contava 55 prodotti sotto scorta, le
   sue righe 54**, e la lista della spesa ne avrebbe presi 54: la regola
   era in **tre** posti e uno era rimasto indietro — quello che non chiede
   `tenuto_in_magazzino`. ⚠️ Il commento che stava sopra quel conteggio
   **lo aveva previsto** (*«due posti che decidono ‹è sotto soglia?›
   finirebbero per dire due numeri diversi»*): una regola raccomandata in un
   commento non è una regola in un posto solo. Ora è `sottoScorta`, e la
   chiamano l'intestazione, il bollino delle righe e MEMO.

5. 🔴 **«Quando scade il sale?» fondeva due prodotti in una risposta
   sola.** Difetto mio, di questo stesso giro: misurate **120 coppie** di
   prodotti in cui uno è la testa dell'altro — «Sale» e «Sale marino di
   Trapani», «Coniglio» e «Coniglio in agrodolce» — e le partite venivano
   fuse sotto il nome del primo, con un numero di partite che non esiste.
   Ora si raggruppano per prodotto e, se sono più d'uno, **si chiede
   quale**: la stessa cura che «quanto ne ho?» usa già.
   ⚠️ E rileggendo è saltato fuori il suo seguito: la scelta fra i due
   l'avevo **riscritta a mano** invece di usare `fraICandidati`, che è la
   funzione con cui tutto il resto di MEMO chiude un tocco. La sua regola è
   che una scelta che non combacia **non fa sparire i candidati**; la mia li
   svuotava, e con un prodotto solo e una scelta vecchia addosso MEMO
   avrebbe chiesto «ne ho 1: di quale?» — una domanda senza risposta
   possibile.
   ⚠️ E «c'è anche in magazzino» conta i **prodotti**, non le partite: tre
   lotti dello stesso astice sono una cosa sola.

E una cosa in più, che difetto non era: **nel Ricettario «chi nomina la cosa
viene prima di chi la contiene»**, la regola che il Magazzino aveva preso la
mattina. «Pesto» risponde del pesto invece di chiedere «di quale?» avendo
davanti le busiate — e **dichiara** che cosa ha lasciato fuori. La stessa
funzione (`candidatiRicetta`) la usa anche la lettura che decide se andare a
prendere gli allergeni: se i due criteri divergessero, MEMO risponderebbe
«non lo so» su un piatto appena riconosciuto.

### Le prove nuove

* **Discriminanti**: ogni cura è stata **rotta apposta** e la prova è
  diventata rossa (l'`eDiOggi` rimesso a `Number()` → 2 rosse; la scadenza
  sempre al futuro → 1; la precedenza del Ricettario tolta → 3; la scorta
  senza `tenuto_in_magazzino` → 3; il raggruppamento per prodotto tolto →
  1; la scelta riscritta a mano → 1). Poi rimesse a posto.
* **Fino in fondo alla catena, un'area per volta** (modello vero, funzione
  online vera): Ricettario e Agenda si aggiungono a Magazzino e scadenze,
  che c'erano già. Una per area e non una per domanda: quello che si
  esercita è il tratto fra la bocca e la risposta, uguale per tutte le
  domande di un'area, e nove chiamate al modello costerebbero nove volte
  tanto per provare la stessa cosa.
* **Nessuna delle nove scrive**: prima si guardavano gli appunti dopo *una*
  domanda; adesso si contano le righe di otto tabelle prima e dopo aver
  risposto a **tutte e nove**, e si nominano tutte quelle che non tornano.

## Cosa abbiamo rovesciato

**Niente**, e va detto perché i cinque punti qui sopra potrebbero
sembrarlo. Nessuno dei cinque rovescia una decisione presa: erano
**difetti**, cioè posti dove il gestionale faceva una cosa diversa da quella
che aveva scritto di voler fare — la regola giusta esisteva già altrove, in
quattro casi su cinque **dentro questo stesso gestionale** (il numero
dell'Agenda, la lista della spesa, l'altra risposta di MEMO, e la funzione
con cui MEMO chiude un tocco). L'unica aggiunta vera è la precedenza nel
Ricettario, che **estende** una regola di quella mattina invece di
rovesciarla.

## Le decisioni che non si leggono dal codice

1. **Il modello capisce, il database risponde.** Dal modello escono tre cose
   sole — area, quale domanda, di che cosa. Il numero lo legge il gestionale
   col permesso di chi guarda. Un numero detto dal modello sarebbe
   plausibile e non controllabile.
2. **Le letture stanno nel browser, non nella funzione online**, che gira
   con la chiave di servizio dove la RLS non c'è: leggere lì sarebbe
   consegnare dati scavalcando il permesso.
3. **Il comando vince sulla domanda, per costruzione.** Una domanda presa
   per comando si butta in un tocco; un comando preso per domanda si perde.
4. **Una domanda registra la dettatura con la filza vuota** — zero appunti —
   ma la registra: è il conto di ciò che è costato, e senza il tetto di
   spesa del mese si potrebbe superare facendo domande.
5. **Sugli allergeni il «no» non si dà** se di qualche ingrediente non li ha
   guardati nessuno: si dice «non te lo so dire», coi nomi degli scoperti.
6. **Si sceglie per identificativo, mai per somiglianza del nome**: «olio»
   non diventa «Olio» perché il nome combacia.
7. **Gli elenchi si tagliano a sei righe dichiarandolo**, e il conteggio
   nella frase resta quello vero — tranne l'elenco delle nove domande, che
   non si taglia perché non è un elenco di dati e non c'è un «tutte» da
   nessuna parte.

## Cosa NON è verificato

1. **Nessun occhio ha guardato una schermata vera.** Le prove sulle
   schermate dicono cosa c'è scritto, non come si legge in cella.
2. **Il modello non è una garanzia.** Le prove sorvegliano la regola; le 19
   frasi del collaudo sono un campione, non una misura.
3. **La lettura che fallisce non è stata provocata dal vivo**: è provata
   sulla regola, dove si può costruire.
4. **La sala non può fare nessuna domanda**, ed è un fatto misurato e
   preesistente: `registra_dettatura` pretende `is_titolare()` e `/detta` è
   chiusa allo staff. Quello che la prova dimostra è che, se un giorno ci
   arrivasse, l'Agenda non le consegnerebbe quello che non deve vedere.
5. **Il difetto dei quindici impegni non l'ha visto nessun occhio su una
   schermata**: è stato misurato interrogando il database e confrontando i
   due conteggi. Quello che nessuno ha ancora guardato è la frase «Oggi hai
   una cosa» sul telefono, in cucina.
6. **Il 55 contro 54 del Magazzino è misurato sul progetto di prova**, dove
   i prodotti sono 475 e quelli fuori magazzino 4. **In produzione non è
   stato misurato** — leggere il gestionale vero non rientra in questo
   giro — e l'ultima misura scritta negli appunti di progetto (04/09) dice
   zero ingredienti: se è ancora vera, lì i due numeri sono tutt'e due
   zero e la differenza si vedrà quando il magazzino si riempirà.
7. **Le prove che passano dal modello sono un campione di quattro frasi**,
   una per area. Che il modello capisca *tutte* le frasi possibili non lo
   dimostra nessuna prova, e non può dimostrarlo.
8. 🔴 **LA REVISIONE ESTERNA DEL DIFF NON È STATA FATTA.** Era chiesta, ed
   è l'unica cosa del mandato che non si è potuta eseguire: lo strumento
   (`codex`) **non è installato su questa macchina** — risponde *«Codex CLI
   is not installed»*. Quello che c'è al posto suo è una rilettura mia, che
   ha comunque trovato il quinto difetto e il suo seguito, e non è la stessa
   cosa: chi rilegge il proprio lavoro cerca gli errori che sa di poter
   fare.
