# Consegna del 12/08/2026 — le versioni di un prodotto, e il costo dei ritentativi

**Commit della consegna: `3cf90f1`** (questo riepilogo è il commit
immediatamente sopra, sola documentazione). Working tree pulito.

**Migrazioni `20260812000016` e `…17` già applicate in produzione** (71
registrate). **`posta-leggi` reinstallata** — quattro volte oggi, e le
ultime due per rimediare a me stesso: vedi §4.

---

## 1. Un'idea di Alessio che ha corretto la mia impostazione

Gli avevo dichiarato un buco: *«se cambia il formato, il confronto al
litro grida al lupo»*. La sua risposta:

> *«Vedo tutte le versioni di olio che ho comprato e scelgo
> consapevolmente cosa continuare a comprare:*
> *· olio A da 5 L, 1 €/l, fornitore A*
> *· olio B da 1 L, 2 €/l, fornitore A*
> *· olio B da 1 L, 3 €/l, fornitore B*
> *Così vedo anche se ci sono fornitori più convenienti sullo stesso
> identico prodotto.»*

Avevo separato due cose che per lui sono una sola, e aveva ragione lui.

**Il prezzo si lega alla versione, non all'ingrediente.** Senza, «olio da
5 L» e «olio da 1 L» finivano nella stessa fila e **ogni cambio di
formato sembrava un rincaro del 100%**. È la terza volta in un giorno che
la stessa lezione si ripresenta: un allarme che grida per una cosa normale
è quello che insegna a non leggere gli allarmi.

**Due domande, due risposte:**

| Domanda | Come si risponde |
|---|---|
| *«mi hanno aumentato il prezzo?»* | confronto sulla **stessa versione**, stesso fornitore. Resta l'allarme, anche su Telegram |
| *«cosa mi conviene comprare?»* | `varianti_ingrediente()`: la tabella che ha disegnato lui, dalla più conveniente. È una **decisione**, non un allarme |

**`stesso_di`** — due diciture di fornitori diversi possono essere lo
stesso identico prodotto, e **il gestionale non può saperlo**: vede due
stringhe. Le mette una sotto l'altra e lo vede lui; se le collega una
volta, da lì in poi le confronta da sole e *«lo stesso prodotto da B lo
paghi 3 invece di 2»* diventa un avviso vero. Il collegamento punta sempre
al capo, mai a un anello intermedio — due salti renderebbero il gruppo di
confronto dipendente dall'ordine in cui sono stati fatti.

---

## 2. La schermata, terza forma

Alessio, davanti alla seconda: *«è tutto molto confusionario e così non
va»*. Sette righe aperte insieme, sei caselle ciascuna. Era la terza volta
che sbagliavo nello stesso modo su questo modulo.

Adesso: **si vede solo ciò che chiede una decisione**, in tre gruppi —
già conosciute (apribili), prodotti nuovi proposti col nome giusto (si
guardano, non si toccano), righe da decidere. E in cima **la quadratura**,
nata da una sua domanda: *«in che modo posso validare quei dati se non
vedo la fattura?»*. Si somma ciò che il documento ha stampato su ogni riga
e si confronta col suo imponibile: se torna, sono state lette tutte e ai
prezzi giusti, **senza guardarne nemmeno una**.

Provata sulla bolla vera: **237,00 € = 237,00 €, al centesimo.**

E i nomi proposti, che erano il difetto peggiore della versione
precedente (proponeva la dicitura del fornitore, e il Ricettario si
riempiva di nomi da fattura):

| Riga della bolla | Nome proposto |
|---|---|
| Pomodori ciliegini di Pachino IGP, cassa da 6 kg | Pomodoro ciliegino — kg |
| Ricotta di pecora fresca, vaschetta 1 kg | Ricotta di pecora — kg |
| Olio EVO Nocellara del Belice, lattina 5 L | Olio extravergine di oliva — l |
| Detergente sgrassante professionale, tanica 5 L | Detergente sgrassante — **non alimentare** |

Marca, IGP e formato tolti da tutti; il detersivo marcato non alimentare
da solo. Conversioni: cassa 6, lattina 5, sacco 25.

---

## 3. Cosa ho cancellato, e perché lo dichiaro

Nel corso delle prove Alessio ha confermato un carico con la schermata
vecchia: erano nati **8 ingredienti coi nomi delle fatture**, compreso
*«Contributo trasporto» a 8 €/kg, categoria verdura*. Su sua richiesta ho
cancellato tutto il finto — ingredienti, lotti, storico prezzi, diciture
memorizzate, il documento della bolla, le mail di prova e **i PDF
dall'archivio dei file** — verificando zero residui.

