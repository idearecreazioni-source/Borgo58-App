# L'etichetta «investimento» e il costo del progetto — 21/09/2026

| | |
|---|---|
| **Mandato** | C11 — l'etichetta «investimento» e il costo del progetto |
| **Ramo** | `claude/etichetta-investimento-c11`, aperto da `slave` a `f956ae8` |
| **Migrazioni** | `20260921000003` — **NON applicata da nessuna parte** (né prova né produzione) |
| **Prove** | 30 pure nuove · 21 di schermata nuove · 1653 pure e 322 di schermata tutte verdi |
| **Stato** | proposta aperta verso `slave`, **non unita** |

---

## 1 · Il difetto che chiude

Il gestionale non aveva **nessun numero** che rispondesse a *«quanto è costato
mettere in piedi il locale»*. Misurato prima di scrivere:

* `cash_movements` ha **26 colonne** e nessuna etichetta — un forno da 6.000 €
  e una bolletta della luce sono indistinguibili;
* il totale più vicino, `rettifiche_fiscali → costi_totali` (in *Fiscale →
  Deducibilità*), è **per anno civile**, **per una società sola**, ed **esclude
  la tasca**.

Il lavoro era stato cominciato il 31/08 e riportato indietro su richiesta di
Alessio. Verificato prima di ricominciare, e **non ripreso alla cieca**: nel
repository e in produzione non c'era nessun residuo — zero occorrenze di
`e_investimento`, nessuna funzione `investimenti*`, nessun file
`20260831000012`. Si è ripartiti dalla decisione, non da un mezzo lavoro.

---

## 2 · Stato iniziale misurato

Produzione, col connettore in sola lettura, il 21/09/2026:

| | |
|---|---|
| `cash_movements` | 26 colonne, nessuna `e_investimento` |
| movimenti | **3**, tutte uscite, nessuna con causale di sistema |
| soggetti | 3 — `srls` · `azienda_agricola` · `tasca` |
| causali di sistema | **9** |
| migrazioni | repository 403 · produzione 394 |
| cartella di lavoro | pulita, `slave` allineato a `origin/slave` |

⚠️ Il commit `fae93f2` e il ramo `codex/telefono-ordinato-notte` **non sono
stati toccati**.

---

## 3 · Stima e tempo effettivo

| | |
|---|---|
| **Stima dichiarata prima di cominciare** | 3–4 ore |
| **Tempo effettivo** | ~2 ore e mezza |
| **Differenza** | ~1 ora in meno del minimo stimato |

⚠️ **Perché è andata più svelta di quanto avevo detto**, e conta più del
numero: la parte che temevo — trovare la caratteristica strutturale che
distingue un rimborso da una spesa — **era già scritta nel progetto**.
`rettifiche_fiscali()` filtra `cash_causali.di_sistema` dal 15/08, e leggerne
il corpo vivo ha risolto in dieci minuti quello per cui avevo messo in conto
un'ora di indagine. *Una stima paga il non sapere, e qui il progetto sapeva
già.*

---

## 4 · Cosa cambia, prima e dopo

| | prima | dopo |
|---|---|---|
| «quanto è costato aprire» | nessun numero | tre numeri: Borgo 58, la tasca, il totale |
| una spesa d'investimento | indistinguibile da una bolletta | porta un'etichetta, e si riconosce nell'elenco |
| un rimborso al titolare | — | **non si può** marcare: il database rifiuta e dice perché |
| un'entrata | — | **non si può** marcare, nemmeno dopo, nemmeno da un'altra porta |
| la tasca | fuori da ogni totale | entra nel costo del progetto, resta fuori dal fiscale |

---

## 5 · Come si marca

**Un movimento nuovo** — *Cassa → Prima nota*: sulle **uscite** compare la
casella «Investimento per il progetto», con la spiegazione dietro il segno
`?`. Sulle **entrate** non compare: non è spenta, non c'è — *un pulsante
premibile per essere respinto è un vicolo cieco*. Senza toccare niente il
movimento nasce **non marcato**.

**Un movimento già scritto** — sempre dalla Prima nota, nella riga: la stessa
casella. Si marca e si smarca quante volte si vuole, **senza cancellare e
rifare la riga** (rifarla le darebbe un identificativo nuovo e lascerebbe una
lapide nel registro delle cancellazioni per una cosa mai cancellata), e
**senza riscriverne nessun altro dato**: la scrittura manda un campo solo.

