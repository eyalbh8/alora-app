import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { getBrandKit, submitBrandKitChanges } from '../api/airops'
import type { BrandKit, BrandKitDiff } from '../api/types'
import { computeBrandKitDiff, hasLocalEdits } from '../lib/diff'
import { deepClone } from '../lib/normalize'

interface BrandKitEditContextValue {
  original: BrandKit | null
  draft: BrandKit | null
  loading: boolean
  error: string | null
  isDirty: boolean
  retry: () => void
  setDraft: (updater: BrandKit | ((prev: BrandKit) => BrandKit)) => void
  discardChanges: () => void
  getDiff: () => BrandKitDiff | null
  submit: () => Promise<void>
  submitting: boolean
  submitError: string | null
  submitSuccess: string | null
  clearSubmitFeedback: () => void
}

const BrandKitEditContext = createContext<BrandKitEditContextValue | null>(null)

export function BrandKitEditProvider({ children }: { children: ReactNode }) {
  const [original, setOriginal] = useState<BrandKit | null>(null)
  const [draft, setDraftState] = useState<BrandKit | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [fetchKey, setFetchKey] = useState(0)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [submitSuccess, setSubmitSuccess] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const kit = await getBrandKit()
      setOriginal(deepClone(kit))
      setDraftState(deepClone(kit))
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load, fetchKey])

  useEffect(() => {
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      if (hasLocalEdits(original, draft)) {
        event.preventDefault()
        event.returnValue = ''
      }
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [original, draft])

  const setDraft = useCallback((updater: BrandKit | ((prev: BrandKit) => BrandKit)) => {
    setDraftState((prev) => {
      if (!prev) return prev
      return typeof updater === 'function' ? updater(prev) : updater
    })
    setSubmitSuccess(null)
  }, [])

  const discardChanges = useCallback(() => {
    if (!original) return
    if (!window.confirm('Discard all unsaved local edits?')) return
    setDraftState(deepClone(original))
    setSubmitError(null)
    setSubmitSuccess(null)
  }, [original])

  const getDiff = useCallback((): BrandKitDiff | null => {
    if (!original || !draft) return null
    return computeBrandKitDiff(original, draft)
  }, [original, draft])

  const submit = useCallback(async () => {
    const diff = getDiff()
    if (!diff || diff.changes.length === 0) return
    setSubmitting(true)
    setSubmitError(null)
    setSubmitSuccess(null)
    try {
      await submitBrandKitChanges(diff)
      setSubmitSuccess(
        'Sent for review — check AirOps to publish once processed.',
      )
      // Treat submitted snapshot as the new baseline so the dirty flag clears.
      setOriginal(deepClone(diff.current))
      setDraftState(deepClone(diff.current))
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : String(err))
    } finally {
      setSubmitting(false)
    }
  }, [getDiff])

  const value = useMemo<BrandKitEditContextValue>(
    () => ({
      original,
      draft,
      loading,
      error,
      isDirty: hasLocalEdits(original, draft),
      retry: () => setFetchKey((k) => k + 1),
      setDraft,
      discardChanges,
      getDiff,
      submit,
      submitting,
      submitError,
      submitSuccess,
      clearSubmitFeedback: () => {
        setSubmitError(null)
        setSubmitSuccess(null)
      },
    }),
    [
      original,
      draft,
      loading,
      error,
      setDraft,
      discardChanges,
      getDiff,
      submit,
      submitting,
      submitError,
      submitSuccess,
    ],
  )

  return (
    <BrandKitEditContext.Provider value={value}>{children}</BrandKitEditContext.Provider>
  )
}

export function useBrandKitEdit(): BrandKitEditContextValue {
  const ctx = useContext(BrandKitEditContext)
  if (!ctx) throw new Error('useBrandKitEdit must be used within BrandKitEditProvider')
  return ctx
}
