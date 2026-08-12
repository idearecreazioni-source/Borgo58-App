import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";

// ---------------------------------------------------------------------
// Prova della dettatura — schermata USA E GETTA
// ---------------------------------------------------------------------
// Chiesta da Alessio il 12/08/2026 prima di comprare qualunque microfono:
// «se capiamo che funziona e vale la pena acquisto tutto l'hardware
// necessario, altrimenti niente».
//
// È la prova che avevo consigliato di fare per prima, perché è quella che
// può far cadere tutto il resto: se in cucina, con la cappa accesa, non si
// capisce niente, la dettatura delle ricette non si fa — e tanto vale
// saperlo prima di progettarci attorno una schermata.
//
// QUI NON C'È NIENTE DEL GESTIONALE: nessuna ricetta, nessuna scrittura,
// nessuna chiamata a pagamento. Si preme, si parla, si legge cosa ha
// capito. Va cancellata quando avremo deciso.
//
// COSA USA: il riconoscimento vocale del browser (Chrome). È gratis e non
// passa dal nostro account AI — ma **l'audio esce verso Google** mentre lo
// trascrive. Per una prova va bene, e Alessio deve saperlo: non è la
// stessa cosa di «l'audio non si conserva».
//
// LA BARRA DEL RUMORE non è un vezzo: serve a distinguere «non mi sente»
// da «mi sente ma c'è troppo fondo». Sono due problemi con due soluzioni
// diverse — il microfono giusto, oppure spegnere la cappa mentre si parla.

const OK = typeof window !== "undefined" &&
  (window.SpeechRecognition || window.webkitSpeechRecognition);

export default function ProvaVoce() {
  const [attivo, setAttivo] = useState(false);
  const [frasi, setFrasi] = useState([]);
  const [parziale, setParziale] = useState("");
  const [errore, setErrore] = useState("");
  const [livello, setLivello] = useState(0);
  const [fondo, setFondo] = useState(null);

  const recRef = useRef(null);
  const audioRef = useRef(null);

  // Il livello del suono in ingresso, a occhio. Serve a vedere quanto
  // alza il fondo la cappa: si guarda la barra da fermi, senza parlare.
  useEffect(() => {
    if (!attivo) return;
    let vivo = true;
    let ctx;
    let stream;
    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        ctx = new AudioContext();
        const src = ctx.createMediaStreamSource(stream);
        const an = ctx.createAnalyser();
        an.fftSize = 512;
        src.connect(an);
        const dati = new Uint8Array(an.frequencyBinCount);
        const gira = () => {
          if (!vivo) return;
          an.getByteTimeDomainData(dati);
          let picco = 0;
          for (const v of dati) picco = Math.max(picco, Math.abs(v - 128));
          setLivello(Math.min(100, Math.round((picco / 128) * 200)));
          requestAnimationFrame(gira);
        };
        gira();
      } catch (e) {
        setErrore(`Microfono non disponibile: ${e.message}`);
      }
    })();
    audioRef.current = () => {
      vivo = false;
      stream?.getTracks().forEach((t) => t.stop());
      ctx?.close();
    };
    return () => audioRef.current?.();
  }, [attivo]);

  const avvia = () => {
    setErrore("");
    if (!OK) {
      setErrore("Questo browser non sa trascrivere. Serve Chrome.");
      return;
    }
    const rec = new OK();
    rec.lang = "it-IT";
    rec.continuous = true;
    rec.interimResults = true;

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

    // `no-speech` e `aborted` non sono guasti: sono i silenzi. Mostrarli
    // come errori farebbe sembrare rotto qualcosa che funziona.
    rec.onerror = (e) => {
      if (e.error !== "no-speech" && e.error !== "aborted") {
        setErrore(`Errore: ${e.error}`);
      }
    };
    // Chrome si ferma da solo dopo un po' di silenzio: si riparte, così
    // la prova dura quanto serve senza dover ripremere.
    rec.onend = () => {
      if (recRef.current === rec) {
        try {
          rec.start();
        } catch {
          /* già avviato */
        }
      }
    };

    recRef.current = rec;
    rec.start();
    setAttivo(true);
  };

  const ferma = () => {
    const rec = recRef.current;
    recRef.current = null;
    rec?.stop();
    setAttivo(false);
    setParziale("");
    audioRef.current?.();
  };

  useEffect(() => () => ferma(), []);

  return (
    <div className="max-w-2xl mx-auto pb-16">
      <Link to="/" className="text-sm text-b58-charcoal-soft hover:text-b58-charcoal">
        ← Dashboard
      </Link>
      <h1 className="font-display text-2xl text-b58-charcoal mt-2">Prova della dettatura</h1>
      <p className="text-b58-charcoal-soft mt-1 mb-4">
        Serve solo a capire se in cucina ti sente. Non salva niente e non costa niente.
      </p>

      {errore && (
        <p className="text-sm text-b58-terracotta-dark bg-b58-terracotta/10 rounded-lg px-3 py-2 mb-4">
          {errore}
        </p>
      )}

      <div className="rounded-xl bg-b58-parchment ring-1 ring-b58-charcoal/10 p-5 mb-4">
        <button
          onClick={attivo ? ferma : avvia}
          className={`tocco-azione w-full rounded-xl text-lg font-medium ${
            attivo
              ? "bg-b58-terracotta text-b58-parchment"
              : "bg-b58-olive text-b58-parchment"
          }`}
        >
          {attivo ? "STO ASCOLTANDO — premi per fermare" : "Premi e parla"}
        </button>

        {attivo && (
          <div className="mt-4">
            <div className="flex items-center gap-2">
              <span className="text-[11px] uppercase tracking-wide text-b58-charcoal-soft w-20">
                rumore
              </span>
              <div className="flex-1 h-3 rounded-full bg-b58-charcoal/10 overflow-hidden">
                <div
                  className="h-full bg-b58-olive transition-[width] duration-75"
                  style={{ width: `${livello}%` }}
                />
              </div>
              <span className="text-xs text-b58-charcoal-soft w-10 text-right">{livello}</span>
            </div>
            <button
              onClick={() => setFondo(livello)}
              className="text-xs text-b58-charcoal-soft hover:text-b58-terracotta underline mt-2"
            >
              segna il livello di adesso come «fondo»
            </button>
            {fondo !== null && (
              <p className="text-xs text-b58-charcoal-soft mt-1">
                Fondo segnato a <strong>{fondo}</strong>. Se parlando arrivi a meno del doppio, il
                microfono fa fatica: è lì che serve quello a clip.
              </p>
            )}
          </div>
        )}
      </div>

      {parziale && (
        <p className="text-b58-charcoal-soft italic mb-2">{parziale}…</p>
      )}

      <div className="space-y-1">
        {frasi.length === 0 && !attivo && (
          <p className="text-sm text-b58-charcoal-soft">
            Prova a dire una frase da ricetta vera: «aggiungi 200 grammi di guanciale», «porta il
            forno a 180 gradi al passo tre», «togli il prezzemolo».
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
        una prova va bene; nel modulo vero questa è una decisione da prendere apposta. Questa
        pagina si cancella quando avremo deciso.
      </p>
    </div>
  );
}
