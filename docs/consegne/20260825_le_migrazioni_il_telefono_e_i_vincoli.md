# Le migrazioni, il telefono e i vincoli che parlano italiano
**25/08/2026 — consegna del mandato del collaudo, sei blocchi**

Commit sotto questo riepilogo: **fe33ec012ac3106dc0b289747797fbdc906838f1**

**Stato delle migrazioni a fine consegna**, misurato e non ricordato:

| dove | quante |
|---|---|
| repository | **238** |
| produzione | **234** |
| progetto di prova | **238** |

Le quattro che mancano in produzione — `20260824000033`,
`20260825000001`, `…002`, `…003` — **aspettano il push di Alessio**: lo
strumento si rifiuta di applicare ciò che non è ancora su GitHub.

---

## Blocco 0a — le migrazioni in attesa

Stato di partenza: **226 in produzione**, 235 nel repository, 9 in
attesa. Repository allineato con GitHub (`c5df7cd`).

### Applicate — otto, non nove

- **`20260824000030`** — *i diciassette confronti reggono*. **Non
  eseguita: registrata** dalla `20260824000032`, che ne rifà il
  controllo con roba propria. È la prescrizione scritta dentro la
  `…032` stessa.
- **`20260824000032`** — *i confronti col foglio non devono
  peggiorare*. Aggiunge `confronti_storti(uuid)`.
  - ⚠️ **Misura riportata dall'applicazione**: sulla previsione
    congelata, **17 confronti, 6 non tornano**. Vedi il blocco 0d.
  - ⚠️ Il ramo che esercita la rottura **non è stato percorso in
    produzione**: non esiste nessuna previsione libera (misurato: 1
    previsione in tutto, congelata). La migrazione lo dichiara con un
    `notice` invece di fingere di aver provato.
- **Le sei degli allergeni**, nominate per intero — `20260824000034`,
  `20260824000035`, `20260824000036`, `20260824000037`,
  `20260824000038`, `20260824000039`. Verificato prima di applicarle che
  **nessuna** nomini `scala`, `scale_che_non_tornano`,
  `scenario_linee_accessorie` o `calcola_proiezione`: sono indipendenti
  dalla `…033`.
  - 🔴 **E LA RETE DEI RIEPILOGHI MI HA PRESO IN FALLO SU QUESTA STESSA
    RIGA.** Prima diceva «`20260824000034` → `…039`», e alla successiva
    applicazione lo strumento si è fermato: quattro versioni — la `…035`,
    la `…036`, la `…037`, la `…038` — **esistevano solo come freccia**.
    È precisamente il caso che la regola del 15/08 dichiara («i riepiloghi
    fra il 10 e il 15/08 nominano le migrazioni in forma abbreviata») e
    che la soglia esiste per non far tornare. *Una scorciatoia di scrittura
    diventa un buco di documentazione al primo che va a cercare.*

### Fermata a metà — e cosa ha lasciato dietro

**`20260824000033`** — *la scala di una linea è un dato*:

> `ERROR: Nessuna previsione libera: la rete non puo' essere provata
> rompendola, e una rete mai vista scattare non si sa se scatta.`

Aveva ragione a fermarsi. Sbagliato era il **perimetro**: cercava una
previsione libera **fra quelle di Alessio**, e in produzione ce n'è una
sola ed è congelata. È la regola del 16/08 — *il perimetro di una prova
dev'essere fatto di roba che la prova ha creato*.

🔴 **E SI È FERMATA DOPO LE DDL.** Misurato dal connettore in sola
lettura, non dedotto:

| cosa | stato in produzione |
|---|---|
| colonna `scenario_linee_accessorie.scala` | **presente** |
| vincolo `linea_scala_nota` | presente |
| `scala_del_calcolo`, `scale_che_non_tornano` | **create** |
| riga in `applied_migrations` | **assente** |

È la trappola scritta in CLAUDE.md §8 il 23/08 — *il messaggio dello
strumento dice che non lascia niente a metà: non è vero quando il blocco
che fallisce sta in fondo* — **ricomparsa**.

**Chiusa da `20260825000001`**, che constata il lavoro già presente
(senza riscrivere le funzioni: si constata, non si ricopia a memoria),
si costruisce **la propria previsione**, la rompe, controlla che la rete
scatti, controlla che taccia con la scala giusta, prova il vocabolario e
il portiere, e ripulisce per identificativo spegnendo `trg_log_delete`.
Poi registra la `…033`.

