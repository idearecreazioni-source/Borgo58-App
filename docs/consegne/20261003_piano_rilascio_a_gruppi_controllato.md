# Piano di rilascio a gruppi, per una mano umana — solo documento

**03/10/2026** · mandato M24-C · ramo `claude/piano-rilascio-a-gruppi` ·
base `slave` `d83edcb` · `master` `896a883`

> 🔴 **È UN PIANO, NON UN'AUTORIZZAZIONE E NON UN RESOCONTO.** Nessuna
> migrazione è stata applicata, nessun gruppo è partito, nessun collegamento
> è stato aperto. Oggi **nessun gruppo può partire** (matrice finale): mancano
> quattro misure reali e cinque decisioni operative, e lo strumento che
> applicherebbe le migrazioni non è autorizzato da nessun mandato.

Fonti, tutte già tracciate in `slave`:

- le 17 migrazioni in `supabase/migrations/`;
- `scripts/contratto-preflight-rilascio.mjs` — versioni, fasi, esclusa,
  `CONTROLLI_OBBLIGATORI`, `CONDIZIONI_OPERATIVE`;
- `docs/consegne/20260928_piano_pre-produzione_16_migrazioni.md`, con la
  sezione «Controlli obbligatori e condizioni operative» (M24-B);
- `scripts/migra.mjs` per il comportamento documentato dello strumento.

Questo documento **non sostituisce** il piano del 28/09 né il contratto: li
divide in passi più piccoli, ciascuno con un punto di arresto.

---

## 1. Le migrazioni, in ordine

Ultima registrata in produzione secondo il contratto: `20260916000002`.

| # | Versione | Nota |
|---|---|---|
| 0 | `20260929000001` | numero più alto, ma va **per prima**, da sola |
| 1 | `20260917000001` | |
| 2 | `20260919000001` | |
| 3 | `20260920000001` | |
| 4 | `20260920000002` | |
| 5 | `20260920000003` | |
| 6 | `20260920000004` | |
| 7 | `20260920000005` | |
| — | `20260921000001` | 🔴 **ESCLUSA**: non si applica mai; la registra la `20260921000002` |
| 8 | `20260921000002` | |
| 9 | `20260921000003` | |
| 10 | `20260922000001` | |
| 11 | `20260923000001` | |
| 12 | `20260923000002` | |
| 13 | `20260923000003` | |
| 14 | `20260923000004` | |
| 15 | `20260928000001` | |

**Come lo strumento sceglie cosa applicare** (`scripts/migra.mjs`): applica
le mancanti in ordine di numero, ognuna nella propria transazione; sa
**fermare la coda** a una versione (`--fino-a`, compresa) e **togliere** una
versione in mezzo (`--salta`, ripetibile). Una migrazione tenuta indietro
resta mancante e ricompare la volta dopo. Per questo i gruppi qui sotto sono
**tratti consecutivi in ordine di numero**: è la forma che lo strumento sa
scegliere senza aggirare i suoi controlli.

⚠️ **Lo strumento stesso è un punto aperto.** Passa la stringa di
collegamento a `psql` come argomento del processo (`scripts/comune.mjs`,
opzione `-d`), cioè nella forma che il disegno dell'adattatore protetto vieta
per una credenziale. Quale strumento applicherà le migrazioni, e con quale
credenziale, **lo decide una persona in un mandato a parte**: questo piano
non ne autorizza nessuno.

---

## 2. I gruppi e i loro confini

