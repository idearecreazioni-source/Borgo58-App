# Borgo 58 — Architettura e regole di integrità del dato

**Stato**: vincolante per ogni implementazione futura, dal 09/08/2026.
**Responsabilità**: l'integrità del dato, a tutti i livelli, è responsabilità di chi scrive il codice — non dell'utente che lo usa, non della schermata, non della fortuna.

Questo documento esiste perché fino all'08/08/2026 la regola non era scritta e il risultato è stato prevedibile: sei operazioni che scrivono su più tabelle una chiamata alla volta dal browser, senza modo di annullare quelle già eseguite se una fallisce. Nessuno lo aveva chiesto: è mancato il disegno. Da qui in avanti il disegno c'è.

---

## 1. Il principio, in una riga

> **Una richiesta dell'utente = una transazione = una chiamata al database.**

Tutto il resto di questo documento discende da qui.

Una transazione è la garanzia che un gruppo di scritture avvenga **tutto o niente**: se qualcosa fallisce a metà, il database riporta indietro anche ciò che era già riuscito. È l'unico meccanismo che rende impossibile — non improbabile, impossibile — un dato scritto a metà.

**Dove vive la transazione**: dentro Postgres. Una funzione SQL è atomica per costruzione. Non serve nulla per ottenerlo e non c'è modo di dimenticarselo.

**Dove NON vive**: in una sequenza di chiamate REST, che siano fatte dal browser o da un server Node. Tre chiamate REST sono tre transazioni separate, e la seconda può fallire dopo la prima. Mettere un server in mezzo non cambia questo fatto: è la trappola in cui è caduto questo progetto.

---

## 2. I quattro livelli, e cosa garantisce ciascuno

### Livello 1 — Il database è l'autorità, non l'archivio

Ogni regola che deve essere **sempre** vera è espressa come vincolo del database, mai come controllo nella schermata.

| Tipo di regola | Come si esprime |
|---|---|
| Un campo non può mancare | `not null` |
| Un valore ammette solo certe forme | `check` |
| Una riga deve puntare a una esistente | `references` |
| Due righe non possono coesistere | `unique`, anche parziale (`where status = 'aperto'`) |
| Chi può vedere o scrivere una riga | Row Level Security, policy separata per select/insert/update/delete |
| Una regola troppo complessa per un vincolo | funzione + trigger, mai codice applicativo |

**Perché**: la schermata è attraversata solo da chi la usa come previsto. Il database è attraversato da tutto — app, migrazioni, correzioni manuali, strumenti futuri. Un invariante che non è nel database non è un invariante: è una speranza.

**Conseguenza operativa**: quando progetto una funzionalità, prima scrivo i vincoli, poi il codice. Se non so esprimere una regola come vincolo, è segno che non ho capito la regola.

### Livello 2 — L'unità di scrittura

**Regola vincolante**:

> Nel codice applicativo è **vietato** eseguire due scritture consecutive che devono riuscire o fallire insieme.

In pratica, per ogni operazione mi chiedo: *"se il tablet si spegnesse fra la prima e la seconda scrittura, il dato resterebbe sensato?"*

- **Sì** → la scrittura può stare nel client, diretta, con la RLS come barriera.
- **No** → l'operazione è **una funzione SQL**, e il client la chiama una volta sola.

Casi che ricadono sempre nella seconda categoria, per esperienza già pagata su questo progetto:
- scrittura su più tabelle (conto + registro sconti, documento + task, cessione + prezzo);
- scrittura che genera un effetto collaterale altrove (un promemoria in Agenda, un movimento di cassa, un lotto di magazzino);
- chiusura di uno stato che ha una controparte (un task da chiudere, un articolo da marcare acquistato);
- qualunque cosa tocchi denaro, fisco, lavoro o HACCP — anche se oggi sembra una tabella sola.

### Livello 3 — Ciò che il database non può contenere

Tre cose stanno fuori da Postgres per necessità, non per scelta. Per ognuna, il contratto.

**a) Segreti, webhook in ingresso, lavori pianificati → Edge Function**
Una chiave che non deve mai raggiungere il browser (API esterne, token bot, client secret OAuth) vive nelle variabili d'ambiente della funzione. Un webhook esterno arriva a una funzione, non al browser.

