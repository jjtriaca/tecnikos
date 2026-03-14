"use client";

import { useEffect, useState, useRef, useCallback, use } from "react";
import { api, ApiError } from "@/lib/api";

/* ── Types ─────────────────────────────────────────────────── */

type ArrivalOption = { label: string; minutes: number };

type ArrivalQuestionConfig = {
  blockId: string;
  question: string;
  options: ArrivalOption[];
  onDecline: string;
  useAsDynamicTimeout: boolean;
  enRouteTimeoutMinutes: number | null;
};

type TrackingConfig = {
  radiusMeters: number;
  trackingIntervalSeconds: number;
  requireHighAccuracy: boolean;
  keepActiveUntil: string; // 'radius' | 'execution_end'
  targetLat: number | null;
  targetLng: number | null;
};

type LinkConfig = {
  acceptOS: boolean;
  gpsNavigation: boolean;
  enRoute: boolean;
  validityHours: number;
  agendaMarginHours: number;
};

type PublicViewData = {
  offer: { token: string; expiresAt: string; channel: string; accepted?: boolean };
  company: { id: string; name: string };
  serviceOrder: {
    id: string;
    title: string;
    description: string | null;
    addressText: string;
    lat: number | null;
    lng: number | null;
    valueCents: number;
    deadlineAt: string;
    status: string;
  };
  distance: { meters: number; km: number } | null;
  otp: { requestOtpUrl: string; acceptUrl: string };
  linkConfig?: LinkConfig;
  enRouteAt?: string | null;
  trackingStartedAt?: string | null;
};

type AcceptResult = {
  serviceOrder: any;
  offer: any;
  arrivalQuestion: ArrivalQuestionConfig | null;
  accessKey?: string;
};

type PauseReasonCat = { value: string; label: string; icon: string };

type PauseConfig = {
  enabled: boolean;
  maxPauses: number;
  maxPauseDurationMinutes: number;
  requireReason: boolean;
  allowedReasons: string[];
  notifications?: {
    onPause?: { gestor?: { enabled: boolean }; cliente?: { enabled: boolean }; tecnico?: { enabled: boolean } };
    onResume?: { gestor?: { enabled: boolean }; cliente?: { enabled: boolean }; tecnico?: { enabled: boolean } };
  };
  // Backward compat fields (old format)
  notifyGestorOnPause?: boolean;
  notifyGestorOnResume?: boolean;
  requirePhotosOnPause?: boolean;
  requirePhotosOnResume?: boolean;
  minPhotosOnPause?: number;
  minPhotosOnResume?: number;
};

type PhotoReq = { minPhotos: number; required: boolean } | null;

type PauseStatus = {
  isPaused: boolean;
  pausedAt: string | null;
  pauseCount: number;
  totalPausedMs: number;
  pauseConfig: PauseConfig | null;
  photoRequirements?: { onPause: PhotoReq; onResume: PhotoReq };
  pauses: Array<{ id: string; reasonCategory: string; reason: string | null; pausedAt: string; resumedAt: string | null; durationMs: number | null }>;
};

const PAUSE_REASONS: PauseReasonCat[] = [
  { value: 'meal_break', label: 'Intervalo para refeição', icon: '🍽️' },
  { value: 'end_of_day', label: 'Encerramento do expediente', icon: '🌙' },
  { value: 'fetch_materials', label: 'Buscar material/peças', icon: '🔧' },
  { value: 'weather', label: 'Condições climáticas', icon: '🌧️' },
  { value: 'waiting_client', label: 'Aguardando cliente', icon: '⏳' },
  { value: 'waiting_utilities', label: 'Aguardando energia/utilidades', icon: '🔌' },
  { value: 'waiting_access', label: 'Aguardando liberação de acesso', icon: '🚧' },
  { value: 'waiting_other_service', label: 'Aguardando outro serviço', icon: '🛠️' },
  { value: 'personal', label: 'Motivo pessoal', icon: '🏥' },
  { value: 'other', label: 'Outro', icon: '📝' },
];

type PageStep = "loading" | "offer" | "otp" | "accepting" | "arrival" | "post-accept" | "tracking" | "arrived" | "done" | "declined" | "error" | "executing" | "pausing" | "paused" | "resuming";

/* ── Page ──────────────────────────────────────────────────── */

