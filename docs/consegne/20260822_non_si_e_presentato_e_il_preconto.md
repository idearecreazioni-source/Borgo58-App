# «Non si è presentato», e il preconto alla via di mezzo

**Blocchi 2 e 3 del mandato delle tre cose decise.**
**Migrazione `20260822000004`** — ⚠️ **solo sul progetto di prova**.

---

## 1 · Lo stato che mancava

Il difetto era emerso costruendo i due mesi finti: il database **rifiuta**
`no_show`. Chi si presenta diventa **servita** da sé quando il conto si
chiude; **chi non si presenta resta «confermata» per sempre**, e non si
distingue da un conto che qualcuno si è dimenticato di chiudere.

⚠️ **Sono due fatti che portano a gesti opposti** — uno è un cliente che non
è venuto, l'altro è un conto da sistemare in Cassa. Confonderli non è
impreciso: è **non poter più separare due fatti**.

**Adesso** `non_presentata` è uno stato, e si sceglie a mano.

⚠️ **A mano, ed è l'unico modo**: nessun gesto del gestionale può dire «non è
venuto», perché **non è successo niente**. È il contrario di «servita», che
la scrive il database quando il conto si chiude.

### E in schermata sono due esiti diversi, non uno

Su una prenotazione confermata ci sono ora **due** vie:

- **«Annulla»** — il cliente ha avvisato prima: il tavolo torna libero in
  tempo per darlo a qualcun altro;
- **«Non si è presentato»** — la sedia è rimasta vuota tutta la sera: il
  posto non è tornato utile a nessuno, ed è la cosa che domani vale la pena
  ricordarsi di quel cliente.

E si disfa: *«In realtà è arrivato»* — capita di segnarlo e poi vederlo
entrare in ritardo.

---

## 2 · La misura: metà del lavoro non andava fatto

Il mandato chiedeva di misurare **chi conta le prenotazioni per stato**.

| | esito |
|---|---|
| `capienza_della_sala` conta gli attesi con `status = 'confermata'` | ✅ una non presentata **esce dal conteggio da sé** — niente da toccare |
| la spunta «sala piena» | ✅ **si spegne da sola**: `trg_cena_cambiata` scatta anche sul cambio di stato e richiama `sincronizza_spunta_sala`, che è l'unico posto dove quella spunta si accende e si spegne |
| il trigger che marca «servita» a conto chiuso | ✅ guarda solo le confermate: una non presentata **non può** tornare servita, e va bene — chi non è venuto non ha mangiato |

⚠️ **Per le prenotazioni normali** (non da preventivo) quella sincronizzazione
non c'è mai stata: è una scelta del 21/08 che questo blocco **non tocca**.

**L'unica cosa da cambiare** era la funzione che alimenta la sala.

---

## 3 · La serata si vede per intero, ma nessuno la aspetta più

Due righe sole in `turni_del_giorno`:

- la non presentata **resta nell'elenco** della sua serata, come una servita:
  sparire vorrebbe dire che a fine servizio non si capisce più cosa è
  successo a quel tavolo — ed è proprio l'informazione da conservare;
- ma il campo `servita`, che governa **colore del tavolo, persone attese e
  ritardo**, la comprende. ⚠️ Quel campo ha sempre voluto dire «non
  l'aspettiamo più»: per il **cliente** servita e non presentata sono fatti
  opposti, per la **sala** sono la stessa cosa — ed è la sala che governa.

🔴 **Senza questo, una non presentata risulterebbe in ritardo per sempre**:
è il modo in cui si comportava restando «confermata».

### ⚠️ E la funzione è stata presa dal DATABASE, non dal file

Il primo tentativo si è fermato con *«cannot change return type of existing
function»*: avevo ricopiato il corpo dalla migrazione del 21/08, e nel
frattempo un'altra migrazione le aveva aggiunto le colonne `servizio` e
`turno_dopo_di`. Riscrivendola da lì **le avrei annullate in silenzio**.

Ripreso con `npm run funzione:viva` e modificato in **due righe**. È la
regola del 18/08 — *una funzione si riscrive dal database, mai dal file che
l'ha creata* — e stavolta se n'è accorto Postgres al posto mio.

---

## 4 · Il preconto: 3,44 mm invece di 3,70

🔴 **E qui la misura ha corretto la mia previsione.** Avevo promesso «due
righe a capo invece di quattro, e 15 mm in meno». Rimisurando sul progetto di
prova: **cinque righe su sei** a capo, e appena 4,6 mm di differenza.

**Perché**: sul progetto di prova i piatti si chiamano
`BASE-Tonno in crosta di pistacchio` — **cinque caratteri di prefisso che
nella realtà non esistono**. La misura di ieri era su nomi senza prefisso.

⚠️ **Quindi ho cercato il numero che non dipende dai dati**, che è quello che
serviva dall'inizio: **quanti caratteri stanno su una riga**. Sui 57,1 mm che
restano al nome dopo il prezzo:

| taglia | caratteri sul nome |
|---|---|
| 3,17 mm | 29 |
| **3,44 mm** ← scelta | **27** |
| 3,70 mm | 25 |

Sui nomi della carta vera, che arrivano a 29 caratteri («Tonno in crosta di
pistacchio»), i 27 lasciano intera la gran parte delle righe; i 25 ne
spezzano il doppio.

⚠️ *Un conto di collaudo può essere più severo del vero, e la misura giusta è
quella che non dipende dai dati.*

Il minimo del foglio resta **3,44 mm** contro i 2,65 di partenza: la ragione
per cui Alessio aveva chiesto di ingrandire — *è il foglio che legge chi sta
pagando* — è soddisfatta lo stesso.

---

## ⚠️ Cosa NON è verificato

1. 🔴 **Nessuna mano ha segnato «non si è presentato»** da schermo: lo stato
   è provato dentro la migrazione (con la controprova che una confermata
   resta attesa), e il pulsante è letto nel codice.
2. ⚠️ **Il colore del tavolo con una non presentata** non l'ha visto
   nessuno: so che il campo la comprende, non come si vede la sagoma.
3. ⚠️ **Il preconto non è uscito da una stampante**: i caratteri per riga
   sono misurati nella pagina viva con le regole di stampa applicate.
4. 🔴 **In produzione non è entrato niente.**
5. ⚠️ **Le note sui clienti non sono state costruite**, per mandato: sono il
   posto dove chi non si presenta finirà, e senza questo stato non si sapeva
   nemmeno chi metterci.

---

## Cosa abbiamo rovesciato

**Niente.** Uno stato nuovo si aggiunge, il campo `servita` chiarisce cosa ha
sempre voluto dire, e una taglia scende di un punto.

⚠️ **E in particolare non è stato rovesciato «servita non la scrive
nessuno»**: quella continua a scriverla il database. La non presentata è
l'opposto — **si sceglie a mano perché non c'è nessun gesto da cui dedurla**,
e le due cose convivono senza contraddirsi.
