# SPEC-0004 — Costo effettivo del progetto, società e tasca affiancate

| Campo | Valore |
|---|---|
| Stato | Bozza — in attesa di conferma di Alessio |
| Priorità | Da definire |
| Origine | Domanda di Alessio sulla registrazione delle spese, 05/09/2026 |
| Richieste correlate | [`C10`](../RICHIESTE.md) — la Tasca |
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

## Decisioni aperte

1. **Proposta nata dalla domanda di Alessio, da confermare:** il riepilogo
   affianca società, Tasca e totale effettivo; non nasconde la distinzione
   fra i due soggetti.
2. Quale periodo proporre all'apertura: mese corrente, anno corrente o scelta
   libera senza predefinito.
3. Il dettaglio deve essere solo per causale oppure anche riga per riga.
4. Dove deve vivere: Prima nota, Cassa, oppure una vista dedicata di riepilogo.
5. Priorità rispetto alle richieste aperte.

## Dipendenze

- Uscite della Tasca, soggetto separato, verso unico e causale Indeducibile.
- Uscite della società in Prima nota.
- Esclusione esplicita di rimborsi e anticipazioni dal totale per evitare
  doppie contabilizzazioni.

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
