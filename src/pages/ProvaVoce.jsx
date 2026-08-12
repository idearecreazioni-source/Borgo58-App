import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";

// ---------------------------------------------------------------------
// Prova della dettatura — schermata USA E GETTA
// ---------------------------------------------------------------------
// Chiesta da Alessio il 12/08/2026 prima di comprare qualunque microfono:
// se in cucina non lo sente, la dettatura delle ricette non si fa, e
// tanto vale saperlo prima di progettarci attorno una schermata.
//
// ⚠️ SECONDA VERSIONE, e il motivo vale più della schermata. La prima
// accendeva il microfono DUE VOLTE insieme: una per il riconoscimento
// vocale, una per la barra del rumore. Chrome non lo permette — il
// riconoscimento parte e viene subito interrotto. E siccome trattavo
// `aborted` come un silenzio innocuo, non compariva nemmeno un errore:
// Alessio ha visto una pagina che «non fa niente».
//
// Due lezioni, e sono le stesse di tutta la giornata:
//   1. il microfono è una risorsa sola: le due funzioni ora si escludono
//      a vicenda, e il programma non ti lascia accenderle insieme;
//   2. **non si nasconde un errore perché di solito è innocuo.** Ora si
//      vedono tutti, e c'è sempre scritto in che stato è.
//
// Qui non c'è niente del gestionale: nessuna ricetta, nessuna scrittura,
// nessuna chiamata a pagamento. Va cancellata dopo la decisione.

const Riconoscitore =
  typeof window !== "undefined" &&
  (window.SpeechRecognition || window.webkitSpeechRecognition);

