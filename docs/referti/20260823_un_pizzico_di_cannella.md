# Un pizzico di cannella ferma lo scarico di tutto il tavolo

**23/08/2026 — referto, non correzione.** 🔴 **Non è stato corretto niente**,
per decisione di Alessio: è un difetto del gestionale trovato mentre si
misurava lo scenario, e mescolarlo al lavoro dello scenario lo farebbe
perdere. La cura è scritta qui in fondo, pronta, e aspetta domani.

**Dove è stato misurato**: progetto di prova, 172 migrazioni, lo scenario dei
due mesi com'era la sera del 22/08. Il gestionale vero non è stato toccato.

---

## 1 · Il fatto, in una riga

> **19 conti chiusi su 62 non hanno fatto scendere il magazzino di un
> grammo**, e nessuno se n'era accorto.

Il conto si chiude, il cliente paga, lo scontrino esce. Ma la merce che è
uscita dalla cella non risulta uscita da nessuna parte, e **il costo di
quella cena non viene registrato**. Non è un errore a schermo: è un silenzio.

---

## 2 · La catena, misurata e non dedotta

Presa una delle diciannove (tavolo T5, tre righe: *Gelo di limone e gelso*,
*Selezione dolce*, *Busiate al pesto alla trapanese*) e chiesto al database
cosa dovesse scaricare:

```
Cannella in stecche → 0,00003708 kg
```

Trentasette **milligrammi**. Da dove nascono:

| passo | valore |
|---|---|
| «Frolla per cannoli» vuole cannella | **0,002 kg** su un impasto da **1 kg** |
| a un «Mini cannolo dolce» tocca frolla | **0,018 kg** |
| quindi la sua cannella è | 0,002 × 0,018 = **0,000036 kg** |
| più il 3% di scarto dell'ingrediente | **0,00003708 kg** |

Nessuno di questi tre numeri è sbagliato. È **la divisione** a portare sotto
la soglia.

E la soglia è una proprietà delle colonne:

| colonna | tipo | il più piccolo che sa tenere |
|---|---|---|
| `stock_consumptions.quantity` | numeric(12,4) | 0,0001 kg = **un decimo di grammo** |
| `stock_lots.quantity_remaining` | numeric(12,4) | idem |
| `quantita()` (come si legge a schermo) | 3 decimali | **il grammo** |

Quindi 0,000037 diventa `0,0000`, e sulla tabella c'è
`check (quantity > 0)`. La riga viene respinta.

### 🔴 E il rifiuto non si porta via il pizzico: si porta via il tavolo

`scarica_magazzino_conto` scarica **tutti** gli ingredienti del conto dentro
un unico blocco protetto. Il rifiuto sulla cannella arriva lì dentro, e
l'`exception when others` annulla **tutto**: il pesce, la carne, il coperto,
il costo. Il conto resta senza il segno dello scarico e viene scritta una
riga in `anomalie_scarico`:

```
tipo: errore
descrizione: new row for relation "stock_consumptions"
             violates check constraint "stock_consumptions_quantity_check"
```

⚠️ Quella riga si vede davvero, in *Magazzino → «Cosa non è sceso dal
magazzino»*, introdotta dalla frase «guasto durante lo scarico:». Ma dice il
nome di un vincolo, non cosa è successo — e soprattutto **non nomina il
conto che ha perso lo scarico intero**.

---

## 3 · Quanto è grosso, contato

Chiesto al database, conto per conto, quanti ingredienti finiscono sotto la
soglia:

| | |
|---|---|
| conti chiusi | **62** |
| conti che hanno perso lo scarico | **19** |
| ingredienti sotto soglia in tutto | **28** |
| conti in cui il guasto ha un'altra causa | **0** |

L'ultima riga è la più utile: **questa sola causa spiega tutti e diciannove**.

I tre colpevoli, tutti veri e tutti innocenti:

| ingrediente | volte | quantità richiesta |
|---|---|---|
| Cannella in stecche | 15 | 0,000037 – 0,000041 kg |
| Pepe nero in grani | 7 | 0,000041 kg |
| Alloro | 6 | 0,000041 kg |

Un pizzico di spezia in un ragù, diviso per le porzioni che ne escono. **Non
c'è niente di finto in questi numeri**: è come si scrive una ricetta.

### E l'effetto sui conti che il gestionale mostra

| mese | ricavi | costo merce registrato | food cost |
|---|---|---|---|
| giugno | 770,00 € | 45,61 € | **5,9%** |
| luglio | 4.327,00 € | 323,47 € | **7,5%** |

Il food cost del gestionale è basso anche per altre ragioni (lo scenario è
carente, ed è il lavoro di stanotte), **ma un terzo dei conti che non
scaricano nulla è la prima**.

---

## 4 · Due cose trovate per strada, e valgono da sole

### 🔴 «Così si potrà riprovare» — ma nessuno può riprovare

Nel codice, il commento che spiega perché in caso di guasto si annulla tutto
dice: *«il conto resta chiuso e non segnato come scaricato — così si potrà
riprovare»*.

**Misurato: `scarica_magazzino_conto` la chiamano solo le chiusure del
conto** (`close_order_paid`, `close_order_as_discount_gift` e le loro
sorelle). Non c'è nessuna schermata, nessun pulsante, nessun lavoro notturno
che la richiami. E un conto già chiuso non si richiude.

