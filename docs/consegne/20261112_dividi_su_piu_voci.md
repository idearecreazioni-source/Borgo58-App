# Dividi una spesa su più voci del Piano dell'investimento (12/11/2026)

Migrazione `20261112000003_dividi_su_piu_voci`. Terzo passo del modello approvato da Alessio l'11/11 (modello-piano-sottovoci.html, «Dividi su più voci»); prima i riquadri (#360) e le sottovoci (#362).

## Cosa c'è
- **Una spesa va su più voci, ognuna con la sua cifra.** Una riga di prima nota, un anticipo o una fattura.
  - Esempio: fattura San Cataldo 7.200 € = 4.500 sul Forno (sottovoce) + 2.700 su Sedie e tavoli.
  - Si salva solo divisa tutta, al centesimo. Una parte sola va bene: è «Metti su una voce» per tutto.
- **Un gesto solo: `dividi_spesa(fonte, id, parti)`.** Mette la spunta «investimento» e sostituisce TUTTI i collegamenti di quella spesa con le parti scelte.
  - Passa dal corridoio `operazioni-atomiche` (scrive due tabelle, Contratto B4).
  - security invoker come `segna_investimento`, più il controllo del titolare all'inizio per dire il rifiuto con una frase.
- **Rifiuti, con la frase:**
  - non sei il titolare;
  - nessuna voce, o una riga senza voce o senza cifra;
  - una cifra a zero o sotto, o con più di due decimali;
  - la stessa voce due volte;
  - una voce che non c'è più, o archiviata;
  - «Restano da dividere X €» e «Hai diviso X € in più della fattura/spesa»;
  - una voce madre (il portiere delle sottovoci), la spesa dell'orto, la rata di un'altra voce (i portieri di prima).
- **Acconto e saldo si dividono a mano** (scelta di Alessio dell'11/11).
  - Colonna nuova `piano_collegamenti.da_dividere`.
  - Il pagamento di una fattura che sta su più voci eredita i collegamenti come prima (in ordine, mai oltre il pagamento: lo speso non sparisce), ma segnati «da dividere».
  - Con una voce sola non cambia niente.
  - `dividi_spesa` riscrive i collegamenti senza il segno.
- **Pagina del piano.**
  - «Dividi su più voci» accanto a «Metti su una voce» nelle Spese da assegnare. Il modulo si apre con le parti che la spesa ha già.
  - Righe «Dove va» + «Quanto (€)», «+ Aggiungi un'altra voce», «Togli», la barra, l'esito («✓ Divisa tutta: restano 0,00 €», «Restano da dividere X», «Hai diviso X in più della fattura»), «Salva la divisione» acceso solo a resto zero.
  - Dentro una voce aperta: ogni documento collegato dice «4.500,00 € di 7.200,00 € · divisa: il resto è su Sedie e tavoli», e ha «Dividi». Le fatture si leggono col numero, la data e il fornitore.
  - «Pagamenti da dividere»: ogni pagamento di una fattura divisa, con «Pagamento di una fattura divisa: dividilo tu», com'è messo ora, e «Dividi».
  - Le voci si scelgono come nella spunta: niente madri, «Madre › Sottovoce».

## Controlli
- **Verifica dentro la migrazione** (si annulla da sola):
  - la divisione giusta 4.500 + 2.700 su sottovoce e voce, con la spunta;
  - la somma sbagliata rifiutata, per difetto e per eccesso;
  - la voce madre e la stessa voce due volte rifiutate, e la divisione di prima intatta dopo i rifiuti;
  - l'acconto di una fattura divisa ereditato «da dividere»; il pagamento di una fattura su una voce sola no;
  - dividere l'acconto toglie il segno;
  - una nuova divisione sostituisce la vecchia;
  - la voce archiviata rifiutata;
  - anon non può chiamarla.
- **Provata su Prova** in transazione annullata.
- **Prove pure:** tests/unita/piano-dividi.test.js.
- **Prove della schermata:** tests/schermate/piano-investimento.test.jsx (dividi su più voci).

## Applicazione su work
- La migrazione;
- la funzione online `operazioni-atomiche` (c'è `dividi_spesa` nell'elenco);
- la pagina.

## Seguiti
- **Caso storto contato per eccesso** (come già deciso nella parte 5): se un pagamento di una fattura si divide su una voce che la fattura non ha, o la fattura si ridivide dopo un acconto, l'impegnato della fattura non scende su quella voce. Non si rifiuta, perché bloccherebbe lo spostamento di fattura e pagamenti da una voce all'altra. Se diventa un fastidio, si decide con Alessio.
- **Il secondo acconto riparte dal primo collegamento** della fattura (difetto di prima, ora visibile perché è «da dividere»): si sistema dividendolo a mano.
- Nella pagina delle Fatture la spunta «investimento» mette ancora la fattura su una voce sola: per dividerla si apre la voce nel piano e si preme «Dividi». Un «Dividi» anche lì, se servirà.
