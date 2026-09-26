# MEMO operativo — Agenda, fase 2: chiudere e spostare davvero

**09/09/2026.** Riepilogo di consegna.

* **HEAD dichiarato**: `9eac745` — l'unico commit di lavoro della fase 2.
* **Ramo**: `agenda-fase-2`. ⚠️ **Dipende da tutt'e due le proposte aperte e
  le contiene**, senza duplicarne una riga: parte dalla cima della **#42**
  (`memo-agenda`) e ha dentro la **#43** (`riscontro-non-approvabili`) per
  merge. Quando quelle saranno unite a master, qui non resterà niente da
  riapplicare.
* **Migrazioni**: **una**, `20260909000002_agenda_chiude_e_sposta_un_impegno`.
  **Applicata solo a Borgo58-Prova** (382 migrazioni registrate lì).
  In produzione non è stato applicato niente.
* **Funzioni online**: `ascolta-voce` installata **solo sul progetto di
  prova** (v30 → v31). In produzione resta alla v9.
* **Prove**: 1.224 pure · 71 sulle schermate · **569 contro il progetto di
  prova** · lint pulito · compilazione pulita.
  ⚠️ **Cinque prove restano rosse in locale e sono PREESISTENTI su `master`**
  (2 sugli indici dei documenti, 3 sulle schermate `rotte-chiuse` e
  `varco-pubblico`): verdi in CI, non dipendono da questo lavoro.
* **Chiamate live al modello**: **4** delle 8 concesse, per **0,403 €**, sul
  progetto di prova.

## Che cosa cambia

La fase 1 aveva chiuso il difetto — «segna come fatto il rinnovo della firma
digitale» non fa più nascere un impegno **nuovo** con quel titolo — e
dichiarava quello che il gestionale non sapeva fare. Adesso lo sa:

| quello che dice | prima (fase 1) | adesso |
|---|---|---|
| «Ricordami di chiamare Tiziana domani» | crea l'impegno | **identico** |
| «Segna come fatto il rinnovo della firma digitale» | appunto non approvabile | appunto **approvabile**: approvando chiude quell'impegno |
| «Sposta a venerdì l'ordine delle verdure» | appunto non approvabile | appunto **approvabile**: approvando sposta quella scadenza |

🔴 **La frase detta non scrive niente, e questo non cambia.** Fra la voce e
la riga di Agenda c'è sempre un appunto approvato guardando il titolo.
Quello che cambia è che quell'appunto, quando l'impegno è **uno solo**, si
può approvare — e approvandolo succede davvero.

## Quando non è uno solo, non sceglie nessuno

🔴 Zero impegni compatibili, o più di uno: la destinazione diventa
`agenda_quale_impegno`, che nel catalogo **non c'è** — quindi l'appunto non è
approvabile **per costruzione**, senza nessun controllo da ricordare — e la
frase dice se non ne ha trovato nessuno o troppi.

⚠️ **Si nominano tutte le cose che mancano**, non la prima: dirne una per
volta fa scoprire la seconda dopo aver rimediato alla prima.

⚠️ **E la via d'uscita c'è comunque**: tutte e tre le destinazioni dell'Agenda
portano in `/agenda`. Un rifiuto senza gesto d'uscita è un vicolo cieco
(16/08), e qui il rifiuto è per costruzione.

## Dove vive la ricerca, e perché lì

In **`voce_risolvi_dati`**, che è dove questo gestionale traduce «come l'ha
chiamato lui» in «quale riga è» per prodotti, frigoriferi, pulizie,
preparazioni, causali e fornitori. Metterla nella funzione online sarebbe il
secondo posto che decide la stessa cosa.

⚠️ **Prima il nome esatto, poi quello che lo contiene.** «Ordine verdure»
detto per intero non deve diventare incerto perché in Agenda c'è anche
«Ordine verdure e frutta». Non è una scelta fra candidati: è che uno dei due
modi di cercare ne trova **uno solo**.

⚠️ **`voce_titolo_nudo` non riusa `nome_ingrediente_chiave`**, e il
discriminante è quello del 17/08: direbbero *esattamente* la stessa cosa? No.
Quella fa una **chiave** per riconoscere l'articolo di un fornitore e lascia
cadere le lettere accentate; questa confronta **quello che è stato detto** con
**quello che è scritto**, e la dettatura del telefono gli accenti a volte li
mette e a volte no — «venerdì» e «venerdi» devono essere la stessa parola.

