# Ricettario Fase 1A — le bozze di ricetta (la fondazione)

**06/10/2026** · mandato notturno «Ricettario Fase 1A, continuazione con corridoio
inattivo» · ramo `claude/ricettario-bozze-fase1a` · base `slave` `8aedabd` · codice nel commit `cbf70a1db3b8fc53a80b2b08ee39c2449e3e1bf1` (il commit sotto questo riepilogo) ·
mandato d'origine [`docs/mandati/20260812_ricettario_fase1.md`](../mandati/20260812_ricettario_fase1.md), Attività A.

> 🔴 **NIENTE DI QUESTO È APPLICATO O INSTALLATO.** La migrazione
> `20261006000001` non è stata applicata né a Prova né alla produzione; la
> funzione online `operazioni-atomiche` non è stata reinstallata; nessun
> database è stato toccato da questa sessione. La migrazione **non fa parte
> dell'allineamento delle 17** (`20260917000001` → `20260929000001`, piano
> G0–G7, contratto di preflight) e **non è dichiarata pronta per la
> produzione**.

---

## 1. Cosa c'è

| pezzo | file |
|---|---|
| tre tabelle, permessi, due trigger, la promozione, il censimento delle unità ridichiarato, la verifica | `supabase/migrations/20261006000001_le_bozze_di_ricetta.sql` |
| una riga nell'elenco chiuso del corridoio | `supabase/functions/operazioni-atomiche/index.ts` (`"promuovi_bozza_ricetta",`, e nient'altro) |
| la frase italiana dell'operazione | `src/lib/operazioni.js` |
| la regola dei buchi (pura), il gesto di conferma | `src/lib/calcoli/bozzeRicetta.js` |
| le letture e scritture del browser | `src/lib/api/bozzeRicetta.js` |
| elenco e dettaglio | `src/pages/ricettario/BozzeList.jsx`, `BozzaDetail.jsx`; due rotte in `src/App.jsx` |
| prove | `tests/unita/bozze-ricetta.test.js`, `tests/schermate/bozza-ricetta.test.jsx`, `tests/app/bozze-ricetta.test.js` |

### Il modello

- `bozze_ricetta`: titolo, `origine_tipo` (manuale · link · screenshot · testo
  · voce), `origine_riferimento`, sunto, `categoria` (`recipe_category`),
  `porzioni`, `buchi_dichiarati text[]`, `stato` (in_revisione · ispirazione ·
  scartata), e i tre campi della promozione: `promossa_il`, `ricetta_id`,
  `gesto_promozione`.
- `bozze_ricetta_ingredienti`: `nome`, `testo_originale`, `quantita` (vuota =
  buco), `unita` **testo libero** (un'unità che il gestionale non conosce resta
  scritta e diventa buco), `ingredient_id` (vuoto = non collegato), `nota`.
- `bozze_ricetta_passaggi`: `fase` (`step_phase`, vuota = buco), `descrizione`.

### La promozione — `promuovi_bozza_ricetta(p_bozza_id, p_esito, p_gesto)`

`security definer`, portiere `is_titolare()`, `revoke` da `public, anon,
authenticated` e **un solo `grant`, ad `authenticated`, per il corridoio**.

- `ispirazione` → la bozza passa a `ispirazione`, nessuna scrittura nel
  Ricettario.
- `ricetta` → se ci sono buchi li **nomina tutti** e rifiuta; altrimenti, in
  una transazione: `recipes` (`piatto_finito`) + `recipe_ingredients` +
  `recipe_steps` + la bozza segnata.
- **Doppio tocco**: la bozza si legge `for update`; se è già promossa con lo
  **stesso** `p_gesto` restituisce la stessa ricetta (`gia_fatto: true`), con
  un gesto **nuovo** rifiuta. Bozza scartata: rifiutata.
- Gli ingredienti si **agganciano**, mai si creano: nessun `insert into
  ingredients` fuori dal blocco di verifica.

### Le difese nel database, non nella schermata

- RLS titolare-only sulle tre tabelle (`for all to authenticated`, `is_titolare()`).
- **Permessi sulle colonne**: dal browser non si scrivono `promossa_il`,
  `ricetta_id`, `gesto_promozione`, e `stato` non si sceglie alla creazione.
  Dichiarare «promossa» senza ricetta è impossibile per permesso.
- Trigger: una bozza promossa non si corregge, e le sue righe non si
  aggiungono, correggono o tolgono. ⚠️ **Due eccezioni**, perché senza
  sarebbero vicoli ciechi: la chiave esterna può svuotare `ricetta_id` quando
  la ricetta viene tolta dal Ricettario, e da quel momento la bozza si può
  cancellare.
