# C5 — La chiusura dell'anno fiscale

**23/09/2026** · ramo `claude/c5-chiusura-anno` · proposta verso `slave`, **non unita**
· migrazioni `20260923000003` e `20260923000004` **applicate al solo progetto di prova**

---

## Il contratto tecnico

**Cosa fotografa.** Per un soggetto e un anno: coperti, ricavi incassati, food
cost, costi fissi, costo e numero degli omaggi, conti chiusi — gli stessi numeri
del consuntivo mensile, accumulati sui dodici mesi. Più due che il mese non ha:
**quanti conti sono rimasti senza documento fiscale e quanto valgono**.

**Da dove prende quei numeri.** Mese per mese: la fotografia in
`consuntivi_mensili` se esiste, altrimenti la misura dal vivo con
`misure_del_mese`. ⚠️ È esattamente la scelta che `confronto_a_oggi` fa dal
15/08 — *la fotografia del mese vince sulla misura di oggi* — e serve a non
creare una terza verità accanto alle due che esistono già. E ogni voce si
accumula **solo nei mesi in cui è misurata**: ciò che non si è potuto misurare
resta **vuoto, mai zero**.

**Cosa NON modifica.**

- **`orders` non viene scritta.** Nessun conto viene riclassificato,
  fiscalizzato, spostato di anno o «appianato».
- **I consuntivi mensili non vengono toccati**: non ne pretende nessuno e non ne
  scrive nessuno. Un anno si chiude anche con zero mesi fotografati.
- **Non emette documenti** e non parla col registratore telematico.

**Chi può farla.** Il titolare. Il controllo è nella funzione (`is_titolare()`,
che **rifiuta** invece di filtrare) e nella RLS della tabella: lo staff non vede
nemmeno lo storico.

**Cosa resta volutamente fuori.** Il pacchetto per la commercialista (C6), il
caricamento della chiusura ufficiale (C7), ratei e risconti, il registratore
telematico e ogni logica di fatturazione.

---

## 🔴 Il fermo su L21 — e perché il confine è realizzabile

**L21 è aperto**: *un conto dell'anno scorso regolarizzato dopo la chiusura,
dove finisce — nell'anno in cui il cliente ha mangiato o in quello in cui esce
il documento?*

Qui **non si risponde**, e il modo di non rispondere è non fare niente a quei
conti. La chiusura:

1. li **conta** e li **mostra prima**, con l'elenco vero e non solo un numero;
2. si **rifiuta** di avvenire finché il titolare non conferma di averli visti —
   e a pretenderlo è il **database**, non la schermata;
3. li lascia **esattamente dov'erano**;
4. lo **dichiara nello storico**, con le due strade possibili nominate entrambe
   e nessuna scelta.

⚠️ **E lo scarto si dichiara invece di appianarlo.** I ricavi dell'anno
comprendono quei conti — perché i ricavi sono l'incassato dai conti chiusi, e lo
sono dal 14/08 in tutto il gestionale, mese compreso — e **accanto** c'è il
numero di quelli senza documento. Sono due assi diversi, ed è
`quadratura_fiscale` a tenerli distinti da sempre. *Toglierli dai ricavi sarebbe
già una risposta a L21; lasciarli senza dirlo sarebbe appianare.*

⚠️ **Quindi il confine regge**: quello che la chiusura fa è **contare e
dichiarare**, e contare non è classificare.

**L22 resta aperto e non è stato toccato**: C6 e C7 non sono in questo lavoro, e
la loro forma la deve dire la commercialista. *Costruirli prima vorrebbe dire
indovinare un formato, e un lettore che si aspetta un formato sbagliato non dà
errore — legge un numero plausibile nella riga sbagliata.*

---

## Le decisioni già presenti, riusate senza rifarle

