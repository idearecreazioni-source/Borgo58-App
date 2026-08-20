# L'evento accettato — blocco 4 del mandato dei preventivi

**20/08/2026** · Code → validatore

- **HEAD dichiarato**: `741d2e691ef5bf6e9af9c96ad5aa63d7031113cd`
- **Working tree**: pulito
- **Mandato**: [`docs/mandati/20260820_i_preventivi_per_gli_eventi.md`](../mandati/20260820_i_preventivi_per_gli_eventi.md), blocco 4
- **Migrazione**: `20260820000009_l_evento_accettato.sql` — **non ancora in
  produzione** (aspetta il push di Alessio)
- **Corridoio**: `operazioni-atomiche` **v17 sul progetto di prova**, da
  installare in produzione (`accetta_preventivo` è un'operazione nuova)
- **Funzione online**: `notify-telegram-reservation` modificata (categoria
  `evento`), **da installare**

---

## Cosa abbiamo rovesciato

**Niente.** Nessuna decisione presa prima è stata ribaltata da questo blocco.
Il riquadro c'è lo stesso, per il precedente del riepilogo del Magazzino: *un
riquadro che compare solo nei guai fa dubitare, quando manca, di non averlo
visto.*

Una decisione **nuova** invece c'è, ed è di Alessio (chiesta prima di scrivere
il codice, perché non l'aveva decisa nessuno): **un preventivo scaduto si
accetta lo stesso, e il gestionale lo dice**. Le altre due strade erano
rifiutare (e obbligare a rifare il preventivo) o accettare in silenzio. La sua
ragione: la scadenza serve a poter rinegoziare, non a impedire.

---

## 1 · Cos'è stato applicato prima di tutto

`20260820000008` (la validità di trenta giorni) era committata e spinta ma non
applicata. **Applicata in produzione**, numeri veri subito dopo:

| | |
|---|---|
| migrazioni in produzione | **158** |
| validità proposta | **30 giorni** |
| preventivi | 0 |
| movimenti di cassa | 0 |
| tracce nel registro cancellazioni | **26**, invariate |

---

## 2 · La regola della sala piena, e perché è una sola

> *«Se l'evento riempie la sala, la spunta si accende da sola. Se quella sera
> ci sono già altre prenotazioni, vuol dire che l'evento è conciliabile e va
> trattato come una prenotazione normale.»*

Tradotta in una proprietà invece che in un elenco di casi: **quante persone
sono attese contro quanti posti ha la sala quel giorno**. L'evento entra in
calendario *prima* che il conto si faccia, quindi nel conto è una prenotazione
come le altre — **nessun caso speciale, nessun ramo «se è un evento»**.

- la capienza la sa già `coperti_del_giorno()` (che tiene conto della
  disposizione di quella sera: due tavoli accostati valgono meno di due tavoli
  separati);
- contano solo le prenotazioni **confermate** — dal 14/08 una richiesta in
  attesa non occupa più niente;
- il conto vive in **un posto solo**, `capienza_della_sala(data)`.

⚠️ **«Non lo so» non è «no».** Se la sala non si è potuta contare (nessuna
sagoma attiva), la capienza torna **vuota**, la spunta **non si tocca**, e
l'accettazione lo dichiara: *«Non sono riuscito a contare i posti di quella
sera… Guardala tu.»* Rispondere «no» sarebbe informazione di assenza spacciata
per assenza di informazione — la regola del 19/08.

### 🔴 La spunta impara da dove viene

`giornate_sold_out` ha ora `preventivo_id`. **Vuota vuol dire «l'ha messa
Alessio a mano»**, e in quel caso nessun annullamento la spegne.

Senza quella colonna, annullare un evento avrebbe spento **anche una decisione
sua** — in silenzio, e su una serata che lui aveva chiuso per una ragione che
il gestionale non conosce. È la parte del blocco che non era nel mandato e che
è saltata fuori guardando la tabella: aveva tre colonne, e nessuna diceva
perché quella riga esisteva.

---

## 3 · Annullare: due cose, non una

⚠️ *Una sala che resta bloccata per errore costa una serata intera, una che si
sblocca in silenzio fa scoprire il buco troppo tardi.* Quindi:

1. la spunta **si spegne da sola** (solo quella accesa da quel preventivo);
2. il preventivo torna `annullato`;
3. **parte l'avviso** su Telegram, con una faccia sua — categoria `evento`,
   titolo «📆 EVENTO ANNULLATO». ⚠️ **Non sotto il triangolo dei guasti**: chi
   legge non deve chiamare aiuto, deve decidere se rimettere in vendita quella
   sera. È la lezione del 13/08 sui rincari, applicata a un fatto nuovo.

⚠️ **È un trigger, non un pezzo di `annulla_prenotazione`**: una prenotazione
si annulla anche modificandola dalla sua scheda, e una regola che vive in una
sola delle due porte non è una regola.

⚠️ **Il tipo dell'avviso porta dentro l'identificativo dell'evento**, altrimenti
il freno anti-tempesta (uno per tipo all'ora) zittirebbe il secondo evento
annullato nella stessa ora — che è **un fatto nuovo**, non la ripetizione del
primo. Stessa lezione del 13/08, altro punto del programma.

---

## 4 · Le versioni: 🔴 una versione nuova NON crea un secondo evento

Il mandato dice che dopo l'accettazione non si sovrascrive: si fa un preventivo
nuovo **collegato** al vecchio. Da lì discende una conseguenza che il mandato
non nominava e che va dichiarata, perché è una decisione:

**accettare una versione riusa la prenotazione dell'antenato** (risalendo la
catena `versione_di`) e la aggiorna. Le versioni precedenti restano
`accettato`: sono la storia di quella cena, non altre cene.

⚠️ L'alternativa — creare una prenotazione per ogni versione accettata —
metterebbe **due volte le stesse persone in sala**, e nessuna delle due
sembrerebbe sbagliata.

### La rottura chiesta dal mandato, fatta

Tolto il collegamento (`versione_di` scritto vuoto in
`nuova_versione_preventivo`), sul progetto di prova:

- **la verifica della migrazione diventa rossa**: *«La versione nuova ha creato
  un secondo evento invece di aggiornare il primo.»*
- **la prova sui dati veri diventa rossa**: *«la versione nuova ha creato un
  secondo evento: expected '4df1041b…' to be '6c707ad7…'»*

Poi rimesso a posto e riverificato verde. **La storia delle versioni non è
perdibile in silenzio.**

---

## 5 · Il preventivo scaduto — la decisione di Alessio

Si accetta, **e l'avvertenza torna insieme al risultato**: *«Questo preventivo
era scaduto il 15/07/2026: il prezzo che hai promesso è quello di allora.»*

⚠️ **Nessuna colonna nuova**: «era scaduto quando l'ho accettato» è
`accettato_il > valido_fino_al`, cioè un **riflesso** — due colonne che
direbbero la stessa cosa sono un difetto (regola del 16/08).

---

## 6 · 🔴 Una misura ha aggiunto lavoro che il mandato non prevedeva

`reservations.reservation_time` non ammette vuoti, e `preventivi.ora_evento`
sì. Quindi l'accettazione doveva rifiutare un preventivo senza ora — **e
rifiutarlo sarebbe stato un vicolo cieco**: misurato, `ora_evento` **non era
scrivibile da nessuna schermata**. Esisteva nel database dal blocco 1 e nessuno
poteva riempirla.

Il campo «Ora» è ora nell'intestazione del preventivo, accanto a Data. *Un
rifiuto che manda a compilare un campo che non esiste è il difetto n. 8 del
mandato di correzione.*

---

## 7 · L'avviso sulle prenotazioni dello stesso giorno

Un preventivo non accettato **non blocca niente**, ma chi prende una
prenotazione per quella sera lo deve sapere. `trattative_del_giorno(data)`, e
l'avviso compare **sotto i campi data/ora/coperti** — dove nasce il dubbio, non
in cima alla schermata (lezione del 17/08: un rifiuto lontano dal gesto è un
rifiuto che non c'è).

🔴 **È aperta a tutto lo staff, e va dichiarato**: in sala si prende una
prenotazione, ed è lì che si rischia di promettere un tavolo per una sera in
trattativa. Per questo restituisce **il minimo che serve a decidere** — quante
persone, in che stato — e **il nome del cliente esce solo per il titolare**.
Nessun prezzo, nessun costo.

⚠️ **L'elenco delle funzioni che scavalcano la RLS senza chiedere chi sei passa
da 16 a 17**, dichiarato per nome in
[`tests/app/permessi.test.js`](../../tests/app/permessi.test.js). La prova era
diventata rossa da sola: è il lavoro per cui esiste.

⚠️ **Due funzioni nuove NON sono concesse a nessuno** (`capienza_della_sala`,
`testo_evento_annullato`): le chiamano solo l'accettazione e il trigger, che
girano coi permessi del proprietario. Concederle avrebbe allungato quell'elenco
per niente.

### 🔴 E la rete ha trovato due porte che avevo lasciato aperte

Le due funzioni **trigger** nuove — `evento_annullato_libera_la_sala` e
`vieta_cancellazione_preventivo_accettato` — sono nate **eseguibili da chiunque
abbia la chiave pubblica**, e l'elenco degli anonimi è passato da 10 a 12. È la
trappola scritta il 15/08 («anche una funzione trigger nasce eseguibile da
chiunque»), ricomparsa. Nessun dato usciva — fuori da un trigger si rifiutano
di girare — ma *un elenco che cresce in silenzio non è più un controllo*.

⚠️ **Non l'ho trovata rileggendo: l'ha trovata la prova automatica del 13/08**,
diventando rossa da sola e dicendo **quali** funzioni erano comparse. Chiuse col
`revoke`; i due elenchi tornano **10** e **17**.

---

## 8 · Le prove, e come sono state rese rosse

**Cinque rotture, cinque rossi, tutti col messaggio giusto** (non un errore di
sintassi che non misura niente):

| rottura | cosa è diventato rosso |
|---|---|
| la versione nuova non è più collegata alla vecchia | *«ha creato un secondo evento invece di aggiornare il primo»* — in migrazione **e** dal client |
| «è un evento, quindi blocca» | *«Un evento da 14 persone con 4 già prenotate su 34 posti ha acceso la spunta»* |
| guardo solo l'evento, ignoro le prenotazioni già prese | *«…non ha acceso la spunta: le prenotazioni già prese non vengono contate»* |
| spengo tutte le spunte del giorno | *«è sparita la spunta che aveva messo Alessio a mano»* |
| il trigger non spedisce l'avviso | *«Il trigger dell'annullamento non spedisce nessun avviso»* |

### I numeri sono scelti perché distinguano

Con capienza **34**, i tre casi della migrazione separano le tre risposte
possibili:

| caso | evento | già prenotate | esito giusto | «blocca sempre» | «guardo solo l'evento» |
|---|---|---|---|---|---|
| A | 34 | 0 | spunta | spunta | spunta |
| B | 14 | 4 | **niente** | spunta ✗ | niente |
| C | 30 | 8 | **spunta** | spunta | **niente ✗** |

⚠️ Senza il caso C, «guardo solo l'evento» sarebbe passata verde: A e B da soli
non la distinguono. E la verifica **si ferma** se la sala tiene meno di 20
coperti, invece di passare senza misurare.

### Le prove sui dati veri (7, tutte verdi)

Entrano **dal collegamento dell'app** e passano dal corridoio. Una di loro
esiste **solo** lì e dentro una migrazione non si potrebbe scrivere: *in sala
l'avviso arriva senza il nome del cliente* — le migrazioni girano come
proprietarie e un difetto di permessi non si vedrebbe mai (lezione del 16/08).

---

## Cosa NON è verificato

- 🔴 **Nessuna mano ha visto niente di tutto questo.** Alessio ha deciso di
  lasciare tutte le prove con le mani al collaudo generale.
- 🔴 **Nessun avviso Telegram è mai partito davvero.** Le prove usano il freno
  anti-tempesta del sistema per non far suonare il telefono per un evento
  finto (§8, già successo l'11/08). Che il trigger *spedisca* è provato
  **leggendo il corpo della funzione** — si può scrivere un testo giusto e non
  mandarlo mai, e la migrazione passerebbe verde. **La faccia del messaggio
  («📆 EVENTO ANNULLATO») non l'ha vista nessuno**: entra nel collaudo
  generale **con la ricetta per farla comparire**, voce 4 di
  [`docs/collaudo/annotazioni.md`](../collaudo/annotazioni.md) — *una voce di
  collaudo che nessuno sa come far scattare è una voce che verrà saltata.*
- **In produzione non c'è nessun preventivo** (0), nessun evento, nessuna
  spunta «sala piena»: tutto è provato sul progetto di prova.
- **Il blocco 5 non è fatto**: la sera dell'evento il magazzino scarica ancora
  le porzioni della carta, non quelle modificate dal preventivo.
- **Non è deciso cosa succede riaccettando un evento annullato**: `status`
  tornerebbe a `confermata` e — se l'interruttore è acceso e il cliente ha una
  mail — partirebbe **l'email di conferma delle prenotazioni normali**, che per
  un evento è fuori luogo. Oggi non morde (interruttore e casi veri assenti);
  va guardato quando la posta ai clienti entrerà davvero in servizio.

---

## Ordine di applicazione

1. Alessio pusha;
2. `npm run migra -- --conferma` (`20260820000009`);
3. `npm run funzione operazioni-atomiche -- --conferma` — **senza,
   `accetta_preventivo` risponde 404 e il pulsante non funziona**;
4. `npm run funzione notify-telegram-reservation -- --conferma` — senza,
   l'avviso di un evento annullato arriva sotto il titolo dei guasti;
5. riepilogo coi numeri veri, secondo push.