⚠️ **Le protezioni sono quelle di sempre**, non una scorciatoia: la RLS
(`cash_movements` è titolare-only per ogni operazione), i due divieti della
migrazione, e il trigger che registra quando la riga è cambiata. È una
scrittura su **una tabella sola senza conseguenze altrove** — categoria A del
Contratto — quindi non passa dal corridoio, che esiste per le scritture «tutto
o niente» su più tabelle e qui non aggiungerebbe nessuna garanzia.

**Sulle righe che non la possono portare** il gesto non c'è, e al suo posto
c'è la **ragione**: l'assenza muta di un comando si legge come un guasto.

---

## 6 · I tre totali — formula e soggetti

*Cassa → **Quanto è costato il progetto*** (`/cassa/costo-progetto`).

```
Totale progetto  =  Borgo 58  +  La tasca di Alessio
```

Dentro ciascuno: la **somma delle uscite marcate** di quel soggetto nel
periodo. Il periodo parte **vuoto**, cioè tutta la storia.

* **Chi entra**: i soggetti di tipo `srls` e `tasca`.
* **Chi non entra**: `azienda_agricola` (l'Orto) e qualunque soggetto futuro.

⚠️ **Si decide sul tipo stabile, mai sul nome visualizzato.** «Borgo 58» e
«Orto Borgo 58» sono testo che Alessio può riscrivere da una schermata, e il
giorno che lo facesse un confronto sul nome smetterebbe di funzionare **senza
nessun errore**.

🔴 **L'orto non sparisce.** Se ha uscite marcate, compare con la sua riga
**dichiarata fuori dal totale**, col suo importo. *Un'uscita marcata che
svanisce in silenzio è un'etichetta che non fa niente* — e in questo progetto
il silenzio è il difetto.

⚠️ **Il totale è la somma visibile delle due parti**, calcolato *da* quelle
due voci: non può raccontare una cosa diversa da quello che c'è scritto sopra.

---

## 7 · Rimborsi, pareggi e anticipazioni

🔴 **La caratteristica è strutturale e il progetto già la usava**:
`cash_causali.di_sistema`. È la stessa colonna con cui `rettifiche_fiscali()`
e `costi_da_classificare()` escludono dai costi ciò che non è un costo, dal
15/08. Le nove causali di sistema sono *Versamento in banca*, *Versamento
dalla cassa*, *Differenza di cassa in più*, *in meno*, *Rimborso al titolare*,
*Caparra ricevuta*, *Caparra restituita*, *Prestito ricevuto*, *Restituzione
di prestito*: denaro che cambia posto, o un debito che si chiude.

**Un'uscita con una causale di sistema non si può marcare.** Si **rifiuta**,
non si ignora: la strada alternativa — lasciar marcare e poi non contarlo —
darebbe un'etichetta che si accende e non fa niente.

⚠️ **Mai una frase, mai una descrizione.** C'è una prova apposta: un'uscita
vera la cui descrizione *parla* di rimborsi, versamenti e anticipazioni resta
marcabile, perché il testo non decide niente.

⚠️ **Il pagamento di una fattura resta marcabile**, ed è voluto: misurato
leggendo il corpo vivo di `pay_supplier_invoice`, quel movimento nasce **senza
causale**. In prima nota quell'uscita è l'unico posto in cui quella spesa
compare, e contarla una volta è giusto.

🔴 **Conseguenza dichiarata, e non è una dimenticanza**: un investimento
pagato *per conto della società* e poi rimborsato **non entra in questo
totale**. La spesa vive in `anticipazioni_socio`, che non è `cash_movements`, e
in prima nota compare solo il rimborso — con la causale di sistema, quindi non
marcabile. È la stessa scelta già scritta in SPEC-0004 («sommare le
anticipazioni rimborsabili raddoppierebbe il costo»), e la via che resta è
quella normale: registrare la spesa su Borgo 58 o sulla tasca.

---

## 8 · Il tetto delle mille righe

🔴 **I totali non si possono tagliare, per costruzione**: li **aggrega** il
database, che consegna al massimo una riga per soggetto. Una somma fatta
sull'elenco sarebbe invece un numero credibile e falso appena i movimenti
marcati passano il migliaio.

⚠️ **Il dettaglio sì**, e allora si fa due cose: si legge **a pagine** finché
non finisce, e si confronta il numero di righe arrivate col **conteggio che
l'aggregato dichiara**. Se è più corto, la schermata lo dice — *«i totali qui
sopra sono completi, il dettaglio no: sto mostrando 1000 righe delle 1200»* —
invece di mostrare un elenco che compone numeri più grandi di lui.

⚠️ **E il segnale delle letture tagliate non copre questo caso**: vive nel
punto unico da cui passano le letture di **elenco** (`GET` verso PostgREST) e
legge `Content-Range`. Queste due sono **chiamate a funzione** (`POST`), e di
lì non passano. Il confronto va fatto a mano, ed è fatto.

⚠️ **Il tetto delle pagine è dichiarato** (20 pagine, 20.000 righe) invece di
essere infinito: un ciclo che non si ferma mai girerebbe per sempre. Se un
giorno si toccasse, a dirlo è la riga qui sopra.

---

## 9 · Niente di fiscale

* L'etichetta **non cambia** deducibilità, IVA, causale né nessuna proprietà
  fiscale.
* **Nessun conteggio esistente è stato riscritto**: `rettifiche_fiscali()`,
  `costi_da_classificare()`, `calcola_imposte()` e la Proiezione non nominano
  la colonna e rispondono come prima.
* **Non crea nessun debito** verso Alessio e nessun rimborso.
* La tasca **entra in questo totale, che è gestionale**, e resta fuori dal
  fiscale per costruzione (non ha parametri fiscali, e tre trigger del 30/08
  impediscono di darglieli).

⚠️ **E non è affidato a un promemoria**: una prova di forma pretende che la
colonna compaia in **una migrazione sola** e in **nessun modulo fiscale**.
*Una cosa tenuta fuori da un promemoria rientra alla prima schermata che
nessuno si ricorda di filtrare.*

---

## 10 · Prove — e le rotture che le hanno messe alla prova

**30 pure** (`tests/unita/investimento.test.js`) · **21 di schermata**
(`tests/schermate/investimento.test.jsx`) · **14 controlli dentro la verifica
della migrazione**.

I quattordici punti chiesti dal mandato, e dove sono provati:

| # | regola | dove |
|---|---|---|
| 1 | un'entrata non può essere investimento | pure · schermata · migrazione (vincolo `check`, anche *dopo* l'inserimento) |
| 2 | una nuova uscita nasce non marcata | schermata (il payload) · migrazione |
| 3 | la scelta manuale si conserva | schermata · migrazione |
| 4 | un'uscita esistente si marca e smarca senza perdere gli altri dati | schermata (manda un campo solo) · migrazione (colonna per colonna) |
| 5 | Borgo 58 e tasca restano separati | pure · migrazione |
| 6 | il totale coincide con la loro somma | pure · schermata |
| 7 | Orto e altri soggetti non entrano | pure · schermata · migrazione |
| 8 | rimborsi e anticipazioni non contano due volte | pure (anche col testo che *parla* di rimborsi) · schermata · migrazione |
| 9 | la tasca non entra nei dati fiscali | pure, di forma: nessun modulo fiscale nomina la colonna |
| 10 | il dettaglio coincide con i totali | pure · schermata · migrazione |
| 11 | oltre 1.000 righe nessun totale parziale in silenzio | pure (3 prove sulla paginazione) · schermata |
| 12 | con dati e senza dati | pure · schermata (compresa la lettura fallita) |
| 13 | le schermate mostrano e nascondono la scelta | schermata |
| 14 | la migrazione si verifica in transazione e non lascia niente | pure, sul file · la verifica stessa |