| Gruppo | Versioni | Perché insieme, perché separato |
|---|---|---|
| **G0** | `20260929000001` | Da sola e per prima: la `20260917000001` (riga 171) e la verifica della `20260920000001` (riga 401) pretendono la voce che solo lei crea. |
| **G1** | `20260917000001` → `20260920000002` (4) | **Stessa finestra, consecutive.** La `20260920000001` si verifica solo dopo che la `20260917000001` ha riscritto la funzione dei promemoria (righe 377-383); la `20260920000002` usa gli oggetti della `20260917000001`. Dopo la `20260917000001` parte un lavoro pianificato ogni 5 minuti (righe 769-773), e senza la `20260920000002` i promemoria girano col tempo massimo predefinito, che su Prova ha prodotto un falso «non arrivato» (commento alla riga 135 della `20260920000002`). Prima del gruppo: la funzione online `notify-telegram-reservation` già installata (righe 77-94 della `20260917000001`). |
| **G2** | `20260920000003` → `20260920000005` (3) | **Stessa finestra, consecutive.** La `20260920000004` pretende i corpi lasciati dalla `20260920000002` e dalla `20260920000003` (righe 63-72); la `20260920000005` si ferma se un solo impegno ha un sollecito impostato (righe 157-160), quindi deve seguire subito la `20260920000004`. Tutte e tre scrivono e cancellano impegni veri. |
| **G3** | `20260921000002` | Da sola, **con la `20260921000001` saltata**. Riscrive la funzione della posta senza guardia preventiva, e registra l'esclusa dopo la propria verifica. |
| **G4** | `20260921000003` | Da sola: due controlli nuovi su ogni scrittura di cassa e anticipazioni, e un vincolo controllato su tutta la tabella dei movimenti. |
| **G5** | `20260922000001` → `20260923000002` (3) | **Stessa finestra, consecutive, mai interrotte fra la prima e la seconda.** La `20260922000001` ricrea la vista dei costi per riga **senza** la protezione per ruolo (riga 1052), e solo la `20260923000001` la rimette (riga 55). La `20260923000002` usa le colonne e il trigger introdotti dalla `20260922000001`. |
| **G6** | `20260923000003` → `20260923000004` (2) | **Stessa finestra, consecutive.** La `20260923000003` crea due vincoli senza la frase italiana; la `20260923000004` gliela dà (righe 123-133 della `20260923000004`). |
| **G7** | `20260928000001` | Da sola: un indice costruito senza la modalità che lascia scrivere gli altri, sul registro delle cancellazioni. |

**Fra un gruppo e l'altro** ci si può fermare: ogni migrazione è una
transazione a sé, e un gruppo concluso resta concluso.

⚠️ **Ciò che nessun sorgente garantisce: il sito vecchio davanti a un
database a metà.** Il piano del 28/09 tiene il sito nuovo fermo fino alla
fine; quindi fra un gruppo e l'altro gira il sito di `master` contro un
database parzialmente aggiornato. Alcune migrazioni lo prevedono per sé (la
`20260922000001` dichiara una tolleranza per il sito vecchio, righe 169-177 e
484-494). **In generale non è verificato**: se la pausa fra i gruppi dura più
di una finestra, la compatibilità di ciascuno stato intermedio va provata su
Prova prima. Altrimenti i gruppi vanno fatti tutti nella stessa finestra.

---

## 3. Gruppo per gruppo

Valgono per **tutti** i gruppi, e non si ripetono sotto:

- **Precondizioni comuni**: le 17 migrazioni su `master` (lo strumento rifiuta
  ciò che non è su `origin/master`); le 17 registrate su Prova; nessuna corsa
  GitHub, prova o migrazione in esecuzione; nessun uso del gestionale durante
  la finestra; il sito nuovo **non** pubblicato; un mandato che autorizzi
  **quel** gruppo.
- **Risultato osservabile comune**: le versioni del gruppo registrate, e
  nessun'altra; nessun allarme nuovo; le lapidi nel registro delle
  cancellazioni contate prima e dopo, e uguali.
- **Stop comuni**: una guardia o una verifica si ferma; l'elenco in sola
  lettura non è esattamente il gruppo atteso; un'applicazione resta in
  attesa di un blocco; arriva un allarme.
- **Mai, come correzione autonoma**: rilanciare; riscrivere una migrazione
  già scritta; applicare SQL a mano; spostare o rinominare file per cambiare
  l'elenco; spegnere una guardia; sostituire lo strumento con un collegamento
  diretto; toccare il Vault o le funzioni online fuori dal mandato.

### G0 — `20260929000001`

- **Precondizioni**: comuni.
- **Copia**: copia di sicurezza della produzione fatta prima, in questa
  finestra.
- **Protezioni**: nessuna oltre alle comuni.
- **Risultato prima di G1**: la migrazione registrata; il suo messaggio dice
  se ha creato la voce o se c'era già, senza mostrarne il valore.
- **Stop**: si ferma perché la voce c'è ma è diversa, è doppia, o la chiave da
  cui la ricava manca o non è leggibile (righe 63-101). **Si ferma tutto: G1
  non parte.**

### G1 — `20260917000001` → `20260920000002`

- **Precondizioni**: controllo obbligatorio
  `funzioni_che_nominano_la_produzione` verde; `soggetti_e_utenti_presenti`
  verde (titolare e staff, per la `20260919000001`);
  `modulo_di_rete_con_tempo_massimo` verde; la funzione online
  `notify-telegram-reservation` già installata, **da un mandato a parte**.
