# Consegna del 15/08/2026 (seconda) — dove stiamo andando

**Commit della consegna: `715626e`** (questo riepilogo è il commit
immediatamente sopra, sola documentazione). Working tree pulito.

| Commit | Cosa |
|---|---|
| `c15b2d9` | il Contratto constata la Proiezione: sei tabelle, quindi B4 |
| `715626e` | dove stiamo andando: il piano sovrapposto ai numeri veri, e la porta che mancava |

**Applicata in produzione**: `20260815000001`. **102 migrazioni**.
`operazioni-atomiche` reinstallata (**v21 → v22**).

È la **coda della rotta economica**, aperta da Alessio poche ore dopo la
consegna del Blocco 3, guardando il risultato e dicendo che non era
quello che si aspettava.

---

## 1. Cosa ha detto, e su cosa aveva ragione

> *«non ho capito perché la previsione è intoccabile e soprattutto perché
> parte da un Excel. io mi ero immaginato qualcosa di diverso… dei campi
> da riempire… ora invece sono vincolato a un file esterno che produce
> una previsione fissa che non posso modificare e che non mi restituisce
> le informazioni che vorrei»*

Tre cose distinte, e vanno separate perché hanno risposte diverse.

**🔴 Dove aveva ragione, e l'errore era mio.** Non esisteva **nessuna
schermata per scrivere una previsione**. I numeri vivevano già nel
gestionale divisi in campi — scontrino, food cost, i ruoli, le voci di
costo fisso una per una, i dodici mesi — ma l'unica porta d'ingresso era
il foglio Excel. In pratica non si poteva né costruirne una né
correggerla. Non era una scelta: era un pezzo che mancava, e la consegna
di stanotte non lo dichiarava fra i limiti perché non me n'ero accorto.

**Dove avevo spiegato male.** Una previsione **non nasce bloccata**: si
blocca quando lo decide lui. E il foglio non è un vincolo esterno — è una
porta d'ingresso, che serviva a non far ricopiare a mano sessanta numeri
già scritti. Ora la schermata lo dice: *«Oppure parti dal tuo foglio
Excel — una scorciatoia, non un obbligo»*.

**Dove serviva altro lavoro, ed era anche nel mandato.** Il §4 del Blocco
3 chiedeva *«proiezione a fine anno mantenendo la rotta attuale»*, e la
consegna di stanotte aveva costruito solo il confronto mese per mese. Il
pezzo mancava, e la sua domanda l'ha fatto emergere.

---

## 2. La regola della proiezione l'ha corretta lui

Prima stesura, mia: «finora sei al 120% del piano, quindi proietto anche
i mesi che restano al 120%». Gliel'ho descritta prima di scriverla, ed è
stato lui a fermarmi:

> *«se a febbraio siamo a +20% vorrei che la stima aggiornata mi
> mostrasse un resoconto di fine anno che considera il 20% in più dei
> SOLI DUE MESI TRASCORSI, non che questo 20% venga calcolato come stima
> su tutto l'anno. Partiamo da una proiezione ideale teorica in modo da
> avere una direzione da mantenere nella realtà.»*

**Quello che è successo davvero + quello che resta da fare come era
previsto.** Il piano non è una scommessa da riscrivere ogni mese: è la
rotta da tenere, e la stima dice dove si arriva se da domani la si tiene.

⚠️ La sua regola è **più prudente della mia** e toglie di mezzo un
problema che la mia aveva: nel suo piano agosto vale quattro volte
gennaio, e un ritmo misurato d'inverno proiettato sull'estate avrebbe
prodotto un numero sbagliato con l'aria di essere giusto — il modo di
fallire che questo progetto continua a incontrare.

---

## 3. Cosa mostra il cruscotto

Per ogni voce: **previsto a oggi · reale a oggi · scarto · piano
dell'anno · stima a dicembre**. Le voci sono coperti, ricavi di sala,
scontrino medio, food cost in euro, **food cost in percentuale sui
ricavi**, costi fissi. Sotto, il risultato di fine anno e le imposte,
piano contro stima.

