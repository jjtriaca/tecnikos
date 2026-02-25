"use client";
import { useState, useCallback } from "react";

/* ═══════════════════════════════════════════════════════════
   DEMO — Simulação de Fluxo Completo (3 telas)
   - Esquerda: Celular do técnico (mobile)
   - Centro: WhatsApp do gestor
   - Direita: WhatsApp do cliente
   ═══════════════════════════════════════════════════════════ */

type Step =
  | "offer"        // OS ofertada ao técnico
  | "accepted"     // Técnico aceitou
  | "en_route"     // Técnico a caminho
  | "arrived"      // Técnico chegou
  | "executing"    // Em execução
  | "pausing"      // Selecionando motivo de pausa
  | "paused"       // Pausado
  | "resumed"      // Retomou execução
  | "completing"   // Finalizando
  | "completed";   // Concluído

type WhatsAppMsg = {
  time: string;
  from: string;
  text: string;
  type: "system" | "received";
};

const OS_DATA = {
  titulo: "Instalação AC Split 12000 BTUs",
  cliente: "Maria Souza",
  endereco: "Rua das Palmeiras, 456 - Centro, Curitiba/PR",
  tecnico: "Carlos Silva",
  valor: "R$ 850,00",
  comissao: "R$ 170,00",
  empresa: "ClimaFrio Serviços LTDA",
};

const PAUSE_REASONS = [
  { value: "meal_break", label: "Intervalo para refeição", icon: "🍽️" },
  { value: "fetch_materials", label: "Buscar material/peças", icon: "🔧" },
  { value: "weather", label: "Condições climáticas", icon: "🌧️" },
  { value: "waiting_client", label: "Aguardando cliente", icon: "⏳" },
  { value: "end_of_day", label: "Encerramento do expediente", icon: "🌙" },
  { value: "other", label: "Outro", icon: "📝" },
];

