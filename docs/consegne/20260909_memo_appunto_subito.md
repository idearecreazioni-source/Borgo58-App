# MEMO — l'appunto appena detto si vede subito

**09/09/2026.** Riepilogo di consegna.

* **HEAD dichiarato**: `d963fc5` — l'unico commit di lavoro (questo riepilogo e' il commit sopra, ed e' sola documentazione).
* **Ramo**: `memo-appunto-subito`, che parte dalla cima della **#46**
  (`agenda-scelta-candidato`, `2814311`) e quindi contiene anche la **#42**,
  la **#43**, la **#44** e la **#45**. ⚠️ **Nessuna delle cinque è stata
  toccata, unita o pubblicata.**
* **Migrazioni**: **nessuna.** Il difetto è tutto nella schermata: il
  database scriveva già l'appunto, e lo scriveva giusto.
* **Funzioni online**: **nessuna installata.**
* **Controlli su GitHub: TUTTI VERDI** (giro `34404250280`, proposta **#47**):
  **1.247 prove pure** (87 file) · **94 sulle schermate** (9) · **536 contro
  il progetto di prova** (74) · lint pulito · compilazione pulita. I due
  lavori di pubblicazione sono **saltati**, come devono.
* **Chiamate live al modello**: **ZERO**, e cercando `anthropic.com` in tutto
  il registro della coda si trovano **zero** righe.
* **Il server di prova serve QUESTO ramo**, verificato in tre modi: il
  processo gira dal worktree `Borgo58-App-subito`; il codice chiesto
  all'indirizzo Tailscale contiene `appenaFatti`, `giroRef` e
  `--barra-pollice`; e la coppia indirizzo/chiave nomina Borgo58-Prova.

## Il difetto, e perché era invisibile leggendo il codice

Finita una dettatura, il riquadro diceva **«Ne ho fatto un appunto»** e
mandava a guardare *«qui sotto»*. Ma l'elenco di sotto quell'appunto lo
**escludeva apposta**:

```js
const giaSopra = new Set((riscontro?.daGuardare ?? []).map((a) => a.id));
const daGuardareOra = attesa.filter(
  (a) => !(a.elementi ?? []).every((e) => giaSopra.has(e.id)),
);
```

🔴 **Quella riga non è un errore: è una decisione giusta del 27/08** — *la
stessa riga non sta in due riquadri, o fa credere di aver parlato due volte*.
Il difetto è che **sopra** c'era solo la frase detta, e **sotto** non c'era
niente. Per vedere la scheda — coi candidati da toccare e con «Approva» —
bisognava uscire da MEMO e rientrare.

⚠️ *Una schermata che dice dove guardare e non ci mette niente è peggio di una
che tace*: chi legge «li trovi qui sotto» guarda sotto, non trova, e conclude
che il gestionale non ha scritto niente.

## La cura: la scheda si sposta, non si duplica

La scheda intera compare **dentro** «Ne ho fatto un appunto», e l'elenco di
sotto continua a non ripeterla.

| stato | cosa si vede |
|---|---|
| appunto approvabile | la scheda con **«Approva»**, subito |
| appunto ambiguo | la scheda coi **candidati da toccare** (#46), subito |
| appunto non approvabile | la scheda col **suo perché**, subito |
| una risposta a una domanda | **nessuna scheda** |
| elenco che si aggiorna dopo | **nessun doppione** |

🔴 **E l'appunto è quello del SERVER**, non una copia messa insieme dal
browser: è la stessa riga che arriva da `appuntiDaApprovare()`, con dentro i
candidati, l'essere approvabile e tutto il resto. Una scheda inventata qui
sarebbe una promessa su cosa verrà scritto, fatta da chi non lo sa.

⚠️ **Finché la lista del server non è tornata** resta la frase detta, con
«Sto rileggendo quello che ho scritto…». È quello che si sa in quel momento.

## La gara che nessuno vedrebbe arrivare

🔴 `ricarica()` parte **all'apertura** e di nuovo **appena finisce una
dettatura**: sono due letture della stessa lista in volo insieme. Se la prima
— partita prima, quindi **senza** l'appunto appena nato — arriva per ultima,
la scheda **compare e sparisce un istante dopo**.

⚠️ E sparirebbe in silenzio: nessun errore, solo una scheda che c'era e non
c'è più. La cura è un numero di giro: **vince sempre la lettura più recente,
non la più veloce**. C'è una prova che fa arrivare apposta la vecchia per
ultima.

## Il pulsante che non si poteva premere

🔴 **Trovato misurando, e non era nel mandato.** `BarraDelPollice` riserva lo
spazio della barra fissa **dove sta la barra**, e il suo commento diceva
*«non c'è modo che qualcosa finisca sotto»*. È vero finché la barra è
l'**ultima** cosa della pagina. In MEMO non lo è: sta a metà, e sotto ci sono
il riscontro e l'elenco.

**Misurato a 390×844, col telefono simulato in un riquadro che ha il suo
viewport** (la finestra di Chrome non si lasciava restringere):

| | prima | adesso |
|---|---|---|
| «Parlare senza aprire il gestionale» | **66 punti sotto la barra** | scoperto |
| cosa resta sotto la barra | un pulsante vero | **solo il distanziatore** |

La cura: la barra impara a **non** riservare lo spazio dov'è
(`spaziatore={false}`) e **pubblica quanto occupa** (`--barra-pollice`); MEMO
lo riserva in fondo. ⚠️ **L'altezza non è scritta a mano da nessuna parte**: la
misura vive in un posto solo, quindi le due non possono separarsi al primo
ritocco — è la stessa ragione per cui il 29/08 lo spaziatore aveva smesso di
essere un numero.

## Cosa abbiamo rovesciato

**Uno, ed è registrato**: [n. 84](../decisioni_rovesciate.md) — *«nel riquadro
di quello che hai appena detto non si approva niente»* (SPEC-0013, 06/09).

⚠️ **La ragione di allora vale ancora intera, e proprio per questo la forma
nuova la rispetta.** Il divieto era su **approvare una riga**: lì c'era il «Sì,
fallo» di ogni singola voce, e approvarne una scavalcava il raggruppamento —
si diceva sì a una voce di una lista senza vedere le altre due che ci stavano
dentro. Quello che compare adesso **non è una riga**: è l'appunto intero, con
tutti i suoi elementi sotto gli occhi. Il gesto resta uno solo.

⚠️ **E la regola del 27/08 non si rovescia**: la stessa riga continua a non
stare in due riquadri — l'elenco di sotto non la ripete. C'è una prova che lo
congela contando le schede a schermo.

## Le prove, e cosa dimostrano

**Nella suite delle schermate** (`tests/schermate/memo-appunto-subito.test.jsx`,
9): appunto approvabile, ambiguo e non approvabile → la scheda si vede
subito, ognuno col suo stato completo; **nessun doppione** dopo un altro giro
della lista; **una risposta non fa comparire nessuna scheda**; **la gara** —
una lettura vecchia in ritardo non fa sparire la scheda; **la pagina porta
l'occhio dall'alto**, che è ciò che tiene «Approva» fuori da sotto la barra; e
la barra fissa è comunque sulla pagina.

⚠️ **SI MONTA LA PAGINA INTERA, ed è un'eccezione dichiarata**: il difetto vive
nel raccordo fra la risposta della voce e la lista del server, non dentro la
scheda — montare solo il componente non lo vedrebbe. Per non ripetere il caso
del 06/09 (la pagina MEMO montata faceva **scadere il tempo alle prove degli
altri file** della stessa cartella) **tutto ciò che pesa è finto**: le
chiamate, la pagina delle risposte, e il modulo delle domande. ✅ Misurato: la
cartella intera gira in **13 secondi** e nessun file va in timeout per colpa
di questo.

⚠️ **Niente di vero è stato toccato dalle prove**: nessun database, nessun
appunto e nessun impegno di Alessio. Le righe sono inventate dentro il file.

## Le prove discriminano: provate per rottura

| rottura voluta | esito |
|---|---|
| la scheda nuova non compare (`appenaFatti` sempre vuoto) | **7 rosse su 9** |
| solo il numero di giro tolto (la gara) | **1 rossa, e proprio quella della gara** |

⚠️ La seconda è quella che conta: una rottura che fa scattare il primo
guardiano non prova i controlli che vengono dopo (lezione del 26/08).

## Il primo giro della coda è stato rosso, e non per questo lavoro

⚠️ **Va detto invece di essere nascosto dietro un rilancio.** Il primo giro è
fallito su `tests/app/permessi.test.js` — *«v_discounts_gifts_monthly: il
titolare non riesce a leggerla»*.

**Cosa è stato misurato**: quella prova passa **in locale** (536 su 536) e
passa **al rilancio della coda**. E questo lavoro **non ha nessuna
migrazione e non tocca il database**: non può aver cambiato i permessi di
una vista.

⚠️ **E il messaggio d'errore era VUOTO** (`{ message: '' }`): un permesso
negato dice *«permission denied for…»*. Un errore senza messaggio è la firma
di un intoppo nel mezzo, non di un rifiuto del database.

🔴 **Ma è la seconda volta di fila**: anche la #46 ha avuto un primo giro
rosso su prove che non c'entravano (un timeout a 30 secondi sugli eventi),
verde al rilancio. **Due su due**, sempre sul progetto di prova condiviso.
Non è dimostrato che sia contesa — nessuno ha misurato cosa altro lo stesse
usando — ma *un controllo che ogni tanto dice rosso senza che niente sia
rotto insegna a non guardare i rossi*, ed è la cosa che questo progetto teme
di più. **Vale la pena guardarci, come lavoro a sé.**

## Cosa NON è verificato

* 🔴 **Nessuna frase è stata dettata davvero.** Il mandato vieta le chiamate al
  modello: il giro è pilotato con un riconoscitore finto, e la risposta del
  server è finta. Quello che resta scoperto è la catena voce → modello →
  appunto, che è la stessa cosa non provata da tre consegne.
* ⚠️ **La misura del telefono è fatta in un riquadro da 390×844 dentro Chrome**,
  non su un telefono: la finestra non si lasciava restringere sotto la soglia
  che fa scattare le regole responsive. Il riquadro ha però il suo viewport,
  quindi la barra era davvero `fixed` e le misure sono quelle vere di quel
  caso.
* ⚠️ **La scheda nuova non è stata vista comparire con gli occhi**, perché per
  farla comparire servirebbe una dettatura vera. Quello che è stato guardato è
  la pagina con le schede già lì, e la barra che non le copre più.
* ⚠️ **Tre prove sulle schermate restano rosse in locale su Windows**
  (`rotte-chiuse`, `varco-pubblico`): **misurate anche sul ramo pulito, senza
  una riga di questo lavoro, e falliscono identiche**. Sono le stesse che le
  consegne #45 e #46 dichiarano preesistenti e verdi in CI.
* ⚠️ **Niente è stato applicato alla produzione.**
