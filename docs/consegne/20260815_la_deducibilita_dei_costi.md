# Consegna del 15/08/2026 (terza) — la deducibilità dei costi

**Commit della consegna: `81bc196`** (questo riepilogo è il commit
immediatamente sopra, sola documentazione). Working tree pulito.

| Commit | Cosa |
|---|---|
| `d812cd0` | il mandato «personale e tesoreria» entra nel repository |
| `6a00b0f` | il raccoglitore unico dei quesiti per i consulenti |
| `64cfea6` | applicare al progetto di prova diventa un comando |
| `821cb8b` | l'attributo di deducibilità — migrazione `20260815000002` |
| `b351cce` | le schermate, e il calcolo che se ne va dal bundle |
| `81bc196` | `CLAUDE.md`: la deducibilità, e chi comanda sui ricavi |

**Applicata in produzione**: `20260815000002`. **103 migrazioni.**
Il corridoio `operazioni-atomiche` **non** è stato toccato (resta **v22**):
questo blocco non aggiunge nessuna operazione multi-tabella.

È il **§9 del mandato «personale e tesoreria»**, il lavoro trasversale —
primo blocco consegnato, nell'ordine consigliato dal mandato stesso
(§9 → Blocco 6 → 7 → 5 → 4 → 1 e 2 quando Gianna risponde).

⚠️ **Questa consegna NON modifica `docs/CONTRATTO.md`**, come il mandato
impone (§10 punto 9). Nessuna riga è risultata non più vera.

---

## 1. Due commit che vengono prima del codice

**Il mandato non era nel repository.** Stessa cosa del 15/08 con la rotta
economica: un mandato che vive solo sul Desktop di Alessio è un mandato
che chi controlla non può vedere, e il confronto fra consegnato e
richiesto diventa un atto di fiducia nel mio riassunto. Entrato per primo,
senza toccarne il testo.

⚠️ **Sulla normalizzazione della cartella chiesta insieme: non c'era
niente da normalizzare.** `docs/mandati/` è già in minuscolo con i nomi
datati dal commit `290b82e` del 14/08, e git la traccia già così. Su
Windows il filesystem è insensibile alle maiuscole e `core.ignorecase` è
`true`: scrivere in `docs/MANDATI/` ha depositato il file nella cartella
esistente senza crearne una seconda. Verificato con `git ls-files`, non
dedotto dal listato della shell — nessun `git mv`, perché non c'era nessun
rename da fare.

**Il raccoglitore dei quesiti** (`docs/quesiti/QUESITI_CONSULENTI.md`): 31
domande, ordinate per destinatario e dentro per urgenza, **senza nessun
importo** perché il repository è pubblico. Quelle già esistenti sono state
**raccolte dal repository e non riscritte a memoria** — l'IRAP dal referto
del 13/08, gli omaggi dalla schermata Sconti, le ferie dal referto, la
privacy dall'informativa pubblica, le date societarie dalla migrazione
dell'Agenda del 2 agosto.

⚠️ **Ogni voce porta un «Dove vive» col file preciso**, e il motivo è
concreto: sparse in una dozzina di posti, il problema non era trovarle —
era che la risposta, quando arriva, **non torna indietro nel punto che
l'aspettava**. La schermata continua a scrivere «da validare con Laura»
per sempre.

⚠️ **Gli identificativi sono stabili e l'ordine no**: `ScontiOmaggi.jsx`
cita «domanda L1» dentro il testo che legge Alessio, quindi rinumerare per
rispettare l'ordine per urgenza avrebbe rotto un rimando già in
produzione.

---

## 2. Assorbe, non affianca — la scoperta che ha deciso il blocco

Il mandato chiede l'attributo come lavoro trasversale, e con una frase
precisa: *«va costruito una volta sola»*.

**Le regole di deducibilità esistevano già.** Stavano in
`src/lib/constants.js` dentro `DEDUCTION_CATEGORIES` — percentuali (75%
trasferte), plafond rappresentanza, regola contanti — col calcolo in
`src/lib/deducibility.js`. Sopra quell'elenco c'era scritto, testualmente,
**«unica fonte di verità»**.

Costruire l'attributo del mandato accanto a quell'elenco avrebbe dato al
gestionale **due risposte alla stessa domanda** — «questa spesa è
deducibile?» — e nessun modo di sapere quale credere. È la stessa
situazione di stanotte col Simulatore fiscale, che calcolava IRES e IRAP
in JavaScript dentro la schermata.

⚠️ **E c'è un motivo in più che vale da solo**: quelle percentuali sono
**oggetto dei quesiti L4 e L9** appena scritti per Laura. Un parametro che
aspetta la risposta di un consulente non può vivere in un file sorgente —
il giorno che lei risponde, cambiarlo sarebbe un deploy invece che un
campo.

