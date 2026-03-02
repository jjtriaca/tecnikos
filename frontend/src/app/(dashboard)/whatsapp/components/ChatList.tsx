"use client";

import { useState } from "react";

export type Conversation = {
  remotePhone: string;
  lastMessage: string;
  lastDirection: string;
  lastMessageType: string;
  lastStatus: string;
  lastMessageAt: string;
  partnerId: string | null;
  partnerName: string | null;
  partnerDocument: string | null;
  unreadCount: number;
};

interface ChatListProps {
  conversations: Conversation[];
  selectedPhone: string | null;
  onSelect: (phone: string) => void;
  loading: boolean;
}

export default function ChatList({ conversations, selectedPhone, onSelect, loading }: ChatListProps) {
  const [search, setSearch] = useState("");

  const filtered = search
    ? conversations.filter(
        (c) =>
          c.remotePhone.includes(search) ||
          c.partnerName?.toLowerCase().includes(search.toLowerCase())
      )
    : conversations;

  function formatPhone(phone: string): string {
    const d = phone.replace(/\D/g, "");
    if (d.length === 11) {
      return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
    }
    if (d.length === 10) {
      return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
    }
    return phone;
  }

  function formatTime(dateStr: string): string {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const oneDay = 86400000;

    if (diff < oneDay && date.getDate() === now.getDate()) {
      return date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
    }
    if (diff < 2 * oneDay) return "Ontem";
    if (diff < 7 * oneDay) {
      const days = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sab"];
      return days[date.getDay()];
    }
    return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
  }

  function truncate(text: string, max: number): string {
    return text.length > max ? text.slice(0, max) + "..." : text;
  }

  if (loading) {
    return (
      <div className="flex flex-col h-full">
        <div className="p-3 border-b border-slate-200">
          <div className="h-10 animate-pulse rounded-lg bg-slate-100" />
        </div>
        <div className="flex-1 space-y-2 p-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-16 animate-pulse rounded-lg bg-slate-100" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Search */}
      <div className="p-3 border-b border-slate-200">
        <div className="relative">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nome ou telefone..."
            className="w-full rounded-lg border border-slate-200 bg-slate-50 pl-10 pr-3 py-2.5 text-sm outline-none focus:border-blue-400 focus:bg-white transition-colors"
          />
        </div>
      </div>

      {/* Conversations */}
      <div className="flex-1 overflow-y-auto">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-slate-400 text-sm p-4">
            <svg className="h-12 w-12 mb-3 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
            {search ? "Nenhuma conversa encontrada" : "Nenhuma conversa ainda"}
          </div>
        ) : (
          filtered.map((conv) => {
            const isSelected = selectedPhone === conv.remotePhone;
            return (
              <button
                key={conv.remotePhone}
                onClick={() => onSelect(conv.remotePhone)}
                className={`w-full flex items-center gap-3 px-3 py-3 text-left hover:bg-slate-50 transition-colors border-b border-slate-100 ${
                  isSelected ? "bg-blue-50 border-l-2 border-l-blue-500" : ""
                }`}
              >
                {/* Avatar */}
                <div className={`flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full text-sm font-bold ${
                  conv.partnerName
                    ? "bg-gradient-to-br from-green-500 to-green-700 text-white"
                    : "bg-slate-200 text-slate-500"
                }`}>
                  {conv.partnerName
                    ? conv.partnerName.charAt(0).toUpperCase()
                    : "#"}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-slate-800 truncate">
                      {conv.partnerName || formatPhone(conv.remotePhone)}
                    </span>
                    <span className="text-[11px] text-slate-400 flex-shrink-0 ml-2">
                      {formatTime(conv.lastMessageAt)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between mt-0.5">
                    <span className="text-xs text-slate-500 truncate">
                      {conv.lastDirection === "OUTBOUND" && (
                        <span className="text-blue-500 mr-1">
                          {conv.lastStatus === "READ" ? "✓✓" : conv.lastStatus === "DELIVERED" ? "✓✓" : "✓"}
                        </span>
                      )}
                      {truncate(conv.lastMessage, 45)}
                    </span>
                    {conv.unreadCount > 0 && (
                      <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-green-500 px-1.5 text-[10px] font-bold text-white flex-shrink-0 ml-2">
                        {conv.unreadCount}
                      </span>
                    )}
                  </div>
                </div>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
