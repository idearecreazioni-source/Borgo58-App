# La sorveglianza esce da ciò che sorveglia, e un prestito non è un incasso

**Blocchi 2 e 3 del mandato del 29/08/2026.**
**Commit dichiarato: `ad5bce0`** — working tree pulito al momento del commit.
**Migrazioni introdotte: `20260829000001`, `20260829000002`.**
⚠️ **Applicate al progetto di prova, NON in produzione**: aspettano il push
di Alessio, come vuole la regola («solo migrazioni già su GitHub»).

---

## Cosa abbiamo rovesciato

*Niente.* Nessuna decisione in vigore è stata contraddetta.

Due decisioni sono state **attuate**, non cambiate: quella del 20/08 (*un
finanziamento non è un ricavo, restituire il capitale non è un costo*) e
quella del 28/08 sulla riserva modificabile. Entrambe erano scritte e
nessuna delle due era imposta dal gestionale.

Quattro voci **aggiunte** a `docs/DECISIONI.md`.

---

# Blocco 2 — le risposte mute

## Il censimento, e il metro che lo rende onesto

La domanda del mandato è: *quante funzioni e viste contengono una risposta
utile ma non sono eseguibili dalle identità che le schermate usano?*

Il primo conteggio possibile — «funzioni non aperte a chi usa l'app» — dà
**114**, e non dice niente: sono quasi tutte funzioni di trigger, aiuti
interni e lavori pianificati, che è **giusto** siano chiuse.

Il metro onesto è un altro: **quali funzioni le schermate chiamano
davvero, e non possono.** Prese dal sorgente tutte le chiamate — **139
nomi**, e **zero costruite con un nome dinamico**, quindi il censimento è
**esaustivo e non a campione**.

**Risultato: una sola.** `submit_public_reservation`, che è il varco del
form pubblico e sta riservata agli anonimi: è il disegno, non un difetto.
**Viste chiuse a chi usa l'app: zero.**

La famiglia è vuota. Il difetto del 28/08 — il database che sapeva da
nove giorni che il lettore era muto e nessuna schermata poteva vederlo —
è stato chiuso dalla migrazione applicata stanotte all'inizio di questa
sessione.

## 🔴 Il buco vero, che non era in elenco

La sentinella sorveglia cinque lavori automatici. **Ed è essa stessa un
lavoro automatico.**

Misurato in produzione: `stato_lavori` ha cinque righe e **nessuna è la
sua**. Se `sentinella-lavori` si ferma, non esiste da nessuna parte un
dato da cui accorgersene — e con lei tacciono tutti e cinque gli allarmi
che dipendono da lei.

⚠️ **Non era una dimenticanza.** L'esclusione era voluta ed è scritta nel
codice: *«non può essere testimone della propria assenza»*. È vero. Il
difetto è che da quella frase giusta **non è mai seguita la seconda
metà**: se non può testimoniare lei, deve farlo qualcun altro.

### Chi guarda, e perché proprio lui

Il testimone deve stare **fuori da pg_cron**, altrimenti lo stesso guasto
spegne guardiano e sorvegliato. Tre strade:

- un servizio esterno → un'infrastruttura nuova per un locale che non ha
  ancora aperto;
- un secondo lavoro pianificato → **non risolve niente**, sta nello stesso
  posto che può fermarsi;
- **il gestionale stesso, quando Alessio lo apre** ← scelta.

⚠️ **Il prezzo è dichiarato**: se non apre il gestionale per due giorni,
per due giorni nessuno guarda. È un limite vero, ed è comunque un'altra
cosa rispetto a oggi, dove **non guarda nessuno mai**.

✅ **Visto a schermo**, non dedotto: con la sentinella ferma da tre ore la
schermata iniziale dice «La sorveglianza dei lavori è ferma · Ferma da 180
minuti. Se adesso un lavoro si fermasse, nessuno lo direbbe».
⚠️ E la prima versione della frase la ripeteva due volte («è ferma… è
ferma»): corretta **dopo averla letta a schermo**, non prima.

✅ **E copre da sé la ricostruzione del progetto di prova** — l'altra metà
del punto 3 del mandato. Con la tabella dei battiti vuota dice **«Non ha
mai dato segno di sé»** invece di tacere: *non sapere non è una
rassicurazione.* Visto a schermo.

---

# Blocco 3 — i prestiti di privati

## La misura chiesta dal mandato, fatta prima di scrivere

*Cosa fanno i riepiloghi di cassa con un movimento senza causale?*

`costi_da_classificare` e `rettifiche_fiscali` scartano le causali di
sistema con `coalesce(c.di_sistema, false) = false`. Un movimento **senza**
causale ha `di_sistema` nullo, il `coalesce` lo rende `false`, quindi
**non viene scartato**: una restituzione di prestito entra fra i costi da
classificare, e da lì nel calcolo delle imposte.

🔴 **E il difetto vero era peggio.** La schermata sceglieva la causale
così: «la prima entrata non di sistema» e «la prima uscita non di
sistema» — cioè **una qualunque, decisa dall'ordine dell'elenco**. In
pratica «Altro incasso» e «Altra uscita». Non «senza causale»: **con una
causale sbagliata che si comporta come un costo vero.**

