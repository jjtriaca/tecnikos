"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

/* ── Types ───────────────────────────────────────────── */

type EvaluationData = {
  serviceOrder: { title: string };
  partner: { name: string };
  alreadyEvaluated: boolean;
};

/* ── Star Component ──────────────────────────────────── */

function Star({
  filled,
  hovered,
  onSelect,
  onHover,
  onLeave,
}: {
  filled: boolean;
  hovered: boolean;
  onSelect: () => void;
  onHover: () => void;
  onLeave: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      onMouseEnter={onHover}
      onMouseLeave={onLeave}
      className="p-1 transition-transform duration-150 active:scale-90 focus:outline-none"
      aria-label="Selecionar nota"
    >
      <svg
        className={`h-10 w-10 sm:h-12 sm:w-12 transition-colors duration-150 ${
          filled || hovered
            ? "text-yellow-400 drop-shadow-sm"
            : "text-slate-200"
        }`}
        fill="currentColor"
        viewBox="0 0 24 24"
      >
        <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
      </svg>
    </button>
  );
}

/* ── Main Page ───────────────────────────────────────── */

export default function RateTokenPage() {
  const { token } = useParams<{ token: string }>();

  // Data fetch state
  const [data, setData] = useState<EvaluationData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [score, setScore] = useState(0);
  const [hoveredStar, setHoveredStar] = useState(0);
  const [comment, setComment] = useState("");

  // Submission state
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  /* ── Load evaluation data ── */
  useEffect(() => {
    if (!token) return;

    (async () => {
      try {
        const res = await fetch(`/api/evaluations/public/${token}`);
        if (!res.ok) {
          if (res.status === 404) {
            setError("Link de avaliacao invalido ou expirado.");
          } else {
            setError("Erro ao carregar dados da avaliacao.");
          }
          return;
        }
        const json: EvaluationData = await res.json();
        setData(json);
      } catch {
        setError("Erro de conexao. Verifique sua internet e tente novamente.");
      } finally {
        setLoading(false);
      }
    })();
  }, [token]);

  /* ── Submit evaluation ── */
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (score === 0) return;

    setSubmitting(true);
    setSubmitError(null);

    try {
      const res = await fetch(`/api/evaluations/public/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ score, comment: comment.trim() || undefined }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.message || "Erro ao enviar avaliacao.");
      }

      setSubmitted(true);
    } catch (err: unknown) {
      setSubmitError(
        err instanceof Error ? err.message : "Erro ao enviar avaliacao."
      );
    } finally {
      setSubmitting(false);
    }
  }

  /* ── Loading state ── */
  if (loading) {
    return (
      <div className="w-full text-center">
        <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-[3px] border-blue-600 border-t-transparent" />
        <p className="text-sm text-slate-400">Carregando...</p>
      </div>
    );
  }

  /* ── Error state ── */
  if (error) {
    return (
      <div className="w-full rounded-2xl border border-red-100 bg-white p-8 text-center shadow-sm">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-red-50">
          <svg
            className="h-7 w-7 text-red-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z"
            />
          </svg>
        </div>
        <h2 className="text-lg font-semibold text-slate-800 mb-1">
          Avaliacao indisponivel
        </h2>
        <p className="text-sm text-slate-500">{error}</p>
      </div>
    );
  }

  if (!data) return null;

  /* ── Already evaluated state ── */
  if (data.alreadyEvaluated) {
    return (
      <div className="w-full rounded-2xl border border-green-100 bg-white p-8 text-center shadow-sm">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-green-50">
          <svg
            className="h-7 w-7 text-green-500"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        </div>
        <h2 className="text-lg font-semibold text-slate-800 mb-1">
          Obrigado pela sua avaliacao!
        </h2>
        <p className="text-sm text-slate-500">
          Voce ja avaliou este servico. Agradecemos seu feedback!
        </p>
      </div>
    );
  }

  /* ── Success state (after submit) ── */
  if (submitted) {
    return (
      <div className="w-full rounded-2xl border border-green-100 bg-white p-8 text-center shadow-sm">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-green-50">
          <svg
            className="h-7 w-7 text-green-500"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        </div>
        <h2 className="text-lg font-semibold text-slate-800 mb-1">
          Avaliacao enviada com sucesso!
        </h2>
        <p className="text-sm text-slate-500">
          Obrigado pelo seu feedback. Ele nos ajuda a melhorar nossos servicos.
        </p>
      </div>
    );
  }

  /* ── Rating form ── */
  const scoreLabels = ["", "Pessimo", "Ruim", "Regular", "Bom", "Excelente"];

  return (
    <div className="w-full rounded-2xl border border-slate-200/80 bg-white p-6 sm:p-8 shadow-sm">
      {/* Header */}
      <div className="mb-6 text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-blue-700 shadow-sm">
          <svg
            className="h-6 w-6 text-white"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            strokeWidth={2.2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"
            />
          </svg>
        </div>
        <h1 className="text-xl font-bold text-slate-800 mb-1">
          Avalie o servico
        </h1>
        <p className="text-sm text-slate-500">
          Sua opiniao e muito importante para nos
        </p>
      </div>

      {/* Service info */}
      <div className="mb-6 rounded-xl bg-slate-50 p-4">
        <div className="mb-2">
          <p className="text-[11px] font-medium uppercase tracking-wider text-slate-400">
            Ordem de servico
          </p>
          <p className="text-sm font-semibold text-slate-700">
            {data.serviceOrder.title}
          </p>
        </div>
        <div>
          <p className="text-[11px] font-medium uppercase tracking-wider text-slate-400">
            Tecnico responsavel
          </p>
          <p className="text-sm font-semibold text-slate-700">
            {data.partner.name}
          </p>
        </div>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit}>
        {/* Stars */}
        <div className="mb-2 text-center">
          <p className="text-sm font-medium text-slate-600 mb-3">
            Como voce avalia o servico?
          </p>
          <div className="flex items-center justify-center gap-1">
            {[1, 2, 3, 4, 5].map((value) => (
              <Star
                key={value}
                filled={value <= score}
                hovered={value <= hoveredStar}
                onSelect={() => setScore(value)}
                onHover={() => setHoveredStar(value)}
                onLeave={() => setHoveredStar(0)}
              />
            ))}
          </div>
          <div className="mt-1 h-5">
            {(hoveredStar > 0 || score > 0) && (
              <p className="text-sm font-medium text-blue-600">
                {scoreLabels[hoveredStar || score]}
              </p>
            )}
          </div>
        </div>

        {/* Comment */}
        <div className="mb-6">
          <label
            htmlFor="comment"
            className="mb-1.5 block text-sm font-medium text-slate-600"
          >
            Comentario{" "}
            <span className="font-normal text-slate-400">(opcional)</span>
          </label>
          <textarea
            id="comment"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Conte-nos mais sobre sua experiencia..."
            rows={3}
            maxLength={500}
            className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 placeholder-slate-300 outline-none transition-colors focus:border-blue-400 focus:ring-2 focus:ring-blue-100 resize-none"
          />
          <p className="mt-1 text-right text-[11px] text-slate-300">
            {comment.length}/500
          </p>
        </div>

        {/* Submit error */}
        {submitError && (
          <div className="mb-4 rounded-xl bg-red-50 border border-red-100 px-4 py-3 text-sm text-red-600">
            {submitError}
          </div>
        )}

        {/* Submit button */}
        <button
          type="submit"
          disabled={score === 0 || submitting}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 py-3.5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-blue-700 focus:ring-2 focus:ring-blue-300 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 active:scale-[0.98]"
        >
          {submitting ? (
            <>
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
              Enviando...
            </>
          ) : (
            "Enviar avaliacao"
          )}
        </button>

        {score === 0 && (
          <p className="mt-2 text-center text-xs text-slate-400">
            Selecione uma nota para continuar
          </p>
        )}
      </form>
    </div>
  );
}
