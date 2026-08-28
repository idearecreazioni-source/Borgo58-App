// L'ELENCO CHE CAMBIA FORMA COL DISPOSITIVO — 29/08/2026
//
// 🔴 PERCHE' ESISTE. La larghezza e' il difetto piu' ripetuto di questo
// progetto, e finora e' stato curato una schermata alla volta. Misurato il
// 29/08 su 60 schermate del gestionale: **15 costringono a scorrere di
// lato**, e tutte e 15 sono tabelle — dai 7 punti di Mance ai 377 di «Come
// sta andando», che chiede 680 punti dove ce ne sono 303.
//
// ⚠️ E LA PAGINA NON SCORREVA MAI: in tutte e 15 lo scorrimento era DENTRO
// il riquadro (`overflow-x-auto`), quindi la decisione del 21/08 — «mai
// scorrimento laterale» — sembrava rispettata. Non lo era: era stata
// spostata di un livello, dove nessuno la misurava.
//
// ⚠️ LA FORMA NON E' NUOVA: e' quella decisa il 25/08 — blocchetti sul
// telefono, tabella sul computer — che pero' era stata RICOPIATA A MANO in
// cinque schermate su trentadue. Copiata cinque volte, una regola sta in
// piedi in un posto solo: qui vive una volta, e chi scrive un elenco nuovo
// non puo' piu' farlo nascere storto.
//
// ⚠️ I CAMPI SI DICHIARANO UNA VOLTA SOLA (`campi`), e da quella
// dichiarazione escono TUTT'E DUE le forme. Due elenchi di colonne — uno
// per la tabella e uno per i blocchetti — divergono in silenzio, e a
// restare indietro sarebbe il telefono, che e' la strada maestra.

export default function ElencoAdattivo({
  righe,
  chiave,
  // Il dato che identifica la riga: grosso in cima al blocchetto, prima
  // colonna nella tabella. Sta fuori da `campi` perche' nel blocchetto non
  // si comporta come gli altri — non ha etichetta, e si legge da lontano.
  titolo,
  intestazioneTitolo = "Nome",
  campi,
  onTocco,
  // Un segno accanto al titolo (es. «disattivato»): si vede in tutte e due
  // le forme, perche' senza, accendendo un filtro l'elenco si allunga e non
  // si capisce quali righe sono comparse.
  segno,
  attenuata,
  vuoto = "—",
}) {
  if (!righe || righe.length === 0) return null;
  const colonne = campi(righe[0]);

  // 🔴 UNA COLONNA VUOTA PER TUTTI NON SI MOSTRA SUL TELEFONO (29/08/2026).
  // Nasce dai Fornitori: «Categoria» diceva «—» su tutti e undici, e su un
  // blocchetto ogni riga inutile e' una riga in meno di quelle che servono.
  // ⚠️ NON si toglie la colonna dal computer: il campo e' compilabile dalla
  // scheda del fornitore — misurato — quindi e' un dato legittimo che oggi
  // e' solo vuoto, e toglierlo lo renderebbe irraggiungibile il giorno che
  // Alessio lo compila.
  // ⚠️ E il criterio e' «vuota per TUTTI», non «vuota su questa riga»: cosi'
  // i blocchetti restano tutti della stessa forma. Righe che cambiano forma
  // una dall'altra si leggono peggio di una riga vuota in piu'.
  const tutte = righe.map((r) => campi(r));
  const conQualcosa = new Set();
  tutte.forEach((cs) => cs.forEach((c) => c.valore && conQualcosa.add(c.chiave)));

  return (
    <>
      {/* SUL TELEFONO: un blocchetto per riga, coi dati a capo.
          ⚠️ `print:hidden` non e' un di piu': senza, chi stampa la
          Tracciabilita' o un registro DAL TELEFONO porterebbe all'ispettore
          un foglio di blocchetti invece della tabella. Sulla carta la
          larghezza non e' quella dello schermo, quindi il motivo per cui i
          blocchetti esistono li' non c'e'. */}
      <div className="md:hidden print:hidden space-y-3">
        {righe.map((r, i) => {
          const dentro = (
            <>
              <div className="flex items-baseline justify-between gap-3 mb-1">
                <span className="text-b58-charcoal font-medium testo-sala-grande">
                  {titolo(r)}
                </span>
                {segno?.(r)}
              </div>
              {tutte[i]
                .filter((c) => conQualcosa.has(c.chiave))
                .map((c) => (
                <p key={c.chiave} className="testo-sala-grande">
                  <span className="text-b58-charcoal-soft">{c.etichetta}: </span>
                  {c.valore ? (
                    <span
                      className={c.forte ? "text-b58-charcoal font-medium" : "text-b58-charcoal"}
                    >
                      {c.valore}
                    </span>
                  ) : (
                    <span className="text-b58-charcoal-soft/70 italic">{c.vuoto ?? vuoto}</span>
                  )}
                </p>
              ))}
            </>
          );
          const stile = `w-full text-left rounded-xl bg-b58-parchment ring-1 ring-b58-charcoal/10 p-4 ${
            attenuata?.(r) ? "opacity-55" : ""
          }`;
          // Senza un gesto non si costruisce un pulsante: un riquadro che si
          // preme e non fa niente insegna che premere non serve.
          return onTocco ? (
            <button key={chiave(r)} type="button" onClick={() => onTocco(r)} className={stile}>
              {dentro}
            </button>
          ) : (
            <div key={chiave(r)} className={stile}>
              {dentro}
            </div>
          );
        })}
      </div>

      {/* SUL COMPUTER E SULLA CARTA: la tabella. */}
      <div className="hidden md:block print:block rounded-xl bg-b58-parchment ring-1 ring-b58-charcoal/10 overflow-hidden overflow-x-auto print:ring-0 print:bg-transparent">
        <table className="w-full testo-sala-grande">
          <thead>
            <tr className="text-left text-b58-charcoal-soft border-b border-b58-charcoal/10">
              <th className="px-4 py-3 font-medium">{intestazioneTitolo}</th>
              {colonne.map((c) => (
                <th key={c.chiave} className="px-4 py-3 font-medium">
                  {c.etichetta}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {righe.map((r) => (
              <tr
                key={chiave(r)}
                onClick={onTocco ? () => onTocco(r) : undefined}
                className={`border-b border-b58-charcoal/5 last:border-0 ${
                  onTocco ? "hover:bg-b58-cream-dark/40 cursor-pointer" : ""
                } ${attenuata?.(r) ? "opacity-55" : ""}`}
              >
                <td className="px-4 py-3 text-b58-charcoal font-medium">
                  {titolo(r)}
                  {segno?.(r)}
                </td>
                {campi(r).map((c) => (
                  <td
                    key={c.chiave}
                    className={`px-4 py-3 ${c.forte ? "text-b58-charcoal font-medium" : "text-b58-charcoal-soft"}`}
                  >
                    {c.valore || (
                      <span className="text-b58-charcoal-soft/70 italic">{c.vuoto ?? vuoto}</span>
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
