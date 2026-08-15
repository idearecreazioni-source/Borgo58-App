# Consegna del 15/08/2026 (quinta) — la sezione personale del titolare

> ⚠️ **DOCUMENTO POSTUMO.** Questo riepilogo è stato scritto il 16/08/2026,
> **dopo** che i commit erano già stati pushati e la migrazione già
> applicata in produzione. È uno scostamento dalla regola di `CLAUDE.md`
> §2 — nessun push senza il riepilogo corrispondente — e **l'eccezione
> d'emergenza non si applica**: era lavoro nuovo, non un difetto che
> bloccava Alessio dal vivo. Rilevato dal validatore; la rete che impedisce
> il ripetersi è descritta in `20260816_i_riepiloghi_arretrati.md`.

**Commit coperti: `06f5152` e `17e4161`.**

| Commit | Cosa |
|---|---|
| `06f5152` | ho messo di tasca mia — migrazione `20260815000006` e il corridoio |
| `17e4161` | la schermata «Ho messo di tasca mia» |

**Applicata in produzione**: `20260815000006` (15/08, ore 21:35). **107
migrazioni**. `operazioni-atomiche` reinstallata (**v23 → v24**).

È il **Blocco 7 del mandato «personale e tesoreria»**.

⚠️ Questa consegna **non modifica** `docs/CONTRATTO.md`.

---

## 1. Cosa fa

Non è «lo spazio dei soldi personali di Alessio»: è il **registro dei
pagamenti che lui fa con fondi propri per conto della società**. Il suo
conto privato e le sue spese personali non entrano nel gestionale.

⚠️ **Il verso opposto — prendere dalla cassa per spese personali — è stato
escluso da Alessio nel mandato e non è stato costruito.** Non esiste
nessuna funzione che lo faccia, e non è una dimenticanza.

---

## 2. La cosa da capire prima di scrivere una riga

Quando paga di tasca sua nascono **due fatti distinti**:

1. la società ha una **spesa**;
2. la società ha un **debito verso di lui**.

Il rimborso chiude il secondo e **non è una seconda spesa**.

⚠️ Contarli entrambi come costo farebbe risultare la stessa cosa pagata
due volte, e le imposte stimate sarebbero più basse del vero. È la stessa
forma del doppio conteggio dei ricavi che Alessio ha chiuso il 15/08
decidendo che comandano i conti chiusi.

Quindi, **per costruzione**: l'anticipazione è il posto dove vive la
spesa; il pareggio genera un movimento con **causale di sistema**, che dal
Blocco 6 è già fuori dai costi. Nessun doppio conteggio, e non perché
qualcuno si ricordi di escluderlo — perché la causale lo è.

⚠️ **E c'è il caso opposto, che è quello che frega.** Se quella spesa ha
**già una fattura registrata**, il costo è contato lì e l'anticipazione è
soltanto il debito. Da qui il collegamento facoltativo alla fattura:
collegata, la riga non è un costo; scollegata, lo è, perché non è
registrata da nessun'altra parte.

---

## 3. Le altre scelte

- **Il tag è `not null`**, stessa ragione della causale di uno sconto
  (14/08): **i totali per tag sono la diagnosi**. Se «fornitore urgente»
  domina la classifica, il problema non sono le anticipazioni — è la cassa
  tenuta troppo scarica. Il vocabolario nasce **vuoto**.
- **Le tre eccezioni si comunicano da sole**: pagamento dal conto
  personale (nei registri la spesa risulterebbe pagata da un conto non
  della società), importo oltre la soglia, e nota ancora aperta a fine
  mese. Regola del mandato: *ciò che si chiude nel mese resta un
  promemoria, ciò che sopravvive al mese diventa formale da solo.*
- ⚠️ **La soglia nasce VUOTA**: è il quesito L10 e Alessio la fisserà con
  Laura. Un numero inventato deciderebbe al posto suo cosa è rilevante.
- ⚠️ **Il saldo dichiara di NON entrare nella previsione di cassa**: una
  nota aperta non ha una scadenza — il rimborso lo decide lui — e darle
  una data inventata sposterebbe il saldo previsto di una cifra che
  nessuno ha promesso.
- **Terza volta che il perimetro dei costi si allarga**, e come le altre
  due si fa nella stessa migrazione che lo cambia.

---

## 4. Verifica

| Cosa | Stato |
|---|---|
| la migrazione sul progetto di prova | **applicata quattro volte**: idempotente |
| il tag è obbligatorio, anche scrivendo in tabella | **respinto dal vincolo** |
| il saldo: quanto la società gli deve | **provato** |
| …e dichiara di restare fuori dalle uscite previste | **provato** |
| **una nota senza fattura è una spesa** | **provato** |
| **una nota collegata a una fattura NON aumenta i costi** | **provato** in migrazione e da fuori |
| il pareggio chiude la nota **e** fa uscire i soldi | **provato dal corridoio vero** |
| …e il rimborso **non** è una seconda spesa | **provato** |
| non si pareggia due volte | **respinto** |
| non si rimborsa più di quanto c'è in cassa | **respinto** |
| le tre eccezioni per la commercialista | **provate**, col motivo che nomina il conto personale |
| una nota chiusa dentro il mese **non** entra nel pacchetto | **provato** |
| i totali per tag | **provati** |
| lo staff respinto su saldo, eccezioni, totali e pareggio | **provato col token vero** |
| lo staff non vede né le note né i tag | **provato**, con righe vere che non deve vedere |
| prove automatiche | **85 verdi** (erano 80) |
| lint, build | puliti |
| **produzione** | **107 migrazioni**, corridoio **v24** |
| elenco anonimi · `security definer` senza portiere | **12** · **13**, invariati |
| residui in produzione | **zero**, controllati col connettore |
| avvisi partiti durante l'applicazione | **zero** |

**Un difetto trovato applicando**: un `case` che produceva `text` su una
colonna enum. Si sarebbe visto al primo rimborso vero.

**Una prova scritta male e corretta**: dava per scontata una fattura da
pagare che sul progetto di prova non esiste, quindi sarebbe stata rossa
per come è apparecchiato il database e non per un difetto. Ora legge lo
stato prima e verifica che il debito cali esattamente di quella nota.

---

## 5. Cosa NON è verificato

- ⚠️ **Nessuno ha usato la schermata.** I PIN sono di Alessio.
- **In produzione non c'è nessuna nota e nessun tag**: il vocabolario
  nasce vuoto per scelta, quindi la prima cosa che vedrà è la richiesta di
  creare un motivo.
- **La soglia per la commercialista non è impostata** e deve restare così
  finché non parla con Laura: vuol dire che quella delle tre eccezioni non
  è mai stata vista scattare con un valore vero.
- **Il collegamento a una fattura non è mai stato usato con una fattura
  vera**: in produzione non ce n'è nessuna da pagare.
