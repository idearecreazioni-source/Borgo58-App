# Le tre falle della voce, il guardiano che guardava altrove, e il setaccio dei residui

**26/08/2026** · mandato «modulo VOCE» · sei blocchi, tutti aperti e chiusi.

- **HEAD dichiarato**: `29c3797f291ac91c549f5a8af84c5555aefb9782`
- **Working tree**: pulito al momento della scrittura di questo riepilogo.
- **Migrazioni**: repository **264**, progetto di prova **264**, produzione
  **260**. Le quattro di scarto — `20260826000007`, `20260826000008`,
  `20260826000009`, `20260826000010` — sono **IN ATTESA del push**: in questo
  mandato non è stato applicato niente al gestionale vero, per decisione
  esplicita del mandato (nessuno era sveglio per dare il via libera).

---

## 0. Le premesse del mandato, rifatte una per una

Tutte e sette misurate di nuovo sul gestionale **vero**, coi corpi letti dal
database con `pg_get_functiondef`. **Nessuna è caduta.** Una era formulata più
stretta del vero, e va detto.

| | esito | come |
|---|---|---|
| **P1** — due funzioni del modulo aperte ad `anon` | ✅ confermata | `proacl` di `voce_apri_sessione` e `registra_dettatura_da_chiave` contiene `anon=X/postgres` |
| **P2** — il freno vive solo in `voce_apri_sessione` | ✅ confermata | corpo vivo di entrambe, letto per intero |
| **P3** — `ultimo_uso`/`usi` li scrive solo la prima | ✅ confermata | idem |
| **P4** — l'identificativo già scritto non viene verificato | ✅ confermata | corpo vivo di `voce_risolvi_dati` |
| **P5** — `impostazioni_ai` non dice chi | ✅ confermata alla cifra | 4 colonne; `tetto_mensile_euro` = 10.00, `aggiornato_il` = 2026-08-26 14:23:22.450342+00 |
| **P6** — zero righe nate oggi nelle tabelle marcate | ✅ confermata | 82 tabelle con `creato_il`/`created_at`, **0** righe con data di oggi; 39 senza marca |
| **P7** — il residuo nato da una variabile riusata | ✅ confermata | `20260826000006` in produzione, `dettature` = 0 righe |

⚠️ **La correzione su P1.** Il mandato dice *«tutte le altre del modulo sono
solo `postgres`»*. Vero per le tre nominate (`scrivi_dettatura`,
`fai_azione_dettata`, `voce_risolvi_dati`), **non** per le altre quattro del
modulo: `azione_si_esegue_da_se`, `azioni_dettate_in_attesa`, `voce_catalogo` e
`voce_da_guardare` hanno anche `authenticated`, perché le chiama l'app. Non è
una falla — è che l'affermazione, presa alla lettera, è più larga del suo
perimetro.

⚠️ **Il misuratore usato per P6 è stato provato prima su una risposta nota.**
Il conteggio dinamico via `query_to_xml` è stato confrontato con la query
diretta su `applied_migrations`: **260 / 260** e **13 / 13** applicate oggi.
Senza quel confronto, uno zero non sarebbe stato una risposta.

---

## 1. Il freno sta anche sulla porta che scrive — `20260826000007`

**Il difetto.** Chi ha la chiave può chiamare `registra_dettatura_da_chiave`
dritta via PostgREST (la chiave anonima è pubblica per costruzione: sta nel
sito), in ciclo, **senza limite**, passando `p_azioni` costruite a mano — cioè
far eseguire qualunque azione di natura `misura` senza che nessun modello sia
mai stato consultato, e **senza lasciare traccia sulla chiave**.

**La cura, in quattro punti.**

1. Il criterio vive in **una funzione sola**, `voce_limite_dettature(uuid)`,
   che entrambe le porte **domandano** invece di riscrivere — stessa forma di
   `azione_si_esegue_da_se`.
2. La soglia resta **60 in un'ora**, scritta una volta come costante dentro
   quella funzione, e **restituita** insieme alla risposta: chi guarda il
   risultato vede il numero senza leggere il codice. Non è finita in una
   tabella di impostazioni apposta — non è una decisione di gestione del
   locale come gli orari, è un freno anti-abuso, e un freno che si alza da una
   schermata è un freno in meno.
3. Anche **la frase del rifiuto** esce da lì: due porte che rifiutano con due
   frasi diverse sono due porte che si distinguono da fuori.
