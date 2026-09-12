# MEMO: un titolo breve non combacia per caso — 13/09/2026

Mandato «MEMO: evitare falsi abbinamenti con titoli brevi», dopo il caso
«Test» del 12/09 (commento sulla #58); seconda autorizzazione di Alessio del
13/09 (casi «S.r.l.» e codici, poi i tre passi sul solo Borgo58-Prova);
terza autorizzazione (riconoscimento al femminile in MEMO, §4).

**Ramo solo locale** `memo-titoli-brevi`, sopra la #58 (`23ca405`), che non è
toccata. **Migrazione**: `20260913000001_un_titolo_breve_non_combacia_per_caso`,
**applicata SOLO a Borgo58-Prova** il 13/09 (390 migrazioni registrate).
**Funzioni online**: `ascolta-voce` **v35 installata SOLO su Borgo58-Prova**
(dal commit `60cad5e`). **In produzione: niente.** **GitHub**: nessun push,
nessuna PR.
**HEAD dichiarato**: `60cad5e`, il commit sotto questo riepilogo.

---

## La causa

`impegni_compatibili` (ultima definizione `20260909000003`) ha tre gradini;
il terzo, «uno contiene l'altro», confrontava due **stringhe** con
`like '%…%'` sulle forme ridotte da `voce_titolo_nudo` e `voce_titolo_essenziale`:

- **nessun confine di parola**: «arte» dentro «partenze», «iva» dentro
  «arrivano», «test» dentro «testo»;
- **i codici si spezzano prima del confronto**: `voce_titolo_nudo` riduce a
  spazio ogni carattere che non è lettera o cifra, quindi
  «TEST-AUTO scelta#k9x2» diventa «test auto scelta k9x2» e «test» sembra una
  parola a sé; «S.r.l.» diventa tre lettere sciolte. Per questo nemmeno un
  confronto a parole intere, da solo, bastava (controprova B);
- la soglia di tre lettere guarda solo la frase detta, mai il titolo.

Il 12/09 l'impegno aperto «Test» è entrato fra i candidati di tutte le prove
vocali, le cui frasi cominciano con «TEST-AUTO…»: 9 prove rosse in
`agenda-a-voce`, `agenda-riconosce-impegno`, `agenda-scelta-candidato`
(giro di master `7dc76fb`).

## La regola nuova

Solo il terzo gradino cambia: si contengono **parole e pezzi interi**.

- `voce_titolo_segnato(testo)`: divide il testo nei pezzi separati da spazi e
  punteggiatura di frase (elenco esplicito: spazi, `, ; : ! ? " « » ( ) [ ] { }`,
  apostrofi, lineette); ogni pezzo passa da `voce_titolo_nudo` e le sue parole
  restano unite da «+». Trattino, cancelletto, barra, trattino basso e punto
  **non** separano: «TEST-AUTO» → `test+auto`, «F24-bis» → `f24+bis`,
  «S.r.l.» → `s+r+l`, «730.1» → `730+1`.
- `voce_titolo_segnato_essenziale(testo)`: come sopra senza i pezzi fatti di un
  solo articolo o preposizione; la parola vuota la decide
  `voce_titolo_essenziale` (un elenco solo). Una parola dentro un pezzo non si
  toglie mai (la «l» di «S.r.l.» resta).
- `voce_contiene_parole(lungo, corto)`: le parole del corto compaiono di fila
  nel lungo, separate da spazio o «+», **cominciando e finendo sul bordo di un
  pezzo** (prima inizio o spazio, dopo spazio o fine — mai «+»).
- `voce_grado_compatibile(detto, titolo)`: la scala tolta dalla tabella.
  Gradino 1 e 2 e soglia di tre lettere sulla frase **identici** a
  `20260909000003`; il 3 usa `voce_contiene_parole` sulle forme segnate, nei
  due versi, con e senza articoli (con la stessa condizione `e_utile`).
- `impegni_compatibili`: `create or replace` con la **stessa firma**
  (`id, title, due_date, grado`), `stable security definer`,
  `search_path = public`, stesso ordine, solo impegni con
  `status <> 'completato'`. Nessun `drop`, nessun `grant`.
- Le quattro funzioni nuove: `revoke all … from public, anon, authenticated`.

**Nessuna soglia di lunghezza nuova**: la controprova A mostra che una soglia
(titolo di almeno 5 lettere) perde «IVA» in due frasi e non ferma comunque
«TEST-AUTO riunione».

**Cosa non cambia**, letto nel codice della #58: la funzione continua a
elencare, e `voce_risolvi_dati` (`20260911000001`, l'unica che la chiama sul
progetto di prova) esegue solo se sul gradino migliore ne resta uno. Con zero
candidati la riga diventa `agenda_quale_impegno` con `manca`, non approvabile;
`azione_percorso('agenda_quale_impegno')` = `/agenda`, quindi «Fallo a mano →»
porta all'Agenda. Frasi miste, spostamenti e approvazione manuale non sono
toccati.

## File

- `supabase/migrations/20260913000001_un_titolo_breve_non_combacia_per_caso.sql` (nuovo)
- `docs/decisioni_rovesciate.md`: voce **93** (riga d'indice e sezione)
- `supabase/functions/ascolta-voce/agenda.ts`: due frasi in `PAROLE_FATTO` (§4)
- `tests/unita/agenda-a-voce.test.js`: le prove del femminile (§4)
- questo riepilogo

Commit: `1f057e0` (migrazione e rovesciamento), `43df4a5` (casi «S.r.l.» e
codici), `60cad5e` (il femminile), e questo.

## 1. La migrazione

La verifica dentro la migrazione **non scrive nessuna riga**: chiama
`voce_grado_compatibile` su **35 casi** e confronta quali titoli stanno sul
gradino migliore — la stessa cosa che guarda chi chiama — nominando tutti i
casi rossi. Poi pretende che `impegni_compatibili` usi davvero
`voce_grado_compatibile`, che resti `security definer`, e che nessuna delle
cinque funzioni sia eseguibile da `anon` o `authenticated`. Si registra in
`applied_migrations`.

## 2. Prove SQL locali (prima di toccare il progetto di prova)

- **Database temporaneo**: PGlite 0.5.8 (PostgreSQL 18.3 in WebAssembly),
  **in memoria**, dentro un processo Node, **nessuna porta e nessun server**,
  in `…\scratchpad\pg-temp` della sessione. Usato in due giri e **cancellato**
  entrambe le volte, verificato inesistente, senza collegamenti ad altre
  cartelle. ⚠️ Il PostgreSQL 17 installato sul computer ha solo gli strumenti
  a riga di comando (`initdb`: manca `postgres.bki`).
- Schema minimo (`tasks`, `applied_migrations`, ruoli `anon`/`authenticated`),
  **solo impegni finti**; funzioni di partenza prese dai file
  (`voce_titolo_nudo` da `…002`, `voce_titolo_essenziale` e
  `impegni_compatibili` da `…003`) con le stesse `revoke`. I casi sono letti
  dalla migrazione stessa e passati da `impegni_compatibili` su una tabella vera.

  | | casi | rossi |
  |---|---|---|
  | **prima** (regola del 09/09) | 35 | **13**: 12 difetti + il prezzo dichiarato |
  | **dopo** (`20260913000001`, applicata **due volte**) | 35 | **0** |

  Rossi prima, verdi dopo: `test_dentro_test_auto`,
  `il_caso_vero_due_candidati_e_test`, `detto_breve_dentro_un_prefisso_tecnico`,
  `codice_dentro_un_codice_piu_lungo`, `titolo_dentro_una_parola_piu_lunga`,
  `sigla_dentro_una_parola_piu_lunga`, `titolo_breve_con_una_trappola_accanto`,
  `titolo_composto_con_una_trappola_accanto`, `nessun_candidato_con_trappole`,
  `una_lettera_dentro_una_sigla_coi_punti` («R» dentro «S.r.l.»),
  `codice_col_trattino_in_una_frase` («F24» insieme a «F24-bis»),
  `codice_dentro_un_codice_col_punto` («730» dentro «730.1»), e
  `prezzo_frammento_di_un_pezzo_col_trattino` (il prezzo, non un difetto).
  Verdi prima e dopo: titolo breve detto da solo e in una frase, «S.r.l.» detta
  coi punti e dentro una frase, «F24» detto uguale e in una frase, «F24-bis» e
  «Modello 730.1» detti interi, titolo composto, trattino detto uguale /
  staccato / dentro una frase, due candidati veri, nessun candidato, e le otto
  coppie delle prove `tests/app/agenda-*`.
- **Controprove**, una rottura alla volta, poi rimessa a posto (35 verdi); la
  verifica della migrazione lanciata **da sola** dopo ogni rottura:

  | rottura | casi rossi | verifica |
  |---|---|---|
  | A · soglia (titolo ≥ 5 lettere) al posto dei pezzi | 5 | si ferma |
  | B · parole intere ma senza pezzi | 9 | si ferma |
  | C · `impegni_compatibili` torna quella di prima | 13 | si ferma |

- Confronti isolati: «commerciali» contro «Andare dal commercialista» prima
  grado 3, dopo nessuno. «assemblea srl» contro «Assemblea S.r.l.» e
  «assemblea S.r.l.» contro «Assemblea srl»: **nessun candidato, prima e dopo**
  (limite preesistente, non peggiorato).
- Rete delle guardie lanciata senza database: per `impegni_compatibili` solo
  le due chiamate spostate, rinuncia dichiarata. Lint zero avvisi,
  compilazione riuscita, prove pure 1333 su 1335 (le 2 rosse sono
  `indice-richieste` e `indice-rovesciamenti`, rosse anche sulla base per i
  fine riga di Windows; la voce 93 controllata con `generaIndice` a fine riga
  Unix: allineata).

## 3. Sul progetto di prova (autorizzato il 13/09)

**Prima di applicare — confronto in sola lettura col catalogo vivo:**
`voce_titolo_nudo`, `voce_titolo_essenziale` e `impegni_compatibili` hanno il
corpo **identico** ai file da cui parte la migrazione; `impegni_compatibili`:
stessa firma, `security definer`, `stable`, `search_path=public`, chiusa ad
`anon` e `authenticated`; la chiama solo `voce_risolvi_dati`; i quattro nomi
nuovi non esistevano; registro: 389 migrazioni, la sola mancante del ramo era
`20260913000001`, le due della #58 presenti. Nessuna differenza inattesa.

**Applicazione** — `npm run prova:migra -- 20260913000001` (lo strumento si
rifiuta sulla produzione e confronta coi corpi vivi): rinuncia dichiarata
riconosciuta, verifica «35 casi di riconoscimento come attesi», 390 migrazioni
registrate.

**Dopo, in sola lettura**: le cinque funzioni hanno il corpo identico alla
migrazione del ramo e sono chiuse al browser; funzioni di `public` 448 → 452;
colonne invariate (1440, stessa impronta); impegni aperti 55, invariati.

**Prove automatiche sul progetto di prova:**

| giro | esito |
|---|---|
| le tre prove vocali Agenda | **32 su 32** (113 s) |
| giro completo `npm run test:app` | **565 su 566**, 80 file (583 s) |
| `agenda-scelta-candidato`, rilanciata da sola due volte | **9 su 9**, due volte |

⚠️ **L'unica rossa del giro completo è un tempo scaduto, non un risultato
sbagliato**: «un candidato unico resta come nella #45» ha superato i 30
secondi di limite (nessun controllo del valore è fallito). Rilanciata due
volte da sola dura **2,6 s** in entrambe; nello stesso file le altre prove
durano 1,5-7,4 s. Non c'erano altre prove in corso (verificato sull'elenco dei
processi di Windows). Fuori dal giro, per scelta dello strumento: `domande-memo`
e `memo-dal-vivo`, che chiamano il modello e si pagano.

**Collaudo end-to-end col modello, sulla v34** (9 impegni finti col marchio,
13 chiamate, 1,74 €): «Test» mai candidato; «F24», «F24-bis», «730», «Modello
730.1» riconosciuti ognuno col proprio codice; «L'IVA è fatta», «L'assemblea
della S.r.l. è fatta», «Segna come fatto il 730» approvati, chiuso solo il
finto giusto; «Segna come fatta l'IVA» e «segnala come fatta» rimasti «da
chiarire» — da qui il §4. Impegni esistenti identici, pulizia verificata.

## 4. Il riconoscimento al femminile (13/09, terza autorizzazione)

**Causa**: `PAROLE_FATTO` in `supabase/functions/ascolta-voce/agenda.ts` (#58)
conosceva «segna come fatto» e «segnala come fatto», non il femminile: «segna
come fatta l'IVA» era una chiusura dichiarata dal modello senza parole di
chiusura per la rete, quindi `agenda_da_chiarire` (`MOTIVO_GESTO_NON_DETTO`).
**Modifica**: due frasi intere in più, «segna come fatta» e «segnala come
fatta» — non la parola «fatta»: le parole si cercano intere. Nessun'altra riga
del codice cambia; il testo per il modello non è toccato.

**Prove pure** (`tests/unita/agenda-a-voce.test.js`): 56 su 56. Col
`agenda.ts` di prima **3 rosse** — le tre sul femminile — e le altre verdi:
maschile, trappole («segna come fattura…», «va fatta domani», «la spesa fatta
al mercato» restano «altro») e prudenze. Il femminile dà **gli stessi esiti del
maschile** su cinque scenari, compresi la frase mista senza pezzi (resta da
chiarire), lo spostamento dichiarato con parole di chiusura (resta da chiarire)
e la chiusura senza parole di chiusura (resta da chiarire). Lint zero,
compilazione riuscita, 1339 su 1341 (le 2 di sempre).

**Nessuna regressione dei titoli brevi**: la verifica di `20260913000001`
lanciata in sola lettura sul database di prova, 35 casi come attesi; le tre
prove vocali Agenda sul progetto di prova, 32 su 32.

**Funzione di prova**: prima v34 (impronta `b691e3f1a1ee9d20`, identica alla
#58, ricontrollata in sola lettura); installata con
`npm run funzione ascolta-voce -- --prova --conferma` → **v35** (impronta
`967e0ea45c045c95`), verifica del token ancora spenta come prima; i 5 file
installati, riscaricati, sono identici al ramo.

**Collaudo end-to-end** (8 impegni finti col marchio, **6 chiamate** al
modello — il massimo autorizzato — 283.290 + 1.309 token, **0,80 €**):

| frase | esito |
|---|---|
| «Segna come fatta l'IVA.» | «IVA», approvabile, approvata: chiusa solo lei |
| «Segnala come fatta l'IVA.» | «IVA», approvabile (non riapprovata) |
| «Segna come fatto il 730.» | «730» e non «Modello 730.1», approvata |
| «Segna come fatta la TEST-AUTO collaudo.» | «Quale dei due?» fra i due «TEST-AUTO collaudo», non approvabile, «Fallo a mano» |
| «Segna come fatto l'F24-bis.» | «F24-bis» e non «F24», approvata |
| «Segna come fatto il TEST-AUTO di stamattina.» | «Quale dei due?» fra i due «TEST-AUTO collaudo», non approvabile, «Fallo a mano»; «Test» mai candidato |

⚠️ L'ultima frase, nel collaudo sulla v34, aveva dato **nessun candidato**;
questa volta i due «TEST-AUTO collaudo», che contengono davvero il pezzo
«TEST-AUTO». Le parole che il modello ha estratto non le ho stampate, quindi
la ragione della differenza **non è misurata**. Le tre proprietà che contano
sono uguali nei due giri: «Test» non entra, non si approva, c'è la via a mano.

Impegni esistenti identici alla fotografia prima e dopo le approvazioni; dopo
la pulizia impegni, dettature, appunti e azioni identici a prima, residui zero.

## Cosa NON è verificato

- La produzione: niente di questa consegna ci è andato (lì `ascolta-voce` è
  alla v10, letto il 12/09).
- Nessuna schermata aperta: «Quale impegno?», «Quale dei due?» e «Fallo a
  mano →» sono letti dai dati e dal codice della #58, non guardati.
- Perché una prova abbia superato i 30 secondi una volta: non misurato.
- Le due prove col modello (`domande-memo`, `memo-dal-vivo`) non girate.
- Il costo delle dettature di collaudo (1,74 € + 0,80 €) non resta nel
  contatore mensile del progetto di prova, perché le dettature sono state
  cancellate; la spesa sull'account AI è avvenuta.

## Casi ancora ambigui

- Un titolo breve che è **una parola vera** della frase continua a combaciare
  («Test» con «fai il test del forno»): è voluto. Se è l'unico candidato viene
  proposto, e si scrive solo dopo l'approvazione.
- Un **frammento** di un pezzo col trattino e una parola detta a metà non
  combaciano più al terzo gradino (il prezzo, provato).
- Una sigla scritta **con e senza punti** («srl» / «S.r.l.») non combacia,
  come prima.
- L'elenco dei separatori è finito: un simbolo non elencato (per esempio «·» o
  «+») tiene insieme due pezzi.
- Al femminile entrano solo le due frasi chieste: «segna fatta» e «segnalo come
  fatta» restano «da chiarire».

## Cosa resta per la produzione

Dopo il merge della #58 e di questo ramo, e con la sua autorizzazione:
`npm run migra -- --conferma` applica `20260913000001` insieme alle due della
#58, e `npm run funzione ascolta-voce -- --conferma` installa la funzione con
le forme al femminile. Prima, il confronto del corpo vivo di
`impegni_compatibili` in produzione.

## Il commento sulla #58

Non aggiornato: la correzione non è nella #58 e non è su GitHub, quindi il
difetto resta vero per quella PR.

## Cosa abbiamo rovesciato

1. **Cosa era stato deciso e quando.** Il 09/09/2026 (`20260909000003`): il
   terzo gradino confronta i testi ridotti all'osso con `like '%…%'`,
   conservando il confronto vecchio accanto a quello senza articoli.
2. **La ragione di allora.** Non perdere nessun impegno che prima si trovava.
3. **Cosa si decide adesso.** Chiesto da Alessio il 13/09: il terzo gradino
   contiene solo parole e pezzi interi; nessuna soglia di lunghezza nuova.
4. **Perché la ragione di allora non vale più.** Vale ancora per le parole
   intere, che continuano a trovarsi; cade per i pezzi di parola, che
   trovavano cose sbagliate (12/09, «Test» dentro «TEST-AUTO…»). **Il prezzo**:
   un frammento di un pezzo col trattino e una parola detta a metà non
   combaciano più al terzo gradino.

Registrato come voce **93** in [`docs/decisioni_rovesciate.md`](../decisioni_rovesciate.md).
Il §4 non rovescia niente: l'elenco cresce di due frasi, e la regola dell'11/09
(«le parole di quella cosa devono dire il gesto») resta intera.

HEAD dichiarato: `60cad5e`.
