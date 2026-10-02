# Il disegno dell'adattatore protetto del preflight

**02/10/2026** · mandato M21-H · ramo `claude/disegno-adattatore-protetto` ·
base `slave` `ec47d6c` · **solo documento**: nessun codice, nessuna
migrazione, nessuna connessione.

> 🔴 **Questo è un progetto, non un adattatore.** Niente è stato costruito,
> configurato o eseguito. Il disegno **non dimostra** che esista già un
> ambiente adatto ad ospitarlo, e **non rende la produzione pronta**: il
> rilascio resta NON PRONTO finché l'adattatore non esiste, non è stato
> provato come descritto qui sotto, e un mandato separato non autorizza il
> preflight reale.

Riferimenti già uniti in `slave`:

- il contratto delle 17 migrazioni,
  `20261001_contratto_preflight_rilascio_17_migrazioni.md`;
- il modulo che decide, `scripts/preflight-produzione-sanitizzato.mjs`, con
  i 20 campi in `CAMPI`;
- l'orchestratore, `scripts/esegui-preflight-produzione.mjs`, che chiede le
  misure all'adattatore;
- il riepilogo `20261001_preflight_produzione_sanitizzato.md`, che dichiara
  l'adattatore **fuori dal repository** e **non ancora esistente**.

---

## 1. Lo scopo

Ottenere **soltanto** le 20 misure sanitizzate già previste — i campi di
`CAMPI` — e consegnarle all'orchestratore. Niente di più: nessun altro dato,
nessuna riga, nessun valore riservato.

## 2. Il confine

Il confine è netto, e non si sposta:

| Lato | Cosa contiene | Cosa NON contiene mai |
|---|---|---|
| **Repository** (contratto, modulo che decide, orchestratore, prove) | regole, tipi ammessi, decisione PRONTO / NON PRONTO | collegamenti, file `.env`, processi esterni, rete, interrogazioni al database |
| **Adattatore protetto** (fuori dal repository) | il collegamento, la sola lettura, le interrogazioni fisse, la chiusura | parametri liberi dal chiamante, valori riservati in uscita, persistenza dei risultati |

Il repository chiama l'adattatore con **il solo nome di una misura**. Tutto
quello che riguarda il database resta dall'altra parte del confine.

## 3. L'adattatore esterno

- **Vive fuori dal repository**: il suo codice non viene mai aggiunto qui, né
  come file né come dipendenza.
- **Ha una versione**: ogni versione ha un identificativo e un'impronta del
  contenuto, registrati nell'ambiente protetto. Il resoconto di un preflight
  reale dichiara quale versione è stata usata, così si sa sempre cosa ha
  misurato cosa.
- **Ha un custode**: una persona o un ruolo responsabile di dove sta, di chi
  può modificarlo e di chi può lanciarlo. Chi sia è una **decisione aperta**
  (§ 12).
- **Espone una sola interfaccia**, quella che l'orchestratore già usa:
  `misura(nome)` e, se serve, `chiudi()`.

## 4. L'ingresso della credenziale

La credenziale per il database non deve **mai** comparire:

- negli **argomenti di un processo** (sono visibili nell'elenco dei processi
  della macchina: è il difetto che ha fatto togliere il cavo del M21-E);
- in **file del repository** o in un file `.env`;
- nell'**output**, nei **log**, nei **messaggi d'errore**;
- nei **risultati** consegnati all'orchestratore.

Deve arrivare all'adattatore da un meccanismo **dell'ambiente protetto**,
che la consegna al solo processo dell'adattatore e solo per la durata del
preflight. **Quale meccanismo** dipende dall'ambiente che verrà scelto, e oggi
nessuno è stato misurato come idoneo (inventario M21-G): resta una
**decisione aperta** (§ 12). Il disegno non ne presuppone nessuno.

## 5. Il minimo privilegio

- **Un'identità dedicata** al preflight, distinta da quelle dell'app e degli
  strumenti di migrazione.
- **Solo lettura**, su due livelli:
  1. l'identità stessa non ha permessi di scrittura;
  2. la sessione viene aperta in sola lettura **prima** di qualunque misura.