**Scelta: assorbe.** Tabella `regole_deducibilita` e funzione
`quota_deducibile()` nel database, governate da Alessio. `deducibility.js`
è stato **rimosso**, non lasciato lì; le tre costanti sono sparite da
`constants.js`. Anche `ProiezioneFiscaleHome` ricalcolava il totale
deducibile per conto proprio: ora lo chiede al database.

---

## 3. Le risposte sono tre, non due — ed è il cuore del blocco

Un costo può essere **deducibile** (in tutto o in parte), **indeducibile**,
oppure **non classificato: nessuno l'ha ancora detto**.

⚠️ Se il valore predefinito fosse «deducibile», la stima delle imposte
sarebbe più bassa del vero **sempre nella stessa direzione** — la stessa
forma dello scarto a zero, dell'elenco allergeni vuoto e della
maxi-deduzione accesa di partenza. Se fosse «indeducibile», sarebbe più
alta, sempre. **Nessuna delle due è una stima**: sono un numero storto con
l'aria di essere un dato.

Quindi la colonna nasce `null` — lezione del 14/08, quando un `not null
default false` rispose al posto di Alessio su nove scostamenti che aveva
appena creato — e chi legge riceve i due numeri **separati**: quanto è
classificato, e quanto no. Il non classificato **non entra né fra i
deducibili né nella rettifica**, e la schermata mostra l'elenco di cosa
manca: un rimprovero senza porta non è una lista di lavoro.

⚠️ **L'avvertenza esce dal database insieme al numero**, come per
`calcola_imposte()`: un avviso che vive nel testo di *una* schermata non
protegge la seconda schermata che mostra lo stesso numero.

⚠️ **«Senza documento» viene PRIMA di ogni regola**, dentro il calcolo e
non nella schermata (criterio 4 del mandato). Se fosse solo questione di
scegliere la regola giusta, prima o poi qualcuno assegnerebbe
«interamente deducibile» a una spesa senza ricevuta, e nessuno se ne
accorgerebbe.

**La regola si eredita, la scelta vince**: sta sulla **causale** (prima
nota) e sul **fornitore** (fatture), la riga la eredita, una scelta
esplicita sulla riga vince sempre. Classificare a mano ogni movimento è
una cosa che nessuno fa per più di due settimane — stessa forma del
fornitore abituale sul prodotto (14/08).

---

## 4. Cosa NON fa, e perché

- **Non inventa nessun caso.** Le cinque regole seminate sono quelle che
  c'erano già nel codice, con le percentuali **intatte** e `verificata_il`
  **vuota**: nessuno le ha confermate, ed è la verità. Se ne aggiunge una
  sola che non c'era — «Indeducibile» allo 0% — perché senza non si
  potrebbe classificare come indeducibile **niente**. L'elenco dei casi
  veri lo darà Laura (L9).
- **Non tocca `calcola_imposte()`**: il motore unico riceve già un
  imponibile, non un utile. La rettifica si somma prima, da chi calcola
  l'imponibile. Un motore solo resta un motore solo.
- ⚠️ **Non entra ancora nella Proiezione, e non per prudenza.** I costi di
  uno scenario sono righe di **piano senza documento**, la rettifica si
  calcola sui **costi veri**: sommarle conterebbe due volte le stesse
  spese. E oggi, con zero movimenti in produzione, il risultato sarebbe
  **zero** — indistinguibile da «nessuna rettifica necessaria». Si collega
  quando ci saranno costi veri classificati.
- ⚠️ **`rettifiche_fiscali()` non legge `deductible_expenses`**: quella
  tabella non è collegata alla prima nota, quindi una trasferta pagata con
  la carta ci starebbe **due volte**. Il collegamento è il §4a del mandato
  («la voce genera il movimento»), cioè il blocco della **tesoreria**. Il
  perimetro è scritto nella schermata, non lasciato dedurre dal numero.

---

## 5. Conseguenza dichiarata, e un difetto trovato leggendo

**Da oggi una spesa senza riferimento al documento non si deduce nemmeno
nel modulo Deduzioni**, dove prima si deduceva. Non cambia nessun numero
esistente — la tabella è vuota in produzione — ma è un **cambio di
comportamento**, è provato, e la schermata lo dice **prima** di salvare
invece di lasciarlo scoprire dopo.