export default function ProvaVoce() {
  const [modo, setModo] = useState("fermo"); // fermo | ascolto | rumore
  const [stato, setStato] = useState("Fermo.");
  const [frasi, setFrasi] = useState([]);
  const [parziale, setParziale] = useState("");
  const [errore, setErrore] = useState("");
  const [livello, setLivello] = useState(0);
  const [fondo, setFondo] = useState(null);

  const recRef = useRef(null);
  const chiudiAudio = useRef(null);

  const fermaTutto = () => {
    const rec = recRef.current;
    recRef.current = null;
    try {
      rec?.stop();
    } catch {
      /* già ferma */
    }
    chiudiAudio.current?.();
    chiudiAudio.current = null;
    setParziale("");
    setLivello(0);
    setModo("fermo");
    setStato("Fermo.");
  };

  useEffect(() => () => fermaTutto(), []);

  // -------------------------------------------------------------------
  // La trascrizione
  // -------------------------------------------------------------------
  const parla = () => {
    setErrore("");
    if (!Riconoscitore) {
      setErrore("Questo browser non sa trascrivere. Serve Google Chrome.");
      return;
    }
    fermaTutto();

    const rec = new Riconoscitore();
    rec.lang = "it-IT";
    rec.continuous = true;
    rec.interimResults = true;

    rec.onstart = () => setStato("Ti sto ascoltando. Parla pure.");

    rec.onaudiostart = () => setStato("Microfono aperto, ti sto ascoltando.");

    rec.onresult = (e) => {
      let inCorso = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const testo = e.results[i][0].transcript;
        if (e.results[i].isFinal) {
          const sicurezza = e.results[i][0].confidence;
          setFrasi((f) => [
            ...f,
            {
              testo: testo.trim(),
              sicurezza: Number.isFinite(sicurezza) ? Math.round(sicurezza * 100) : null,
              ora: new Date().toLocaleTimeString("it-IT"),
            },
          ]);
        } else {
          inCorso += testo;
        }
      }
      setParziale(inCorso);
    };

    // ⚠️ Nessun errore viene nascosto. `no-speech` si dice a parole
    // perché è il caso normale (silenzio), ma si dice: una pagina che
    // tace mentre non funziona è la cosa che ha fatto perdere mezz'ora.
    rec.onerror = (e) => {
      if (e.error === "no-speech") {
        setStato("Non ho sentito niente — riprovo ad ascoltare.");
        return;
      }
      if (e.error === "not-allowed" || e.error === "service-not-allowed") {
        setErrore(
          "Il microfono è bloccato per questo sito. Clicca sull'icona a sinistra " +
            "dell'indirizzo, in alto, e metti il microfono su «Consenti». Poi ricarica."
        );
        fermaTutto();
        return;
      }
      setErrore(`Il riconoscimento si è fermato: ${e.error}`);
    };

    // Chrome si ferma da solo dopo un po' di silenzio: si riparte, così
    // la prova dura quanto serve senza dover ripremere.
    rec.onend = () => {
      if (recRef.current !== rec) return;
      try {
        rec.start();
        setStato("Ti sto ascoltando. Parla pure.");
      } catch {
        setStato("Riconoscimento fermo.");
      }
    };

    recRef.current = rec;
    setModo("ascolto");
    setStato("Sto chiedendo il microfono…");
    try {
      rec.start();
    } catch (e) {
      setErrore(`Non sono riuscito a partire: ${e.message}`);
      fermaTutto();
    }
  };

  // -------------------------------------------------------------------
  // La misura del rumore — DA SOLA, mai insieme alla trascrizione
  // -------------------------------------------------------------------
  const misuraRumore = async () => {
    setErrore("");
    fermaTutto();
    setModo("rumore");
    setStato("Sto chiedendo il microfono…");
    let vivo = true;
    let ctx;
    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      ctx = new AudioContext();
      const an = ctx.createAnalyser();
      an.fftSize = 512;
      ctx.createMediaStreamSource(stream).connect(an);
      const dati = new Uint8Array(an.frequencyBinCount);
      setStato("Sto misurando il rumore. Non parlare, guarda la barra.");
      const gira = () => {
        if (!vivo) return;
        an.getByteTimeDomainData(dati);
        let picco = 0;
        for (const v of dati) picco = Math.max(picco, Math.abs(v - 128));
        setLivello(Math.min(100, Math.round((picco / 128) * 200)));
        requestAnimationFrame(gira);
      };
      gira();
      chiudiAudio.current = () => {
        vivo = false;
        stream?.getTracks().forEach((t) => t.stop());
        ctx?.close();
      };
    } catch (e) {
      setErrore(`Microfono non disponibile: ${e.message}`);
      setModo("fermo");
      setStato("Fermo.");
    }
  };

  const bottone =
    "tocco-azione w-full rounded-xl text-lg font-medium disabled:opacity-40";

  return (
    <div className="max-w-2xl mx-auto pb-16">
      <Link to="/dashboard" className="text-sm text-b58-charcoal-soft hover:text-b58-charcoal">
        ← Dashboard
      </Link>
      <h1 className="font-display text-2xl text-b58-charcoal mt-2">Prova della dettatura</h1>
      <p className="text-b58-charcoal-soft mt-1 mb-4">
        Serve solo a capire se in cucina ti sente. Non salva niente e non costa niente.
      </p>

      {!Riconoscitore && (
        <p className="text-sm text-b58-terracotta-dark bg-b58-terracotta/10 rounded-lg px-3 py-2 mb-4">
          Questo browser non sa trascrivere: apri questa pagina con Google Chrome.
        </p>
      )}

      {errore && (
        <p className="text-sm text-b58-terracotta-dark bg-b58-terracotta/10 rounded-lg px-3 py-2 mb-4">
          {errore}
        </p>
      )}

      <div className="rounded-xl bg-b58-parchment ring-1 ring-b58-charcoal/10 p-5 mb-4">
        {/* Le due prove non possono convivere: il microfono è uno solo, e
            Chrome non lo dà a due padroni. */}
        {modo === "fermo" && (
          <div className="space-y-2">
            <button onClick={parla} className={`${bottone} bg-b58-olive text-b58-parchment`}>
              1 · Parla, e vediamo cosa capisce
            </button>
            <button
              onClick={misuraRumore}
              className={`${bottone} bg-white ring-1 ring-b58-charcoal/15 text-b58-charcoal`}
            >
              2 · Misura solo il rumore (senza parlare)
            </button>
          </div>
        )}

        {modo !== "fermo" && (
          <button onClick={fermaTutto} className={`${bottone} bg-b58-terracotta text-b58-parchment`}>
            FERMA
          </button>
        )}

        <p className="text-sm text-b58-charcoal-soft mt-3">{stato}</p>

        {modo === "rumore" && (
          <div className="mt-3">
            <div className="flex items-center gap-2">
              <div className="flex-1 h-4 rounded-full bg-b58-charcoal/10 overflow-hidden">
                <div
                  className="h-full bg-b58-olive transition-[width] duration-75"
                  style={{ width: `${livello}%` }}
                />
              </div>
              <span className="text-sm text-b58-charcoal w-10 text-right">{livello}</span>
            </div>
            <button
              onClick={() => setFondo(livello)}
              className="text-xs text-b58-charcoal-soft hover:text-b58-terracotta underline mt-2"
            >
              segna il livello di adesso come «fondo»
            </button>
            {fondo !== null && (
              <p className="text-xs text-b58-charcoal-soft mt-1">
                Fondo segnato a <strong>{fondo}</strong>. Misuralo con la cappa spenta e poi
                accesa: la differenza fra i due numeri è quella che decide se serve il microfono a
                clip.
              </p>
            )}
          </div>
        )}
      </div>

      {parziale && <p className="text-b58-charcoal-soft italic mb-2">{parziale}…</p>}

      <div className="space-y-1">
        {frasi.length === 0 && modo !== "ascolto" && (
          <p className="text-sm text-b58-charcoal-soft">
            Quando ascolta, prova con frasi da ricetta vere: «aggiungi 200 grammi di guanciale»,
            «porta il forno a 180 gradi al passo tre», «togli il prezzemolo».
          </p>
        )}
        {frasi.map((f, i) => (
          <div key={i} className="rounded-lg bg-white ring-1 ring-b58-charcoal/10 px-3 py-2">
            <p className="text-b58-charcoal">{f.testo}</p>
            <p className="text-[11px] text-b58-charcoal-soft/70">
              {f.ora}
              {f.sicurezza !== null && ` · sicurezza ${f.sicurezza}%`}
            </p>
          </div>
        ))}
      </div>

      {frasi.length > 0 && (
        <button
          onClick={() => setFrasi([])}
          className="text-sm text-b58-charcoal-soft hover:text-b58-terracotta underline mt-4"
        >
          pulisci l{"'"}elenco
        </button>
      )}

      <p className="text-[11px] text-b58-charcoal-soft/70 mt-6">
        La trascrizione la fa il browser, quindi mentre parli l{"'"}audio esce verso Google. Per
        una prova va bene; nel modulo vero è una decisione da prendere apposta. Questa pagina si
        cancella quando avremo deciso.
      </p>
    </div>
  );
}
