// Esportazione PDF trasversale (§3.15): niente libreria di generazione PDF,
// solo il dialogo di stampa nativo del browser ("Salva come PDF") su una
// vista già pensata per la stampa — pulito, veloce, senza dipendenze nuove.
export default function PrintButton({ label = "Esporta PDF" }) {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="print:hidden rounded-lg border border-b58-charcoal/15 hover:bg-b58-cream-dark transition-colors text-b58-charcoal testo-sala-grande font-medium px-4 py-2"
    >
      {label}
    </button>
  );
}
