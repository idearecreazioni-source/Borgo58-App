# Il collaudo — guida per Alessio

Si prova con l'app davanti, non con un elenco di casi deciso prima. Qui
c'è solo l'occorrente: cosa è già apparecchiato, come si accende, e come
mi mandi quello che trovi.

---

## 1. Come si accende

Doppio click non basta: serve la finestra nera.

```bash
npm run dev:prova
```

Poi apri **http://localhost:5173**. In cima a ogni schermata deve esserci
la **striscia rossa «DATABASE DI PROVA»**. Se vedi quella grigia «DATI
VERI», chiudi tutto: sei sul locale vero e non devi scriverci niente.

Dal telefono: stesso indirizzo ma con i numeri, quello che comincia per
`192.168…` e compare nella finestra nera.

Quando hai finito, chiudi la finestra nera. Per tornare al gestionale vero,
`npm run dev` come sempre.

**Se rompi qualcosa, non è un problema**: si rimette tutto com'era con

```bash
npm run prova:scenario
```

Non c'è niente da salvare e niente da recuperare. È il posto giusto per
fare disastri.

---

## 2. Cosa c'è già dentro

Tutto quello che vedi marcato **`BASE-`** l'ho messo io, ed è finto.

- **2 fornitori** con recapiti e canale d'ordine — gli stessi nomi che
  trovi sui documenti finti del punto 4.
- **8 ingredienti** con giacenza, prezzo e scorta minima. Due sono già
  sotto soglia, quindi la **lista della spesa** ha delle righe dentro.
- **8 piatti in carta**, quattro categorie, su un menu attivo.
- **6 prenotazioni per stasera**: tre prima delle 20 e tre dopo, così sulla
  pianta vedi i due colori. **Tre hanno il tavolo, tre no** — quelle le
  assegni tu.
- **3 conti già chiusi e pagati**, perché una schermata vuota non si
  collauda.
- **2 fatture**: una pagata il mese scorso, una in scadenza.
- Un ricevimento merci non conforme, un movimento di prima nota, un
  tablet, i parametri fiscali.

⚠️ **Non ci sono conti aperti, comande in corso o righe già pronte da
stornare.** Quelli li fai tu: la sala apparecchiata è mia, la serata è tua.

---

## 3. Le due giornate da recitare

Non sono un elenco di casi da spuntare. Sono due percorsi lunghi: falli
per intero, e le storture verranno fuori da sole.

### Giornata A — una sera di servizio

Comincia dal **Calendario → la pianta**: guarda chi arriva, assegna i tre
tavoli che mancano. Poi apri le **Comande** e fai una serata: apri i
tavoli, prendi le ordinazioni, manda in cucina, stampa qualche ticket.

Poi complica, come si complica davvero:

- un tavolo che **riordina a metà servizio**, quando il primo giro è già
  in cucina;
- una riga da **stornare** dopo che è partita;
- un tavolo che **si sposta** o si accosta a un altro;
- il conto **diviso alla romana**, con l'arrotondamento;
- un **omaggio** o uno sconto, con la causale;
- un conto **pagato metà contanti e metà carta**;
- un piatto **fuori menu** (voce libera).

Alla fine guarda **Cassa** e **Magazzino**: i soldi tornano? La giacenza è
scesa di quello che hai venduto?

### Giornata B — dal fornitore al pagamento

- Guarda la **lista della spesa**: le righe che ci sono ti convincono?
- Genera un **ordine** e aprilo in WhatsApp (non mandarlo davvero).
- Mandati le mail del punto 4 e guarda cosa propone l'assistente.
- **Registra il carico** da una fattura, riga per riga.
- Segna la fattura **pagata** e controlla che l'uscita compaia in prima
  nota.
- Prova a **cancellare** una fattura già pagata: deve rifiutarsi e dirti
  cosa fare prima.
- Fai una domanda al **«Chiedi all'archivio»** sul contratto: per esempio
  «quanto costa un intervento straordinario sui frigoriferi?».

---

## 4. I documenti finti e le mail

I file li generi con:

```bash
npm run collaudo:documenti
```

Finiscono in `docs/collaudo/documenti/`. Sono sei PDF, tutti con il nome
che comincia per **`FINTA-`**, con **controparti inventate** (mai Mililli o
Augeri) e con scritto in fondo che sono documenti di prova. Se fra un anno
ne salta fuori uno, lo dice da sé in tre modi diversi.

