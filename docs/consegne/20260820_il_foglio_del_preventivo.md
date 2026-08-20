# Il foglio del preventivo — blocco 3 dei preventivi

**Migrazione**: `20260820000007_il_foglio_del_preventivo.sql`
— applicata sul progetto di prova, **NON ancora in produzione**.
**Funzione online**: `email-cliente` estesa (un tipo nuovo, `preventivo`) —
**v1 sulla prova**, in produzione ancora quella di prima.
**Mandato**: [`20260820_i_preventivi_per_gli_eventi.md`](../mandati/20260820_i_preventivi_per_gli_eventi.md).

---

## ⚠️ Cosa NON è verificato

1. 🔴 **Nessuna mail è mai partita davvero**: la funzione online è installata
   solo sul progetto di prova, dove il servizio di invio non è configurato.
   Il giro completo — Alessio preme, il cliente riceve — **non l'ha fatto
   nessuno**.
2. 🔴 **Nessuna mano ha premuto niente**, e nessuna prova di questo progetto
   guarda una schermata: che i tre pulsanti si vedano e che la stampa produca
   il foglio giusto **non è verificato**.
3. 🔴 **SERVE UNA DECISIONE DI ALESSIO**: per quanti giorni vale un
   preventivo. Finché non lo dice, **il foglio si rifiuta di essere prodotto**
   a meno che non scriva una data a mano su ogni preventivo. Vedi sotto.
4. ⚠️ **In produzione non ci sono preventivi né ricette**: niente di tutto
   questo ha incontrato dati veri.

---

## Cosa abbiamo rovesciato

**Nessun rovesciamento.**

---

## 🔴 Una misura che cambia due promesse del mandato

Il mandato diceva *«PDF, mail e messaggio WhatsApp col PDF allegato»*.
Misurato prima di costruire: **in questo progetto non esiste nessuna libreria
per produrre un file PDF** — il PDF si fa con la **stampa del browser**, ed è
così per tutti i documenti del gestionale (manuale HACCP, deduzioni,
tracciabilità).

**Conseguenza, dichiarata invece che aggirata**: il gestionale **non ha mai un
file PDF fra le mani**, quindi

- **la mail non può allegarlo**: manda il preventivo **scritto nel messaggio**;
- **WhatsApp non può allegarlo**: apre il messaggio col testo pronto, e se
  Alessio vuole allegare il foglio lo allega **lui**, dopo averlo salvato.

⚠️ *Prometterlo e costruire qualcosa che allega un file inesistente sarebbe
stato il difetto peggiore di tutti: un allegato che non arriva non produce
nessun errore.*

---

## 🔴 Il foglio dice fino a quando vale, o non si produce

Un preventivo è una promessa di prezzo fatta su un costo di oggi, per una cena
fra due mesi. **Senza una scadenza scritta sopra, quel foglio resta valido per
sempre** in mano a chi l'ha ricevuto.

⚠️ **Quanti giorni vale non l'ha ancora detto nessuno**, quindi:

- la colonna delle impostazioni (`giorni_validita_preventivo`) **nasce vuota**
  — una durata inventata da me deciderebbe **per quanto tempo Alessio resta
  legato a un prezzo**, che è una cosa con conseguenze legali;
- e **il foglio si rifiuta** se sul preventivo non c'è una data, con un
  messaggio che dice cosa fare.

✅ È la stessa forma dell'esportazione della prima nota che si rifiuta quando
la lettura è tagliata: *su un foglio che si consegna a qualcuno non esiste una
terza strada fra completo e dichiarato incompleto.*

---

## 🔴 Nel foglio non c'è nessun costo, e lo garantisce il database

Il contenuto lo compone `foglio_preventivo()`, **in un posto solo**. Tre
schermate che se lo costruiscono per conto proprio sono **tre occasioni** di
lasciarci dentro un numero di troppo — e qui pesa più che sulla schermata,
perché **il foglio viaggia**: finisce nella posta del cliente, e magari lo gira
a qualcun altro.

⚠️ **Il controllo è esplicito**, nella migrazione e nelle prove: nessuna delle
cinque chiavi di costo, e la parola «food cost» **non compare nel testo**.

⚠️ **E c'è il controllo al contrario**: il prezzo dev'esserci. Senza, il
controllo di sopra passerebbe anche su **un foglio vuoto**.

⚠️ **In più la vista dei costi è `print:hidden`**: una stampa fatta per sbaglio
da lì non può finire nella posta del cliente.

---

## I tre gesti sono tre cose diverse

| gesto | cosa fa | reversibile? |
|---|---|---|
| **Prepara il foglio** | fotografa il contenuto e apre la stampa | sì — non esce di qui |
| **Apri su WhatsApp** | copia il testo e apre il messaggio | sì — lo manda lui |
| **Manda la mail** | 🔴 **parte davvero** | **no** |

⚠️ **Mai un tocco che manda tutto**, e la ragione tecnica è la sua: il giorno
che di un cliente si ha solo il telefono, un invio unico spedirebbe una mail
a un indirizzo inventato pur di partire.

⚠️ **Solo la mail chiede conferma**, e non è prudenza generica: è l'unico dei
tre da cui non si torna indietro. ⚠️ **E il pulsante è spento se manca
l'indirizzo**, con la ragione nel titolo — *un pulsante che esiste per essere
rifiutato è un inganno*.

⚠️ **WhatsApp copia sempre prima** (lezione del 14/08): la copia riesce
sempre, l'apertura è un di più — e se WhatsApp non è installato **non succede
niente, senza nessun errore**. E **lo zero del prefisso non si toglie**: in
Italia resta anche nell'internazionale.

---

## 🔴 Il foglio si fotografa

Ogni volta che si produce o si manda, il contenuto finisce in
`preventivo_fogli`. ⚠️ Serve per quando si farà una **versione nuova**: sapere
**cosa diceva il foglio che il cliente ha in mano** è impossibile
ricostruendolo dai dati di oggi, che nel frattempo sono cambiati.

⚠️ **E un invio rifiutato non lascia la fotografia di un foglio mai mandato**:
il controllo sull'indirizzo viene **prima** di tutto il resto. C'è una prova.

---

## Le prove, e le due rotture

**Sei controlli dentro la migrazione** e **12 prove col token di un utente
vero** sul file dei preventivi — 152 pure + **257** sull'app in tutto.

| rottura | cosa è diventato rosso |
|---|---|
| **un costo entra nel foglio** | *«Il foglio contiene un costo: {…, "costo_cibo": 20.00, …}»* |
| la scadenza non è più pretesa | *«Il foglio è stato prodotto senza scadenza»* |

---

## Per Alessio, in una riga

Dal preventivo puoi fare tre cose separate — preparare il foglio da salvare in
PDF, aprirlo su WhatsApp, o mandarlo per mail — e sul foglio non c'è niente
dei tuoi costi; ma prima devi scrivere fino a quando vale, altrimenti il
gestionale si rifiuta di prepararlo.

---

## 🔴 La domanda

**Per quanti giorni vale un preventivo?**

Serve come valore proposto: lo scrivi una volta e poi ogni preventivo nuovo
nasce con la sua scadenza già calcolata. Finché non lo dici, la data va scritta
a mano su ognuno — e senza quella, il foglio non si produce.

---

**Migrazione**: `20260820000007` — sul progetto di prova sì, in produzione
**no**, in attesa del `git push`.
**Funzione online**: `email-cliente` da reinstallare in produzione dopo il
push, altrimenti «Manda la mail» non manda niente.
