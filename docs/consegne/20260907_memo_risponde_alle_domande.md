# MEMO consultivo, fase 1 — MEMO risponde alle domande

**07/09/2026.** Riepilogo per il validatore.

* **HEAD dichiarato**: `bb16932` — il commit che sta sotto questo file.
* **Ramo**: `memo-consultivo-fase-1`, aperto da `798d41a` (master).
* **Migrazioni**: **nessuna.** Nessuna tabella, nessun permesso, nessuna
  funzione del database toccata. L'unica funzione online cambiata è
  `ascolta-voce`.
* **Prove**: 1.033 pure · 42 sulle schermate · 497 contro il progetto di
  prova · lint pulito · compilazione pulita.
  ⚠️ **Due prove pure restano rosse, e sono PREESISTENTI su `master`**:
  `indice-richieste` e `indice-rovesciamenti` — i due indici generati non
  combaciano più con quello che i documenti contengono. **Misurato**, non
  dedotto: con il lavoro di questo ramo messo da parte (`git stash -u`)
  falliscono uguale. Sono fuori dal perimetro di questo mandato e non sono
  state toccate.
* **Copia di lavoro**: un albero separato (`Desktop\Borgo58-App-memo`),
  aperto da `origin/master`. I documenti locali non salvati di Alessio —
  `docs/DECISIONI.md` e `docs/specifiche/` — vivono nell'altra copia e
  **non sono stati né letti né toccati né inclusi**.

---

## Cosa abbiamo rovesciato

**Niente.** Non è stata rovesciata nessuna decisione presa in precedenza.

Le due cose che cambiano nel modulo voce sono **aggiunte**, non
rovesciamenti:

* MEMO fino a ieri capiva solo **comandi**; adesso una frase può essere
  anche una **domanda**. Il comportamento sui comandi non cambia in niente:
  la stessa filza, gli stessi appunti, lo stesso sì.
* Dalla Scorciatoia dell'orologio i comandi continuano a funzionare come
  prima; le domande no, **e lo dice**.

---

## Che cosa fa

Da MEMO voce, con l'accesso vero, si possono fare **nove domande** e
ricevere una risposta scritta, in sola lettura:

| area | domande |
|---|---|
| Ricettario | «ho la ricetta di X?» · «X ha il sedano / quali allergeni ha?» · «quali piatti ho in carta?» |
| Magazzino | «quanto X ho?» · «cosa mi manca?» · «cosa scade?» |
| Agenda | «cosa devo fare oggi?» · «cosa sono in ritardo?» · «quando scade X?» |

### Il modello capisce, il database risponde

Dal modello escono **tre cose sole**: area, quale domanda, di che cosa.
Nessun numero, nessuna data, nessun elenco — e il prompt glielo dice
espressamente («NON RISPONDERE TU ALLA DOMANDA»). Il numero lo legge il
gestionale **col permesso di chi sta guardando**, e la frase la compone una
regola pura.

⚠️ **È la condizione che rende verificabile tutta la fase 1**: un numero
detto dal modello sarebbe plausibile e non controllabile — la forma di
errore più costosa di questo progetto. Così quello che MEMO dice è la stessa
cosa che si legge aprendo la schermata, e sotto c'è il collegamento per
andarla a guardare.

### Le letture stanno nel browser, non nella funzione online

La funzione online gira con la chiave di servizio, **dove la RLS non c'è**:
se leggesse lei la giacenza, la risposta sarebbe quella del database e non
quella di chi sta guardando — cioè un dato consegnato scavalcando il
permesso. Le letture passano dal collegamento dell'app.

⚠️ **Nessuna lettura di denaro.** `v_recipe_costs`, `stock_lots`,
`unit_cost` non compaiono in `src/lib/api/domandeMemo.js`, e una prova di
forma lo sorveglia: alle nove domande il denaro non serve, e non chiederlo è
più forte che chiederlo e non mostrarlo.

### Il comando vince sulla domanda — per costruzione, non per prompt

`comeRispondere()` in `supabase/functions/ascolta-voce/domande.ts`: se dalla
frase è uscita **anche una sola azione**, quella frase è un comando.

⚠️ I due scambi non costano uguale. Una domanda presa per comando produce un
appunto che non scrive niente e si butta in un tocco; **un comando preso per
domanda si perde**, e chi ha parlato crede di aver segnato.

### Le risposte sono cinque

| stato | quando |
|---|---|
| `risposta` | l'ho letto, ed ecco cosa dice |
| `non_lo_so` | **non sono riuscito a leggere** (`NON_LETTO` da `leggi()`) — mai un numero, mai uno zero |
| `chiarimento` | ho capito la domanda, manca il soggetto: «di che cosa?» |
| `scegli` | più candidati: si chiede quale, **per identificativo** |
| `non_so_farlo` | era una domanda, ma non è fra le nove |

