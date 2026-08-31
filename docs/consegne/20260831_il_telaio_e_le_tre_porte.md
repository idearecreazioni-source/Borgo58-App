# Il telaio, e le tre porte che mancavano

**31/08/2026, mezzogiorno.** Riepilogo per il validatore.

* **HEAD dichiarato**: `35671ba66782b3cf4968a27b48c8461352c799e9` — il commit che sta sotto questo file.
* **Migrazioni**: 365 nel repository e sulla prova, **361 in produzione**.
  Le quattro nuove **aspettano il push di Alessio**: `npm run migra` si è
  rifiutato di applicarle perché non sono ancora su GitHub — *la produzione
  non deve mai correre avanti al repository*.

🔴 **E DUE FRENI HANNO RIFIUTATO DAVVERO, oggi.** Il primo perché questo
riepilogo non nominava le migrazioni per intero; il secondo perché **la
cartella dei backup non era più sul Desktop** — Alessio l'ha portata fuori dal
computer, cioè ha fatto esattamente la sua metà. ⚠️ **E lì c'è una tensione
vera fra due regole del 23/08**: «porta la copia fuori» fa sparire la copia
dal Desktop, e il freno la cerca lì. Ogni volta che lui fa la cosa giusta, il
freno scatta. La via d'uscita è un minuto (`npm run backup`), ma la tensione
va decisa da lui — è la domanda 1.
* **Prove**: 657 pure verdi (58 file), **459 sull'app verdi** (67 file), lint
  pulito.

### Le quattro migrazioni nuove, per intero

* `20260831000006` — chi non è chiamato da nessuno, dentro il database
* `20260831000007` — la giacenza dice in che mondo sta
* `20260831000008` — il segno «va in carta» arriva davvero in creazione
* `20260831000009` — il portiere sulla rete delle orfane

---

## Cosa abbiamo rovesciato

**Niente.** Nessuna decisione di Alessio è stata cambiata: questa consegna
cura difetti e costruisce porte che mancavano. La sola cosa che cambia nome è
il pulsante «Ho messo di tasca mia», che diventa «Anticipo io, poi mi
rimborso» — e non è un rovesciamento, è la stessa cosa chiamata col suo nome
per distinguerla dalla tasca.

---

## Il filo — e la risposta è sì, un modo esiste

Il mandato chiedeva, prima delle tre cure: *esiste un modo per accorgersi da
soli che una cosa costruita nel database non ha nessuna schermata che ci
arrivi?*

**Sì, e l'ho costruito.** È
`tests/app/funzioni-senza-schermata.test.js`, con la funzione
`funzioni_senza_chiamante()` che gli dà la metà che il repository non può
sapere.

Una funzione è **raggiungibile** se almeno una di queste è vera: la chiama
un'altra funzione del database; la usa un trigger; il suo nome compare in
`src/`. Chi non soddisfa nessuna delle tre è **orfano**.

**Misurato la prima volta che l'ho lanciata:**

| | |
|---|---|
| funzioni eseguibili da `authenticated` | **309** |
| di cui senza un chiamante nel database | **206** |
| di cui **orfane** (nessuna schermata) | **26** |
| — legittime (funzioni online, reti, lavori, script) | 17 |
| — **debiti veri** | **9** |

🔴 **E fra i nove c'erano esattamente i miei tre difetti di stanotte** —
`mondi_del_magazzino`, `carta_da_ristampare`, `segna_carta_stampata` — **più
sei preesistenti che nessuno aveva mai contato**: `conti_senza_quadratura`,
`coperti_per_linea`, `numeri_fuori_intervallo`, `scale_che_non_tornano`,
`sprechi_e_resi`, `tipi_vocali_senza_uscita`.

⚠️ **Avrebbe preso `speso_dalla_tasca` stanotte**, prima che lo vedesse
Alessio.

