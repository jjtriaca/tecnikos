"use client";

import { useEffect, useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";

interface SessionData {
  sessionId: string;
  tenantName: string;
  responsibleName: string;
  uploadedCount: number;
  uploadComplete: boolean;
  reviewStatus: string;
  rejectionReason: string | null;
  expired: boolean;
  cnpjCardUrl: string | null;
  docFrontUrl: string | null;
  docBackUrl: string | null;
  selfieFarUrl: string | null;
  selfieMediumUrl: string | null;
  selfieCloseUrl: string | null;
}

const STEPS = [
  { key: "cnpjCard", label: "Cartao CNPJ", description: "PDF ou foto do Cartao CNPJ", accept: "image/*,application/pdf", capture: "environment" as const, icon: "doc" },
  { key: "docFront", label: "Documento (Frente)", description: "Frente do RG ou CNH aberta", accept: "image/*", capture: "environment" as const, icon: "id" },
  { key: "docBack", label: "Documento (Verso)", description: "Verso do RG ou CNH", accept: "image/*", capture: "environment" as const, icon: "id" },
  { key: "selfieClose", label: "Selfie (Perto)", description: "Rosto proximo da camera", accept: "image/*", capture: "user" as const, icon: "face" },
  { key: "selfieMedium", label: "Selfie (Medio)", description: "Rosto a meia distancia", accept: "image/*", capture: "user" as const, icon: "face" },
  { key: "selfieFar", label: "Selfie (Longe)", description: "Rosto distante, meio corpo visivel", accept: "image/*", capture: "user" as const, icon: "face" },
];

const URL_MAP: Record<string, keyof SessionData> = {
  cnpjCard: "cnpjCardUrl",
  docFront: "docFrontUrl",
  docBack: "docBackUrl",
  selfieFar: "selfieFarUrl",
  selfieMedium: "selfieMediumUrl",
  selfieClose: "selfieCloseUrl",
};

export default function VerifyPage() {
  const params = useParams();
  const router = useRouter();
  const token = params.token as string;

  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<SessionData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [currentStep, setCurrentStep] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [resubmitting, setResubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load session
  useEffect(() => {
    if (!token) return;
    fetch(`/api/public/saas/verification/${token}`)
      .then((r) => {
        if (!r.ok) throw new Error("Sessao invalida ou expirada");
        return r.json();
      })
      .then((data: SessionData) => {
        setSession(data);
        // Find the first step that hasn't been uploaded
        const firstEmpty = STEPS.findIndex(
          (s) => !data[URL_MAP[s.key] as keyof SessionData]
        );
        setCurrentStep(firstEmpty === -1 ? STEPS.length : firstEmpty);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [token]);

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setSelectedFile(file);
    setPreview(URL.createObjectURL(file));
  }

  function clearSelection() {
    setSelectedFile(null);
    setPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function handleUpload() {
    if (!selectedFile || !session) return;
    const step = STEPS[currentStep];
    setUploading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append("file", selectedFile);
      formData.append("type", step.key);

      const r = await fetch(`/api/public/saas/verification/${token}/upload`, {
        method: "POST",
        body: formData,
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.message || "Erro ao enviar");

      // Update session state
      setSession((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          [URL_MAP[step.key]]: data.url,
          uploadedCount: data.uploadedCount,
          uploadComplete: data.uploadComplete,
        };
      });

      // Move to next step
      clearSelection();
      if (currentStep < STEPS.length - 1) {
        setCurrentStep(currentStep + 1);
      } else {
        setCurrentStep(STEPS.length); // Complete
      }
    } catch (err: any) {
      setError(err.message || "Erro ao enviar arquivo");
    } finally {
      setUploading(false);
    }
  }

  async function handleResubmit() {
    setResubmitting(true);
    setError(null);
    try {
      const r = await fetch(`/api/public/saas/verification/${token}/resubmit`, {
        method: "POST",
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.message || "Erro ao criar nova sessao");

      // Navigate to the new session
      router.replace(`/verify/${data.token}`);
      // Force a full reload to load new session
      window.location.href = `/verify/${data.token}`;
    } catch (err: any) {
      setError(err.message || "Erro ao reenviar documentos");
    } finally {
      setResubmitting(false);
    }
  }

  // ── Render states ──

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-3 border-blue-500 border-t-transparent" />
      </div>
    );
  }

  if (error && !session) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="max-w-sm w-full bg-white rounded-2xl shadow-lg p-8 text-center">
          <div className="w-16 h-16 mx-auto rounded-full bg-red-100 flex items-center justify-center mb-4">
            <svg className="w-8 h-8 text-red-500" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" />
            </svg>
          </div>
          <h1 className="text-lg font-bold text-slate-900 mb-2">Link invalido</h1>
          <p className="text-sm text-slate-500">{error}</p>
        </div>
      </div>
    );
  }

  if (session?.expired) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="max-w-sm w-full bg-white rounded-2xl shadow-lg p-8 text-center">
          <div className="w-16 h-16 mx-auto rounded-full bg-amber-100 flex items-center justify-center mb-4">
            <svg className="w-8 h-8 text-amber-500" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
            </svg>
          </div>
          <h1 className="text-lg font-bold text-slate-900 mb-2">Sessao expirada</h1>
          <p className="text-sm text-slate-500">O prazo para envio dos documentos expirou. Inicie o cadastro novamente.</p>
        </div>
      </div>
    );
  }

  if (!session) return null;

  // ── REJECTED SESSION — show rejection reason + resubmit button ──
  if (session.reviewStatus === "REJECTED") {
    return (
      <div className="min-h-screen bg-slate-50">
        {/* Header */}
        <header className="bg-white border-b border-slate-200 px-4 py-3">
          <div className="max-w-md mx-auto flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-blue-600 to-blue-700 flex items-center justify-center">
                <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="m3.75 13.5 10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75Z" />
                </svg>
              </div>
              <span className="text-base font-bold text-slate-900">Tecnikos</span>
            </div>
            <span className="text-xs text-slate-400">{session.tenantName}</span>
          </div>
        </header>

        <div className="max-w-md mx-auto px-4 py-8">
          {/* Rejection icon */}
          <div className="w-20 h-20 mx-auto rounded-full bg-red-100 flex items-center justify-center mb-6">
            <svg className="w-10 h-10 text-red-500" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
            </svg>
          </div>

          <h1 className="text-xl font-bold text-slate-900 text-center mb-2">Documentos recusados</h1>
          <p className="text-sm text-slate-500 text-center mb-6">
            Sua verificacao foi recusada pela equipe de analise. Veja abaixo o motivo e reenvie seus documentos.
          </p>

          {/* Rejection reason card */}
          {session.rejectionReason && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6">
              <div className="flex items-start gap-3">
                <svg className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" />
                </svg>
                <div>
                  <p className="text-sm font-semibold text-red-800 mb-1">Motivo da recusa:</p>
                  <p className="text-sm text-red-700">{session.rejectionReason}</p>
                </div>
              </div>
            </div>
          )}

          {/* What was submitted */}
          <div className="bg-white border border-slate-200 rounded-xl p-4 mb-6">
            <p className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-3">Documentos enviados anteriormente</p>
            <div className="space-y-2">
              {STEPS.map((s) => {
                const uploaded = !!session[URL_MAP[s.key] as keyof SessionData];
                return (
                  <div key={s.key} className="flex items-center gap-2.5 text-sm">
                    <div className={`w-5 h-5 rounded-full flex items-center justify-center ${uploaded ? "bg-slate-200 text-slate-500" : "bg-red-100 text-red-400"}`}>
                      {uploaded ? (
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                        </svg>
                      ) : (
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                        </svg>
                      )}
                    </div>
                    <span className={uploaded ? "text-slate-600" : "text-red-600"}>{s.label}</span>
                    {!uploaded && <span className="text-[10px] text-red-400 ml-auto">Nao enviado</span>}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Tips */}
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6">
            <p className="text-sm font-semibold text-blue-800 mb-2">Dicas para aprovacao:</p>
            <ul className="space-y-1.5 text-xs text-blue-700">
              <li className="flex items-start gap-2">
                <span className="mt-0.5">&#x2022;</span>
                <span>Fotos devem estar nitidas e sem reflexo</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-0.5">&#x2022;</span>
                <span>Documento inteiro deve estar visivel na foto</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-0.5">&#x2022;</span>
                <span>Selfies devem mostrar claramente o rosto</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-0.5">&#x2022;</span>
                <span>O documento deve pertencer ao responsavel pela empresa</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-0.5">&#x2022;</span>
                <span>Cartao CNPJ deve ser o documento atualizado da Receita Federal</span>
              </li>
            </ul>
          </div>

          {/* Error */}
          {error && (
            <div className="rounded-xl bg-red-50 border border-red-200 p-3 mb-4">
              <p className="text-xs text-red-700">{error}</p>
            </div>
          )}

          {/* Resubmit button */}
          <button
            onClick={handleResubmit}
            disabled={resubmitting}
            className="w-full py-3.5 rounded-xl bg-blue-600 text-white text-sm font-bold hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {resubmitting ? (
              <span className="flex items-center justify-center gap-2">
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                Preparando nova sessao...
              </span>
            ) : (
              <span className="flex items-center justify-center gap-2">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182" />
                </svg>
                Reenviar documentos
              </span>
            )}
          </button>

          <p className="text-[10px] text-slate-400 text-center mt-3">
            Uma nova sessao sera criada para voce reenviar todos os documentos.
          </p>
        </div>
      </div>
    );
  }

  // ── ALREADY APPROVED ──
  if (session.reviewStatus === "APPROVED") {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="max-w-sm w-full bg-white rounded-2xl shadow-lg p-8 text-center">
          <div className="w-16 h-16 mx-auto rounded-full bg-green-100 flex items-center justify-center mb-4">
            <svg className="w-8 h-8 text-green-500" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
            </svg>
          </div>
          <h1 className="text-lg font-bold text-slate-900 mb-2">Verificacao aprovada!</h1>
          <p className="text-sm text-slate-500">Sua empresa ja foi validada. Voce pode fechar esta pagina e usar o sistema normalmente.</p>
        </div>
      </div>
    );
  }

  // All uploaded — completion screen
  if (currentStep >= STEPS.length || session.uploadComplete) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="max-w-sm w-full bg-white rounded-2xl shadow-lg p-8 text-center">
          <div className="w-16 h-16 mx-auto rounded-full bg-green-100 flex items-center justify-center mb-4">
            <svg className="w-8 h-8 text-green-500" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
            </svg>
          </div>
          <h1 className="text-lg font-bold text-slate-900 mb-2">Documentos enviados!</h1>
          <p className="text-sm text-slate-500 mb-4">
            Todos os documentos foram enviados com sucesso.
            Voce pode fechar esta pagina.
          </p>
          <p className="text-xs text-slate-400">
            A equipe do Tecnikos ira analisar seus documentos e ativar sua conta em breve.
          </p>
        </div>
      </div>
    );
  }

  const step = STEPS[currentStep];
  const isSelfie = step.icon === "face";

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 px-4 py-3">
        <div className="max-w-md mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-blue-600 to-blue-700 flex items-center justify-center">
              <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="m3.75 13.5 10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75Z" />
              </svg>
            </div>
            <span className="text-base font-bold text-slate-900">Tecnikos</span>
          </div>
          <span className="text-xs text-slate-400">{session.tenantName}</span>
        </div>
      </header>

      <div className="max-w-md mx-auto px-4 py-6">
        {/* Progress bar */}
        <div className="flex items-center gap-1 mb-6">
          {STEPS.map((_, i) => (
            <div key={i} className={`h-1.5 flex-1 rounded-full transition-colors ${
              i < currentStep ? "bg-green-500" : i === currentStep ? "bg-blue-500" : "bg-slate-200"
            }`} />
          ))}
        </div>

        <p className="text-xs text-slate-400 text-center mb-2">
          Passo {currentStep + 1} de {STEPS.length}
        </p>

        <h1 className="text-xl font-bold text-slate-900 text-center mb-1">{step.label}</h1>
        <p className="text-sm text-slate-500 text-center mb-6">{step.description}</p>

        {/* Selfie guide overlay */}
        {isSelfie && !preview && (
          <div className="relative bg-slate-900 rounded-2xl aspect-[3/4] flex items-center justify-center mb-4 overflow-hidden">
            <svg viewBox="0 0 200 260" className="w-48 h-auto opacity-30">
              <ellipse cx="100" cy="110" rx="70" ry="90" fill="none" stroke="white" strokeWidth="2" strokeDasharray="8,4" />
              <line x1="100" y1="20" x2="100" y2="40" stroke="white" strokeWidth="1" opacity="0.5" />
              <line x1="100" y1="200" x2="100" y2="220" stroke="white" strokeWidth="1" opacity="0.5" />
              <line x1="30" y1="110" x2="50" y2="110" stroke="white" strokeWidth="1" opacity="0.5" />
              <line x1="150" y1="110" x2="170" y2="110" stroke="white" strokeWidth="1" opacity="0.5" />
            </svg>
            <div className="absolute bottom-4 left-0 right-0 text-center">
              <p className="text-white text-sm font-medium">
                {step.key === "selfieClose" && "Aproxime o rosto da camera"}
                {step.key === "selfieMedium" && "Mantenha meia distancia"}
                {step.key === "selfieFar" && "Afaste-se, mostre meio corpo"}
              </p>
            </div>
          </div>
        )}

        {/* File input (hidden) */}
        <input
          ref={fileInputRef}
          type="file"
          accept={step.accept}
          capture={step.capture}
          onChange={handleFileSelect}
          className="hidden"
        />

        {/* Preview */}
        {preview ? (
          <div className="mb-4">
            {selectedFile?.type === "application/pdf" ? (
              <div className="bg-slate-100 rounded-2xl p-8 text-center">
                <svg className="w-12 h-12 mx-auto text-red-500 mb-2" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
                </svg>
                <p className="text-sm text-slate-700 font-medium">{selectedFile?.name}</p>
                <p className="text-xs text-slate-400 mt-1">PDF selecionado</p>
              </div>
            ) : (
              <img src={preview} alt="Preview" className="w-full rounded-2xl border border-slate-200 max-h-80 object-contain bg-slate-50" />
            )}

            <div className="flex gap-3 mt-4">
              <button
                onClick={clearSelection}
                className="flex-1 py-3 rounded-xl border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50"
              >
                Tirar outra
              </button>
              <button
                onClick={handleUpload}
                disabled={uploading}
                className="flex-1 py-3 rounded-xl bg-blue-600 text-white text-sm font-bold hover:bg-blue-700 disabled:opacity-50"
              >
                {uploading ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    Enviando...
                  </span>
                ) : "Enviar"}
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => fileInputRef.current?.click()}
            className="w-full rounded-2xl border-2 border-dashed border-slate-300 bg-white p-10 text-center hover:border-blue-400 hover:bg-blue-50/30 transition-all mb-4"
          >
            {isSelfie ? (
              <svg className="w-10 h-10 mx-auto text-blue-400 mb-3" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
              </svg>
            ) : (
              <svg className="w-10 h-10 mx-auto text-blue-400 mb-3" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 0 1 5.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 0 0-1.134-.175 2.31 2.31 0 0 1-1.64-1.055l-.822-1.316a2.192 2.192 0 0 0-1.736-1.039 48.774 48.774 0 0 0-5.232 0 2.192 2.192 0 0 0-1.736 1.039l-.821 1.316Z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 1 1-9 0 4.5 4.5 0 0 1 9 0ZM18.75 10.5h.008v.008h-.008V10.5Z" />
              </svg>
            )}
            <p className="text-sm font-medium text-slate-700">
              {isSelfie ? "Tirar selfie" : "Tirar foto ou selecionar arquivo"}
            </p>
            <p className="text-[10px] text-slate-400 mt-1">{step.description}</p>
          </button>
        )}

        {/* Error message */}
        {error && (
          <div className="rounded-xl bg-red-50 border border-red-200 p-3 mb-4">
            <p className="text-xs text-red-700">{error}</p>
          </div>
        )}

        {/* Already uploaded list */}
        <div className="mt-6 space-y-2">
          <p className="text-xs font-medium text-slate-400 uppercase tracking-wide">Documentos</p>
          {STEPS.map((s, i) => {
            const uploaded = !!session[URL_MAP[s.key] as keyof SessionData];
            const isCurrent = i === currentStep;
            return (
              <div key={s.key} className={`flex items-center gap-3 p-3 rounded-xl ${
                isCurrent ? "bg-blue-50 border border-blue-200" : uploaded ? "bg-green-50 border border-green-200" : "bg-white border border-slate-100"
              }`}>
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs ${
                  uploaded ? "bg-green-500 text-white" : isCurrent ? "bg-blue-500 text-white" : "bg-slate-200 text-slate-400"
                }`}>
                  {uploaded ? (
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                    </svg>
                  ) : (
                    i + 1
                  )}
                </div>
                <span className={`text-sm ${uploaded ? "text-green-700" : isCurrent ? "text-blue-700 font-medium" : "text-slate-400"}`}>
                  {s.label}
                </span>
                {uploaded && !isCurrent && (
                  <button
                    onClick={() => { setCurrentStep(i); clearSelection(); }}
                    className="ml-auto text-[10px] text-slate-400 hover:text-blue-500"
                  >
                    Reenviar
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
