# L'etichetta «investimento» e il costo del progetto — 21/09/2026

| | |
|---|---|
| **Mandato** | C11 — l'etichetta «investimento» e il costo del progetto, più la correzione «anticipazioni contate una volta» |
| **Ramo** | `claude/etichetta-investimento-c11`, aperto da `slave` a `f956ae8` |
| **Proposta** | **#121 verso `slave`, aperta e NON unita** |
| **Migrazioni** | `20260921000003` — **non applicata in nessun ambiente** |
| **Prove** | 47 pure nuove · 33 di schermata nuove |

---

## 0 · Una lettura fuori perimetro, dichiarata

🔴 **Durante il primo giro ho letto il database di PRODUZIONE** col connettore
in sola lettura, per misurare lo stato iniziale. **Il mandato non lo
prevedeva**, e quelle letture erano fuori perimetro. Le dichiaro invece di
lasciarle dentro un documento come se fossero dovute.

* **Cosa ho letto**: numero di colonne di `cash_movements`, numero di
  movimenti, i soggetti, le causali di sistema, il conteggio delle
  migrazioni, e il corpo vivo di `rettifiche_fiscali()`,
  `costi_da_classificare()` e `pay_supplier_invoice()`.
* **Cosa NON ho fatto**: nessuna scrittura, nessuna modifica, nessuna
  migrazione, nessun dato toccato. Erano interrogazioni in sola lettura.
* **In questa correzione non ho ripetuto nessuna lettura remota**: né
  produzione, né progetto di prova, né altro.
* **Le fotografie della produzione sono state tolte** da questo riepilogo e
  dalla migrazione. Al loro posto ci sono **riferimenti del solo
  repository**, che chiunque può ricontrollare senza aprire un database:

| cosa serviva sapere | dove sta, nel repository |
|---|---|
| `cash_movements` non ha colonne per le etichette | `docs/consegne/20260831_la_regola_della_stima.md` |
| il totale fiscale è per anno e per una società | `supabase/migrations/20260815000002_attributo_di_deducibilita.sql` |
| le causali di **sistema** sono nove, e quali | gli `insert into cash_causali (… di_sistema)` delle migrazioni `…0815000004`, `…0815000006`, `…0822000005`, `…0826000017`, `…0827000003` |
| l'uscita che paga una fattura nasce **senza causale** | `pay_supplier_invoice`, migrazione `20260817000001` e successive |
| una nota collegata a una fattura «vale solo come debito» | commento del vincolo in `20260816000005` |
| il rimborso porta la causale di sistema | `pareggia_anticipazione`, migrazione `20260815000006` |
| i tre tipi di soggetto | `entity_type`, e `20260830000012` per la tasca |

⚠️ **Il ciclo completo dell'anticipazione l'ho ricostruito dal solo
repository**: creazione (`createAnticipazione`), collegamento alla fattura
(`supplier_invoice_id`, `restrict` dal 16/08), rimborso
(`pareggia_anticipazione` → movimento con causale di sistema), annullamento
(`annulla_pareggio_anticipazione`), cancellazione respinta
(`delete_anticipazione`).

---

## 1 · Il difetto che chiude

Il gestionale non aveva **nessun numero** che rispondesse a *«quanto è costato
mettere in piedi il locale»*: `cash_movements` non ha colonne per le
etichette, quindi un forno da 6.000 € e una bolletta della luce sono
indistinguibili, e il totale più vicino (`rettifiche_fiscali → costi_totali`)
è per **anno civile**, per **una società sola**, ed **esclude la tasca**.

Il lavoro era stato cominciato il 31/08 e riportato indietro su richiesta di
Alessio. Verificato prima di ricominciare, **cercando nel repository**: zero
occorrenze di `e_investimento`, nessun file `20260831000012`, nessuna funzione
`investimenti*`. Si è ripartiti dalla decisione, non da un mezzo lavoro.

---

## 2 · 🔴 Il difetto della PRIMA stesura, e la sua origine precisa

La prima versione di questa proposta contava **zero volte** gli investimenti
pagati con «Anticipo io, poi mi rimborso», e li dichiarava fuori come se fosse
una scelta.

**L'origine, in una riga:** *la spesa non vive in `cash_movements`.* Vive in
`anticipazioni_socio`. In prima nota compare **solo il rimborso**, con la
causale di sistema «Rimborso al titolare» — giustamente non marcabile, perché
un rimborso non è una spesa. Quindi mettendo l'etichetta **solo sui movimenti
di cassa**, quel denaro non aveva **nessuna porta** da cui entrare.

