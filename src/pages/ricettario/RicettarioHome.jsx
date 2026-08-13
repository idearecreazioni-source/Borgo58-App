import { Link } from "react-router-dom";
import Icon from "../../components/Icon";
import { useAuth } from "../../context/AuthContext";

export default function RicettarioHome() {
  const { isTitolare } = useAuth();

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="font-display text-2xl md:text-3xl text-b58-charcoal">Ricettario</h1>
        <p className="text-b58-charcoal-soft mt-1">
          {isTitolare ? "Food cost dinamico, allergeni UE, HACCP." : "Ricette, HACCP, allergeni."}
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {isTitolare && (
          <Link
            to="/ricettario/ingredienti"
            className="rounded-xl bg-b58-parchment p-6 ring-1 ring-b58-charcoal/10 hover:ring-b58-terracotta/50 hover:shadow-sm transition-all"
          >
            <div className="w-10 h-10 rounded-lg bg-b58-cream-dark flex items-center justify-center text-b58-terracotta mb-3">
              <Icon name="box" className="w-5 h-5" />
            </div>
            <h3 className="font-display text-base text-b58-charcoal">Ingredienti</h3>
            <p className="text-sm text-b58-charcoal-soft mt-1">
              Anagrafica, prezzi correnti e storico, allergeni, stagionalità.
            </p>
          </Link>
        )}

        {isTitolare && (
          <Link
            to="/ricettario/schede"
            className="rounded-xl bg-b58-parchment p-6 ring-1 ring-b58-charcoal/10 hover:ring-b58-terracotta/50 hover:shadow-sm transition-all"
          >
            <div className="w-10 h-10 rounded-lg bg-b58-cream-dark flex items-center justify-center text-b58-terracotta mb-3">
              <Icon name="box" className="w-5 h-5" />
            </div>
            <h3 className="font-display text-base text-b58-charcoal">Schede dei prodotti</h3>
            <p className="text-sm text-b58-charcoal-soft mt-1">
              L&apos;assistente completa i campi mancanti. Gli allergeni li confermi tu.
            </p>
          </Link>
        )}

        <Link
          to="/ricettario/ricette"
          className="rounded-xl bg-b58-parchment p-6 ring-1 ring-b58-charcoal/10 hover:ring-b58-terracotta/50 hover:shadow-sm transition-all"
        >
          <div className="w-10 h-10 rounded-lg bg-b58-cream-dark flex items-center justify-center text-b58-terracotta mb-3">
            <Icon name="book" className="w-5 h-5" />
          </div>
          <h3 className="font-display text-base text-b58-charcoal">Ricette</h3>
          <p className="text-sm text-b58-charcoal-soft mt-1">
            {isTitolare
              ? "Food cost per porzione calcolato in automatico, fasi HACCP, allergeni."
              : "Ingredienti, quantità, fasi di preparazione, HACCP e allergeni."}
          </p>
        </Link>

        {isTitolare && (
          <Link
            to="/ricettario/menu"
            className="rounded-xl bg-b58-parchment p-6 ring-1 ring-b58-charcoal/10 hover:ring-b58-terracotta/50 hover:shadow-sm transition-all"
          >
            <div className="w-10 h-10 rounded-lg bg-b58-cream-dark flex items-center justify-center text-b58-terracotta mb-3">
              <Icon name="calendar" className="w-5 h-5" />
            </div>
            <h3 className="font-display text-base text-b58-charcoal">Menu</h3>
            <p className="text-sm text-b58-charcoal-soft mt-1">
              Struttura 4-4-4-2, prezzi di vendita, margini, simulatore what-if.
            </p>
          </Link>
        )}
      </div>
    </div>
  );
}
