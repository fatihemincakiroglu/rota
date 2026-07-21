// Gunduz/gece siniri (terminator): Dunya uzerinde guneşin aydinlattigi yari
// ile karanlik yarinin ayrimi. Verilen bir zaman icin, gece tarafini kaplayan
// bir GeoJSON coklgeni uretir; harita uzerine yari saydam koyu katman olarak
// cizilir. Rota ilerledikce "zaman" ilerletilerek golge kayar.

// Gunes'in belirli bir UTC zamaninda tam tepede oldugu nokta (subsolar point):
// enlem = gunes deklinasyonu, boylam = gunes saat acisindan.
function subsolarPoint(date) {
  const rad = Math.PI / 180
  const deg = 180 / Math.PI

  // Gunlerin J2000'den beri sayisi
  const jd = date.getTime() / 86400000 + 2440587.5
  const n = jd - 2451545.0

  // Ortalama boylam ve anomali (derece)
  const L = (280.46 + 0.9856474 * n) % 360
  const g = ((357.528 + 0.9856003 * n) % 360) * rad
  // Ekliptik boylam
  const lambda = (L + 1.915 * Math.sin(g) + 0.020 * Math.sin(2 * g)) * rad
  // Egiklik
  const eps = (23.439 - 0.0000004 * n) * rad

  // Deklinasyon
  const decl = Math.asin(Math.sin(eps) * Math.sin(lambda)) * deg

  // Greenwich ortalama yildiz zamani -> subsolar boylam
  const gmst = (18.697374558 + 24.06570982441908 * n) % 24 // saat
  const eqTimeLon = -gmst * 15 // her saat 15°
  // Subsolar boylam: guneşin tam tepede oldugu boylam
  let lon = eqTimeLon + 180
  // düzeltme: ekliptik boylam kaynakli
  lon = ((lon % 360) + 540) % 360 - 180

  return { lat: decl, lng: lon }
}

// Gece tarafini kaplayan coklgen: subsolar noktanin tam karsisindaki
// (antipod) merkezli, 90° yaricaplı daire, kaba bir kucuk-daire olarak.
// Harita duz oldugundan, gece bolgesini enlem seridi bantlariyla yaklasik
// olusturmak yerine, boylam boyunca gece sinirini (terminator egrisi) hesaplayip
// alt/ust kapatan bir coklgen kuruyoruz.
export function nightPolygon(date) {
  const rad = Math.PI / 180
  const deg = 180 / Math.PI
  const sun = subsolarPoint(date)
  const decl = sun.lat * rad

  // Terminator: her boylam icin, guneşin ufukta oldugu enlem.
  // lat = atan( -cos(H) / tan(decl) )  ; H = lon - subsolar_lon (saat acisi)
  const pts = []
  const step = 2
  for (let lon = -180; lon <= 180; lon += step) {
    const H = (lon - sun.lng) * rad
    let lat
    if (Math.abs(decl) < 1e-6) {
      lat = 0
    } else {
      lat = Math.atan(-Math.cos(H) / Math.tan(decl)) * deg
    }
    pts.push([lon, lat])
  }

  // Gece tarafi: deklinasyon pozitifse (kuzey yazi) gece GUNEY kutbunu icerir.
  // Coklgeni terminator + uygun kutup kenariyla kapat.
  const southShadow = decl > 0 // kuzey yazinda gece guneyde yogun
  const edgeLat = southShadow ? -90 : 90
  const ring = [...pts]
  // kenar boyunca kutba in ve geri don
  ring.push([180, edgeLat])
  ring.push([-180, edgeLat])
  ring.push(pts[0])

  return {
    type: 'Feature',
    geometry: { type: 'Polygon', coordinates: [ring] },
    properties: {},
  }
}

// Rota animasyonu icin: baslangic zamanina, ilerlemeye (0..1) gore kayan
// bir "sanal saat". toplam gun sayisi kadar zaman gecirir (varsayilan 1 gun).
export function clockForProgress(baseDate, progress, spanHours = 24) {
  return new Date(baseDate.getTime() + progress * spanHours * 3600 * 1000)
}
