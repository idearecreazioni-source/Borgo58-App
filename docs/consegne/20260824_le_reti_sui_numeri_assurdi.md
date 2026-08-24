# Le sei risposte, le reti sui numeri assurdi, la rilettura — 24/08/2026

**Commit dichiarato:** `d7bc76e0a078ea4ffc0b13945b9a5cf52ea1f601`
**Working tree:** pulito
**Migrazioni:** 207 nel repository, 207 sul progetto di prova, **201 in
produzione** (le sei nuove aspettano il push di Alessio).

Segue la consegna [«le correzioni del collaudo»](20260824_le_correzioni_del_collaudo.md).

---

## PRIMA: le cinque migrazioni applicate in produzione

Alessio ha pushato e autorizzato. Applicate col comando, coi numeri veri
prima e dopo:

| | prima | dopo |
|---|---|---|
| migrazioni | 196 | **201** |
| allarmi | 1 | **0** |
| domande all'archivio | 6 | **0** |
| tracce nel registro cancellazioni | 0 | **0** |
| disposizioni della sala | 14 | **14** |
| ricette · causali · impegni | 14 · 17 · 8 | **14 · 17 · 8** |
| aliquote (IRES/IRAP/acconto/rata) | 24,00 / 3,90 / 100 / 40 | **invariate** |

✅ La sanatoria delle aliquote ha toccato **zero righe**, come previsto: in
produzione erano già in punti. Il vincolo
`fiscal_settings_aliquote_in_punti` è ora anche sul gestionale vero.

---

## Le sei risposte

### 1 · LUNCH — non adesso, e c'è una dipendenza

Nessun codice. Le tre risposte sulle linee sono scritte in
[`docs/mandati/20260824_le_tre_linee_della_previsione.md`](../mandati/20260824_le_tre_linee_della_previsione.md),
perché non si perdano fra un riepilogo e l'altro.

⚠️ **Il dato esiste già a metà**: `service_hours` distingue pranzo e cena,
`serata_di_servizio()` sa a quale giornata appartiene un istante. Quel che
manca è che **il conto** porti con sé quale dei due servizi era.

### 2 · EVENTI — misurato: dentro c'erano altre tre cose

Letto **dal foglio vero**, col lettore dell'app e non a memoria. Quattro
righe di linee accessorie, e solo una è di eventi:

| linea | come si conta |
|---|---|
| **Lounge apericena** | a giornata |
| **Chef table** | a giornata |
| **Barattoli trasformati (pz/giorno)** | a giornata |
| Eventi premium (n/mese) | a evento |

🔴 **Tre voci del piano vero non hanno dove stare nelle tre linee**, e non
sono varianti della stessa cosa: lounge e chef table sono servizi **a
coperto** con scontrini diversi dalla sala; **i barattoli non sono un
coperto affatto** — sono prodotto venduto al pezzo, e nessuna delle tre
linee lo descrive. Le tre strade possibili sono nel documento del mandato.

⚠️ E il lettore del foglio riconosce l'evento *dalla parola «eventi» nel
nome della riga*: con tre linee strutturate quella regola non basta più.

### 3 · PAREGGIO — registrato, nessun codice

Pareggio in **euro di ricavo totale**; sotto, come informazione, i coperti
di sala «se lunch ed eventi vanno come previsto». ⚠️ Va scritto che il
secondo numero è **condizionato**, o verrà letto come il pareggio.

### 4 · IL CALAMARO — fatto e visto

Migrazioni `…006` e `…007`. Nessun terzo pulsante in Scadenze: cambia la
schermata dei fermi, che aperta da lì mostra **tutte** le partite in casa
con una ricerca per nome.

**Visto a schermo**: cercando «Calamaro» resta una riga sola, e sotto ci
sono le sei risposte (consumato, buttato, reso, ricordamelo, abbattuto,
trasformato).

⚠️ Senza durata dichiarata la riga **non scrive «dura 0»** — che si
leggerebbe «scaduta subito»: dice che il fermo non si può giudicare.

