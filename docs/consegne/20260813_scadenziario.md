# Consegna del 13/08/2026 (seconda) — lo scadenziario

**Commit della consegna: `1ff5cb4`** (questo riepilogo è il commit
immediatamente sopra, sola documentazione). Working tree pulito.

| Commit | Cosa |
|---|---|
| `79c014d` | lo scadenziario — migrazione `20260813000004` |
| `1ff5cb4` | tolta la conferma prima di buttare, per decisione di Alessio |

**Applicata in produzione da me**: `20260813000004`. **76 migrazioni**
registrate. `notify-telegram-reservation` (**v10**) e `operazioni-atomiche`
(**v14**) reinstallate.

---

## 1. Prima cosa: la coda della consegna precedente è chiusa

Il riepilogo di stanotte dichiarava non verificato il messaggio nuovo dei
rincari. **Ora è stato visto arrivare**, con la sesta fattura di
collaudo:

```
💶 RINCARO

Rincaro su Pomodoro ciliegino (Pomodori ciliegini di Pachino IGP,
cassa da 6 kg): da 4,30 € a 4,60 € (+7,0%), +43,8% da quando lo
compri — FT 2026/PROVA-6 del 13/08/2026

Lo stesso rincaro non si ripete. Un rincaro diverso arriva sempre.
```

Titolo distinto da quello dei guasti, prezzi in euro, niente riga
tecnica, e la frase in fondo che dice il vero. La categoria arriva fino
alla funzione dei messaggi: era il modo in cui quella correzione poteva
fallire in silenzio, ed è escluso.

---

## 2. Lo scadenziario, e la regola è di Alessio

Nasce da un rifiuto ripetuto: l'assistente proponeva un promemoria in
Agenda per ogni scadenza di ogni riga di fattura, e **lui l'ha rifiutato
tutte le volte**. Il rifiuto era il dato — una lista di compiti non è il
posto dove si guardano le scadenze della cella.

### La sua regola ha corretto la mia, e va messo a verbale perché

Avevo obiettato che una partita nuova non fa sparire quella vecchia,
quindi non doveva zittire l'avviso — obiezione di sicurezza alimentare,
non di gusto. La sua risposta:

> *«Se sto comprando altre partite di un determinato prodotto vuol dire
> che la partita precedente è in esaurimento e che c'è un riciclo tale
> che non consente al prodotto di arrivare alla data di scadenza. Il
> sistema ha senso solo per quei prodotti movimentati poco e che
> potrebbero sfuggire a un controllo manuale.»*

Ha ragione, e per un motivo che la mia versione non aveva: **la sua
regola non dipende dal fatto che qualcuno si ricordi di premere
"finita"**. La mia avrebbe elencato ogni mattina tutto ciò che era
entrato e non era stato scaricato a mano — cioè quasi tutto — e dopo tre
giorni non l'avrebbe letta più nessuno. Un avviso che si impara a
saltare è peggio di un avviso che non c'è: è la stessa lezione del freno
anti-tempesta, applicata **prima** di sbagliare invece che dopo.

### La regola, per intero

