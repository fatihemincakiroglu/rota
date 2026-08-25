// "Atlas" temasi — MapBoast'un imza premium gorunumu.
// CARTO Positron stil JSON'u calisma aninda cekilip donusturulur:
//   * yesil kara + mavi deniz (premium doga paleti)
//   * POI / magaza / toplu tasima ikonlari gizlenir (dekluttering = premium his)
//   * AWS acik yukseklik verisiyle KABARTMA (hillshade) — daglara derinlik
// Ucretsiz, API anahtari gerektirmez. Sonuc onbelleklenir (tema gecisi hizli).

import { makeStyleLoader } from './styleCache.js'

const BASE = 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json'

// AWS Terrain Tiles (acik veri, anahtarsiz) — terrarium kodlamali DEM
const DEM_TILES = 'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png'

// Palet — sitenin krem arayuzuyle (#fdf7f2) butunlesik "seyahat atlasi" tonlari
const P = {
  land: '#cde4b4',      // yumusak cimen yesili zemin
  landAlt: '#c3ddab',   // ikincil zemin dokusu
  water: '#79b7d9',     // derin ama yumusak deniz mavisi
  waterLine: '#68a8cc',
  waterText: '#3f7ea3',
  green: '#a8cf8d',     // orman/park biraz koyu yesil
  building: '#bcd6a2',
  road: '#eef3e6',      // acik yollar
  roadMajor: '#ffffff', // ana arterler beyaz serit
  border: '#8fae94',    // yesilimsi gri sinirlar
  text: '#2f5136',      // koyu yesil murekkep
  textBig: '#1f3d2a',   // ulke/buyuk sehir
  halo: '#eef5e4',
  hillShadow: '#5c7a5e', // kabartma golgesi yesil-gri (kahverengi degil)
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

export const atlasStyle = makeStyleLoader(BASE, transform)