4. `usi` smette di mentire **senza sdoppiare il proprio significato**: adesso
   vale «quante volte la chiave è stata usata, da qualunque porta», e le
   dettature vere si contano in una colonna nuova, `scritture`.

⚠️ **`scritture` nasce VUOTA per le chiavi già esistenti** (nullable, con
`default 0` solo per le nuove). Un `default 0` avrebbe scritto «non ha mai
scritto niente» al posto di chi non ha risposto — regola del 14/08. Misurato
prima: `chiavi_voce` ha **zero righe** in produzione e sulla prova, quindi oggi
la distinzione non cambia nessun dato; la forma resta quella giusta.

⚠️ **Il punto 4 del mandato era già soddisfatto e lo dichiaro invece di
prendermene il merito**: `registra_dettatura_da_chiave` diceva già «Questa
chiave non vale.», identica all'altra porta. La verifica lo **prova**
confrontando le due frasi invece di fidarsi.

### Come si giudica — dai fallimenti

Verifica dentro la migrazione, con una chiave vera costruita per l'occasione.
Valori **prima e dopo**, non conclusioni:

```
chiave dopo una scrittura: usi 0 -> 1, ultimo_uso (vuoto) -> 2026-08-26 14:49:36.644328+00, scritture 1
la 61 e' stata rifiutata: Sono gia' arrivate 60 dettature nell'ultima ora da questa strada:
  mi fermo. Se non sei stato tu, togli la chiave dal gestionale.
revocata e inesistente dicono la stessa cosa: «Questa chiave non vale.»
freno: create 60 dettature e 2 chiavi, tolte tutte. dettature 0 -> 0, chiavi 0 -> 0
```

🔴 **E LA PRIMA CONTROPROVA NON HA PROVATO NIENTE.** Rotta la funzione e
rilanciato `npm run prova:migra`, la verifica è rimasta **verde**: la
migrazione **rimette a posto la funzione buona prima di verificarla**. È la
ricomparsa della lezione del 19/08 in una forma nuova, e vale per ogni
migrazione idempotente. Estratto il **solo blocco di verifica**, le due
rotture danno due errori diversi e giusti:

| rottura | cosa dice la verifica |
|---|---|
| tolta la traccia sulla chiave | `Dopo una scrittura «usi» doveva passare da 0 a 1, e vale 0` |
| tolto solo il freno | `La porta che scrive ha accettato la dettatura numero 61 con il tetto a 60.` |

Dopo le rotture: `dettature` 0, `azioni_dettate` 0, `chiavi_voce` 0.

⚠️ **La rete delle guardie è diventata rossa e aveva ragione**: segnalava che
`voce_apri_sessione` perdeva la soglia e la parola «scorciatoia». Non
spariscono, **si spostano**: dichiarato con `rete-guardie:` e provato dalla
verifica, che il rifiuto alla sessantunesima lo esercita con la frase vera.

⚠️ **Corretto un commento della funzione online** `ascolta-voce`: diceva «il
freno vive dentro `voce_apri_sessione`», che era vero e insufficiente.

---

## 2. Un identificativo che non esiste si dice — `20260826000008`

**Il difetto.** Quando `ingredient_id` / `equipment_id` / `task_id` arriva già
scritto, `voce_risolvi_dati` lo prendeva così com'era. L'azione arrivava fino
in fondo e moriva con l'errore tecnico della funzione sottostante —
**misurato**, rimettendo la funzione com'era e rifacendo il giro:

```
COM ERA PRIMA -> stato: fallita | errore: Giacenza insufficiente: disponibili 0, richiesti 2
```

cioè una frase sulla giacenza di un prodotto che non esiste, che manda a
cercare la cosa sbagliata — e un'azione `fallita`, cioè **fuori dagli occhi di
Alessio**, mentre il modulo ha già la strada giusta.

