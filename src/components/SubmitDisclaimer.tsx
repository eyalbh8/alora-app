/** Banner shown on the review/submit flow — edits are queued, not live. */
export function SubmitDisclaimer({ className = '' }: { className?: string }) {
  return (
    <div
      className={`rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950 ${className}`}
      role="note"
    >
      <p className="font-semibold">Queued for review — not a live write</p>
      <p className="mt-1 text-amber-900/80">
        Changes are queued for review via your configured AirOps Playbook webhook. They will not go
        live until reviewed and published in AirOps. The public Brand Kit REST API is read-only;
        there is no direct PATCH/POST write endpoint today.
      </p>
    </div>
  )
}
