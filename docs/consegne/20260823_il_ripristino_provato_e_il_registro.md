# Il ripristino provato davvero, e il registro che riparte da zero

**23/08/2026 — terza consegna della sessione**, dopo `914a5e7`. Ordine
chiesto da Alessio: la prova di ripristino su un terzo posto, lo zip
automatico, il promemoria del piano a pagamento, e il registro delle
cancellazioni preparato ma non applicato.

| | |
|---|---|
| HEAD dichiarato | `c2e4a72` |
| working tree | pulito (solo file `*.local.*`, ignorati) |
| migrazione nuova | `20260823000022_il_registro_riparte_da_zero.sql` |
| applicata | ✅ progetto di prova (194) — ❌ **non** in produzione, **aspetta il suo via libera** |
| produzione | **172 migrazioni, invariata** |
| prove | 324 pure · 356 sul progetto di prova, tutte verdi |

---

## 1 — Il ripristino, senza buttare il collaudo

**Fatto, e riuscito.** Nuovo comando `npm run backup:ripristina`.

### La strada, e le due scartate

Alessio: *«trova un terzo posto»*. Misurate tutte e tre:

- 🔴 **PostgreSQL locale: non si può.** Le utilità a riga di comando ci
  sono (`pg_dump`, `psql`, e perfino `postgres.exe`), ma **manca la
  cartella `share`** con i file di bootstrap: è un'installazione dei soli
  comandi, e `initdb` si ferma. Nessun cluster locale.
- 🔴 **Docker: non c'è** su questa macchina.
- 🔴 **Un terzo progetto Supabase: costerebbe.** Il piano gratuito ne
  regge due per organizzazione, e sono già produzione e prova. Creare il
  terzo avrebbe potuto significare spendere: non l'ho fatto.
- ✅ **La strada trovata**: sullo stesso motore del progetto di prova si
  crea un **database nuovo** (`ripristino_prova`), ci si rimette sopra la
  copia, si contano le righe, e alla fine si butta. Sono database diversi
  sulla stessa macchina: il database della prova e la produzione **non
  vengono toccati**. Il ruolo `postgres` ha il permesso di creare
  database — verificato prima di provarci.

### Il risultato

**103 tabelle su 103. 564 righe su 564. Zero errori sui dati.** E la
forma combacia con la produzione: **258 funzioni, 193 policy**.

### 🔴 Ma il primo tentativo ne ha rimesse su 467 su 564

Ed è la parte che vale di più, perché ha trovato **due cose vere**.

**(a) Il metodo.** Un `psql -f` a mano non basta: servono l'ordine
(estensioni, forma, **utenti**, dati) e i **trigger spenti**
(`session_replication_role = replica`). Con i trigger accesi, misurato:
gli scenari congelati **rifiutano le proprie righe** (i loro trigger
esistono apposta), `recipe_status_history` se ne riscrive **42 invece di
28**, e `user_roles` resta a zero perché la chiave esterna verso gli
utenti la respinge. *Un ripristino rimette i dati com'erano; non li fa
riaccadere.* Tutto questo la procedura del progetto lo faceva già — non
lo faceva il mio comando improvvisato.

**(b) 🔴 UN BUCO VERO NELLA COPIA: mancavano le estensioni.** Il backup si
prende con `--schema=public` e le estensioni vivono altrove
(`extensions`, `pg_catalog`, `vault`): **zero `CREATE EXTENSION` nel
file**. La conseguenza, misurata e non dedotta: senza `btree_gist` il
vincolo `employee_leaves_niente_sovrapposizioni` **non si ricrea**, e il
ripristino non dà nessun errore. Si tornerebbe in piedi con un database
che **accetta due periodi di ferie sovrapposti** sullo stesso dipendente
— una regola sparita in silenzio, la famiglia del §8.

✅ Ora `npm run backup` salva `06_estensioni.sql`, e col ripristino **il
vincolo torna**: controllato interrogando il database usa-e-getta, non
sperato.

⚠️ **Cosa resta segnalato e non è un difetto della copia**: `pg_cron` si
può creare solo nel database che si chiama `postgres`, e `supabase_vault`
vuole uno schema che nel database usa-e-getta non c'è. Su un progetto
Supabase nuovo — dove un ripristino vero andrebbe — ci sono già tutti e
due.

✅ **Provato al contrario**: tolte 4 righe dei tavoli da una copia, il
comando si ferma e dice «dining_tables: 9 invece di 13». E il database
usa-e-getta **si butta comunque**, anche quando la prova fallisce.

⚠️ **Limite dichiarato**: il ripristino degli **accessi**
(`03_accessi.sql`) non è provato — nel database usa-e-getta `auth.users` è
un moncone costruito da noi. Le righe che li nominano tornano su lo stesso
perché i controlli sono spenti, come in un ripristino vero.

