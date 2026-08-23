# Le migrazioni in produzione, e le due che si sono fermate

**23/08/2026 — quarta consegna della sessione**, dopo `ebf036e`. Via
libera di Alessio dopo aver portato fuori dal computer il backup delle
22:26 (quello con le estensioni dentro).

| | |
|---|---|
| HEAD dichiarato | (l'ultimo commit di questa consegna) |
| produzione **prima** | 172 migrazioni · 103 tabelle · 564 righe |
| produzione **adesso** | **192 migrazioni** · 105 tabelle · 582 righe |
| prova | 194 migrazioni |
| applicate stasera | **20** (le 19 del 23/08 meno una, più cliente pagante e spesa spicciola) |
| fermate | **2**: `20260823000012` e `20260823000022` |
| forma dei due database | **identica** — 105 tabelle, 281 funzioni, 201 policy, 100 trigger |

---

## L'allineamento, misurato

Confrontate produzione e prova oggetto per oggetto: **nessuna tabella e
nessuna funzione sta in uno e non nell'altro**. Le due reti dei permessi
dicono gli stessi numeri su entrambi: **19** funzioni `security definer`
senza portiere, **10** eseguibili col solo `anon`.

E le undici funzioni principali sono state **chiamate**, non solo
guardate — *un corpo che si crea non è un corpo che funziona* (17/08):
lista della spesa, prodotti da compilare, partite in scadenza, prodotto
fermo, quadratura fiscale, incassi per giorno, pianta della sala, spesa
spicciola, categorie, e le due reti. Tutte rispondono.

## I conteggi che si sono mossi, e perché

Le righe sono passate da **564 a 582**. Tre movimenti, tutti spiegati:

- **`applied_migrations`: 172 → 192.** Sono le venti applicate.
- **Due tabelle nuove e vuote**: `spesa_spicciola` e
  `trasformazioni_dichiarate`.
- **`anomalie_scarico`: 3 → 0.** ⚠️ **Cancellazione dichiarata**, dentro
  `20260823000003`: toglie dall'elenco di «ciò che non è sceso» le righe
  che sono **bevande** (voce libera destinata al bar), perché quelle non
  scendono per scelta. Perimetro stretto, nessuna traccia lasciata nel
  registro (la tabella non è fra quelle tracciate — controllato dalla
  migrazione stessa, non dedotto). ⚠️ **Il commento della migrazione
  prevedeva «in produzione oggi sono zero»: erano tre.** Una previsione
  scritta a mano, sbagliata di poco e senza conseguenze — ma è la stessa
  famiglia dei conteggi che invecchiano.
- **`allarmi`: 3 → 4.** ⚠️ **Un allarme di prova è rimasto in
  produzione**: lo ha scritto la verifica di `20260823000002`, che
  costruisce un guasto apposta per dimostrare che un ingrediente rotto
  non porta via gli altri. Il messaggio lo dice da sé — *«guasto
  costruito apposta»* — ma **la migrazione avrebbe dovuto ripulirlo** e
  non l'ha fatto. Non l'ho tolto io: cancellare in produzione fuori da una
  migrazione è vietato (§2 punto 5). Va tolto con una migrazione, o
  lasciato come cicatrice dichiarata.

---

## 🔴 La prima che si è fermata: `20260823000006`

**Si è fermata a metà, e per un po' la produzione è stata rotta.**

La migrazione rinomina una colonna e poi riscrive le funzioni che la
nominano. La rinomina è andata; il ciclo che riscrive le funzioni si è
fermato con *«"array_agg" is an aggregate function»*. Risultato: la
colonna nuova esisteva e **quattro funzioni ne nominavano ancora una che
non c'era più** — `create_ingredient`, `applica_scheda_prodotto`,
`prodotti_da_compilare`, `tocca_campo_confermato`.

🔴 **Perché qui sì e sulla prova no — misurato, non dedotto.** Ho chiesto
il piano alle due macchine, e sono **due piani diversi per la stessa
riga**:

- in **produzione** il motore calcolava la definizione di *ogni* funzione
  del catalogo (`Seq Scan on pg_proc`) **prima** di filtrare lo schema —
  e inciampava su `array_agg`, che sta in `pg_catalog` e non è una
  funzione normale;
- sulla **prova** filtrava prima lo schema, quindi guardava solo le
  funzioni nostre.

⚠️ **È una famiglia nuova per questi appunti**: una migrazione che passa
sulla prova e fallisce in produzione **non perché i dati siano diversi,
ma perché il piano è diverso**. Fin qui le differenze misurate erano
sempre di dati (la tabella vuota, la riga che non c'era).

**Cosa ho fatto.** Prima ho **rimesso il nome di prima** alla colonna: la
produzione è tornata allo stato coerente delle 177 migrazioni, zero
funzioni rotte, e le ho **richiamate** per esserne sicuro. Poi ho
rinfrescato le statistiche del catalogo (`analyze pg_proc`,
`analyze pg_namespace` — non toccano nessun dato), il piano è tornato
quello giusto, e la migrazione è passata.

⚠️ **E QUESTO LASCIA UNA MINA, dichiarata.** Ha funzionato perché il
piano è cambiato, non perché la riga sia diventata robusta: **a una
ricostruzione da zero può rifarlo**. La cura vera è una riga in più in
`…006` (filtrare le funzioni prima di chiederne la definizione), ma
quel file è **già pubblicato e già applicato sulla prova**, e correggerlo
è una decisione che non posso prendere da solo.

---

## 🔴 La seconda: `20260823000012` — è dentro, ma non risulta

Il suo lavoro **è in produzione** (il controllo che rifiuta una quantità
troppo piccola c'è, identico a quello della prova). Si è fermata la sua
**verifica**, con *«su un prodotto in chili la soglia non viene fatta
rispettare»*.

⚠️ **E il difetto è nella verifica, non nel gestionale.** Quel passaggio
prende **in prestito un prodotto vero misurato in chili** — e in
produzione i prodotti sono **zero**. L'inserimento non tocca nessuna
riga, nessun rifiuto scatta, e il controllo legge «non è successo niente»
come «la regola non funziona». È la **trappola del caso vuoto** (17/08)
dentro una verifica, e insieme la regola del 16/08: *il perimetro di una
prova dev'essere fatto di roba che la prova ha creato.*

**La cura è una riga**: quella verifica ha già un ingrediente suo in
chili (`v_conv`, rimesso a `kg` due passaggi prima) — basta usare quello
invece di pescarne uno vero. Ma vale la stessa cosa di sopra: **file già
pubblicato**, e correggerlo è una tua decisione.

⚠️ **Finché resta così**, ogni `npm run migra` inciampa lì: va tenuta
indietro con `--salta 20260823000012`, oppure si corregge.

---

## La terza fermata: la rete dei riepiloghi

A metà strada lo strumento si è fermato da solo: *«queste migrazioni sono
già in produzione e nessun riepilogo le nomina»* —
`20260823000008` e `20260823000009`.

⚠️ **C'erano**, ma scritte **«…08» e «…09»**, in forma abbreviata. È
esattamente ciò che la regola del 16/08 vieta: il controllo cerca il
numero **completo**, e per lui una forma abbreviata non esiste. Corretto
il riepilogo, e si è ripreso. **La rete ha fatto il suo lavoro.**

---

## E `20260823000022` (il registro) non è potuta partire

Lo strumento l'ha respinta: *«non è ancora su GitHub»*. Quel commit è
locale, e **il push è tuo** — è la regola che tiene la produzione dal
correre avanti al repository. Le altre due migrazioni nuove (`…020` e
`…021`) erano già state spinte, e infatti sono passate.

**Il registro delle cancellazioni è ancora a 43 tracce.**

---

## Le due funzioni online, installate

⚠️ **Le migrazioni da sole non bastavano.** Il cliente pagante scrive
passando dal corridoio `operazioni-atomiche`, e in produzione girava
ancora la versione di prima: la migrazione sarebbe entrata e il riquadro
«Chi paga» avrebbe risposto **404**. La stessa cosa per
`schede-prodotto`, ferma alla versione 2 mentre le migrazioni di ieri
la portavano alla 3.

Installate tutte e due (corridoio **33 → 34**, schede **2 → 3**), da file
già committati e già su GitHub.

✅ **Controllato leggendo il codice VIVO, non fidandomi del messaggio di
installazione**: scaricata la funzione installata in produzione e
confrontata con quella del repository — **identiche**, e l'operazione
`assegna_cliente_conto` è dentro.

⚠️ **Quello che non ho potuto provare**: chiamare il corridoio di
produzione **da utente vero**. Su quel database non ho un'identità di
collaudo (il PIN di Alessio non si usa, §2), e una chiamata anonima viene
respinta prima ancora di guardare l'elenco delle operazioni. La prova che
il gesto funziona davvero là dentro resta da fare con una sua mano.

---

## Il backup si controlla da sé, e la prova completa no

Sua decisione, con la ragione che vale più della prova: *«un backup che
diventa lento è un backup che smetto di fare, e quello è il rischio
peggiore di tutti»*. Quindi `npm run backup` **controlla da sé la copia
appena fatta** — conta le righe una per una e si ferma dicendo di non
portarla fuori se non tornano — mentre la prova di ripristino completa
resta un comando a parte, ricordato nel promemoria di
`npm run collaudo:stato`.

🔴 **E il collegamento era rotto al primo giro**, trovato perché il
controllo ha gridato: la cartella si chiama «Backup Borgo 58» e passando
da `npm run` il percorso **si spezzava sugli spazi** — il controllo
riceveva «C:\Users\User\Desktop\Backup» e diceva che mancava lo schema.
Un difetto del collegamento, non della copia; ma se il controllo fosse
stato più indulgente sarebbe passato per buono.

---

## Gli utenti: la parte che contava di più

🔴 **Il progetto Supabase temporaneo non l'ho fatto**, e la ragione è la
condizione che aveva posto lui: *verificare prima se costa*. **Non posso
verificarlo** — il token del CLI vive nel portachiavi di Windows, non in
un file, e da lì non riesco a chiedere all'API che piano abbia
l'organizzazione. *«Non lo so» non è «non costa»*, quindi mi sono
fermato.

**Ma la prova si è potuta fare lo stesso, senza spendere.** Il motivo per
cui prima non si poteva è che nel database usa-e-getta `auth.users` era
un moncone scritto da me. Ora `npm run backup` salva anche la **forma
vera** di quelle tabelle (35 colonne e otto indici) e la prova di
ripristino la usa.

✅ **4 utenti su 4, tutti con la password, tutti col ruolo ritrovato** —
compreso quello di Alessio. Zero errori in ogni passaggio.

🔴 **E la prova al contrario ha bocciato il MIO controllo, non la copia.**
Tolto un utente dal file, il ripristino restava **verde**: confrontava
quanti utenti erano rientrati con quanti ce n'erano **nello stesso
file**. *Un confronto di un file con sé stesso non si accorge di niente.*

⚠️ E nessun altro controllo poteva prenderlo: `05_conteggi.txt` conta solo
le tabelle del gestionale, e gli utenti stanno in `auth`. Adesso il
backup **dichiara quanti utenti sta salvando** e il controllo del file lo
confronta — tolto un utente si ferma: *«utenti: nel file 3, dichiarati 4
— senza tutti gli utenti, dopo un ripristino qualcuno non entra più»*.

⚠️ **Quello che resta fuori**: se il servizio di autenticazione di Supabase
accetti quelle righe. Qui si prova che il file le contiene tutte e che
rientrano in tabelle della forma giusta.

---

## Cosa abbiamo rovesciato

**Niente.** Nessuna decisione è stata cambiata.

---

## Cosa NON è verificato

- **Nessuna mano vera ha aperto l'app dopo l'applicazione.** Le funzioni
  rispondono da qui, ma nessuna schermata è stata guardata sui dati veri.
- **La mina di `…006`** resta: se un giorno si ricostruisce il database da
  zero, quella riga può rifermarsi. Ha funzionato per un piano, non per
  una proprietà.
- **`…012` non risulta applicata** pur essendolo nella sostanza: il
  registro delle migrazioni e la realtà non coincidono su quella riga.
- **L'allarme di prova rimasto in produzione** non è stato tolto.

---

## Cosa aspetta una tua decisione

1. **Il push** dei commit locali: senza, il registro delle cancellazioni
   (`…022`) non può entrare.
2. **Correggere `20260823000012`** (una riga nella sua verifica) — oppure
   tenerla indietro per sempre con `--salta`.
3. **Correggere `20260823000006`** (una riga nel suo ciclo) per togliere
   la mina alle ricostruzioni future.
4. **L'allarme di prova** in produzione: toglierlo con una migrazione, o
   lasciarlo con la sua etichetta.
5. **Se e quando provare gli accessi su un progetto Supabase vero**: serve
   sapere se un terzo progetto costa, e quello lo puoi vedere solo tu dal
   pannello.

