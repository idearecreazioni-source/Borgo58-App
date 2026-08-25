# L'assistente che legge le foto — 25/08/2026, sera

**HEAD dichiarato: `e2bbcaef1251596bbe5d83011f5fa7bebabaf3dc`**
**Working tree: pulito** (restano solo file `_*.local.*` esclusi da
`.gitignore`, di sessioni precedenti).

Commit di questa consegna, in ordine:

| hash | cosa |
|---|---|
| `557ba10` | L'assistente legge le etichette, e ogni allergene dice da dove viene |
| `7203785` | Due domande per Tiziana, e i quesiti diventano fogli da portare |
| `e2bbcae` | Appunti: l'assistente che legge le foto, e i due difetti trovati guardando |

Più questo riepilogo, che è l'ultimo commit e dichiara l'hash sotto di sé.

---

## LA RILETTURA — quello che va detto prima di tutto

### Che cosa NON è stato verificato con gli occhi

- **Nessuna etichetta è stata fotografata da una mano vera.** Le immagini
  del collaudo sono state **costruite** (disegnate su canvas con font
  veri, luce di taglio, rumore, una ruotata di 13° e scurita) e poi
  **lette davvero** dall'API. La catena è vera dall'inizio alla fine —
  browser → funzione online → modello → database — ma la fotografia no.
- **Nessuno ha guardato un colore.** In questo ambiente lo screenshot non
  funziona: tutto ciò che è «visto» è **misurato dal DOM**. Il riquadro
  verde della lettura, il rosso di un rifiuto, la leggibilità con la luce
  della cucina restano non guardati.
- **Nessuno ha usato l'assistente da un telefono vero.** Le misure sono
  fatte a 390 punti di larghezza in un browser da computer, con
  `--pxcm` a 37,8 (la stima da monitor).
- **La fotocamera non è stata aperta.** `capture="environment"` è scritto
  ma non è mai stato provato su un dispositivo con una fotocamera: le
  prove hanno messo il file nel campo da codice.
- **Niente di tutto questo è in produzione.** Le cinque migrazioni sono
  applicate **solo al progetto di prova**, e `leggi-foto` è installata
  **solo lì**.

### Che cosa è stato dato per fatto senza misurarlo

- **Il listino dei prezzi del modello** (`costo_modello_ai`) è una
  conversione da dollari a euro con un cambio prudente, **non una
  misura**: nessuno ha ancora visto una fattura dell'account AI. Ogni
  costo che il gestionale mostra si regge su quei due numeri. La riga di
  listino lo dichiara nel proprio campo `nota`.
- **Il tetto di 4 MB sulla richiesta** è preso come limite plausibile del
  gateway, non misurato al bordo: non ho provato a mandare una foto da
  4,1 MB per vedere dove si rompe davvero. Il ridimensionamento nel
  browser rende il caso difficile da raggiungere.
- **`claude-sonnet-5` invece del modello piccolo** è una scelta di
  merito, non una misura: non ho confrontato le due letture sulla stessa
  etichetta. La ragione è che ciò che si legge sono **allergeni**, e un
  allergene mancato non è un campo compilato male.

### Quali affermazioni di questo lavoro sono diventate false mentre lo facevo

1. **«Il tetto blocca al 100%»** era vera quando ho scritto la funzione e
   **falsa nella prima verifica**: i miei numeri di prova (un milione e
   mezzo di token) davano 9,63 € per una foto sola, e il vincolo
   `costo_euro <= 5` — scritto da me poche righe sopra — li ha respinti.
   Il vincolo ha fatto il suo mestiere: erano i **dati della prova** a
   non essere plausibili.
2. **«La verifica della `…014` sorveglia il riflesso»** era vera nel
   senso che il blocco esisteva, e **falsa nel senso che contava**:
   togliendo `fonte` dal gruppo dei deboli la verifica restava **verde**.
   Provato, non dedotto. Chiuso dalla `…015`.
3. **«`applica_lettura_etichetta` è una funzione come le altre»** —
   scritto implicitamente chiamandola dal browser. Falsa: scrive due
   tabelle, quindi il Contratto vuole il corridoio. L'ha detto una prova.
