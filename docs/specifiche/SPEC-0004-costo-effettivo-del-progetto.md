# SPEC-0004 — Costo effettivo del progetto, società e tasca affiancate

| Campo | Valore |
|---|---|
| Stato | Fatta — #121 unita, migrazione applicata al solo progetto di prova |
| Priorità | Alta — serve fino all'apertura di marzo 2027, poi decade |
| Origine | Domanda di Alessio sulla registrazione delle spese, 05/09/2026 |
| Richieste correlate | [`C11`](../RICHIESTE.md) — l'etichetta «investimento» · [`C10`](../RICHIESTE.md) — la Tasca |
| Decisioni vigenti correlate | [`DECISIONI.md`](../DECISIONI.md), sezione La tasca di Alessio |

## Problema

La Prima nota registra già le uscite della società e, quando si seleziona
«La mia tasca», mostra quanto Alessio ha speso con denaro proprio. I due
insiemi restano però separati: non esiste una vista che risponda alla domanda
gestionale «quanto è costato davvero il progetto», distinguendo senza
confondere ciò che ha pagato Borgo 58 e ciò che ha pagato Alessio.

## Obiettivo

Mostrare un riepilogo dei costi del progetto nel periodo scelto, con tre
numeri leggibili e separati:

1. uscite sostenute da Borgo 58;
2. uscite sostenute dalla Tasca di Alessio;
3. totale effettivo sostenuto per il progetto, dato dalla somma dei primi due.

La vista serve a governare il progetto, non a trasformare le uscite della
Tasca in costi fiscali della società o in somme da rimborsare.

## Fuori-scope

- Includere la Tasca nella proiezione o nelle dichiarazioni fiscali.
- Generare un debito della società verso Alessio o un rimborso.
- Sommare le anticipazioni rimborsabili: sono già spese della società e
  includerle di nuovo raddoppierebbe il costo.
- Decidere deducibilità, IVA o trattamento tributario di singole spese.

## Decisioni prese

⚠️ Le cinque voci di questa sezione erano aperte fino al 21/09/2026. Restano
scritte con la risposta accanto invece di sparire: *una decisione cancellata
non si distingue da una che non è mai stata posta.*

1. **Il riepilogo affianca società, Tasca e totale effettivo** — confermato da
   Alessio il 31/08/2026: *«un numero solo direbbe quanto è costato aprire
   nascondendo chi l'ha pagato»*.
2. **Il periodo di partenza è l'intera storia**, non il mese né l'anno
   corrente. La domanda è «quanto è costato il progetto», e vuol dire *da
   sempre*; i filtri Dal/Al servono a guardare un pezzo, non a decidere il
   totale di partenza. ⚠️ Si può fare senza rischio solo perché i totali
   arrivano da un'**aggregazione** del database, che il tetto delle mille righe
   non può tagliare.
3. **Il dettaglio è riga per riga**, non per causale: ogni riga porta data,
   descrizione, causale, mezzo, soggetto e importo — dati che esistono già,
   senza nessuna copia dei movimenti. ⚠️ Un raggruppamento per causale non
   permetterebbe di ricontrollare il totale voce per voce, e *un totale che non
   si può ricontrollare è un totale diverso, non uno più vero* (16/08).
4. **Vive dentro «Cassa, Banca e Prima Nota»** (`/cassa/costo-progetto`), non
   come modulo nuovo: la fonte è la Prima nota, e un modulo a sé farebbe
   credere che esista un secondo archivio delle spese. ⚠️ E serve fino a marzo
   2027: una voce nel menu principale sarebbe una cosa permanente per una
   domanda che scade.
5. **Priorità: fatta il 21-22/09/2026**, col mandato C11.

## Come si etichetta

🔴 **È un'etichetta manuale su un'uscita** (`cash_movements.e_investimento`),
non un secondo archivio: una sezione separata creerebbe due verità sulla stessa
spesa e andrebbe smontata dopo l'apertura, un'etichetta si smette solo di usare.

⚠️ **Niente è automatico**: nessuna regola deduce l'etichetta da data, causale,
importo, fattura o parole della descrizione, e tutte le righe scritte prima
nascono spente. Il quesito **L19** alla commercialista resta aperto e non è
anticipato da niente.

⚠️ **«In cosa» e «con quali soldi» non hanno campi nuovi**: la causale e la nota
dicono già in cosa, il mezzo e il soggetto dicono già con quali soldi.

## Dove vivono le regole

- **I due divieti sono nel database** (migrazione `20260921000003`): un vincolo
  `check` rende impossibile marcare un'entrata, e un trigger rifiuta un'uscita
  con una **causale di sistema**. Una regola nella schermata la aggira chiunque
  scriva da un'altra porta.
- **Chi entra nel totale vive in un posto solo**,
  [`src/lib/calcoli/investimento.js`](../../src/lib/calcoli/investimento.js), e
  guarda il **tipo stabile** del soggetto (`entity_type`), mai il nome
  visualizzato. Il database si limita ad aggregare per soggetto: se la stessa
  regola vivesse anche in SQL, sarebbe scritta due volte.

## Dipendenze

- Uscite della Tasca, soggetto separato, verso unico e causale Indeducibile.
- Uscite della società in Prima nota.
- Esclusione di rimborsi e anticipazioni dal totale. ⚠️ **Riconosciuti da una
  colonna, mai da una frase**: `cash_causali.di_sistema`, la stessa con cui
  `rettifiche_fiscali()` esclude dai costi ciò che non è un costo. Un'uscita
  con una causale di sistema non si può marcare, e il rifiuto dice perché.
  ⚠️ Conseguenza dichiarata: un investimento pagato con un'**anticipazione del
  socio** non entra in questo totale — la spesa vive in `anticipazioni_socio` e
  in prima nota compare solo il rimborso. La via normale è registrarla su
  Borgo 58 o sulla tasca, dove l'etichetta c'è.

## Criteri di accettazione

- Per lo stesso periodo si vedono separatamente i tre valori: società, Tasca,
  totale effettivo.
- Il totale effettivo coincide con la somma visibile delle due componenti.
- Le uscite della Tasca restano fuori da ogni dato fiscale e dalla proiezione.
- Un rimborso o un'anticipazione non fa crescere il costo effettivo due volte.
- Ogni totale offre un percorso al dettaglio che lo compone.

## Collegamenti a decisioni vigenti

- La Tasca registra soltanto uscite, tutte Indeducibili, e resta fuori dalla
  proiezione fiscale per costruzione.
- Le anticipazioni sono spese per conto della società da pareggiare; non sono
  la Tasca.

## Nota per il coordinamento

Prima del mandato esecutivo serve confermare la forma del riepilogo e le
scelte aperte. Questa specifica non modifica alcun conteggio esistente.
