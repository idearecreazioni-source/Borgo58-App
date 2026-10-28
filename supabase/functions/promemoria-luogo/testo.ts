// =====================================================================
// IL TESTO DELLA NOTIFICA — 28/10/2026, promemoria per luogo
// =====================================================================
// La risposta e' testo semplice perche' l'automazione dell'iPhone la passa
// cosi' com'e' a «Mostra notifica»: niente da estrarre, niente da
// sbagliare.
//
// ⚠️ NIENTE DA FARE = TESTO VUOTO, deciso da Alessio: «nessuna notifica».
//    Una notifica «niente da fare» ogni sera si impara a ignorare, e poi si
//    ignora anche quella che conta. L'automazione mostra la notifica solo
//    se il testo ha un valore.
// ⚠️ UN TETTO DI RIGHE: una notifica non e' uno schermo. Oltre le prime
//    otto si dice quante altre ce ne sono, invece di tagliare in silenzio.
// Separato da index.ts perche' le prove lo leggano senza Deno.

export const LUOGHI: Record<string, string> = { casa: "Casa", ristorante: "Ristorante" };

export const RIGHE_MASSIME = 8;
export const CARATTERI_TITOLO = 60;

export function testoNotifica(
  luogo: string,
  impegni: { titolo: string }[],
  quanti: number,
): string {
  if (!impegni.length) return "";
  const nome = LUOGHI[luogo] ?? luogo;
  const righe = impegni.slice(0, RIGHE_MASSIME).map((i) => {
    const t = String(i.titolo ?? "").trim();
    return `• ${t.length > CARATTERI_TITOLO ? `${t.slice(0, CARATTERI_TITOLO - 1)}…` : t}`;
  });
  const totale = Math.max(quanti, impegni.length);
  const altre = totale - righe.length;
  if (altre > 0) righe.push(`…e altr${altre === 1 ? "a" : "e"} ${altre}`);
  const intestazione = totale === 1 ? `${nome}: 1 cosa da fare` : `${nome}: ${totale} cose da fare`;
  return [intestazione, ...righe].join("\n");
}
