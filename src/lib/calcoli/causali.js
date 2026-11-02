// Le causali spente (active = false) non compaiono nei menu, ma il nome
// resta occupato: il database vieta due causali con lo stesso nome e lo
// stesso tipo (unique (label, kind), confronto esatto). Chi ne aggiunge una
// con quel nome deve poter riaccendere quella spenta, non solo leggere un
// rifiuto.

/** La causale spenta con lo stesso nome (spazi ai bordi tolti) e tipo, se c'è. */
export function causaleSpentaOmonima(causali, label, kind) {
  const nome = String(label ?? "").trim();
  if (!nome) return null;
  return (causali ?? []).find((c) => !c.active && c.kind === kind && c.label === nome) ?? null;
}
