# Ricettario: la preparazione non è un piatto, e «Tutto l'anno» — 12/09/2026 (mandato notturno, blocco A, con le correzioni di Alessio)

Sola interfaccia. **Migrazioni**: nessuna. **Funzioni online**: nessuna.
**Database**: né letto né scritto (la lettura in sola lettura dei casi storici
è stata negata in questa sessione). **Dipende dalla #69**
(`finger-food-non-spariscono`, `c3784e5`) e non la modifica. **Ramo solo
locale**, mai spinto. **HEAD dichiarato**: `232d45f`, il commit sotto questo
riepilogo.

⚠️ **Seconda stesura.** La prima (`0bbc0e1`, HEAD `2193f8b`) trattava i finger
come le preparazioni e cambiava la regola dei mesi dell'ingrediente. Alessio
l'ha corretta lo stesso giorno; i commit `63e83f4` (annulla i mesi) e
`232d45f` (il resto) stanno sopra, e la storia resta leggibile.

---

## Le differenze fra i tipi, adesso

| | ingrediente | preparazione | finger | piatto e selezione |
|---|---|---|---|---|
| stati | — | **In sviluppo · Pronta per l'uso · Ritirata** | i 4 del piatto | i 4 del piatto |
| testo | — | **«Nota interna»** (stesso campo) | «Descrizione per il menu» | «Descrizione per il menu» |
| costo in testata | — | **€ per unità di resa** (€/kg, €/l…) + totale della preparazione | a porzione | a porzione |
| stagioni | 12 mesi, **regola del 29/08 invariata** | 4 + «Tutto l'anno», alternativi | come la preparazione | come la preparazione (la selezione non ce l'ha) |

## Cosa cambia

1. **Stati**: solo `recipe_type = "preparazione"` ha `STATI_PREPARAZIONE`
   (`constants.js`: `statiPerTipo`, `statoPerTipo`, `etichettaStato`). Stesse
   colonne del piatto: niente si riscrive. Un tipo sconosciuto si legge da
   piatto. Scheda (striscia, etichetta, storico, riquadro «Bloccato apposta»),
   elenco (cartellini e filtro, che si azzera se lo stato scelto non esiste
   nella porta nuova) e frase di MEMO sullo stato (`domande.js`).
2. **Caso storico**: una preparazione con `in_carta` vero (possibile solo da
   prima del 20/08) si legge «Pronta per l'uso»; il riquadro «Bloccato
   apposta» dice che è rimasta in un menu e offre «Togli da «…» e sblocca».
   Nessuna scrittura parte da sola.
3. **«Nota interna»** sulla preparazione: stesso campo `menu_description`,
   testo conservato.
4. **Costo per unità di resa** (`costoPerUnitaDiResa` in `tipoRicetta.js`):
   totale di una dose ÷ resa, la stessa divisione che il database fa quando la
   preparazione entra in un'altra ricetta; senza resa «—», mai zero. Sotto
   resta il totale («totale della preparazione»).
5. **Stagioni delle ricette** (`stagionalita.js`): «Tutto l'anno» spegne le
   stagioni, una stagione spegne «Tutto l'anno»; **quattro stagioni si mostrano
   e si salvano come «Tutto l'anno»**; dati misti a schermo mostrano solo
   «Tutto l'anno» e si normalizzano solo al salvataggio.
6. **Scheda dello staff**: stagioni come sopra; niente «1 porzioni» sulla
   preparazione.

## Come è stato verificato

- `tests/schermate/ricetta-tipo-e-stagioni.test.jsx` (18 casi),
  `tests/unita/stati-per-tipo.test.js` (8), `stagionalita.test.js`.
  **Controprova**: le prove nuove girate sulla versione di stanotte
  (`0bbc0e1`, in una copia temporanea già tolta) danno **5 rosse** sulla
  schermata (finger da piatto, costo al litro, descrizione del finger, quattro
  stagioni ×2) e le prove sui mesi rosse come atteso; sul codice corretto
  tutte verdi. Le prove della #69 sui finger food verdi.
- Lint zero, compilazione riuscita; prove pure e schermate come nella prima
  stesura (le due già rosse sul ramo di partenza e le due scadenze sotto
  carico restano quelle, vedi il riepilogo del blocco C).
- **Prova visiva senza nessun server** (Vite senza porta, Chrome pilotato da
  un tubo, dati finti), a iPhone 390, iPhone 440, iPhone 390 a 64 punti per cm
  («caratteri grandi»), computer 1280: vedi i numeri nel riepilogo in chat.

## Cosa NON è verificato

- Safari su un iPhone vero; il gesto con un dito vero.
- Quante preparazioni hanno davvero `in_carta` vero nei due database: non
  misurato (lettura negata).

## Decisioni di Alessio applicate (12/09)

- Stati diversi solo per la preparazione; finger e selezioni da piatto.
- Mesi dell'ingrediente: resta la regola del 29/08.
- Costo della preparazione per unità di resa, totale visibile.
- Quattro stagioni = «Tutto l'anno».

## Cosa abbiamo rovesciato

Nessun rovesciamento in questo giro. (La prima stesura ne proponeva uno, sui
mesi dell'ingrediente: Alessio l'ha respinto e il commit è annullato.)
