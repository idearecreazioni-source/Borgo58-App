import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import Didascalia from "../../components/Didascalia";
import { leggi, nonLetto } from "../../lib/calcoli/letture";
import {
  annullaAzione,
  azioniDellaDettatura,
  azioniInAttesa,
  chiaviVoce,
  confermaAzione,
  creaChiaveVoce,
  mandaDettato,
  revocaChiaveVoce,
  scegliPerAzione,
} from "../../lib/api/voce";
import { spesaAiDelMese } from "../../lib/api/assistenteFoto";
import {
  comeEAndata,
  componiDettato,
  creaRiconoscitore,
  daQuantoAspetta,
  fraseDelMicrofono,
  perchéAspetta,
  riconoscitoreDisponibile,
  statoDettatura,
  unaVoltaSola,
} from "../../lib/calcoli/voce";
import { formatEUR } from "../../lib/constants";

// =====================================================================
// PARLA E BASTA — i comandi vocali
// =====================================================================
// 🔴 SI PREME PER ACCENDERE, SI RIPREME PER SPEGNERE. Mai tenere premuto:
//    è una decisione di Alessio del 24/08, e la ragione è che in cella si
//    hanno le mani occupate — tenere premuto vuol dire una mano in meno
//    per tutto il tempo in cui si parla.
//
// 🔴 SI DETTA UNA FILZA IN UNA VOLTA SOLA. «Pomodori due casse, olio tre
//    bottiglie, tonno cinque scatole» è UNA registrazione e TRE azioni.
//
// 🔴 IL RISCONTRO ARRIVA ALLA FINE, MAI DOPO OGNI FRASE. In cella non
//    sente, e con le mani occupate non guarda: dirgli qualcosa a metà
//    serve solo a fargli perdere il filo.
//
// ⚠️ L'AUDIO NON ESCE DA QUESTO DISPOSITIVO. Il riconoscimento vocale gira
//    nel browser; quello che parte verso il gestionale è già testo. Non
//    c'è nessuna registrazione da conservare né da cancellare.