🔴 **La riga più importante del modulo**: alla domanda «la carbonara ha il
sedano?», se di qualche ingrediente gli allergeni non li ha guardati
nessuno, la risposta **non è «no»** — è «non te lo so dire», con i nomi
degli ingredienti scoperti. Un «no» lì è una promessa che nessuno può
mantenere, e chi legge la gira a un cliente che ha un'allergia.

⚠️ **Si sceglie per IDENTIFICATIVO, mai per somiglianza del nome.** Davanti
a «Olio» e «Olio di semi», chi ha detto «olio» ha nominato esattamente il
primo — e prenderlo per buono sarebbe scegliere al posto suo. Restringe solo
il tocco su un candidato, che porta con sé il suo identificativo; e quello
chiude il giro, altrimenti la stessa domanda si ripeterebbe all'infinito.

### Niente si scrive

Una domanda registra la dettatura con la filza di azioni **vuota**: zero
appunti, zero azioni, zero movimenti.

⚠️ **Il registro delle dettature si scrive lo stesso, e va dichiarato**: è
il conto di ciò che è stato detto e di quanto è costato (`consumi_ai()` lo
legge da lì). Senza, la chiamata al modello sarebbe costata e non
comparirebbe da nessuna parte — e **il tetto di spesa del mese si potrebbe
superare facendo domande**. Zero azioni vuol dire zero appunti: il registro
non è un dato del gestionale.

### La Scorciatoia dell'orologio

Le domande da lì **non si rispondono, e lo si dichiara**: al polso si entra
da anonimi con una chiave, e nessuna delle fonti delle nove domande è
leggibile da `anon`. Rispondere a metà — o peggio, leggere con la chiave di
servizio — sarebbe consegnare dati a chi ha in mano una chiave e non un
accesso. Provato dal vivo: risposta 200, `rispondibile: false`, zero azioni,
zero appunti.

---

## I difetti trovati, e come

### Due li ha trovati un occhio, guardando il collaudo col modello vero

1. **Il titolo nominava un piatto che nessuno aveva detto.** Era composto
   dall'*esempio* col soggetto appiccicato: «ho la ricetta della caponata?»
   diventava a schermo *«Ho la ricetta della carbonara — «caponata»»*.
   Nessuna asserzione guardava quella stringa.
2. **«Cosa scade?» rispondeva con sessantotto righe.** Non è una risposta:
   è lo scadenziario ricopiato in un riquadro, su un telefono tenuto in una
   mano sola. Ora gli elenchi si tagliano a **sei** righe **dichiarando**
   quante ne restano, e il conteggio nella frase resta quello vero.
   ⚠️ Un elenco tagliato in silenzio è la famiglia che questo progetto
   insegue dal 19/08.

### Quattro li ha trovati la revisione del diff

3. 🔴 **Un prodotto fuori magazzino riceveva un numero.** La risposta era
   «Ghiaccio secco: 0 kg» con un'avvertenza sotto. Ma il Magazzino, al posto
   della giacenza, scrive **«fuori magazzino»** apposta — quel numero è
   quello dell'ultimo carico e non scenderà mai. ⚠️ **Un'avvertenza accanto
   non sana il numero**, e soprattutto MEMO diceva una cosa *diversa* da
   quella che si legge aprendo la schermata: cioè rompeva la promessa su cui
   poggia tutta la fase 1.
4. 🔴 **Lo stesso prodotto veniva contato fra quelli «sotto soglia»**, che
   la schermata non segnala mai (la sua giacenza non scende, quindi il
   confronto non vuol dire niente). **Misurato sul progetto di prova**: dei
   quattro prodotti fuori magazzino, uno — «Zafferano in pistilli» — ci
   finiva dentro. «Mancano 54 cose» invece di 55.
5. **«Questa domanda non la so fare» era un vicolo cieco**: nessun
   collegamento. Ora porta all'area quando il modello l'ha capita, e **non
   inventa una destinazione** quando non l'ha capita.
6. **I candidati di «di quale?» non si tagliavano.** Su un magazzino vero
   «quanto pomodoro ho?» può trovarne quindici, e quindici pulsanti su un
   telefono non sono una domanda.

⚠️ **E l'elenco delle nove domande NON si taglia**, ed è l'unica eccezione
dichiarata: le altre risposte elencano *dati*, e il resto si va a leggere
nella sua schermata. Quelle sono *cosa MEMO sa fare* — mostrarne sei su nove
nasconderebbe tre cose senza nessun posto dove trovarle.

---

## Le prove

