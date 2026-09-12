# Un finger food non entra in un menu dove poi sparirebbe — 12/09/2026 (mandato esteso, priorità 1 B)

Sola interfaccia. **Migrazioni**: nessuna. **Funzioni online**: nessuna.
**Database**: non toccato (solo letture, vedi sotto). **HEAD dichiarato**: vedi
l'ultima riga.

---

## Il percorso, misurato sul codice

1. **Inserimento.** Un piatto di finger food (`recipe_type = piatto_finito`,
   `category = finger_food`) si metteva in un menu dalla sua scheda:
   `RicettaDetail`, pannello «Nei menu», `cambiaMenu` → `addMenuItem(…,
   { category: recipe.category })`. Da `MenuDetail` invece no: i candidati
   sono filtrati per le quattro sezioni.
2. **Scheda del menu.** `MenuDetail` raggruppa in `{ antipasto, primo,
   secondo, dolce }` con `map[i.category]?.push(i)`: una voce finger food
   **non compare in nessuna sezione**, e non conta nel riepilogo.
3. **Menu stampato.** `EditorMenuHome` stampa solo le sezioni di
   `CATEGORY_ORDER` (le stesse quattro). La voce resta nell'elenco «Cosa
   lascio fuori» ma **non esce sul foglio**.
4. **In sala invece si vede.** `menu_items_display` (corpo vivo letto in
   sola lettura il 12/09) non filtra per portata, e la Sala raggruppa per
   tutte le `RECIPE_CATEGORIES`, finger food compreso.

Dati, letti in sola lettura il 12/09: sul **progetto di prova** 4 voci
finger food nel menu attivo e 5 piatti finger food; in **produzione**
nessuna ricetta finger food e nessuna voce.

## Cosa cambia

Decisione di Alessio del 12/09: *finché non sceglie lui una sezione, un
finger food non si inserisce in un menu.*

- **`src/lib/calcoli/sezioniMenu.js`** (nuovo): le portate che hanno un posto
  nel menu (`antipasto`, `primo`, `secondo`, `dolce`), la frase del divieto
  («I finger food non sono ancora previsti nel menu: non comparirebbero né
  nella scheda del menu né nel foglio stampato.») e `fuoriDalleSezioni()`.
- **`addMenuItem`** (`src/lib/api/menus.js`) rifiuta una portata senza posto
  **prima** di scrivere. È il punto da cui passano tutte le schermate che
  aggiungono una voce di menu.
- **`RicettaDetail`**: su un finger food il pannello «Nei menu» non offre
  più «+ <menu>»; mostra solo i menu dove il piatto sta già (per poterlo
  togliere) e la frase. Nella striscia degli stati, «in carta» è bloccato
  con la stessa frase («🔒 Bloccato apposta»).
- **`MenuDetail`**:
  - le voci già nel menu che nessuna sezione mostra si **dichiarano**, un
    nome per riga, col collegamento alla scheda; se il menu è in servizio
    dice che in sala si ordinano lo stesso;
  - arrivando con `?aggiungi=<id>` su un finger food lo dice invece di
    non fare niente. ⚠️ Nel codice di oggi nessun collegamento produce
    `?aggiungi=`: il ramo si chiude per non lasciarlo armato.
- **Nessun piatto esistente è toccato**: niente viene tolto o spostato.

## Il prezzo, dichiarato

- Finché vale il divieto, **un finger food nuovo non si ordina dal menu in
  sala**, e il bis (che parte da una selezione ordinata) non ha da dove
  partire. Quelli già in un menu restano ordinabili.
- **Non è un vincolo del database**: chi scrivesse dritto in `menu_items`
  passerebbe ancora. Il vincolo vero (un trigger su `menu_items`) vuole una
  migrazione, fuori da questo mandato.
- `EditorMenuHome`: nell'elenco «Cosa lascio fuori», una voce finger food
  **già** nel menu è contata in «Si stampano tutti e N i piatti» e non
  si stampa. Non corretto qui: quelle righe sono vicine alla modifica della
  #63 e a quella della #67. Da sistemare dopo quelle unioni; con il divieto
  non ne nascono di nuove.

## Come è stato verificato

