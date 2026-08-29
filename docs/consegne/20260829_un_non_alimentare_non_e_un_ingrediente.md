# Un non alimentare non è un ingrediente, e dodici mesi sono «tutto l'anno»

**Blocco 2 del mandato del 29/08 (sera)** · 29/08/2026

| | |
|---|---|
| commit del lavoro | `cb346e6` |
| migrazioni introdotte | `20260829000011_i_dodici_mesi_sono_tutto_l_anno.sql`, `20260829000012_un_non_alimentare_non_e_un_ingrediente.sql`, `20260829000013_la_ricerca_del_nome_chiamava_una_porta_chiusa.sql`, `20260829000014_le_due_funzioni_di_trigger_nascevano_aperte.sql`, `20260829000015_la_verifica_che_ora_ha_bisogno_dei_claims.sql` |
| applicate in produzione | **NO** — il push non è stato fatto (vedi il riepilogo del Blocco 1) |
| applicate sul progetto di prova | sì, tutte e cinque |
| prove | 584 pure, 454 sull'app |

---

## 2b — LA MISURA CHE DECIDEVA IL BLOCCO

Il mandato chiedeva, prima di spostare qualsiasi cosa: *quanti non
alimentari compaiono OGGI dentro una ricetta?*

**ZERO.** Nessuna riga di `recipe_ingredients` nomina un prodotto non
alimentare — misurato con una `join`, non stimato.

Quindi non c'era nessuna decisione da rimandare ad Alessio, e vietarlo non
toglie niente a nessun food cost: *non si vieta un uso, si scrive nel
programma una cosa già vera* — la stessa forma della L capovolta della
sala (19/08).

I non alimentari sono **4 su 133**, e portano addosso esattamente il
vestito che non gli serve:

| nome | stagionalità | temp. consegna | scarto |
|---|---|---|---|
| Carta forno | tutto l'anno | ambiente | 3,00 % |
| Detergente per superfici | tutto l'anno | ambiente | 3,00 % |
| Sacchetti sottovuoto | — | — | 3,00 % |
| Sgrassatore per cucina | — | — | 3,00 % |

🔴 *«Carta forno, disponibile tutto l'anno, da consegnare a temperatura
ambiente, con il 3% di scarto»* è una scheda che descrive un alimento e
parla di un rotolo di carta.

---

## 2a — la sezione separata

Scelta di Alessio fra due, e la sua: **sezione separata**, non un filtro.

* **Magazzino → Materiali di consumo** (`/magazzino/materiali`).
* Gli **Ingredienti** mostrano ora solo alimenti. ✅ Visto: «Carta forno»
  e «Sgrassatore» spariti da lì, «Baccalà» ancora al suo posto.
* La **scheda è la stessa, più corta**, e non una scheda nuova: due schede
  per la stessa merce divergerebbero al primo campo aggiunto. ✅ Visto su
  «Carta forno»: allergeni, stagionalità, temperatura attesa, % scarto e
  note HACCP **spariti**; prezzo, scorta minima, conservazione,
  sorveglianza dei rincari e «È un alimento» **rimasti**.
* **Non è un secondo magazzino**: misurato, `lista_spesa()` e
  `add_below_threshold_items()` **non nominano `alimentare`** — i
  materiali continuano a entrare in lista della spesa da soli quando
  scendono sotto la scorta minima.
* Nel database un non alimentare **non può entrare in una ricetta**, e il
  rifiuto dice cosa fare: *«… sta fra i materiali di consumo e non può
  entrare in una ricetta. Se è un alimento, togli la spunta…»*.

⚠️ **I valori del vestito NON sono stati cancellati**, si è smesso di
mostrarli. Cancellare i dati di Alessio è una decisione che nessuno mi ha
chiesto; e restano inerti, perché in una ricetta non ci possono più
finire. È la domanda n. 3.

🔴 **DIFETTO TROVATO APRENDO UNA SCHEDA**: dalla scheda di «Carta forno» il
ritorno diceva **«← Ingredienti»** e portava in un elenco dove quel
prodotto **non c'è più**. Un vicolo cieco creato dalla correzione stessa.
Ora il ritorno segue il prodotto.

