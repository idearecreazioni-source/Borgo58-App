# Consegna del 15/08/2026 (quarta) — la tesoreria

**Commit della consegna: `1441655`** (questo riepilogo è il commit
immediatamente sopra, sola documentazione). Working tree pulito.

| Commit | Cosa |
|---|---|
| `6929cfa` | le funzioni online si possono installare sul progetto di prova |
| `b1ff04b` | la cassa che quadra — migrazione `20260815000004` |
| `5dcb127` | il cassetto si conta e si versa, e il saldo dice finalmente tutto |
| `cb98cd4` | ce la faccio al 16? — migrazione `20260815000005` e la schermata |
| `1441655` | `CLAUDE.md`: la tesoreria, e due trappole che valgono oltre questo blocco |

**Applicate in produzione**: `20260815000004`, `20260815000005`. **106
migrazioni**. `operazioni-atomiche` reinstallata (**v22 → v23**), con due
operazioni nuove.

È il **Blocco 6 del mandato «personale e tesoreria»**, consegnato in due
metà. ⚠️ **Manca il caricamento dell'estratto conto**, rinviato da Alessio
— vedi §6.

⚠️ **Questa consegna NON modifica `docs/CONTRATTO.md`** (§10 punto 9 del
mandato). Nessuna riga è risultata non più vera: le due operazioni nuove
sono B4 e passano dal corridoio, come la riga di §5 già prevede.

---

## 1. Il concetto che regge il blocco

**Un costo non è un'uscita.** Il costo del personale di agosto sta ad
agosto nel conto economico; lo stipendio esce il 10 di settembre e l'F24
il 16.

*Chi guarda solo la cassa crede che agosto sia leggerissimo e settembre un
disastro. Chi guarda solo il conto economico sa se guadagna ma non **se
arriva al 16 con i soldi sul conto** — ed è la seconda domanda quella che
chiude i ristoranti.*

Due viste distinte alimentate dagli stessi fatti, come chiedeva il
mandato: non una sola che prova a rispondere a entrambe.

---

## 2. Il saldo di cassa era incompleto, e si spiegava con una nota sotto

🔴 Dal 04/08 chiudere un conto non scrive in prima nota — scelta giusta e
invariata, perché gli incassi di sala arriveranno dal registratore
telematico. Ma la conseguenza era che il saldo **escludeva in silenzio
ogni incasso di sala**, tanto che dal 14/08 la schermata lo dichiarava con
una riga sotto il numero.

**Un numero che si deve spiegare con una nota sotto non è una risposta**
alla domanda «quanto contante ho nel cassetto?».

⚠️ **La soluzione non è scrivere righe finte in prima nota.** Gli incassi
contanti si **leggono dai conti chiusi** — stesso patto di `lista_spesa()`,
dove giacenza e soglia vengono dal conteggio vero e non da una copia. Così
la prima nota resta il registro di ciò che ha scritto Alessio, e **il
giorno del registratore telematico non c'è nessuna riga doppia da
togliere**.

⚠️ **E rispetta la decisione di Alessio del 15/08 sui ricavi**: i conti
chiusi restano l'unica fonte, e questa lettura **non aggiunge ricavo** —
ripartisce lo stesso incasso per mezzo di pagamento. Il contante nel
cassetto, la carta in arrivo dalla banca.

**L'avvertenza del 14/08 è sparita perché non è più vera.** Al suo posto
c'è quella che arriva dal database insieme al numero, e dichiara il limite
che **resta**: qui manca la carta, che non è ancora in banca.

---

## 3. Il cassetto: contarlo, e portarne una parte in banca

**Il conteggio.** Il teorico si **fotografa** al momento del conteggio:
ricalcolandolo dopo, la differenza di un conteggio di marzo cambierebbe da
sola a ogni movimento arretrato — stesso principio dei risultati congelati
di uno scenario e del costo congelato sul lotto.

⚠️ **E la differenza non si limita a essere dichiarata: genera un
movimento vero.** Se restasse solo scritta nel conteggio, il saldo
continuerebbe a dire un numero che il cassetto ha già smentito, e alla
settimana dopo la differenza **si sommerebbe a sé stessa**. La riga porta
la causale di sistema e il rimando al conteggio, quindi resta riconoscibile
per sempre come «questo l'ha messo il conteggio».

**Nessuna soglia di allarme**, per decisione esplicita di Alessio: la vede
e basta. Una soglia inventata da me farebbe suonare l'allarme sulle cose
sbagliate.

**Il versamento è un trasferimento, non un'uscita**: due movimenti in una
transazione, cassa giù e banca su (corridoio, B4). A metà sarebbe denaro
sparito da una parte e mai arrivato dall'altra — **l'incoerenza più facile
da non notare, perché ognuno dei due saldi resta un numero plausibile.**

