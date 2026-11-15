# La prova «MEMO = pagina» e il registro di MEMO (15/11/2026)

Dalla richiesta del revisore (`RICHIESTA_operativa_protezioni_MEMO_15-11.md`), protezione 1 (prima parte) e registro.

## Cosa c'è
- **Prova `tests/app/memo-come-la-pagina.test.js`** (gira nei Controlli contro Prova): confronta il **risultato** di MEMO con la pagina, usando il codice vero della pagina (`leggiPiano`, `totaliDelPiano`, `listSupplierInvoices`), non una copia.
  - Piano: una madre con due sottovoci vive e una archiviata, più di 50 voci. MEMO deve contare le stesse voci e lo stesso previsto della pagina, e il conteggio deve dire la verità oltre il taglio a 50.
  - Fatture fornitori: una pagata e due da pagare. Il «da pagare» di MEMO deve essere quello della pagina, le non pagate vengono prima, la pagata ha da pagare zero.
- **Dimostrato**: rimettendo sul database di Prova la vecchia lettura del piano (madri comprese) la prova diventa rossa (64 voci invece di 63); rimessa a posto torna verde.
- **Migrazione `20261115000015`**: le fatture fornitori di MEMO contano il debito **per società**, come la pagina («due società, due debiti: mai un totale solo»).
- **Registro**: ogni risposta di MEMO salva in `memo_messaggi` la domanda e la risposta (testo), il modello, i token, il costo e lo stato, le righe citate (`risultati`: riferimento breve e tabella) e, in `strumenti`, per ogni lettura usata: nome, ricerca, righe arrivate al modello, **conteggio e totale dichiarati**. Prima c'erano solo i nomi.

## Da fare (prossime parti della protezione 1)
Cassa con due soggetti, banca con un ignorato, magazzino, prenotazioni, HACCP, agenda, costo piatti, documenti, fatture clienti: ognuna col suo caso difficile. La protezione 2 (confronto notturno su work con avviso su Telegram) è un lavoro a parte.

## Su work
Migrazione `20261115000015` e funzione `memo-chat`. Copia prima.
