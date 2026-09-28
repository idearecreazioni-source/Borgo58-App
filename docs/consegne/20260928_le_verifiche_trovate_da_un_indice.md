# Le verifiche nel registro, trovate da un indice

**28/09/2026** · ramo `claude/indice-verifiche` · proposta verso `slave`, **non unita**
· migrazione `20260928000001` **non applicata a nessun database remoto** (né Prova, né produzione)

---

## Perché

La #134 è rossa nel solo `tests/app/registri-esibibili.test.js` › «il registro
delle cancellazioni non conserva le righe delle verifiche»: 57014, statement
timeout (corsa 36349917319). Misurato su Prova il 28/09, in sola lettura:
`deleted_records` ha **102.394 righe** (68.891 il 15/09), le righe con
«verifica» sono **0**, e la ricerca di `lapidi_delle_verifiche()` è un **Seq
Scan** che scarta tutte le righe (1.091 ms a database fermo; 3,7–9,0 s nei
controlli GitHub, limite 8 s).

## Cosa cambia

Una migrazione sola: un indice **parziale** con lo stesso predicato del filtro
della funzione, ordinato per la colonna del suo `order by`.

```sql
create index if not exists idx_deleted_records_verifiche
  on deleted_records (deleted_at)
  where record::text ilike '%verifica%';
```

**Non cambiano**: `lapidi_delle_verifiche()`, `lapidi_di_prova()`, RLS,
permessi, limiti di tempo, righe del registro. Nessuna estensione, nessun
`CONCURRENTLY`.

## La dimostrazione (PostgreSQL 17.11 locale usa-e-getta; Prova è 17.6)

⚠️ Eseguita **a mano** sul database locale, con script fuori dal repository:
non è automatizzata. Le prove automatiche sono quelle della sezione dopo.

Estratto dal pacchetto winget `PostgreSQL.PostgreSQL.17` 17.11-4 (installatore
EDB, SHA-256 `c9828fd3…a5e4` uguale al manifest, firma valida EnterpriseDB
Corporation), solo `--extract-only`. Schema, RLS, `is_titolare()` e funzione
copiati dalle migrazioni; 102.394 righe sintetiche; SELECT misurata col ruolo
`authenticated` e i claims del titolare.

| | piano | tempo |
|---|---|---|
| zero risultati, senza indice | Seq Scan + Sort, 102.394 scartate | 769,7 ms (funzione 671,4) |
| zero risultati, con indice | Index Scan using `idx_deleted_records_verifiche`, nessun Sort | 0,043 ms (funzione 0,888) |
| 6 pertinenti + 4 quasi-parole, con indice | stesso Index Scan | 0,553 ms |

I sei criteri:
1. il predicato è accettato (indice valido, 8 kB);
2. predicato e filtro sono la stessa espressione, `((record)::text ~~* '%verifica%'::text)`;
3. sotto RLS il piano usa l'indice e non il Seq Scan;
4. nessun Sort sopra l'indice: l'ordine per `deleted_at` lo dà l'indice;
5. stesse 6 righe nello stesso ordine della lettura intera forzata, in tutti e
   due i versi, per la SELECT e per la funzione (maiuscole, parola dentro
   un'altra, chiave JSON, annidata, campo fuori dalla firma; le quasi-parole
   restano fuori). Lo staff è ancora respinto;
6. tutti i piani «con indice» sono presi con le impostazioni di serie del
   pianificatore.

Il piano interno della funzione, letto con `auto_explain`, usa lo stesso Index
Scan.

## Prove

- **Verifica dentro la migrazione** (non scrive niente):
  - indice valido, btree sulla sola `deleted_at`, predicato esatto (dal catalogo);
  - il corpo della funzione, **senza commenti** e con spazi e maiuscole ridotti,
    contiene ancora `from deleted_records d where d.record::text ilike
    '%verifica%' order by d.deleted_at;` — un **confronto di testo**, non
    un'analisi del SQL;
  - `EXPLAIN` (senza `ANALYZE`) della SELECT da `authenticated` coi claims del
    titolare: l'indice c'è, nessun Seq Scan, **nessun Sort in tutto il piano**.
    `enable_seqscan` è scoraggiato: la verifica dimostra che l'indice **può**
    servire la query, non che il pianificatore lo scelga (su un registro
    piccolo come la produzione sceglierebbe legittimamente la lettura intera);
  - stesso conteggio di `lapidi_di_prova()`, con lo stesso ruolo e gli stessi
    claims;
  - ruolo, `enable_seqscan` e claims tornano ai valori di partenza.
  - Provata sul database locale come la applica `npm run migra`
    (`ON_ERROR_STOP` e transazione sola): due giri verdi. Rotture prese tutte,
    ognuna col suo messaggio: indice assente, predicato più largo, chiave `id`,
    filtro della funzione cambiato, filtro cambiato col vecchio in un
    commento, ritorno alla lettura intera. Con la verifica fallita non restano
    né la riga in `applied_migrations` né il commento sull'indice.
- **`tests/unita/indice-verifiche.test.js`** (10), sul testo delle migrazioni:
  predicato identico al filtro dell'ultima definizione della funzione (cercata
  senza commenti); colonna uguale all'`order by`; applicazione atomica secondo
  `argomentiMigrazione()`; niente pulizie, `vacuum`/`analyze`, limiti di tempo,
  estensioni, `concurrently`, funzioni ridefinite. È un setaccio sul testo, non
  un parser SQL. Rotture prese tutte: indice tolto, predicato più largo, chiave
  sbagliata, un `delete` sul registro, un `vacuum`.
- **Revisione Codex del diff**: nove rilievi. Accolti e corretti quelli sul
  ripristino delle impostazioni, sul corpo letto coi commenti, sul riordino
  cercato solo nella prima riga del piano, sulla robustezza della prova pura e
  sulle frasi di questo riepilogo. Quello sull'atomicità non regge per come il
  progetto applica le migrazioni, ed è ora fissato da una prova.

## Cosa non è verificato

- La migrazione **non è applicata a Prova**: finché non lo è, il controllo
  «Prove contro il progetto di prova» resta esposto al 57014 già noto.
- Il tempo sul Prova vero con l'indice non è misurato: la dimostrazione è su
  dati sintetici, non sui 102.394 record veri.

## Cosa abbiamo rovesciato

Niente. La migrazione `20260915000001` diceva che il costo restava
proporzionale al registro e che toglierlo davvero voleva dire decidere cosa
fare del registro di Prova: la decisione di non pulire vale ancora, e un
indice toglie il costo senza toccare le righe.
