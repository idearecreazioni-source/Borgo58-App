# Consegna del 14/08/2026 (quindicesima) — il Contratto allineato sui tavoli uniti

**Commit della consegna: `144b484`** (questo riepilogo è il commit
immediatamente sopra, sola documentazione). Working tree pulito.

| Commit | Cosa |
|---|---|
| `4a8744b` | **Contratto §5: i tavoli uniti non sono più una decisione da prendere** |
| `144b484` | `CLAUDE.md`: l'ultimo pezzo del blocco Sala è chiuso |

**Nessuna migrazione.** Produzione invariata: **97 migrazioni**, corridoio
**v20**, elenco anonimi **12**. Nessuna riga di codice dell'app.

---

## ⚠️ 1. QUESTA CONSEGNA MODIFICA `docs/CONTRATTO.md`

**È dichiarato qui in testa perché è la condizione che Alessio ha posto
il 14/08/2026 autorizzando la prima modifica di quel documento**, ed è
scritta in `CLAUDE.md` §6 come regola permanente: *ogni modifica del
Contratto va sempre dichiarata al validatore, in un commit suo e nel
riepilogo, nominandola.*

Il motivo, che vale la pena ripetere ogni volta: **un documento che è
l'autorità sull'architettura, modificato da chi la deve rispettare, senza
che chi controlla lo sappia, smette di essere un'autorità.**

**Autorizzazione**: chiesta esplicitamente e concessa da Alessio, dopo che
gli è stato spiegato cosa comportava — e cosa **non** comportava (nessuna
migrazione, nessuna modifica al programma, niente che cambi per la sala).

---

## 2. Cosa cambia, e perché non bastava cancellare due parole

La riga di §5 elencava quattro cose «aperte, non non-conformi»:

> conto diviso, **tavoli uniti**, storni post-invio, asporto

I **tavoli uniti** sono stati decisi il 14/08 (mandato «Blocco Sala») e
sono in produzione dallo stesso giorno. Quella riga **diceva il falso su
un quarto del proprio contenuto**: descriveva come «decisione di prodotto
non ancora presa» una cosa già in funzione.

⚠️ **Non basta togliere due parole dall'elenco.** Una riga cancellata
senza spiegazione non dice niente a chi controlla — e il validatore
troverebbe un elenco più corto senza sapere se la decisione è stata presa
o dimenticata. Quindi la decisione è scritta per esteso nel Contratto:

- un conto si aggancia a un **insieme** di tavoli, con una chiave esterna,
  non a una stringa: **tre tavoli accostati sono una comanda sola**;
- `orders.table_label` resta ma **cambia significato**: è ciò che si
  stampa, fotografato all'apertura;
- ⚠️ l'invariante «un tavolo non sta su due conti aperti» è un **vincolo
  del database**, e la proiezione che lo rende esprimibile è scritta da un
  trigger e **mai dall'applicazione** — senza, sarebbe restato un `if` nel
  codice chiamante, cioè ciò che il Contratto vieta;
- apertura, spostamento e chiusura su più tavoli passano dal **corridoio**
  (B4), ognuno come **una** funzione Postgres;
- **nessuna entità «gruppo di tavoli»**.

**Il testo originale resta come citazione**, come già fatto il 14/08 per
`closeOrderAsDiscountGift`: cancellarlo renderebbe illeggibile perché la
riga esisteva.

⚠️ **Conto diviso, storni post-invio e asporto NON sono stati toccati** e
restano aperti esattamente come prima. Il Contratto lo dice a chiare
lettere, perché il rischio di una modifica come questa è di allargarsi
oltre ciò che è stato autorizzato.

---

## 3. Perché è un commit separato

Il mandato Sala lo imponeva (§9, anti-deriva): **il Contratto non si tocca
dentro il blocco che deve rispettarlo.** Si tocca dopo, con un sì
esplicito, e in un commit che non contiene nient'altro — così chi
controlla può leggerlo da solo senza doverlo estrarre da una consegna.

Questa era **l'ultima cosa aperta del blocco Sala**, dichiarata da cinque
riepiloghi di fila.

---

## 4. Verifica

| Cosa | Stato |
|---|---|
| lint, build, prove automatiche | **55 verdi**, puliti |
| modifiche al database | **nessuna** |
| modifiche al codice dell'app | **nessuna** |
| **produzione** | **97 migrazioni**, invariata |
| file toccati | `docs/CONTRATTO.md`, `CLAUDE.md`, questo riepilogo |
| autorizzazione di Alessio | **chiesta e concessa**, dopo avergli detto cosa comportava |
| dichiarazione al validatore | **questa**, in testa e nel titolo del commit |

---

## 5. Cosa resta aperto

- **Nel Contratto**: conto diviso, storni post-invio, asporto. Tre
  decisioni di prodotto che aspettano l'esperienza di Alessio in sala,
  cioè l'apertura.
- **Non provati da una mano vera**, dal blocco Sala: il trascinamento di
  una sagoma, il giro del tavolo, i due colori e la doppia prenotazione
  col pulsante contestuale. ⚠️ **Nessuna prova automatica copre la
  schermata della pianta**: le 55 verdi guardano il database.
- ⚠️ **In produzione restano due prenotazioni di prova** di Alessio
  («alessio» e «Alessio», entrambe alle 20:00): da togliere prima che
  arrivino prenotazioni vere (§5 punto 8).
- **Dal mandato cumulativo**: cantina e bevande, la resa al posto dello
  scarto, la tracciabilità a valle, Fatture in Cloud, e la voce — che
  dipende dal Ricettario Fase 1. Più la **Proiezione economico-fiscale**,
  che è il Blocco 3 del mandato del magazzino e viene prima di tutti
  quelli.