| decisione | da dove viene | come si riusa |
|---|---|---|
| la serata di servizio, non il calendario | 18-19/08 | il perimetro dell'anno passa da `conti_senza_documento`, che filtra su `serata_di_servizio(closed_at)`; «l'anno è finito?» si chiede a `serata_di_servizio(now())`. **Nessuna definizione nuova di giorno fiscale** |
| una sola tabella → niente corridoio | `chiudi_mese`, 14/08 | `chiudi_anno` scrive un `insert` solo, dentro una funzione: una chiamata, una transazione. Nessuna scrittura in sequenza dal browser |
| una fotografia non si ricalcola | 14/08 | trigger `before update` che rifiuta, come per i mesi |
| una rifotografia si dichiara | 16/08 | `chiusure_precedenti` e `prima_chiusura_il` si **leggono dal registro delle cancellazioni**, non da un contatore da tenere allineato |
| vuoto non è zero | 15/08, 19/08 | ogni numero porta `origine_*`, e ciò che non si è misurato resta `null` |
| la tasca fuori da tutto ciò che è fiscale | 30/08 | si riusa il trigger `vieta_fiscale_sulla_tasca()` — quella funzione **è** la definizione di quella regola, e scriverne una seconda vorrebbe dire tenerle allineate per sempre |
| un importo si scrive in un modo solo | 17/08 | il rifiuto formatta con `euro()`, non con una maschera a mano |
| il perimetro del registro si dichiara | 26/08 | `chiusure_annuali` entra in `perimetro_registro` come `dentro`, col trigger — *una tabella «da decidere» col trigger addosso è il caso in cui il guardiano tace* |

⚠️ **E una colonna che NON è stata scritta**: non esiste `chiusa_con_avviso`. La
chiusura pulita e quella con avviso si distinguono dal **conteggio**
(`conti_senza_documento > 0`), perché *quando due colonne direbbero la stessa
cosa la seconda è un riflesso* — e un riflesso che si può ricavare non si scrive
affatto.

---

## File e migrazioni

**Migrazione `20260923000003_la_chiusura_dell_anno_fiscale.sql`** — tabella
`chiusure_annuali` (RLS titolare, tre trigger: non si riscrive · lascia la
copia · la tasca no), `misure_dell_anno()`, `chiudi_anno()`, classificazione nel
perimetro del registro, e una verifica in dieci gruppi dentro una
sotto-transazione annullata con `foto_righe()` / `pretendi_nessun_residuo()`.

⚠️ **Il vincolo sull'anno è `1900..2200` e non `2020..2200`**, ed è una
correzione fatta prima di consegnare: le verifiche e le prove automatiche si
scelgono anni lontani e vuoti per non toccare i dati veri (17/08), e un limite
stretto le avrebbe **respinte** — cioè avrebbe impedito di provare la regola
invece di proteggerla. La verifica della migrazione chiude il **1996**.

**Migrazione `20260923000004_i_due_vincoli_della_chiusura_parlano_italiano.sql`**
— la coda, e nasce da un buco mio trovato applicando. Nella `…003` avevo scritto
la frase italiana per i quattro vincoli sui **valori** e non per le altre due
forme: l'unicità su società + anno e il legame col soggetto. La regola del 25/08
riguardava i `check`, ed è stata **allargata il 28/08** a unicità e chiavi
esterne — *correggere un esemplare non chiude la famiglia*.

⚠️ **Non è teorico**: sulla strada normale il messaggio buono lo dà
`chiudi_anno`, ma la RLS permette al titolare di scrivere **dritto in tabella**,
e da lì il rifiuto uscirebbe come «duplicate key value violates unique
constraint» — che in sala non è un rifiuto, è un guasto.

