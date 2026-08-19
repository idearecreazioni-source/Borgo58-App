# In un menu ci vanno solo i piatti

**Migrazione**: `20260820000002_in_menu_solo_i_piatti.sql`
— applicata sul progetto di prova, **NON ancora in produzione**.
**Nessuna nuova operazione del corridoio.**
Due decisioni di Alessio del 20/08, prese guardando la misura fatta applicando
il blocco 2 dei finger food.

---

## ⚠️ Cosa NON è verificato

1. 🔴 **Nessuna mano ha aperto l'Editor Menu dopo la modifica**, e nessuna
   prova di questo progetto guarda una schermata: quello che è provato è che
   il database rifiuta e che il criterio della schermata risponde giusto — non
   che l'elenco a video si sia accorciato.
2. ⚠️ **In produzione ci sono 0 menu e 0 ricette**: la regola non ha mai
   incontrato un dato vero, e non può.
3. ⚠️ **Nessun menu esistente è stato riesaminato**, perché non ce ne sono. Il
   giorno che ci fossero, il trigger guarda solo le righe **nuove o
   modificate**: una riga già scritta con dentro una preparazione resterebbe
   dov'è. Oggi il caso non esiste; è dichiarato perché domani no.

---

## Cosa abbiamo rovesciato

**Un rovesciamento, il n. 19** ([`decisioni_rovesciate.md`](../decisioni_rovesciate.md)).

- **Cosa era stato deciso e quando**: il 19/08, che il caso dei **due prezzi**
  — lo stesso bocconcino venduto anche come piatto in carta — si **scrivesse**
  invece di risolverlo, e che quel giorno sarebbe servita una regola su quale
  prezzo vince.
- **La ragione di allora**: il caso esisteva, niente lo escludeva, e un caso
  che non si risolve va scritto dove qualcuno lo leggerà.
- **Cosa si decide adesso**: Alessio — *«semmai un bocconcino dovesse
  diventare un piatto a sé, creerò una ricetta nuova con un nome diverso»*. Il
  prezzo a pezzo resta l'unico prezzo di un bocconcino.
- **Perché la ragione di allora non vale più**: ⚠️ **non perché fosse
  sbagliata — perché descriveva un caso che una decisione ha cancellato.** Non
  si è risolto il conflitto: si è smesso di poterlo generare.

⚠️ **L'avvertenza è stata sostituita, non cancellata**, in tutti e tre i posti
dove stava (il commento della colonna nel database, il mandato, il riepilogo
del prezzo a pezzo): ognuno dice adesso che c'era e cosa l'ha superata. *Un
avvertimento sparito senza spiegazione è indistinguibile da uno dimenticato.*

---

## 🔴 Il criterio chiede una proprietà, non elenca i tipi

Alessio: *«le preparazioni non devono stare nell'elenco del menu, ci devono
stare solo i piatti taggati pronti per la carta»*.

⚠️ **La forma conta più del contenuto**, ed è la stessa cura fatta poche ore
prima sulla colonna delle porzioni: il criterio non è «togliamo i tipi che non
servono» ma **«restano i piatti pronti per la carta»**. Un tipo nuovo domani
non ricompare dove non deve, perché **non c'è nessun elenco da ricordarsi di
aggiornare**.

### Le due metà stanno in due posti diversi, apposta

| metà | dove vive | perché lì |
|---|---|---|
| **«è un piatto»** | **nel database** (trigger `solo_piatti_in_menu`) | è un **invariante**: una preparazione dentro un menu è un errore di categoria, come un piatto dentro un altro piatto. Il Contratto è esplicito — gli invarianti sono vincoli del database, non controlli nella schermata |
| **«è pronto per la carta»** | **nella schermata** (`puoAndareInCarta`) | è una condizione di **maturità**, e cambia nel tempo. Un vincolo la renderebbe una gabbia: togliere il segno «pronta» a un piatto che sta in un menu in bozza verrebbe respinto, e non è una cosa che qualcuno ha deciso |

⚠️ **Il trigger difende due porte**, non una: la carta (`menu_items`) **e i
piatti del giorno** (`daily_menu_items`). Difenderne una sola avrebbe lasciato
l'altra aperta, e il difetto sarebbe comparso nel posto meno guardato.

⚠️ **E guarda anche gli aggiornamenti**, non solo gli inserimenti: sostituire
in carta un piatto con una preparazione è lo stesso fatto per un'altra strada.
Questa non è una precauzione teorica — vedi la seconda rottura qui sotto.

⚠️ **Le voci libere dei piatti del giorno restano ammesse**: una riga senza
ricetta non è una ricetta sbagliata.

---

## Le prove, e le tre rotture

**Sei controlli dentro la migrazione**, **6 prove pure** e **5 prove col token
di un utente vero** (152 pure + 229 sull'app in tutto).

🔴 **In ogni prova la preparazione e il bocconcino sono segnati «pronti per la
carta»**, ed è la condizione che rende tutto questo capace di distinguere: se
fossero respinti solo perché quel segno è spento, non si starebbe misurando il
criterio giusto — si starebbe misurando una coincidenza. *È la trappola del
caso vuoto del 17/08, letta sulla condizione invece che sui dati*, ed è
esattamente il rilievo che Alessio ha posto chiedendo il lavoro.

⚠️ **E c'è la prova al contrario**: un piatto pronto **entra**. Senza, un
trigger che rifiutasse *sempre* farebbe passare tutte le altre.

| rottura | cosa è diventato rosso |
|---|---|
| il trigger non rifiuta più niente | *«Una preparazione è entrata in un menu»* |
| il trigger guarda solo gli inserimenti, non gli aggiornamenti | *«Un piatto in carta è stato sostituito con una preparazione»* |
| il criterio della schermata elenca i tipi (`≠ preparazione`) invece di chiedere la proprietà | **4 prove pure su 6**, fra cui *«un tipo che oggi non esiste non entra da solo»* |

🔴 **La terza è quella che vale**, perché è la rottura che riproduce il difetto
appena chiuso: con un elenco di tipi da escludere, un tipo nuovo domani
comparirebbe in carta finché qualcuno non si ricorda di aggiungerlo. Con la
proprietà, no.

### 🔴 E una rottura non aveva morso il file

La seconda l'avevo lanciata con una sostituzione che **non corrispondeva a
niente**: il file restava intatto, la migrazione passava, e sembrava che il
controllo non discriminasse. *Un comando che non trova quello che cerca e
continua zitto* — la stessa forma che questi appunti inseguono da due giorni,
stavolta nel mio stesso strumento di controprova. Rifatta guardando che la
riga fosse davvero cambiata, la prova è diventata rossa.

---

## Per Alessio, in una riga

Nell'Editor Menu adesso compaiono solo i piatti che hai segnato pronti per la
carta: le preparazioni e i bocconcini spariscono da quegli elenchi, e il
gestionale li rifiuta anche se ci arrivano per un'altra strada.

---

**Commit del lavoro**: `b515309` — «In un menu ci vanno solo i piatti, e il
caso dei due prezzi non esisterà».
**Commit del mandato del registratore**: `18ee23f` — sola documentazione.
**Working tree**: pulito.
**Migrazione**: `20260820000002` — sul progetto di prova sì, in produzione
**no**, in attesa del `git push`.