⚠️ **`RAPPRESENTANZA_PER_PERSON_THRESHOLD` non era letta da nessun
calcolo.** Viveva solo dentro il testo di un campo della schermata
Deduzioni — «N. persone (soglia 50€/pers.)» — che quindi **prometteva una
regola che nessuno applicava**. Non è stata spostata nel database:
sarebbe nata **parametro spento**, la cosa che il 14/08 si è finito di
togliere dalla capienza. Corretto il testo, che ora dice «annotazione».

---

## 6. Due difetti miei, trovati prima di andare avanti

1. **La verifica pretendeva che nessuna regola avesse una data di
   conferma.** Il giorno che Alessio scrive la data di Laura, rieseguire
   la migrazione si sarebbe fermato **su una sua scelta legittima** — è la
   lezione del 14/08, la verifica che si rifiutava di passare per come era
   apparecchiata la sala. Ora guarda le sole righe che **nessuno ha mai
   toccato** (`updated_at = created_at`): un guardiano che è una
   **proprietà dello schema**, non una data o un flag da ricordare.
   Provato simulando la conferma sul progetto di prova, e poi rimesso
   com'era — spegnendo il trigger, perché `set_updated_at` riscriveva la
   traccia della prova stessa.
2. **`soglia_rappresentanza_per_persona` era già stata aggiunta** prima
   che mi accorgessi che nessuno la legge. Tolta dalla migrazione, e
   tolta anche dal progetto di prova per non lasciare i due ambienti
   diversi.

---

## 7. Un comando in più, e il motivo per cui è nel repository

`npm run prova:migra`. Il protocollo §7.7 impone che ogni migrazione passi
prima dal progetto di prova, e `scripts/migra.mjs` si rifiuta di toccare
la produzione se non ce l'ha vista passare — ma **il modo di applicarla lì
era rimasto manuale**: `docs/AMBIENTE_PROVA.md` diceva ancora *«si incolla
nell'SQL Editor del progetto di prova»*, cioè esattamente il gesto che il
12/08 è arrivato troncato a metà e ha fatto cambiare la regola su chi
applica le migrazioni.

Era il primo anello della catena, ed era il più ripetuto: una migrazione
si applica alla prova molte volte, una per ogni correzione più le
riesecuzioni che ne dimostrano l'idempotenza. **Preferire l'automazione
alla disciplina (§5) vale soprattutto sul gesto ripetuto** — e una rete di
sicurezza serve solo se usarla non costa più di saltarla.

Due protezioni nel programma e non nella memoria di chi lancia: si rifiuta
di partire se `DB_URL_PROVA` contiene il riferimento del progetto vero, e
non registra niente da sé in `applied_migrations`.

---

## 8. Verifica

| Cosa | Stato |
|---|---|
| la migrazione sul progetto di prova | **applicata cinque volte**: idempotente |
| calcolo: senza documento, senza regola, parziale, contante, esenzione, zero | **provati uno per uno** |
| l'eredità dalla causale | **provata** (200 al 75% → 150) |
| …e la scelta sulla riga che vince sull'eredità | **provata** (→ 200) |
| il non classificato NON entra fra i deducibili | **provato** |
| …e NON entra nella rettifica | **provato** |
| un costo senza documento produce rettifica e non alza la quota | **provato** |
| l'elenco di cosa manca da classificare | **provato** |
| le spese del modulo Deduzioni valorizzate dal database | **provate**, col motivo |
| lo staff respinto su tutte e quattro le funzioni nuove | **provato** |
| le percentuali spostate dal codice non sono cambiate | **provato** (trasferte 75%) |
| nessuna regola nasce confermata | **provato** |
| …e la migrazione regge se Alessio ne conferma una | **provato simulandolo** |
| prove automatiche | **69 verdi** (erano 61) + **14 pure** |
| lint, build | puliti |
| **produzione** | **103 migrazioni**, corridoio **v22** (non toccato) |
| regole in produzione · non confermate | **6** · **6** |
| causali senza regola · fornitori senza regola | **12** · **2** (stato di partenza voluto) |
| colonna `category` e il suo enum | **rimossi**, 0 · 0 |
| elenco anonimi | **12**, invariato |
| `security definer` senza portiere | **13**, invariato con **4 funzioni nuove** |
| le 4 funzioni nuove eseguibili da `anon` | **0** |
| RLS su `regole_deducibilita` · policy | **accesa** · **1** |
| residui delle verifiche in produzione | **zero**, controllati col connettore |
| avvisi partiti durante l'applicazione | **zero** |

⚠️ **La RLS non si prova dentro una migrazione**: là si gira come
proprietari delle tabelle, e il proprietario la RLS la scavalca. Le prove
automatiche passano da PostgREST col token dello staff, e **creano prima
una riga vera** che lui non deve vedere (§5 punto 2 del protocollo).

---

## 9. Come sono state applicate, per il validatore

