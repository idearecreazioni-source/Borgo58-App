# Consegna del 16/08/2026 (diciassettesima) — lo stato di partenza del progetto di prova

**Commit della consegna: `413749a`.** Questo riepilogo è il commit
immediatamente sopra, sola documentazione. Working tree pulito.

| Commit | Cosa |
|---|---|
| `833a087` | lo stato di partenza, il controllo, il sito sulla prova — migrazione `20260816000017` |
| `fba1c05` | il segno del database sale in cima (prima correzione di Alessio al collaudo) |
| `413749a` | la striscia dei dati veri prende la forma di quella di prova (seconda correzione) |

⚠️ **`20260816000017` è già applicata in produzione** (§5). Nessuna Edge
Function reinstallata, nessuna operazione nuova nel corridoio.

Questa consegna **non modifica** `docs/CONTRATTO.md`.

Blocco a sé, successivo al mandato di correzione. Serviva a due cose: far
scattare **sul progetto di prova** i difetti che oggi si scoprono in
produzione, e rendere possibile il collaudo vero.

---

## 1. 🔴 La dimostrazione che il blocco serviva — un difetto vero, trovato costruendolo

Costruendo lo stato di partenza con i **gesti veri dell'app**, la prima
ricetta segnata «pronta per carta» ha risposto:

```
42501 — new row violates row-level security policy for table "recipe_status_history"
```

`log_recipe_status_change` (migrazione `20260802000003`) è `security
invoker`: gira coi permessi di chi ha fatto la modifica. Su
`recipe_status_history` l'unico permesso concesso è `select` — la stessa
migrazione dichiara nel commento di volerci scrivere, e poi non concede
l'insert.

**Conseguenza: dal 02/08/2026 nessuno poteva marcare una ricetta «pronta
per carta», né togliere quel segno, da nessuna schermata.** Non un errore
silenzioso: un errore incomprensibile in faccia, sopra un gesto normale.

### Perché non se n'era accorto nessuno — è la parte da tenere

