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
    <div className="flex gap-7 border-b border-[#eae6de]">
      {tabs.map((tab) => {
        const isActive = active === tab.id
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onChange(tab.id)}
            className={`-mb-px border-b pb-2.5 text-[12px] font-medium transition ${
              isActive
                ? 'border-brand-700 text-brand-900'
                : 'border-transparent text-[#9a938a] hover:text-[#101414]'
            }`}
          >
            {tab.label}
          </button>
        )
      })}
    </div>
  )
}
