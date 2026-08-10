export type AiTrafficTab = 'traffic' | 'settings'

interface AiTrafficTabsProps {
  active: AiTrafficTab
  onChange: (tab: AiTrafficTab) => void
}

export function AiTrafficTabs({ active, onChange }: AiTrafficTabsProps) {
  const tabs: { id: AiTrafficTab; label: string }[] = [
    { id: 'traffic', label: 'AI Traffic' },
    { id: 'settings', label: 'Settings' },
  ]

  return (
    <div className="flex gap-6 border-b border-slate-200">
      {tabs.map((tab) => {
        const isActive = active === tab.id
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onChange(tab.id)}
            className={`-mb-px border-b-2 pb-2.5 text-sm font-medium transition ${
              isActive
                ? 'border-brand-600 text-brand-800'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            {tab.label}
          </button>
        )
      })}
    </div>
  )
}
