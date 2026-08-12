# Consegna del 12/08/2026 — la prova della dettatura, e il carico finalmente giusto

**Commit della consegna: `885da6d`** (questo riepilogo è il commit
immediatamente sopra, sola documentazione). Working tree pulito.

Niente da applicare al database. Una schermata nuova, **dichiaratamente
usa-e-getta**.

---

## 1. Il carico da fattura, letto come deve

Ultima rilettura della bolla di prova, dopo le due correzioni della sera
(tetto della risposta e righe non-merce):

| Riga del documento | Nome proposto | Conversione |
|---|---|---|
| Pomodori ciliegini di Pachino IGP, cassa da 6 kg | Pomodoro ciliegino | cassa = **6** |
| Melanzane nere lunghe sfuse | Melanzana | 1 |
| Basilico fresco in mazzi | Basilico fresco | 1 |
| Ricotta di pecora fresca, vaschetta 1 kg | Ricotta di pecora | 1 |
| Olio EVO Nocellara del Belice, lattina 5 L | Olio extravergine di oliva | lattina = **5** |
| Semola rimacinata di grano duro, sacco 25 kg | Semola rimacinata di grano duro | sacco = **25** |
| Detergente sgrassante professionale, tanica 5 L | Detergente sgrassante *(non alimentare)* | 5 |
| Contributo trasporto | — | **fuori dal carico** |
| Contributo ambientale CONAI | — | **fuori dal carico** |

Marca, IGP e formato tolti da tutti i nomi; il detersivo marcato non
alimentare da solo; trasporto e contributo già fuori, senza nome proposto.
Quadratura: **237,00 € = imponibile del documento**, al centesimo.
Costo della lettura: 10.421 token.

**Resta non fatto**: nessuno ha ancora premuto Conferma su questa
proposta. Il carico vero — lotti in magazzino, ingredienti creati, diciture
memorizzate, prezzi nello storico — non è mai stato eseguito con la
schermata definitiva.

---

## 2. La schermata della dettatura — perché esiste e perché è brutta

Chiesta da Alessio prima di comprare hardware:

> *«Se capiamo che funziona e vale la pena acquisto tutto l'hardware
> necessario, altrimenti niente.»*

È la prova che avevo consigliato di fare **per prima**, perché è quella
che può far cadere tutto il resto del mandato sulle ricette: se in cucina
con la cappa accesa non si capisce niente, la dettatura non si fa — e
tanto vale saperlo prima di progettarci attorno una schermata.

Dentro non c'è niente del gestionale: nessuna ricetta, nessuna scrittura,
nessuna chiamata a pagamento. Si preme, si parla, si legge **il testo
esatto che ha capito**, con la percentuale di sicurezza dichiarata dal
browser.

**La barra del rumore non è un vezzo**: distingue *«non mi sente»* da *«mi
sente ma c'è troppo fondo»*, che sono due problemi con due soluzioni
diverse — il microfono a clip, oppure spegnere la cappa mentre si parla.
Il pulsante «segna il fondo» misura quanto la cappa alza il rumore di
base: è quel numero che decide se l'acquisto ha senso.

**Dichiarato in schermata**: la trascrizione la fa il browser, quindi
mentre si parla **l'audio esce verso Google**. Per una prova va bene;
nel modulo vero è una decisione da prendere apposta, e non è la stessa
cosa di *«l'audio non si conserva»*.

Sta su `/prova-voce`, titolare-only, e **va cancellata dopo la
decisione**. Lo scrivo qui perché una schermata di prova che resta è il
modo in cui un gestionale si riempie di roba che nessuno sa più perché
c'è.

---

## 3. Contesto dal mandato ricette

Delle mie tre obiezioni al mandato, Alessio ne ha smontate due con
informazioni che non avevo:

1. **Il rumore**: lavorerà quasi sempre da solo e spesso con la cappa
   spenta, e i microfoni a cancellazione di rumore esistono. Il rischio
   resta, ma è molto più basso di come l'avevo posto — e questa prova
   serve a misurarlo invece di discuterne.
2. **I link social**: la prova dei cinque link **l'ha già fatta lui**, e
   funziona ragionevolmente. Obiezione caduta, e per il motivo giusto:
   un dato contro un'ipotesi.

Resta valida solo la terza, che è di sequenza: costruire la fondazione
dopo aver misurato quale delle due bocche regge davvero.

---

## 4. Verifica

| Cosa | Stato |
|---|---|
| lettura della bolla col metodo definitivo | **fatto**: 9 righe, nomi puliti, conversioni giuste, non-merce fuori |
| quadratura sul documento vero | **fatto**: 237,00 € = 237,00 € |
| lint, build | puliti |
| prove automatiche | **29 verdi** |
| **conferma di un carico** | **mai eseguita** con la schermata definitiva |
| **la prova della dettatura** | **mai eseguita**: la pagina esiste, nessuno ci ha ancora parlato dentro |

Le due cose non verificate sono anche le due che decidono i prossimi
passi: il primo carico vero riempirà la memoria delle diciture e lo
storico prezzi, e la prova della dettatura dirà se il mandato sulle
ricette parte o si ferma.
