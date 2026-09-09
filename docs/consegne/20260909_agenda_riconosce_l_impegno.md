# MEMO operativo — Agenda: riconoscere l'impegno senza ripeterne il titolo

**09/09/2026.** Riepilogo di consegna.

* **HEAD dichiarato**: `c925f60` — l'unico commit di lavoro (questo riepilogo e' il commit sopra, ed e' sola documentazione).
* **Ramo**: `agenda-riconosce-impegno`, che parte dalla cima della **#44**
  (`agenda-fase-2`, `ff5e43f`) e quindi contiene anche la **#42** e la
  **#43**. ⚠️ **Nessuna delle tre è stata toccata né unita.**
* **Migrazioni**: **una**, `20260909000003_agenda_riconosce_l_impegno`.
  **Applicata solo a Borgo58-Prova** (383 migrazioni registrate lì).
  In produzione non è stato applicato niente.
* **Funzioni online**: **nessuna installata**. Questo lavoro non tocca
  `ascolta-voce`: il riconoscimento dell'impegno vive nel database, dove
  vive già la traduzione da «come l'ha chiamato lui» a «quale riga è» per
  tutti gli altri tipi.
* **Prove**: **1.237 pure** · **74 sulle schermate** · **527 contro il
  progetto di prova (tutte verdi)** · lint pulito · compilazione pulita.
  ⚠️ **Quattro restano rosse in locale e sono PREESISTENTI**: una pura
  (`indice-richieste`, artefatto di fine riga su Windows — con LF passa) e
  tre sulle schermate (`rotte-chiuse`, `varco-pubblico`), le stesse tre che
  la consegna della #44 dichiara già rosse in locale e verdi in CI.
  Misurate anche sul ramo #44 intatto: identiche.
* **Chiamate live al modello**: **ZERO**. Vincolo del mandato, e non è una
  dichiarazione sulla parola — vedi «La spesa che partiva da sola».

## Il difetto, misurato

In Agenda c'è **«Rinnovo firma digitale»**. La frase che viene da sé —
«segna come fatto il rinnovo **della** firma digitale» — non lo trovava, e
rispondeva *«non l'ho trovato fra quelli aperti in Agenda»*.

🔴 **Il modo di fallire è il peggiore di quelli che questo progetto teme:
nessun errore, e una frase sicura di sé che dice il falso.** Chi la legge va
a controllare in Agenda, vede che l'impegno c'è, e da quel momento non si
fida più nemmeno delle volte che funziona.

La colpa era del confronto. `voce_titolo_nudo` appiana maiuscole, accenti e
segni, ma lascia gli articoli — e «rinnovo firma digitale» **non è contenuto
in** «rinnovo della firma digitale», perché in mezzo c'è una parola che non
porta nessun significato.

## Cosa cambia

| quello che dice | prima | adesso |
|---|---|---|
| «Segna come fatto **il rinnovo della firma digitale**» (in Agenda: «Rinnovo firma digitale») | «non l'ho trovato» | appunto **approvabile**, chiude quell'impegno |
| «Sposta a venerdì **l'ordine delle verdure**» | trovava solo col titolo quasi letterale | trova anche con articoli e preposizioni in mezzo |
| due impegni ugualmente plausibili | «quale dei 2», e basta | «quale dei 2» **più i due titoli col loro giorno** |
| nessun impegno | non approvabile | **identico** |
| «Ricordami di chiamare Tiziana domani» | crea l'impegno | **identico** |

## La scala della precisione, e perché non un confronto più largo

⚠️ **Allargare e basta era la cura sbagliata.** Un confronto più largo trova
anche cose che non c'entrano, e su un gesto che **chiude** l'impegno di
qualcun altro o sposta una scadenza che nessuno voleva toccare, trovare
troppo è pericoloso quanto non trovare niente — con l'aggravante che
sbagliare non dà nessun segnale.

Al suo posto una **scala** (`impegni_compatibili` restituisce il `grado`):

| grado | come combacia |
|---|---|
| 1 | parola per parola |
| 2 | le stesse parole, **senza articoli e preposizioni** |
| 3 | uno contiene l'altro |

Si guarda **il gradino più alto che ha trovato qualcosa**, e si esegue solo
se lì dentro è rimasto **un candidato solo**.

