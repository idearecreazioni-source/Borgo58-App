# Le ricette di esempio si tolgono

**25/10/2026** · decisione di Alessio (*«le 14 ricette le puoi togliere»*) · commit sotto questo riepilogo: `c1d9a1b` (la migrazione è in `0be1017`) · migrazione `20261025000021` · ramo `claude/project-thread-7v8uro`, proposta verso `slave` · working tree pulito al commit

## Cosa ha deciso

Alessio ha detto che le 14 ricette in produzione non sono sue ma esempi, e ha approvato l'elenco esatto che gli è stato mostrato: le 14 ricette, il menu «Carta di prova» che le contiene, e i 2 conti di prova che ne usano 6. Le sue 3 bozze (Crema Catalana allo Zafferano, Panna Cotta al Mandarino, Crema al Caffè simil Coppa del Nonno) **restano**.

## Cosa fa la migrazione

- **Perimetro per identificativo**, letto dalla produzione il 25/10 col connettore in sola lettura: 14 ricette, 1 menu, 2 conti (`c944b2fe…` T2 annullato del 05/09, `a4942b15…` T3 aperto dal 22/09). Mai un criterio come «tutte le ricette».
- **Guardiani, o tutto o niente**: i 17 identificativi devono esserci tutti; il menu deve contenere solo quelle ricette, e le ricette nessun altro menu; nessun altro conto le usa; le ricette non hanno ingredienti, passaggi, video, bozza, menu del giorno, preparazione, preventivo, produzione, trasformazioni o scelte sugli allergeni; i due conti non hanno pagamenti, scarichi, caparre o segnalazioni. Se una sola cosa è cambiata, si ferma senza cancellare niente.
- **Ordine**: prima i conti (le righe vanno via in cascata: col conto già sparito il trigger delle righe servite le lascia andare), poi il menu, poi le ricette.
- **Verifica dopo**: 2 conti e 14 ricette tolti, niente rimasto, numero delle bozze invariato, lapidi nuove = 2 + numero di righe dei conti.

## Misure in produzione prima (25/10, sola lettura)

`recipe_status_history` 28 righe, `menu_items` 14, `order_items` 7 (6 con una ricetta), `order_tables` 2. Tutte le altre tabelle con una chiave verso queste righe: 0. Le 3 bozze hanno `ricetta_id` vuoto. Lapidi attese: **9** (2 conti + 7 righe), perché `orders` e `order_items` sono nel registro delle cancellazioni; ricette, menu e storico di stato no.

## Allineamento con slave

Sopra `0be1017` il ramo ha ricevuto `origin/slave` (i ritocchi di forma, #208). Un conflitto solo, sul titolo di `BozzeList.jsx`: tenuto lo stile nuovo di slave e il nome «Bozze» chiesto da Alessio. Poi `npm run indice` (`c1d9a1b`), perché i due rami avevano aggiunto un rovesciamento ciascuno (105 e 106). Dopo l'unione: lint pulito, prove pure 2281/2281, prove delle schermate 443/443, build riuscita.

## Verifiche

- Lint, prove pure e build: invariati rispetto a `430b12b` (il commit aggiunge solo il file SQL).

## Cosa NON è verificato

- **Il ramo che cancella non è mai girato.** Sul progetto di prova quegli identificativi non esistono: lì la migrazione dice «niente da togliere» e non fa niente. L'unico posto dove cancella è la produzione.
- **Non è ancora stata lanciata nemmeno sul progetto di prova**: si fa dal computer di Alessio subito prima della produzione, dopo il merge.
- In produzione si applica solo dopo il merge su `master` (lo pretende `nonAncoraSuGitHub`), con una copia di sicurezza di meno di 24 ore, e i numeri veri si riportano dopo.

## Cosa abbiamo rovesciato

Niente.