🔴 **E UN DIFETTO CHE STAVO PER INTRODURRE IO, chiuso prima di consegnare**:
`listIngredients()` ora restituisce solo alimenti **di suo**, e la
schermata della **posta in arrivo** la usa per far abbinare le righe di
una fattura. Senza correggerla, una riga di detersivo non avrebbe potuto
essere abbinata allo sgrassatore che c'è già, e avrebbe fatto nascere **un
doppione, senza nessun errore**. Là passa `alimentare: null` — «tutti e
due» — e la ragione è scritta lì.
⚠️ Gli altri cinque chiamanti sono stati guardati uno per uno: ricette,
cessioni agricole, raccolta propria e l'elenco Ingredienti parlano tutti
di cibo, e il predefinito è quello giusto.

---

## 2d — dodici mesi sono «tutto l'anno»

**Misurato prima di scrivere**: 35 prodotti su 133 avevano **tutti e
dodici** i mesi accesi, e **zero** dicevano `tutto_anno` — che pure esiste
nel vocabolario `month_code` dal primo giorno, ed è l'ultimo dei tredici.

🔴 Cioè: **il vocabolario offriva la risposta corta e nessuna strada la
scriveva.**

* La normalizzazione è un **trigger**, non un controllo nella schermata:
  le porte da cui una stagionalità entra sono almeno quattro (la mano di
  Alessio, MEMO da una foto, la lettura di una fattura, domani la voce), e
  un controllo nella schermata ne coprirebbe una.
* Il **verso opposto non può stare nel database** ed è dichiarato: al
  database arriva un elenco, non sa quale mese è stato spento. «Tutto
  l'anno meno agosto = undici mesi» lo calcola
  `src/lib/calcoli/stagionalita.js`.
* **35 righe sanate**, e i due trigger che avrebbero mentito sono stati
  spenti e riaccesi: `trg_tocca_campo_confermato` avrebbe scritto che
  Alessio ha *guardato* la stagionalità di 35 prodotti, e
  `trg_ingredients_updated_at` che li ha *toccati*. Nessuna delle due è
  vera.

⚠️ **Il nome del trigger non è indifferente**: in Postgres i trigger BEFORE
di riga scattano in ordine alfabetico, e `trg_normalizza_…` viene prima di
`trg_tocca_…`. Quindi chi risalva dodici mesi su una riga che già dice
«tutto l'anno» **non risulta averla toccata** — ed è giusto, non l'ha
toccata.

✅ **VISTO A SCHERMO, tutti e tre i versi**, su «Aceto di vino bianco»:

| gesto | esito |
|---|---|
| riga che dice «tutto l'anno» | tutte e tredici le caselle accese |
| tocco su «Ago» | **undici** mesi accesi, «Tutto l'anno» spento |
| di nuovo su «Ago» | tutti e dodici + «Tutto l'anno» |
| tocco su «Tutto l'anno» | tutto spento — vuoto, che vuol dire «nessuno l'ha detto» |

*(Guardato senza salvare: nel database non è cambiato niente.)*

---

## 2c — LA MISURA HA CORRETTO LA DIAGNOSI, e ha trovato di più

Il mandato dice che «Fotografa l'etichetta» è rimasto sulla scheda
dell'ingrediente **da prima della separazione del 27/08**, e chiede di
misurare dove nasce oggi il prodotto comprato e di portarlo lì.

**Misurato: il prodotto comprato non nasce da nessun'altra parte.** Il
pulsante non è rimasto indietro — è stato **ricablato** il 27/08 dalla
`20260827000024`, che gli passa `ingredient_id` apposta perché la
confezione si appenda all'ingrediente giusto. Non c'è nessun posto dove
spostarlo.

⚠️ **E la riga di `docs/DECISIONI.md` che diceva «separazione prodotto /
ingrediente: NON da costruire adesso» era rimasta indietro**: quel lavoro è
stato fatto il 27/08 con tre migrazioni. Corretta — segnata come fatta,
senza cancellarla.

🔴 **MA CERCANDO DOVE SPOSTARLO È SALTATO FUORI IL DIFETTO VERO, ed è della
stessa famiglia.** Da MEMO foto il percorso è:

```
/fotografa  →  «Apri la scheda di un prodotto nuovo»
            →  /ricettario/ingredienti/NUOVO
            →  create_ingredient
```

e `create_ingredient` **non accorpa niente**: misurato, non contiene
`nome_ingrediente_chiave`, non ha nessun `on conflict`, e su `ingredients`
**non esiste nessun indice unico sul nome**. Fotografando l'etichetta di
una seconda marca di un prodotto che c'è già nasceva **un secondo
ingrediente generico** — cioè il difetto che la separazione del 27/08 era
andata a togliere, rientrato dalla porta principale.