⚠️ **Il food cost compare due volte, e la seconda è quella che serve.**
L'ha chiesta per nome: *«se ho fatto delle previsioni basandomi su un
food cost al 30% e poi invece è al 40% c'è un grave problema da
attenzionare»*. Su un totale non si vede — 12.000 invece di 9.000 si
legge «abbiamo venduto di più».

⚠️ **Il verso del segnale è un dato, non un colore**: su ricavi e coperti
«sotto» è peggio, su food cost e fissi è il contrario. Senza
distinguerli, un colore direbbe l'opposto di quello che serve. **Nessuna
soglia inventata da me**: si mostrano i numeri. Un avviso automatico
resterà una decisione sua, con una soglia sua.

⚠️ **Le imposte proiettate escono dal motore unico**, come tutte le altre
del gestionale, e si portano dietro la stessa avvertenza: un numero e il
suo limite non si separano.

---

## 4. Due difetti trovati dalle verifiche, non da me

**Il primo è di modello, e la verifica della migrazione l'ha fermato.**
Avevo scritto che una voce conta come «misurata» solo se **tutti** i mesi
trascorsi ce l'hanno. Ragionevole a prima vista, e sbagliato per
costruzione: **Borgo 58 apre a marzo 2027**, quindi gennaio e febbraio
non avranno conti perché il locale non esisteva, e con quella regola
l'anno intero avrebbe detto «non misurato» per sempre. Ora ogni voce si
accumula **solo nei mesi in cui è misurata**, e il piano si somma **sugli
stessi mesi**. ⚠️ Il rapporto del food cost usa i ricavi degli stessi
mesi: un food cost di marzo diviso i ricavi di tutto l'anno non è una
percentuale, è un numero.

**Il secondo l'ha trovato una prova automatica che non riusciva a
ripulirsi dietro** — ma il difetto non era della prova. Una previsione
chiusa non si poteva cancellare, quindi **nemmeno Alessio avrebbe potuto
togliere una previsione chiusa per sbaglio** (il file sbagliato, l'anno
sbagliato): gli sarebbe rimasta nell'elenco per sempre, confondibile con
quella buona.

**Regola nuova, che cambia una regola consegnata poche ore prima:**
- **ritoccare** una previsione chiusa resta impossibile, in ogni sua parte;
- **togliere un pezzo lasciando il resto** resta impossibile;
- **buttarla via intera** si può, e resta scritto.

⚠️ Non è un indebolimento travestito: cancellare una previsione non la
rende ricalcolabile e non permette di correggerne una parte. O c'è tutta
com'era, o non c'è.

⚠️ **Coda dichiarata**: `20260814000014` contiene la verifica della
regola vecchia. Una ricostruzione da zero applica le migrazioni in ordine
e funziona; **rieseguire quella migrazione da sola dopo questa
fallirebbe**. Non si corregge un file già applicato (Contratto §8).

---

## 5. Il registro delle cancellazioni non si può ripulire, e questo ha
conseguenze

`deleted_records` ha la **sola lettura** per tutti: un registro
cancellabile non è un registro. Conseguenza: ciò che ci finisce dentro ci
resta per sempre, quindi **non ci deve finire rumore**.

- Si registra solo la cancellazione di una previsione **chiusa** — una
  bozza è lavoro in corso, e buttarla via è come cancellare una minuta.
  Il trigger ha la condizione dentro di sé, e si **ricrea sempre** invece
  di essere saltato se già presente: la condizione è parte del trigger,
  non del suo nome, e un `if not exists` avrebbe lasciato in piedi la
  versione senza condizione, in silenzio.
- **Non** si registrano i dodici mesi congelati uno per uno: sarebbero
  dodici righe di dettaglio a ogni cancellazione, e i numeri che contano
  stanno già nella riga della previsione.
- ⚠️ **Per lo stesso motivo il sigillo non si prova nelle prove
  automatiche**: per provarlo servirebbe congelare, e ogni giro
  lascerebbe una riga in quel registro. Il sigillo è provato dentro le
  migrazioni, che girano come proprietarie del database e si ripuliscono
  per intero. Le prove automatiche coprono creazione, correzione, RLS e
  la cancellazione di una bozza — che non lascia niente.

---

## 6. Verifica

