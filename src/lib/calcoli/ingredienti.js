import { labelFor, formatEUR } from "../constants";

// I CAMPI DI UN INGREDIENTE NELL'ELENCO, SCRITTI UNA VOLTA SOLA.
//
// ⚠️ PERCHÉ NON DUE ELENCHI, UNO PER FORMA. Dal 25/08 l'elenco ingredienti si
// mostra in due modi: una **tabella** sul computer e dei **blocchetti** sul
// telefono, coi dati a capo. È la stessa forma già usata dal Calendario
// Eventi dal 18/08 (`campiPrenotazione`), e la ragione è la stessa: due
// elenchi di colonne sono due posti che possono divergere — si aggiunge un
// dato alla tabella, ci si dimentica dei blocchetti, e il telefono resta
// indietro **in silenzio**.
//
// 🔴 PERCHÉ IL TELEFONO NON POTEVA PIÙ ASPETTARE, misurato: sei colonne in
// 390 punti facevano **sbordare la pagina di 646 punti**. Alessio il
// Ricettario lo guarda in cucina, col telefono appoggiato e le mani sporche.
//
// ⚠️ L'UNITÀ NON HA PIÙ UNA COLONNA SUA: era già dentro il prezzo
// («12,00 €/kg»), e un dato scritto due volte in una riga larga 390 punti è
// spazio tolto a quelli che mancano. Quando il prezzo non c'è l'unità resta
// comunque, fra parentesi: si perde il doppione, mai l'informazione.
//
// 🔴 E «NON ANCORA COMPRATO» NON È ZERO. `formatEUR(null)` restituisce
// «0,00 €», quindi un ingrediente mai acquistato si leggeva **gratis** —
// che è la stessa forma dello scarto a zero e dell'elenco allergeni vuoto.
// Un prezzo che non si conosce si dichiara.
// ⚠️ LE CATEGORIE ARRIVANO DA FUORI (27/08/2026), e non è un parametro di
// comodo: dal 27/08 sono DATI, e questo file non può più ridirle da sé —
// sarebbe una seconda verità che resta indietro appena Alessio ne aggiunge
// una. Chi chiama le ha già lette con `listCategorieIngrediente()`.
//
// ⚠️ E SE NON SONO ANCORA ARRIVATE si mostra il CODICE, non un vuoto: un
// codice è brutto e vero, un vuoto si legge «questo prodotto non ha
// categoria» — che è un'altra cosa (regola del 19/08).
export function campiIngrediente(ing, categorie = []) {
  if (!ing) return [];
  const prezzo =
    ing.current_price === null || ing.current_price === undefined
      ? { valore: "", vuoto: `non ancora comprato (${ing.unit})` }
      : { valore: `${formatEUR(ing.current_price)}/${ing.unit}` };
  return [
    {
      chiave: "categoria",
      etichetta: "Categoria",
      valore: labelFor(categorie, ing.category) || ing.category || "",
    },
    {
      chiave: "provenienza",
      etichetta: "Provenienza",
      valore:
        ing.source_type === "produzione_interna"
          ? "Produzione interna"
          : (ing.supplier?.name ?? ""),
      vuoto: "nessun fornitore",
    },
    { chiave: "prezzo", etichetta: "Prezzo", forte: true, ...prezzo },
    {
      chiave: "allergeni",
      etichetta: "Allergeni",
      valore:
        ing.allergens?.length > 0
          ? `${ing.allergens.length} allergen${ing.allergens.length === 1 ? "e" : "i"}`
          : "",
      vuoto: "nessuno",
    },
  ];
}