- **Copia**: la stessa di G0 se nella stessa finestra, altrimenti una nuova.
- **Protezioni**: le quattro nella stessa finestra, senza pause.
- **Risultato prima di G2**: esistono le tabelle degli invii e delle
  consegne e quella dei silenzi; il lavoro pianificato degli esiti risulta
  pianificato e iscritto fra i lavori sorvegliati; nessuna funzione nomina
  più il progetto di produzione.
- **Stop**: la `20260917000001` si ferma sulla guardia del corpo vivo o delle
  colonne del modulo di rete; la verifica della `20260920000001` nomina una
  funzione rimasta; un allarme su Telegram durante o subito dopo.

### G2 — `20260920000003` → `20260920000005`

- **Precondizioni**: G1 concluso; `soggetti_e_utenti_presenti` verde
  (titolare).
- **Copia**: quella della finestra.
- **Protezioni**: nessuno usa l'agenda durante il gruppo; le tre nella stessa
  finestra.
- **Risultato prima di G3**: le colonne del sollecito sui compiti esistono,
  e nessun impegno ha un sollecito impostato.
- **Stop**: la guardia della `20260920000004` non riconosce i corpi lasciati
  dalla `20260920000002` e dalla `20260920000003`; la `20260920000005` trova
  un impegno sollecitato.

### G3 — `20260921000002` (con la `20260921000001` saltata)

- **Precondizioni**: G2 concluso; il corpo vivo della funzione della posta è
  ancora quello misurato il 28/09 (da rimisurare: la misura è vecchia).
- **Copia**: quella della finestra.
- **Protezioni**: la `20260921000001` **saltata esplicitamente**; nessuna
  lettura della posta in corso.
- **Risultato prima di G4**: la `20260921000001` e la `20260921000002`
  risultano registrate tutte e due.
- **Stop**: l'elenco in sola lettura contiene la `20260921000001`; la verifica
  non trova nel corpo nuovo le parti attese (righe 497-517).

### G4 — `20260921000003`

- **Precondizioni**: G3 concluso; `soggetti_e_utenti_presenti` verde (soggetti
  `srls`, `tasca`, `azienda_agricola` e titolare); esiste una causale di
  uscita normale attiva e una di sistema (righe 610-616) — **misura in sola
  lettura non ancora prevista dal contratto**.
- **Copia**: quella della finestra.
- **Protezioni**: nessuna scrittura in cassa o nelle anticipazioni durante il
  gruppo.
- **Risultato prima di G5**: le colonne dell'investimento esistono, nessuna
  riga marcata, i due controlli attivi.
- **Stop**: la verifica non trova i soggetti o le causali.

### G5 — `20260922000001` → `20260923000002`

- **Precondizioni**: G4 concluso; condizione operativa
  `storico_dei_costi_riga_per_riga` risolta: una strategia di ripristino
  **già verificata**, non solo una copia fatta; condizione
  `finestra_della_vista_dei_costi` risolta: una protezione decisa per il
  tempo fra la `20260922000001` e la `20260923000001`.
- **Copia**: una copia **nuova**, subito prima del gruppo, e la prova che si
  ripristina.
- **Protezioni**: nessuno collegato come staff durante il gruppo; nessuna
  modifica alle ricette; le tre senza nessuna interruzione fra la prima e la
  seconda.
- **Risultato prima di G6**: la vista dei costi per riga ha di nuovo la
  protezione per ruolo; il costo di ogni ricetta non si è spostato (lo
  controlla la verifica della `20260922000001`).
- **Stop**: la sanatoria trova righe in cui il lordo non riproduce lo scarto
  (righe 299-327); il costo di una ricetta cambia (righe 1076-1078); la
  `20260923000001` non parte subito dopo — in quel caso la vista resta senza
  protezione, e **la decisione su cosa fare è umana**.

### G6 — `20260923000003` → `20260923000004`

- **Precondizioni**: G5 concluso; `soggetti_e_utenti_presenti` verde
  (titolare, `srls`, `azienda_agricola`); `vincoli_senza_frase` verde; nessun
  conto del 1996 senza documento (riga 511) — **misura in sola lettura non
  ancora prevista dal contratto**.
- **Copia**: quella della finestra.
- **Protezioni**: le due nella stessa finestra.
- **Risultato prima di G7**: la tabella delle chiusure annuali esiste; nessun
  vincolo senza frase.
- **Stop**: la verifica della `20260923000004` nomina un vincolo muto.

### G7 — `20260928000001`

- **Precondizioni**: G6 concluso; nessuna cancellazione in corso nel
  gestionale.