---

## 4. La trappola che il blocco apre, chiusa nella stessa migrazione

⚠️ **Fino al 15/08 ogni uscita di prima nota era un COSTO.** Da oggi no: un
versamento in banca è un'uscita dalla cassa che **non è una spesa**.
`rettifiche_fiscali()` e `costi_da_classificare()`, scritte poche ore
prima nella consegna della deducibilità, sommavano **tutte** le uscite:
senza correggerle, ogni versamento sarebbe comparso fra i costi da
classificare e avrebbe gonfiato i costi dell'anno — **senza nessun
errore**.

Sono state corrette **dentro la stessa migrazione che crea il problema**.
*Una trappola aperta in una migrazione e chiusa in quella dopo è una
trappola che per un po' è stata aperta* — e nel frattempo qualcuno può
aver guardato quel numero.

Le quattro **causali di sistema** sono protette da un **vincolo**, non da
un'abitudine: non si spengono e non si marcano «è un costo fisso». Un
versamento contato fra i fissi falserebbe lo scostamento della Proiezione
e nessuno saprebbe perché. Unicità con indice parziale, così una
riesecuzione non ne crea altre quattro che le funzioni sceglierebbero a
caso con `limit 1`.

---

## 5. «Ce la faccio al 16?»

Somma cassa + banca + carta in arrivo, toglie ciò che deve uscire entro la
data scelta.

⚠️ **La riconciliazione che non ha bisogno di file.** Una fattura non
pagata è un'uscita attesa; quando `pay_supplier_invoice` la segna pagata e
scrive il movimento, **sparisce da sola**. Questa è già riconciliazione, e
l'estratto conto servirà a confrontare col **mondo esterno** — non a
sapere cosa il gestionale ha già registrato. È la ragione per cui rinviare
il caricamento non lascia il blocco monco.

**Il POS in transito**, che il mandato chiede «dal primo giorno»: senza
quella voce il saldo teorico della banca non torna **mai**, e un numero
che non torna mai si smette di guardare in una settimana.

⚠️ **I due parametri nascono VUOTI** — giorni di accredito e commissione —
e non li invento: sono il quesito B2 e la banca non è scelta. Finché sono
vuoti la schermata dichiara che l'importo è **lordo** e che non si sa
quando arriva. È il terzo stato della deducibilità applicato a un
parametro invece che a un costo: un valore inventato qui sposterebbe il
saldo previsto **sempre nella stessa direzione**.

⚠️ **E la previsione dichiara da sola il suo buco più grosso: non
comprende gli stipendi**, che escono dal prospetto del costo aziendale —
Blocco 1, fermo in attesa di Gianna. Senza quella frase un saldo previsto
ottimista sembrerebbe una promessa. La verifica controlla che la frase ci
sia.

---

## 6. Cosa NON è stato costruito, e perché — decisione di Alessio

**Il caricamento dell'estratto conto (CSV) non c'è.** Chiesto a lui prima
di iniziare la seconda metà, con le due strade e le conseguenze; ha scelto
di rinviarlo.

La ragione regge: **il conto corrente non è ancora aperto** e non sappiamo
che formato esporti l'home banking — è il quesito B1, e la scelta della
banca è ancora davanti. Costruire adesso un lettore di file al buio
significa costruirlo due volte.

⚠️ **Il Blocco 6 resta quindi aperto su questo punto**, e non lo dichiaro
completo. Tutto il resto del §7 del mandato è consegnato.

---

## 7. Il buco nel processo che si è visto costruendo, e che è stato chiuso

Le migrazioni hanno una rete: `scripts/migra.mjs` **si rifiuta** di toccare
la produzione se non le ha viste passare dal progetto di prova. **Le
funzioni online non ce l'avevano** — `funzione.mjs` era cablato sul solo
riferimento di produzione.

Si è visto qui: due operazioni nuove del corridoio, le prove automatiche
che le chiamavano, e il corridoio del progetto di prova che rispondeva
**404** perché nessuno poteva aggiornarlo se non dal pannello a mano.

⚠️ **La conseguenza vera non è il 404**: senza quel comando, **un'operazione
nuova poteva arrivare in produzione senza essere mai stata esercitata da
nessuna prova.** La rete c'era su metà della catena.

`npm run funzione <nome> --prova`. Sulla prova cadono due vincoli — «già
su GitHub» e «già committato» — e cadono per la stessa ragione: il
progetto di prova serve a esercitare il codice **prima** di committarlo,
che è l'ordine che il protocollo chiede. Pretendere il commit lì creerebbe
un giro chiuso. **In produzione restano interi tutti e due.**

