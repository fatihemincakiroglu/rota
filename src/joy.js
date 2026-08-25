// "Kagit" temasi — editoryal seyahat haritasi gorunumu.
// CARTO Positron tabani calisma aninda boyanir.
//
// Tasarim ilkesi: zemin DUSUK doygunlukta kalir, renk yalnizca aksanda olur.
// Uygulamanin aksanlari mercan rota cizgisi (#FF6B5B) ve kehribar ulke
// vurgusudur (#FFB547); sicak kagit + kul yesili + fume teal bunlarin altinda
// sessiz kalir ve onlari one cikarir. Onceki canli yesil/camgobegi palet ayni
// tonal araligi paylastigi icin aksanlarla yarisiyor, harita da cizgi film
// gibi duruyordu.

import { makeStyleLoader } from './styleCache.js'

const BASE = 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json'

const P = {
  land: '#F4EFE6',      // sicak kagit
  landAlt: '#EFE9DD',   // bir ton koyu — duz zemin yerine hafif doku
  green: '#DFE5D2',     // park/orman: kul yesili, gozu yormaz
  sand: '#EDE4D2',      // col/kumluk
  water: '#A9C6CC',     // fume teal — mercan rotanin tamamlayicisi
  waterLine: '#93B4BC',
  building: '#E7DFD0',
  road: '#FFFFFF',      // kagit uzerinde net beyaz yollar
  roadMajor: '#F0E2C6', // ana arterler sicak kum
  border: '#CBBEA8',    // sinirlar: yumusak, opaklik ile geri cekilir
  text: '#5E5647',      // sicak murekkep
  textMinor: '#8C8371', // kucuk yer adlari daha soluk
  halo: '#F8F4EC',      // hale = kagit rengi (mavi hale kirli gosteriyordu)
}

const has = (l, s) => (l.id + ' ' + (l['source-layer'] || '')).toLowerCase().includes(s)
const anyOf = (l, arr) => arr.some((s) => has(l, s))
const setPaint = (l, k, v) => { l.paint = { ...(l.paint || {}), [k]: v } }
const setLayout = (l, k, v) => { l.layout = { ...(l.layout || {}), [k]: v } }
const hide = (l) => setLayout(l, 'visibility', 'none')

// Ulke duzeyi mi? (sinir kalinligi ve murekkep tonu bunlara ozel)
const isCountry = (l) => anyOf(l, ['country', 'admin_0', 'admin-0'])

function transform(style) {
  for (const l of style.layers) {
    if (l.type === 'background') {
      setPaint(l, 'background-color', P.land)
    } else if (l.type === 'fill') {
      if (has(l, 'water')) setPaint(l, 'fill-color', P.water)
      else if (anyOf(l, ['sand', 'desert', 'beach'])) setPaint(l, 'fill-color', P.sand)
      else if (anyOf(l, ['park', 'green', 'wood', 'grass', 'forest', 'landcover', 'landuse', 'cemetery', 'pitch'])) {
        setPaint(l, 'fill-color', P.green)
        setPaint(l, 'fill-opacity', 0.55) // kagit tonu altindan gecsin
      } else if (has(l, 'building')) setPaint(l, 'fill-color', P.building)
      else setPaint(l, 'fill-color', P.landAlt)
    } else if (l.type === 'line') {
      if (has(l, 'water')) setPaint(l, 'line-color', P.waterLine)
      else if (anyOf(l, ['boundary', 'admin'])) {
        // Sinirlar okunur ama one cikmaz. Onceki beyaz + tam opaklik
        // haritayi bir izgara gibi gosteriyordu.
        setPaint(l, 'line-color', P.border)
        setPaint(l, 'line-opacity', isCountry(l) ? 0.55 : 0.28)
        setPaint(l, 'line-width', isCountry(l) ? 0.9 : 0.6)
      } else if (anyOf(l, ['motorway', 'trunk', 'primary', 'major'])) {
        setPaint(l, 'line-color', P.roadMajor)
      } else if (anyOf(l, ['transport', 'road', 'highway', 'street', 'bridge', 'tunnel', 'rail', 'path', 'minor'])) {
        setPaint(l, 'line-color', P.road)
      }
    } else if (l.type === 'symbol') {
      if (anyOf(l, ['poi', 'housenumber', 'house_num', 'transit', 'airport', 'aero', 'ferry', 'station'])) {
        hide(l)
        continue
      }
      const country = isCountry(l)
      setPaint(l, 'text-color', country ? P.text : P.textMinor)
      setPaint(l, 'text-halo-color', P.halo)
      setPaint(l, 'text-halo-width', 1.4)
      setPaint(l, 'text-halo-blur', 0.4)
      // Genis harf araligi kucuk puntoda "haritavari" bir tipografi verir;
      // ulke adlari zaten buyuk harf geldigi icin en cok orada ise yarar.
      if (country) setLayout(l, 'text-letter-spacing', 0.16)
    }
  }
  return style
}

export const joyStyle = makeStyleLoader(BASE, transform)
