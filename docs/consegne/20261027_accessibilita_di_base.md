# Accessibilità di base — 27/10/2026 (notte)

**HEAD dichiarato sotto questo riepilogo:** `74a58ea`, sul ramo `claude/accessibilita-di-base` aperto da `origin/slave` `eeb08ba`. Due commit: `00e33e9` e `74a58ea`. Working tree pulito. **Nessuna migrazione, nessuna funzione online, nessun dato toccato.**

## Origine
L'audit WCAG 2.2 AA del 25/10 (`ecc:a11y-architect`), voce P1.6 del piano. È il lavoro notturno autorizzato da Alessio il 26/10. Qui c'è solo la parte che non cambia l'aspetto: contrasti e pianta della sala da tastiera restano per il restyling.

## Cosa cambia
- **Fuoco visibile:** l'anello da tastiera compare ovunque mancasse. Sta in `@layer base`, quindi non si somma all'anello dei campi.
- **«Vai al contenuto»:** è il primo elemento da tastiera e salta il menu.
- **Meno movimento:** niente transizioni per chi le ha disattivate nel sistema.
- **Ruota dell'ora:** definiti i colori `--color-b58-sand` e `-sand-light`. La ruota li usava, ma non esistevano.
- **Menu:** si chiama «Menu principale»; sul telefono il menu aperto è una finestra con un nome e si chiude con Esc.
- **Finestre:** Preconto, Chiusura conto, Carta dei vini, Bis e Chi paga hanno `role=dialog` con un nome. La «×» dice cosa chiude.
- **Esc:** chiude solo la finestra in cima e non quando si sta scrivendo in un campo (`useChiudiConEsc`, 5 prove).
- **Prima nota:** ogni campo ha il suo nome.

## Verificato
- `npx oxlint`: zero avvisi.
- Prove di schermata: 451 verdi. Prove pure verdi, salvo le 3 già note per gli a capo CRLF.
- Build riuscita; nel CSS compilato la regola del fuoco sta nel livello `base` e i colori sabbia esistono.
- Revisione `ecc:a11y-architect`: nessun rilievo alto. Accolti:
  - il livello della regola del fuoco;
  - la pila delle finestre per Esc;
  - Esc lasciato ai campi;
  - l'etichetta di «Rif. documento».

  Non accolto: il colore sabbia «usato per testi in decine di pagine». Misurato, compare solo in 4 bordi (`border-b58-sand`), dove 3,84:1 basta.

## Non verificato
- Nessuna schermata aperta con la tastiera a mano. Le finestre non hanno ancora la trappola del fuoco né il ritorno del fuoco: è un limite dichiarato dalla revisione, non un peggioramento.

## Dato per fatto senza misurarlo
- Nulla.

## Affermazioni diventate false durante il lavoro
- Nel primo commit il commento diceva che `:where()` bastava a lasciare la precedenza ai campi. Era falso, perché la regola stava fuori da ogni livello: corretto nel secondo commit.

## Cosa abbiamo rovesciato
Nessuna decisione rovesciata.
