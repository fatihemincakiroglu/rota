// Rota geometrisi: duraklar arasinda kavisli/duz yol noktalari uretir.
import { t } from './i18n.js'

const R = 6371 // km

export function distanceKm(a, b) {
  const toRad = (d) => (d * Math.PI) / 180
  const dLat = toRad(b.lat - a.lat)
  const dLng = toRad(b.lng - a.lng)
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(s))
}

export function bearingDeg(a, b) {
  // Mercator konform bir projeksiyondur: ekrandaki aci = gercek kerteriz.
  // Dogru formul atan2(dLng * cos(lat), dLat); cos(lat) carpani olmadan
  // yuksek enlemlerde arac ikonu rotadan sapiyordu (60°'de ~18° hata).
  const toRad = (d) => (d * Math.PI) / 180
  let dLng = b.lng - a.lng
  // Antimeridyen: kisa yaydan git
  if (dLng > 180) dLng -= 360
  else if (dLng < -180) dLng += 360
  const midLat = toRad((a.lat + b.lat) / 2)
  const dx = dLng * Math.cos(midLat)
  const dy = b.lat - a.lat
  return (Math.atan2(dx, dy) * 180) / Math.PI
}

// Bir bacak (leg) icin nokta dizisi — GERCEK BUYUK DAIRE (great-circle).
// Kure uzerindeki iki nokta arasindaki en kisa yol; Mercator haritada dogal
// olarak kavisli gorunur ve kutuplara yakin rotalarda dogru davranir.
// Tum araclar ayni geometriyi kullanir: great-circle zaten dogru yolu verir.
function legPoints(a, b) {
  const toRad = (d) => (d * Math.PI) / 180
  const toDeg = (r) => (r * 180) / Math.PI

  const lat1 = toRad(a.lat), lon1 = toRad(a.lng)
  const lat2 = toRad(b.lat), lon2 = toRad(b.lng)

  // İki nokta arasindaki aci mesafesi (radyan) — haversine
  const dLat = lat2 - lat1
  const dLon = lon2 - lon1
  const hav =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2
  const delta = 2 * Math.asin(Math.min(1, Math.sqrt(hav))) // 0..π

  const dist = distanceKm(a, b)
  const n = Math.max(48, Math.min(512, Math.round(dist / 6)))
  const pts = []

  // Cok kisa mesafe (delta~0): dogrudan lineer, slerp payda sifira gitmesin
  if (delta < 1e-6) {
    for (let i = 0; i <= n; i++) {
      const t = i / n
      pts.push({ lng: a.lng + (b.lng - a.lng) * t, lat: a.lat + (b.lat - a.lat) * t })
    }
    return unwrapAntimeridian(pts)
  }

  const sinDelta = Math.sin(delta)
  for (let i = 0; i <= n; i++) {
    const t = i / n
    // Kuresel lineer interpolasyon (slerp) — kartezyen uzayda
    const A = Math.sin((1 - t) * delta) / sinDelta
    const B = Math.sin(t * delta) / sinDelta
    const x = A * Math.cos(lat1) * Math.cos(lon1) + B * Math.cos(lat2) * Math.cos(lon2)
    const y = A * Math.cos(lat1) * Math.sin(lon1) + B * Math.cos(lat2) * Math.sin(lon2)
    const z = A * Math.sin(lat1) + B * Math.sin(lat2)
    const lat = Math.atan2(z, Math.hypot(x, y))
    const lon = Math.atan2(y, x)
    pts.push({ lat: toDeg(lat), lng: toDeg(lon) })
  }
  return unwrapAntimeridian(pts)
}

// Antimeridyen (180°/-180°) gecisinde boylamin -180<->+180 arasi ziplamasi
// haritada rotayi tum dunya boyunca yatay bir cizgiye cevirir. Ardisik
// noktalar arasi fark 180°'yi asarsa boylami surekli hale getir (unwrap).
function unwrapAntimeridian(pts) {
  for (let i = 1; i < pts.length; i++) {
    let d = pts[i].lng - pts[i - 1].lng
    if (d > 180) pts[i].lng -= 360
    else if (d < -180) pts[i].lng += 360
  }
  return pts
}

// Kullanicinin surukledigi C noktasindan (t=0.5'te tam ustunden) gecen
// kuadratik Bezier yolu — rota bukme tutamaclari icin.
// Kontrol noktasi, egrinin ortasi C'ye denk gelecek sekilde turetilir.
export function bendPath(a, c, b) {
  const ctrl = {
    lat: 2 * c.lat - (a.lat + b.lat) / 2,
    lng: 2 * c.lng - (a.lng + b.lng) / 2,
  }
  const dist = distanceKm(a, c) + distanceKm(c, b)
  const n = Math.max(64, Math.min(512, Math.round(dist / 6)))
  const pts = []
  for (let i = 0; i <= n; i++) {
    const t = i / n
    const u = 1 - t
    pts.push({
      lat: u * u * a.lat + 2 * u * t * ctrl.lat + t * t * b.lat,
      lng: u * u * a.lng + 2 * u * t * ctrl.lng + t * t * b.lng,
    })
  }
  // ONEMLI: yon (bearing) eklenmeli — animasyon her karede p.bearing okur;
  // eksikse rotasyon NaN'a duser ve arac ikonu ters/sapmis gorunur.
  return withBearings(unwrapAntimeridian(pts))
}