⚠️ Non ha ancora morso: doppioni sul progetto di prova, **zero**.

**La cura non è un vincolo** — due prodotti possono legittimamente
chiamarsi quasi uguali, e se accorpare lo decide l'assistente (25/08). È
**dirlo prima di salvare, con la via d'uscita**. ✅ Visto a schermo:

| scritto nel campo nome | esito |
|---|---|
| `Burro` | «Questo nome ce l'ha già **Burro**. Se è la stessa cosa comprata da un'altra marca, aprilo e aggiungi lì la confezione…» |
| `  BURRO  ` | lo stesso — la chiave è quella con cui accorpa l'assistente |
| `Qualcosa che non esiste 12345` | nessun avviso |

---

## 🔴 IL DIFETTO CHE SOLO GUARDARE POTEVA TROVARE

`ingrediente_con_questo_nome` è nata `security invoker`: gira coi permessi
di chi la chiama. Dentro chiama `nome_ingrediente_chiave`, che **dal
13/08 è chiusa a tutti**. Dal browser, col token di un utente vero:

```
42501 — permission denied for function nome_ingrediente_chiave
```

⚠️ **Da `psql` funzionava benissimo**, ed è il punto: `psql` gira come
`postgres`. La verifica dentro la migrazione era **verde**, e sarebbe
rimasta verde per sempre. È la lezione del 16/08 in una forma nuova —
*ogni difetto che vive nei permessi si prova solo dal client* — e a
trovarlo è stato aprire la scheda e scriverci dentro un nome.

**Cura scelta fra le tre del 27/08**: `security definer` **con un portiere
che rifiuta**. Non si riapre `nome_ingrediente_chiave` ad `authenticated`,
che rovescerebbe una decisione del 13/08 senza che nessuno l'abbia
chiesto. E il portiere **rifiuta invece di filtrare**: un filtro nella
`where` risponderebbe «nessun omonimo» a chi non deve vedere, cioè una
rassicurazione falsa proprio dove serve un avvertimento.

⚠️ **La `20260829000012` NON è stata riscritta** (regola di Alessio,
23/08): era già applicata sul progetto di prova. La correzione è una
migrazione nuova, la `…013`.

---

## Le misure di schermo

Misurato a **375 punti** su **tre densità** (37,8 da computer · 59,5 da
tablet 8,3" · 64 da tablet 7,9"), col metro provato **prima** su due casi
di risposta nota: `.testo-sala` deve dare 3,20 mm e `.tocco-bottone` 8,50.
Ha dato **3,20** e **8,4985** — e quel centesimo sotto soglia è la trappola
del metro troppo severo, quindi il confronto ha una tolleranza.

| schermata | testi sotto 3,20 mm | bersagli sotto 8,50 mm | scorrimento laterale |
|---|---|---|---|
| Materiali di consumo | **0** | **0** | **0**, pagina e riquadri |
| scheda di un materiale | 3 (preesistenti) | 2 (preesistenti) | **0** |

🔴 **DUE DIFETTI TROVATI MISURANDO, e corretti**: sulla scheda del
prodotto c'erano due misure in **pixel fissi** (`text-[0.68rem]`) — su un
tablet calibrato valevano **1,70 mm** di testo, e **«va bene così» era un
bersaglio da 2,12 mm**, cioè un pulsante che si preme con un dito. È la
famiglia dei pixel fissi già tolta dal Ricettario il 25/08, rimasta lì
dentro. Corretti anche i due gemelli nella pianta della sala, che è
l'altra schermata di questa consegna.

⚠️ **Quello che RESTA è preesistente e fuori perimetro**, e viene da
componenti condivisi: il «?» delle didascalie (3,00 mm), «Aggiorna prezzo»
(7,50 mm), «Quanto ce n'è davvero? Allinea» (5,00 mm), una riga di prezzo a
3,13 mm.
🔴 **E la famiglia è più larga di così**: cercandola, i pixel fissi sono
**10 occorrenze in 5 file** — Cassa, la pianta della sala, la calibrazione
del tocco, il preconto. Ne ho corrette 3 (quelle sulle due schermate che
consegno) e **7 restano**. È un lavoro suo, non una coda di questo blocco.

