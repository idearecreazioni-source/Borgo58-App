# Consegna del 11/08/2026 (terza) — chi può eseguire cosa

Risposta al blocco del validatore sulla migrazione dell'email.

**Commit della consegna: `c5945af`** (questo riepilogo è il commit
immediatamente sopra, sola documentazione). Working tree pulito.

| Commit | Cosa |
|---|---|
| `c5945af` | revoche sull'email + migrazione `20260811000002` che chiude il ruolo anonimo su 35 funzioni, trappola in `CLAUDE.md` §8 |

**Da applicare in produzione, in quest'ordine**: `20260811000001`
(corretta, idempotente, già applicata una volta) e `20260811000002`.

---

## 0. Una correzione di fatto, prima di tutto

Il validatore scrive: *«La migrazione non è mai stata applicata in
produzione»*. **Non è così**: `20260811000001` è stata applicata in
produzione l'11/08 alle 22:29, corretta per un altro difetto e
**riapplicata** alle 23:0x, la funzione `email-cliente` è installata,
l'interruttore è acceso e **la catena è stata provata dal vivo**: richiesta
vera dal form pubblico → conferma dal gestionale → email arrivata in
casella, un invio registrato, zero allarmi.

Non cambia la sostanza del rilievo — che è giusto — ma cambia il rimedio:
non basta correggere il file, la correzione **va anche applicata in
produzione**, perché là il difetto è vivo adesso.

---

## 1. Il rilievo era giusto, e il rimedio è quello indicato

`invia_email_conferma()` e `email_conferma_dovuta()` avevano `proacl` a
`NULL`, cioè il permesso predefinito di Postgres: eseguibili da `public`,
quindi da `anon` — e la chiave `anon` è pubblica, sta nel bundle del sito.
Un estraneo poteva far partire un'email a nome del locale, con la spesa e
la riga di registro che ne seguono.

Corretto nel file: `revoke all on function … from public, anon,
authenticated` su entrambe **e** sulla funzione trigger, con verifica
finale via `has_function_privilege` che solleva eccezione. Migrazione
riapplicata da zero sul progetto di prova.

### La prova negativa ha trovato un secondo difetto — nel mio rimedio

Prima di dichiararlo fatto ho riaperto **di proposito** il permesso sul
progetto di prova (`grant execute … to anon`) e ho rieseguito la
migrazione: **è fallita**. Avevo scritto `revoke … from public` soltanto,
e una concessione esplicita ad `anon` non viene toccata da quella revoca.
Da lì la forma finale con tutti e tre i ruoli nominati.

È esattamente il motivo per cui il blocco di verifica deve essere provato
al contrario: un controllo che non ha mai visto fallire non è un controllo.

---

## 2. La domanda del validatore: chi DEVE poter chiamare `invia_email_conferma`?

**Soltanto il trigger. Nessun ruolo applicativo, oggi né domani.**

- Oggi la chiama `trg_email_conferma_cliente()`, che è `security definer`
  e gira come proprietario: il permesso dei ruoli applicativi non
  c'entra, e infatti la revoca non ha rotto niente.
- Una futura schermata **Reinvia** non cambierà la risposta. Un reinvio è
  una scrittura con conseguenze, quindi per il contratto (regola **B4**)
  passa dal corridoio `operazioni-atomiche` verso una funzione dedicata:
  il permesso si concederà a *quella*, non a questa. Concedere adesso in
  previsione di un domani è il modo classico di lasciare aperta la porta
  di una stanza che non verrà mai costruita.

---

## 3. Il rilievo apriva una classe, non un caso

Seguendo il metodo del §8 (*«i guasti che emergono dopo anni sono lo
stesso errore ripetuto in venti punti»*) ho interrogato la produzione su
tutte le funzioni `security definer` dello schema `public`:

**35 funzioni erano eseguibili dal ruolo anonimo.** Fra queste, chiamabili
via PostgREST da chiunque avesse la chiave pubblica:

| Funzione | Cosa poteva fare un estraneo |
|---|---|
| `merge_customers` | fondere due schede cliente |
| `register_stock_delivery` | registrare un carico di magazzino |
| `record_stock_consumption` | scaricare merce |
| `add_shopping_list_item`, `add_below_threshold_items`, `remove_…`, `close_…` | scrivere nella lista della spesa |
| `link_reservation_customer` | legare una prenotazione a un cliente |
| `send_due_task_reminders`, `controlla_lavori_pianificati` | far partire promemoria e sentinella |

Nessun dato usciva (nessuna di queste restituisce contenuti), ma **si
poteva scrivere nel database del locale dall'esterno**. Le funzioni
scritte dopo il 10/08 non hanno il difetto: `capienza_e_orari` aveva già
introdotto la revoca esplicita. Quelle di prima sono rimaste col permesso
di partenza.

Nuova migrazione **`20260811000002_niente_aperto_al_pubblico`**: chiude
`anon` su tutte le `security definer` dello schema `public` **tranne le
due del form pubblico**, e **conserva `authenticated` dov'era**.

**Perché `authenticated` resta**: il corridoio `operazioni-atomiche` non
usa una chiave di servizio — costruisce il client con la chiave anon e
inoltra l'`Authorization` dell'utente (`index.ts`, righe 88-116), quindi
le funzioni girano come `authenticated`. Toglierlo spegnerebbe il
gestionale. La migrazione fotografa il permesso dello staff **prima** di
revocare e lo riconcede subito dopo: senza quel passaggio, le funzioni
che lo ereditavano da `public` lo avrebbero perso in silenzio.

**Resta aperto e lo dichiaro**: che uno staff possa chiamare via RPC
un'operazione che la schermata non gli offrirebbe è un tema diverso — si
chiude con `is_titolare()` **dentro** ciascuna funzione, guardandole una
per una, non con una revoca in blocco. Non è in questa consegna.

---

## 4. Verifica

| Cosa | Come |
|---|---|
| revoche sull'email | migrazione riapplicata da zero sul progetto di prova, verifica interna verde |
| il controllo non è finto | permesso riaperto di proposito → la verifica **è fallita**, come deve |
| lockdown dell'anonimo | 35 funzioni chiuse; l'elenco finale stampa **2** funzioni aperte, che sono le due del form |
| il gestionale non si è rotto | `npm run test:app` sul progetto di prova: **24 prove su 24 verdi**, compresa quella della prenotazione pubblica da sloggati |
| produzione | **non ancora**: entrambe le migrazioni le applica Alessio |

---

## 5. Sequenza per Alessio

1. Applicare `20260811000001` (corretta) in produzione.
2. Applicare `20260811000002`.
3. Rileggere `/prenota` da sloggato: deve continuare a mostrare gli orari
   e ad accettare una richiesta. È il solo comportamento che questa
   consegna potrebbe rompere.
