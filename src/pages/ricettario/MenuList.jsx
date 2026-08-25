import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { listMenus } from "../../lib/api/menus";
import { formatDate } from "../../lib/constants";

export default function MenuList() {
  const [menus, setMenus] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    listMenus()
      .then(setMenus)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center justify-between gap-4 mb-6 flex-wrap">
        <div>
          <Link to="/ricettario" className="tocco-bottone inline-flex items-center testo-sala-grande text-b58-charcoal-soft hover:text-b58-terracotta">
            ← Ricettario
          </Link>
          <h1 className="font-display text-2xl text-b58-charcoal mt-1">Menu</h1>
        </div>
        <Link
          to="/ricettario/menu/nuovo"
          className="rounded-lg bg-b58-terracotta hover:bg-b58-terracotta-dark transition-colors text-b58-parchment font-medium px-4 py-2 testo-sala-grande"
        >
          + Nuovo menu
        </Link>
      </div>

      {error && <p className="testo-sala-grande text-b58-terracotta-dark mb-4">Errore: {error}</p>}

      {loading ? (
        <p className="testo-sala-grande text-b58-charcoal-soft">Caricamento…</p>
      ) : menus.length === 0 ? (
        <div className="rounded-xl border border-dashed border-b58-charcoal/20 p-10 text-center">
          <p className="text-b58-charcoal-soft">Nessun menu ancora. Crea il primo.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {menus.map((m) => (
            <button
              key={m.id}
              onClick={() => navigate(`/ricettario/menu/${m.id}`)}
              className="text-left rounded-xl bg-b58-parchment p-5 ring-1 ring-b58-charcoal/10 hover:ring-b58-terracotta/50 hover:shadow-sm transition-all"
            >
              <div className="flex items-start justify-between gap-2">
                <h3 className="font-display testo-sala-grande text-b58-charcoal">{m.name}</h3>
                {m.is_active && (
                  <span className="testo-sala font-medium uppercase tracking-wide bg-b58-olive text-b58-parchment rounded-full px-2 py-1 shrink-0">
                    Attivo
                  </span>
                )}
              </div>
              <p className="testo-sala-grande text-b58-charcoal-soft mt-1">
                Struttura {m.structure}
                {m.valid_from && <> · dal {formatDate(m.valid_from)}</>}
              </p>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
