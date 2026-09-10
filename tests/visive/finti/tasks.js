// =====================================================================
// GLI IMPEGNI FINTI DELLA PROVA VISIVA
// =====================================================================
// La prova visiva monta la VERA schermata dell'Agenda in un browser vero;
// finte sono soltanto le letture. Nessuna di queste funzioni parla col
// database: la prova guarda la forma della scheda, non i dati.
//
// ⚠️ LE RIGHE SONO SCELTE PER METTERE IN DIFFICOLTÀ L'ALLINEAMENTO, non
//    per sembrare vere: un titolo lungo che va a capo, uno con la nota
//    della provenienza, uno riservato col suo segno accanto, uno stellato
//    che sta nella sezione in testa, uno senza scadenza. Un titolo corto su
//    una riga sola lascerebbe passare anche un allineamento storto.

const oggi = new Date();
const iso = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const fra = (giorni) => iso(new Date(oggi.getTime() + giorni * 86400000));

const riga = (id, extra) => ({
  id,
  title: `Impegno ${id}`,
  description: null,
  due_date: fra(2),
  due_time: null,
  category: "altro",
  origine_modulo: null,
  preferito: false,
  ricorrenza_ogni: null,
  ricorrenza_unita: null,
  status: "da_fare",
  visibile_staff: true,
  corsia: "questa_settimana",
  giorni_in_lista: 3,
  giorni_alla_scadenza: 2,
  ...extra,
});

const RIGHE = [
  riga("a", {
    title: "Portare i corrispettivi di luglio al commercialista e farsi firmare la ricevuta",
    due_date: fra(1),
    giorni_alla_scadenza: 1,
  }),
  riga("b", { title: "Rinnovo firma digitale", origine_modulo: "posta", due_date: fra(3), giorni_alla_scadenza: 3 }),
  riga("c", { title: "Chiamare il tecnico della cella", visibile_staff: false }),
  riga("d", { title: "Sanificare la cappa", preferito: true, corsia: "questa_settimana" }),
  riga("e", {
    title: "Ritirare le analisi dell'acqua",
    due_date: null,
    corsia: "quando_capita",
    giorni_alla_scadenza: null,
    giorni_in_lista: 40,
  }),
];

// Quante schede la prova deve trovare disegnate: se ne mancasse una, la
// misura delle altre non direbbe niente di lei.
export const QUANTE_SCHEDE = RIGHE.length;

export const agendaCorsie = async () => RIGHE;
export const agendaFatti = async () => [];
export const listTasksForMonth = async () => [];
export const completaTask = async () => null;
export const riapriTask = async () => ({});
export const spostaTask = async () => null;
export const stellaTask = async () => null;