Tolta anche la copia della bolla dal registro delle cancellazioni: quel
registro conserva la riga intera, e una copia integrale di una consegna
mai avvenuta è la stessa bugia della riga HACCP di stamattina, solo in un
posto dove nessuno la guarda.

Restano intatti i 4 documenti veri e i 2 promemoria veri.

---

## 4. Due errori miei, sullo stesso tema: il costo dell'AI

**`max_tokens`, la seconda volta oggi.** Ho arricchito ciò che si chiede
al modello — importo di riga, unità di fatturazione, fattore, nome
proposto — senza rialzare il tetto della risposta. Risultato in
produzione: `stop_reason: max_tokens`, risposta troncata, che **non è
JSON** e fallisce senza spiegare niente.

Sta scritto in `CLAUDE.md` §8 dalla mattina, per lo stesso motivo: allora
il tetto era 400, l'ho portato a 4.000 e ho considerato chiuso il
problema. **Non era chiuso, era spostato.** Ora 12.000, e la regola è
scritta come regola: *il tetto si alza nello stesso momento in cui si
chiede di scrivere di più*. Non si paga se non lo si usa.

**E il difetto più caro, che ha scoperto il primo.** Una mail la cui
lettura fallisce resta `da_leggere` di proposito — se il guasto è
passeggero verrà ripresa, se è permanente resta visibile invece di sparire
con una proposta inventata. Giusto. Solo che veniva ripresa **ogni quarto
d'ora, per sempre, e ogni tentativo si paga**. Una mail che il modello non
digerirà mai costa quattro letture all'ora finché qualcuno non se ne
accorge — e nessuno se ne accorge, perché il freno anti-tempesta degli
avvisi ne fa uscire uno solo all'ora.

Ora i tentativi si contano, il tetto è 3, e `riprova_lettura_posta()` la
rimette in coda — **gesto di Alessio, non del sistema**: riprovare ha
senso quando si è capito *perché* era fallita, non allo scadere di un
timer.

Regola generale, ora in §8: **ogni ritentativo automatico che costa soldi
vuole un contatore e un tetto**, altrimenti è una perdita che cresce da
sola.

---

## 5. Verifica

| Cosa | Stato |
|---|---|
| progetto di prova, entrambe le migrazioni | **applicate due volte**: idempotenti |
| formato diverso **non** è rincaro | **provato** coi numeri di Alessio (1 / 2 / 3 €/l) |
| stessa versione più cara **è** rincaro | **provato** |
| la tabella parte dalla più conveniente, col fornitore | **provato** |
| due diciture non collegate restano distinte; collegate danno +50% | **provato** |
| una versione non si collega a se stessa | **provato** |
| tentativi contati e mail rimessa in coda a mano | **provato** |
| prove automatiche | **29 verdi** |
| **produzione** | **applicate**: 71 migrazioni, zero residui |
| lint, build | puliti |

**Non verificato, e dichiarato**: nessun carico è mai stato confermato con
la schermata nuova, quindi `varianti_ingrediente()` non ha ancora mai
avuto due versioni vere da confrontare. La sua verifica è quella dentro la
migrazione, non un dato di produzione.

---

## 6. Dopo il tetto alzato: riuscita, e una regressione trovata subito

**La rilettura è andata**: `10.242` token, tre azioni, tutte e nove le
righe con importo, unità, fattore e nome proposto. Il tetto a 4.000 era
esattamente il problema.

**E nella risposta riuscita si è vista la regressione.** Avendo chiesto al
modello di riportare *tutte* le righe del documento (servono a far
quadrare il totale) e, separatamente, di *proporre un nome* per ogni riga
non abbinata, le due istruzioni si sono sommate: proponeva **«Trasporto»**
e **«Contributo ambientale CONAI»** come prodotti nuovi.

Confermando di corsa sarebbero nati in dispensa due ingredienti che non
sono cibo e non sono niente. È lo stesso pasticcio di stasera —
*«Contributo trasporto» a 8 €/kg, categoria verdura* — **con un nome più
pulito, che è peggio: sembra a posto.**

Corretto: quelle righe arrivano marcate `non_merce`, senza nome proposto,
e la schermata le mette già fuori dal carico. Confermando, la memoria le
ricorda come «non è merce» e dal mese prossimo spariscono da sole.

**La lezione è su come si scrivono le istruzioni, non sul modello**: due
regole giuste separatamente possono comporsi in una terza che nessuno ha
chiesto, e non lo si vede finché non arriva il documento che le tocca
entrambe. È la stessa forma dei guasti di ieri sera — solo che qui non
c'era nessun errore da nessuna parte, solo una proposta sbagliata scritta
bene.
