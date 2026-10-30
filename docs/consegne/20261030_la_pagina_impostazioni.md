# La pagina Impostazioni — 30/10/2026

Lo chiede Alessio dopo aver visto la #269 su Prova: va tutto bene, tranne la scelta dello schermo fissa nel piede del menu, che ruba spazio per una cosa che si sceglie una volta sola.

Le sue parole: *«Sposta nelle Impostazioni solo la scelta dello schermo, chiaro/scuro resta nel piede del menu.»*

## Cosa cambia
- **Una pagina nuova, `/impostazioni`.** Ha la scelta Telefono / Mini tablet / Tablet / Computer e una riga che dice che vale solo per questo apparecchio.
  - È per tutti, non solo per il titolare: i tablet della sala li usa lo staff.
  - Si carica a parte, quindi non pesa sul gestionale.
- **Il piede del menu** ha chiaro/scuro come prima. Sotto ci sono, sulla stessa riga, «Impostazioni» ed «Esci».
- **La prima volta** lo schermo lo propone il gestionale, come prima (`src/lib/schermo.js`).
- **A microfono acceso** il telaio chiede prima di lasciare la pagina, anche quando si tocca «Impostazioni».

## Prove
- `tests/schermate/scelta-schermo.test.jsx` è riscritta, con quattro prove:
  - la pagina ha le quattro scelte e la riga «vale solo qui»;
  - scegliere si ricorda su questo apparecchio;
  - il menu non ha più la scelta dello schermo, e chiaro/scuro c'è ancora;
  - «Impostazioni» è sulla stessa riga di «Esci».
- Tutte le prove delle schermate: 482 passate.
- Il resto:
  - lint pulito;
  - compilazione riuscita;
  - peso di 445,86 kB su un tetto di 450.

## Revisione ECC
- **ecc:react-reviewer:** niente di grave. Applicato:
  - il gruppo è un `div`, perché `section` con il ruolo «group» perdeva il suo punto di riferimento;
  - nel piede, `min-w-0` sulle due voci, così una scritta grande non spinge fuori l'altra;
  - la prova controlla che la riga di spiegazione sia proprio quella collegata al gruppo.
- Non fatto: spostare il fuoco sul titolo dopo la navigazione. Nessuna pagina lo fa oggi, e farlo è un lavoro a parte.

## Non verificato
- Il telefono vero con le scritte al massimo: va guardato su Prova.
