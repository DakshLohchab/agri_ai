import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { useLanguage } from "@/context/LanguageContext";
import { translateRichText, translateText } from "@/services/translation";

export type Message = {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  originalContent?: string;
  originalLanguage?: string;
  contentLanguage?: string;
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
  originalTitle?: string;
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
  const { language } = useLanguage();
  const [rawConversations, setRawConversations] = useState<Conversation[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);
  const [hasLoaded, setHasLoaded] = useState(false);

  useEffect(() => {
    loadConversations();
  }, []);

  const loadConversations = async () => {
    try {
      const stored = await AsyncStorage.getItem("agri_conversations");
      if (stored) {
        const parsed = (JSON.parse(stored) as Conversation[]).map((conversation) => ({
          ...conversation,
          originalTitle: conversation.originalTitle ?? conversation.title,
          messages: conversation.messages.map((message) => ({
            ...message,
            originalContent: message.originalContent ?? message.content,
            originalLanguage:
              message.originalLanguage ??
              message.contentLanguage ??
              (message.role === "assistant" ? "en" : "auto"),
            contentLanguage: message.contentLanguage ?? message.originalLanguage ?? "auto",
          })),
        }));
        setRawConversations(parsed);
        setConversations(parsed);
        saveConversations(parsed);
      }
    } catch (e) {
      console.error("Failed to load conversations", e);
    } finally {
      setHasLoaded(true);
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
      originalTitle: "New Query",
      messages: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    setRawConversations((prev) => {
      const updated = [newConv, ...prev];
      saveConversations(updated);
      return updated;
    });
    return id;
  }, []);

  const deleteConversation = useCallback((id: string) => {
    setRawConversations((prev) => {
      const updated = prev.filter((c) => c.id !== id);
      saveConversations(updated);
      return updated;
    });
    setCurrentConversationId((prev) => (prev === id ? null : prev));
  }, []);

  const addMessage = useCallback((convId: string, message: Message) => {
    setRawConversations((prev) => {
      const updated = prev.map((c) => {
        if (c.id !== convId) return c;
        const nextMessage = {
          ...message,
          originalContent: message.originalContent ?? message.content,
          originalLanguage:
            message.originalLanguage ??
            (message.role === "assistant" ? "en" : message.contentLanguage ?? language.code),
          contentLanguage: message.contentLanguage ?? language.code,
        };
        const firstUserMsg = c.messages.find((m) => m.role === "user");
        const title = firstUserMsg
          ? firstUserMsg.content.slice(0, 40) + (firstUserMsg.content.length > 40 ? "..." : "")
          : nextMessage.role === "user"
          ? nextMessage.content.slice(0, 40)
          : c.title;
        const originalTitle = firstUserMsg
          ? (firstUserMsg.originalContent ?? firstUserMsg.content).slice(0, 40) +
            ((firstUserMsg.originalContent ?? firstUserMsg.content).length > 40 ? "..." : "")
          : nextMessage.role === "user"
          ? (nextMessage.originalContent ?? nextMessage.content).slice(0, 40) +
            ((nextMessage.originalContent ?? nextMessage.content).length > 40 ? "..." : "")
          : c.originalTitle ?? c.title;
        return {
          ...c,
          messages: [...c.messages, nextMessage],
          title,
          originalTitle,
          updatedAt: Date.now(),
        };
      });
      saveConversations(updated);
      return updated;
    });
  }, [language.code]);

  const updateMessage = useCallback((convId: string, msgId: string, updates: Partial<Message>) => {
    setRawConversations((prev) => {
      const updated = prev.map((c) => {
        if (c.id !== convId) return c;
        return {
          ...c,
          messages: c.messages.map((m) =>
            m.id === msgId
              ? {
                  ...m,
                  ...updates,
                  originalContent:
                    updates.originalContent ??
                    m.originalContent ??
                    (typeof updates.content === "string" && updates.content.length > 0
                      ? updates.content
                      : m.content),
                  originalLanguage:
                    updates.originalLanguage ??
                    m.originalLanguage ??
                    m.contentLanguage ??
                    language.code,
                  contentLanguage: updates.contentLanguage ?? m.contentLanguage ?? language.code,
                }
              : m
          ),
          updatedAt: Date.now(),
        };
      });
      saveConversations(updated);
      return updated;
    });
  }, [language.code]);

  useEffect(() => {
    if (!hasLoaded) return;

    let cancelled = false;

    setConversations(rawConversations);

    const translateConversations = async () => {
      const translated = await Promise.all(
        rawConversations.map(async (conversation) => {
          const translatedMessages = await Promise.all(
            conversation.messages.map(async (message) => {
              const baseContent = message.originalContent ?? message.content;
              const baseLanguage = message.originalLanguage ?? message.contentLanguage ?? "auto";
              let content = baseContent;

              if (!(language.code === baseLanguage || (language.code === "en" && baseLanguage === "en"))) {
                try {
                  content = await translateRichText(
                    baseContent,
                    language.code,
                    baseLanguage === language.code ? "auto" : baseLanguage
                  );
                } catch {
                  content = baseContent;
                }
              }

              return {
                ...message,
                originalContent: baseContent,
                originalLanguage: baseLanguage,
                content,
                contentLanguage: language.code,
              };
            })
          );

          const firstUserBaseMessage = conversation.messages.find((item) => item.role === "user");
          const firstUserMessage =
            translatedMessages.find((item) => item.role === "user")?.content ?? conversation.title;
          const titleBase = firstUserMessage.slice(0, 40);
          const title =
            firstUserMessage.length > 40 && !titleBase.endsWith("...")
              ? `${titleBase}...`
              : titleBase;
          const originalTitle =
            firstUserBaseMessage?.originalContent ??
            conversation.originalTitle ??
            conversation.title;
          const originalTitleLanguage =
            firstUserBaseMessage?.originalLanguage ??
            firstUserBaseMessage?.contentLanguage ??
            "auto";
          let translatedTitle = originalTitle || title || conversation.title;

          if (language.code !== originalTitleLanguage) {
            try {
              translatedTitle = await translateText(
                originalTitle || title || conversation.title,
                language.code,
                originalTitleLanguage
              );
            } catch {
              translatedTitle = originalTitle || title || conversation.title;
            }
          }

          return {
            ...conversation,
            messages: translatedMessages,
            originalTitle,
            title: translatedTitle,
          };
        })
      );

      if (cancelled) return;
      setConversations(translated);
    };

    translateConversations().catch(() => {
      setConversations(rawConversations);
    });

    return () => {
      cancelled = true;
    };
  }, [rawConversations, hasLoaded, language.code]);

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
