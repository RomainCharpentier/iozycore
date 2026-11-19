import { useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { fetchPocket } from '@/common/api/works'
import { useAuth } from '@/common/hooks/useAuth'
import { writePocketCopy } from '@/common/lib/pocketCopy'
import { queryKeys } from '@/common/lib/queryKeys'

/**
 * Keeps the pocket copy fresh while the app is online: read at each opening and
 * when the app comes back to the front after five minutes, written on the device.
 * A visitor has no collection, so no copy.
 */
export function useKeepPocketCopy() {
  const { compte, estInvite } = useAuth()
  const copy = useQuery({
    queryKey: queryKeys.works.pocket,
    queryFn: fetchPocket,
    enabled: !!compte && !estInvite,
    staleTime: 5 * 60_000,
  })
  useEffect(() => {
    if (copy.data) writePocketCopy(copy.data)
  }, [copy.data])
}