⚠️ **Solo gli impegni aperti**: uno già fatto non si richiude e non si sposta,
e comparire fra i candidati lo renderebbe ambiguo per niente. «in corso»
resta dentro: è un impegno vivo.

## Il seme nuovo, e perché serviva

🔴 **Ciò che si scopre guardando il database può cambiare la destinazione, non
solo i dati.** `voce_risolvi_dati` può ora proporre un tipo diverso, e
`scrivi_dettatura` lo onora. Senza quella riga l'appunto resterebbe
**approvabile** — lo dice il catalogo, non i dati — e chi preme «Approva»
riceverebbe un rifiuto per una cosa che la schermata gli aveva offerto.

⚠️ Chi decide resta `voce_risolvi_dati`, che è l'unico posto che ha guardato:
`scrivi_dettatura` esegue quello che gli è stato detto.

## Fra la proposta e il «sì» può essere cambiato tutto

L'appunto non scade mai, quindi possono passare giorni. Tre controlli, tutti
e tre nella stessa forma — **fermarsi senza scrivere e dire perché**:

1. **l'impegno è stato tolto** dall'Agenda;
2. **è stato chiuso da qualcun altro** (o rinominato);
3. **è stato spostato a un'altra data** — e lì il messaggio dice **tutti e tre
   i giorni**: dov'è adesso, dov'era secondo l'appunto, dove non l'ho portato.

🔴 **E se l'identificativo si perde NON si cerca un sostituto.** In Agenda
potrebbe esserci un altro impegno somigliante, e chiuderlo vorrebbe dire
eseguire una firma data su una riga che nessuno ha mai visto sull'appunto. La
prova end-to-end apparecchia esattamente quel caso.

⚠️ **Il titolo e la data di partenza si scrivono una volta sola**, alla prima
risoluzione. `approva_appunto` richiama `voce_risolvi_dati`: riscrivendoli con
quelli di adesso, l'appunto si allineerebbe da solo a un impegno cambiato — e
il controllo che si ferma quando è cambiato non scatterebbe mai.

## Si riusa il gesto dell'Agenda

`completa_task` chiude l'impegno **e fa nascere il ricorrente successivo**. Un
`update` scritto dentro il ramo vocale sarebbe la seconda definizione di
«segnare fatto», e la prima volta che si chiude a voce un adempimento annuale
quello sparirebbe invece di ripresentarsi l'anno dopo.

Lo spostamento è invece lo stesso `update` di una tabella sola che fa il
pulsante «rimanda» (`spostaTask`): lì il Contratto non chiede il corridoio.

## Il collegamento torna nel database

🔴 La fase 1 se lo portava dietro dentro i dati dell'appunto, perché
`azione_percorso` — il posto dove quella cosa vive dal 27/08 — per un tipo
fuori catalogo rispondeva giustamente niente, e aggiungercelo voleva dire una
migrazione che quel lavoro non poteva fare.

Adesso la migrazione c'è, e il ripiego **si toglie invece di restare
accanto**: due posti che dicono dove si va sono due posti che un giorno
diranno cose diverse — ed è esattamente la ragione per cui quella regola era
stata scritta. Due prove pure tengono chiusa la porta.

⚠️ **E l'etichetta del collegamento non promette più «coi campi già
compilati»**: sull'Agenda non c'è nessun modulo da riempire, c'è un impegno da
cercare. La promessa resta vera dove è vera — sulle dodici destinazioni che
hanno un modulo — ma non si scrive più su un pulsante che non la mantiene.

## Il collaudo dal vivo, quattro frasi sul progetto di prova

Attraversando la porta del telefono per intero: dettatura → appunto **letto
come lo legge la schermata** → approvazione **dal corridoio** → e poi si va a
guardare in Agenda.

