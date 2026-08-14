import { useRef, useState } from "react";
import {
  SALA_LARGHEZZA_CM,
  SALA_PROFONDITA_CM,
  ZONE_FONDALE,
} from "../lib/api/sala";

// LA PIANTA DELLA SALA — la stessa in Calendario e in Comande.
//
// Deliberatamente povera, e va tenuta povera (§4 del mandato): sagome in
// scala approssimativa, aggancio a griglia, niente rotazione, niente
// collisioni fini, niente zoom libero. Divani e Chef Table si disegnano
// ma non si trascinano — e non perché questa schermata non li lasci
// prendere: è un vincolo del database (dining_tables_sagoma_check).
//
// ⚠️ IL SALVATAGGIO AVVIENE AL RILASCIO, MAI DURANTE IL TRASCINAMENTO.
// Salvare a ogni movimento vorrebbe dire decine di scritture per un solo
// gesto, e una connessione lenta trasformerebbe un trascinamento in uno
// scatto.
//
// ⚠️ QUANTO È GRANDE SULLO SCHERMO. Il tavolo più piccolo è 90 cm; il
// target di tocco minimo del progetto è 1,05 cm reali (§3.2.1). Da qui la
// larghezza minima del disegno: 2070 / 90 × 1,05 ≈ 24 cm reali. Su un
// monitor la pianta ci sta tutta; su un tablet verticale la sala scorre
// in orizzontale — che è quello che fa una pianta di sala su un foglio
// piccolo. Non si rimpicciolisce sotto quella soglia: un tavolo che non
// si riesce a toccare durante un servizio non è una pianta, è un disegno.
const LARGHEZZA_MINIMA_CM_REALI = (SALA_LARGHEZZA_CM / 90) * 1.05;

// L'aggancio a griglia: 10 cm. Abbastanza fine da accostare due tavoli
// senza fatica, abbastanza grosso da non lasciare fessure di 3 cm che a
// schermo sembrano un errore di chi trascina.
const GRIGLIA_CM = 10;

const COLORI = {
  libero: { riempimento: "var(--color-b58-parchment)", bordo: "var(--color-b58-charcoal)" },
  selezionato: { riempimento: "var(--color-b58-terracotta)", bordo: "var(--color-b58-terracotta-dark)" },
  occupato: { riempimento: "var(--color-b58-gold)", bordo: "var(--color-b58-gold-dark)" },
  prenotato: { riempimento: "var(--color-b58-olive)", bordo: "var(--color-b58-olive-dark)" },
  fisso: { riempimento: "var(--color-b58-cream-dark)", bordo: "var(--color-b58-charcoal-soft)" },
};

const aggancia = (v) => Math.round(v / GRIGLIA_CM) * GRIGLIA_CM;
const limita = (v, min, max) => Math.min(max, Math.max(min, v));

/**
 * @param sagome      righe di pianta_del_giorno (o della pianta base)
 * @param selezione   array di id selezionati
 * @param onSeleziona (sagoma) => void — assente: le sagome non si toccano
 * @param onSposta    (sagoma, x, y) => void — assente: niente trascinamento
 * @param stato       { [id]: { colore, riga1, riga2 } }
 */
