# A quale giornata appartiene questo istante — una risposta sola

**Censimento**: [`20260819_censimento_giornata_operativa.md`](../referti/20260819_censimento_giornata_operativa.md).
**Regola e perimetro**: decisi da Alessio il 19/08/2026.
**Migrazione**: `20260819000006_a_quale_giornata_appartiene_questo_istante.sql`
— **applicata sul progetto di prova, NON in produzione**.

---

## ⚠️ Cosa NON è verificato

1. 🔴 **Nessuna mano ha visto la schermata del conteggio del cassetto**, che
   adesso propone la serata e la dichiara sotto il campo.
2. 🔴 **Non è mai passata una mezzanotte vera con dei dati dentro**: in
   produzione ci sono zero movimenti e zero conti chiusi. Tutto è provato su
   istanti costruiti apposta.
3. ⚠️ **Le notti del cambio dell'ora sono provate, non vissute**: le due
   prove usano gli istanti del 29/03/2026 e del 25/10/2026, e nessuna delle
   due notti è ancora arrivata.
4. ⚠️ **I 35 punti del client non sono stati toccati.** Le schermate dei
   soldi propongono ancora «oggi»: alle 00:30 propongono **domani** come data
   di un movimento. L'unica corretta è quella del conteggio del cassetto —
   che è il gesto del perimetro.
5. ⚠️ **Il difetto di Comande resta**: la serata si decide all'apertura della
   schermata e non si aggiorna più. È una decisione di Alessio (*la sala non
   deve cambiare sotto le mani di chi sta chiudendo*), ma cosa succede a un
   tablet acceso alle 05:00 **non è dichiarato in nessun posto**.
6. ⚠️ **Le viste non sono state guardate**, come dichiarava il censimento.

---

## Cosa abbiamo rovesciato

**Nessun rovesciamento.** La decisione del 18/08 — *le 5 stanno in
`service_settings`, e `serataDiServizio()` è una funzione pura che riceve
l'ora* — non solo regge: era stata scritta **per questo giorno**, e la
condizione d'ingresso posta allora è la prova che chiude questa consegna.

---

## 🔴 La regola, e il suo perimetro

**Parole di Alessio**: dopo mezzanotte, in questo locale, l'unico movimento
che capita è il conto incassato a fine servizio. Quindi seguono **la serata
in corso** due gesti soli:

1. il **conto** incassato dopo mezzanotte;
2. il **conteggio del cassetto** di fine serata.

⚠️ **Tutto il resto segue il calendario**: banca, carte, fatture, scadenze,
uscite, spese, prenotazioni, turni, HACCP.

⚠️ **Non è una semplificazione da allargare col tempo.** La proposta era più
larga — *«tutto ciò che passa dal cassetto»* — e **l'ha ristretta lui**:
quei movimenti, dopo mezzanotte, da lui non ci sono. La verifica lo
**controlla nei due versi**: che i due gesti prendano la serata, e che il
pagamento di una fattura e una spesa deducibile **non l'abbiano presa** — se
il perimetro si allargasse da solo, la migrazione si ferma.

⚠️ **E i due gesti stanno insieme o non funziona nessuno dei due**: se
l'incasso delle 00:30 va su sabato e il conteggio del cassetto finisce su
domenica, il gestionale confronta i soldi contati stanotte con gli incassi di
un'altra giornata e **dichiara un ammanco che non esiste**.

---

## Una risposta sola, e il suo gemello

**`serata_di_servizio(istante)`** nel database è il gemello di
`serataDiServizio()` in `src/lib/calcoli/serata.js`. ⚠️ **La parentela non è
un modo di dire**: quella funzione fu scritta **pura** il 18/08 apposta —
riceve l'ora invece di contenerla — *perché il giorno che il database avesse
la sua le due leggessero lo stesso numero*. Quel giorno è oggi, e l'ora è
sempre e solo `service_settings.ora_fine_serata`.

**`oggi_a_roma()`** è l'altra metà: il giorno di calendario, in ora italiana.

🔴 **`current_date` non è mai la risposta giusta**, nemmeno dove la
mezzanotte va benissimo: il database vive a Greenwich, e fra mezzanotte e le
due dice **ieri** a chiunque. Dopo questa migrazione **nessuna funzione lo
usa più** — la verifica lo pretende, e la conta la fa sul database togliendo
i commenti.

---

## Gli otto predefiniti, decisi uno per uno

⚠️ **Sono il gruppo peggiore**, ed è la famiglia dei 33 posti silenziosi: chi
scrive una riga senza la data **non sta scegliendo**.

| colonna | regola |
|---|---|
| `conteggi_cassa.contato_il` | **serata** — gesto 2 del perimetro |
| `cash_movements.movement_date`, `tips_collected.collected_date`, `discounts_gifts.movement_date`, `daily_menus.service_date`, `anticipazioni_socio.pagata_il`, `deductible_expenses.expense_date`, `foraged_items.harvest_date` | **calendario di Roma** |

**Nessuno è rimasto com'era** «perché tanto di solito va bene». Per i sette
di calendario non cambia la regola: **cambia il fuso**.

---

