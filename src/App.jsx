import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import SearchBox from './SearchBox.jsx'
import {
  buildPath,
  zoomForLeg,
  distanceKm,
  etaText,
  offsetLabel,
  hourDiff,
  usesRoads,
  fetchRoadLeg,
} from './geo.js'
import { FORMATS } from './formats.js'
import {
  shareUrl,
  readRouteFromUrl,
  loadSaved,
  saveRoute,
  deleteSaved,
  hydrateSaved,
} from './share.js'
import { t, fmtNum, LANGS, LANG } from './i18n.js'
import { LOGO_URL, getLogoImage } from './logo.js'
import { stampFor, stampSvg } from './stamp.js'
import { nightPolygon, clockForProgress } from './daynight.js'
import { loadBorders, countryAt, flagEmoji, countryName } from './borders.js'

// Aktif dilin locale'i (Intl.DisplayNames icin) — ulke adlari bu dile gore
const LOCALE = (LANGS.find((l) => l.code === LANG) || {}).locale || 'en'

// Harita temalari (hepsi ucretsiz, anahtar gerektirmez)
const THEMES = {
  voyager: {
    id: 'voyager',
    label: t('themeVoyager'),
    style: 'https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json',
  },
  light: {
    id: 'light',
    label: t('themeLight'),
    style: 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json',
  },
  dark: {
    id: 'dark',
    label: t('themeDark'),
    style: 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json',
  },
}

const VEHICLES = [
  // faces: emojinin dogal olarak baktigi aci (ekran, kuzey=0 saat yonu)
  // flip: yatay tasit mi? (sag yariya bakarken bas asagi olmasin diye dikey flip)
  { id: 'plane', emoji: '✈️', label: t('vehPlane'), arc: true, rotate: true, faces: 45, flip: false },
  { id: 'car', emoji: '🚗', label: t('vehCar'), arc: false, rotate: true, faces: -90, flip: true },
  { id: 'train', emoji: '🚄', label: t('vehTrain'), arc: false, rotate: true, faces: -90, flip: true },
  { id: 'ship', emoji: '🚢', label: t('vehShip'), arc: false, rotate: true, faces: -90, flip: true },
  { id: 'bike', emoji: '🚲', label: t('vehBike'), arc: false, rotate: true, faces: -90, flip: true },
  { id: 'balloon', emoji: '🎈', label: t('vehBalloon'), arc: true, rotate: false, faces: 0, flip: false },
]
const vById = (id) => VEHICLES.find((v) => v.id === id) || VEHICLES[0]

// Hiz kademeleri: sure carpani (kucuk = hizli)
const SPEEDS = [
  { id: 0.5, label: t('speedSlow') },
  { id: 1, label: t('speedNormal') },
  { id: 2, label: t('speedFast') },
]

const DWELL = 750 // duraklarda bekleme (ms)

// Sinematik kamera: hafif 3B egim. Seyir aninda daha egik, durakta biraz duzelir.
const PITCH_CRUISE = 55 // seyir egimi (derece) — yol/manzara perspektifi
const PITCH_CITY = 45   // durak yaklasiminda biraz daha duz

const easeInOutCubic = (t) =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2

// Durak/yol onbellek anahtarlari — saf, durum tasimaz. Modul seviyesinde
// tanimli olduklari icin her render'da yeniden yaratilmazlar.
const key = (s) => `${s.lat.toFixed(2)},${s.lng.toFixed(2)}`
const roadKey = (a, b) =>
  `${a.lat.toFixed(3)},${a.lng.toFixed(3)}>${b.lat.toFixed(3)},${b.lng.toFixed(3)}`

