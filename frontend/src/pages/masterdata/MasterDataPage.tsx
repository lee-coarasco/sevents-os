import { useState } from "react";
import { UomSection } from "./UomSection";
import { CurrenciesSection } from "./CurrenciesSection";
import { CostCodesSection } from "./CostCodesSection";
import { DocumentTypesSection } from "./DocumentTypesSection";
import { ProjectTypesSection } from "./ProjectTypesSection";
import { NumberingSchemesSection } from "./NumberingSchemesSection";

const TABS = [
  { key: "uom", label: "Units of Measure" },
  { key: "currencies", label: "Currencies" },
  { key: "cost-codes", label: "Cost Codes" },
  { key: "document-types", label: "Document Types" },
  { key: "project-types", label: "Project Types" },
  { key: "numbering-schemes", label: "Numbering Schemes" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

export function MasterDataPage() {
  const [activeTab, setActiveTab] = useState<TabKey>("uom");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-brand text-2xl font-bold text-zinc-900">Master Data</h1>
        <p className="mt-1 text-sm text-zinc-400">
          Controlled lists used across every module — units of measure, currencies, cost codes, document types,
          project types and numbering schemes
        </p>
      </div>

      <div className="flex flex-wrap gap-2 border-b border-zinc-100 pb-2">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveTab(tab.key)}
            className={`rounded-lg px-3.5 py-2 text-sm font-medium transition-colors ${
              activeTab === tab.key
                ? "bg-brand text-zinc-900"
                : "text-zinc-500 hover:bg-brand-soft hover:text-brand-dim"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "uom" && <UomSection />}
      {activeTab === "currencies" && <CurrenciesSection />}
      {activeTab === "cost-codes" && <CostCodesSection />}
      {activeTab === "document-types" && <DocumentTypesSection />}
      {activeTab === "project-types" && <ProjectTypesSection />}
      {activeTab === "numbering-schemes" && <NumberingSchemesSection />}
    </div>
  );
}
