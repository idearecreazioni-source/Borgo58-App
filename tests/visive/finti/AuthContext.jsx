// L'accesso finto della prova visiva: un titolare, senza nessuna sessione
// vera. La schermata dell'Agenda chiede solo questo.
export const useAuth = () => ({ isTitolare: true, isStaff: false });