| File | A cosa serve |
|---|---|
| `FINTA-Fattura-OrtoProva-114.pdf` | fattura pulita: il giro normale |
| `FINTA-Fattura-IttiCollaudo-58.pdf` | **la fattura difficile**: una riga che non si capisce («MISTO GG/2 SEL. CAT.A») e una con l'unità ambigua (12 casse o 12 chili?) |
| `FINTA-DDT-OrtoProva-341.pdf` | bolla senza prezzi, con lotti e scadenze |
| `FINTA-Contratto-manutenzione-frigoriferi.pdf` | contratto con canone, durata e rinnovo: è per «Chiedi all'archivio» |
| `FINTA-Bustapaga-marzo-2027.pdf` | busta paga con lordo, netto e costo azienda |
| `FINTA-Pubblicita-forniture.pdf` | **non è un documento**: serve a vedere che non finisca in archivio |

**A quale indirizzo mandarle: `info@borgo58.it`**, dalla tua posta
normale. Una mail per documento, con un oggetto verosimile («Fattura
114/2026», «DDT 341», «Contratto manutenzione»), e il PDF allegato.

⚠️ **E qui c'è una cosa che devi decidere tu, prima di mandarle.** La
posta entra nel gestionale **vero**, non in quello di prova: il servizio
che consegna le mail punta al locale, e spostarlo vorrebbe dire toccare la
catena che oggi funziona. Quindi:

- tutto il resto del collaudo gira sul database di prova, senza rischi;
- **la parte della posta gira sul database vero**, e quei sei documenti
  finiscono nell'archivio vero insieme a quelli veri.

Non è una cosa nuova: nel gestionale ci sono già sei fatture di collaudo
dal 13 agosto, tenute apposta. Ma vanno tolte tutte insieme **prima della
prima fattura vera di un fornitore vero**, come avevamo deciso. Se
preferisci non aggiungerne altre, la parte della posta si salta e si prova
solo il carico da fattura a mano — dimmelo e ti dico cosa cambia.

---

## 5. Come mi mandi quello che trovi

**Non fermarti a ogni intoppo per scrivermi.** Vai avanti e annota:
correggere a interruzioni mi fa fare dieci giri sullo stesso file, a
blocchi ne faccio uno solo e più pulito.

Mandami **un blocco alla fine di ogni giornata** (o quando ti fermi), con
una riga per problema, così:

```
SALA · il conto alla romana non torna
Tavolo 3, conto da 47,50 in 4 persone. Ho messo 11 a testa,
il resto l'ha registrato come sconto ma nel riepilogo non lo trovo.

MAGAZZINO · la giacenza non è scesa
Chiuso il tavolo 5 con 2 busiate. I pomodori sono rimasti 18 kg.

CASSA · piccolezza
Il totale del mese è scritto in grigio chiaro, si legge male sul tablet.
```

Tre cose per ogni riga, e nient'altro: **dove** (il modulo), **cosa hai
fatto**, **cosa ti aspettavi**. Non serve che tu capisca perché: quello è
il mio lavoro.

Se una cosa è solo brutta e non sbagliata, scrivi «piccolezza» — così
separo subito i difetti dalle rifiniture e non ti chiedo di ridirmelo.

Se qualcosa **ti blocca** e non puoi andare avanti, quella sì: scrivimela
subito da sola.

---

## 6. Il primo esercizio, prima delle due giornate

Nessuno ha ancora guardato quello che ho messo dentro **schermata per
schermata**. So che le righe ci sono, non che ogni schermata le mostri
bene — ed è la prima cosa da scoprire.

Prima di cominciare a recitare, fai un giro dei moduli e guarda **soltanto
se i numeri hanno senso**, senza toccare niente:

- Ricettario: le 8 ricette, i costi, il food cost dei piatti
- Editor Menu: la carta, il food cost medio
- Magazzino: giacenze, scadenze, lista della spesa
- Calendario: la pianta di stasera, i due colori, le prenotazioni
- Cassa: saldo, prima nota, i conti chiusi
- Fatture: i due totali per società
- Proiezione fiscale: cosa mostra senza previsione caricata
- HACCP: il ricevimento non conforme e la non conformità aperta

**Quello che ti sembra strano qui è il difetto più prezioso di tutto il
collaudo**, perché è quello che vedrai ogni giorno per anni.
---

## 🔴 Una cosa da annotare per ogni difetto trovato — decisa il 20/08

Quando trovi qualcosa che non va, oltre a dirmi **cos'è** serve una riga in
più: **una prova automatica l'avrebbe preso?**

