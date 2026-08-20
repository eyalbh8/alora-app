interface ErrorStateProps {
  message: string
  onRetry?: () => void
}

export function ErrorState({ message, onRetry }: ErrorStateProps) {
  return (
    <div className="flex flex-col items-start gap-3 rounded-lg border border-error/20 bg-error-surface px-6 py-8">
      <p className="eyebrow mb-0 text-error">Something went wrong</p>
      <p className="max-w-lg text-[15px] leading-[1.7] break-words text-error-link">{message}</p>
      {onRetry && (
        <button type="button" onClick={onRetry} className="button button--outline">
          <span>Retry</span>
          <span aria-hidden="true">→</span>
        </button>
      )}
    </div>
  )
}
