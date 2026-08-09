import { Link } from 'react-router-dom'
import { useBrandKitEdit } from '../../context/BrandKitEditContext'
import { EditableField } from '../../components/EditableField'
import { FlagIcon } from '../../components/FlagIcon'

export function BrandKitOverviewScreen() {
  const { draft, setDraft } = useBrandKitEdit()
  if (!draft) return null

  const url = draft.brand_url.replace(/^https?:\/\//, '')

  return (
    <div className="space-y-8">
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-950 via-emerald-900 to-emerald-800 px-6 py-10 text-emerald-50">
        <div
          className="pointer-events-none absolute inset-0 opacity-30"
          style={{
            backgroundImage:
              'radial-gradient(circle at 20% 40%, rgba(255,255,255,0.25) 0, transparent 45%), radial-gradient(circle at 80% 20%, rgba(16,185,129,0.4) 0, transparent 40%)',
          }}
        />
        <div className="relative flex items-end justify-between gap-4">
          <div>
            <p className="font-serif text-6xl font-bold tracking-tight text-emerald-100/90 sm:text-7xl">
              {(draft.brand_name[0] ?? 'A').toUpperCase()}
            </p>
            <p className="mt-3 max-w-sm text-xs text-emerald-100/70">
              Brand story / mission · global rules, tone and voice
            </p>
          </div>
          <button
            type="button"
            className="rounded-lg border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-medium text-white backdrop-blur hover:bg-white/20"
            title="Visual placeholder — image upload is not wired"
          >
            Add Image
          </button>
        </div>
      </div>

      <div className="flex items-start gap-3">
        <FlagIcon iconName="flag-us" className="mt-1 text-3xl" />
        <div>
          <h2 className="text-3xl font-semibold tracking-tight text-slate-900">
            {draft.brand_name}
          </h2>
          <a
            href={`https://${url}`}
            target="_blank"
            rel="noreferrer"
            className="text-sm text-slate-400 hover:text-emerald-800 hover:underline"
          >
            {url}
          </a>
        </div>
      </div>

      <section>
        <div className="mb-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            01 · Brand Foundations
          </p>
          <h3 className="text-lg font-semibold text-slate-900">About your Brand</h3>
        </div>
        <EditableField
          label="Brand about"
          value={draft.brand_about}
          onChange={(brand_about) => setDraft({ ...draft, brand_about })}
          rows={6}
        />
      </section>

      <section className="grid gap-4 sm:grid-cols-2">
        <QuickCard
          to="/brand-kit/product-lines"
          title="Product Lines"
          count={draft.product_lines.length}
          blurb="Positioning, ICP, and competitors"
        />
        <QuickCard
          to="/brand-kit/content-types"
          title="Content Types"
          count={draft.content_types.length}
          blurb="Formats like blog posts or landing pages"
        />
      </section>
    </div>
  )
}

function QuickCard({
  to,
  title,
  count,
  blurb,
}: {
  to: string
  title: string
  count: number
  blurb: string
}) {
  return (
    <Link
      to={to}
      className="rounded-xl border border-slate-200/80 bg-slate-50/50 p-4 transition hover:border-emerald-200 hover:bg-emerald-50/40"
    >
      <div className="flex items-baseline justify-between">
        <h4 className="text-sm font-semibold text-slate-900">{title}</h4>
        <span className="text-2xl font-semibold text-emerald-800">{count}</span>
      </div>
      <p className="mt-1 text-xs text-slate-500">{blurb}</p>
    </Link>
  )
}
