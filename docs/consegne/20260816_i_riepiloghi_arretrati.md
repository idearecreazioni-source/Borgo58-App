# Consegna del 16/08/2026 (seconda) — gli arretrati, e la rete

**Commit della consegna: `833f9a5`** (questo riepilogo è il commit
immediatamente sopra, sola documentazione). Working tree pulito.

| Commit | Cosa |
|---|---|
| `750a0a6` | le due cifre delle imposte — migrazione `20260816000002` |
| `833f9a5` | i riepiloghi arretrati, e la rete perché non si ripeta |

⚠️ **`20260816000002` è committata ma NON ancora applicata in produzione**
(aspetta il push di Alessio). I numeri veri dell'applicazione vanno in
coda a questo file, in §5, subito dopo. La versione è già nominata qui
sopra, quindi la rete descritta in §3 non la considera scoperta.

⚠️ Questa consegna **non modifica** `docs/CONTRATTO.md`.

---

## 1. Gli arretrati, e come sono stati rilevati

**Non li ho visti io.** Il validatore ha contato quattro commit usciti
senza riepilogo il 15/08 — `06f5152`, `17e4161`, `d06c32a`, `a565379` —
**due dei quali con una migrazione già applicata in produzione**
(`20260815000006` alle 21:35, `20260816000001` alle 22:30).

L'eccezione d'emergenza di `CLAUDE.md` §2 **non si applicava**: quella
copre il caso in cui Alessio è bloccato dal vivo su un difetto già in
produzione. Qui era lavoro nuovo, e una funzionalità che non esiste ancora
non blocca nessuno.

**Tre riepiloghi postumi**, dichiarati tali in testa al file:
- `20260815_la_sezione_personale.md` → `06f5152`, `17e4161`
- `20260815_le_causali_di_sistema.md` → `d06c32a`
- `20260816_incassato_e_scontrinato.md` → `a565379`

---

## 2. Perché è successo, senza attenuanti e senza giri

La regola c'era, ed era **un'intenzione**. Ha retto per quattro consegne e
si è sciolta alla quinta, dopo nove ore di lavoro continuato: ho chiesto
il push per applicare la migrazione successiva e non mi sono fermato a
scrivere il documento.

*È la stessa forma di tutti i controlli che questo progetto ha già
sostituito con dell'automazione* — il lint a zero, la verifica dentro le
migrazioni, il divieto di applicare ciò che non è passato dalla prova. La
differenza è che quelli fermano il programma e questo no.

---

## 3. La rete

`npm run migra` e `npm run funzione` **si rifiutano di toccare la
produzione** finché esiste una migrazione già applicata che nessun file di
`docs/consegne/` nomina. Stessa forma e stesso punto della rete che già
impedisce di applicare ciò che non è passato dal progetto di prova.

⚠️ **Controlla ciò che è GIÀ applicato, non ciò che sta per esserlo**, ed è
la scelta che rende la rete usabile invece che aggirabile. Il riepilogo
contiene i **numeri veri** dell'applicazione — quante migrazioni ci sono
adesso, quanti avvisi sono partiti, cosa dice il connettore — che si
conoscono solo dopo. Pretenderlo prima costringerebbe a scrivere un
documento con dei buchi da riempire, cioè a fingere. Così invece **il
debito non può accumularsi**: la volta dopo non si applica niente finché
la precedente non è documentata. La finestra scoperta è quella fra
l'applicazione e la scrittura, cioè minuti.

⚠️ **Soglia dichiarata, e non è comodità.** Il controllo cerca il numero di
versione **completo** dentro i riepiloghi. Le migrazioni fino al 09/08
precedono la convenzione stessa (nata il 10/08); quelle fra il 10/08 e il
15/08 **sono documentate** ma i riepiloghi le nominano in forma abbreviata
(«…09», «…14»). Applicare il controllo all'indietro produrrebbe **62 falsi
allarmi**, e un controllo che grida sempre viene spento al primo uso —
che è il modo in cui muoiono i controlli. Vale da `20260815000006` in
avanti, ed è una costante col suo perché accanto in `scripts/comune.mjs`.

**Da qui in avanti: il numero di versione va scritto per intero nel
riepilogo.**

`npm run consegne` mostra lo stato senza aspettare il blocco.

### Quello che la rete NON copre, detto per intero

⚠️ **Una consegna di solo codice, senza migrazioni, può ancora uscire
senza riepilogo.** `migra.mjs` e `funzione.mjs` sono i punti in cui io
tocco la produzione; il sito invece lo pubblica il `git push` di Alessio,
che non passa da nessuno script mio e non deve. Due dei quattro commit
arretrati (`17e4161`, `d06c32a`) erano proprio di quel tipo.

È un residuo reale e lo dichiaro invece di lasciarlo intendere coperto. È
però il caso **meno grave**: un cambiamento di codice pushato resta
leggibile su GitHub da chiunque controlli, mentre una migrazione applicata
e non documentata cambia il database vero e **non si ricostruisce da
fuori**.

---

## 4. Le due cifre delle imposte (`750a0a6`)

Decisione di Alessio del 16/08, dopo una discussione in cui **aveva
ragione lui sul problema**: *«non dovrebbe considerare i conti non
scontrinati nelle previsioni finché non vengono regolarizzati, altrimenti
nel frattempo mi fornirebbero uno specchio della situazione errato»*.