- `perimetro_registro`: le tre tabelle dichiarate **fuori** dal registro
  delle cancellazioni, con la ragione.
- Il censimento delle unità (`colonne_unita_non_classificate`) è ridichiarato
  dal corpo dell'ultima definizione nel repository (`20260831000005`) con una
  riga in più: `bozze_ricetta_ingredienti.quantita`, **che non si converte**.
  `grant` invariato rispetto a prima (era già ad `authenticated`).

### Le schermate

`/ricettario/bozze` e `/ricettario/bozze/:id`, sotto `RequireTitolare`.
⚠️ **Non sono nel menu né nella pagina del Ricettario**, apposta: mostrarle
oggi vorrebbe dire offrire una schermata che non funziona. Una prova pura
controlla che il collegamento non compaia. L'unico ingresso è «Nuova bozza
vuota»: nessun campo che legga link, immagini, audio o testo AI.

Il riquadro «Cosa manca per diventare una ricetta (N)» è sempre visibile;
«Crea la ricetta» resta spenta finché è pieno. Aprendo la conferma nasce un
gesto (`nuovoGesto()`), che resta lo stesso se si riprova dopo un errore.
⚠️ `nuovoGesto` non si affida a `crypto.randomUUID`, che nel browser c'è solo su
un indirizzo cifrato: il gestionale si apre anche da `http://` sulla rete del
locale.

---

## 2. La durata delle bozze

Il mandato del 12/08 chiede che le bozze scartate si eliminino da sole dopo N
mesi, «stampo posta». Lo stampo esiste (`pulizia_posta`, lavoro `pg_cron`
sorvegliato da `lavori_sorvegliati`), ma usarlo vuol dire **un lavoro
pianificato nuovo**, che questo mandato esclude. **La pulizia automatica resta
da progettare**; oggi una bozza scartata resta finché il titolare non la
elimina.

---

## 3. Prove

| dove | cosa | esito |
|---|---|---|
| locale, `npx oxlint` | stile | pulito |
| locale, Node puro (sostituto minimo di `describe/it/expect`, senza vitest) | `tests/unita/bozze-ricetta.test.js` | **33/33**; rotta apposta la riga del corridoio → 32/33, la prova giusta rossa; rimessa |
| GitHub | compilazione, prove pure, prove di schermata, prove sul progetto di prova | vedi la proposta |

⚠️ **In locale non ho lanciato vitest né la compilazione**: tutti e due
passano da Vite, che legge `.env`, e il mandato lo vieta. Le prove di
schermata (`tests/schermate/bozza-ricetta.test.jsx`) girano **solo** su GitHub.

⚠️ **`tests/app/bozze-ricetta.test.js` oggi è SPENTA**, e lo dice: la tabella
non esiste su Prova. Si riaccende da sola quando la migrazione verrà
applicata, e da lì diventa **rossa** se il corridoio installato non conosce
ancora l'operazione.

---

## Cosa non è verificato

- **Il blocco di verifica della migrazione non è mai girato**: gira solo
  applicandola. Contiene undici controlli (bozza che non crea niente, buchi
  nominati tutti, tutto o niente, nessun ingrediente creato, buco che resta
  vuoto, portiere sullo staff, doppio tocco, gesto nuovo rifiutato, bozza
  promossa ferma, ricetta tolta e bozza poi cancellabile, scartata
  rifiutata, ispirazione senza Ricettario, esito sconosciuto) — scritti, mai
  eseguiti.
- **La RLS dal client** (lo staff non vede né conferma): scritta in
  `tests/app/`, spenta finché la migrazione non è applicata.
- **La schermata non è stata aperta** in un browser: è vista solo dalla prova
  di schermata su GitHub (jsdom, dati finti).
- Il caso «un'unità che le schermate non propongono ma il database conosce»:
  la schermata segnalerebbe un buco che il database accetterebbe (mai il
  contrario). Dichiarato in `src/lib/calcoli/bozzeRicetta.js`.
- Dato per fatto senza misurarlo: che nella cascata di cancellazione di una
  bozza la riga madre non sia più visibile al trigger delle righe figlie. Se
  fosse visibile, cancellare una bozza promossa e senza ricetta fallirebbe, e
  il controllo (8) della verifica lo direbbe all'applicazione.

## Cosa abbiamo rovesciato

Niente. La pulizia automatica delle bozze scartate (mandato del 12/08) non è
rovesciata: è **rinviata**, perché richiede un lavoro pianificato che questo
mandato esclude (§2).
