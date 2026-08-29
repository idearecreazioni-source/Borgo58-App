import { Fragment } from "react";

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
  // 🔴 LE RIGHE CHE SI APRONO — 29/08/2026, Blocco 4 del mandato.
  //
  // Il Magazzino era rimasto l'unica tabella larga che questo componente
  // «non copre»: misurata a 375 punti sborda di **116**, e lo sbordo è
  // DENTRO il riquadro (`overflow-x-auto`) — dove la decisione del 21/08,
  // «mai scorrimento laterale», sembrava rispettata e non lo era.
  // Il pezzo che mancava non era la larghezza: era che quella tabella ha
  // **una riga che si apre**, con dentro un modulo.
  //
  //   · `azione(r)` → { etichetta, onClick, spenta } — il gesto della riga;
  //   · `aperta(r)` → cosa mostrare sotto, quando è aperta (null = chiusa).
  //
  // ⚠️ SE C'È UN'AZIONE, IL BLOCCHETTO NON È PIÙ UN PULSANTE. Un bottone
  // dentro un bottone non è HTML valido e sul telefono il tocco finisce a
  // chi capita — è la stessa trappola del numero di telefono dentro la
  // riga della prenotazione (19/08). Quindi con `azione` il riquadro
  // diventa un `div`, e se serve anche `onTocco` il titolo prende il suo
  // pulsante per conto proprio.
  azione,
  aperta,
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
          const gesto = azione?.(r);
          const dentroAperta = aperta?.(r);
          // Con un'azione il riquadro è un contenitore, non un pulsante:
          // dentro ci sta il gesto, e sotto quello che si apre.
          if (gesto || dentroAperta) {
            return (
              <div key={chiave(r)} className={stile}>
                {onTocco ? (
                  <button type="button" onClick={() => onTocco(r)} className="w-full text-left">
                    {dentro}
                  </button>
                ) : (
                  dentro
                )}
                {gesto && (
                  <button
                    type="button"
                    onClick={gesto.onClick}
                    disabled={gesto.spenta}
                    className="tocco-bottone mt-2 inline-flex items-center rounded-lg border border-b58-charcoal/15 hover:bg-b58-cream-dark transition-colors text-b58-charcoal testo-sala px-3 disabled:opacity-40"
                  >
                    {gesto.etichetta}
                  </button>
                )}
                {dentroAperta && <div className="mt-3">{dentroAperta}</div>}
              </div>
            );
          }
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
              {/* La colonna del gesto non ha intestazione: il pulsante dice
                  gia' cosa fa, e un titolo sopra sarebbe una parola in piu'
                  su una riga che ne ha gia' cinque. */}
              {azione && <th className="px-4 py-3"></th>}
            </tr>
          </thead>
          <tbody>
            {righe.map((r) => {
              const gesto = azione?.(r);
              const dentroAperta = aperta?.(r);
              return (
              <Fragment key={chiave(r)}>
              <tr
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
                {gesto && (
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      onClick={gesto.onClick}
                      disabled={gesto.spenta}
                      className="tocco-bottone text-b58-charcoal-soft hover:text-b58-terracotta-dark testo-sala disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                      {gesto.etichetta}
                    </button>
                  </td>
                )}
              </tr>
              {dentroAperta && (
                <tr className="bg-white">
                  <td colSpan={colonne.length + (azione ? 2 : 1)} className="px-4 py-3">
                    {dentroAperta}
                  </td>
                </tr>
              )}
              </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}
