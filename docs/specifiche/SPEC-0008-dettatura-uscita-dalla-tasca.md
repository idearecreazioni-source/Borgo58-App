# SPEC-0008 — Dettatura di un'uscita dalla Tasca

| Campo | Valore |
|---|---|
| Stato | Bozza — in attesa di conferma di Alessio |
| Priorità | Da definire |
| Origine | Domanda di Alessio sulla dettatura di una spesa personale, 05/09/2026 |
| Richieste correlate | [`C10`](../RICHIESTE.md) — la Tasca |
| Decisioni vigenti correlate | [`DECISIONI.md`](../DECISIONI.md), MEMO voce; La tasca di Alessio |

## Problema

MEMO riconosce un «movimento di cassa» con verso, importo, mezzo, causale e
descrizione, ma non riconosce il soggetto della Tasca. Una frase come «ho
speso 200 euro con soldi miei» può quindi predisporre una normale uscita di
Borgo 58 anziché una spesa della Tasca, che ha regole opposte su fiscalità e
rimborso.

## Obiettivo

Permettere una frase naturale e inequivocabile per registrare una spesa
personale non rimborsabile, predisponendo la Prima nota già sul soggetto
«La tasca di Alessio» e lasciando sempre ad Alessio la conferma del movimento.

## Fuori-scope

- Registrare una spesa della Tasca automaticamente senza conferma.
- Confondere la Tasca con l'anticipo rimborsabile alla società.
- Consentire entrate, banca, fattura o regole fiscali sulla Tasca.
- Deducibilità o valutazioni fiscali del documento associato.

## Decisioni aperte

1. **Proposta:** la frase «Segna [importo] euro dalla mia tasca per
   [descrizione]» seleziona in modo esplicito la Tasca.
2. Quali sinonimi accettare senza ambiguità: «con soldi miei», «li ho pagati
   io senza rimborso», «spesa personale per il progetto».
3. Se la frase nomina un rimborso, MEMO deve deviare al modulo Anticipo io,
   poi mi rimborso, oppure chiedere prima quale dei due casi sia.
4. Priorità rispetto alle richieste aperte.

## Dipendenze

- La via di uscita manuale della voce per i movimenti di denaro.
- Regola vigente: i movimenti di denaro passano sempre dalla conferma di
  Alessio.
- Regole della Tasca: una sola uscita, contante, Indeducibile, fuori dalla
  proiezione fiscale.

## Criteri di accettazione

- La frase proposta prepara una sola uscita con soggetto Tasca, importo e
  descrizione riportati fedelmente.
- Prima della conferma è visibile che non è un'uscita di Borgo 58 e che non
  sarà rimborsata né fiscale.
- MEMO non salva mai il movimento da solo.
- Una frase ambigua non sceglie il soggetto in silenzio: chiede quale caso è.
- La via manuale mostra la Tasca già selezionata e non permette scelte non
  compatibili.

## Collegamenti a decisioni vigenti

- Un movimento di cassa non si salva mai da solo: viene sempre controllato.
- La causale di una spesa dettata può mancare; il movimento non deve per questo
  sparire.
- La Tasca accetta solo uscite Indeducibili e non genera rimborso.

## Nota per il coordinamento

La frase suggerita non è ancora un comando disponibile. Dopo la conferma della
forma e dei sinonimi, la specifica va portata alla chat di coordinamento per
il mandato esecutivo e la verifica.
