# La proprietà della stampa, le 87 rotte e la previsione del disegno vecchio
**25/08/2026 — mandato di verifica, quattro blocchi**

> 🔴 **NESSUNA IMMAGINE, PER TUTTA LA CONSEGNA.** Lo screenshot non
> funziona in questo ambiente. Tutto ciò che qui è «visto» è **letto dal
> DOM renderizzato**: i numeri sono misurati davvero, l'aspetto non l'ha
> guardato nessuno. Vale anche per il blocco 4, dove il mandato chiedeva
> di guardare con gli occhi.

Commit sotto questo riepilogo: **b98d72c**

**Migrazioni: nessuna.** Quattro blocchi di misura e una sola modifica di
interfaccia. Niente aspetta un ok, niente cancella o modifica righe
esistenti.

**Tutti e quattro i blocchi sono stati aperti e chiusi.**

---

## Blocco 1 — il preconto a 3,44 mm

Fatto. Il ticket resta a 6,8.

**Verificato su un preconto vero** (costruito un conto di prova,
agganciato a un tavolo, aperto il modale): **3,44 mm su tutti e dieci i
testi**, alle due larghezze. E il **ticket è rimasto a 6,80**.

La ragione è scritta accanto alla regola, con le parole del mandato:
*3,20 è il minimo del progetto, non l'obiettivo, e il preconto è l'unico
documento che finisce in mano a chi non lavora qui.* E che **non è
definitiva** fino alla prova su carta vera.

### Le due regole morte

⚠️ **Erano DUE, non una**: `print:text-[13px]` compariva alle righe 95 e
130 di `PrecontoModal`. Tutt'e due scavalcate da `.testo-sala`, che nel
foglio di stile viene dopo. **Tolte**, non fatte vincere: al loro posto
una classe sola, `.ticket-preconto`.

⚠️ **Il valore era già giusto e non serviva a niente**: 13 punti sulla
carta fanno **esattamente** 3,44 mm. Qualcuno aveva pensato la cosa
giusta, e non ha mai stampato.

---

## Blocco 2 — la proprietà della stampa

> «la taglia di ogni testo stampato è la stessa da qualunque dispositivo
> sia partita la stampa»

### ✅ Dimostrata — ma il sospetto era sulla causa sbagliata

**La base tipografica in centimetri veri NON si muove in stampa.**
Misurato: con `--pxcm` a **64**, in stampa il `body` vale **15,1 punti**
— perché il blocco `@media print` la rifissa in punti. Il sospetto era
ragionevole (l'indizio del 4,23 → 4,00 era vero: quell'elemento ora
eredita la base) e **la misura lo smentisce**.

### 🔴 Ma una taglia cambiava davvero, per un'altra causa

Il **titolo** di tre documenti usciva di due misure diverse:

| documento | finestra 390 | finestra 1265 |
|---|---|---|
| manuale HACCP | **6,35 mm** | **7,94 mm** |
| tracciabilità | **6,35 mm** | **7,94 mm** |
| scadenze da stampare | **6,35 mm** | **7,94 mm** |

La causa è `md:text-3xl` — un **breakpoint responsive**, che guarda la
larghezza della finestra e **non sa niente della carta**. Sullo schermo è
giusto che un titolo cresca; sul foglio no.

Chiuso con `.titolo-documento`, fissata alla taglia **grande** — quella
del computer, da cui questi documenti si stampano.

⚠️ **È una famiglia che la regola del §8 non copriva**: fin qui avevamo
guardato solo le misure in centimetri veri. Un breakpoint rompe la stessa
proprietà per una strada diversa, e adesso è scritto.

### La controprova, documento per documento

Rimisurati **tutti e nove**, applicando le regole `@media print` vere
lette dal foglio di stile, a **390** e **1265** punti. Le taglie in
millimetri di carta:

| documento | 390 punti | 1265 punti | uguale? |
|---|---|---|---|
| manuale HACCP | 3,17×106 · 3,70×259 · 4,00 · 4,76×6 · 7,94 | idem | ✅ |
| registro temperature | 4,00 · 6,35 | idem | ✅ |
| registro pulizia | 4,00 · 6,35 | idem | ✅ |
| registro non conformità | 3,20×6 · 4,00×2 · 6,35 | idem | ✅ |
| registro ricevimento | 3,20×5 · 4,00×2 · 6,35 | idem | ✅ |
| tracciabilità | 4,00×3487 · 7,94 | idem | ✅ |
| scadenze da stampare | 3,17×7 · 3,70×42 · 4,00 · 7,94 | idem | ✅ |
| **preconto** | 3,44×10 | idem | ✅ |
| **ticket cucina** | 5,42×2 · 6,35 · 6,80×5 | idem | ✅ |

