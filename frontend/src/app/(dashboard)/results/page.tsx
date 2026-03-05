"use client";

import { useState } from "react";
import AccountsTab from "../finance/components/AccountsTab";
import DreReport from "../finance/components/DreReport";

type TabId = "plano" | "dre";

const TABS: { id: TabId; label: string; icon: string }[] = [
  { id: "plano", label: "Plano de Contas", icon: "📋" },
  { id: "dre", label: "DRE", icon: "📈" },
];

export default function ResultsPage() {
  const [activeTab, setActiveTab] = useState<TabId>("plano");

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Resultados</h1>
          <p className="text-sm text-slate-500">
            Plano de contas, categorias e demonstrativos de resultado.
          </p>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex gap-1 mb-6 border-b border-slate-200">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab.id
                ? "border-blue-600 text-blue-700"
                : "border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300"
            }`}
          >
            <span>{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === "plano" && <AccountsTab />}
      {activeTab === "dre" && <DreReport />}
    </div>
  );
}