Bastano tre parole — «sì», «no», «forse». Non devi saperlo con certezza: se
hai dubbi scrivi «forse» e ci guardo io.

⚠️ **A cosa serve, perché non è burocrazia.** Oggi in questo progetto
**nessuna prova automatica guarda una schermata**: le prove esercitano il
database e i calcoli, non quello che si vede. Aggiungere quella capacità è
una decisione presa e **rimandata apposta al 20/08** — non per il costo, ma
perché oggi sceglieremmo *a indovinare* quali schermate provare, su schermate
che stanno ancora cambiando sotto le mani.

🔴 **Quell'elenco di «sì / no» È la risposta.** A fine collaudo dirà, per
misura e non per intuizione, quali difetti vivevano solo a schermo — e quindi
quali schermate meritano una prova. *Un elenco ricavato dai difetti veri batte
un elenco deciso prima da chi non li ha ancora visti.*

⚠️ **E il prezzo dell'attesa è dichiarato**: fino ad allora **un difetto che
vive solo a schermo può passare**. È successo davvero — il modulo che restava
aperto, il tocco che contraddiceva il colore, la sala disegnata vuota: li ha
trovati tutti e tre una mano o una fotografia, non una prova.
---

## Le prime voci misurate — 20/08, notte

I primi due difetti trovati dalle mani di Alessio, con la risposta già
scritta. ⚠️ **Sono le prime due righe dell'elenco della decisione 2**: a fine
collaudo questo elenco dirà, per misura, quali schermate meritano una prova.

| # | difetto | una prova automatica l'avrebbe preso? |
|---|---|---|
| 1 | **La sezione Preventivi non aveva nessuna porta**: la rotta c'era, la schermata funzionava, e gli unici collegamenti stavano dentro la pagina stessa | 🔴 **NO** — le prove non guardano le schermate, e questa era irraggiungibile a schermo |
| 2 | **«Nuovo preventivo» non creava niente**: `entita[0]?.id` su un oggetto che non è un array → `entity_id` nullo al database | 🔴 **NO** — nessuna prova esercita quel pulsante; la funzione del database era giusta e rifiutava correttamente |
| 3 | **«Food cost obiettivo 25.0#%»**: un cancelletto in mezzo al numero. In PostgreSQL `#` non è un simbolo di formato e i caratteri non riconosciuti escono letteralmente | 🔴 **NO** — nessuna prova legge il testo di quella frase; il calcolo dietro era giusto |
| 4 | **La capienza si conta una volta sola**: il conto si fa dentro l'accettazione e non si rifà mai più. Cambiando le persone o il giorno, la spunta «sala piena» resta com'era | 🔴 **NO** — nessuna prova esercita una modifica *dopo* l'accettazione; le prove del blocco 4 provano il conto **al momento in cui si fa**, ed è giusto |

⚠️ **Il quarto è il più serio dei quattro**, ed è anche quello che dice di più
sul limite di stanotte: le prove del blocco 4 misurano che la regola è giusta,
e **non** che venga applicata tutte le volte che servirebbe. *Una prova che
esercita un gesto non sta provando cosa succede dopo quel gesto.*
Misura per intero in [`referti/20260821_la_capienza_si_conta_una_volta_sola.md`](../referti/20260821_la_capienza_si_conta_una_volta_sola.md).

⚠️ **E cercando se il gesto si fosse ripetuto ne sono usciti due in più**, uno
dei quali **vivo su ogni riga**: `FM990.99` su un numero intero dà «25.», e
tutte e sei le regole di deducibilità dicevano «100.% deducibile». *Il difetto
segnalato era il più visibile, non l'unico.*

✅ **E il punto 1 del collaudo è chiuso e verde**, verificato in produzione in
tutte e due le metà: il preventivo accettato ha generato **una sola** cena
(26/08, 20:30, 10 persone, confermata), e dopo la correzione a 20 coperti c'è
**ancora una sola** cena, aggiornata a 20. **Nessun doppione** — è la prima
verifica dal vivo del blocco 4, e conferma la parte che le prove automatiche
provavano solo sui dati finti.

⚠️ **Il secondo è il più istruttivo**, e va letto insieme al blocco A della
stessa sera: lì sono stati curati i `.catch` che ingoiavano un guasto. **Qui a
ingoiare è stato un `?.`** — l'optional chaining su un dato che *deve*
esserci. È la stessa famiglia con un'altra faccia: *«non l'ho trovato»
trasformato in un vuoto che nessuno annuncia.*

