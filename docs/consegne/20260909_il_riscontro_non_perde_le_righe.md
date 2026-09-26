# Il riscontro dopo aver parlato non perde più le righe

**09/09/2026.** Riepilogo di consegna.

* **HEAD dichiarato**: `aa7ae00` — l'unico commit di lavoro del ramo, aperto
  da `fdfea8d` (la cima di `master`).
* **Ramo**: `riscontro-non-approvabili`. **Separato dalla #42**, per decisione
  di Alessio: il difetto è del riscontro immediato, non dell'Agenda.
* **Migrazioni**: **una**, `20260909000001_il_riscontro_non_perde_le_righe`.
  **Applicata solo a Borgo58-Prova** (381 migrazioni registrate lì).
  In produzione non è stato applicato niente.
* **Funzioni online**: nessuna installata. Sul progetto di prova
  `ascolta-voce` resta alla v30 messa il 08/09 dalla #42; in produzione resta
  alla v9.
* **Prove**: 1.197 pure · 59 sulle schermate · **557 contro il progetto di
  prova, tutte verdi** · lint pulito · compilazione pulita.
  ⚠️ **Cinque prove restano rosse in locale e sono PREESISTENTI su `master`**
  (2 sugli indici dei documenti, 3 sulle schermate `rotte-chiuse` e
  `varco-pubblico`): non dipendono da questo lavoro e sono verdi in CI.
* **Chiamate live al modello**: **2**, per **0,199 €**, sul progetto di prova.

## Il fatto

L'08/09 Alessio ha collaudato la #42 dal telefono. Due frasi su sei hanno
risposto **«Non ho capito niente di quello che hai detto»**:

* «Segna come fatto il rinnovo della firma digitale»
* «Sposta a venerdì l'ordine delle verdure»

🔴 **L'assistente aveva capito benissimo tutt'e due.** Le righe erano in
`azioni_dettate` col tipo giusto, il titolo giusto, il giorno nuovo giusto e
il loro motivo. Nella stessa sessione «Quanto ho in cassa?» ha risposto
correttamente, quindi non c'entravano credito, rete né assistente
indisponibile.

| frase | righe scritte | righe che la schermata riceveva |
|---|---|---|
| «Segna come fatto…» | 1 | **0** |
| «Sposta a venerdì…» | 1 | **0** |
| «Ricordami di chiamare Tiziana» | 1 | 1 |

## La causa: una congiunzione interna

`azioni_della_dettatura` è la porta da cui `Detta.jsx` chiede «cosa hai
appena capito», subito dopo che si è finito di parlare. Legava ogni riga al
catalogo delle destinazioni con `join tipi_azione_vocale`.

🔴 **Una destinazione che nel catalogo non c'è non fa fallire la query: fa
sparire la riga**, senza nessun errore. Il conteggio arrivava a zero, e con
zero il gestionale scrive la frase più severa che ha.

⚠️ È la famiglia già scritta in CLAUDE.md §8 — *una risposta più corta che ha
l'aria di essere intera* — in un posto nuovo. Il sesto esemplare.

## Era già stato curato a metà, e questa è la parte che conta

Il **06/09** la migrazione `20260906000001` ha fatto due cose giuste:

1. ha **tolto la chiave esterna** su `azioni_dettate.tipo`, apposta — SPEC-0013
   vuole che una destinazione che il gestionale non sa eseguire resti scritta
   invece di diventare «non ho capito»;
2. ha rifatto **`azioni_dettate_in_attesa`** con la congiunzione **esterna** e
   `destinazione_vocale(tipo, destinazione_libera)`.

🔴 **Non è tornata su `azioni_della_dettatura`**, che dal 27/08 non veniva più
toccata. Da quel giorno i due elenchi dicono cose **diverse della stessa
riga**: quello delle cose in attesa la mostra, quello del riscontro immediato
la fa sparire. *Due letture della stessa cosa che si contraddicono sono un
difetto anche quando una delle due è giusta.*

## Quanto è largo — misurato, non dedotto

Sul progetto di prova ci sono **sei** destinazioni fuori catalogo con almeno
una riga scritta, e **tutte e sei** sparivano dal riscontro immediato:

| destinazione | da quale lavoro | come si chiama a schermo |
|---|---|---|
| `agenda_da_segnare_fatto` | Agenda (08/09) | Da segnare fatto in Agenda |
| `agenda_da_spostare` | Agenda (08/09) | Da spostare in Agenda |
| `soldi_di_chi` | la tasca (07/09) | Questi soldi tornano indietro? |
| `anticipazione_da_registrare` | la tasca (07/09) | Anticipo io, poi mi rimborso |
| `lista_non_detta` | le liste (06/09) | Quale delle due liste? |
| `lista_nominata_spesa_spicciola` | le liste (06/09) | Aggiungi a «spesa spicciola» |

🔴 **Non è un difetto dell'Agenda**: è del riscontro, e tocca anche i due
lavori consegnati prima. Una spesa detta «di tasca mia» senza dire di chi
sono i soldi avrebbe risposto «non ho capito niente» allo stesso modo, e non
lo sapeva nessuno.

## Che cosa fa la migrazione