**La cura.** Verificata l'esistenza della riga, l'identificativo che non punta
a niente **si toglie dai dati** (se restasse, chi conferma domani ricadrebbe
nell'errore) e la riga finisce **in attesa**, `sicuro` decaduto a falso, con
una frase in italiano. È l'estensione al caso non coperto della decisione di
Alessio del 26/08 in `DECISIONI.md`.

**Le tre frasi vere**, come le legge chi guarda:

- «Il prodotto che mi avevi indicato non c'e' piu' fra quelli del gestionale: dimmi tu qual e'.»
- «Il frigo che mi avevi indicato non c'e' piu': dimmelo e la scrivo.»
- «La pulizia che mi avevi indicato non c'e' piu' nel piano.»

E il giro intero: `stato in_attesa`, con quel motivo accanto.

⚠️ **Si guarda che la riga ESISTA, non che sia attiva.** Una temperatura
misurata su un frigo poi disattivato è una misura vera: buttarla via sarebbe
peggio che scriverla. La strada del **numero** continua a guardare i soli
attivi, ed è giusto — lì si sta scegliendo adesso.

⚠️ **Un caso «buono» è provato insieme ai tre cattivi**: un frigo vero deve
ancora passare. Senza, un controllo che rifiuta tutto sembrerebbe funzionare
benissimo.

**Controprova**: tolti i tre rami, la verifica diventa rossa —
`Un prodotto inventato e' passato senza che niente mancasse: {"dati": {...}, "manca": null}`.

🔴 **E un mio errore di misura, corretto**: la prima volta ho scritto la
quantità come `quanto` invece di `quantita`, e ho ottenuto «La quantità deve
essere maggiore di zero» — un errore vero, **di un altro caso**, che si ferma
prima del punto in esame. La verifica ora usa il nome vero del campo, con la
ragione scritta accanto.

---

## 3. Chi ha toccato il tetto della spesa — `20260826000009`

Tre colonne nuove su `impostazioni_ai`: `tetto_da`, `tetto_il`,
`sbloccato_da`. Le scrivono `imposta_tetto_ai` e `sblocca_spesa_ai`, chiedendo
`auth.uid()` invece di dedurlo.

🔴 **Il valore attuale NON è stato attribuito a nessuno**, ed è il punto del
blocco. In produzione il tetto vale 10,00 ed è stato scritto il **26/08 alle
14:23:22 UTC da una migrazione**, mentre Alessio era lontano dal gestionale.
Scriverci sopra il suo nome perché è il nome plausibile sarebbe esattamente il
difetto che questo blocco esiste per togliere: *una riga che dichiara un
autore che non ha fatto quel gesto è peggio di una riga senza autore, perché
la prima la si crede.*

Il primo controllo della verifica è **su questo**: se qualcuno un giorno
«sistemasse» la riga scrivendoci un nome, diventa rosso.

⚠️ **`tetto_il` esiste separata da `aggiornato_il`** perché quella riga cambia
per **due gesti diversi**: con una colonna sola, uno sblocco farebbe sembrare
toccato anche il tetto. È la stessa forma di `usi`, e non se ne apre un
secondo caso. Un controllo dedicato verifica che lo sblocco non sposti
l'istante del tetto.

⚠️ **La riga non si cancella: si salva INTERA e si riscrive INTERA** — è una
riga vera e singleton. Il confronto finale è `v_torna is distinct from
v_prima` sull'intero record, non colonna per colonna a memoria.

```
il tetto di adesso vale 10.00 e resta senza autore, com'e' giusto
tetto: chi passa da (vuoto) a 86328c11-…, quando da (vuoto) a 2026-08-26 14:56:26.862057+00
sblocco: chi 86328c11-…, quando 2026-08-26
impostazioni_ai rimessa identica: tetto 10.00, sbloccato (mai), chi (vuoto)
```

⚠️ **Non è stata toccata nessuna schermata**: la traccia oggi si scrive e non
si mostra. Vedi la domanda 3 in fondo.

---

## 4. Il guardiano guarda le righe, non le lapidi — `20260826000010`

**Quanto è grande il buco, misurato e non stimato:** le tabelle di `public`
sono **119**, quelle col trigger che scrive nel registro delle cancellazioni
**21**. Sulle altre **98** un controllo che conta le lapidi risponde «zero» che
ci sia un residuo o che non ci sia.

⚠️ **Le 21 non sono un elenco sbagliato**: sono le tabelle di soldi, fisco,
lavoro e documenti, scelte apposta l'08/08. Il difetto è che *un controllo dei
residui si appoggiava a un registro fatto per un'altra domanda.*

**Il guardiano nuovo**: `foto_righe()` all'inizio, `pretendi_nessun_residuo(foto, dove)`
alla fine. Confronta **tutte** le tabelle, cammina sull'**unione** delle due
fotografie (una tabella nata o sparita nel frattempo non passa in silenzio), e
**nomina tutte insieme** quelle che non tornano.

⚠️ **Il limite, dichiarato perché conta più della cura**: conta le righe, quindi
non vede due righe che si compensano né una riga **modificata** e lasciata
modificata — che è successo davvero il 14/08. Per quella la regola resta
salvare la riga intera e riscriverla intera. Questo guardiano non la
sostituisce e non finge di farlo.

✅ **Provato su un caso di cui conoscevo già la risposta**, come chiede il
mandato — un guardiano che risponde «zero» al primo colpo non ha ancora detto
niente:

```
tabelle di public: 119, non tracciate: 98
col residuo il guardiano dice: la prova del guardiano ha lasciato 1 tabelle diverse
  da come le ha trovate — dettature: erano 0, sono 1 (+1)
con lo stesso residuo davanti, le lapidi sono 2525 prima e 2525 dopo: il guardiano vecchio tace
tolto il residuo, il guardiano tace
```

La riga centrale è **la dimostrazione del buco**, non un ragionamento su di
esso. E l'ultima serve quanto le altre: un guardiano che grida sempre viene
spento.

⚠️ **Il controllo vecchio non si toglie**: sulle 21 tracciate dice una cosa in
più — che la verifica non ha cancellato per sbaglio un dato vero. Si affianca.
Rovesciamento n. 55.

---

## 5. Le 39 tabelle senza marca temporale — il setaccio che il validatore non può fare

**39 esatte**, come diceva la premessa. Dal connettore non si distingue una
riga nata oggi da una di luglio; contate e **guardate dentro** una per una.
**Nessuna riga inspiegabile.**

**Configurazione e cataloghi (11)** — righe che il gestionale si porta dietro
per costruzione: `applied_migrations` 260 · `vincoli_muti_noti` 155 (tutte
congelate insieme il 25/08 alle 07:06, su 70 tabelle) · `service_hours` 14 (7
giorni × 2 servizi) · `tipi_azione_vocale` 11 (le 11 azioni del modulo voce) ·
`lavori_sorvegliati` 5 · `costo_modello_ai` 2 (`claude-sonnet-5`,
`claude-haiku-4-5-20251001`) · `fiscal_settings` 1 · `impostazioni_ai` 1 ·
`service_settings` 1.

**Dati di Alessio e loro figlie (9)** — `disposizioni_giornaliere` 14 (3
giornate: 18, 19 e 23 agosto) · `menu_items` 14 (l'unico menu, **0** righe che
puntano a ricette inesistenti) · `scenario_costi_fissi` 15 ·
`scenario_mesi` 12 · `scenario_risultati` 12 · `scenario_linee_accessorie` 4 ·
`scenario_personale` 4 · `scenario_extra` 3 — tutte figlie di **un solo**
scenario (verificato: `count(distinct scenario_id)` = 1 su tutte e tre le
principali).

**Registri che si riempiono da soli (3)** — `recipe_status_history` 28 (14
ricette distinte, tutte scritte il 21/08 fra le 22:23:41 e le 22:23:46, cioè
in blocco al caricamento) · `privacy_pulizie` 15 (una al giorno alle 04:30 dal
12/08 al 26/08 — **15 giorni esatti** — con 0 richieste cancellate) ·
`stato_lavori` 5 (i cinque lavori sorvegliati, ultimo battito 26/08 14:55).

**Vuote (19)** — `avvisi_rimandati`, `chiamate_turno`, `chiavi_voce`,
`consuntivi_mensili`, `correzioni_coperti`, `deleted_records`, `email_inviate`,
`impostazioni_tesoreria`, `preventivo_fogli`, `preventivo_righe`,
`price_history`, `recipe_ingredients`, `recipe_steps`, `scelte_allergene`,
`segnalazioni_fiscali`, `storico_costi_ricetta`, `tip_distribution_lines`,
`tip_distributions`, `trasformazioni_dichiarate`.

⚠️ **`deleted_records` a zero in produzione** è coerente col reset dichiarato
in `DECISIONI.md` (25/08): magazzino a zero, nessuna lapide.
⚠️ **`recipe_ingredients` a zero con 14 ricette**: le ricette esistono senza i
loro ingredienti. Coerente con l'ordine di caricamento deciso da Alessio
(«prima le ricette, poi i prodotti»), ma è la riga che merita un'occhiata sua —
domanda 4.

---

## 6. Come fallisce il modulo voce — collaudo sul progetto di prova

Frasi **vere**, lette dal database, non parafrasate.

| caso | esito |
|---|---|
| movimento di cassa con `sicuro = true` | `in_attesa`, **0 eseguite su 1** — «Questa la guardi sempre tu prima che venga scritta.» ⚠️ Il modello *dichiara* la sicurezza e il gestionale la **ignora** per le `creazione`: è il patto che regge il modulo, e regge |
| temperatura senza il frigo | `in_attesa`, `sicuro` decaduto a falso — «Non hai detto quale frigo: dimmelo e la scrivo.» |
| ricetta dettata | `in_attesa` — «Questa la guardi sempre tu prima che venga scritta.» |
| modello fuori dal listino | la dettatura **passa**, costo 0, `nel_listino: false`, e avvisa: «Il costo di questa dettatura non e' stato conteggiato: il modello «modello-che-non-esiste» non e' nel listino. Va aggiunto, altrimenti la spesa del mese risulta piu' bassa del vero.» |
| cinque cose, la terza fallisce | **5 azioni, 3 eseguite, 2 da guardare**: 1) promemoria *eseguita* · 2) nota non capita *eseguita* · 3) merce buttata **fallita** → «Giacenza insufficiente: disponibili 6.0000, richiesti 1000» · 4) promemoria *eseguita* · 5) ricetta *in attesa*. **Le altre quattro restano buone.** |
| tetto raggiunto | `blocca = true` — «…le letture sono ferme. Le schede si compilano a mano come sempre, oppure si sblocca da qui.» |
| tetto raggiunto e sbloccato oggi | `blocca = false` — «…ma e' stata sbloccata: le letture continuano.» |
| sblocco del mese scorso | `blocca = true` — non vale più |