🔴 **E un difetto trovato prima di collegare, non provando**: la funzione
nuova prometteva nei propri commenti «stessa forma di `partite_ferme()`,
colonna per colonna — se divergesse anche solo una colonna nessun errore
lo direbbe», e poi chiamava `giorni_fermo` quella che di là si chiama
`ferma_da`. La schermata avrebbe mostrato **«ferma da undefined giorni»**.
Corretto con una migrazione **nuova**, non riscrivendo quella vecchia; e
la verifica adesso confronta **tutte** le colonne, non quella — diventerà
rossa il giorno che qualcuno ne aggiunge una a una sola delle due.

### 5 · OMAGGI «ALTRO» — fatti, e con due difetti trovati per strada

Lo scenario ne garantisce ora **uno per mese**. Prima erano scelti a caso
fra quattro causali su dieci estrazioni, e «Altro» non era mai uscito.

🔴 **Il filtro era troppo largo**: la parola «altro» pescava anche **«Altro
incasso»**, che è una causale di *entrata*. Fra i dati di collaudo c'era
infatti **uno sconto con causale «Altro incasso»** — un dato che non può
esistere, e che nessuno avrebbe letto come finto. Tolto.

**I numeri, sui dati veri di luglio 2026:**

| | |
|---|---|
| omaggi «Altro» | 96,20 € |
| omaggi totali a listino | 297,62 € |
| incassato | 39.570,00 € |
| percentuale | **0,24%** |

### 6 · MIGRAZIONI — applicate (sopra)

---

## LE RETI SUI NUMERI ASSURDI

### Il censimento

Chiesto al catalogo: **111 colonne numeriche** delle tabelle di `public`
non hanno nessun vincolo `check` che le nomini.

⚠️ **Ma è un setaccio, non un elenco di difetti.** Più della metà sono
**risultati calcolati** (`scenario_risultati`, `consuntivi_mensili`),
scritti da una funzione e non da una mano: lì un limite respingerebbe una
perdita legittima — un EBITDA negativo è un fatto, non una battitura.

### 🔴 La radice, misurata: «percento» vuol dire due cose

| unità | dove |
|---|---|
| **frazione** (0,25 = 25%) | `scenari_proiezione.food_cost_percento`, `pagamenti_elettronici_percento`, `commissione_pos_percento`, `finanziamento_tasso`, `aliquota_foglio_informativa` |
| **punti** (24 = 24%) | `fiscal_settings.ires_rate`, `plafond_rappresentanza_percento`, `service_settings.soglia_rincaro_percento`, `ingredients.waste_percentage_default` |

Chi scrive un valore nuovo non ha modo di saperlo, e sbagliando **non
riceve un errore: riceve un numero credibile**. È così che le imposte sono
diventate cento volte più basse.

⚠️ **I vincoli tolgono il silenzio, non l'ambiguità del nome**: quella si
toglie rinominando le colonne, ed è un lavoro ancora da fare.

### I limiti CERTI — 23 vincoli che rifiutano

**Denaro e imposte** (`…008`, dodici): le frazioni stanno fra 0 e 1; le
ore di un giorno fra 0 escluso e 24; il netto di una busta paga non supera
il lordo; una fattura non ha importo negativo (*quello che il fornitore
storna è una nota di credito, che ha una tabella sua*); IVA di cessione
0-100; prezzi e importi non negativi; anno dello scenario 2000-2100;
finanziamento fino a 40 anni; pressione fino al 300%.

**Magazzino** (`…010`, undici): 🔴 **lo scarto sta sotto 100**, perché il
lordo si ricava dividendo per (1 − scarto/100) — a 100 è una divisione per
zero, a 150 il fabbisogno diventa **negativo**, e nessuno dei due dà un
errore. Durata e preavviso positivi, preavviso entro l'anno; quantità di
ricetta e di lista positive; **temperature fra −80 e +150 °C** — largo
apposta: ferma la virgola persa (185 invece di 18,5), non giudica se il
frigo va bene, che lo fa già il range dell'attrezzatura.

### I limiti SOSPETTI — si accettano e si mostrano