⚠️ **Debito dichiarato, nessuna rete lo copre**: su una ricostruzione da
zero la `…033` gira prima e si ferma di nuovo. Va saltata come la
`…030`. La `20260825000001` non può ripararlo da sé — viene dopo.

### Un dato vero emerso per strada

Sulla previsione congelata la linea **«Eventi premium (n/mese)»** ha la
scala che non torna: il nome dice «al mese», il calcolo la legge «per
evento». Già confermato il 24/08 — sono 24 eventi **all'anno**, i numeri
del piano sono giusti, **mente l'etichetta**.

### Righe esistenti toccate

- la `…032` modifica e **rimette com'era** i `controlli` di una
  previsione libera — ramo **non percorso** in produzione;
- tutte le altre scritture stanno su **tabelle nate in questa serie**;
- ogni verifica conta le **lapidi** prima e dopo.

**Nessun dato di Alessio è stato cancellato o modificato in modo
permanente.**

---

## Blocco 0b — quali sostitutivi servono

Letto sul **progetto di prova** (in produzione ci sono 14 ricette ma
**zero ingredienti**, quindi lì non c'è niente da leggere). Misurato:
116 ricette, 132 ingredienti, 319 righe.

🔴 **E la prima misura è la più importante: solo 2 ingredienti su 132
hanno gli allergeni compilati** — «Farina di grano duro» (glutine) e
«Ricotta di pecora» (latte), entrambi `confermati`. Finché resta così,
il lavoro degli allergeni al tavolo è **quasi muto**: non è rotto, è che
non sa cosa contengono i piatti.

L'elenco, per numero di ricette che li usano, è in chat (non qui: sono
dati del locale e il repository è pubblico).

---

## Blocco 0c — due alternative allo stesso ingrediente

**Non fatto, per decisione di Alessio.** Nessuna riga scritta.

---

## Blocco 0d — dove guardare i 3.600 €

Misurato: i costi fissi del gestionale sono **15 voci**, il foglio ne
dichiara meno per l'equivalente di **300 €/mese**. Ci sono **due voci da
300 €/mese**, e senza il foglio non si può dire quale sia quella in più.

🔴 **E c'è un difetto che cambia la risposta**: su una previsione
**congelata** l'elenco delle voci di costo fisso **non è visibile da
nessuna schermata**. Il dettaglio mostra solo il totale; il modulo di
modifica si rifiuta di aprirsi (`PrevisioneForm` solleva «questa
previsione è chiusa»). Quindi Alessio non può andare a guardare da solo:
le voci gli sono state date in chat.

**Non corretto** — costruire una vista in sola lettura delle voci di una
previsione congelata è una scelta di disegno che non era nel mandato.

---

## Blocco 0e — il food cost col sostituto

**NON COSTRUITO: richiede una scelta, ed è descritta in chat coi
numeri.** Quello che è stato misurato:

- la regola su *quanto* sostituto usare **esiste già** in
  `fabbisogno_conto` (stessa quantità dell'originale; se non c'è
  sostituto, non esce niente). Non c'è niente da inventare lì.
- 🔴 **ma i due calcoli divergono già oggi, senza nessuna
  sostituzione.** Confrontati su dieci conti chiusi veri del progetto di
  prova: differenze fino al **35%** su un conto (5,11 contro 3,32) e
  intorno al **4%** sui conti grandi.
- **la causa, misurata**: **14 preparazioni hanno lotti in giacenza**.
  `fabbisogno_conto` non le esplode (interruttore del 14/08: una
  preparazione che ha lotti si consuma col costo congelato di quando è
  stata prodotta), `v_recipe_costs` le esplode fino alla materia prima
  ai prezzi di oggi. **Non sono due errori: sono due risposte a due
  domande diverse**, ed è per questo che la scelta è di Alessio.
- misurato anche cosa **non** cambierebbe: **0 righe mai inviate** in
  4566, quindi cambiare la base non toglierebbe nessuna riga; le 1845
  voci libere sono già escluse da entrambi i calcoli.

---

## Blocco 1 — il progetto di prova dal telefono

**Non è servito toccare niente del sistema.** Misurato, non dedotto:

- il server ascolta già su tutta la rete (`host: true` in
  `vite.config.js`, che vale anche per `dev:prova`);
- il server attivo punta **già** al progetto di prova
  (`bnwqgpuyzmzujxfbtyvs`) — chiesto al server stesso, non dedotto dalla
  riga di comando, che non lo distingue;