🔴 **Da qui la proprietà che rende sicuro il cambiamento:** *un gradino largo
non può togliere una risposta che un gradino stretto aveva già dato.* Quindi
tutto ciò che prima si risolveva continua a risolversi **identico**, e
l'unica cosa che cambia è che dei casi che prima non trovavano niente adesso
trovano. Non è una speranza da ricontrollare caso per caso: è la forma del
meccanismo. La prova che la sorveglia è *«il titolo esatto VINCE su chi lo
contiene»* — «Panex kalox» detto per intero non diventa ambiguo perché in
Agenda c'è anche «Panex kalox e lattex».

## Quali parole se ne vanno, e quali no

`voce_titolo_essenziale` toglie **solo articoli e preposizioni** (semplici,
articolate, e le forme con l'apostrofo, che `voce_titolo_nudo` ha già ridotto
a parole a sé).

⚠️ **Non «le parole corte» e non «le parole comuni»**: articoli e
preposizioni sono una **classe chiusa** della lingua — si possono elencare
tutte, e nessuna porta il significato di un impegno. Una lista di «parole
poco utili» cresce a ogni caso nuovo, e ogni parola aggiunta allarga il
confronto senza che nessuno se ne accorga.

⚠️ **Le congiunzioni RESTANO.** «Ordine verdure **e** frutta» e «Ordine
verdure frutta» non sono la stessa cosa detta in due modi: la «e» lega due
cose, e toglierla farebbe combaciare due impegni che parlano di merci
diverse. Il confine è la grammatica, non il fastidio.

⚠️ **Si spezza in parole invece di cancellare dal testo**, e non è stile: con
una sostituzione, due parole da togliere una accanto all'altra («di la») ne
lasciano una — la seconda non viene vista perché lo spazio che la precede se
l'è portato via la prima. Provato apposta (`voce_titolo_essenziale('ordine di
la firma')` → `'ordine firma'`).

⚠️ **Un titolo di soli articoli torna VUOTO, non stringa vuota.** Senza quella
distinzione, `like '%' || '' || '%'` prenderebbe **tutta l'Agenda**, in
silenzio. È la stessa trappola per cui il confronto ha una soglia di tre
lettere, e c'è una prova che ci cammina sopra.

## Quando restano in due, si dice QUALI

🔴 **La riga che non si tocca:** con due candidati pari il gestionale non
sceglie, e l'appunto **non è approvabile** — la destinazione diventa
`agenda_quale_impegno`, che nel catalogo non c'è, quindi non è approvabile
*per costruzione*.

Quello che cambia è che adesso l'appunto **se li porta dietro**, col loro
giorno: `dati.impegni_possibili = [{titolo, data}]`, e la schermata li elenca sotto
«Potrebbero essere questi:». Prima diceva «quale dei 2» e lasciava a chi
legge il compito di andarli a cercare in Agenda — cioè di rifare a mano il
lavoro che il gestionale aveva appena fatto.

* ⚠️ **Il giorno è la metà che serve**: due impegni che si chiamano quasi
  uguale si distinguono per *quando* scadono, quasi mai per come sono
  scritti. Un elenco di soli titoli somiglianti è la stessa domanda, scritta
  più lunga. E **«senza scadenza» si scrive**: una riga muta si legge «non
  l'ho guardato».
* ⚠️ **Si mostrano solo quelli del gradino che ha bloccato**, non tutti i
  compatibili: sono quelli che il gestionale non ha saputo distinguere fra
  loro. Mettere accanto anche i più deboli, già scartati, farebbe sembrare la
  scelta più difficile di com'è. **Al più cinque**, col numero intero nella
  frase, così l'elenco non finge di essere completo.
* ⚠️ **Non si toccano.** Un pulsante per sceglierli renderebbe approvabile un
  appunto che finché i candidati sono due non deve esserlo. La via d'uscita
  resta quella di sempre: ridirlo, o «Fallo a mano →» che porta in Agenda.
  ⚠️ **È una scelta, non una dimenticanza**, e va detta perché è il primo
  seguito che verrà in mente a chiunque legga questa schermata.