⚠️ **Lo stato di partenza è CONGELATO**, non preteso vuoto — stessa forma dei
vincoli muti del 25/08: 26 righe, ognuna con scritto **da dove passa**, e per
sei di loro la parola `DEBITO`. Un controllo che grida su 26 righe legittime
verrebbe spento al secondo giorno.

⚠️ **E LA RETE HA DUE LIMITI, tutti e due dichiarati.**
1. Guarda se il **nome** compare in `src/`, non se una schermata la chiami
   davvero: un wrapper che nessuno importa la fa risultare raggiungibile. È
   un **pavimento**.
2. 🔴 **Non copre le COLONNE.** E il buco si è visto due ore dopo: `va_in_carta`
   era nata stanotte, la Cantina la leggeva, e **nessuna schermata la
   scriveva**. L'ho trovata a mano, non con la rete.

🔴 **E IL MISURATORE HA MENTITO PRIMA DI ESSERE TARATO**, per la quarta volta
in due sessioni: i nomi letti dal database portavano il `\r` di Windows,
quindi la ricerca non trovava **mai** niente e diceva «zero funzioni
raggiungibili» — falso per 309 su 309. La taratura su tre casi di risposta
nota è ora **dentro la prova**, e la fa fallire se il setaccio si rompe.

---

## Blocco 0 — allineare il gestionale vero

Backup: **127 tabelle, 995 righe**, e **rimesso su davvero** in un database
usa-e-getta — 127/127, 995/995, 4 utenti coi loro ruoli.

🔴 **UN FRENO MI HA FERMATO, E AVEVA RAGIONE**: `npm run migra` si è rifiutato
di toccare la produzione perché **il mio riepilogo di stanotte non nominava
nessuna delle cinque migrazioni**. Diceva «cinque migrazioni nuove aspettano
il push» — e la regola vuole il numero **per intero**, perché una forma
abbreviata lascia mute quelle in mezzo. Corretto il riepilogo, non aggirato il
freno.

Misurato dopo, letto dalla produzione:

| | prima | dopo |
|---|---|---|
| migrazioni | 356 | **361** |
| ultima | `20260830000013` | **`20260831000005`** |
| mondi del magazzino | **2** | **7** — Alimentari · Vini · Bevande · Liquori e distillati · Materiale di consumo · Pulizia e sanificazione · Varie ed eventuali |
| l'annata sui prodotti | no | **sì** |
| il segno «va in carta» | no | **sì** |
| categorie senza mondo | — | **zero** |

---

## Blocco 1 — la tasca

🔴 **MISURATO, e il quadro è diverso dal sospetto.** Il pulsante «Ho messo di
tasca mia» **non scrive nella cassa del locale**: porta a *Cassa → Sezione
personale* e scrive in `anticipazioni_socio` sul soggetto **Borgo 58**.
Nessun movimento di cassa. Il timore specifico del mandato non si verifica.

⚠️ **Ma la conseguenza pratica è comunque grave, e diversa**: chi crede di
registrare la tasca sta registrando **un debito che la società gli deve** —
cioè l'opposto esatto di quello che Alessio ha detto («non c'è niente da
pareggiare»). I due nomi si somigliavano abbastanza da scambiarsi.

**Tre cure:**

1. 🔴 **La cache dei soggetti non scadeva MAI.** `let cache = null` viveva
   quanto la pagina, e su questo gestionale il tablet resta acceso sul
   bancone per giorni. Un soggetto nato dopo l'apertura della pagina — ed è
   *esattamente* quello che è successo alla tasca, entrata in produzione
   all'01:06 — **non sarebbe comparso mai**, senza nessun errore. Adesso
   scade dopo mezz'ora.
2. **La porta**: da Cassa c'è «La mia tasca», che porta alla Prima nota **già
   sul soggetto giusto** (`?soggetto=tasca`). Arrivarci su Borgo 58 e dover
   cambiare a mano è il gesto in cui si sbaglia.
