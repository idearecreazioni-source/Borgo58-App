# Il report della notte — quanto ci è voluto davvero

**23/08/2026, dalle 00:20 alle 04:50.** Chiesto dal mandato: *«NEL REPORT
FINALE IL TEMPO EFFETTIVO, blocco per blocco, confrontato con la tua
stima»*.

---

## 1 · I blocchi, col tempo vero

| blocco | stima | tempo vero | scarto |
|---|---|---|---|
| **0 · Il pizzico di cannella** (misura + referto) | — | **41 min** (38 di misura, 3 di scrittura) | non stimato: è una scoperta, non un lavoro previsto |
| **1 · La pulizia che si controlla** | ~20 min | **28 min** | +40% |
| **2+3 · La scala e i settori** | ~90 min | **2 h 35 min** | **+72%** |
| **4 · I campi messi dalla macchina** | 30 min | **55 min** | +83% |
| **5 · Il giro delle 60 schermate** | 20 min | **9 min** | −55% |
| **6 · L'assistente installato sulla prova** | 15 min | **8 min** | −47% |
| **7 · Riepiloghi, coda, rovesciamenti, report** | 30 min | **35 min** | +17% |

**In tutto: 4 ore e 10 minuti di lavoro** (più venti minuti di pausa, quando
mi hai chiesto di fermarmi per spostare il computer).

---

## 2 · 🔴 Dove è finito il tempo davvero: le corse

La scrittura del codice è stata **meno di metà** della notte. Il resto è
stato **aspettare che lo scenario si costruisse**:

| corsa | durata | esito |
|---|---|---|
| prima, a scala piena | **26 min 57 s** | riuscita — ha dato le misure su cui è stato deciso tutto il resto |
| seconda, coi settori del retro | **34 min 58 s** | riuscita |
| terza, con le fasi e gli angoli | **32 min 30 s** | 🔴 **caduta all'ultimo passo** su un vocabolario chiuso |
| ripresa della sola coda | 2 min 33 s | riuscita |
| quarta, pulita dall'inizio | ~35 min | l'ultima, per provare il comando intero |

**Più di due ore e mezza di attesa.** Ed è esattamente il motivo per cui il
mandato chiedeva il ripristino da copia: dalla prossima volta rimettere lo
scenario costa **4 minuti e 25 secondi**, misurati.

### 🔴 La terza corsa persa, e perché

Si è fermata dopo trentadue minuti con:

> `invalid input value for enum cooking_technique: "pesatura"`

Il vocabolario del **passo** di una ricetta l'avevo controllato; quello della
**tecnica** no, perché la colonna sembrava testo libero.

⚠️ **La lezione, scritta nel codice perché non si ripeta**: *un vocabolario
chiuso non si riconosce dal nome della colonna — si chiede al database, ogni
volta, per ogni colonna che si scrive.* Questo progetto ha una rete che
sorveglia i vocabolari (17/08), e **non copre gli script**: guarda l'app.

---

## 3 · Cosa ha trovato la notte, in ordine di peso

1. 🔴 **Un pizzico di cannella ferma lo scarico di tutto il tavolo** — 149
   conti su 346, il 43%. **Non corretto**, come chiesto:
   [referto](../referti/20260823_un_pizzico_di_cannella.md), e due domande
   per te in coda.
2. 🔴 **Ogni cliente ordinava un piatto solo**, e da lì venivano *tutti* i
   numeri assurdi insieme — scontrino a 15,71 €, food cost al 6%, turni mai
   usati, zero bevande in due mesi.
3. 🔴 **Il comando diceva «rifallo» e accumulava**: 15 preventivi invece di
   3, 36 promemoria uguali, 2.233 righe che puntavano al vuoto.
4. 🔴 **Il registro di ricevimento merci aveva una riga** dopo 475 partite
   entrate in cella — trovato **aprendo la schermata**, non leggendo il
   codice.
5. 🔴 **Una frase diventata falsa**: il comando di ripristino avvisava sempre
   «adesso il progetto di prova contiene i dati VERI», e da stanotte non è
   più vero — mandava a rifare da zero un database che stava benissimo.
6. ⚠️ **1.031 righe di «voce libera»**: ogni bicchiere di vino finisce fra
   le cose che il magazzino non ha saputo scaricare. È come si comporta il
   gestionale, e con una sola bevanda in due mesi non si vedeva.

---

## 4 · Cosa resta aperto, e di chi è

**Tue, e sono decisioni — non lavoro:**

1. **Il pizzico di cannella**: se il magazzino non scende per un tavolo, non
   deve scendere niente o quello che si può? E le spezie a pizzico le vuoi in
   magazzino?
2. **Le bevande in «cosa non è sceso dal magazzino»**: un vino è una riga del
   listino, non una voce sconosciuta. Deve smettere di comparire lì?
3. **La chiave dell'assistente sul progetto di prova**: il comando è in
   [`docs/collaudo/assistente_sulla_prova.md`](../collaudo/assistente_sulla_prova.md).
4. **Il push**, come sempre: quattro commit e una migrazione nuova, che entra
   in produzione solo dopo.

**Mie, dichiarate e non fatte:**

- il **conteggio dei campi da confermare** non è mostrato in nessuna
  schermata (la funzione c'è);
- **CLAUDE.md è fermo al 19/08**: la sezione «Chiuso di recente» non ha
  quattro giorni di lavoro. Non l'ho aggiornata stanotte perché nemmeno le
  tre sessioni precedenti l'hanno fatto, e mettere una voce sola darebbe
  l'impressione che le altre non esistano. ⚠️ Ma è il file che apre ogni
  sessione: **fermo al 19/08, chi ricomincia domani parte da quattro giorni
  fa.**

---

## 5 · Le regole che ho rispettato, dette una volta

- 🔴 **Il database vero non è stato toccato**, in nessun modo — nemmeno in
  lettura. Tutto è successo sul progetto di prova.
- **La migrazione nuova è applicata solo alla prova** (173 lì, 172 in
  produzione): in produzione entra col tuo push.
- **Un riepilogo per blocco, committato prima del successivo.** L'unica
  eccezione è dichiarata nel riepilogo della scala: scala e settori sono un
  commit solo, perché lo scenario è **un comando solo** e separarli avrebbe
  lasciato un commit che non gira.
