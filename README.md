# ROTA — TravelBoast tarzı seyahat animasyonu

Duraklarını seç, aracını seç (uçak, araba, tren, gemi, bisiklet, balon),
rotanın harita üzerinde çizilişini izle.

- **React + Vite** — hızlı geliştirme ve build
- **MapLibre GL** — ücretsiz, API anahtarı gerektirmez (CARTO dark basemap)
- **Nominatim (OpenStreetMap)** — ücretsiz şehir arama, anahtar gerektirmez

## Yerelde çalıştırma

```bash
npm install
npm run dev
```

Tarayıcıda `http://localhost:5173` adresini aç.

## Vercel'e deploy

1. Bu klasörü bir GitHub reposuna gönder:
   ```bash
   git init && git add -A && git commit -m "ilk sürüm"
   git remote add origin https://github.com/KULLANICI/rota.git
   git push -u origin main
   ```
2. [vercel.com](https://vercel.com) → **Add New → Project** → repoyu seç.
3. Framework olarak **Vite** otomatik algılanır; ayar değiştirmeden **Deploy**'a bas.

Hepsi bu — build komutu `npm run build`, çıktı klasörü `dist` (Vercel bunları kendisi bulur).

Alternatif (repo olmadan): `npm i -g vercel && vercel` komutuyla terminalden de yükleyebilirsin.

## Özellikler

- **Duraklar:** kalkış, varış ve sürükle-bırak ile sıralanabilen ara duraklar
- **Gidiş-dönüş:** tek tıkla başlangıca geri dönen döngüsel rota
- **Gerçek yollar:** araba/bisiklet/tren için OSRM'den gerçek karayolu rotası (uçak/balon kuş uçuşu)
- **Canlı km:** animasyon boyunca artan mesafe sayacı; bitişte rota üzerinde toplam km
- **Bacak bazlı araç:** her bacak için ayrı araç (İstanbul→Paris uçak, Paris→Roma tren)
- **Mesafe & süre:** her bacak için km + araca göre tahmini süre, saat farkı
- **Hava durumu:** her durak için anlık sıcaklık ve durum rozeti (Open-Meteo, anahtarsız)
- **Harita temaları:** Gece / Gündüz / Klasik
- **Hız kontrolü:** Yavaş / Normal / Hızlı
- **Canlı sayaç:** animasyon sırasında kat edilen / kalan mesafe
- **Dışa aktarma:** PNG görsel ve WebM/MP4 video — Yatay, 9:16, 1:1, 4:5 formatları
- **Paylaşım:** rotayı bağlantıya kodla (URL'den geri yüklenir)
- **Kaydetme:** rotaları tarayıcıda sakla, tek tıkla geri yükle
- **Gerçek uçuş eğrisi:** rota, küre üzerindeki en kısa yol (great-circle) olarak çizilir; uzun ve kutba yakın rotalarda doğru kavis
- **Pasaport damgası:** her varışta ekrana o ülkenin damgası düşer (video çıktısına da işlenir)
- **Gündüz/gece gölgesi:** rota ilerledikçe güneşin konumuna göre kayan gerçek terminatör gölgesi
- **9 dil:** Türkçe, İngilizce, İspanyolca, Arapça (RTL), Hintçe, Fransızca, Rusça, Portekizce, Almanca

## Yol haritası fikirleri

- Yol rotası **OSRM** (router.project-osrm.org) demo sunucusundan çekilir — ücretsiz,
  anahtarsız. Yalnızca sürüş profili olduğundan bisiklet/tren de karayolunu izler; gemi
  ve deniz aşırı bacaklar kuş uçuşu çizilir. Servis yavaşsa/kapalıysa otomatik kuş uçuşuna döner.
- Durak varışlarında şehir fotoğrafı beliren kart animasyonu
- Arka plan müziği (video dışa aktarımına dahil)

## Notlar

- Nominatim'in adil kullanım politikası vardır; yoğun trafik alırsan
  kendi geocoding servisine (ör. Maptiler, Mapbox) geçmen gerekir.
- Hava durumu **Open-Meteo** (api.open-meteo.com) üzerinden alınır — ücretsiz,
  anahtar gerektirmez. Servis kapalıysa rozetler görünmez, uygulama çalışmaya devam eder.
- Saat dilimi, boylamdan kaba biçimde tahmin edilir (her 15° = 1 saat); gerçek
  saat dilimi sınırlarını yansıtmaz, yaklaşık bir değerdir.
- Video dışa aktarma çoğu tarayıcıda **WebM** üretir; Safari MP4 üretebilir.
- Antimeridyen (180° boylam) üzerinden geçen rotalar artık düzgün çizilir (great-circle + unwrap).
