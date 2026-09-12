# Il censimento delle schermate, ripetibile: la proposta — 12/09/2026 (mandato esteso, priorità 4)

**Solo documentazione.** Codice dell'app: non toccato. **Migrazioni**:
nessuna. **Funzioni online**: nessuna. **Database**: non toccato. **HEAD
dichiarato**: vedi l'ultima riga.

---

## Cosa c'è

`docs/proposte/20260912_il_censimento_ripetibile.md`:
1. gli strumenti di oggi e i loro limiti: la prova visiva dell'Agenda, il
   pilota di Chrome e il censimento del telefono della #57, il censimento
   del mandato notturno 2;
2. cosa deve poter fare un censimento ripetibile: niente database, niente
   credenziali, stesso esito due volte, rosso da solo, e dire quando non ha
   misurato;
3. il metodo: letture finte generate dagli export di `src/lib/api`,
   quattro forme, tre varianti di dati per schermata, e la tabella di cosa
   rende rosso, con le soglie;
4. cosa ha già trovato questa notte: 28 viste per le PR #67 e #69, un
   difetto vero e un falso allarme della prova stessa;
5. perché non è una PR di codice adesso, e i sei passi per applicarla dopo
   l'unione della #57 e della #59.

## Perché solo una proposta

Il mandato dice: se c'è sovrapposizione con la #57 o la #59, non creare
conflitti e consegna una proposta pronta. La sovrapposizione c'è, e non è di
righe ma di pezzi:
- il pilota di Chrome (`scripts/chrome-senza-schermo.mjs`) nasce con la #57;
- `tests/visive/finti/` e `scripts/prova-visiva.mjs` li cambiano la #57 e la
  #59;
- `package.json` lo tocca la #57.

Una seconda copia del pilota adesso sarebbe il difetto che quel file dichiara
di chiudere.

## Come è stato verificato

- Il metodo è quello usato per controllare le PR #67 (12 viste, 0 difetti) e
  #69 (16 viste: 3 sovrapposizioni al primo giro, 0 dopo la correzione).
  L'esito e le fotografie stanno nei rispettivi riepiloghi.
- I nomi delle funzioni del pilota della #57 (`avviaChrome`, `apriScheda`,
  `apriPagina`, `valuta`, `fotografa`, `nomeFile`) sono letti dal ramo
  `origin/telefono-ordinato` (`f513e6b`).
- I tempi (28 viste in circa 2 minuti) sono misurati su questo computer.
  Quelli per 240 viste sono una stima e sono scritti come tale.
- `git merge-tree` con i rami di #57–#69: nessun conflitto.

## Cosa NON è verificato

- Lo strumento proposto non esiste ancora come file del repository: la
  versione usata questa notte è una cartella locale, esclusa da git.
- Non è stato fatto girare su GitHub.

## Cosa abbiamo rovesciato

Niente.

---

**Hash di HEAD dichiarato**: `bc49b64` sul ramo `censimento-ripetibile`, cioè
il commit immediatamente sotto questo documento.
**Stato del working tree al momento della consegna**: pulito (la cartella
della prova visiva locale è esclusa da git e non è committata).
