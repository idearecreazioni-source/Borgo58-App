# Consegna del 14/08/2026 (ottava) — risposta al referto di validazione

**Commit della consegna: `39ba0e4`** (questo riepilogo è il commit
immediatamente sopra, sola documentazione). Working tree pulito.

| Commit | Cosa |
|---|---|
| `0b29f31` | i due rilievi 🟡, chiusi |
| `39ba0e4` | **il Contratto allineato al codice** — autorizzato da Alessio |

**Nessuna migrazione.** Produzione invariata: **92 migrazioni**, elenco
anonimi **12**, `security definer` senza portiere **14**.

⚠️ **Questa consegna modifica `docs/CONTRATTO.md`.** È dichiarato qui in
testa perché è la condizione che Alessio ha posto autorizzandola (§4).

---

## 1. Le due domande dirette — risposte da Alessio, non da me

**La regola d'emergenza sul push è sua.** Gliel'ho posta come scelta fra
tre strade — scriverla, non ammetterla mai, o ammetterla solo per le
correzioni — e ha scelto lui la prima. Alla domanda esplicita del
validatore ha risposto **«fatto»**, cioè confermato.

Il rilievo era giusto a prescindere dalla risposta, e va scritto: *il
modo più economico di rendere lecita una violazione è riscrivere la
regola*. Che l'eccezione sia delimitata bene non basta a renderla
legittima — deve essere di chi ha l'autorità, e sentita fuori dal
documento che la contiene.

**I due impegni riaperti è stato lui.** Ha premuto «rimetti da fare» sui
due che aveva chiuso, subito dopo che il riepilogo era stato scritto —
cioè ha fatto **proprio la prova che quel riepilogo dichiarava mai fatta
da una mano vera**. Niente li ha riaperti da solo.

---

## 2. 🟡 CLAUDE.md si contraddiceva sulla regola del push — chiuso

A §2 l'eccezione era scritta come decisa; in coda al mandato cumulativo
sopravviveva la riga 🔵 che la dichiarava ancora aperta. Fra un mese non
si sarebbe capito quale valesse.

Ora in coda resta **solo il rimando a §2**: una regola che vive in due
posti prima o poi ne dice due versioni. È la stessa forma di difetto del
fornitore che stava sul prodotto e sulla riga della lista — due posti per
la stessa informazione.

---

## 3. 🟡 I numeri dell'Agenda non erano più quelli veri — chiuso

`CLAUDE.md` diceva «20 impegni, 2 fatti, 4 senza scadenza»; il connettore
dice **20, tutti da fare, 5 senza scadenza**. Corretto — e **scritto
perché**: senza la spiegazione, il numero da solo sembrerebbe un errore,
mentre è la traccia della prima prova dal vivo del «rimetti da fare».

---

## 4. Il Contratto allineato al codice

Il documento descriveva ancora `closeOrderAsDiscountGift` come difetto 🟠
**aperto**, «da correggere prima che il modulo Comande venga considerato
chiuso». È stato corretto il **09/08**: client → `eseguiOperazione()` →
Edge Function `operazioni-atomiche` → **una sola** funzione Postgres, con
le due scritture nella stessa transazione.

**Il testo originale resta come citazione**: è l'origine della decisione,
e cancellarlo renderebbe illeggibile perché il corridoio esiste.

Aggiunte due cose che il referto ha messo in chiaro:

- **come la correzione poteva fallire restando formalmente conforme**:
  due chiamate reincollate lato server invece di una funzione sola;
- ⚠️ **che la stessa forma di difetto tornerà nella Sala**: assegnare una
  prenotazione tocca la prenotazione **e** le righe dei tavoli — due
  tabelle, quindi corridoio **obbligatorio**. Per contro, un'operazione
  su più righe di **una sola** tabella (`completa_task`, `riapri_task`)
  resta Categoria A e la RPC diretta è corretta: **a rendere necessario
  il corridoio è la seconda tabella, non il numero di righe**.

### La condizione posta da Alessio, e perché conta

Autorizzando, ha aggiunto: *«purché il validatore venga sempre
informato»*. Scritta in `CLAUDE.md` §6 come regola permanente: **ogni
modifica del Contratto va sempre dichiarata al validatore**, in un commit
suo e nel riepilogo, nominandola.

Il motivo è ovvio quando lo si scrive, e vale la pena scriverlo: un
documento che è **l'autorità sull'architettura**, modificato da chi la
deve rispettare, senza che chi controlla lo sappia, smette di essere
un'autorità. È la stessa preoccupazione del rilievo sul push, applicata
al livello sopra.

---

## 5. Il rilievo di merito, messo a verbale e non fatto

`tasks` non sa **quando** un impegno è stato fatto: la sezione «Fatti di
recente» mostra `updated_at`, che risponde a *«l'ultima volta che
qualcuno ha toccato la riga»* — un'altra domanda.

Con venti impegni è debito accettabile. Ma in quella tabella ci sono **gli
adempimenti societari con importi e codici F24**: il giorno in cui serve
dire quando un adempimento è stato assolto — davanti a Laura, o peggio —
quella data non risponde. **Costa una colonna oggi e un problema fra un
anno.**

Scritto in `CLAUDE.md` §10 come debito dichiarato. **Non fatto qui**: non
è di questa consegna, e infilarlo senza una decisione su cosa deve
significare esattamente «fatto il» sarebbe la fretta che questo progetto
evita.

---

## 6. Verifica

| Cosa | Stato |
|---|---|
| lint, build, prove automatiche | **46 verdi**, puliti |
| **produzione** | **92 migrazioni**, invariata |
| elenco anonimi · `security definer` senza portiere | **12** · **14**, invariati |
| modifiche al database | **nessuna** |
| modifiche al codice dell'app | **nessuna** |
| file toccati | `CLAUDE.md`, `docs/CONTRATTO.md`, questo riepilogo |

---

## 7. Cosa NON è stato fatto

- **La colonna della data di chiusura** (§5): dichiarata, non costruita.
- **Il blocco Sala non è iniziato**: la nota sul corridoio obbligatorio è
  un promemoria dentro il Contratto, non codice.
- **Restano aperti quattro blocchi** del mandato cumulativo — cantina,
  resa al posto dello scarto, tracciabilità a valle, Fatture in Cloud
  (che aspetta l'attivazione di Alessio) — più la voce, che dipende dal
  Ricettario. **Del mandato «Ricettario Fase 1» manca il documento**:
  non è sul Desktop e non è nel repository.
- **Il Ricettario è ancora vuoto**, quindi Produzioni e scarico del
  magazzino restano funzionanti e senza niente da fare.
