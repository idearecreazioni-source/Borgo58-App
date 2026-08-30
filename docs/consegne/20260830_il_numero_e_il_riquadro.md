# Le Comande: il numero sul tavolo, e il riquadro che si legge — 30/08/2026

> **Blocco 4** del mandato del 30/08. Chiude **S1** e **S3** di
> [`docs/RICHIESTE.md`](../RICHIESTE.md).
>
> **Il commit che sta sotto questo riepilogo: `55b1bd6`.**
>
> **Nessuna migrazione.** Il database sapeva già tutto: mancava la domanda.

---

## 1. Il doppio colore a parità di orario (S1)

Alessio: *«ho preso tre prenotazioni sullo stesso tavolo alla stessa ora e
non è successo niente. E servono più di due tinte per dire che sono tre: due
tinte dicono "due".»*

### 🔴 Dove si perde: non si perde. La domanda non era mai stata fatta.

**RIFATTA LA SCENA sul progetto di prova**, come chiedeva il mandato: tre
prenotazioni su T3 alle 20:30. Risultato misurato leggendo il disegno:
**una tinta sola**, `--color-b58-turno`.

E la funzione che decide il colore **si comporta come deve**:

```
fasce = ["tardi", "tardi", "tardi"]  →  distinte = ["tardi"]  →  un colore
```

⚠️ **Il colore risponde a «in che fascia arrivano», non a «quante sono».**
Tre prenotazioni alla stessa ora sono nella stessa fascia per costruzione:
deduplicare è giusto, e «misto» vuol dire *fasce diverse*, che lì è falso.

🔴 **E la misura ha detto una seconda cosa che non cercavo.** Su T3 oggi ci
sono **sei** prenotazioni — 20:00, 20:30 ×3, 21:24, 22:00 — a **quattro ore
diverse**, e il tavolo è **lo stesso identico rosso**. Il motivo:
`turni_del_giorno` per il 30/08 (una **domenica**, che in questo locale è
solo pranzo) classifica tutte le sere come servizio `pranzo`, fascia
`tardi` — «dopo l'ora degli ultimi arrivi», che è letteralmente vero.
**Quindi il colore non può dire «quante» nemmeno a ore diverse.**

### La cura: un numero, non una terza tinta

⚠️ Alessio ha ragione che due tinte dicono «due». Ma **tre tinte direbbero
«tre» e quattro no**, e a quel punto servirebbe una legenda per leggere un
numero. **Un numero si scrive.**

Sul bordo in alto a destra della sagoma compare una **pastiglia scura con la
cifra**, quando le prenotazioni sono più di una. Il colore continua a dire
la fascia: **due canali per due domande**, come la sbarratura del ritardo e
il pallino della comanda.

⚠️ **Fuori dalla sagoma, non dentro**: dentro ci stanno il nome e la cifra
dei coperti, e la decisione del 18/08 dice che non ci entra altro.

⚠️ **Il numero non si perde selezionando il tavolo**, come la sbarratura e
il pallino: quante persone aspettano quel tavolo resta vero anche mentre lo
si tocca.

⚠️ **E le fasce si deduplicano, le prenotazioni no** — è la stessa riga
letta con due domande diverse, e una prova la tiene ferma.

### 🔴 Due difetti trovati mentre lo costruivo

1. **La cifra usciva coricata.** Sul telefono la pianta si mette in piedi
   (`rotate(-90)` su tutto il disegno) e il «3» era sdraiato. Le scritte
   della sagoma hanno la loro controrotazione dal 14/08; le pastiglie che
   c'erano prima sono **cerchi**, e su un cerchio girare non si vede — così
   nessuno se n'era mai accorto. **L'ha trovato l'occhio, non il codice.**
2. **`segnoDelTavolo` contava i doppioni.** La riga diceva `fasce.length > 1`
   → «più di una fascia», e su tre prenotazioni della stessa fascia
   rispondeva **«misto»**, che vuol dire «fasce diverse» ed era falso.
   ⚠️ **Oggi non mordeva**, perché l'unico chiamante deduplica prima. Ma la
   funzione è pubblica e il nome del parametro non dice «già deduplicate»:
   il difetto era armato per il prossimo che la chiama. **L'ha trovato una
   prova nuova, non una rilettura**, e si è tolto il caso invece di scriverlo
   in un commento.

⚠️ **La legenda ha la sua riga, FUORI dall'elenco della precedenza**:
quell'elenco risponde a *«quando su un tavolo c'è più di una cosa, quale
vince»*, e il numero non gareggia con nessuno — si somma. Metterlo in fila
con le tinte direbbe che a volte le sostituisce.

---

## 2. Il riquadro delle informazioni (S3)

Le sue due frasi — *«troppo grande da cellulare e troppo piccolo da pc»* —
**sembrano contraddirsi e non lo sono**, ed è la diagnosi che la sessione
precedente aveva già misurato senza curarla:

> **il riquadro si adatta alla pianta, il testo dentro no.**

Il riquadro è posizionato in **percentuale del disegno** — si rimpicciolisce
col telefono, cresce col monitor — mentre il testo è in **centimetri veri**,
cioè uguale dappertutto. Da vicino il testo è troppo grande per il riquadro,
da lontano troppo piccolo per lui.

### La cura è l'unità di misura

Dentro quel riquadro il testo si misura **sul riquadro** (`cqw` = un
centesimo della sua larghezza), non sullo schermo. Il riquadro diventa il
metro (`container-type: inline-size`).

