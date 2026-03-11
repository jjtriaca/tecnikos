"use client";

import { useChatIA } from "@/contexts/ChatIAContext";

export default function ChatIAButton() {
  const { isOpen, setIsOpen, available, usage, onboarding, loadWelcome, messages } = useChatIA();

  if (!available) return null;

  const handleClick = () => {
    if (!isOpen && messages.length === 0) {
      loadWelcome();
    }
    setIsOpen(!isOpen);
  };

  const showPulse = onboarding && !onboarding.requiredDone;

  return (
    <button
      onClick={handleClick}
      className={`fixed right-6 bottom-6 z-[90] flex h-14 w-14 items-center justify-center rounded-full shadow-lg transition-all duration-200 hover:scale-105 active:scale-95 ${
        isOpen
          ? "bg-slate-600 text-white max-sm:hidden"
          : "bg-gradient-to-br from-blue-600 to-blue-700 text-white"
      }`}
      title="Assistente IA"
    >
      {isOpen ? (
        <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      ) : (
        <>
          <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456z"
            />
          </svg>
          {showPulse && (
            <span className="absolute -top-1 -right-1 flex h-4 w-4">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-75" />
              <span className="relative inline-flex h-4 w-4 rounded-full bg-amber-500" />
            </span>
          )}
        </>
      )}

      {/* Usage badge */}
      {!isOpen && usage.used > 0 && (
        <span className="absolute -top-1 -left-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-slate-700 px-1 text-[9px] font-bold text-white">
          {usage.used}/{usage.limit}
        </span>
      )}
    </button>
  );
}
