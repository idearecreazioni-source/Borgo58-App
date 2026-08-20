# La chiave che scrive non vive sul computer — misura e proposta

**20/08/2026, notte** · Code → Alessio e validatore

**Decisione già presa da Alessio**: strada 3, nella forma *«la chiave non vive
sul computer»*, accettando il costo di un gesto ogni volta.

🔴 **QUESTO DOCUMENTO NON È LAVORO FATTO: è la misura chiesta prima di
scrivere, e la proposta che ne esce.** Niente è stato toccato — né il codice,
né il database vero, né `.env.db`.

---

## 1 · Il censimento: chi legge `DB_URL_PRODUZIONE`, e per farne cosa

Dieci punti la usano. **Uno solo scrive.**

| comando | cosa fa sul database vero |
|---|---|
| `npm run migra -- --conferma` | 🔴 **SCRIVE** — `psql -f` applica le migrazioni (`migra.mjs:250`) |
| `npm run migra` (senza conferma) | legge: quali versioni ci sono |
| `npm run backup` | legge: `pg_dump` su `public`, `auth.users`, `auth.identities`, `storage.buckets`, `storage.objects` |
| `npm run collaudo:stato` | legge: cosa c'è ancora di prova |
| `npm run consegne` | legge: quali migrazioni non hanno riepilogo |
| `npm run deposito:orfani` | legge l'archivio; ⚠️ la rimozione dei file passa dalla **service_role**, non da questa chiave |
| `npm run funzione:viva` | legge il corpo vivo di una funzione |
| `npm run funzione <nome>` | legge `applied_migrations` per la rete dei riepiloghi |
| `npm run prova:stato` | legge: quali tabelle piene in produzione sono vuote sulla prova |
| `npm run prova:ricostruisci` | legge la sala vera per copiarla sulla prova |

⚠️ **Il `-f` di `backup.mjs` è il file di USCITA di `pg_dump`, non un file da
applicare**: l'ho guardato riga per riga per non contarlo fra le scritture.

🔴 **La conseguenza, ed è il motivo per cui la misura andava fatta prima**:
togliere `DB_URL_PRODUZIONE` dal file e basta **spegnerebbe nove strumenti di
misura**, fra cui il **backup** — che è la rete di sicurezza e deve funzionare
*senza* Alessio, non con lui.

---

## 2 · Un accesso di sola lettura separato: sì, e costa MENO del previsto

🔴 **Esiste già, e non va creato**: Supabase fornisce il ruolo
**`supabase_read_only_user`**. Misurato sul database vero, in sola lettura:

| | |
|---|---|
| `select` su `public` | ✅ |
| `insert` su `public` | ❌ (è il punto) |
| `select` su `applied_migrations` | ✅ |
| `select` su `auth.users` / `auth.identities` | ✅ |
| `select` su `storage.objects` / `storage.buckets` | ✅ |

**Copre tutti e nove i comandi di lettura**, backup compreso. E nessuno di
quegli script chiama funzioni del database: fanno tutti `select` su tabelle e
sul catalogo — quindi non c'è il rischio che un `security definer` rifiuti quel
ruolo.

⚠️ **Due cose che NON ho potuto verificare da qui**, e sono le sole che
restano in dubbio:
1. **la password di quel ruolo**. Va presa o rigenerata dal pannello Supabase:
   non ce l'ho e non devo averla;
2. **che `pg_dump` giri davvero con quel ruolo**. I permessi ci sono tutti, ma
   *i permessi che ci sono* e *il comando che riesce* sono due cose diverse —
   è la stessa distinzione del 17/08 fra «la funzione è stata riscritta» e «la
   funzione risponde».

🔴 **Quindi l'ordine non è negoziabile: prima si prova il backup con la chiave
nuova, e solo se riesce si toglie quella vecchia.** Un backup rotto scoperto il
giorno che serve è peggio del buco che stiamo chiudendo.

---

## 3 · La proposta

### Cosa cambia in `.env.db`

```
DB_URL_PRODUZIONE=postgresql://supabase_read_only_user:...@...   ← SOLA LETTURA
```

La stringa con l'utente `postgres` — quella che scrive — **esce dal file** e
resta solo nel gestore di password di Alessio.

⚠️ **Il nome della variabile non cambia**: si chiama già `DB_URL_PRODUZIONE` in
dieci punti, e rinominarla sarebbe lavoro senza guadagno. Cambia **cosa
contiene**, e la sua riga in `docs/BACKUP.md` lo dirà.

