import type { ReactNode } from 'react'
import type { AiTrafficPayload } from '../../api/types'
import { providerLabel, regionLabel } from '../../lib/format'
import { ProviderIcon } from '../ProviderIcon'

interface AiTrafficSettingsProps {
  preferences: AiTrafficPayload['preferences']
}

function SettingsSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-xl border border-slate-200/60 bg-white p-5 shadow-sm">
      <h3 className="text-sm font-semibold text-[#101414]">{title}</h3>
      <div className="mt-3">{children}</div>
    </div>
  )
}

function ChipList({ items, emptyLabel }: { items: string[]; emptyLabel: string }) {
  if (items.length === 0) {
    return <p className="text-sm text-slate-500">{emptyLabel}</p>
  }
  return (
    <div className="flex flex-wrap gap-2">
      {items.map((item) => (
        <span
          key={item}
          className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-sm text-slate-700"
        >
          {item}
        </span>
      ))}
    </div>
  )
}

function ProviderChipList({ providers, emptyLabel }: { providers: string[]; emptyLabel: string }) {
  if (providers.length === 0) {
    return <p className="text-sm text-slate-500">{emptyLabel}</p>
  }
  return (
    <div className="flex flex-wrap gap-2">
      {providers.map((provider) => (
        <span
          key={provider}
          className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-sm text-slate-700"
        >
          <ProviderIcon provider={provider} size="sm" />
          {providerLabel(provider)}
        </span>
      ))}
    </div>
  )
}

export function AiTrafficSettings({ preferences }: AiTrafficSettingsProps) {
  const prefs = (preferences ?? {}) as Record<string, unknown>
  const tags = (prefs.tags as Array<{ name?: string }> | undefined)?.map((t) => t.name ?? '').filter(Boolean) ?? []
  const topics = (prefs.topics as string[] | undefined) ?? []
  const aiEngines = (prefs.aiEngines as string[] | undefined) ?? []
  const countries = ((prefs.countries as string[] | undefined) ?? []).map(regionLabel)

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <SettingsSection title="AI engines">
        <ProviderChipList providers={aiEngines} emptyLabel="No AI engines configured." />
      </SettingsSection>
      <SettingsSection title="Countries">
        <ChipList items={countries} emptyLabel="No countries configured." />
      </SettingsSection>
      <SettingsSection title="Topics">
        <ChipList items={topics} emptyLabel="No topics configured." />
      </SettingsSection>
      <SettingsSection title="Tags">
        <ChipList items={tags} emptyLabel="No tags configured." />
      </SettingsSection>
    </div>
  )
}