| Chi avrebbe dovuto vederlo | Perché non l'ha visto |
|---|---|
| La revisione generale (16 difetti trovati) | ha letto tutto il codice; qui il codice **è scritto bene** — è il permesso che manca da un'altra parte |
| Le verifiche dentro le migrazioni | girano come **proprietarie del database**, e le proprietarie scavalcano la RLS: il difetto sarebbe passato verde anche prima della correzione |
| Le prove automatiche | nessuna cambiava quel campo su una ricetta esistente (l'INSERT non fa scattare un trigger `after update`) |
| L'uso quotidiano | il Ricettario in produzione ha **0 ricette** |

Ci voleva **il gesto vero, fatto col token di un utente vero**. È
esattamente ciò che fa `npm run prova:base`, ed è l'argomento per cui il
collaudo con le mani è la prossima cosa da fare.

### La cura — migrazione `20260816000017`

`security definer` + `set search_path = public`: il pattern già scritto in
CLAUDE.md §6 per ogni funzione che deve scrivere fuori dai permessi di chi
la chiama.

⚠️ **Lo storico resta NON scrivibile dai client**, e il controllo guarda la
cosa giusta: la porta la tiene chiusa la **RLS accesa senza nessuna policy
di scrittura**, non il permesso sulla tabella — `authenticated` il permesso
di insert ce l'ha, glielo dà Supabase a tutte le tabelle dello schema.
Guardare il permesso avrebbe prodotto un allarme falso, e un allarme falso
dentro una migrazione si disattiva e non torna più.

⚠️ **L'elenco delle funzioni aperte alla chiave pubblica scende da 11 a
10**, nell'unico modo ammesso: una riga in meno, dichiarata nella stessa
consegna. Diventata `definer`, lasciarla eseguibile da fuori sarebbe stata
una porta aperta; come funzione di trigger non ha bisogno di permessi.
`tests/app/permessi.test.js` è aggiornata **col perché scritto dentro il
file**, non solo qui.

---

## 2. Lo stato di partenza — `npm run prova:base`

Poche righe vere, non un gestionale finto. Quattordici gesti:

| | |
|---|---|
| fornitore · ingrediente · variazione di prezzo · lotto | la catena della spesa |
| ricetta con una riga · menu attivo con un piatto | il Ricettario (ed esercita il riflesso «in carta» di ieri) |
| **conto aperto → riga → mandato in cucina → chiuso e pagato** | con lo scarico di magazzino che ne consegue |
| movimento di prima nota · fattura da pagare | i soldi |
| tablet · parametri fiscali · riga in lista della spesa · ricevimento non conforme | quattro tabelle in cui una verifica, oggi, girerebbe a vuoto |
| prenotazione confermata | la sala |

### ⚠️ Costruito chiamando le funzioni VERE dell'app

Non con `insert` scritti nello script. Uno stato di partenza scritto a mano
è una **copia** del comportamento dell'app, e le copie invecchiano in
silenzio: il giorno in cui `apri_conto` cambia parametri, o una scrittura
passa dal corridoio, o nasce un vincolo nuovo, questo comando **o si
aggiorna da solo o smette di funzionare e lo si vede subito**.

*Corollario dichiarato: il comando è anche una prova. Se domani fallisce,
la prima ipotesi non è che sia rotto lui.* Lo ha già dimostrato tre volte
in un'ora: `create_ingredient` restituisce la riga e non l'identificativo,
`dining_tables` non ha più la colonna `sagoma`, `reservation_type` non
contiene «cena». Nessuna delle tre si vedeva leggendo.

**Come**: i moduli di `src/` si importano fra loro senza estensione e
leggono `import.meta.env` — Node da solo non sa fare né l'una né l'altra
cosa. Si caricano quindi **dentro Vite** (`ssrLoadModule`, modalità
`test`), che è già una dipendenza del progetto: la configurazione arriva da
`.env.test`, e il codice esercitato è quello che gira nel browser.

### ⚠️ La demolizione NON passa dall'app, ed è una scelta

L'app si **rifiuta** di cancellare un conto chiuso — è la regola del Blocco
4 del mandato: *«il totale su cui hai incassato non deve cambiare dopo»*.
Chiedere all'app di disfare lo stato di partenza vorrebbe dire aprire una
porta in quella regola per comodità di collaudo, cioè indebolire un vincolo
che protegge soldi veri.

**Si costruisce dai gesti dell'app, si demolisce dal database** — con
`session_replication_role = replica`, altrimenti ogni riga tolta
lascerebbe una **lapide** nel registro delle cancellazioni: righe di prova
indistinguibili da cancellazioni vere, esattamente ciò che quel registro
non deve contenere. La pulizia dichiara **quante righe ha tolto** (21
all'ultimo giro).

### Marcato e ricostruibile

Tutto si chiama `BASE-…`, accanto ai `TEST-AUTO …` delle prove.
`npm run prova:base -- --rifai` lo rifà; `npm run prova:ricostruisci` lo
rimette da sé alla fine — e **se non ci riesce lo dice** invece di finire
in silenzio con un database vuoto, che è la condizione da cui nasce tutto
il problema.

---

## 3. Il controllo — `npm run prova:stato`

La regola: **le tabelle non vuote nel locale vero non devono essere vuote
sul progetto di prova.**

⚠️ **L'elenco non è scritto a mano.** Si ricava dal locale vero a ogni
esecuzione (conteggio riga per riga via `query_to_xml`, non le stime di
`pg_stat`, che su tre righe possono dire zero): man mano che il locale si
riempie, il comando chiede di più da solo. Un elenco scritto oggi sarebbe
una fotografia della produzione di oggi travestita da regola — lo stesso
errore del guardiano che contava tre righe (16/08).

⚠️ **Elenca cosa manca, non risponde sì o no.** E distingue due casi che
sembrano uno: una tabella **vuota** è stato di partenza mancante; una
tabella che sulla prova **non esiste** è il progetto indietro con le
migrazioni, ed è un problema diverso e più grave.

| | prima | dopo |
|---|---|---|
| Tabelle non vuote nel locale vero | 45 | 45 |
| Di queste, **vuote sulla prova** | **29** | **16** |

Le 16 che restano sono due famiglie sole, ed è una linea netta: la posta e
l'assistente (`posta_ricevuta`, `posta_azioni`, `posta_allegati`,
`documents`, `domande_archivio`), le previsioni (`scenari_proiezione` e le
cinque `scenario_*`), gli ordini ai fornitori (2), più
`articoli_fornitore` e `anomalie_scarico`. **Sono i dati di collaudo**, che
per mandato non sono in questo blocco.

---

## 4. Il sito sul progetto di prova — `npm run dev:prova`

`.env.local` non si tocca: `npm run dev` continua ad aprire il locale vero
e non c'è niente da rimettere a posto dopo. I valori si leggono da
`.env.test` e si passano a Vite solo per quell'esecuzione.

*(Verificato empiricamente, non dato per buono dalla documentazione: le
variabili `VITE_*` dell'ambiente vincono su `.env.local`. Controllato
compilando e cercando l'indirizzo dentro il pacchetto prodotto, e poi dal
vivo — il server di sviluppo serve `supabase.js` con dentro l'indirizzo
del progetto di prova.)*

Il comando si **rifiuta di partire** se `.env.test` puntasse alla
produzione, e il controllo si rifà una seconda volta **dentro** lo script
dello stato di partenza, sull'ambiente che i moduli hanno davvero caricato:
fra le due cose c'è la risoluzione delle variabili di Vite, ed è lì che un
errore non si vedrebbe.

### Il segno in schermata — due correzioni di Alessio, e sono la parte migliore

| Versione | Esito del collaudo |
|---|---|
| Targhetta piccola in basso a sinistra | **bocciata**: vista solo perché la stava cercando. Il criterio era «notata senza cercarla» |
| Striscia grigia sottile in cima | **bocciata**: sul telefono si notava di più, ma non abbastanza |
| Striscia identica a quella rossa, cambia solo colore e testo | **passata** |

Le sue due ragioni, che valgono più delle modifiche:

1. *Due segni in due posti diversi si imparano peggio di due stati dello
   stesso segno.* Se l'occhio deve controllare **un solo punto**, il
   controllo diventa automatico in due giorni; un angolo in basso non entra
   mai nel campo visivo di chi lavora.
2. *Se sono due stati dello stesso segno devono avere anche la stessa
   forma.* Un grigio sottile accanto a un rosso pieno non sono due stati:
   sono due segni diversi, e **il più discreto è proprio quello che avvisa
   del caso più pericoloso**. Non serve accorgersi della striscia — serve
   accorgersi **quando cambia**, e questo funziona solo se le due sono
   confrontabili a colpo d'occhio.

⚠️ **La forma condivisa non è un'intenzione: è una proprietà del codice.**
La striscia è scritta **una volta sola**; i tre stati forniscono soltanto
colore, titolo e spiegazione. Non è possibile che una delle due dimagrisca
senza che dimagriscano tutte — che è esattamente il difetto della versione
bocciata, dove erano due pezzi separati e uno dei due si è fatto timido.

- grigia: **DATI VERI** — quello che scrivi qui conta davvero.
- rossa: **DATABASE DI PROVA** — quello che scrivi qui non è vero, e quello
  che leggi nemmeno.
- rossa: **DATABASE SCONOSCIUTO** — un terzo database non è «probabilmente
  la prova». Congelato in 6 prove pure, insieme al caso senza indirizzo:
  **senza indirizzo non si risponde «sei sul vero»**, che sarebbe una
  rassicurazione falsa.

Il segno sta **sopra le rotte**, non dentro il Layout: vale anche sulle
Comande e sulla pagina pubblica, che il Layout non lo usano.
`print:hidden`: su un preconto o su un registro HACCP non c'entra niente.

---

## 5. I numeri veri — `20260816000017` in produzione

```
NOTICE: Lo storico di stato si scrive, e la tabella resta in sola lettura per i client.
applicate e registrate: 1 su 1
totale migrazioni in produzione: 124
 righe_di_storico | aperte_alla_chiave_pubblica
                0 |                          10
```

| Controllo (connettore in sola lettura, dopo) | Valore |
|---|---|
| Migrazioni in produzione | **124** |
| `log_recipe_status_change` è `security definer` | **sì** |
| …con `search_path` fissato | `search_path=public` |
| …eseguibile da `anon` / da `authenticated` | **no / no** |
| Trigger `trg_recipe_status_history` | **acceso** (`O`) |
| Funzioni raggiungibili con la sola chiave pubblica | **10** (erano 11) |
| Policy su `recipe_status_history` | **1, di sola lettura** |
| Righe di storico · residui `__VERIFICA__` | **0 · 0** |
| Policy intestate al ruolo `public` | **0**, invariato |

---

## 6. Il collaudo, fatto da una mano vera

Non «da verificare»: **fatto**, da Alessio, in tre giri successivi.

| Cosa | Dove | Esito |
|---|---|---|
| Fascia rossa sulla prova | computer + Comande + scorrimento | **passata**: si vede sempre |
| Righe `BASE-` presenti e riconoscibili | gestionale sulla prova | **passate** |
| Striscia in cima, resta ferma e non ruba spazio | telefono | **passata** |
| Le due strisce confrontabili a colpo d'occhio | computer + telefono | **passata** (terza versione) |
| Targhetta in basso a sinistra | computer | **bocciata** → rifatta |
| Striscia grigia sottile | telefono | **bocciata** → rifatta |

⚠️ **La taratura dell'intensità del grigio è una decisione presa, non un
debito.** Alessio ha fermato qui: l'app non è in uso e non ci sono ancora
dati da proteggere, quindi un altro giro non vale il costo. **Se durante il
collaudo capiterà di confondersi anche una sola volta, si alza di un tono.**
È scritto qui perché fra un mese non sembri una cosa dimenticata.

---

## 7. Prove automatiche

| | |
|---|---|
| Pure (`npm run test`) | **6 file, 33 prove** — 6 nuove su `ambienteDa` |
| Sul progetto di prova (`npm run test:app`) | **21 file, 129 prove**, tutte verdi |

⚠️ **Una prova esistente è stata corretta, non aggirata.** Con lo stato di
partenza in piedi, `in-carta-riflesso` falliva: accende un menu suo, e il
menu attivo può essere **uno solo**. Ora spegne quello che trova e **lo
rimette com'era** alla fine (lezione del 14/08: una prova si ripulisce
rimettendo, non cancellando). È il primo effetto voluto del blocco — un
progetto di prova non vuoto fa emergere le prove che davano per scontata la
sua vuotezza.