**Residui del collaudo, chiesti al guardiano nuovo**: nessuno. Tolte 6
dettature e 3 impegni, la riga del tetto rimessa identica.

---

## Cosa abbiamo rovesciato

**Due**, tutti e due registrati in [`docs/decisioni_rovesciate.md`](../decisioni_rovesciate.md).

**n. 54 — «il freno anti-abuso sta sulla porta d'ingresso»** (deciso il 26/08
con la nascita del modulo). *Ragione di allora*: una sola porta da
sorvegliare, e la si attraversa per prima. *Adesso*: il criterio vive in una
funzione che entrambe le porte domandano. *Perché non vale più*: le porte sono
**due**, e la seconda è quella che agisce. La ragione era vera per chi usa il
gestionale come previsto — ed è precisamente chi non conta.

**n. 55 — «una verifica dimostra di essersi ripulita contando le lapidi»**
(16/08). *Ragione di allora*: un controllo che è una proprietà e non una
quantità. *Adesso*: si affianca il confronto delle righe di tutte le tabelle.
*Perché non vale più — e per cosa vale ancora*: ⚠️ **vale ancora intera** sulle
21 tracciate, dove dice una cosa in più, e **non si toglie**. Non vale più che
sia **sufficiente**: sulle altre 98 risponde «zero» comunque.

