# Il collaudo — guida per Alessio

Si prova con l'app davanti, non con un elenco di casi deciso prima. Qui
c'è solo l'occorrente: cosa è già apparecchiato, come si accende, e come
mi mandi quello che trovi.

---

## 1. Come si accende

Doppio click non basta: serve la finestra nera.

```bash
npm run dev:prova
```

Poi apri **http://localhost:5173**. In cima a ogni schermata deve esserci
la **striscia rossa «DATABASE DI PROVA»**. Se vedi quella grigia «DATI
VERI», chiudi tutto: sei sul locale vero e non devi scriverci niente.

Dal telefono: stesso indirizzo ma con i numeri, quello che comincia per
`192.168…` e compare nella finestra nera.

Quando hai finito, chiudi la finestra nera. Per tornare al gestionale vero,
`npm run dev` come sempre.

**Se rompi qualcosa, non è un problema**: si rimette tutto com'era con

```bash
npm run prova:scenario
```

Non c'è niente da salvare e niente da recuperare. È il posto giusto per
fare disastri.

---

## 2. Cosa c'è già dentro

Tutto quello che vedi marcato **`BASE-`** l'ho messo io, ed è finto.

- **2 fornitori** con recapiti e canale d'ordine — gli stessi nomi che
  trovi sui documenti finti del punto 4.
- **8 ingredienti** con giacenza, prezzo e scorta minima. Due sono già
  sotto soglia, quindi la **lista della spesa** ha delle righe dentro.
- **8 piatti in carta**, quattro categorie, su un menu attivo.
- **6 prenotazioni per stasera**: tre prima delle 20 e tre dopo, così sulla
  pianta vedi i due colori. **Tre hanno il tavolo, tre no** — quelle le
  assegni tu.
- **3 conti già chiusi e pagati**, perché una schermata vuota non si
  collauda.
- **2 fatture**: una pagata il mese scorso, una in scadenza.
- Un ricevimento merci non conforme, un movimento di prima nota, un
  tablet, i parametri fiscali.

⚠️ **Non ci sono conti aperti, comande in corso o righe già pronte da
stornare.** Quelli li fai tu: la sala apparecchiata è mia, la serata è tua.

---

## 3. Le due giornate da recitare

Non sono un elenco di casi da spuntare. Sono due percorsi lunghi: falli
per intero, e le storture verranno fuori da sole.

### Giornata A — una sera di servizio

Comincia dal **Calendario → la pianta**: guarda chi arriva, assegna i tre
tavoli che mancano. Poi apri le **Comande** e fai una serata: apri i
tavoli, prendi le ordinazioni, manda in cucina, stampa qualche ticket.

Poi complica, come si complica davvero:

- un tavolo che **riordina a metà servizio**, quando il primo giro è già
  in cucina;
- una riga da **stornare** dopo che è partita;
- un tavolo che **si sposta** o si accosta a un altro;
- il conto **diviso alla romana**, con l'arrotondamento;
- un **omaggio** o uno sconto, con la causale;
- un conto **pagato metà contanti e metà carta**;
- un piatto **fuori menu** (voce libera).

Alla fine guarda **Cassa** e **Magazzino**: i soldi tornano? La giacenza è
scesa di quello che hai venduto?

### Giornata B — dal fornitore al pagamento

- Guarda la **lista della spesa**: le righe che ci sono ti convincono?
- Genera un **ordine** e aprilo in WhatsApp (non mandarlo davvero).
- Mandati le mail del punto 4 e guarda cosa propone l'assistente.
- **Registra il carico** da una fattura, riga per riga.
- Segna la fattura **pagata** e controlla che l'uscita compaia in prima
  nota.
- Prova a **cancellare** una fattura già pagata: deve rifiutarsi e dirti
  cosa fare prima.
- Fai una domanda al **«Chiedi all'archivio»** sul contratto: per esempio
  «quanto costa un intervento straordinario sui frigoriferi?».

---

## 4. I documenti finti e le mail

I file li generi con:

```bash
npm run collaudo:documenti
```

Finiscono in `docs/collaudo/documenti/`. Sono sei PDF, tutti con il nome
che comincia per **`FINTA-`**, con **controparti inventate** (mai Mililli o
Augeri) e con scritto in fondo che sono documenti di prova. Se fra un anno
ne salta fuori uno, lo dice da sé in tre modi diversi.

