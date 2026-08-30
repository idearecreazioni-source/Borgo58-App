# La pesca dal file delle richieste — 30/08/2026 (blocco 4)

**Commit che sta sotto questo riepilogo:** `237c4ec`
**Migrazioni introdotte:** nessuna. Questo blocco non aggiunge codice: usa il
file per **decidere** invece che per registrare, e riporta se ha funzionato.

---

## 1. Cosa ho preso, e perché quelle

Il mandato chiedeva di aprire [`RICHIESTE.md`](../RICHIESTE.md) e prendere le
aperte **più vecchie**. Ne ho prese **due**, ed erano le due più vecchie
raggiungibili senza aspettare nessuno:

| # | richiesta | ferma dal | perché questa |
|---|---|---|---|
| **N4** | cantina e bevande con la stessa macchina del magazzino | **14/08/2026** | è la più vecchia in assoluto fra quelle che dipendono solo da me, ed era **già il blocco 1 di stanotte**: il mandato e il file chiedevano la stessa cosa da due parti |
| **T1** | dopo un riavvio, dal telefono si vede solo bianco | 30/08/2026 | era **fatta a metà** e la metà mancante era di Alessio: bastava chiedergli se aveva funzionato |

**Le altre aperte più vecchie le ho lasciate stare, e la ragione è la stessa
per tutte e tre:**

* **R12** (la resa al posto dello scarto standard, 14/08) — tocca ricettario,
  magazzino e food cost **insieme**, e a metà lascerebbe il gestionale peggio
  di com'è. `DECISIONI.md` la mette esplicitamente fra i lavori che «avranno
  una sessione loro con la finestra intera».
* **N6** (la tracciabilità a valle, 14/08) — stessa famiglia: è un blocco
  intero, non una coda.
* **N7/N8** (il costo del personale, 15/08) — **aspettano Gianna**: si
  progettano sui documenti veri, non si indovina la forma di un prospetto.
* **V3** (la funzione online della voce da installare) — si fa **dopo un
  push**, e stanotte il push non c'è ancora stato.

---

## 2. Cosa si è chiuso

**Nove richieste**, e otto vengono dal mandato di stanotte:

| # | cosa | chiusa da |
|---|---|---|
| N4 | cantina e bevande — **per la parte che serve** | `20260830000002` |
| T1 | il gestionale riparte da solo dopo un riavvio | riferito da lui: ha installato il file, ha riavviato, il telefono si apre |
| P1 | il modulo non è più sempre aperto | commit `237c4ec` |
| P2 | «Registrala» apre il modulo | `237c4ec` |
| P3 | «Da fare» è una sezione sua | `237c4ec` |
| P4 | quadrotti anche sul computer | `237c4ec` |
| P5 | il «costata 0,00 €» | `20260830000004`, `…005` |
| M5 | via «Altro» dai materiali | `20260830000003` |
| S8 | il nome del tavolo piccolo e intero | `237c4ec` |

**Il conto adesso: 53 richieste, 19 aperte, 31 chiuse, 3 scartate da lui.**
⚠️ Resta un **pavimento**, non un censimento: sono le richieste che si sono
potute trovare scritte. Quelle dette solo a voce non ci sono.

⚠️ **N4 è chiusa «per la parte che serve», e la differenza è scritta nel
file**: mescita al calice, prodotti in magazzino, margine — sì. **Bottiglia
aperta, bottiglia buttata e inventario trimestrale — no**, per decisione sua
del 30/08: li sistema il conteggio dell'Allineamento, che esiste già. Se non
fosse scritto così, fra tre mesi qualcuno riaprirebbe N4 credendola intera.

---

## 3. Il file ha funzionato? — la risposta onesta

Alessio ha chiesto di sapere se il file, usato per **decidere** il lavoro
invece che per registrarlo, serve. È la prima volta.

**Cosa ha funzionato.**
* **Ha impedito che N4 fosse rifatta da zero.** Il mandato di stanotte
  descriveva la cantina come un lavoro nuovo; il file diceva che era il
  **blocco 3 del mandato cumulativo del 14/08**, con dentro tre decisioni già
  prese — mescita sì, annate non separate, inventario trimestrale. Due di
  quelle tre hanno cambiato il disegno di stanotte. **Senza il file avrei
  ricostruito quelle decisioni da capo, e probabilmente diverse.**
* **Ha detto cosa NON toccare.** P6 («resta com'è: ricerca, alfabetico,
  storico, ricorrente») ha delimitato il blocco 2 prima di aprirlo.
* **Ha reso banale la scelta.** Le richieste sono ordinate per modulo con la
  data: guardare le più vecchie è stato leggere quattro righe.

**Cosa non ha funzionato, e va detto.**
* 🔴 **Metà delle voci aperte non sono pescabili, e il file non lo dice.**
  Delle 19 aperte, **almeno sette** aspettano qualcun altro (Gianna, Laura, la
  banca, un piano di Fatture in Cloud) o sono blocchi interi che non si
  possono cominciare in coda a una sessione. Chi apre il file per «prendere la
  più vecchia» trova in cima proprio quelle. **Manca una colonna che dica se
  una richiesta è pescabile adesso o aspetta.**
* ⚠️ **La colonna «stato» ha una quinta risposta che non è dichiarata**:
  «fatta a metà» (T1 la portava), e «fatta per la parte che serve» (N4). Sono
  utili — dicono il vero — ma non stanno nell'elenco degli stati scritto in
  cima al file.
* ⚠️ **Nessuna voce dice quanto costa.** Fra «via una spunta» e «la
  tracciabilità a valle» non c'è niente che distingua un'ora da tre giorni,
  quindi la scelta di cosa pescare l'ho fatta leggendo il **contenuto** di
  ogni riga, non l'elenco.

**Non ho cambiato la forma del file**: la struttura è di Alessio, e tre
colonne nuove sono una sua decisione. Sono le domande 2 e 3 qui sotto.

---

## 4. Cosa abbiamo rovesciato

**Niente in questo blocco.** Il blocco non tocca codice: sceglie il lavoro e
aggiorna il registro delle richieste. I quattro rovesciamenti di stanotte
(nn. 69-72) stanno nei riepiloghi dei blocchi 1, 2 e 3 e in
[`decisioni_rovesciate.md`](../decisioni_rovesciate.md).

---

## 5. Cosa NON è verificato

* **T1 è chiusa su una cosa riferita, non misurata da me.** Alessio dice che
  ha installato il file, ha riavviato e il telefono si apre da solo. Non l'ho
  visto: non ho riavviato il suo computer.
* **Il conto delle richieste è letto dal file, non dalla realtà.** «19 aperte»
  vuol dire «19 righe che non dicono fatta o scartata»: se una fosse stata
  fatta senza che nessuno lo segnasse, sarebbe ancora lì.

---

```bash
git -C "C:\Users\User\Desktop\Claude code\Borgo58-App" push
```
