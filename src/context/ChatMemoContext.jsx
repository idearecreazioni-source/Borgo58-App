import { createContext, useContext } from "react";

// La chat vive nel telaio, ma MEMO voce deve poterla aprire senza cambiare
// pagina: il contesto porta soltanto quel gesto e il testo da scrivere.
const ChatMemoContext = createContext({ apriChat: null });

export function FornitoreChatMemo({ apriChat, children }) {
  return <ChatMemoContext.Provider value={{ apriChat }}>{children}</ChatMemoContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useChatMemo() {
  return useContext(ChatMemoContext);
}