**b) Hardware — stampanti di reparto, registratore telematico → agente sul mini-PC**
Il browser non può e non deve parlare con una stampante di rete o con un RT. Il collegamento è fisico e locale.

**c) File → Supabase Storage**
Lo storage **non partecipa alle transazioni del database**. È l'unica incoerenza strutturale che non si può eliminare, quindi si governa con una regola d'ordine (§4.3).

### Livello 4 — Il client non contiene logica di integrità

Il codice del browser può fare tre cose e nient'altro:

1. leggere;
2. scrivere **una** riga in **una** tabella, quando questo non ha conseguenze altrove;
3. chiamare **una** funzione.

Non compone operazioni. Non decide permessi (li mostra soltanto). Non ingoia errori: se qualcosa fallisce, si vede.

---

## 3. Contratto delle funzioni SQL

Ogni funzione che orchestra una scrittura rispetta questa struttura, nell'ordine:

```sql
create or replace function verbo_oggetto(p_...)
returns <id o void>
language plpgsql
security definer            -- oppure invoker, MA con commento che spiega perché
set search_path = public
as $$
begin
  -- 1. AUTORIZZAZIONE — per prima, sempre. Mai fidarsi della schermata.
  if not is_titolare() then
    raise exception 'Solo il titolare può ...';
  end if;

  -- 2. VALIDAZIONE — messaggi leggibili da chi li legge davvero:
  --    un cameriere durante il servizio, non uno sviluppatore.
  if p_quantita is null or p_quantita <= 0 then
    raise exception 'La quantità deve essere maggiore di zero';
  end if;

  -- 3. SCRITTURE — tutte qui dentro, quindi tutte nella stessa transazione.
end;
$$;
```

Regole aggiuntive, non negoziabili:

- **`security definer` implica `set search_path = public`.** Senza, è un vettore di scalata di privilegi.
- **`security invoker` va commentato.** È l'eccezione (serve quando la RLS del chiamante deve applicarsi); senza commento, fra un anno sembra una dimenticanza e qualcuno la "corregge".
- **La funzione è autosufficiente**: non presuppone che il client abbia già controllato qualcosa.
- **Nome**: inglese, `snake_case`, verbo + oggetto (`close_order_as_gift`, non `order_gift_handler`).
- **Restituisce** l'id o la riga quando il client ne ha bisogno subito, altrimenti `void`.

---

## 4. Le tre eccezioni oneste, e come si governano

Un documento di architettura che non dichiara i propri limiti è pubblicità. Questi sono i punti dove la garanzia non è totale, e la regola che li rende comunque sicuri.

### 4.1 Chiamate a servizi esterni dentro una transazione