// Hava durumu kodu -> emoji (saf)
const weatherEmoji = (code) => {
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

// Bir tasit emojisini gittigi yone dogru cevirecek CSS transform'u uretir.
// bearing: yumusatilmis ham yon (kuzey=0, saat yonu, derece)
// v: arac tanimi (faces = emojinin dogal acisi, flip = yatay tasit mi)
// Yatay tasitlarda (araba/tren/gemi/bisiklet) sag yariya bakarken emoji bas
// asagi donmesin diye dikey flip uygulanir.
function vehicleTransform(bearing, v) {
  if (!v.rotate) return 'rotate(0deg)'
  let angle = bearing - v.faces
  if (v.flip) {
    // Ekran yonu saga dogru mu? (0..180 arasi rota = dogu bileseni pozitif)
    const dir = ((bearing % 360) + 360) % 360
    const goingRight = dir > 0 && dir < 180
    if (goingRight) {
      // Dikey flip + aciyi flip'e gore duzelt
      return `scaleY(-1) rotate(${-(angle)}deg)`
    }
  }
  return `rotate(${angle}deg)`
}

// Canli mesafe gostergesi — kendi requestAnimationFrame dongusuyle posRef'ten
// okur ve YALNIZCA kendini render eder. Boylece animasyon boyunca butun App
// agaci yeniden render olmaz (onceki setTraveledHz her karede App'i cizerdi).
function LiveDistance({ posRef, totalKm, playing }) {
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

export default function App() {
  const mapContainer = useRef(null)
  const mapRef = useRef(null)
  const vehicleMarkerRef = useRef(null)
  const ringMarkerRef = useRef(null)
  const stopMarkersRef = useRef([])
  const rafRef = useRef(null)
  const posRef = useRef(null)
  const recorderRef = useRef(null)
  const roadCacheRef = useRef({}) // "lat,lng>lat,lng" -> [{lng,lat,bearing}]
  const [roadVersion, setRoadVersion] = useState(0) // yol gelince yeniden ciz

  const [departure, setDeparture] = useState(null)
  const [arrival, setArrival] = useState(null)
  const [midStops, setMidStops] = useState([])
  const [addingMid, setAddingMid] = useState(false)
  const [vehicle, setVehicle] = useState(VEHICLES[0]) // varsayilan arac
  const [legVehicles, setLegVehicles] = useState([]) // her bacak icin arac id
  const [playing, setPlaying] = useState(false)
  const [currentLeg, setCurrentLeg] = useState(-1)

  const [theme, setTheme] = useState('voyager')
  const [format, setFormat] = useState('landscape')
  const [speed, setSpeed] = useState(1)
  const [loop, setLoop] = useState(false)

  const [saved, setSaved] = useState([])
  const [weather, setWeather] = useState({}) // key -> {t, code} veya 'loading'
  const [toast, setToast] = useState('')
  const [dragIdx, setDragIdx] = useState(null)
  const [langOpen, setLangOpen] = useState(false) // dil secici acik mi
  const [stamps, setStamps] = useState([]) // ekranda gorunen pasaport damgalari
  const [showStamps, setShowStamps] = useState(true) // damga efekti acik mi
  const [author, setAuthor] = useState('') // video/gorsel cikisina yazilacak ad soyad
  const [dayNight, setDayNight] = useState(false) // gunduz/gece golgesi acik mi
  const [borderPop, setBorderPop] = useState(null) // ekran ortasi ulke gecis pop-up'i {id, flag, name}
  const curLang = LANGS.find((l) => l.code === LANG) || LANGS[0]

  // Ulke sinir verisini arka planda yukle (animasyonda gecis tespiti icin)
  useEffect(() => { loadBorders() }, [])

  // Dil menusu: disari tiklaninca kapat
  useEffect(() => {
    if (!langOpen) return
    const close = (e) => {
      if (!e.target.closest('.lang-picker')) setLangOpen(false)
    }
    document.addEventListener('click', close)
    return () => document.removeEventListener('click', close)
  }, [langOpen])

  // Duraklar: baslangic + ara + varis, (loop ise sona baslangic eklenir)
  const baseStops = useMemo(
    () => [departure, ...midStops, arrival].filter(Boolean),
    [departure, midStops, arrival]
  )
  const stops = useMemo(() => {
    if (loop && baseStops.length > 1) return [...baseStops, baseStops[0]]
    return baseStops
  }, [baseStops, loop])

  // Bacak sayisi degistiginde leg araclarini senkronize et
  useEffect(() => {
    const need = Math.max(0, stops.length - 1)
    setLegVehicles((prev) => {
      const next = prev.slice(0, need)
      while (next.length < need) next.push(vehicle.id)
      return next
    })
  }, [stops.length]) // eslint-disable-line react-hooks/exhaustive-deps

  const legVeh = useCallback(
    (i) => vById(legVehicles[i] || vehicle.id),
    [legVehicles, vehicle]
  )
  // Rota kavis mi? Herhangi bir bacak kavisli arac ise onizlemede kavis goster
  const anyArc = useMemo(
    () => stops.slice(0, -1).some((_, i) => legVeh(i).arc),
    [stops, legVeh]
  )

  const legKm = useMemo(
    () => stops.slice(0, -1).map((s, i) => distanceKm(s, stops[i + 1])),
    [stops]
  )
  const totalKm = useMemo(() => legKm.reduce((a, b) => a + b, 0), [legKm])

  // Saf yardimcilar — modul seviyesinde tanimli (her render'da yeniden yaratilmaz)
  const showToast = useCallback((msg) => {
    setToast(msg)
    setTimeout(() => setToast(''), 2600)
  }, [])

  // Bir bacak icin nokta dizisi: yol araci ise OSRM cache'i, yoksa kavis/duz.
  const legPointsFor = useCallback((i) => {
    const from = stops[i]
    const to = stops[i + 1]
    const v = legVeh(i)
    if (usesRoads(v.id)) {
      const cached = roadCacheRef.current[roadKey(from, to)]
      if (cached) return cached // gercek yol
    }
    return buildPath([from, to], v.arc) // kus ucusu (kavisli/duz)
  }, [stops, legVeh])

  // Yol araclarinin bacaklarini onceden OSRM'den cek (arka planda)
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      for (let i = 0; i < stops.length - 1; i++) {
        const v = legVeh(i)
        if (!usesRoads(v.id)) continue
        const k = roadKey(stops[i], stops[i + 1])
        if (roadCacheRef.current[k]) continue
        const pts = await fetchRoadLeg(stops[i], stops[i + 1])
        if (cancelled) return
        if (pts) {
          roadCacheRef.current[k] = pts
          setRoadVersion((n) => n + 1) // onizlemeyi tazele
        }
      }
    })()
    return () => { cancelled = true }
  }, [stops, legVehicles]) // eslint-disable-line react-hooks/exhaustive-deps


  // --- Harita kurulumu ---------------------------------------------------
  useEffect(() => {
    // StrictMode dev'de effect'i iki kez calistirir; harita zaten varsa
    // ikinci WebGL context'ini kurma.
    if (mapRef.current || !mapContainer.current) return
    getLogoImage() // logoyu onceden yukle (video/PNG cizimi icin hazir olsun)
    const map = new maplibregl.Map({
      container: mapContainer.current,
      style: THEMES[theme].style,
      center: [29, 41],
      zoom: 3.2,
      preserveDrawingBuffer: true,
      attributionControl: { compact: true },
    })
    mapRef.current = map
    map.on('load', () => addRouteLayers(map))

    return () => {
      cancelAnimationFrame(rafRef.current)
      map.remove()
      mapRef.current = null
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  function addRouteLayers(map) {
    // Gece golgesi (gunduz/gece) — rota cizgilerinin ALTINDA kalsin diye once eklenir
    if (!map.getSource('night')) {
      map.addSource('night', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      })
      map.addLayer({
        id: 'night',
        type: 'fill',
        source: 'night',
        paint: {
          'fill-color': '#0a1230',
          'fill-opacity': 0.42,
        },
      })
    }
    if (!map.getSource('route-preview')) {
      map.addSource('route-preview', {
        type: 'geojson',
        data: { type: 'Feature', geometry: { type: 'LineString', coordinates: [] } },
      })
      map.addLayer({
        id: 'route-preview',
        type: 'line',
        source: 'route-preview',
        paint: {
          'line-color': '#c25b4e',
          'line-opacity': 0.45,
          'line-width': 2,
          'line-dasharray': [1, 2],
        },
      })
    }
    if (!map.getSource('route-progress')) {
      map.addSource('route-progress', {
        type: 'geojson',
        data: { type: 'Feature', geometry: { type: 'LineString', coordinates: [] } },
      })
      map.addLayer({
        id: 'route-progress-glow',
        type: 'line',
        source: 'route-progress',
        paint: { 'line-color': '#FF6B5B', 'line-opacity': 0.35, 'line-width': 10, 'line-blur': 5 },
      })
      map.addLayer({
        id: 'route-progress',
        type: 'line',
        source: 'route-progress',
        paint: { 'line-color': '#FF6B5B', 'line-width': 3.5 },
        layout: { 'line-cap': 'round', 'line-join': 'round' },
      })
    }
  }

  // Tema degisimi: stil yeniden yuklenir, katmanlar tekrar eklenir
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    map.setStyle(THEMES[theme].style)
    map.once('styledata', () => {
      addRouteLayers(map)
      redrawPreview()
    })
  }, [theme]) // eslint-disable-line react-hooks/exhaustive-deps

  // Gunduz/gece toggle degisince onizlemede gece golgesini guncelle
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    if (map.isStyleLoaded()) updateNight(dayNight ? new Date() : null)
    else map.once('styledata', () => updateNight(dayNight ? new Date() : null))
  }, [dayNight]) // eslint-disable-line react-hooks/exhaustive-deps

  // --- Durak isaretcileri + onizleme -------------------------------------
  function redrawPreview() {
    const map = mapRef.current
    if (!map) return
    const src = map.getSource('route-preview')
    if (!src) return
    const coords = []
    for (let i = 0; i < stops.length - 1; i++) {
      legPointsFor(i).forEach((p) => coords.push([p.lng, p.lat]))
    }
    src.setData({ type: 'Feature', geometry: { type: 'LineString', coordinates: coords } })
  }

  // Gece golgesini bir tarih icin guncelle (dayNight kapaliysa temizle)
  function updateNight(date) {
    const map = mapRef.current
    const src = map?.getSource('night')
    if (!src) return
    if (!dayNight || !date) {
      src.setData({ type: 'FeatureCollection', features: [] })
      return
    }
    src.setData({ type: 'FeatureCollection', features: [nightPolygon(date)] })
  }

  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    stopMarkersRef.current.forEach((m) => m.remove())
    // loop'ta son durak baslangicla ayni; isaretciyi tekrar cizme
    const uniqueStops = loop && stops.length > 1 ? stops.slice(0, -1) : stops
    stopMarkersRef.current = uniqueStops.map((s, i) => {
      const isLast = i === uniqueStops.length - 1 && uniqueStops.length > 1 && !loop
      const tag = i === 0 ? t('tagDep') : isLast ? t('tagArr') : t('tagVia')
      const el = document.createElement('div')
      el.className = 'stop-pin'
      el.innerHTML = `<span class="stop-pin-num">${tag}</span><span class="stop-pin-name">${s.name}</span>`
      return new maplibregl.Marker({ element: el, anchor: 'bottom' })
        .setLngLat([s.lng, s.lat])
        .addTo(map)
    })

    if (map.isStyleLoaded()) redrawPreview()
    else map.once('load', redrawPreview)

    if (stops.length > 1 && !playing) {
      const b = new maplibregl.LngLatBounds()
      stops.forEach((s) => b.extend([s.lng, s.lat]))
      map.fitBounds(b, { padding: 90, duration: 800 })
    } else if (stops.length === 1) {
      map.easeTo({ center: [stops[0].lng, stops[0].lat], zoom: 6, duration: 800 })
    }
  }, [stops, legVehicles, loop, roadVersion]) // eslint-disable-line react-hooks/exhaustive-deps

  // --- URL'den rota yukleme (ilk acilis) ---------------------------------
  useEffect(() => {
    setSaved(loadSaved())
    const r = readRouteFromUrl()
    if (r) applyState(r)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  function applyState(r) {
    if (!r?.stops?.length) return
    resetAnimation()
    setDeparture(r.stops[0] || null)
    setArrival(r.stops.length > 1 ? r.stops[r.stops.length - 1] : null)
    setMidStops(r.stops.slice(1, -1))
    setLegVehicles(r.legVehicles || [])
    setTheme(r.theme || 'voyager')
    setLoop(!!r.loop)
    setSpeed(r.speed || 1)
  }

  // --- Hava durumu (Open-Meteo, anahtarsiz) ------------------------------
  useEffect(() => {
    const uniqueStops = loop && stops.length > 1 ? stops.slice(0, -1) : stops
    uniqueStops.forEach((s) => {
      const k = key(s)
      if (weather[k]) return
      setWeather((w) => ({ ...w, [k]: 'loading' }))
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
        .catch(() => setWeather((w) => ({ ...w, [k]: null })))
    })
  }, [stops, loop]) // eslint-disable-line react-hooks/exhaustive-deps

  // --- Animasyon kontrol -------------------------------------------------
  function resetAnimation() {
    cancelAnimationFrame(rafRef.current)
    recorderRef.current?.stop()
    recorderRef.current = null
    posRef.current = null
    setPlaying(false)
    setCurrentLeg(-1)
    setStamps([]) // ekrandaki damgalari temizle
    setBorderPop(null) // ulke gecis pop-up'ini temizle
    if (borderTimerRef.current) clearTimeout(borderTimerRef.current)
    borderRef.current = null
    lastCountryRef.current = null
    updateNight(null) // gece golgesini temizle
    vehicleMarkerRef.current?.remove()
    vehicleMarkerRef.current = null
    ringMarkerRef.current?.remove()
    ringMarkerRef.current = null
    mapRef.current
      ?.getSource('route-progress')
      ?.setData({ type: 'Feature', geometry: { type: 'LineString', coordinates: [] } })
  }

  function clearAll() {
    resetAnimation()
    setDeparture(null)
    setArrival(null)
    setMidStops([])
    setAddingMid(false)
    setLoop(false)
  }

  function popPin(index, cls = 'arrived') {
    const m = stopMarkersRef.current[index % stopMarkersRef.current.length]
    if (!m) return
    const el = m.getElement()
    el.classList.add(cls)
    setTimeout(() => el.classList.remove(cls), 950)
  }

  function setRing(lngLat) {
    ringMarkerRef.current?.remove()
    ringMarkerRef.current = null
    if (!lngLat) return
    const el = document.createElement('div')
    el.className = 'pulse-ring'
    ringMarkerRef.current = new maplibregl.Marker({ element: el })
      .setLngLat(lngLat)
      .addTo(mapRef.current)
  }

  function celebrate(lngLat) {
    const el = document.createElement('div')
    el.className = 'confetti'
    el.textContent = '🎉'
    const m = new maplibregl.Marker({ element: el, anchor: 'bottom' })
      .setLngLat(lngLat)
      .addTo(mapRef.current)
    setTimeout(() => m.remove(), 1600)
  }

  // Bir duraga varista pasaport damgasi dusur (kisa sure ekranda kalir)
  const stampIdRef = useRef(0)
  const stampRef = useRef(null) // video kaydina cizilecek aktif damga {img, born, rotate, left, top}
  const stampImgCacheRef = useRef({}) // svg -> onceden rasterize edilmis Image

  // Ulke gecisi: animasyonda yeni ulkeye girilince ekran ortasi pop-up
  const lastCountryRef = useRef(null) // en son icinde olunan ISO2
  const borderPopIdRef = useRef(0)
  const borderRef = useRef(null) // video kaydina cizilecek aktif gecis {flag, name, born}
  const borderTimerRef = useRef(null)
  function announceCountry(iso2, isStart) {
    const flag = flagEmoji(iso2)
    const name = countryName(iso2, LOCALE)
    const id = ++borderPopIdRef.current
    setBorderPop({ id, flag, name })
    // Video kaydi icin aktif gecisi isaretle (capture her karede cizer)
    borderRef.current = { flag, name, born: performance.now(), id }
    if (borderTimerRef.current) clearTimeout(borderTimerRef.current)
    borderTimerRef.current = setTimeout(() => {
      setBorderPop((cur) => (cur && cur.id === id ? null : cur))
      if (borderRef.current && borderRef.current.id === id) borderRef.current = null
    }, 2600)
  }

  function dropStamp(stop) {
    if (!showStamps || !stop) return
    const data = stampFor(stop)
    const id = ++stampIdRef.current
    // Ekranda rastgele ama merkeze yakin bir konum (ust-orta bolge)
    const left = 30 + (Math.abs(stampIdRef.current * 37) % 40) // %30..%70
    const top = 18 + (Math.abs(stampIdRef.current * 53) % 30)  // %18..%48
    const svg = stampSvg(data, 180)
    setStamps((prev) => [...prev, { id, svg, rotate: data.rotate, left, top }])

    // Video kaydi icin: SVG'yi Image'a yukle, capture her karede cizsin.
    // Ayni damga (ayni ulke) tekrar geldiginde cache'ten al — her varista
    // yeniden base64/decode maliyeti odenmez.
    const cache = stampImgCacheRef.current
    const useImg = (img) => {
      stampRef.current = { id, img, born: performance.now(), rotate: data.rotate, left, top }
    }
    if (cache[svg]?.complete) {
      useImg(cache[svg])
    } else {
      const img = cache[svg] || new Image()
      cache[svg] = img
      if (img.complete && img.src) {
        useImg(img)
      } else {
        img.onload = () => useImg(img)
        img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svg)))
      }
    }

    // 2.6 sn sonra kaldir (cache'teki Image korunur; sadece aktif damga silinir)
    setTimeout(() => {
      setStamps((prev) => prev.filter((s) => s.id !== id))
      if (stampRef.current && stampRef.current.id === id) stampRef.current = null
    }, 2600)
  }

  async function play(record = false) {
    const map = mapRef.current
    if (!map || stops.length < 2 || playing) return
    resetAnimation()

    // Yol araclarinin eksik bacaklarini animasyondan once cek
    const needRoads = stops.slice(0, -1).some((_, i) =>
      usesRoads(legVeh(i).id) && !roadCacheRef.current[roadKey(stops[i], stops[i + 1])]
    )
    if (needRoads) {
      showToast(t('toastFetchingRoads'))
      for (let i = 0; i < stops.length - 1; i++) {
        if (!usesRoads(legVeh(i).id)) continue
        const k = roadKey(stops[i], stops[i + 1])
        if (roadCacheRef.current[k]) continue
        const pts = await fetchRoadLeg(stops[i], stops[i + 1])
        if (pts) roadCacheRef.current[k] = pts
      }
      setRoadVersion((n) => n + 1)
    }

    const legs = []
    for (let i = 0; i < stops.length - 1; i++) {
      const v = legVeh(i)
      const pts = legPointsFor(i)
      // Mesafe: yol geometrisi varsa nokta nokta topla, yoksa kus ucusu
      let km = 0
      for (let j = 0; j < pts.length - 1; j++) km += distanceKm(pts[j], pts[j + 1])
      const cruise = zoomForLeg(stops[i], stops[i + 1])
      legs.push({
        points: pts,
        coords: pts.map((p) => [p.lng, p.lat]),
        duration: (Math.max(3200, Math.min(10000, 2200 + km * 2.2))) * speed,
        zoomCruise: cruise,
        zoomCity: Math.min(9.5, cruise + 3),
        km,
        vehicle: v,
      })
    }

    let firstV = legs[0].vehicle
    const el = document.createElement('div')
    el.className = 'vehicle takeoff'
    el.innerHTML = `<span class="vehicle-emoji">${firstV.emoji}</span>`
    let inner = el.firstChild
    const marker = new maplibregl.Marker({ element: el })
      .setLngLat(legs[0].coords[0])
      .addTo(map)
    vehicleMarkerRef.current = marker
    setTimeout(() => el.classList.remove('takeoff'), 900)

    const src = map.getSource('route-progress')
    setPlaying(true)
    setCurrentLeg(0)
    setRing([stops[1].lng, stops[1].lat])
    popPin(0)

    // Gercek toplam (yol geometrisi dahil) — rozet ve final etiket icin
    const realTotalKm = legs.reduce((a, l) => a + l.km, 0)

    // --- Performans: kumulatif on-hesap ---
    // prefixCoords[i] = 0..i-1 bacaklarinin tum noktalari (bir kez kurulur)
    // prefixKm[i]     = 0..i-1 bacaklarinin toplam km'si
    const prefixCoords = [[]]
    const prefixKm = [0]
    for (let i = 0; i < legs.length; i++) {
      prefixCoords.push(prefixCoords[i].concat(legs[i].coords))
      prefixKm.push(prefixKm[i] + legs[i].km)
    }

    posRef.current = {
      lng: legs[0].points[0].lng,
      lat: legs[0].points[0].lat,
      bearing: legs[0].points[0].bearing,
      rotate: firstV.rotate,
      faces: firstV.faces,
      flip: firstV.flip,
      emoji: firstV.emoji,
      traveledKm: 0,
      totalKm: realTotalKm,
      done: false,
    }
    if (record) {
      const sub = `${stops[0].name} → ${stops[stops.length - 1].name}`
      // capture.js tembel yuklenir — sadece video/PNG cikisi istendiginde
      const { startRecorder } = await import('./capture.js')
      recorderRef.current = startRecorder(map, stops, posRef, realTotalKm, format, sub, stampRef, author, borderRef)
      if (!recorderRef.current) {
        alert(t('recorderUnsupported'))
      }
    }

    let zoom = legs[0].zoomCity
    let bearing = legs[0].points[0].bearing
    let pitch = PITCH_CITY // sinematik egim (yumusak takip edilir)
    map.easeTo({ center: legs[0].coords[0], zoom, pitch, bearing: 0, duration: 600 })

    const start = performance.now() + 650
    let lastLeg = 0
    let finished = false

    // Ulke gecisi takibi: baslangic noktasinin ulkesini sessizce kaydet
    // (baslangicta pop-up gostermeyiz; ilk gecisten itibaren gosteririz)
    lastCountryRef.current = countryAt(legs[0].coords[0][0], legs[0].coords[0][1])
    let borderThrottle = 0

    // Gunduz/gece icin: toplam animasyon suresi + baslangic saati (simdi)
    const totalDur =
      legs.reduce((a, l) => a + l.duration, 0) + DWELL * Math.max(0, legs.length - 1)
    const nightBase = new Date()
    let nightThrottle = 0
    if (dayNight) updateNight(nightBase) // baslangic golgesi

    const frame = (now) => {
      const elapsed = Math.max(0, now - start)

      let acc = 0
      let legIdx = 0
      let tLeg = 0
      let dwelling = false
      let done = false
      for (let i = 0; i < legs.length; i++) {
        if (elapsed < acc + legs[i].duration) {
          legIdx = i
          tLeg = (elapsed - acc) / legs[i].duration
          break
        }
        acc += legs[i].duration
        if (i < legs.length - 1) {
          if (elapsed < acc + DWELL) {
            legIdx = i
            tLeg = 1
            dwelling = true
            break
          }
          acc += DWELL
        } else {
          legIdx = i
          tLeg = 1
          done = true
        }
      }

      const leg = legs[legIdx]
      const tE = easeInOutCubic(Math.min(1, tLeg))
      const idx = Math.min(leg.points.length - 1, Math.floor(tE * (leg.points.length - 1)))
      const p = leg.points[idx]

      // Arac gorunumunu bu bacaga gore guncelle (leg bazli arac)
      if (inner && inner.textContent !== leg.vehicle.emoji) {
        inner.textContent = leg.vehicle.emoji
      }

      // Cizilen rota: onceden hazir prefix + mevcut bacagin dilimi
      const drawn = prefixCoords[legIdx].concat(leg.coords.slice(0, idx + 1))
      const progressSrc = map.getSource('route-progress')
      progressSrc?.setData({ type: 'Feature', geometry: { type: 'LineString', coordinates: drawn } })

      marker.setLngLat([p.lng, p.lat])

      // Ulke gecisi tespiti (~3fps ile; nokta-poligon testi maliyetli).
      // Bekleme (dwell) sirasinda atlanir; araci gercekten hareket ederken bakariz.
      if (!dwelling && now - borderThrottle > 320) {
        borderThrottle = now
        const iso = countryAt(p.lng, p.lat)
        // Denizde/veri disinda iso null olur — o zaman "gecis yok" say, son
        // kara ulkesini koru ki deniz asiri bacaklarda yanlis tetiklenmesin.
        if (iso && iso !== lastCountryRef.current) {
          // Ilk kez bir ulke set ediliyorsa (baslangic null'du) sessizce gec
          if (lastCountryRef.current !== null) announceCountry(iso)
          lastCountryRef.current = iso
        }
      }

      // Kat edilen mesafe: on-hesaplanmis prefix + mevcut bacagin orani.
      // Panel gostergesi ayri bir LiveDistance bileseni tarafindan posRef'ten
      // okunur; burada React state'i guncellemiyoruz (App yeniden render olmaz).
      const done_km = prefixKm[legIdx] + leg.km * tE

      // Gunduz/gece golgesi: ilerlemeye gore sanal saat kaydir (~5fps, poligon pahali)
      if (dayNight && now - nightThrottle > 200) {
        nightThrottle = now
        const progress = Math.min(1, elapsed / totalDur)
        // Tum yolculuk boyunca ~1 gun (24s) gecsin ki golge belirgin kaysin
        updateNight(clockForProgress(nightBase, progress, 24))
      }

      if (leg.vehicle.rotate) {
        const diff = ((p.bearing - bearing + 540) % 360) - 180
        bearing += diff * 0.12
        inner.style.transform = vehicleTransform(bearing, leg.vehicle)
      } else {
        inner.style.transform = 'rotate(0deg)'
      }
      posRef.current = {
        lng: p.lng,
        lat: p.lat,
        bearing,
        rotate: leg.vehicle.rotate,
        faces: leg.vehicle.faces,
        flip: leg.vehicle.flip,
        emoji: leg.vehicle.emoji,
        traveledKm: done_km,
        totalKm: realTotalKm,
        done: false,
      }

      const targetZoom =
        leg.zoomCity + (leg.zoomCruise - leg.zoomCity) * Math.sin(Math.PI * tE)
      zoom += (targetZoom - zoom) * 0.06
      // Sinematik egim: seyirde daha egik, durak yaklasiminda biraz duzelir
      const targetPitch =
        PITCH_CITY + (PITCH_CRUISE - PITCH_CITY) * Math.sin(Math.PI * tE)
      pitch += (targetPitch - pitch) * 0.06
      map.jumpTo({ center: [p.lng, p.lat], zoom, pitch, bearing: 0 })

      if (legIdx !== lastLeg) {
        popPin(legIdx)
        dropStamp(stops[legIdx]) // yeni ulasilan duragin damgasi
        lastLeg = legIdx
        const dest = stops[legIdx + 1]
        if (dest) setRing([dest.lng, dest.lat])
        setCurrentLeg(legIdx)
      }

      if (done && !finished) {
        finished = true
        const last = stops[stops.length - 1]
        popPin(stops.length - 1)
        celebrate([last.lng, last.lat])
        dropStamp(last) // son varis damgasi
        setRing(null)
        setPlaying(false)
        setCurrentLeg(stops.length - 1)
        el.classList.add('landed')
        // Kayit overlay'i icin: bittigini ve toplam km'i isaretle
        if (posRef.current) {
          posRef.current.traveledKm = realTotalKm
          posRef.current.totalKm = realTotalKm
          posRef.current.done = true
        }
        const b = new maplibregl.LngLatBounds()
        stops.forEach((s) => b.extend([s.lng, s.lat]))
        // Bitiste kamera duzlesir (pitch 0) ve tum rotayi tek karede gosterir
        setTimeout(() => map.fitBounds(b, { padding: 90, duration: 1800, pitch: 0, bearing: 0, essential: true }), 700)
        if (recorderRef.current) {
          setTimeout(() => {
            recorderRef.current?.stop()
            recorderRef.current = null
          }, 3200)
        }
        return
      }
      rafRef.current = requestAnimationFrame(frame)
    }
    rafRef.current = requestAnimationFrame(frame)
  }

  async function handleImage() {
    const map = mapRef.current
    if (!map || stops.length < 2) return
    // Yol araclarinin eksik bacaklarini once cek
    for (let i = 0; i < stops.length - 1; i++) {
      if (!usesRoads(legVeh(i).id)) continue
      const k = roadKey(stops[i], stops[i + 1])
      if (roadCacheRef.current[k]) continue
      const pts = await fetchRoadLeg(stops[i], stops[i + 1])
      if (pts) roadCacheRef.current[k] = pts
    }
    const full = []
    let realTotal = 0
    for (let i = 0; i < stops.length - 1; i++) {
      const pts = legPointsFor(i)
      pts.forEach((p) => full.push([p.lng, p.lat]))
      for (let j = 0; j < pts.length - 1; j++) realTotal += distanceKm(pts[j], pts[j + 1])
    }
    map
      .getSource('route-progress')
      ?.setData({ type: 'Feature', geometry: { type: 'LineString', coordinates: full } })
    const b = new maplibregl.LngLatBounds()
    stops.forEach((s) => b.extend([s.lng, s.lat]))
    map.fitBounds(b, { padding: 110, duration: 0 })
    const sub = `${stops[0].name} → ${stops[stops.length - 1].name}`
    const { downloadImage } = await import('./capture.js')
    await downloadImage(map, stops, realTotal, format, sub, author)
  }

  // --- Paylasim & kaydetme ----------------------------------------------
  function currentState() {
    return { stops: baseStops, legVehicles, theme, loop, speed }
  }

  async function handleShare() {
    if (baseStops.length < 2) return
    const url = shareUrl(currentState())
    try {
      await navigator.clipboard.writeText(url)
      showToast(t('toastLinkCopied'))
    } catch {
      window.prompt(t('sharePrompt'), url)
    }
  }

  function handleSave() {
    if (baseStops.length < 2) return
    const def = `${baseStops[0].name} → ${baseStops[baseStops.length - 1].name}`
    const name = window.prompt(t('routeNamePrompt'), def)
    if (name === null) return
    const list = saveRoute(name, currentState())
    setSaved(loadSaved())
    showToast(t('toastRouteSaved'))
  }

  function handleLoadSaved(entry) {
    const r = hydrateSaved(entry)
    if (r) {
      applyState(r)
      showToast(t('toastRouteLoaded'))
    }
  }

  function handleDeleteSaved(id, e) {
    e.stopPropagation()
    setSaved(deleteSaved(id))
  }

  // --- Ara durak surukle-birak sirala ------------------------------------
  function onDrop(targetIdx) {
    if (dragIdx === null || dragIdx === targetIdx) return
    setMidStops((prev) => {
      const next = [...prev]
      const [moved] = next.splice(dragIdx, 1)
      next.splice(targetIdx, 0, moved)
      return next
    })
    setDragIdx(null)
  }

  const routeReady = departure && arrival
  const uniqueStops = loop && stops.length > 1 ? stops.slice(0, -1) : stops

  return (
    <div className="app">
      <aside className="panel">
        <header className="brand">
          <div className="brand-top">
            <h1><img className="brand-logo" src={LOGO_URL} alt="" /> MapBoast</h1>
            <div className={`lang-picker ${langOpen ? 'open' : ''}`}>
              <button
                className="lang-switch"
                aria-haspopup="listbox"
                aria-expanded={langOpen}
                onClick={() => setLangOpen((v) => !v)}
              >
                <img className="lang-flag" src={curLang.flag} alt="" width="18" height="18" />
                {curLang.label} <span className="lang-caret">▾</span>
              </button>
              {langOpen && (
                <ul className="lang-menu" role="listbox">
                  {LANGS.map((l) => (
                    <li key={l.code}>
                      <a
                        className={`lang-item ${l.code === LANG ? 'on' : ''}`}
                        href={l.path}
                        role="option"
                        aria-selected={l.code === LANG}
                      >
                        <img className="lang-flag" src={l.flag} alt="" width="18" height="18" />
                        <span className="lang-name">{l.name}</span>
                        <span className="lang-code">{l.label}</span>
                      </a>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
          <p>{t('tagline')}</p>
        </header>

        <SearchBox
          label={t('departureLabel')}
          value={departure}
          placeholder={t('departurePh')}
          onPick={setDeparture}
          onClear={() => { setDeparture(null); resetAnimation() }}
          disabled={playing}
        />
        <SearchBox
          label={t('arrivalLabel')}
          value={arrival}
          placeholder={t('arrivalPh')}
          onPick={setArrival}
          onClear={() => { setArrival(null); resetAnimation() }}
          disabled={playing}
        />

        {/* Ara duraklar — surukle-birakla sirala */}
        <div className="mids">
          {midStops.map((s, i) => (
            <div
              className={`chip mid ${dragIdx === i ? 'dragging' : ''}`}
              key={`${key(s)}-${i}`}
              draggable={!playing}
              onDragStart={() => setDragIdx(i)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => onDrop(i)}
              onDragEnd={() => setDragIdx(null)}
              title={t('dragToReorder')}
            >
              <span className="drag-handle">⋮⋮</span>
              <span className="chip-name">{s.name}</span>
              <button
                className="chip-clear"
                disabled={playing}
                onClick={() => setMidStops((prev) => prev.filter((_, j) => j !== i))}
                aria-label={t('removeMid', s.name)}
              >×</button>
            </div>
          ))}
          {addingMid ? (
            <SearchBox
              label={t('midLabel')}
              value={null}
              placeholder={t('midPh')}
              autoFocus
              onPick={(s) => { setMidStops((prev) => [...prev, s]); setAddingMid(false) }}
              onClear={() => {}}
              disabled={playing}
            />
          ) : (
            <button className="add-mid" onClick={() => setAddingMid(true)} disabled={playing || !routeReady}>
              {t('addMid')}
            </button>
          )}
        </div>

        {/* Pasaport damgasi efekti */}
        {baseStops.length > 1 && (
          <label className="toggle">
            <input type="checkbox" checked={showStamps} disabled={playing}
              onChange={(e) => setShowStamps(e.target.checked)} />
            <span>{t('passportStamps')}</span>
          </label>
        )}

        {/* Ad soyad — video/gorsel cikisina islenir */}
        <label className="author-field">
          <span>{t('authorLabel')}</span>
          <input type="text" value={author} disabled={playing}
            placeholder={t('authorPlaceholder')}
            maxLength={40}
            onChange={(e) => setAuthor(e.target.value)} />
        </label>

        {/* Kalkis panosu — mesafe/sure/saat farki/hava */}
        <div className="board">
          <div className="board-head">
            <span>{t('board')}</span>
            <span className="board-status">
              {playing ? t('statusEnRoute') : routeReady ? t('statusReady') : t('statusWaiting')}
            </span>
          </div>
          {stops.length === 0 && <div className="board-empty">{t('boardEmpty')}</div>}
          <ul className="board-rows">
            {stops.map((s, i) => {
              const isLastUnique = i === stops.length - 1
              const tag = i === 0 ? t('tagDep') : (isLastUnique && !loop) ? t('tagArr') : (loop && isLastUnique) ? t('tagDep') : t('tagVia')
              const state = !playing ? '' : i < currentLeg ? 'passed' : i === currentLeg ? 'active' : ''
              const w = weather[key(s)]
              return (
                <li key={i} className={`board-row ${state}`}>
                  <span className="row-num">{tag}</span>
                  <span className="row-name">{s.name.toUpperCase()}</span>
                  <span className="row-meta">
                    {w && w !== 'loading' && w != null && (
                      <span className="row-wx">{weatherEmoji(w.code)} {w.t}°</span>
                    )}
                    <span className="row-tz">{offsetLabel(s.lng)}</span>
                  </span>
                </li>
              )
            })}
          </ul>
        </div>

        {/* Bacak detaylari: arac secimi + mesafe + sure + saat farki */}
        {stops.length > 1 && (
          <div className="legs">
            <div className="legs-head">{t('legs')}</div>
            {stops.slice(0, -1).map((s, i) => {
              const to = stops[i + 1]
              const v = legVeh(i)
              const diff = hourDiff(s, to)
              return (
                <div className="leg" key={i}>
                  <div className="leg-top">
                    <span className="leg-route">{s.name} → {to.name}</span>
                    <span className="leg-stats">
                      {fmtNum(legKm[i])} km · {etaText(legKm[i], v.id)}
                      {diff !== 0 && <span className="leg-tz"> · {diff > 0 ? '+' : '−'}{Math.abs(diff)}{t('hourSuffix')}</span>}
                    </span>
                  </div>
                  <div className="leg-vehicles">
                    {VEHICLES.map((veh) => (
                      <button
                        key={veh.id}
                        className={`leg-veh ${v.id === veh.id ? 'on' : ''}`}
                        disabled={playing}
                        title={veh.label}
                        onClick={() => setLegVehicles((prev) => {
                          const next = [...prev]
                          while (next.length < stops.length - 1) next.push(vehicle.id)
                          next[i] = veh.id
                          return next
                        })}
                      >{veh.emoji}</button>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* Mesafe sayaci */}
        {totalKm > 0 && (
          <div className="distance">
            <span>{playing ? t('traveledRemaining') : t('totalDistance')}</span>
            {playing ? (
              <LiveDistance posRef={posRef} totalKm={totalKm} playing={playing} />
            ) : (
              <strong>{fmtNum(totalKm)} KM</strong>
            )}
          </div>
        )}

        {/* Varsayilan arac (yeni bacaklara uygulanir) */}
        <div className="section-label">{t('defaultVehicle')}</div>
        <div className="vehicles">
          {VEHICLES.map((v) => (
            <button
              key={v.id}
              className={`vehicle-btn ${vehicle.id === v.id ? 'selected' : ''}`}
              onClick={() => { setVehicle(v); setLegVehicles((prev) => prev.map(() => v.id)) }}
              disabled={playing}
              title={v.label}
            >
              <span>{v.emoji}</span><small>{v.label}</small>
            </button>
          ))}
        </div>

        {/* Tema + Hiz + Format */}
        <div className="options">
          <div className="opt">
            <span className="opt-label">{t('mapLabel')}</span>
            <div className="seg">
              {Object.values(THEMES).map((t) => (
                <button key={t.id} className={theme === t.id ? 'on' : ''} onClick={() => setTheme(t.id)}>{t.label}</button>
              ))}
            </div>
          </div>
          <div className="opt">
            <span className="opt-label">{t('speedLabel')}</span>
            <div className="seg">
              {SPEEDS.map((sp) => (
                <button key={sp.id} className={speed === sp.id ? 'on' : ''} disabled={playing} onClick={() => setSpeed(sp.id)}>{sp.label}</button>
              ))}
            </div>
          </div>
          <div className="opt">
            <span className="opt-label">{t('formatLabel')}</span>
            <div className="seg">
              {Object.values(FORMATS).map((f) => (
                <button key={f.id} className={format === f.id ? 'on' : ''} onClick={() => setFormat(f.id)}>{f.label}</button>
              ))}
            </div>
          </div>
        </div>

        <div className="actions">
          <button className="play" onClick={() => play(false)} disabled={!routeReady || playing}>
            {playing ? t('playing') : t('startJourney')}
          </button>
          <button className="clear" onClick={clearAll} disabled={stops.length === 0}>{t('clear')}</button>
        </div>

        <div className="actions">
          <button className="export" onClick={() => play(true)} disabled={!routeReady || playing}
            title={t('videoTitle')}>⏺ Video ({FORMATS[format].label})</button>
          <button className="export" onClick={handleImage} disabled={!routeReady || playing}
            title={t('imageTitle')}>{t('imageBtn')}</button>
        </div>

        <div className="actions">
          <button className="ghost" onClick={handleShare} disabled={!routeReady}>{t('linkBtn')}</button>
          <button className="ghost" onClick={handleSave} disabled={!routeReady}>{t('saveBtn')}</button>
        </div>

        {/* Kayitli rotalar */}
        {saved.length > 0 && (
          <div className="saved">
            <div className="saved-head">{t('savedRoutes')}</div>
            <ul>
              {saved.map((e) => (
                <li key={e.id} onClick={() => handleLoadSaved(e)}>
                  <span className="saved-name">{e.name}</span>
                  <button className="saved-del" onClick={(ev) => handleDeleteSaved(e.id, ev)} aria-label={t('deleteLabel')}>×</button>
                </li>
              ))}
            </ul>
          </div>
        )}

        <footer className="credits">{t('credits')}</footer>
      </aside>

      <div ref={mapContainer} className="map" />
      {stamps.map((s) => (
        <div
          key={s.id}
          className="passport-stamp"
          style={{ left: `${s.left}%`, top: `${s.top}%`, '--stamp-rot': `${s.rotate}deg` }}
          dangerouslySetInnerHTML={{ __html: s.svg }}
        />
      ))}
      {borderPop && (
        <div className="border-pop" key={borderPop.id}>
          <span className="border-flag">{borderPop.flag}</span>
          <span className="border-name">{borderPop.name}</span>
        </div>
      )}
      {toast && <div className="toast">{toast}</div>}
    </div>
  )
}
