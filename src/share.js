// Rota durumunu paylasilabilir baglantiya kodlar/cozer ve
// tarayicida (localStorage) birden cok rota profili saklar.

// --- URL kodlama ---------------------------------------------------------
// Kompakt bir yapi: { v, stops:[{n,a,o}], legs:[vehicleId], theme, loop, speed }
// n=name, a=lat, o=lng — kisa tutmak icin.

function toCompact(state) {
  return {
    v: 1,
    s: state.stops.map((s) => ({
      n: s.name,
      f: s.full || s.name,
      a: +s.lat.toFixed(4),
      o: +s.lng.toFixed(4),
    })),
    l: state.legVehicles || [],
    t: state.theme || 'dark',
    p: state.loop ? 1 : 0,
    sp: state.speed || 1,
  }
}

function fromCompact(c) {
  if (!c || !Array.isArray(c.s)) return null
  return {
    stops: c.s.map((x) => ({ name: x.n, full: x.f || x.n, lat: x.a, lng: x.o })),
    legVehicles: Array.isArray(c.l) ? c.l : [],
    theme: c.t || 'dark',
    loop: !!c.p,
    speed: c.sp || 1,
  }
}

// Unicode guvenli base64 (Turkce karakterler icin)
function b64encode(str) {
  return btoa(unescape(encodeURIComponent(str)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}
function b64decode(str) {
  const s = str.replace(/-/g, '+').replace(/_/g, '/')
  return decodeURIComponent(escape(atob(s)))
}

export function encodeRoute(state) {
  try {
    return b64encode(JSON.stringify(toCompact(state)))
  } catch {
    return ''
  }
}

export function decodeRoute(token) {
  try {
    return fromCompact(JSON.parse(b64decode(token)))
  } catch {
    return null
  }
}

// Mevcut rotanin tam paylasim baglantisini uretir
export function shareUrl(state) {
  const token = encodeRoute(state)
  const base = window.location.origin + window.location.pathname
  return `${base}#r=${token}`
}

// Sayfa acilisinda URL'deki rotayi okur (varsa)
export function readRouteFromUrl() {
  const hash = window.location.hash || ''
  const m = hash.match(/[#&]r=([^&]+)/)
  if (!m) return null
  return decodeRoute(m[1])
}

// --- Kayitli profiller (localStorage) -----------------------------------
const KEY = 'rota:saved'

export function loadSaved() {
  try {
    return JSON.parse(localStorage.getItem(KEY) || '[]')
  } catch {
    return []
  }
}

export function saveRoute(name, state) {
  const list = loadSaved()
  const entry = {
    id: Date.now().toString(36),
    name: name || 'Adsız rota',
    at: Date.now(),
    data: toCompact(state),
  }
  list.unshift(entry)
  try {
    localStorage.setItem(KEY, JSON.stringify(list.slice(0, 30)))
  } catch {
    // kota dolu vb. — sessizce gec
  }
  return entry
}

export function deleteSaved(id) {
  const list = loadSaved().filter((e) => e.id !== id)
  localStorage.setItem(KEY, JSON.stringify(list))
  return list
}

export function hydrateSaved(entry) {
  return fromCompact(entry.data)
}
