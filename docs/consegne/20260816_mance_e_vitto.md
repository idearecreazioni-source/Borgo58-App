# Consegna del 16/08/2026 (terza) — mance e vitto del personale

**Commit della consegna: `c49ceb3`** (questo riepilogo è il commit
immediatamente sopra, sola documentazione). Working tree pulito.

| Commit | Cosa |
|---|---|
| `a569f58` | mance e vitto del personale — migrazione `20260816000003` |
| `c49ceb3` | `CLAUDE.md`: mance e vitto, e i blocchi 5 e 7 chiusi |

⚠️ **`20260816000003` è committata e NON ancora applicata** (aspetta il
push). I numeri veri dell'applicazione vanno in §6, nello stesso giorno.
La versione è nominata qui sopra, quindi la rete non la considera scoperta.

È il **Blocco 5 del mandato «personale e tesoreria»**. Col §9, il Blocco 6
e il Blocco 7 già consegnati, del mandato restano il **Blocco 4**
(simulatore di assunzione) e i **Blocchi 1 e 2**, fermi in attesa del
prospetto di Gianna.

⚠️ Questa consegna **non modifica** `docs/CONTRATTO.md`. Nessuna operazione
nuova nel corridoio: `create_tip_distribution` cambia firma ma **non
nome**, quindi l'elenco resta identico.

---

## 1. Le mance sono una partita di giro

Non sono ricavi né costi della società: sono redditi di lavoro dei
collaboratori, e per l'azienda un **debito verso il personale** finché non
vengono distribuite.

⚠️ **Nei ricavi non c'erano già, e va detto perché cambia cosa c'era da
fare.** I ricavi si leggono dai conti chiusi (decisione di Alessio del
15/08) e una mancia non sta su nessun conto: `orderTotals()` somma piatti
e coperti, e la chiusura «alla romana» blocca la cifra al totale proprio
perché gli spicci in più sono mance (decisione del 09/08).

**Il difetto era nei saldi**, in due punti:

- **Le mance in contanti stanno fisicamente nel cassetto.** Il conteggio
  le trova, il saldo atteso no: ogni conteggio avrebbe mostrato
  un'eccedenza cronica, e la differenza — che dal Blocco 6a **genera un
  movimento vero** — avrebbe cominciato a correggere un errore che non
  c'era.
- **Le mance su carta arrivano in banca insieme agli incassi.** Il POS
  accredita 1.510 e il gestionale ne aspettava 1.450: il saldo banca non
  sarebbe tornato **mai**, che è precisamente il motivo per cui il mandato
  chiede la voce del POS «dal primo giorno».

⚠️ **`mezzo` sulla raccolta E sulla distribuzione.** Sulla distribuzione
perché senza si dovrebbe **indovinare** da quale forma escono i soldi
pagati, e un'ipotesi lì dentro sposterebbe il saldo del cassetto senza che
nessuno l'abbia decisa.

**E non si distribuisce più di quello che c'è in quella forma**: un debito
non si paga due volte, e il controllo sta nel database, non nella
schermata.

---

## 2. Il vitto del personale

⚠️ **Metà problema era già risolto**, e conviene saperlo invece di
ricostruirlo: il food cost del mese si calcola con un `join` su `orders`,
quindi uno scarico **senza conto** era già fuori dal food cost dei piatti
venduti. La verifica lo **controlla** invece di darlo per scontato.

🔴 **Quello che invece non funzionava**: `record_stock_consumption`
scaricava i lotti col metodo FEFO ma **non registrava il costo di quello
che aveva tolto**. Un vitto senza costo non può essere «letto come costo
del personale», che è ciò che il mandato chiede — e la stessa cosa valeva
per lo **spreco**, che era misurabile solo in chili.

Ora il costo si **fotografa** dai lotti davvero toccati: fra sei mesi, coi
prezzi cambiati, non si ricostruisce. Stesso principio dello scarico
automatico dei conti e del costo congelato su una produzione.

*(Il trattamento fiscale dei pasti al personale è il quesito L13 per la
commercialista. La causale si costruisce comunque: serve al food cost, e
quella parte non aspetta nessuno.)*

---

## 3. Tre difetti trovati applicando, tutti invisibili leggendo

1. ⚠️ **Il vocabolario degli scarichi era chiuso in DUE posti**: il
   controllo dentro `record_stock_consumption` **e un vincolo sulla
   tabella**. Aprendone uno solo, la funzione sarebbe passata e
   l'inserimento sarebbe fallito con *«violates check constraint»* al
   primo vitto registrato — un errore incomprensibile per chi lo legge. E
   quello sulla tabella è il più importante: vale anche per chi scrive
   dritto in tabella dal browser. Si è **ricreato**, non tolto.