- esistono **già** due regole firewall *Allow* in ingresso per
  `C:\Program Files\nodejs\node.exe` sul profilo **Public**, che è
  quello della Wi-Fi; e il processo che serve il gestionale è
  esattamente quell'eseguibile;
- provato: `http://172.20.10.7:5173` risponde **HTTP 200** e serve il
  progetto di prova.

⚠️ **L'unica cosa che non si può provare da qui è la connessione da un
altro dispositivo**: il traffico verso il proprio indirizzo non
attraversa il firewall in ingresso. Tutto il resto della catena è
verificato.

**`npm run dev:prova` ora stampa da sé gli indirizzi di rete**, calcolati
a ogni avvio e non scritti a mano — l'indirizzo dell'hotspot cambia ogni
volta che si riaccende, e un numero scritto in un messaggio è una frase
che diventa falsa. Le schede senza rete (`169.254.x.x`) sono escluse.

### Le misure delle schermate, a 390×844 con `--pxcm 64`

| schermata | scorre di lato | testi < 3,20 mm | bersagli < 8,50 mm |
|---|---|---|---|
| Dashboard | no | 0 | 0 |
| HACCP (principale) | **54 punti** → **corretto** | 0 | 0 |
| HACCP temperature | no | 0 | 0 |
| HACCP pulizia | no | 0 | 1 (6,81) |
| HACCP non conformità | no | 0 | 1 (6,81) |
| HACCP raccolta propria | no | 0 | 0 |
| Ricettario (indice) | no | 9 (min 2,19) | 0 |
| Ricettario · elenco ricette | no | 0 | 0 |
| **Ricettario · scheda ricetta** (dove vive il finger food) | no | **150** (min **1,88**) | **39** (min **2,5**) |
| **Ricettario · ingredienti** | no | **835** (min **1,88**) | 5 (min 2,5) |
| Spesa spicciola | no | 0 | 0 |
| Magazzino | **653 punti** → **corretto** | 0 | 0 |
| Comande | **143 punti** → **corretto** | 0 | 0 |
| Cassa | no | 1 (2,81) | 2 (6,81) |
| Pianta della sala | no | 0 | **2** (min **2,5**) |

🔴 **I due casi grossi restano aperti**: la **scheda di una ricetta** e
l'**elenco ingredienti** sono illeggibili alla calibrazione di un
telefono — 985 testi sotto soglia fra le due, il peggiore a 1,88 mm
(meno di un terzo del minimo). Non è una rifinitura: è un lavoro a sé, e
non era nel mandato.

⚠️ **E una casella da 2,5 mm nella pianta della sala** — meno di un
terzo del bersaglio minimo.

⚠️ **Una mia misura ha sbagliato, e l'ho corretta**: al primo giro
`/haccp/temperature` risultava **vuota**. Non lo era: ci metteva più di
1,4 secondi a caricare, e la mia attesa era troppo corta. Portata a 3,5
secondi la schermata c'era tutta.

---

## Blocco 2 — i quesiti per Tiziana

Aggiunti **T3**…**T7** in `docs/quesiti/QUESITI_CONSULENTI.md`, con la
stessa forma degli altri (contesto · domanda · cosa cambia nell'app ·
dove vive · stato). **Nessun importo**: il repository è pubblico.

- **T3 · le durate per tipo di conservazione.** ⚠️ Il numero è stato
  **rimisurato**: sul progetto di prova sono **3 prodotti su 132** ad
  avere una durata, non «2 su 129».
- **T4 · la forma dei registri per l'ASP**, dichiarando che le tre
  schermate hanno oggi un formato **provvisorio deciso da noi**.
- **T5 · l'elenco vero delle pulizie** (quelle di adesso le ha inventate
  Alessio per provare la schermata, e finché è così il contatore «da
  fare oggi» è un numero inventato con l'aria di essere vero).
- **T6 · la contaminazione crociata nella nostra cucina** — l'olio di
  frittura condiviso, che nessuna ricetta può sapere. È la promessa più
  delicata che il gestionale faccia: «senza pesce» detto a un allergico.
- **T7 · come si dimostra il riconoscimento di una specie raccolta**,
  distinta da T2 e agganciata a lei.

---

## Blocco 3 — la spesa spicciola

### (a) Il tocco non aspetta più il database

**Misurato prima di correggere**, non stimato: fra il tocco e il cambio
della riga passavano **389 ms in media** (320-430 su tre giri), ed erano
**due** giri di rete — l'aggiornamento e poi la rilettura dell'elenco
intero. Quella misura è fatta **dal computer**: dal telefono, in un
supermercato, è peggio.