### Le undici rotture deliberate

Ognuna è stata fatta, misurata e **rimessa a posto**.

| rottura | prove diventate rosse |
|---|---|
| l'orto entra nel totale | 6 |
| si ignora la causale di sistema | 2 |
| il totale si calcola su tutte le righe | 3 |
| il dettaglio si dichiara sempre completo | 2 |
| la lettura si ferma alla prima pagina | 2 |
| la casella compare anche sulle entrate | 1 |
| marcare ricarica tutto l'elenco | 1 |
| su lettura fallita si disegna lo zero | 1 |
| la verifica cancella invece di annullare | 1 |
| il vincolo `check` viene tolto | 1 |
| il trigger torna a `update of e_investimento` | 1 |

🔴 **E una rottura ha trovato un difetto nella prova, non nel codice.**
Commentando la chiamata a `pretendi_nessun_residuo` dentro la migrazione, la
prova restava **verde**: cercava la parola nel file, e una riga commentata la
contiene ancora. *Un setaccio che cerca una forma nel testo trova anche chi la
nomina per spiegarla* — la stessa famiglia dei falsi allarmi del 27/08, qui al
contrario. Corretta: adesso guarda il **codice**, coi commenti tolti, e
rifacendo la rottura diventa rossa.

🔴 **E una rottura non ha morso al primo colpo, per un motivo già scritto in
§8**: la sostituzione che toglieva il vincolo `check` usava `\n` su un file a
**CRLF**, quindi non ha cambiato niente e la prova restava verde. Rifatta con
`\r?\n` — e con un controllo che **fallisce se l'àncora non si trova**, invece
di riuscire senza fare niente. *Una rottura che non è avvenuta è
indistinguibile da una prova che non discrimina.*

