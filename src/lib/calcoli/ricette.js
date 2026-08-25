import { RECIPE_CATEGORIES, eComponente, labelFor, formatEUR } from "../constants";

// I CAMPI DI UNA RICETTA NELL'ELENCO, SCRITTI UNA VOLTA SOLA.
//
// ⚠️ Stessa forma di `campiPrenotazione` (18/08) e `campiIngrediente`
// (25/08), e per la stessa ragione: l'elenco si mostra come **tabella** sul
// computer e come **blocchetti** sul telefono, e due elenchi di colonne sono
// due posti che possono divergere in silenzio.
//
// 🔴 PERCHÉ ORA: misurata alla larghezza di un telefono (390 punti), la
// tabella delle ricette ne occupava **651** — sbordava di 277. Non si vedeva
// da un monitor, e non si vedeva nemmeno da una misura che confrontasse col
// bordo della FINESTRA invece che con la larghezza utile: la barra di
// scorrimento vale 17 punti, e con quelli in mezzo il conto sembrava tornare.
//
// ⚠️ NOME E STATO NON SONO FRA I CAMPI, come nelle prenotazioni: il nome è il
// titolo del blocchetto e lo stato è un cartellino colorato, non una riga
// «etichetta: valore».
//
// ⚠️ L'ETICHETTA DELLE PORZIONI SEGUE LA PORTA — un finger e una preparazione
// hanno una RESA, un piatto ha delle porzioni. Una colonna che si chiama
// sempre allo stesso modo racconterebbe una cosa falsa in due elenchi su tre.
export function campiRicetta(r, { porta, isTitolare, costo } = {}) {
  if (!r) return [];
  const campi = [
    {
      chiave: "categoria",
      etichetta: "Categoria",
      valore: labelFor(RECIPE_CATEGORIES, r.category),
    },
    {
      chiave: "porzioni",
      etichetta: eComponente(porta) ? "Resa" : "Porzioni",
      valore: eComponente(r.recipe_type)
        ? `${r.yield_quantity ?? "—"} ${r.yield_unit ?? ""}`.trim()
        : String(r.portions_yield ?? ""),
    },
  ];
  if (isTitolare) {
    campi.push({
      chiave: "costo",
      etichetta: "Food cost / porzione",
      valore: costo ? formatEUR(costo.food_cost_portion) : "",
      vuoto: "non calcolabile",
      forte: true,
    });
  }
  return campi;
}