**Nessuna taglia cambia.** Accanto alla base c'è scritto **perché è
sicura e come si ridimostra**, senza numeri: *si misura ogni documento
stampabile a due larghezze applicando le regole print vere, e nessuna
taglia deve cambiare.*

---

## Blocco 3 — le 87 rotte, separate

**a + b + c = 87.** Fa 87.

| insieme | quante |
|---|---|
| **(a) misurate a 390 punti veri e sane** | **39** |
| **(b) misurate e corrette** | **34** |
| **(c) mai misurate** | **14** |

### (a) Le 39 sane

Sane **alla prima misura**, senza interventi: Dashboard, Comande, Cucina,
Bar, Scontrini, Cassa, Prima nota, Magazzino, Spesa spicciola, Scadenze,
Ordini, Produzioni, Carico, Fermi, HACCP, Temperature, Pulizia, Non
conformità, Ricevimento, Raccolta propria, Mance, Pianta della sala
**(22)** · le **8 del Ricettario**, corrette *ieri* e sane oggi · e le
**9 misurate adesso** per la prima volta: Deducibilità, Deduzioni,
Catalogo strumenti, Piatti del giorno, Nuova prenotazione, Nuova
previsione, Nuovo menu, Privacy, Prenota — **tutte a zero e zero**.

### (b) Le 34 corrette

Lista spesa, Fornitori, Allineamento, Tracciabilità (×2 rotte), Manuale
HACCP, Sconti e omaggi, Causali, Previsione, Scontrinato, Sezione
personale, Prestiti, Agenda, Nuovo task, Scadenze da stampare, Fatture
fornitori, Calendario Eventi, Clienti, Preventivi, Sala e orari,
Comunicazioni, Proiezione fiscale, Simulatore, Andamento, Le previsioni,
Archivio documenti, Posta, Chiedi all'archivio, Personale, Agricolo,
Cessioni, Editor menu, Bevande e vini, Segnaposto moduli.

### (c) Le 14 mai misurate, e perché

| rotta | perché |
|---|---|
| `*` | non è una schermata: è il catch-all che porta al 404 |
| `/` | è la schermata di **accesso**: ci sono passato entrando, mai misurata col misuratore |
| `/comande/reparti` | **rotta morta per scelta**: reindirizza a `/comande/cucina` dal 09/08 |
| `/agenda/:id` | richiede l'identificativo di un impegno |
| `/calendario-eventi/:id` | richiede una prenotazione |
| `/calendario-eventi/clienti/:id` | richiede un cliente |
| `/calendario-eventi/preventivi/:id` | richiede un preventivo |
| `/documenti/:id` | richiede un documento |
| `/fiscale/previsioni/:id` | richiede una previsione — **aperta nel blocco 4**, ma non misurata col misuratore |
| `/fiscale/previsioni/:id/modifica` | richiede una previsione **non congelata** |
| `/magazzino/fornitori/:id` | richiede un fornitore |
| `/personale/:id` | richiede un dipendente |
| `/ricettario/ingredienti/:id` | richiede un ingrediente |
| `/ricettario/menu/:id` | richiede un menu |

⚠️ **Undici delle quattordici sono schermate di dettaglio con un
parametro**: si aprono solo con un identificativo vero, e ognuna
vorrebbe una riga di dati scelta apposta. Non sono difficili: sono
tredici misure che nessuno ha ancora fatto.

### 🔴 I conteggi di questo mandato sono PAVIMENTI, non totali

In questa consegna la ricerca nel codice mi ha **mancato tre volte** —
`print:text-[13px]`, `print:hidden`, il badge dell'Agenda. Ogni volta
me ne sono accorto misurando invece di rileggere, ma la conseguenza vale
per **tutti** i numeri che ho scritto: *un setaccio trova quello che sa
cercare*. Dove ho scritto «zero», si legga **«zero fra quelli che ho
guardato»**.

---

## Blocco 4 — la Proiezione con una previsione del disegno vecchio

### La premessa del mandato va corretta due volte

🔴 **Primo: sul progetto di prova le linee senza `codice`/`forma`
esistono già.** Misurato: **2 linee su 2**, entrambe con codice, forma e
scala a NULL. La trappola descritta («lì tutte le previsioni sono nate
col disegno nuovo») **non era quella**: quel caso c'era già.

⚠️ Ho costruito lo stesso la riproduzione fedele, perché le due linee
della prova **non sono** le quattro della produzione: nomi diversi,
previsioni **non congelate**, una linea sola per previsione.

### Cosa ho costruito

Sul **progetto di prova** (verificato che lo script punti a
`DB_URL_PROVA`, con la rete `soloProva()` che lo controlla da sé): una
previsione **di partenza, congelata**, con le **quattro linee
accessorie identiche a quelle vere** — nomi, quantità, prezzi e basi
copiati dalla produzione **in sola lettura** — con `codice`, `forma` e
`scala` a **NULL** e **nessuna linea lunch**.

