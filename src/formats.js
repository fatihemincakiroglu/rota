// Cikti en-boy formatlari. Ayri hafif modul: UI (App) bunu import edince
// agir capture.js (MediaRecorder/canvas cizim) bundle'a dahil olmaz.
import { t } from './i18n.js'

export const FORMATS = {
  landscape: { id: 'landscape', label: t('formatLandscape'), w: null, h: null },
  vertical: { id: 'vertical', label: '9:16', w: 1080, h: 1920 },
  square: { id: 'square', label: '1:1', w: 1080, h: 1080 },
  portrait: { id: 'portrait', label: '4:5', w: 1080, h: 1350 },
}

// Kayit sirasinda haritayi hedef en-boy oranina sokmak icin CSS sinifi.
// Neden: cikti, harita canvas'inin ORTASINDAN kirpiliyor. 1900x900'luk bir
// canvas'tan 1080x1920 uretmek icin olcek max(1080/1900, 1920/900) = 2.13
// seciliyor, yani yatayda yalnizca %27'lik bir serit kadraja giriyor —
// kalkis ve varis uclarda kaldigi icin ilk once onlar kirpiliyor. Ustelik
// 507 piksellik bolge 1080'e buyutuldugu icin video bulanik cikiyor.
// Harita zaten hedef oranda olursa kirpma da buyutme de ortadan kalkiyor.
export const aspectOf = (formatId) => {
  const f = FORMATS[formatId]
  return f && f.w ? f.w / f.h : null
}