4. **«La foto si butta alla conferma»** è rimasta vera, ma per una
   ragione diversa da quella che avevo in mente scrivendo il mandato: non
   si butta, **non viene mai salvata**.

### Quali conteggi sono pavimenti e non totali

- **«Sei chiamate all'API vera»** è esatto per le letture del collaudo a
  mano, ma le prove automatiche non chiamano il modello: il numero non
  dice quante volte la catena è stata esercitata.
- **«Un solo bersaglio resta sotto soglia»** vale per le **due schermate
  misurate** (`/fotografa` e la scheda di un prodotto). Non ho rimisurato
  le altre 65 schermate del gestionale.
- **«Quattro difetti trovati dalle reti»** è quello che le reti esistenti
  sanno cercare: un difetto in una famiglia che nessuna rete sorveglia
  non sarebbe comparso.

### Blocchi non aperti

Nessuno: entrambi i blocchi del mandato (il motore e la scheda del
prodotto dall'etichetta) sono chiusi. Le due destinazioni successive —
bolle e fatture — sono **fuori da questo mandato** per costruzione, e il
gestionale lo dice a schermo quando le riconosce.

---

## BLOCCO 0 — l'applicazione e le due verifiche

### 0.1 · L'ultimo lavoro salvato

`bf60004` — *«Riepilogo: il margine contato due volte e le tre verifiche
rifatte»*: la correzione del margine delle linee accessorie nella
Proiezione, più tre verifiche rifatte con dati propri.

### 0.2 · Le sei migrazioni applicate — e NESSUN conto bancario è nato

**Applicate 6 su 6.** In produzione ci sono ora **247 migrazioni**
(erano 241).

🔴 **La domanda che il mandato poneva ha risposta netta: in
`conti_bancari` NON è comparsa nessuna riga.**

La riga della `20260825000009` durante l'applicazione:

```
Sanatoria: 0 conti creati, 0 movimenti di banca assegnati.
```

Misurato **prima** con l'accesso in sola lettura, e **dopo**
dall'accesso indipendente:

| | prima | dopo |
|---|---|---|
| righe in `conti_bancari` | 0 | **0** |
| movimenti in `cash_movements` | 0 | **0** |
| lapidi in `deleted_records` | 0 | **0** |
| trigger lasciati spenti | 0 | **0** |
| conti di prova (`ZZ%`) rimasti | — | **0** |
| migrazioni | 241 | **247** |

⚠️ **La premessa del validatore è stata verificata, non creduta**: prima
di applicare ho contato io stesso i movimenti e i conti bancari, e ho
letto per intero la migrazione per constatare che il ciclo della
sanatoria gira **solo** sulle società che hanno già movimenti di banca
orfani. Con zero movimenti, il ciclo non entra mai.

⚠️ **Il punto da sorvegliare non era la sanatoria ma la VERIFICA**: quel
blocco crea due conti («ZZ verifica conto A» e «B») per provare i quattro
casi, e li cancella per identificativo alla fine. Se si fosse fermato a
metà sarebbero rimasti. Non è successo, ed è misurato sopra.

### 0.3 · Il pareggio congelato — MISURATO, e la prova discrimina

**I due valori salvati sono stati calcolati col margine GIUSTO.** La
correzione appena fatta chiude tutto: non c'è niente da decidere.

**Come è stato misurato, invece che dedotto.** Ho letto dal database la
catena vera che scrive quei due numeri:

```
congela_scenario  →  riepilogo_calcolato  →  scrive bep_solo_sala
                                             e bep_con_accessorie
```

e il corpo vivo di `riepilogo_calcolato` li calcola così:

```sql
ceil(v_fissi / v_mdc_cop)::integer                              -- bep_solo_sala
ceil(greatest(v_fissi - t.margine_accessori, 0) / v_mdc_cop)    -- bep_con_accessorie
```

🔴 **Nessuno dei due passa da `pareggio_previsione`**, che è la funzione
dove viveva il doppio conteggio. Il difetto stava in `v_rapporto`, che
alimenta `pareggio_euro` — un numero **in euro**, mentre questi due sono
**in coperti**. E `margine_accessori` compare **una volta sola**.

**Poi l'ho ricalcolato dai dati salvati**, ricostruendo `costanti_scenario`
in SQL puro (il connettore in sola lettura non ha il permesso di
eseguirla):

| | valore |
|---|---|
| `bep_solo_sala` salvato | **6099** |
| ricalcolato con la formula giusta | **6099** |
| `bep_con_accessorie` salvato | **3167** |
| ricalcolato con la formula giusta | **3167** |
| margine / ricavi | **70,8 %** |
| col doppio conteggio sarebbe | 95,7 % |

⚠️ **E la prova DISCRIMINA** — un ricalcolo che coincide non dimostra
niente finché non si sa cosa avrebbe dato una formula sbagliata:

| ipotesi | risultato |
|---|---|
| formula giusta | **3167** ← è il valore salvato |
| contando due volte gli accessori | 234 |
| ignorando del tutto gli accessori | 6099 |

Le tre risposte sono nettamente diverse: il valore congelato non può
essere finito a 3167 per caso.

⚠️ **Confermato anche dall'applicazione stessa**: la `…011` ha stampato
*«Margine risposto 70.8 — dai dati salvati 70.8 — col doppio conteggio
sarebbe stato 95.7»*, che coincide con la mia misura indipendente.

✅ **E i due valori NON sono cambiati applicando**: 6099 e 3167 prima,
6099 e 3167 dopo, `congelato_il` invariato al 15/08.

### 0.4 · La Previsione di partenza, in parole comuni

Il piano dice che in un anno pieno entrano **5.495 persone**. Fra sala e
linee accessorie i ricavi sono **418.214 €**; dopo il costo di quello che
si serve resta un margine di **296.023 €**, cioè il **70,8 %** di quanto
si incassa. I costi fissi dell'anno sono **216.478 €**, e alla fine
restano **79.545 €** prima delle imposte.

🔴 **Il numero che vale la pena guardare è il pareggio, e dice una cosa
precisa:**

- con la **sola sala** servono **6.099 coperti** per andare in pari — ma
  il piano ne prevede **5.495**. Con la sola osteria, quel piano **non
  arriva al pareggio**;
- con le **linee accessorie** ne bastano **3.167**, e 5.495 è ben sopra.

⚠️ **Detto in un modo solo: le linee accessorie non sono un extra del
piano, sono quello che lo tiene in piedi.** Il gestionale oggi non le
misura da nessun modulo (§ «Chiuso di recente» del 15/08), quindi lo
scostamento su quella metà resta dichiarato non misurato.

---

## COSA ABBIAMO ROVESCIATO

**Un rovesciamento**, il n. 48 dell'elenco.

- **Cosa era stato deciso e quando.** Il 23/08, chiudendo il blocco dei
  campi compilati dalla macchina, `applica_scheda_prodotto` fu scritta
  con dentro una decisione esplicita: *«Gli allergeni restano fuori dalla
  lista dei campi da confermare, e non è una dimenticanza: ce l'hanno già
  una loro (`origine_allergeni`), con tre stati invece di due. Metterli
  anche qui vorrebbe dire due posti che dicono la stessa cosa e possono
  contraddirsi.»*
- **La ragione di allora.** Evitare un doppione: due colonne che
  raccontano lo stesso fatto e possono divergere.
- **Cosa si decide adesso.** Nasce `allergeni_prodotto`, che dice da dove
  viene **ciascun** allergene — cioè un secondo posto che parla degli
  allergeni accanto a `origine_allergeni`.
- **Perché la ragione di allora non vale più.** ⚠️ **Non è caduta: è
  stata onorata.** Le due colonne non dicono la stessa cosa —
  `origine_allergeni` parla dell'**insieme** (e decide se si stampa sul
  menu), `allergeni_prodotto` del **singolo**. Applicando il discriminante
  del 17/08 («direbbero *esattamente* la stessa cosa?») la risposta è no,
  ma solo in parte — quindi non si possono fondere e servirebbe un
  guardiano. **Si è scelta la strada più forte**: `origine_allergeni`
  diventa un **riflesso** scritto da un trigger a partire dalle righe, e
  quindi i due posti non possono più contraddirsi per costruzione. È il
  quarto riflesso del progetto.

