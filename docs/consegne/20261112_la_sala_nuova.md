# La sala nuova (12/11/2026)

Migrazione `20261112000004_la_sala_nuova`. La pianta del locale è cambiata: la mappa dei tavoli (Calendario → pianta, Comande) è rifatta sul file Sweet Home 3D «Borgo 58 prova bagni», con le decisioni di Alessio dell'11/11.

## Cosa c'è
- **La sala nuova.**
  - 12 tavoli: **T1 e T2 grandi 160×80** (in verticale, 4 posti), **T3…T12 piccoli 70×80** (2 posti).
  - I piccoli stanno a coppie (T3-T4, T5-T6, T8-T9, T11-T12) più due da soli (T7, T10).
  - 3 salottini (**Divano 1-3**, 6 posti, prenotabili come prima) lungo la parete in basso.
  - Le posizioni sono quelle del file, arrotondate a 10 cm.
- **La Chef Table è spenta**, non cancellata: ordini e prenotazioni vecchie la nominano. Si riaccende da «Sala e orari»; se torna, la sua posizione va decisa sulla pianta nuova.
- **Una sola sala.** Niente più «sala alta» e «sala bassa»:
  - nel database la zona diventa `sala` per tutte le sagome, e il vincolo non accetta più le due vecchie;
  - sullo schermo la distinzione non c'era già più a parole, ora non c'è nemmeno nel disegno.
  - È la strada meno invasiva: nessuna schermata leggeva la zona per distinguere le due sale.
- **Lo storico resta attaccato.** I tavoli esistenti si aggiornano sul posto (stesso id, stesso nome); si creano solo T10, T11, T12. Prenotazioni e conti vecchi tengono il nome scritto al momento.
- **Le disposizioni di giornata si tolgono tutte**: erano scritte nelle coordinate della sala vecchia. Su Prova erano 4, tutte di fine agosto; su work la migrazione dice quante al rilascio.
- **I formati.** Nuovi: «Piccolo 70x80» (2 coperti) e «Grande 160x80» (4). I vecchi (90x90 e 180x90) si spengono e la pagina «Sala e orari» mostra solo quelli in uso.
- **Il disegno.**
  - La sala misura 1990 × 950 cm **dentro i muri** (prima 2070 × 1030, in proporzione).
  - Si disegnano i muri veri (il muro di spina coi suoi tre varchi, bagni, bancone, cucina, servizi), la scala e il contorno aperto sull'uscita.
  - Bagni, cucina e servizi sono vietati ai mobili; il bancone no, come prima.
  - Il pannello del Calendario e delle Comande (modulo, gesti del conto) sta nel blocco di destra, servizi + cucina (640 × 950).
  - Il riquadro del bancone in Comande cresce verso la sala fino al primo tavolo, anche se ora ha i servizi alle spalle invece del bordo: senza, sarebbe tornato alto 200 cm.
  - Niente più sagome «spostate solo nel disegno»: era la Chef Table.

## Controlli
- **Verifica dentro la migrazione** (si annulla da sola, zero residui):
  - 12 tavoli accesi (10 piccoli, 2 grandi), 3 salottini, Chef Table spenta ma presente;
  - nessuna sagoma in «sala alta / bassa»;
  - tutto dentro 1990 × 950, nessuna sagoma sopra un'altra;
  - ogni tavolo acceso ha un formato acceso;
  - il conteggio vede 4 coppie e 4 tavoli da soli; la pianta del giorno ha 15 sagome;
  - una sagoma nuova in «sala alta» si rifiuta.
  - I conti esatti valgono solo sul giro che rifà la sala: su un secondo giro la sala è di Alessio.
- **Provata su Prova** in transazione annullata, due giri di fila (il secondo non tocca niente).
- **Prove pure:** tests/unita/sala-misure.test.js (zone, muri, aree vietate, pannelli, bersaglio del tavolo da 70).
- **Prove della schermata:** tests/schermate/pianta-sala-nuova.test.jsx.
- **Prove sui dati veri** (tests/app) aggiornate ai formati nuovi: coperti-sala, aggancio-sala, aiuto.
- **Anteprima per Alessio:** `pianta-nuova-anteprima.png` (e `.svg`) in «Ricerche attrezzatura».

## Da chiedere ad Alessio
- **Due piccoli accostati contano 2 coperti, non 4.** La regola è «meno due per ogni giunzione», pensata per i quadrati; nelle coppie della pianta le sedie stanno sui lati corti e non se ne perde nessuna. Per ora si corregge a mano dalla pianta. Va decisa la regola.
- I numeri dei tavoli (T3…T12) seguono l'ordine della pianta da sinistra a destra, dall'alto in basso: si cambiano da «Sala e orari».

## Applicazione su work
- ⚠️ Prima dei Controlli: `prova:migra` (i Controlli non migrano Prova, e le prove sui dati veri si aspettano la sala nuova).
- La migrazione;
- la pagina.

Nessuna funzione online da pubblicare.
