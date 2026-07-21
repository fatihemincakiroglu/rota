// MapBoast logosu — harita disa aktariminda (video/PNG) sol ust koseye cizilir.
// Gercek logo dosyasi public/mapboast-logo.png olarak yerlestirilmistir.
// Bir kez yuklenip tekrar kullanilan Image nesnesi (canvas cizimi icin).

export const LOGO_URL = '/mapboast-logo.png'

let _img = null
let _ready = false
export function getLogoImage() {
  if (_img) return _img
  const img = new Image()
  img.crossOrigin = 'anonymous'
  img.onload = () => { _ready = true }
  img.src = LOGO_URL
  _img = img
  return img
}
export function logoReady() {
  return _ready && _img && _img.complete && _img.naturalWidth > 0
}
