// I COLORI DELLA SALA — un posto solo.
//
// ⚠️ STA IN UN FILE SUO dal 29/08, e non e una pignoleria: da quando la
// LEGENDA li legge (`LegendaDellaSala`), la mappa e condivisa fra due
// componenti — e un file che esporta insieme un componente e una costante
// rompe il ricaricamento a caldo mentre si lavora. Qui non esporta niente
// che si disegni, quindi il problema non esiste.
//
// ⚠️ E LA LEGENDA LEGGE DA QUI, non da una propria copia: una spiegazione
// con i colori riscritti a mano, il giorno che qualcuno cambia una tinta,
// comincia a raccontare una sala diversa da quella che si vede.

// LA PIANTA DELLA SALA — la stessa in Calendario e in Comande.
//
// Deliberatamente povera, e va tenuta povera (§4 del mandato): sagome in
// scala approssimativa, aggancio a griglia, niente rotazione, niente
// collisioni fini, niente zoom libero. Divani e Chef Table si disegnano
// ma non si trascinano — e non perché questa schermata non li lasci
// prendere: è un vincolo del database (dining_tables_sagoma_check).
//
// ⚠️ IL SALVATAGGIO AVVIENE AL RILASCIO, MAI DURANTE IL TRASCINAMENTO.
// Salvare a ogni movimento vorrebbe dire decine di scritture per un solo
// gesto, e una connessione lenta trasformerebbe un trascinamento in uno
// scatto.
//
// ⚠️ QUANTO È GRANDE SULLO SCHERMO. Il tavolo più piccolo è 90 cm; il
// target di tocco minimo del progetto è 1,05 cm reali (§3.2.1). Da qui la
// larghezza minima del disegno: 2070 / 90 × 1,05 ≈ 24 cm reali. Su un
// monitor la pianta ci sta tutta; su un tablet verticale la sala scorre
// in orizzontale — che è quello che fa una pianta di sala su un foglio
// piccolo. Non si rimpicciolisce sotto quella soglia: un tavolo che non
// si riesce a toccare durante un servizio non è una pianta, è un disegno.
// ⚠️ ROVESCIAMENTO DICHIARATO (18/08, giro E). Il fattore RIDUZIONE_DISEGNO
// abbassa questa soglia: il tavolo piu' piccolo non misura piu' 1,05 cm
// reali ma poco piu' di tre quarti. La ragione di allora non era sbagliata
// nel principio — un bersaglio troppo piccolo non si prende — ma 1,05 era
// una convenzione presa da fuori, non una misura su questa app: Alessio
// oggi trascina i tavoli col dito a 6,6 mm senza inciampare. Il perche' del
// numero, e il prezzo che accettiamo, stanno in lib/calcoli/sala.js.
// ⚠️ Le tre soglie si sono spostate in `lib/calcoli/sala.js` il 21/08:
// sono misure, e una misura si deve poter provare senza un browser.
// 🔴 LE DUE LARGHEZZE MINIME NON VIVONO PIÙ QUI (22/08): erano il pavimento
// che tagliava la sala. Restano in `lib/calcoli/sala.js`, dove adesso
// rispondono a un'altra domanda — *«quanti punti servono per avere il
// bersaglio pieno di 1,05 cm?»* — e chi le legge è la calibrazione, che
// dice il prezzo invece di imporlo.

// ⚠️ E DA QUI IN POI SONO DUE NUMERI DIVERSI, che prima erano lo stesso.
// «Quanto piccolo può diventare il disegno» e «quando la sala sta male
// sdraiata» sono due domande, e la riduzione del giro E le separa: se la
// soglia si rimpicciolisse insieme al disegno, un tablet in verticale
// (768 punti) smetterebbe di girare la sala e mostrerebbe una pianta
// sdraiata dove le Comande, sullo STESSO tablet, la mostrano in piedi —
// cioè si allargherebbe la differenza fra le due schermate proprio nel
// giro che la deve chiudere.
// Quindi il verso si decide con la misura di PRIMA: nessuno schermo
// cambia orientamento per via di questo giro, cambia solo quanto è grande
// il disegno.