export default function Detta() {
  const [ascolto, setAscolto] = useState(false);
  const [frasi, setFrasi] = useState([]);
  const [parziale, setParziale] = useState("");
  const [stato, setStato] = useState("");
  const [errore, setErrore] = useState("");
  const [inCorso, setInCorso] = useState(false);
  const [riscontro, setRiscontro] = useState(null);
  const [attesa, setAttesa] = useState(null);
  const [spesa, setSpesa] = useState(null);
  const [chiavi, setChiavi] = useState(null);
  const [chiaveNuova, setChiaveNuova] = useState(null);
  const [nomeChiave, setNomeChiave] = useState("iPhone di Alessio");
  const [apriChiavi, setApriChiavi] = useState(false);
  const [apriGuida, setApriGuida] = useState(false);

  const recRef = useRef(null);
  const frasiRef = useRef([]);
  const disponibile = riconoscitoreDisponibile();
  // ⚠️ PERCHE' manca, non solo SE manca: la fascia di prima accusava il
  //    browser anche quando il browser era giusto e a mancare era il modo in
  //    cui la pagina girava. Vedi statoDettatura() in calcoli/voce.js.
  const perche = statoDettatura();

  const ricarica = useCallback(() => {
    leggi(azioniInAttesa()).then(setAttesa);
    leggi(spesaAiDelMese()).then(setSpesa);
  }, []);

  useEffect(() => {
    ricarica();
    return () => {
      try {
        recRef.current?.stop();
      } catch {
        /* già ferma */
      }
      recRef.current = null;
    };
  }, [ricarica]);

  // -------------------------------------------------------------------
  // Il microfono
  // -------------------------------------------------------------------
  const spegni = useCallback(() => {
    const rec = recRef.current;
    recRef.current = null;
    try {
      rec?.stop();
    } catch {
      /* già ferma */
    }
    setAscolto(false);
    setParziale("");
  }, []);

  const manda = useCallback(
    async (testo) => {
      if (!testo) {
        setStato("Non ho sentito niente.");
        return;
      }
      setInCorso(true);
      setErrore("");
      setStato("Sto capendo quello che hai detto…");
      try {
        const esito = await mandaDettato(testo);
        // ⚠️ Anche quando l'assistente non ha risposto, la dettatura è
        //    stata registrata col suo testo: si legge lo stesso, e quello
        //    che ha detto non si perde.
        const id = esito?.dettatura_id ?? esito?.dettatura?.dettatura_id;
        const azioni = id ? await azioniDellaDettatura(id) : [];
        setRiscontro({ ...comeEAndata(azioni), testo, messaggio: esito?.messaggio ?? null });
        setFrasi([]);
        frasiRef.current = [];
        setStato("");
        ricarica();
      } catch (e) {
        setErrore(e.message);
        setStato("");
      } finally {
        setInCorso(false);
      }
    },
    [ricarica],
  );

  const accendi = () => {
    setErrore("");
    setRiscontro(null);
    if (!disponibile) {
      setErrore(`${perche.frase} ${perche.cosaFare}`);
      return;
    }

    const rec = creaRiconoscitore();
    frasiRef.current = [];
    setFrasi([]);
    setParziale("");

    rec.onstart = () => setStato("Ti sto ascoltando. Di' pure tutto di fila.");
    rec.onaudiostart = () => setStato("Microfono aperto: parla pure.");

    rec.onresult = (e) => {
      let corrente = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const testo = e.results[i][0].transcript;
        if (e.results[i].isFinal) {
          frasiRef.current = [...frasiRef.current, testo.trim()];
          setFrasi(frasiRef.current);
        } else {
          corrente += testo;
        }
      }
      setParziale(corrente);
    };

    // ⚠️ Nessun errore viene nascosto perché «di solito è innocuo»: è la
    //    lezione del 12/08, quando un errore trattato come silenzio
    //    produsse una pagina che non faceva niente e non lo diceva.
    rec.onerror = (e) => {
      const { frase, ferma } = fraseDelMicrofono(e.error);
      if (ferma) {
        setErrore(frase);
        spegni();
      } else {
        setStato(frase);
      }
    };

    // ⚠️ Il riconoscimento si chiude da sé dopo una pausa lunga, anche in
    //    continuo. Se l'ascolto è ancora acceso lo si riapre, altrimenti
    //    una pausa mentre si cerca un barattolo chiuderebbe la filza a
    //    metà — e la seconda parte andrebbe persa senza dire niente.
    rec.onend = () => {
      if (recRef.current === rec) {
        try {
          rec.start();
        } catch {
          setAscolto(false);
        }
      }
    };

    recRef.current = rec;
    setAscolto(true);
    try {
      rec.start();
    } catch (e) {
      setErrore(`Il microfono non si è aperto: ${e.message}`);
      spegni();
    }
  };

  const fermaEManda = () => {
    const testo = componiDettato(frasiRef.current, parziale);
    spegni();
    setStato("");
    manda(testo);
  };

  // -------------------------------------------------------------------
  // Confermare e annullare
  // -------------------------------------------------------------------
  // 🔴 IL DOPPIO INVIO NON SI RENDE IMPROBABILE: SI RENDE IMPOSSIBILE.
  //    Il pulsante spento arriva al render dopo, e fra il tocco e il render
  //    chi non vede succedere niente ripreme — è quello che ha fatto Alessio
  //    la notte del 27/08 su un movimento di cassa. Questa guardia è
  //    SINCRONA: il secondo tocco non parte nemmeno.
  //    ⚠️ Il database ha comunque l'ultima parola (una cosa già eseguita
  //       viene respinta sotto blocco): qui si toglie il secondo giro di
  //       rete e il secondo messaggio, che è ciò che confonde chi guarda.
  const [inAzione, setInAzione] = useState(null);
  const [esiti, setEsiti] = useState({});
  const guardia = useRef(unaVoltaSola());

  // ⚠️ L'esito sta SULLA RIGA che è stata toccata, non in cima alla pagina:
  //    «un rifiuto lontano dal gesto è un rifiuto che non c'è», ed è la
  //    lezione del 17/08 pagata già una volta in Cassa.
  const segna = (id, esito) => setEsiti((e) => ({ ...e, [id]: esito }));

  const conferma = async (azione) => {
    if (!guardia.current.prendi(azione.id)) return;
    setInAzione(azione.id);
    segna(azione.id, { stato: "in_corso" });
    setErrore("");
    try {
      await confermaAzione(azione.id);
      segna(azione.id, { stato: "fatta" });
      ricarica();
      if (riscontro) {
        const azioni = await azioniDellaDettatura(azione.dettatura_id ?? riscontro.dettaturaId);
        if (azioni.length) setRiscontro((r) => ({ ...comeEAndata(azioni), testo: r.testo }));
      }
    } catch (e) {
      segna(azione.id, { stato: "fallita", messaggio: e.message });
    } finally {
      guardia.current.lascia(azione.id);
      setInAzione(null);
    }
  };

  // ⚠️ Stessa guardia sincrona di «Sì, fallo», e con la STESSA chiave:
  //    i due pulsanti fanno la stessa scrittura, quindi non devono poter
  //    partire tutt'e due sulla stessa riga.
  const scegli = async (azione, sceltaId) => {
    if (!guardia.current.prendi(azione.id)) return;
    setInAzione(azione.id);
    segna(azione.id, { stato: "in_corso" });
    setErrore("");
    try {
      await scegliPerAzione(azione.id, sceltaId);
      segna(azione.id, { stato: "fatta" });
      ricarica();
      if (riscontro) {
        const azioni = await azioniDellaDettatura(azione.dettatura_id ?? riscontro.dettaturaId);
        if (azioni.length) setRiscontro((r) => ({ ...comeEAndata(azioni), testo: r.testo }));
      }
    } catch (e) {
      segna(azione.id, { stato: "fallita", messaggio: e.message });
    } finally {
      guardia.current.lascia(azione.id);
      setInAzione(null);
    }
  };

  const annulla = async (azione) => {
    if (!guardia.current.prendi(azione.id)) return;
    setInAzione(azione.id);
    segna(azione.id, { stato: "in_corso" });
    setErrore("");
    try {
      await annullaAzione(azione.id);
      ricarica();
      setRiscontro((r) =>
        r ? { ...r, daGuardare: r.daGuardare.filter((a) => a.id !== azione.id) } : r,
      );
    } catch (e) {
      segna(azione.id, { stato: "fallita", messaggio: e.message });
    } finally {
      guardia.current.lascia(azione.id);
      setInAzione(null);
    }
  };

  // -------------------------------------------------------------------
  // Le chiavi della Scorciatoia
  // -------------------------------------------------------------------
  const mostraChiavi = () => {
    setApriChiavi((a) => !a);
    if (chiavi === null) leggi(chiaviVoce()).then(setChiavi);
  };

  const nuovaChiave = async () => {
    setErrore("");
    try {
      const c = await creaChiaveVoce(nomeChiave);
      setChiaveNuova(c);
      leggi(chiaviVoce()).then(setChiavi);
    } catch (e) {
      setErrore(e.message);
    }
  };

  const togliChiave = async (id) => {
    setErrore("");
    try {
      await revocaChiaveVoce(id);
      setChiaveNuova(null);
      leggi(chiaviVoce()).then(setChiavi);
    } catch (e) {
      setErrore(e.message);
    }
  };

  // 🔴 IL DOPPIONE — visto a schermo da Alessio, due volte. La stessa riga
  //    compariva in DUE riquadri: quello di quello che ha appena detto e
  //    quello delle cose che aspettano da prima, ognuno col suo «Sì,
  //    fallo». La prima volta ha creduto di aver parlato due volte; la
  //    seconda ha parlato una volta sola e il doppione c'era lo stesso.
  //
  // ⚠️ Comanda il riquadro di SOPRA, non quello di sotto: è quello che sta
  //    guardando adesso, e ha accanto il testo che ha appena detto. Le
  //    pendenze sono «quello che aspetta da PRIMA», e una riga di dieci
  //    secondi fa non è da prima.
  const giaSopra = new Set((riscontro?.daGuardare ?? []).map((a) => a.id));
  const daGuardareOra = (Array.isArray(attesa) ? attesa : []).filter((a) => !giaSopra.has(a.id));
  const dettato = componiDettato(frasi, parziale);

  return (
    <div className="max-w-3xl mx-auto">
      <div className="mb-6">
        <h1 className="font-display text-2xl md:text-3xl text-b58-charcoal">Parla e basta</h1>
        <Didascalia testo="Premi una volta per accendere il microfono, di' tutto quello che ti serve di fila, poi ripremi per fermare. Quello che l'assistente capisce con sicurezza lo scrive da sé; il resto te lo chiede." />
      </div>

      {errore && (
        <p className="testo-sala text-b58-terracotta-dark mb-4 rounded-lg bg-b58-terracotta/10 px-3 py-2">
          {errore}
        </p>
      )}

      {/* ------------------------------------------------------------
          IL MICROFONO
          🔴 È il bersaglio più usato di questa schermata: sta a 1,2 cm
             reali (`.tocco-azione`), cioè il gesto principale, non un
             pulsantino. E il segno che sta ascoltando deve vedersi da
             lontano con le mani occupate: pulsante rosso, pulsazione,
             e la parola scritta accanto.
         ------------------------------------------------------------ */}
      <div className="rounded-xl border border-b58-cream-dark bg-white p-4 md:p-6">
        <button
          type="button"
          onClick={ascolto ? fermaEManda : accendi}
          disabled={inCorso}
          className={`tocco-azione w-full rounded-xl px-4 font-medium transition-colors disabled:opacity-60 ${
            ascolto
              ? "bg-b58-terracotta text-white animate-pulse"
              : "bg-b58-charcoal text-white hover:bg-b58-charcoal-soft"
          }`}
        >
          <span className="testo-sala-lontano">
            {inCorso ? "Sto capendo…" : ascolto ? "◼ Ferma e manda" : "🎙 Premi e parla"}
          </span>
        </button>

        {/* 🔴 IL SEGNO CHE STA ASCOLTANDO — decisione di Alessio del 24/08 e
            ripetuta il 25/08: **bene visibile**. La notte del 27/08 ha
            parlato, gli è sembrato che non lo ascoltasse, e ha ripetuto
            tutto: il pallino da 3 mm accanto a una riga da 3,2 non si vede
            con le mani occupate e il telefono appoggiato.
            ⚠️ Tre segni insieme, e non è ridondanza: il pulsante che pulsa
               si vede da lontano, il pallino dice «adesso», e il CONTATORE
               delle frasi capite è l'unico che dimostra che sta capendo —
               un'animazione va avanti uguale anche se il microfono è morto. */}
        {ascolto && (
          <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg bg-b58-terracotta/10 px-3 py-2">
            <span className="inline-block h-4 w-4 shrink-0 rounded-full bg-b58-terracotta animate-pulse" />
            <span className="testo-sala-lontano font-medium text-b58-terracotta-dark">
              Ti sto ascoltando
            </span>
            <span className="testo-sala text-b58-charcoal-soft">
              {frasi.length === 0
                ? "parla pure, di' tutto di fila"
                : frasi.length === 1
                  ? "1 cosa sentita finora"
                  : `${frasi.length} cose sentite finora`}
            </span>
          </div>
        )}

        {stato && !ascolto && <p className="testo-sala mt-3 text-b58-charcoal-soft">{stato}</p>}

        {dettato && (
          <div className="mt-4 rounded-lg bg-b58-cream px-3 py-3">
            <p className="testo-sala text-b58-charcoal">
              {frasi.join(" ")}
              {parziale && <span className="text-b58-charcoal-soft"> {parziale}</span>}
            </p>
          </div>
        )}

        {!disponibile && (
          <div className="testo-sala mt-3 rounded-lg bg-b58-gold/15 ring-1 ring-b58-gold-dark/30 px-3 py-2">
            <p className="text-b58-charcoal font-medium">{perche.frase}</p>
            <p className="text-b58-charcoal-soft mt-0.5">{perche.cosaFare}</p>
          </div>
        )}

        {spesa && !nonLetto(spesa) && spesa.tetto_euro != null && (
          <p className="testo-sala mt-3 text-b58-charcoal-soft">
            Assistente, questo mese: {formatEUR(spesa.speso_euro)} su {formatEUR(spesa.tetto_euro)}.{" "}
            <Link to="/fotografa" className="text-b58-terracotta hover:underline">
              Il tetto si cambia da qui →
            </Link>
          </p>
        )}
      </div>

      {/* ------------------------------------------------------------
          IL RISCONTRO — arriva ALLA FINE, e sono due elenchi
         ------------------------------------------------------------ */}
      {riscontro && (
        <div className="mt-6 rounded-xl border border-b58-cream-dark bg-white p-4 md:p-6">
          <h2 className="testo-sala-lontano font-medium text-b58-charcoal">{riscontro.titolo}</h2>
          <p className="testo-sala mt-1 text-b58-charcoal-soft">Hai detto: «{riscontro.testo}»</p>
          {riscontro.messaggio && (
            <p className="testo-sala mt-2 text-b58-charcoal-soft">{riscontro.messaggio}</p>
          )}

          {riscontro.fatte.length > 0 && (
            <ul className="mt-4 space-y-1">
              {riscontro.fatte.map((a) => (
                <li
                  key={a.id}
                  className="tocco-riga flex items-center gap-2 rounded-lg bg-b58-olive/10 px-3 testo-sala text-b58-charcoal"
                >
                  <span aria-hidden="true">✓</span>
                  <span>{a.frase}</span>
                </li>
              ))}
            </ul>
          )}

          {riscontro.daGuardare.length > 0 && (
            <div className="mt-4">
              <h3 className="testo-sala font-medium text-b58-charcoal mb-2">
                Queste te le chiedo:
              </h3>
              <ul className="space-y-2">
                {riscontro.daGuardare.map((a) => (
                  <RigaDaGuardare
                    key={a.id}
                    azione={a}
                    occupato={inAzione === a.id}

                    esito={esiti[a.id]}
                    onConferma={() => conferma(a)}
                    onAnnulla={() => annulla(a)}
                    onScegli={(id) => scegli(a, id)}
                  />
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* ------------------------------------------------------------
          QUELLO CHE ASPETTA DA PRIMA
          🔴 NIENTE SCADE. Questo elenco non si svuota da solo: è il
             «glielo si ricorda il giorno dopo» del mandato, fatto
             mostrando invece che cancellando.
         ------------------------------------------------------------ */}
      {nonLetto(attesa) ? (
        <p className="testo-sala mt-6 text-b58-terracotta-dark">
          Non sono riuscito a leggere le cose che aspettano.{" "}
          <button type="button" onClick={ricarica} className="tocco-inline underline">
            Riprova
          </button>
        </p>
      ) : (
        daGuardareOra.length > 0 && (
          <div className="mt-6 rounded-xl border border-b58-cream-dark bg-white p-4 md:p-6">
            <h2 className="testo-sala-lontano font-medium text-b58-charcoal">
              {daGuardareOra.length === 1
                ? "Una cosa detta aspetta ancora"
                : `${daGuardareOra.length} cose dette aspettano ancora`}
            </h2>
            <ul className="mt-3 space-y-2">
              {daGuardareOra.map((a) => (
                <RigaDaGuardare
                  key={a.id}
                  azione={a}
                  quando={daQuantoAspetta(a.giorni)}
                  occupato={inAzione === a.id}

                  esito={esiti[a.id]}
                  onConferma={() => conferma(a)}
                  onAnnulla={() => annulla(a)}
                  onScegli={(id) => scegli(a, id)}
                />
              ))}
            </ul>
          </div>
        )
      )}

      {/* ------------------------------------------------------------
          LE CHIAVI DELLA SCORCIATOIA
         ------------------------------------------------------------ */}
      <div className="mt-6 rounded-xl border border-b58-cream-dark bg-white p-4 md:p-6">
        <button
          type="button"
          onClick={mostraChiavi}
          className="tocco-riga flex w-full items-center justify-between rounded-lg px-1 text-left"
        >
          <span className="testo-sala font-medium text-b58-charcoal">
            Parlare senza aprire il gestionale
          </span>
          <span aria-hidden="true" className="testo-sala text-b58-charcoal-soft">
            {apriChiavi ? "▲" : "▼"}
          </span>
        </button>

        {apriChiavi && (
          <div className="mt-3">
            <p className="testo-sala text-b58-charcoal-soft">
              Con una Scorciatoia dell'iPhone puoi dettare dall'orologio senza tirare fuori il
              telefono. Serve una chiave, e la chiave si vede una volta sola.
            </p>
            {/* ⚠️ MISURATO, non stimato: dentro il paragrafo questo gesto
                faceva 7,87 mm di altezza a 390 punti — sotto la soglia
                degli 8,5. Il testo resta uguale, il bersaglio cresce col
                padding: si tocca la riga, non le lettere.
                ⚠️ E LE ISTRUZIONI STANNO QUI DENTRO, non in un documento
                a parte: si seguono SUL TELEFONO mentre si costruisce la
                Scorciatoia, e mandarlo su un secondo schermo vorrebbe
                dire perdere il segno a ogni passo. */}
            <button
              type="button"
              onClick={() => setApriGuida((g) => !g)}
              className="tocco-riga mt-1 inline-flex items-center rounded-lg px-2 -mx-1 testo-sala text-b58-terracotta hover:underline"
            >
              {apriGuida ? "Nascondi i passaggi" : "Come si fa, passo per passo →"}
            </button>

            {apriGuida && <GuidaScorciatoia />}

            {chiaveNuova && (
              <div className="mt-3 rounded-lg border border-b58-terracotta bg-b58-terracotta/5 p-3">
                <p className="testo-sala font-medium text-b58-charcoal">
                  Ecco la chiave «{chiaveNuova.nome}». Copiala adesso: non si vedrà più.
                </p>
                <code className="mt-2 block break-all rounded bg-white px-2 py-2 testo-sala">
                  {chiaveNuova.chiave}
                </code>
              </div>
            )}

            <div className="mt-3 flex flex-wrap items-center gap-2">
              <input
                value={nomeChiave}
                onChange={(e) => setNomeChiave(e.target.value)}
                className="tocco-riga flex-1 min-w-[12rem] rounded-lg border border-b58-cream-dark px-3 testo-sala"
                placeholder="A che dispositivo la dai"
              />
              <button
                type="button"
                onClick={nuovaChiave}
                className="tocco-riga rounded-lg bg-b58-charcoal px-4 testo-sala text-white"
              >
                Crea una chiave
              </button>
            </div>

            {Array.isArray(chiavi) && chiavi.length > 0 && (
              <ul className="mt-4 space-y-1">
                {chiavi.map((c) => (
                  <li
                    key={c.id}
                    className="tocco-riga flex flex-wrap items-center justify-between gap-2 rounded-lg bg-b58-cream px-3 testo-sala"
                  >
                    <span className={c.revocata_il ? "line-through text-b58-charcoal-soft" : ""}>
                      {c.nome} — {c.usi === 0 ? "mai usata" : `usata ${c.usi} volte`}
                      {c.revocata_il ? " · tolta" : ""}
                    </span>
                    {!c.revocata_il && (
                      <button
                        type="button"
                        onClick={() => togliChiave(c.id)}
                        className="tocco-riga rounded-lg px-3 text-b58-terracotta-dark"
                      >
                        Togli
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ⚠️ Il gesto che CONFERMA e quello che ANNULLA stanno a più di 5 mm l'uno
//    dall'altro (`gap-3` non basterebbe: sono 1,62 mm veri). Qui la
//    distanza la fa `justify-between` con i due gesti agli estremi, e la
//    riga intera è alta 1,05 cm.
// 🔴 TRE DOMANDE, TRE RIGHE DIVERSE — e non sono tre frasi diverse.
//    Il gestionale scriveva «ho trovato due prodotti… non so quale intendi»
//    e sotto offriva **«Sì, fallo»**. Sì a cosa? Dove l'incertezza è su
//    QUALE, un pulsante unico è la risposta a una domanda che non è stata
//    fatta — e premerlo rifà la stessa cosa e fallisce di nuovo, perché
//    quello che manca non è un permesso: è un'informazione.
//
// ⚠️ CHE DOMANDA SIA lo dice il DATABASE (`azione_domanda`), non questa
//    schermata: riusa la funzione che già sa cosa manca. Deciderlo qui
//    sarebbe la seconda definizione della stessa cosa, e il giorno che le
//    due divergono la schermata offre un pulsante che il database rifiuta.
function RigaDaGuardare({ azione, quando, occupato, esito, onConferma, onAnnulla, onScegli }) {
  const inCorso = esito?.stato === "in_corso" || occupato;
  const fatta = esito?.stato === "fatta";
  const fallita = esito?.stato === "fallita";
  const scelte = Array.isArray(azione.scelte) ? azione.scelte : [];
  const chiedeQuale = azione.domanda === "scegli" && scelte.length > 0;
  // ⚠️ `manca` è il caso in cui nemmeno il gestionale sa cosa proporre:
  //    lì «Sì, fallo» è inutile quanto nel caso sopra, ma non c'è niente
  //    da toccare. Resta la via d'uscita: ridire, o lasciar perdere.
  const chiedeAltro = azione.domanda === "manca";

  return (
    <li className="rounded-lg border border-b58-cream-dark bg-b58-cream/40 p-3">
      <p className="testo-sala font-medium text-b58-charcoal">{azione.frase}</p>
      <p className="testo-sala mt-1 text-b58-charcoal-soft">
        {perchéAspetta(azione)}
        {quando ? ` · ${quando}` : ""}
      </p>

      {/* ⚠️ UN RIFIUTO SENZA GESTO D'USCITA È UN VICOLO CIECO, e questo
          progetto li tratta come un difetto a sé. Su una riga a cui manca
          un'informazione che il gestionale non può proporre, gli unici
          pulsanti sarebbero «Lascia perdere» — cioè buttare via quello che
          ha detto. La via d'uscita c'è ed è ridirlo: qui si dice.
          🔴 QUELLA VERA — un collegamento alla schermata giusta coi campi
             già riempiti — è una decisione di Alessio del 27/08 e NON è
             ancora costruita. Finché non c'è, questa frase è l'unica cosa
             che impedisce alla riga di essere un vicolo cieco. */}
      {chiedeAltro && !fatta && (
        <p className="testo-sala mt-2 text-b58-charcoal-soft">
          Ridillo a voce aggiungendo quello che manca: quello che hai detto resta qui finché
          non lo fai.
        </p>
      )}

      {chiedeQuale && !fatta && (
        <div className="mt-2">
          <p className="testo-sala text-b58-charcoal">Quale dei due?</p>
          <div className="mt-1 flex flex-wrap gap-2">
            {scelte.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => onScegli(s.id)}
                disabled={inCorso}
                className="tocco-riga rounded-lg bg-b58-charcoal px-4 testo-sala text-b58-parchment disabled:opacity-60"
              >
                {s.nome}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
        {/* 🔴 «Sì, fallo» compare SOLO dove la domanda è «lo faccio o no?». */}
        {!chiedeQuale && !chiedeAltro && (
          <button
            type="button"
            onClick={onConferma}
            disabled={inCorso || fatta}
            className="tocco-riga rounded-lg bg-b58-olive px-4 testo-sala text-white disabled:opacity-60"
          >
            {/* 🔴 «…» non è un riscontro: chi non capisce che sta succedendo
                qualcosa ripreme. Le parole per intero, anche se occupano. */}
            {fatta ? "✓ Fatto" : inCorso ? "Lo sto facendo…" : "Sì, fallo"}
          </button>
        )}
        {(chiedeQuale || chiedeAltro) && fatta && (
          <span className="testo-sala text-b58-charcoal">✓ Fatto</span>
        )}
        <button
          type="button"
          onClick={onAnnulla}
          disabled={inCorso || fatta}
          className="tocco-riga rounded-lg px-4 testo-sala text-b58-terracotta-dark disabled:opacity-60"
        >
          Lascia perdere
        </button>
      </div>

      {/* 🔴 L'ESITO STA QUI, SULLA RIGA TOCCATA, e non in cima alla pagina:
          «un rifiuto lontano dal gesto è un rifiuto che non c'è» — lezione
          del 17/08, già pagata una volta in Cassa. La notte del 27/08
          Alessio ha premuto due volte proprio perché non vedeva niente. */}
      {fallita && (
        <p className="testo-sala mt-2 rounded-lg bg-b58-terracotta/10 px-3 py-2 text-b58-terracotta-dark">
          Non si è fatta: {esito.messaggio}
        </p>
      )}
    </li>
  );
}

// I passaggi per costruire la Scorciatoia dell'iPhone.
//
// ⚠️ STANNO QUI E NON IN UN DOCUMENTO A PARTE, e la ragione è di merito:
//    si seguono SUL TELEFONO, con l'app Comandi rapidi aperta accanto.
//    Un file da aprire su un altro schermo si perde al terzo passaggio.
//    La stessa guida, per intero, sta anche in `docs/guide/SCORCIATOIA_VOCE.md`.
//
// ⚠️ L'indirizzo lo dice il gestionale invece di farlo scrivere a mano:
//    è la riga più facile da sbagliare, e sbagliandola non compare
//    nessun errore comprensibile — la Scorciatoia semplicemente non fa
//    niente.
function GuidaScorciatoia() {
  const indirizzo = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ascolta-voce`;
  return (
    <div className="mt-3 rounded-lg bg-b58-cream px-3 py-3">
      <ol className="space-y-3">
        <li className="testo-sala text-b58-charcoal">
          <b>1.</b> Sull'iPhone apri <b>Comandi rapidi</b> e tocca <b>+</b> in alto a destra.
        </li>
        <li className="testo-sala text-b58-charcoal">
          <b>2.</b> «Aggiungi azione» → cerca <b>Detta testo</b>. Poi metti «Interrompi ascolto»
          su <b>Al tocco</b>: così puoi fare una pausa senza che si chiuda da solo.
        </li>
        <li className="testo-sala text-b58-charcoal">
          <b>3.</b> «Aggiungi azione» → cerca <b>Ottieni contenuto di URL</b>.
        </li>
        <li className="testo-sala text-b58-charcoal">
          <b>4.</b> Nell'indirizzo incolla questo:
          <code className="mt-1 block break-all rounded bg-white px-2 py-2">{indirizzo}</code>
        </li>
        <li className="testo-sala text-b58-charcoal">
          <b>5.</b> Apri la freccina <b>▸</b> di quell'azione e metti <b>Metodo: POST</b> e{" "}
          <b>Corpo richiesta: JSON</b>.
        </li>
        <li className="testo-sala text-b58-charcoal">
          <b>6.</b> Sotto «Corpo richiesta» fai due campi di testo:
          <br />• <b>testo</b> → scegli <b>Testo dettato</b> dalla barra sopra la tastiera (non
          scriverlo a mano: è il risultato del passo 2)
          <br />• <b>chiave</b> → la chiave che hai copiato qui sopra
        </li>
        <li className="testo-sala text-b58-charcoal">
          <b>7.</b> Dai il nome <b>Borgo 58</b> e tocca Fine. Dall'orologio lo trovi nell'app
          Comandi rapidi, e si può mettere sul quadrante.
        </li>
        {/* 🔴 IL PASSO CHE MANCAVA — 27/08/2026. Alessio ha costruito la
            Scorciatoia esattamente come dicevano i sette passi, ed è stata
            respinta prima di entrare. La causa non era nella Scorciatoia:
            era una porta chiusa a monte, e adesso è aperta. Qui resta la
            frase che riconosce quel rifiuto per nome, perché è l'unico che
            arriva in inglese e non si capisce di chi sia la colpa. */}
        <li className="testo-sala text-b58-charcoal">
          <b>8.</b> Provala dal telefono: se risponde <b>«ho capito…»</b> è a posto.
          <br />
          Se risponde <b>«Missing authorization header»</b> — o qualunque altra cosa in
          inglese — <b>non hai sbagliato niente tu</b>: è il gestionale che ha una
          porta chiusa dalla parte sua. Dimmelo e la riapro.
        </li>
      </ol>
      {/* 🔴 Il limite si dichiara dentro la guida, non solo nel riepilogo:
          chi la sta seguendo deve sapere che questo pezzo non l'ha ancora
          provato nessuno, altrimenti se non funziona cerca l'errore nei
          propri passaggi. */}
      <p className="testo-sala mt-3 text-b58-charcoal-soft">
        Quello che ancora nessuno ha provato è se la registrazione parte davvero <b>dal polso</b> e
        se regge <b>a schermo spento</b>. Dal telefono funziona di sicuro. Se dall'orologio non
        parte, dimmelo: non è un problema del gestionale, è di come iOS tratta quel comando.
      </p>
    </div>
  );
}
