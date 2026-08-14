// Ilk kullanim tanitimi: 6 adimlik tur. Her adim panelde bir bolumu isaret
// eder ve HARITA da o adima tepki verir (ucus, demo rota, bukme, animasyon).
import { useCallback, useEffect, useRef, useState } from 'react'
import { cityByName } from '../cities.js'
import { readRouteFromUrl } from '../share.js'

export const TOUR_LAST = 5
const DONE_KEY = 'rota:tourDone'
const START_DELAY_MS = 900

// Turun demo rotasi (Istanbul -> Paris, hafif kuzeye bukulmus).
// Durak adlari yerlesik listeden gelir; boylece kullanicinin dilinde gorunur.
export const TOUR_DEMO = {
  dep: cityByName('Istanbul'),
  arr: cityByName('Paris'),
  bend: { lat: 52.4, lng: 16 },
}

const sameSpot = (a, b) =>
  !!a && !!b && Math.abs(a.lat - b.lat) < 1e-4 && Math.abs(a.lng - b.lng) < 1e-4

/**
 * Tur, panele demo bir rota yazar. Kullanici bu sirada kendi duragini secerse
 * tur ARTIK rotanin sahibi degildir: uzerine yazmaz ve kapanirken silmez.
 * Sahiplik her adimda paneldeki rotaya bakilarak belirlenir — ayri bir bayragi
 * senkron tutmaya calismaktan daha saglam.
 */
export function useTour({
  mapRef,
  departure,
  arrival,
  midStops,
  setDeparture,
  setArrival,
  setShapePts,
  resetAnimation,
  clearAll,
  play,
}) {
  const [step, setStep] = useState(-1) // -1 = kapali
  const playedRef = useRef(false)

  // Panelde tur disinda hicbir sey var mi?
  const routeIsEmpty = useCallback(
    () => !departure && !arrival && midStops.length === 0,
    [departure, arrival, midStops]
  )
  // Paneldeki rota hala turun yazdigi demo mu?
  const routeIsDemo = useCallback(
    () =>
      midStops.length === 0 &&
      sameSpot(departure, TOUR_DEMO.dep) &&
      (!arrival || sameSpot(arrival, TOUR_DEMO.arr)),
    [departure, arrival, midStops]
  )

  useEffect(() => {
    try {
      if (localStorage.getItem(DONE_KEY)) return
    } catch {
      return // gizli mod vb.
    }
    if (readRouteFromUrl()) return // paylasilan linkle gelen kullaniciyi bolme
    const id = setTimeout(() => {
      // Bu sure icinde kullanici kendi rotasina baslamissa turu hic acma
      if (routeIsEmpty()) setStep(0)
    }, START_DELAY_MS)
    return () => clearTimeout(id)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const finish = useCallback(() => {
    try {
      localStorage.setItem(DONE_KEY, '1')
    } catch {
      /* gizli mod vb. */
    }
    setStep(-1)
    // Yalnizca turun kendi demo rotasini topla. Kullanici kendi duraklarini
    // girdiyse paneli oldugu gibi birak.
    resetAnimation()
    if (routeIsEmpty() || routeIsDemo()) {
      clearAll()
      mapRef.current?.easeTo({ center: [29, 41], zoom: 3.2, pitch: 0, duration: 1200 })
    } else {
      mapRef.current?.easeTo({ pitch: 0, duration: 700 })
    }
  }, [mapRef, resetAnimation, clearAll, routeIsEmpty, routeIsDemo])

  const next = useCallback(() => {
    setStep((s) => (s >= TOUR_LAST ? s : s + 1))
  }, [])

  useEffect(() => {
    if (step < 0) return
    const map = mapRef.current
    // Tur rotaya dokunmadan once: panel bos mu ya da hala demo mu?
    const owns = routeIsEmpty() || routeIsDemo()
    if (step === 0) {
      map?.flyTo({ center: [20, 30], zoom: 1.7, pitch: 0, duration: 2400 })
    } else if (step === 1) {
      if (owns && !departure) setDeparture(TOUR_DEMO.dep) // harita Istanbul'a ucar
    } else if (step === 2) {
      if (owns && !arrival) setArrival(TOUR_DEMO.arr) // rota cizilir, kamera oturur
    } else if (step === 3) {
      if (owns) setShapePts({ 0: TOUR_DEMO.bend }) // cizgi bukulur
      map?.easeTo({ pitch: 32, duration: 900 })
    } else if (step === 4) {
      map?.easeTo({ pitch: 0, duration: 700 })
    } else if (step === 5) {
      // Demo animasyonu yalnizca demo rotada otomatik baslar; kullanicinin
      // kendi rotasini haberi olmadan oynatmayiz.
      if (!playedRef.current && routeIsDemo() && arrival) {
        playedRef.current = true
        play(false)
      }
    }
  }, [step]) // eslint-disable-line react-hooks/exhaustive-deps

  return { step, next, finish }
}
