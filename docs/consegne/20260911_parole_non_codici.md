# Le parole, non i codici del database — 11/09/2026 (mandato notturno 2, fase 2)

Sola interfaccia. **Migrazioni**: nessuna. **Funzioni online**: nessuna.
**Database**: non toccato. **HEAD dichiarato**: vedi l'ultima riga.

Sei punti dove una schermata mostrava il valore tecnico del database al posto
della parola che la stessa schermata, o il database stesso, usa altrove.
Trovati dal censimento del mandato notturno 2 (testi e schermate aperte sul
progetto di prova) e verificati sul codice di master.

---

## Cosa cambia

| schermata | prima | adesso |
|---|---|---|
| Scheda ingrediente, «Non si può eliminare: compare in …» | `stock_lots (3), recipe_ingredients (2)…` (visto nel censimento) | «partite in magazzino (3), ricette (2)…» |
| Scheda ingrediente, storico prezzi, colonna «Fonte» | valore dell'enum `price_source` (`cessione_interna`) | «a mano», «fattura», «preventivo», «cessione interna» |
| Editor menu, elenco dei piatti | «(finger_food)» (visto nel censimento) | «(Finger food)» |
| Cantina, inventario, colonna «Mondo» | `vini`, `liquori` | il nome del menu («Liquori e distillati»); senza nome, la parola con la maiuscola |
| Prestiti, riga di un prestito | «· cassa» | «· contanti», come il modulo |
| Menu, piatto fuori stagione | «(stagione: tutto_anno…)» | i nomi di `SEASONS`, in minuscolo |

Due dettagli:
- `NOMI_TABELLE` in `IngredienteForm.jsx` è **lo stesso elenco** di
  `nome_leggibile()` nel database (migrazione `20260824000020`), che scrive il
  rifiuto quando si prova a cancellare. `usi_dell_ingrediente` restituisce i
  nomi tecnici e cambiarla vorrebbe dire una migrazione, fuori dal mandato. È
  quindi un secondo posto, dichiarato gemello nel commento. Una tabella che
  manca resta col suo nome: si vede, e si aggiunge.
- Nessun elenco nuovo in `constants.js`, quindi la rete dei vocabolari non
  cambia. Le parole stanno accanto alla schermata che le usa, e ogni valore
  sconosciuto resta leggibile invece di sparire.

## Come è stato verificato

- `tests/schermate/parole-non-codici.test.jsx` (Cantina, Prestiti): **rosse
  col codice di master** (rimessi i due file e rilanciate), verdi dopo.
- **Censimento sui dati veri del progetto di prova**, dopo la correzione.
  - Scheda ingrediente ed Editor menu, nelle 4 forme: **nessun codice** a
    schermo, mentre prima c'erano `recipe_ingredients shopping_list_items
    stock_consumptions stock_lots` e `finger_food`.
  - Cantina, Prestiti, scheda ingrediente e menu: tutte e 4 si aprono senza
    niente che sbordi o si sovrapponga, e senza nessuna scrittura.
  - Nella fotografia di Prestiti la riga dice «· contanti».
- **Fusione di prova** con #57, #58, #59, #60, #61 e #62: nessun conflitto.
- Lint pulito, compilazione riuscita.
- Prove pure **1295/1297**: le due rosse sono i fine riga di Windows, già
  note su master.
- Prove sulle schermate **134/134**. I due file a tempo, rilanciati da soli
  dopo l'ultimo commit, danno 12/12.

## Cosa NON è verificato

- Nel progetto di prova l'inventario della Cantina è vuoto, e non c'è una
  riga di storico con «cessione_interna»: quei due casi li prova solo la prova
  sulla schermata (Cantina) o nessuno (la fonte «cessione interna»).
- Non visto su un iPhone vero.

## Trovato e NON toccato (decisione di Alessio)

- **Editor menu, menu stampato**: le sezioni della stampa (`CATEGORY_ORDER`)
  sono antipasti, primi, secondi e dolci. I piatti **finger food** di un menu
  attivo compaiono nell'elenco ma **non hanno una sezione nel foglio
  stampato**. Se debbano averla, e dove, è una scelta del menu, non una
  correzione.

## Cosa abbiamo rovesciato

Niente.

---

**Hash di HEAD dichiarato**: `396283f` sul ramo `parole-non-codici`, cioè il
commit immediatamente sotto questo documento.
**Stato del working tree al momento della consegna**: pulito.