⚠️ **Il prezzo, dichiarato**: `origine_allergeni` era scritta anche da
`applica_scheda_prodotto` (valore `stimati`). I due non si pestano i
piedi — quella funzione scrive solo quando il campo è vuoto, e col
trigger non è mai vuoto se ci sono righe — **ma è una convivenza da
tenere presente**, non una separazione netta.

---

## BLOCCO 1 — il motore

### Che cosa fa

Si sceglie o si scatta una foto, l'assistente dice cosa ci vede, il
gestionale ne fa qualcosa. Il pezzo è **uno solo** e non sa niente di
etichette: `<ScattaFoto>` più la funzione online `leggi-foto`. Le due
destinazioni che arriveranno useranno questo.

### (a) Da dove si parte — due strade, due comportamenti

| da dove | genere chiesto | come si comporta |
|---|---|---|
| scheda di un prodotto | `etichetta` | il contesto è noto: non chiede dove mettere |
| Dashboard → *Fotografa* | `qualunque` | il contesto non è noto: lo deve capire l'assistente |

⚠️ **Il genere viaggia come CONTESTO, mai come risposta già data.** Se il
gestionale dicesse «questa è un'etichetta», il modello avrebbe ottime
probabilità di assecondarlo — e il caso (c) non si presenterebbe mai.
**Provato**: foto di un paesaggio con contesto «etichetta» → risposta
`altro`, scheda vuota, e il messaggio dice cosa vede.

