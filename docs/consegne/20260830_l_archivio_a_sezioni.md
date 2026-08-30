# L'archivio a sezioni — 30/08/2026, notte

**Migrazione che entra**: `20260830000013` — *l'archivio a sezioni*.
Applicata al progetto di prova, che ora ha **356** migrazioni registrate.
Nel gestionale vero non c'è: aspetta il push.

---

## Il difetto, misurato prima di scrivere

`documents.doc_type` esiste ed è preteso da un vincolo, ma è **testo libero**:
nessun vocabolario, nessun controllo oltre al non-vuoto. Quindi «Fattura»,
«fattura» e «Fatture» sarebbero diventate **tre sezioni diverse**, e un
archivio diviso in sezioni sarebbe stato diviso in sezioni sbagliate.

⚠️ **E la misura ha corretto la premessa due volte:**

* l'obbligo **non è un `not null`** sulla colonna: è il check
  `documents_ha_identita`, marcato **NOT VALID** — cioè vale per le righe
  nuove e non è mai stato passato su quelle vecchie. Infatti sul progetto di
  prova ci sono **2 documenti senza tipo**, che nessun `not null` avrebbe
  permesso;
* in produzione i documenti sono **zero**, quindi lì la sanatoria non tocca
  niente. Sul progetto di prova sono **10**, con **9 valori distinti**
  scritti a mano.

## Cosa c'è adesso

**Un catalogo** (`sezioni_archivio`) con le **otto sezioni di Alessio**, e un
legame da `documents.doc_type` che rende impossibile scriverne una nona.
L'archivio si guarda **diviso**, nell'ordine del catalogo.

⚠️ **I valori scritti a mano non si buttano e non si indovinano** — regola del
27/08: entrano nel catalogo **spenti**, restano legali per i documenti che li
portano, e non si propongono più. Sul progetto di prova ne sono stati
conservati **nove**, e la migrazione **dichiara quanti**.
*Indovinare a quale delle otto appartenga «Verbale» sarebbe riscrivere un dato
di Alessio senza che nessuno lo chieda.*

⚠️ **Una sezione vuota non compare**: qui si cerca un documento, e sei
riquadri vuoti sono sei righe da saltare ogni volta. **I documenti senza
sezione stanno in fondo e si dicono**: nasconderli li farebbe sparire.

## La trappola che chiudere un vocabolario apre — e le due porte da cui entra

🔴 **Un menu a tendina che riceve un valore fuori elenco MOSTRA LA PRIMA
OPZIONE, senza nessun errore** (trappola del 27/08, allora vista a schermo).
Su un documento archiviato con una sezione poi spenta, aprire la scheda e
salvare gliela cambierebbe — e il difetto sarebbe indistinguibile da una
scelta. Per questo `sezioni_archivio_per(corrente)` **aggiunge sempre la
sezione che il documento porta già**, spenta o no, e la scheda la marca «non
si usa più».

🔴 **E LA SECONDA PORTA ERA LA POSTA, che avrebbe smesso di funzionare.**
`esegui_azione_posta` prende il «tipo» proposto dal modello e lo scrive dritto
in `doc_type`: col legame nuovo, un «contratto» inventato **avrebbe fatto
fallire l'archiviazione al momento della conferma**, cioè nel punto peggiore.
⚠️ La cura sta **a monte e riusa la rete che c'era**: gli elenchi chiusi
arrivano già al modello da `vocabolari_per_assistente()`, costruiti **dal
catalogo**. Se ne aggiunge uno, e il valore che torna **passa da un filtro** —
se non appartiene, arriva **vuoto**, il pulsante si spegne con la sua ragione
e Alessio sceglie.
⚠️ **Se l'elenco non si è potuto leggere il valore passa com'è**: lo
respingerà il legame, rumorosamente, invece di essere svuotato in silenzio da
un elenco che non c'era. Stessa scelta già presa per la categoria dei prodotti.

## Come è stata provata

🔴 **Tre rotture, tre controlli diversi**:

| rottura | cosa diventa rosso |
|---|---|
| cade il legame verso il catalogo | *«Un documento con una sezione inventata NON è stato respinto»* |
| il menu offre **solo** le attive | *«Il menu NON comprende la sezione che il documento porta già»* |
| il menu offre **tutto**, spente comprese | *«Una sezione spenta viene proposta anche quando nessun documento la porta»* |

🔴 **E il primo giro di rotture non aveva provato niente**, ed è la trappola
del 26/08 presa in flagrante: avevo rotto il legame e **non l'avevo rimesso**,
quindi le due rotture successive cadevano sul **primo** guardiano e i controlli
in esame non venivano mai raggiunti — tre errori identici che sembravano tre
conferme. Rimesso il legame prima di ognuna, i tre messaggi si separano.

⚠️ **Il blocco di verifica vive dentro una sotto-transazione annullata** — la
strada decisa stasera: zero righe lasciate, zero lapidi, registro delle
cancellazioni acceso per tutto il tempo.

## Cosa hanno trovato le reti che c'erano già

