import { NavLink } from "react-router-dom";
import Logo from "./Logo";
import Icon from "./Icon";
import { MODULES } from "../data/modules";
import { useAuth } from "../context/AuthContext";

export default function Sidebar({ onNavigate }) {
  const { logout } = useAuth();

  const linkClasses = ({ isActive }) =>
    `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors ${
      isActive
        ? "bg-b58-terracotta text-b58-parchment"
        : "text-b58-charcoal-soft hover:bg-b58-cream-dark"
    }`;

  return (
    <div className="flex h-full flex-col bg-b58-parchment">
      <div className="px-4 pt-6 pb-4">
        <Logo />
      </div>

      <nav className="flex-1 overflow-y-auto px-3 space-y-1">
        <NavLink to="/dashboard" end onClick={onNavigate} className={linkClasses}>
          <Icon name="box" className="w-4 h-4" />
          Dashboard
        </NavLink>

        <div className="pt-4 pb-1 px-3 text-[11px] font-medium uppercase tracking-wide text-b58-charcoal-soft/60">
          Moduli
        </div>

        {MODULES.map((m) => (
          <NavLink
            key={m.id}
            to={`/moduli/${m.id}`}
            onClick={onNavigate}
            className={linkClasses}
          >
            <Icon name={m.icon} className="w-4 h-4" />
            <span className="truncate">{m.name}</span>
          </NavLink>
        ))}
      </nav>

      <div className="px-3 py-4 border-t border-b58-charcoal/10">
        <button
          onClick={logout}
          className="w-full text-left flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-b58-charcoal-soft hover:bg-b58-cream-dark transition-colors"
        >
          Esci
        </button>
      </div>
    </div>
  );
}