---

## 11 · Cosa abbiamo rovesciato

**Niente.**

Nessuna decisione in vigore è stata rovesciata. Le quattro decisioni di
Alessio del 31/08 (è un'etichetta e non una sezione; il totale si divide per
soggetto; «in cosa» e «con quali soldi» non vogliono campi nuovi; serve fino a
marzo 2027 e poi decade) sono state **eseguite alla lettera**, e le cinque
decisioni che SPEC-0004 lasciava aperte sono state **chiuse**, non cambiate —
sono scritte lì con la risposta accanto, perché *una decisione cancellata non
si distingue da una che non è mai stata posta*.

⚠️ L'unica cosa che somiglia a un rovesciamento e non lo è: in questa vista il
periodo parte **vuoto**, mentre in Prima nota dal 19/08 parte dal mese in
corso. Non è la stessa regola letta diversamente — è che le due schermate
rispondono a due domande diverse, e qui il rischio che quella regola
proteggeva (un totale tagliato a mille righe) **non esiste**, perché il totale
arriva da un'aggregazione.

---

## 12 · Cosa NON è stato verificato

* 🔴 **La migrazione non è stata applicata da nessuna parte** — né al progetto
  di prova né alla produzione, com'è scritto nel perimetro del mandato.
  Quindi la sua verifica interna, i quattordici controlli che contiene e i due
  divieti del database **non sono mai girati contro un database vero**. Sono
  scritti e riletti, non provati.
  ⚠️ Conseguenza: **le funzioni `costo_del_progetto()` e
  `righe_costo_del_progetto()` non hanno mai risposto a nessuno.** Quello che
  si sa è che la schermata le chiama e cosa fa con le risposte, perché lì il
  collegamento è finto.
* **Nessuna mano ha toccato niente.** La casella, il segno nell'elenco, i tre
  numeri e il riquadro «fuori dal totale» non li ha visti nessun occhio: le
  prove di schermata montano il DOM, non guardano. Se il segno «investimento»
  si distingua **con la luce del ristorante**, e se la casella sia comoda **col
  dito**, restano giudizi di Alessio.
* **Nessuna misura di larghezza sul telefono.** La casella nuova nel modulo e
  la riga nel dettaglio non sono state misurate a 390 punti. La spiegazione è
  stata messa **dietro il segno `?`** e non affiancata al nome proprio per la
  famiglia di difetti del 25/08 — ma è una precauzione presa leggendo, non una
  misura.
* **Il rifiuto del vincolo in italiano** è verificato dentro la migrazione
  (che chiama `spiega_vincolo`), e quella verifica non è girata: la frase c'è
  nel `comment on constraint`, che nessuno ha ancora interrogato dal vivo.

---

## 13 · Cosa resta da fare

1. **Applicare `20260921000003` al progetto di prova**, e leggere l'esito della
   sua verifica: è il primo momento in cui i due divieti e i tre numeri
   toccano un database vero.
2. **Poi in produzione**, col giro di sempre (commit → push → `npm run migra`).
3. **Guardare le due schermate con le mani**, e con la luce del locale.

⚠️ Finché il punto 1 non è fatto, in produzione **non cambia niente**: il
codice nuovo chiede una colonna e due funzioni che là non esistono, quindi la
vista risponderebbe con un errore — e lo direbbe, invece di disegnare zeri.
Questa proposta **prepara** la funzione; l'applicazione è di un mandato
successivo.

---

## 14 · File toccati

**Nuovi**

* `supabase/migrations/20260921000003_l_etichetta_investimento.sql`
* `src/lib/calcoli/investimento.js`
* `src/pages/cassa/CostoProgetto.jsx`
* `tests/unita/investimento.test.js`
* `tests/schermate/investimento.test.jsx`
* `docs/consegne/20260921_l_etichetta_investimento.md` (questo)

**Modificati**

* `src/lib/api/cash.js` — `di_sistema` nella lettura dei movimenti,
  `segnaInvestimento`, `costoDelProgetto`, `righeCostoDelProgetto`
* `src/pages/cassa/PrimaNota.jsx` — la casella, il gesto sulla riga, il segno,
  la colonna nell'export
* `src/pages/cassa/CassaHome.jsx` — la porta
* `src/App.jsx` — la rotta
* `docs/specifiche/SPEC-0004-costo-effettivo-del-progetto.md` e
  `docs/specifiche/INDICE.md` — le cinque decisioni aperte, chiuse
* `docs/RICHIESTE.md` — C11 segnata fatta
* `docs/DECISIONI.md` — la sezione «Quanto è costato il progetto»
