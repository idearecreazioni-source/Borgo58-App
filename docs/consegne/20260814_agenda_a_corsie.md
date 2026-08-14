# Consegna del 14/08/2026 (sesta) — l'Agenda a corsie

**Commit della consegna: `9ad74c2`** (questo riepilogo è il commit
immediatamente sopra, sola documentazione). Working tree pulito.

| Commit | Cosa |
|---|---|
| `0b946c6` | l'Agenda a corsie — migrazione `20260814000005` |
| `9ad74c2` | stato della produzione dopo l'applicazione |

**Applicata in produzione**: `20260814000005`. **91 migrazioni**. Nessuna
funzione online reinstallata.

È il **Blocco 1 del mandato cumulativo** del 14/08. Nello stesso commit
è entrata anche la **regola d'emergenza sul push** (§5 qui sotto), che il
mandato lasciava come decisione aperta.

---

## 1. Cosa c'era davvero, letto prima di toccare

Col connettore, prima di scrivere una riga:

- **20 impegni** in tutto;
- **5 senza scadenza** — in un elenco ordinato per data finiscono in
  fondo e non li guarda più nessuno: erano invisibili;
- **quattro convenzioni diverse** per la categoria su venti righe:
  `Adempimenti societari`, `Documenti`, `amministrativo`, e vuoto.

---

## 2. Le categorie si chiudono senza rompere nessun modulo

La categoria la scrivono **cinque posti**: Archivio documenti, Posta,
Proiezione fiscale, Personale e Alessio a mano. Mettere un vincolo e
basta avrebbe rotto quattro flussi che oggi funzionano.

Quindi **prima la regola, poi il vincolo**: un trigger normalizza ciò che
arriva (`categoria_task()`), e solo dopo il `check` pretende un valore
dell'elenco chiuso. Chi scrive continua a scrivere come sa, e **una
quinta convenzione non può nascere** — automazione al posto della
disciplina (§5), non una convenzione da ricordare.

⚠️ **Ciò che non si sa dove mettere finisce in «altro», non nella casella
più probabile.** Sotto `amministrativo` in produzione convivevano
pagamenti di fatture e date di locazione: si è collocato solo ciò che il
**titolo** dichiara (fattura/pagamento → *fornitori e pagamenti*), il
resto è rimasto dichiaratamente incerto. Una classificazione plausibile e
sbagliata si legge come vera.

