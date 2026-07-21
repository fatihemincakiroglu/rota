// Disa aktarma araclari: harita canvas'ini pinler ve aracla birlestirip
// PNG gorsel veya WebM/MP4 video olarak indirir.
// Farkli en-boy oranlari (yatay, 9:16, 1:1, 4:5) desteklenir.

import { t, fmtNum } from './i18n.js'
import { getLogoImage, logoReady } from './logo.js'
import { FORMATS } from './formats.js'

// FORMATS artik formats.js'te; geriye donuk uyumluluk icin yeniden disari ver
export { FORMATS }

// Belirli bir formata gore cikti tuvali boyutu + harita canvas'ini "cover"
// mantigiyla yerlestiren yardimci. map(px,py) harita canvas pikselini
// cikti pikseline cevirir; k global olcek katsayisidir (yazi/pin boyutu icin).
function layoutFor(map, format) {
  const mapCanvas = map.getCanvas()
  const sw = mapCanvas.width
  const sh = mapCanvas.height
  const dpr = sw / map.getContainer().clientWidth // ~device pixel ratio

  if (!format || !format.w) {
    return {
      outW: sw,
      outH: sh,
      drawMap: (ctx) => ctx.drawImage(mapCanvas, 0, 0),
      project: (px, py) => ({ x: px, y: py }),
      k: dpr,
    }
  }

  const outW = format.w
  const outH = format.h
  // cover: harita ciktiyi doldursun, tasan kisim kirpilsin
  const scale = Math.max(outW / sw, outH / sh)
  const dw = sw * scale
  const dh = sh * scale
  const dx = (outW - dw) / 2
  const dy = (outH - dh) / 2

  return {
    outW,
    outH,
    drawMap: (ctx) => ctx.drawImage(mapCanvas, 0, 0, sw, sh, dx, dy, dw, dh),
    project: (px, py) => ({ x: dx + px * scale, y: dy + py * scale }),
    // pin/yazi olcegini cikti cozunurlugune oranla (dikeyde biraz buyut)
    k: (outW / 1080) * 1.6,
  }
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

function saveBlob(blob, filename) {
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = filename
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 5000)
}

