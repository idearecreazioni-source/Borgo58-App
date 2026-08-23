# La temperatura attesa non è quella misurata

**Blocco 3 del mandato del 23/08** — quello marcato *«ha peso legale»*.
Migrazione **`20260823000006`**, applicata **solo sul progetto di prova**.

---

## 1 · Il reperto di Alessio

> *«Come fa a sapere a che temperatura sono gli ingredienti che arrivano?
> Dovrebbe sapere a che temperatura DOVREBBERO essere, non quella effettiva
> che può solo essere misurata a mano.»*

Ha ragione, e sotto lo stesso nome c'erano due dati di natura diversa:

| | cos'è | chi lo scrive |
|---|---|---|
| **temperatura attesa** | una **norma** (0-4 °C per il pesce fresco) | l'assistente la propone, Alessio la corregge |
| **temperatura misurata** | un **fatto**, letto con la sonda a ogni consegna | una persona, ogni volta |

🔴 **E il registro HACCP attesta misurazioni.** Se lì dentro finisse un
numero indovinato da una macchina, quel registro direbbe il falso — e a
un'ispezione risponde chi l'ha firmato, cioè Alessio.

---

## 2 · ✅ La misura prima della cura: il rischio non si era realizzato

Il mandato chiedeva: *«verifica dove finisce oggi quel campo: se già
alimenta il registro, è da scollegare prima di tutto il resto»*.

**Chiesto al codice vivo, non dedotto.** Le funzioni che nominano
`haccp_receiving_temp` sono **quattro** — `create_ingredient`,
`prodotti_da_compilare`, `applica_scheda_prodotto`, `tocca_campo_confermato`
— e **nessuna scrive in `haccp_goods_receiving`**.

Il registro prende la temperatura da un parametro che compila una
**persona**: il campo «Temp. °C» della conferma del carico, e quello del
registro a mano. **Nessuno dei due è precompilato.**

⚠️ **Quindi non c'era niente da scollegare.** Il difetto era **nel nome e
nel posto**: un campo intitolato «Temperatura ricevimento (HACCP)»,
compilato dall'assistente, che *sembra* un dato del registro. E la distanza
fra «sembra» e «è» la copre chiunque legga in fretta — o chiunque, fra sei
mesi, decida di «riempire quel campo automaticamente, tanto c'è già».

⚠️ **E si è misurato quanto costa cambiarlo adesso**: **0 prodotti su 127**
hanno quel campo compilato. Oggi è un rinomino e basta; fra sei mesi sarebbe
lo stesso rinomino **più un dubbio su ogni riga già scritta**.

---

## 3 · Cosa è stato fatto

### Il nome è spaccato

`ingredients.haccp_receiving_temp` → **`ingredients.temperatura_attesa`**, con
il commento sulla colonna che dice cosa non deve diventare. A schermo:

> **Temperatura attesa alla consegna**
> *A che temperatura dovrebbe arrivare. Quella vera si misura col termometro
> alla consegna e si scrive nel registro HACCP: questa non ci finisce mai.*

⚠️ **Il parametro delle funzioni resta col nome vecchio**
(`p_haccp_receiving_temp`): rinominarlo romperebbe le chiamate per nome che
il corridoio fa dal client. Cambia la **colonna**, non il patto.

### Le quattro funzioni riscritte dal corpo VIVO

`alter table … rename column` non tocca il corpo delle funzioni. Sono state
riscritte leggendo `pg_get_functiondef` e sostituendo **solo** il nome della
colonna — ⚠️ *mai a memoria*: è la trappola in cui questo progetto è cascato
il 18/08, e di nuovo stamattina nel blocco 2, perdendo un portiere.

### E la temperatura attesa serve a qualcosa

Compare **dove sta il dubbio**: sotto il campo «Temp. °C» della conferma del
carico, come riga piccola — *«dovrebbe essere 0-4 °C»* — per i prodotti di
quella consegna.

⚠️ **Non precompila il campo, e non è una svista**: quello che si scrive
sopra è ciò che il registro attesta. Precompilarlo sarebbe far firmare ad
Alessio una misurazione che non ha fatto.

---

## 4 · Come è provato

**Dentro la migrazione**, e il controllo che vale più degli altri è una
domanda al catalogo invece di un sospetto da rileggere:

> *nessuna funzione che scrive in `haccp_goods_receiving` nomina
> `temperatura_attesa`* — se un giorno qualcuno collegasse i due campi, la
> migrazione si rifiuterebbe di riapplicarsi.

Più: la colonna vecchia non esiste, **zero** funzioni la nominano ancora
(altrimenti si romperebbero alla prima chiamata), e il giro dell'assistente
funziona col nome nuovo.

**Dal client** (`tests/app/temperatura-attesa.test.js`), perché è il tratto
che nessuna verifica dentro una migrazione può provare: il valore parte
dalla **schermata**, passa dal corridoio col nome del parametro vecchio, e
deve arrivare nella colonna nuova. ⚠️ **Provata rompendola**: staccato quel
filo, diventa rossa con *«expected null to be '0-4 °C'»* — se si fosse
staccato davvero, il campo si sarebbe visto a schermo, salvato senza errore,
e sarebbe rimasto vuoto.

**Guardato con gli occhi**: aperta la scheda di «Alici fresche» sul progetto
di prova, si legge l'etichetta nuova e la frase sotto.

---

## 5 · Cosa abbiamo rovesciato

Niente. Il campo non ha cambiato natura né valore: aveva un nome che ne
descriveva uno diverso, e ora ha il suo. Nessuna decisione precedente viene
capovolta — la scelta del 13/08 di far compilare quel campo all'assistente
resta intera, ed è **proprio perché è una norma** che ha senso farla
proporre a una macchina.

---

## ⚠️ Cosa NON è verificato

1. 🔴 **Niente in produzione**: la migrazione è solo sul progetto di prova.
2. ⚠️ **La riga «dovrebbe essere…» nel carico da fattura non è stata vista
   da un occhio**: non c'è una fattura in lavorazione con prodotti che
   abbiano la temperatura attesa compilata (sono zero su 127). È stata
   provata leggendo il codice, non aprendola.
3. 🔵 **L'avviso automatico non c'è, ed è una decisione da prendere.** La
   temperatura attesa è **testo libero** («≤ 4 °C»), quindi il gestionale
   non può confrontarla con quella misurata: mostra, non giudica. Per
   avvisare che una consegna è arrivata fuori norma servirebbe un
   **intervallo numerico** (minimo e massimo) al posto del testo — e
   cambierebbe anche cosa l'assistente deve produrre.
   **Domanda per Alessio**: vuoi che il gestionale ti avvisi da solo quando
   la temperatura che hai appena scritto è fuori norma? Se sì, la
   temperatura attesa diventa due numeri invece di una frase; se no, resta
   un promemoria e il giudizio è tuo.
4. ⚠️ **Il registro a mano (HACCP → Ricevimento merci) non mostra
   l'attesa**, e non per dimenticanza: lì il prodotto è **testo libero**, non
   un ingrediente scelto da un elenco, quindi non c'è niente da cui leggerla.
   Collegare quel campo all'anagrafica è un lavoro a sé.
