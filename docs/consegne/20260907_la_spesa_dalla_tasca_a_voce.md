# MEMO — «La mia tasca»: una spesa personale si può dettare

**07/09/2026.** Riepilogo di consegna.

* **HEAD dichiarato**: `0ddf70e` — il merge della proposta #37 su `master`.
* **Ramo**: `spec-tasca-a-voce`, aperto da `e635bf2`.
* **Migrazioni**: **una**, `20260907000002_la_spesa_dalla_tasca_si_detta`.
* **Funzione online**: `ascolta-voce`.
* **Prove**: 1.091 pure · 45 sulle schermate · 523 contro il progetto di
  prova · lint pulito · compilazione pulita.
  ⚠️ **Cinque prove restano rosse in locale e sono PREESISTENTI su
  `master`** (2 sugli indici dei documenti, 3 sulle schermate
  `rotte-chiuse` e `varco-pubblico`): rimisurate sul ramo non toccato a
  macchina ferma, e verdi su GitHub. Non dipendono da questo lavoro.

## Che cosa cambia

Il gestionale ha **tre soggetti contabili** che si somigliano abbastanza da
scambiarsi: la cassa dell'osteria, **la tasca** (contante di Alessio, solo
uscite, sempre «Indeducibile», fuori dalla proiezione fiscale, e **non torna
indietro** — 30/08) e le **anticipazioni del socio** (spese per conto della
società, che la società pareggia — 15/08).

🔴 **La voce ne conosceva uno solo**: per un movimento di cassa il gestionale
sceglieva `entity_type = 'srls'` e basta, quindi una spesa detta «di tasca
mia» finiva **nella cassa dell'osteria**, senza nessun errore e con una riga
plausibile. Adesso la voce li distingue.

## Le regole sono di Alessio, non indovinate

Le specifiche decidevano che cosa *significa* ciascun soggetto, ma **non
quali parole scelgono quale**: SPEC-0008 lo elencava fra le decisioni aperte.
Il lavoro si è fermato e ha chiesto. Le regole (07/09/2026):

1. «di tasca mia» è **sempre** la tasca;
2. «ho anticipato», «da rimborsare», «poi mi rimborso» sono le anticipazioni;
3. se non nomina né l'una né l'altro, MEMO **non sceglie**: appunto non
   approvabile che chiede quale dei due;
4. se ci sono tutt'e due, **prevale il rimborso** — non si registra mai come
   non rimborsabile una cosa che ha detto di voler recuperare.

## Che cosa fa la migrazione `20260907000002`

* aggiunge al catalogo delle azioni vocali il tipo **`spesa_tasca`**
  (`additivo` = false: due spese di denaro si approvano una per una);
* aggiunge il ramo che la scrive in `fai_azione_dettata`, scegliendo il
  **soggetto tasca** — e **rifiutando** se quel soggetto non c'è, invece di
  ripiegare sull'osteria;
* aggiunge la sua uscita a mano (`/cassa/prima-nota?soggetto=tasca`) e i
  campi precompilati.

⚠️ **Non rifà nessuna protezione della Cassa**: il divieto di entrate nella
tasca e l'obbligo di «Indeducibile» sono un trigger del database dal 30/08
(`guardia_movimenti_tasca`). Il gesto nuovo sceglie il soggetto e lascia
lavorare il guardiano che c'è già.

⚠️ **La verifica della migrazione vive in una sotto-transazione annullata**: i
movimenti di cassa sono fra le tabelle sorvegliate dal registro delle
cancellazioni, e creare-e-cancellare avrebbe lasciato lapidi finte in un
registro che nessuno può ripulire dall'app. Provata **per rottura**: mandando
la spesa della tasca sul soggetto dell'osteria diventa rossa.

## Il confine, dichiarato

Il caso «da rimborsare» **non viene registrato**: nasce un appunto non
approvabile che dice dove va — Cassa → «Anticipo io, poi mi rimborso» — e
porta lì. Registrarlo avrebbe voluto dire inventare i campi di
un'anticipazione che nessuna decisione stabilisce. La protezione chiesta resta
intera: quella spesa non finisce mai nella tasca.

## Due difetti trovati strada facendo

🔴 **Dal collaudo con l'assistente vero**: «ho pagato 30 euro di tasca mia per
il pane» finiva sull'anticipo. Misurato invece che dedotto — il modello aveva
dichiarato benissimo `soldi: "di tasca mia"`, e poi aveva scritto **di suo**
il riassunto *«Uscita di 30€ per il pane (anticipati di tasca sua)»*, che la
regola leggeva. Ora **il fatto dichiarato decide da solo**; il dettato serve
da rete solo quando il modello non dichiara niente. *Un riassunto scritto da
chi interpreta non è una fonte: è già un'interpretazione.*
⚠️ E con esso è emersa una contraddizione dentro gli elenchi stessi: «senza
rimborso» contiene «rimborso», quindi finiva fra le cose da farsi ridare. Ora
le negazioni si guardano per prime.

🔴 **Un difetto latente nella via d'uscita a mano**: l'indirizzo si costruiva
sempre con un `?`, e la tasca ne porta già uno. Con due il browser non dà
errore — il secondo parametro finisce dentro il valore del primo — e la
schermata si apre **senza niente di precompilato**. Corretto in un posto solo
(`indirizzoAMano`), con la sua prova.

## Il collaudo, fatto guardando

Cinque frasi dettate sul progetto di prova, con l'assistente vero:

| frase | dove finisce |
|---|---|
| «Ho comprato il detersivo di tasca mia, 12 euro» | **Spesa dalla mia tasca**, approvabile |
| «Ho pagato 30 euro di tasca mia per il pane» | **Spesa dalla mia tasca**, approvabile |
| «Ho anticipato 20 euro per il pane, poi mi rimborso» | **Anticipo**, non approvabile |
| «Ho comprato il detersivo con soldi miei» | **«Questi soldi tornano indietro?»**, non approvabile |
| «Ho pagato 30 euro al fornitore» | **Movimento di cassa**, come sempre |

Approvando la prima: **12 € sulla tasca, uscita, con la regola di
deducibilità messa dal trigger, e zero movimenti sull'osteria.**

## Cosa abbiamo rovesciato

**Niente.** Il significato dei tre soggetti resta quello deciso il 15/08 e il
30/08. Quello che cambia è che la voce, che ne conosceva uno, adesso li
distingue — e quando non si capisce **non sceglie**, che è la regola già in
vigore per le due liste della spesa.

## Cosa NON è verificato

1. **Nessun occhio ha guardato una schermata**: l'appunto e la Prima nota
   precompilata sono provati dal codice, non visti.
2. **Il modello è provato su cinque frasi.** Che capisca tutte le
   formulazioni possibili non lo dimostra nessuna prova; quello che è
   dimostrato è che, qualunque cosa dichiari, sono **le parole di Alessio** a
   decidere il soggetto.
3. **Gli elenchi di parole invecchiano**, ed è dichiarato: un sinonimo che
   manca non manda i soldi nel posto sbagliato — lascia un appunto che non si
   può approvare, o un movimento della cassa come prima.
4. **La revisione esterna del diff non è stata fatta**: lo strumento
   (`codex`) non è installato su questa macchina.
