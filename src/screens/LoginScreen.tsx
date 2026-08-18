import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Descope, useSession } from '@descope/react-sdk'

const DESCOPE_FLOW_ID = (import.meta.env.VITE_DESCOPE_FLOW_ID || 'sign-up-or-in').trim()

export function LoginScreen() {
  const navigate = useNavigate()
  const { isAuthenticated } = useSession()

  useEffect(() => {
    if (isAuthenticated) {
      navigate('/', { replace: true })
    }
  }, [isAuthenticated, navigate])

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#faf9f7]">
      <div className="w-full max-w-md rounded-lg bg-white p-8 shadow-sm">
        <div className="mb-8 text-center">
          <h1 className="font-serif text-[32px] font-semibold leading-none tracking-[-0.01em] text-brand-950">
            Alora
          </h1>
          <p className="mt-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-brand-600">
            AI Favorite
          </p>
        </div>
        <Descope flowId={DESCOPE_FLOW_ID} />
      </div>
    </div>
  )
}
