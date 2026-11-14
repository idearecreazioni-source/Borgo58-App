# Gli eventi si contano a parte (14/11/2026)

Commit sotto questa consegna: `29ce70f2`. Migrazione `20261114000002_gli_eventi_si_contano_a_parte`. Nessuna funzione online da installare.

## Perché
Decisione di Alessio, 14/11: **«gli eventi si contano con gli eventi, non con lo scontrino medio dei normali servizi»**.

La migrazione `20261113000008` (pezzo 5b) metteva le fatture senza tavolo dentro `misure_del_mese.ricavi`. Quel numero è la base dei «Ricavi di sala», e lo scontrino medio è ricavi diviso coperti: una fattura da 5.000 € per un evento alzava lo scontrino medio dei servizi normali senza un coperto in più. Il confronto col piano segnava «sopra il previsto» a torto.

## Cosa cambia
- `misure_del_mese.ricavi` torna a essere **i soli conti dei tavoli**, com'era prima del 13/11.
- Le fatture senza tavolo sono in due colonne nuove, `ricavi_eventi` e `eventi_quanti`, alla data della fattura e col totale.
- La pagina **Andamento mensile** mostra una riga «Eventi fatturati questo mese (N): … Si contano a parte».
- La funzione cambia le colonne che restituisce: eliminata e ricreata, permessi e commento rimessi.

## Cosa NON cambia, e come l'ho controllato
- **Il piano di previsione tiene gli eventi a parte da sempre**: `ricavi_sala` è coperti × scontrino, mentre gli eventi premium stanno in `ricavi_accessori`. Con questa migrazione la parte reale e la parte prevista sono omogenee.
- **Chi legge `misure_del_mese`**, tutti per nome di colonna, quindi la colonna in più non li rompe:
  - `chiudi_mese` e la sua versione che rifotografa (i mesi congelati);
  - `scostamento_mensile` e `stato_confronto_mensile` (scontrino medio);
  - `confronto_a_oggi` (andamento dell'anno);
  - il costo di un coperto nella Proiezione;
  - la chiusura dell'anno fiscale.
- **Imposte, IVA e Proiezione Fiscale non leggono questa funzione**: lavorano su `ricavi_non_fiscalizzati`, che guarda direttamente i conti dei tavoli. Spostare gli eventi non toglie niente a quei calcoli.
- Nessuna vista e nessuna prova citava la funzione: cambiarne le colonne è sicuro. La prova a secco su Prova lo ha confermato.

## ⚠️ Da sapere, non toccato
- Un mese già **congelato** (`consuntivi_mensili`) e il rapporto di **chiusura dell'anno** mostrano i ricavi di sala, come sempre, e **non** gli eventi: la tabella dei consuntivi non ha una colonna per gli eventi. Per ora gli eventi si vedono solo nel mese vivo, a parte.
- Se Alessio vuole gli eventi anche nei mesi congelati e nella chiusura dell'anno, serve una colonna nuova in `consuntivi_mensili` e una riga nel rapporto. È un lavoro a parte, e glielo si chiede.
- ⚠️ **Detto, non risolto**: le fatture senza tavolo non entrano nemmeno nei calcoli delle imposte e dell'IVA, che leggono solo i conti dei tavoli. Va guardato con Laura prima della prima fattura vera a un evento.

## Verifica dentro la migrazione (annullata, zero residui)
1. Una fattura senza tavolo uscita **non** tocca i ricavi di sala (né la loro origine): entra in `ricavi_eventi` col suo totale e nel conteggio.
2. Una bozza non conta da nessuna parte.
3. La fattura del conto di un tavolo non aggiunge niente a nessuna delle due.

## Su Prova (14/11)
- A secco, poi `prova:migra`: 487 migrazioni.
- Letti dal vivo dopo il cambio: i numeri del mese, il confronto col piano (4 righe) e il budget omaggi (1 riga).
- Nessun dato lasciato.

## Cosa abbiamo rovesciato
Niente di nuovo.

## Rilascio su work (solo col sì di Alessio)
La migrazione `20261114000002` e il sito (Approve). Nessuna funzione online.