Una partita si segnala solo se: **ha una data di scadenza** (i vegetali
sfusi non ce l'hanno — fuori, sua decisione), **ce n'è ancora**, **non ne
è entrata una più recente ancora in giacenza**, e **mancano meno giorni
del preavviso**.

⚠️ **Il prezzo, dichiarato e non nascosto**: una partita vecchia rimasta
indietro mentre ne entrano di nuove non verrà segnalata. È una scelta
consapevole per una cucina piccola dove il controllo a vista esiste
davvero, non una svista.

### Le altre decisioni

- **Il preavviso è per prodotto**: il sistema **propone** 2 giorni per il
  frigo e 14 per dispensa e freezer, Alessio corregge dove serve.
  Chiederlo a mano su ogni prodotto avrebbe prodotto uno scadenziario
  mezzo vuoto — peggio di nessuno, perché sembra completo.
- **`partite_in_scadenza()` restituisce anche le partite mute, col
  motivo scritto**: «come mai non me l'ha detto?» deve avere una risposta
  in schermata. Ed è **una regola sola** per la schermata e per il
  messaggio delle 10:00 — stesso principio di `orderTotals()` e
  `posti_liberi()`, e la lezione dei rincari di ieri, dove schermo e
  Telegram dicevano due cose diverse.
- **«Buttata» scrive da sé la riga nel registro HACCP** (categoria nuova
  `scadenza`: prima sarebbe finita in «altro», dove non la ritrova
  nessuno). **«Finita» non ci scrive** — un registro pieno di righe
  normali è un registro che l'ispettore smette di leggere. Tre tabelle in
  una transazione: `chiudi_partita` passa dal corridoio (B4).
- **Il lavoro è programmato alle 8 E alle 9 UTC**, e passa solo quello
  che cade alle 10 locali: `pg_cron` ragiona in UTC e l'Italia cambia ora
  due volte l'anno. Senza, da ottobre il messaggio sarebbe arrivato alle
  11 senza che nessuno capisse perché. Sorvegliato dalla sentinella, e
  **il battito si scrive anche quando non c'era niente da dire**: una
  giornata senza scadenze non è un guasto.

---

## 3. La conferma prima di buttare: tolta, per sua decisione

Avevo messo una conferma sul solo pulsante «buttata» — toglie merce dalla
giacenza **e** scrive nel registro HACCP, e un tocco per sbaglio su un
tablet con le mani unte produce una dichiarazione che non si cancella.
Gliel'ho consigliata; **ha deciso di toglierla**, ed è una decisione sul
suo locale.

Al posto della finestrella, la differenza fra i due pulsanti è scritta in
testa alla schermata: *«finita = usata, esce dalla giacenza; buttata =
esce dalla giacenza e finisce nel registro HACCP. Non si chiede conferma
e non si torna indietro.»* Una riga che sta lì è più onesta di una
finestrella che si impara a chiudere senza leggerla — che era poi il
motivo per cui dava fastidio.

---

## 4. Una domanda per Laura, e una conseguenza in sospeso

Alessio ha chiesto: *«le fatture le avrò nel cassetto fiscale, giusto?
Allora non ha senso che il sistema mi chieda di archiviarle.»*

La risposta è **in parte sì**, e la parte che manca conta: la
disponibilità del file integrale dipende dall'adesione al servizio di
consultazione, la conservazione a norma è un servizio a sé, e **i DDT non
c'entrano niente** — non passano da nessuno SdI, e nel nostro caso sono
la norma (merce con bolla, fattura a fine mese). La copia nel gestionale
è l'unica che esiste per quelli.

Domanda **L6 aggiunta a `DOMANDE_Consulenti.md`** nell'archivio, con
quattro punti concreti. Da lì dipendono due cose: se l'assistente smette
di **proporre** l'archiviazione delle fatture elettroniche (lasciandola
possibile ma spenta) e se conviene costruire l'import automatico degli
XML — che avrebbe un vantaggio grosso: **una fattura elettronica è già
strutturata, quindi importi e righe si leggono senza chiedere niente a un
modello a pagamento**, e senza il rischio di leggerli male.

---

## 5. Verifica

| Cosa | Stato |
|---|---|
| il messaggio nuovo dei rincari | **visto arrivare** (§1) |
| migrazione sul progetto di prova | **applicata due volte**: idempotente |
| il preavviso proposto (2 / 14, durata, scelta esplicita, zero) | **provato** |
| partita in scadenza → segnalata | **provato** |
| **entra una partita nuova → la vecchia tace** | **provato** |
| **finita la partita nuova → la vecchia torna a parlare** | **provato** |
| scadenza lontana → muta, col motivo | **provato** |
| partita senza data → fuori dallo scadenziario | **provato** |
| il testo del messaggio | **provato**, senza spedirlo |
| «buttata» → giacenza a zero + movimento + riga HACCP | **provato** |
| «finita» → **non** scrive nel registro HACCP | **provato** |
| partita già chiusa → rifiutata | **provato** |
| lavoro programmato e sorvegliato nei due versi | **provato** |
| fuori dalle 10 locali non fa e non manda niente | **provato** |
| prove automatiche | **30 verdi** |
| lint, build | puliti |
| **produzione** | **76 migrazioni**; funzioni v10 e v14 |
| la schermata, coi dati veri | **guardata da Alessio**: 16 partite con scadenza, 4 da guardare |

---

## 6. Cosa NON è verificato, e lo dico chiaro

- **Il messaggio delle 10:00 non è mai partito**: oggi quell'ora era già
  passata quando il lavoro è stato installato. Il primo arriva domani
  mattina. Il testo è provato dentro la migrazione, l'invio no.
- **Tutti i prodotti stanno prendendo 14 giorni di preavviso, anche il
  basilico.** Non è un difetto della regola: i prodotti nati dalle
  fatture non hanno ancora scritto dove si conservano né quanto durano, e
  senza quel dato la funzione sceglie il valore prudente. È esattamente
  il buco che chiude il primo lavoro in coda — l'assistente che compila i
  campi di un prodotto nuovo. Nel frattempo il preavviso si corregge a
  mano.
- **I dati di collaudo sono ancora in produzione**, ora di sei documenti.
  Alessio ha detto oggi «per ora non cancelliamo niente». Deroga
  consapevole al §5 punto 8, da chiudere prima che entri una fattura
  vera.
- **`/prova-voce` è ancora lì**, usa-e-getta e ormai servita.
- **Nessuna fattura vera di un fornitore vero** è ancora passata di qui.
