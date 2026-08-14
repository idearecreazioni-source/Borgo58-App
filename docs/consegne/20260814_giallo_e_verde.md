# Consegna del 14/08/2026 (dodicesima) — giallo e verde

**Commit della consegna: `6e1f5f8`** (questo riepilogo è il commit
immediatamente sopra, sola documentazione). Working tree pulito.

| Commit | Cosa |
|---|---|
| `be36e06` | giallo e verde — migrazione `20260814000011` |
| `6e1f5f8` | `CLAUDE.md`: giallo e verde, e le due prenotazioni di prova |

**Applicata in produzione**: `20260814000011`. **97 migrazioni**. Nessuna
funzione online reinstallata (i nomi delle operazioni non cambiano).

Terza e ultima coda del blocco Sala, di nuovo **dall'uso**: Alessio ha
guardato la pianta dal telefono e dal computer e ha segnalato tre cose.
Su tutte e tre aveva ragione, e **una delle tre sostituisce una cosa che
avevo costruito io**.

---

## 1. Dentro la sagoma ci sta il suo nome e basta

Sua proposta, e va accolta senza cercare alternative: **in un quadrato di
90 cm un nome e un'ora non ci stanno a una dimensione leggibile**. Le due
prove lo dicevano già:

- sul telefono, su un divano, «Divano 3» e «6 posti» si accavallavano;
- sul computer, su un tavolo prenotato, l'ora usciva tagliata — si
  leggeva `0:00 · 2` — e il nome ci stava *solo perché era corto*.

Chi c'è e a che ora si legge **nell'elenco sotto la pianta**, dove lo
spazio c'è ed esiste già. Sulla sagoma resta il colore, che si legge
senza leggere.

⚠️ Sparisce così anche il caso «alessio scritto di traverso»: quella
scritta non c'è più.

---

## 2. Le scritte sui divani si sovrapponevano — ed era un difetto mio

Non una questione di gusto. Per tenere le etichette dritte quando la sala
è in piedi, **giravo ogni scritta attorno a sé stessa**. Due righe che
stavano una **sotto** l'altra finivano così una **accanto** all'altra, e
si sovrapponevano.

La correzione è una riga di ragionamento: **la controrotazione dev'essere
una sola, sul blocco intero, attorno al centro della sagoma**. Una
rotazione e la sua inversa attorno allo stesso punto si annullano
esattamente — orientamento *e* posizione. Le scritte restano dritte **e**
impilate.

**Misurato sul disegno vero**, coi dati di produzione, a larghezza di
telefono: **zero sovrapposizioni**; «Divano 1» e «6 posti» a 22 px di
distanza, uno sopra l'altro; tutte le etichette a 0° tranne «Chef Table»,
che corre lungo il bancone perché in 70 cm di profondità non ci sta.

---

## 3. Giallo e verde: l'ora si vede, non si spunta

**Idea di Alessio, e ha sostituito la spunta che avevo messo io** —
*«sa che il tavolo potrebbe essere ancora occupato quando arriva»*.

Il suo ragionamento è migliore del mio: **quella spunta chiedeva a lui di
dichiarare a mano una cosa che il gestionale deduce dall'ora di arrivo.**

| Colore | Vuol dire |
|---|---|
| **giallo** | arriva entro l'ora di soglia → il tavolo può liberarsi per una seconda serata |
| **verde** | arriva dopo → è l'ultimo giro di quel tavolo |
| **mezzo e mezzo** | quel tavolo ha già tutt'e due |

Un tavolo mezzo giallo e mezzo verde racconta la serata a colpo d'occhio,
e chi ha prenotato per secondo **sa implicitamente** di poter aspettare —
che è esattamente ciò che la spunta diceva a parole.

### ⚠️ Il verde avvisa, non blocca

Decisione esplicita di Alessio fra tre strade (mostralo / impediscilo /
impediscilo con scappatoia). **Nessun vincolo nuovo nel database**: due
prenotazioni sullo stesso tavolo restano ammesse a qualunque ora. Se due
persone gli dicono che mangiano al volo, ce li mette.

Un gestionale che blocca una cosa che in sala si fa è un gestionale che
si impara ad aggirare.

### ⚠️ L'ora di soglia è un dato, non una riga di codice

Vive in `service_settings.ora_primo_turno` e la cambia lui da «Sala e
orari» → *Fin quando è «primo giro»*. D'estate, di sabato o fra un anno
quell'ora è diversa, e cambiarla non deve richiedere una modifica al
programma — come il prezzo del coperto e gli orari di servizio.

