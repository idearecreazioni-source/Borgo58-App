import { DEDUCTION_CATEGORIES, RAPPRESENTANZA_PLAFOND_RATE } from "./constants";

const catRule = (cat) => DEDUCTION_CATEGORIES.find((c) => c.value === cat);

// La regola contanti 2025 (§6): per trasferte e rappresentanza, il pagamento
// in contanti rende la spesa indeducibile (salvo esenzioni: biglietti di
// linea, indennità km).
export function expenseCashRuleFails(expense) {
  const rule = catRule(expense.category);
  return Boolean(
    rule?.cashRule && expense.payment_method === "contante" && !expense.exempt_from_cash_rule
  );
}

// Quota "ammessa" prima del plafond: 0 se bocciata dalla regola contanti,
// altrimenti importo × percentuale deducibile della categoria (es. 75% trasferte).
export function expenseEligibleAmount(expense) {
  if (expenseCashRuleFails(expense)) return 0;
  const rule = catRule(expense.category);
  return Number(expense.amount) * (rule?.rate ?? 1);
}

// Aggregato per categoria + applicazione del plafond rappresentanza.
// annualRevenue serve solo al plafond; se assente, la rappresentanza non
// viene limitata ma lo si segnala in UI.
export function computeDeducibility(expenses, { annualRevenue } = {}) {
  const plafond = annualRevenue ? Number(annualRevenue) * RAPPRESENTANZA_PLAFOND_RATE : null;
  const byCat = {};
  DEDUCTION_CATEGORIES.forEach((c) => {
    byCat[c.value] = { category: c.value, total: 0, eligible: 0, cashExcluded: 0, count: 0 };
  });

  expenses.forEach((e) => {
    const b = byCat[e.category];
    if (!b) return;
    b.total += Number(e.amount);
    b.count += 1;
    if (expenseCashRuleFails(e)) b.cashExcluded += Number(e.amount);
    else b.eligible += expenseEligibleAmount(e);
  });

  const rappr = byCat.rappresentanza;
  rappr.plafond = plafond;
  rappr.deductible = plafond != null ? Math.min(rappr.eligible, plafond) : rappr.eligible;
  rappr.overPlafond = plafond != null && rappr.eligible > plafond ? rappr.eligible - plafond : 0;

  Object.values(byCat).forEach((b) => {
    if (b.category !== "rappresentanza") b.deductible = b.eligible;
  });

  const totalDeductible = Object.values(byCat).reduce((s, b) => s + b.deductible, 0);
  const totalSpent = Object.values(byCat).reduce((s, b) => s + b.total, 0);
  return { byCat, totalDeductible, totalSpent, plafond };
}
