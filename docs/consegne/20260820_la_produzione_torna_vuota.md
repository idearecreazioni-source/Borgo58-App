# La produzione torna vuota — preparata, non applicata

**20/08/2026** · Code → validatore · blocco D del mandato della serata

- **HEAD dichiarato**: `c3ab27cedc8fd27e60e57a282b052eca2629a3fb`
- **Working tree**: pulito
- **Migrazione**: `20260820000012_la_produzione_torna_vuota.sql` — 🔴 **NON
  applicata, e non va applicata di sera**
- **Provata**: sul progetto di prova, **ricostruito da zero** con tutte e 162
  le migrazioni in fila

---

## Cosa abbiamo rovesciato

**Niente.** Nessuna decisione presa prima è stata ribaltata.

Il riquadro c'è lo stesso anche quando è vuoto, per il precedente del
riepilogo del Magazzino.

---

## 🔴 Tre numeri del mandato non tornavano. Il mandato diceva di fermarsi e dirlo

| il mandato diceva | ho misurato | cos'era |
|---|---|---|
| reservations 16, **3 confermate future** (20, 21, 23/08) | 16, **4** confermate future | il **21/08 ne ha due**: erano contate le *date*, non le righe |
| **8** allarmi `rincaro_*` | **7** | uno in meno, e i 5 `scadenze_*` tornano |
| gli impegni di Alessio: 6 nominati | **8** | ce n'è uno che il mandato non nomina: *«Tassa di concessione governativa libri sociali»* |

⚠️ **Nessuno dei tre cambia il perimetro** — sono tutti conteggi, non voci
diverse — ma li dichiaro invece di adattare il codice in silenzio. E il terzo
conta più degli altri: quell'impegno **non si tocca**, e sarebbe stato l'unico
a rischio se avessi cancellato per elenco invece che per meccanismo.

Tutti gli altri numeri del mandato tornano **esatti**, compresi i 18 «cosa non
si tocca».

---

## Come si riconosce cosa va via

🔴 **Per MECCANISMO, non per parola chiave**, ed è la richiesta esplicita del
mandato. Gli impegni generati sono quelli con `origine_modulo` valorizzato:

- `archivio_documenti` → **7** («Scadenza documento: …»)
- `posta` → **5** (i due della locazione + tre «Pagamento fattura Bonaccorsi»)
- **vuoto → 8**, e sono di Alessio: diritto camerale, deposito e approvazione
  bilancio, dominio, firma digitale, titolare effettivo, domicilio digitale,
  tassa libri sociali. **Nessuno di questi si tocca**, e dentro ci sono importi
  e codici F24.

⚠️ Cancellare «i *Scadenza documento:* …» per titolo avrebbe funzionato oggi e
sarebbe stato sbagliato domani: il titolo lo decide chi scrive la mail.

---

## L'ordine, e i due punti in cui sbagliarlo NON dà errore

1. **gli scarichi PRIMA dei conti** — `stock_consumptions.order_id` è
   `set null`: cancellando i conti per primi il legame si azzera **in
   silenzio**, e poi gli ingredienti restano bloccati (`restrict`) senza che
   niente spieghi perché. 🔴 **È il motivo per cui l'ordine scritto in
   `collaudo-stato.mjs` non arrivava in fondo**, corretto in questo commit;
2. **la posta PRIMA dei documenti** — `documento_id` è `set null` in due
   tabelle: invertendo si perde quale mail aveva prodotto quale documento.

Gli altri passi falliscono rumorosamente, che è il caso facile.

### 🔴 E un terzo l'ho sbagliato io, e me l'ha detto il database

La prima versione cancellava `order_items` **prima** di `orders`, e un trigger
l'ha respinta: *«Questo conto è già chiuso: non si può togliere. Il totale su
cui hai incassato non deve cambiare dopo.»*

⚠️ **La cura non era spegnere quel trigger.** Il ramo che serve **c'è già
dentro di lui**, e la sua ragione — scritta mesi fa — nomina esattamente
questo lavoro: *«se il conto stesso sta sparendo, le sue righe se ne vanno con
lui… senza questo ramo la prima a restarne prigioniera sarebbe la pulizia dei
dati di collaudo che Alessio deve fare prima della prima fattura vera»*.

Basta cancellare **il conto**: righe, tavoli, pagamenti, anomalie e
segnalazioni fiscali scendono in cascata (misurato: tutte `on delete cascade`).

---

## 🔴 Il guardiano che era una fotografia, trovato dalla ricostruzione da zero

Avevo scritto un controllo che pretendeva che esistesse ancora
`lavoro_fermo_lettura_posta`, **l'avviso vero del 12/08**. In produzione è
giusto. Ma su un database appena costruito **quell'avviso non c'è mai stato** —
è un fatto storico, non qualcosa che le migrazioni creano — e la catena delle
162 migrazioni **si spezzava all'ultima**.

Era **una fotografia della produzione travestita da regola**: la trappola del
16/08, *«questo guardiano dice come deve essere fatto il mondo, o com'era il
mondo quando l'ho guardato?»*.

La proprietà vera è un'altra: **questa pulizia non deve togliere nessun avviso
che non sia di collaudo** — si contano prima e dopo, e su un database vuoto
sono zero e zero. Vera dappertutto.

⚠️ **A trovarlo non è stata una rilettura**: è stata la ricostruzione da zero,
che nessuno mi aveva chiesto di fare e che serviva per avere un Ricettario
vuoto su cui provare.

---

## La pulizia si FERMA se il perimetro non è quello previsto

