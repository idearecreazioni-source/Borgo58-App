# Consegna del 12/08/2026 — chi applica le migrazioni (modifica al Contratto)

**Commit della consegna: `9fbadad`** (questo riepilogo è il commit
immediatamente sopra, sola documentazione). Working tree pulito.

**Questa consegna modifica `docs/CONTRATTO.md` §8.** Te la segnalo per
prima perché è l'unica cosa che leggerai oggi che non è codice.

---

## 1. Cosa ha deciso Alessio, e in risposta a cosa

Le migrazioni di produzione **le applica la sessione Code**. Non più lui,
copiando l'SQL nell'SQL Editor della dashboard.

L'origine non è una preferenza: è che la pratica si è rotta tre volte in
mezz'ora, sotto i miei occhi.

1. Gli avevo dato un comando PowerShell per copiare un file negli
   appunti: **l'ha incollato nell'SQL Editor** — due finestre nere,
   nessun motivo evidente per distinguerle.
2. Gli ho dato il file per intero in chat: **la copia è arrivata
   troncata**, 270 righe, errore di stringa non terminata.
3. L'ho spezzato in due pezzi corti: ha funzionato.

Il terzo tentativo funziona ma non scala: significa che ogni migrazione
futura è una sequenza di passaggi manuali in cui un pezzo può sparire
senza che se ne accorga nessuno.

**Gli ho posto la raccomandazione contraria dentro la scelta stessa**
(«toglie il tuo passaggio di controllo … non te lo consiglio») e l'ha
respinta. È la sua decisione e il registro la ricorda.

Va aggiunto che **la premessa tecnica della regola vecchia era comunque
scaduta**: il Contratto diceva «MCP/CLI non funzionanti sulla sua
macchina», ma PostgreSQL 17 è installato dal 10/08 per la copia di
sicurezza e per il progetto di prova.

---

## 2. Cosa si perde — non lo giro in positivo

La regola vecchia non era burocrazia. Era **il punto in cui un errore
della sessione IA si fermava davanti a un essere umano prima di toccare i
dati veri.** Quel punto non esiste più.

Non c'è un modo per dire questa cosa che la renda innocua, e non ci provo.

---

## 3. Cosa lo sostituisce — controlli, non promesse

Cinque buone intenzioni scritte in un documento sarebbero state peggio di
niente: le intenzioni si degradano, i controlli no (§5 di `CLAUDE.md`).
Quindi `npm run migra`, e ciò che conta sono i suoi rifiuti:

| Vincolo | Cosa fa |
|---|---|
| **Mai in produzione ciò che non è passato dalla prova** | ogni migrazione mancante deve risultare in `applied_migrations` del progetto di prova, o si ferma |
| **Solo file committati** | una migrazione con modifiche non committate non entra: ciò che gira in produzione dev'essere ciò che tu puoi leggere su GitHub |
| **Il database giusto** | *pretende* il progetto vero in `DB_URL_PRODUZIONE` e lo *rifiuta* in `DB_URL_PROVA` — barriera speculare a `soloProva()`: un `.env.db` compilato male applicherebbe tutto al progetto sbagliato lasciando la produzione indietro, **e sembrerebbe riuscito** |
| **Sola lettura per difetto** | senza `--conferma` mostra soltanto cosa farebbe |

Il primo è quello che conta davvero: rende impossibile *«la provo
direttamente in produzione, tanto è piccola»*, che è la scorciatoia con
cui questa modifica al Contratto diventerebbe pericolosa.

Il comando **non registra nulla da sé** in `applied_migrations`: lo fa
ogni migrazione come ultima istruzione (§7.4). Se una gira senza
registrarsi, viene riproposta al giro dopo — sono idempotenti — e il
resoconto finale distingue *«applicate e registrate»* da *«girate senza
registrarsi»*, invece di dire «fatto».

**Barriere provate accendendole**, non leggendole: migrazione finta mai
passata dalla prova → fermato al vincolo 1; la stessa registrata in prova
ma non committata → fermato al vincolo 2. File e riga di prova rimossi
subito dopo, zero residui verificati.

---

## 4. Cosa NON è cambiato

- **Il `git push` resta di Alessio.** È il solo passaggio fra un mio
  commit e il sito pubblico, e non l'ho toccato.
- **Le Edge Function le installa ancora lui**: manca una chiave d'accesso
  Supabase sulla macchina. Non gliel'ho proposta come dettaglio tecnico:
  quella chiave aprirebbe **l'intero account**, cancellazione dei progetti
  compresa. È una decisione separata e più grossa di questa, e va posta
  come tale il giorno che servirà.
- **PIN e password**: mai io.

---

## 5. Verifica

| Cosa | Stato |
|---|---|
| produzione allineata | **verificata**: 63 migrazioni nel repository, 63 applicate, zero mancanti |
| vincolo «passata dalla prova» | **provato**: ferma |
| vincolo «committata» | **provato**: ferma |
| pulizia della prova delle barriere | **verificata**: zero residui su disco e in `applied_migrations` |
| `CONTRATTO.md` §8 e `CLAUDE.md` §2 | riscritti, con dentro cosa si è perso |
| lint, prove di unità, build | puliti |

**Non ancora usato in produzione**: `npm run migra --conferma` non ha mai
applicato niente di vero — le due migrazioni di oggi le ha applicate
Alessio a mano, prima della decisione. La prima applicazione vera sarà
la prossima migrazione, e te la riporterò coi numeri.