### (b) Procede se è sicuro, chiede se non lo è

La certezza la **dichiara il modello** (`sicuro: true|false`). ⚠️ **Non
c'è nessuna soglia numerica inventata da me e non c'è nessun numero in un
commento**: la decisione di Alessio è netta, e il gestionale la esegue.
Quando `sicuro` è falso, la schermata lo dice sopra la scheda.

### (c) La destinazione che non c'è ancora

**Provato con una bolla di trasporto costruita apposta** (mittente,
destinatario, quattro righe di merce, causale, firme). Risposta:

```
esito:        destinazione_mancante
riconosciuto: bolla
scheda:       null
messaggio:    «Ho letto una bolla di consegna, ma non so ancora dove
               metterla: il gestionale non l'ha ancora imparata.
               Per ora si registra a mano.»
```

⚠️ **`scheda: null` non è un dettaglio**: è la garanzia che una bolla non
può finire incastrata nella scheda di un prodotto. Il caso è imposto
nella funzione online, non lasciato al buon senso di chi chiama.

### (d) La foto si butta — anzi, non si salva mai

🔴 **La strada scelta rende la verifica una PROPRIETÀ invece che un
controllo.** La foto:

- non entra nel deposito dei documenti;
- non entra nel database (`letture_foto` conserva **quanto è costata**,
  non l'immagine);
- non entra in nessun registro.

Vive nello stato di `<ScattaFoto>` fra lo scatto e la conferma, viaggia
dentro il corpo della richiesta, e se ne va con la schermata. **Non si
cancella ciò che non è mai stato scritto.**

⚠️ **Prezzo dichiarato**: ricaricando la pagina prima di confermare, la
foto si perde e va rifatta. Fra lo scatto e la conferma passano secondi;
una foto dimenticata in un deposito resterebbe lì per sempre.

⚠️ **L'anteprima resta finché non si conferma**, ed è il punto (d) del
mandato: se un campo non torna, l'etichetta si riguarda invece di rifare
la foto.

### (e) Senza rete si fa a mano, senza drammi

**Provato rompendo `fetch` nel browser vero**, e ⚠️ **verificando che la
rottura abbia morso davvero** (lezione del 25/08: il collegamento al
database può avere una copia sua di `fetch`). La rottura ha intercettato
la chiamata, e a schermo è comparso:

> Non sono riuscito a mandare la foto: può essere la rete. La scheda si
> compila a mano come sempre.

- **nessun riquadro rosso** (misurato: `riquadro_rosso: false`) — in
  cucina la rete cade, e leggere quel caso come un guasto insegnerebbe a
  ignorare il rosso vero;
- **l'anteprima resta**: si riprova senza rifare la foto;
- **il percorso manuale non è nascosto**: il modulo del prodotto è quello
  di sempre, sotto.

🔴 **E qui è saltato fuori un difetto vero, trovato guardando:** dopo una
prima lettura riuscita, scattando una seconda foto che fallisce restavano
a schermo **insieme** l'anteprima della foto **nuova** e il riquadro
verde della lettura **vecchia** — che chi guarda legge come se parlasse
della foto che vede. E quel riquadro dice **da dove vengono gli
allergeni**. Ora la lettura precedente decade appena si sceglie una foto
nuova; i campi già compilati restano (Alessio li ha visti), ma **la
promessa che vengano da un'etichetta letta decade con essa**.

Verificato dopo la correzione: prima lettura riuscita → seconda foto con
la rete rotta → **riquadro verde sparito**, messaggio di rete presente.

### (f) Il tetto di spesa

| | |
|---|---|
| dove vive | `impostazioni_ai`, una riga sola |
| valore di partenza | **vuoto** — e vuoto non è zero |
| al 100 % | **blocca** |
| sopra l'80 % | avvisa |
| sblocco | vale **solo per il mese in cui è dato** |
| zero | **respinto dal database** |

🔴 **Il tetto si guarda PRIMA di chiamare il modello.** Misurato: una
richiesta bloccata torna in **0,9 secondi**, contro i 20 di una lettura
vera. *Un tetto che si accorge di essere superato mentre lo supera non è
un tetto.*

⚠️ **La lettura che NON avviene viene comunque registrata** (`esito:
tetto`, token 0, costo 0). Senza, il registro direbbe che quel giorno
nessuno ha provato a usare l'assistente, mentre qualcuno ci ha provato e
ha trovato la porta chiusa: è l'informazione che serve per capire se il
tetto è tarato bene.

⚠️ **Uno sblocco vale un mese solo**, e c'è una verifica apposta: senza
quel verso, un solo sblocco toglierebbe il tetto **per sempre** e nessuno
se ne accorgerebbe, perché tutto continuerebbe a funzionare.

⚠️ **Nessun numero è stato messo da me**, né nel codice né in un
commento. Finché il tetto è vuoto la spesa si conta, si mostra e **non
blocca** — dichiarato a schermo. Non è un buco: sull'account AI c'è già
il tetto di 10 $/mese messo l'11/08.

### (g) Solo Alessio

`RequireTitolare` sulla rotta, `is_titolare()` in ogni funzione, e le
tabelle titolare-only. **Provato dal client**: la sala che chiede la
spesa riceve un **rifiuto**, non un elenco vuoto.

### Il costo, misurato

| | |
|---|---|
| costo di una lettura vera | **0,024 – 0,028 €** |
| di cui domanda | ~3.500 token (l'immagine) |
| tempo | 5 – 20 secondi |
| foto mandata | 30 – 150 kB dopo il ridimensionamento |

Il costo si calcola **nel database** dal listino (`costo_modello_ai`),
non nella funzione online: il listino vive in un posto solo. ⚠️ **Un
modello fuori listino non costa zero in silenzio**: la riga lo dichiara
nel proprio messaggio, perché uno zero muto in un conto di spesa si legge
«gratis».

---

## BLOCCO 2 — la scheda del prodotto dall'etichetta

### (a) La scheda si vede prima di salvare

La lettura **riempie i campi** e non salva niente. **Guardato a schermo**
(misurando il DOM) su un'etichetta di ricotta costruita apposta:

| campo | valore proposto |
|---|---|
| nome | Ricotta di pecora fresca |
| categoria | `latticini` |
| unità | kg |
| conservazione | `frigo_0_4` |
| durata | 7 giorni |
| temperatura | 0-4 °C |
| allergene | **Latte**, casella accesa |

E sopra il modulo:

> Ho letto l'etichetta e riempito la scheda qui sotto. Controllala e
> salva.
> **Latte** — scritto sull'etichetta
> Ingredienti letti: SIERO di LATTE di pecora, sale, correttore di
> acidità: acido citrico.

⚠️ **La lettura non sovrascrive ciò che una persona ha già scritto**:
riempie i buchi e lascia stare il resto. Provato al contrario in
`tests/unita/foto.test.js`.

### (b) Gli allergeni si compilano da soli

Nessuna schermata di conferma di massa: era già stata proposta e
rifiutata. Gli allergeni proposti accendono le caselle, e Alessio le
corregge come ha sempre fatto.

### (c) L'origine di ogni allergene — le QUATTRO risposte

| origine | cosa vede la sala |
|---|---|
| `etichetta` | «Scritto sull'etichetta del prodotto.» |
| `fonte` | «Ricavato da: *nome della fonte*. Non è scritto sull'etichetta.» |
| `dedotto` | «Dedotto dal tipo di prodotto: nessuno l'ha letto sull'etichetta. Se il cliente chiede, mostragli gli ingredienti invece di garantire.» |
| `alessio` | «Verificato da Alessio.» |

🔴 **La quarta non era nel mandato, e senza di lei il resto non regge**:
un allergene scritto da una persona sarebbe indistinguibile da uno
dedotto da una macchina — che è la confusione che questa costruzione
esiste per togliere. Ed è il punto (d) dello stesso mandato applicato
agli allergeni.

⚠️ **Una fonte va NOMINATA, e lo pretende il database** (`la_fonte_si_nomina`):
«ricavato da una fonte» senza dire quale non è più attendibile di una
deduzione, ma a schermo verrebbe letto come se lo fosse. ⚠️ Se il modello
manda `fonte` senza il nome, l'allergene **scende a `dedotto`** invece di
essere scartato: toglierlo sarebbe la cosa pericolosa.

⚠️ **Un allergene messo a mano non sparisce dalla sala**: chi non ha una
riga di origine si legge `alessio`. *Se sparisse, il gestionale direbbe
che un piatto non contiene una cosa che contiene* — il modo peggiore in
cui questa funzione potrebbe sbagliare. C'è una prova apposta, ed è una
delle due che si accorgono della rottura.

⚠️ **Un'origine non sopravvive al suo allergene**: un trigger toglie le
righe rimaste senza. *Un'origine orfana afferma qualcosa su un allergene
che il prodotto non ha.*

⚠️ **Nessun portale ufficiale ingrediente→allergeni esiste**, ed è
scritto nella migrazione perché qualcuno lo cercherà: l'Allegato II del
Reg. UE 1169/2011 elenca i quattordici allergeni **da dichiarare**, non
chi li contiene. È il motivo per cui la fonte si nomina.

⚠️ **Le tracce da contaminazione restano fuori**, come deciso: hanno già
`allergeni_tracce`, e le istruzioni al modello vietano di dichiararle in
questo elenco. **Provato**: l'etichetta della semola diceva «può contenere
tracce di soia» e la soia **non** è finita fra gli allergeni.

### Il riflesso, e perché il più debole comanda

`origine_allergeni` è ora calcolata dalle righe:

- almeno un `dedotto` **o** `fonte` → **`stimati`** (non si stampa)
- altrimenti almeno un `etichetta` → `etichetta`
- altrimenti → `confermati`

⚠️ **Anche `fonte` tiene l'elenco fuori dalla stampa**: una fonte
consultata è meglio di una deduzione, ma non è l'etichetta di quel
barattolo, che è la sola cosa che ne risponde. **È la scelta che il
quesito T8 mette in mano a Tiziana**: oggi è prudenza nostra, non una
regola che qualcuno ci ha dato.

### (d) Ogni campo ricorda chi l'ha messo

Nuova colonna `ingredients.campi_dall_assistente`. ⚠️ **Non è
`campi_da_confermare`**, che risponde a un'altra domanda («la macchina
l'ha compilato e nessuno l'ha ancora guardato»): qui Alessio **li ha
guardati**, perché la scheda si vede prima di salvare. Quello che manca è
*chi ha scritto questo valore*.

🔴 **Il confronto lo può fare solo il modulo**: il database vede arrivare
un valore e non ha modo di sapere se è quello proposto o quello che
Alessio ci ha scritto sopra.

⚠️ **E poi si difende da sola**: se qualcuno cambia quel campo, la
marcatura cade — **con lo stesso trigger** che già fa cadere «da
confermare», **esteso invece che affiancato**. Provato nei due versi:
cambiare la durata fa cadere la sua marcatura e lascia le altre;
riscrivere lo **stesso** valore non fa cadere niente (senza quel verso,
un salvataggio qualunque svuoterebbe tutto e la colonna sarebbe inutile).

⚠️ Nella stessa passata il trigger ha preso il `search_path` fissato che
**non aveva** (regola del 10/08), e ha imparato a guardare anche nome,
categoria e unità — che una lettura d'etichetta può proporre.

### (e) La destinazione la propone l'assistente

Dalla Dashboard, riconosciuta un'etichetta, compare *«Apri la scheda di
un prodotto nuovo»*. ⚠️ **La scheda viaggia nella navigazione, non in un
deposito** — stesso motivo della foto.

---

## LE RETI CHE SI SONO ACCORTE DA SOLE

🔴 **Quattro difetti, e non li ha trovati una rilettura.** Sono diventate
rosse quattro prove del progetto appena le migrazioni sono entrate.

| rete | cosa ha trovato | cura |
|---|---|---|
| `scritture-dal-corridoio` | `applica_lettura_etichetta` scrive **due tabelle** ed era chiamata **dritta dal browser** — regola B4 | passa dal corridoio (v25) |
| `vincoli-che-parlano` | `impostazioni_ai_una_riga` era **muto**: risponderebbe in inglese | frase italiana |
| `cambio-unita` | `letture_foto.costo_euro` non classificata nel censimento delle unità | dichiarata «non si converte» |
| `permessi` | due funzioni scavalcano la RLS **senza portiere** | una **chiusa**, una **dichiarata** |

⚠️ **Il primo è il più serio**: a metà resterebbe un prodotto con gli
allergeni cambiati e **nessuna origine registrata** — che in sala si
legge come un elenco messo da Alessio, cioè come una garanzia.

⚠️ **Sul quarto la scelta è stata di merito, non di comodo**:
`origine_dell_insieme` è stata **chiusa** (la chiama solo un trigger, che
gira come proprietario); `allergeni_con_origine` **resta aperta alla
sala** perché è la funzione che risponde al cameriere col cliente
davanti, ed è dichiarata nell'elenco congelato con la ragione. Chiuderla
al solo titolare vorrebbe dire costruirla per chi non è al tavolo nel
momento in cui serve.

---

## COME SI ROMPONO LE PROVE — la controprova, fatta

**Quattro rotture volute, e una ha scoperto qualcosa.**

| rottura | esito |
|---|---|
| `misureRidotte` ingrandisce le foto piccole | **rossa** la prova giusta |
| `campiProposti` sovrascrive quello che c'è già | **rossa** la prova giusta |
| la sala perde gli allergeni messi a mano (`left join` → `join`) | **rosse** due prove, col messaggio giusto |
| il riflesso ignora `fonte` | 🔴 **VERDE** — buco nella verifica |

🔴 **L'ultima è la più utile.** La `…014` decide che una fonte consultata
tiene l'elenco fuori dalla stampa del menu. Togliendo `fonte` dal gruppo
dei deboli, **la sua verifica restava verde**: provava tre origini
insieme — etichetta, fonte **e** dedotto — e con un dedotto dentro il
risultato è `stimati` comunque. **Il caso che discrimina è uno solo:
etichetta + fonte, senza nessun dedotto.**

Cioè: la regola che decide se un elenco di allergeni finisce stampato su
un menu **non era sorvegliata da niente**. Chiuso dalla `…015`, che
aggiunge quel caso **con roba propria** — e che **diventa rossa** con la
rottura (provato) e verde senza.

⚠️ **Non ho riscritto la `…014`** (regola del 23/08): il file racconta
cosa è successo quel giorno.

---

## LE MISURE — 390 punti, la larghezza vera di un telefono

⚠️ Ogni riga è misurata a **390 punti di larghezza**, `--pxcm` 37,8.

### `/fotografa`

| | |
|---|---|
| sbordo | **0 punti** |
| testi | 25, **nessuno** sotto 3,20 mm |
| bersagli | 4, **tutti** ≥ 8,50 mm |
| «Fotografa» | 8,50 → **12,00 mm** (corretto: era esattamente al minimo) |
| campo del tetto | 8,76 mm |

### Scheda di un prodotto

| | |
|---|---|
| sbordo | **0 punti** |
| «Fotografa l'etichetta» | **12,00 mm** |
| «Crea ingrediente» | **10,29 mm** |
| caselle allergeni | 7,70 → **8,50 mm** |
| caselle mesi | 7,70 → **8,50 mm** |
| bersagli ancora sotto soglia | **1** |

⚠️ **Le caselle degli allergeni e dei mesi erano PREESISTENTI a 7,70 mm**
e le ho portate a norma perché sono esattamente quelle su cui Alessio
correggerà le proposte dell'assistente. 🔴 **Resta «+ Nuovo fornitore» a
5,00 mm**, preesistente e fuori perimetro: dichiarato, non corretto.

⚠️ **Due falsi allarmi, riconosciuti guardando invece che contando**
(lezione del 25/08): le tre caselle di spunta misurano 3,44 mm nel
*quadratino* ma **8,50 nell'etichetta toccabile** che le contiene; e il
«?» a 3,00 mm è il **testo dentro** il pallino della Didascalia, il cui
bersaglio è 8,50 × 8,50.

---

## LE PROVE

| | |
|---|---|
| pure | **453** (18 nuove) |
| sui dati veri | **402** (16 nuove) |
| di cui dal corridoio | 1 — il giro che nessuna prova SQL vede |

⚠️ **Le prove sui dati veri entrano dal collegamento dell'app**, col
token di un utente vero: è l'unico modo di esercitare il tratto fra
schermata e database, dove vivono i difetti che una verifica dentro una
migrazione non può vedere (gira come proprietaria e scavalca la RLS).

⚠️ **I numeri della prova sul costo sono quelli di una foto vera**
(1.500 token di domanda, 400 di risposta → 0,00963 €), e le tre risposte
sbagliate possibili danno **tre risultati diversi**: 0,00413 con la sola
domanda, 0,00550 con la sola risposta, 0,00523 coi token sommati a un
prezzo solo. *Un conto che sbaglia non può azzeccare per caso.*

---

## LE MIGRAZIONI

Cinque, **applicate solo al progetto di prova** (che ne ha ora 252).

| versione | cosa |
|---|---|
| `20260825000013` | il motore: listino, registro delle letture, tetto di spesa |
| `20260825000014` | ogni allergene dice da dove viene, e il riflesso |
| `20260825000015` | il caso che la verifica non prendeva |
| `20260825000016` | ogni campo ricorda chi l'ha messo |
| `20260825000017` | quello che le reti hanno trovato |

⚠️ **Nessuna è in produzione**: `npm run migra` si rifiuta finché non
sono su GitHub. **In produzione ci sono 247 migrazioni**, quelle del
blocco 0.

⚠️ **`leggi-foto` è installata solo sul progetto di prova** (versione 3),
e il corridoio `operazioni-atomiche` lì è alla **v25**. In produzione
vanno installate tutt'e due dopo il push.

### Dati di scena, puliti

| | |
|---|---|
| letture del collaudo cancellate | **10** |
| letture rimaste | **0** |
| ingredienti `ZZ%` rimasti | **0** |
| origini allergeni rimaste | **0** |
| lapidi prima / dopo | **2245 / 2245** |
| tetto sulla prova | rimesso **vuoto**, com'era |

⚠️ **La cancellazione delle letture è stata fatta per proprietà, non per
«la più recente»**: la tabella è nata in questa sessione, quindi **tutte**
le sue righe erano del collaudo — e l'ho constatato leggendo la data
della più vecchia prima di cancellare. `letture_foto` **non è tracciata**
da `deleted_records`, verificato dal catalogo: nessuna lapide.

---

## COSA RESTA FUORI, DICHIARATO

- **Le bolle e le fatture**: riconosciute, non registrabili. È il
  contenuto dei due mandati successivi.
- **La voce**: non toccata, e niente le sbarra la strada — `leggi-foto`
  riceve un corpo JSON, e una Scorciatoia iOS che manda dell'audio
  troverà la stessa forma.
- **Il quesito T8**, che questo lavoro non può decidere da solo: un
  allergene **dedotto** può stare sul menu? Oggi il gestionale dice di no
  **per prudenza nostra**.
- **`durata_giorni` quando l'etichetta non porta una data**: resta vuota
  invece di essere inventata. Con una scadenza stampata la calcola
  (misurato: 187 giorni da «02/2027»).
- **Il ridimensionamento su una foto vera da telefono**: le prove usano
  immagini costruite. Il calcolo delle misure è provato al contrario, il
  ridimensionamento vero no.
