// Kara araclari icin OSRM yol geometrisinin onbellegi ve on-yuklemesi.
import { useCallback, useEffect, useRef, useState } from 'react'
import { fetchRoadLeg, usesRoads } from '../geo.js'

// Basarisiz bir bacak icin yeniden deneme araligi (ms). Olumsuz sonucu
// hatirlamazsak servis kapaliyken her state degisiminde ayni istekler
// tekrar tekrar atiliyor.
const RETRY_MS = 60_000

// Onbellek anahtari — bukme noktasi da rotayi degistirdigi icin anahtara girer
export const roadKey = (a, b, via) =>
  `${a.lat.toFixed(3)},${a.lng.toFixed(3)}>${b.lat.toFixed(3)},${b.lng.toFixed(3)}` +
  (via ? `|${via.lat.toFixed(3)},${via.lng.toFixed(3)}` : '')

/**
 * @param stops    duraklar
 * @param legVeh   (i) => arac tanimi
 * @param shapePts bacak index -> kullanicinin surukledigi bukme noktasi
 *
 * Doner:
 *  cacheRef   — anahtar -> nokta dizisi (legPointsFor bunu okur)
 *  version    — yeni geometri geldiginde artar (onizlemeyi tazelemek icin)
 *  needsFetch — (anahtar) => OSRM'e gitmeli miyiz?
 *  ensureLegs — eksik bacaklari cek; yeni veri geldiyse true doner
 */
export function useRoadLegs(stops, legVeh, shapePts) {
  const cacheRef = useRef({}) // "lat,lng>lat,lng" -> [{lng,lat,bearing}]
  const failRef = useRef({}) // anahtar -> son basarisiz deneme zamani
  const [version, setVersion] = useState(0)

  const needsFetch = useCallback((k) => {
    if (cacheRef.current[k]) return false
    const failedAt = failRef.current[k]
    return !failedAt || Date.now() - failedAt > RETRY_MS
  }, [])

  const ensureLegs = useCallback(async () => {
    let fetched = false
    for (let i = 0; i < stops.length - 1; i++) {
      if (!usesRoads(legVeh(i).id)) continue
      const sp = shapePts[i] || null
      const k = roadKey(stops[i], stops[i + 1], sp)
      if (!needsFetch(k)) continue
      const pts = await fetchRoadLeg(stops[i], stops[i + 1], sp)
      if (pts) {
        cacheRef.current[k] = pts
        delete failRef.current[k]
        fetched = true
      } else {
        failRef.current[k] = Date.now()
      }
    }
    return fetched
  }, [stops, legVeh, shapePts, needsFetch])

  // Arka planda on-yukleme: kullanici oynata basmadan once yol hazir olsun
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      for (let i = 0; i < stops.length - 1; i++) {
        if (!usesRoads(legVeh(i).id)) continue
        const sp = shapePts[i] || null
        const k = roadKey(stops[i], stops[i + 1], sp)
        if (!needsFetch(k)) continue
        const pts = await fetchRoadLeg(stops[i], stops[i + 1], sp)
        if (cancelled) return
        if (pts) {
          cacheRef.current[k] = pts
          delete failRef.current[k]
          setVersion((n) => n + 1) // onizlemeyi tazele
        } else {
          failRef.current[k] = Date.now()
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [stops, legVeh, shapePts, needsFetch])

  return { cacheRef, version, needsFetch, ensureLegs }
}