// ⚠️ LA SALA IN PIEDI, per il tablet della sala (chiesto da Alessio il
// 14/08 dopo aver aperto il primo tavolo dal vivo: la pianta sbordava di
// lato e si vedeva mezza).
//
// La sala è larga il doppio di quanto è profonda: su un tablet tenuto in
// verticale, sdraiata, o esce dallo schermo o diventa troppo piccola per
// toccarla. Girata di un quarto ci sta in larghezza e scorre in
// verticale — che è il verso in cui si scorre su un telefono.
//
// **Il disegno gira, la sala no.** L'ingresso finisce in basso, cioè
// dalla parte da cui si entra guardando lo schermo, e la sala alta in
// cima. ⚠️ **Le scritte NON girano**: ogni etichetta si rigira di un
// quarto in senso contrario, altrimenti si leggerebbe di traverso — e un
// nome di tavolo che si legge piegando la testa, durante un servizio,
// non si legge.


// L'aggancio a griglia: 10 cm. Abbastanza fine da accostare due tavoli
// senza fatica, abbastanza grosso da non lasciare fessure di 3 cm che a
// schermo sembrano un errore di chi trascina.
//
// ⚠️ Dal 18/08/2026 NON è più un numero di questo file: è legato alla
// tolleranza con cui il database decide che due tavoli si toccano, e i due
// devono accordarsi. Il rapporto è scritto in `lib/calcoli/sala.js`, in un
// posto solo — prima stavano in due file che non si nominavano.

