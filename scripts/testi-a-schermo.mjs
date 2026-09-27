// IL TESTO CHE SI VEDE — 27/09/2026, primo batch visivo «niente tagliato».
//
// Regole sul testo mostrato a schermo, usate dalla prova visiva delle
// schermate (`prova-visiva-schermate.mjs`) sul testo della pagina GIÀ
// DISEGNATA: non leggono mai il sorgente, quindi un commento o un nome di
// variabile non possono farle scattare.

/**
 * Un accento scritto con l'apostrofo («e'», «piu'», «perche'»), nel TESTO
 * CHE SI VEDE — non nel sorgente: la prova lo chiede alla pagina disegnata,
 * quindi commenti e codice non ci arrivano mai. Restituisce la prima forma
 * trovata, o `null`.
 * ⚠️ Solo parole che in italiano un apostrofo in fondo NON lo vogliono: «po'»
 *    è corretto e resta fuori, come «l'», «un'», «dell'» (lì l'apostrofo sta
 *    davanti a un'altra parola).
 */
export function accentoConApostrofo(testo) {
  const m = testo.match(
    /(?:^|[^A-Za-zÀ-ÿ'])((?:c')?(?:e|se|ne|piu|puo|gia|perche|poiche|cosi|cioe|pero|finche|sara|verra|potra|dovra|meta|citta|deducibilita|qualita|quantita|attivita|novita)')(?=$|[^A-Za-zÀ-ÿ])/i,
  );
  return m ? m[1] : null;
}