3. **I due nomi si distinguono**: «Anticipo io, poi mi rimborso» contro «La
   mia tasca».

✅ **Provato premendo**: la porta apre sul soggetto giusto, il titolo dice
«Speso dalla tasca», niente Banca e niente Entrata. Registrato **21,40 €** e
ricomparso come *«Speso dalla tasca: 21,40 € — Trasporti 21,40 €»*. Riga tolta
per identificativo, **11412 lapidi prima e dopo**.

---

## Blocco 2 — «Butto il fondo»

✅ **Constatato: compare solo quando c'è una bottiglia aperta. Non è un
difetto** — un gesto su una bottiglia che non esiste non ha senso.

🔴 **Ma sotto c'era un difetto vero e più grave: non si poteva stappare
NIENTE.** La Cantina diceva «nessun prodotto segnato "va in carta"» — una
frase giusta e **senza uscita**, perché non esisteva nessun posto dove
segnarlo. **Quinta volta della stessa famiglia in due giorni, e l'avevo fatta
io stanotte.**

E la metà più insidiosa: messa la casella sulla scheda, **in modifica
funzionava e in creazione no**, perché la creazione passa da
`create_ingredient(...)`, che ha i parametri nominati uno per uno. Sarebbe
stata la quarta ricomparsa della trappola del 16/08 — *un valore che si vede
nella schermata non è un valore che arriva al database* — che è scritta nel
commento di quella stessa funzione.

✅ **Provata la catena intera con le mani**: spuntato «Si vende al cliente» sul
Passito di Pantelleria → letto dal database (`va_in_carta = t`) → la Cantina
lo offre → stappato → **e «È finita» e «Butto il fondo…» compaiono**.

---

## Blocco 3 — i sette mondi

🔴 **Constatato: la schermata non esisteva.** Il Magazzino era un elenco unico
con «Materiali di consumo» come pulsante a parte — la forma vecchia a due
mondi, mentre il database ne aveva sette da ore.

⚠️ **E la causa non era la schermata**: `v_stock_levels` — quello che il
Magazzino elenca — **non sapeva in che mondo sta un prodotto**. La colonna è
stata aggiunta **in fondo** (mai in mezzo, §6).

🔴 **E RISCRIVENDO QUELLA VISTA A MEMORIA AVREI CAMBIATO UN TIPO**: la mia
versione perdeva il `::numeric(12,4)` su `current_quantity`, cioè avrebbe
cambiato **in silenzio** come si arrotondano le giacenze che tutto il
Magazzino legge. Presa dal corpo vivo, e la verifica adesso **controlla il
tipo**.

✅ **Provato premendo**: Bevande → 3 righe, Vini → 0 con la frase giusta
(*«Nessun prodotto in «Vini». Gli altri mondi sono lì sopra»*), Varie → 4,
Tutti → 133. **I conteggi delle porte coincidono con le righe**, e l'indirizzo
cambia (`?mondo=bevande`): è una sezione salvabile, non un filtro volatile.
Misurata a 390 punti: zero sbordi, zero bersagli sotto soglia, zero testi
piccoli.

---

## Blocco 4 — le risposte di Alessio

* **4a** categorie di Vini e Liquori: **non toccate**, aspettano lui.
* **4b** la forma della carta dei vini: **non fatta**, è un giro suo.
* **4c** l'allerta della carta vecchia: **non fatta**, e **dichiarata come
  DEBITO nella rete** — così resta contata invece di sparire.
* **4d** ✅ **fatto e visto**: sulla tasca i tipi documento sono adesso
  *Scontrino · Documento raccoglitore · Non documentato*. Fattura e
  Autofattura tolte, **solo lì**.
  ⚠️ E passando alla tasca con «Fattura» già scelto il valore torna a «non
  documentato»: un valore fuori elenco in un menu mostra la **prima opzione**
  senza errore (trappola del 27/08), e qui la prima sarebbe stata
  «Scontrino» — un documento che nessuno ha detto di avere.

