# Le date nascoste dietro un taglio

**Migrazione**: `20260819000008_le_date_nascoste_dietro_un_taglio.sql`
— applicata sul progetto di prova, **NON in produzione**.
**Deciso da Alessio** il 19/08/2026: si fa **adesso**, non dopo il collaudo
generale. La ragione è che in produzione non c'è ancora nessun movimento e
nessun conto chiuso: oggi costa una migrazione, dopo costerebbe la stessa
migrazione **più** una decisione su ogni riga già scritta.

---

## ⚠️ Cosa NON è verificato

1. 🔴 **Non è applicata in produzione**: lo script si rifiuta finché le
   migrazioni non sono su GitHub, e il push lo fa Alessio.
2. ⚠️ **Non è mai passata una mezzanotte vera con dei dati dentro.** Tutto è
   provato su istanti costruiti apposta.
3. ⚠️ **Le viste non sono state guardate**, come dichiarava il censimento del
   19/08: qui si è coperto ciò che quel censimento aveva misurato — funzioni
   e predefiniti di colonna — più la famiglia nuova. Una vista che filtrasse
   per data non comparirebbe in nessuno dei due elenchi.
4. ⚠️ **La rete non guarda sé stessa** (contiene le parole che cerca), ed è
   dichiarato invece che scoperto: stessa forma della sentinella dei lavori.

---

## Cosa abbiamo rovesciato

**Nessun rovesciamento.** Il perimetro deciso da Alessio il 19/08 —
*seguono la serata due gesti soli* — **non viene allargato di un punto**:
tutte e tre le funzioni corrette restano di **calendario**. Cambia il fuso
con cui il calendario viene letto, che è un'altra cosa.

---

## 🔴 Il difetto, e perché la rete non lo vedeva

La consegna delle 05:00 (`20260819000006`) ha tolto `current_date` da tutte
le funzioni e ha lasciato una rete a sorvegliare che non torni. Ma
`current_date` **non è l'unico modo di chiedere che giorno è a Greenwich**:
tagliare a data un istante già memorizzato — `created_at::date` — fa
esattamente la stessa cosa, perché il database vive a Greenwich e fra
mezzanotte e le due dice **ieri**.

🔴 **E `scarichi_senza_ricavo` era rimasta curata a metà**, che è un modo
nuovo di sbagliare: gli estremi del periodo arrivavano da `oggi_a_roma()` e
la riga si confrontava con `sc.created_at::date`. Prima era **sbagliata ma
coerente**; così uno spreco registrato dopo mezzanotte il primo del mese
**spariva da tutti e due i mesi** — non nel vecchio perché gli estremi erano
nuovi, non nel nuovo perché la sua data era vecchia. Un numero che manca
senza che nessuna riga risulti fuori posto.

**I tre punti rimasti**, misurati sul progetto di prova dopo `…006`:

| funzione | cosa tagliava | cosa tocca |
|---|---|---|
| `scarichi_senza_ricavo` | `sc.created_at::date` | i **costi** degli sprechi |
| `quadratura_pagamenti` | `v_inv.paid_at::date`, **tre volte** | **soldi**: è la schermata dove si va a cercare perché i conti non tornano |
| `agenda_corsie` | `t.created_at::date` | l'anzianità in «quando capita», che lì è l'unica cosa che si guarda |

Tre erano già state curate da `…006` (`conti_da_fiscalizzare`,
`quadratura_fiscale`, `pos_in_transito`): lì il taglio nudo era sparito **da
solo**, perché quelle funzioni erano state riscritte per intero.

⚠️ **`completa_task` non è in elenco, ed è il falso positivo da non
prendere**: il suo `end::date` taglia un `date + interval`, che non ha fuso.

---

## La rete, allargata invece che affiancata

Una seconda rete accanto alla prima darebbe **due elenchi da guardare**, e il
giorno che se ne guarda uno solo la porta aperta è l'altra. La rete resta
una, e adesso riconosce tre modi di chiedere la data a Greenwich:
`current_date`, `now()::date`, e **il taglio nudo di una colonna con l'ora
dentro**.

