import { useEffect, useRef, useState } from 'react'
import { searchLocal, fold } from './cities.js'
import { t, LANG } from './i18n.js'

export default function SearchBox({
  label,
  value,
  placeholder,
  onPick,
  onClear,
  disabled,
  autoFocus,
}) {
  const [q, setQ] = useState('')
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)
  const timer = useRef(null)

  // Yerlesik listeden aninda sonuc + Nominatim'den ek sonuclar
  useEffect(() => {
    const query = q.trim()
    clearTimeout(timer.current)
    if (query.length < 2) {
      setResults([])
      setLoading(false)
      return
    }
    const local = searchLocal(query, 5)
    setResults(local)

    timer.current = setTimeout(async () => {
      setLoading(true)
      try {
        const url =
          `https://nominatim.openstreetmap.org/search?format=json&limit=5&accept-language=${LANG}&q=` +
          encodeURIComponent(query)
        const res = await fetch(url)
        const data = await res.json()
        const remote = data.map((d) => ({
          name: d.display_name.split(',')[0],
          full: d.display_name,
          lat: parseFloat(d.lat),
          lng: parseFloat(d.lon),
        }))
        // Yerel sonuclarla birlestir, ayni isimleri tekrarlama
        setResults((prev) => {
          const seen = new Set(prev.map((r) => fold(r.name)))
          const merged = [...prev]
          for (const r of remote) {
            if (!seen.has(fold(r.name))) {
              merged.push(r)
              seen.add(fold(r.name))
            }
          }
          return merged.slice(0, 6)
        })
      } catch {
        // Servis yanit vermezse yerel sonuclar zaten ekranda
      } finally {
        setLoading(false)
      }
    }, 400)
    return () => clearTimeout(timer.current)
  }, [q])

  function pick(r) {
    onPick(r)
    setQ('')
    setResults([])
  }

  return (
    <div className="field">
      <span className="field-label">{label}</span>
      {value ? (
        <div className="chip">
          <span className="chip-name">{value.name}</span>
          <button
            className="chip-clear"
            onClick={onClear}
            disabled={disabled}
            aria-label={t('removeSelection', label)}
          >
            ×
          </button>
        </div>
      ) : (
        <div className="search">
          <input
            value={q}
            autoFocus={autoFocus}
            disabled={disabled}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && results.length > 0) pick(results[0])
            }}
            placeholder={placeholder}
            aria-label={label}
          />
          {loading && <div className="search-hint">…</div>}
          {results.length > 0 && (
            <ul className="search-results">
              {results.map((r, i) => (
                <li key={i}>
                  <button onClick={() => pick(r)}>
                    <strong>{r.name}</strong>
                    <span>{r.full}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
