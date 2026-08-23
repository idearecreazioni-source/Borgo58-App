# I campi messi dalla macchina si vedono

**Blocco 4 del mandato notturno del 23/08**, punto «le due cose già decise».
Migrazione **`20260823000001`**, applicata **solo sul progetto di prova**.
In produzione non è entrato niente: aspetta il push di Alessio.

---

## 1 · Cosa aveva chiesto Alessio

> *«temperatura di ricevimento e percentuale di scarto come gli allergeni;
> stagionalità, conservazione e durata visibili come "messi dalla macchina"
> ma non bloccanti»*

---

## 2 · 🔴 Il buco, misurato prima di scrivere

Dal 13/08 l'assistente compila cinque campi di un prodotto nuovo. Il
database sa **quando** l'ha fatto (`campi_compilati_il`) ma **non quali**, e
non sa se qualcuno li ha guardati dopo.

E il pezzo che fa male è questo: `applica_scheda_prodotto` **quell'elenco lo
ha già in mano** — lo costruisce in una variabile (`v_scritti`), lo
restituisce a chi la chiama, e poi lo butta via. L'informazione esisteva per
un istante e non veniva scritta da nessuna parte.

### Perché due di quei cinque campi non sono un dettaglio

| campo | cosa cambia se è sbagliato |
|---|---|
| **% di scarto** | entra nel costo di **ogni piatto** che usa quel prodotto — e sbaglia **sempre nella stessa direzione** |
| **temperatura di ricevimento** | è un dato HACCP: finisce su un registro che si esibisce |

Gli altri tre — stagionalità, conservazione, durata — spostano un avviso,
non un numero. È esattamente la distinzione che Alessio aveva fatto.

---

## 3 · Come è fatto

### Una lista, non cinque colonne «origine_…»

`ingredients.campi_da_confermare`, un elenco di nomi.

⚠️ **Perché non cinque colonne come per gli allergeni.** Gli allergeni ne
hanno una perché lì gli stati sono **tre** e uno è particolare — *letto
dall'etichetta*, che è la fonte legale. Qui gli stati sono due (l'ha messo
la macchina / l'ha guardato Alessio) e i campi sono cinque: cinque colonne
direbbero cinque volte la stessa cosa, e il campo che nascerà domani ne
vorrebbe una sesta.

⚠️ **E gli allergeni restano fuori dalla lista**, apposta: ce l'hanno già la
loro colonna. Metterli anche qui sarebbe **due posti che dicono la stessa
cosa e possono contraddirsi** — che in questo progetto è un difetto, non una
comodità.

### Cambiare un campo vuol dire averlo guardato

Lo fa un **trigger**, non l'applicazione: le schermate che scrivono su un
ingrediente sono più d'una (la scheda del prodotto, la creazione da fattura,
il carico), e una regola ripetuta in tre posti si dimentica nel quarto.

⚠️ **Ma solo se il valore cambia davvero.** È la differenza fra «l'ha
confermato» e «ha premuto Salva»: senza questo, un salvataggio qualunque
della scheda cancellerebbe tutti i segni in un colpo solo. La verifica lo
prova esplicitamente — riscrive lo stesso valore e pretende che il segno
resti.

### «Va bene così», senza toccare il numero

Il caso più frequente è proprio quello: la macchina ha indovinato. Senza una
strada per dirlo, l'unico modo per togliere il segno sarebbe **scrivere un
valore sbagliato e poi rimetterlo**.

### E la domanda che serve davvero

`campi_da_confermare()` risponde a *«quanti prodotti hanno ancora uno scarto
che nessuno ha guardato?»*, non a «questo prodotto è da confermare?». Con
cento prodotti, la seconda domanda non la fa nessuno.

---

## 4 · Cosa si vede a schermo

Nella scheda del prodotto, **accanto all'etichetta del campo**: un
segnetto *«messo dalla macchina»* e un *«va bene così»*.

⚠️ **Dentro il campo e non in un riquadro in cima**: una spiegazione sopra
la schermata si legge il primo giorno e poi diventa arredamento, e qui il
dubbio è su un numero preciso — *«questo 18% l'ho detto io o l'ha indovinato
la macchina?»*.

⚠️ **E non blocca niente**, come chiesto: il prodotto si usa, si vende, e il
suo piatto va in carta lo stesso.

---

---

## 5 · Due cose trovate applicando, non rileggendo

### 🔴 `v_tolti || 'durata'` non compila

Il trigger si è fermato al primo colpo con *«malformed array literal:
"durata"»*: senza un `::text` esplicito, Postgres legge quella stringa come
un **letterale di array**.

⚠️ **L'ha trovata la verifica perché CHIAMA la funzione**, non perché la
crea: è la lezione del 17/08 — *un corpo che si crea non è un corpo che
funziona*.

### 🔴 E la rete delle letture mute ha parlato due volte, la seconda a torto

Il pulsante «va bene così» inghiottiva il guasto in silenzio, e la prova
automatica delle letture mute l'ha preso: giusto, e corretto.

Ma alla seconda esecuzione **ha segnalato il commento** che spiegava la
correzione, perché lì dentro era scritta la forma vietata. Il setaccio
guarda il **testo**, non il comportamento.

⚠️ È la lezione del 22/08 vista da vicino: *un censimento automatico dice
dove guardare, non cosa è vero.*

---

## ⚠️ Cosa NON è verificato

1. 🔴 **In produzione non è entrato niente.** La migrazione è applicata
   **solo sul progetto di prova**: in produzione entra col push di Alessio e
   `npm run migra -- --conferma`.
2. 🔴 **Nessuna mano ha visto il segnetto.** La verifica dentro la
   migrazione prova la regola nei cinque versi (la macchina segna, cambiare
   toglie, riscrivere lo stesso valore no, confermare toglie senza
   cambiare, il conteggio risponde), ma **che il segno si legga sulla
   scheda di un prodotto vero non l'ha guardato nessuno**.
3. ⚠️ **La lista nasce vuota su tutti i prodotti che esistono già**, e va
   saputo: vuol dire «nessuno li ha messi in dubbio», non «li ha scritti
   Alessio». Il segno comparirà dalla prossima scheda compilata
   dall'assistente in poi. Riempirla all'indietro avrebbe voluto dire
   **indovinare** quali campi aveva messo la macchina mesi fa.
4. ⚠️ **Il conteggio non è ancora mostrato in nessuna schermata**: la
   funzione c'è e risponde, ma il posto dove scriverlo — il Ricettario? il
   food cost? — è una scelta di Alessio.

---

## Cosa abbiamo rovesciato

**Niente.** Nessuna decisione precedente viene ribaltata: la colonna degli
allergeni resta com'era e continua a fare il suo lavoro, e questo lavoro le
si mette accanto invece di sostituirla.