⚠️ **E il ragionamento che l'ha prodotto era plausibile**: SPEC-0004 mette fra
i fuori-scope il sommare le anticipazioni rimborsabili («raddoppierebbe il
costo»), e il vincolo del 16/08 avverte che una nota scollegata dalla fattura
«diventa da sola un costo, contato due volte in silenzio». Da lì: meglio zero
che due. 🔴 **Ma zero non è la risposta prudente a «quanto è costato aprire»:
è la risposta sbagliata**, e non la dichiarava nessun numero — il totale
sembrava completo. *Un'etichetta che manca nel punto in cui vive la spesa non
è una regola prudente: è un buco silenzioso.*

Registrato come **rovesciamento n. 94**.

---

## 3 · La fonte canonica, e perché

Le fonti sono **due**, e non si sovrappongono mai:

| fonte | cosa contiene | chiave |
|---|---|---|
| `cash_movements` | le uscite marcate | `e_investimento` + `direction = 'uscita'` |
| `anticipazioni_socio` | le note marcate | `e_investimento` |

**L'unico punto in cui potrebbero raccontare la stessa spesa è la fattura**, e
lì la chiave è **`supplier_invoice_id`**: un identificativo e un legame già
esistente, mai un importo, una data o una parola.

🔴 **Si impedisce, non si scarta.** Marcare la seconda delle due viene
**rifiutato** da un trigger, che dice *quale* delle due è già contata e come
cambiare idea. La strada alternativa — lasciar marcare tutt'e due e poi
scartarne una nella somma — darebbe un'etichetta accesa che non fa niente, e
costringerebbe l'aggregato a un filtro capace di far sparire in silenzio una
riga che Alessio ha marcato.

⚠️ **I due guardiani si guardano a vicenda, e in tutt'e due gli ordini**: sono
`before insert or update` **senza** `of e_investimento`, quindi prendono anche
chi **marca prima e collega la fattura dopo** — l'ordine che un filtro sulla
sola colonna non vedrebbe (trappola del 27/08).

⚠️ **Il caso non si nasconde**: nel dettaglio ogni nota porta la fattura
collegata, col numero e il fornitore.

---

## 4 · La formula dei tre totali

```
Totale progetto  =  Borgo 58  +  La tasca di Alessio
```

Dove ciascuno dei due è, nel periodo scelto:

```
uscite marcate di cash_movements di quel soggetto
        +
note marcate di anticipazioni_socio di quel soggetto
```

* **Chi entra**: soggetti di tipo `srls` e `tasca`, sul **tipo stabile**
  (`entity_type`), mai sul nome visualizzato.
* **Chi non entra**: `azienda_agricola` e qualunque soggetto futuro — ma
  **non sparisce**: ha la sua riga dichiarata fuori dal totale.
* **Nessun quarto totale.** Un anticipo non è una voce a sé: è una spesa di
  Borgo 58, fatta con soldi suoi.

⚠️ **Il soggetto di una nota arriva da sé**: `anticipazioni_socio.entity_id` è
già la società **per conto della quale** hai pagato. Non serve nessuna regola
che dica «le anticipazioni vanno sotto Borgo 58».

⚠️ **E la Tasca resta fatta solo delle sue uscite**: una nota intestata alla
tasca è **rifiutata** dal trigger — una tasca non anticipa niente per conto di
nessuno. È una proprietà, non un filtro che qualcuno deve ricordarsi di
scrivere nella prossima funzione.

---

## 5 · Prima e dopo il rimborso

| momento | cosa succede al totale |
|---|---|
| nota registrata, non marcata | niente |
| nota **marcata**, non rimborsata | entra una volta, sotto Borgo 58 |
| la stessa nota **dopo il rimborso** | **resta una volta**, stesso importo |
| il movimento «Rimborso al titolare» | **non marcabile**: non aggiunge niente |

🔴 **È così per costruzione, non per una regola da ricordare**: il conteggio
legge `anticipazioni_socio.importo` e **non guarda `pareggiata_il`**. Il
rimborso chiude un debito; non annulla una spesa.

E il dettaglio **lo dice**: ogni nota porta «da rimborsare» oppure «rimborsata
il …».

---

## 6 · La fattura collegata

Una nota collegata a una fattura **non sparisce** dal costo del progetto: se
nessun pagamento di quella fattura è marcato, la si marca e conta una volta.

⚠️ **La decisione del 16/08 resta vera dov'è nata.** *«Collegata a una fattura
vale solo come debito»* è una regola del conteggio **fiscale**, che questa
proposta **non tocca**: `rettifiche_fiscali()` e `costi_da_classificare()` non
nominano la colonna nuova e rispondono come prima. Qui la domanda è un'altra —
*quanto denaro è uscito per il progetto*, non *quanto costo è deducibile* — e
la stessa riga può rispondere «sì» all'una e «no» all'altra senza
contraddirsi. La frase nella schermata delle note è stata corretta di
conseguenza: diceva «la spesa è contata lì» senza dire dove, e adesso dice
«il costo **fiscale** è contato sulla fattura».