🔴 **`letture.test.js` ha preso un difetto mio**: in `DocumentoDetail` avevo
scritto `.catch(() => setSezioni([]))`, che trasforma «non sono riuscito a
leggerle» in «non ce ne sono» — la famiglia del 19/08, riaperta da me. Ora
passa da `leggi()` e la schermata **dichiara** di non sapere, con la via
d'uscita per riprovare.

🔴 **`permessi.test.js` ha nominato `e_una_tasca`** (del blocco precedente), e
la cura giusta **non era un portiere**: la chiamano solo i trigger, che girano
coi permessi del proprietario, e un `is_titolare()` dentro avrebbe **rifiutato
un movimento di cassa scritto dalla sala**. È la cura (a) del 27/08 — *nessun
utente la chiama, quindi si chiude la porta*.

🔴 **`archivio-domande.test.js` è diventata rossa col codice `23503`**: scriveva
documenti con tipo a testo libero. Aggiornata alle sezioni del catalogo — non
è un allentamento, è che stava provando un gestionale che non esiste più.

🔴 **E `frasi-sullo-stato.test.js` ERA ROTTA DALLA NASCITA**, trovato usandola:
importava `titolare` da `aiuto.js`, che **non lo esporta**. Restava
`undefined`, e non faceva danno solo perché la prova **usciva prima di
usarlo** — finché nessun documento vivo diceva «non ancora in produzione», il
controllo tornava subito. *Cioè la rete nata oggi per sorvegliare le frasi non
poteva scattare: al primo caso vero sarebbe morta con un errore di
programmazione invece di nominare la frase falsa.* L'hanno fatta arrivare fin
lì le frasi che ho scritto stanotte.

## Cosa abbiamo rovesciato

🔴 **Una cosa, ed è mia: avevo cominciato a costruire nella rete delle frasi
una via d'uscita — «se la riga porta una data, lasciala stare» — e l'ho
tolta.**

* **Cosa era stato deciso e quando.** Oggi stesso, nella rete
  `frasi-sullo-stato.test.js`, con una prova che dice esattamente il
  contrario: *«una frase che porta la data NON è esente: la data non rende
  vera una bugia, serve solo dove il gestionale non può rispondere»*.
* **La ragione di allora.** Per una migrazione che si può **nominare**, il
  gestionale una risposta ce l'ha: quindi non si scrive a mano, si chiede.
* **Cosa si decide adesso.** Niente: la via d'uscita è stata **tolta** e la
  regola resta intera. La mia riga in `RICHIESTE.md` non dichiara più nulla
  sulla produzione — dice solo quale migrazione l'ha chiusa.
* **Perché la ragione di allora vale ancora.** Perché è giusta, e la mia
  modifica l'avrebbe smontata per comodità mia. *Vale anche quando la strada
  che si sta prendendo sembra più prudente — anzi soprattutto allora.*

⚠️ Nessuna riga in [`decisioni_rovesciate.md`](../decisioni_rovesciate.md):
non è una decisione di Alessio rovesciata, è una mia deviazione rientrata.

## 🔴 Un limite di quella rete, trovato usandola e NON corretto

**`frasi-sullo-stato.test.js` interroga il progetto di PROVA, non la
produzione** — le prove dell'app si rifiutano di parlare col database vero, ed
è giusto così. Ma *«non ancora in produzione»* è un'affermazione **sulla
produzione**: fra il momento in cui una migrazione entra nella prova e quello
in cui entra in produzione, quella frase è **vera** e la rete la chiamerebbe
falsa.

⚠️ **Oggi non morde**, perché la regola dice di non scrivere quella frase a
mano — e infatti la cura è stata togliere la frase, non zittire la rete. Ma
**il giorno che qualcuno la scrive in buona fede durante una consegna, la rete
lo accusa a torto**, e *un guardiano che grida ingiustamente si impara a
spegnere*.

**Non corretto**, perché la cura vera è una decisione: o la rete impara a
chiedere alla produzione (e allora non può stare in `tests/app`), o la regola
dice esplicitamente che quella frase **non si scrive mai**. È una domanda per
Alessio, non una cosa da scegliere stanotte.

---

## Cosa NON è verificato

* 🔴 **NESSUNA DELLE TRE SCHERMATE È STATA APERTA** — l'archivio, la scheda di
  un documento, la posta in arrivo. Per aprirle serve entrare, e questa
  sessione ha scelto di **non digitare nessun PIN**. Quindi l'elenco diviso,
  il menu a otto voci, la riga «(non si usa più)» e il menu della posta sono
  **scritti e compilati, non guardati**.
* **La posta non è stata provata dall'inizio alla fine**: il filtro sul valore
  proposto dal modello è scritto, ma nessuna mail vera è passata da lì. E
  `posta-leggi` **non è stata reinstallata**: finché non lo è, il modello non
  riceve l'elenco delle sezioni.
* **In produzione l'archivio non ha sezioni**: la migrazione aspetta il push.
* **Nessun documento vero è stato archiviato** in una sezione.
