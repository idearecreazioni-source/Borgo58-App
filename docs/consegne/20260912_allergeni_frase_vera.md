# La regola vera degli allergeni nel menu stampato — 12/09/2026 (mandato esteso, priorità 1 A)

Sola interfaccia. **Migrazioni**: nessuna. **Funzioni online**: nessuna.
**Database**: non toccato (solo letture, vedi sotto). **HEAD dichiarato**: vedi
l'ultima riga.

---

## Cosa cambia

Un file di codice, `src/pages/menu-editor/EditorMenuHome.jsx`, e una prova nuova.

1. **Il riquadro rosso diceva una regola che il gestionale non applica.**
   - Prima: «Questi ingredienti hanno allergeni **solo stimati**, o mai
     guardati da nessuno: … I piatti che li contengono non stampano
     l'elenco allergeni **finché non li confermi** in Ricettario → Schede
     dei prodotti».
   - La regola vera, dal 25/08/2026 (decisione di Alessio, migrazione
     `20260825000018`): un allergene dedotto vale come confermato. La vista
     `v_recipe_allergens` segna «da verificare» **solo** un ingrediente con
     `origine_allergeni` vuota.
   - Adesso: «Attenzione: allergeni che nessuno ha guardato. Su questi
     prodotti gli allergeni non li ha ancora visti né una persona né MEMO:
     … Finché è così, i piatti che li contengono non stampano l'elenco
     allergeni, ma un asterisco. Si sistemano da Ricettario → Schede dei
     prodotti». Sono le parole della scheda ricetta (corrette il 27/08):
     lo stesso fatto si dice uguale.
   - Era la regola già tolta il 27/08 da schede prodotti, commento della
     colonna e scheda ricetta (migrazione `20260827000008`, «una regola
     tolta in un posto solo»). **Questo era il sesto posto.**

2. **Se la lettura degli allergeni falliva, il foglio diceva «non ne hanno».**
   - Prima: l'errore finiva nel `catch` dei piatti (una striscia in cima), e
     l'anteprima con «Mostra allergeni» si disegnava lo stesso: nessun
     allergene, nessun asterisco, e in fondo «teniamo l'elenco completo».
   - Adesso la lettura passa da `leggi()` (`src/lib/calcoli/letture.js`). Con
     «Mostra allergeni» acceso, **al posto** dell'anteprima c'è
     `DatoNonLetto` con «Riprova», e la frase dice come stampare la carta
     senza allergeni. Senza «Mostra allergeni» la carta si stampa come
     prima: non usa gli allergeni.

La logica degli allergeni **non cambia**: cambia cosa si dice.

## Da dove viene la regola (letture, nessuna scrittura)

- Corpo vivo di `v_recipe_allergens` in produzione, letto il 12/09 col
  connettore in sola lettura: `allergeni_da_verificare =
  bool_or(coalesce(origine_allergeni, 'mai_guardati') <> all
  (array['confermati','etichetta','stimati']))`.
- Vincolo della colonna sul progetto di prova, letto con `psql`:
  `origine_allergeni is null or origine_allergeni = any
  (array['stimati','etichetta','confermati'])`. Quindi «fonte» e «dedotto»
  del singolo allergene diventano `stimati` sul prodotto, e l'unico caso che
  blocca è il vuoto.
- Il rimedio indicato è vero: `applica_scheda_prodotto` (ultima definizione,
  `20260823000001`) scrive gli allergeni e `origine_allergeni = 'stimati'`
  quando l'origine è vuota, e `prodotti_da_compilare` (`20260813000012`)
  elenca fra i campi mancanti `allergeni` quando l'origine è vuota.

## Come è stato verificato

- **Prova nuova** `tests/schermate/editor-menu-allergeni.test.jsx`, 4 casi
  con le letture finte:
  - lettura riuscita, allergeni guardati: si stampano, niente riquadro,
    niente asterisco;
  - lettura riuscita, un prodotto mai guardato: il riquadro non contiene
    «solo stimati», «finché non li confermi», «non confermati»; il piatto
    ha l'asterisco e non l'elenco;
  - lettura non riuscita con «Mostra allergeni»: «Non riesco a leggere gli
    allergeni dei piatti», niente «teniamo l'elenco completo», e «Riprova»
    riporta il foglio;
  - lettura non riuscita senza «Mostra allergeni»: la carta si disegna.
- **Rossa col codice di partenza**: rimesso `EditorMenuHome.jsx` di master,
  2 casi su 4 rossi (il secondo e il terzo, cioè la frase vecchia e la
  lettura fallita), gli altri 2 verdi. Poi rimesso il file nuovo.
- **Prova visiva locale**, 3 casi × 4 forme = 12 viste, **0 difetti**:
  iPhone 390, iPhone largo 440, caratteri grandi (390 a 64 punti per cm) e
  computer 1280. Vere schermate montate in Chrome senza schermo, letture
  finte, nessun collegamento al database. Misurati: pagina che scorre di
  lato, controlli fuori dallo schermo, controlli sovrapposti, pulsanti
  tagliati. Fotografie guardate a 390, caratteri grandi, 440 e 1280. Lo
  strumento è locale e non è committato (priorità 4 del mandato).
- `npm run lint` pulito, `npm run build` riuscita.
- Prove pure **1295/1297**: le due rosse sono i fine riga di Windows
  (`indice-richieste`, `indice-rovesciamenti`), rosse anche su master.
- Prove sulle schermate **136/136**.
- **Fusione di prova** (`git merge-tree`) con i rami delle PR #57, #58, #59,
  #60, #61, #62, #63, #64, #65 e #66: nessun conflitto. `EditorMenuHome.jsx`
  è toccato anche dalla #63 (riga dell'elenco dei piatti e un import): le
  modifiche non si toccano.

## Cosa NON è verificato

- La regola «un dedotto vale» sta nella **vista**: la prova nuova la riceve
  già calcolata e non la guarda. Le prove contro il database non sono state
  lanciate: il mandato vieta di scrivere anche sul progetto di prova.
- Nella lettura con `psql` del progetto di prova il parametro della sessione
  in sola lettura **non è arrivato** (`default_transaction_read_only = off`,
  misurato). Le istruzioni erano solo `select`, quindi niente è cambiato, ma
  la protezione dichiarata non c'era.
- Non visto su un iPhone vero; la prova visiva è Chrome.

## Trovato e NON toccato

- Nessun caso nuovo. Resta aperta la domanda del 25/08 sulla colonna vuota,
  che mescola «nessuno ha guardato» e «l'ha scritto Alessio a mano prima
  del 27/08»: è un dato, non una frase, e resta ad Alessio.

## Cosa abbiamo rovesciato

Niente.

---

**Hash di HEAD dichiarato**: `489d9c1` sul ramo `allergeni-frase-vera`, cioè il
commit immediatamente sotto questo documento.
**Stato del working tree al momento della consegna**: pulito (la cartella
della prova visiva locale è esclusa da git e non è committata).