---

## Cosa abbiamo rovesciato

**Niente.** Nessuna voce in vigore di `docs/DECISIONI.md` è stata
contraddetta.

Voci **toccate**:
* *Prodotti, ingredienti e prezzi* — «25/08: separare il prodotto
  dall'ingrediente». **Confermata e non toccata**: il difetto chiuso oggi
  è una porta rimasta aperta su quella stessa decisione.
* *Prodotti, ingredienti e prezzi* — «25/08: l'assistente decide da sé se
  un prodotto si accorpa». **È la ragione per cui l'avviso del 2c avvisa e
  non blocca.**
* *Lavori decisi ma NON da costruire adesso* — la riga «separazione
  prodotto / ingrediente» era **scaduta**: corretta, non cancellata.

Voci **aggiunte** in questo stesso blocco: le due decisioni di Alessio su
2a e 2d, in *Prodotti, ingredienti e prezzi*.

---

## Come è stato provato

Ogni migrazione ha il suo **caso positivo prima di tutto** — senza, un
rifiuto più avanti non dimostra che la causa è quella cercata — e un
controllo che si ferma **se una sostituzione non attecchisce**, leggendo
il corpo vivo.

**Tre migrazioni, sei rotture, sei controlli diversi:**

| migrazione | rottura | dove fallisce |
|---|---|---|
| `…011` | il trigger non riduce i dodici mesi | *«Dodici mesi in inserimento non diventano tutto l'anno»* |
| `…011` | il trigger appiattisce sempre | *«Undici mesi non restano undici: {tutto_anno}»* |
| `…012` | il divieto copre solo l'inserimento | *«Una riga di ricetta è stata spostata su un materiale di consumo»* |
| `…012` | la ricerca confronta la stringa nuda | *«Il nome scritto diverso non viene riconosciuto (trovati 0)»* |
| `…013` | — | il portiere è provato **impersonando titolare e staff**: il primo trova, il secondo riceve un **rifiuto**, non un elenco vuoto |

⚠️ Le verifiche si sono estratte e lanciate **da sole**: rilanciare la
migrazione intera avrebbe rimesso a posto la funzione rotta *prima* di
verificarla.

⚠️ **Due migrazioni si sono fermate su colonne che avevo dato per
scontate** — `entities.tipo` (è `entity_type`) e `recipes.entity_id` (non
esiste: le ricette non appartengono a una società). Tutte e due sono
tornate indietro **intere**, misurato dopo: nessun trigger creato, nessuna
riga sanata, nessuna riga in `applied_migrations`.

**TRE guardiani sono diventati rossi da soli**, e ognuno ha trovato una cosa
che nessuna rilettura aveva visto:

1. **La rete delle «letture mute»**, sul `catch` silenzioso dell'avviso del
   nome. Dichiarato con la ragione — e insieme quello del Blocco 1, che
   stava rendendo falsa una nota già scritta accanto al modulo pubblico.
2. 🔴 **La rete dei permessi**: le due funzioni di **trigger** nate
   stanotte erano **eseguibili con la sola chiave pubblica**, e l'elenco
   era salito da 13 a 15. È la trappola scritta in `CLAUDE.md` dal 15/08 —
   *«anche una funzione trigger nasce aperta»* — ripetuta poche ore dopo
   aver letto quel documento. Nessun dato usciva (fuori da un trigger si
   rifiutano di girare), ma **quell'elenco non deve crescere in silenzio**.
   Chiusa dalla `…014`, tornato a **13**.
3. 🔴 **La rete dei portieri nelle migrazioni**, e qui ha trovato più di
   quello che cercava. La verifica della `…012` chiama
   `ingrediente_con_questo_nome()` senza claims: era legittimo quando è
   stata scritta, ed è diventato fragile un'ora dopo, quando la `…013` ha
   messo il portiere a quella funzione — **senza che una riga della `…012`
   sia cambiata**. È la seconda volta che il progetto incontra questa
   forma (la prima è del 24/08).
   🔴 **E cercando si è vista una cosa più grossa**: la `…012` non chiama
   soltanto quella funzione, la **crea** con un `create or replace` e
   **senza portiere**. Rilanciarla da sola dopo la `…013` — cosa che
   `npm run prova:migra <nome>` sa fare — **annullerebbe il portiere in
   silenzio**. Su una ricostruzione da zero il caso non si presenta (la
   `…013` viene dopo), ma il rilancio mirato sì: scritto nella `…015`
   perché fra sei mesi nessuno rifaccia l'indagine, con un controllo che
   se ne accorgerebbe.