Quindi il «si potrà riprovare» è **una frase diventata falsa**: non descrive
una possibilità che esiste. In pratica quei 19 conti non scaricheranno mai
più.

### ⚠️ La soglia gemella c'era già, e guardava da una parte sola

Due righe sotto il punto che fallisce, l'anomalia «non ce n'era abbastanza»
scatta solo sopra `0.00005`:

```sql
if v_da_togliere > 0.00005 then   -- sotto, non si dice niente
```

Cioè **chi ha scritto questa funzione sapeva dell'arrotondamento**, e l'ha
guardato dal lato di quello che *manca* e non dal lato di quello che *si
scrive*. Il difetto vive nello spazio fra le due — lo stesso posto dove
vivevano il verso della sagoma (18/08) e il manuale HACCP che stampava
«conforme» (19/08).

### ⚠️ E la stessa riga è nelle produzioni

`registra_produzione` ha la forma identica (`if v_tolto > 0 then insert …`).
Oggi non morde, perché si produce a dosi intere e le quantità restano grandi.
Ma il giorno che mordesse, fallirebbe **dopo** aver creato il lotto del
semilavorato: peggio di qui.

---

## 5 · La cura, scritta e non applicata

**Non è «arrotondare per non far fallire».** È che il gestionale **non sa
dire trentasette milligrammi** — e infatti il lotto non si muoveva comunque:
togliere 0,000037 a una colonna con quattro decimali la lascia dov'era.
Quindi non si perde nessuna scrittura che prima avveniva: si smette di
**provare** a farne una impossibile.

In `scarica_magazzino_conto` e in `registra_produzione`, la stessa
sostituzione:

```sql
-- prima
if v_tolto > 0 then
  insert into stock_consumptions (…, quantity, …)
  values (…, v_tolto, …);

-- dopo
if round(v_tolto, 4) > 0 then
  insert into stock_consumptions (…, quantity, …)
  values (…, round(v_tolto, 4), …);
```

**Come si prova che non è decorativa** (la verifica è già scritta):

1. si costruiscono due ingredienti propri — uno normale, uno da pizzico — e
   una ricetta che rende **100 porzioni**, così il millesimo nasce da una
   divisione e non da un numero scritto piccolo apposta;
2. **prima di misurare**, si controlla che il caso si sia formato:
   `round(fabbisogno_pizzico, 4) = 0` e `round(fabbisogno_normale, 4) > 0`.
   Senza questo controllo il blocco passerebbe verde senza provare niente;
3. **la controprova**: si prova a inserire a mano quella quantità e si
   pretende il rifiuto `23514`. È ciò che dimostra che l'arrotondamento è un
   fatto e non un sospetto;
4. poi: nessuna anomalia «errore», il pesce sceso di 0,0500 kg, **nessuna
   riga** per il pizzico, **il lotto del pizzico fermo**, e il conto che
   risulta scaricato.

### ⚠️ Cosa la cura NON risolve, e va deciso da Alessio

1. **La sproporzione resta.** Un guasto qualunque su un ingrediente solo
   continuerebbe a portarsi via lo scarico dell'intero conto. Renderlo
   indipendente ingrediente per ingrediente è possibile, ma **cambia il
   patto**: oggi «tutto o niente, e si riproverà»; domani «quello che si può
   si scarica». La seconda strada è più utile solo se qualcuno può davvero
   riprovare il resto — e oggi non può.
   🔵 **Domanda per Alessio**: se il magazzino non scende per un tavolo,
   vuoi che *non scenda niente* e resti da rifare, o che *scenda quello che
   si può* e ti venga detto cosa manca?
2. **La giacenza delle spezie non scenderà mai.** La cannella comprata resta
   quella comprata, e la lista della spesa non la chiederà mai.
   ⚠️ **È vero anche oggi** — è la taglia delle colonne, non questa
   correzione — ma con la cura diventa *silenzioso invece che rumoroso*, e
   quindi va detto qui.
   🔵 **Domanda per Alessio**: le spezie a pizzico le vuoi in magazzino, o
   comprate e basta? Se le vuoi in magazzino, la strada è portare le
   quantità al milligrammo (sei decimali invece di quattro) su tutta la
   catena, ed è un lavoro suo.

---

## ⚠️ Cosa NON è stato verificato

1. 🔴 **Niente è stato corretto e niente è stato applicato.** Il file della
   migrazione è stato scritto e poi **tolto**, apposta: la cura sta qui come
   testo, così non può entrare per sbaglio insieme al lavoro dello scenario.
2. ⚠️ **In produzione il difetto non può ancora mordere**: il Ricettario vero
   è vuoto (0 ricette). Morderà **il giorno in cui Alessio scriverà la prima
   ricetta con una spezia dentro** — cioè presto, e senza avviso.
3. ⚠️ **Non è stato misurato quanti altri punti del gestionale scrivono una
   quantità arrotondabile a zero.** Guardati solo i quattro che scrivono in
   `stock_consumptions`; di questi, due hanno la forma difettosa
   (`scarica_magazzino_conto`, `registra_produzione`), uno prende la
   quantità da un lotto (`chiudi_partita`, sempre ≥ 0,0001) e uno la riceve
   da chi chiama (`record_stock_consumption`).
