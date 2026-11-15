import { useAuth } from "../context/AuthContext";

// La chat e' separata dalla voce: cosi' un tocco non puo' accendere un
// microfono e il pannello puo' stare anche accanto alla schermata /detta.
export default function ApriChatMemo({ className = "", allAprire }) {
  const { isTitolare } = useAuth();
  if (!isTitolare) return null;

  return (
    <button
      type="button"
      onClick={allAprire}
      aria-label="Apri la chat di MEMO"
      className={`tocco-bottone inline-flex items-center gap-1 rounded-lg px-2 text-b58-charcoal hover:bg-b58-cream-dark ${className}`}
    >
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3h11A2.5 2.5 0 0 1 20 5.5v8a2.5 2.5 0 0 1-2.5 2.5H10l-4.5 4v-4.3A2.5 2.5 0 0 1 4 13.5v-8Z" />
        <path d="M8 9h8M8 12h5" />
      </svg>
      <span className="testo-sala font-medium">Chat</span>
    </button>
  );
}
