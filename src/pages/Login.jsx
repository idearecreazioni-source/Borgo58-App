import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import Logo from "../components/Logo";

export default function Login() {
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = (e) => {
    e.preventDefault();
    if (login(pin)) {
      navigate("/dashboard", { replace: true });
    } else {
      setError("PIN non valido (minimo 4 cifre).");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-b58-cream px-4">
      <div className="w-full max-w-sm">
        <div className="flex justify-center mb-8">
          <Logo size="lg" />
        </div>

        <form
          onSubmit={handleSubmit}
          className="bg-b58-parchment rounded-2xl shadow-sm ring-1 ring-b58-charcoal/10 p-8"
        >
          <h1 className="font-display text-lg text-b58-charcoal mb-1">Accedi</h1>
          <p className="text-sm text-b58-charcoal-soft mb-6">
            Inserisci il PIN per entrare nel gestionale.
          </p>

          <label className="block text-xs font-medium uppercase tracking-wide text-b58-charcoal-soft mb-2">
            PIN
          </label>
          <input
            type="password"
            inputMode="numeric"
            autoFocus
            value={pin}
            onChange={(e) => {
              setPin(e.target.value);
              setError("");
            }}
            placeholder="••••"
            className="w-full rounded-lg border border-b58-charcoal/15 bg-white px-4 py-3 text-lg tracking-[0.4em] text-center text-b58-charcoal focus:outline-none focus:ring-2 focus:ring-b58-terracotta"
          />
          {error && <p className="text-sm text-b58-terracotta-dark mt-2">{error}</p>}

          <button
            type="submit"
            className="mt-6 w-full rounded-lg bg-b58-terracotta hover:bg-b58-terracotta-dark transition-colors text-b58-parchment font-medium py-3"
          >
            Entra
          </button>

          <p className="text-[11px] text-b58-charcoal-soft/70 mt-5 text-center leading-relaxed">
            Accesso demo — l'autenticazione reale (PIN monoutente / Supabase)
            sarà collegata insieme al resto della configurazione dati.
          </p>
        </form>
      </div>
    </div>
  );
}