// Tum rota: her nokta {lng, lat, bearing, legIndex}
export function buildPath(stops) {
  const path = []
  for (let i = 0; i < stops.length - 1; i++) {
    const pts = legPoints(stops[i], stops[i + 1])
    for (let j = 0; j < pts.length; j++) {
      const next = pts[Math.min(j + 1, pts.length - 1)]
      path.push({
        ...pts[j],
        bearing: bearingDeg(pts[j], next),
        legIndex: i,
      })
    }
  }
  return path
}

// Bacak uzunluguna gore takip zoom'u
export function zoomForLeg(a, b) {
  const d = distanceKm(a, b)
  if (d > 4000) return 3
  if (d > 1500) return 4
  if (d > 600) return 5
  if (d > 250) return 6.5
  if (d > 80) return 8
  return 10
}

// Araclarin ortalama seyir hizlari (km/s) — tahmini sure hesabi icin
export const VEHICLE_SPEED = {
  plane: 800,
  car: 90,
  train: 160,
  ship: 40,
  bike: 18,
  balloon: 30,
}

// Bir bacak icin tahmini sureyi insan-okunur metne cevirir
export function etaText(km, vehicleId) {
  const speed = VEHICLE_SPEED[vehicleId] || 90
  const hours = km / speed
  if (hours < 1) {
    const mins = Math.max(1, Math.round(hours * 60))
    return `${mins} ${t('minsShort')}`
  }
  if (hours < 24) {
    const h = Math.floor(hours)
    const m = Math.round((hours - h) * 60)
    return m ? `${h} ${t('hoursShort')} ${m} ${t('minsShort')}` : `${h} ${t('hoursShort')}`
  }
  const days = Math.floor(hours / 24)
  const h = Math.round(hours % 24)
  return h ? `${days} ${t('daysShort')} ${h} ${t('hoursShort')}` : `${days} ${t('daysShort')}`
}

// Boylamdan kaba UTC ofseti tahmini (her 15° = 1 saat).
// Gercek saat dilimi sinirlerini bilmedigimiz icin yaklasik degerdir.
export function utcOffsetApprox(lng) {
  return Math.round(lng / 15)
}

export function offsetLabel(lng) {
  const o = utcOffsetApprox(lng)
  const sign = o >= 0 ? '+' : '−'
  return `UTC${sign}${Math.abs(o)}`
}

// İki durak arasindaki saat farki (varis - kalkis), isaretli
export function hourDiff(from, to) {
  return utcOffsetApprox(to.lng) - utcOffsetApprox(from.lng)
}

// --- Gercek yol rotasi (OSRM) -------------------------------------------
// Kara araclari icin kus ucusu yerine gercek karayolu geometrisi.
// Ucretsiz demo sunucusu yalnizca "driving" profilini guvenilir sunar;
// bisiklet/tren de ayni kara agini kullanir. Ucak/balon/gemi rota istemez.

// Hangi araclar yol rotasi kullansin?
export function usesRoads(vehicleId) {
  return vehicleId === 'car' || vehicleId === 'bike' || vehicleId === 'train'
}

// OSRM'den bir bacagin yol geometrisini ceker. Basarisiz olursa null doner.
export async function fetchRoadLeg(a, b, via = null) {
  // Bukme noktasi varsa: A→via ve via→B ayri cekilir, birlestirilir.
  if (via) {
    const [p1, p2] = await Promise.all([fetchRoadLeg(a, via), fetchRoadLeg(via, b)])
    if (!p1 || !p2) return null
    return p1.concat(p2.slice(1)) // ortak nokta bir kez
  }
  const url =
    `https://router.project-osrm.org/route/v1/driving/` +
    `${a.lng},${a.lat};${b.lng},${b.lat}` +
    `?overview=full&geometries=geojson`
  try {
    const res = await fetch(url)
    if (!res.ok) return null
    const data = await res.json()
    const coords = data?.routes?.[0]?.geometry?.coordinates
    if (!coords || coords.length < 2) return null
    // [lng,lat] -> {lng,lat,bearing,legIndex}
    const pts = coords.map(([lng, lat]) => ({ lng, lat }))
    return withBearings(pts)
  } catch {
    return null
  }
}

// Nokta dizisine yon (bearing) bilgisi ekler
function withBearings(pts) {
  return pts.map((p, j) => {
    const next = pts[Math.min(j + 1, pts.length - 1)]
    return { ...p, bearing: bearingDeg(p, next) }
  })
}