Due prove nuove in `in-carta-riflesso`: marcare «pronta per carta» riesce e
lo storico si scrive; nello storico non ci si scrive a mano.

---

## 8. Cosa NON è verificato

- **Le 16 tabelle ancora scoperte** restano scoperte, e sono elencate dal
  comando ogni volta che lo si lancia. Non sono un debito nascosto: sono il
  blocco successivo.
- **Lo stato di partenza non è mai stato guardato dentro il gestionale
  schermata per schermata**: si sa che le righe ci sono (le ha viste
  Alessio nell'elenco), non che ogni schermata le mostri bene. È
  precisamente ciò che il collaudo vero servirà a scoprire.
- **`npm run prova:ricostruisci` non è stato rieseguito da zero** dopo aver
  agganciato lo stato di partenza alla sua coda: il collegamento è scritto
  e il comando che invoca è provato da solo, la catena intera no.
- **Il difetto dello storico non è stato visto sparire con dati veri**: in
  produzione ci sono 0 ricette. La prova che ora funziona è quella sul
  progetto di prova, col token di un utente vero.

---

## 9. Stato dopo la consegna

| | |
|---|---|
| Migrazioni in produzione | **124** |
| Migrazioni nel repository / sul progetto di prova | 124 / 124 |
| Tabelle non vuote nel locale vero | 45 |
| …di queste, ancora vuote sulla prova | **16** (erano 29) |
| Funzioni eseguibili con la sola chiave pubblica | **10** (erano 11) |
| Prove automatiche | 33 pure + 129 sul progetto di prova |
| Comandi nuovi | `prova:base` · `prova:stato` · `dev:prova` |

**Prossimo passo, e divisione del lavoro concordata**: il collaudo vero.
Code prepara lo scenario e i documenti finti (fatture, DDT, contratti);
Alessio manda le mail — quelle devono arrivare **da fuori** — e prova le
schermate. Si imposta insieme.
