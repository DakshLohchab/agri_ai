import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, useCallback, useContext, useEffect, useState } from "react";

export type Message = {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: number;
  agentSteps?: AgentStep[];
};

export type AgentStep = {
  node: string;
  status: "pending" | "running" | "completed" | "error";
  message: string;
  duration?: number;
};

export type Conversation = {
  id: string;
  title: string;
  messages: Message[];
  createdAt: number;
  updatedAt: number;
};

type ChatContextType = {
  conversations: Conversation[];
  currentConversationId: string | null;
  setCurrentConversationId: (id: string | null) => void;
  createConversation: () => string;
  deleteConversation: (id: string) => void;
  addMessage: (convId: string, message: Message) => void;
  updateMessage: (convId: string, msgId: string, updates: Partial<Message>) => void;
  getConversation: (id: string) => Conversation | undefined;
};

const ChatContext = createContext<ChatContextType>({
  conversations: [],
  currentConversationId: null,
  setCurrentConversationId: () => {},
  createConversation: () => "",
  deleteConversation: () => {},
  addMessage: () => {},
  updateMessage: () => {},
  getConversation: () => undefined,
});

export function ChatProvider({ children }: { children: React.ReactNode }) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);

  useEffect(() => {
    loadConversations();
  }, []);

  const loadConversations = async () => {
    try {
      const stored = await AsyncStorage.getItem("agri_conversations");
      if (stored) setConversations(JSON.parse(stored));
    } catch (e) {
      console.error("Failed to load conversations", e);
    }
  };

  const saveConversations = async (convs: Conversation[]) => {
    try {
      await AsyncStorage.setItem("agri_conversations", JSON.stringify(convs));
    } catch (e) {
      console.error("Failed to save conversations", e);
    }
  };

  const createConversation = useCallback(() => {
    const id = Date.now().toString() + Math.random().toString(36).substr(2, 9);
    const newConv: Conversation = {
      id,
      title: "New Query",
      messages: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    setConversations((prev) => {
      const updated = [newConv, ...prev];
      saveConversations(updated);
      return updated;
    });
    return id;
  }, []);

  const deleteConversation = useCallback((id: string) => {
    setConversations((prev) => {
      const updated = prev.filter((c) => c.id !== id);
      saveConversations(updated);
      return updated;
    });
  }, []);

  const addMessage = useCallback((convId: string, message: Message) => {
    setConversations((prev) => {
      const updated = prev.map((c) => {
        if (c.id !== convId) return c;
        const firstUserMsg = c.messages.find((m) => m.role === "user");
        const title = firstUserMsg
          ? firstUserMsg.content.slice(0, 40) + (firstUserMsg.content.length > 40 ? "..." : "")
          : message.role === "user"
          ? message.content.slice(0, 40)
          : c.title;
        return {
          ...c,
          messages: [...c.messages, message],
          title,
          updatedAt: Date.now(),
        };
      });
      saveConversations(updated);
      return updated;
    });
  }, []);

  const updateMessage = useCallback((convId: string, msgId: string, updates: Partial<Message>) => {
    setConversations((prev) => {
      const updated = prev.map((c) => {
        if (c.id !== convId) return c;
        return {
          ...c,
          messages: c.messages.map((m) => (m.id === msgId ? { ...m, ...updates } : m)),
          updatedAt: Date.now(),
        };
      });
      saveConversations(updated);
      return updated;
    });
  }, []);

  const getConversation = useCallback(
    (id: string) => conversations.find((c) => c.id === id),
    [conversations]
  );

  return (
    <ChatContext.Provider
      value={{
        conversations,
        currentConversationId,
        setCurrentConversationId,
        createConversation,
        deleteConversation,
        addMessage,
        updateMessage,
        getConversation,
      }}
    >
      {children}
    </ChatContext.Provider>
  );
}

export const useChat = () => useContext(ChatContext);