Riscrive `azioni_della_dettatura` **dal corpo vivo del progetto di prova**
(regola del 18/08: fra il file che l'ha creata e il database ci stanno tutte
le migrazioni che l'hanno toccata). Rispetto a quel corpo cambiano **tre cose
e basta**:

* la congiunzione col catalogo diventa **esterna**;
* il titolo passa da `t.titolo` a `destinazione_vocale(a.tipo,
  a.destinazione_libera)` — ⚠️ **la stessa fonte dell'elenco gemello**, non una
  seconda regola scritta accanto: copiarla vorrebbe dire che il giorno che
  cambia i due elenchi ricominciano a divergere, che è il difetto che si sta
  chiudendo;
* la natura prende `coalesce(t.natura, 'libera')`.

⚠️ **`create or replace` e non `drop`**: la forma del risultato non cambia di
una colonna, e dopo un `drop` i permessi tornerebbero aperti al mondo
(lezione del 13/08).

⚠️ **NON RENDE APPROVABILE NIENTE.** Se una cosa si possa approvare lo dice
`appunti_vocali.eseguibile`, che il database ricava dal catalogo per un'altra
strada. Misurato sui due appunti veri di Alessio: erano `false` prima e sono
`false` adesso. Qui cambia soltanto **se la riga arriva a chi guarda**.

## La verifica discrimina, e lo dimostrano due rotture

Provata **estraendo il solo blocco di verifica** e rompendo la funzione — non
riapplicando la migrazione, che con `create or replace` curerebbe da sé la
rottura prima di verificarla (lezione del 26/08):

| rottura rimessa | cosa ha detto la verifica |
|---|---|
| congiunzione interna | «Il riscontro perde le righe: scritte 2, ricevute 1» |
| natura forzata a «libera» | «Il promemoria ha perso la natura del catalogo: libera» |

Due rotture, **due errori diversi e tutt'e due giusti**: è così che si vede
che una verifica discrimina invece di limitarsi a passare. La seconda esiste
perché una cura che mostrasse la destinazione dichiarata per *tutte* le righe
passerebbe la prima e cambierebbe il nome delle quattordici destinazioni
normali.

## Perché le prove dell'08/09 erano tutte verdi

🔴 **Nessuna delle tre chiedeva quello che chiede il telefono.**

* le prove **pure** controllano la regola che decide, e quella era giusta;
* le prove **sulle schermate** costruivano l'appunto a mano e guardavano come
  si disegna: hanno dimostrato che si disegna bene, mai che arriva;
* le prove **contro il database** leggevano la riga **dalla tabella**, con una
  porta di servizio: la riga c'era, quindi passavano;
* e le **cinque dettature dal vivo** leggevano dalla tabella allo stesso modo,
  quindi hanno confermato la stessa cosa una sesta volta.

⚠️ È la lezione già pagata tre volte in questo progetto — le mance (16/08), i
coperti (18/08), la traduzione dei rifiuti (25/08): *una prova che entra da
una porta sua non prova il tratto fra schermata e database.*

**La prova nuova entra dalla porta della schermata** e confronta due numeri:
le righe scritte e le righe ricevute. L'ultima è una **proprietà e non un
elenco** — chiede al database quali destinazioni fuori catalogo hanno righe
scritte e pretende, per ognuna, che i due numeri coincidano. Un elenco dei sei
nomi trovati oggi sarebbe scaduto al primo tipo nuovo.

## Il collaudo, rifatto

**Sulle dettature vere di Alessio**, senza spendere una chiamata: le stesse
righe di ieri, richieste dalla porta della schermata, adesso arrivano tutte.

| frase detta col telefono l'08/09 | scritte | ricevute | il telefono adesso legge |
|---|---|---|---|
| «Segna come fatto il rinnovo della firma digitale» | 1 | **1** | «Una cosa da guardare prima di scriverla.» |
| «Sposta a venerdì l'ordine delle verdure» | 1 | **1** | «Una cosa da guardare prima di scriverla.» |
| «Sposta venerdì l'ordine delle verdure» | 1 | **1** | idem |
| «Ricordami di chiamare Tiziana domani» | 1 | 1 | idem |
| «Aggiungi il rinnovo della firma digitale per venerdì» | 1 | 1 | idem |

E **tutte e sei** le destinazioni fuori catalogo arrivano col loro nome in
italiano (tabella sopra).

**Due dettature nuove dal vivo**, lette dalla porta della schermata:

* «Segna come fatto il rinnovo della firma digitale» → 1 riga, «Da segnare
  fatto in Agenda», appunto **non approvabile**, col motivo e il collegamento
  all'Agenda;
* «Sposta a venerdì l'ordine delle verdure» → 1 riga, «Da spostare in
  Agenda», giorno nuovo **11/09**, appunto **non approvabile**.

Le righe di prova sono state cancellate, per identificativo.

⚠️ **Un caso da non fraintendere**: la dettatura «Quanto ho in cassa» risulta
con zero righe anche adesso, ed è giusto — era una **domanda**, quindi non
produce nessuna azione e la schermata prende un'altra strada prima di
arrivare a quella frase.

## Cosa abbiamo rovesciato

**Niente.** La decisione del 06/09 — *una destinazione che il gestionale non
sa eseguire resta scritta invece di diventare «non ho capito»* — non si tocca:
si applica anche al secondo dei due elenchi, dove era rimasta fuori. Nessuna
riga in `docs/decisioni_rovesciate.md`.

## Cosa NON è verificato

1. **Nessun occhio ha guardato la schermata dopo la correzione**: quello che è
   misurato è il numero di righe che la schermata riceve, non come le disegna.
   Il collaudo col telefono resta da fare ad Alessio.
2. **In produzione non è stato applicato niente**: la migrazione è solo sulla
   prova, e il gestionale vero ha ancora il difetto.
3. **L'ordine fra le due proposte conta ed è dichiarato**: questo ramo parte da
   `master` e non contiene il lavoro dell'Agenda; la #42 contiene l'Agenda e
   non questa correzione. Unite tutt'e due, master le ha entrambe — ma **la
   #42 da sola metterebbe in produzione due frasi che rispondono «non ho
   capito niente»**.
4. **Non è stato cercato se altre letture del gestionale hanno la stessa
   forma**: qui sono state guardate le due dell'elenco vocale. Se ne esistano
   altrove non lo dice nessuna misura di questa consegna.