⚠️ **E la ragione scritta nel codice era falsa.** Il commento diceva che a
tenere il prestito fuori dagli incassi era `prestito_id`. Misurato:
**nessuna funzione di riepilogo guarda quella colonna** — solo le due che
la scrivono. A tenerlo fuori è la decisione del 15/08 (i ricavi si leggono
dai conti chiusi). *L'effetto era giusto, la ragione no.*

## La forma della cura

Il meccanismo che esclude i movimenti di sistema **esiste già e
funziona**: non è stato toccato nessun riepilogo. Bastano due causali di
sistema — «Prestito ricevuto» e «Restituzione di prestito» — e i prestiti
ne restano fuori da soli.

⚠️ **Il parametro della causale ESCE dalla firma** invece di diventare
obbligatorio: è sempre la stessa, e chiederla è offrire la possibilità di
sbagliarla. *Un parametro tolto è un caso che non esiste più.*

**Il mezzo di rientro** è ora imposto dal database, e il rifiuto **nomina**
quello giusto: «Questo prestito è entrato in cassa: va restituito da lì,
non da banca».

**La riserva** resta 5.000 € e si cambia da *Cassa → Prestiti*.
⚠️ Vuoto e zero sono due risposte diverse: vuoto vale il ripiego, zero
vuol dire «nessuna riserva».

## Il riaggancio: la risposta è doppia

Il mandato sospettava che il riaggancio senza `returning` non reggesse.
**Costruito il caso invece di ragionarci:**

- due restituzioni identiche (stesso prestito, giorno, importo) →
  **REGGE**: 2 righe, 0 senza movimento, 0 movimenti agganciati due volte;
- **ma con una riga già rimasta orfana** → **non regge**: l'update non ha
  limite e aggancia lo stesso movimento a più righe. Misurato: uno.

Quindi: il caso che il mandato chiedeva regge, quello accanto no.
`returning` costa una riga e toglie il caso invece di renderlo improbabile.

## Provato attraverso il corridoio vero

Non solo dentro la migrazione, che gira come proprietaria: il prestito
registrato **dalla schermata** entra con causale «Prestito ricevuto»
(di sistema), e restituirlo dalla banca viene rifiutato con la frase che
nomina la cassa. Il prestito di prova è stato tolto per identificativo,
**lapidi comprese**: 6995 prima, 6995 dopo.

⚠️ **I permessi delle due funzioni ricreate sono stati CONFRONTATI** con
quelli originali letti in produzione — non ricopiati dalle funzioni
accanto: identici, nessuna porta aperta dalla firma nuova.

## Cosa hanno preso i guardiani

- **Il guardiano dei residui** ha fermato la verifica due volte: lasciava
  una riga di impostazioni (creata e non tolta: rimetterla «com'era»
  svuotando il campo non basta se prima **non c'era affatto**) e **8
  lapidi** nel registro delle cancellazioni.
- **La prova con l'elenco delle causali di sistema scritto a mano** è
  diventata rossa da sola: è esattamente il suo lavoro.
- **Le prove dei prestiti** passavano ancora il parametro tolto e il
  corridoio rispondeva 500 — la conferma che il tratto client → corridoio
  conta, e che nessuna migrazione lo prova.

Ogni verifica è stata **rotta in due modi diversi** che falliscono su
controlli diversi.

---

## Rilettura

**Cosa NON ho verificato con gli occhi.** Nessuna immagine (lo screenshot
non funziona in questo ambiente): quello che è «visto» è letto dal DOM come
testo. **Nessun allarme è stato mandato davvero**: la sentinella è provata
facendola girare e guardando il battito, non facendo suonare un telefono.
**Nessun prestito vero esiste**: in produzione `prestiti_privati` è vuota, e
tutto quello che ho provato l'ho costruito io.

**Cosa ho contato senza leggerlo.** Le 139 chiamate delle schermate vengono
da un setaccio sul sorgente: non ho aperto i 139 punti. Il «114 funzioni
chiuse» l'ho letto dal catalogo e **non l'ho esaminato riga per riga** —
l'ho scartato come metro, non classificato.

**Quali mie affermazioni sono diventate false mentre lavoravo.** Il
messaggio della verifica del blocco 4 diceva «copre 2 fonti» e contava
quelle *con righe* invece di quelle *comprese*: corretto. E la prima frase
dell'avviso della sentinella diceva due volte «è ferma».

**Quali conteggi sono pavimenti.** Nessuno di questi due blocchi: il 139 è
esaustivo (zero chiamate dinamiche, verificato), e le fonti dei prestiti
sono due funzioni sole.

**Cosa ho lasciato sul progetto di prova.** Le migrazioni `…0001` e `…0002`
applicate; il battito della sentinella (dato legittimo, scritto da lei);
**i sei lavori pianificati riaccesi** e l'indirizzo delle funzioni nel
Vault — voluti, sono il punto 4d. Il prestito e la mail di prova sono stati
tolti per identificativo, con le lapidi contate prima e dopo.
