// Arac tanimlari, hiz kademeleri ve arac ikonunun yon transformu.
import { t } from './i18n.js'

export const VEHICLES = [
  // faces: emojinin dogal olarak baktigi aci (ekran, kuzey=0 saat yonu)
  // flip: yatay tasit mi? (sag yariya bakarken bas asagi olmasin diye dikey flip)
  { id: 'plane', emoji: '✈️', label: t('vehPlane'), rotate: true, faces: 45, flip: false },
  { id: 'car', emoji: '🚗', label: t('vehCar'), rotate: true, faces: -90, flip: true },
  { id: 'train', emoji: '🚄', label: t('vehTrain'), rotate: true, faces: -90, flip: true },
  { id: 'ship', emoji: '🚢', label: t('vehShip'), rotate: true, faces: -90, flip: true },
  { id: 'bike', emoji: '🚲', label: t('vehBike'), rotate: true, faces: -90, flip: true },
  { id: 'balloon', emoji: '🎈', label: t('vehBalloon'), rotate: false, faces: 0, flip: false },
]
export const vById = (id) => VEHICLES.find((v) => v.id === id) || VEHICLES[0]

// Hiz kademeleri: id = SURE carpani (kucuk carpan = kisa sure = hizli animasyon).
// Not: eski surumde etiketler tersti (Yavas 0.5x sureyle hizlaniyordu) — duzeltildi.
export const SPEEDS = [
  { id: 2, label: t('speedSlow') },
  { id: 1, label: t('speedNormal') },
  { id: 0.5, label: t('speedFast') },
]

// Bir tasit emojisini gittigi yone dogru cevirecek CSS transform'u uretir.
// bearing: yumusatilmis ham yon (kuzey=0, saat yonu, derece)
// v: arac tanimi (faces = emojinin dogal acisi, flip = yatay tasit mi)
// Yatay tasitlarda (araba/tren/gemi/bisiklet) sag yariya bakarken emoji bas
// asagi donmesin diye dikey flip uygulanir.
export function vehicleTransform(bearing, v) {
  if (!v.rotate) return 'rotate(0deg)'
  let angle = bearing - v.faces
  if (v.flip) {
    // Ekran yonu saga dogru mu? (0..180 arasi rota = dogu bileseni pozitif)
    const dir = ((bearing % 360) + 360) % 360
    const goingRight = dir > 0 && dir < 180
    if (goingRight) {
      // Dikey flip + aciyi flip'e gore duzelt
      return `scaleY(-1) rotate(${-(angle)}deg)`
    }
  }
  return `rotate(${angle}deg)`
}
