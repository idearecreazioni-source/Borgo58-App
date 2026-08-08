import { useEffect, useRef, useState } from "react";

// Campo che si salva DA SOLO mentre si scrive.
//
// Perche' non basta salvare "quando il campo perde il fuoco": provandolo
// dal vivo l'08/08/2026, scrivere una nota in comanda e premere F5 la
// faceva sparire — il cursore era ancora dentro il campo e il salvataggio
// non partiva mai. L'audit dello stesso giorno ha trovato lo stesso
// difetto sulla quantita' degli ingredienti e sul prezzo di vendita nel
// Ricettario: si scrive un prezzo, si ricarica, il prezzo non c'e' piu'.
// Nessun errore, nessun avviso.
//
// Principio §7: preferire l'automazione alla disciplina. Non si chiede a
// nessuno di ricordarsi di toccare fuori dal campo prima di andarsene.
//
// Nota sui campi numerici: un salvataggio puo' scattare su un numero
// scritto a meta' (l'"1" di "12"). Non e' un problema — subito dopo arriva
// il valore completo e vince l'ultimo. E' comunque meglio di perdere tutto.
const ATTESA_MS = 700;

export default function CampoAutosalvato({
  value,
  onSave,
  type = "text",
  step,
  placeholder,
  className,
  disabled,
}) {
  const [text, setText] = useState(value ?? "");
  // Ultimo valore che risulta scritto nel database: evita di risalvare
  // all'infinito lo stesso testo a ogni ricarica dei dati.
  const salvato = useRef(String(value ?? ""));
  const timer = useRef(null);
  const testoRef = useRef(value ?? "");

  testoRef.current = text;

  // Il valore puo' cambiare da fuori (ricarico dopo un salvataggio):
  // ci si allinea solo se e' davvero diverso da quello che risulta
  // salvato, per non cancellare quello che si sta scrivendo adesso.
  useEffect(() => {
    const nuovo = String(value ?? "");
    if (nuovo !== salvato.current) {
      salvato.current = nuovo;
      setText(value ?? "");
    }
  }, [value]);

  const salva = () => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
    const testo = String(testoRef.current).trim();
    if (testo === salvato.current.trim()) return;
    // Un campo numerico svuotato non e' "zero": e' una modifica a meta'.
    // Salvarlo scriverebbe 0 su un prezzo o una quantita' vera.
    if (type === "number" && testo === "") return;
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
  // pausa nella scrittura — questo copre la digitazione interrotta a meta'.
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
      type={type}
      step={step}
      value={text}
      onChange={handleChange}
      onBlur={salva}
      placeholder={placeholder}
      disabled={disabled}
      className={className}
    />
  );
}
