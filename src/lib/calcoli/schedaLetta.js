// Che cosa si fa di una scheda letta da un'etichetta.
//
// ⚠️ SONO REGOLE PURE E STANNO QUI, non dentro il modulo del prodotto: in
//    questo progetto nessuna prova automatica apre una schermata, quindi
//    una regola scritta dentro un componente non e' provata da niente. Qui
//    invece si prova anche al contrario — con una scheda vuota, con un
//    campo che Alessio ha riscritto, con uno che ha riscritto uguale.

// I campi che una lettura d'etichetta puo' proporre. ⚠️ Lo stesso elenco
// vive nel database, dentro `marca_campi_dall_assistente`, che scarta
// quello che non riconosce: se i due si separano, il database lo dice
// invece di scrivere una marcatura muta.
export const CAMPI_PROPONIBILI = [
  "nome",
  "categoria",
  "unita",
  "conservazione",
  "durata",
  "temperatura",
  "stagionalita",
];

// Come si chiama, nel modulo, il campo che il database chiama cosi'.
const NEL_MODULO = {
  nome: "name",
  categoria: "category",
  unita: "unit",
  conservazione: "storage_type",
  durata: "shelf_life_days",
  temperatura: "temperatura_attesa",
  stagionalita: "seasonality",
};

/**
 * Da quello che l'assistente ha letto, i valori da mettere nei campi.
 *
 * ⚠️ NON SOVRASCRIVE CIO' CHE C'E' GIA'. Se Alessio stava correggendo un
 *    prodotto e aveva gia' scritto qualcosa, la lettura riempie i buchi e
 *    lascia stare il resto: una foto non deve cancellare quello che una
 *    persona ha appena digitato.
 *    ⚠️ Il nome fa eccezione solo quando il campo e' vuoto — cioe' nel
 *    caso vero, il prodotto nuovo.
 */
export function campiProposti(scheda, formAttuale = {}) {
  if (!scheda) return { valori: {}, proposti: [] };

  const vuoto = (v) =>
    v === null || v === undefined || v === "" || (Array.isArray(v) && v.length === 0);

  const candidati = {
    nome: scheda.nome ?? null,
    categoria: scheda.categoria ?? null,
    unita: scheda.unita ?? null,
    conservazione: scheda.conservazione ?? null,
    durata:
      scheda.durata_giorni === null || scheda.durata_giorni === undefined
        ? null
        : String(scheda.durata_giorni),
    temperatura: scheda.temperatura ?? null,
    stagionalita: Array.isArray(scheda.stagionalita) ? scheda.stagionalita : null,
  };

  const valori = {};
  const proposti = [];
  for (const campo of CAMPI_PROPONIBILI) {
    const proposto = candidati[campo];
    if (vuoto(proposto)) continue;
    if (!vuoto(formAttuale[NEL_MODULO[campo]])) continue;
    valori[NEL_MODULO[campo]] = proposto;
    proposti.push(campo);
  }
  return { valori, proposti };
}

/**
 * Fra i campi che l'assistente aveva proposto, quali sono arrivati intatti
 * al salvataggio: sono quelli su cui la marcatura «l'ha messo la macchina»
 * e' vera.
 *
 * ⚠️ IL CONFRONTO LO PUO' FARE SOLO IL MODULO: il database vede arrivare
 *    un valore e non ha modo di sapere se e' quello proposto o quello che
 *    Alessio ci ha scritto sopra.
 */
export function campiRimastiDellAssistente(valoriProposti, formAlSalvataggio) {
  if (!valoriProposti || !formAlSalvataggio) return [];
  const rimasti = [];
  for (const campo of CAMPI_PROPONIBILI) {
    const chiave = NEL_MODULO[campo];
    if (!(chiave in valoriProposti)) continue;
    const proposto = valoriProposti[chiave];
    const adesso = formAlSalvataggio[chiave];
    const uguali = Array.isArray(proposto)
      ? Array.isArray(adesso) &&
        proposto.length === adesso.length &&
        proposto.every((x) => adesso.includes(x))
      : String(proposto ?? "") === String(adesso ?? "");
    if (uguali) rimasti.push(campo);
  }
  return rimasti;
}

/**
 * Gli allergeni letti, tenendo solo quelli che sono rimasti nel modulo.
 *
 * ⚠️ SE ALESSIO NE HA TOLTO UNO, la sua origine non si scrive: quel
 *    prodotto per lui non ce l'ha, e conservare l'origine di un allergene
 *    che non c'e' vorrebbe dire affermare qualcosa su una cosa che non
 *    esiste. Se invece ne AGGIUNGE uno, quello non ha origine e in sala si
 *    legge «verificato da Alessio» — che e' vero.
 */
export function allergeniDaScrivere(scheda, allergeniNelModulo) {
  const letti = Array.isArray(scheda?.allergeni) ? scheda.allergeni : [];
  const tenuti = new Set(allergeniNelModulo ?? []);
  return letti
    .filter((a) => a?.codice && tenuti.has(a.codice))
    .map((a) => ({
      codice: a.codice,
      origine: a.origine ?? "dedotto",
      fonte: a.fonte ?? null,
    }));
}
