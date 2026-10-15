# Memo e i lavori da fare

**15/10/2026** · richiesta di Alessio · commit sotto questo riepilogo: `8d53f0d` · proposta #192 verso `slave`

## Cosa cambia

Prima: «mettilo tra i lavori da fare» detto a Memo creava l'impegno in **«Altro»**.
Dopo: il modello riempie `dati.categoria = "lavori"` e l'impegno finisce nella
sezione «Lavori da fare» dell'Agenda.

- `supabase/functions/ascolta-voce/index.ts`: il promemoria dichiara
  `"categoria": "lavori"|null`, con la regola che si riempie **solo se Alessio
  l'ha detto**. Non è il modello a decidere che cos'è un lavoro: una sezione
  riempita con cose scelte da lui smetterebbe di dire che cosa c'è da fare.
- `supabase/functions/ascolta-voce/agenda.ts`: stesso campo in
  `istruzioniAgenda()`. Le descrizioni del promemoria sono due, e se una sola
  lo conoscesse direbbero cose diverse.
- `tests/unita/agenda-a-voce.test.js`: tre prove (valore presente nel
  vocabolario `TASK_CATEGORIES`, campo nelle due descrizioni).

**Nessuna migrazione.** Il database accettava già il campo:
`fai_azione_dettata` (corpo in `20261011000002`) scrive
`coalesce(nullif(p_dati->>'categoria',''),'altro')`, e `categoria_task()`
(`20261015000001`) riconosce `lavori`. Un valore fuori elenco viene tradotto
in `altro`, quindi un errore del modello non rompe niente.

## Verifiche

- `npm test`: **141 file, 2235 prove verdi**. Lint: zero avvisi. Build: riuscita.
- Rottura: con `index.ts` riportato a `HEAD~1`, diventa rossa **solo** la prova
  sulle istruzioni generali (1 su 59).

## Cosa NON è verificato

- **Non provato con il modello vero.** Da questa sessione non si installa
  `ascolta-voce` sul progetto di prova (non ci sono chiavi). Se il modello
  rispetti la regola «solo se l'ha detto» non è stato misurato.
- La riga dell'appunto mostrerà «categoria: lavori» (`datiInChiaro` usa il nome
  del campo): non è stato guardato a schermo.
- Dopo l'unione la funzione va installata (`npm run funzione ascolta-voce -- --conferma`).
  Unire la modifica da sola non cambia il comportamento di Memo.

## Cosa abbiamo rovesciato

Niente.