### Cosa cambia in `npm run migra`

Oggi legge la chiave dal file e applica. Dopo:

- **i cinque controlli restano identici** e girano **con la chiave di
  lettura**: identità del database, riepiloghi, passaggio dalla prova, file
  committati, migrazioni su GitHub. Nulla si indebolisce;
- **solo al momento di applicare**, il comando **chiede la stringa di
  scrittura a schermo**, la usa per quella sola esecuzione e non la scrive da
  nessuna parte;
- se la stringa non arriva, il comando **dice cosa manca e dove prenderla** —
  non fallisce con un errore di collegamento che nessuno sa leggere.

### 🔴 Il gesto vero, e va detto perché è la parte che cambia le giornate

Il terminale di Claude Code **ha i prompt disattivati** (§4). Quindi da lì la
richiesta non si può soddisfare: **le migrazioni le applicherà Alessio da una
finestra PowerShell normale**, incollando la stringa quando gliela chiede.

⚠️ **Questo rovescia in parte la decisione del 12/08** («le migrazioni di
produzione le applico io»), e va dichiarato invece di lasciarlo scoprire.

**Ma non è lo stesso gesto che il 12/08 era fallito tre volte.** Allora il
problema era **incollare un file SQL lungo** nell'SQL Editor, e il paste si
troncava a metà — lasciando il database in uno stato che nessuno aveva voluto.
Qui si incolla **una riga**, e il comando fa il resto: se si tronca, il
collegamento **fallisce subito** invece di applicare mezza migrazione. *La
ragione del 12/08 non vale più perché è cambiato l'oggetto del gesto, non
perché fosse sbagliata.*

⚠️ E resto io a **preparare tutto**: scrivere le migrazioni, provarle sulla
prova, controllare le cinque reti, dire cosa sta per succedere e riportare i
numeri veri dopo. Cambia **chi preme l'ultimo tasto**.

---

## 4 · Cosa questo chiude, e cosa no

**Chiude**: sul computer non resta nessuna chiave capace di scrivere sul
database del locale. Il pulsante di pubblicazione dell'interfaccia grafica
continua a mettere il sito online — quello non lo tocca niente — ma **non apre
più la strada al database vero**, perché la strada non c'è più.

**Non chiude**, e va detto:
- 🔴 **la `SERVICE_ROLE_PRODUZIONE` resta nel file**, e con quella si scrive
  attraverso PostgREST. Serve al backup dei documenti e a `deposito:orfani`.
  ⚠️ Misurato il 20/08: quel ruolo **non ha `select` sulle tabelle di
  `public`** — è già ristretto — ma sullo **storage** può cancellare file.
  *Chiuderla è un lavoro a sé, e non l'ho aperto.*
- **chi può modificare `migra.mjs` può fare altro**: questa non è una difesa
  contro qualcuno che vuole passare. È che **non ci sia più una strada per
  sbaglio o per inerzia** — che è il difetto misurato, non un attacco.

---

## 5 · L'ordine, quando si farà

Non stanotte, e non prima delle quattro migrazioni pendenti.

1. *(Alessio)* dal pannello Supabase: password di `supabase_read_only_user`;
2. si mette quella stringa in `.env.db` **accanto** a quella vecchia, con un
   nome provvisorio;
3. **`npm run backup` con la chiave nuova**, e si guarda che i quattro file
   escano non vuoti e i conteggi tornino. 🔴 **Se qui qualcosa non riesce, ci
   si ferma e la proposta si riapre**;
4. si prova anche `npm run collaudo:stato` e `npm run consegne`, che sono i
   due che leggono di più;
5. solo allora: la chiave di scrittura **esce dal file** e va nel gestore di
   password, e `migra.mjs` impara a chiederla;
6. si prova ad applicare **una migrazione vera** con Alessio davanti — perché
   *un comando che si crea non è un comando che funziona*, e il prompt da qui
   non posso provarlo.

---

## Cosa NON è verificato

- **niente è stato scritto**: né codice, né `.env.db`, né database;
- **il prompt a schermo non l'ho provato** e da questo terminale non posso:
  i prompt sono disattivati. È la parte che va vista in PowerShell;
- **`pg_dump` con il ruolo di sola lettura non è stato eseguito**: ho misurato
  i permessi, non il comando.