- **Conferma dal database**: prima di **ogni** misura l'adattatore chiede al
  database se la sessione è ancora in sola lettura. Se la risposta non è
  «sì», si ferma subito con un errore fisso.
- **Tempo limite** su ogni misura e sull'intera sessione: una misura che
  aspetta un blocco non deve aspettare per sempre.

⚠️ Se un'identità così si possa davvero creare con l'organizzazione attuale
del database **non è verificato**: è una decisione aperta (§ 12).

## 6. La mappa fissa delle misure

- Il chiamante può chiedere **soltanto** uno dei 20 nomi di `CAMPI`.
- A ogni nome corrisponde **una sola interrogazione fissa**, scritta dentro
  l'adattatore, rivista da una persona prima dell'uso e mai composta a tempo
  di esecuzione.
- Il chiamante **non può** passare interrogazioni, nomi di tabelle, percorsi,
  filtri, limiti o qualunque altro parametro. `misura` accetta un argomento
  solo, e solo se è uno dei 20 nomi.
- Un nome sconosciuto, un argomento in più o un tipo diverso producono un
  **errore fisso**, e nessuna interrogazione parte.
- Le misure che dal database non si possono ottenere (§ 12) restituiscono
  `null`: la mappa le dichiara, invece di inventarle.

## 7. L'uscita stretta

L'adattatore restituisce, per ogni misura, **soltanto** il tipo previsto da
`CAMPI`:

- sì / no;
- un conteggio intero, da zero in su;
- una versione di migrazione di 14 cifre;
- un elenco di versioni di 14 cifre;
- oppure `null`, che vuol dire «non ottenuta».

Il controllo si fa **due volte**: l'adattatore verifica la propria risposta
prima di consegnarla, e l'orchestratore la riverifica (lo fa già). Una
risposta che non rispetta il tipo **non viene consegnata**: diventa un errore
fisso.

## 8. Il Vault

- **Nessun valore in chiaro esce dal database.** Le due voci del Vault che
  il contratto controlla si misurano solo come **presenza, conteggio o
  corrispondenza sì/no**, con il confronto fatto **dentro** il database.
- Nessuna interrogazione della mappa restituisce il contenuto di una voce
  del Vault, nemmeno trasformato o accorciato.
- Se una condizione sul Vault non si può decidere senza far uscire un
  valore, la misura restituisce `null` (NON VERIFICATO). Non si aggira.

## 9. Gli errori

- Ogni errore dell'adattatore ha un **codice fisso**, preso da un elenco
  chiuso (per esempio: «misura sconosciuta», «sessione non in sola lettura»,
  «misura non riuscita», «risposta non ammessa», «tempo scaduto»).
- Il messaggio del database, il messaggio di una libreria, lo stato interno,
  i parametri della sessione **non vengono mai ripetuti**: né nel risultato,
  né nei log, né nell'errore.
- L'orchestratore, a sua volta, non ripete niente di ciò che riceve (lo fa
  già).

## 10. La chiusura e la non persistenza

- La sessione si chiude **sempre** — annullando ogni transazione e
  scollegandosi — anche quando una misura fallisce o scade il tempo.
- I risultati **non vengono salvati**: niente file, niente archivi, niente
  cache. Vivono in memoria il tempo di arrivare all'orchestratore.
- L'unica cosa che esce dal preflight è il risultato dell'orchestratore:
  PRONTO / NON PRONTO e i nomi dei controlli non validi.
- Se servono tracce del giro, contengono solo: versione dell'adattatore,
  ora, esito e codici d'errore fissi.

## 11. Le prove

### 11.1 Prove offline, con un database finto

Prima ancora di toccare un database vero, l'adattatore deve superare prove
che usano solo un database **finto**. Fra queste, almeno queste rotture
concettuali, che devono far **rifiutare** l'adattatore:

