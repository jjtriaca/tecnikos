"use client";

import { createContext, useContext, useState, useCallback, useEffect, useRef, ReactNode } from "react";
import { api, getAccessToken } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  actionButtons?: { label: string; href: string; icon?: string }[];
  createdAt: string;
}

interface Conversation {
  id: string;
  title: string | null;
  isOnboarding: boolean;
  messageCount: number;
  lastMessageAt: string | null;
  createdAt: string;
}

interface OnboardingItem {
  key: string;
  label: string;
  done: boolean;
  optional: boolean;
  href: string;
  description: string;
}

interface OnboardingStatus {
  allDone: boolean;
  requiredDone: boolean;
  items: OnboardingItem[];
  completedCount: number;
  totalRequired: number;
}

interface ChatIAContextValue {
  isOpen: boolean;
  setIsOpen: (v: boolean) => void;
  available: boolean;
  loading: boolean;
  sending: boolean;
  messages: ChatMessage[];
  conversationId: string | null;
  conversations: Conversation[];
  usage: { used: number; limit: number };
  onboarding: OnboardingStatus | null;
  sendMessage: (content: string) => Promise<void>;
  loadWelcome: () => Promise<void>;
  loadConversation: (id: string) => Promise<void>;
  newConversation: () => void;
  refreshOnboarding: () => Promise<void>;
}

const ChatIAContext = createContext<ChatIAContextValue | null>(null);

export function ChatIAProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [available, setAvailable] = useState(false);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [usage, setUsage] = useState({ used: 0, limit: 50 });
  const [onboarding, setOnboarding] = useState<OnboardingStatus | null>(null);
  const [initialized, setInitialized] = useState(false);

  // Check availability + auto-open on first access
  useEffect(() => {
    if (!user) return;
    api.get<{ available: boolean }>("/chat-ia/status")
      .then((res) => {
        setAvailable(res.available);
        // Auto-open on first access (never opened chat before)
        if (res.available && !localStorage.getItem("chatia_opened")) {
          localStorage.setItem("chatia_opened", "1");
          setIsOpen(true);
        }
      })
      .catch(() => setAvailable(false));
  }, [user]);

  // Load usage + onboarding on open
  useEffect(() => {
    if (!isOpen || !user || initialized) return;
    setInitialized(true);

    Promise.all([
      api.get<{ used: number; limit: number }>("/chat-ia/usage").catch(() => ({ used: 0, limit: 50 })),
      api.get<OnboardingStatus>("/chat-ia/onboarding-status").catch(() => null),
      api.get<Conversation[]>("/chat-ia/conversations").catch(() => []),
    ]).then(([u, ob, convs]) => {
      setUsage(u);
      setOnboarding(ob);
      setConversations(convs);
    });
  }, [isOpen, user, initialized]);

  const loadWelcome = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<{ content: string; actionButtons?: any[] }>("/chat-ia/welcome");
      setMessages([{
        id: "welcome",
        role: "assistant",
        content: res.content,
        actionButtons: res.actionButtons,
        createdAt: new Date().toISOString(),
      }]);
      setConversationId(null);
    } catch {
      setMessages([{
        id: "error",
        role: "assistant",
        content: "Não foi possível conectar ao assistente. Tente novamente mais tarde.",
        createdAt: new Date().toISOString(),
      }]);
    } finally {
      setLoading(false);
    }
  }, []);

  const sendMessage = useCallback(async (content: string) => {
    if (!content.trim() || sending) return;

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      content,
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setSending(true);

    const streamId = `stream-${Date.now()}`;
    let streamedContent = "";
    let messageAdded = false;

    try {
      const token = getAccessToken();
      const res = await fetch("/api/chat-ia/message-stream", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ conversationId, content }),
        credentials: "include",
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => null);
        throw new Error(errData?.message || "Erro ao enviar mensagem");
      }

      const reader = res.body?.getReader();
      if (!reader) throw new Error("Streaming não suportado");

      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        // Process complete SSE events (separated by \n\n)
        while (true) {
          const idx = buffer.indexOf("\n\n");
          if (idx === -1) break;

          const block = buffer.slice(0, idx);
          buffer = buffer.slice(idx + 2);

          let eventType = "";
          let eventData = "";
          for (const line of block.split("\n")) {
            if (line.startsWith("event: ")) eventType = line.slice(7);
            else if (line.startsWith("data: ")) eventData = line.slice(6);
          }

          if (!eventType || !eventData) continue;

          try {
            const data = JSON.parse(eventData);

            if (eventType === "delta") {
              streamedContent += data.text;
              if (!messageAdded) {
                messageAdded = true;
                setMessages((prev) => [...prev, {
                  id: streamId,
                  role: "assistant",
                  content: streamedContent,
                  createdAt: new Date().toISOString(),
                }]);
              } else {
                setMessages((prev) => prev.map((m) =>
                  m.id === streamId ? { ...m, content: streamedContent } : m,
                ));
              }
            } else if (eventType === "buttons") {
              setMessages((prev) => prev.map((m) =>
                m.id === streamId ? { ...m, actionButtons: data.buttons } : m,
              ));
            } else if (eventType === "done") {
              if (data.conversationId) {
                setConversationId(data.conversationId);
              }
            } else if (eventType === "error") {
              if (!messageAdded) {
                setMessages((prev) => [...prev, {
                  id: streamId,
                  role: "assistant",
                  content: data.message || "Erro ao processar mensagem.",
                  createdAt: new Date().toISOString(),
                }]);
              } else {
                setMessages((prev) => prev.map((m) =>
                  m.id === streamId
                    ? { ...m, content: m.content + "\n\n*Erro: " + (data.message || "Erro inesperado") + "*" }
                    : m,
                ));
              }
            }
          } catch { /* ignore parse errors */ }
        }
      }

      // Update usage
      setUsage((prev) => ({ ...prev, used: prev.used + 1 }));
    } catch (err: any) {
      if (!messageAdded) {
        setMessages((prev) => [...prev, {
          id: `error-${Date.now()}`,
          role: "assistant",
          content: err.message || "Erro ao enviar mensagem. Tente novamente.",
          createdAt: new Date().toISOString(),
        }]);
      }
    } finally {
      setSending(false);
    }
  }, [conversationId, sending]);

  const loadConversation = useCallback(async (id: string) => {
    setLoading(true);
    try {
      const msgs = await api.get<ChatMessage[]>(`/chat-ia/conversations/${id}/messages`);
      setMessages(msgs);
      setConversationId(id);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  const newConversation = useCallback(() => {
    setMessages([]);
    setConversationId(null);
    loadWelcome();
  }, [loadWelcome]);

  const refreshOnboarding = useCallback(async () => {
    try {
      const ob = await api.get<OnboardingStatus>("/chat-ia/onboarding-status");
      setOnboarding(ob);
    } catch {
      // ignore
    }
  }, []);

  return (
    <ChatIAContext.Provider
      value={{
        isOpen,
        setIsOpen,
        available,
        loading,
        sending,
        messages,
        conversationId,
        conversations,
        usage,
        onboarding,
        sendMessage,
        loadWelcome,
        loadConversation,
        newConversation,
        refreshOnboarding,
      }}
    >
      {children}
    </ChatIAContext.Provider>
  );
}

export function useChatIA() {
  const ctx = useContext(ChatIAContext);
  if (!ctx) throw new Error("useChatIA must be inside ChatIAProvider");
  return ctx;
}