---

## Cosa NON è stato fatto, e perché

* **Il pulsante della foto non è stato spostato**: misurato, non c'è
  nessun posto dove spostarlo. Vedi sopra.
* **I valori del vestito non sono stati cancellati** dai 4 materiali:
  domanda n. 3.
* **I 7 pixel fissi rimasti** in Cassa, calibrazione e preconto.

---

## RILETTURA

**Cosa NON ho verificato con gli occhi**
* **Nessuna immagine**: lo screenshot non funziona in questo ambiente.
  Tutto ciò che è «visto» è **testo e numeri letti dal DOM**. Colori e
  leggibilità con la luce della cucina non li ha visti nessuno.
* **Non ho salvato** nessuna scheda dal browser: il tocco sulla
  stagionalità e l'avviso del nome sono stati guardati **senza premere
  Salva**, per non lasciare righe nei dati di Alessio. Quindi il giro
  completo *scrivi → salva → il database normalizza* è provato dentro la
  migrazione, non con le mani.
* **Non ho provato a mettere davvero un detersivo in una ricetta dalla
  schermata**: il rifiuto è provato nel database, non dal browser.
* **La schermata Materiali non è stata aperta da un telefono vero**: le
  misure vengono dal DOM con la finestra a 375 punti.

**Cosa ho contato senza leggerlo**
* «4 su 133», «35 su 133», «zero non alimentari in ricetta», «zero
  doppioni» sono `count(*)` sul progetto di prova.
* «10 occorrenze in 5 file» di pixel fissi è un setaccio sul testo
  (`text-[…]`): **dice dove guardare, non cosa è vero** — le 3 che ho
  corretto le ho aperte, le altre 7 no.
* «584 prove pure» e «454 sull'app» sono i totali stampati dai comandi.

**Quali mie affermazioni sono diventate false mentre lavoravo**
* Avevo scritto, nel commento della `…012`, che
  `ingrediente_con_questo_nome` era pronta. **Diventata falsa aprendo la
  schermata**: rispondeva `42501` a chiunque non fosse `postgres`. La
  frase era vera del database e falsa dell'applicazione.
* Avevo dato per scontato che `listIngredients()` potesse restringersi
  agli alimenti senza conseguenze. **Falsa**: la posta in arrivo ne ha
  bisogno per tutti e due.
* Il commento della `…011` diceva «l'ordine viene dal vocabolario, non
  dall'alfabeto»: è vero, ma **vale solo perché `month_code` è un enum
  ordinato** — su una colonna di testo la stessa riga sarebbe falsa.

**Quali blocchi non ho aperto**
* Dichiarati alla fine della consegna, insieme alle domande.

**Quali conteggi sono pavimenti**
* «4 non alimentari» e «35 coi dodici mesi» sono **fotografie del
  progetto di prova al 29/08**: in produzione gli ingredienti sono
  **zero**, quindi là la sanatoria toccherà zero righe e lo dirà.
* «zero non alimentari in ricetta» è vero **oggi**: da oggi è anche una
  proprietà, perché il database lo impedisce.

**Cosa ho lasciato sul progetto di prova**
* **Righe di prova: zero.** Contato dopo ogni migrazione e dopo ogni
  rottura — `ingredients`, `recipes`, `recipe_ingredients` con nome
  `VERIFICA%`: 0.
* **Trigger rimasti spenti: zero** su `ingredients` e su `reservations`.
* **35 righe di Alessio sono cambiate davvero**, ed è il lavoro: la loro
  stagionalità è passata da dodici mesi a «tutto l'anno». Non è un
  residuo, è la sanatoria — e in produzione non toccherà niente, perché
  là non c'è nessun ingrediente.
* ⚠️ **Una cosa che NON ho misurato prima**: quante righe avessero
  `stagionalita` fra i campi «da confermare» **prima** della sanatoria.
  Dopo sono **51**, e il trigger che le avrebbe tolte era spento — ma il
  «prima» non l'ho fotografato, quindi quel 51 è un numero letto una
  volta sola e non un confronto.
* I due documenti vuoti che Alessio tiene apposta **non sono stati
  toccati**.
