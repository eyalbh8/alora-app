/**
 * Rendered wherever a GSC/GA4 metric is null — the integration isn't
 * connected. Deliberately distinct from "0" and from "—" (no data).
 */
export function NotConnectedBadge({ source }: { source?: 'GSC' | 'GA4' }) {
  return (
    <span
      className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-400 whitespace-nowrap"
      title={source ? `${source === 'GSC' ? 'Google Search Console' : 'Google Analytics 4'} is not connected` : 'Integration not connected'}
    >
      Not connected
    </span>
  )
}
