// Cikti en-boy formatlari. Ayri hafif modul: UI (App) bunu import edince
// agir capture.js (MediaRecorder/canvas cizim) bundle'a dahil olmaz.
import { t } from './i18n.js'

export const FORMATS = {
  landscape: { id: 'landscape', label: t('formatLandscape'), w: null, h: null },
  vertical: { id: 'vertical', label: '9:16', w: 1080, h: 1920 },
  square: { id: 'square', label: '1:1', w: 1080, h: 1080 },
  portrait: { id: 'portrait', label: '4:5', w: 1080, h: 1350 },
}