⚠️ **I due nomi se li fa dire dal catalogo**, non li indovina: li cerca per
**struttura** (l'unicità dev'essere esattamente su `(entity_id, anno)`, il legame
dev'essere `entity_id → entities(id)` e restare `restrict`) e **si ferma
rumorosamente** se non coincidono, invece di commentare la cosa sbagliata.

⚠️ **E un commento non cambia da sé la lingua dell'errore di Postgres**: la
traduzione la fa il punto unico da cui passano le richieste dell'app, che legge
proprio quel commento. Questa migrazione riempie il posto da cui la traduzione
pesca, e **non introduce nessun trigger e nessuna logica nuova**.

**Codice**

- `src/lib/calcoli/chiusuraAnno.js` — le regole, separate dal disegno.
- `src/pages/fiscale/ChiusuraAnnuale.jsx` — la schermata, `/fiscale/chiusura-anno`.
- `src/lib/api/proiezione.js` — quattro funzioni nuove.
- `src/pages/fiscale/ProiezioneFiscaleHome.jsx`, `src/App.jsx` — la voce e la rotta.

**Prove**

- `tests/unita/chiusura-anno.test.js` — 30 prove pure.
- `tests/schermate/chiusura-anno.test.jsx` — 21 prove di schermata.
- `tests/app/chiusura-annuale.test.js` — 13 prove sui dati veri, **condizionate**.
- `tests/unita/vincoli-chiusura-anno.test.js` — 19 prove pure sulla `…004`.
- `tests/app/vincoli-chiusura-anno.test.js` — 5 prove sui dati veri, **condizionate**.

---

## Cosa dimostrano le prove

| il mandato chiede | dove |
|---|---|
| chiusura annuale pulita | app 1 · migrazione (1) · schermata |
| avviso con conti senza documento | app 6 · migrazione (6) · schermata |
| annullamento dopo l'avviso senza scritture | app 7 · migrazione (7) · schermata |
| conferma esplicita del titolare | app 8 · migrazione (8) · schermata |
| rifiuto per staff e anonimo | app 11-13 (**solo dal client**: dentro una migrazione `is_titolare()` è falso) |
| duplicato impedito | app 3 · migrazione (2) |
| separazione fra entità | app 5 · migrazione (4) |
| storico invariato se dopo cambiano i dati | app 10 · migrazione (9) |
| nessuna riclassificazione automatica | app 9 · migrazione (8) · prova pura sul testo della migrazione |
| L21 dichiarata e non nascosta | prove pure (5) · schermata (2) |

**Provato per rottura, non per rilettura.** Undici rotture sulle regole e sulla
migrazione, sette sulla schermata: **tutte e diciotto fanno diventare rossa la
prova giusta**, una alla volta.

🔴 **E una rottura ha trovato un buco in una prova mia.** Il controllo «il
portiere rifiuta invece di filtrare» cercava *almeno un* portiere: togliendolo
da `misure_dell_anno` restava **verde**, perché quello di `chiudi_anno` bastava a
farla passare. Ora si contano, e devono essere due.

🔴 **E la prima tornata di rotture non aveva provato niente.** I file erano
ancora non tracciati da git, quindi il ripristino fra una rottura e l'altra non
avveniva e le rotture si **sommavano**: i conteggi crescenti sembravano un
risultato e non lo erano. Rifatta con copie pulite, una rottura alla volta.

---

## Cosa abbiamo rovesciato

**Niente.** Nessuna decisione presa prima viene rovesciata da questo lavoro: la
chiusura annuale riusa la macchina dei mesi senza cambiarne una regola, e
`chiudi_mese`, `consuntivi_mensili`, `conti_senza_documento`,
`conti_da_fiscalizzare` e `quadratura_fiscale` **non sono state toccate**.

---

## Cosa NON è verificato

- 🔴 **Il gestionale vero non ha niente di tutto questo.** Le due migrazioni
  sono applicate **al solo progetto di prova**, e la proposta non è unita: in
  produzione la tabella non esiste.
  ⚠️ *Questa riga diceva «non applicata da nessuna parte», ed era vera quando
  è stata scritta. È diventata falsa quando la migrazione è stata applicata al
  progetto di prova, e si corregge dove vive.*
- ⚠️ **Nessuna mano ha aperto la schermata.** In questo ambiente le prove non
  guardano un'immagine: che l'avviso si distingua con le luci del ristorante, e
  che la conferma sia comoda col dito, restano giudizi di Alessio.
- ⚠️ **Nessun anno vero è stato chiuso**, e non potrebbe esserlo: il locale apre
  nel 2027.
- ⚠️ **La misura dell'anno costa dodici giri di `misure_del_mese`** quando i
  mesi non sono fotografati. Su un database vuoto è immediata; **quanto costi su
  un anno pieno non è stato misurato**, perché un anno pieno non esiste ancora.

---

## Cosa serve da Alessio o dalla commercialista

1. **L21 resta aperto**, e finché lo è la schermata lo dichiara invece di
   decidere. Quando ci sarà la risposta, cambia **cosa fare dei conti
   regolarizzati dopo** — non questa chiusura, che continuerà a contarli.
2. **L22 resta aperto** e blocca C6 e C7, che non sono in questo lavoro.
3. La migrazione va applicata prima sul progetto di prova, come sempre.
