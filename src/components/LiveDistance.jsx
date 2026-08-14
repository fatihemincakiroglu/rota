/* eslint-disable react-hooks/refs --
   Bu bilesen bilerek render sirasinda posRef'i okur. Animasyon degerini
   state'e tasimak butun App agacini saniyede ~12 kez yeniden cizdirirdi;
   burada asagidaki rAF dongusu SADECE bu bileseni tazeliyor ve guncel
   degeri ref'ten aliyor. Kural bu dosya icin bilincli olarak kapali. */
import { useEffect, useRef, useState } from 'react'
import { fmtNum } from '../i18n.js'

// Canli mesafe gostergesi — kendi requestAnimationFrame dongusuyle posRef'ten
// okur ve YALNIZCA kendini render eder. Boylece animasyon boyunca butun App
// agaci yeniden render olmaz (onceki setTraveledHz her karede App'i cizerdi).
export default function LiveDistance({ posRef, totalKm, playing }) {
  const [, force] = useState(0)
  const rafRef = useRef(null)
  const lastRef = useRef(0)

  useEffect(() => {
    if (!playing) return
    const tick = (now) => {
      // ~12fps: goze yeter, React yukunu dusuk tutar
      if (now - lastRef.current > 80) {
        lastRef.current = now
        force((n) => (n + 1) & 0xffff)
      }
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafRef.current)
  }, [playing])

  const traveled = posRef.current?.traveledKm || 0
  const remaining = Math.max(0, totalKm - traveled)
  return (
    <strong>
      {fmtNum(traveled)}
      <em> / {fmtNum(remaining)} KM</em>
    </strong>
  )
}
