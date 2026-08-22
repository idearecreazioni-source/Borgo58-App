# I 44 ritorni — tutti, non solo quelli del tablet

**Blocco 1 del mandato del 22/08.** **Nessuna migrazione.**
Corretti **44 «torna indietro»** in **44 file**, misurati a **800 × 1280**
con calibrazione **74**.

---

## 1 · Cosa è cambiato

Ogni ritorno passa da un collegamento di testo — alto quanto la sua riga,
fra i **4,00 e i 6,43 mm** — a un bersaglio da **8,50 mm**.

Una riga per file, la stessa dappertutto: `tocco-bottone inline-flex
items-center` davanti alle classi che c'erano già.

🔴 **E `text-sm` NON è stato toccato**, in nessuno dei 44. È la condizione
posta dal mandato: la taglia del testo dipende dalle crocette di Alessio, e
allargarla adesso sarebbe lavoro da disfare se dirà «questa si guarda solo
dal computer». Il bersaglio no — *un bersaglio piccolo è scomodo anche col
mouse*, e se una schermata data per da-scrivania finisce sul tablet è già a
posto.

| modulo | quanti |
|---|---|
| ricettario | 10 |
| fiscale | 7 |
| calendario | 7 |
| cassa | 5 |
| magazzino | 3 |
| documenti | 3 |
| menu editor | 2 |
| agenda | 2 |
| personale · haccp · agricolo · privacy · placeholder | 1 ciascuno |

---

## 2 · ⚠️ Il caso che non c'entrava — trovato, e dichiarato invece che corretto

Il mandato avvertiva: *«una correzione che vale per tutti è comoda finché
non incontra il caso che non c'entra»*. Ce n'era **uno**, e lo strumento si
è fermato da sé invece di scriverci sopra:

> **`src/pages/calendario/ClienteDetail.jsx:317`** — la freccia `←` che
> segna la **direzione di una comunicazione col cliente** (`r.verso ===
> "entrata"`). Non è un pulsante: è un simbolo dentro una riga di testo, in
> mezzo a `→` e `·`.

⚠️ **Ed è per questo che lo strumento è stato scritto per dichiarare i
saltati invece di ignorarli**: se avesse corretto «tutto quello che contiene
una freccia», quel carattere sarebbe diventato un riquadro da 8,5 mm dentro
una frase, e **nessun errore l'avrebbe segnalato** — sarebbe rimasto lì
finché qualcuno non apriva quella scheda.

Il conto quindi torna così: **62 frecce in tutto**, 17 avevano già la misura
(le Comande di stamattina), **44 erano ritorni veri e sono stati sistemati**,
**1 non era un ritorno**.

---

## 3 · Il campione guardato dopo, come chiesto

Aperte cinque schermate di struttura diversa, sul progetto di prova. Per
ognuna: quanto misura il ritorno, se si **sovrappone** a qualcosa, se la
pagina scorre in orizzontale.

| schermata | ritorno | sovrapposizioni | scorrimento |
|---|---|---|---|
| `/ricettario/ricette` | 8,50 mm | nessuna | no |
| `/cassa/causali` | 8,50 mm | nessuna | no |
| `/magazzino/tracciabilita` | 8,50 mm | nessuna | no |
| `/calendario-eventi/clienti` | 8,50 mm | nessuna | no |
| `/fiscale/simulatore` | 8,50 mm | nessuna | no |

⚠️ **Il caso che poteva rompersi era `/haccp/manuale`**, dove il ritorno sta
in un `flex` **accanto al pulsante di stampa**: guardato apposta, il vicino
più prossimo è a più di 8 mm. Un ritorno più alto lì avrebbe potuto spingere
la testata o accavallarsi.

---

## ⚠️ Cosa NON è verificato

1. 🔴 **Non li ha visti un occhio**: il pannello del browser di questa
   sessione non compone fotografie (`the Browser pane is not displayed`).
   Quello che c'è sono **misure geometriche prese dentro la pagina viva** —
   più precise di una fotografia per l'altezza e le sovrapposizioni,
   **cieche** su come la cosa *si legge*.
2. ⚠️ **39 dei 44 non sono stati aperti**: il campione è di cinque. Sono
   però la stessa riga applicata alla stessa forma, e il setaccio ricontato
   dopo dice **61 su 62 con la misura**.
3. ⚠️ **Il testo di quelle schermate resta sotto i 3,20 mm** (1,89 nel
   campione). È voluto e dichiarato: aspetta le crocette.
4. ⚠️ **Le schermate con le liste vuote** non mostrano tutti i loro
   ritorni: `/documenti` per esempio non ne ha nessuno di primo livello.

---

## Cosa abbiamo rovesciato

**Niente.** Un bersaglio cresce, nessuna decisione cambia.

⚠️ **E in particolare non è stato rovesciato il criterio delle crocette**:
il mandato lo ha *ristretto*, non capovolto — vale ancora intero per la
**taglia del testo**, e non vale per i **bersagli**, che sono scomodi anche
col mouse. Le due cose stavano insieme nel censimento di stamattina, e da
oggi si decidono separate.

---

## 4 · Due cose emerse per strada, fuori dal blocco

- 🔴 **Il pulsante «Apri menu»** (l'hamburger) misura **5,14 × 5,14 mm** ed
  è su **tutte** le 67 schermate: sta nel **layout**, quindi nessun
  censimento fatto schermata per schermata poteva vederlo. **Lo sta
  sistemando la sessione parallela**, insieme alle voci del menu laterale
  (5,07 mm).
- ⚠️ **Aprire un tavolo dalla pianta può fallire in silenzio.** Visto una
  volta: la schermata diceva «T3 aperto», il conto **non era nel database**,
  e al primo aggiornamento sono spariti tavolo e cinque piatti segnati.
  In console un **406**. **Non si è riprodotto** con la sala pulita (T4
  aperto e scritto regolarmente), e il corridoio `apri_conto` chiamato a
  mano risponde **200**. Quindi non è «non scrive»: è una **condizione**,
  probabilmente una lettura che si aspetta una riga sola e ne trova un
  numero diverso.
  🔴 **Ma il difetto che resta vero comunque è un altro, e non dipende dal
  406**: davanti a quella lettura fallita la schermata **ha continuato a
  disegnare un tavolo aperto che non esisteva**. È la regola del 19/08 —
  *«non vuol dire che è vuota: vuol dire che non lo so»* — dal lato della
  scrittura invece che della lettura. **Non corretto**: fuori mandato, e la
  cura giusta va decisa sapendo da dove nasce il 406.
