# Referto — i moduli che toccano soldi e obblighi (13/08/2026)

**Cosa è stato guardato**: Cassa/Prima Nota, Proiezione Fiscale,
Personale, HACCP. **Logica interna**, non permessi né architettura: quelli
hanno già avuto il loro giro (audit dell'08/08 e Contratto). Qui si cerca
il calcolo sbagliato e la regola incompleta — le cose che nessun controllo
per classi di difetto trova, perché il codice funziona benissimo mentre
dice una cosa falsa.

**Nessuna correzione applicata.** Su richiesta di Alessio: prima il
referto, poi si decide cosa vale la pena toccare e in che ordine.

Gravità: 🔴 produce numeri sbagliati o dichiarazioni false · 🟠 lacuna che
si paga a un controllo o a un'ispezione · 🟡 da sistemare, non urgente.

---

## 🔴 1. «Cassa, Banca e Prima Nota» non ha la banca

Il modulo si chiama così nella schermata, ma dentro **esiste solo il
contante**: un movimento non ha modo di dire se è passato dal cassetto o
dal conto corrente. Non c'è un campo per il mezzo di pagamento, non c'è
un saldo di banca, non c'è un conto.

Il saldo che il gestionale chiama «contante atteso» somma **tutti** i
movimenti.

**Cosa succede il primo giorno vero.** Alessio paga un fornitore con un
bonifico da 300 € e lo registra (deve: è prima nota). Il gestionale
scrive 300 € in meno nel cassetto, dove invece non è uscito niente: a
fine serata la conta non torna, e non torna **per un motivo che non è un
errore di cassa**. Se invece non lo registra per non sballare il conto,
la prima nota è incompleta — cioè il registro che deve essere completo.

**Non c'è modo di usarlo bene**: qualunque cosa faccia, uno dei due
numeri è falso.

**Cosa farei**: un campo «da dove è uscito/entrato» (cassa o banca) su
ogni movimento, e due saldi separati. È una migrazione piccola, ma tocca
la schermata più usata del modulo e il calcolo del saldo.

---

## 🟠 2. L'IRAP è calcolata sull'utile, come l'IRES

Il simulatore applica IRES (24%) e IRAP (3,9%) **allo stesso identico
numero**, l'utile stimato.

L'IRES sull'utile è corretto. L'IRAP no: ha una base sua — il valore
della produzione netta — in cui alcune voci non si scalano come per
l'IRES, a partire dagli interessi e da parte del costo del lavoro. Per
un'osteria con dipendenti la base IRAP è tipicamente **più alta**
dell'utile, e il numero mostrato è quindi ottimista in modo sistematico.

⚠️ La pagina dichiara onestamente di essere una stima e rimanda a Laura,
e questo salva il modulo dall'essere pericoloso. Ma «stima» fa pensare
«approssimato per difetto o per eccesso a caso»: qui è **storto sempre
nella stessa direzione**, che è un'altra cosa.

**Cosa farei**: non inventare una formula IRAP. Chiedere a Laura quale
base usare, e nel frattempo scrivere in schermata che l'IRAP è calcolata
sull'utile per semplificazione e che la base vera è diversa — una riga,
oggi.

---

## 🟠 3. Una temperatura fuori range si salva senza dover fare niente

Il registro temperature confronta la lettura col range del frigo e
scrive **«Fuori range»** in rosso. Poi:

- l'azione correttiva è un campo **facoltativo**;
- non nasce **nessuna non conformità**;
- niente impedisce di salvare e andare avanti.

**Perché è peggio di non averlo scritto.** Quel registro si esibisce a
un'ispezione. Una riga «frigo a +12 °C, fuori range» senza nessuna azione
accanto è una dichiarazione firmata che te ne sei accorto e non hai fatto
niente. Un ispettore non trova un buco: trova una prova.

**Cosa farei**: fuori range → azione correttiva **obbligatoria** per
salvare, e la riga di non conformità che nasce da sé (come «buttata»
nello scadenziario di stamattina, dove funziona già così).

---

## 🟠 4. Merce non conforme al ricevimento, e nessuna conseguenza

Stessa forma del punto 3, altro registro. Al ricevimento merci si
spuntano «imballaggio OK» e «conforme». Se li togli — cioè se la merce
arriva rotta o alla temperatura sbagliata — **non succede niente**:
nessuna nota obbligatoria, nessuna non conformità, nessuna traccia di
cosa è stato deciso (respinta? accettata lo stesso? con quale riserva?).

Resta scritto che la merce non era conforme e che è entrata comunque.

**Cosa farei**: come sopra. Non conforme → serve dire cosa si è fatto, e
la non conformità nasce da sé.

---

## 🟠 5. Gli omaggi sono valorizzati a listino, ma la TD27 vuole il costo

Il riepilogo mensile degli omaggi — quello che serve a Laura per
l'autofattura TD27 — somma il **valore a listino** del conto omaggiato.
La tabella non conserva da nessuna parte quanto quel pasto è **costato**.

Ma per la cessione gratuita di beni dell'attività la base è il **costo di
produzione**, non il prezzo di vendita (è scritto anche nella domanda L1
preparata per Laura). Un pasto da 40 € di listino può costarne 11: la
differenza fra le due basi non è un dettaglio.

⚠️ E non è recuperabile dopo: il costo degli ingredienti di quel piatto
si può calcolare **oggi**, coi prezzi di oggi. Fra sei mesi, no.

**Cosa farei**: registrare anche il costo al momento dell'omaggio, come
si fa già col prezzo del coperto (`orders.coperto_unit_price` conserva il
prezzo di allora). Il riepilogo poi mostra tutti e due i numeri e Laura
sceglie.

**Nota**: si incrocia col lavoro «pasti del personale» già in coda, che
ha esattamente lo stesso problema e la stessa soluzione.

---

## 🟡 6. Le ferie sono un numero scritto a mano

Si registra un permesso con data di inizio, data di fine e **un numero di
giorni digitato a mano**, che può essere vuoto o non c'entrare niente con
le date (dal 1 al 15 agosto, «2 giorni»). Non c'è nessun controllo, non
c'è il residuo maturato, e due permessi possono sovrapporsi senza che
nessuno dica niente.

Finché il personale non c'è, non fa danno. Il giorno in cui qualcuno
chiede «quante ferie mi restano», la risposta del gestionale non è
affidabile — e quella è una domanda che si fa sempre.

**Cosa farei**: calcolare i giorni dalle date (lasciandoli correggibili
per i mezzi giorni), rifiutare le sovrapposizioni. Il residuo maturato è
materia da consulente del lavoro: prima si chiede a Gianna.

---

## 🔴 7. Il magazzino sale e non scende mai da solo

*Aggiunto dopo la consegna del referto, da una domanda di Alessio: «il
magazzino non cala perché non abbiamo ancora ricette, o non lo farebbe a
prescindere?». **A prescindere.***

Verificato nel codice e nel database: chiudere un conto scrive sul conto e
sulla cassa e **non tocca il magazzino in nessun modo**. Non c'è nessun
trigger su `orders` o `order_items` che scarichi la giacenza; le uniche
due cose che la muovono sono il carico da fattura (che la fa salire) e lo
scarico a mano dalla schermata Magazzino.

Con le ricette perfette e la cella piena, **servire cento coperti
lascerebbe la giacenza esattamente com'era**.

**Le tre conseguenze, in ordine di quanto fanno male:**

1. **La lista della spesa non partirà mai.** La Fase A del mandato «filiera
   della spesa» — appena messa in coda — fa comparire in lista un
   ingrediente quando la giacenza scende sotto la soglia. Se la giacenza
   non scende, nessun ingrediente ci arriva mai. La funzione sembrerebbe
   costruita e funzionante, e non direbbe niente per sempre.
2. **La giacenza diverge dalla realtà un po' ogni giorno**, e non esiste
   il momento in cui qualcuno se ne accorge: lo si scopre contando a
   mano.
3. **Lo scadenziario ci si appoggia**: una partita esaurita tace, ma se
   nessuno scarica niente nessuna partita risulta mai esaurita. Regge lo
   stesso solo grazie alla regola voluta da Alessio (una partita più
   recente zittisce la vecchia) — che quindi lo protegge da un difetto
   che non era stata pensata per coprire.

**Perché non è una dimenticanza**: lo scarico automatico a fine conto
funziona solo se le ricette sono precise, e va deciso cosa fare delle
voci libere, dei piatti fuori ricetta e degli sprechi. Fatto male produce
**giacenze sbagliate con l'aria di essere giuste**, che è peggio di
giacenze dichiaratamente manuali. È un lavoro a sé, non una correzione —
messo in coda in `CLAUDE.md` §10, da fare quando ci saranno ricette vere.

---

## Quello che invece è sano, e va detto

- **Le mance** fanno davvero i controlli che dichiarano: soglia dei
  75.000 € di reddito dell'anno prima, tetto del 30%, sostitutiva al 5%
  calcolata sull'imponibile giusto. E dicono chiaramente che segnalano,
  non decidono.
- **Le deduzioni** applicano il plafond dell'1,5% dei ricavi sul totale
  annuo (non riga per riga, che sarebbe sbagliato), distinguono le
  percentuali per categoria e marcano le spese non tracciate come non
  deducibili.
- **I registri HACCP non hanno limiti nascosti**: le liste che alimentano
  il manuale esibibile sono complete per costruzione, e il modo di
  contenerle è il filtro di periodo. C'è l'avvertenza scritta in testa al
  file perché nessuno ci ricaschi.
- **La prima nota non taglia l'export**: stessa avvertenza, stesso motivo.
- **Le date sono locali ovunque** nei moduli guardati: nessuna ricaduta
  nella trappola del giorno sbagliato fra mezzanotte e le due.

---

## Cosa NON copre questo referto

- **Il modulo Comande e il conto al tavolo**: già passato dal suo giro il
  09/08 e coperto da `orderTotals()`.
- **La proiezione fiscale oltre il simulatore** (catalogo strumenti,
  scadenzario societario): guardata solo di sfuggita.
- **Le regole HACCP di merito** — quali registrazioni servono, con che
  frequenza, con quali soglie. Quelle le valida Tiziana, non io: qui si è
  guardato se il gestionale fa quello che dice di fare, non se quello che
  dice è il piano giusto.
- **Nessuna verifica dal vivo con dati veri**: i moduli sono
  sostanzialmente vuoti (nessun dipendente, nessun movimento di cassa,
  nessuna lettura di temperatura). Questo referto nasce dalla lettura del
  codice e dello schema, non dall'uso.
