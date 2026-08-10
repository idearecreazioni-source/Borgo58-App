# Consegna del 10/08/2026 — coda del blocco 1
## Il difetto §6.1: `set_task_visibility` senza `search_path`

**HEAD dichiarato: `bbdd9c64a905d3bf2a1e13372f2c44e79d04cf3f`** (`bbdd9c6`).
Working tree **pulito**. Due commit sopra `b17aa6e`:

| Commit | Cosa |
|---|---|
| `fdbf698` | la migrazione e la sua verifica *(pushato e applicato in produzione mentre scrivevo)* |
| `bbdd9c6` | sola documentazione: il conteggio migrazioni in `CLAUDE.md` passa a 50 |

**Migrazione `20260810000003_search_path_dei_trigger`: APPLICATA IN
PRODUZIONE** da Alessio, dopo essere stata applicata due volte sul
progetto di prova.

**Verificato in produzione a valle** (connettore in sola lettura):
`funzioni trigger senza search_path = 0`; `set_task_visibility` e
`set_updated_at` entrambe con `search_path=public`; **50 migrazioni**
registrate, l'ultima è `search_path_dei_trigger`; **zero residui** della
prova interna alla migrazione.

---

## 1. Grazie per il bersaglio

La caccia era la parte cara: il ripristino diceva *"function is_titolare()
does not exist"* senza dire da dove. Individuata `set_task_visibility` e —
soprattutto — verificato che fosse **l'unica** su tutte le funzioni
trigger, la correzione è diventata una riga.

Trovata una seconda funzione trigger priva di `search_path`,
**`set_updated_at`**: coerente con la vostra verifica, perché **non è
rotta** — usa solo `now()`, che vive in `pg_catalog` e si trova sempre,
qualunque sia il `search_path`. È stata fissata lo stesso, e la ragione è
di verificabilità, non di rischio:

> «nessuna funzione trigger senza `search_path`» è una regola che una
> query controlla in blocco — ed è così che la controlla il blocco di
> verifica della migrazione. «Nessuna tranne una, e ricordarsi perché»
> non è controllabile: sopravvive finché qualcuno se lo ricorda.

Se preferite l'eccezione documentata alla regola chiusa, si torna indietro
in una riga: è una scelta di metodo, non un vincolo tecnico.

---

## 2. Verifica, nell'ordine giusto (progetto di prova)

1. **Guasto riprodotto PRIMA della correzione**: `search_path` azzerato +
   inserimento di un promemoria → `function is_titolare() does not exist`,
   `CONTEXT: PL/pgSQL function public.set_task_visibility() line 3 at IF`.
   Cioè esattamente la riga che il ripristino colpiva.
2. Migrazione applicata.
3. **La stessa scena adesso passa.** La prova sta **dentro** la migrazione:
   non un controllo sui metadati («la funzione ha la configurazione
   giusta»), ma la scena esatta del guasto — search_path vuoto, insert
   vero, riga ripulita e conteggio a zero.
4. **Rieseguita una seconda volta**: stesso esito, zero funzioni scoperte
   (idempotenza reale, non dichiarata).
5. **Suite completa: 21 prove su 21 verdi.**

Il riepilogo finale della migrazione stampa
`funzioni_trigger_senza_search_path = 0`.

---

## 3. Rischio in produzione

Nessun cambiamento di comportamento: le due funzioni fanno esattamente
quello che facevano, con lo stesso corpo. Cambia solo l'ambiente in cui
risolvono i nomi — e lo cambia verso quello che già usavano di fatto
(`public`). L'unico effetto osservabile è che un ripristino, da adesso,
non si ferma più sui promemoria.

---

## 4. Stato del blocco 1

Chiuso, difetto §6.1 compreso. Restano in capo ad Alessio i due passi
non automatizzabili (copia fuori sede, promemoria settimanale) e resta
aperto il solo difetto §6.2 — l'indirizzo della Edge Function inciso in
tre migrazioni — da parametrizzare quando si toccherà quel giro.

Prossimo: **blocco 2, privacy dei clienti**. In attesa da Alessio la
scelta dei mesi di conservazione delle richieste rifiutate e il testo
dell'informativa verificato da chi lo segue.
