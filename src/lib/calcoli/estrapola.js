// «ESTRAPOLA» — le regole che la schermata non deve rifarsi da sola (R11).

/** Una riga che riguarda una ricetta intera (non si è potuta estrapolare). */
export const rigaDiRicetta = (r) => r.chiave?.startsWith("ricetta:") || r.chiave?.startsWith("bozza:");

/** «Dalle ricette: Amatriciana, Gricia» — il legame con chi l'ha generata. */
export function notaDalleRicette(da = []) {
  const nomi = (da ?? []).filter(Boolean);
  if (!nomi.length) return null;
  return `${nomi.length === 1 ? "Dalla ricetta" : "Dalle ricette"}: ${nomi.join(", ")}`;
}

/**
 * Le righe da mandare in lista: solo quelle TENUTE, con la quantità come
 * l'ha lasciata Alessio. ⚠️ Una quantità svuotata resta vuota (va in lista
 * «senza quantità»), non diventa zero.
 */
export function righeDaMettere(proposta, tenute, quantita) {
  return proposta
    .filter((r) => !rigaDiRicetta(r) && tenute[r.chiave])
    .map((r) => {
      const scritta = quantita[r.chiave];
      const q = scritta === undefined ? r.quantita : scritta === "" ? null : Number(String(scritta).replace(",", "."));
      return {
        ingredient_id: r.ingredient_id ?? null,
        nome: r.nome,
        quantita: Number.isFinite(q) && q > 0 ? q : null,
        unita: r.unita ?? null,
        nota: notaDalleRicette(r.da),
      };
    });
}