**Adesso**, misurato a schermo: **7 ms** sulla spesa spicciola, **39 ms**
sulla stella dell'Agenda, **33 ms** sul «fatto».

La regola sta in [`src/lib/calcoli/tocco.js`](../../src/lib/calcoli/tocco.js)
e non dentro le schermate, **perché il ritorno indietro si prova solo
potendo far fallire il salvataggio apposta**: dentro un componente
`salva` è una chiamata al database che nessuna prova può rompere.

🔴 **E LA PRIMA CONTROPROVA NON AVEVA PROVATO NIENTE.** Nel browser vero
avevo rotto `window.fetch` per simulare la caduta della rete: il
collegamento al database ne aveva già una copia sua, quindi il
salvataggio **era riuscito**. La riga non tornava indietro perché non
doveva. Me ne sono accorto **solo chiedendo al database com'era finita
la riga**, invece di fidarmi di quello che mostrava lo schermo.

Ora sono **9 prove pure**, provate rompendole in due modi: tolto il
ritorno indietro → 3 rosse (le tre giuste); rimesso il tocco lento → 1
rossa (la prima).

⚠️ **`togliSubito` restituisce `{ok, esito}` e non l'esito nudo**: un
impegno completato che non genera un successore e un salvataggio fallito
sarebbero stati **lo stesso valore vuoto** — la stessa forma del
«percento» che in questo database vuol dire due cose.

### I gesti veloci trovati, e quali sono stati sistemati

**Sistemati (3):**
- spesa spicciola · «preso» e «rimetti in lista»
- Agenda · «fatto» (la riga sparisce subito; il ricarico resta **dopo**,
  perché la ricorrenza la sa solo il database)
- Agenda · la stella «per me conta» — ⚠️ non ricaricava l'elenco, ma
  aspettava lo stesso la risposta prima di accendersi, e **se falliva
  non tornava indietro perché non era mai andata avanti**

**Lasciato apposta (1):** «Cancella» della spesa spicciola — è l'unico
gesto lì dentro che non si disfa, e vedere l'effetto solo quando è
davvero avvenuto è una garanzia.

⚠️ **Il setaccio è PARZIALE e va detto**: **30 schermate** ricaricano
dopo un'azione, ma non tutte sono «gesti veloci» (ricaricare dopo aver
registrato una fattura è giusto). Ho ristretto ai gesti che cambiano un
interruttore su una riga di un elenco e si ripetono in fila, e ne ho
guardati alcuni — **non tutti e 30**. Le Comande, il Bar, la Cucina, le
spunte HACCP e l'Editor Menu **non sono stati misurati**.

### (b) I bersagli

Riga da **10,5 → 12 mm**, nome dell'articolo da **3,2 → 4 mm**, e via il
`disabled` che spegneva i pulsanti durante il salvataggio. La regola del
24/08 vale qui più che altrove: *3,20 mm è il minimo accettabile, non
l'obiettivo*.

### (c) La lista su WhatsApp

Stessa forma degli ordini ai fornitori: il gestionale **prepara il testo
e apre WhatsApp**, non manda niente. ⚠️ **Senza destinatario**, e qui è
una differenza vera con gli ordini: un ordine ha il numero del
fornitore, questa lista no. ⚠️ **Si copia sempre prima e si apre dopo**
(lezione del 14/08: se il programma non è installato, `whatsapp://` non
fa **niente**).

---

## Blocco 4 — la schermata HACCP disallineata

🔴 **Una riga sola spiegava tutti e tre i sintomi**: la scheda era
`inline-flex items-center`, cioè metteva icona, contatore, titolo e
descrizione **in fila orizzontale**. Da lì: «Tracciabilità lotti»
toccava la sua descrizione perché le era **affiancata**, il contatore si
infilava fra icona e titolo perché era il **secondo della fila**, e la
pagina sbordava di **54 punti** (444 su 390).

**Guardata dopo**, non dedotta: 390 su 390, zero elementi fuori, i tre
impilati su tutte e sei le schede, contatori sopra il titolo e a destra,
stacco titolo-descrizione da **0,63 a 1,3 mm**.

**E lo stesso difetto è saltato fuori in altri due posti** misurando dal
telefono: **Magazzino** (una fila larga 1027 punti, sbordo di 653) e
**Comande**, cioè la schermata del servizio (barra larga 436, sbordo di
143). Corretti tutti e due.