* ⚠️ **I candidati si rifanno a ogni giro e non si conservano mai**:
  `voce_risolvi_dati` rigira al momento dell'approvazione, e un elenco
  scritto ieri direbbe «erano questi due» quando uno dei due è già stato
  chiuso. Si toglie **prima** di guardare (`v_dati - 'impegni_possibili'`), così
  l'unico modo di averli è averli appena trovati.
* ⚠️ **E non stanno fra i dati concreti**: quelli sono «cosa verrebbe scritto
  approvando», e i candidati sono l'esatto contrario — la ragione per cui non
  si scrive niente. Mostrarli lì direbbe a chi firma che sta autorizzando due
  impegni invece di nessuno. Stanno in `DI_SERVIZIO`, accanto a `dove`.

## L'impegno che sparisce fra la proposta e il «sì»

🔴 **Il rischio che il confronto più largo introduce**, chiuso e provato: se
l'impegno proposto viene chiuso nel frattempo e in Agenda ce n'è un altro
somigliante, **non si ripesca**. Chiudere una riga che nessuno ha mai visto
sull'appunto firmato sarebbe la firma in bianco che tutto questo lavoro esiste
per evitare. La regola c'era già dalla fase 2 (`v_perso`); qui è **provata
contro un somigliante costruito apposta**, che con la scala vecchia non
esisteva.

## La spesa che partiva da sola

🔴 **Trovato guardando come si sarebbero pagati i controlli di questa
proposta.** `npm run test:app` lancia tutto `tests/app`, e lì dentro
`domande-memo.test.js` fa **otto richieste vere al modello** per giro. I
controlli su GitHub girano a ogni proposta e a ogni push: **otto richieste a
pagamento per ogni giro, che nessuno ha deciso e che crescono da sole.**

⚠️ È la stessa famiglia del 12/08 — *ogni cosa automatica che costa soldi
vuole un tetto, altrimenti è una perdita che cresce da sola*. Lì erano le
mail riprovate all'infinito.

Cura: `scripts/prove-che-costano.mjs`. Le prove che chiamano il modello
**restano fuori** dal giro automatico; si lanciano con
`npm run test:app -- --col-modello`.

