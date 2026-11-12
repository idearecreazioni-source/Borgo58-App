# I piccoli accostati fanno quattro (12/11/2026)

Migrazione `20261112000006_i_piccoli_accostati_fanno_quattro`. Decisione del proprietario: con la sala nuova due tavoli piccoli (70x80, 2 posti) accostati contano **4 coperti**, non 2. Le sedie stanno sui lati corti e accostare i tavoli non ne toglie.

## Cosa succedeva
`coperti_del_giorno()` calcolava, per ogni gruppo di tavoli accostati, «somma dei posti meno 2 per ogni giunzione». Con due piccoli: 2 + 2 − 2 = 2, cioè si perdevano due posti che in sala ci sono.

## La regola
Coperti di un tavolone = somma dei coperti dei suoi tavoli **meno `posti_persi_per_giunzione` per ogni giunzione**. Il numero è del formato, in una nuova colonna di `formati_tavolo` (si cambia da dato, non da migrazione):

| Formato | Posti persi per giunzione | Esempio |
|---|---|---|
| Piccolo 70x80 | **0** | 2 piccoli = 4, 3 in fila = 6, N in fila = 2·N |
| Grande 160x80 (e ogni altro formato) | 2, come prima | 2 grandi = 6 |

## Cosa cambia e cosa no
- Cambia solo il conteggio dei piccoli accostati. Nella sala di oggi: le 4 coppie (T3-T4, T5-T6, T8-T9, T11-T12) passano da 2 a 4 coperti, quindi la capienza con la sala «a coppie» sale di 8.
- **Grandi, divani e formati vecchi: invariati** (default 2, i divani non si accostano).
- Le correzioni a mano restano e vincono sempre sul calcolato.
- Nessun altro chiamante da toccare: `posto_per_la_serata()` e la pianta leggono `coperti_del_giorno()`.
- Nessuna guardia a lista chiusa nuova o cambiata: vocabolari e GUARDIE_ESENTI non si toccano.

## Controlli
- Verifica dentro la migrazione: piccolo a 0, grande a 2, ogni coppia di piccoli della sala fa 4.
- Prove pure: `tests/unita/coperti-giunzioni.test.js` (specchio `copertiCalcolati()` in `src/lib/calcoli/sala.js`, più la forma della migrazione).
- Prove sui dati veri (`tests/app/coperti-sala.test.js`) aggiornate alla regola nuova.

## Da fare al rilascio
Applicare la migrazione su Prova, poi su work (con l'ok di Alessio). Non ancora applicata.
