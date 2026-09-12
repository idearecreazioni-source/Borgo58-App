# Vocabolario, riga 9: «Caricamento…» o «Sto leggendo …» — 12/09/2026

Scelta di Alessio del 12/09 sulla tabella della PR #71. **Solo testo a
schermo**, nessuna logica. **Migrazioni**: nessuna. **Funzioni online**:
nessuna. **HEAD dichiarato**: vedi l'ultima riga.

## La regola

- **«Caricamento…»** quando si aspetta e basta.
- **«Sto leggendo …»** quando la frase dice cosa.
- Spariscono «Carico…», che in Magazzino e Scadenze si leggeva anche «carico
  di merce», e «Sto guardando…», che non diceva cosa.

## Cosa cambia — undici righe in undici file

| File | Prima | Adesso |
|---|---|---|
| `magazzino/Fermi.jsx` | «Carico…» | «Caricamento…» |
| `magazzino/Scadenze.jsx` | «Carico…» | «Caricamento…» |
| `menu-editor/BevandeVini.jsx` | «Carico…» | «Caricamento…» |
| `ricettario/SchedeProdotti.jsx` | «Carico…» | «Caricamento…» |
| `calendario/PreventiviList.jsx` | «Sto guardando…» | «Caricamento…» |
| `calendario/PreventivoDetail.jsx` | «Sto guardando…» | «Caricamento…» |
| `cassa/Prestiti.jsx` | «Sto guardando…» | «Caricamento…» |
| `comande/Scontrini.jsx` | «Sto guardando…» | «Caricamento…» |
| `components/ScattaFoto.jsx` (il pulsante mentre MEMO legge) | «Sto guardando…» | «Sto leggendo la foto…» |
| `assistente/Fotografa.jsx` («Quanto sta costando») | «Sto guardando…» | «Sto leggendo la spesa di MEMO…» |
| `assistente/Detta.jsx` (MEMO voce risponde a una domanda) | «Sto guardando…» | «Sto leggendo il gestionale…» |

Le altre forme «Sto leggendo …» già a schermo («Sto leggendo il documento…»,
«Sto leggendo la coda…») seguono già la regola e restano.

## Come è stato verificato

- Sostituzioni contate: ogni frase trovata esattamente una volta. Dopo, in
  `src` non compaiono più né «Carico…» né «Sto guardando».
- `oxlint` pulito sugli undici file. Nessuna prova in `tests/` cita queste
  frasi.
- `git merge-tree` con i rami di #57–#76 e con `vocabolario-persone-coperti`:
  nessun conflitto. Tre file li tocca anche una PR aperta, in altre righe:
  `Detta.jsx` (#57 e #58), `PreventivoDetail.jsx` (#57) e `Prestiti.jsx`
  (#63).

## Cosa NON è verificato

- Non misurato a schermo. Il pulsante della foto dice «Sto leggendo la
  foto…» invece di «Sto guardando…»: tre caratteri in più su un pulsante
  largo quanto lo schermo.

## Cosa abbiamo rovesciato

Niente.

---

**Hash di HEAD dichiarato**: `134c0f2` sul ramo `vocabolario-caricamento`,
cioè il commit immediatamente sotto questo documento.
**Stato del working tree al momento della consegna**: pulito (la cartella
della prova visiva locale è esclusa da git e non è committata).
