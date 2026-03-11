"use client";

import { createContext, useContext, useState, useCallback, useEffect, ReactNode } from "react";
import { api } from "@/lib/api";
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

  // Check availability
  useEffect(() => {
    if (!user) return;
    api.get<{ available: boolean }>("/chat-ia/status")
      .then((res) => setAvailable(res.available))
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

    try {
      const res = await api.post<{
        conversationId: string;
        message: { content: string; actionButtons?: any[] };
      }>("/chat-ia/message", {
        conversationId,
        content,
      });

      setConversationId(res.conversationId);

      const assistantMsg: ChatMessage = {
        id: `assistant-${Date.now()}`,
        role: "assistant",
        content: res.message.content,
        actionButtons: res.message.actionButtons,
        createdAt: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, assistantMsg]);

      // Update usage
      setUsage((prev) => ({ ...prev, used: prev.used + 1 }));
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        {
          id: `error-${Date.now()}`,
          role: "assistant",
          content: err.message || "Erro ao enviar mensagem. Tente novamente.",
          createdAt: new Date().toISOString(),
        },
      ]);
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