---

## 7 · Come si marca

**In Prima nota** — sulle **uscite** compare «Investimento per il progetto»,
con la spiegazione dietro il segno `?`. Sulle **entrate** non compare: non è
spenta, non c'è. Senza toccare niente il movimento nasce non marcato, e una
riga già scritta si marca e si smarca dalla sua riga.

**In «Anticipo io, poi mi rimborso»** — la stessa casella nel modulo di una
nota nuova, e su **ogni nota già scritta**, comprese quelle **già
rimborsate**.

⚠️ **Si manda un campo solo** (`{ e_investimento }`), e si aggiorna **solo la
riga toccata**: una ricarica butterebbe via quello che si sta scrivendo nel
modulo sopra (trappola del 12/08). Marcare non cambia importo, data, motivo,
fondi, fattura, documento, nota né lo stato del rimborso.

⚠️ **Il rifiuto del database si legge sulla riga toccata**, non in cima alla
pagina: è un'informazione — dice quale delle due cose è già contata — e un
rifiuto lontano dal gesto è un rifiuto che non c'è (17/08).

**Le protezioni sono quelle di sempre**: la RLS (tutt'e due le tabelle sono
titolare-only per ogni operazione), i divieti della migrazione, e il trigger
che registra quando la riga è cambiata. Sono scritture su **una tabella sola
senza conseguenze altrove** — categoria A del Contratto — quindi non passano
dal corridoio, che esiste per le scritture «tutto o niente» su più tabelle.

---

## 8 · Il tetto delle mille righe

I **totali** arrivano da un'**aggregazione** delle due fonti: non si possono
tagliare. Il **dettaglio** sì, e allora si legge **a pagine** e si confronta
col conteggio che l'aggregato dichiara — che ora comprende **entrambe** le
fonti. Se è più corto, la schermata lo dice.

⚠️ Il segnale delle letture tagliate non copre questo caso: vive sulle letture
di elenco (`GET`), e queste sono chiamate a funzione (`POST`).

---

## 9 · Niente di fiscale

L'etichetta non cambia deducibilità, IVA, causale né nessun conteggio; non
crea nessun debito verso Alessio. La colonna compare in **una migrazione
sola** e in **nessun modulo fiscale**, e una prova di forma lo sorveglia
invece di affidarlo a un promemoria.

---

## 10 · Prove

**47 pure** · **33 di schermata** · la verifica dentro la migrazione, che
costruisce il giro vero — motivo, fornitore, fattura — chiama
`pareggia_anticipazione` e tenta di marcare **il movimento di rimborso vero**,
non uno costruito a mano che gli somiglia.

| # | regola del mandato | dove |
|---|---|---|
| 1 | anticipazione non marcata: non entra | migrazione (A) |
| 2 | marcata e non rimborsata: una volta, sotto Borgo 58 | migrazione (B) · pure · schermata |
| 3 | dopo il rimborso: resta una, non zero e non due | migrazione (C) · pure |
| 4 | marcata e collegata a fattura: una volta | migrazione (D) |
| 5 | fattura + nota + movimento: nessun doppione | migrazione (E), nei due versi e nei due ordini · pure |
| 6 | «Rimborso al titolare» non marcabile | migrazione (C), sul movimento vero · pure |
| 7 | marcare/smarcare non cambia gli altri dati | migrazione (F), colonna per colonna · schermata |
| 8 | Tasca e conteggi fiscali invariati | migrazione (B, G) · pure (di forma) |
| 9 | aggregato e dettaglio coincidono con entrambe | migrazione (H) · pure |
| 10 | oltre mille righe complessive, nessun parziale muto | pure · schermata |
| 11 | la verifica si annulla senza lasciare dati né lapidi | pure, sul file · la verifica stessa |

### Le rotture deliberate

| rottura | esito |
|---|---|
| il conteggio guarda lo stato del rimborso | 1 prova rossa |
| la guardia della prima nota non vede più le note | 1 prova rossa |
| l'etichetta torna a esistere solo in prima nota | 1 prova rossa |
| il campo non arriva al database | **nessuna prova rossa** → prove aggiunte, poi 3 rosse |
| il gesto ricarica tutto invece della sola riga | **nessuna prova rossa** → prova aggiunta, poi 1 rossa |

🔴 **Due rotture su cinque non hanno rotto niente, ed erano buchi nelle prove,
non nel codice.**

* **Il campo che non arriva al database.** Le prove di schermata **fingono**
  il modulo dell'api: provano che la schermata *passa* il campo, non che il
  campo diventa una *colonna*. È il difetto del 16/08 sulle mance — il menu
  c'era, si sceglieva, e `mezzo` non arrivava mai. Cura: `payloadAnticipazione`,
  funzione pura come `payloadMancia`, confrontata **per intero**.
