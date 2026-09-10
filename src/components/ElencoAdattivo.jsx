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
  // diventa un `div` che ASCOLTA il tocco (vedi `apribile` qui sotto).
  azione,
  aperta,
  // 🔴 LA NOTA IN FONDO AL QUADROTTO — 10/09/2026, Blocco 2 del mandato.
  //
  // Serve per la roba che non è un campo: non ha un'etichetta, non ha una
  // colonna, e **quasi sempre non c'è**. Nell'Agenda è la provenienza di un
  // impegno («nato dalla posta»), che come colonna diceva «scritto a mano»
  // su quasi tutte le righe — cioè occupava una riga per non dire niente.
  //
  // ⚠️ Restituire `null` la fa sparire del tutto, spazio compreso: una nota
  // che c'è sempre torna a essere una colonna, e siamo daccapo.
  nota,
  // 🔴 LA COLONNA DI SINISTRA — 10/09/2026, dal collaudo di Alessio: «il
  //    titolo del task deve partire dalla stessa colonna degli altri
  //    contenuti della scheda, su telefono e desktop».
  //
  //    Prima la spunta dell'Agenda stava DENTRO il titolo, quindi spingeva
  //    a destra solo lui: misurato con la prova visiva, i campi, la nota e
  //    «rimanda» partivano **34,7 punti più a sinistra** del titolo. Una
  //    scheda con due margini diversi si legge come due cose incollate.
  //
  //    ⚠️ La cura non è spostare i campi a mano di 34 punti: sarebbe un
  //    numero che vale per QUESTA spunta, a QUESTA densità, e si romperebbe
  //    alla prima calibrazione diversa del tablet. È dare alla spunta una
  //    colonna sua, e mettere tutto il resto nella colonna accanto: così
  //    titolo e contenuti partono dallo stesso punto **per costruzione**,
  //    qualunque sia la larghezza della spunta.
  inizio,
  vuoto = "—",
}) {
  if (!righe || righe.length === 0) return null;
  const colonne = campi(righe[0]);

  // 🔴 IL QUADROTTO INTERO SI APRE, E I SUOI COMANDI RESTANO INDIPENDENTI
  //    — 10/09/2026, Blocco 2 del mandato.
  //
  // Prima, dove il quadrotto aveva dei comandi dentro (l'Agenda: la spunta,
  // la stella, «rimanda»), il tocco che apre il dettaglio viveva **solo sul
  // titolo**: una striscia di testo alta un centimetro in mezzo a un
  // riquadro che sembrava tutto premibile. Sul telefono si finisce quasi
  // sempre a lato, e quel tocco non faceva niente.
  //
  // ⚠️ E LA CURA NON PUÒ ESSERE UN PULSANTE PIÙ GRANDE: un bottone dentro
  // un bottone non è HTML valido, e la spunta di «fatto» finirebbe per
  // aprire la scheda invece di chiudere l'impegno. Quindi il riquadro
  // diventa un `div` che ascolta il tocco, e **si tira indietro** quando il
  // tocco è arrivato a un comando suo — che è la regola qui sotto.
  //
  // ⚠️ SI GUARDA IL BERSAGLIO, NON SI CHIEDE AI COMANDI DI DIFENDERSI. La
  // strada alternativa era mettere uno `stopPropagation` su ognuno: sono
  // otto schermate, e il nono comando scritto da qui a sei mesi lo
  // dimenticherebbe **senza nessun errore** — aprirebbe la scheda e basta.
  // Questa regola invece copre anche i comandi che non esistono ancora.
  // ⚠️ E CIÒ CHE SI È APERTO SOTTO NON RICHIUDE IL QUADROTTO. Trovato
  //    facendo il censimento degli elenchi: in Magazzino il tocco APRE la
  //    riga, e dentro l'area aperta c'è un modulo. Senza questa riga un
  //    dito appoggiato accanto a un campo — su un'etichetta, su uno spazio
  //    vuoto — richiuderebbe la riga appena aperta, portandosi via quello
  //    che si stava scrivendo. `[data-non-apre]` marca quell'area.
  const daUnComando = (e) => {
    const c = e.target.closest("button, a, input, select, textarea, label, [data-non-apre]");
    return Boolean(c) && e.currentTarget.contains(c);
  };
  const apreLaRiga = (r) => (e) => {
    if (daUnComando(e)) return;
    onTocco(r);
  };
  // Con la tastiera si apre con Invio o barra spaziatrice, e **solo se il
  // fuoco è sul riquadro**: dentro un campo di testo la barra spaziatrice
  // deve scrivere uno spazio.
  const apreDaTastiera = (r) => (e) => {
    if (e.target !== e.currentTarget) return;
    if (e.key !== "Enter" && e.key !== " ") return;
    e.preventDefault();
    onTocco(r);
  };
  const fuocoVisibile =
    "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-b58-terracotta";

  // Tutto il contenuto di una scheda nella colonna di destra, e `inizio`
  // nella sua a sinistra. Senza `inizio` non cambia niente.
  const conInizio = (r, contenuto) => {
    const primo = inizio?.(r);
    if (!primo) return contenuto;
    return (
      <div className="flex items-start gap-3">
        <div className="shrink-0">{primo}</div>
        <div className="min-w-0 flex-1">{contenuto}</div>
      </div>
    );
  };

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
              {/* 🔴 `flex-wrap` e `min-w-0` — 30/08/2026, e questa l'ha
                  trovata la MISURA e non la rilettura: alla densita' di un
                  mini tablet (59,5 e 64 punti per centimetro, non i 37,8 di
                  un monitor) il titolo piu' il segno sbordavano di 8 punti.
                  ⚠️ E stava in un COMPONENTE, cioe' in tutti e otto gli
                  elenchi che lo usano: e' la famiglia del 22/08 — un difetto
                  che sta dappertutto non compare in nessun censimento per
                  schermate. */}
              <div className="flex flex-wrap items-baseline justify-between gap-3 mb-1">
                <span className="min-w-0 text-b58-charcoal font-medium testo-sala-grande" data-titolo>
                  {titolo(r)}
                </span>
                {segno?.(r)}
              </div>
              {tutte[i]
                .filter((c) => conQualcosa.has(c.chiave))
                .map((c) => (
                <p key={c.chiave} className="testo-sala-grande" data-campo>
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
          const suaNota = nota?.(r);
          const inFondo = suaNota ? (
            <p className="testo-sala text-b58-charcoal-soft/70 mt-2" data-nota>{suaNota}</p>
          ) : null;
          // Con un'azione il riquadro è un contenitore, non un pulsante:
          // dentro ci sta il gesto, e sotto quello che si apre. Ma se c'è
          // qualcosa da aprire, il tocco lo ascolta il riquadro INTERO.
          if (gesto || dentroAperta || inizio) {
            const apribile = Boolean(onTocco);
            return (
              <div
                key={chiave(r)}
                data-quadrotto
                className={apribile ? `${stile} cursor-pointer ${fuocoVisibile}` : stile}
                {...(apribile
                  ? {
                      role: "button",
                      tabIndex: 0,
                      onClick: apreLaRiga(r),
                      onKeyDown: apreDaTastiera(r),
                    }
                  : {})}
              >
                {conInizio(r, <>
                {dentro}
                {inFondo}
                {gesto && (
                  <button
                    type="button"
                    data-gesto
                    onClick={gesto.onClick}
                    disabled={gesto.spenta}
                    className="tocco-bottone mt-2 inline-flex items-center rounded-lg border border-b58-charcoal/15 hover:bg-b58-cream-dark transition-colors text-b58-charcoal testo-sala px-3 disabled:opacity-40"
                  >
                    {gesto.etichetta}
                  </button>
                )}
                {dentroAperta && (
                  <div className="mt-3" data-non-apre>
                    {dentroAperta}
                  </div>
                )}
                </>)}
              </div>
            );
          }
          // Senza un gesto non si costruisce un pulsante: un riquadro che si
          // preme e non fa niente insegna che premere non serve.
          return onTocco ? (
            <button key={chiave(r)} type="button" onClick={() => onTocco(r)} className={stile} data-quadrotto>
              {dentro}
              {inFondo}
            </button>
          ) : (
            <div key={chiave(r)} className={stile} data-quadrotto>
              {dentro}
              {inFondo}
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
                data-riga
                {...(onTocco
                  ? {
                      onClick: apreLaRiga(r),
                      onKeyDown: apreDaTastiera(r),
                      tabIndex: 0,
                      role: "button",
                    }
                  : {})}
                className={`border-b border-b58-charcoal/5 last:border-0 ${
                  onTocco ? `hover:bg-b58-cream-dark/40 cursor-pointer ${fuocoVisibile}` : ""
                } ${attenuata?.(r) ? "opacity-55" : ""}`}
              >
                <td className="px-4 py-3 text-b58-charcoal font-medium">
                  {conInizio(r, <>
                  {titolo(r)}
                  {segno?.(r)}
                  {nota?.(r) && (
                    <span className="block testo-sala font-normal text-b58-charcoal-soft/70 mt-0.5" data-nota>
                      {nota(r)}
                    </span>
                  )}
                  </>)}
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
