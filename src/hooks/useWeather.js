// Duraklarin anlik hava durumu (Open-Meteo, anahtarsiz).
import { useEffect, useRef, useState } from 'react'

// Bir durak icin onbellek anahtari — saf, durum tasimaz
export const stopKey = (s) => `${s.lat.toFixed(2)},${s.lng.toFixed(2)}`

// Bir okumanin taze sayildigi sure ve bayatlari tarama araligi
const TTL_MS = 15 * 60_000
const POLL_MS = 5 * 60_000

// Hava durumu kodu -> emoji (saf)
export const weatherEmoji = (code) => {
  if (code == null) return '·'
  if (code === 0) return '☀️'
  if (code <= 2) return '🌤️'
  if (code === 3) return '☁️'
  if (code <= 48) return '🌫️'
  if (code <= 67) return '🌧️'
  if (code <= 77) return '🌨️'
  if (code <= 82) return '🌦️'
  if (code <= 99) return '⛈️'
  return '·'
}

/**
 * stops icin hava durumu okumalarini getirir ve TTL dolunca tazeler.
 * Doner: { [stopKey]: { t, code } | 'loading' | null }
 */
export function useWeather(stops) {
  const [weather, setWeather] = useState({})
  // Son istek zamani ref'te tutulur: efekt icindeki `weather` degeri bayat
  // olabilecegi icin ayni durak icin cift istek atilmasini onler.
  const reqRef = useRef(new Map()) // durak anahtari -> son istek zamani
  const [tick, setTick] = useState(0)

  // TTL dolan duraklari periyodik olarak yeniden sorgula
  useEffect(() => {
    const id = setInterval(() => setTick((n) => n + 1), POLL_MS)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    stops.forEach((s) => {
      const k = stopKey(s)
      const lastAt = reqRef.current.get(k)
      if (lastAt && Date.now() - lastAt < TTL_MS) return
      reqRef.current.set(k, Date.now())
      // Tazelemede eski okumayi ekranda birak; rozet 'loading'e donup titremesin
      setWeather((w) => ({ ...w, [k]: w[k] ?? 'loading' }))
      fetch(
        `https://api.open-meteo.com/v1/forecast?latitude=${s.lat}&longitude=${s.lng}&current=temperature_2m,weather_code`
      )
        .then((r) => r.json())
        .then((d) => {
          const c = d.current
          setWeather((w) => ({
            ...w,
            [k]: c ? { t: Math.round(c.temperature_2m), code: c.weather_code } : null,
          }))
        })
        .catch(() => {
          reqRef.current.delete(k) // ag hatasi: hemen tekrar denenebilsin
          setWeather((w) => ({ ...w, [k]: w[k] === 'loading' ? null : w[k] ?? null }))
        })
    })
  }, [stops, tick])

  return weather
}