export default function PublicTokenPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);

  const [step, setStep] = useState<PageStep>("loading");
  const [data, setData] = useState<PublicViewData | null>(null);
  const [phone, setPhone] = useState("");
  const maskPhone = (v: string) => {
    const d = v.replace(/\D/g, "").slice(0, 11);
    if (d.length <= 2) return d.length ? `(${d}` : "";
    if (d.length <= 7) return `(${d.slice(0,2)}) ${d.slice(2)}`;
    return `(${d.slice(0,2)}) ${d.slice(2,7)}-${d.slice(7)}`;
  };
  const [otpCode, setOtpCode] = useState("");
  const [otpLoading, setOtpLoading] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [acceptLoading, setAcceptLoading] = useState(false);
  const [arrivalConfig, setArrivalConfig] = useState<ArrivalQuestionConfig | null>(null);
  const [selectedMinutes, setSelectedMinutes] = useState<number | null>(null);
  const [arrivalLoading, setArrivalLoading] = useState(false);
  const [arrivalError, setArrivalError] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState("");

  // En-route state
  const [enRouteLoading, setEnRouteLoading] = useState(false);
  const [enRouteAt, setEnRouteAt] = useState<string | null>(null);

  // Tracking state
  const [trackingConfig, setTrackingConfig] = useState<TrackingConfig | null>(null);
  const [trackingEnabled, setTrackingEnabled] = useState(false);
  const [trackingActive, setTrackingActive] = useState(false);
  const [trackingDistance, setTrackingDistance] = useState<number | null>(null);
  const [trackingLastUpdate, setTrackingLastUpdate] = useState<Date | null>(null);
  const [trackingError, setTrackingError] = useState<string | null>(null);
  const watchIdRef = useRef<number | null>(null);
  const lastSentRef = useRef<number>(0);
  const phoneDigitsRef = useRef<string>("");

  // Pause state
  const [pauseStatus, setPauseStatus] = useState<PauseStatus | null>(null);
  const [pauseReason, setPauseReason] = useState<string>("");
  const [pauseReasonText, setPauseReasonText] = useState<string>("");
  const [pauseLoading, setPauseLoading] = useState(false);
  const [pauseError, setPauseError] = useState<string | null>(null);

  // Cleanup GPS watch on unmount
  useEffect(() => {
    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
    };
  }, []);

  // Send position to backend (throttled)
  const sendPosition = useCallback(async (lat: number, lng: number, accuracy?: number, speed?: number, heading?: number) => {
    const now = Date.now();
    const interval = (trackingConfig?.trackingIntervalSeconds || 30) * 1000;
    if (now - lastSentRef.current < interval) return;
    lastSentRef.current = now;

    try {
      const res = await api.post<{
        distanceMeters: number | null;
        distanceKm: number | null;
        proximityReached: boolean;
        radiusMeters: number;
      }>(`/p/${token}/position`, {
        lat, lng, accuracy, speed, heading,
      });

      if (res.distanceMeters !== null) {
        setTrackingDistance(res.distanceMeters);
      }
      setTrackingLastUpdate(new Date());
      setTrackingError(null);

      if (res.proximityReached) {
        // Stop tracking if configured to stop at radius
        if (trackingConfig?.keepActiveUntil === 'radius') {
          stopTracking();
        }
        setStep("arrived");
      }
    } catch (e: any) {
      console.warn("[GPS] Error sending position:", e?.message);
    }
  }, [token, trackingConfig]);

  // Start GPS tracking
  const startTracking = async () => {
    if (!navigator.geolocation) {
      setTrackingError("GPS não disponível neste dispositivo");
      return;
    }

    try {
      // Try to start tracking on backend — use defaults if not configured
      let config: TrackingConfig = {
        radiusMeters: 200,
        trackingIntervalSeconds: 30,
        requireHighAccuracy: true,
        keepActiveUntil: "radius",
        targetLat: data?.serviceOrder?.lat ?? null,
        targetLng: data?.serviceOrder?.lng ?? null,
      };

      try {
        const res = await api.post<{ success: boolean; config: TrackingConfig }>(`/p/${token}/start-tracking`, {});
        if (res.config) config = res.config;
      } catch {
        // Backend may not have PROXIMITY_TRIGGER — use defaults, still track locally
      }

      setTrackingConfig(config);
      setTrackingActive(true);
      setStep("tracking");

      // Start watching position
      watchIdRef.current = navigator.geolocation.watchPosition(
        (pos) => {
          sendPosition(
            pos.coords.latitude,
            pos.coords.longitude,
            pos.coords.accuracy ?? undefined,
            pos.coords.speed ?? undefined,
            pos.coords.heading ?? undefined,
          );
        },
        (err) => {
          if (err.code === 1) {
            setTrackingError("Permissão de localização negada. Ative o GPS nas configurações.");
          } else if (err.code === 2) {
            setTrackingError("Posição indisponível. Verifique se o GPS está ativo.");
          } else {
            setTrackingError("Erro ao obter localização. Tente novamente.");
          }
        },
        {
          enableHighAccuracy: config.requireHighAccuracy,
          maximumAge: 10000,
          timeout: 20000,
        }
      );
    } catch (e: any) {
      setTrackingError(e?.message || "Erro ao iniciar rastreamento");
    }
  };

  // Stop GPS tracking
  const stopTracking = () => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    setTrackingActive(false);
  };

  // Load offer data
  useEffect(() => {
    (async () => {
      try {
        // Include accessKey from localStorage if available (for post-acceptance access)
        const storedKey = localStorage.getItem(`tk_ak_${token}`);
        const akParam = storedKey ? `?ak=${storedKey}` : "";
        const res = await api.get<PublicViewData>(`/p/${token}${akParam}`);
        setData(res);
        // Restore enRouteAt from backend if previously set
        if (res.enRouteAt) {
          setEnRouteAt(res.enRouteAt);
        }
        if (res.offer.accepted) {
          // If GPS or enRoute available (and not all done), go to post-accept
          const lc = res.linkConfig;
          const hasEnRoute = lc?.enRoute && !res.enRouteAt;
          const hasGps = lc?.gpsNavigation && !res.trackingStartedAt;
          if (hasEnRoute || hasGps) {
            setStep("post-accept");
          } else {
            setStep("done");
          }
        } else {
          setStep("offer");
        }
      } catch (e: any) {
        setErrorMsg(e?.message || "Link inválido ou expirado.");
        setStep("error");
      }
    })();
  }, [token]);

  // Pre-load tracking config when entering "post-accept" state (for GPS button)
  useEffect(() => {
    if (step !== "post-accept" || !data?.linkConfig?.gpsNavigation) return;
    (async () => {
      try {
        const trackRes = await api.get<{ enabled: boolean; config: any }>(`/p/${token}/tracking-config`);
        if (trackRes.config) setTrackingConfig(trackRes.config);
      } catch {
        // Tracking config not available — GPS button already controlled by linkConfig
      }
    })();
  }, [step, token, data]);

  // Save access key and lock device
  const saveAccessKey = (key: string) => {
    localStorage.setItem(`tk_ak_${token}`, key);
  };

  // Accept directly (no OTP)
  const handleAccept = async () => {
    setAcceptLoading(true);
    setErrorMsg("");
    try {
      const res = await api.post<AcceptResult>(`/p/${token}/accept`, {});
      // Save accessKey — locks this link to this device
      if (res.accessKey) {
        saveAccessKey(res.accessKey);
      }
      if (res.arrivalQuestion) {
        setArrivalConfig(res.arrivalQuestion);
        setStep("arrival");
      } else {
        // If GPS or enRoute enabled, go to post-accept page
        const lc = data?.linkConfig;
        if (lc?.gpsNavigation || lc?.enRoute) {
          setStep("post-accept");
        } else {
          setStep("done");
        }
      }
    } catch (e: any) {
      setErrorMsg(e?.message || "Erro ao aceitar.");
      setAcceptLoading(false);
    }
  };

  // Mark en route
  const handleEnRoute = async () => {
    setEnRouteLoading(true);
    setErrorMsg("");
    try {
      const res = await api.post<{ success: boolean; accessKey?: string; enRouteAt: string }>(`/p/${token}/en-route`, {});
      if (res.accessKey) {
        saveAccessKey(res.accessKey);
      }
      setEnRouteAt(res.enRouteAt);
    } catch (e: any) {
      setErrorMsg(e?.message || "Erro ao registrar saída.");
    } finally {
      setEnRouteLoading(false);
    }
  };

  // Submit arrival time
  const handleSubmitArrival = async () => {
    if (selectedMinutes === null) return;
    setArrivalLoading(true);
    setArrivalError(null);
    try {
      await api.post(`/p/${token}/arrival-time`, { selectedMinutes });
      // After arrival time, go to post-accept if GPS/enRoute available
      const lc = data?.linkConfig;
      if (lc?.gpsNavigation || lc?.enRoute) {
        setStep("post-accept");
      } else {
        setStep("done");
      }
    } catch (e: any) {
      setArrivalError(e?.message || "Erro ao salvar tempo.");
      setArrivalLoading(false);
    }
  };

  // Decline
  const handleDecline = async () => {
    setArrivalLoading(true);
    try {
      await api.post(`/p/${token}/decline`, {});
      setStep("declined");
    } catch (e: any) {
      setArrivalError(e?.message || "Erro ao recusar.");
      setArrivalLoading(false);
    }
  };

  // Load pause status
  const fetchPauseStatus = useCallback(async () => {
    try {
      const res = await api.get<PauseStatus>(`/p/${token}/pause-status`);
      setPauseStatus(res);
      return res;
    } catch {
      return null;
    }
  }, [token]);

  // Handle pause
  const handlePause = async () => {
    if (!pauseReason) return;
    if (pauseReason === 'other' && !pauseReasonText.trim()) {
      setPauseError("Descreva o motivo da pausa");
      return;
    }
    setPauseLoading(true);
    setPauseError(null);
    try {
      await api.post(`/p/${token}/pause`, {
        reasonCategory: pauseReason,
        reason: pauseReason === 'other' ? pauseReasonText : undefined,
        photos: [], // TODO: photo upload integration
      });
      await fetchPauseStatus();
      setStep("paused");
    } catch (e: any) {
      setPauseError(e?.message || "Erro ao pausar");
    } finally {
      setPauseLoading(false);
    }
  };

  // Handle resume
  const handleResume = async () => {
    setPauseLoading(true);
    setPauseError(null);
    try {
      await api.post(`/p/${token}/resume`, {
        photos: [], // TODO: photo upload integration
      });
      await fetchPauseStatus();
      setStep("executing");
    } catch (e: any) {
      setPauseError(e?.message || "Erro ao retomar");
    } finally {
      setPauseLoading(false);
    }
  };

  // Check if OS is in execution on page load (for returning technicians)
  useEffect(() => {
    if (data && data.serviceOrder.status === 'EM_EXECUCAO') {
      fetchPauseStatus().then(ps => {
        if (ps?.isPaused) {
          setStep("paused");
        } else if (ps?.pauseConfig?.enabled) {
          setStep("executing");
        }
      });
    }
  }, [data, fetchPauseStatus]);

  // ── LOADING ──
  if (step === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-r-transparent" />
          <p className="mt-3 text-sm text-slate-500">Carregando oferta...</p>
        </div>
      </div>
    );
  }

  // ── ERROR ──
  if (step === "error") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
        <div className="w-full max-w-sm text-center">
          <div className="text-4xl mb-3">😕</div>
          <h1 className="text-lg font-bold text-slate-800">Oferta não disponível</h1>
          <p className="text-sm text-slate-500 mt-2">{errorMsg || "O link pode ter expirado ou já foi aceito por outro técnico."}</p>
        </div>
      </div>
    );
  }

  // ── TRACKING (GPS Active) ──
  if (step === "tracking" && trackingActive) {
    const radius = trackingConfig?.radiusMeters || 200;
    const progressPct = trackingDistance !== null
      ? Math.max(0, Math.min(100, 100 - ((trackingDistance - radius) / (radius * 10)) * 100))
      : 0;

    return (
      <div className="flex min-h-screen items-center justify-center bg-purple-50 p-6">
        <div className="w-full max-w-sm bg-white rounded-2xl shadow-lg p-6">
          <div className="text-center mb-4">
            <div className="text-4xl mb-2">📡</div>
            <h2 className="text-lg font-bold text-purple-800">GPS Ativo</h2>
            <p className="text-sm text-slate-500 mt-1">Rastreando sua localização...</p>
          </div>

          {/* Distance display */}
          <div className="bg-purple-50 rounded-xl p-4 mb-4">
            <div className="text-center">
              <span className="text-3xl font-bold text-purple-700">
                {trackingDistance !== null
                  ? trackingDistance >= 1000
                    ? `${(trackingDistance / 1000).toFixed(1)} km`
                    : `${trackingDistance} m`
                  : "—"}
              </span>
              <p className="text-xs text-purple-500 mt-1">distância até o local</p>
            </div>

            {/* Progress bar */}
            <div className="mt-3 bg-purple-200 rounded-full h-2 overflow-hidden">
              <div
                className="bg-purple-600 h-full rounded-full transition-all duration-1000"
                style={{ width: `${progressPct}%` }}
              />
            </div>
            <p className="text-[10px] text-purple-400 mt-1 text-center">
              Raio de proximidade: {radius >= 1000 ? `${(radius / 1000).toFixed(1)} km` : `${radius}m`}
            </p>
          </div>

          {/* Last update */}
          {trackingLastUpdate && (
            <p className="text-xs text-slate-400 text-center mb-3">
              Última atualização: {trackingLastUpdate.toLocaleTimeString("pt-BR")}
            </p>
          )}

          {/* Error */}
          {trackingError && (
            <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200">
              <p className="text-sm text-red-700">{trackingError}</p>
            </div>
          )}

          {/* Manual arrival button */}
          <button
            type="button"
            onClick={() => { stopTracking(); setStep("arrived"); }}
            className="w-full py-3 rounded-xl bg-green-600 text-white font-semibold hover:bg-green-700 transition-colors"
          >
            📍 Cheguei no local
          </button>

          {/* Stop tracking button */}
          <button
            type="button"
            onClick={() => { stopTracking(); setStep("done"); }}
            className="w-full mt-3 py-2.5 rounded-xl border-2 border-slate-200 text-slate-600 font-medium text-sm hover:bg-slate-50 transition-colors"
          >
            Parar rastreamento
          </button>

          <p className="text-[10px] text-slate-400 text-center mt-4">
            ⚡ Mantenha esta página aberta para o rastreamento funcionar.
          </p>
        </div>
      </div>
    );
  }

  // ── EXECUTING (In execution with pause available) ──
  if (step === "executing") {
    const pc = pauseStatus?.pauseConfig;
    const canPause = !pc?.maxPauses || (pauseStatus?.pauseCount || 0) < pc.maxPauses;
    return (
      <div className="flex min-h-screen items-center justify-center bg-blue-50 p-6">
        <div className="w-full max-w-sm bg-white rounded-2xl shadow-lg p-6">
          <div className="text-center mb-4">
            <div className="text-4xl mb-2">🔧</div>
            <h2 className="text-lg font-bold text-blue-800">Em Execução</h2>
            <p className="text-sm text-slate-500 mt-1">
              {data?.serviceOrder.title}
            </p>
          </div>

          {/* Pause history */}
          {(pauseStatus?.pauseCount || 0) > 0 && (
            <div className="mb-4 bg-slate-50 rounded-xl p-3">
              <p className="text-xs text-slate-500">
                Pausas realizadas: <span className="font-bold">{pauseStatus?.pauseCount}</span>
                {pc?.maxPauses ? ` / ${pc.maxPauses}` : ''}
              </p>
              {(pauseStatus?.totalPausedMs || 0) > 0 && (
                <p className="text-xs text-slate-400 mt-0.5">
                  Tempo total pausado: {Math.round((pauseStatus?.totalPausedMs || 0) / 60000)} min
                </p>
              )}
            </div>
          )}

          {canPause ? (
            <button
              type="button"
              onClick={() => { setPauseReason(""); setPauseReasonText(""); setPauseError(null); setStep("pausing"); }}
              className="w-full py-3 rounded-xl bg-orange-500 text-white font-semibold hover:bg-orange-600 transition-colors"
            >
              ⏸️ Pausar Atendimento
            </button>
          ) : (
            <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-center">
              <p className="text-sm text-amber-700">Limite de pausas atingido</p>
            </div>
          )}

          <p className="text-[10px] text-slate-400 text-center mt-4">
            O cronômetro de execução está em andamento.
          </p>
        </div>
      </div>
    );
  }

  // ── PAUSING (Select reason) ──
  if (step === "pausing") {
    const pc = pauseStatus?.pauseConfig;
    const allowedReasons = pc?.allowedReasons || PAUSE_REASONS.map(r => r.value);
    const filteredReasons = PAUSE_REASONS.filter(r => allowedReasons.includes(r.value));

    return (
      <div className="flex min-h-screen items-center justify-center bg-orange-50 p-6">
        <div className="w-full max-w-sm bg-white rounded-2xl shadow-lg p-6">
          <div className="text-center mb-4">
            <div className="text-3xl mb-2">⏸️</div>
            <h2 className="text-lg font-bold text-orange-800">Pausar Atendimento</h2>
            {pc?.requireReason && (
              <p className="text-sm text-slate-500 mt-1">Selecione o motivo da pausa:</p>
            )}
          </div>

          {pauseError && (
            <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200">
              <p className="text-sm text-red-700">{pauseError}</p>
            </div>
          )}

          {/* Reason selection */}
          <div className="space-y-2 mb-4 max-h-[40vh] overflow-y-auto">
            {filteredReasons.map(r => (
              <button
                key={r.value}
                type="button"
                onClick={() => { setPauseReason(r.value); setPauseError(null); }}
                className={`w-full p-3 rounded-xl border-2 text-left transition-all flex items-center gap-3 ${
                  pauseReason === r.value
                    ? "border-orange-500 bg-orange-50 text-orange-800"
                    : "border-slate-200 bg-white text-slate-700 hover:border-orange-300"
                }`}
              >
                <span className="text-xl">{r.icon}</span>
                <span className="text-sm font-medium">{r.label}</span>
              </button>
            ))}
          </div>

          {/* Free text for "other" */}
          {pauseReason === 'other' && (
            <div className="mb-4">
              <textarea
                value={pauseReasonText}
                onChange={e => setPauseReasonText(e.target.value)}
                placeholder="Descreva o motivo..."
                rows={2}
                className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm focus:border-orange-500 focus:ring-1 focus:ring-orange-200 outline-none resize-none"
              />
            </div>
          )}

          {/* Confirm pause */}
          <button
            type="button"
            disabled={!pauseReason || pauseLoading}
            onClick={handlePause}
            className="w-full py-3 rounded-xl bg-orange-500 text-white font-semibold disabled:bg-slate-300 disabled:cursor-not-allowed hover:bg-orange-600 transition-colors"
          >
            {pauseLoading ? "Pausando..." : "⏸️ Confirmar Pausa"}
          </button>

          {/* Cancel */}
          <button
            type="button"
            onClick={() => setStep("executing")}
            disabled={pauseLoading}
            className="w-full mt-3 py-2.5 rounded-xl border-2 border-slate-200 text-slate-600 font-medium text-sm hover:bg-slate-50 transition-colors"
          >
            Voltar
          </button>
        </div>
      </div>
    );
  }

  // ── PAUSED ──
  if (step === "paused") {
    const pausedAt = pauseStatus?.pausedAt ? new Date(pauseStatus.pausedAt) : null;
    const activePause = pauseStatus?.pauses?.find(p => !p.resumedAt);
    const reasonCat = activePause?.reasonCategory || '';
    const reasonInfo = PAUSE_REASONS.find(r => r.value === reasonCat);

    return (
      <div className="flex min-h-screen items-center justify-center bg-amber-50 p-6">
        <div className="w-full max-w-sm bg-white rounded-2xl shadow-lg p-6">
          <div className="text-center mb-4">
            <div className="text-4xl mb-2">⏸️</div>
            <h2 className="text-lg font-bold text-amber-800">Atendimento Pausado</h2>
            <p className="text-sm text-slate-500 mt-1">{data?.serviceOrder.title}</p>
          </div>

          {/* Pause info */}
          <div className="mb-4 bg-amber-50 rounded-xl p-4 space-y-2">
            {reasonInfo && (
              <p className="text-sm text-amber-700">
                {reasonInfo.icon} {reasonInfo.label}
              </p>
            )}
            {activePause?.reason && (
              <p className="text-xs text-slate-500">{activePause.reason}</p>
            )}
            {pausedAt && (
              <p className="text-xs text-slate-400">
                Pausado desde: {pausedAt.toLocaleString("pt-BR")}
              </p>
            )}
          </div>

          {pauseError && (
            <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200">
              <p className="text-sm text-red-700">{pauseError}</p>
            </div>
          )}

          {/* Resume button */}
          <button
            type="button"
            disabled={pauseLoading}
            onClick={handleResume}
            className="w-full py-3 rounded-xl bg-green-600 text-white font-semibold hover:bg-green-700 transition-colors disabled:bg-slate-300"
          >
            {pauseLoading ? "Retomando..." : "▶️ Retomar Atendimento"}
          </button>

          <p className="text-[10px] text-slate-400 text-center mt-4">
            O cronômetro de execução está pausado.
          </p>
        </div>
      </div>
    );
  }

  // ── ARRIVED (Proximity reached or manual) ──
  if (step === "arrived") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-green-50 p-6">
        <div className="w-full max-w-sm text-center">
          <div className="text-5xl mb-3">📍</div>
          <h1 className="text-xl font-bold text-green-800">Você chegou ao local!</h1>
          <p className="text-sm text-slate-600 mt-2">
            {trackingConfig?.keepActiveUntil === 'execution_end'
              ? "O GPS continuará ativo durante o atendimento."
              : "O gestor e o cliente foram notificados."}
          </p>

          {/* If pause system is available, offer execution mode */}
          {pauseStatus?.pauseConfig?.enabled && (
            <button
              type="button"
              onClick={() => setStep("executing")}
              className="mt-4 w-full py-3 rounded-xl bg-blue-600 text-white font-semibold hover:bg-blue-700 transition-colors"
            >
              🔧 Acompanhar execução
            </button>
          )}

          <p className="text-xs text-slate-400 mt-4">Você pode fechar esta página.</p>
        </div>
      </div>
    );
  }

  // ── POST-ACCEPT (Page 2 — GPS + En Route) ──
  if (step === "post-accept") {
    const lc = data?.linkConfig;
    return (
      <div className="flex min-h-screen items-center justify-center bg-blue-50 p-6">
        <div className="w-full max-w-sm space-y-4">
          <div className="text-center">
            <div className="text-4xl mb-2">✅</div>
            <h2 className="text-lg font-bold text-blue-800">OS Aceita!</h2>
            <p className="text-sm text-slate-500 mt-1">{data?.serviceOrder.title}</p>
          </div>

          {/* Error */}
          {errorMsg && (
            <div className="p-3 rounded-xl bg-red-50 border border-red-200">
              <p className="text-sm text-red-700">{errorMsg}</p>
            </div>
          )}

          {/* En Route button */}
          {lc?.enRoute && !enRouteAt && (
            <div className="bg-white rounded-2xl shadow-sm border border-blue-200 p-4 text-center">
              <div className="text-2xl mb-2">🚗</div>
              <h3 className="text-sm font-semibold text-blue-800">Estou a caminho</h3>
              <p className="text-xs text-slate-500 mt-1 mb-3">
                Informe ao gestor que você está se deslocando para o local.
              </p>
              <button
                type="button"
                onClick={handleEnRoute}
                disabled={enRouteLoading}
                className="w-full py-2.5 rounded-xl bg-blue-600 text-white font-medium text-sm hover:bg-blue-700 transition-colors disabled:bg-slate-300"
              >
                {enRouteLoading ? "Registrando..." : "🚗 Estou a caminho"}
              </button>
            </div>
          )}

          {/* En Route confirmed */}
          {lc?.enRoute && enRouteAt && (
            <div className="bg-white rounded-2xl shadow-sm border border-green-200 p-4 text-center">
              <div className="text-2xl mb-1">✅</div>
              <p className="text-sm font-medium text-green-700">Saída registrada</p>
              <p className="text-xs text-slate-400 mt-1">
                {new Date(enRouteAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
              </p>
            </div>
          )}

          {/* GPS Tracking */}
          {lc?.gpsNavigation && !trackingActive && typeof navigator !== "undefined" && navigator.geolocation && (
            <div className="bg-white rounded-2xl shadow-sm border border-purple-200 p-4 text-center">
              <div className="text-2xl mb-2">📡</div>
              <h3 className="text-sm font-semibold text-purple-800">Ativar rastreamento GPS</h3>
              <p className="text-xs text-slate-500 mt-1 mb-3">
                Permite monitorar sua proximidade e notificar automaticamente quando você chegar ao local.
              </p>
              <button
                type="button"
                onClick={startTracking}
                className="w-full py-2.5 rounded-xl bg-purple-600 text-white font-medium text-sm hover:bg-purple-700 transition-colors"
              >
                🛰️ Ativar GPS
              </button>
              {trackingError && (
                <p className="text-xs text-red-500 mt-2">{trackingError}</p>
              )}
            </div>
          )}

          {/* If no more actions, show done info */}
          {(!lc?.gpsNavigation || trackingActive) && (!lc?.enRoute || enRouteAt) && (
            <p className="text-center text-xs text-slate-400 mt-2">Você pode fechar esta página.</p>
          )}
        </div>
      </div>
    );
  }

  // ── DONE ──
  if (step === "done") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-green-50 p-6">
        <div className="w-full max-w-sm text-center">
          <div className="text-5xl mb-3">✅</div>
          <h1 className="text-xl font-bold text-green-800">OS Aceita!</h1>
          <p className="text-sm text-slate-600 mt-2">
            {selectedMinutes
              ? `Tempo estimado informado: ${selectedMinutes >= 60 ? `${selectedMinutes / 60}h` : `${selectedMinutes} min`}`
              : "Você foi atribuído a esta ordem de serviço."}
          </p>
          <p className="text-xs text-slate-400 mt-4">Você pode fechar esta página.</p>
        </div>
      </div>
    );
  }

  // ── DECLINED ──
  if (step === "declined") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-amber-50 p-6">
        <div className="w-full max-w-sm text-center">
          <div className="text-5xl mb-3">🔄</div>
          <h1 className="text-xl font-bold text-amber-800">Atendimento recusado</h1>
          <p className="text-sm text-slate-600 mt-2">
            Sua recusa foi registrada. O sistema tomará a ação configurada pelo gestor.
          </p>
          <p className="text-xs text-slate-400 mt-4">Você pode fechar esta página.</p>
        </div>
      </div>
    );
  }

  // ── ARRIVAL QUESTION MODAL ──
  if (step === "arrival" && arrivalConfig) {
    const enRouteLimit = arrivalConfig.enRouteTimeoutMinutes;
    return (
      <div className="flex min-h-screen items-center justify-center bg-blue-50 p-6">
        <div className="w-full max-w-sm bg-white rounded-2xl shadow-lg p-6">
          <div className="text-center mb-4">
            <div className="text-3xl mb-2">🕐</div>
            <h2 className="text-lg font-bold text-slate-800">{arrivalConfig.question}</h2>
            {enRouteLimit && (
              <p className="text-xs text-amber-600 mt-1">
                Prazo máximo: {enRouteLimit >= 60 ? `${enRouteLimit / 60}h` : `${enRouteLimit} min`}
              </p>
            )}
          </div>

          {/* Error message */}
          {arrivalError && (
            <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200">
              <p className="text-sm text-red-700">{arrivalError}</p>
            </div>
          )}

          {/* Time options */}
          <div className="space-y-2 mb-4">
            {arrivalConfig.options.map((opt, i) => {
              const exceeds = enRouteLimit !== null && opt.minutes > enRouteLimit;
              return (
                <button
                  key={i}
                  type="button"
                  disabled={exceeds || arrivalLoading}
                  onClick={() => { setSelectedMinutes(opt.minutes); setArrivalError(null); }}
                  className={`w-full p-3 rounded-xl border-2 text-left transition-all ${
                    exceeds
                      ? "border-slate-200 bg-slate-100 text-slate-400 cursor-not-allowed line-through"
                      : selectedMinutes === opt.minutes
                        ? "border-blue-500 bg-blue-50 text-blue-800"
                        : "border-slate-200 bg-white text-slate-700 hover:border-blue-300"
                  }`}
                >
                  <span className="font-medium">{opt.label}</span>
                  {exceeds && <span className="text-xs ml-2">(excede o prazo)</span>}
                </button>
              );
            })}
          </div>

          {/* Confirm button */}
          <button
            type="button"
            disabled={selectedMinutes === null || arrivalLoading}
            onClick={handleSubmitArrival}
            className="w-full py-3 rounded-xl bg-blue-600 text-white font-semibold disabled:bg-slate-300 disabled:cursor-not-allowed hover:bg-blue-700 transition-colors"
          >
            {arrivalLoading ? "Enviando..." : "Confirmar"}
          </button>

          {/* Decline button */}
          <button
            type="button"
            disabled={arrivalLoading}
            onClick={handleDecline}
            className="w-full mt-3 py-2.5 rounded-xl border-2 border-red-200 text-red-600 font-medium text-sm hover:bg-red-50 transition-colors disabled:opacity-50"
          >
            Não vou poder atender
          </button>
        </div>
      </div>
    );
  }

  // ── OFFER VIEW + OTP FLOW ──
  const so = data!.serviceOrder;
  const company = data!.company;
  const distance = data?.distance;

  return (
    <div className="min-h-screen bg-slate-50 p-4">
      <div className="mx-auto max-w-sm space-y-4">
        {/* Company header */}
        <div className="text-center pt-2">
          <p className="text-xs text-slate-400 uppercase tracking-wider">Oferta de serviço</p>
          <h2 className="text-sm font-semibold text-blue-600">{company.name}</h2>
        </div>

        {/* OS card */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4 space-y-3">
          <h1 className="text-lg font-bold text-slate-800">{so.title}</h1>
          {so.description && <p className="text-sm text-slate-600">{so.description}</p>}

          <div className="space-y-2 text-sm">
            <div className="flex items-start gap-2">
              <span className="text-base">📍</span>
              <span className="text-slate-600">{so.addressText}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-base">💰</span>
              <span className="text-slate-700 font-medium">R$ {(so.valueCents / 100).toFixed(2)}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-base">📅</span>
              <span className="text-slate-600">Prazo: {new Date(so.deadlineAt).toLocaleDateString("pt-BR")}</span>
            </div>
            {distance && (
              <div className="flex items-center gap-2">
                <span className="text-base">🗺️</span>
                <span className="text-slate-600">{distance.km < 1 ? `${distance.meters}m` : `${distance.km} km`} de distância</span>
              </div>
            )}
          </div>
        </div>

        {/* Error */}
        {errorMsg && (
          <div className="p-3 rounded-xl bg-red-50 border border-red-200">
            <p className="text-sm text-red-700">{errorMsg}</p>
          </div>
        )}

        {/* Accept button — only if acceptOS is enabled */}
        {(data?.linkConfig?.acceptOS !== false) && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4 space-y-3">
            <button
              type="button"
              onClick={handleAccept}
              disabled={acceptLoading}
              className="w-full py-3 rounded-xl bg-green-600 text-white font-semibold text-base disabled:bg-slate-300 hover:bg-green-700 transition-colors"
            >
              {acceptLoading ? "Aceitando..." : "✅ Aceitar OS"}
            </button>
          </div>
        )}

        {/* When acceptOS=OFF: show enRoute + GPS directly on offer page */}
        {data?.linkConfig?.acceptOS === false && (() => {
          const lc = data.linkConfig!;
          return (
            <>
              {/* En Route */}
              {lc.enRoute && !enRouteAt && (
                <div className="bg-white rounded-2xl shadow-sm border border-blue-200 p-4 text-center">
                  <div className="text-2xl mb-2">🚗</div>
                  <h3 className="text-sm font-semibold text-blue-800">Estou a caminho</h3>
                  <p className="text-xs text-slate-500 mt-1 mb-3">
                    Informe ao gestor que você está se deslocando para o local.
                  </p>
                  <button
                    type="button"
                    onClick={handleEnRoute}
                    disabled={enRouteLoading}
                    className="w-full py-2.5 rounded-xl bg-blue-600 text-white font-medium text-sm hover:bg-blue-700 transition-colors disabled:bg-slate-300"
                  >
                    {enRouteLoading ? "Registrando..." : "🚗 Estou a caminho"}
                  </button>
                </div>
              )}

              {/* En Route confirmed */}
              {lc.enRoute && enRouteAt && (
                <div className="bg-white rounded-2xl shadow-sm border border-green-200 p-4 text-center">
                  <div className="text-2xl mb-1">✅</div>
                  <p className="text-sm font-medium text-green-700">Saída registrada</p>
                  <p className="text-xs text-slate-400 mt-1">
                    {new Date(enRouteAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                  </p>
                </div>
              )}

              {/* GPS */}
              {lc.gpsNavigation && !trackingActive && typeof navigator !== "undefined" && navigator.geolocation && (
                <div className="bg-white rounded-2xl shadow-sm border border-purple-200 p-4 text-center">
                  <div className="text-2xl mb-2">📡</div>
                  <h3 className="text-sm font-semibold text-purple-800">Ativar rastreamento GPS</h3>
                  <p className="text-xs text-slate-500 mt-1 mb-3">
                    Permite monitorar sua proximidade e notificar quando você chegar ao local.
                  </p>
                  <button
                    type="button"
                    onClick={startTracking}
                    className="w-full py-2.5 rounded-xl bg-purple-600 text-white font-medium text-sm hover:bg-purple-700 transition-colors"
                  >
                    🛰️ Ativar GPS
                  </button>
                  {trackingError && (
                    <p className="text-xs text-red-500 mt-2">{trackingError}</p>
                  )}
                </div>
              )}
            </>
          );
        })()}

        {/* Expiry info */}
        <p className="text-center text-xs text-slate-400">
          Esta oferta expira em {new Date(data!.offer.expiresAt).toLocaleString("pt-BR")}
        </p>
      </div>
    </div>
  );
}