`numeri_sospetti()` e **`npm run numeri`** (`…011`). Titolare soltanto:
dentro ci sono prezzi d'acquisto, fatture e movimenti di cassa.

⚠️ **Soglie tarate contando quante righe segnalerebbero sui dati veri.**
Dodici soglie, **cinque segnalazioni in tutto**. Se una ne producesse
cinquanta non sarebbe una rete: sarebbe un guardiano che grida sempre.

### 🔴 La prova al contrario ha trovato un difetto nella MIA verifica

Ho allargato apposta il limite del food cost fino a renderlo inutile e ho
riapplicato: **la verifica è rimasta verde**.

Provava con «25», che veniva respinto da **un altro vincolo, del 15/08**
(`scenario_scontrino_sopra_il_costo`): con 40 e 10 di scontrino, un food
cost di 25 rende il margine negativo di 953 €. Il vincolo nuovo non
c'entrava.

⚠️ **È la trappola del caso vuoto in una forma nuova**: non «non c'era
niente da fare», ma **«c'era già qualcun altro che lo faceva»**. Corretta
con la migrazione `…009`, col valore che discrimina: **1,1** — l'unico
intervallo in cui i due vincoli si distinguono (il vecchio lascia passare
fino a 1,175).

### E il verso opposto, che conta quanto il primo

Ogni vincolo è provato **due volte**. Uno scarto del **90%** è la realtà
dei carciofi e deve passare; **−30 °C** è un abbattitore, non un errore.
Stringendo la soglia dello scarto a 50, la verifica diventa rossa da sola.

### I valori assurdi già scritti nei dati di prova

Cinque segnalazioni, e **una è un dato davvero implausibile**:

| dove | cosa | giudizio |
|---|---|---|
| **Prima nota** | «Differenza contando il cassetto il 28/07» — **23.663,50 €** | 🔴 **assurdo**: teorico 24.144,00 €, contato 480,50 €. Il contante dei conti chiusi si accumula da due mesi e **lo scenario non versa mai in banca**, quindi il teorico è la somma di tutto il contante mai versato. Non è un difetto del gestionale: è uno scenario incompleto che produce un numero fuori scala |
| Magazzino | Zafferano in pistilli, 2.400 €/kg | **giusto**: è il prezzo dello zafferano |
| Magazzino | Aceto di vino bianco, 1825 giorni | **giusto**: è l'aceto |
| Ricettario | Caponata di carciofi, riga da 10 pz | plausibile |
| Ricettario | Pasta fresca all'uovo, riga da 7 pz | plausibile |

⚠️ E ne restano due dal giro precedente, non toccati: **cinque ingredienti
`TEST-AUTO`** residui delle prove automatiche (129 in anagrafica invece di
124), e **due allarmi** del 23/08 sul progetto di prova.

### Cosa avevo già messo stanotte sulle aliquote — verificato

✅ **`fiscal_settings_aliquote_in_punti` è una rete vera nel database**: un
vincolo `check`, non un controllo nella schermata, provato al contrario
(tolto il vincolo, la prova diventa rossa) e da oggi anche in produzione.
**Non l'ho rifatta.** La `…008` le si affianca senza sovrapporsi: quella
guarda l'unità delle aliquote, questa gli altri numeri della stessa
tabella.

---

## LA RILETTURA PRIMA DELLA CONSEGNA

Regola nuova, scritta in cima al §8 di `CLAUDE.md`. Fatta voce per voce
contro il mandato. Ha trovato tre cose.

### 🔴 1. Un vincolo che scatta parla in inglese

**Misurato dal browser**, chiamando l'operazione vera con un food cost
di 1,1. Il dato viene fermato — che è il punto — ma la frase che Alessio
vedrebbe è:

> `new row for relation "scenari_proiezione" violates check constraint "scenario_frazioni_sono_frazioni"`

⚠️ **È metà cura**: il numero assurdo non entra, e chi lo scrive non
capisce perché. Le spiegazioni in italiano ci sono — le ho scritte nei
`comment on constraint` di ogni vincolo — ma **nessuno le legge a
runtime**.