⚠️ **Con un pavimento e un tetto in centimetri veri**: su un riquadro molto
stretto una proporzione pura scenderebbe sotto i **3,20 mm**, la soglia
sotto cui in questo progetto un testo non si legge; su un monitor grande
diventerebbe un cartellone.

🔴 **E il pavimento è 3,20 mm, non 4** — misurato: con 4 mm il nome chiedeva
**246 punti** dentro un riquadro che ne ha **168**. *Un pavimento più alto
della soglia era proprio ciò che rendeva il testo «troppo grande da
cellulare»: su uno schermo denso vinceva sempre lui, e la proporzione non
serviva a niente.*

### Il nome va a capo, non si tronca

Sulla sua schermata si leggeva **«BASE-Tavolo …»**. Anche alla soglia minima
«BASE-Tavolo Amato» non ci sta su una riga di 168 punti.

⚠️ **E questo è il nome PER CUI si guarda il riquadro.** La nota del 24/08
diceva già la regola — *si tronca un nome secondario, non quello per cui si
guarda* — e qui era applicata al contrario.

### Le misure, prima e dopo

Sul riquadro di T3 in Comande, con «BASE-Tavolo Amato»:

| | 37,8 (monitor) | 59,5 | 64 (mini tablet) | computer (1280) |
|---|---|---|---|---|
| **prima** — corpo del nome | 6,00 mm | 6,00 | 6,00 | 6,00 |
| **prima** — troncato? | **sì** | **sì** | **sì** | — |
| **dopo** — corpo del nome | 4,99 mm | 3,20 | 3,20 | **7,50 mm** |
| **dopo** — troncato? | **no** | **no** | **no** | **no** |
| **dopo** — scorre dentro? | no | no | no | no |

✅ **Guardato con gli occhi** a 375 punti e a 1280.

---

## Cosa abbiamo rovesciato

**Niente, e una precisazione.** La decisione del 18/08 — *dentro la sagoma
ci stanno il nome e la cifra dei coperti, nient'altro* — non viene toccata:
il numero delle prenotazioni sta **sul bordo, fuori dalla sagoma**, come i
pallini della comanda che ci stanno dal 21/08. La regola del 21/08 sul
riquadro (*3,20 mm è il minimo accettabile, non l'obiettivo*) resta: il
tetto del testo è salito da 6,00 a 7,50 mm, il pavimento è sceso a 3,20
**solo dove la larghezza non permette di più** — e la scelta che ne esce è
fra un nome leggibile a 3,20 e un nome tagliato a 6,00.

---

## Rilettura obbligatoria

### Cosa NON ho verificato con gli occhi

- **Il badge in Comande.** L'ho visto nel Calendario. In Comande **non
  compare** su T3, ed è coerente: lì `fasce` esclude chi si è già seduto o è
  già stato servito, quindi «quante devono ancora arrivare» è zero. **Non
  l'ho visto comparire in Comande su un caso in cui dovrebbe.**
- **Due prenotazioni su un tavolone.** La somma sul gruppo è provata da una
  prova pura, non da una schermata.
- **Il riquadro con «prenotato da …»**: la riga secondaria (che resta
  troncata apposta) non è mai comparsa, perché nessuna delle prenotazioni di
  prova ha un pagante diverso dal prenotante.
- **La legenda nuova**: la riga è scritta, **non l'ho aperta a schermo**.

### Cosa ho contato senza leggerlo

- «Sei prenotazioni su T3, quattro ore diverse, stesso colore»: le sei sono
  una query, il colore è letto dal disegno. **Che siano tutte `tardi` viene
  da `turni_del_giorno`**, e l'ho letto dalla funzione, non dedotto.

### Quali mie affermazioni sono diventate false mentre lavoravo

- Ho scritto il badge dandolo per **corretto quando diceva «6»**, e mi ero
  sbagliato in due modi: pensavo fossero le mie tre e invece erano sei
  (tre mie più tre già lì), e **la cifra era coricata**. Il numero era
  giusto; la mia lettura di quello che stavo guardando no.
- Avevo scritto che il pavimento del testo del riquadro fosse 4,00 mm: dopo
  la misura è **3,20**, e il commento nel codice dice il perché.

### Quali conteggi sono pavimenti

- **Le misure del riquadro** valgono su un nome di 17 lettere. Nomi più
  lunghi andranno su tre righe: non l'ho provato.

### 🔴 Cosa ho lasciato sul progetto di prova

**Niente, e l'ho contato invece di prometterlo.**

Per rifare la scena ho creato **tre prenotazioni** su T3 alle 20:30
(`MISURA30AGO-1/2/3`) e le loro assegnazioni. Cancellate **per
identificativo**, non «le più recenti» (regola del 23/08):

| | prima | dopo |
|---|---|---|
| prenotazioni | 276 | **273** |
| assegnazioni ai tavoli | 209 | **206** |
| **lapidi** (`deleted_records`) | 9409 | **9409** |
| righe `MISURA30AGO%` rimaste | — | **0** |

⚠️ Le lapidi non si muovono perché `reservations` non è fra le 21 tabelle
tracciate: **è un fatto misurato, non una promessa.**

### Blocchi non aperti

Restano il **Blocco 2** (vini e bevande nel magazzino), il **Blocco 5** e
l'**Aggiunta 2** (Produzioni). Le ragioni sono in fondo al messaggio.
