// Yerlesik sehir listesi: arama servisi yanit vermese bile aninda sonuc verir.
//
// Cok dillilik: sehirler ISO2 ulke koduyla saklanir, ulke adi kullanicinin
// diline gore Intl.DisplayNames ile uretilir (9 dil, sifir ceviri verisi).
// Sehir adi varsayilan olarak uluslararasi (Latin) yazimdir; Turkce sayfada
// `tr` alani varsa o kullanilir. `alt` yalnizca aramada eslesen yerel
// yazimlardir (Munchen, Praha, Москва...), ekranda gosterilmez.
//
// NOT: ar/hi/ru sayfalarinda yerlesik listeden secilen sehir Latin harfle
// gorunur; kullanici listede olmayan bir yer yazarsa Nominatim zaten
// accept-language ile yerellestirilmis adi dondurur.
import { LANG, LOCALE } from './i18n.js'

export const CITIES = [
  { en: 'Istanbul', tr: 'İstanbul', cc: 'TR', lat: 41.0082, lng: 28.9784 },
  { en: 'Ankara', cc: 'TR', lat: 39.9334, lng: 32.8597 },
  { en: 'Izmir', tr: 'İzmir', cc: 'TR', lat: 38.4237, lng: 27.1428 },
  { en: 'Antalya', cc: 'TR', lat: 36.8969, lng: 30.7133 },
  { en: 'Bursa', cc: 'TR', lat: 40.1885, lng: 29.061 },
  { en: 'Adana', cc: 'TR', lat: 37, lng: 35.3213 },
  { en: 'Gaziantep', cc: 'TR', lat: 37.0662, lng: 37.3833 },
  { en: 'Konya', cc: 'TR', lat: 37.8746, lng: 32.4932 },
  { en: 'Trabzon', cc: 'TR', lat: 41.0027, lng: 39.7168 },
  { en: 'Samsun', cc: 'TR', lat: 41.2867, lng: 36.33 },
  { en: 'Kayseri', cc: 'TR', lat: 38.7312, lng: 35.4787 },
  { en: 'Eskisehir', tr: 'Eskişehir', cc: 'TR', lat: 39.7767, lng: 30.5206 },
  { en: 'Diyarbakir', tr: 'Diyarbakır', cc: 'TR', lat: 37.9144, lng: 40.2306 },
  { en: 'Mersin', cc: 'TR', lat: 36.8121, lng: 34.6415 },
  { en: 'Van', cc: 'TR', lat: 38.4891, lng: 43.4089 },
  { en: 'Erzurum', cc: 'TR', lat: 39.9, lng: 41.27 },
  { en: 'Mugla', tr: 'Muğla', cc: 'TR', lat: 37.2153, lng: 28.3636 },
  { en: 'Bodrum', cc: 'TR', lat: 37.0344, lng: 27.4305 },
  { en: 'Cappadocia', tr: 'Kapadokya', cc: 'TR', lat: 38.6431, lng: 34.8289 },
  { en: 'Rize', cc: 'TR', lat: 41.0201, lng: 40.5234 },
  { en: 'London', tr: 'Londra', cc: 'GB', lat: 51.5074, lng: -0.1278 },
  { en: 'Paris', cc: 'FR', lat: 48.8566, lng: 2.3522 },
  { en: 'Berlin', cc: 'DE', lat: 52.52, lng: 13.405 },
  { en: 'Munich', tr: 'Münih', cc: 'DE', lat: 48.1351, lng: 11.582, alt: ['München'] },
  { en: 'Frankfurt', cc: 'DE', lat: 50.1109, lng: 8.6821 },
  { en: 'Rome', tr: 'Roma', cc: 'IT', lat: 41.9028, lng: 12.4964 },
  { en: 'Milan', tr: 'Milano', cc: 'IT', lat: 45.4642, lng: 9.19 },
  { en: 'Venice', tr: 'Venedik', cc: 'IT', lat: 45.4408, lng: 12.3155, alt: ['Venezia'] },
  { en: 'Madrid', cc: 'ES', lat: 40.4168, lng: -3.7038 },
  { en: 'Barcelona', tr: 'Barselona', cc: 'ES', lat: 41.3874, lng: 2.1686 },
  { en: 'Lisbon', tr: 'Lizbon', cc: 'PT', lat: 38.7223, lng: -9.1393, alt: ['Lisboa'] },
  { en: 'Amsterdam', cc: 'NL', lat: 52.3676, lng: 4.9041 },
  { en: 'Brussels', tr: 'Brüksel', cc: 'BE', lat: 50.8503, lng: 4.3517, alt: ['Bruxelles'] },
  { en: 'Vienna', tr: 'Viyana', cc: 'AT', lat: 48.2082, lng: 16.3738, alt: ['Wien'] },
  { en: 'Zurich', tr: 'Zürih', cc: 'CH', lat: 47.3769, lng: 8.5417 },
  { en: 'Geneva', tr: 'Cenevre', cc: 'CH', lat: 46.2044, lng: 6.1432, alt: ['Genève'] },
  { en: 'Prague', tr: 'Prag', cc: 'CZ', lat: 50.0755, lng: 14.4378, alt: ['Praha'] },
  { en: 'Budapest', tr: 'Budapeşte', cc: 'HU', lat: 47.4979, lng: 19.0402 },
  { en: 'Warsaw', tr: 'Varşova', cc: 'PL', lat: 52.2297, lng: 21.0122, alt: ['Warszawa'] },
  { en: 'Athens', tr: 'Atina', cc: 'GR', lat: 37.9838, lng: 23.7275 },
  { en: 'Thessaloniki', tr: 'Selanik', cc: 'GR', lat: 40.6401, lng: 22.9444 },
  { en: 'Sofia', tr: 'Sofya', cc: 'BG', lat: 42.6977, lng: 23.3219 },
  { en: 'Bucharest', tr: 'Bükreş', cc: 'RO', lat: 44.4268, lng: 26.1025, alt: ['București'] },
  { en: 'Belgrade', tr: 'Belgrad', cc: 'RS', lat: 44.7866, lng: 20.4489, alt: ['Beograd'] },
  { en: 'Sarajevo', tr: 'Saraybosna', cc: 'BA', lat: 43.8563, lng: 18.4131 },
  { en: 'Skopje', tr: 'Üsküp', cc: 'MK', lat: 41.9973, lng: 21.428 },
  { en: 'Tirana', tr: 'Tiran', cc: 'AL', lat: 41.3275, lng: 19.8187 },
  { en: 'Stockholm', tr: 'Stokholm', cc: 'SE', lat: 59.3293, lng: 18.0686 },
  { en: 'Oslo', cc: 'NO', lat: 59.9139, lng: 10.7522 },
  { en: 'Copenhagen', tr: 'Kopenhag', cc: 'DK', lat: 55.6761, lng: 12.5683, alt: ['København'] },
  { en: 'Helsinki', cc: 'FI', lat: 60.1699, lng: 24.9384 },
  { en: 'Dublin', cc: 'IE', lat: 53.3498, lng: -6.2603 },
  { en: 'Moscow', tr: 'Moskova', cc: 'RU', lat: 55.7558, lng: 37.6173, alt: ['Москва'] },
  { en: 'Kyiv', tr: 'Kiev', cc: 'UA', lat: 50.4501, lng: 30.5234, alt: ['Київ'] },
  { en: 'Dubai', cc: 'AE', lat: 25.2048, lng: 55.2708 },
  { en: 'Abu Dhabi', tr: 'Abu Dabi', cc: 'AE', lat: 24.4539, lng: 54.3773 },
  { en: 'Doha', cc: 'QA', lat: 25.2854, lng: 51.531 },
  { en: 'Riyadh', tr: 'Riyad', cc: 'SA', lat: 24.7136, lng: 46.6753 },
  { en: 'Mecca', tr: 'Mekke', cc: 'SA', lat: 21.3891, lng: 39.8579, alt: ['Makkah'] },
  { en: 'Medina', tr: 'Medine', cc: 'SA', lat: 24.5247, lng: 39.5692 },
  { en: 'Tehran', tr: 'Tahran', cc: 'IR', lat: 35.6892, lng: 51.389 },
  { en: 'Baku', tr: 'Bakü', cc: 'AZ', lat: 40.4093, lng: 49.8671 },
  { en: 'Tbilisi', tr: 'Tiflis', cc: 'GE', lat: 41.7151, lng: 44.8271 },
  { en: 'Cairo', tr: 'Kahire', cc: 'EG', lat: 30.0444, lng: 31.2357 },
  { en: 'Marrakesh', tr: 'Marakeş', cc: 'MA', lat: 31.6295, lng: -7.9811, alt: ['Marrakech'] },
  { en: 'Casablanca', tr: 'Kazablanka', cc: 'MA', lat: 33.5731, lng: -7.5898 },
  { en: 'Cape Town', cc: 'ZA', lat: -33.9249, lng: 18.4241 },
  { en: 'Nairobi', cc: 'KE', lat: -1.2921, lng: 36.8219 },
  { en: 'Tokyo', cc: 'JP', lat: 35.6762, lng: 139.6503 },
  { en: 'Osaka', cc: 'JP', lat: 34.6937, lng: 135.5023 },
  { en: 'Seoul', tr: 'Seul', cc: 'KR', lat: 37.5665, lng: 126.978 },
  { en: 'Beijing', tr: 'Pekin', cc: 'CN', lat: 39.9042, lng: 116.4074 },
  { en: 'Shanghai', tr: 'Şanghay', cc: 'CN', lat: 31.2304, lng: 121.4737 },
  { en: 'Hong Kong', cc: 'HK', lat: 22.3193, lng: 114.1694 },
  { en: 'Singapore', tr: 'Singapur', cc: 'SG', lat: 1.3521, lng: 103.8198 },
  { en: 'Bangkok', cc: 'TH', lat: 13.7563, lng: 100.5018 },
  { en: 'Bali', cc: 'ID', lat: -8.6705, lng: 115.2126 },
  { en: 'Kuala Lumpur', cc: 'MY', lat: 3.139, lng: 101.6869 },
  { en: 'New Delhi', tr: 'Yeni Delhi', cc: 'IN', lat: 28.6139, lng: 77.209 },
  { en: 'Mumbai', cc: 'IN', lat: 19.076, lng: 72.8777 },
  { en: 'Sydney', tr: 'Sidney', cc: 'AU', lat: -33.8688, lng: 151.2093 },
  { en: 'Melbourne', cc: 'AU', lat: -37.8136, lng: 144.9631 },
  { en: 'New York', cc: 'US', lat: 40.7128, lng: -74.006 },
  { en: 'Los Angeles', cc: 'US', lat: 34.0522, lng: -118.2437 },
  { en: 'San Francisco', cc: 'US', lat: 37.7749, lng: -122.4194 },
  { en: 'Miami', cc: 'US', lat: 25.7617, lng: -80.1918 },
  { en: 'Chicago', cc: 'US', lat: 41.8781, lng: -87.6298 },
  { en: 'Las Vegas', cc: 'US', lat: 36.1699, lng: -115.1398 },
  { en: 'Toronto', cc: 'CA', lat: 43.6532, lng: -79.3832 },
  { en: 'Vancouver', cc: 'CA', lat: 49.2827, lng: -123.1207 },
  { en: 'Mexico City', tr: 'Meksiko', cc: 'MX', lat: 19.4326, lng: -99.1332, alt: ['Ciudad de México'] },
  { en: 'Rio de Janeiro', cc: 'BR', lat: -22.9068, lng: -43.1729 },
  { en: 'São Paulo', cc: 'BR', lat: -23.5505, lng: -46.6333 },
  { en: 'Buenos Aires', cc: 'AR', lat: -34.6037, lng: -58.3816 },
]

