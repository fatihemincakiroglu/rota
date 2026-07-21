// Ulke sinir tespiti: rota noktalarinin hangi ulkede oldugunu offline hesaplar.
// public/countries.min.json (sadelestirilmis dunya sinirlari) tembel yuklenir;
// nokta-poligon (ray casting) testi ile bir koordinatin ulkesini bulur.
// API / rate-limit yok — animasyon boyunca aninda calisir.

let DATA = null // yuklenen ulke poligonlari
let loading = null // ayni anda birden fazla yukleme olmasin

// Sinir verisini bir kez yukle (idempotent).
export async function loadBorders() {
  if (DATA) return DATA
  if (loading) return loading
  loading = fetch('/countries.min.json')
    .then((r) => (r.ok ? r.json() : null))
    .then((json) => { DATA = json || []; return DATA })
    .catch(() => { DATA = []; return DATA })
  return loading
}

// Ray-casting: nokta bir halkanin (ring) icinde mi?
function pointInRing(x, y, ring) {
  let inside = false
  const n = ring.length
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const xi = ring[i][0], yi = ring[i][1]
    const xj = ring[j][0], yj = ring[j][1]
    if ((yi > y) !== (yj > y)) {
      const xInt = ((xj - xi) * (y - yi)) / (yj - yi || 1e-12) + xi
      if (x < xInt) inside = !inside
    }
  }
  return inside
}

// poly = [disHalka, delik1, delik2, ...]
function pointInPolygon(x, y, poly) {
  if (!pointInRing(x, y, poly[0])) return false
  for (let h = 1; h < poly.length; h++) if (pointInRing(x, y, poly[h])) return false
  return true
}

// Bir koordinat (lng, lat) hangi ulkede? ISO2 kodu doner ya da null.
// Veri yuklu degilse null (cagiran taraf loadBorders'i beklemis olmali).
export function countryAt(lng, lat) {
  if (!DATA || !DATA.length) return null
  for (let i = 0; i < DATA.length; i++) {
    const c = DATA[i]
    const b = c.bbox
    if (lng < b[0] || lng > b[2] || lat < b[1] || lat > b[3]) continue
    if (c.type === 'Polygon') {
      if (pointInPolygon(lng, lat, c.coordinates)) return c.iso2
    } else {
      const mp = c.coordinates
      for (let p = 0; p < mp.length; p++) {
        if (pointInPolygon(lng, lat, mp[p])) return c.iso2
      }
    }
  }
  return null
}

// ISO2 -> ulkenin sinir geometrisi (GeoJSON Feature) ya da null.
// Harita uzerinde o ulkeyi vurgulamak icin kullanilir.
export function countryFeature(iso2) {
  if (!DATA || !iso2) return null
  const c = DATA.find((x) => x.iso2 === iso2)
  if (!c) return null
  return {
    type: 'Feature',
    properties: { iso2 },
    geometry: { type: c.type, coordinates: c.coordinates },
  }
}

// ISO2 -> bayrak emoji (regional indicator sembolleri)
export function flagEmoji(iso2) {
  if (!iso2 || iso2.length !== 2) return '🏳️'
  const A = 0x1f1e6
  const cc = iso2.toUpperCase()
  return String.fromCodePoint(A + (cc.charCodeAt(0) - 65), A + (cc.charCodeAt(1) - 65))
}

// ISO2 -> ulke adi (kullanicinin diline gore, tarayici yerlesigi).
// locale ornegi: 'tr-TR', 'en-US'. Desteklenmezse ISO2 doner.
export function countryName(iso2, locale) {
  if (!iso2) return ''
  try {
    const dn = new Intl.DisplayNames([locale || 'en'], { type: 'region' })
    return dn.of(iso2.toUpperCase()) || iso2
  } catch {
    return iso2
  }
}
