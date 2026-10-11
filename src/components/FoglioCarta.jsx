import { useState } from "react";

// IL FOGLIO DI UNA CARTA STAMPATA — una forma sola per il menu e per la carta
// dei vini (N19, 11/10/2026). Prima viveva dentro l'editor del menu; la
// carta dei vini non aveva nessun foglio, solo una tabella di lavoro.
// ⚠️ Due carte che si stampano con due forme diverse in sala si vedono
//    accanto: per questo i pezzi sono gli stessi, non copie.

// Segno distintivo: un piccolo rametto d'ulivo, come la foglia del logo e
// l'orto dell'azienda agricola. Separa le sezioni della carta.
export function Sprig() {
  return (
    <svg viewBox="0 0 150 22" width="120" height="18" className="mx-auto my-3 text-b58-olive" aria-hidden="true">
      <line x1="0" y1="12" x2="58" y2="12" stroke="currentColor" strokeWidth="0.7" />
      <line x1="92" y1="12" x2="150" y2="12" stroke="currentColor" strokeWidth="0.7" />
      <path d="M75 12 C 75 5 80 2 87 3.5 C 84.5 9.5 80 12 75 12 Z" fill="currentColor" opacity="0.85" />
      <path d="M75 12 C 75 5 70 2 63 3.5 C 65.5 9.5 70 12 75 12 Z" fill="currentColor" opacity="0.85" />
      <line x1="75" y1="12" x2="75" y2="19" stroke="currentColor" strokeWidth="0.7" />
    </svg>
  );
}

export function Masthead({ header, subheader }) {
  const [logoOk, setLogoOk] = useState(true);
  return (
    <div className="text-center mb-2">
      {logoOk ? (
        <img
          src="/logo-borgo58.png"
          alt={header}
          onError={() => setLogoOk(false)}
          className="mx-auto h-20 md:h-24 object-contain"
        />
      ) : (
        <>
          <h2 className="font-display text-4xl text-b58-charcoal">{header}</h2>
          {subheader && <p className="testo-sala tracking-[0.3em] uppercase text-b58-charcoal-soft mt-1">{subheader}</p>}
        </>
      )}
    </div>
  );
}

/** Il foglio: è ciò che viene stampato. */
export default function FoglioCarta({ children, ...attributi }) {
  return (
    <div
      {...attributi}
      className="mx-auto max-w-2xl bg-b58-parchment ring-1 ring-b58-charcoal/10 px-10 py-12 md:px-14 md:py-16 print:ring-0 print:max-w-none"
      style={{ printColorAdjust: "exact", WebkitPrintColorAdjust: "exact", fontFamily: "var(--font-menu)" }}
    >
      {children}
    </div>
  );
}

/** Il titolo di una sezione della carta («Antipasti», «Bianchi»). */
export function TitoloSezione({ children }) {
  return (
    <h3
      className="text-center text-[1.6rem] leading-none text-b58-terracotta-dark tracking-[0.08em]"
      style={{ fontFamily: "var(--font-menu)", fontWeight: 500 }}
    >
      {children}
    </h3>
  );
}
