// "Atlas" temasi — MapBoast'un imza premium gorunumu.
// CARTO Positron stil JSON'u calisma aninda cekilip donusturulur:
//   * parsomen/krem zemin + vintage celik-turkuaz su (seyahat posteri paleti)
//   * POI / magaza / toplu tasima ikonlari gizlenir (dekluttering = premium his)
//   * AWS acik yukseklik verisiyle KABARTMA (hillshade) — daglara derinlik
// Ucretsiz, API anahtari gerektirmez. Sonuc onbelleklenir (tema gecisi hizli).

const BASE = 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json'

// AWS Terrain Tiles (acik veri, anahtarsiz) — terrarium kodlamali DEM
const DEM_TILES = 'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png'

// Palet — sitenin krem arayuzuyle (#fdf7f2) butunlesik "seyahat atlasi" tonlari
const P = {
  land: '#f4ecdd',      // parsomen zemin
  landAlt: '#efe6d4',   // ikincil zemin dokusu
  water: '#a9c6cc',     // vintage celik-turkuaz
  waterLine: '#93b4bb',
  waterText: '#5f858f',
  green: '#d9e2c8',     // adacayi yesili (park/orman)
  building: '#e9dfcc',
  road: '#d8cbb4',      // sicak yol tonu
  roadMajor: '#c3b193', // otoyol/ana arter biraz koyu
  border: '#b39c80',    // ulke/il siniri
  text: '#57493a',      // etiket murekkebi
  textBig: '#453827',   // ulke/buyuk sehir
  halo: '#f4ecdd',
  hillShadow: '#8f7c63',
}

// id + source-layer icinde arama (stil surumleri arasi dayanikli eslesme)
const has = (l, s) => (l.id + ' ' + (l['source-layer'] || '')).toLowerCase().includes(s)
const anyOf = (l, arr) => arr.some((s) => has(l, s))
const setPaint = (l, k, v) => { l.paint = { ...(l.paint || {}), [k]: v } }
const hide = (l) => { l.layout = { ...(l.layout || {}), visibility: 'none' } }

function transform(style) {
  for (const l of style.layers) {
    if (l.type === 'background') {
      setPaint(l, 'background-color', P.land)
    } else if (l.type === 'fill') {
      if (has(l, 'water')) setPaint(l, 'fill-color', P.water)
      else if (anyOf(l, ['park', 'green', 'wood', 'grass', 'forest', 'landcover', 'landuse', 'cemetery', 'pitch'])) {
        setPaint(l, 'fill-color', P.green)
      } else if (has(l, 'building')) setPaint(l, 'fill-color', P.building)
      else setPaint(l, 'fill-color', P.landAlt)
    } else if (l.type === 'line') {
      if (has(l, 'water')) setPaint(l, 'line-color', P.waterLine)
      else if (anyOf(l, ['boundary', 'admin'])) setPaint(l, 'line-color', P.border)
      else if (anyOf(l, ['motorway', 'trunk', 'primary', 'major'])) setPaint(l, 'line-color', P.roadMajor)
      else if (anyOf(l, ['transport', 'road', 'highway', 'street', 'bridge', 'tunnel', 'rail', 'path', 'minor'])) {
        setPaint(l, 'line-color', P.road)
      }
    } else if (l.type === 'symbol') {
      // Kalabalik yaratan her sey gizli: POI, kapi no, toplu tasima, havaalani ikonu
      if (anyOf(l, ['poi', 'housenumber', 'house_num', 'transit', 'airport', 'aero', 'ferry', 'station'])) {
        hide(l)
        continue
      }
      const big = anyOf(l, ['country', 'state', 'capital', 'city'])
      setPaint(l, 'text-color', has(l, 'water') ? P.waterText : big ? P.textBig : P.text)
      setPaint(l, 'text-halo-color', P.halo)
      setPaint(l, 'text-halo-width', 1.2)
    }
  }

  // Kabartma (hillshade): etiketlerin ALTINA, zemin dolgularin USTUNE girer.
  // Kaynak hatasi olsa bile harita calismaya devam eder (karo hatalari olumcul degil).
  style.sources['mb-dem'] = {
    type: 'raster-dem',
    tiles: [DEM_TILES],
    encoding: 'terrarium',
    tileSize: 256,
    maxzoom: 13,
    attribution: 'Terrain: AWS Open Data / Mapzen',
  }
  const firstSymbol = style.layers.findIndex((l) => l.type === 'symbol')
  const hillshade = {
    id: 'mb-hillshade',
    type: 'hillshade',
    source: 'mb-dem',
    paint: {
      'hillshade-exaggeration': 0.32,
      'hillshade-shadow-color': P.hillShadow,
      'hillshade-highlight-color': '#ffffff',
      'hillshade-accent-color': P.hillShadow,
    },
  }
  if (firstSymbol >= 0) style.layers.splice(firstSymbol, 0, hillshade)
  else style.layers.push(hillshade)

  return style
}

let cached = null
let inflight = null
export function atlasStyle() {
  if (cached) return Promise.resolve(cached)
  if (inflight) return inflight
  inflight = fetch(BASE)
    .then((r) => r.json())
    .then((json) => { cached = transform(json); return cached })
    .catch(() => {
      // Ag hatasi: donusum yapilamazsa duz Positron URL'ine dus — harita bos kalmasin
      inflight = null
      return BASE
    })
  return inflight
}
