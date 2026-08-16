# Consegna del 16/08/2026 (ottava) — Blocco 4 del mandato di correzione

**Commit della consegna: `f6688a2`.** Questo riepilogo è il commit
immediatamente sopra, sola documentazione. Working tree pulito.

| Commit | Cosa |
|---|---|
| `f6688a2` | le comande: una riga inviata non sparisce, una mai inviata non si paga — migrazione `20260816000008` |

⚠️ **Ordine seguito** (CLAUDE.md §2, regola 4): commit → push di Alessio →
`npm run migra -- --conferma` → questo riepilogo → secondo push. La
migrazione **`20260816000008` è già applicata in produzione** (§7).
Nessuna operazione nuova nel corridoio, quindi **nessuna Edge Function
reinstallata**.

⚠️ Questa consegna **non modifica** `docs/CONTRATTO.md`.

⚠️ **Cambia un comportamento che oggi esiste** (4.2, decisione di
Alessio): è l'unica consegna del mandato che lo fa, e i suoi effetti sui
dati già scritti sono misurati al §7.

---

## 1. 4.1 — Una riga già mandata in cucina si cancellava senza traccia

`sendDraftItems` aveva la sua rete (`is sent_at null`, messa nell'audit
dell'08/08 quando si scoprì che spediva le righe del collega).
`removeDraftItem` e `updateDraftItemQuantity` **no**. Quindi da qualsiasi
tablet si poteva cancellare o cambiare una riga **già uscita dalla
stampante della cucina**, e **anche a conto chiuso**. Le policy di
`order_items` sono aperte a tutto lo staff — giustamente, è la sala — e la
tabella era fuori dal registro delle cancellazioni.

**In sala con due tablet è una gara che si perde in silenzio**: il piatto è
in cottura, la riga non esiste più, e il conto non lo dice.

**La cura non è vietare di correggersi: è separare cancellare da
stornare.** Una riga inviata si annulla (`voided_at` + motivo) e lo storno
resta visibile. Quello che sparisce senza lasciare niente è l'unica cosa
vietata.

Tre livelli, come chiedeva il mandato:

| Livello | Cosa |
|---|---|
| Client | `is("sent_at", null)` su `removeDraftItem` e `updateDraftItemQuantity` — dà l'errore prima, non è la difesa |
| **Database** | trigger `trg_riga_servita` before update/delete su `order_items` |
| Registro | `order_items` dentro `deleted_records` — le tabelle tracciate passano da 14 a **15** |

**Cosa resta permesso su una riga inviata**: lo storno, «ticket stampato»
(`prepared_at`) e **la nota** — modificabile dopo l'invio per scelta
dichiarata dall'08/08, perché la riga è la fonte del ticket ristampato.
⚠️ **L'ora di invio non si riscrive**: è il momento in cui il ticket è
uscito dalla stampante, non un campo di lavoro.

**Su un conto chiuso non si tocca più niente che sposti un euro** —
nemmeno lo storno. Un conto chiuso è una fotografia: cambiarne una riga
vuol dire cambiare un totale su cui qualcuno ha già incassato, e domani un
incasso su cui il registratore telematico si confronterà.

---

## 2. Il difetto che la cura stava per introdurre

🔴 **Trovato scrivendo la verifica, non leggendo il codice.** Col solo
divieto, **un conto con anche una sola riga inviata non sarebbe più stato
cancellabile da nessuno, per sempre** — la cancellazione a cascata passa
dallo stesso trigger. E la prima a restarne prigioniera sarebbe stata la
**pulizia dei dati di collaudo** che Alessio deve fare prima della prima
fattura vera (CLAUDE.md §10).

La regola che si difende è *«un conto non dice una cosa e le sue righe
un'altra»*. Se il conto stesso sta sparendo, non dice più niente: le sue
righe se ne vanno con lui. Nel trigger è un ramo esplicito — in una
cancellazione a cascata la riga del conto è già via, quindi la `select`
sullo stato non trova niente — **e il registro delle cancellazioni
conserva comunque ogni riga**, verificato nella migrazione.

⚠️ **La verifica ci passa attraverso invece di aggirare il trigger
spegnendolo**: una scappatoia sarebbe anche la strada per aggirarlo
davvero (stesso principio del sigillo delle previsioni, 15/08).

---

## 3. 4.2 — Le bozze mai inviate non si pagano più

Decisione di Alessio. Una riga scritta e mai mandata in cucina non è un
piatto servito: non si addebita e non toglie niente dalla cella.

| Dove | Prima | Ora |
|---|---|---|
| `totale_conto()` | tutte le righe non annullate | **solo le inviate** |
| `fabbisogno_conto()` | idem | **solo le inviate** |
| `orderTotals()` (browser) | idem | **solo le inviate** |

⚠️ **Ma non spariscono in silenzio.** `totale_conto()` restituisce, insieme
al totale, **quante righe sono rimaste in bozza e quanto valgono** — il
numero e il suo limite viaggiano insieme, come per `calcola_imposte()`. E
tre schermate lo dicono:

- **Chiusura conto**: riquadro giallo con l'elenco delle righe e la frase
  «non entrano nel conto e non scaricano il magazzino; se sono state
  servite lo stesso, chiudi e mandale prima»;
- **Preconto**: una riga di avviso — ⚠️ `print:hidden`, perché **sul foglio
  che va al cliente ci va il conto, non i nostri lavori in corso** (stessa
  scelta degli allergeni da verificare, che stanno sullo schermo e non sul
  menu);
- **Bar**: l'avviso è nel riquadro cassa **prima** di aprire la chiusura,
  perché dal Bar si chiude il tavolo di chiunque.

In **Sala** non è stato aggiunto niente: quella schermata separa già le
bozze dalle righe inviate in due sezioni, con il pulsante «Manda in
cucina» accanto.

---

## 4. Il difetto peggiore che questa modifica poteva introdurre

🔴 **`listOpenOrders` non chiedeva `sent_at`.** La select del Bar era
`items:order_items(id, quantity, unit_price, voided_at)`. Con la regola
nuova, **ogni riga sarebbe risultata non inviata** e il totale del Bar
sarebbe crollato ai soli coperti — **in silenzio, davanti al cliente**.

È la lezione del 16/08 sulle mance **allo specchio**: lì un campo che si
vedeva nella schermata non arrivava al database; qui un campo che serve al
calcolo non arriva alla schermata. Stessa forma, stesso modo di fallire —
nessun errore, un numero sbagliato con l'aria di essere giusto.

Corretto, e reso **rumoroso invece che muto** da una prova di unità: se
`sent_at` manca del tutto dalle righe, `itemsTotal` deve valere zero e le
righe devono finire tutte fra le «non inviate». ⚠️ **E la stessa
dimenticanza è poi successa davvero** in una prova esistente
(`comande.test.js` selezionava le righe senza `sent_at`): è stata
corretta e **lasciata lì col suo commento**, perché è la dimostrazione che
l'errore è facile.

---

## 5. Cosa è stato verificato, e come

**Dentro la migrazione**, col ruolo vero del titolare, su un conto e due
sagome creati dalla verifica:

| # | Controllo | Esito |
|---|---|---|
| 5a | Totale = riga inviata + coperti; la bozza fuori | 20,00 (10 + 2×5), bozza da 7,00 dichiarata |
| 5b | La bozza si cambia e si cancella | sì |
| 5c | La riga inviata: cancellata / quantità cambiata / ora di invio riscritta | **respinti tutti e tre** |
| 5d | Storno, nota e «ticket stampato» su riga inviata | **permessi** — la cura non vieta il rimedio |
| 5d | Dopo lo storno il totale torna ai soli coperti | 10,00 |
| 5e | A conto chiuso: storno e cancellazione | **respinti** |
| 5e | A conto chiuso: la nota | permessa |
| 5e-bis | Permessi di `totale_conto` dopo il drop | non aperta ad `anon`, eseguibile dal gestionale |
| 5f | La bozza cancellata finisce nel registro | 1 riga |
| 5g | Il conto intero si cancella e le righe se ne vanno con lui | sì, e restano nel registro |

⚠️ **E il controllo che vale più degli altri**: la migrazione **si ferma da
sola** se trova righe mai inviate su conti già chiusi — perché in quel caso
avrebbe appena abbassato un totale su cui qualcuno ha incassato, ed è «un
numero che cambia da solo nella notte». In produzione ne ha trovate **zero**.

⚠️ **`totale_conto` è stata ricreata con un `drop`** (Postgres non cambia
le colonne restituite da una funzione esistente). Due conseguenze
guardate, non supposte: **i sette chiamanti sono tutti `plpgsql`** (nessuna
dipendenza rigida; sei usano `lateral` prendendo `t.totale` per nome,
`close_order_as_discount_gift` fa `select * into` su una variabile
`record`, che regge due colonne in più — letto nei corpi delle funzioni); e
**dopo un drop i permessi tornano aperti al mondo**, quindi sono richiusi e
**controllati dentro la migrazione**.

**Prove automatiche.** 4 nuove in `tests/app/comande-riga-servita.test.js`,
⚠️ **che entrano con l'utente STAFF e non col titolare**: il difetto era
che da *qualsiasi* tablet si poteva far sparire una riga in cottura, e
provarlo col titolare direbbe poco. Più 2 nuove di unità sul conto.

⚠️ **7 prove esistenti sono diventate rosse**, ed è la misura che la
modifica fa qualcosa: le loro comande di prova nascevano senza `sent_at`,
cioè rappresentavano conti chiusi con righe mai mandate in cucina — uno
stato che in sala non esiste. Le fixture sono state rese realistiche una
per una (`comande`, `scarico-magazzino`, `tesoreria`).

Suite intera: **20 pure + 111 sul progetto di prova, tutte verdi.** Lint a
zero, build ok. **Idempotenza:** applicata due volte di fila sul progetto
di prova.

---

## 6. Il passato, guardato prima di toccarlo

Letto col connettore **prima** di scrivere la migrazione — e stavolta
davvero dal connettore, dopo l'errore dichiarato nel riepilogo del Blocco 3:

| Conto | Stato | Righe | Mai inviate | Valore |
|---|---|---|---|---|
| T7 · T8 · T9 | annullato (14/08) | 0 | 0 | — |
| T3 | annullato (14/08) | 0 | 0 | — |
| Divano 3 | **chiuso** (15/08) | 1 | **0** | 5,00 |

**Nessun totale già scritto cambia.** Se ce ne fosse stato uno, la cura
giusta non sarebbe stata questa.

---

## 7. I numeri veri dell'applicazione in produzione

```
applicate e registrate: 1 su 1
totale migrazioni in produzione: 115
vincolo_righe: 1 | registro_comande: 1 | tabelle_tracciate: 15 | bozze_su_conti_chiusi: 0
```

| Controllo (connettore in sola lettura, dopo) | Valore |
|---|---|
| Trigger `trg_riga_servita` | presente |
| Tabelle nel registro delle cancellazioni | **15** (erano 14) |
| Conti / righe di comanda | 3 / 1, invariati |
| Conti residui della verifica | 0 |
| Sagome in sala | 13, invariate |
| `totale_conto` eseguibile con la sola chiave pubblica | **no** |
| `totale_conto` eseguibile dal gestionale | sì |
| Funzioni di `public` eseguibili col solo `anon` | **12, invariate** |

---

## 8. Cosa NON è verificato

- **Niente è passato da una mano vera in sala.** Il giro è provato coi
  ruoli veri dentro la migrazione e dalla suite, mai da un dito su un
  tablet — e questa è la consegna in cui quel limite pesa di più, perché
  cambia un gesto che si fa durante il servizio.
- **Il caso dei due tablet in gara non è riprodotto davvero**: la prova
  usa un client staff, non due dispositivi che scrivono nello stesso
  istante. Ciò che è provato è che il divieto vale per lo staff da una
  connessione qualunque, che è la sostanza del difetto.
- **Nessun conto reale ha mai avuto righe in bozza alla chiusura**, quindi
  i tre avvisi nuovi (chiusura, preconto, Bar) non sono mai comparsi su
  uno schermo.
- **Non è stato deciso che fine fanno le bozze dopo la chiusura**: restano
  attaccate al conto chiuso, non addebitate e non scaricate. Non si
  cancellano da sole — cancellarle butterebbe via l'unica traccia che
  qualcuno le aveva scritte — e da lì in poi il trigger le protegge come
  ogni altra riga di un conto chiuso. **Se Alessio le vuole vedere in un
  elenco («cosa è rimasto in bozza questo mese»), è lavoro da chiedere.**
