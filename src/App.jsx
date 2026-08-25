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
  bendPath,
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
import { getPinImage } from './pin.js'
import { stampFor, stampSvg } from './stamp.js'
import { loadBorders, countryAt, countryFeature } from './borders.js'
import { atlasStyle } from './atlas.js'
import { joyStyle } from './joy.js'
import { VEHICLES, SPEEDS, vById, vehicleTransform } from './vehicles.js'
import LiveDistance from './components/LiveDistance.jsx'
import TourCard from './components/TourCard.jsx'
import { useTour } from './hooks/useTour.js'
import { useWeather, weatherEmoji, stopKey as key } from './hooks/useWeather.js'
import { useRoadLegs, roadKey } from './hooks/useRoadLegs.js'

// Harita temalari (hepsi ucretsiz, anahtar gerektirmez).
// 'style' bir URL ya da stil nesnesi ureten async fonksiyon olabilir (Atlas).
const THEMES = {
  joy: {
    id: 'joy',
    label: t('themeJoy'),
    style: joyStyle, // editoryal kagit: sicak zemin + fume teal deniz (varsayilan)
  },
  atlas: {
    id: 'atlas',
    label: t('themeAtlas'),
    style: atlasStyle, // premium doga: yumusak yesil-mavi + kabartma
  },
  dark: {
    id: 'dark',
    label: t('themeDark'),
    style: 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json',
  },
}
// Bilinmeyen/eski tema id'leri (or. kaldirilan 'light'/'voyager') varsayilana
// duser — eski paylasim linkleri kirilmaz.
const themeCfg = (id) => THEMES[id] || THEMES.joy
// URL ya da async fonksiyon — her zaman Promise doner
const resolveStyle = (id) => {
  const c = themeCfg(id)
  return typeof c.style === 'function' ? c.style() : Promise.resolve(c.style)
}

const DWELL = 750 // duraklarda bekleme (ms)

// Sinematik kamera: hafif 3B egim. Seyir aninda daha egik, durakta biraz duzelir.
const PITCH_CRUISE = 55 // seyir egimi (derece) — yol/manzara perspektifi
const PITCH_CITY = 45   // durak yaklasiminda biraz daha duz

const easeInOutCubic = (t) =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2

// --- Performans: ilerleme cizgisi line-gradient ile cizilir ---------------
// Eski yontem her karede binlerce noktali diziyi yeniden kurup setData ile
// GPU'ya yukluyordu (GC + serilestirme = mikro donmalar). Yeni yontemde tam
// geometri BIR KEZ yuklenir; her karede yalnizca kucuk bir paint degeri
// (gradient esigi) guncellenir.
// line-progress mercator duzleminde olctugu icin frac da ayni metrikle
// hesaplanir — cizgi ucu araca tam oturur.
const _mercY = (lat) => Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360))
const mercSeg = (a, b) =>
  Math.hypot(((b[0] - a[0]) * Math.PI) / 180, _mercY(b[1]) - _mercY(a[1]))

