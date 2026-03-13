"use client";

import { useEffect, useState, useRef, useCallback } from "react";
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
  selfieCloseUrl: string | null;
  selfieMediumUrl: string | null;
}

const STEPS = [
  { key: "cnpjCard", label: "Cartao CNPJ", description: "PDF ou foto do Cartao CNPJ", accept: "image/*,application/pdf", capture: "environment" as const, icon: "doc" },
  { key: "docFront", label: "Documento (Frente)", description: "Frente do RG ou CNH aberta", accept: "image/*", capture: "environment" as const, icon: "id" },
  { key: "docBack", label: "Documento (Verso)", description: "Verso do RG ou CNH", accept: "image/*", capture: "environment" as const, icon: "id" },
  { key: "selfieClose", label: "Selfie 1", description: "Posicione o rosto dentro do retangulo", accept: "image/*", capture: "user" as const, icon: "face" },
  { key: "selfieMedium", label: "Selfie 2", description: "Afaste um pouco e enquadre novamente", accept: "image/*", capture: "user" as const, icon: "face" },
];

const URL_MAP: Record<string, keyof SessionData> = {
  cnpjCard: "cnpjCardUrl",
  docFront: "docFrontUrl",
  docBack: "docBackUrl",
  selfieClose: "selfieCloseUrl",
  selfieMedium: "selfieMediumUrl",
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

  // Camera state for selfie
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

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
        const firstEmpty = STEPS.findIndex(
          (s) => !data[URL_MAP[s.key] as keyof SessionData]
        );
        setCurrentStep(firstEmpty === -1 ? STEPS.length : firstEmpty);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [token]);

  // Stop camera stream on cleanup or step change
  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setCameraActive(false);
    setCameraError(null);
  }, []);

  // Auto-start camera when entering selfie step
  const step = currentStep < STEPS.length ? STEPS[currentStep] : null;
  const isSelfie = step?.icon === "face";

  useEffect(() => {
    if (!isSelfie || preview) {
      stopCamera();
      return;
    }

    // Check if getUserMedia is available
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError("use_native");
      setCameraActive(false);
      return;
    }

    // Start front camera with timeout
    let cancelled = false;
    let timeoutId: ReturnType<typeof setTimeout>;

    async function startCamera() {
      try {
        setCameraError(null);

        // Timeout: if camera doesn't start in 6 seconds, fallback to native
        timeoutId = setTimeout(() => {
          if (!cancelled) {
            setCameraError("use_native");
            setCameraActive(false);
            stopCamera();
          }
        }, 6000);

        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "user", width: { ideal: 720 }, height: { ideal: 960 } },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
          // Verify video is actually producing frames
          await new Promise((resolve) => setTimeout(resolve, 500));
          if (!cancelled && videoRef.current && videoRef.current.videoWidth === 0) {
            throw new Error("Camera not producing frames");
          }
        }
        if (!cancelled) {
          clearTimeout(timeoutId);
          setCameraActive(true);
        }
      } catch (err: any) {
        if (!cancelled) {
          clearTimeout(timeoutId);
          setCameraError("use_native");
          setCameraActive(false);
        }
      }
    }

    startCamera();
    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
      stopCamera();
    };
  }, [isSelfie, preview, currentStep, stopCamera]);

  // Capture photo from camera
  function capturePhoto() {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    // Mirror horizontally for selfie
    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(video, 0, 0);
    ctx.setTransform(1, 0, 0, 1, 0, 0);

    canvas.toBlob((blob) => {
      if (!blob) return;
      const file = new File([blob], `selfie_${Date.now()}.jpg`, { type: "image/jpeg" });
      setSelectedFile(file);
      setPreview(URL.createObjectURL(file));
      stopCamera();
    }, "image/jpeg", 0.92);
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setSelectedFile(file);
    setPreview(URL.createObjectURL(file));
    stopCamera();
  }

  function clearSelection() {
    setSelectedFile(null);
    setPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function handleUpload() {
    if (!selectedFile || !session || !step) return;
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

      setSession((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          [URL_MAP[step.key]]: data.url,
          uploadedCount: data.uploadedCount,
          uploadComplete: data.uploadComplete,
        };
      });

      clearSelection();
      if (currentStep < STEPS.length - 1) {
        setCurrentStep(currentStep + 1);
      } else {
        setCurrentStep(STEPS.length);
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
      router.replace(`/verify/${data.token}`);
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

  // ── REJECTED SESSION ──
  if (session.reviewStatus === "REJECTED") {
    return (
      <div className="min-h-screen bg-slate-50">
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
          <div className="w-20 h-20 mx-auto rounded-full bg-red-100 flex items-center justify-center mb-6">
            <svg className="w-10 h-10 text-red-500" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
            </svg>
          </div>
          <h1 className="text-xl font-bold text-slate-900 text-center mb-2">Documentos recusados</h1>
          <p className="text-sm text-slate-500 text-center mb-6">
            Sua verificacao foi recusada. Veja o motivo e reenvie seus documentos.
          </p>

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

          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6">
            <p className="text-sm font-semibold text-blue-800 mb-2">Dicas para aprovacao:</p>
            <ul className="space-y-1.5 text-xs text-blue-700">
              <li className="flex items-start gap-2"><span className="mt-0.5">&#x2022;</span><span>Fotos devem estar nitidas e sem reflexo</span></li>
              <li className="flex items-start gap-2"><span className="mt-0.5">&#x2022;</span><span>Documento inteiro deve estar visivel na foto</span></li>
              <li className="flex items-start gap-2"><span className="mt-0.5">&#x2022;</span><span>Selfies devem mostrar claramente o rosto</span></li>
              <li className="flex items-start gap-2"><span className="mt-0.5">&#x2022;</span><span>Cartao CNPJ deve ser o documento atualizado da Receita Federal</span></li>
            </ul>
          </div>

          {error && (
            <div className="rounded-xl bg-red-50 border border-red-200 p-3 mb-4">
              <p className="text-xs text-red-700">{error}</p>
            </div>
          )}

          <button onClick={handleResubmit} disabled={resubmitting}
            className="w-full py-3.5 rounded-xl bg-blue-600 text-white text-sm font-bold hover:bg-blue-700 disabled:opacity-50 transition-colors">
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
          <p className="text-[10px] text-slate-400 text-center mt-3">Uma nova sessao sera criada para voce reenviar todos os documentos.</p>
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
          <p className="text-sm text-slate-500">Sua empresa ja foi validada. Voce pode fechar esta pagina.</p>
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
          <p className="text-sm text-slate-500 mb-4">Todos os documentos foram enviados com sucesso. Voce pode fechar esta pagina.</p>
          <p className="text-xs text-slate-400">A equipe do Tecnikos ira analisar seus documentos e ativar sua conta em breve.</p>
        </div>
      </div>
    );
  }

  if (!step) return null;

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Hidden canvas for photo capture */}
      <canvas ref={canvasRef} className="hidden" />

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

        {/* ── SELFIE: Live camera with face guide ── */}
        {isSelfie && !preview && (
          <div className="mb-4">
            {cameraActive ? (
              <div className="relative rounded-2xl overflow-hidden bg-black">
                {/* Live camera feed (mirrored) */}
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full aspect-[3/4] object-cover"
                  style={{ transform: "scaleX(-1)" }}
                />
                {/* Face guide rectangle overlay */}
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="w-[65%] h-[55%] border-2 border-white/70 rounded-3xl relative">
                    {/* Corner accents */}
                    <div className="absolute -top-0.5 -left-0.5 w-6 h-6 border-t-3 border-l-3 border-blue-400 rounded-tl-xl" />
                    <div className="absolute -top-0.5 -right-0.5 w-6 h-6 border-t-3 border-r-3 border-blue-400 rounded-tr-xl" />
                    <div className="absolute -bottom-0.5 -left-0.5 w-6 h-6 border-b-3 border-l-3 border-blue-400 rounded-bl-xl" />
                    <div className="absolute -bottom-0.5 -right-0.5 w-6 h-6 border-b-3 border-r-3 border-blue-400 rounded-br-xl" />
                  </div>
                </div>
                {/* Instruction text */}
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent px-4 pb-4 pt-8">
                  <p className="text-white text-sm font-medium text-center">
                    Posicione o rosto dentro do retangulo
                  </p>
                </div>
              </div>
            ) : cameraError ? (
              /* Camera failed — show native camera button */
              <div className="rounded-2xl bg-slate-50 border border-slate-200 p-6 text-center">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-blue-100 flex items-center justify-center">
                  <svg className="w-8 h-8 text-blue-600" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 0 1 5.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 0 0-1.134-.175 2.31 2.31 0 0 1-1.64-1.055l-.822-1.316a2.192 2.192 0 0 0-1.736-1.039 48.774 48.774 0 0 0-5.232 0 2.192 2.192 0 0 0-1.736 1.039l-.821 1.316Z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 1 1-9 0 4.5 4.5 0 0 1 9 0Z" />
                  </svg>
                </div>
                <p className="text-sm font-semibold text-slate-800 mb-1">Tire uma selfie</p>
                <p className="text-xs text-slate-500 mb-4">Posicione o rosto centralizado e com boa iluminacao</p>
                <label className="inline-flex items-center gap-2 px-6 py-3.5 rounded-xl bg-blue-600 text-white text-sm font-bold hover:bg-blue-700 cursor-pointer transition-colors">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 0 1 5.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 0 0-1.134-.175 2.31 2.31 0 0 1-1.64-1.055l-.822-1.316a2.192 2.192 0 0 0-1.736-1.039 48.774 48.774 0 0 0-5.232 0 2.192 2.192 0 0 0-1.736 1.039l-.821 1.316Z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 1 1-9 0 4.5 4.5 0 0 1 9 0Z" />
                  </svg>
                  Abrir camera
                  <input
                    type="file"
                    accept="image/*"
                    capture="user"
                    onChange={handleFileSelect}
                    className="hidden"
                  />
                </label>
              </div>
            ) : (
              /* Loading camera */
              <div className="relative bg-slate-900 rounded-2xl aspect-[3/4] flex items-center justify-center overflow-hidden">
                <div className="flex flex-col items-center gap-3">
                  <div className="h-8 w-8 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  <p className="text-white/70 text-sm">Abrindo camera...</p>
                </div>
              </div>
            )}

            {/* Hidden file input for native camera fallback */}
            <input
              ref={fileInputRef}
              type="file"
              accept={step.accept}
              capture={step.capture}
              onChange={handleFileSelect}
              className="hidden"
            />

            {/* Capture button (only when live camera is active) */}
            {cameraActive && (
              <div className="mt-4">
                <button
                  onClick={capturePhoto}
                  className="w-full py-3.5 rounded-xl bg-blue-600 text-white text-sm font-bold hover:bg-blue-700 flex items-center justify-center gap-2"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 0 1 5.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 0 0-1.134-.175 2.31 2.31 0 0 1-1.64-1.055l-.822-1.316a2.192 2.192 0 0 0-1.736-1.039 48.774 48.774 0 0 0-5.232 0 2.192 2.192 0 0 0-1.736 1.039l-.821 1.316Z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 1 1-9 0 4.5 4.5 0 0 1 9 0Z" />
                  </svg>
                  Tirar foto
                </button>
              </div>
            )}
          </div>
        )}

        {/* ── NON-SELFIE: Standard file upload ── */}
        {!isSelfie && !preview && (
          <>
            <input
              ref={fileInputRef}
              type="file"
              accept={step.accept}
              capture={step.capture}
              onChange={handleFileSelect}
              className="hidden"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="w-full rounded-2xl border-2 border-dashed border-slate-300 bg-white p-10 text-center hover:border-blue-400 hover:bg-blue-50/30 transition-all mb-4"
            >
              <svg className="w-10 h-10 mx-auto text-blue-400 mb-3" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 0 1 5.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 0 0-1.134-.175 2.31 2.31 0 0 1-1.64-1.055l-.822-1.316a2.192 2.192 0 0 0-1.736-1.039 48.774 48.774 0 0 0-5.232 0 2.192 2.192 0 0 0-1.736 1.039l-.821 1.316Z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 1 1-9 0 4.5 4.5 0 0 1 9 0ZM18.75 10.5h.008v.008h-.008V10.5Z" />
              </svg>
              <p className="text-sm font-medium text-slate-700">Tirar foto ou selecionar arquivo</p>
              <p className="text-[10px] text-slate-400 mt-1">{step.description}</p>
            </button>
          </>
        )}

        {/* Preview */}
        {preview && (
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
              <button onClick={clearSelection}
                className="flex-1 py-3 rounded-xl border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50">
                {isSelfie ? "Tirar outra" : "Escolher outra"}
              </button>
              <button onClick={handleUpload} disabled={uploading}
                className="flex-1 py-3 rounded-xl bg-blue-600 text-white text-sm font-bold hover:bg-blue-700 disabled:opacity-50">
                {uploading ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    Enviando...
                  </span>
                ) : "Enviar"}
              </button>
            </div>
          </div>
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
                    onClick={() => { setCurrentStep(i); clearSelection(); stopCamera(); }}
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
