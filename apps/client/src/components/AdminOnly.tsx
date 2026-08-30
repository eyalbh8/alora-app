import { Navigate } from 'react-router-dom'
import { useIsAdmin, useCurrentUser } from '../hooks/useCurrentUser'
import { FullScreenLoader } from './loading'
import type { PropsWithChildren } from 'react'

/** Renders children only for Menchly admins; others redirect home. */
export function AdminOnly({ children }: PropsWithChildren) {
  const { isLoading, isError } = useCurrentUser()
  const isAdmin = useIsAdmin()

  if (isLoading) return <FullScreenLoader />
  if (isError || !isAdmin) return <Navigate to="/" replace />
  return <>{children}</>
}
