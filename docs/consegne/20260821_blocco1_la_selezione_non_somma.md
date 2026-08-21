# Blocco 1 — si seleziona un tavolo o un tavolone, mai due tavoli lontani

**21/08/2026** · primo blocco del mandato «le Comande sul tablet».
**Nessuna migrazione**: il database non c'entra, il concetto che serviva lo
sapeva già.

---

## 1 · Il difetto

`src/pages/comande/Sala.jsx`, il tocco su una sagoma:

```js
setSelezione((s) => (s.includes(sagoma.id) ? s.filter(...) : [...s, sagoma.id]));
```

**Ogni tocco sommava.** Si potevano selezionare **T1 e T9** — i due capi
della sala — e aprirci sopra **una comanda sola**. Non è una comanda: è un
errore che nessuno vede finché non arriva il preconto.

I quattro gesti chiesti da Alessio, adesso:

| tocco su | cosa succede |
|---|---|
| un tavolo singolo | si seleziona quello, **e basta** |
| un altro tavolo | **cambia** la selezione, non la somma |
| un tavolo accostato | si selezionano **tutti** quelli del tavolone |
| il vuoto della sala | si **deseleziona** |

---

## 2 · Il concetto di «accostati» non è stato reinventato — ma non stava dove il mandato diceva

Il mandato indicava `src/lib/calcoli/sala.js`. **Misurato: lì non c'è.**

Quel file contiene la **tolleranza geometrica del magnete** — quanto due
sagome devono avvicinarsi perché si aggancino **mentre si trascinano**
(`TOLLERANZA_CONTATTO_CM`, `raggioMagneteCm`, `agganciaAiVicini`).

🔴 **Il raggruppamento vero è un'altra cosa e vive altrove**: lo conta il
**database** (`coperti_del_giorno`) e lo ridice `insiemiPerTavolo` in
`src/lib/calcoli/ritardo.js` — **la stessa mappa che colora la sala**.

⚠️ **Non mi sono fermato perché la definizione È riusabile**, e anzi è quella
giusta: usare la tolleranza di `sala.js` avrebbe creato **una seconda
definizione di «accostati»**, cioè precisamente ciò che il mandato voleva
evitare.

⚠️ **E c'è un precedente esatto.** `insiemiPerTavolo` è nata il 18/08 da un
difetto identico, trovato sempre dalle mani di Alessio: *toccando T7 — dentro
un tavolone — il gestionale lo trattava da libero mentre si vedeva colorato.*
Il commento sopra quella funzione lo dice così:

> «il tocco contraddiceva il colore… tutto il disegno del giro D3 poggia su
> *bianco è libero, colorato ha qualcuno*, e lì quella regola era falsa».

**Se il tocco usasse una definizione sua, quel difetto tornerebbe.**

---

## 3 · Dove vive la regola, e perché non nella schermata

La regola sta in **`src/lib/calcoli/selezione.js`**, `selezioneDopoIlTocco`,
con **8 prove**.

⚠️ **Non dentro il componente**, ed è una scelta con una ragione precisa:
*in questo progetto nessuna prova apre una schermata.* Una regola scritta
dentro un `setSelezione` non la guarda nessuno — è la stessa lezione del
16/08 (`payloadMancia`, il campo che si vedeva e non arrivava al database).

**La schermata chiama quella funzione**, non ne tiene una copia: se domani la
regola cambiasse in un posto solo, non potrebbero divergere.

### Rotta apposta

Rimessa la somma di prima, **5 prove su 8 diventano rosse**, e la prima dice
il difetto parola per parola:

```
AssertionError: expected [ 'T1', 'T2' ] to deeply equal [ 'T2' ]
```

Cioè: i due tavoli lontani sommati. Poi rimessa a posto.

---

## 4 · Il tocco sul vuoto

La pianta non sapeva dire «hai toccato il vuoto»: aggiunta la prop
`onSfondo`, **facoltativa**, quindi il Calendario — che usa la stessa pianta
— non cambia comportamento.

⚠️ **Si riconosce dal bersaglio, non dalla propagazione**: il click risale
con `closest("[data-sagoma]")` e, se sopra c'è una sagoma, il gesto non è
suo. Fermare la propagazione su ogni sagoma avrebbe funzionato **uguale
oggi** e si sarebbe rotto il giorno che qualcuno aggiunge un elemento dentro
una sagoma dimenticandosi di fermarla.

---

## 5 · Cosa non è verificato

- 🔴 **Nessuna mano ha ancora toccato la sala sul tablet.** Le 8 prove
  misurano la regola, non il gesto: quello che *non* è provato è che il
  tocco arrivi davvero alla regola, e che il tocco sul vuoto non scatti per
  sbaglio dentro una sagoma.
- ⚠️ **Il caso «sposta un conto su altri tavoli» non è stato esercitato a
  mano**: con la regola nuova, spostare su un tavolone seleziona tutti e tre
  i tavoli in un tocco — è un miglioramento, ma va guardato.
- ⚠️ **Il Calendario non è stato riaperto** dopo la modifica alla pianta.
  Non passa `onSfondo`, quindi per costruzione non cambia, ma la pianta è
  condivisa.

---

## 6 · Cosa abbiamo rovesciato

**Niente.**

⚠️ La selezione che sommava non era una decisione: era il comportamento
predefinito di un elenco a cui si aggiunge e si toglie, mai messo alla prova
con una sala vera. **Non si rovescia una scelta — si corregge un gesto che
nessuno aveva mai guardato**, ed è la stessa forma della soglia del menu di
stanotte e della soglia di tocco del 18/08.

⚠️ **E una cosa che poteva sembrare una perdita non lo è**: prima si potevano
scegliere due tavoli qualsiasi *anche quando erano davvero accostati ma il
database non li contava come tavolone*. Quel caso non esiste — il database
conta i gruppi dalle posizioni vere — e se esistesse sarebbe un difetto del
conteggio, da curare lì e non aggirare col dito.

---

## 7 · Mi fermo qui

Il mandato dice di fermarsi dopo il blocco 1 e farlo provare ad Alessio:
*se la selezione non è giusta, il resto si costruisce sopra un gesto rotto.*

**Lint a zero, 181 prove pure, 292 sui dati veri.**