---

## 2 — Lo zip automatico

`npm run backup` produce da sé il file unico da portare via, accanto alla
cartella (che resta: serve alla verifica e alla prova di ripristino).

⚠️ **Se lo zip fallisce la copia non è persa**, e il comando lo dice: un
guasto lì non deve far sembrare fallito un backup riuscito.

Copia di stasera: `Borgo58_backup_2026-08-23_2226.zip`, **248 KB**.

---

## 3 — Il promemoria del piano a pagamento

Sta dentro `npm run collaudo:stato`, **non in un'agenda**: quello è il
comando che si guarda proprio nel momento giusto — prima di caricare i
primi dati veri si viene lì a vedere cosa c'è ancora di prova. *Un
promemoria in un'agenda si rimanda; uno che compare mentre si sta per
fare la cosa, no.*

⚠️ **E non è una data: è un fatto che si misura.** Finché fatture e
movimenti in produzione sono zero la riga è un ricordo tranquillo; appena
ce n'è anche uno, diventa un avviso in rosso.

---

## 4 — Il registro delle cancellazioni

**Preparato, applicato solo sulla prova, fermo in produzione** come
chiesto.

Il reperto era giusto: **43 tracce, non 29**. Il numero era vero quando fu
scritto e nessuno l'ha più riletto — la stessa forma con cui sono già
invecchiati l'elenco dei dati di collaudo (tre volte in sei giorni) e il
conteggio delle funzioni senza portiere. ⚠️ **La cura non è aggiornare il
numero**: `npm run collaudo:stato` lo chiede già al database.

### Cosa toglierebbe, misurato in produzione

| tabella | tracce | | tabella | tracce |
|---|---|---|---|---|
| cash_movements | 13 | | employees | 2 |
| documents | 10 | | employee_leaves | 2 |
| order_items | 6 | | reservations | 1 |
| discounts_gifts | 4 | | payslips | 1 |
| supplier_invoices | 3 | | order_payments | 1 |

**43 in tutto**, fra il 13 e il 22 agosto: 22 da un utente vero (i suoi
collaudi), 21 da migrazioni e lavori pianificati.

⚠️ **Il perimetro è una data**, non «svuota la tabella»: toglie solo ciò
che esisteva quando la migrazione è stata scritta. Rieseguirla non si
porta via le tracce nate dopo — che dal primo dato vero in poi sono la
storia del locale. *È l'unico caso in cui un numero fisso è onesto: non
dice com'è fatto il mondo, dice fin dove arrivava quando ho guardato.*

🔴 **La verifica che conta non è «è vuoto»**: è che il registro **continui
a registrare**. Svuotare una tabella e spegnerla per sbaglio si somigliano
molto, e un registro che non scrive più non lo direbbe nessuno finché non
serve. La verifica cancella una riga vera di una tabella tracciata e
pretende che la traccia nasca.

✅ **Provata al contrario**: spento apposta il trigger delle tracce, la
verifica è diventata rossa («0 invece di 1»); riacceso, verde. Zero
residui, trigger tornato acceso — controllato.

**Sulla prova**: 412 tracce tolte, 0 rimaste, e le 356 prove sono rimaste
tutte verdi dopo.

---

## Cosa abbiamo rovesciato

**Niente.** Nessuna decisione presa prima è stata cambiata. Il backup
guadagna un file (le estensioni) e uno zip; il registro si svuota per
decisione nuova di Alessio, non contro una decisione vecchia.

---

## Cosa NON è verificato

- **Il ripristino degli accessi**, per la ragione scritta sopra.
- **Nessuna mano vera**: tutto è stato fatto da qui.
- **La migrazione del registro non è mai girata in produzione**, e in
  produzione le tracce sono 43 mentre sulla prova erano 412: il numero che
  stamperà là sarà diverso, ed è giusto così.
- **Il promemoria del piano non è mai scattato in rosso**: oggi fatture e
  movimenti sono zero. Il ramo che avvisa non l'ha visto nessuno.

---

## Cosa aspetta il via libera di Alessio

Tutto fermo finché la copia non è fuori dal computer, come ha deciso:

1. le **19 migrazioni del 23/08** già in attesa;
2. `20260823000020_il_cliente_del_tavolo.sql`;
3. `20260823000021_la_spesa_spicciola.sql`;
4. `20260823000022_il_registro_riparte_da_zero.sql` — ⚠️ per tenere
   indietro **solo questa** lasciando passare le altre:
   `npm run migra -- --salta 20260823000022 --conferma`;
5. l'installazione del corridoio `operazioni-atomiche` in produzione,
   **insieme** alla `…020`.