⚠️ **Togliere quei conti dai RICAVI sarebbe stato peggio**: da quello
stesso numero escono lo scontrino medio, il **food cost in percentuale** —
quello che gli interessa di più — e tutto lo scostamento dal piano. Ricavi
ridotti li avrebbero falsati tutti e tre, e un food cost calcolato su
ricavi parziali sembra altissimo: manderebbe a cercare un problema in
cucina che non esiste. Lo specchio si sarebbe storto dall'altra parte, su
più schermate invece che su una.

⚠️ **E una seconda ragione, detta e accettata**: un numero che **migliora
quando non si emette un documento** è un incentivo messo dentro lo
strumento.

**Soluzione scelta: si sdoppia sulle imposte, non sui ricavi.** Due cifre
affiancate — su tutto l'incassato e sul solo fiscalizzato — e la vera sta
in mezzo finché i conti in sospeso non sono regolarizzati. Con il
collegamento all'elenco dei conti da sistemare, perché un avviso senza
porta non è una lista di lavoro. Il riquadro **compare solo quando c'è del
sospeso**.

⚠️ **Il motore fiscale resta uno solo**: qui non si calcola nessuna
imposta, `calcola_imposte()` viene chiamata **due volte** con due basi
diverse. E la verifica lo controlla confrontando le due cifre con la
funzione chiamata direttamente — se un domani qualcuno ci scrivesse dentro
un calcolo proprio, quel controllo diventerebbe rosso.

### ⚠️ Una trappola chiusa, ed è la quarta volta che si presenta

`fiscal_settings` ha **una riga in produzione** e **nessuna sul progetto di
prova** — quelle righe le crea Alessio dal Simulatore, non una migrazione.

Alla prima stesura la verifica **saltava** i controlli fiscali quando la
riga mancava. Vuol dire che tutta la parte sulle imposte avrebbe girato
**per la prima volta in produzione**: la prova sarebbe stata su uno stato
di partenza diverso da quello vero **esattamente nel punto rilevante** —
la stessa lezione del 12/08, del 14/08 e del 15/08.

Ora, se la riga manca, la verifica **se ne crea una temporanea e la toglie
alla fine**; se c'è, è di Alessio e non viene toccata in nessun punto. Il
controllo finale verifica che sia tornata com'era in entrambi i casi.

---

## 5. Verifica

| Cosa | Stato |
|---|---|
| `20260816000002` sul progetto di prova | **applicata tre volte**: idempotente |
| …e la parte fiscale è stata **davvero** esercitata | **sì**, con la riga temporanea (prima veniva saltata) |
| le due cifre differiscono quando c'è del sospeso | **provato** |
| …e coincidono quando tutto è regolarizzato | **provato** |
| le due cifre coincidono col motore fiscale unico | **provato** confrontando con `calcola_imposte()` |
| i ricavi non fiscalizzati si leggono dai conti chiusi | **provato** |
| lo staff respinto su entrambe le funzioni nuove | **provato col token vero** |
| la rete dei riepiloghi scatta su una versione non nominata | **provato** |
| …e ignora quelle sotto la soglia | **provato** |
| `npm run consegne` sullo stato attuale | **nessun arretrato** |
| prove automatiche | **92 verdi** (erano 90) + **14 pure** |
| lint, build | puliti |
| residui sul progetto di prova | **zero**, `fiscal_settings` tornata a zero righe |
| **produzione** | **108 migrazioni** — `20260816000002` **non ancora applicata** |

### Dopo l'applicazione in produzione — compilata

`20260816000002` applicata il 16/08/2026. Letto col connettore in sola
lettura, non dedotto dall'uscita della migrazione:

| Cosa | Stato |
|---|---|
| migrazioni in produzione | **109** |
| avvisi partiti durante l'applicazione | **zero** |
| residui della verifica (conti di prova) | **zero** |
| `fiscal_settings` | **1 riga**, quella della S.r.l.s. — intatta |
| elenco anonimi · `security definer` senza portiere | **12** · **13**, invariati |
| conti incassati ancora senza documento | **1** (Divano 3 del 15/08) |

⚠️ **La riga dei parametri fiscali è quella di Alessio e non è stata
toccata**: il ramo della verifica che ne crea una temporanea non è stato
percorso qui, perché in produzione la riga esiste. È stato percorso sul
progetto di prova, che è il motivo per cui esiste.

⚠️ **Il riquadro delle due cifre ora ha dati veri su cui comparire**: c'è
una previsione caricata e un conto incassato senza documento. Non è ancora
stato aperto da nessuno.

---

## 6. Cosa NON è verificato

- ⚠️ **Il riquadro delle due cifre non l'ha visto nessuno**: compare solo
  quando c'è del sospeso **e** quando c'è una previsione selezionata in
  «Come sta andando». In produzione la previsione c'è (caricata da Alessio
  il 15/08) e un conto in sospeso pure, quindi dovrebbe comparire — ma non
  è stato aperto.
- **La parte fiscale in produzione non è ancora stata toccata**: la
  migrazione non è applicata.
- **Il residuo di processo di §3** — le consegne di solo codice — resta
  scoperto dalla rete e coperto solo dalla regola.
- Tutto il resto come dichiarato nei riepiloghi delle consegne precedenti.