⚠️ **La cura delle Comande si è misurata due volte**: con `flex-wrap`
sui soli pulsanti la barra andava su **tre** righe alte 154 punti — il
testo a sinistra le lasciava 358 punti dei 417 che chiede. Mandando a
capo anche il contenitore sono **due** righe da 104. Sul computer resta
**una** riga da 54.

---

## Blocco 5 — i vincoli parlano italiano?

**Provati davvero da una schermata**, non dedotti dal codice.

1. ✅ **La temperatura a −100 ora scatta.** Era il caso saltato fuori
   senza vincolo: `temperature_dentro_il_mondo` esiste e rifiuta, con la
   sua frase italiana. Provato inserendo −100 su una lettura vera.
2. 🔴 **Nessuno risponde in inglese, ma 14 vincoli nuovi su 51 davano il
   messaggio di ripiego** — «c'è una regola che lo impedisce (nome)» —
   che dice **che** c'è una regola, non **quale**. Misurato a schermo su
   `menu_items_prezzo_non_negativo` e `ricevimento_temperatura_sensata`.
3. 🔴 **E il guardiano che doveva impedirlo era un elenco scritto a
   mano**: la verifica del 24/08 controllava **14 nomi elencati uno per
   uno**, quindi niente di nato dopo era coperto.

**Le 14 frasi ora ci sono**, e il guardiano è diventato una **proprietà**
(`vincoli_senza_frase()`, che costruisce l'elenco dal catalogo) con lo
stato di partenza congelato in `vincoli_muti_noti`.

⚠️ **Soglia dichiarata**: in tutto il database ci sono **212** vincoli
`check` e **170** erano senza frase. Pretenderle tutte darebbe 170
allarmi, e un controllo che grida sempre viene spento. Se ne congelano
**156** e si sorveglia che **non crescano**.

🔴 **Un difetto trovato provando**: la memoria delle spiegazioni
ricordava anche l'**assenza**, quindi dopo aver scritto le 14 frasi due
vincoli continuavano a dare il messaggio generico finché non si
ricaricava la pagina. Ora si ricorda **solo ciò che si è trovato**.

🔴 **E la prova nuova entra dal collegamento dell'app**: con un client
suo riceveva «violates check constraint» **in inglese**, perché la
traduzione vive dentro `src/lib/supabase.js`. Scoperto **facendola
fallire**. Provata rompendola: creando un vincolo muto diventa rossa e
**lo nomina**.

---

## Blocco 6 — «aggiornato il» che diceva il falso

🔴 **La misura ha corretto la diagnosi due volte.**

- La voce diceva «due tabelle»: sono **cinque** —
  `correzioni_coperti`, `disposizioni_giornaliere`, `formati_tavolo`,
  `impostazioni_tesoreria`, `service_hours`. Le altre **trenta** colonne
  dello stesso nome il trigger ce l'hanno.
- La voce diceva «il valore non viene mai aggiornato»: **viene
  aggiornato**, dall'applicazione, con `new Date().toISOString()`. I
  difetti veri sono due e sono **peggio**:
  1. **l'ora è quella del dispositivo**, non del database (lezione del
     20/08: *i due orologi non sono lo stesso orologio*);
  2. **dipende da chi si ricorda di scriverla** — una funzione SQL non
     passa affatto dall'applicazione, e lascia la colonna indietro
     **senza nessun errore**.

Ora la scrive un **trigger**, e le sei scritture a mano sono tolte dal
client (`service_settings` compresa: il trigger ce l'aveva già e
riceveva lo stesso l'ora del browser).

⚠️ **Solo `before update`, mai `before insert`**: su una riga appena
creata «aggiornato il» vuoto vuol dire «mai modificata», ed è vero.

**La verifica dichiara una proprietà, non un elenco**, e la controprova è
l'aggiornamento che **non nomina** la colonna — cioè il caso vero. Per
averlo si spegne il trigger, si scrive una data del 1990, si riaccende
(controllando di averlo fatto). ⚠️ **Non si prova che la data
«avanza»**: dentro una transazione `now()` è **un istante solo**.
Provata rompendola: tolto un trigger, si ferma e **nomina la tabella**.

---

## Un allarme falso, guardato invece che archiviato

La rete dei portieri accusava la `20260825000001` di chiamare
`scale_che_non_tornano()` senza claims. **Guardato caso per caso**: non
la chiama — il nome compare dentro `to_regprocedure('public.…()')` e nel
testo di un messaggio. Due cure diverse apposta: `to_regprocedure` entra
nella depurazione dell'euristica (è un **quarto** modo di nominare una
funzione senza chiamarla, e chiunque lo userà domani avrebbe lo stesso
allarme), e il nome nel messaggio si chiude con `rete-portieri:`, **nella
migrazione che chiude il caso** e non in quella che l'ha causato.

