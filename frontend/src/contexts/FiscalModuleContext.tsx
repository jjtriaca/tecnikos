"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { api } from "@/lib/api";

interface FiscalModuleContextValue {
  fiscalEnabled: boolean;
  loading: boolean;
  refresh: () => Promise<void>;
}

const FiscalModuleContext = createContext<FiscalModuleContextValue>({
  fiscalEnabled: false,
  loading: true,
  refresh: async () => {},
});

export function FiscalModuleProvider({ children }: { children: React.ReactNode }) {
  const [fiscalEnabled, setFiscalEnabled] = useState(false);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const res = await api.get<{ fiscalEnabled: boolean }>("/companies/fiscal-module");
      setFiscalEnabled(res.fiscalEnabled);
    } catch {
      setFiscalEnabled(false);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return (
    <FiscalModuleContext.Provider value={{ fiscalEnabled, loading, refresh }}>
      {children}
    </FiscalModuleContext.Provider>
  );
}

export function useFiscalModule() {
  return useContext(FiscalModuleContext);
}