---

## 8. Verifica

| Cosa | Stato |
|---|---|
| le due migrazioni sul progetto di prova | **applicate quattro e tre volte**: idempotenti |
| un conto chiuso in contante entra nel saldo | **provato** con un conto vero (2 piatti + 2 coperti = 50) |
| …e la prima nota resta a **zero righe** | **provato** |
| …e lo stesso conto pagato con carta **non** entra nel contante | **provato** |
| il versamento sposta e non spende | **provato** in migrazione **e dal corridoio vero** |
| non si versa più contante di quanto ce n'è | **respinto** |
| il conteggio fotografa il teorico e genera il movimento | **provato** |
| un secondo conteggio uguale non muove niente | **provato** (la correzione non si somma a sé stessa) |
| versamento e differenza **non** sono costi | **provato** in migrazione e da fuori |
| causale di sistema: spegnerla, marcarla costo fisso | **respinti dal vincolo**, anche scrivendo in tabella |
| i parametri del POS nascono vuoti e si dichiara «lordo» | **provato** |
| una scadenza oltre l'orizzonte non viene contata | **provato** |
| una fattura pagata **sparisce** dalle uscite attese | **provato** in migrazione e da fuori |
| la previsione è la somma che dichiara di essere | **provato** |
| …e dichiara che mancano gli stipendi | **provato** |
| lo staff respinto su saldi, versamento, conteggio, previsione, POS, attesi | **provato col token vero** |
| prove automatiche | **80 verdi** (erano 69) + **14 pure** |
| lint, build | puliti |
| **produzione** | **106 migrazioni**, corridoio **v23** |
| elenco anonimi · `security definer` senza portiere | **12** · **13**, invariati |
| residui delle verifiche in produzione | **zero**, controllati col connettore |
| avvisi partiti durante le due applicazioni | **zero** |

⚠️ **La RLS non si prova dentro una migrazione**: là si gira come
proprietari e il proprietario la scavalca. Le prove automatiche passano da
PostgREST col token dello staff, e **creano prima una riga vera** che lui
non deve vedere (§5 punto 2).

⚠️ **La verifica della seconda migrazione RIMETTE i parametri del POS come
erano — cioè inesistenti.** Lasciare quella riga direbbe che Alessio ha
risposto a una domanda che nessuno gli ha ancora fatto. Lezione del 14/08:
una verifica che modifica dati si ripulisce **rimettendo**, e qui
«com'era» voleva dire che la riga non c'era affatto.

**Tre difetti miei, trovati prima di applicare:**
1. Un'ambiguità fra una colonna della vista dei saldi e un parametro di
   uscita della funzione (`saldo_banca` era entrambi).
2. Una pulizia che inseguiva le note con un `like` invece di cancellare per
   data — cioè il modo in cui una pulizia lascia indietro proprio la riga
   creata per ultima, che qui era il movimento scritto **dalla funzione** e
   non da me.
3. La chiusura di una scadenza scritta con la **data UTC**, la trappola di
   §8: fra mezzanotte e le due restituisce ieri, e per un'osteria che
   chiude all'una vuol dire chiudere col giorno sbagliato.

---

## 9. Cosa NON è verificato, e lo dico chiaro

- ⚠️ **Nessuno ha ancora usato le schermate.** Il riquadro «Il cassetto» e
  la pagina «Ce la faccio?» non le ha aperte una mano vera: i PIN sono
  suoi. È il limite più grosso.
- ⚠️ **Non può essere visto con dati veri, e non per un difetto**: in
  produzione ci sono **zero** movimenti di prima nota, **zero** fatture,
  **zero** conti chiusi (i due esistenti sono **annullati**, verificato col
  connettore, quindi non entrano in nessun saldo). Tutti i numeri diranno
  zero, e non è un guasto.
- **Il caricamento dell'estratto conto non esiste** (§6), quindi il
  confronto col mondo esterno non è mai stato provato.
- **I parametri del POS non sono impostati** e devono restare così finché
  la banca non risponde: vuol dire che il calcolo del netto e la finestra
  dei giorni **non sono mai stati visti funzionare con valori veri** — solo
  dentro la verifica, che li imposta e poi li toglie.
- **Gli stipendi non entrano nella previsione**, dichiarato ovunque:
  aspettano il Blocco 1 e Gianna.
- **I dati di collaudo del magazzino restano in produzione** (deroga del
  13/08) e `/prova-voce` è ancora lì. Restano anche **2 prenotazioni di
  prova** della sala: sono righe di Alessio, e le toglie lui.
