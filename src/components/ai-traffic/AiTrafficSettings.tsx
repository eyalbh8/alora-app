import type { ReactNode } from 'react'
import type { AiTrafficPayload } from '../../api/types'
import { providerLabel, regionLabel } from '../../lib/format'
import { ProviderIcon } from '../ProviderIcon'

interface AiTrafficSettingsProps {
  preferences: AiTrafficPayload['preferences']
}

function SettingsSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="border-t border-[#101414] py-5">
      <h3 className="text-[10.5px] font-semibold uppercase tracking-[0.1em] text-[#6f6961]">
        {title}
      </h3>
      <div className="mt-4">{children}</div>
    </section>
  )
}

function ChipList({ items, emptyLabel }: { items: string[]; emptyLabel: string }) {
  if (items.length === 0) {
    return <p className="text-sm text-[#9a938a]">{emptyLabel}</p>
  }
  return (
    <div className="flex flex-wrap gap-2">
      {items.map((item) => (
        <span
          key={item}
          className="rounded-full border border-[#d8d2c9] px-3 py-1 text-sm text-[#5c554c]"
        >
          {item}
        </span>
      ))}
    </div>
  )
}

function ProviderChipList({ providers, emptyLabel }: { providers: string[]; emptyLabel: string }) {
  if (providers.length === 0) {
    return <p className="text-sm text-[#9a938a]">{emptyLabel}</p>
  }
  return (
    <div className="flex flex-wrap gap-2">
      {providers.map((provider) => (
        <span
          key={provider}
          className="inline-flex items-center gap-1.5 rounded-full border border-[#d8d2c9] px-3 py-1 text-sm text-[#5c554c]"
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
    <div className="grid gap-x-10 gap-y-4 lg:grid-cols-2">
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
