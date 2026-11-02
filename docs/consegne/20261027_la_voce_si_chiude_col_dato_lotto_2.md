# La voce si chiude col dato: magazzino, HACCP e lista della spesa — 27/10/2026 (notte)

**HEAD dichiarato sotto questo riepilogo:** `8a238ed`, sul ramo `claude/voce-lotto-2` aperto da `origin/slave` `2dd7cae`. Due commit: `6c5b4dc` (gemelle e schermate) e `8a238ed` (verifica più stretta e prove). Working tree pulito.
**Migrazione `20261027000001_la_voce_si_chiude_col_dato_magazzino_e_haccp` e `operazioni-atomiche` (versione 47 → 48): applicate SOLO al progetto di prova.** Produzione non toccata.

## Origine
È il secondo lotto della correzione B4 della voce (piano P0.1), lavoro notturno autorizzato da Alessio il 26/10. Il primo lotto (Prima nota e Spesa spicciola, `20261026000002`) è in produzione da stanotte.

## Cosa cambia
- **Sei gemelle `_da_voce`.** Chiudono la cosa detta (`chiudi_azione_dalla_schermata`) e chiamano la funzione di sempre nella stessa transazione:
  - consumo e merce buttata;
  - allineamento della giacenza;
  - carico merce;
  - temperatura;
  - pulizia;
  - lista della spesa.
- **Funzioni di sempre e firme invariate.** Senza voce le schermate chiamano quelle.
- **«Solo se è il prodotto, il frigo o il compito che aveva detto» resta alla schermata**, che passa l'id solo in quel caso, come prima.
- **Il carico con la voce passa dal corridoio** invece che dalla RPC diretta.
- **Restano col vecchio giro** Agenda, Ricette e Ingredienti (terzo lotto).

## Verificato
- `npx oxlint`: zero avvisi.
- Prove pure verdi, salvo le 3 già note per gli a capo CRLF.
- Prove di schermata: 448 verdi.
- Nuove prove pure: `voce-chiusa-col-dato` (17), le otto schermate convertite e le otto operazioni.
- **Progetto di prova:**
  - migrazione applicata e riapplicata, verifica superata con zero residui;
  - corridoio installato;
  - `npm run test:app` su `voce-chiusa-col-dato-lotto2` (nuovo), `voce-chiusa-col-dato`, `migrazioni-senza-portieri`, `scritture-dal-corridoio` e `uscita-a-mano`: 16 verdi.
- **Revisione `ecc:code-reviewer`:** argomenti nell'ordine giusto, percorsi uguali ad `azione_percorso()`, nessuna regressione senza voce. Il rilievo medio (la verifica contava anche rifiuti per altri motivi) è accolto.

## Non verificato
- **Consumo, giacenza e carico dal client vero con merce in magazzino:** la migrazione li prova sul rifiuto, le prove sull'app sulle altre tre.
- **Le schermate aperte a mano.**

## Decisione che spetta ad Alessio
- Lo stesso comportamento nuovo del primo lotto: se la cosa detta era già finita, il salvataggio viene rifiutato con un messaggio, invece di scrivere una seconda volta.

## Dato per fatto senza misurarlo
- Nulla.

## Affermazioni diventate false durante il lavoro
- Nessuna.

## Cosa abbiamo rovesciato
- **Deciso il 23/08 per la pulizia:** «insert diretto, una tabella, la RLS come barriera».
- **La ragione di allora:** nessuna conseguenza altrove.
- **Cosa si decide adesso:** con la voce passa dal corridoio.
- **Perché:** la ragione di allora vale ancora senza voce, che non cambia. Con la voce la conseguenza altrove c'è, ed è la cosa detta da chiudere. È la stessa forma della voce 109 di `docs/decisioni_rovesciate.md`, che la copre.
