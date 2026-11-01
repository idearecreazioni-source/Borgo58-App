import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { preparaFoto } from "../../lib/api/assistenteFoto";
import { ambienteCorrente } from "../../lib/ambiente";
import { STATI, riassunto } from "../../lib/calcoli/codaCasa";
import { mettiInCoda, svuotaLaCoda } from "../../lib/casa/invio";
import { useCoda } from "../../lib/casa/useCoda";
import { fotoDi } from "../../lib/casa/coda";

// LA CODA DI CASA (fase 4, 31/10/2026) — il primo traguardo: fotografare
// uno scontrino anche senza rete. La foto resta nel telefono finche' Casa
// non la riceve; poi diventa una spesa «da collocare» in Cassa, con la sola
// foto. Importo, data e fornitore li leggera' il PC (fase 7), o si scrivono
// a mano collocandola.

// La miniatura legge i byte una volta per voce (non a ogni aggiornamento
// della coda), e solo finche' la foto e' nel telefono.
function Miniatura({ chiave, inCoda }) {
  const [url, setUrl] = useState(null);
  useEffect(() => {
    if (!inCoda) {
      setUrl(null);
      return undefined;
    }
    let vivo = true;
    let u = null;
    fotoDi(chiave)
      .then((foto) => {
        if (!vivo || !foto?.byte) return;
        u = URL.createObjectURL(new Blob([foto.byte], { type: foto.tipo }));
        setUrl(u);
      })
      // SILENZIO MOTIVATO: la miniatura e' un aiuto; se la foto non si
      // legge resta il segnaposto, e lo stato della voce lo dice la riga.
      .catch(() => {});
    return () => {
      vivo = false;
      if (u) URL.revokeObjectURL(u);
    };
  }, [chiave, inCoda]);
  if (!url) return <div className="w-14 h-14 rounded-lg bg-b58-olive/15 flex items-center justify-center text-b58-olive text-xs">✓</div>;
  return <img src={url} alt="Scontrino in coda" className="w-14 h-14 rounded-lg object-cover" />;
}

const ora = (ms) =>
  new Date(ms).toLocaleString("it-IT", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

export default function CodaCasa() {
  const casa = ambienteCorrente().genere === "casa";
  const { voci, errore } = useCoda(casa);
  const scelta = useRef(null);
  const [occupato, setOccupato] = useState(false);
  const [messaggio, setMessaggio] = useState(null);
  const conta = riassunto(voci);

  if (!casa) {
    return <p className="p-6 text-b58-charcoal">La coda delle foto esiste solo su Casa, il gestionale personale.</p>;
  }

  const scegli = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setOccupato(true);
    setMessaggio(null);
    try {
      const pronta = await preparaFoto(file);
      await mettiInCoda(pronta);
      setMessaggio("Foto in coda: arriva a Casa appena il telefono la raggiunge.");
    } catch (err) {
      setMessaggio(err?.message || "La foto non e' entrata in coda.");
    } finally {
      setOccupato(false);
    }
  };

  return (
    <div className="max-w-xl mx-auto p-4 space-y-4">
      <h1 className="text-xl font-semibold text-b58-charcoal">Scontrini per Casa</h1>

      <button
        type="button"
        onClick={() => scelta.current?.click()}
        disabled={occupato}
        className="w-full rounded-xl bg-b58-olive text-b58-parchment py-4 text-lg font-semibold disabled:opacity-60"
      >
        {occupato ? "Preparo la foto…" : "Fotografa uno scontrino"}
      </button>
      <input ref={scelta} type="file" accept="image/*" capture="environment" className="hidden" onChange={scegli} />
      {messaggio && <p className="text-sm text-b58-charcoal">{messaggio}</p>}
      {errore && <p className="text-sm text-b58-terracotta-dark-testo">{errore}</p>}

      <div className="flex items-center justify-between text-sm text-b58-charcoal">
        <span>
          {conta.inCoda ? `${conta.inCoda} in coda` : "Niente in coda"}
          {conta.conErrore ? ` · ${conta.conErrore} non ancora partite` : ""}
        </span>
        {conta.inCoda > 0 && (
          <button type="button" onClick={() => svuotaLaCoda({ forza: true })} className="underline text-b58-olive">
            Invia adesso
          </button>
        )}
      </div>

      <ul className="space-y-2">
        {voci.map((v) => (
          <li key={v.chiave} className="flex items-center gap-3 rounded-xl bg-b58-parchment p-2 shadow-sm">
            <Miniatura chiave={v.chiave} inCoda={v.stato === STATI.IN_CODA} />
            <div className="text-sm">
              <div className="text-b58-charcoal">Scattata il {ora(v.creata)}</div>
              {v.stato === STATI.ARRIVATA ? (
                <div className="text-b58-olive">Arrivata a Casa · in Cassa, da collocare</div>
              ) : v.errore ? (
                <div className="text-b58-terracotta-dark-testo">In coda: {v.errore}</div>
              ) : (
                <div className="text-b58-charcoal/70">In coda nel telefono</div>
              )}
            </div>
          </li>
        ))}
      </ul>

      <p className="text-xs text-b58-charcoal/70">
        Le foto arrivate si collocano da <Link to="/cassa/da-collocare" className="underline">Cassa → Da collocare</Link>.
        Le foto restano nel telefono finche' Casa non le ha ricevute.
      </p>
    </div>
  );
}