2. ⚠️ **Quinta ricomparsa della stessa trappola.** La verifica saltava
   tutta la parte del vitto quando mancava un ingrediente con giacenza —
   e sul progetto di prova non ce n'è, **in produzione sì** (i dati di
   collaudo del 12-13/08). Il controllo più importante della migrazione
   avrebbe girato **per la prima volta sui dati veri**. Ora, se manca, la
   verifica se ne crea uno temporaneo e lo toglie; se c'è, è di Alessio e
   si aggiunge solo un lotto proprio.
3. ⚠️ **Non era idempotente.** Alla seconda esecuzione il `drop` della
   vecchia firma di `create_tip_distribution` non trovava più niente e il
   `create` falliva con «function already exists». Corretto con `create or
   replace`, e provata **tre volte di fila**.

**E dopo i due `drop` i permessi tornano aperti al mondo** (trappola del
13/08): sono stati richiusi, e la verifica lo controlla con
`has_function_privilege` invece di fidarsi delle righe scritte sopra.

---

## 4. Le schermate

- **Mance**: la forma si sceglie sia raccogliendo sia distribuendo, e in
  cima compare **quanto resta da distribuire diviso fra cassetto e banca**
  — con la frase, che arriva dal database, che dice che quelle somme non
  sono del locale.
- **Magazzino**: «Vitto del personale» entra fra i motivi di scarico,
  accanto a consumo, spreco e rettifica.

---

## 5. Verifica

| Cosa | Stato |
|---|---|
| la migrazione sul progetto di prova | **applicata tre volte senza errori**: idempotente |
| le mance si dividono per forma | **provato** (40 contanti, 60 carta) |
| le mance in contanti entrano nel cassetto | **provato**, e il saldo dichiara «non tuoi» |
| le mance su carta entrano nel POS in transito | **provato**, con l'avvertenza |
| distribuire più di quello che c'è in quella forma | **respinto dal database** |
| la distribuzione passa dal **corridoio vero** | **provato** |
| lo scarico a mano **registra il costo** | **provato** — è il controllo che giustifica metà migrazione |
| il vitto **non** è legato a un conto | **provato** (quindi fuori dal food cost dei piatti venduti) |
| un motivo di scarico inventato | **respinto**, dalla funzione e dal vincolo di tabella |
| lo staff respinto su mance, scarichi e saldi | **provato col token vero** |
| i permessi dopo i due `drop` | **richiusi**, verificato con `has_function_privilege` |
| prove automatiche | **98 verdi** (erano 92) + **14 pure** |
| lint, build | puliti |
| residui sul progetto di prova | **zero** — mance, distribuzioni, righe, ingredienti e scarichi di prova |
| elenco anonimi · `security definer` senza portiere | **12** · **13**, invariati |
| **produzione** | **109 migrazioni** — `20260816000003` **non ancora applicata** |

---

## 6. Dopo l'applicazione in produzione

*(da compilare nello stesso giorno, prima del secondo push)*

- migrazioni in produzione: **da compilare**
- avvisi partiti durante l'applicazione: **da compilare**
- residui delle verifiche: **da compilare**
- elenco anonimi · `security definer` senza portiere: **da compilare**
- i dati di collaudo del magazzino non toccati dalla verifica: **da compilare**

---

## 7. Cosa NON è verificato

- ⚠️ **Nessuna mancia è mai stata registrata**, né in produzione né da una
  mano vera: tutto è provato dentro la migrazione e dalle prove
  automatiche. Il locale non è aperto.
- ⚠️ **Nessun vitto è mai stato scaricato in produzione.** ⚠️ E quando
  succederà, toccherà i **dati di collaudo del magazzino** — gli
  ingredienti delle sei fatture di prova — che restano lì per decisione
  del 13/08 e vanno cancellati prima della prima fattura vera.
- **Il costo del vitto non entra ancora in nessuna schermata di
  Proiezione**: la funzione che lo somma esiste, ma il collegamento al
  costo del personale aspetta il Blocco 1, cioè Gianna.
- **La separazione delle mance dai corrispettivi non è mai stata vista con
  un POS vero**, perché il POS non c'è: i due parametri restano vuoti
  (quesito B2).
- **`v_tips_balance` continua a esistere e non distingue la forma**:
  risponde a «quanto è stato raccolto in tutto», che è un'altra domanda, e
  non è stata toccata.
