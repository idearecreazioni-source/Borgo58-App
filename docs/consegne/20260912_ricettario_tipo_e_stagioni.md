# Ricettario: una preparazione non è un piatto, e «Tutto l'anno» è l'alternativa — 12/09/2026 (mandato notturno, blocco A)

Sola interfaccia. **Migrazioni**: nessuna. **Funzioni online**: nessuna.
**Database**: né letto né scritto (la lettura in sola lettura dei casi storici
è stata negata in questa sessione, vedi sotto). **Dipende dalla #69**
(`finger-food-non-spariscono`, `c3784e5`) e non la modifica. **HEAD
dichiarato**: `2193f8b`, il commit sotto questo riepilogo.

---

## Le differenze fra i quattro tipi, verificate sul codice

| | ingrediente | preparazione | finger | piatto (e selezione) |
|---|---|---|---|---|
| può stare in un menu | no | **no** (DB, 20/08) | **no** (DB, 20/08) | sì (la selezione no, #69) |
| stati mostrati prima | — | i 4 del piatto | i 4 del piatto | 4 |
| stati mostrati adesso | — | In sviluppo · **Pronta per l'uso** · Ritirata | come la preparazione | invariati |
| «Descrizione per il menu» | — | **«Nota interna»** | **«Nota interna»** | invariata |
| stagionalità | 12 mesi + «Tutto l'anno» | 4 stagioni + «Tutto l'anno» | come la preparazione | come la preparazione (la selezione non ce l'ha) |

Trovate e **non** cambiate, perché sono numeri e non parole (vedi «Decisioni»):
- sulla scheda di una preparazione il costo si legge «… € **/ porzione**» e
  sotto «totale ricetta base» con lo stesso numero (le porzioni di un
  componente sono 1);
- la scheda dello staff diceva «1 porzioni» su un componente: **tolto**.

## Cosa cambia

1. **Stati per tipo** (`constants.js`: `STATI_COMPONENTE`, `statiPerTipo`,
   `statoPerTipo`, `etichettaStato`). Stesse colonne (`pronta_per_carta`,
   `ritirata_il`): una preparazione già segnata pronta si legge «Pronta per
   l'uso» senza riscrivere niente. Applicato alla scheda (striscia, etichetta,
   storico, riquadro «Bloccato apposta»), all'elenco (cartellini e filtro, che
   si azzera se lo stato scelto non esiste nella porta nuova) e alla frase di
   MEMO sullo stato (`domande.js`). Un tipo sconosciuto si legge come prima.
2. **Caso storico**: un componente con `in_carta` vero (possibile solo da prima
   del 20/08) si legge «Pronta per l'uso»; il riquadro «Bloccato apposta» dice
   che la voce è rimasta in un menu e offre «Togli da «…» e sblocca». Nessuna
   scrittura parte da sola.
3. **«Nota interna»** su preparazione e finger: stesso campo
   `menu_description`, testo conservato e salvato uguale.
4. **Stagioni delle ricette** (`stagionalita.js`: `stagioniDopoIlTocco`,
   `stagioneAccesa`, `stagioniNormalizzate`), con `aria-pressed`. Dati misti:
   a schermo solo «Tutto l'anno», normalizzati solo al salvataggio.
5. **Mesi dell'ingrediente** (commit a sé, `2193f8b`): stessa regola.

## Come è stato verificato

- `tests/schermate/ricetta-tipo-e-stagioni.test.jsx`, 13 casi: **9 rossi sul
  codice di prima per il comportamento**, 4 verdi che non devono cambiare;
  verdi tutti dopo.
- `tests/unita/stati-per-tipo.test.js` (5), `stagionalita.test.js` (6 nuovi
  sulle stagioni, 2 riscritti sui mesi).
- Tutte: prove pure **1307 verdi**, 2 rosse già rosse sul ramo di partenza
  (`indice-richieste`, e `indice-rovesciamenti` che questo lavoro rimette
  verde); schermate **153 verdi** (due scadenze a 5 s sotto carico, verdi
  rilanciate da sole due volte); lint zero; compilazione riuscita.
- **Prova visiva senza nessun server** (strumento di sessione, fuori dal
  repository: Vite senza porta, Chrome pilotato da un tubo, le richieste
  servite da Chrome stesso), dati finti: scheda ricetta in 6 casi e scheda
  ingrediente in 2 casi, a iPhone 390, iPhone 440, iPhone 390 a 64 punti per
  cm («caratteri grandi»), computer 1280. **32 pagine su 32** aperte, sbordo
  zero ovunque; il gesto «Tutto l'anno» → «Inverno» (ricetta) e «Ago» → «Tutto
  l'anno» (ingrediente) dà il risultato atteso in tutte le forme.

## Cosa NON è verificato

- **Safari su un iPhone vero**: la prova è Chrome.
- **Quante preparazioni o finger hanno davvero `in_carta` vero o stati «da
  piatto» nei due database**: non misurato (lettura negata).
- Il gesto con un dito vero, e i colori con la luce del locale.

## Decisioni che restano ad Alessio

1. Il costo «/ porzione» su una preparazione: resta, o si scrive per unità di
   resa?
2. Quattro stagioni accese devono diventare «Tutto l'anno» come i dodici mesi?
   Oggi no.

## Cosa abbiamo rovesciato

1. **Cosa era stato deciso e quando.** 29/08, decisione di Alessio: togliendo
   un mese da «tutto l'anno» restano undici mesi accesi; con «tutto l'anno» si
   vedono accesi anche i dodici mesi.
2. **La ragione di allora.** «Tutto l'anno meno agosto» in un tocco.
3. **Cosa si decide adesso.** «Tutto l'anno» è l'alternativa ai mesi, come alle
   stagioni delle ricette (mandato del 12/09).
4. **Vale ancora, e questo è il prezzo**: «tutto l'anno meno agosto» si fa con
   undici tocchi. Voce 91 in `docs/decisioni_rovesciate.md`; commit a sé.
