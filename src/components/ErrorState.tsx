interface ErrorStateProps {
  message: string
  onRetry?: () => void
}

export function ErrorState({ message, onRetry }: ErrorStateProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-red-100 bg-red-50/50 px-6 py-10 text-center">
      <p className="text-sm font-medium text-red-700">Something went wrong</p>
      <p className="max-w-lg text-xs break-words text-red-500">{message}</p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="rounded-lg border border-red-200 bg-white px-4 py-1.5 text-sm font-medium text-red-700 shadow-sm transition hover:bg-red-50"
        >
          Retry
        </button>
      )}
    </div>
  )
}