// ⚠️ ESPORTATA dal 29/08 perche la LEGENDA legga gli stessi identici
//    colori che la pianta disegna. Una legenda con la propria copia dei
//    colori e una spiegazione che il giorno che qualcuno cambia una tinta
//    comincia a raccontare una sala diversa da quella che si vede — ed e
//    lo stesso principio per cui la precedenza dei segni si chiede alla
//    funzione che la decide, non si riscrive a parole.
export const COLORI = {
  libero: { riempimento: "var(--color-b58-parchment)", bordo: "var(--color-b58-charcoal)" },
  // 🔴 VERDE OLIVA DAL 21/08, e prima era terracotta. Il terracotta era
  // **doppio** — è anche la fascia «ultimo giro» — e quel doppio uso finisce
  // qui: l'ambiguità si scioglieva «da sé» solo finché il tavolo selezionato
  // era al massimo uno, e da quando la selezione prende un tavolone intero
  // non è più vero. Il verde si è liberato perché la fascia di mezzo è
  // passata all'ambra.
  selezionato: {
    riempimento: "var(--color-b58-olive)",
    bordo: "var(--color-b58-olive-dark)",
  },
  // ⚠️ SCURO, E FINO AL 18/08 ERA DORATO. Il cambio non è estetico: dal giro
  // D2 le fasce arrivano anche in Comande, e lì il dorato vuol già dire
  // «primo giro». Sulla stessa schermata lo stesso quadratino avrebbe detto
  // «sono seduti» su un tavolo e «arriveranno presto» su quello accanto, e
  // nessuna legenda può disfare un'ambiguità così: chi guarda non ha modo di
  // sapere quale dei due sta guardando. Il terracotta della selezione resta
  // doppio (è anche la fascia «ultimo giro»), e lì l'ambiguità si scioglie da
  // sé — il tavolo selezionato è al massimo uno, ed è quello che hai appena
  // toccato tu.
  // 🔴 E DAL 21/08 QUESTO MARRONE DICE UN'ALTRA COSA: non più «ci sono
  // seduti adesso», ma **la comanda è partita per la cucina**. Alessio:
  // *in una sala da tredici tavoli, chi è seduto si vede guardando la sala* —
  // quello che non si vede da nessuna parte è se l'ordine è andato.
  inviata: { riempimento: "var(--color-b58-charcoal-soft)", bordo: "var(--color-b58-charcoal)" },
  // ⚠️ LE TRE FASCE DELLA SERATA (idea di Alessio, 14/08; il terzo colore
  // è del 18/08). Non è un vincolo e non impedisce niente: è l'ora resa
  // visibile senza doverla leggere.
  //   giallo  = arriva prima dell'ora del primo giro → il tavolo può
  //             servire una seconda volta;
  //   verde   = arriva a servizio avviato → il tavolo resta suo;
  //   arancio = arriva dopo l'ultimo ingresso → è l'ultimo turno, e può
  //             stare sullo stesso tavolo di un giallo.
  // ⚠️ I confini NON sono qui e non sono due ore fisse: vengono dagli
  // orari **di quel servizio** (`service_hours`). La domenica è pranzo, e
  // tre fasce calcolate sugli orari della cena direbbero «primo giro» a
  // chiunque pranzi.
  presto: { riempimento: "var(--color-b58-gold)", bordo: "var(--color-b58-gold-dark)" },
  // 🔴 AMBRA DAL 21/08, e il verde è passato a «selezionato». Il colore non è
  // stato scelto a occhio: è il punto medio **misurato** fra i suoi due
  // vicini in questa stessa mappa, ed è il punto che massimizza la distanza
  // dal più vicino dei due — 19,0 di differenza percettiva da entrambi, dove
  // sopra 10 si distingue a colpo d'occhio. Misurato anche contro TUTTI gli
  // altri colori della sala: il minimo resta 19,0. Il conto è in
  // `index.css`.
  pieno: { riempimento: "var(--color-b58-ambra)", bordo: "var(--color-b58-ambra-dark)" },
  // 🔴 ROSSO SCURO DAL 21/08, e **non è il terracotta del marchio**: è una
  // variabile sua (`--color-b58-turno` in `index.css`). Scelto da Alessio
  // guardando il tablet in sala, per staccare meglio l'ultimo turno
  // dall'ambra. Cambiare il terracotta avrebbe ridipinto pulsanti, accenti e
  // logo di tutta l'app per una decisione presa su un tavolo.
  tardi: { riempimento: "var(--color-b58-turno)", bordo: "var(--color-b58-turno-dark)" },
  // Mezzo e mezzo: sul tavolo c'è più di una fascia — tipicamente un
  // giallo e un arancio, che è proprio il secondo giro.
  misto: { riempimento: "url(#mezzoEmezzo)", bordo: "var(--color-b58-olive-dark)" },
  // 🔴 «NON LO SO» HA UN ASPETTO SUO — 29/08/2026, richiesta di Alessio da
  // una schermata sua. Fino a stanotte una prenotazione che cade fuori
  // dagli orari del servizio prendeva **lo stesso identico colore** del
  // turno centrale: due fatti diversi, un colore solo, e chi guarda senza
  // modo di distinguerli.
  //
  // ⚠️ NON È UN QUINTO COLORE DELLA SERATA, ed è il punto: le fasce sono
  // tre e restano tre. Questo è un rigato grigio che dice «qui manca
  // un'informazione» — si vede che non è una fascia, invece di sembrarne
  // una. È la regola «uno zero non è una risposta» sulla sala.
  //
  // ⚠️ E NON È IL TRATTEGGIO DEL RITARDO, che è un secondo canale e passa
  // sopra i colori: questo sta AL POSTO del colore, perché il colore è
  // proprio la cosa che non si sa. I due si possono vedere insieme su uno
  // stesso tavolo, e vogliono dire due cose diverse.
  ignota: { riempimento: "url(#fasciaIgnota)", bordo: "var(--color-b58-charcoal-soft)" },
  fisso: { riempimento: "var(--color-b58-cream-dark)", bordo: "var(--color-b58-charcoal-soft)" },
};
