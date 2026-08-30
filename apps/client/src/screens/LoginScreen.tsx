import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Descope, useSession } from '@descope/react-sdk'
import { BrandMark } from '../components/Layout'
import { FullScreenLoader } from '../components/loading'

const DESCOPE_FLOW_ID = (import.meta.env.VITE_DESCOPE_FLOW_ID || 'sign-up-or-in').trim()

export function LoginScreen() {
  const navigate = useNavigate()
  const { isAuthenticated, isSessionLoading } = useSession()
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!isSessionLoading && isAuthenticated) {
      navigate('/', { replace: true })
    }
  }, [isAuthenticated, isSessionLoading, navigate])

  if (isSessionLoading) {
    return <FullScreenLoader />
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-bg px-6">
      <div className="w-full max-w-md rounded-xl border border-line bg-surface p-8 shadow-hover">
        <div className="mb-8">
          <div className="mb-6 flex items-center gap-2.5">
            <BrandMark />
            <span className="brand__name">Menchly</span>
          </div>
          <h1 className="screen-title">Sign in</h1>
        </div>
        {error ? (
          <p className="mb-4 text-[13px] text-error">{error}</p>
        ) : null}
        <Descope
          flowId={DESCOPE_FLOW_ID}
          redirectUrl={`${window.location.origin}/login`}
          onSuccess={() => navigate('/', { replace: true })}
          onError={(event) => {
            const detail = (event as { detail?: { errorMessage?: string; errorDescription?: string } })
              ?.detail
            setError(detail?.errorMessage || detail?.errorDescription || 'Sign-in failed')
          }}
        />
      </div>
    </div>
  )
}