**Nessuna decisione di Alessio è stata rovesciata.**

---

## Voci di `docs/DECISIONI.md` toccate

Lette prima di lavorare, **nessuna contraddetta**:

- *Assistente — voce*, 25/08: «Il punto che riceve l'audio va protetto con una
  CHIAVE dal primo giorno» → il Blocco 1 la **rafforza**.
- *Assistente — voce*, 25/08: criterio salva-da-sé **misura contro creazione**
  → verificato intatto dal Blocco 6, non toccato.
- *Assistente — voce*, 25/08: «Le temperature si scrivono solo se dice anche
  QUALE frigo» → il Blocco 2 la estende al caso dell'identificativo morto.
- *Assistente — voce*, 26/08: «quando non trova il prodotto nominato mette
  QUELLA RIGA da parte» → il Blocco 2 la **estende** al caso non coperto: la
  riga si mette da parte anche quando a mancare non è il nome ma la riga.
- *Prodotti, ingredienti e prezzi*, 25/08: il reset prima dell'uso vero →
  usata per spiegare `deleted_records` a zero nel Blocco 5.

---

## Rilettura obbligatoria

**Cosa NON ho verificato con gli occhi.** Nessuna schermata è stata aperta:
tutto questo mandato vive nel database e in una riga di commento della
funzione online. In particolare **non ho visto** come appare in Dashboard
un'azione messa in attesa dal Blocco 2, né la schermata del tetto dopo il
Blocco 3. **La Scorciatoia dall'orologio non è mai stata provata da me**: il
Blocco 1 è provato chiamando le funzioni del database, non passando dalla
funzione online né dal telefono.

