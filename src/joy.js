// "Neseli" temasi — TravelBoast/Apple Maps tarzi canli cizgi film gorunumu.
// (Birebir o harita Apple Maps'tir ve ucretlidir; bu, ayni hissi veren
// ucretsiz esdegerdir.) CARTO Positron tabani calisma aninda boyanir:
// parlak camgobegi deniz, canli yesil kara, beyaz oyunlu etiketler,
// POI kalabaligi tamamen gizli.

const BASE = 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json'

const P = {
  land: '#8fd473',      // canli cimen yesili
  landAlt: '#9cda7f',
  water: '#3cc0ee',     // parlak camgobegi
  waterLine: '#2fb2e2',
  green: '#79c95e',     // orman/park biraz koyu yesil
  building: '#a5de8a',
  road: '#eef7e4',      // yumusak beyaz yollar
  roadMajor: '#ffd76e', // ana arterler oyunlu amber
  border: '#f2fbff',    // sinirlar beyazimsi
  text: '#ffffff',
  halo: '#4aa3c9',      // etiket golgesi (deniz mavisiyle uyumlu)
}

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
      if (anyOf(l, ['poi', 'housenumber', 'house_num', 'transit', 'airport', 'aero', 'ferry', 'station'])) {
        hide(l)
        continue
      }
      setPaint(l, 'text-color', P.text)
      setPaint(l, 'text-halo-color', P.halo)
      setPaint(l, 'text-halo-width', 1.6)
    }
  }
  return style
}

let cached = null
let inflight = null
export function joyStyle() {
  if (cached) return Promise.resolve(cached)
  if (inflight) return inflight
  inflight = fetch(BASE)
    .then((r) => r.json())
    .then((json) => { cached = transform(json); return cached })
    .catch(() => {
      inflight = null
      return BASE // ag hatasi: duz stile dus, harita bos kalmasin
    })
  return inflight
}