**Risultato sui dati veri**: 7 documenti · 7 fisco e scadenze · 3
fornitori e pagamenti · **3 in «altro»** (le due date di locazione e
l'intestazione del dominio). Si spostano a mano.

---

## 3. L'urgenza la dice la data

I tre livelli di priorità erano **dichiarati a mano**, e su venti righe
valevano `alta` per tutti gli adempimenti societari e `media` per tutto
il resto: **non distinguevano niente**. Spariscono dalle schermate.

Resta **una stella** per «questo per me conta», che è un'altra cosa e non
si può calcolare.

⚠️ La colonna `priority` **non è stata cancellata**: è `not null` e alcuni
moduli la scrivono ancora. Toglierla è un lavoro a sé, da fare quando
nessuno la scrive più. Dichiarato, non fatto.

---

## 4. Le corsie, e perché le calcola il database

In ritardo (sparisce se vuota) · questa settimana per giorno, con *Oggi*
e *Domani* scritti così · più avanti a fisarmonica per mese · quando
capita.

La corsia la decide `agenda_corsie()`, **non la schermata**: il badge del
modulo e la lista devono contare la stessa cosa, ed è la lezione dei
rincari, dove schermo e Telegram dicevano due numeri diversi.

⚠️ **Le date sono locali.** «Oggi» calcolato in UTC, fra mezzanotte e le
due, è ieri: un impegno di stasera risulterebbe scaduto mentre il locale
è ancora aperto. Trappola già costata 14 punti nell'audit dell'08/08.

⚠️ **«Quando capita» non deve diventare un cimitero**: ogni riga porta da
quanti giorni è lì, e quella corsia **non entra mai nel badge**. Il badge
conta **solo ritardo + oggi** — un numero fermo su venti smette di essere
un'informazione e si impara a ignorarlo, come il triangolo degli avvisi
prima che i rincari avessero un titolo loro.

**Tre gesti dalla lista**: fatto, rimanda, dagli una data. Aprire una
scheda per spuntare una casella è il motivo per cui le liste non si
tengono aggiornate.

**Ricorrenze**: chiudendo un impegno che torna ne nasce subito il
successivo, **nella stessa transazione** — se la chiusura passasse e la
rigenerazione no, un adempimento annuale sparirebbe per riapparire l'anno
dopo come una dimenticanza. E la data nuova si conta **dalla scadenza,
non da oggi**: chiuderlo in ritardo non deve spostare in avanti tutti gli
anni successivi.

---

## 5. La regola d'emergenza sul push, chiusa

Il mandato la lasciava aperta: *«un'eccezione non scritta si allarga da
sola»*. **Decisione di Alessio**: si scrive.

Ora in `CLAUDE.md` §2: **quando Alessio è bloccato dal vivo su un difetto
già in produzione, il push parte subito e il riepilogo arriva appena
finito**, dichiarando quali commit sono usciti prima e perché. **Non vale
per il lavoro nuovo** — una funzionalità che non esiste ancora non può
bloccare nessuno. Il riepilogo arretrato si scrive **nella stessa
sessione**.

---

## 6. Due difetti trovati correggendo

1. **Il PDF degli adempimenti per il commercialista** filtrava sulla
   dicitura vecchia (`Adempimenti societari`). Senza la riga cambiata
   sarebbe uscito **vuoto** — e un PDF vuoto è credibile.
2. ⚠️ **Una verifica tarata sui dati veri.** Il primo tentativo pretendeva
   «5 impegni senza scadenza», che è il numero della **produzione** e non
   del progetto di prova: è fallita lì, ed è la lezione del 12/08 al
   contrario (quella volta passò dove non doveva). Ora verifica la
   **regola** — nessun impegno senza data resta fuori dalla sua corsia —
   e vale su qualunque database.

---

## 7. Verifica

| Cosa | Stato |
|---|---|
| la migrazione sul progetto di prova | **applicata due volte**: idempotente |
| nessuna categoria libera sopravvissuta | **provato** |
| il trigger traduce una convenzione vecchia | **provato** |
| una categoria sconosciuta finisce in «altro» | **provato** |
| le quattro corsie coi casi veri | **provato** |
| l'anzianità di una voce ferma da 90 giorni | **provato** |
| **nessun impegno senza data fuori da «quando capita»** | **provato** (regola, non conteggio) |
| il badge conta ritardo + oggi, e **non** «quando capita» | **provato** |
| la stella arriva in lista | **provato** |
| una ricorrenza chiusa genera la successiva **alla sua data** | **provato** |
| chiuderla due volte | **rifiutato** |
| un impegno completato esce dalle corsie | **provato** |
| **lo staff non vede gli impegni riservati** (§3.18) | **provato** |
| elenco anonimi | **12**, controllato dentro la migrazione |
| prove automatiche | **46 verdi** |
| lint, build | puliti |
| **produzione** | **91 migrazioni** |
| `security definer` senza portiere | **14**, invariato |
| dati veri dopo la migrazione | **20 impegni, 5 senza data, 0 residui** |

---

## 8. Cosa NON è verificato, e lo dico chiaro

- **Nessuno ha ancora guardato la schermata nuova.** È il primo lavoro di
  questa serie che si può giudicare subito, perché i dati veri ci sono
  già — ma al momento di scrivere questo riepilogo Alessio non l'ha
  aperta.
- **Le ricorrenze non esistono su nessun impegno vero**: il campo è nuovo
  e vuoto ovunque. La rigenerazione è provata solo dentro la migrazione.
- **La stella non è mai stata usata**, e nessuno ha ancora messo a posto
  i 3 impegni finiti in «altro».
- **La provenienza cliccabile porta al modulo, non al record esatto**:
  `origine_modulo` dice *da dove*, non *quale riga*. Aprire il documento
  preciso richiederebbe un riferimento che oggi non c'è — dichiarato, non
  fatto.
- **Nessuna prova automatica copre l'Agenda lato applicazione**: la suite
  resta a 46. Le verifiche sono quelle dentro la migrazione.
- **`priority` è ancora scritta da alcuni moduli** e resta in tabella,
  ora senza significato nelle schermate: è debito dichiarato.
