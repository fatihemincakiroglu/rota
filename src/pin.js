// Varis noktasi pini (kullanicinin sagladigi konum ikonu).
// Ekranda DOM marker olarak, video/PNG cikisinda canvas'a cizilerek kullanilir.
// logo.js ile ayni tembel-yukleme deseni.

export const PIN_URL = '/pin-arrival.png'

let _img = null
let _ready = false
export function getPinImage() {
  if (_img) return _img
  const img = new Image()
  img.crossOrigin = 'anonymous'
  img.onload = () => { _ready = true }
  img.src = PIN_URL
  _img = img
  return img
}
export function pinReady() {
  return _ready && _img && _img.complete && _img.naturalWidth > 0
}