// ISO2 -> kullanicinin dilinde ulke adi. Desteklenmezse kodun kendisi doner.
const _dn = (() => {
  try {
    return new Intl.DisplayNames([LOCALE], { type: 'region' })
  } catch {
    return null
  }
})()
export function countryLabel(cc) {
  if (!cc) return ''
  try {
    return _dn?.of(cc) || cc
  } catch {
    return cc
  }
}

// Sehrin ekranda gorunecek adi
export function cityLabel(c) {
  return LANG === 'tr' && c.tr ? c.tr : c.en
}

// CITIES kaydini uygulamanin durak nesnesine cevirir.
// Sehir-devletlerde (Singapur, Hong Kong) ad ile ulke ayni oldugu icin
// "Singapur, Singapur" gibi tekrar yazilmaz.
export function toStop(c) {
  const name = cityLabel(c)
  const country = countryLabel(c.cc)
  return {
    name,
    full: country && country !== name ? `${name}, ${country}` : name,
    lat: c.lat,
    lng: c.lng,
    cc: c.cc,
  }
}

// Yerlesik listeden ada gore durak bul (tanitim turu gibi sabit rotalar icin)
export function cityByName(en) {
  const c = CITIES.find((x) => x.en === en)
  return c ? toStop(c) : null
}

// Turkce karakterleri sadelestirerek esnek eslesme saglar (istanbul = İstanbul)
export function fold(s) {
  return s
    .toLocaleLowerCase('tr')
    .replace(/ı/g, 'i')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

// Bir sehrin aramada eslesebilecegi tum yazimlari
const variants = (c) => [c.en, c.tr, ...(c.alt || [])].filter(Boolean)

export function searchLocal(q, limit = 5) {
  const f = fold(q.trim())
  if (!f) return []
  const starts = []
  const contains = []
  for (const c of CITIES) {
    const names = variants(c).map(fold)
    if (names.some((n) => n.startsWith(f))) starts.push(c)
    else if (names.some((n) => n.includes(f)) || fold(countryLabel(c.cc)).includes(f)) contains.push(c)
  }
  return [...starts, ...contains].slice(0, limit).map(toStop)
}