| frase | esito misurato |
|---|---|
| «Segna come fatto il … rinnovo della firma digitale» | appunto **approvabile**, titolo dell'impegno vero, gesto «segna fatto» · approvato → in Agenda **completato** |
| «Sposta a venerdì il … ordine delle verdure» | appunto **approvabile**, **da 2026-09-07 a 2026-09-11** · approvato → in Agenda **11/09, ancora da fare** |
| «Ricordami di chiamare Tiziana domani» | `promemoria`, «Annota in Agenda», approvabile, collegamento `/agenda/nuovo` — **identico a prima** |
| «Quanto ho in cassa?» | **domanda**: zero azioni, zero appunti |

Gli impegni e le righe di prova sono stati cancellati per identificativo:
misurato dopo, **zero residui**.

## Le prove, e cosa dimostrano

* **27 pure**: le tre intenzioni, le parole che le distinguono, la data che
  non si inventa, e — nuove — che questo modulo **non si porta più dietro né
  l'indirizzo né il motivo** dei due gesti che adesso il database sa fare.
* **12 sulle schermate**: ciò che si vede **prima di firmare** — quale
  impegno, quale gesto, e sullo spostamento **da che giorno a che giorno** —
  più il caso ambiguo, dove il pulsante «Approva» **non c'è**, e il
  collegamento è **uno solo**.
* **12 contro il progetto di prova**: il giro intero, con l'Agenda **guardata**
  prima e dopo. Compresi i due candidati, nessun candidato, la data mancante,
  la data che non è una data, l'impegno chiuso nel frattempo (con un
  somigliante apposta), l'impegno spostato nel frattempo, l'impegno tolto.

⚠️ **Ogni dettatura di prova controlla anche che la schermata riceva tutte le
righe scritte**: è il difetto dell'08/09, e adesso è una condizione di ogni
prova invece di una prova a sé.

## La verifica della migrazione discrimina

Otto gruppi di controlli in una sotto-transazione annullata: il catalogo e il
ramo che nascono insieme, un candidato solo, due candidati, nessun candidato,
lo spostamento, la data mancante, l'impegno cambiato fra proposta e
approvazione (chiuso e spostato), il promemoria invariato, le uscite a mano.

⚠️ **La metà che conta è quella che non deve cambiare**: una verifica che
provasse solo i due gesti nuovi passerebbe anche se questa migrazione avesse
rotto la creazione di un impegno, che è il gesto più frequente dell'Agenda.

## Cosa abbiamo rovesciato

**Una cosa, ed è dichiarata.** L'etichetta del collegamento a mano diceva
«Fallo a mano, **coi campi già compilati** →» (27/08). Adesso dice «Fallo a
mano →».

* *cosa era stato deciso e quando*: 27/08/2026, decisione di Alessio —
  *«mi aspetto che un collegamento mi porti dove si segnano le spese, coi
  campi noti già compilati»*.
* *la ragione di allora*: la promessa dei campi compilati è il valore del
  gesto, e va detta.
* *cosa si decide adesso*: la promessa esce dall'etichetta.
* *perché la ragione di allora non vale più*: **vale ancora, e resta vera per
  dodici destinazioni su quindici** — ma su `/agenda` non c'è nessun modulo da
  riempire, e una schermata non promette un valore che un altro pezzo non
  mantiene. La promessa si dimostra arrivando a destinazione, dove la striscia
  la fa vedere, invece di essere scritta su un pulsante che a volte mente.

Riga aggiunta in `docs/decisioni_rovesciate.md`.

## Cosa NON è verificato

1. **Nessun occhio ha guardato la schermata**: l'appunto approvabile, i due
   giorni e il pulsante sono provati dal codice, non visti. Il collaudo col
   telefono resta da fare ad Alessio.
2. **In produzione non è stato applicato né installato niente**: la migrazione
   e la funzione sono solo sulla prova.
3. **La ricerca dell'impegno è provata su titoli costruiti**, non sui nomi che
   Alessio userà davvero. Quello che è dimostrato è la **proprietà**: se i
   compatibili non sono esattamente uno, non si approva.
4. **L'ordine fra le tre proposte conta**: #43 prima, poi #42 riallineata su
   master, poi questa. Questo ramo le contiene tutt'e due e non va unito prima
   di loro.
5. **Non è stato provato con due dettature approvate nello stesso istante**:
   la concorrenza sull'approvazione è quella già in vigore (`for update` su
   `appunti_vocali`), non toccata da questo lavoro.
