import { useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { fetchPocket } from '@/common/api/works'
import { useAuth } from '@/common/hooks/useAuth'
import { ecrirePoche } from '@/common/lib/poche'
import { queryKeys } from '@/common/lib/queryKeys'

/**
 * Keeps the pocket copy fresh while the app is online: read at each opening and
 * after each add or wish (its key sits under 'works'), written on the device.
 * A visitor has no collection, so no copy.
 */
export function useGarderLaPoche() {
  const { compte, estInvite } = useAuth()
  const poche = useQuery({
    queryKey: queryKeys.works.pocket,
    queryFn: fetchPocket,
    enabled: !!compte && !estInvite,
    staleTime: 5 * 60_000,
  })
  useEffect(() => {
    if (poche.data) ecrirePoche(poche.data)
  }, [poche.data])
}
