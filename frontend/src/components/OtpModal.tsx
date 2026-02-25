"use client";

import { useMemo, useState } from "react";
import { api } from "@/lib/api";

type OtpRequestResponse = {
  otpId?: string | null;
  id?: string | null;
};

type OtpVerifyResponse = {
  success?: boolean;
  verified?: boolean;
};

export default function OtpModal({
  token,
  isOpen,
  onClose,
  onVerified,
}: {
  token: string;
  isOpen: boolean;
  onClose: () => void;
  onVerified?: (result: OtpVerifyResponse) => void;
}) {
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [otpId, setOtpId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const phoneDigits = useMemo(() => phone.replace(/\D/g, ""), [phone]);

  async function requestOtp() {
    setError(null);
    setLoading(true);
    try {
      const res = await api.post<OtpRequestResponse>(
        `/public-offers/${token}/otp/request`,
        { phone: phoneDigits }
      );
      setOtpId(res.otpId || res.id || null);
    } catch {
      setError("Não foi possível enviar o código. Verifique o telefone.");
      setOtpId(null);
    } finally {
      setLoading(false);
    }
  }

  async function verifyOtp() {
    if (!otpId) return;
    setError(null);
    setLoading(true);
    try {
      const res = await api.post<OtpVerifyResponse>(
        `/public-offers/${token}/otp/verify`,
        { otpId, code: otp }
      );
      if (!res.success && !res.verified) {
        setError("Código inválido.");
        return;
      }
      onVerified?.(res);
      onClose();
    } catch {
      setError("Não foi possível validar o código.");
    } finally {
      setLoading(false);
    }
  }

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      <div className="relative w-full max-w-md border rounded-2xl bg-white p-6 flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold">Confirmação por SMS</h2>
          <button
            className="border rounded-lg px-3 py-1"
            onClick={onClose}
            disabled={loading}
            type="button"
          >
            Fechar
          </button>
        </div>

        {!otpId ? (
          <>
            <label className="flex flex-col gap-1">
              <span className="text-sm">Telefone</span>
              <input
                className="border rounded-lg px-3 py-2"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="(00) 00000-0000"
                inputMode="tel"
              />
            </label>

            {error && <div className="text-sm text-red-600">{error}</div>}

            <button
              className="border rounded-lg px-4 py-2 font-semibold"
              onClick={requestOtp}
              disabled={loading || phoneDigits.length < 10}
              type="button"
            >
              {loading ? "Enviando..." : "Enviar código"}
            </button>
          </>
        ) : (
          <>
            <label className="flex flex-col gap-1">
              <span className="text-sm">Código</span>
              <input
                className="border rounded-lg px-3 py-2"
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
                placeholder="000000"
                inputMode="numeric"
              />
            </label>

            {error && <div className="text-sm text-red-600">{error}</div>}

            <div className="flex gap-2">
              <button
                className="border rounded-lg px-4 py-2 font-semibold flex-1"
                onClick={verifyOtp}
                disabled={loading || otp.trim().length < 4}
                type="button"
              >
                {loading ? "Validando..." : "Validar"}
              </button>

              <button
                className="border rounded-lg px-4 py-2"
                onClick={() => {
                  setOtpId(null);
                  setOtp("");
                  setError(null);
                }}
                disabled={loading}
                type="button"
              >
                Trocar número
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
