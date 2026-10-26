# Sicurezza P0: le email ai clienti, le intestazioni del sito e l'audit dei permessi — 26/10/2026

**HEAD dichiarato sotto questo riepilogo:** `8a07840`, sul ramo `claude/p0-sicurezza-email-header-rls` aperto da `origin/master` `794af67`. Quattro commit: `4e1d87d` (email), `e622892` (intestazioni), `3f75ab5` (audit), `8a07840` (revisione: avviso CodeQL e rilievi ECC, vedi in fondo). Proposta #236 verso `slave`. Working tree pulito. **Nessuna migrazione, nessun dato toccato. La funzione online `email-cliente` NON è stata reinstallata**: va fatto dopo l'unione (`npm run funzione email-cliente -- --conferma`).

## Origine
Piano di verifica del 25/10/2026, voci P0.2, P0.3 e P0.5, chieste in chat il 26/10 «su un ramo, senza unire».

## Cosa cambia
1. `supabase/functions/email-cliente/testi.ts` (nuovo) e `index.ts`: i testi della conferma e del preventivo passano in un file puro, e ogni valore che entra nell'HTML passa da `esc()`. Prima il nome scritto nel modulo pubblico `/prenota` entrava nell'HTML così com'era: un link scritto nel campo «nome» diventava un link vero, in una mail mandata dal dominio del locale. Il testo semplice e l'oggetto non cambiano.
2. `public/_headers` (nuovo): CSP, `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy`, `Permissions-Policy` (microfono e fotocamera solo per il sito). Nella CSP i due progetti Supabase sono scritti per nome.
3. `supabase/diagnostica/20261026_audit_permessi.sql` (nuovo): sola lettura, accanto a `20260808_audit_fondamenta.sql`. Sette categorie:
   - tabelle senza RLS;
   - funzioni definer senza `search_path`;
   - privilegi di anon;
   - policy valide per anon;
   - funzioni eseguibili da anon;
   - privilegi predefiniti per anon o PUBLIC;
   - contenitori di file pubblici.
4. Due file di prova: `tests/unita/email-cliente-testi.test.js` (8 prove) e `tests/unita/intestazioni-sicurezza.test.js` (6 prove: i progetti nella CSP coincidono con `scripts/comune.mjs`, nessuno script inline in `index.html`).

## Verificato
- `npx oxlint`: zero avvisi. Compilazione riuscita. `npm run test:schermate`: 444 verdi su 444.
- `npm run test` (prove pure): 2352 verdi, 3 rosse (`bozze-col-lordo`, due in `indirizzo-funzioni-vault`). Non dipendono da questo lavoro, che non tocca quei file:
  - la copia di lavoro ha gli a capo CRLF (`core.autocrlf=true`);
  - convertiti i file in LF in una copia a parte, quei due file danno 19 verdi su 19.
- **La CSP sulla build vera.** La build di questo ramo è stata servita con le intestazioni lette da `_headers` e aperta nel browser:
  - `/` (Login) e `/prenota`: nessuna violazione in console, caratteri Fraunces e Inter caricati;
  - una richiesta a `example.com` è bloccata, una a un progetto Supabase estraneo è bloccata, quella al progetto di prova passa (401, chiave finta).
- **L'audit dei permessi sul progetto di prova** (`bnwqgpuyzmzujxfbtyvs`), in una transazione `default_transaction_read_only=on`. 8 righe, tutte «funzione eseguibile da anon» e tutte attese:
  - `submit_public_reservation`, `public_reservation_options`, `giorni_chiusi_prenotabili`;
  - `voce_apri_sessione`, `registra_dettatura_da_chiave`;
  - `is_titolare`, `normalize_phone`, `task_origin_visible_to_staff`.

  Zero righe in tutte le altre categorie. Controprova dei numeri:
  - 144 tabelle in `public`, nessuna senza RLS;
  - 408 funzioni definer, tutte con `search_path`;
  - `authenticated` legge `recipes`, `anon` no;
  - l'unico privilegio predefinito su `public` è `authenticated=arwd`.

## Non verificato
- **La produzione**: l'audit non è stato lanciato sul database vero. Va incollato da Alessio nell'SQL Editor del progetto vero, e il risultato va confrontato con quello della prova.
- **Le schermate dopo l'accesso con la CSP attiva** (Sala, MEMO foto e voce, Archivio, stampe): da qui non si entra. Vanno guardate sull'anteprima Cloudflare del ramo, con la console aperta: una violazione si legge come «Refused to …».
- Che Cloudflare legga i commenti `#` di `_headers` e applichi la regola anche alle pagine servite da `_redirects`: va misurato sull'anteprima del ramo (intestazioni della risposta di una pagina qualunque).
- La mail vera con il testo nuovo: la funzione non è reinstallata.

## Dato per fatto senza misurarlo
- Nulla.

## Affermazioni diventate false durante il lavoro
- Nel report di verifica del 25/10 l'audit di sicurezza consigliava «`revoke all on all tables in schema public from anon`». **Sul progetto di prova non serve**: anon non ha privilegi su nessuna tabella o vista. Sulla produzione lo dirà l'audit.

## Cosa abbiamo rovesciato
Nessuna decisione rovesciata. Il sito non aveva intestazioni di sicurezza per assenza, non per una scelta scritta. Ho cercato `_headers`, `Content-Security`, `frame-ancestors` e `X-Frame` in `docs/` e in `CLAUDE.md`: nessun risultato.

## Revisione dopo la proposta (`8a07840`)
- **CodeQL**, controllo di GitHub, avviso di gravità alta su `tests/unita/intestazioni-sicurezza.test.js:60`: l'espressione che cerca gli script in `index.html` non riconosceva `<SCRIPT>` maiuscolo. Corretta: ora è insensibile alle maiuscole e accetta la chiusura `</script …>`.
- **Revisione `ecc:security-reviewer`**: nessun rilievo alto. Accolti:
  - il nome del cliente sta su una riga sola, così un a capo nel modulo pubblico non aggiunge righe al corpo della mail (2 prove);
  - l'audit vede i privilegi su singole colonne, le policy di `storage` valide per anon e le procedure;
  - la prova delle intestazioni controlla il rientro delle righe, i due progetti in `img-src` e `wss`, e `object-src 'none'`.
- **Non accolti** (bassi): `upgrade-insecure-requests` e `frame-src` esplicito (già coperto da `default-src 'self'`); il controllo del contenuto di `search_path`.
- **Audit rilanciato sul progetto di prova**, in sola lettura: le stesse 8 righe attese e zero nelle altre categorie. Le 4 policy di `storage` valgono solo per `authenticated`.
- **Prove dopo la revisione:** lint a zero; prove pure 2355 verdi, con le stesse 3 rosse per gli a capo CRLF.
- **Rilievo medio rimasto aperto:** la CSP scrive i progetti per nome. Se la variabile `VITE_SUPABASE_URL` di Cloudflare puntasse altrove, il gestionale non parlerebbe col database. Da qui il valore non si legge: va controllato sull'anteprima del ramo.
