"use client";

import { useRouter } from "next/navigation";

interface ActionButton {
  label: string;
  href: string;
  icon?: string;
}

interface Props {
  role: "user" | "assistant";
  content: string;
  actionButtons?: ActionButton[];
}

export default function ChatIAMessage({ role, content, actionButtons }: Props) {
  const router = useRouter();

  const isUser = role === "user";

  // Simple markdown rendering (bold, lists, line breaks)
  const renderContent = (text: string) => {
    return text.split("\n").map((line, i) => {
      // Bold
      let rendered = line.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
      // Checkmark items
      rendered = rendered.replace(/^(\d+)\.\s*(\u2B1C|\u2705)\s*/, '<span class="mr-1">$2</span>$1. ');
      // Bullet points
      if (rendered.startsWith("- ")) {
        rendered = `<span class="mr-1 text-blue-400">\u2022</span>${rendered.substring(2)}`;
      }

      return (
        <span key={i} className="block" dangerouslySetInnerHTML={{ __html: rendered }} />
      );
    });
  };

  return (
    <div className={`flex gap-2 ${isUser ? "justify-end" : "justify-start"}`}>
      {!isUser && (
        <div className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-600 to-blue-700">
          <svg className="h-4 w-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
          </svg>
        </div>
      )}

      <div
        className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-[13px] leading-relaxed ${
          isUser
            ? "bg-blue-600 text-white rounded-br-md"
            : "bg-slate-100 text-slate-800 rounded-bl-md"
        }`}
      >
        <div className="space-y-0.5">{renderContent(content)}</div>

        {/* Action buttons */}
        {actionButtons && actionButtons.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {actionButtons.map((btn, i) => (
              <button
                key={i}
                onClick={() => router.push(btn.href)}
                className="inline-flex items-center gap-1 rounded-lg bg-blue-600 px-3 py-1.5 text-[11px] font-medium text-white transition-colors hover:bg-blue-700"
              >
                {btn.icon === "settings" && (
                  <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                )}
                {btn.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
