# Censimento — «a quale giornata appartiene questo istante»

**Misurato in produzione, in sola lettura, il 19/08/2026.**
**Prima consegna del lavoro «la regola delle 5 del mattino»: SOLO LA MISURA.
Nessuna correzione in questa passata**, per decisione presa insieme —
*sia la misura a dire quanti sono*.

---

## Perché adesso, e perché la finestra si chiude da sé

In produzione oggi ci sono **zero movimenti di prima nota e zero conti
chiusi**. Cambiare come si decide a quale giornata appartiene un incasso
**non richiede nessuna sanatoria**, perché non c'è niente da sanare. Dopo il
collaudo generale ce ne sarà.

⚠️ **E il numero di partenza era vecchio.** La coda diceva «18 punti SQL»,
contati il 18/08 leggendo il *testo* delle migrazioni. Misurando il database
vivo — che è la cosa che gira — i punti sono **32**, e uno dei 18 era un
falso positivo (`submit_public_reservation`: `current_date` compare **dentro
un commento**, e la funzione usa già l'ora di Roma).

---

## I numeri

| | |
|---|---|
| funzioni che usano `current_date` (fuso **UTC**) | **9** |
| funzioni che usano `(now() at time zone 'Europe/Rome')::date` | **15** |
| colonne con predefinito `CURRENT_DATE` | **8** |
| **punti totali nel database** | **32** |
| punti nel client che calcolano «oggi» (`oggiLocale()`) | **35**, in 22 file |
| punti nel client che calcolano «quale serata» (`serataDiServizio()`) | **6**, in 4 file |

⚠️ **Il conteggio è stato fatto sul database, non sul testo delle
migrazioni**, e togliendo i commenti: un censimento che conta le parole
dentro i commenti gonfia il problema e fa perdere fiducia nel numero.

---

## Le tre risposte possibili

Prima di elencare, i tre significati che oggi si confondono:

1. **Giornata di calendario, ora di Roma** — «che giorno è oggi». Giusta per
   scadenze, prenotazioni, giorni bancari.
2. **Serata di servizio** — «quale sera è questa», che comincia la sera e
   finisce alle **05:00** (`service_settings.ora_fine_serata`, dato di
   Alessio). Giusta per tutto ciò che nasce mentre il locale è aperto.
3. **Giornata di calendario in UTC** — `current_date`. ⚠️ **Non è mai la
   risposta giusta**: il database vive a Greenwich, e fra mezzanotte e le due
   dice **ieri**. Misurato mentre accadeva il 18/08: alle 01:31 italiane
   rispondeva `2026-08-17`.

---

## A · I 9 punti in UTC — dove `current_date` è comunque sbagliato

| funzione | a che cosa serve la data | regola giusta |
|---|---|---|
| `registra_conteggio_cassa` | il giorno del conteggio del cassetto | 🔴 **serata** |
| `versa_in_banca` | il giorno del versamento | 🔴 **serata** |
| `conti_da_fiscalizzare` | il periodo dei conti da confrontare col registratore | 🔴 **serata** |
| `quadratura_fiscale` | idem, incassi contro scontrinato | 🔴 **serata** |
| `scarichi_senza_ricavo` | scarichi di magazzino contro conti | 🔴 **serata** |
| `pareggia_anticipazione` | il giorno in cui si rimborsa il titolare | 🟡 **da decidere**: in contanti è serata, per bonifico è calendario |
| `pos_in_transito` | quanti giorni fa è stato incassato col POS | 🟢 calendario (giorni bancari) — ma **in UTC sbaglia lo stesso** |
| `previsione_cassa` | l'orizzonte «fra 30 giorni» | 🟢 calendario — **idem** |
| `saldo_anticipazioni` | l'**anno** in corso | 🟢 calendario — sbaglia **una notte all'anno**, il 1° gennaio prima delle 02:00 |

⚠️ **Anche dove la risposta giusta è «calendario», `current_date` resta
sbagliato**: la cura non è cambiare regola, è cambiare fuso.

---

## B · Gli 8 predefiniti di colonna

| tabella · colonna | regola giusta |
|---|---|
| `cash_movements.movement_date` | 🔴 **serata** |
| `conteggi_cassa.contato_il` | 🔴 **serata** |
| `tips_collected.collected_date` | 🔴 **serata** |
| `discounts_gifts.movement_date` | 🔴 **serata** |
| `daily_menus.service_date` | 🔴 **serata** |
| `anticipazioni_socio.pagata_il` | 🟡 da decidere, come sopra |
| `deductible_expenses.expense_date` | 🟢 calendario |
| `foraged_items.harvest_date` | 🟢 calendario (si raccoglie di giorno) |

⚠️ **I predefiniti sono il punto più insidioso dei tre gruppi**: non c'è
nessuna riga di codice da leggere. Chi scrive `insert into cash_movements`
senza la data **non sta scegliendo**, e il valore arriva da solo — è la
famiglia dei 33 posti silenziosi del 17/08.

---

## C · I 15 punti già in ora di Roma — dove la mezzanotte va bene

`agenda_corsie`, `avvisa_scadenze`, `messaggio_scadenze`, `movimenti_attesi`,
`uscite_future`, `partite_in_scadenza`, `bozza_ordine`, `completa_task`,
`crea_prenotazione_su_tavoli`, `submit_public_reservation`,
`public_reservation_options`, `posto_per_la_serata`, `registra_produzione`,
`pay_supplier_invoice`, `apri_conto`.

**Sono giusti così**, e la ragione è la stessa per tutti: parlano di
**calendario** — quando scade una cosa, per che giorno si prenota, che data
si scrive su un ordine. ⚠️ Due meritano una riga:

- **`apri_conto`** non usa una data ma l'**ora corrente**, per scegliere la
  prenotazione più vicina. La serata gliela passa chi chiama (decisione del
  giro D1: *un parametro in più è meglio di un dodicesimo orologio*). È il
  modello da seguire.
- **`pay_supplier_invoice`** data l'uscita al giorno di calendario, ed è
  giusto: un bonifico non appartiene a una serata.

---

## D · Il client

**35 punti** calcolano «oggi» con `oggiLocale()` (data locale, cura del fuso
dal 08/08) e **6** calcolano «quale serata» con `serataDiServizio()`.

⚠️ **La domanda esiste anche qui, e la risposta deve essere la stessa.** Le
schermate dei soldi — `CassaHome`, `PrimaNota`, `ScontiOmaggi`,
`Scontrinato`, `SezionePersonale`, `Previsione` — usano tutte `oggiLocale()`:
alle 00:30, col locale aperto, propongono **domani** come data di un
movimento.

⚠️ **E c'è un difetto già noto della stessa famiglia**: in Comande la serata
si decide **all'apertura della schermata e non si aggiorna più**. Alessio ha
deciso che la sala **non deve cambiare sotto le mani** di chi sta chiudendo —
decisione ancora valida — ma *cosa succede a un tablet acceso alle 05:00* non
è dichiarato da nessuna parte.

---

## Cosa proporre, quando si passerà a correggere

⚠️ **Non «correggere 32 punti»**, che è il modo in cui questa trappola è già
tornata cinque volte. La lezione è tornata tre volte in due giorni:

> **Una funzione sola risponde «a quale giornata appartiene questo
> istante», e tutti gli altri la chiamano.**

Se «la giornata operativa» diventa 32 espressioni copiate, la prossima
modifica ne dimenticherà una **e nessuna prova lo dirà**.

**La forma già esiste a metà**: `serataDiServizio()` in
`src/lib/calcoli/serata.js` è **pura** e riceve l'ora da
`service_settings.ora_fine_serata` — scritta così apposta, il 18/08, perché
il giorno che il database avesse la sua funzione le due leggessero **lo
stesso numero**. Manca il gemello SQL.

⚠️ **La condizione d'ingresso, scritta il 18/08 e non negoziabile**: la prova
che *sullo stesso istante le due strade diano la stessa serata*, misurata ai
bordi — 00:30, 04:59, 05:01.

---

## Cosa questo censimento NON dice

1. ⚠️ **Non dice se i 15 punti «di calendario» siano tutti giusti nel
   merito**: dice che il fuso è corretto e che la domanda che pongono è di
   calendario. Un errore di merito dentro uno di quelli non lo prende.
2. ⚠️ **Non copre le viste**: sono state guardate solo funzioni e predefiniti
   di colonna. Una vista che filtra per data non comparirebbe in questo
   elenco.
3. ⚠️ **Non copre i lavori pianificati** (`pg_cron`): l'orario di esecuzione
   è già trattato altrove (il doppio lancio delle 8 e 9 UTC per l'ora
   legale), ma nessuno l'ha riconfrontato con questa misura.
4. ⚠️ **I 35 punti del client non sono classificati uno per uno**: è un
   conteggio, non un censimento. Farlo con lo stesso metodo di questo
   documento è la seconda metà del lavoro.
