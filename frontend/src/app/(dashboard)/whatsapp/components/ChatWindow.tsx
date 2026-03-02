"use client";

import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";

type Message = {
  id: string;
  companyId: string;
  partnerId: string | null;
  remotePhone: string;
  direction: string;
  messageType: string;
  content: string;
  caption: string | null;
  whatsappMsgId: string | null;
  status: string;
  createdAt: string;
  partner: { id: string; name: string } | null;
};

interface ChatWindowProps {
  phone: string;
  partnerName: string | null;
  onMessageSent: () => void;
}

export default function ChatWindow({ phone, partnerName, onMessageSent }: ChatWindowProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const pollRef = useRef<NodeJS.Timeout | null>(null);

  function formatPhone(p: string): string {
    const d = p.replace(/\D/g, "");
    if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
    if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
    return p;
  }

  async function loadMessages() {
    try {
      const data = await api.get<Message[]>(`/whatsapp/messages/${encodeURIComponent(phone)}?take=100`);
      setMessages(data.reverse()); // API returns desc, we want asc
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    setLoading(true);
    setMessages([]);
    loadMessages();

    // Poll for new messages every 5 seconds
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(loadMessages, 5000);

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phone]);

  useEffect(() => {
    // Scroll to bottom on new messages
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  useEffect(() => {
    inputRef.current?.focus();
  }, [phone]);

  async function handleSend() {
    if (!text.trim() || sending) return;

    setSending(true);
    try {
      await api.post("/whatsapp/send", {
        phone,
        message: text.trim(),
      });
      setText("");
      await loadMessages();
      onMessageSent();
    } catch {
      // ignore
    } finally {
      setSending(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  function formatTime(dateStr: string): string {
    return new Date(dateStr).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  }

  function formatDate(dateStr: string): string {
    const d = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - d.getTime();

    if (diff < 86400000 && d.getDate() === now.getDate()) return "Hoje";
    if (diff < 172800000) return "Ontem";
    return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });
  }

  // Group messages by date
  const grouped: { date: string; messages: Message[] }[] = [];
  let currentDate = "";
  for (const msg of messages) {
    const date = formatDate(msg.createdAt);
    if (date !== currentDate) {
      currentDate = date;
      grouped.push({ date, messages: [] });
    }
    grouped[grouped.length - 1].messages.push(msg);
  }

  function statusIcon(status: string) {
    switch (status) {
      case "READ":
        return <span className="text-blue-400">&#10003;&#10003;</span>;
      case "DELIVERED":
        return <span className="text-slate-400">&#10003;&#10003;</span>;
      case "SENT":
        return <span className="text-slate-400">&#10003;</span>;
      case "FAILED":
        return <span className="text-red-400">&#10007;</span>;
      default:
        return null;
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-200 bg-white">
        <div className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full text-sm font-bold ${
          partnerName
            ? "bg-gradient-to-br from-green-500 to-green-700 text-white"
            : "bg-slate-200 text-slate-500"
        }`}>
          {partnerName ? partnerName.charAt(0).toUpperCase() : "#"}
        </div>
        <div>
          <p className="text-sm font-semibold text-slate-800">
            {partnerName || formatPhone(phone)}
          </p>
          <p className="text-xs text-slate-500">
            {partnerName && formatPhone(phone)}
          </p>
        </div>
      </div>

      {/* Messages */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto bg-[#efeae2] bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAiIGhlaWdodD0iMjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGNpcmNsZSBjeD0iMSIgY3k9IjEiIHI9IjEiIGZpbGw9InJnYmEoMCwwLDAsMC4wMykiLz48L3N2Zz4=')] px-4 py-3"
      >
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <div className="flex items-center gap-2 text-slate-400 text-sm">
              <svg className="h-5 w-5 animate-spin" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Carregando mensagens...
            </div>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-slate-400 text-sm">
            <svg className="h-16 w-16 mb-3 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
            <p>Nenhuma mensagem ainda.</p>
            <p className="text-xs mt-1">Envie a primeira mensagem abaixo.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {grouped.map((group) => (
              <div key={group.date}>
                {/* Date separator */}
                <div className="flex justify-center mb-3">
                  <span className="rounded-lg bg-white/80 px-3 py-1 text-xs font-medium text-slate-500 shadow-sm">
                    {group.date}
                  </span>
                </div>

                {/* Messages */}
                <div className="space-y-1">
                  {group.messages.map((msg) => {
                    const isOutbound = msg.direction === "OUTBOUND";
                    return (
                      <div
                        key={msg.id}
                        className={`flex ${isOutbound ? "justify-end" : "justify-start"}`}
                      >
                        <div
                          className={`max-w-[75%] rounded-xl px-3 py-2 shadow-sm ${
                            isOutbound
                              ? "bg-[#d9fdd3] rounded-tr-sm"
                              : "bg-white rounded-tl-sm"
                          }`}
                        >
                          {/* Content */}
                          <p className="text-sm text-slate-800 whitespace-pre-wrap break-words">
                            {msg.content}
                          </p>

                          {/* Footer: time + status */}
                          <div className={`flex items-center gap-1 mt-1 ${isOutbound ? "justify-end" : ""}`}>
                            <span className="text-[10px] text-slate-400">
                              {formatTime(msg.createdAt)}
                            </span>
                            {isOutbound && (
                              <span className="text-[10px]">{statusIcon(msg.status)}</span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Input */}
      <div className="flex items-center gap-2 px-3 py-3 border-t border-slate-200 bg-white">
        <input
          ref={inputRef}
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Digite uma mensagem..."
          disabled={sending}
          className="flex-1 rounded-full border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm outline-none focus:border-green-400 focus:bg-white transition-colors disabled:opacity-50"
        />
        <button
          onClick={handleSend}
          disabled={!text.trim() || sending}
          className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-green-500 text-white hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {sending ? (
            <svg className="h-5 w-5 animate-spin" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          ) : (
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
              <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
            </svg>
          )}
        </button>
      </div>
    </div>
  );
}
