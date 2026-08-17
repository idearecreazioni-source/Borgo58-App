# Consegna del 17/08/2026 (quarta) — i quattro difetti del secondo giro

**Commit della consegna: `1573eeb`** (`I quattro difetti del secondo giro, e
la prima meta' delle piccolezze`). Working tree pulito prima di questo
riepilogo. Questa consegna **non modifica** `docs/CONTRATTO.md`.

Chiude i quattro difetti che Alessio ha trovato **usando** il n. 8 dal vivo,
più cinque delle dieci piccolezze. Le altre cinque sono il giro successivo.

⚠️ **Il giro delle sette prove è passato da una mano vera**: cinque cose
funzionano (i tre numeri della nota di credito, il credito proposto,
il DDT collegato, il «togli» con la sua conferma, l'assegno nei due versi),
quattro no. È la prima volta che il lavoro del n. 8 viene esercitato da
qualcuno che non l'ha scritto.

---

## 1. Il n. 1 — misurato prima di correggere

🔴 **Il sintomo**: in Cassa il messaggio dice «un'uscita già registrata per
33,60 € non è ancora nel saldo… **la trovi in "Ce la faccio?"**». In «Ce la
faccio?» non c'era.

⚠️ **Le due ipotesi erano molto diverse**, e Alessio ha chiesto di misurare
prima di scegliere:

- **(a)** le uscite future non vengono lette affatto — cioè la condizione che
  lui aveva posto il 17/08 non è rispettata;
- **(b)** è l'orizzonte: la previsione guarda 30 giorni per impostazione
  predefinita, e l'assegno cade il 31°.

**Misurato** sul progetto di prova, impersonando il titolare, con la funzione
vera e i due orizzonti:

```
OGGI: 2026-08-17
MOVIMENTO FUTURO: 33.60 del 2026-09-17
ATTESO 30gg: fattura … 74.90 · fattura … 195.69          ← l'assegno NON c'è
ATTESO 60gg: fattura … 74.90 · fattura … 195.69
             uscita_futura | 2026-09-17 | 33.60          ← c'è, con la sua data
```

**È la (b).** Il meccanismo funziona; il difetto è che un messaggio prometteva
una schermata dove, con l'orizzonte di partenza, quella riga non si vede.

### La cura, e perché non è allungare l'orizzonte

Delle due strade indicate da Alessio si prende la seconda, e la ragione è che
la prima cambia il significato di un numero che sceglie lui: **se «fra 30
giorni» comprendesse anche il 31° quando lì c'è qualcosa, «30» non vorrebbe
più dire 30.**

Quindi **il taglio si dichiara** — la stessa regola di «3 di 12 da pagare» e
dell'elenco delle fatture pagate: *un elenco tagliato in silenzio sembra
completo*. In «Ce la faccio?» compare una riga che dice quante uscite già
registrate cadono oltre, per quanto, e la prima quando. E in Cassa il
messaggio smette di promettere: «in "Ce la faccio?" compare **se l'orizzonte
arriva fin lì**».

⚠️ **Il conto di cosa cade oltre lo fa il database** (`uscite_future` con
orizzonte): sottrarre in JavaScript «tutte le future meno quelle in elenco»
sarebbe stato più corto, ed è esattamente il genere di somma che il 17/08 ha
prodotto un numero sbagliato nell'anteprima dei crediti.

---

## 2. Gli altri tre

**n. 2 — il rifiuto accanto al gesto.** Il messaggio compariva in cima alla
pagina. Il testo era ottimo — «resterebbero note che dichiarano di correggere
un documento che non esiste più» — e non l'ha visto nessuno: Alessio stava
premendo a metà schermata, non ha capito se la fattura fosse stata cancellata,
e *l'istinto è premere di nuovo*. Ora il rifiuto compare **sotto la riga su
cui si è premuto**, e vale per tutti e quattro i gesti della riga
(cancellare, pagare, correggere l'importo, togliere una nota).

**n. 3 — spento con la ragione, non premibile per essere rifiutato.**
«Rimuovi» su una fattura con una nota di credito addosso: la schermata sa già
che il gesto verrà respinto — la nota è lì, in quella riga — e chiedere
«elimino la fattura?» sapendolo è una domanda finta.
⚠️ **La stessa cura è stata applicata al «Pronta per carta» del Ricettario**,
che aveva identicamente lo stesso difetto (premibile su una ricetta in carta,
si spegneva a schermo e veniva respinto dal database). Era in elenco fra le
piccolezze del primo blocco; è lo stesso difetto, quindi si chiude insieme.

**n. 4 — il pannello che non si aggiornava.** Dopo aver tolto una nota, il
modulo di pagamento continuava a dire «usciranno 170,00 € · nota già scalata
25,69 €» quando la nota non c'era più: *un pezzo di schermata che promette un
importo che un altro pezzo ha appena cambiato.*
⚠️ **Si ricarica quello che è cambiato sul server** — l'anteprima e i crediti
proponibili — **e non quello che l'utente stava scegliendo**: le note spuntate
restano, meno quella che non esiste più. È la trappola del 12/08 (una
schermata che ricarica butta via ciò che si sta scrivendo), applicata al
verso giusto.

---

## 3. Le piccolezze fatte (cinque su dieci)

| | dove |
|---|---|
| La concordanza: «1 **nota** di credito», col verbo che concorda | `delete_supplier_invoice` |
| «non esiste **più**» invece di «non esiste piu'» | idem |
| «74,90 €» invece di «74.9€» nel promemoria in Agenda | `create_supplier_invoice` |
| Le tre frasi con l'accento reso come apostrofo che Alessio ha letto | `saldo_tesoreria`, `riflette_in_carta_sulla_ricetta` |
| Le quantità a quattro decimali: «5.8785 kg» → «5,88 kg» | nuovo `formatQta`, 5 schermate del Magazzino |

⚠️ **Gli accenti si correggono sul corpo esistente, non ricopiando le
funzioni.** Sono funzioni lunghe che non hanno niente di sbagliato tranne
quattro parole: ricopiarle in migrazione vorrebbe dire trascrivere novanta
righe per cambiarne una, e **una trascrizione a mano è il posto dove nasce una
differenza che nessuno vede**. Si legge la definizione, si sostituisce la
frase, si riesegue — e la verifica pretende che la parola nuova ci sia e la
vecchia no.

**Restano cinque**, ed è il giro successivo: il gergo in interfaccia
(`fisco_scadenze`, «Omaggi (base TD27)», il codice nella striscia rossa) ·
«Questo mese» coi due numeri nudi · il riepilogo in cima al Magazzino ·
«Nuova fattura» che occupa il posto più visibile pur essendo il caso più raro
· **le spunte dell'Editor Menu Cartaceo**, che non è una ritoccatura: la cura
non è ingrandire la nota, è che la spunta somigli a ciò che fa.

---

## 4. Due difetti miei, trovati applicando

🔴 **La sostituzione degli accenti non trovava niente, e lo diceva.**
Cercava la frase con **un** apostrofo, ma `pg_get_functiondef` restituisce il
corpo come è scritto *dentro* la funzione, dove quella frase vive in una
stringa e l'apostrofo è raddoppiato. Risultato: zero sostituzioni, e la
migrazione sarebbe passata verde con gli accenti intatti.

⚠️ **È emersa solo perché ogni sanatoria dichiara quante righe ha toccato** —
regola scritta il 16/08 dopo i due fallimenti del Blocco 9. Il blocco ha
stampato *«Frasi con l'accento reso come apostrofo, corrette: 0»*, e quello
zero era la spia. Senza quella regola sarebbe passata in silenzio: *è il
silenzio ad aver ingannato quattro volte, non la mancanza del dato.*

🔴 **Una mia asserzione dava per scontato di essere sola al mondo.**
Pretendeva che «la prima uscita oltre l'orizzonte» fosse quella creata dalla
verifica: sul progetto di prova ce n'era già un'altra prima (l'assegno dello
scenario di collaudo), e la verifica si è fermata su un dato legittimo. È la
lezione del 14/08 — *una verifica non deve fallire per come qualcuno ha
apparecchiato* — e vale anche quando chi apparecchia sono i dati di collaudo.
Riscritta per misurare la **differenza che fa un giorno di orizzonte sulla
stessa fotografia**: al giorno prima quell'uscita è «oltre», al giorno stesso
non lo è più, e fra le due misure deve ballare esattamente lei.

## 5. E un falso allarme, corretto — agli atti

Misurando il n. 1 ho visto la fattura con la nota comparire a **195,69** fra
le uscite attese invece che a 170,00, e l'ho annunciato come un secondo
difetto. **Non lo era**: quella nota Alessio l'aveva tolta durante la prova
(il «togli» che ha collaudato), e la sua lapide è nel registro delle
cancellazioni. Il numero era giusto.

⚠️ Vale la pena scriverlo perché la diagnosi sbagliata aveva la stessa forma
di quella giusta: *un numero che non torna*. A distinguerli è stato guardare
**chi aveva toccato i dati**, non il codice. Le prove che dipendevano da
quello stato sono tornate verdi rifacendo lo scenario, che è il gesto
previsto.

---

## 6. Numeri veri dell'applicazione in produzione

```
psql:…20260817000004_l_orizzonte_e_le_parole.sql:275: NOTICE:
  Frasi con l'accento reso come apostrofo, corrette: 4.
psql:…20260817000004_l_orizzonte_e_le_parole.sql:471: NOTICE:
  L'orizzonte dichiara cosa cade oltre, e i messaggi sono scritti in italiano.

 uscite_future_esistenti | promemoria_fatture
                       0 |                  0

  applicate e registrate: 1 su 1
  totale migrazioni in produzione: 128
```

Applicata il **17/08/2026 alle 16:46:43 UTC**.

**La sanatoria ha toccato 4 frasi** — dichiarato, non sottinteso: in
produzione quelle due funzioni avevano davvero l'accento reso come apostrofo,
e ora non ce l'hanno più.

### Controlli dal connettore in sola lettura

| Controllo | Valore |
|---|---|
| Migrazioni in produzione | **128** |
| `uscite_future` — quante versioni, e la firma | **1**, `p_entity_id uuid, p_fino_al date` |
| `saldo_tesoreria` dice «non è mai stato contato» | **sì** |
| `riflette_in_carta_sulla_ricetta` dice «è in carta nel menu» | **sì** |
| Frasi con l'apostrofo rimaste in quelle due funzioni | **0** |
| Trigger `trg_recipes_in_carta` acceso | **sì** |
| Funzioni raggiungibili con la sola chiave pubblica | **10, invariato** |
| Lapidi in `deleted_records` | **25, invariate** |
| Fornitori `__VERIFICA__` rimasti | **0** |
| Fatture · movimenti · promemoria da fattura | 0 · 0 · 0 |

⚠️ **Il trigger acceso è un controllo che vale la pena spiegare**: riscrivere
il corpo di una funzione trigger non stacca il trigger, ma darlo per scontato
su una funzione che protegge la carta dei piatti sarebbe una fiducia mal
messa. La verifica lo controlla.

---

## 7. Cosa NON è verificato

- **Le quattro correzioni non sono ancora state usate da Alessio**: è
  esattamente ciò che farà adesso, mentre finisco le piccolezze. La scelta di
  farlo in due giri invece che in uno è del validatore, con la sua ragione:
  *queste quattro non sono cosmesi — cambiano come l'app risponde, e si
  giudicano solo usandole.*
- **La riga «oltre l'orizzonte» non è mai comparsa a schermo**: in produzione
  non c'è nessuna uscita futura (zero movimenti). Si vede sul progetto di
  prova, dove lo scenario ha l'assegno a 30 giorni.
- **Il rifiuto accanto alla riga non è stato letto da nessuno** nella sua
  nuova posizione.
- **Le due funzioni riscritte dal blocco degli accenti non sono state
  esercitate dal client**: la verifica controlla il testo del loro corpo, non
  che il messaggio arrivi a schermo. `saldo_tesoreria` lo mostra in Cassa
  quando il cassetto non è mai stato contato — che in produzione è il caso
  vero, quindi lo vedrà.
- **`formatQta` non ha una prova automatica**: è una funzione di sola
  presentazione e nessun numero dipende da lei. Si vede in Magazzino.

---

## 8. Stato finale

| | |
|---|---|
| Migrazioni in produzione | **128** |
| Migrazioni nel repository / sul progetto di prova | 128 / 128 |
| Corridoio `operazioni-atomiche` | produzione **v29**, prova **v12** |
| Prove automatiche | 49 pure + 144 sul progetto di prova |
| Collaudo — primo e secondo giro | chiusi |
| I quattro difetti trovati usando il n. 8 | **chiusi** |
| Piccolezze | **5 su 10** |