⚠️ Si depura **solo** quella forma e non tutte le stringhe: un nome
dentro una stringa può essere una chiamata vera se finisce in un
`execute`. **E la dichiarazione non spegne la rete**: provato creando un
file che chiama davvero quella funzione senza claims — torna rossa.

---

## Cosa NON è stato verificato con gli occhi

- **Nessuna immagine è stata guardata**: in questo ambiente lo
  screenshot non funziona. Tutto ciò che è «visto» è **misurato dal
  DOM**. Colori, contrasto e leggibilità con la luce del locale non li
  ha visti nessuno.
- **Il gestionale di prova non è stato aperto da un altro dispositivo**:
  la catena è verificata fino all'ultimo anello che si può provare da
  qui.
- **Le sostituzioni allergene non sono state esercitate**: zero
  sostituzioni fatte, e solo 2 ingredienti su 132 hanno gli allergeni.
- **Il pulsante WhatsApp non è stato premuto per davvero**: si è
  verificato il testo che comporrebbe, non l'apertura dell'app.
- **Il setaccio dei gesti veloci è parziale** (vedi blocco 3).

## Cosa è stato dato per fatto senza misurarlo

- Che le due voci da 300 €/mese siano le sole candidate: **il foglio non
  è stato letto** (non entra nel repository), quindi quale delle due sia
  quella in più non è misurato.
- Che i vincoli con la frase la diano *tutti* correttamente: ne sono
  stati provati a schermo **quattro**, non 42.

## Affermazioni diventate false mentre lavoravo

- Il primo riepilogo di questo blocco diceva **«applicate 8 su 8»**: era
  vero finché la `…033` non si è fermata. Il numero vero è **6 + 2
  registrate**.
- La mia prima misura diceva **`/haccp/temperature` vuota**: falso, era
  lenta.
- La prima controprova del ritorno indietro diceva **«non torna
  indietro»**: falso, la mia rottura non aveva rotto niente.
- Il commento in `src/lib/supabase.js` diceva «i `comment on constraint`
  che ogni vincolo di questo progetto ha già»: **erano 42 su 212**.

---

## Cosa abbiamo rovesciato

*(sezione fissa, anche quando è vuota)*

**Un rovesciamento, e va registrato**: la verifica della `…033`
pretendeva di provare la rete su una previsione **di Alessio**, e quella
scelta è stata rovesciata — adesso la prova **si costruisce la propria**.

- **Cosa era stato deciso e quando**: 24/08/2026, dentro la `…033` —
  la rete si prova rompendola su una previsione libera esistente.
- **La ragione di allora**: rompere qualcosa di vero dimostra che la
  rete scatta sui dati veri, non su un caso costruito ad arte.
- **Cosa si decide adesso**: la prova si costruisce la previsione, la
  rompe e la cancella.
- **Perché la ragione di allora non vale più**: non è che non valga —
  **vale ancora, e questo è il prezzo che accettiamo**. Una prova su
  roba propria non dimostra che la rete scatta sui dati di Alessio,
  dimostra che scatta. Ma l'alternativa non era «provarla sui dati
  veri»: era **non provarla affatto**, perché in produzione una
  previsione libera non esiste — e una rete mai vista scattare non si sa
  se scatta.

Registrato anche in [`docs/decisioni_rovesciate.md`](../decisioni_rovesciate.md).

---
---

# SECONDA PARTE — dopo il push e le conferme di Alessio

**Le quattro migrazioni in attesa sono state applicate** — `20260824000033`,
`20260825000001`, `20260825000002`, `20260825000003`, nominate qui per
intero perché la rete dei riepiloghi cerca il numero completo e una
forma abbreviata per lei non esiste: la produzione è
passata da 234 a **238**, allineata col repository e col progetto di
prova. Numeri veri letti dopo, non dedotti: 156 vincoli muti congelati,
i vincoli con la frase italiana da 42 a **56**, **zero** colonne
«aggiornato il» senza trigger, **zero** lapidi lasciate dalle verifiche.

