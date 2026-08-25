// Tema stillerinin ortak yukleyicisi (joy.js ve atlas.js bunu kullanir).
//
// Neden ayri bir modul: iki tema da ayni onbellek + fetch kodunu birebir
// kopyalamisti ve ikisinde de ayni iki hata vardi:
//
//  1. fetch'in ZAMAN ASIMI YOKTU. Harita kurulumu bu promise'i bekledigi icin
//     CDN takildiginda promise hic cozulmuyor, new maplibregl.Map() satirina
//     hic ulasilmiyor ve harita alani kalici olarak bos kaliyordu.
//  2. Onbellek TEK BIR NESNE tutuyordu. MapLibre kendisine verilen stil
//     nesnesini sahiplenip uzerinde degisiklik yapar; ayni nesneyi ikinci kez
//     setStyle'a vermek (tema degistirip geri donunce) bozuk stil uretebilir.

const TIMEOUT_MS = 6000

// Yapisal dogrulama: CDN hata sayfasi/bos yanit dondurduyse donusume sokma
const looksLikeStyle = (j) => j && Array.isArray(j.layers) && j.sources

/**
 * @param base      stil JSON'unun URL'i
 * @param transform (styleJson) => styleJson — temanin boyama fonksiyonu
 * @returns () => Promise<styleNesnesi | urlString>
 *
 * Hata/zaman asimi durumunda ham URL doner: MapLibre onu kendisi indirir,
 * tema boyamasi olmaz ama HARITA GORUNUR. Bos ekrandan iyidir.
 */
export function makeStyleLoader(base, transform) {
  let cached = null
  let inflight = null

  return function loadStyle() {
    // Her cagriya taze bir kopya: MapLibre verilen nesneyi degistirir
    if (cached) return Promise.resolve(structuredClone(cached))
    if (inflight) return inflight

    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS)

    inflight = fetch(base, { signal: ctrl.signal })
      .then((r) => {
        if (!r.ok) throw new Error(`stil ${r.status}`)
        return r.json()
      })
      .then((json) => {
        if (!looksLikeStyle(json)) throw new Error('beklenmeyen stil bicimi')
        cached = transform(json)
        return structuredClone(cached)
      })
      .catch(() => base) // ag hatasi/zaman asimi: duz stile dus, harita bos kalmasin
      .finally(() => {
        clearTimeout(timer)
        inflight = null // basarisizsa sonraki denemede tekrar sansi olsun
      })

    return inflight
  }
}
