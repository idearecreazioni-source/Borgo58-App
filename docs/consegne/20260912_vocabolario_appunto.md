# Vocabolario, riga 6: «appunto» per ciò che arriva da MEMO — 12/09/2026

Scelta di Alessio del 12/09 sulla tabella della PR #71. **Solo testo a
schermo**, nessuna logica. **Migrazioni**: nessuna. **Funzioni online**:
nessuna. **HEAD dichiarato**: vedi l'ultima riga.

## La regola

Quello che MEMO non scrive da solo e aspetta di essere approvato è un
**«appunto»**. A schermo si chiamava anche «una cosa che avevi detto», «le
cose in sospeso», «quello che avevi detto».

## Cosa cambia — nella parte che non tocca la #58

| File | Prima | Adesso |
|---|---|---|
| `components/StriscaDallaVoce.jsx` (arrivando da un appunto, lettura fallita) | «Sei arrivato qui da una cosa che avevi detto a voce, ma non sono riuscito a rileggerla … e quello che avevi detto è ancora nell'elenco delle cose in sospeso.» | «Sei arrivato qui da un appunto, ma non sono riuscito a rileggerlo … e l'appunto è ancora fra quelli che aspettano.» |
| idem (fatto) | «✓ Fatto. La cosa che avevi detto non aspetta più.» | «✓ Fatto. L'appunto non aspetta più.» |
| idem (finendo a mano) | «Stai finendo a mano una cosa che avevi detto: «…»» | «Stai finendo a mano un appunto: «…»» |
| `lib/operazioni.js` (due errori del corridoio) | «approvare / correggere quello che avevi detto» | «approvare / correggere l'appunto» |
| `lib/calcoli/voce.js` (titolo del riscontro dopo una dettatura) | «N cose da guardare prima di scriverla» · «Una da guardare» | «N appunti da guardare prima di scriverli» (al singolare «Un appunto … scriverlo») · «Un appunto da guardare» |

- Nel titolo del riscontro **«Fatto: N cose» resta**: quelle sono già
  scritte, non sono appunti.
- Prima diceva «N cose … scriverla», col singolare anche al plurale: ora il
  verbo segue il numero.

La prova `tests/unita/voce.test.js` cita il titolo del riscontro ed è
aggiornata con le frasi nuove. Controlla anche il verbo, al singolare e al
plurale.

## ⚠️ Rimandato a dopo la #58 (sono i suoi file)

- Dashboard: «Non sono riuscito a leggere le cose che hai dettato» e «aspetta
  che tu lo approvi».
- MEMO voce: «aspetta che tu lo guardi», da allineare ad «approvi».
- `AppuntoDaApprovare.jsx`: i suoi testi.

## Cosa resta com'è, apposta

- **«Hai detto: «…»»**, «Sto capendo quello che hai detto…», «capire quello
  che hai detto», «Non ho capito niente di quello che hai detto»: parlano
  della **frase detta**, non di un appunto.

## Come è stato verificato

- Sostituzioni contate, con i fine riga di Windows dei quattro file: ogni
  frase trovata esattamente una volta.
- `oxlint` pulito. Prove pure **1295/1297**, con `voce.test.js` verde. Le
  due rosse sono i fine riga di Windows (`indice-richieste`,
  `indice-rovesciamenti`), rosse anche su master.
- Nessuna prova sulle schermate cita la striscia o il riscontro.
- `git merge-tree` con i rami di #57–#79 e con gli altri rami del
  vocabolario: nessun conflitto.

## Cosa NON è verificato

- Non misurato a schermo: solo testo, più corto di prima.

## Cosa abbiamo rovesciato

Niente.

---

**Hash di HEAD dichiarato**: `c7c861d` sul ramo `vocabolario-appunto`, cioè il
commit immediatamente sotto questo documento.
**Stato del working tree al momento della consegna**: pulito (la cartella
della prova visiva locale è esclusa da git e non è committata).