Questa migrazione toglie gli **ingredienti**, e il mandato l'ha scritta
sapendo che in produzione **le ricette sono zero**. Il giorno che ce ne fosse
una, quegli ingredienti sarebbero i suoi.

Quindi: **se trova anche una sola ricetta, non tocca niente** e lo dice. ⚠️ E
si ferma **prima** di cominciare, non a metà: *una pulizia interrotta in mezzo
lascia uno stato che nessuno ha voluto.*

Sul progetto di prova il messaggio è arrivato davvero: *«Ci sono 9 ricette:
questa pulizia è stata scritta per un Ricettario VUOTO…»*.

---

## Cosa sorveglia, e perché non è prudenza generica

**18 conteggi fotografati prima e riconfrontati dopo**, e se anche uno solo è
cambiato la migrazione **fallisce nominando quale**. Dentro ci sono la pianta
della sala, i formati dei tavoli, le 14 disposizioni giornaliere (che sono la
sala **reale**), le 17 causali, la Previsione congelata, i parametri fiscali,
i lavori sorvegliati e gli 8 impegni di Alessio.

⚠️ *Dire solo «qualcosa non torna» costringerebbe a rifare la misura da capo*:
il messaggio dice **quale** conteggio è cambiato, da quanto a quanto.

E due controlli finali: il residuo di collaudo è andato via **per intero** (9
tabelle sommate a zero), e il registro delle cancellazioni **non si è
accorciato** — se si fosse accorciato, qualcuno avrebbe tolto delle lapidi.

---

## Le due cose che non tornano come prima

- **`documents` è una tabella tracciata**: i 10 documenti lasciano **10 righe**
  nel registro delle cancellazioni, che **nessuno può ripulire dall'app**. È
  previsto, e per questo il controllo **non** pretende che le lapidi siano le
  stesse — sarebbe falso — ma solo che non siano **diminuite**.
- **Alessio non conserva nell'app i quattro documenti veri** (atto notarile,
  partita IVA, contratto di locazione, business plan): li tiene altrove e li
  ricaricherà ad app finita. È una sua decisione esplicita del 20/08.

🔴 **E qui c'è una cosa che il mandato non poteva sapere**, saltata fuori dal
blocco A: **due dei tre file orfani nel deposito sono la partita IVA e il
contratto di locazione**. Sono **fuori dal database** e questa migrazione non
li tocca — li toglie `npm run deposito:orfani`. ⚠️ **Vanno nominati ad Alessio
prima**, perché sono documenti veri e il deposito è l'unico posto dove il
gestionale ce li ha.

---

## Fuori dal database

- **`/prova-voce` è stata TOLTA** (rotta, import e file): era usa-e-getta e ha
  già servito.
- **`scripts/collaudo-stato.mjs`**: l'ordine di cancellazione è stato riscritto
  con quello vero, e ora rimanda alla migrazione invece di far togliere a mano.
  🔴 Cominciava dai conti, quindi **non arrivava in fondo**.
- **I 13 file del deposito** restano: li toglie `npm run deposito:orfani`, dopo
  il backup.

---

## I numeri

| | |
|---|---|
| prove pure | **168 passate**, 0 saltate |
| prove sui dati veri | **292 passate**, **0 saltate** |
| lint | zero avvisi |
| migrazioni sul progetto di prova | **162**, applicate **da zero in fila** |
| migrazioni in produzione | **158**, invariate |

⚠️ **Le 162 applicate da zero valgono più del numero**: è la prova che la
catena regge dall'inizio — cosa che nessuno verifica finché non serve, e serve
nel giorno peggiore.

---

## 🔴 Cosa deve succedere PRIMA di applicarla, in quest'ordine

1. Alessio pusha;
2. **`npm run backup`** — quello che va via non torna;
3. Alessio **conferma** di avere ancora scaricabili i quattro documenti veri,
   e in particolare i due che stanno **solo** nel deposito (vedi sopra);
4. `npm run migra -- --conferma`;
5. `npm run deposito:orfani -- --conferma` per i file;
6. riepilogo coi numeri veri dopo.

⚠️ **Il punto 3 non è una formalità**: dopo il 4 e il 5, di quei documenti nel
gestionale non resta niente — solo la copia jsonb nel registro delle
cancellazioni, che non contiene il file.

---

## Cosa NON è verificato

- 🔴 **La migrazione non è mai girata su dati veri**: sul progetto di prova ha
  girato su un database appena costruito, dove quasi tutte le tabelle erano
  vuote. **I 18 guardiani non sono mai stati messi alla prova con numeri
  diversi da zero.**
- **Il residuo che toglie è stato misurato, non cancellato**: i conteggi di
  questo riepilogo vengono dalla produzione in sola lettura.
- **Nessuna mano ha guardato l'app dopo la pulizia**: che il gestionale si apra
  senza errori con tutte le tabelle vuote è una cosa che va vista.

---

## DA CONFERMARE AD ALESSIO

1. **I due documenti veri nel deposito** — la **partita IVA** e il **contratto
   di locazione** stanno lì e in nessun'altra parte del gestionale. *Se li hai
   altrove*: si tolgono col resto. *Se no*: vanno scaricati prima, e dopo la
   pulizia non si recuperano.
2. **Le 4 prenotazioni confermate future** (20, 21 e 23 agosto) hanno nomi da
   collaudo — «Matio», «Alessio», «Test» — e due sono a orari impossibili
   (04:00, 14:59). Le do per finte. *Se una fosse vera*, dimmelo prima: dopo
   la pulizia non c'è più nessun modo di sapere che qualcuno aveva prenotato.