| Rottura | Cosa si prova | Esito atteso |
|---|---|---|
| **Interrogazione arbitraria** | il chiamante passa un testo d'interrogazione al posto del nome di una misura | errore fisso, nessuna interrogazione parte |
| **Valore del Vault in chiaro** | il database finto risponde con un testo che sembra una chiave, a una misura che deve essere sì/no | risposta non consegnata, errore fisso, il testo non compare da nessuna parte |
| **Risposta non sanitizzata** | il database finto risponde con un oggetto, una frase, un numero negativo o non intero, una versione storta | risposta non consegnata, errore fisso |
| **Tentativo di scrittura** | una voce della mappa viene alterata per contenere una scrittura | l'adattatore rifiuta la propria mappa all'avvio; e in ogni caso la sessione in sola lettura la respinge |
| **Fuga di errore** | il database finto fallisce con un messaggio che contiene un valore riservato | errore fisso, il messaggio non compare nel risultato, nei log o nell'errore |

E inoltre:

- la sessione si apre in sola lettura **prima** della prima misura, e la
  conferma viene chiesta prima di **ogni** misura;
- se la conferma è «no», nessuna misura parte;
- la chiusura avviene **sempre**, anche dopo un errore;
- nessun processo figlio riceve la credenziale come argomento;
- ogni rottura è applicata **davvero** e verificata come applicata prima di
  far girare la prova, e il file torna identico dopo — la regola che il
  progetto usa già.

### 11.2 Prove prima di qualunque esecuzione reale

Nell'ordine, ognuna condizione della successiva:

1. tutte le prove offline verdi, sulla versione esatta che si userà;
2. le interrogazioni della mappa rilette da una persona;
3. un giro sul **progetto di prova**, con un'identità dedicata **del progetto
   di prova**, mai con quella di produzione;
4. sul progetto di prova, la dimostrazione che quell'identità **non può
   scrivere**: un tentativo di scrittura deve essere respinto dal database;
5. sul progetto di prova, la dimostrazione che le uscite sono solo dei tipi
   ammessi e che i log contengono solo codici fissi;
6. solo dopo, un **mandato separato** per il preflight di produzione.

## 12. Le decisioni ancora aperte

Sono decisioni **umane o dell'ambiente**, e questo documento non le prende:

- **Dove vive e chi lancia l'adattatore.** L'inventario M21-G non ha trovato
  nessun canale già idoneo.
- **Come arriva la credenziale** all'adattatore senza passare da argomenti,
  file, `.env` o output (§ 4).
- **Se si può creare un'identità dedicata in sola lettura** sul database di
  produzione, e chi la crea e la custodisce (§ 5).
- **Chi è il custode** dell'adattatore e delle sue versioni (§ 3).
- **Da dove vengono le misure che il database non può dare.** Dal database
  di produzione si possono misurare le versioni registrate, il Vault in forma
  ridotta, le guardie controllabili prima di applicare, le transazioni e i
  blocchi. Non si possono misurare da lì: il contenuto di `master`, il
  registro della prova, la copia di sicurezza, la funzione online delle
  notifiche, i corpi vivi confrontati col repository, i dati delle ricette e
  i due giri del rilascio. Per ognuna va deciso se arriva da un'altra fonte
  sanitizzata o resta `null` — e quindi il rilascio resta NON PRONTO.

## 13. Le condizioni di stop

Ci si ferma, senza correggere e senza riprovare, se:

- una prova offline non è verde;
- l'adattatore riceve qualcosa che non è uno dei 20 nomi;
- la sessione non risulta in sola lettura, anche una volta sola;
- una risposta non è di un tipo ammesso;
- un valore riservato, un indirizzo o un messaggio del database compare in
  un risultato, in un log o in un errore;
- la credenziale compare negli argomenti di un processo, in un file o in un
  output;
- la chiusura non avviene;
- si dovrebbe leggere una configurazione privata non prevista dal mandato.

## 14. Cosa questo documento non fa

- Non costruisce, configura o esegue l'adattatore.
- Non sceglie una piattaforma, un archivio di credenziali o un'identità: non
  ne dà nessuna per esistente.
- Non contiene valori riservati, indirizzi, stringhe di collegamento,
  interrogazioni o nomi di credenziali.
- Non cambia niente nel repository oltre a sé stesso.

## Cosa non è verificato

- L'esistenza di un ambiente adatto ad ospitare l'adattatore.
- La possibilità di un'identità dedicata in sola lettura in produzione.
- Ogni proprietà descritta qui: sono requisiti, non misure.

## Cosa abbiamo rovesciato

Niente. Il disegno sviluppa quanto già deciso nel M21-F: il collegamento sta
fuori dal repository.
