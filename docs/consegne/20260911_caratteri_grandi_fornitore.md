# Coi caratteri grandi la scheda di un fornitore sta nello schermo — 11/09/2026 (mandato notturno 2, fase 2)

Sola interfaccia, un file: `src/pages/magazzino/FornitoreDetail.jsx`.
**Migrazioni**: nessuna. **Funzioni online**: nessuna. **Database**: non
toccato. **HEAD dichiarato**: vedi l'ultima riga.

---

## Il difetto, misurato

L'unico difetto visivo vero trovato dal censimento del mandato notturno 2 in
un file che nessuna PR aperta tocca. Il censimento ha girato su 392 viste di
98 schermate, a iPhone 390, iPhone largo 440, caratteri grandi (64 punti per
cm) e computer 1280, su una copia locale di master più #57, #58 e #59.

A 390 punti con i caratteri grandi, su `/magazzino/fornitori/:id`:
- il menu **«È in regime di esonero?»** era largo quanto la sua voce più
  lunga («Sì: l'autofattura la faccio io») e usciva dal riquadro, da 40 a 417
  punti su 390;
- **tutta la pagina scorreva di lato**, larga 470 punti su 390;
- nella fotografia, le righe di **«Consegne recenti»** e **«Storico
  prezzi»** uscivano dal bordo, perché data e prezzo erano in `shrink-0` e
  non potevano andare a capo.

## La cura

- Menu: `max-w-full min-w-0`.
- Righe: `flex-wrap` e `min-w-0` (via `shrink-0`). Data e prezzo vanno sotto
  il nome quando non ci stanno accanto.

## Come è stato verificato

- **Censimento prima e dopo, stessa schermata e stesse forme.**
  - Prima: menu fuori dal riquadro e pagina larga 470 su 390, con i
    caratteri grandi.
  - Dopo: pagina **390 su 390**, niente fuori, a iPhone 390 e 440, caratteri
    grandi e computer 1280.
  - Guardata la fotografia dopo: menu e righe dentro il riquadro.
- Resta segnalata una sovrapposizione di 8 punti fra «Salva modifiche» e
  «Disattiva fornitore». È il margine negativo voluto dei pulsanti scritti
  come testo (`tocco-testo`, 0,5 rem per lato), non un difetto: il testo non
  si tocca.
- **Fusione di prova** con #57, #58, #59, #60, #61 e #62: nessun conflitto.
- Lint pulito, compilazione riuscita.
- Prove pure **1295/1297**: le due rosse sono i fine riga di Windows, già
  note su master.
- Prove sulle schermate **129/132**: le tre rosse sono esattamente quelle già
  note su master (`rotte-chiuse` ×1, `varco-pubblico` ×2, tempo scaduto).

## Cosa NON è verificato, e il limite

- **Nessuna prova automatica nuova.** La prova visiva di master copre solo
  l'Agenda, e il censimento per schermata (`npm run misura:telefono`) vive
  nella PR #57. La verifica durevole giusta è una `verifica` su questa rotta
  in `misura-telefono-rotte.mjs`, da aggiungere quando la #57 sarà unita:
  aggiungerla adesso vorrebbe dire modificare un file della #57.
- Il menu nativo, coi caratteri grandi, **tronca** la voce scelta («Non
  gliel'ho ancora ch…»). È il comportamento di ogni menu del telefono: si
  vede tutta aprendolo.
- Chrome, non Safari. Non visto su un iPhone vero.

## Cosa abbiamo rovesciato

Niente.

---

**Hash di HEAD dichiarato**: `ada29b2` sul ramo `caratteri-grandi`, cioè il
commit immediatamente sotto questo documento.
**Stato del working tree al momento della consegna**: pulito.