### ⚠️ La spunta è stata rimossa, non lasciata sempre falsa

`prenotazione_tavoli.rischio_accettato` la scriveva solo quella casella.
Lasciarla lì sarebbe **la «colonna spenta»** che questo stesso blocco ha
appena finito di togliere dalla capienza: fra tre mesi qualcuno la
ritrova e la riaccende credendo di riparare qualcosa.

Toglierla cambia la firma di **due funzioni**, quindi vanno cancellate e
rifatte (un parametro in meno fa una funzione *nuova*; due sovrapposte
renderebbero ambigua ogni chiamata per nome — `42725`, e si scopre a
runtime). E dopo un `drop` **i permessi tornano aperti al mondo**:
trappola già costata una correzione il 13/08. Richiusi, e la verifica lo
controlla — sia che `anon` non passi, sia che chi è in sala passi ancora.

---

## 4. Il form pubblico: una tendina al posto di tredici bottoni

Con l'orario ogni quarto d'ora, una cena sono **tredici pulsanti**: su un
telefono occupano mezza schermata prima ancora che l'ospite abbia scritto
il proprio nome. Stessi orari, stessa funzione del database, un menu a
tendina.

---

## 5. Verifica

| Cosa | Stato |
|---|---|
| la migrazione sul progetto di prova | **applicata due volte**: idempotente |
| l'ora di soglia esiste ed è modificabile | **provato** |
| `rischio_accettato` non esiste più | **provato** |
| **nessuna firma vecchia sopravvissuta** | **provato**: esattamente 2 funzioni con quei nomi |
| permessi dopo il `drop` | **richiusi**: `anon` no, `authenticated` sì |
| due prenotazioni sullo stesso tavolo a orari diversi | **ammesse**, senza nessuna spunta |
| i due orari cadono dalle due parti della soglia | **provato** (è ciò che decide il colore) |
| assegnare con la firma nuova | **provato** |
| prenotazione senza nome | **rifiutata** |
| **scritte sovrapposte sul disegno vero** | **zero**, misurate a larghezza di telefono |
| etichette dritte | **tutte a 0°** tranne «Chef Table», lungo il bancone |
| il mezzo-e-mezzo | **provato**: due tappe secche al 50%, non una sfumatura |
| ogni tavolo resta toccabile | **1,05 cm reali**, il minimo del progetto |
| prove automatiche | **55 verdi** |
| lint, build | puliti |
| **produzione** | **97 migrazioni**, soglia **20:00** |
| elenco anonimi | **12**, invariato |
| dati di prova lasciati **da me** | **zero** |

---

## 6. Cosa NON è verificato, e lo dico chiaro

- **I due colori non li ha ancora visti nessuno.** Sono provati sul
  disegno renderizzato coi dati veri, non nella schermata vera con una
  prenotazione vera. La prova che serve è una sola: **due prenotazioni
  sullo stesso tavolo, una alle 19:30 e una alle 21:30, e guardare se
  diventa mezzo giallo e mezzo verde.**
- **La tendina del form pubblico non è stata provata da un ospite**, né
  su un telefono vero.
- **Il trascinamento, il giro del tavolo e la prenotazione presa dalla
  pianta** restano non provati da una mano vera, come nei due riepiloghi
  precedenti.
- ⚠️ **In produzione ci sono due prenotazioni di prova** («alessio» e
  «Alessio», entrambe alle 20:00, una sola con un tavolo assegnato): sono
  le sue prove dal vivo. **Non le ho cancellate io** — sono righe che ha
  creato lui e non so se gli servono ancora. Vanno tolte prima che
  arrivino prenotazioni vere (§5 punto 8), e nel frattempo **si vedranno
  gialle**, perché le 20:00 cadono dentro la soglia.
- ⚠️ **Il colore guarda solo l'ora, non quanto si fermano.** Un tavolo da
  due che arriva alle 19:00 e uno da dieci che arriva alle 19:00 sono
  tutti e due gialli, ma non si liberano nello stesso momento. Il
  gestionale non lo sa e non deve indovinarlo — è la stessa ragione per
  cui la durata del tavolo è stata rimossa. Decide lui.
- **La riga del Contratto §5 sui tavoli uniti è ancora quella vecchia**:
  resta il commit separato da autorizzare, dichiarato ormai da tre
  riepiloghi.