Una funzione non deve chiamare un servizio esterno (Telegram, un'API) nel mezzo delle sue scritture: se la transazione viene annullata, il messaggio è già partito e non si riprende indietro.

**Regola**: la funzione scrive il fatto nel database; l'invio parte **dopo**, da un trigger o da un lavoro pianificato che legge quel fatto. Il messaggio può ripartire; una transazione annullata non può essere richiamata.

### 4.2 Hardware: il pattern della coda

Una comanda non deve poter fallire perché la stampante è spenta, e una stampante spenta non deve poter far perdere la comanda.

**Regola**: l'app scrive la richiesta di stampa in una tabella (una coda). L'agente sul mini-PC la legge, stampa, e segna l'esito. Se la stampante è offline la riga resta in coda con il suo stato, visibile. Nessuna attesa sincrona, nessun dato perso, e lo stato è ispezionabile invece che intuibile.

### 4.3 File: ordine obbligatorio

Storage e database non condividono la transazione. Quindi:

- **Creazione**: prima il file, poi la riga. Se la riga fallisce resta un file orfano — invisibile, innocuo, ripulibile.
- **Cancellazione**: prima la riga, poi il file. Mai il contrario: un file cancellato con la riga ancora presente produce un documento che l'app mostra e non si apre.
- **La verità è la riga**, mai il contenuto della cartella.

---

## 5. Cosa mi impegno a fare prima di scrivere qualunque funzionalità

Quattro domande. Se anche una sola risposta è "non lo so", non scrivo codice.

1. **Quali invarianti ha questo dato?** → diventano vincoli del database, prima del codice.
2. **Questa operazione scrive in più punti?** → allora è una funzione, non una sequenza.
3. **Chi ha diritto di farla, e dove è controllato?** → nel database (RLS o funzione), non nella schermata.
4. **Se si interrompe a metà, cosa resta?** → se la risposta non è "niente" o "uno stato sensato", il disegno è sbagliato e va rifatto prima di iniziare.

E, a valle: nessuna funzionalità è "fatta" senza verifica dal vivo con i due ruoli reali. Questo era già un protocollo e resta.

---

## 6. Come questa regola smette di dipendere dalla mia memoria

La disciplina si degrada, l'automazione no. Tre misure, in ordine di efficacia:

1. **Questo documento è richiamato in `CLAUDE.md`**, che viene letto all'avvio di ogni sessione: la regola arriva prima del codice, non dopo.
2. **Controllo automatico nel gancio pre-commit**: un modulo di `src/lib/api/` che contiene due scritture (`insert`/`update`/`delete`/`rpc`) dentro la stessa funzione viene segnalato e il commit si ferma. È un'euristica, non una prova — ma trasforma "ricordarsi" in "essere fermati". *(da implementare, §7)*
3. **Le migrazioni che introducono un invariante devono provarlo violandolo** dentro la migrazione stessa, come già fatto per il vincolo "un solo conto aperto per tavolo": si tenta l'operazione vietata e si verifica di essere respinti. Un vincolo che non si è visto rifiutare qualcosa non è verificato.

---

## 7. Piano di rientro sui sei casi esistenti

Ordine per danno potenziale, non per comodità.

| # | Operazione | Diventa | Danno oggi se si interrompe | Tempo |
|---|---|---|---|---|
| 1 | Chiusura conto come sconto/omaggio | `close_order_as_discount_gift` | Omaggio registrato in cassa, tavolo ancora aperto. Tocca il registro rilevante per il TD27 | 2,5-3 h |
| 2 | Cessione intercompany + costo ingrediente | `register_intercompany_cession` | Cessione fra le due entità senza l'aggiornamento che la giustifica — materia fiscale | 1,5-2 h |
| 3 | Documento + file + task di scadenza | `create_document` / `delete_document` + regola §4.3 | Documento che l'app mostra e non si apre, o file orfano | 3-4 h |
| 4 | Fattura fornitore + task, pagamento + chiusura task | `create_supplier_invoice`, `pay_supplier_invoice` | Fattura senza promemoria o pagata con promemoria aperto | 1,5-2 h |
| 5 | Cancellazione dipendente / documento + task | `delete_employee`, `delete_employee_document` | Task chiusi di un dipendente che esiste ancora | 1,5-2 h |
| 6 | Deduzione fiscale + task | `create_deductible_expense` | Impatto minore, stessa famiglia | 1 h |
| 7 | Gancio pre-commit che rileva le doppie scritture (§6.2) | — | Che il difetto si ripresenti | 1-1,5 h |

**Totale: 13-16 ore.** Ogni voce comprende migrazione idempotente con blocco di verifica, adeguamento del modulo frontend, prova dal vivo con entrambi i ruoli.

---

## 8. Cosa questo documento non cambia

Per chiarezza, e per non lasciare aspettative sbagliate:

- **Non introduce un server Node.** Non perché sia stato escluso a priori, ma perché nessuno dei problemi qui elencati si risolve aggiungendolo: le transazioni le dà Postgres, e un server che parlasse a Supabase via REST avrebbe lo stesso identico difetto che stiamo correggendo. Un server con connessione diretta al database darebbe le transazioni, ma scavalcherebbe la RLS e imporrebbe di riscrivere in Node tutti i controlli di permesso che oggi sono nel database e sono stati verificati uno per uno.
- **Il mini-PC nel locale resta necessario e previsto**, per l'hardware. È l'unico componente per cui non esiste alternativa.
- **Non riscrive ciò che è già corretto**: le sette funzioni SQL esistenti rispettano già questo contratto.