export default function PiantaSala({ sagome = [], selezione = [], onSeleziona, onSposta, stato = {} }) {
  const svgRef = useRef(null);
  // La sagoma che si sta trascinando adesso: vive solo qui, e sparisce al
  // rilascio. La posizione vera resta quella del database finché non
  // arriva la conferma della scrittura.
  const [trascina, setTrascina] = useState(null);

  const selezionati = new Set(selezione);

  // Da pixel dello schermo a centimetri della sala.
  const inCentimetri = (evento) => {
    const riquadro = svgRef.current.getBoundingClientRect();
    return {
      x: ((evento.clientX - riquadro.left) / riquadro.width) * SALA_LARGHEZZA_CM,
      y: ((evento.clientY - riquadro.top) / riquadro.height) * SALA_PROFONDITA_CM,
    };
  };

  const iniziaTrascinamento = (evento, sagoma) => {
    if (!onSposta || !sagoma.spostabile) return;
    const punto = inCentimetri(evento);
    evento.currentTarget.setPointerCapture(evento.pointerId);
    setTrascina({
      id: sagoma.id,
      // Scarto fra dove si è toccato e l'angolo della sagoma: senza, la
      // sagoma salta col suo angolo sotto il dito al primo movimento.
      dx: punto.x - sagoma.x,
      dy: punto.y - sagoma.y,
      x: sagoma.x,
      y: sagoma.y,
      mosso: false,
    });
  };

  const muovi = (evento) => {
    if (!trascina) return;
    const punto = inCentimetri(evento);
    const sagoma = sagome.find((s) => s.id === trascina.id);
    if (!sagoma) return;
    const x = limita(aggancia(punto.x - trascina.dx), 0, SALA_LARGHEZZA_CM - sagoma.larghezza_cm);
    const y = limita(aggancia(punto.y - trascina.dy), 0, SALA_PROFONDITA_CM - sagoma.profondita_cm);
    setTrascina((t) => (t ? { ...t, x, y, mosso: t.mosso || x !== sagoma.x || y !== sagoma.y } : t));
  };

  const rilascia = (sagoma) => {
    if (!trascina || trascina.id !== sagoma.id) return;
    const { x, y, mosso } = trascina;
    setTrascina(null);
    // Un tocco senza movimento è una selezione, non uno spostamento: in
    // sala si tocca il tavolo per aprirlo molto più spesso di quanto lo
    // si sposti.
    if (mosso) onSposta?.(sagoma, x, y);
    else onSeleziona?.(sagoma);
  };

  const coloreDi = (sagoma) => {
    if (selezionati.has(sagoma.id)) return COLORI.selezionato;
    const s = stato[sagoma.id];
    if (s?.colore && COLORI[s.colore]) return COLORI[s.colore];
    if (!sagoma.spostabile) return COLORI.fisso;
    return COLORI.libero;
  };

  return (
    <div className="overflow-auto rounded-xl bg-b58-cream ring-1 ring-b58-charcoal/10">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${SALA_LARGHEZZA_CM} ${SALA_PROFONDITA_CM}`}
        className="block w-full touch-none select-none"
        style={{
          minWidth: `calc(${LARGHEZZA_MINIMA_CM_REALI.toFixed(1)} * var(--pxcm))`,
          aspectRatio: `${SALA_LARGHEZZA_CM} / ${SALA_PROFONDITA_CM}`,
          height: "auto",
        }}
        onPointerMove={muovi}
      >
        {/* IL FONDALE — sfondo statico, mai interattivo: pareti e zone non
            si spostano, non si ridimensionano, non hanno stato. */}
        {ZONE_FONDALE.map((z) => (
          <g key={z.nome}>
            <rect
              x={z.x}
              y={z.y}
              width={z.larghezza}
              height={z.profondita}
              fill={z.servizio ? "var(--color-b58-cream-dark)" : "var(--color-b58-parchment)"}
              fillOpacity={z.servizio ? 0.6 : 0.45}
              stroke="var(--color-b58-charcoal)"
              strokeOpacity="0.18"
              strokeWidth="4"
            />
            <text
              x={z.x + 18}
              y={z.y + 46}
              fontSize="34"
              fill="var(--color-b58-charcoal)"
              fillOpacity="0.35"
              style={{ textTransform: "uppercase", letterSpacing: "2px" }}
            >
              {z.nome}
            </text>
          </g>
        ))}

        {/* L'ingresso, sulla parete di sinistra della sala bassa. */}
        <line
          x1="0"
          y1="700"
          x2="0"
          y2="880"
          stroke="var(--color-b58-olive)"
          strokeWidth="16"
          strokeLinecap="round"
        />
        <text x="24" y="800" fontSize="30" fill="var(--color-b58-olive-dark)">
          Ingresso
        </text>

        {/* LE SAGOME — le uniche cose vive del disegno. */}
        {sagome.map((sagoma) => {
          const inMano = trascina?.id === sagoma.id;
          const x = inMano ? trascina.x : sagoma.x;
          const y = inMano ? trascina.y : sagoma.y;
          const colore = coloreDi(sagoma);
          const info = stato[sagoma.id];
          const tondo = sagoma.forma === "tondo";
          const selezionabile = Boolean(onSeleziona || (onSposta && sagoma.spostabile));

          return (
            <g
              key={sagoma.id}
              transform={`translate(${x} ${y})`}
              style={{ cursor: selezionabile ? "pointer" : "default" }}
              onPointerDown={(e) => iniziaTrascinamento(e, sagoma)}
              onPointerUp={() => rilascia(sagoma)}
              onClick={() => {
                // Chi non si trascina (divani, Chef Table) non passa mai
                // da rilascia(): il tocco arriva da qui.
                if (!sagoma.spostabile || !onSposta) onSeleziona?.(sagoma);
              }}
            >
              <rect
                width={sagoma.larghezza_cm}
                height={sagoma.profondita_cm}
                rx={tondo ? Math.min(sagoma.larghezza_cm, sagoma.profondita_cm) / 2 : 12}
                fill={colore.riempimento}
                stroke={colore.bordo}
                strokeWidth={inMano ? 10 : 5}
                opacity={inMano ? 0.85 : 1}
              />
              <text
                x={sagoma.larghezza_cm / 2}
                y={sagoma.profondita_cm / 2 + (info?.riga1 ? -6 : 12)}
                textAnchor="middle"
                fontSize="36"
                fontWeight="600"
                fill={
                  selezionati.has(sagoma.id) || info?.colore === "prenotato"
                    ? "var(--color-b58-parchment)"
                    : "var(--color-b58-charcoal)"
                }
              >
                {sagoma.label}
              </text>
              {info?.riga1 && (
                <text
                  x={sagoma.larghezza_cm / 2}
                  y={sagoma.profondita_cm / 2 + 32}
                  textAnchor="middle"
                  fontSize="28"
                  fill={
                    selezionati.has(sagoma.id) || info?.colore === "prenotato"
                      ? "var(--color-b58-parchment)"
                      : "var(--color-b58-charcoal-soft)"
                  }
                >
                  {info.riga1}
                </text>
              )}
              {info?.riga2 && (
                <text
                  x={sagoma.larghezza_cm / 2}
                  y={sagoma.profondita_cm / 2 + 66}
                  textAnchor="middle"
                  fontSize="26"
                  fill={
                    selezionati.has(sagoma.id) || info?.colore === "prenotato"
                      ? "var(--color-b58-parchment)"
                      : "var(--color-b58-charcoal-soft)"
                  }
                >
                  {info.riga2}
                </text>
              )}
              {sagoma.posti_fissi && !info?.riga1 && (
                <text
                  x={sagoma.larghezza_cm / 2}
                  y={sagoma.profondita_cm / 2 + 44}
                  textAnchor="middle"
                  fontSize="26"
                  fill="var(--color-b58-charcoal-soft)"
                >
                  {sagoma.posti_fissi} posti
                </text>
              )}
              {sagoma.spostato && (
                <circle cx={sagoma.larghezza_cm - 16} cy="16" r="12" fill="var(--color-b58-terracotta)" />
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}