Lo script si ferma se il congelamento non riesce o se qualcuno ha
riempito le tre colonne: *una prova che non riproduce lo stato vero non
prova niente*.

### Le tre risposte

**1. Le quattro righe SPARISCONO — e non finiscono in nessun gruppo.**
Letto il DOM della schermata: `Lounge apericena`, `Chef table`,
`Barattoli`, `Eventi premium` — **nessuno dei quattro compare**. E la
schermata **non dice niente**: nessun «senza forma», nessun avviso,
nessun conteggio di righe non riconosciute.

🔴 **E la causa è più larga del disegno vecchio**: `PrevisioneDettaglio`
**non nomina mai** le linee accessorie. Cercato in tutte le schermate di
`src/pages/fiscale/`: **zero occorrenze**. Solo l'API le conosce. Quindi
**non è che il disegno a sei linee non le riconosce — è che la schermata
non elenca le linee accessorie a nessuno**, né vecchie né nuove.

**2. Il pareggio LE CONTA.** Misurato in tabella:

| | euro |
|---|---|
| ricavi di sala | **205.920,00** |
| **ricavi accessori** | **142.656,00** |
| totali | **348.576,00** |

I 142.656 € delle quattro righe invisibili sono **dentro** i totali, il
pareggio e le imposte. Il sintomo visibile a schermo è un numero
impossibile:

> «Pareggio 32.402,85 € di ricavo · margine **103,7% dei ricavi**»
> «Sono **0 coperti di sala** se le altre linee vanno come previsto.»

**Un margine sopra il 100% e un pareggio a zero coperti**: è il segno che
le accessorie pesano tanto da coprire tutto, detto da una schermata che
non mostra quali siano.

**3. La schermata NON si rompe.** Degrada **in silenzio** — che per i
criteri di questo progetto è il caso peggiore: un numero plausibile
senza il suo perché, come la sala disegnata vuota del 18/08.

**Non corretto**, come da mandato: è una misura.

⚠️ **E il gestionale vero non è stato toccato in scrittura**: la
produzione è stata solo letta, dal connettore in sola lettura.

Previsione di prova cancellata: **zero rimaste**, **zero trigger
lasciati spenti**, lapidi invariate a **1797**.

---

## Cosa NON è stato verificato con gli occhi

- 🔴 **Tutto.** Nessuna immagine in tutta la consegna — dichiarato in
  cima. Il blocco 4 chiedeva di guardare: ho **letto il DOM
  renderizzato** e lo dico esplicitamente, come il mandato ammetteva.
- **Nessuno ha stampato su carta**, e questa consegna fissa due taglie
  di stampa e ne aggiunge una terza (`.titolo-documento`).
- **Il preconto a 3,44 mm** non è stato visto da un cliente seduto, né su
  una termica.
- **Le tre schermate col titolo fissato** non sono state guardate a
  schermo dopo la modifica: so che in stampa non cambiano più.

## Cosa è stato dato per fatto senza misurarlo

- Che fissare `.titolo-documento` a **30 punti** sia la scelta giusta:
  è la taglia da cui questi documenti sono sempre usciti, ma **non l'ho
  confrontata con una stampa vera**.
- Che le **9 rotte misurate adesso** siano rappresentative del loro
  contenuto: alcune (Nuova previsione, Nuovo menu) sono **moduli vuoti**,
  e un modulo vuoto ha meno testo di uno pieno.
- Che le **11 rotte con parametro** non nascondano difetti: non sono
  state aperte, e non c'è ragione di crederle sane.
- Che la classificazione **(a) sana / (b) corretta** sia esatta riga per
  riga: è ricostruita dalle misure registrate, e per due o tre rotte
  misurate una volta sola la separazione è un mio giudizio.

## Affermazioni diventate false mentre lavoravo

- **«Il preconto ha una `print:text-[13px]`»**: ne aveva **due**.
- **«Sul progetto di prova il caso della previsione vecchia non può
  esistere»** (premessa del mandato): **esiste già**, 2 linee su 2 senza
  codice né forma.
- **«Il disegno a sei linee non riconosce quelle quattro righe»**
  (premessa del mandato): più largo — la schermata **non mostra le linee
  accessorie a nessuno**.
- Nel riepilogo precedente ho scritto che la misura del manuale HACCP era
  cambiata **«da 4,23 a 4,00 senza che nessuno l'avesse chiesta»** e
  l'ho attribuita alla base: **era vero**, ed era la base — ma la base in
  stampa **non varia col dispositivo**, quindi non era il difetto che
  l'indizio faceva sospettare.

## Blocchi non aperti

**Nessuno.** Tutti e quattro aperti e chiusi.