| File | A cosa serve |
|---|---|
| `FINTA-Fattura-OrtoProva-114.pdf` | fattura pulita: il giro normale |
| `FINTA-Fattura-IttiCollaudo-58.pdf` | **la fattura difficile**: una riga che non si capisce («MISTO GG/2 SEL. CAT.A») e una con l'unità ambigua (12 casse o 12 chili?) |
| `FINTA-DDT-OrtoProva-341.pdf` | bolla senza prezzi, con lotti e scadenze |
| `FINTA-Contratto-manutenzione-frigoriferi.pdf` | contratto con canone, durata e rinnovo: è per «Chiedi all'archivio» |
| `FINTA-Bustapaga-marzo-2027.pdf` | busta paga con lordo, netto e costo azienda |
| `FINTA-Pubblicita-forniture.pdf` | **non è un documento**: serve a vedere che non finisca in archivio |

**A quale indirizzo mandarle: `info@borgo58.it`**, dalla tua posta
normale. Una mail per documento, con un oggetto verosimile («Fattura
114/2026», «DDT 341», «Contratto manutenzione»), e il PDF allegato.

⚠️ **E qui c'è una cosa che devi decidere tu, prima di mandarle.** La
posta entra nel gestionale **vero**, non in quello di prova: il servizio
che consegna le mail punta al locale, e spostarlo vorrebbe dire toccare la
catena che oggi funziona. Quindi:

- tutto il resto del collaudo gira sul database di prova, senza rischi;
- **la parte della posta gira sul database vero**, e quei sei documenti
  finiscono nell'archivio vero insieme a quelli veri.

Non è una cosa nuova: nel gestionale ci sono già sei fatture di collaudo
dal 13 agosto, tenute apposta. Ma vanno tolte tutte insieme **prima della
prima fattura vera di un fornitore vero**, come avevamo deciso. Se
preferisci non aggiungerne altre, la parte della posta si salta e si prova
solo il carico da fattura a mano — dimmelo e ti dico cosa cambia.

---

## 5. Come mi mandi quello che trovi

**Non fermarti a ogni intoppo per scrivermi.** Vai avanti e annota:
correggere a interruzioni mi fa fare dieci giri sullo stesso file, a
blocchi ne faccio uno solo e più pulito.

Mandami **un blocco alla fine di ogni giornata** (o quando ti fermi), con
una riga per problema, così:

```
SALA · il conto alla romana non torna
Tavolo 3, conto da 47,50 in 4 persone. Ho messo 11 a testa,
il resto l'ha registrato come sconto ma nel riepilogo non lo trovo.

MAGAZZINO · la giacenza non è scesa
Chiuso il tavolo 5 con 2 busiate. I pomodori sono rimasti 18 kg.

CASSA · piccolezza
Il totale del mese è scritto in grigio chiaro, si legge male sul tablet.
```

Tre cose per ogni riga, e nient'altro: **dove** (il modulo), **cosa hai
fatto**, **cosa ti aspettavi**. Non serve che tu capisca perché: quello è
il mio lavoro.

Se una cosa è solo brutta e non sbagliata, scrivi «piccolezza» — così
separo subito i difetti dalle rifiniture e non ti chiedo di ridirmelo.

Se qualcosa **ti blocca** e non puoi andare avanti, quella sì: scrivimela
subito da sola.

---

## 6. Il primo esercizio, prima delle due giornate

Nessuno ha ancora guardato quello che ho messo dentro **schermata per
schermata**. So che le righe ci sono, non che ogni schermata le mostri
bene — ed è la prima cosa da scoprire.

Prima di cominciare a recitare, fai un giro dei moduli e guarda **soltanto
se i numeri hanno senso**, senza toccare niente:

- Ricettario: le 8 ricette, i costi, il food cost dei piatti
- Editor Menu: la carta, il food cost medio
- Magazzino: giacenze, scadenze, lista della spesa
- Calendario: la pianta di stasera, i due colori, le prenotazioni
- Cassa: saldo, prima nota, i conti chiusi
- Fatture: i due totali per società
- Proiezione fiscale: cosa mostra senza previsione caricata
- HACCP: il ricevimento non conforme e la non conformità aperta

**Quello che ti sembra strano qui è il difetto più prezioso di tutto il
collaudo**, perché è quello che vedrai ogni giorno per anni.