// Durak pinleri + arac emojisini 2D tuvale cizer
function drawOverlays(ctx, map, L, stops, vehiclePos) {
  const k = L.k

  stops.forEach((s) => {
    const pr = map.project([s.lng, s.lat])
    const { x, y } = L.project(pr.x, pr.y)
    const label = s.name
    ctx.font = `600 ${12.5 * k}px "IBM Plex Mono", monospace`
    const tw = ctx.measureText(label).width
    const h = 24 * k
    const w = tw + 34 * k
    const rx = x - w / 2
    const ry = y - h - 12 * k

    roundRect(ctx, rx, ry, w, h, h / 2)
    ctx.fillStyle = 'rgba(11,17,32,0.92)'
    ctx.fill()
    ctx.strokeStyle = '#FFB547'
    ctx.lineWidth = 1.5 * k
    ctx.stroke()

    ctx.fillStyle = '#FFB547'
    ctx.beginPath()
    ctx.arc(rx + 13 * k, ry + h / 2, 5 * k, 0, Math.PI * 2)
    ctx.fill()

    ctx.fillStyle = '#F2EDE3'
    ctx.textAlign = 'left'
    ctx.textBaseline = 'middle'
    ctx.fillText(label, rx + 23 * k, ry + h / 2 + 1 * k)

    ctx.fillStyle = '#FFB547'
    ctx.beginPath()
    ctx.arc(x, y, 4 * k, 0, Math.PI * 2)
    ctx.fill()
  })

  if (vehiclePos) {
    const pr = map.project([vehiclePos.lng, vehiclePos.lat])
    const { x, y } = L.project(pr.x, pr.y)
    ctx.save()
    ctx.translate(x, y)
    if (vehiclePos.rotate) {
      const bearing = vehiclePos.bearing
      const faces = vehiclePos.faces ?? 45
      let angle = bearing - faces
      const dir = ((bearing % 360) + 360) % 360
      const goingRight = dir > 0 && dir < 180
      if (vehiclePos.flip && goingRight) {
        // Dikey flip + duzeltilmis aci (DOM'daki scaleY(-1) rotate ile ayni)
        ctx.scale(1, -1)
        ctx.rotate((-angle * Math.PI) / 180)
      } else {
        ctx.rotate((angle * Math.PI) / 180)
      }
    }
    ctx.font = `${34 * k}px serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.shadowColor = 'rgba(0,0,0,0.5)'
    ctx.shadowBlur = 8 * k
    ctx.fillText(vehiclePos.emoji, 0, 0)
    ctx.restore()

    // Aracin altinda ilerleyen (artan) km sayaci
    if (vehiclePos.traveledKm != null && !vehiclePos.done) {
      const km = `${fmtNum(vehiclePos.traveledKm)} km`
      ctx.font = `700 ${13 * k}px "IBM Plex Mono", monospace`
      const tw = ctx.measureText(km).width
      const bw = tw + 20 * k
      const bh = 22 * k
      const bx = x - bw / 2
      const by = y + 22 * k
      roundRect(ctx, bx, by, bw, bh, bh / 2)
      ctx.fillStyle = 'rgba(255,107,91,0.95)'
      ctx.fill()
      ctx.fillStyle = '#1a0f0c'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(km, x, by + bh / 2 + 0.5 * k)
    }
  }
}

// Rota bitince kirmizi cizginin uzerine toplam km etiketi (rota ortasinda)
function drawTotalLabel(ctx, map, L, stops, totalKm) {
  if (!stops.length || !totalKm) return
  const k = L.k
  // Rota kutusunun orta noktasi
  let minLat = 90, maxLat = -90, minLng = 180, maxLng = -180
  stops.forEach((s) => {
    minLat = Math.min(minLat, s.lat); maxLat = Math.max(maxLat, s.lat)
    minLng = Math.min(minLng, s.lng); maxLng = Math.max(maxLng, s.lng)
  })
  const mid = { lng: (minLng + maxLng) / 2, lat: (minLat + maxLat) / 2 }
  const pr = map.project([mid.lng, mid.lat])
  const { x, y } = L.project(pr.x, pr.y)

  const text = t('totalBadge', fmtNum(totalKm))
  ctx.font = `700 ${16 * k}px "IBM Plex Mono", monospace`
  const tw = ctx.measureText(text).width
  const bw = tw + 30 * k
  const bh = 34 * k
  const bx = x - bw / 2
  const by = y - bh / 2

  ctx.save()
  ctx.shadowColor = 'rgba(0,0,0,0.45)'
  ctx.shadowBlur = 14 * k
  roundRect(ctx, bx, by, bw, bh, 10 * k)
  ctx.fillStyle = '#FF6B5B'
  ctx.fill()
  ctx.restore()

  ctx.fillStyle = '#1a0f0c'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(text, x, by + bh / 2 + 0.5 * k)
}

// Sol ust kose: MapBoast logosu + toplam mesafe (+ istege bagli alt bilgi)
function drawBadge(ctx, L, totalKm, subtitle) {
  const k = L.k
  const pad = 14 * k

  // --- Logo (sol ust) ---
  const logo = getLogoImage()
  const logoH = 46 * k // logo yuksekligi
  let logoW = logoH
  if (logoReady()) {
    const ar = logo.naturalWidth / logo.naturalHeight || 1
    logoW = logoH * ar
    ctx.save()
    ctx.shadowColor = 'rgba(0,0,0,0.28)'
    ctx.shadowBlur = 6 * k
    ctx.drawImage(logo, pad, pad, logoW, logoH)
    ctx.restore()
  }

  // --- km rozeti (logonun altinda) ---
  const text = totalKm ? `${fmtNum(totalKm)} KM` : 'MAPBOAST'
  ctx.font = `700 ${14 * k}px "IBM Plex Mono", monospace`
  const w = ctx.measureText(text).width + 28 * k
  const h = 30 * k
  const by = pad + logoH + 8 * k

  roundRect(ctx, pad, by, w, h, 8 * k)
  ctx.fillStyle = 'rgba(11,17,32,0.85)'
  ctx.fill()
  ctx.strokeStyle = '#FFB547'
  ctx.lineWidth = 1.5 * k
  ctx.stroke()

  ctx.fillStyle = '#FFB547'
  ctx.textAlign = 'left'
  ctx.textBaseline = 'middle'
  ctx.fillText(text, pad + 14 * k, by + h / 2 + 1 * k)

  let cursorY = by + h + 16 * k
  if (subtitle) {
    ctx.font = `500 ${11 * k}px "IBM Plex Mono", monospace`
    ctx.fillStyle = 'rgba(74,63,58,0.9)'
    ctx.fillText(subtitle, pad + 2 * k, cursorY)
    cursorY += 16 * k
  }
  // Yazar imzasi
  ctx.font = `500 ${10 * k}px "IBM Plex Mono", monospace`
  ctx.fillStyle = 'rgba(74,63,58,0.6)'
  ctx.textAlign = 'left'
  ctx.fillText('Fatih Emin Çakıroğlu', pad + 2 * k, cursorY)
}

// Aktif pasaport damgasini canvas'a cizer — ekrandaki CSS animasyonuna
// benzer his: dogunca sertce "basilir", sonra yavasca solar.
// s: { img, born, rotate, left, top }  (left/top yuzde cinsinden)
function drawStamp(ctx, L, s) {
  const now = performance.now()
  const age = now - s.born // ms
  const LIFE = 2600
  if (age > LIFE) return

  // Opaklik: hizli belir (0..12%), uzun plato, son %20'de sol
  let alpha
  const p = age / LIFE
  if (p < 0.12) alpha = p / 0.12
  else if (p < 0.8) alpha = 1
  else alpha = Math.max(0, (1 - p) / 0.2)

  // Olcek: baslangicta buyuk gelip "cakilir" (2.4 -> 1)
  let scale
  if (p < 0.12) scale = 2.4 - (2.4 - 0.92) * (p / 0.12)
  else if (p < 0.24) scale = 0.92 + (1 - 0.92) * ((p - 0.12) / 0.12)
  else scale = 1

  const size = 180 * L.k
  const x = (s.left / 100) * L.outW
  const y = (s.top / 100) * L.outH

  ctx.save()
  ctx.globalAlpha = alpha
  ctx.translate(x, y)
  ctx.rotate((s.rotate * Math.PI) / 180)
  ctx.scale(scale, scale)
  ctx.shadowColor = 'rgba(74,63,58,0.25)'
  ctx.shadowBlur = 6 * L.k
  ctx.shadowOffsetY = 3 * L.k
  ctx.drawImage(s.img, -size / 2, -size / 2, size, size)
  ctx.restore()
}

function waitIdle(map) {
  return new Promise((resolve) => {
    map.once('idle', resolve)
    map.triggerRepaint()
  })
}

// Rotanin PNG gorselini indirir (secilen formatta)
export async function downloadImage(map, stops, totalKm, formatId = 'landscape', subtitle = '') {
  await waitIdle(map)
  const L = layoutFor(map, FORMATS[formatId] || FORMATS.landscape)
  const out = document.createElement('canvas')
  out.width = L.outW
  out.height = L.outH
  const ctx = out.getContext('2d')
  ctx.fillStyle = '#fdf7f2'
  ctx.fillRect(0, 0, out.width, out.height)
  L.drawMap(ctx)
  drawOverlays(ctx, map, L, stops, null)
  drawBadge(ctx, L, totalKm, subtitle)
  drawTotalLabel(ctx, map, L, stops, totalKm)
  const suffix = formatId === 'landscape' ? '' : `-${FORMATS[formatId].label.replace(':', 'x')}`
  out.toBlob((b) => b && saveBlob(b, `mapboast${suffix}.png`), 'image/png')
}

function pickMime() {
  const candidates = [
    'video/webm;codecs=vp9',
    'video/webm;codecs=vp8',
    'video/webm',
    'video/mp4',
  ]
  return candidates.find((m) => window.MediaRecorder?.isTypeSupported(m)) || ''
}

// Animasyon boyunca kayit: her karede harita + pinler + arac birlestirilir.
// formatId secilen en-boy oranini belirler (9:16, 1:1, 4:5, yatay).
export function startRecorder(map, stops, posRef, totalKm, formatId = 'landscape', subtitle = '', stampRef = null) {
  if (!window.MediaRecorder) return null
  const mime = pickMime()
  const L = layoutFor(map, FORMATS[formatId] || FORMATS.landscape)

  const rec = document.createElement('canvas')
  rec.width = L.outW
  rec.height = L.outH
  const ctx = rec.getContext('2d')

  const stream = rec.captureStream(30)
  const recorder = new MediaRecorder(stream, {
    mimeType: mime || undefined,
    videoBitsPerSecond: 6_000_000,
  })
  const chunks = []
  recorder.ondataavailable = (e) => e.data.size && chunks.push(e.data)
  recorder.onstop = () => {
    const ext = mime.includes('mp4') ? 'mp4' : 'webm'
    const suffix = formatId === 'landscape' ? '' : `-${FORMATS[formatId].label.replace(':', 'x')}`
    saveBlob(new Blob(chunks, { type: mime || 'video/webm' }), `mapboast${suffix}.${ext}`)
  }

  let running = true
  const copy = () => {
    if (!running) return
    ctx.clearRect(0, 0, rec.width, rec.height)
    ctx.fillStyle = '#fdf7f2'
    ctx.fillRect(0, 0, rec.width, rec.height)
    L.drawMap(ctx)
    drawOverlays(ctx, map, L, stops, posRef.current)
    drawBadge(ctx, L, totalKm, subtitle)
    // Rota bitince kirmizi cizginin uzerine toplam km
    if (posRef.current?.done) {
      drawTotalLabel(ctx, map, L, stops, totalKm)
    }
    // Aktif pasaport damgasi (varista dusen) — ekrandaki DOM ile ayni his
    if (stampRef?.current?.img) drawStamp(ctx, L, stampRef.current)
    requestAnimationFrame(copy)
  }
  recorder.start(200)
  requestAnimationFrame(copy)

  return {
    stop() {
      running = false
      if (recorder.state !== 'inactive') recorder.stop()
    },
  }
}
