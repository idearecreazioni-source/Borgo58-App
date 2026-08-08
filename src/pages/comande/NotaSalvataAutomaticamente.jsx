import { useEffect, useRef, useState } from "react";

// Campo nota che si salva DA SOLO mentre si scrive (§3.2.1).
//
// Perche' non basta salvare "quando il campo perde il fuoco": provandolo dal
// vivo l'08/08/2026, scrivere una nota e premere F5 la faceva sparire — il
// cursore era ancora dentro il campo e il salvataggio non partiva mai. Sul
// tablet in sala succederebbe ogni volta che lo schermo si blocca o si passa
// a un'altra app: una perdita silenziosa, che ci si accorge di aver avuto
// solo quando il piatto arriva sbagliato.
//
// Principio §7: preferire l'automazione alla disciplina. Non si chiede al
// cameriere di ricordarsi di toccare fuori dal campo.
const ATTESA_MS = 700;

export default function NotaSalvataAutomaticamente({ value, placeholder, onSave, className }) {
  const [text, setText] = useState(value ?? "");
  // Ultimo testo che risulta scritto nel database: evita di risalvare
  // all'infinito lo stesso valore a ogni ricarica dell'ordine.
  const salvato = useRef(value ?? "");
  const timer = useRef(null);
  const testoRef = useRef(value ?? "");

  testoRef.current = text;

  // Il valore puo' cambiare da fuori (ricarico dell'ordine dopo un invio):
  // ci si allinea solo se e' davvero diverso da quello che risulta salvato,
  // per non cancellare quello che l'utente sta scrivendo in questo momento.
  useEffect(() => {
    const nuovo = value ?? "";
    if (nuovo !== salvato.current) {
      salvato.current = nuovo;
      setText(nuovo);
    }
  }, [value]);

  const salva = () => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
    const testo = testoRef.current.trim();
    if (testo === salvato.current.trim()) return;
    salvato.current = testo;
    onSave(testo);
  };

  const handleChange = (e) => {
    setText(e.target.value);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(salva, ATTESA_MS);
  };

  // Ultima rete di sicurezza: schermo bloccato, cambio di app, chiusura
  // della pagina. Il salvataggio vero e' gia' scattato dopo 0,7 secondi di
  // pausa nella scrittura — questo copre solo la digitazione interrotta a
  // meta'.
  useEffect(() => {
    const flush = () => salva();
    window.addEventListener("pagehide", flush);
    document.addEventListener("visibilitychange", flush);
    return () => {
      window.removeEventListener("pagehide", flush);
      document.removeEventListener("visibilitychange", flush);
      if (timer.current) clearTimeout(timer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <input
      value={text}
      onChange={handleChange}
      onBlur={salva}
      placeholder={placeholder}
      className={className}
    />
  );
}