**Non corretto**, perché la cura ha almeno due forme e la scelta cambia il
risultato: (a) intercettare il `check_violation` nel corridoio e nelle
scritture dirette, traducendo il nome del vincolo con una funzione
`spiega_vincolo()`; (b) anticipare il controllo nelle schermate, col
rischio di due regole per lo stesso limite. **Materiale per il prossimo
mandato.**

### ⚠️ 2. Il riquadro degli omaggi in Cassa mostra ancora zero

Nel riepilogo precedente avevo scritto di aver reso collaudabile quel
riquadro. **Riletto guardandolo: mostra 0,00 € e 0%.**

Non è falso ciò che ho fatto — gli omaggi «Altro» esistono — ma quel
riquadro guarda **il mese in corso**, e agosto nello scenario ha 3 conti
chiusi e 116 € incassati: è quasi vuoto **per costruzione**, perché lo
scenario copre i due mesi passati.

**Il calcolo si collauda in «Come sta andando» scegliendo luglio**, dove
la causale «Altro» ora compare nel prospetto degli omaggi. In Cassa no.
*Non ho aggiunto omaggi ad agosto: su 116 € incassati, un omaggio da 70 €
darebbe una percentuale del 37%, cioè un altro numero assurdo.*

### ⚠️ 3. Una promessa di una mia migrazione, smentita dalla migrazione stessa

Già raccontata al punto 4: «stessa forma, colonna per colonna» e poi una
colonna diversa. Trovata rileggendo il commento contro il codice.

---

## Cosa NON è verificato con gli occhi

- 🔴 **Le sei migrazioni nuove non sono in produzione**: aspettano il push.
- **Nessun vincolo è stato esercitato da una mano dalle schermate.** Sono
  provati dentro le migrazioni e — uno solo, il food cost — dal browser
  chiamando l'operazione vera. **Non so cosa vede Alessio** quando ne
  scatta uno dal form dei costi fissi, dalla scheda di un ingrediente o
  dal registro temperature.
- **`npm run numeri` non è mai stato lanciato sulla produzione** (solo
  sulla prova): là dovrebbe dire «niente fuori dall'ordinario», ma non
  l'ho guardato.
- **Le misure delle schermate** (testo ≥ 3,20 mm, bersagli ≥ 8,50 mm) non
  sono state prese su nulla di ciò che ho toccato — comprese la ricerca
  nuova nei fermi e il campo delle ore nel form.
- **La stampa** dei tre archivi HACCP non è mai stata aperta in anteprima.

## Cosa ho dato per fatto senza misurarlo

- **Che i vincoli nuovi non rompano nessuna scrittura esistente
  dell'app.** Le 358 prove sul database sono verdi, ed è una prova
  robusta — ma esercitano il gestionale, non tutte le combinazioni di
  valori che una mano può scrivere.
- **Che le 111 colonne senza vincolo siano «più della metà calcolate».**
  Le ho classificate leggendo i nomi delle tabelle, non una per una: è una
  stima, e il numero esatto di quelle ancora scoperte **non l'ho contato**.

## Cosa resta scoperto delle reti, dichiarato

Il mandato chiedeva di guardare tutto il gestionale. Ho fatto **denaro,
imposte e magazzino**, come da priorità. Restano fuori, e sono i gruppi:

- **Agenda e personale**: giorni di ferie, ore dei turni, premi.
- **Sala e prenotazioni**: numero di coperti di una prenotazione, misure
  dei tavoli, posizioni sulla pianta.
- **Comande**: quantità delle righe, coperti del conto, importi di
  sconto e mancia (alcuni hanno già vincoli, non tutti).
- **Preventivi ed eventi**: numero di persone, importi, acconti.
- **Agricolo**: superfici, rese, quantità raccolte (solo `harvested`
  coperto).

---

## Cosa abbiamo rovesciato

**Nessun rovesciamento in questo giro.** Le reti aggiungono vincoli dove
non ce n'erano: nessuna decisione precedente viene contraddetta. La
correzione della `…006` da parte della `…007` non è un rovesciamento — è
la stessa decisione, scritta giusta.
