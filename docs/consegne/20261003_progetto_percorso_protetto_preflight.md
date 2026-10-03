# Il percorso protetto del preflight — progetto

**03/10/2026** · richiesta di Alessio · ramo
`claude/progetto-percorso-protetto-preflight` · base `slave` `b97b649` ·
**solo documento**.

> 🔴 **È UN PROGETTO, NON UN'ESECUZIONE.** Niente è stato applicato, creato o
> collegato: la proposta n. 153 resta non applicata, nessuna password o
> credenziale esiste, nessun database è stato raggiunto. **Ogni passo
> operativo descritto qui richiede un nuovo consenso esplicito di Alessio.**
> Il preflight resta NON PRONTO, e il connettore Supabase «lettura» della
> sessione **non** è considerato accesso protetto (decisione del 03/10/2026).

Riferimenti già uniti in `slave`:
`docs/consegne/20261002_disegno_adattatore_protetto_preflight.md` (il
disegno dell'adattatore), `docs/consegne/20261003_identita_sola_lettura_preflight.md`
(l'identità), `scripts/contratto-preflight-rilascio.mjs` (i sei controlli
obbligatori), `docs/consegne/20261003_piano_rilascio_a_gruppi_controllato.md`.
Fuori dal repository: il nucleo offline del ponte, in
`…\ponte-preflight-protetto`, provato solo con dati finti.

---

## 1. Il punto di partenza, e il fatto che cambia il disegno

Il percorso deve servire a **due insiemi** di misure:

- le **tre** misure del catalogo sulle versioni registrate
  (`applied_migrations.version`);
- i **sei** controlli obbligatori del contratto (M24-B e M24-D).

La proposta n. 153 copre **solo le prime tre**: dà al ruolo la lettura di una
colonna e una regola di riga. Per i sei controlli non basta, e allargarla nel
modo diretto non è ammesso:

| Controllo | Cosa deve leggere | Perché la lettura diretta non va |
|---|---|---|
| `funzioni_che_nominano_la_produzione` | il testo delle funzioni vive | catalogo: forse leggibile, **non verificato** su Supabase |
| `vincoli_senza_frase` | vincoli, commenti, `vincoli_muti_noti` | la funzione esistente risponde **solo al titolare** (`vincoli_senza_frase`, 20260828000001) |
| `soggetti_e_utenti_presenti` | `user_roles`, `entities` | dati dell'applicazione, con la loro RLS |
| `modulo_di_rete_con_tempo_massimo` | la firma della funzione di invio di rete | catalogo |
| `causali_di_uscita_presenti` | `cash_causali` | dati dell'applicazione |
| `conti_del_1996_senza_documento` | conti, sconti, totale del conto | la regola chiama `totale_conto`, che **rifiuta chi non è un utente dell'app** (`auth.uid()` vuoto, 20260824000035) |

Quindi: o il ruolo legge **tabelle dell'applicazione** — vietato dal principio
del mandato M23-A — oppure le misure si fanno **dentro il database** e al ruolo
arriva solo il risultato.

---

## 2. La scelta proposta: misure dentro il database, al ruolo solo l'esito

**Strada consigliata (A).** Uno **schema dedicato** (nome di lavoro:
`preflight`) contiene **una funzione per misura**, senza parametri, che
restituisce **soltanto** il tipo previsto dal contratto (sì/no, un conteggio,
una versione, un elenco di versioni). Le funzioni girano coi permessi del
proprietario, quindi leggono ciò che serve; il ruolo dedicato riceve
**esclusivamente** il diritto di chiamarle.

| Al ruolo `borgo58_preflight_reader` | Concesso? |
|---|---|
| `NOLOGIN` finché un mandato non decide altrimenti; poi `LOGIN` solo su Prova, prima | — |
| `SUPERUSER`, `CREATEDB`, `CREATEROLE`, `REPLICATION`, `BYPASSRLS` | **mai** |
| `USAGE` sullo schema `preflight` | sì |
| `EXECUTE` sulle sole funzioni di misura | sì |
| qualunque privilegio su `public`, tabelle, viste, sequenze, colonne | **no** |
| regole di riga | **nessuna** |

**Cosa cambia rispetto alla n. 153**: il ruolo **non** legge più
`applied_migrations` direttamente; anche le tre misure delle versioni diventano
funzioni dello schema `preflight`. Spariscono il privilegio di colonna e la
regola di riga. È un **rovesciamento** della forma decisa in M23-C, da
registrare se Alessio lo approva: la ragione di allora (privilegio minimo)
resta, e la forma nuova la rispetta meglio, perché il ruolo non vede nemmeno
una colonna.

**Strada scartata (B)**: concedere al ruolo la lettura di `user_roles`,
`entities`, `cash_causali`, `orders` e affini. Viola il principio «nessun
accesso ai dati applicativi», e la regola del 1996 non funzionerebbe comunque
perché `totale_conto` rifiuta il ruolo.

### 2.1 Le regole di ogni funzione di misura

- **Nessun parametro**: il chiamante sceglie solo *quale* misura, mai *come*.
- **Uscita stretta**: solo il tipo del contratto. Per esempio
  `funzioni_che_nominano_la_produzione` restituisce **sì/no** (nessuna funzione
  fuori dalle sei ammesse), non l'elenco dei nomi né i loro corpi.
- **Nessun valore riservato**: nessuna funzione legge o restituisce voci del
  Vault. L'identificativo del progetto di produzione, che il controllo 1
  cerca, è un dato che il database ricava da sé (vedi §2.3), non un parametro.
- **Sola lettura**: dichiarate `stable`, e chiamate solo dentro una sessione in
  sola lettura (§3). ⚠️ Che una sessione in sola lettura respinga anche le
  scritture tentate dentro una funzione col permesso del proprietario va
  **dimostrato su Prova** con una rottura apposta, non dato per noto.
- **Una sola definizione per regola**: dove una regola esiste già (i vincoli
  senza frase, i conti senza documento) la si estrae in un nucleo senza
  controllo del ruolo, chiamato **sia** dalla funzione esistente **sia** dalla
  misura — mai una seconda copia. È lo schema già usato per `totale_conto`.
  ⚠️ Per i conti del 1996 il nucleo da estrarre è il **totale del conto**
  senza il controllo `auth.uid()`: tocca una funzione dei soldi, ed è il
  pezzo più delicato del progetto.

### 2.2 Le reti esistenti non guardano il nuovo schema

`funzioni_senza_portiere()` (20260905000001) e `funzioni_aperte_ad_anon()`
guardano **solo lo schema `public`**. Le funzioni di `preflight` scavalcano le
regole di accesso per costruzione, e nessuna rete se ne accorgerebbe. Serve
**una rete propria**, nella stessa migrazione: le funzioni di `preflight` sono
eseguibili **soltanto** dal ruolo dedicato (non da `public`, `anon`,
`authenticated`), sono esattamente quelle previste, e non hanno parametri.

### 2.3 Il controllo 1 senza scrivere l'identificativo da nessuna parte

La verifica della `20260920000001` cerca l'identificativo scritto nel suo
testo. Una funzione di misura che lo scrivesse nel proprio corpo
comparirebbe essa stessa fra «le funzioni che lo nominano». La misura va
quindi costruita in modo da **escludere sé stessa** e da non contenere il
valore in chiaro. Come farlo senza leggere il Vault è un **punto aperto** di
questo progetto (§7).

---

## 3. L'adattatore

Si riparte dal nucleo offline già provato (`ponte-preflight-protetto`:
contratto del custode, trasporto in busta, esecutore con solo tre letture),
estendendolo:

- **mappa fissa**: ognuno dei nomi del contratto corrisponde a **una**
  chiamata fissa a una funzione di `preflight`; il chiamante passa solo il
  nome. Le misure senza funzione restano `null` (NON VERIFICATO);
- **due livelli di sola lettura**: il ruolo nasce con la sola lettura come
  impostazione predefinita, e l'adattatore apre ogni sessione in sola lettura
  e **chiede al database** se lo è, prima di ogni misura;
- **tempo limite** su ogni misura e sull'intera sessione;
- **uscita stretta** controllata due volte (adattatore e orchestratore), errori
  a codice fisso, nessun valore ripetuto, nessun risultato salvato.

### 3.1 Il client verso il database — punto aperto

Tre strade, nessuna oggi percorribile senza una decisione:

| Strada | Stato |
|---|---|
| client C# con la libreria PostgreSQL locale (`libpq` 17.10, impronta già calcolata) | la scrittura del client è **bloccata dai controlli di sicurezza di Claude Code** (M23-L) |
| libreria PostgreSQL per Node | sarebbe una **dipendenza nuova**, da scaricare: vietato finora |
| `psql` | non legge la password dall'ingresso standard; l'unico modo senza argomenti né ambiente sarebbe un file, **vietato** |

La strada coerente col lavoro fatto è la prima. Per sbloccarla serve che
Alessio scelga **come** autorizzare quei passi (permesso per la modifica dei
file in quella cartella, oppure la modalità che chiede conferma a ogni
azione, oppure scrivere lui il file) — vedi M23-L.

### 3.2 La credenziale

- **Gestione credenziali di Windows**, una voce **per ambiente** (Prova e
  produzione mai la stessa), **creata da Alessio**.
- L'adattatore la legge **solo in memoria** e la consegna al client senza
  argomenti, ambiente, file o output. ⚠️ Leggere quella voce da un programma è
  esattamente il tipo di azione che i controlli di sicurezza di Claude Code
  hanno già bloccato: è probabile che **solo Alessio** possa lanciare quel
  passo.
- **Come nasce la password** non ha un percorso conforme alle regole del
  progetto (documento dell'identità, §5.2): resta una **decisione di Alessio**.

### 3.3 Il collegamento — non verificato

Se un ruolo creato da noi possa collegarsi attraverso l'infrastruttura di
Supabase, e con quale forma del nome utente, **non è verificato**. Si scopre
solo su Prova.

---

## 4. La migrazione che servirà (non scritta qui)

Quando Alessio lo decide, una migrazione nuova — che **sostituisce** la n. 153
invece di affiancarla — dovrà:

1. creare lo schema `preflight` e il ruolo `NOLOGIN`, con la regola della
   «scatola vuota» già decisa (M23-C-1) se il ruolo esiste;
2. estrarre i due nuclei (vincoli senza frase; totale del conto senza
   controllo del ruolo), lasciando invariato il comportamento delle funzioni
   esistenti;
3. creare le funzioni di misura, senza parametri, eseguibili solo dal ruolo;
4. aggiungere la rete propria dello schema;
5. verificare tutto in un blocco di verifica, **con le rotture apposta**
   (una funzione con un parametro, una eseguibile da `authenticated`, un
   privilegio su una tabella, un ruolo con login già attivo).

⚠️ Tocca una funzione dei soldi (`totale_conto`), quindi passa dalle prove
sul progetto di prova e dalla rete delle regole uniche prima di qualunque
altra cosa.

---

## 5. Il collaudo su Prova, in ordine

Ogni passo è condizione del successivo, e **ognuno richiede il consenso di
Alessio**:

1. migrazione del §4 applicata **solo** su Prova, verifica verde;
2. misura in Prova di **cosa eredita il ruolo** dai permessi comuni: atteso
   nessun accesso a tabelle e nessuna funzione oltre a quelle di `preflight`
   (letto dal catalogo con l'accesso del proprietario, già usato per Prova);
3. decisione e creazione della password **di Prova**, da Alessio, con la prova
   che non finisce in log, argomenti o cronologia;
4. sblocco del client (§3.1) e collaudo della sola libreria;
5. primo collegamento con l'identità di Prova: la sessione risulta in sola
   lettura senza chiederlo;
6. le misure su Prova: tipi giusti, e confronto con ciò che il proprietario
   legge dagli stessi dati;
7. **rotture apposta**, tutte respinte dal database: scrittura su una
   tabella, lettura diretta di `user_roles`, chiamata di una funzione
   dell'applicazione, lettura del Vault, chiamata di una misura inesistente;
8. revoca di prova e controllo che il collegamento successivo venga rifiutato.

Solo dopo: un **mandato separato** per misurare i sei controlli in produzione.

---

## 6. Condizioni di stop

Ci si ferma, senza correggere e senza riprovare, se:

- il ruolo riceve un privilegio diverso da quelli del §2;
- una funzione di `preflight` è eseguibile da qualcun altro, ha un parametro,
  o restituisce più del tipo previsto;
- il ruolo eredita accesso a una tabella o a una funzione dell'applicazione;
- la sessione non risulta in sola lettura;
- una rottura del §5.7 non viene respinta;
- la credenziale compare in un argomento, un file, un output, un log;
- serve un accesso alla produzione prima del mandato separato.

---

## 7. Decisioni aperte per Alessio

1. **Strada A** (misure dentro il database, il ruolo chiama solo funzioni) al
   posto della forma della n. 153 — e quindi chiudere la n. 153 senza unirla.
2. **Il nucleo del totale del conto**: estrarlo senza il controllo del ruolo
   tocca una funzione dei soldi.
3. **Il controllo 1** (funzioni che nominano la produzione): come misurarlo
   senza che la misura contenga il valore e senza leggere il Vault.
4. **Come nasce la password** di Prova (e poi di produzione).
5. **Come sbloccare il client** C# (§3.1).
6. **Chi lancia l'adattatore** e da quale computer.

## Cosa non è verificato

- che il catalogo delle funzioni sia leggibile e che un ruolo personalizzato
  possa collegarsi, su Supabase;
- che una sessione in sola lettura respinga le scritture dentro le funzioni
  di misura;
- cosa erediti un ruolo nuovo dai permessi comuni;
- che il client C# possa caricare la libreria e leggere una credenziale.

Sono tutti passi del collaudo su Prova (§5), non affermazioni di questo
documento.

## Cosa abbiamo rovesciato

Niente, finché Alessio non sceglie. **Se** approva la strada A, si rovescia la
forma della n. 153 (lettura diretta di una colonna con una regola di riga):
la ragione di allora — privilegio minimo — vale ancora, e la strada A la
rispetta di più.
