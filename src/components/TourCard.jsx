import { t } from '../i18n.js'
import { TOUR_LAST } from '../hooks/useTour.js'

// Tanitim turunun ekranin altinda duran kartı: baslik, metin, adim noktalari.
export default function TourCard({ step, onNext, onSkip }) {
  if (step < 0) return null
  const last = step >= TOUR_LAST
  return (
    <div className="tour-card">
      <div className="tour-title">{t(`tourT${step}`)}</div>
      <div className="tour-body">{t(`tourB${step}`)}</div>
      <div className="tour-foot">
        <button className="tour-skip" onClick={onSkip}>{t('tourSkip')}</button>
        <div className="tour-dots">
          {Array.from({ length: TOUR_LAST + 1 }).map((_, i) => (
            <span key={i} className={i === step ? 'on' : ''} />
          ))}
        </div>
        <button className="tour-next" onClick={last ? onSkip : onNext}>
          {last ? t('tourDone') : t('tourNext')}
        </button>
      </div>
    </div>
  )
}