| Cosa | Stato |
|---|---|
| la migrazione sul progetto di prova | **applicata tre volte**: idempotente |
| costruire una previsione a mano e correggerla | **provato**, righe figlie rifatte e non duplicate |
| **la stima = quello che è successo + il piano che resta** | **provato coi numeri a mano** |
| …e un conto solo non fa salire la stima sopra il piano | **provato** (era il difetto della mia regola) |
| solo i mesi con dati entrano nel confronto | **provato**: 1 mese misurato su 8 trascorsi |
| food cost anche in percentuale, col rapporto sugli stessi mesi | **provato** |
| il verso del segnale (sotto è peggio / sopra è peggio) | **provato** |
| senza misure la stima **dichiara** di essere il piano ripetuto | **provato** |
| i conti di un'altra attività non entrano nella proiezione | **provato** |
| previsione chiusa: ritocco e cancellazione di un pezzo | **respinti** |
| previsione chiusa: si butta via intera, e resta scritto | **provato** |
| previsione **aperta**: se ne va senza lasciare traccia nel registro | **provato** |
| lo staff respinto su andamento e correzione | **provato** |
| prove automatiche | **61 verdi** + **14 pure** |
| il database di prova dopo le prove | **zero previsioni, zero lapidi** |
| lint, build | puliti |
| **produzione** | **102 migrazioni**, corridoio **v22** |
| elenco anonimi · `security definer` senza portiere | **12** · **13**, invariati |
| trigger del congelamento | **7 accesi, 0 spenti** |
| registro delle cancellazioni: solo se chiusa | **verificato sul trigger in produzione** |
| residui delle verifiche in produzione | **zero** |
| avvisi partiti durante l'applicazione | **zero** |

---

## 7. ✅ E intanto Alessio l'ha fatto davvero

Il limite più grosso dichiarato stanotte era: *«nessuno ha ancora
caricato il foglio dalla schermata vera»*.

**L'ha fatto stamattina alle 10:33**, in produzione, dal browser: una
previsione di partenza per il 2027, dodici mesi, quindici voci di costo
fisso, ancora aperta. Il gestionale ha conservato il **nome** del file e
la dicitura di versione del foglio, mai il foglio.

⚠️ **E i totali tornano anche là.** Verificato dal connettore in sola
lettura **rifacendo il conto in modo indipendente dagli ingressi** — non
richiamando la funzione sotto esame: **quindici totali su quindici,
differenza zero**, EBITDA di sala ed EBITDA complessivo compresi. I due
pareggi erano già stati verificati sul progetto di prova con lo stesso
file.

⚠️ Nota di sicurezza, e va letta come una conferma: il connettore in sola
lettura **non ha potuto eseguire il calcolo della proiezione** —
`permission denied`. È il motivo per cui il conto è stato rifatto a mano:
quella funzione non è concessa a nessuno, ed è ciò che rende «congelato»
qualcosa di più di «non lo tocca la schermata».

---

## 8. Cosa NON è verificato, e lo dico chiaro

- ⚠️ **La schermata nuova — costruire una previsione a mano — non l'ha
  ancora usata nessuno.** È il pezzo consegnato oggi, e il collaudo vero
  è quello: aprire *Le previsioni → + Nuova previsione*, riempirla, e
  vedere se i campi sono quelli che si aspettava. Se ne mancano, si
  aggiungono.
- ⚠️ **Il cruscotto oggi dirà «non misurato» quasi su tutto, e non è un
  guasto**: zero conti chiusi, Ricettario vuoto, nessuna causale marcata
  come costo fisso. **Il numero che gli interessa di più — food cost 30
  contro 40 — non può esistere finché non ci sono ricette.** È anche
  l'indicazione di cosa riempire per primo.
- **Nessun mese è mai stato chiuso**, quindi la parte «quello che è
  successo» non è mai stata vista con dati veri.
- **La previsione in produzione è aperta e non congelata**: il sigillo,
  in produzione, non è ancora stato messo alla prova da una mano vera.
- **L'IRAP resta il rilievo aperto del referto del 13/08.**
- **I dati di collaudo del magazzino restano in produzione** (deroga del
  13/08) e `/prova-voce` è ancora lì.