function now() {
  return new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

/* ── WhatsApp Message Bubble ── */
function WaMsg({ msg }: { msg: WhatsAppMsg }) {
  if (msg.type === "system") {
    return (
      <div className="flex justify-center my-2">
        <span className="text-[10px] bg-[#e1f3d8] text-[#54656f] px-3 py-1 rounded-lg shadow-sm">
          {msg.text}
        </span>
      </div>
    );
  }
  return (
    <div className="flex justify-start my-1">
      <div className="max-w-[85%] bg-white rounded-lg shadow px-3 py-2">
        <p className="text-[10px] font-bold text-[#00a884] mb-0.5">{msg.from}</p>
        <p className="text-[12px] text-[#111b21] whitespace-pre-line">{msg.text}</p>
        <p className="text-[9px] text-[#667781] text-right mt-0.5">{msg.time} ✓✓</p>
      </div>
    </div>
  );
}

/* ── WhatsApp Screen ── */
function WhatsAppScreen({ title, avatar, messages }: { title: string; avatar: string; messages: WhatsAppMsg[] }) {
  return (
    <div className="flex flex-col h-full bg-[#efeae2] rounded-2xl overflow-hidden shadow-xl border border-slate-300">
      {/* Header */}
      <div className="bg-[#008069] text-white px-3 py-2.5 flex items-center gap-2">
        <div className="w-8 h-8 bg-[#dfe5e7] rounded-full flex items-center justify-center text-lg">{avatar}</div>
        <div>
          <p className="text-sm font-semibold">{title}</p>
          <p className="text-[10px] opacity-80">online</p>
        </div>
      </div>
      {/* Chat body */}
      <div className="flex-1 overflow-y-auto p-3 space-y-1" style={{ backgroundImage: "url('data:image/svg+xml,<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 100 100\"><rect fill=\"%23efeae2\" width=\"100\" height=\"100\"/></svg>')" }}>
        {messages.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-xs text-[#667781] italic">Aguardando mensagens...</p>
          </div>
        ) : (
          messages.map((m, i) => <WaMsg key={i} msg={m} />)
        )}
      </div>
    </div>
  );
}

/* ── Mobile Phone Frame ── */
function PhoneFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative mx-auto" style={{ width: 320, height: 640 }}>
      {/* Phone body */}
      <div className="absolute inset-0 bg-black rounded-[2.5rem] shadow-2xl border-4 border-slate-800">
        {/* Notch */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-28 h-6 bg-black rounded-b-2xl z-10" />
        {/* Screen */}
        <div className="absolute top-2 left-2 right-2 bottom-2 bg-white rounded-[2rem] overflow-hidden">
          <div className="h-full overflow-y-auto">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Main Demo Component ── */
export default function DemoPage() {
  const [step, setStep] = useState<Step>("offer");
  const [gestorMsgs, setGestorMsgs] = useState<WhatsAppMsg[]>([]);
  const [clienteMsgs, setClienteMsgs] = useState<WhatsAppMsg[]>([]);
  const [selectedReason, setSelectedReason] = useState("");
  const [pauseCount, setPauseCount] = useState(0);
  const [timer, setTimer] = useState("00:00");
  const [timerInterval, setTimerInterval] = useState<ReturnType<typeof setInterval> | null>(null);
  const [timerStart, setTimerStart] = useState(0);

  const addGestor = useCallback((text: string, from = "Sistema FieldService") => {
    setGestorMsgs(prev => [...prev, { time: now(), from, text, type: "received" }]);
  }, []);

  const addCliente = useCallback((text: string, from = "Sistema FieldService") => {
    setClienteMsgs(prev => [...prev, { time: now(), from, text, type: "received" }]);
  }, []);

  const startTimer = useCallback(() => {
    const start = Date.now();
    setTimerStart(start);
    const iv = setInterval(() => {
      const elapsed = Math.floor((Date.now() - start) / 1000);
      const m = String(Math.floor(elapsed / 60)).padStart(2, "0");
      const s = String(elapsed % 60).padStart(2, "0");
      setTimer(`${m}:${s}`);
    }, 1000);
    setTimerInterval(iv);
  }, []);

  const stopTimer = useCallback(() => {
    if (timerInterval) clearInterval(timerInterval);
    setTimerInterval(null);
  }, [timerInterval]);

  /* ── Step Handlers ── */
  const handleAccept = () => {
    setStep("accepted");
    addGestor(`O tecnico ${OS_DATA.tecnico} aceitou a OS "${OS_DATA.titulo}".`);
  };

  const handleEnRoute = () => {
    setStep("en_route");
    addGestor(`O tecnico ${OS_DATA.tecnico} esta a caminho. OS: "${OS_DATA.titulo}"`);
    addCliente(`O tecnico esta a caminho para o servico "${OS_DATA.titulo}". Endereco: ${OS_DATA.endereco}`);
  };

  const handleArrived = () => {
    setStep("arrived");
    addGestor(`O tecnico ${OS_DATA.tecnico} chegou ao local. OS: "${OS_DATA.titulo}"`);
    addCliente(`O tecnico ${OS_DATA.tecnico} esta chegando! OS: "${OS_DATA.titulo}"`);
  };

  const handleStartExec = () => {
    setStep("executing");
    startTimer();
    addGestor(`Execucao iniciada. OS: "${OS_DATA.titulo}" por ${OS_DATA.tecnico}.`);
  };

  const handlePauseClick = () => {
    setStep("pausing");
  };

  const handleConfirmPause = () => {
    if (!selectedReason) return;
    const reasonLabel = PAUSE_REASONS.find(r => r.value === selectedReason)?.label || selectedReason;
    setPauseCount(prev => prev + 1);
    stopTimer();
    setStep("paused");
    addGestor(`O tecnico ${OS_DATA.tecnico} pausou a OS "${OS_DATA.titulo}". Motivo: ${reasonLabel}. Pausas: ${pauseCount + 1}.`);
    addCliente(`O servico "${OS_DATA.titulo}" foi temporariamente pausado. Motivo: ${reasonLabel}. O tecnico retomara em breve.`);
  };

  const handleResume = () => {
    setStep("resumed");
    startTimer();
    setTimeout(() => setStep("executing"), 500);
    addGestor(`O tecnico ${OS_DATA.tecnico} retomou a OS "${OS_DATA.titulo}". Tempo pausado: ${timer}.`);
    addCliente(`O servico "${OS_DATA.titulo}" foi retomado pelo tecnico.`);
  };

  const handleComplete = () => {
    stopTimer();
    setStep("completed");
    addGestor(`OS "${OS_DATA.titulo}" foi concluida pelo tecnico ${OS_DATA.tecnico}. Tempo total: ${timer}. Pausas: ${pauseCount}.`);
    addCliente(`Seu servico "${OS_DATA.titulo}" foi concluido com sucesso! Obrigado por escolher ${OS_DATA.empresa}.`);
  };

  const handleReset = () => {
    stopTimer();
    setStep("offer");
    setGestorMsgs([]);
    setClienteMsgs([]);
    setSelectedReason("");
    setPauseCount(0);
    setTimer("00:00");
  };

  /* ── Tech Mobile Screen Content ── */
  const renderTechScreen = () => {
    switch (step) {
      case "offer":
        return (
          <div className="p-4 pt-8 space-y-4">
            <div className="text-center">
              <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-2 text-3xl">🔧</div>
              <h2 className="text-lg font-bold text-slate-800">Nova Proposta de OS</h2>
              <p className="text-xs text-slate-500">Voce recebeu uma oferta de servico</p>
            </div>
            <div className="bg-blue-50 rounded-xl p-3 space-y-2">
              <div className="flex justify-between"><span className="text-xs text-slate-500">Titulo:</span><span className="text-xs font-bold">{OS_DATA.titulo}</span></div>
              <div className="flex justify-between"><span className="text-xs text-slate-500">Cliente:</span><span className="text-xs">{OS_DATA.cliente}</span></div>
              <div className="flex justify-between"><span className="text-xs text-slate-500">Endereco:</span><span className="text-xs text-right max-w-[60%]">{OS_DATA.endereco}</span></div>
              <div className="flex justify-between"><span className="text-xs text-slate-500">Valor:</span><span className="text-xs font-bold text-green-700">{OS_DATA.valor}</span></div>
              <div className="flex justify-between"><span className="text-xs text-slate-500">Comissao:</span><span className="text-xs font-bold text-blue-700">{OS_DATA.comissao}</span></div>
            </div>
            <button onClick={handleAccept} className="w-full bg-green-600 text-white py-3 rounded-xl font-bold text-sm hover:bg-green-700 transition">Aceitar OS</button>
            <button className="w-full border border-red-300 text-red-600 py-2.5 rounded-xl text-sm">Recusar</button>
          </div>
        );

      case "accepted":
        return (
          <div className="p-4 pt-8 space-y-4 text-center">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto text-3xl">✅</div>
            <h2 className="text-lg font-bold text-green-800">OS Aceita!</h2>
            <p className="text-xs text-slate-500">{OS_DATA.titulo}</p>
            <div className="bg-green-50 rounded-xl p-3">
              <p className="text-xs text-slate-600">Quando estiver pronto, clique para indicar que esta a caminho.</p>
            </div>
            <button onClick={handleEnRoute} className="w-full bg-blue-600 text-white py-3 rounded-xl font-bold text-sm hover:bg-blue-700 transition flex items-center justify-center gap-2">
              🚗 Estou a Caminho
            </button>
          </div>
        );

      case "en_route":
        return (
          <div className="p-4 pt-8 space-y-4 text-center">
            <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto text-3xl animate-pulse">🚗</div>
            <h2 className="text-lg font-bold text-blue-800">A Caminho</h2>
            <p className="text-xs text-slate-500">{OS_DATA.endereco}</p>
            <div className="bg-blue-50 rounded-xl p-3">
              <div className="flex items-center justify-center gap-2">
                <div className="w-2 h-2 bg-blue-500 rounded-full animate-ping" />
                <span className="text-xs text-blue-700">GPS ativo - rastreando posicao</span>
              </div>
              <p className="text-sm font-bold text-blue-800 mt-2">Distancia: 2.3 km</p>
            </div>
            <button onClick={handleArrived} className="w-full bg-purple-600 text-white py-3 rounded-xl font-bold text-sm hover:bg-purple-700 transition">
              📍 Cheguei no Local
            </button>
          </div>
        );

      case "arrived":
        return (
          <div className="p-4 pt-8 space-y-4 text-center">
            <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto text-3xl">📍</div>
            <h2 className="text-lg font-bold text-purple-800">Voce Chegou!</h2>
            <p className="text-xs text-slate-500">{OS_DATA.titulo}</p>
            <div className="bg-amber-50 rounded-xl p-3 space-y-2">
              <p className="text-xs font-bold text-amber-800">📸 Fotos obrigatorias antes de iniciar:</p>
              <div className="flex gap-2 justify-center">
                <div className="w-16 h-16 bg-slate-200 rounded-lg flex items-center justify-center text-xl">📷</div>
                <div className="w-16 h-16 bg-green-100 rounded-lg flex items-center justify-center text-xl border-2 border-green-400">✅</div>
              </div>
              <p className="text-[10px] text-slate-500">1/1 foto(s) enviada(s)</p>
            </div>
            <button onClick={handleStartExec} className="w-full bg-teal-600 text-white py-3 rounded-xl font-bold text-sm hover:bg-teal-700 transition">
              ▶️ Iniciar Execucao
            </button>
          </div>
        );

      case "executing":
      case "resumed":
        return (
          <div className="p-4 pt-8 space-y-3">
            <div className="text-center">
              <h2 className="text-lg font-bold text-teal-800">Em Execucao</h2>
              <p className="text-xs text-slate-500">{OS_DATA.titulo}</p>
            </div>
            {/* Timer */}
            <div className="bg-teal-50 rounded-xl p-4 text-center">
              <p className="text-[10px] text-teal-600 uppercase tracking-wider mb-1">Tempo de execucao</p>
              <p className="text-3xl font-mono font-bold text-teal-800">{timer}</p>
              {pauseCount > 0 && <p className="text-[10px] text-orange-600 mt-1">Pausas realizadas: {pauseCount}</p>}
            </div>
            {/* Checklist */}
            <div className="bg-white rounded-xl border border-slate-200 p-3 space-y-2">
              <p className="text-xs font-bold text-slate-700">Checklist:</p>
              {["Material conferido", "Area limpa", "Equipamento instalado", "Teste realizado"].map((item, i) => (
                <label key={i} className="flex items-center gap-2 text-xs">
                  <input type="checkbox" className="rounded border-slate-300 text-teal-600" defaultChecked={i < 2} />
                  <span>{item}</span>
                </label>
              ))}
            </div>
            {/* Actions */}
            <div className="space-y-2">
              <button onClick={handlePauseClick} className="w-full bg-orange-500 text-white py-3 rounded-xl font-bold text-sm hover:bg-orange-600 transition flex items-center justify-center gap-2">
                ⏸️ Pausar Atendimento
              </button>
              <button onClick={handleComplete} className="w-full bg-green-600 text-white py-3 rounded-xl font-bold text-sm hover:bg-green-700 transition flex items-center justify-center gap-2">
                ✅ Concluir Servico
              </button>
            </div>
          </div>
        );

      case "pausing":
        return (
          <div className="p-4 pt-8 space-y-4">
            <div className="text-center">
              <div className="w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center mx-auto text-2xl">⏸️</div>
              <h2 className="text-lg font-bold text-orange-800 mt-2">Pausar Atendimento</h2>
              <p className="text-xs text-slate-500">Selecione o motivo da pausa</p>
            </div>
            <div className="space-y-2">
              {PAUSE_REASONS.map(r => (
                <button key={r.value} onClick={() => setSelectedReason(r.value)}
                  className={`w-full flex items-center gap-3 p-3 rounded-xl border text-left transition ${selectedReason === r.value ? "border-orange-400 bg-orange-50" : "border-slate-200 bg-white hover:border-orange-200"}`}>
                  <span className="text-xl">{r.icon}</span>
                  <span className="text-sm">{r.label}</span>
                  {selectedReason === r.value && <span className="ml-auto text-orange-500 text-lg">●</span>}
                </button>
              ))}
            </div>
            {selectedReason === "other" && (
              <input type="text" placeholder="Descreva o motivo..." className="w-full text-sm border border-slate-300 rounded-xl px-3 py-2.5" />
            )}
            <div className="bg-amber-50 rounded-xl p-3">
              <p className="text-xs font-bold text-amber-800">📸 Foto obrigatoria ao pausar:</p>
              <div className="flex gap-2 mt-2">
                <div className="w-14 h-14 bg-green-100 rounded-lg flex items-center justify-center text-lg border-2 border-green-400">✅</div>
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setStep("executing")} className="flex-1 border border-slate-300 py-2.5 rounded-xl text-sm text-slate-600">Cancelar</button>
              <button onClick={handleConfirmPause} disabled={!selectedReason}
                className={`flex-1 py-2.5 rounded-xl text-sm font-bold text-white transition ${selectedReason ? "bg-orange-500 hover:bg-orange-600" : "bg-slate-300 cursor-not-allowed"}`}>
                Confirmar Pausa
              </button>
            </div>
          </div>
        );

      case "paused":
        return (
          <div className="p-4 pt-8 space-y-4 text-center">
            <div className="w-20 h-20 bg-orange-100 rounded-full flex items-center justify-center mx-auto text-4xl animate-pulse">⏸️</div>
            <h2 className="text-xl font-bold text-orange-800">Atendimento Pausado</h2>
            <p className="text-xs text-slate-500">{OS_DATA.titulo}</p>
            <div className="bg-orange-50 rounded-xl p-4 space-y-2">
              <div className="flex justify-between text-xs">
                <span className="text-slate-500">Motivo:</span>
                <span className="font-bold">{PAUSE_REASONS.find(r => r.value === selectedReason)?.icon} {PAUSE_REASONS.find(r => r.value === selectedReason)?.label}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-slate-500">Pausas realizadas:</span>
                <span className="font-bold">{pauseCount}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-slate-500">Tempo de execucao:</span>
                <span className="font-bold font-mono">{timer}</span>
              </div>
            </div>
            <button onClick={handleResume} className="w-full bg-teal-600 text-white py-3.5 rounded-xl font-bold text-sm hover:bg-teal-700 transition flex items-center justify-center gap-2">
              ▶️ Retomar Atendimento
            </button>
          </div>
        );

      case "completed":
        return (
          <div className="p-4 pt-8 space-y-4 text-center">
            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto text-4xl">🎉</div>
            <h2 className="text-xl font-bold text-green-800">Servico Concluido!</h2>
            <p className="text-xs text-slate-500">{OS_DATA.titulo}</p>
            <div className="bg-green-50 rounded-xl p-4 space-y-2">
              <div className="flex justify-between text-xs"><span className="text-slate-500">Tempo total:</span><span className="font-bold font-mono">{timer}</span></div>
              <div className="flex justify-between text-xs"><span className="text-slate-500">Pausas:</span><span className="font-bold">{pauseCount}</span></div>
              <div className="flex justify-between text-xs"><span className="text-slate-500">Comissao:</span><span className="font-bold text-blue-700">{OS_DATA.comissao}</span></div>
            </div>
            <div className="bg-blue-50 rounded-xl p-3">
              <p className="text-xs text-blue-800 font-bold mb-2">💰 Lancamentos financeiros criados:</p>
              <div className="space-y-1 text-left">
                <div className="flex justify-between text-xs"><span>💰 Contas a Receber</span><span className="font-bold">{OS_DATA.valor}</span></div>
                <div className="flex justify-between text-xs"><span>👷 Comissao Tecnico</span><span className="font-bold">{OS_DATA.comissao}</span></div>
              </div>
            </div>
            <p className="text-xs text-slate-400">Aguardando aprovacao do gestor...</p>
          </div>
        );
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-100 to-slate-200 p-4">
      {/* Header */}
      <div className="max-w-7xl mx-auto mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-800">Demo - Fluxo Completo de Atendimento</h1>
            <p className="text-sm text-slate-500">Simulacao com 3 telas: Tecnico (mobile) | Gestor (WhatsApp) | Cliente (WhatsApp)</p>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs bg-blue-100 text-blue-800 px-3 py-1 rounded-full font-bold">
              v1.00.43
            </span>
            <button onClick={handleReset} className="bg-slate-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-slate-700 transition">
              🔄 Reiniciar Demo
            </button>
          </div>
        </div>
        {/* Progress bar */}
        <div className="mt-4 flex items-center gap-1">
          {(["offer","accepted","en_route","arrived","executing","paused","completed"] as Step[]).map((s, i) => {
            const labels: Record<string, string> = { offer: "Ofertada", accepted: "Aceita", en_route: "A Caminho", arrived: "Chegou", executing: "Executando", paused: "Pausada", completed: "Concluida" };
            const icons: Record<string, string> = { offer: "📋", accepted: "✅", en_route: "🚗", arrived: "📍", executing: "🔧", paused: "⏸️", completed: "🎉" };
            const order = ["offer","accepted","en_route","arrived","executing","pausing","paused","resumed","completing","completed"];
            const currentIdx = order.indexOf(step);
            const stepIdx = order.indexOf(s);
            const isActive = stepIdx <= currentIdx;
            const isCurrent = s === step || (step === "pausing" && s === "executing") || (step === "resumed" && s === "executing");
            return (
              <div key={s} className="flex items-center flex-1">
                <div className={`flex flex-col items-center flex-1 ${isActive ? "opacity-100" : "opacity-40"}`}>
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm ${isCurrent ? "bg-blue-600 text-white ring-4 ring-blue-200" : isActive ? "bg-green-500 text-white" : "bg-slate-300 text-white"}`}>
                    {icons[s]}
                  </div>
                  <span className="text-[9px] mt-1 text-slate-600 font-medium">{labels[s]}</span>
                </div>
                {i < 6 && <div className={`h-0.5 flex-1 ${isActive ? "bg-green-400" : "bg-slate-300"} -mt-4`} />}
              </div>
            );
          })}
        </div>
      </div>

      {/* 3 Screens */}
      <div className="max-w-7xl mx-auto grid grid-cols-3 gap-6">
        {/* Tecnico Mobile */}
        <div>
          <h3 className="text-sm font-bold text-slate-700 text-center mb-3 flex items-center justify-center gap-2">
            <span className="w-6 h-6 bg-teal-500 rounded-full text-white text-xs flex items-center justify-center">📱</span>
            Celular do Tecnico
          </h3>
          <PhoneFrame>{renderTechScreen()}</PhoneFrame>
        </div>

        {/* Gestor WhatsApp */}
        <div>
          <h3 className="text-sm font-bold text-slate-700 text-center mb-3 flex items-center justify-center gap-2">
            <span className="w-6 h-6 bg-violet-500 rounded-full text-white text-xs flex items-center justify-center">👔</span>
            WhatsApp do Gestor
          </h3>
          <div style={{ height: 640 }}>
            <WhatsAppScreen title={`${OS_DATA.empresa}`} avatar="👔" messages={gestorMsgs} />
          </div>
        </div>

        {/* Cliente WhatsApp */}
        <div>
          <h3 className="text-sm font-bold text-slate-700 text-center mb-3 flex items-center justify-center gap-2">
            <span className="w-6 h-6 bg-emerald-500 rounded-full text-white text-xs flex items-center justify-center">👤</span>
            WhatsApp do Cliente
          </h3>
          <div style={{ height: 640 }}>
            <WhatsAppScreen title={OS_DATA.cliente} avatar="👤" messages={clienteMsgs} />
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="max-w-7xl mx-auto mt-6 text-center">
        <p className="text-[10px] text-slate-400">
          FieldService v1.00.43 &quot;Ajustes de Pausas + Financeiro&quot; — Demonstracao interativa do fluxo de atendimento
        </p>
      </div>
    </div>
  );
}