* 🔴 **L'elenco non è scritto a mano**, e non è pignoleria: un elenco a mano è
  già scaduto il giorno dopo (in questo progetto è successo coi vincoli senza
  frase, con le lapidi, con l'elenco dei dati di collaudo). Si ricava: quali
  funzioni online nominano il modello **nel loro sorgente**, e quali prove le
  **invocano**. Una prova nuova che chiami il modello finisce fuori **da
  sola**.
* ⚠️ **Nominare non è chiamare**: `tests/app/permessi.test.js` elenca le
  funzioni online per contarle e non ne chiama nessuna. Confonderle
  spegnerebbe una prova che non costa un centesimo. C'è la prova al
  contrario.
* ⚠️ **Si esclude, non si cancella, e il comando DICE sempre quali ha lasciato
  fuori.** Un'esclusione silenziosa sarebbe copertura persa travestita da
  verde.
* ⚠️ **Gli `--exclude` rimettono a mano i default di vitest**: sulla riga di
  comando `--exclude` **sostituisce** quelli della configurazione invece di
  aggiungersi, e senza si tornerebbe a frugare dentro `node_modules`.

## 🔴 La parola che era già occupata

**Il difetto più grosso di questo lavoro l'ho fatto io, e l'ha trovato una
prova della #44 diventata rossa da sola.**

La prima versione chiamava il proprio elenco `candidati`, che era il nome
ovvio. Ma `candidati` **in questo database ha già un significato**: per
giacenza, temperatura e pulizia è l'elenco dei **numeri di catalogo** fra cui
scegliere, e `azione_scelte` li converte a intero uno per uno per
costruire i pulsanti.

Mettendoci dentro degli oggetti `{titolo, data}`, Postgres rispondeva
*«invalid input syntax for type integer»*.

* 🔴 **E il danno non era la riga: era la schermata.** `azione_scelte` gira
  dentro `appunti_da_approvare()`, che raccoglie **tutti** gli appunti in
  un'interrogazione sola. Un solo appunto con quella chiave storta faceva
  fallire la lettura intera — MEMO avrebbe risposto «non ho capito niente»
  **su tutto**, non su quell'appunto. È la famiglia del 18/08: *nove letture
  in blocco, e se una fallisce non se ne applica nessuna.*
* ⚠️ **La cura vera è il nome**, non una toppa: l'elenco si chiama
  `impegni_possibili`. Col discriminante del 17/08 le due cose direbbero
  *esattamente* la stessa cosa? No — una è **una scelta che si tocca**,
  l'altra è **un'informazione che si legge**. Due cose diverse, due nomi.
* ⚠️ **E accanto c'è la rete**: `azione_scelte` adesso **salta** gli elementi
  che non sono numeri invece di far cadere tutto. Non cambia niente per i
  dati buoni; toglie il caso in cui un dato storto in una riga si porta via
  le righe che stanno bene. Provato dentro la migrazione (controllo 11), dove
  prima della correzione quella stessa riga sollevava l'errore.
* ⚠️ **Come è stato trovato, e conta**: non rileggendo. È diventata rossa
  `tests/app/agenda-a-voce.test.js` — una prova scritta ieri per la #44, che
  non sapeva niente di questo lavoro.

## Cosa abbiamo rovesciato

**Uno, ed è registrato**: [n. 82](../decisioni_rovesciate.md) — *«le prove
contro il database girano tutte, a ogni giro»*.

1. **Deciso il 31/08/2026**, costruendo i controlli su GitHub: girano a ogni
   proposta, perché prima dipendevano dal fatto che qualcuno se le ricordasse.
2. **La ragione di allora**: preferire l'automazione alla disciplina — la
   disciplina si degrada, l'automazione no.
3. **Adesso**: le prove che chiamano davvero il modello restano fuori dal giro
   automatico, e si chiedono apposta.
4. ⚠️ **La ragione di allora vale ancora intera, e questo è il prezzo che
   accettiamo**: quelle prove provano una cosa che nessun'altra prova può
   provare — che il modello *capisce* — e da oggi la sorveglia una persona.
   Si paga perché dall'altra parte c'è una spesa che parte da sola a ogni
   giro.

**E una rinuncia dichiarata dentro la migrazione** (`-- rete-guardie:`): la
colonna `impegni_compatibili.esatto` **se ne va**, perché è diventata un
doppione — diceva «combacia parola per parola», che adesso è `grado = 1`. Due
colonne che dicono *esattamente* la stessa cosa sono un riflesso da togliere,
non una rete da tenere (discriminante del 17/08). ⚠️ La rete del progetto l'ha
**presa da sola** al primo tentativo di applicare, e ha preteso la
dichiarazione: ha funzionato come doveva.

## Le prove, e cosa dimostrano

* **Pure** (`tests/unita/appunti-candidati.test.js`, 7): i candidati si
  leggono col loro giorno, «senza scadenza» arriva come vuoto dichiarato, una
  forma che non è un elenco non fa esplodere niente, e **i candidati non
  compaiono fra i dati che verrebbero scritti**.
* **Pure** (`tests/unita/prove-che-costano.test.js`, 6): la regola dei costi
  ricava le funzioni a pagamento dal sorgente, guarda **tutta** la cartella
  della funzione, distingue *nominare* da *chiamare*, e — sul progetto vero —
  **vede** la prova che c'è. ⚠️ Quest'ultima non diventerà rossa se ne
  nascesse un'altra (la regola la escluderebbe da sola): quello che pretende è
  che la regola non sia spenta.
* **Schermata** (`tests/schermate/appunto-agenda.test.jsx`, 6 nuove su 18): i
  due titoli si leggono, ognuno porta il suo giorno, mostrarli **non** li
  rende approvabili, **non sono toccabili**, «senza scadenza» si vede, e
  quando l'impegno è uno **l'elenco non compare affatto**.
* **Contro il progetto di prova**
  (`tests/app/agenda-riconosce-impegno.test.js`, 8): la variante naturale
  trova l'impegno **e approvando lo chiude** (e l'altro no); maiuscole,
  punteggiatura, spazi doppi e accenti insieme; due candidati pari non si
  approvano e **si leggono col giorno**; un candidato senza scadenza porta il
  giorno vuoto; **il titolo esatto vince su chi lo contiene**; nessun
  candidato non mostra elenchi e non crea niente; lo spostamento conserva
  identificativo, giorno di prima e giorno nuovo e sposta **solo quello**;
  l'impegno chiuso fra proposta e sì **rifiuta e non pesca il somigliante**.