## Il conteggio del cassetto si conferma, non si scrive in silenzio

Richiesta di Alessio: la serata a cui il conteggio sta andando **si vede e la
conferma lui**. Il campo si chiama «Serata che stai chiudendo», è
precompilato con la serata calcolata, e sotto c'è scritto *«Stai chiudendo la
serata di sabato 22. Fino alle 05:00 è ancora la sera prima»*.

⚠️ **Il caso che lo rende necessario esiste davvero e sbaglierebbe senza
dirlo**: il cassetto contato **prima** di mezzanotte a locale chiuso presto,
o la mattina dopo prima di aprire. È la stessa forma scelta oggi altre tre
volte — il mezzo di pagamento, la riga della lista, la causale: *si fa da sé,
ma si vede.*

⚠️ **La proposta usa l'ora vera di Alessio**, letta dalle impostazioni: un
numero scritto nella schermata sarebbe il secondo orologio. Se la lettura
fallisce resta «oggi», che è la proposta di prima — si perde la comodità, non
il gesto.

---

## Le undici funzioni riprese e corrette

Riprese dal **database** con `pg_get_functiondef` (regola del 18/08) e
cambiate **solo dove decidono una data** — 27 sostituzioni in tutto:

- **calendario, cambia il fuso**: `previsione_cassa`, `versa_in_banca`,
  `pareggia_anticipazione`, `saldo_anticipazioni`, `pos_in_transito`,
  `scarichi_senza_ricavo`;
- **serata sui conti**: `conti_da_fiscalizzare`, `quadratura_fiscale`,
  `misure_del_mese`, `ricavi_non_fiscalizzati`;
- **serata sul gesto**: `registra_conteggio_cassa`.

⚠️ **`pos_in_transito` resta calendario** anche se guarda i conti: i giorni
di accredito di una carta sono **giorni bancari**, non serate. Cambia solo il
fuso con cui li conta.

---

## La rete, e il buco che ha dentro

`funzioni_con_data_utc()` costruisce l'elenco **dal database a ogni
esecuzione**: una funzione nuova che usasse `current_date` fa diventare rossa
una prova **senza che nessuno si sia ricordato di aggiornare un elenco**.

⚠️ **Toglie i commenti prima di guardare**: nel censimento uno dei diciotto
punti era la parola «current_date» dentro un commento, e un guardiano che
grida a vuoto viene spento.

⚠️ **La rete non guarda se stessa**, e va detto invece che scoperto: contiene
la parola che cerca, quindi si accuserebbe da sola. È la stessa forma della
sentinella dei lavori — *un testimone non testimonia della propria assenza*
(12/08).

---

## Le prove, e la controprova

**11 prove nuove sui dati veri** (`tests/app/giornata-operativa.test.js`),
più 16 controlli dentro la migrazione.

**I bordi**, che sono l'unico posto dove la regola cambia: 00:30 → ieri sera;
04:59 → ieri sera; 05:01 → giorno nuovo; le 23:00 e l'01:00 della stessa
notte sulla **stessa** serata.

⚠️ **Il fuso si prova solo dove i due fusi danno due risposte diverse**: le
03:30 di Greenwich sono le 05:30 italiane, cioè già il giorno nuovo —
leggendo Greenwich sarebbero ancora la serata prima. *Un istante qualunque
non discriminerebbe niente.*

⚠️ **Le notti del cambio dell'ora ci sono adesso che è gratis**: a marzo le
02:00 non esistono, a ottobre le 02:30 capitano due volte. Col confine alle 5
nessuna delle due tocca la regola — *ma è precisamente il genere di cosa che
si scopre l'anno dopo.*

**E la prova che lega le due strade**: sugli stessi nove istanti, il database
e il client devono dire la **stessa** serata. È la condizione d'ingresso
scritta il 18/08.

### La controprova — due rotture

| rottura | prove rosse |
|---|---|
| il confine torna a **mezzanotte** | **7 su 11** |
| via il **fuso italiano** (si legge Greenwich) | **3 su 11** |

⚠️ Le due rompono **gruppi diversi**: la prima colpisce i bordi, la seconda
solo gli istanti dove i fusi divergono. Se avessero rotto le stesse prove,
quelle prove starebbero misurando una cosa sola.

---

## 🔴 Una prova esistente sbagliava a datare, e l'ha detto la regola nuova

`tests/app/tesoreria.test.js` creava conti con `closed_at` = **solo la data**,
cioè mezzanotte di Greenwich, cioè **le 02:00 italiane**. Con la regola nuova
quel conto appartiene alla **serata prima** — ed è esattamente ciò che si
voleva.

⚠️ **A sbagliare era la prova, non il codice**: un conto chiuso alle 02:00 è
la sera prima. Corretta dandogli un'ora di servizio vera (21:00), e la
ragione è scritta lì.

---

## Per Alessio, in una riga

Un conto chiuso all'una di notte adesso conta nella serata giusta, e quando
conti il cassetto il gestionale ti dice **quale serata stai chiudendo** e te
la fa correggere.

---

**Commit**: 9d0cb0b — «Una risposta sola a *a quale giornata appartiene
questo istante*».
**Working tree**: pulito.