- `tests/schermate/finger-food-nel-menu.test.jsx`, 6 casi:
  - `addMenuItem` rifiuta un finger food con la frase **senza** chiamare
    il database; un primo lo scrive come prima;
  - scheda ricetta: su un finger food nessun «+ Carta dei due mesi», resta
    «✓ Menu degli eventi», compare la frase; su un primo il «+» c'è;
  - scheda menu: una voce finger food già dentro si dichiara col nome, e il
    primo non finisce nell'avviso; `?aggiungi=` su un finger food mostra la
    frase.
- **Rosso col codice di partenza**: rimessi i tre file di master
  (`menus.js`, `MenuDetail.jsx`, `RicettaDetail.jsx`), **4 casi su 6 rossi
  per il motivo giusto**: `addMenuItem` prova a scrivere (`Cannot read
  properties of undefined`, il database finto non risponde); «+ Carta dei
  due mesi» c'è; le due frasi mancano. I 2 casi di controllo restano verdi.
- `tests/schermate/finger-food-sezioni.test.jsx`, la guardia per il futuro:
  per **ogni** portata di `RECIPE_CATEGORIES`, una voce di quella portata
  compare in una sezione della scheda del menu **e** del foglio stampato
  **se e solo se** il divieto la lascia entrare. Diventa rossa se nasce una
  portata nuova o se una sezione viene aggiunta in una sola schermata.
- **Prova visiva locale**, 4 casi × 4 forme = 16 viste, **0 difetti**:
  iPhone 390, iPhone largo 440, caratteri grandi (390 a 64 punti per cm),
  computer 1280. Vere schermate in Chrome senza schermo, letture finte.
  - Al primo giro l'avviso della scheda menu dava **3 sovrapposizioni**
    (390, 440, caratteri grandi): i nomi, collegamenti affiancati nella
    frase, avevano aree di tocco che si toccavano da una riga all'altra.
    Corretto (un nome per riga, `tocco-riga`) e rimisurato: pulito.
  - Fotografie guardate: pannello «Nei menu» a 390, blocco a caratteri
    grandi, avviso a 390 e caratteri grandi prima e dopo.
- `npm run lint` pulito, `npm run build` riuscita.
- Prove pure **1295/1297**: le due rosse sono i fine riga di Windows, rosse
  anche su master.
- Prove sulle schermate: **140**. Nel giro completo scadono i primi casi di
  `rotte-chiuse` e `varco-pubblico`, che montano l'intero gestionale.
  **Misurato** con l'elenco dettagliato, tre giri per parte: **4,69–4,82 s**
  col codice di questo ramo, **4,77–4,96 s** col codice di master; il limite
  è 5 s. Il ramo non li rallenta: stanno sul filo su questo computer, e
  rilanciati da soli sono verdi.
- **Fusione di prova** con #57–#67: nessun conflitto. `MenuDetail.jsx` è
  toccato anche dalla #63 (un import e la riga della stagione): le
  modifiche non si toccano.

## Cosa NON è verificato

- Le prove contro il database non sono state lanciate (il mandato vieta di
  scrivere anche sul progetto di prova).
- Non visto su un iPhone vero; la prova visiva è Chrome.
- La Sala non è stata aperta: che un finger food nuovo non si possa più
  ordinare è letto dal codice (`menu_items_display`, raggruppamento della
  Sala), non provato.

## Decisioni che restano ad Alessio

1. **Dove va la sezione dei finger food** nella scheda del menu e nel
   foglio stampato. Scelta quella, il divieto si toglie in un posto solo
   (`SEZIONI_DEL_MENU`) e la guardia chiede di aggiungerla in tutte e due
   le schermate.
2. **Se il divieto debba diventare un vincolo del database** (una
   migrazione).

## Cosa abbiamo rovesciato

Niente di deciso prima. Il pannello «Nei menu» della scheda ricetta (24/08)
offriva ogni menu a ogni piatto finito: ora non lo offre a un finger food,
per decisione di Alessio del 12/09. La ragione del 24/08 — scegliere da
una scheda in quale menu va un piatto — vale ancora per le quattro portate.

---

**Hash di HEAD dichiarato**: `ecae9d8` sul ramo `finger-food-non-spariscono`,
cioè il commit immediatamente sotto questo documento.
**Stato del working tree al momento della consegna**: pulito (la cartella
della prova visiva locale è esclusa da git e non è committata).