✅ **E una cosa ha funzionato come doveva**: il guasto **ha fatto rumore
appena successo** — errore chiaro a schermo e avviso su Telegram, col freno di
uno all'ora. È il comportamento che questo progetto insegue da giorni:
*meglio un errore che si vede di un dato sbagliato che passa.*

---

## 🔴 Dove guardare — le sei domande che hanno trovato di più

*Aggiunto il 22/08, dopo cinque giorni di difetti veri.* Non è un elenco di
casi da spuntare — quello lo hai già escluso, e aveva ragione: un elenco
scritto da chi i difetti non li ha ancora visti trova solo quelli che aveva
in mente. **Queste sono le domande che hanno prodotto i reperti migliori**,
ognuna con accanto il difetto che ha tirato fuori.

### 1. «Questa schermata mi sta dicendo un dato, o che non lo sa?»

La più produttiva di tutte. Una sala disegnata **vuota** e una sala che **non
si è riusciti a leggere** si vedono uguali — ma la prima dice «non ha
prenotato nessuno» e la seconda non dice niente.

> Ha trovato: la pianta disegnata vuota quando una lettura falliva · «Nessun
> tavolo configurato» in Comande · e al contrario, il **tavolo aperto nel
> database che la schermata non mostrava**.

Quando una schermata è vuota, chiediti sempre: *vuota, o rotta?*

### 2. «Questo numero l'ho contato io, o l'ho chiesto al gestionale?»

Ogni volta che un numero è stato scritto a mano da qualche parte, prima o poi
è diventato falso — e nessuno se n'è accorto, perché **nessun controllo
guarda una frase**.

> Ha trovato: le prenotazioni «6» che erano 16 · i conti «5» che erano 8 ·
> le causali «4» che sono 5 · «le sei fatture di collaudo» che erano
> documenti, e le fatture erano zero.

### 3. «Se questa lettura fallisse a metà, me ne accorgerei?»

È la famiglia che ci ha morso più volte: **una risposta più corta che ha
l'aria di essere intera**.

> Ha trovato: le liste tagliate a mille righe senza nessun errore · il
> registro delle cancellazioni controllato su 1000 righe di 1930 · il foglio
> del menu del giorno stampato **completamente bianco**.

### 4. «Cosa fanno DAVVERO questi due pulsanti?»

Prima di dire «questi due sono troppo vicini», aprili. Su **quindici** coppie
segnalate in tre giorni, **nove erano falsi allarmi**: «Annulla» che chiude
un modulo, un impegno che si chiama «Pagare fattura», due riquadri di
navigazione.

> Ha trovato (i veri): «È arrivato» accanto ad «Annulla l'ordine» · due
> «Rimuovi» delle mance a mezzo millimetro · e la freccia «↓» che stava a
> 4,59 mm dal «Rimuovi» **della fase sopra** — sbagliando il tocco non
> cancellavi quella che stavi spostando.

### 5. «Questa frase è ancora vera?»

Le frasi non hanno controlli. Erano tutte giuste il giorno in cui sono state
scritte, e nessuno le ha più rilette quando il gestionale è cambiato sotto.

> Ha trovato: «Cerco i posti liberi…» quando il conteggio dei posti non
> esiste più · «Prima nota **manuale**» quando gli incassi entrano da soli ·
> un commento nel codice che diceva l'opposto di quello che il codice faceva.

⚠️ **La peggiore è quella falsa a metà**: la parte ancora vera la fa sembrare
giusta tutta.

### 6. «Come lo faccio fallire?» — invece di rileggerlo

Rileggere il proprio lavoro appena fatto non ha mai trovato niente. **Romperlo
di proposito sì**, tutte le volte.

> Ha trovato: prove che passavano senza misurare niente · una verifica che
> si sarebbe rotta al primo tavolo rinominato · e due volte **il difetto era
> nello strumento di misura**, non nel gestionale.

---

## ⚠️ E due cose sul come guardare, imparate a spese nostre

- **Le fotografie mentono.** Una era ritagliata dallo strumento, una era
  vecchia per la cache del browser. Se una schermata ti sembra sbagliata,
  **ricarica forzando l'aggiornamento** prima di segnalarla — e se puoi
  dimmi l'ora dello scatto.
- **Misura sul tablet, non sul computer.** Le stesse identiche righe di
  codice danno numeri diversi sui due schermi: sul tablet i punti sono meno
  e tutto ciò che è in centimetri veri diventa più grande. Un difetto di
  ingombro che dal computer non si vede, sul tablet sborda.
