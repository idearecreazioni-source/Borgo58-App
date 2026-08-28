// =====================================================================
// UNA TABELLA NUOVA NON PUO' NASCERE PIU' LARGA DELLO SCHERMO
// 29/08/2026
// =====================================================================
// 🔴 IL FATTO. La larghezza e' il difetto piu' ripetuto di questo progetto,
// e finora e' stato curato una schermata alla volta. Misurato il 29/08 su
// 60 schermate aperte a 375 punti: **15 costringono a scorrere di lato**,
// e tutte e 15 sono tabelle — da 7 punti fino a 377.
//
// ⚠️ E LA PAGINA NON SCORREVA MAI. In tutte e 15 lo scorrimento era DENTRO
// il riquadro (`overflow-x-auto`), quindi la decisione del 21/08 — «mai
// scorrimento laterale» — SEMBRAVA rispettata. Non lo era: era stata
// spostata di un livello, dove nessuno la misurava. Un controllo che avesse
// guardato solo `document.scrollWidth` avrebbe detto zero su tutte e 15.
//
// ---------------------------------------------------------------------
// PERCHE' UN SETACCIO SUL CODICE E NON UNA MISURA NEL BROWSER
// ---------------------------------------------------------------------
// In questo progetto le prove non hanno un ambiente DOM: nessuna prova
// automatica puo' aprire una schermata e misurarla. Quindi la rete guarda
// la FORMA nel sorgente — che e' anche il momento giusto, perche' avvisa
// mentre si scrive invece che al collaudo.
//
// LA REGOLA: una `<table>` dentro `src/pages/` sta in piedi solo se e'
// nascosta sul telefono (`hidden md:…`), oppure se e' un documento che
// nasce per la CARTA, dove la larghezza dello schermo non c'entra.
// Chi non vuole pensarci usa `<ElencoAdattivo>`, che fa gia' la cosa
// giusta e non compare qui perche' non contiene `<table>` scritta a mano.
//
// ⚠️ LO STATO DI PARTENZA E' CONGELATO, NON PERDONATO. Le nove schermate
// ancora larghe stanno in NOTE_LARGHE con la loro misura: la rete non
// pretende che siano gia' a posto — pretende che **non ne nascano altre**.
// E' la stessa forma di `vincoli_muti_noti` del 25/08: una soglia
// dichiarata invece di un controllo che grida sempre e viene spento.

// I documenti che nascono per la carta: li' la tabella e' la forma giusta,
// e nasconderla sul telefono farebbe uscire un foglio sbagliato.
export const PER_LA_CARTA = [
  "src/pages/haccp/ManualeCompleto.jsx",
  "src/pages/agenda/StampaAdempimenti.jsx",
];

// 🔴 LE TABELLE ANCORA LARGHE AL 29/08/2026, con lo sbordo misurato a 375
// punti. Ognuna e' un debito dichiarato, non un permesso: la rete diventa
// rossa se ne compare una che non e' in questo elenco, e chi cura una di
// queste la toglie da qui.
export const NOTE_LARGHE = {
  "src/pages/fiscale/AndamentoMensile.jsx": "377 punti — matrice mese × voce, i blocchetti perdono la lettura a colonne",
  "src/pages/fiscale/Deducibilita.jsx": "247 punti — report con totali",
  "src/pages/agricolo/AgricoloHome.jsx": "231 punti — righe con pulsanti e riga che si apre",
  "src/pages/fiscale/DeduzioniFiscali.jsx": "170 punti — report con totali",
  // 🔴 TROVATA DALLA RETE, NON DALLA MISURA A SCHERMO: a 375 punti dava
  // zero sbordo perche' sul progetto di prova l'elenco era vuoto — ed e'
  // proprio la schermata che Alessio ha fotografato come illeggibile.
  // *Una schermata senza dati non e' una schermata senza difetti.*
  "src/pages/magazzino/Allineamento.jsx": "riga 294 — va rifatta dal Blocco 5",
  "src/pages/magazzino/MagazzinoHome.jsx": "116 punti — va rifatta dal Blocco 5 (elenco unico per ingrediente)",
  "src/pages/cassa/PrimaNota.jsx": "58 punti — righe con un gesto per riga",
  "src/pages/cassa/Previsione.jsx": "58 punti — report",
  "src/pages/menu-editor/BevandeVini.jsx": "8 punti — tabella di MODIFICA, i campi si scrivono dentro",
  "src/pages/fiscale/PrevisioneDettaglio.jsx": "non misurata a schermo — matrice",
  "src/pages/fiscale/PrevisioneForm.jsx": "non misurata a schermo — modulo a matrice",
  "src/pages/fiscale/Previsioni.jsx": "non misurata a schermo",
  "src/pages/haccp/TemperatureLog.jsx": "non misurata a schermo (registro vuoto sul progetto di prova)",
  "src/pages/calendario/PreventivoDetail.jsx": "non misurata a schermo (serve un preventivo aperto)",
  "src/pages/calendario/ReservationForm.jsx": "non misurata a schermo (dentro un modulo)",
  "src/pages/ricettario/MenuDetail.jsx": "non misurata a schermo (serve un menu aperto)",
  "src/pages/ricettario/RicettaDetail.jsx": "non misurata a schermo (serve una ricetta aperta)",
  "src/pages/ricettario/StaffRicettaDetail.jsx": "non misurata a schermo (serve una ricetta aperta)",
  "src/pages/personale/DipendenteDetail.jsx": "non misurata a schermo (serve un dipendente aperto)",
  "src/pages/cassa/ScontiOmaggi.jsx": "non misurata a schermo (nessuno sconto sul progetto di prova)",
  "src/pages/ricettario/IngredienteForm.jsx": "gia' curata il 25/08 — la seconda tabella e' dentro `hidden md:block`",
  
  
  
};

// Una tabella e' al sicuro se il pezzo di codice che la contiene la nasconde
// sul telefono. Si guarda la finestra di righe PRIMA della `<table>`, non
// tutto il file: un file puo' avere due tabelle, una curata e una no.
const RIGHE_DI_CONTESTO = 12;

export function tabelleSenzaRiparo(testo) {
  const righe = testo.split(/\r?\n/);
  const fuori = [];
  righe.forEach((riga, i) => {
    if (!/<table[\s>]/.test(riga)) return;
    const da = Math.max(0, i - RIGHE_DI_CONTESTO);
    const contesto = righe.slice(da, i + 1).join("\n");
    // `hidden md:table` sulla tabella stessa, oppure `hidden md:block` sul
    // riquadro che la contiene: sono le due forme in uso nel progetto.
    const riparata = /hidden\s+(md|sm|lg):(table|block|flex|grid)/.test(contesto);
    if (!riparata) fuori.push(i + 1);
  });
  return fuori;
}
