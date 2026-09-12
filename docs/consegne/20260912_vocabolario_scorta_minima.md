# Vocabolario, riga 3: «scorta minima» ovunque — 12/09/2026

Scelta di Alessio del 12/09 sulla tabella della PR #71. **Solo testo a
schermo**, nessuna logica. **Migrazioni**: nessuna. **Funzioni online**:
nessuna. **HEAD dichiarato**: vedi l'ultima riga.

## Perché

Il campo che si scrive nella scheda ingrediente si chiama «Scorta minima».
Sulle stesse schermate però comparivano «sotto soglia», «Soglia minima» e
«soglie minime», anche a una riga di distanza da «sotto scorta minima».

## Cosa cambia

| File | Prima | Adesso |
|---|---|---|
| `MagazzinoHome.jsx:181` | «Giacenze, soglie minime, scadenze.» | «Giacenze, scorte minime, scadenze.» |
| `MagazzinoHome.jsx:544` | segno sulla riga «sotto soglia» | «sotto scorta minima» |
| `MagazzinoHome.jsx:569` | etichetta «Soglia minima» | «Scorta minima» |
| `ListaSpesa.jsx:185` | «Nessun ingrediente sotto soglia da aggiungere.» | «… sotto scorta minima …» |
| `ListaSpesa.jsx:458` | segno sulla riga «sotto soglia» | «sotto scorta minima» |
| `Allineamento.jsx:130` | «nessun prodotto ha una scorta o una soglia.» | «nessun prodotto ha una giacenza o una scorta minima.» |
| `src/data/modules.js:44` | «…, soglie minime, …» | «…, scorte minime, …» |

In `Allineamento` «scorta» voleva dire la quantità in dispensa: diventa
«giacenza», la parola che la schermata usa già per quel numero.

Restano uguali:
- «soglia» dove vuol dire un'altra cosa: temperature HACCP, coperti a
  serata, orari in Sala e orari, regime delle mance;
- i commenti nel codice;
- i nomi tecnici (`soglia_minima`, `sottoSoglia`, `numeri.soglia`).

## Come è stato verificato

- Sostituzioni fatte con uno strumento che conta le occorrenze e non tocca un
  file se il numero non torna. Al primo giro si è fermato su due file:
  «sotto soglia» compariva anche in un commento. Rifatto prendendo la sola
  riga visibile.
- Dopo: nessun «soglia» visibile nei quattro file. Restano solo un valore
  tecnico (`"soglia_minima"`) e i commenti.
- `oxlint` pulito sui quattro file.
- `git merge-tree` con i rami di #57–#73: nessun conflitto. `ListaSpesa.jsx`
  lo tocca anche la #65 (righe 580-586), `modules.js` la #60 (riga 24):
  righe lontane.
- Nessuna prova sulle schermate cita queste frasi. Le prove sul database
  usano «sotto soglia» solo nei titoli e nei commenti.

## Cosa NON è verificato

- Non misurato a schermo. È solo testo, ma il segno sulla riga del
  Magazzino e della Lista della spesa diventa più lungo di 7 caratteri, e
  sul telefono può andare a capo.

## Cosa abbiamo rovesciato

Niente.

---

**Hash di HEAD dichiarato**: `a5db9ad` sul ramo `vocabolario-scorta-minima`,
cioè il commit immediatamente sotto questo documento.
**Stato del working tree al momento della consegna**: pulito (la cartella
della prova visiva locale è esclusa da git e non è committata).