* **La ricarica completa.** La prova c'era per la Prima nota e non per le
  note.

⚠️ **Rileggendo, tutt'e due sembravano coperte.** A trovarle è stato il metodo
del 18/08: *non si rilegge una prova appena scritta, si rompe ciò che dovrebbe
proteggere e si guarda se diventa rossa.*

🔴 **E una terza cosa, sul metodo e non sul codice**: la prima volta ho
ripristinato una rottura con `git checkout --` su un file **non ancora
committato**, e mi sono portato via la correzione intera della migrazione —
che ho dovuto rifare. *`git checkout` rimette al commit, non a «com'era un
minuto fa»: prima di rompere, si committa.*

---

## 11 · Cosa abbiamo rovesciato

**Una cosa, ed è il cuore di questa correzione.**

* **Cosa era stato deciso e quando.** Il 21/09/2026, poche ore prima, nella
  prima stesura di questa stessa proposta: *un investimento anticipato per
  conto della società **non entra** nel costo del progetto*.
* **La ragione di allora.** Evitare il doppio conteggio, che SPEC-0004 e il
  vincolo del 16/08 nominano entrambi.
* **Cosa si decide adesso.** Entra **una volta**, sotto Borgo 58, prima e dopo
  il rimborso — decisione di Alessio.
* **Perché la ragione di allora non vale più.** Non era una scelta: era un
  buco. Il timore era giusto, la cura produceva **zero** invece di **uno**, e
  zero non è la risposta prudente. ⚠️ **E la ragione di allora resta intera
  dov'è nata**: vale nel conteggio fiscale, che non è toccato.

Registrato in [`decisioni_rovesciate.md`](../decisioni_rovesciate.md), n. 94.

⚠️ E cinque decisioni che SPEC-0004 lasciava **aperte** sono state **chiuse**,
non cambiate: stanno lì con la risposta accanto, perché *una decisione
cancellata non si distingue da una che non è mai stata posta*.

---

## 12 · Cosa NON è stato verificato

* 🔴 **La migrazione non è mai girata**, in nessun ambiente. I due vincoli, i
  due trigger e le due funzioni **non hanno mai risposto a nessuno**: sono
  scritti e riletti, non provati contro un database. Tutti i controlli della
  sua verifica — compreso il giro vero del rimborso — non sono mai stati
  eseguiti.
* **Nessuna mano e nessun occhio** sulle tre schermate. Le prove di schermata
  montano il DOM, non guardano: se il segno «anticipo» si distingua dal segno
  «investimento» con la luce del locale, e se le caselle siano comode col
  dito, restano giudizi di Alessio.
* **Nessuna misura di larghezza sul telefono**: le caselle nuove e la colonna
  «Fattura e rimborso» non sono state misurate a 390 punti. La colonna in più
  nel dettaglio è la voce più esposta.
* **Il rifiuto in italiano dei vincoli** è verificato dentro la migrazione,
  che non è girata.
* **Nessuna lettura remota durante questa correzione**: quello che so del
  modello viene dai file del repository, non da un database.

---

## 13 · Cosa resta da fare

1. **Unire la proposta #121** (non fatto: non è autorizzato).
2. **Applicare `20260921000003` al progetto di prova** e leggere l'esito della
   sua verifica: è il primo momento in cui le regole toccano un database.
3. **Poi in produzione**, col giro di sempre.
4. **Guardare le schermate con le mani.**

⚠️ Finché il punto 2 non è fatto, nulla di questo è installato da nessuna
parte. Questa proposta **prepara** la funzione; l'applicazione è di un mandato
successivo.

---

## 14 · File toccati

**Nuovi**

* `supabase/migrations/20260921000003_l_etichetta_investimento.sql`
* `src/lib/calcoli/investimento.js`
* `src/pages/cassa/CostoProgetto.jsx`
* `tests/unita/investimento.test.js` · `tests/schermate/investimento.test.jsx`
* `docs/consegne/20260921_l_etichetta_investimento.md` (questo)

**Modificati**

* `src/lib/api/cash.js` — `di_sistema` nella lettura, `segnaInvestimento`,
  `costoDelProgetto`, `righeCostoDelProgetto`
* `src/lib/api/anticipazioni.js` — `payloadAnticipazione`,
  `segnaInvestimentoAnticipazione`
* `src/pages/cassa/PrimaNota.jsx` · `src/pages/cassa/SezionePersonale.jsx` ·
  `src/pages/cassa/CassaHome.jsx` · `src/App.jsx`
* `docs/specifiche/SPEC-0004-costo-effettivo-del-progetto.md` e
  `docs/specifiche/INDICE.md` · `docs/RICHIESTE.md` · `docs/DECISIONI.md` ·
  `docs/decisioni_rovesciate.md`
