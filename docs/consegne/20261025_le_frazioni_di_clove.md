# Le frazioni di Clove — riepilogo di consegna (25/10/2026)

**HEAD sotto questo riepilogo:** `7a0e655` · working tree pulito · ramo `claude/project-thread-2650tq`. **Nessuna migrazione, nessuna funzione online.**

## Cosa
- Causa misurata scaricando la pagina vera: `recipeIngredient` contiene `"1⁄2 litro latte"` con U+2044 (barra delle frazioni). `NUMERO` in `src/lib/calcoli/ricettaDaTesto.js` conosce solo `/`, quindi trovava due numeri → quantità vuota + buco «più di un numero».
- `frazioniNormalizzate()`: U+2044 e U+2215 → `/`; i caratteri `½ ⅓ ⅔ ¼ ¾ …` → `1/2` ecc.; `1½` → `1 1/2` (resta buco, regola esistente sui numeri misti). Applicata solo alla riga d'ingrediente, `testo_originale` invariato.
- Unità: `millilitro/i`, `centilitro/i`, `decilitro/i`, `milligrammo/i`, `cc` → l/g; `hg/etto/etti` → 0,1 kg. Conversioni esatte, non stime.
- «tuorli» → «tuorlo d'uovo»: **non è del lettore**, è il nome pulito proposto dall'assistente (`proposte.ts`). Non toccato.

## Verifica
- `npm test`: 141 file, 2239 prove verdi. Lint pulito, build riuscita.
- Controprova: tolta la chiamata a `frazioniNormalizzate`, diventano rosse 3 prove su 4 nuove (quella delle unità resta verde, giustamente).
- Produzione, sola lettura: `bozze_ricetta_ingredienti` con quei caratteri → **1 riga** («Crema Catalana Allo Zafferano», `1⁄2 litro latte`, quantità vuota).

## Cosa NON è verificato
- Nessuna schermata aperta: la funzione è pura, provata da vitest. Non ho importato di nuovo la ricetta dal gestionale.

## Cosa abbiamo rovesciato
Niente. La regola «un numero misto è un buco» resta intera, anche per `1½`.
