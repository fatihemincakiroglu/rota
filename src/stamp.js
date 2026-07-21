// Pasaport damgasi: her varista ekrana dusen dairesel/dikdortgen damga.
// Gercek damga gorselleri yerine, ulke adindan programatik SVG uretilir —
// her ulke icin calisir, gorsel varligi gerektirmez.

// Durak "full" alanindan ( or. "Paris, Fransa" / "Paris, France") ulke adini al.
export function countryOf(stop) {
  if (!stop) return ''
  const src = stop.full || stop.name || ''
  const parts = src.split(',').map((s) => s.trim()).filter(Boolean)
  return parts.length ? parts[parts.length - 1] : ''
}

// Basit deterministik hash → renk (ayni ulke hep ayni damga rengi)
function hashHue(str) {
  let h = 0
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) | 0
  return ((h % 360) + 360) % 360
}

// Damga icin uc murekkep tonu (seyahat pasaportu estetigi)
const INKS = [
  { name: 'mavi', h: 210 },
  { name: 'kirmizi', h: 355 },
  { name: 'yesil', h: 150 },
  { name: 'mor', h: 275 },
]

// Bir varis icin damga verisi uret (renk + sekil + kucuk rastgelelik)
export function stampFor(stop) {
  const country = countryOf(stop) || stop?.name || '—'
  const city = (stop?.name || '').toLocaleUpperCase()
  const hue = hashHue(country)
  const ink = INKS[Math.abs(hue) % INKS.length]
  const rotate = ((hashHue(city + country) % 24) - 12) // -12°..+12°
  const shape = hashHue(country) % 2 === 0 ? 'circle' : 'rect'
  const date = new Date()
  const dd = String(date.getDate()).padStart(2, '0')
  const mon = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'][date.getMonth()]
  const yy = date.getFullYear()
  return { country: country.toLocaleUpperCase(), city, ink, rotate, shape, dateStr: `${dd} ${mon} ${yy}` }
}

// Damgayi SVG string olarak uret (DOM'a ya da canvas'a cizilebilir)
export function stampSvg(s, size = 180) {
  const col = `hsl(${s.ink.h} 70% 42%)`
  const colFaint = `hsl(${s.ink.h} 55% 42% / 0.5)`
  const cx = size / 2
  const cy = size / 2
  const label = s.city.length > 12 ? s.city.slice(0, 11) + '…' : s.city

  if (s.shape === 'circle') {
    const r = size * 0.44
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}">
      <g fill="none" stroke="${col}" stroke-width="${size*0.018}" opacity="0.92">
        <circle cx="${cx}" cy="${cy}" r="${r}"/>
        <circle cx="${cx}" cy="${cy}" r="${r*0.82}" stroke="${colFaint}" stroke-width="${size*0.01}"/>
      </g>
      <g fill="${col}" text-anchor="middle" font-family="'IBM Plex Mono', monospace" font-weight="700">
        <text x="${cx}" y="${cy - size*0.06}" font-size="${size*0.115}">${escapeXml(label)}</text>
        <text x="${cx}" y="${cy + size*0.03}" font-size="${size*0.075}" opacity="0.85">${escapeXml(s.country)}</text>
        <text x="${cx}" y="${cy + size*0.17}" font-size="${size*0.07}" letter-spacing="1">${s.dateStr}</text>
      </g>
      <g stroke="${col}" stroke-width="${size*0.012}" opacity="0.8">
        <path d="M${cx - r*0.5} ${cy + size*0.22} l${r*0.28} 0 m${r*0.12} 0 l${r*0.6} 0"/>
      </g>
    </svg>`
  }
  // dikdortgen damga
  const w = size * 0.9, h = size * 0.62
  const x = (size - w) / 2, y = (size - h) / 2
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}">
    <g fill="none" stroke="${col}" stroke-width="${size*0.018}" opacity="0.92">
      <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${size*0.03}"/>
      <rect x="${x+size*0.03}" y="${y+size*0.03}" width="${w-size*0.06}" height="${h-size*0.06}" rx="${size*0.02}" stroke="${colFaint}" stroke-width="${size*0.01}"/>
    </g>
    <g fill="${col}" text-anchor="middle" font-family="'IBM Plex Mono', monospace" font-weight="700">
      <text x="${cx}" y="${cy - size*0.07}" font-size="${size*0.12}">${escapeXml(label)}</text>
      <text x="${cx}" y="${cy + size*0.02}" font-size="${size*0.075}" opacity="0.85">${escapeXml(s.country)}</text>
      <text x="${cx}" y="${cy + size*0.15}" font-size="${size*0.07}" letter-spacing="1">${s.dateStr}</text>
    </g>
  </svg>`
}

function escapeXml(str) {
  return String(str).replace(/[<>&'"]/g, (c) =>
    ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' }[c])
  )
}