- **Copia**: quella della finestra.
- **Protezioni**: condizione `nessun_tempo_massimo_sui_blocchi`: qualcuno pronto
  a interrompere se l'indice resta in attesa.
- **Risultato finale**: le 17 registrate (comprese l'esclusa e la
  `20260929000001`), l'indice esiste ed è valido.
- **Stop**: la verifica non trova l'indice usato dal pianificatore.

**Dopo G7, e solo dopo**: l'approvazione della pubblicazione del sito nuovo,
in un mandato a parte; poi il riepilogo del rilascio con tutte le versioni
per intero e i numeri veri.

---

## 4. I quattro controlli obbligatori — non ancora misurati

Dal contratto (`CONTROLLI_OBBLIGATORI`). **Nessuno è stato eseguito.**

| Controllo | Serve a | Stato |
|---|---|---|
| `funzioni_che_nominano_la_produzione` | G1 | non misurato |
| `vincoli_senza_frase` | G6 | non misurato |
| `soggetti_e_utenti_presenti` | G1, G4, G6 | non misurato |
| `modulo_di_rete_con_tempo_massimo` | G1 | non misurato |

🔴 **Bloccante**: misurarli richiede un accesso in sola lettura alla
produzione. L'identità dedicata non esiste (proposta n. 153, non applicata) e
l'adattatore protetto è fermo. **Chi misura, e con quale accesso, è una
decisione umana.**

Due misure in più, trovate scrivendo questo piano e **non** ancora nel
contratto: le causali di uscita per G4 (righe 610-616 della
`20260921000003`) e i conti del 1996 per G6 (riga 511 della
`20260923000003`).

---

## 5. Le cinque condizioni operative — non ancora risolte

Dal contratto (`CONDIZIONI_OPERATIVE`). **Nessuna ha una risposta scritta.**

| Condizione | Riguarda | Chi decide |
|---|---|---|
| `esclusa_resta_esclusa` | G3 | è già nel contratto; va rispettata a ogni elenco |
| `finestra_della_vista_dei_costi` | G5 | una persona: quale protezione per quel tempo |
| `nessun_tempo_massimo_sui_blocchi` | tutti, soprattutto G4, G5, G7 | una persona: interrompere a mano, o cambiare lo strumento con un mandato a parte |
| `storico_dei_costi_riga_per_riga` | G5 | una persona: quale ripristino, e la prova che funziona |
| `righe_temporanee_nell_agenda` | G2 | una persona: accettare che le verifiche scrivano e cancellino impegni veri, o no |

---

## 6. Matrice: può partire / non può partire

**Oggi nessun gruppo è autorizzato.**

| Gruppo | Mandato che lo autorizza | Controlli obbligatori | Condizioni operative | Strumento e accesso decisi | Può partire? |
|---|---|---|---|---|---|
| G0 | ❌ | — | — | ❌ | **NO** |
| G1 | ❌ | ❌ 3 non misurati | — | ❌ | **NO** |
| G2 | ❌ | ❌ 1 non misurato | ❌ `righe_temporanee_nell_agenda` | ❌ | **NO** |
| G3 | ❌ | — | ⚠️ `esclusa_resta_esclusa` da rispettare | ❌ | **NO** |
| G4 | ❌ | ❌ 1 non misurato, più le causali | ❌ `nessun_tempo_massimo_sui_blocchi` | ❌ | **NO** |
| G5 | ❌ | — | ❌ `finestra_della_vista_dei_costi`, `storico_dei_costi_riga_per_riga` | ❌ | **NO** |
| G6 | ❌ | ❌ 2 non misurati, più i conti del 1996 | — | ❌ | **NO** |
| G7 | ❌ | — | ❌ `nessun_tempo_massimo_sui_blocchi` | ❌ | **NO** |

In più, per tutti: `master` non contiene ancora le 17 migrazioni, e la
copia di sicurezza della finestra non esiste.

## Cosa non è verificato

- Ogni affermazione sullo stato della produzione: questo piano legge solo i
  sorgenti.
- Lo stato delle 17 migrazioni su Prova.
- La compatibilità del sito vecchio con ciascuno stato intermedio.
- La durata di qualunque gruppo: **nessun tempo è stimato**, apposta.

## Cosa abbiamo rovesciato

Niente. Il piano del 28/09 applicava le 15 applicabili in un solo giro;
questo le divide in gruppi consecutivi **senza cambiare l'ordine**, e dice
quali gruppi non possono essere interrotti.
