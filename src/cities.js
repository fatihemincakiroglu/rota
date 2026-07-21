// Yerlesik sehir listesi: arama servisi yanit vermese bile aninda sonuc verir.
export const CITIES = [
  // Turkiye
  { name: 'İstanbul', full: 'İstanbul, Türkiye', lat: 41.0082, lng: 28.9784 },
  { name: 'Ankara', full: 'Ankara, Türkiye', lat: 39.9334, lng: 32.8597 },
  { name: 'İzmir', full: 'İzmir, Türkiye', lat: 38.4237, lng: 27.1428 },
  { name: 'Antalya', full: 'Antalya, Türkiye', lat: 36.8969, lng: 30.7133 },
  { name: 'Bursa', full: 'Bursa, Türkiye', lat: 40.1885, lng: 29.061 },
  { name: 'Adana', full: 'Adana, Türkiye', lat: 37.0, lng: 35.3213 },
  { name: 'Gaziantep', full: 'Gaziantep, Türkiye', lat: 37.0662, lng: 37.3833 },
  { name: 'Konya', full: 'Konya, Türkiye', lat: 37.8746, lng: 32.4932 },
  { name: 'Trabzon', full: 'Trabzon, Türkiye', lat: 41.0027, lng: 39.7168 },
  { name: 'Samsun', full: 'Samsun, Türkiye', lat: 41.2867, lng: 36.33 },
  { name: 'Kayseri', full: 'Kayseri, Türkiye', lat: 38.7312, lng: 35.4787 },
  { name: 'Eskişehir', full: 'Eskişehir, Türkiye', lat: 39.7767, lng: 30.5206 },
  { name: 'Diyarbakır', full: 'Diyarbakır, Türkiye', lat: 37.9144, lng: 40.2306 },
  { name: 'Mersin', full: 'Mersin, Türkiye', lat: 36.8121, lng: 34.6415 },
  { name: 'Van', full: 'Van, Türkiye', lat: 38.4891, lng: 43.4089 },
  { name: 'Erzurum', full: 'Erzurum, Türkiye', lat: 39.9, lng: 41.27 },
  { name: 'Muğla', full: 'Muğla, Türkiye', lat: 37.2153, lng: 28.3636 },
  { name: 'Bodrum', full: 'Bodrum, Muğla, Türkiye', lat: 37.0344, lng: 27.4305 },
  { name: 'Kapadokya', full: 'Kapadokya (Göreme), Nevşehir, Türkiye', lat: 38.6431, lng: 34.8289 },
  { name: 'Rize', full: 'Rize, Türkiye', lat: 41.0201, lng: 40.5234 },

  // Avrupa
  { name: 'Londra', full: 'Londra, Birleşik Krallık', lat: 51.5074, lng: -0.1278 },
  { name: 'Paris', full: 'Paris, Fransa', lat: 48.8566, lng: 2.3522 },
  { name: 'Berlin', full: 'Berlin, Almanya', lat: 52.52, lng: 13.405 },
  { name: 'Münih', full: 'Münih, Almanya', lat: 48.1351, lng: 11.582 },
  { name: 'Frankfurt', full: 'Frankfurt, Almanya', lat: 50.1109, lng: 8.6821 },
  { name: 'Roma', full: 'Roma, İtalya', lat: 41.9028, lng: 12.4964 },
  { name: 'Milano', full: 'Milano, İtalya', lat: 45.4642, lng: 9.19 },
  { name: 'Venedik', full: 'Venedik, İtalya', lat: 45.4408, lng: 12.3155 },
  { name: 'Madrid', full: 'Madrid, İspanya', lat: 40.4168, lng: -3.7038 },
  { name: 'Barselona', full: 'Barselona, İspanya', lat: 41.3874, lng: 2.1686 },
  { name: 'Lizbon', full: 'Lizbon, Portekiz', lat: 38.7223, lng: -9.1393 },
  { name: 'Amsterdam', full: 'Amsterdam, Hollanda', lat: 52.3676, lng: 4.9041 },
  { name: 'Brüksel', full: 'Brüksel, Belçika', lat: 50.8503, lng: 4.3517 },
  { name: 'Viyana', full: 'Viyana, Avusturya', lat: 48.2082, lng: 16.3738 },
  { name: 'Zürih', full: 'Zürih, İsviçre', lat: 47.3769, lng: 8.5417 },
  { name: 'Cenevre', full: 'Cenevre, İsviçre', lat: 46.2044, lng: 6.1432 },
  { name: 'Prag', full: 'Prag, Çekya', lat: 50.0755, lng: 14.4378 },
  { name: 'Budapeşte', full: 'Budapeşte, Macaristan', lat: 47.4979, lng: 19.0402 },
  { name: 'Varşova', full: 'Varşova, Polonya', lat: 52.2297, lng: 21.0122 },
  { name: 'Atina', full: 'Atina, Yunanistan', lat: 37.9838, lng: 23.7275 },
  { name: 'Selanik', full: 'Selanik, Yunanistan', lat: 40.6401, lng: 22.9444 },
  { name: 'Sofya', full: 'Sofya, Bulgaristan', lat: 42.6977, lng: 23.3219 },
  { name: 'Bükreş', full: 'Bükreş, Romanya', lat: 44.4268, lng: 26.1025 },
  { name: 'Belgrad', full: 'Belgrad, Sırbistan', lat: 44.7866, lng: 20.4489 },
  { name: 'Saraybosna', full: 'Saraybosna, Bosna-Hersek', lat: 43.8563, lng: 18.4131 },
  { name: 'Üsküp', full: 'Üsküp, Kuzey Makedonya', lat: 41.9973, lng: 21.428 },
  { name: 'Tiran', full: 'Tiran, Arnavutluk', lat: 41.3275, lng: 19.8187 },
  { name: 'Stokholm', full: 'Stokholm, İsveç', lat: 59.3293, lng: 18.0686 },
  { name: 'Oslo', full: 'Oslo, Norveç', lat: 59.9139, lng: 10.7522 },
  { name: 'Kopenhag', full: 'Kopenhag, Danimarka', lat: 55.6761, lng: 12.5683 },
  { name: 'Helsinki', full: 'Helsinki, Finlandiya', lat: 60.1699, lng: 24.9384 },
  { name: 'Dublin', full: 'Dublin, İrlanda', lat: 53.3498, lng: -6.2603 },
  { name: 'Moskova', full: 'Moskova, Rusya', lat: 55.7558, lng: 37.6173 },
  { name: 'Kiev', full: 'Kiev, Ukrayna', lat: 50.4501, lng: 30.5234 },

  // Orta Dogu & Afrika
  { name: 'Dubai', full: 'Dubai, BAE', lat: 25.2048, lng: 55.2708 },
  { name: 'Abu Dabi', full: 'Abu Dabi, BAE', lat: 24.4539, lng: 54.3773 },
  { name: 'Doha', full: 'Doha, Katar', lat: 25.2854, lng: 51.531 },
  { name: 'Riyad', full: 'Riyad, Suudi Arabistan', lat: 24.7136, lng: 46.6753 },
  { name: 'Mekke', full: 'Mekke, Suudi Arabistan', lat: 21.3891, lng: 39.8579 },
  { name: 'Medine', full: 'Medine, Suudi Arabistan', lat: 24.5247, lng: 39.5692 },
  { name: 'Tahran', full: 'Tahran, İran', lat: 35.6892, lng: 51.389 },
  { name: 'Bakü', full: 'Bakü, Azerbaycan', lat: 40.4093, lng: 49.8671 },
  { name: 'Tiflis', full: 'Tiflis, Gürcistan', lat: 41.7151, lng: 44.8271 },
  { name: 'Kahire', full: 'Kahire, Mısır', lat: 30.0444, lng: 31.2357 },
  { name: 'Marakeş', full: 'Marakeş, Fas', lat: 31.6295, lng: -7.9811 },
  { name: 'Kazablanka', full: 'Kazablanka, Fas', lat: 33.5731, lng: -7.5898 },
  { name: 'Cape Town', full: 'Cape Town, Güney Afrika', lat: -33.9249, lng: 18.4241 },
  { name: 'Nairobi', full: 'Nairobi, Kenya', lat: -1.2921, lng: 36.8219 },

  // Asya & Okyanusya
  { name: 'Tokyo', full: 'Tokyo, Japonya', lat: 35.6762, lng: 139.6503 },
  { name: 'Osaka', full: 'Osaka, Japonya', lat: 34.6937, lng: 135.5023 },
  { name: 'Seul', full: 'Seul, Güney Kore', lat: 37.5665, lng: 126.978 },
  { name: 'Pekin', full: 'Pekin, Çin', lat: 39.9042, lng: 116.4074 },
  { name: 'Şanghay', full: 'Şanghay, Çin', lat: 31.2304, lng: 121.4737 },
  { name: 'Hong Kong', full: 'Hong Kong', lat: 22.3193, lng: 114.1694 },
  { name: 'Singapur', full: 'Singapur', lat: 1.3521, lng: 103.8198 },
  { name: 'Bangkok', full: 'Bangkok, Tayland', lat: 13.7563, lng: 100.5018 },
  { name: 'Bali', full: 'Bali (Denpasar), Endonezya', lat: -8.6705, lng: 115.2126 },
  { name: 'Kuala Lumpur', full: 'Kuala Lumpur, Malezya', lat: 3.139, lng: 101.6869 },
  { name: 'Yeni Delhi', full: 'Yeni Delhi, Hindistan', lat: 28.6139, lng: 77.209 },
  { name: 'Mumbai', full: 'Mumbai, Hindistan', lat: 19.076, lng: 72.8777 },
  { name: 'Sidney', full: 'Sidney, Avustralya', lat: -33.8688, lng: 151.2093 },
  { name: 'Melbourne', full: 'Melbourne, Avustralya', lat: -37.8136, lng: 144.9631 },

  // Amerika
  { name: 'New York', full: 'New York, ABD', lat: 40.7128, lng: -74.006 },
  { name: 'Los Angeles', full: 'Los Angeles, ABD', lat: 34.0522, lng: -118.2437 },
  { name: 'San Francisco', full: 'San Francisco, ABD', lat: 37.7749, lng: -122.4194 },
  { name: 'Miami', full: 'Miami, ABD', lat: 25.7617, lng: -80.1918 },
  { name: 'Chicago', full: 'Chicago, ABD', lat: 41.8781, lng: -87.6298 },
  { name: 'Las Vegas', full: 'Las Vegas, ABD', lat: 36.1699, lng: -115.1398 },
  { name: 'Toronto', full: 'Toronto, Kanada', lat: 43.6532, lng: -79.3832 },
  { name: 'Vancouver', full: 'Vancouver, Kanada', lat: 49.2827, lng: -123.1207 },
  { name: 'Meksiko', full: 'Meksiko, Meksika', lat: 19.4326, lng: -99.1332 },
  { name: 'Rio de Janeiro', full: 'Rio de Janeiro, Brezilya', lat: -22.9068, lng: -43.1729 },
  { name: 'São Paulo', full: 'São Paulo, Brezilya', lat: -23.5505, lng: -46.6333 },
  { name: 'Buenos Aires', full: 'Buenos Aires, Arjantin', lat: -34.6037, lng: -58.3816 },
]

// Turkce karakterleri sadelestirerek esnek eslesme saglar (istanbul = İstanbul)
export function fold(s) {
  return s
    .toLocaleLowerCase('tr')
    .replace(/ı/g, 'i')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

export function searchLocal(q, limit = 5) {
  const f = fold(q.trim())
  if (!f) return []
  const starts = []
  const contains = []
  for (const c of CITIES) {
    const n = fold(c.name)
    if (n.startsWith(f)) starts.push(c)
    else if (n.includes(f) || fold(c.full).includes(f)) contains.push(c)
  }
  return [...starts, ...contains].slice(0, limit)
}
