# SPEC-0006 — Prima nota: prima il motivo, poi il movimento

| Campo | Valore |
|---|---|
| Stato | Bozza — in attesa di conferma di Alessio |
| Priorità | Da definire |
| Origine | Osservazione di Alessio sulla Prima nota, 05/09/2026 |
| Richieste correlate | [`C2`](../RICHIESTE.md) — caricamento estratto conto; [`C10`](../RICHIESTE.md) — Tasca |
| Decisioni vigenti correlate | [`DECISIONI.md`](../DECISIONI.md), Cassa e tesoreria; La tasca di Alessio |

## Problema

Nella Prima nota la descrizione della spesa è dopo importo, data, causale e
tipo documento. Per chi registra un fatto vero, il primo dato è invece
«perché sono entrati o usciti questi soldi».

Le causali manuali sono troppo generiche per leggere costi ricorrenti come gli
abbonamenti AI, mentre il menu dell'entrata non chiarisce quali entrate vadano
registrate qui e quali arrivino già da altri moduli. Infine, scegliendo Banca,
il campo disponibile continua a chiamarsi «Rif. documento» anziché chiedere
un riferimento del movimento bancario.

## Obiettivo

Rendere la Prima nota un registro comprensibile di fatti economici:

- la descrizione è il primo campo del movimento;
- le causali raccolgono insiemi confrontabili, senza sostituire la descrizione;
- entrate e uscite indicano chiaramente cosa si registra qui e cosa arriva già
  da Comande, Fatture o Prestiti;
- un movimento bancario può portare un riferimento bancario leggibile.

## Fuori-scope

- Reinserire manualmente gli incassi di pranzi e cene, già prodotti da
  Comande.
- Registrare manualmente un prestito o una sua restituzione: hanno il modulo
  Prestiti e causali di sistema proprie.
- Collegare automaticamente l'estratto conto, che attende la scelta della
  banca.
- Sostituire una fattura o un documento con una riga di Prima nota.

## Decisioni aperte

1. **Proposta nata dall'osservazione di Alessio, da confermare:**
   «Descrizione della spesa/entrata» è il primo campo visibile, prima di
   importo, data e causale.
2. Quali causali permanenti servono davvero per le uscite. Una candidata è
   «Servizi digitali e abbonamenti» per gli abbonamenti AI; la descrizione
   mantiene servizio e periodo.
3. Quali entrate manuali devono essere offerte: versamento titolare/fondo
   cassa, rimborso o storno, interessi bancari, contributo; le vendite e i
   prestiti restano fuori da questa scelta.
4. **Proposta:** quando il mezzo è Banca, il campo cambia in «Riferimento
   movimento bancario», con esempi come CRO, identificativo dell'operazione o
   riga dell'estratto conto. Con Contante conserva il nome «Rif. documento».
5. Priorità rispetto alle richieste aperte.

## Dipendenze

- Causali modificabili dal titolare in Cassa → Causali, con alcune causali di
  sistema non selezionabili manualmente.
- Regola: gli incassi della sala arrivano già dalle Comande.
- Modulo Prestiti per finanziamenti e restituzioni.
- Scelta della banca prima di qualunque import automatico dell'estratto conto.

## Criteri di accettazione

- Inserendo una spesa AI, il primo campo chiede una descrizione e la conserva
  nel dettaglio e nell'esportazione.
- La causale «Servizi digitali e abbonamenti», se approvata, è disponibile per
  le uscite della società ma non è usata per i movimenti della Tasca.
- La sezione Entrata spiega quali fatti manuali accetta e non offre gli
  incassi di sala né i prestiti come voci generiche.
- Se si seleziona Banca, il campo di riferimento parla del movimento bancario;
  se si seleziona Contante, conserva il riferimento al documento.
- Senza un conto bancario configurato, la scelta Banca indica chiaramente la
  strada necessaria invece di sembrare un collegamento all'estratto conto.

## Collegamenti a decisioni vigenti

- La causale di un movimento dettato può essere facoltativa: non deve impedire
  di registrare l'uscita.
- I prestiti usano causali di sistema proprie e non sono ricavi o costi.
- La Tasca accetta solo uscite Indeducibili e resta fuori dalla fiscalità.

## Nota per il coordinamento

Prima di un mandato esecutivo Alessio deve confermare l'ordine dei campi,
l'elenco delle nuove causali e delle entrate manuali. La specifica non attiva
collegamenti bancari né modifica movimenti esistenti.