## Una prova della #44 che si era rotta da sé

🔴 **`tests/app/agenda-a-voce.test.js` è diventata rossa, e NON per colpa di
questo lavoro.** Diceva `expect(riga.motivo).toMatch(/quale dei 2/)`, e ha
ricevuto *«quale dei 3»*.

⚠️ **Misurato invece che dedotto.** Il terzo candidato è un impegno **vero**
comparso sul progetto di prova oggi alle **14:53** — «Ordine delle verdure»
— quasi certamente dal collaudo a mano di Alessio sulla #44. Valutando il
predicato **della regola vecchia** su quei tre titoli, combaciavano
**tutti e tre lo stesso**: quella prova si sarebbe rotta oggi anche senza
una riga di questo lavoro, e la stessa cosa succederebbe alla CI della #44.

**Cosa si è fatto**: l'asserzione non fissa più il numero. Pretende la
forma della frase (`/quale dei \d+ impegni aperti/`) e — questa è la
proprietà che conta — che i **due impegni creati dalla prova** siano fra i
candidati mostrati. ⚠️ È la regola del 16/08 applicata a una prova invece
che a una migrazione: *un guardiano dice come deve essere fatto il mondo,
non com'era quando l'ho guardato.* Un numero letto dal database e scritto
dentro una prova è un fossile.

## La verifica della migrazione discrimina

Dieci controlli, e **provati per rottura invece che riletti** — estraendo il
**solo blocco di verifica**, perché rilanciare la migrazione ripara la
funzione prima di verificarla (lezione del 26/08).

| rottura voluta | errore ottenuto |
|---|---|
| la normalizzazione smette di togliere gli articoli | *«gli articoli non se ne vanno: "il rinnovo della firma"»* |
| la scala perde il gradino 2 | *«la variante naturale doveva combaciare al gradino 2, e invece "(niente)"»* |
| si sceglie il primo fra due pari | *«con due candidati pari ne ha scelto uno — 6ef97283…»* |

⚠️ **La prima rottura ha fatto scattare il primo controllo e ha fermato i
successivi** — che è precisamente la trappola del 26/08. Per questo ne sono
state fatte tre, mirate a gradini diversi della verifica.

## Cosa NON è verificato

* 🔴 **Nessuno ha guardato la schermata con gli occhi.** L'elenco dei
  candidati è provato dal DOM montato in prova, non visto: colori, ingombro
  sul telefono e leggibilità con le luci basse non li ha visti nessuno.
* 🔴 **Nessuna frase è stata dettata davvero.** Il mandato vieta le chiamate
  al modello, quindi la classificazione della frase è esercitata con
  `destinazioneAgenda` (codice nostro, deterministico) e non col modello vero.
  ⚠️ **Il pezzo scoperto è preciso**: che il modello, sentendo «segna come
  fatto il rinnovo della firma digitale», metta in `impegno` il nome nudo. Su
  quello la fase 2 aveva fatto quattro chiamate vere; qui zero.
* ⚠️ **La soglia dei cinque candidati mostrati non è mai stata raggiunta da
  una prova**: le prove ne costruiscono due. Il ramo del taglio esiste e non
  è stato percorso.
* ⚠️ **Niente è stato applicato alla produzione**, e la migrazione non è mai
  girata contro dati veri: in produzione gli impegni aperti sono di Alessio,
  e i titoli veri potrebbero far emergere ambiguità che i titoli inventati
  delle prove non hanno.
* ⚠️ **Le rosse locali sono un artefatto di fine riga**, non un difetto:
  `indice-richieste` (e `indice-rovesciamenti`, prima che rigenerassi
  l'indice). Misurato: normalizzando il file a LF passano. Su Linux — dove
  gira la CI — i file arrivano a LF.
* ⚠️ **Sul progetto di prova è rimasto un residuo che non è di questo
  lavoro**: un impegno `TEST-AUTO appunti#kiwdlpp promemoria a9cf315a` del
  06/09. Non l'ho toccato — *una pulizia cancella solo le righe che ha
  creato lei* (23/08) — ma va detto che c'è.
* ⚠️ **E c'è un impegno vero, «Ordine delle verdure», nato oggi sulla
  prova**: non l'ho toccato perché non è mio. È quello che ha reso rossa la
  prova della #44.