⚠️ **L'elenco delle colonne se lo costruisce dal catalogo**: una tabella
nuova con un `created_at` entra nella sorveglianza da sola. *Gli elenchi si
costruiscono dai cataloghi, mai a mano* (17/08).

⚠️ **E la forma curata non viene segnalata, per costruzione**: in
`(x.created_at at time zone 'Europe/Rome')::date` il taglio non tocca la
colonna — fra le due cose c'è il fuso. La rete cerca il taglio **attaccato**
al nome. Senza questa proprietà griderebbe su chi ha fatto la cosa giusta, e
un guardiano che grida sempre viene spento.

⚠️ **Ha anche preso il portiere**, come le altre diagnostiche (vedi la
consegna del portiere): raccontava la forma del database a chiunque avesse
fatto il login.

---

## Le prove, e le quattro rotture

**16 controlli dentro la migrazione**, con l'istante che discrimina: le
**00:30 italiane di due giorni fa sono le 22:30 di Greenwich di tre giorni
fa**. Letto col fuso giusto dista 2 giorni, letto a Greenwich ne dista 3. La
verifica si ferma da sola se l'istante scelto non discrimina i due fusi —
*un istante qualunque non proverebbe niente*.

| rottura | cosa è diventato rosso |
|---|---|
| torna il taglio nudo negli scarichi | *«Lo scarico delle 00:30 non compare nel suo giorno italiano»* |
| torna il taglio nudo in `quadratura_pagamenti` | *«La fattura pagata alle 00:30 non risulta pagata nel suo giorno italiano»* |
| torna il taglio nudo in `agenda_corsie` | *«L'anzianità dell'impegno è 3 giorni invece di 2»* |
| la rete smette di guardare i tagli | *«La rete vede solo 2 delle 3 rotture»* |

⚠️ **Ognuna rompe una cosa sola e fa cadere una prova sola**: se avessero
fatto cadere le stesse, starebbero misurando una cosa sola.

🔴 **E una prova sbagliata è stata trovata proprio così.** La prima stesura
contava le righe che tornavano dagli scarichi, invece della **differenza**:
sul progetto di prova ce ne sono di altri, e leggeva 2 dove si aspettava 1 —
sarebbe stata rossa per un residuo altrui invece che per il difetto. *Il
perimetro di una prova dev'essere fatto di roba che la prova ha creato*
(16/08); dove la funzione non dice di chi parla, si misura una **differenza**.

---

## Il censimento del mattino era in disaccordo col codice — corretto

Tre righe di
[`20260819_censimento_giornata_operativa.md`](../referti/20260819_censimento_giornata_operativa.md)
dicevano «serata» (versamento in banca, scarichi) o «da decidere» (rimborso
al titolare) dove il codice consegnato fa **calendario**. **Il codice ha
ragione**: il perimetro l'ha ristretto Alessio dopo che il censimento era
stato scritto.

⚠️ **Le righe vecchie non sono state cancellate**: erano la proposta con cui
si è arrivati alla decisione, e cancellarle farebbe perdere il motivo. Sopra
c'è un riquadro che dice che erano in disaccordo. *Senza, chiunque riaprisse
quel documento fra sei mesi aprirebbe tre segnalazioni che non sono difetti.*

---

## Per Alessio, in una riga

Uno spreco o una fattura pagata dopo mezzanotte adesso finiscono nel giorno
giusto anche quando li si guarda per periodo, e il gestionale si accorge da
solo se qualcuno riapre quella porta.

---

**Commit del lavoro**: `f6df765` — «Le date nascoste dietro un taglio».
**Working tree**: pulito al momento del commit del lavoro.
**Migrazioni**: `20260819000008` — sul progetto di prova sì, in produzione
**no**, in attesa del `git push`.
