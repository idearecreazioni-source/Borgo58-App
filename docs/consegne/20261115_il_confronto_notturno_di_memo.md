# Il confronto notturno: MEMO contro le pagine (15/11/2026)

Seconda protezione chiesta dal revisore, approvata da Alessio il 15/11.

## Cosa fa
Ogni notte alle **03:30 di Roma**, su work, un lavoro pianificato (`memo-confronto-notturno`) confronta quello che dice ogni lettura di MEMO con quello che dicono le pagine: **solo conteggi e totali**, nessun dato personale, nessuna intelligenza artificiale (costo zero). 12 confronti: piano, fatture fornitori (per società), cassa (per soggetto), banca, prenotazioni, magazzino, HACCP, agenda, costo piatti, archivio documenti, fatture ai clienti.

- **Se non coincide**: arriva un avviso su Telegram (con `segnala_allarme`, uno per giorno al massimo), una riga in italiano, per esempio «MEMO e le pagine non coincidono. piano dell'investimento: MEMO dice 69 righe e 98.586,80 €, la pagina 63 righe e 77.620,80 €. Non fidarti dei numeri della chat finché non lo sistemiamo.»
- **Se tutto coincide**: nessun messaggio. L'esito di ogni notte resta scritto in `memo_confronti` (letture, numero di MEMO, numero della pagina, coincide sì/no), leggibile dal titolare e da un accesso di sola lettura; il battito dell'ultimo giro riuscito è in `stato_lavori` (`memo_confronto`).
- **Se il controllo stesso si rompe**: avviso a parte («non è riuscito») e niente battito. **Se non parte più** (più di 26 ore senza battito): lo dice la sentinella dei lavori (`lavori_sorvegliati`).

## Come è fatto
Si appoggia al sistema che c'era: pg_cron come `avvisa_scadenze` (1:30 e 2:30 UTC, passa solo quello che cade alle 3 qui), `segnala_allarme` per Telegram (e le regole di silenzio di Prova), `stato_lavori` e la sentinella. La «pagina» è scritta in SQL con la stessa regola del codice della pagina; è una seconda strada allo stesso numero.

## Come si è provato
La verifica della migrazione: il confronto controlla tutte le letture e su Prova coincidono; **rompendo apposta la lettura del piano** (le madri dentro, come il 15/11) il confronto se ne accorge; la frase dell'avviso è quella attesa; il lavoro è pianificato e sorvegliato. Annulla tutto (zero residui). Su Prova il lavoro è girato davvero: 12 confronti, tutti uguali, nessun avviso, battito scritto.

## Per il controllo del lunedì del revisore
`select * from memo_confronti order by eseguito_il desc` e `select * from stato_lavori where nome = 'memo_confronto'`.

## Su work
Migrazione `20261115000017`. Nessuna funzione online da reinstallare. Copia prima. **Non manda messaggi veri finché non c'è una differenza.**