---

## Blocco 5 — la spunta della fattura

🔴 **LA MIA DIAGNOSI DI STANOTTE ERA SBAGLIATA.** Avevo scritto che «il modale
non si apre col click programmatico». **Falso**: il pulsante «Chiudi conto»
era **disabilitato**, perché il conto aveva una riga non ancora inviata.
Misurato leggendo `button.disabled`, non dedotto.

✅ **Aperto e premuto davvero**: la spunta c'è, il bersaglio è **16,76 mm**, e
la frase cambia sotto le dita — da *«Lo scontrino esce come sempre»* a *«Lo
scontrino non esce. Il conto resta "fattura promessa" finché non la emetti da
Cassa»*.

✅ **E il conto è stato chiuso davvero**: nel database
`documento_fiscale = 'fattura_da_emettere'`, senza scontrino.

⚠️ **Il conto di prova è rimasto sul progetto di prova**, e non è una
dimenticanza: cancellarlo è **respinto da un vincolo** — *«Questo conto è già
chiuso: "Caponata" non si può togliere. Il totale su cui hai incassato non
deve cambiare dopo»*. È la stessa guardia che protegge i soldi veri, e non si
aggira per comodità di pulizia.

---

## RILETTURA

### Schermate APERTE E GUARDATE
Magazzino (sette porte, premute una per una) · Prima nota su Borgo 58 e sulla
tasca · Cassa · scheda di un ingrediente (casella spuntata con le mani) ·
Cantina (bottiglia stappata) · Comande (conto aperto, comanda inviata,
**modale di chiusura aperto e spunta premuta**).

### Consegnate senza vederle
**Nessuna, questa volta.** Tutte e sei le cose costruite o curate sono state
premute.

### Cosa ho contato senza leggerlo
* Le misure di schermo vengono dal **DOM**, col misuratore tarato su
  `.tocco-campo = 8,50 mm`. ⚠️ **Nessuna immagine è stata guardata**: lo
  screenshot non funziona in questo ambiente.
* Le prove: letto il totale del comando, 459/459, exit 0.

### 🔴 Mie affermazioni di STANOTTE che si sono rivelate FALSE
1. **«Il modale non si apre col click programmatico»** — era **disabilitato**,
   e bastava inviare la comanda. Una diagnosi sbagliata scritta con sicurezza.
2. **«E3 fatta»** — le due funzioni erano costruite e **senza nessuna
   schermata**. Oggi sono dichiarate come debito, non come fatto.
3. **«I sette mondi fatti»** — la migrazione sì, la schermata **no**.
4. **Il riepilogo non nominava nessuna delle cinque migrazioni**, e l'ha
   trovato un freno, non io.
5. **`va_in_carta` costruita** — e senza nessun posto dove scriverla.
6. **E una di OGGI, scritta due ore fa in questo stesso file**: «le quattro
   nuove entrano subito dopo». Non sono entrate — serve il push. Corretta
   qui, ed è la terza domanda della rilettura obbligatoria che fa il suo
   lavoro.

### Blocchi non aperti
**Blocco 6** per intero: etichetta «investimento», chiusura dell'anno fiscale,
il pacchetto per la commercialista, la coda di `RICHIESTE.md`.

### Conteggi che sono PAVIMENTI
* Le **26 orfane** sono quelle che la rete sa vedere: guarda le funzioni, non
  le colonne né le rotte.
* **Zero bersagli sotto soglia** vale sulle schermate aperte, a 390 punti e a
  una densità sola.

### E in una riga: telaio o tre sintomi?
**Telaio.** La rete esiste, ha nominato da sola i tre difetti più sei che
nessuno aveva contato, e resta accesa a ogni `npm run test:app`. ⚠️ **Ma è un
telaio parziale, e si è visto lo stesso giorno**: non copre le colonne, e
`va_in_carta` l'ho trovata a mano due ore dopo averla costruita.