function setProgressFrac(map, frac) {
  const stop = frac >= 1 ? 2 : Math.max(frac, 1e-6)
  const g = ['step', ['line-progress'], '#FF6B5B', stop, 'rgba(255,107,91,0)']
  if (map.getLayer('route-progress')) map.setPaintProperty('route-progress', 'line-gradient', g)
  if (map.getLayer('route-progress-glow')) map.setPaintProperty('route-progress-glow', 'line-gradient', g)
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
  // playing state'i asenkron play() icinde bayat kaliyor (await sirasinda hala
  // false). Senkron kilit icin ref tutulur — cift tiklamada iki animasyon
  // dongusu baslamasin.
  const playingRef = useRef(false)

  const [departure, setDeparture] = useState(null)
  const [arrival, setArrival] = useState(null)
  const [midStops, setMidStops] = useState([])
  const [addingMid, setAddingMid] = useState(false)
  const [vehicle, setVehicle] = useState(VEHICLES[0]) // varsayilan arac
  const [legVehicles, setLegVehicles] = useState([]) // her bacak icin arac id
  const [playing, setPlaying] = useState(false)
  const [currentLeg, setCurrentLeg] = useState(-1)

  const [theme, setTheme] = useState('joy')
  const [camera, setCamera] = useState('follow') // 'follow' (sinematik) | 'fixed' (sabit, en akici)
  // Rota bukme noktalari: bacak index'i -> {lat,lng}. Kullanici bacagin
  // ortasindaki tutamaci surukleyerek rotanin yonunu sekillendirir.
  const [shapePts, setShapePts] = useState({})
  const hydratingRef = useRef(false) // paylasilan rota yuklenirken bukmeler silinmesin
  const handleMarkersRef = useRef([]) // haritadaki tutamac marker'lari
  const [format, setFormat] = useState('landscape')
  const [speed, setSpeed] = useState(1)

  const [saved, setSaved] = useState([])
  const [toast, setToast] = useState('')
  const [dragIdx, setDragIdx] = useState(null)
  const [langOpen, setLangOpen] = useState(false) // dil secici acik mi
  const [stamps, setStamps] = useState([]) // ekranda gorunen pasaport damgalari
  const [showStamps, setShowStamps] = useState(true) // damga efekti acik mi
  const [author, setAuthor] = useState('') // video/gorsel cikisina yazilacak ad soyad
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

  // Duraklar: baslangic + ara duraklar + varis
  const stops = useMemo(
    () => [departure, ...midStops, arrival].filter(Boolean),
    [departure, midStops, arrival]
  )

  // Duraklarin anlik hava durumu (TTL'li, kendi kendini tazeler)
  const weather = useWeather(stops)

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

  // Saf yardimcilar — modul seviyesinde tanimli (her render'da yeniden yaratilmaz)
  const showToast = useCallback((msg) => {
    setToast(msg)
    setTimeout(() => setToast(''), 2600)
  }, [])

  // Yol geometrisi: OSRM onbellegi, on-yukleme ve yeniden deneme politikasi
  const { cacheRef: roadCacheRef, version: roadVersion, needsFetch: roadNeedsFetch, ensureLegs } =
    useRoadLegs(stops, legVeh, shapePts)

  // Bir bacak icin nokta dizisi: yol araci ise OSRM cache'i, yoksa kavis/duz.
  const legPointsFor = useCallback((i) => {
    const from = stops[i]
    const to = stops[i + 1]
    const v = legVeh(i)
    const sp = shapePts[i] || null
    if (usesRoads(v.id)) {
      const cached = roadCacheRef.current[roadKey(from, to, sp)]
      if (cached) return cached // gercek yol (bukme noktasi uzerinden olabilir)
    }
    if (sp) return bendPath(from, sp, to) // kullanici buktu: Bezier
    return buildPath([from, to]) // kus ucusu (great-circle)
  }, [stops, legVeh, shapePts, roadCacheRef])

  // NOT: legKm, legPointsFor'u kullandigi icin ondan SONRA tanimlanmali
  // (const useCallback'ten once erisim TDZ hatasiyla sayfayi bosaltir).
  const legKm = useMemo(
    () => stops.slice(0, -1).map((_, i) => {
      // Gercek geometriden (yol/bukme dahil) topla — panel gercek mesafeyi gostersin
      const pts = legPointsFor(i)
      let km = 0
      for (let j = 0; j < pts.length - 1; j++) km += distanceKm(pts[j], pts[j + 1])
      return km
    }),
    [stops, legPointsFor, roadVersion] // eslint-disable-line react-hooks/exhaustive-deps
  )
  const totalKm = useMemo(() => legKm.reduce((a, b) => a + b, 0), [legKm])

  // --- Harita kurulumu ---------------------------------------------------
  useEffect(() => {
    // StrictMode dev'de effect'i iki kez calistirir; harita zaten varsa
    // ikinci WebGL context'ini kurma.
    if (mapRef.current || !mapContainer.current) return
    getLogoImage() // logoyu onceden yukle (video/PNG cizimi icin hazir olsun)
    getPinImage() // varis pini gorselini de onceden yukle
    let disposed = false // StrictMode/unmount: stil beklerken sokulduysek kurma
    ;(async () => {
      const style = await resolveStyle(theme)
      if (disposed || mapRef.current || !mapContainer.current) return
      // Konteyner sifir boyutluysa MapLibre sessizce 300px varsayilanina duser
      // ve overflow:hidden canvas'i kirptigi icin harita BOMBOS gorunur —
      // hicbir hata da firlatilmaz. CSS gerilemesi sessiz kalmasin.
      const box = mapContainer.current.getBoundingClientRect()
      if (box.width < 1 || box.height < 1) {
        console.error(
          `[harita] konteyner ${Math.round(box.width)}x${Math.round(box.height)} — ` +
          'CSS duzeni bozuk, harita cizilemez'
        )
      }
      const map = new maplibregl.Map({
        container: mapContainer.current,
        style,
        center: [29, 41],
        zoom: 3.2,
        preserveDrawingBuffer: true,
        attributionControl: { compact: true },
      })
      mapRef.current = map
      // Sessiz basarisizlik olmasin: stil/katman hatasi konsola dussun
      map.on('error', (e) => console.error('[harita]', e?.error?.message || e))
      map.on('load', () => addRouteLayers(map))
    })().catch((err) => {
      // Buraya dusmek harita HIC olusturulamadi demektir — kullaniciyi bos
      // bir panelle birakma, en azindan neden oldugunu bildir.
      console.error('[harita kurulumu]', err)
      if (!disposed) showToast(t('toastMapFailed'))
    })

    return () => {
      disposed = true
      cancelAnimationFrame(rafRef.current)
      mapRef.current?.remove()
      mapRef.current = null
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  function addRouteLayers(map) {
    if (!map.getSource('country-hl')) {
      map.addSource('country-hl', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      })
      // Dolgu — ulke icini parildatir
      map.addLayer({
        id: 'country-hl-fill',
        type: 'fill',
        source: 'country-hl',
        paint: {
          'fill-color': '#FFB547',
          'fill-opacity': 0, // animasyonla degistirilir
        },
      })
      // Sinir cizgisi — ulke konturunu parildatir
      map.addLayer({
        id: 'country-hl-line',
        type: 'line',
        source: 'country-hl',
        paint: {
          'line-color': '#FFC875',
          'line-width': 2.5,
          'line-opacity': 0, // animasyonla degistirilir
          'line-blur': 0.6,
        },
        layout: { 'line-cap': 'round', 'line-join': 'round' },
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
        lineMetrics: true, // line-gradient ile ilerleme cizimi icin gerekli
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
    let stale = false // hizli ardisik tema tiklamalarinda eski stil uygulanmasin
    resolveStyle(theme).then((style) => {
      if (stale || !mapRef.current) return
      map.setStyle(style)
      // 'styledata' stil tam oturmadan ve her kaynak yuklemesinde tetikleniyor;
      // 'style.load' ise stil TAMAMEN uygulandiktan sonra bir kez tetiklenir.
      map.once('style.load', () => {
        addRouteLayers(map)
        redrawPreview()
      })
    })
    return () => { stale = true }
  }, [theme]) // eslint-disable-line react-hooks/exhaustive-deps

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

  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    stopMarkersRef.current.forEach((m) => m.remove())
    stopMarkersRef.current = stops.map((s, i) => {
      const isLast = i === stops.length - 1 && stops.length > 1
      const el = document.createElement('div')
      el.title = s.name // tam ad: uzerine gelince ipucu (etiket yok, sade gorunum)
      if (isLast) {
        // VARIS: sadece ziplayan konum pini — metin/kisaltma yok
        el.className = 'arrival-pin'
        el.innerHTML = `<img class="arrival-img" src="/pin-arrival.png" alt="" width="44" height="44" />`
      } else if (i === 0) {
        el.className = 'dep-dot' // KALKIS: yesil nokta
      } else {
        el.className = 'via-dot' // ARA DURAK: kucuk amber nokta
      }
      return new maplibregl.Marker({ element: el, anchor: isLast ? 'bottom' : 'center' })
        .setLngLat([s.lng, s.lat])
        .addTo(map)
    })

    if (stops.length > 1 && !playing) {
      const b = new maplibregl.LngLatBounds()
      stops.forEach((s) => b.extend([s.lng, s.lat]))
      map.fitBounds(b, { padding: 90, duration: 800 })
    } else if (stops.length === 1) {
      map.easeTo({ center: [stops[0].lng, stops[0].lat], zoom: 6, duration: 800 })
    }
  }, [stops]) // eslint-disable-line react-hooks/exhaustive-deps

  // Onizleme cizimi ayri efekt: OSRM yol geometrisi geldikce (roadVersion)
  // yalnizca cizgi tazelenir — kamera/fitBounds TEKRAR tetiklenmez.
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    if (map.isStyleLoaded()) redrawPreview()
    // 'load' haritanin omrunde yalnizca BIR KEZ tetiklenir; stil degisimi
    // sirasinda buraya dusersek o callback bir daha hic calismazdi.
    else map.once('style.load', redrawPreview)
  }, [stops, legVehicles, roadVersion]) // eslint-disable-line react-hooks/exhaustive-deps

  // Ilk kullanim tanitimi (demo rota + adim adim harita hareketleri)
  const tour = useTour({
    mapRef, departure, arrival, midStops,
    setDeparture, setArrival, setShapePts,
    resetAnimation, clearAll, play,
  })
  const tourStep = tour.step

  // --- Rota bukme tutamaclari --------------------------------------------
  // Her bacagin ortasinda surukleneb ilir kucuk bir nokta: kullanici onu
  // cekerek rotanin o bacaginin hangi yonden gidecegini belirler
  // (TravelBoast'taki sari sekillendirme noktalari gibi).
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    handleMarkersRef.current.forEach((m) => m.remove())
    handleMarkersRef.current = []
    if (playing || stops.length < 2) return

    for (let i = 0; i < stops.length - 1; i++) {
      const from = stops[i]
      const to = stops[i + 1]
      const pts = legPointsFor(i)
      const mid = shapePts[i] || pts[Math.floor(pts.length / 2)]
      const el = document.createElement('div')
      el.className = 'bend-handle'
      el.title = t('bendHint')
      const mk = new maplibregl.Marker({ element: el, draggable: true })
        .setLngLat([mid.lng, mid.lat])
        .addTo(map)

      // Canli onizleme: surukleme sirasinda state'e DOKUNMADAN (marker'lar
      // yeniden kurulup drag'i kirmasin) yalnizca onizleme cizgisi guncellenir.
      // Yol araclarinda gecici Bezier gosterilir; birakinca OSRM via rotasina oturur.
      let raf = 0
      mk.on('drag', () => {
        if (raf) return
        raf = requestAnimationFrame(() => {
          raf = 0
          const cur = mk.getLngLat()
          const coords = []
          for (let j = 0; j < stops.length - 1; j++) {
            const jp = j === i
              ? bendPath(from, { lat: cur.lat, lng: cur.lng }, to)
              : legPointsFor(j)
            for (const p of jp) coords.push([p.lng, p.lat])
          }
          map.getSource('route-preview')?.setData({
            type: 'Feature',
            geometry: { type: 'LineString', coordinates: coords },
          })
        })
      })
      mk.on('dragend', () => {
        const p = mk.getLngLat()
        setShapePts((prev) => ({ ...prev, [i]: { lat: p.lat, lng: p.lng } }))
      })
      handleMarkersRef.current.push(mk)
    }
    return () => {
      handleMarkersRef.current.forEach((m) => m.remove())
      handleMarkersRef.current = []
    }
  }, [stops, legVehicles, shapePts, roadVersion, playing]) // eslint-disable-line react-hooks/exhaustive-deps

  // Durak sayisi/dongu degisince bacak index'leri kayar — bukmeler sifirlanir.
  // applyState (paylasilan/kayitli rota) yuklerken bayrakla korunur.
  useEffect(() => {
    if (hydratingRef.current) return
    setShapePts({})
  }, [stops.length])  

  // --- URL'den rota yukleme (ilk acilis) ---------------------------------
  useEffect(() => {
    setSaved(loadSaved())
    const r = readRouteFromUrl()
    if (r) applyState(r)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  function applyState(r) {
    if (!r?.stops?.length) return
    resetAnimation()
    hydratingRef.current = true
    setTimeout(() => { hydratingRef.current = false }, 0) // effect'ler islendikten sonra
    setShapePts(r.shapePts || {})
    setDeparture(r.stops[0] || null)
    setArrival(r.stops.length > 1 ? r.stops[r.stops.length - 1] : null)
    setMidStops(r.stops.slice(1, -1))
    setLegVehicles(r.legVehicles || [])
    setTheme(themeCfg(r.theme).id)
    setSpeed(r.speed || 1)
    setCamera(r.camera === 'fixed' ? 'fixed' : 'follow')
  }

  // --- Animasyon kontrol -------------------------------------------------
  function resetAnimation() {
    cancelAnimationFrame(rafRef.current)
    recorderRef.current?.stop()
    recorderRef.current = null
    posRef.current = null
    playingRef.current = false
    setPlaying(false)
    setCurrentLeg(-1)
    setStamps([]) // ekrandaki damgalari temizle
    // Ulke vurgusunu durdur ve temizle
    if (hlRafRef.current) { cancelAnimationFrame(hlRafRef.current); hlRafRef.current = null }
    lastCountryRef.current = null
    {
      const m = mapRef.current
      if (m) {
        if (m.getLayer('country-hl-fill')) m.setPaintProperty('country-hl-fill', 'fill-opacity', 0)
        if (m.getLayer('country-hl-line')) m.setPaintProperty('country-hl-line', 'line-opacity', 0)
        m.getSource('country-hl')?.setData({ type: 'FeatureCollection', features: [] })
      }
    }
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
    setShapePts({})
    setDeparture(null)
    setArrival(null)
    setMidStops([])
    setAddingMid(false)
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

  // Ulke gecisi: animasyonda yeni ulkeye girilince o ulkenin sinirini
  // harita uzerinde parildatir (yanip sonme). Pop-up yok — haritayla butunlesik.
  const lastCountryRef = useRef(null) // en son icinde olunan ISO2
  const hlRafRef = useRef(null) // aktif parildatma animasyon frame'i
  function highlightCountry(iso2) {
    const map = mapRef.current
    if (!map) return
    const feat = countryFeature(iso2)
    if (!feat) return
    const src = map.getSource('country-hl')
    if (!src) return
    src.setData(feat)

    // Onceki parildatmayi durdur
    if (hlRafRef.current) cancelAnimationFrame(hlRafRef.current)

    // ~2.4 sn boyunca 2.5 kez yanip sonen dolgu + kontur
    const DUR = 2400
    const PULSES = 2.5
    const FILL_MAX = 0.32
    const LINE_MAX = 0.95
    const t0 = performance.now()
    const tick = (now) => {
      const p = Math.min(1, (now - t0) / DUR)
      // Sinuzoidal parildama; genlik sona dogru zarfla soner
      const envelope = 1 - p // giderek zayifla
      const wave = (Math.sin(p * Math.PI * 2 * PULSES - Math.PI / 2) + 1) / 2 // 0..1
      const k = wave * envelope
      if (map.getLayer('country-hl-fill')) {
        map.setPaintProperty('country-hl-fill', 'fill-opacity', FILL_MAX * k)
      }
      if (map.getLayer('country-hl-line')) {
        map.setPaintProperty('country-hl-line', 'line-opacity', LINE_MAX * k)
      }
      if (p < 1) {
        hlRafRef.current = requestAnimationFrame(tick)
      } else {
        // Bitince temizle
        if (map.getLayer('country-hl-fill')) map.setPaintProperty('country-hl-fill', 'fill-opacity', 0)
        if (map.getLayer('country-hl-line')) map.setPaintProperty('country-hl-line', 'line-opacity', 0)
        src.setData({ type: 'FeatureCollection', features: [] })
        hlRafRef.current = null
      }
    }
    hlRafRef.current = requestAnimationFrame(tick)
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
    const applyStampImage = (img) => {
      stampRef.current = { id, img, born: performance.now(), rotate: data.rotate, left, top }
    }
    if (cache[svg]?.complete) {
      applyStampImage(cache[svg])
    } else {
      const img = cache[svg] || new Image()
      cache[svg] = img
      if (img.complete && img.src) {
        applyStampImage(img)
      } else {
        img.onload = () => applyStampImage(img)
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
    // playing state'i await sirasinda bayat kaliyor; senkron ref ile kilitle
    if (!map || stops.length < 2 || playingRef.current) return
    resetAnimation() // senkron; kilidi hemen ardindan kur
    playingRef.current = true

    // Yol araclarinin eksik bacaklarini animasyondan once cek
    const needRoads = stops.slice(0, -1).some((_, i) =>
      usesRoads(legVeh(i).id) &&
      roadNeedsFetch(roadKey(stops[i], stops[i + 1], shapePts[i] || null))
    )
    if (needRoads) {
      showToast(t('toastFetchingRoads'))
      await ensureLegs()
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
    // prefixKm[i]   = 0..i-1 bacaklarinin toplam km'si (sayac icin)
    // Her bacak icin mercator kumulatif uzunluk (cumM) hesaplanir; gradient
    // esigi bu metrikle bulunur ki cizgi ucu line-progress ile ayni hizada olsun.
    const prefixKm = [0]
    const prefixMerc = [0]
    const fullCoords = []
    for (let i = 0; i < legs.length; i++) {
      prefixKm.push(prefixKm[i] + legs[i].km)
      const cs = legs[i].coords
      const cumM = new Float64Array(cs.length)
      for (let j = 1; j < cs.length; j++) cumM[j] = cumM[j - 1] + mercSeg(cs[j - 1], cs[j])
      legs[i].cumM = cumM
      legs[i].merc = cumM[cs.length - 1]
      prefixMerc.push(prefixMerc[i] + legs[i].merc)
      for (let j = 0; j < cs.length; j++) fullCoords.push(cs[j])
    }
    const totalMerc = prefixMerc[legs.length] || 1

    // Tam rota geometrisi TEK SEFERDE yuklenir; animasyon boyunca setData YOK.
    src?.setData({ type: 'Feature', geometry: { type: 'LineString', coordinates: fullCoords } })
    setProgressFrac(map, 0)

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
      recorderRef.current = startRecorder(map, stops, posRef, realTotalKm, format, sub, stampRef, author)
      if (!recorderRef.current) {
        alert(t('recorderUnsupported'))
      }
    }

    let zoom = legs[0].zoomCity
    let bearing = legs[0].points[0].bearing
    let pitch = PITCH_CITY // sinematik egim (yumusak takip edilir)
    const followCam = camera === 'follow'
    if (followCam) {
      map.easeTo({ center: legs[0].coords[0], zoom, pitch, bearing: 0, duration: 600 })
    } else {
      // Sabit kamera: rota bastan tek karede — animasyon boyunca kamera hic
      // oynamaz, YENI KARO YUKLENMEZ. En akici mod; kayitta da titremesiz.
      const b = new maplibregl.LngLatBounds()
      stops.forEach((s) => b.extend([s.lng, s.lat]))
      map.fitBounds(b, { padding: 100, duration: 600, pitch: 0, bearing: 0 })
    }

    const start = performance.now() + 650
    let lastLeg = 0
    let finished = false
    let lastFrac = -1 // gradient guncelleme esigi (gereksiz paint cagrisi olmasin)

    // Ulke gecisi takibi: baslangic noktasinin ulkesini sessizce kaydet
    // (baslangicta pop-up gostermeyiz; ilk gecisten itibaren gosteririz)
    lastCountryRef.current = countryAt(legs[0].coords[0][0], legs[0].coords[0][1])
    let borderThrottle = 0

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

      // Cizilen rota: gradient esigi guncellenir (geometri zaten GPU'da).
      // Bacak icinde alt-segman enterpolasyonu ile uc, araca tam oturur.
      const posF = tE * (leg.points.length - 1)
      const segT = posF - idx
      const cm = leg.cumM
      const within = cm[idx] + (idx + 1 < cm.length ? (cm[idx + 1] - cm[idx]) * segT : 0)
      const frac = (prefixMerc[legIdx] + within) / totalMerc
      if (frac - lastFrac >= 0.0015) {
        lastFrac = frac
        setProgressFrac(map, frac)
      }

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
          if (lastCountryRef.current !== null) highlightCountry(iso)
          lastCountryRef.current = iso
        }
      }

      // Kat edilen mesafe: on-hesaplanmis prefix + mevcut bacagin orani.
      // Panel gostergesi ayri bir LiveDistance bileseni tarafindan posRef'ten
      // okunur; burada React state'i guncellemiyoruz (App yeniden render olmaz).
      const done_km = prefixKm[legIdx] + leg.km * tE

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

      if (followCam) {
        const targetZoom =
          leg.zoomCity + (leg.zoomCruise - leg.zoomCity) * Math.sin(Math.PI * tE)
        zoom += (targetZoom - zoom) * 0.06
        // Sinematik egim: seyirde daha egik, durak yaklasiminda biraz duzelir
        const targetPitch =
          PITCH_CITY + (PITCH_CRUISE - PITCH_CITY) * Math.sin(Math.PI * tE)
        pitch += (targetPitch - pitch) * 0.06
        map.jumpTo({ center: [p.lng, p.lat], zoom, pitch, bearing: 0 })
      }

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
        setProgressFrac(map, 1) // cizgiyi tamamen goster
        const last = stops[stops.length - 1]
        popPin(stops.length - 1)
        celebrate([last.lng, last.lat])
        dropStamp(last) // son varis damgasi
        setRing(null)
        playingRef.current = false
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
        // Bitiste kamera duzlesir (pitch 0) ve tum rotayi tek karede gosterir.
        // Sabit kamerada zaten o karedeyiz — gereksiz hareket yapma.
        if (followCam) {
          setTimeout(() => map.fitBounds(b, { padding: 90, duration: 1800, pitch: 0, bearing: 0, essential: true }), 700)
        }
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
    await ensureLegs() // eksik yol bacaklarini once cek
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
    setProgressFrac(map, 1) // onceki animasyondan kalan esik cizgiyi kirpmasin
    const b = new maplibregl.LngLatBounds()
    stops.forEach((s) => b.extend([s.lng, s.lat]))
    map.fitBounds(b, { padding: 110, duration: 0 })
    const sub = `${stops[0].name} → ${stops[stops.length - 1].name}`
    const { downloadImage } = await import('./capture.js')
    await downloadImage(map, stops, realTotal, format, sub, author)
  }

  // --- Paylasim & kaydetme ----------------------------------------------
  function currentState() {
    return { stops, legVehicles, theme, speed, camera, shapePts }
  }

  async function handleShare() {
    if (stops.length < 2) return
    const url = shareUrl(currentState())
    try {
      await navigator.clipboard.writeText(url)
      showToast(t('toastLinkCopied'))
    } catch {
      window.prompt(t('sharePrompt'), url)
    }
  }

  function handleSave() {
    if (stops.length < 2) return
    const def = `${stops[0].name} → ${stops[stops.length - 1].name}`
    const name = window.prompt(t('routeNamePrompt'), def)
    if (name === null) return
    saveRoute(name, currentState())
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

        <div className={tourStep === 1 ? 'tour-hl' : undefined}>
        <SearchBox
          label={t('departureLabel')}
          value={departure}
          placeholder={t('departurePh')}
          onPick={setDeparture}
          onClear={() => { setDeparture(null); resetAnimation() }}
          disabled={playing}
        />
        </div>
        <div className={tourStep === 2 ? 'tour-hl' : undefined}>
        <SearchBox
          label={t('arrivalLabel')}
          value={arrival}
          placeholder={t('arrivalPh')}
          onPick={setArrival}
          onClear={() => { setArrival(null); resetAnimation() }}
          disabled={playing}
        />
        </div>

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
        {stops.length > 1 && (
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
              const tag = i === 0 ? t('tagDep') : isLastUnique ? t('tagArr') : t('tagVia')
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
        <div className={`vehicles ${tourStep === 4 ? 'tour-hl' : ''}`}>
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
            <span className="opt-label">{t('cameraLabel')}</span>
            <div className="seg">
              <button className={camera === 'follow' ? 'on' : ''} disabled={playing} onClick={() => setCamera('follow')}>{t('cameraFollow')}</button>
              <button className={camera === 'fixed' ? 'on' : ''} disabled={playing} onClick={() => setCamera('fixed')}>{t('cameraFixed')}</button>
            </div>
          </div>
          <div className="opt">
            <span className="opt-label">{t('mapLabel')}</span>
            <div className="seg">
              {Object.values(THEMES).map((th) => (
                <button key={th.id} className={theme === th.id ? 'on' : ''} disabled={playing} onClick={() => setTheme(th.id)}>{th.label}</button>
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
                <button key={f.id} className={format === f.id ? 'on' : ''} disabled={playing} onClick={() => setFormat(f.id)}>{f.label}</button>
              ))}
            </div>
          </div>
        </div>

        <div className={`actions ${tourStep === 5 ? 'tour-hl' : ''}`}>
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

      {/* Damgalar haritanin USTUNDE konumlanmali: yuzde degerleri harita
          alanina gore olculur. Eskiden .app'e (360px panel dahil) goreydi,
          bu yuzden ekrandaki damga video/PNG ciktisindakinden farkli yere
          dusuyordu; mobilde panelin uzerine tasabiliyordu. */}
      <div className="map-wrap">
        <div ref={mapContainer} className="map" />
        {stamps.map((s) => (
          <div
            key={s.id}
            className="passport-stamp"
            style={{ left: `${s.left}%`, top: `${s.top}%`, '--stamp-rot': `${s.rotate}deg` }}
            dangerouslySetInnerHTML={{ __html: s.svg }}
          />
        ))}
      </div>
      <TourCard step={tourStep} onNext={tour.next} onSkip={tour.finish} />
      {toast && <div className="toast">{toast}</div>}
    </div>
  )
}