🔴 **E LA RETE DEI RIEPILOGHI HA PRESO IN FALLO QUESTO STESSO
DOCUMENTO**, al primo tentativo di applicare: quattro versioni degli
allergeni — `20260824000035`, `…036`, `…037`, `…038` — erano nominate
solo da una freccia (`…034` → `…039`) e per lei non esistevano. È il
caso che la soglia del 15/08 dichiara. Corretto nominandole per intero.

---

## Punto 1 — il food cost col sostituto: la diagnosi era SBAGLIATA

Alessio ha scelto «comanda il magazzino» e ha chiesto la spiegazione
prima di qualunque modifica. La spiegazione **rovescia quello che questo
stesso documento diceva poche ore prima**.

### Il conto vero, riga per riga

**T6 del 31 luglio** — una Busiate, due «Selezione da strada», cinque
voci libere.

| | dalla ricetta | dal magazzino | scarto |
|---|---|---|---|
| Busiate al pesto | 0,8020 | 0,6700 | 0,1320 |
| Selezione da strada | 2,1547 | 1,3268 | **0,8279** |
| Selezione da strada | 2,1547 | 1,3268 | **0,8279** |
| voci libere (×5) | — | — | non valorizzate |
| **totale** | **5,11** | **3,32** | **1,79** |

Dentro «Selezione da strada», gli ingredienti che il magazzino **non
scarica affatto**: aceto di vino bianco, panna fresca, cipolla di
Giarratana, capperi di Salina, pistacchio di Bronte, oliva nocellara,
sedano verde, ricotta salata. E tre che scarica **in parte**: melanzana
(0,0516 kg contro 0,0170), zucchero (0,0158 → 0,0098), olio evo
(0,0077 → 0,0055).

### Perché — e la misura ha corretto la diagnosi DUE volte

1. Prima ipotesi: «le otto sotto-preparazioni del piatto hanno lotti».
   **Falso**: misurate una per una, nessuna delle otto ha lotti.
2. Scendendo di un livello: **tre preparazioni di secondo livello** ne
   hanno — Caponata (1,446 kg), Crema di pistacchio (0,955), Crema di
   ricotta salata (0,939). Sono esattamente quelle che spiegano gli
   ingredienti mancanti.

🔴 **E QUI STA IL PUNTO: NON SONO DUE DECISIONI CHE CONVIVONO. È UN
DIFETTO.** La decisione del 14/08 dice che una preparazione **che ha
lotti** non si esplode — *si consuma*. `fabbisogno_conto` fa la prima
metà (smette di esplodere) e **non fa la seconda**: la riga della
preparazione non ha `ingredient_id`, e la `select` finale la scarta.
Risultato: di quel piatto **non esce niente**, né le melanzane né la
caponata.

**Misurato, non dedotto:**
- **13.624 scarichi** registrati, di cui **1** su una preparazione — e
  quell'uno è uno scarico **a mano**, non da un conto;
- **346 conti** hanno scaricato magazzino: **nessuno** ha mai toccato
  una preparazione;
- **14 preparazioni** hanno **15,2 kg** in giacenza che non scendono mai.

⚠️ **Quindi la risposta alla domanda di Alessio è: nessuna delle due
decisioni va rivista.** La decisione del 14/08 è giusta e resta; quello
che manca è la sua seconda metà, che non è mai stata costruita. Con
«comanda il magazzino» il food cost erediterebbe **anche questo buco** —
ed è il motivo per cui la correzione va fatta **prima**, non dopo.

⚠️ **E un secondo fatto emerso**: `fabbisogno_conto` guarda la giacenza
**di adesso** (`quantity_remaining > 0`), non quella del giorno del
conto. Sullo stesso conto passato dà risposte diverse a distanza di
tempo.

**Non corretto in questa consegna**: è un difetto del magazzino, non del
food cost, e cambia i numeri di una tabella vera.

---

## Punto 2 — le voci di una previsione chiusa

Fatto. Il dettaglio ora elenca le voci di costo fisso dalla più cara,
col totale **ricalcolato dalle righe** e non letto dal riepilogo — se i
due divergessero, chi guarda lo vedrebbe.

- Non è servito «aprire» niente: la policy è già `for all using
  (is_titolare())` e in Postgres **non esistono trigger sulla lettura**.
  Il sigillo riguardava sempre e solo le scritture.
- Verificato in produzione: **15 voci** su previsioni congelate.
- Guardato a schermo sul progetto di prova: 4 voci, ordinate, col
  totale.

