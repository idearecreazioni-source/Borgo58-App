# Vocabolario, riga 8: «giro» per la sala, «turno» per la cucina — 12/09/2026

Scelta di Alessio del 12/09 sulla tabella della PR #71. **Solo testo a
schermo**, nessuna logica. **Migrazioni**: nessuna. **Funzioni online**:
nessuna. **HEAD dichiarato**: vedi l'ultima riga.

## Perché

Nella legenda dei colori della sala la stessa fascia si chiamava «Primo giro»
nel titolo e «primo turno» nella spiegazione, e l'ultima «Ultimo turno».
Intanto in cucina «turno» vuol dire un'altra cosa, cioè l'uscita dei piatti.

## Cosa cambia — cinque frasi in tre file

| File | Prima | Adesso |
|---|---|---|
| `lib/calcoli/ritardo.js` (legenda della sala, anche in Comande) | «arrivano entro l'ora del primo **turno**» | «… del primo **giro**» |
| idem | fascia «Ultimo **turno**» | «Ultimo **giro**» |
| idem | «un primo giro e un ultimo **turno**» | «… un ultimo **giro**» |
| `calendario/PiantaGiornata.jsx` | «su questo tavolo c'è un altro **turno** dopo» | «… un altro **giro** dopo» |
| `calendario/SalaEOrari.jsx` | «Minuti fra un **turno** e l'altro» | «Minuti fra un **giro** e l'altro» |

Resta «turno» dove è della cucina: «Avanti col prossimo turno», «+ turno»,
«N° turno» sui biglietti.

Non cambiano:
- «ultimo ingresso» e «ultimi arrivi», che sono due ore diverse (decisione
  del 18/08);
- i nomi tecnici (la chiave `tardi`, le variabili di colore `b58-turno`);
- i commenti.

## Come è stato verificato

- Sostituzioni contate: ogni frase trovata esattamente una volta.
- `oxlint` pulito sui tre file. Nessuna prova in `tests/` cita queste frasi.
- Prove pure **1295/1297**: le due rosse sono i fine riga di Windows, rosse
  anche su master.
- `git merge-tree` con i rami di #57–#75: nessun conflitto. `SalaEOrari.jsx`
  lo tocca anche la #57, in altre righe.

## Cosa NON è verificato

- Non misurato a schermo: è solo testo, e le parole hanno la stessa
  lunghezza.

## Cosa abbiamo rovesciato

Niente.

---

**Hash di HEAD dichiarato**: `f6a1a0b` sul ramo `vocabolario-giro-turno`,
cioè il commit immediatamente sotto questo documento.
**Stato del working tree al momento della consegna**: pulito (la cartella
della prova visiva locale è esclusa da git e non è committata).
