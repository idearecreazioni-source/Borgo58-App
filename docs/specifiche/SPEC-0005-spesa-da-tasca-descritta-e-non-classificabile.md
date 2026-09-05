# SPEC-0005 — Spesa dalla Tasca descritta e non classificabile

| Campo | Valore |
|---|---|
| Stato | Bozza — correzione di una decisione già vigente |
| Priorità | Da definire |
| Origine | Osservazione di Alessio sulla Prima nota, 05/09/2026 |
| Richieste correlate | [`C10`](../RICHIESTE.md) — la Tasca |
| Decisioni vigenti correlate | [`DECISIONI.md`](../DECISIONI.md), sezione La tasca di Alessio |

## Problema

Nella Prima nota della Tasca il campo che descrive la spesa è chiamato
«Finalità aziendale (opz., utile in verifica)»: non si capisce subito che è
il posto dove scrivere cosa è stato pagato, ad esempio un abbonamento AI.

Inoltre la schermata mostra una causale selezionabile come «Altra uscita».
Questo contraddice la decisione vigente: dalla Tasca deve essere possibile
solo «Indeducibile». Il database la impone comunque, ma l'interfaccia offre
una scelta che non può essere rispettata.

## Obiettivo

Rendere immediata la registrazione di una spesa personale per il progetto:
importo, data e una descrizione leggibile del motivo. Nella Tasca la causale
deve risultare fissa e dichiarata «Indeducibile», senza menu né possibilità di
selezionare una classificazione diversa.

## Fuori-scope

- Rendere le spese della Tasca deducibili o fiscali.
- Creare categorie fiscali nuove per ogni servizio o abbonamento.
- Trasformare la Tasca in un'anticipazione rimborsabile.
- Cambiare le causali disponibili per Borgo 58 o altri soggetti.

## Decisioni aperte

1. **Proposta nata dall'osservazione di Alessio, da confermare:** nella Tasca
   il campo si chiama «Descrizione della spesa» e porta un esempio concreto,
   ad esempio «Abbonamento AI — nome del servizio, mese».
2. Per una spesa ricorrente, la descrizione deve includere obbligatoriamente
   il mese oppure resta libera.
3. Priorità rispetto alle altre richieste aperte.

## Dipendenze

- Decisione vigente: la Tasca accetta solo uscite e solo Indeducibile.
- Il campo esistente `business_purpose`, già presente anche nell'esportazione
  della Prima nota, come descrizione del motivo della spesa.

## Criteri di accettazione

- Con soggetto «La tasca di Alessio», il campo descrittivo è riconoscibile
  senza dover interpretare il linguaggio fiscale.
- Una spesa AI può essere registrata con importo, data e descrizione in un
  solo passaggio.
- La causale visibile è «Indeducibile», fissa e non modificabile.
- Il salvataggio conserva la descrizione e la mostra nel dettaglio e
  nell'esportazione.
- Nessuna uscita della Tasca entra nei calcoli fiscali o della società.

## Collegamenti a decisioni vigenti

- La Tasca registra solo uscite, mai entrate.
- Dalla Tasca è ammessa esclusivamente la regola Indeducibile, imposta dal
  database.
- La Tasca resta fuori dalla proiezione fiscale per costruzione.

## Nota per il coordinamento

La causale selezionabile è un difetto rispetto a una decisione esistente;
questa bozza non ne cambia il significato. Dopo la conferma della forma del
campo descrittivo e della priorità, va portata alla chat di coordinamento per
il mandato esecutivo e la verifica.