🔴 **E LA PROVA DEL SIGILLO STA IN UNA MIGRAZIONE** (`20260825000004`),
non in una prova automatica, per una ragione **misurata**: cancellare la
previsione di prova lascia una **lapide** che dal client nessuno può
ripulire, e una prova automatica ne lascerebbe una a ogni giro. Provato:
il registro del progetto di prova è passato da 1683 a **1684**, e quella
riga è stata tolta per identificativo. È la decisione già scritta in
CLAUDE.md dal 15/08.

⚠️ **Due cose trovate applicando**: il congelamento **fotografa** i
risultati in `scenario_risultati`, che ha il suo sigillo (i nomi dei
trigger sono stati chiesti al catalogo, non ricordati); e la prima
versione della prova automatica si fermava sul congelamento, facendo
fallire **di rimbalzo** la prova successiva su una previsione rimasta
aperta — che si leggeva «il sigillo non tiene».

---

## Punto 4 — i gesti lenti delle schermate del servizio

Misurato prima e dopo, come per la spesa spicciola:

| dove | gesto | prima | dopo |
|---|---|---|---|
| Bar | «✓ Evaso» su un ticket | **322 ms** | **53 ms** |
| Cucina | «segna non stampato» | **322 ms** | **28 ms** |

(322 è la media di tre giri, 242-460, **dal computer**.)

- **`toccaTutteSubito` nasce qui**: al banco non si segna pronta una
  riga, si segna pronto un **ticket**. Un ciclo manderebbe una richiesta
  per riga; questo ne manda **una**, e se fallisce tornano indietro tutte
  **ognuna al suo valore di partenza** — dentro un ticket le righe
  possono essere in stati diversi.
- ⚠️ **Sospeso il ricarico periodico mentre il salvataggio è in volo**:
  il giro dei dieci secondi può cadere fra il tocco e la risposta e
  riportare indietro il ticket per un istante. In servizio un lampeggio
  si legge «non ha preso» — cioè esattamente il doppio tocco che si sta
  togliendo. Il lucchetto è sul **ricarico**, non sui pulsanti.

**HACCP guardato e lasciato com'è, con la ragione**: lì i gesti sono
**creazioni** su registri esibibili (una pulizia fatta, una non
conformità chiusa con la sua azione correttiva), non spunte ripetute —
vedere l'effetto solo quando è avvenuto è una garanzia. Le due caselle
del ricevimento merci sono campi di un modulo: già istantanee.

---

## Le due regole nuove in §8

(a) **Una migrazione che fallisce dopo le DDL lascia il lavoro a metà**,
mentre lo strumento dice il contrario — col danno vero: fidarsi di quel
messaggio porta a **riapplicare cose già applicate**.
⚠️ **E il confine è più stretto di come sembra, misurato apposta**:
dentro un blocco `do` anche le DDL vengono annullate (rotto un trigger a
metà pulizia, i cinque trigger erano tutti accesi dopo). Il guaio è
delle istruzioni **fuori** dai blocchi.

(b) **Un difetto di ingombro è quasi sempre una famiglia**: trovatone
uno, si cerca subito nelle altre schermate — e il computer non lo
mostra.

---

## Cosa NON è stato verificato con gli occhi, in questa seconda parte

- **La sezione delle voci su una previsione CONGELATA**: guardata a
  schermo su una previsione **libera** (sul progetto di prova non ce ne
  sono di chiuse). Che funzioni anche sulla chiusa è provato dalla
  migrazione e dalla policy, non da un occhio.
- **Il gesto «Stampa» della Cucina non è stato premuto**: apre un
  dialogo di stampa bloccante. Misurato il gesto inverso, che passa
  dalla stessa funzione.
- **Nessuna immagine**: qui lo screenshot non funziona, tutto è misurato
  dal DOM.

## Affermazioni di questo stesso documento diventate false

- La prima parte diceva che la divergenza del food cost nasce da «due
  decisioni entrambe volute». **Falso**: è un difetto — il magazzino non
  scarica le preparazioni con lotti.
- Diceva anche «14 preparazioni con lotti, trattate diversamente». Il
  numero è giusto, ma **non sono quelle del piatto misurato**: quelle
  stanno un livello più in basso.
- Le sei migrazioni degli allergeni erano nominate con una freccia, e
  per la rete dei riepiloghi **non esistevano**.

---

## Cosa abbiamo rovesciato — seconda parte

*(sezione fissa, anche quando è vuota)*

Niente di deciso in precedenza. La decisione del 14/08 sulle
preparazioni con lotti **non è rovesciata**: si è scoperto che era
applicata a metà.