Domanda posta durante la consegna, e la risposta vale come dichiarazione
permanente: **il meccanismo è `psql -f`, identico nei due ambienti**, e
non passa mai dal connettore.

- Prova: `npm run prova:migra` → `scripts/prova-migra.mjs`
- Produzione: `npm run migra -- --conferma` → `scripts/migra.mjs`
- Entrambi: `psql -v ON_ERROR_STOP=1 -d <stringa da .env.db> -f <file>`,
  via `strumento("psql")` in `scripts/comune.mjs`.

Il connettore MCP è `read_only=true` (`.mcp.json`, Contratto §8) e serve
solo a **osservare** la produzione prima e dopo.

⚠️ **`supabase_migrations.schema_migrations` non esiste — e non esiste
nemmeno su Prova** (verificato: `relation ... does not exist`). Il flusso
`supabase db push` non è mai stato usato in questo progetto: la CLI
Supabase compare solo in `scripts/funzione.mjs` per le Edge Function, che
non tocca lo schema. **I due ambienti sono coerenti fra loro**, non
divergenti.

Il registro effettivo è `applied_migrations`, e ogni migrazione **si
auto-registra** come ultima istruzione (§7.4): gli script non ci scrivono
mai, così una migrazione che si ferma prima della fine non si registra e
al giro dopo risulta ancora mancante.

**Il punto debole, detto per intero**: il registro è derivato dal *file*,
non dall'applicatore. Un file che dimenticasse la riga di auto-
registrazione verrebbe applicato e non risulterebbe mai. Il guardiano è in
`.githooks/pre-commit`, ma è un `grep`: garantisce che la stringa ci sia,
non che venga eseguita. Il controllo indipendente è dal connettore,
confrontando `applied_migrations` con la cartella — ed è ciò che stampa
`npm run migra` senza `--conferma`.

---

## 10. Una decisione di Alessio, scritta perché non si perda

Gli avevo posto il rischio del **triplo conteggio dei ricavi**. Ha deciso,
ed è in `CLAUDE.md` §6:

- **Comandano i conti chiusi**, unica fonte dei ricavi, perché unica
  scomponibile in piatti, coperti e scontrino medio.
- **La chiusura di serata non aggiunge ricavo**: ripartisce lo stesso
  incasso per mezzo di pagamento e alimenta la **tesoreria**, non il conto
  economico.
- **Il registratore telematico sarà il verificatore fiscale**: il suo
  totale giornaliero si confronta con quello dei conti chiusi e **la
  differenza è un'anomalia da mostrare**, mai una seconda versione da
  tenere. ⚠️ Regola conseguente vincolante per il disegno del Blocco 6:
  **niente si batte sul registratore senza passare da un conto**.

Chiude la domanda che il 14/08 era rimasta aperta in `CLAUDE.md`
(«quando arriverà il registratore telematico va deciso chi comanda»).

---

## 11. Cosa NON è verificato, e lo dico chiaro

- ⚠️ **Nessuno ha ancora aperto le schermate nuove.** I PIN sono suoi:
  `/fiscale/deducibilita`, la Deduzioni riscritta, il menu sulla causale e
  quello sul fornitore **non li ha usati una mano vera**. È il limite più
  grosso di questa consegna.
- ⚠️ **Non può essere visto con dati veri, e non per un difetto**: in
  produzione ci sono **zero** movimenti di prima nota, **zero** fatture
  fornitori e **zero** spese nel modulo Deduzioni. Il cruscotto dirà zero
  ovunque, e non è un guasto.
- **Nessuna regola è confermata da Laura**, quindi ogni schermata scrive
  che sono da confermare. Sparirà quando lui scrive le date (quesiti L4 e
  L9).
- **Nessuna causale e nessun fornitore ha una regola**: finché non gliene
  assegna, ogni costo futuro nascerà «da classificare». È lo stato di
  partenza voluto — il gestionale non ne indovina nessuna — ma vuol dire
  che **l'eredità non è mai stata vista funzionare in produzione**.
- **La rettifica non è collegata alla stima delle imposte** (§4): è un
  lavoro dichiarato, non una dimenticanza.
- **L'IRAP resta il rilievo aperto del referto del 13/08.**
- **I Blocchi 1 e 2 del mandato — il costo del personale — sono fermi in
  attesa di Gianna**, come il mandato impone: non si indovina la forma del
  suo prospetto.
- **I dati di collaudo del magazzino restano in produzione** (deroga del
  13/08, invariata) e `/prova-voce` è ancora lì. In produzione ci sono
  ancora **2 conti** e **2 prenotazioni di prova** della sala: sono righe
  di Alessio, e le toglie lui.
