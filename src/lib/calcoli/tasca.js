// LA TASCA NELLA PRIMA NOTA — SPEC-0005, 06/09/2026.
//
// 🔴 PERCHE' LA REGOLA STA QUI E NON DENTRO LA SCHERMATA. Le due cose che
//    questa specifica decide — come si chiama il campo della descrizione e
//    che cosa si vede al posto del menu delle causali — sono affermazioni
//    su **un soggetto contro tutti gli altri**. Scritte dentro `PrimaNota.jsx`
//    si proverebbero solo montando la schermata; scritte qui si provano al
//    contrario, cioe' chiedendo che per Borgo 58 e per l'orto NON cambi
//    niente. *La prova che vale e' quella sugli altri soggetti, ed e' anche
//    la piu' facile da dimenticare.*
//
// ⚠️ QUELLO CHE QUESTO FILE NON E': non e' il posto dove vive il divieto.
//    Il divieto e' un trigger del database (`guardia_movimenti_tasca`,
//    migrazione `20260830000012`): dalla tasca escono soldi e basta, e
//    l'unica regola di deducibilita' ammessa e' «Indeducibile», che il
//    database mette da se' se nessuno gliela dice. Qui si decide soltanto
//    che cosa mostrare, per non offrire un gesto che verrebbe rifiutato.

// 🔴 LA CAUSALE VISIBILE SULLA TASCA. Non e' una riga di `cash_causali`:
//    e' la classificazione fiscale, ed e' l'unica possibile. Prima del
//    06/09 al suo posto c'era il menu delle causali di uscita — cioe' una
//    scelta che il database non poteva rispettare.
export const CAUSALE_TASCA = "Indeducibile";

// Come `speso_dalla_tasca()` chiama le righe che non hanno una causale
// salvata. Sta qui e non scritto a mano nella schermata perche' e' la
// parola con cui il database risponde, non una nostra etichetta.
export const SENZA_CAUSALE = "senza causale";

const DESCRIZIONE_ALTRI = {
  etichetta: "Finalità aziendale",
  segnaposto: "Finalità aziendale (facoltativo, utile in verifica)",
  conEtichetta: false,
};

// 🔴 IL CAMPO CAMBIA NOME SOLO SULLA TASCA (SPEC-0005). «Finalita'
//    aziendale» e' il linguaggio della verifica fiscale, e sulla tasca non
//    c'e' nessuna verifica fiscale da superare: li' quel riquadro serve a
//    dire **che cosa hai pagato**, e chi lo legge deve capirlo senza
//    tradurre.
// ⚠️ L'esempio porta il mese, ma il mese NON e' obbligatorio (decisione di
//    Alessio, 06/09): il testo resta libero. Un campo che rifiuta una
//    descrizione perche' manca il mese fa scrivere un mese finto pur di
//    andare avanti.
export function campoDescrizione(inTasca) {
  if (!inTasca) return { ...DESCRIZIONE_ALTRI };
  return {
    etichetta: "Descrizione della spesa",
    segnaposto: "Abbonamento AI — nome del servizio, mese",
    conEtichetta: true,
  };
}

// La causale da mostrare al posto del menu, oppure `null` quando il menu
// resta (tutti gli altri soggetti).
export function causaleFissa(inTasca) {
  return inTasca ? CAUSALE_TASCA : null;
}

// 🔴 SULLA TASCA NON SI SALVA NESSUNA CAUSALE, ed e' una conseguenza e non
//    una scelta a parte: se il menu non c'e', non c'e' niente da scegliere.
//    Il database non ne pretende una — quello che pretende e' la regola di
//    deducibilita', e se la scrive da solo.
export function causaleDaSalvare(inTasca, scelta) {
  if (inTasca) return null;
  return scelta || null;
}

// 🔴 LA SPACCATURA CHE DIREBBE IL CONTRARIO DEL MODULO (SPEC-0005, punto 1
//    della regia del 06/09). In cima alla schermata «Speso dalla tasca» si
//    apre per causale. Da quando la causale non si salva piu', quelle righe
//    sono tutte «senza causale» — e comparirebbero **sotto un modulo che ha
//    appena dichiarato «Indeducibile»**: due parti della stessa schermata
//    che raccontano cose diverse dello stesso fatto.
// ⚠️ SI TOGLIE LA RIGA, NON IL TOTALE: quanto e' uscito dalla tasca e' il
//    numero per cui quella riga esiste, e resta intero — comprese le somme
//    delle righe senza causale, che sono uscite vere.
// ⚠️ E NON SI TOGLIE LA STORIA: un movimento registrato prima del 06/09 con
//    una causale scelta a mano continua a comparire con la sua. Si toglie
//    l'assenza, non il dato.
export function spaccaturaTasca(righe) {
  return (righe ?? []).filter((r) => r?.causale && r.causale !== SENZA_CAUSALE);
}

export function totaleTasca(righe) {
  return (righe ?? []).reduce((t, r) => t + Number(r?.totale || 0), 0);
}