**Cosa ho contato senza leggerlo.** Le **21** tabelle tracciate: ho contato i
trigger che nominano `log_deleted_record`, non ho letto il corpo di ciascuno
per verificare che facciano davvero quello che il nome dice. Le **11** azioni
di `tipi_azione_vocale` e i **5** lavori sorvegliati: elencati per nome, non
esercitati uno per uno (il Blocco 6 ne esercita 6 su 11).

**Quali mie affermazioni sono diventate false mentre lavoravo.** Tre.
(a) «Con un identificativo inventato l'errore è *La quantità deve essere
maggiore di zero*» — falsa, era colpa del mio campo sbagliato; corretta e
rimisurata. (b) Il commento della funzione online «il freno vive dentro
`voce_apri_sessione`» era vero all'inizio del mandato ed è falso alla fine:
corretto nel file. (c) «La controprova del Blocco 1 dimostra che la verifica
discrimina» — falsa per venti minuti, finché non ho estratto il solo blocco di
verifica.

**Quali blocchi non ho aperto.** Nessuno: tutti e sei aperti e chiusi.

**Quali conteggi sono pavimenti e non totali.** Il **6 su 11** delle azioni
vocali esercitate nel Blocco 6 è un pavimento. Le **98** tabelle non tracciate
e le **39** senza marca temporale sono **totali**, ricavati dal catalogo. I
**60** del freno sono la soglia, non una misura.

**Migrazioni in attesa per la produzione**, in ordine:

1. `20260826000007_il_freno_sta_anche_sulla_porta_che_scrive`
2. `20260826000008_un_identificativo_che_non_esiste_si_dice`
3. `20260826000009_chi_ha_toccato_il_tetto_della_spesa`
4. `20260826000010_il_guardiano_guarda_le_righe_non_le_lapidi`

⚠️ **Le prime tre riscrivono funzioni con `create or replace` e le loro
verifiche scrivono e cancellano righe proprie.** La 007 crea e toglie **60
dettature e 2 chiavi**; la 008 una dettatura; la 009 **non crea niente** e
rimette la riga di `impostazioni_ai` identica; la 010 crea e toglie una
dettatura. Tutte contano le righe prima e dopo e si fermano se non tornano.

**Lezioni nuove nel file delle trappole** (`CLAUDE.md` §8), cinque:
due porte che portano allo stesso posto · un contatore che mente stando fermo ·
una controprova che riapplica la migrazione · il guardiano che conta le lapidi
su 98 tabelle · la dichiarazione `rete-portieri:` che tace se malformata ·
riprodurre un errore coi nomi veri dei campi.

---

## Domande per Alessio

1. **La schermata del tetto di spesa deve mostrare chi l'ha toccato?** Oggi il
   gestionale lo *scrive* e non lo *fa vedere*, e in questo progetto un dato
   scritto che nessuno può vedere è indistinguibile da un dato non scritto.
   **Raccomandazione: sì**, ma una riga sola sotto il tetto — «messo da te il
   26/08» — non un registro. Se dici no, resta scritto e utile solo il giorno
   che qualcuno lo va a cercare nel database.
2. **Il numero 60 va bene com'è?** È il limite di quante volte in un'ora la
   Scorciatoia può mandare qualcosa al gestionale. Sessanta vuol dire una al
   minuto per un'ora intera. **Raccomandazione: lasciarlo**, e riguardarlo dopo
   che l'avrai usato per qualche giorno vero — se dovesse mai fermarti, il
   messaggio te lo dice chiaramente.
3. **Quando provi la Scorciatoia domattina, mi dici cosa succede alla prima
   dettatura?** Non ho potuto provare la catena dal telefono: quello che ho
   provato è il gestionale che riceve. **Raccomandazione: fammi sapere il
   testo esatto** che vedi tornare, giusto o sbagliato che sia.
4. **Le 14 ricette in produzione non hanno ingredienti dentro.** Le ho trovate
   così contando le tabelle: le ricette ci sono, le righe degli ingredienti
   sono zero. **Raccomandazione: è normale se le hai caricate e devi ancora
   riempirle**; dimmelo, perché finché sono vuote il costo di quei piatti non
   esiste.
