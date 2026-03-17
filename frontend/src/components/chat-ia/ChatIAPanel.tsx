"use client";

import { useEffect, useRef, useState } from "react";
import { useChatIA } from "@/contexts/ChatIAContext";
import ChatIAMessage from "./ChatIAMessage";
import ChatIAInput from "./ChatIAInput";
import ChatIAButton from "./ChatIAButton";
import { api } from "@/lib/api";

export default function ChatIAPanel() {
  const { isOpen, setIsOpen, loading, sending, messages, usage, newConversation, conversations, loadConversation } = useChatIA();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [showSuggestion, setShowSuggestion] = useState(false);
  const [suggCategory, setSuggCategory] = useState("MELHORIA");
  const [suggTitle, setSuggTitle] = useState("");
  const [suggDesc, setSuggDesc] = useState("");
  const [suggSending, setSuggSending] = useState(false);
  const [suggSent, setSuggSent] = useState(false);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, sending]);

  return (
    <>
      <ChatIAButton />

      {isOpen && (
        <div className="fixed inset-0 z-[85] flex flex-col overflow-hidden bg-white shadow-2xl animate-in slide-in-from-bottom-4 duration-200 sm:inset-auto sm:right-6 sm:bottom-24 sm:h-[min(600px,80vh)] sm:w-[400px] sm:rounded-2xl sm:border sm:border-slate-200">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-slate-100 bg-gradient-to-r from-blue-600 to-blue-700 px-4 py-3">
            <div className="flex items-center gap-2">
              <svg className="h-5 w-5 text-blue-200" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
              </svg>
              <div>
                <h3 className="text-sm font-semibold text-white">Assistente IA</h3>
                <p className="text-[10px] text-blue-200">{usage.used}/{usage.limit} mensagens</p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              {/* History button */}
              <button
                onClick={() => setShowHistory(!showHistory)}
                className="rounded-lg p-1.5 text-blue-200 transition-colors hover:bg-blue-500/30 hover:text-white"
                title="Histórico"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </button>
              {/* New conversation */}
              <button
                onClick={newConversation}
                className="rounded-lg p-1.5 text-blue-200 transition-colors hover:bg-blue-500/30 hover:text-white"
                title="Nova conversa"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                </svg>
              </button>
              {/* Suggest improvement */}
              <button
                onClick={() => { setShowSuggestion(true); setSuggSent(false); }}
                className="rounded-lg p-1.5 text-blue-200 transition-colors hover:bg-blue-500/30 hover:text-white"
                title="Solicitar melhoria"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 18v-5.25m0 0a6.01 6.01 0 001.5-.189m-1.5.189a6.01 6.01 0 01-1.5-.189m3.75 7.478a12.06 12.06 0 01-4.5 0m3.75 2.383a14.406 14.406 0 01-3 0M14.25 18v-.192c0-.983.658-1.823 1.508-2.316a7.5 7.5 0 10-7.517 0c.85.493 1.509 1.333 1.509 2.316V18" />
                </svg>
              </button>
              {/* Close */}
              <button
                onClick={() => setIsOpen(false)}
                className="rounded-lg p-1.5 text-blue-200 transition-colors hover:bg-blue-500/30 hover:text-white"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 5.25l-7.5 7.5-7.5-7.5m15 6l-7.5 7.5-7.5-7.5" />
                </svg>
              </button>
            </div>
          </div>

          {/* History panel */}
          {showHistory && (
            <div className="border-b border-slate-200 bg-slate-50 p-3 max-h-48 overflow-y-auto">
              <p className="mb-2 text-[11px] font-medium text-slate-500 uppercase">Conversas anteriores</p>
              {conversations.length === 0 ? (
                <p className="text-xs text-slate-400">Nenhuma conversa ainda</p>
              ) : (
                <div className="space-y-1">
                  {conversations.map((conv) => (
                    <button
                      key={conv.id}
                      onClick={() => {
                        loadConversation(conv.id);
                        setShowHistory(false);
                      }}
                      className="w-full rounded-lg px-2.5 py-2 text-left text-xs text-slate-600 transition-colors hover:bg-slate-200"
                    >
                      <div className="font-medium truncate">{conv.title || "Sem título"}</div>
                      <div className="text-[10px] text-slate-400">{conv.messageCount} msgs</div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Suggestion panel */}
          {showSuggestion && (
            <div className="border-b border-slate-200 bg-white p-4">
              {suggSent ? (
                <div className="text-center py-4">
                  <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-green-50">
                    <svg className="h-5 w-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <p className="text-sm font-medium text-slate-700">Sugestao enviada!</p>
                  <p className="text-xs text-slate-400 mt-1">Obrigado pelo seu feedback</p>
                  <button onClick={() => setShowSuggestion(false)} className="mt-3 text-xs text-blue-600 hover:text-blue-700">Fechar</button>
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-sm font-semibold text-slate-700">Solicitar melhoria</p>
                    <button onClick={() => setShowSuggestion(false)} className="text-slate-400 hover:text-slate-600">
                      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                  <select
                    value={suggCategory}
                    onChange={(e) => setSuggCategory(e.target.value)}
                    className="mb-2 w-full rounded-lg border border-slate-200 px-3 py-1.5 text-xs text-slate-700 focus:border-blue-400 focus:ring-1 focus:ring-blue-100 outline-none"
                  >
                    <option value="MELHORIA">Melhoria</option>
                    <option value="BUG">Bug / Erro</option>
                    <option value="DUVIDA">Duvida</option>
                  </select>
                  <input
                    placeholder="Titulo da sugestao..."
                    value={suggTitle}
                    onChange={(e) => setSuggTitle(e.target.value)}
                    className="mb-2 w-full rounded-lg border border-slate-200 px-3 py-1.5 text-xs text-slate-700 placeholder-slate-300 focus:border-blue-400 focus:ring-1 focus:ring-blue-100 outline-none"
                  />
                  <textarea
                    placeholder="Descreva o que gostaria de melhorar..."
                    value={suggDesc}
                    onChange={(e) => setSuggDesc(e.target.value)}
                    rows={3}
                    className="mb-2 w-full rounded-lg border border-slate-200 px-3 py-1.5 text-xs text-slate-700 placeholder-slate-300 focus:border-blue-400 focus:ring-1 focus:ring-blue-100 outline-none resize-none"
                  />
                  <button
                    disabled={suggTitle.length < 5 || suggDesc.length < 10 || suggSending}
                    onClick={async () => {
                      setSuggSending(true);
                      try {
                        await api.post("/suggestions", { category: suggCategory, title: suggTitle, description: suggDesc });
                        setSuggSent(true);
                        setSuggTitle(""); setSuggDesc(""); setSuggCategory("MELHORIA");
                      } catch { /* ignore */ }
                      setSuggSending(false);
                    }}
                    className="w-full rounded-lg bg-blue-600 py-2 text-xs font-semibold text-white transition-all hover:bg-blue-700 disabled:opacity-50"
                  >
                    {suggSending ? "Enviando..." : "Enviar sugestao"}
                  </button>
                </>
              )}
            </div>
          )}

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {loading && messages.length === 0 && (
              <div className="flex items-center justify-center py-8">
                <svg className="h-6 w-6 animate-spin text-blue-500" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              </div>
            )}

            {messages.map((msg) => (
              <ChatIAMessage
                key={msg.id}
                role={msg.role}
                content={msg.content}
                actionButtons={msg.actionButtons}
              />
            ))}

            {sending && messages[messages.length - 1]?.role !== "assistant" && (
              <div className="flex gap-2">
                <div className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-600 to-blue-700">
                  <svg className="h-4 w-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
                  </svg>
                </div>
                <div className="rounded-2xl rounded-bl-md bg-slate-100 px-4 py-3">
                  <div className="flex gap-1">
                    <span className="h-2 w-2 animate-bounce rounded-full bg-slate-400" style={{ animationDelay: "0ms" }} />
                    <span className="h-2 w-2 animate-bounce rounded-full bg-slate-400" style={{ animationDelay: "150ms" }} />
                    <span className="h-2 w-2 animate-bounce rounded-full bg-slate-400" style={{ animationDelay: "300ms" }} />
                  </div>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <ChatIAInput />
        </div>
      )}
    </>
  );
}
