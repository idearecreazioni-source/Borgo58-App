# MEMO: un titolo breve non combacia per caso — 13/09/2026

Mandato «MEMO: evitare falsi abbinamenti con titoli brevi», dopo il caso
«Test» del 12/09 (commento sulla #58).

**Ramo solo locale** `memo-titoli-brevi`, sopra la #58 (`23ca405`), che non è
toccata. **Migrazione**: `20260913000001_un_titolo_breve_non_combacia_per_caso`,
**pronta e NON applicata** — né a Borgo58-Prova né in produzione.
**Funzioni online**: nessuna. **Database condivisi**: né letti né scritti.
**HEAD dichiarato**: `1f057e0`, il commit sotto questo riepilogo.

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
  parola a sé. Per questo nemmeno un confronto a parole intere, da solo,
  bastava (lo mostra la controprova B);
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
  **non** separano: «TEST-AUTO» → `test+auto`, «F24-bis» → `f24+bis`.
- `voce_titolo_segnato_essenziale(testo)`: come sopra senza i pezzi fatti di un
  solo articolo o preposizione; la parola vuota la decide
  `voce_titolo_essenziale` (un elenco solo). Una parola dentro un pezzo col
  trattino non si toglie mai.
- `voce_contiene_parole(lungo, corto)`: le parole del corto compaiono di fila
  nel lungo, separate da spazio o «+», **cominciando e finendo sul bordo di un
  pezzo** (prima inizio o spazio, dopo spazio o fine — mai «+»).
- `voce_grado_compatibile(detto, titolo)`: la scala tolta dalla tabella.
  Gradino 1 e 2 e soglia di tre lettere sulla frase **identici** a
  `20260909000003`; il 3 usa `voce_contiene_parole` sulle forme segnate, nei
  due versi, con e senza articoli (con la stessa condizione `e_utile`).
- `impegni_compatibili`: `create or replace` con la **stessa firma**
  (`id, title, due_date, grado`), `stable security definer`,
  `search_path = public`, stesso ordine (`grado, due_date nulls last,
  created_at`), solo impegni con `status <> 'completato'`. Nessun `drop` e
  nessun `grant`: i permessi restano quelli del 09/09 (chiusi).
- Le quattro funzioni nuove: `revoke all … from public, anon, authenticated`.

**Nessuna soglia di lunghezza nuova**: la controprova A mostra che una soglia
(titolo di almeno 5 lettere) perde «IVA» in due frasi e non ferma comunque
«TEST-AUTO riunione».

**Cosa non cambia**, verificato leggendo il codice della #58: la funzione
continua a elencare, e `voce_risolvi_dati` (`20260911000001`) esegue solo se
sul gradino migliore ne resta uno. Con zero candidati la riga diventa
`agenda_quale_impegno` con `manca` («non l'ho trovato fra quelli aperti in
Agenda»), non approvabile; `azione_percorso('agenda_quale_impegno')` = `/agenda`,
quindi «Fallo a mano →» porta all'Agenda. Frasi miste, spostamenti e
approvazione manuale non sono toccati.

## File

- `supabase/migrations/20260913000001_un_titolo_breve_non_combacia_per_caso.sql` (nuovo)
- `docs/decisioni_rovesciate.md`: voce **93** (riga d'indice e sezione)
- questo riepilogo

## Come è stato verificato

### 1. Migrazione pronta ma non applicata

La verifica dentro la migrazione **non scrive nessuna riga**: chiama
`voce_grado_compatibile` su **26 casi** (titoli e frase detta) e confronta
quali titoli stanno sul gradino migliore — la stessa cosa che guarda chi
chiama. Nomina tutti i casi rossi. Poi pretende che `impegni_compatibili`
usi davvero `voce_grado_compatibile`, che resti `security definer`, e che
nessuna delle cinque funzioni sia eseguibile da `anon` o `authenticated`
(`has_function_privilege`). Si registra in `applied_migrations`.

### 2. Prove SQL locali

- **Database temporaneo**: PGlite 0.5.8 (PostgreSQL 18.3 compilato in
  WebAssembly), **in memoria**, dentro un processo Node, **nessuna porta e
  nessun server**. Pacchetto e script in
  `…\scratchpad\pg-temp` della sessione. ⚠️ Il PostgreSQL 17 installato sul
  computer ha solo gli strumenti a riga di comando (`initdb`: manca
  `postgres.bki`), quindi la modalità a utente singolo proposta non era
  disponibile.
- **Rimosso**: `pg-temp` (pacchetto, script, registri) e la copia estratta di
  master del giorno prima, verificati inesistenti dopo la cancellazione, senza
  collegamenti ad altre cartelle al loro interno.
- **Schema minimo**: `tasks` (id, title, due_date, status, created_at),
  `applied_migrations`, i ruoli `anon` e `authenticated`; **solo impegni
  finti**. Le funzioni di partenza sono prese **dai file** delle migrazioni
  (`voce_titolo_nudo` da `…002`, `voce_titolo_essenziale` e
  `impegni_compatibili` da `…003`), con le stesse `revoke` che quelle
  migrazioni fanno.
- **I casi** sono letti dalla migrazione stessa (fra `-- casi:inizio` e
  `-- casi:fine`) e passati da `impegni_compatibili` su una tabella vera:

  | | casi | rossi |
  |---|---|---|
  | **prima** (regola del 09/09) | 26 | **10**: i 9 difetti + il prezzo dichiarato |
  | **dopo** (`20260913000001`, applicata **due volte**) | 26 | **0** |

  Rossi prima, verdi dopo: `test_dentro_test_auto`,
  `il_caso_vero_due_candidati_e_test` (3 candidati invece di 2),
  `detto_breve_dentro_un_prefisso_tecnico`, `codice_dentro_un_codice_piu_lungo`,
  `titolo_dentro_una_parola_piu_lunga`, `sigla_dentro_una_parola_piu_lunga`,
  `titolo_breve_con_una_trappola_accanto`,
  `titolo_composto_con_una_trappola_accanto`, `nessun_candidato_con_trappole`,
  e `prezzo_frammento_di_un_pezzo_col_trattino` (il prezzo, non un difetto).
  Verdi prima e dopo (non devono peggiorare): titolo breve detto da solo e in
  una frase, titolo composto, trattino detto uguale / staccato / dentro una
  frase, parola intera di un titolo col trattino, due candidati veri, nessun
  candidato, e le **otto** coppie delle prove `tests/app/agenda-*` riportate
  coi loro titoli e frasi.
- **Altri controlli sul dopo**: un «IVA» completato non compare, uno
  `in_corso` sì; le cinque funzioni non eseguibili da `anon`/`authenticated`;
  «commerciali» contro «Andare dal commercialista»: prima grado 3, dopo nessun
  candidato.
- **Controprove, una rottura alla volta, poi rimessa a posto (26 verdi)**:

  | rottura | casi rossi | la sola verifica della migrazione |
  |---|---|---|
  | A · soglia (titolo ≥ 5 lettere) al posto dei pezzi | 4 | si ferma |
  | B · parole intere ma senza pezzi | 6 | si ferma |
  | C · `impegni_compatibili` torna quella di prima | 10 | si ferma: «non usa voce_grado_compatibile» |

  La verifica è stata lanciata **da sola** dopo ogni rottura: rilanciare la
  migrazione intera avrebbe rimesso a posto la funzione prima di verificarla.
- Nel primo giro la migrazione si è fermata perché le funzioni di partenza
  erano aperte (il banco non aveva le `revoke` del 09/09): errore del banco,
  corretto; la verifica ha mostrato di accorgersi di una porta aperta.

### Revisione del diff

- **Rete delle guardie** (`scripts/guardie.mjs`) lanciata **senza database**,
  col corpo di riferimento preso dall'ultimo file che definisce la funzione:
  per `impegni_compatibili` trova solo le chiamate a `voce_titolo_nudo` e
  `voce_titolo_essenziale`, spostate dentro `voce_grado_compatibile`, e la
  rinuncia è dichiarata (`-- rete-guardie:`).
- Rileggendo i commenti della migrazione, due affermazioni non erano provate
  da nessun caso («check up» staccato combacia con «Check-up»; «up caldaia» no):
  diventate i casi `trattino_detto_staccato` e
  `prezzo_frammento_di_un_pezzo_col_trattino`.
- `npm run lint`: zero avvisi. `npm run build`: riuscita. `npm run test`:
  1333 su 1335; le 2 rosse sono `indice-richieste` e `indice-rovesciamenti`,
  rosse anche sulla base e dovute ai fine riga di Windows. La voce 93 è stata
  controllata con `generaIndice` a fine riga Unix: indice allineato.

## 3. Cosa richiederà una futura autorizzazione sul database di prova

1. Confrontare il corpo **vivo** di `impegni_compatibili` sul progetto di prova
   (`npm run funzione:viva -- impegni_compatibili --prova`) con quello di
   `20260909000003` su cui è scritta questa: se differisce, la migrazione va
   riscritta dal corpo vivo prima di applicarla.
2. Applicarla a Borgo58-Prova (`npm run prova:migra`) e leggere la verifica.
3. Rilanciare `tests/app/agenda-a-voce.test.js`,
   `tests/app/agenda-riconosce-impegno.test.js`,
   `tests/app/agenda-scelta-candidato.test.js` (e il giro intero), anche con un
   impegno dal titolo breve presente sul progetto.
4. Solo dopo, e con la sua autorizzazione, la produzione — dopo il merge della
   #58 e di questo ramo.

## Cosa NON è verificato

- Nessun database condiviso: il comportamento sul progetto di prova e in
  produzione non è misurato.
- Il motore delle prove è PostgreSQL **18.3**; Supabase gira un'altra versione.
  Le funzioni usano solo SQL di base (espressioni regolari, `translate`,
  `lower`, `string_agg`, `with ordinality`), ma la differenza di versione non è
  provata.
- Le prove `tests/app/*` non sono state lanciate con la regola nuova.
- Nessuna schermata aperta: «Quale impegno?» e «Fallo a mano →» con zero
  candidati sono letti dal codice della #58, non guardati.

## Casi ancora ambigui

- Un titolo breve che è **una parola vera** della frase continua a combaciare
  («Test» con «fai il test del forno»): è voluto. Se è l'unico candidato viene
  proposto, e si scrive solo dopo l'approvazione.
- Un **frammento** di un pezzo col trattino e una parola detta a metà non
  combaciano più al terzo gradino (il prezzo, provato).
- L'elenco dei separatori è finito: un simbolo non elencato (per esempio «·» o
  «+») tiene insieme due pezzi. Sigle coi punti («S.r.l.») non sono state
  provate.

## Il commento sulla #58

Non aggiornato: la correzione non è nella #58 e non è su GitHub, quindi il
difetto resta vero per quella PR. Scrivere «risolto» farebbe credere unibile
una PR che non lo è.

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

HEAD dichiarato: `1f057e0`.