| dove | quante | che cosa |
|---|---|---|
| `tests/unita/domande-memo.test.js` | 58 | tutte e nove le domande, non trovato, lettura fallita, più candidati, il «no» sugli allergeni che non si può dare, il taglio dichiarato, il titolo |
| `tests/unita/domanda-o-comando.test.js` | 16 | comando contro domanda, i due elenchi delle nove che devono combaciare, e la **rete che vieta le scritture** in `domandeMemo.js` |
| `tests/schermate/risposta-memo.test.jsx` | 8 | cosa vede chi ha fatto la domanda; **zero pulsanti che scrivano** |
| `tests/app/domande-memo.test.js` | 16 | contro il progetto di prova: le nove fonti si leggono davvero, nessun appunto nasce, la sala non riceve quello che non deve vedere |

**Provate per rottura**, non rilette:

* tolta la precedenza del comando → rossa la prova giusta;
* tolto un `leggi()` → rossa la rete delle letture;
* ripristinate, tutte verdi.

🔴 **E una prova dell'app è nata rossa, e la misura l'ha raddrizzata**: sul
progetto di prova i prodotti sotto la scorta minima sono più di cento, e
l'elenco si taglia. Cercare il proprio fra le sei righe visibili dipendeva
dall'ordine alfabetico — cioè era una prova che passava per caso. Riscritta
sulla domanda giusta: **la risposta combacia col database?** (`righe +
troppe == quante ne dice il Magazzino`).

⚠️ **Una prova di forma è stata corretta perché guardava i commenti**: il
setaccio «qui non si scrive» trovava la frase *«qui non compare
eseguiOperazione»* scritta nell'intestazione del file. Terza volta che
questa trappola si presenta in questo progetto.

---

## Il collaudo con il modello vero

Sul **progetto di prova**, con `ascolta-voce` installata lì (versione 17 →
18) e i dati veri del collaudo. Diciannove frasi in tutto.

Tutte e nove le domande hanno risposto con dati che combaciano col
database. In più:

| detto | esito |
|---|---|
| «segna che ho due chili di astice» | **comando**: appunto `giacenza` in attesa |
| «quanto mi costa la caponata?» | domanda **fuori dalle nove**, elenca quelle che sa |
| «quanto ne ho?» | **chiarimento**: «Di che cosa?» |
| «quanto wasabi ho?» | «non ce l'ho in magazzino», **non zero** |
| «quanto olio ho?» | **chiede quale** fra tre |
| «la caponata ha il sedano?» | **chiede quale** fra cinque caponate |
| dalla Scorciatoia | «te la posso dire solo dal gestionale», zero appunti |

**Pulizia**: sedici dettature e un appunto, cancellati **per
identificativo** (regola del 23/08) — non «le più recenti». Controllato
dopo: zero dettature rimaste, zero azioni, zero appunti aperti sul progetto
di prova.

---

## Cosa NON è stato verificato

1. **Nessun occhio ha guardato una schermata vera.** Le prove sulle
   schermate montano il solo riquadro in un ambiente finto: dicono *che cosa
   c'è scritto*, non *come si legge in cella con le mani occupate*. Se una
   risposta di sei righe si legga davvero su un telefono lo può dire solo
   una mano.
2. **Il modello non è una garanzia.** Le prove sorvegliano la **regola**: se
   il modello classificasse male una frase, la regola farebbe la cosa
   prudente (comando, o «non la so fare»), ma *quante volte* classifichi
   bene non lo dice nessuna prova. Le diciannove frasi del collaudo sono un
   campione, non una misura.
3. **La lettura che fallisce non è stata provocata dal vivo.** Il caso «non
   lo so» è provato sulla regola, dove si può costruire; sul progetto di
   prova non si è staccata la rete a metà domanda.
4. **La sala non può ancora fare nessuna domanda**, ed è un fatto misurato,
   non una scelta di questo blocco: `registra_dettatura` pretende
   `is_titolare()` e la rotta `/detta` è chiusa allo staff. Quello che la
   prova dimostra è che, il giorno che ci arrivasse, **l'Agenda non le
   consegnerebbe** quello che non deve vedere — perché a decidere è la RLS,
   non MEMO.

---

## Un problema estraneo, annotato

`tests/unita/indice-richieste.test.js` e
`tests/unita/indice-rovesciamenti.test.js` **sono rosse su `master`**, prima
e indipendentemente da questo lavoro: i blocchi-indice scritti dentro
`docs/RICHIESTE.md` e `docs/decisioni_rovesciate.md` non combaciano più con
quelli che `npm run richieste` e `npm run indice` genererebbero. Si
rigenerano con quei due comandi. **Non toccato**: è documentazione fuori
dal perimetro di questo mandato.
