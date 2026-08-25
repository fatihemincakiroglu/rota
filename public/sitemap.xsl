<?xml version="1.0" encoding="UTF-8"?>
<!--
  sitemap.xml SADECE arama motorlari icindir; bu sablon yalnizca bir insan
  dosyayi tarayicida actiginda devreye girer. Google/Bing XSL'i yok sayar,
  ham XML'i ayristirir — yani buradaki hicbir sey SEO'yu etkilemez.
  Palet uygulamanin "Kagit" temasiyla ayni.
-->
<xsl:stylesheet version="1.0"
  xmlns:xsl="http://www.w3.org/1999/XSL/Transform"
  xmlns:s="http://www.sitemaps.org/schemas/sitemap/0.9"
  xmlns:xhtml="http://www.w3.org/1999/xhtml">
  <xsl:output method="html" encoding="UTF-8" indent="yes"/>

  <xsl:template match="/">
    <html lang="tr">
      <head>
        <meta charset="UTF-8"/>
        <meta name="viewport" content="width=device-width, initial-scale=1"/>
        <meta name="robots" content="noindex"/>
        <title>MapBoast — site haritası</title>
        <style>
          :root {
            --paper: #F4EFE6; --paper-2: #FBF8F2; --ink: #4A4335;
            --ink-soft: #8C8371; --line: #E2D9C8; --accent: #FF6B5B;
          }
          * { box-sizing: border-box; }
          body {
            margin: 0; padding: 48px 24px; background: var(--paper);
            color: var(--ink); font: 15px/1.6 ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif;
          }
          .wrap { max-width: 940px; margin: 0 auto; }
          h1 { font-size: 22px; font-weight: 600; margin: 0 0 6px; letter-spacing: -0.01em; }
          .sub { color: var(--ink-soft); font-size: 13.5px; margin: 0 0 6px; }
          .note {
            color: var(--ink-soft); font-size: 12.5px; margin: 0 0 28px;
            padding-left: 12px; border-left: 2px solid var(--line);
          }
          .count {
            display: inline-block; background: var(--accent); color: #fff;
            font-size: 12px; font-weight: 600; padding: 2px 9px;
            border-radius: 999px; margin-left: 8px; vertical-align: 2px;
          }
          table { width: 100%; border-collapse: collapse; background: var(--paper-2);
                  border: 1px solid var(--line); border-radius: 12px; overflow: hidden; }
          th {
            text-align: left; font-size: 11px; font-weight: 600; letter-spacing: 0.08em;
            text-transform: uppercase; color: var(--ink-soft);
            padding: 12px 16px; border-bottom: 1px solid var(--line); white-space: nowrap;
          }
          td { padding: 12px 16px; border-bottom: 1px solid var(--line); vertical-align: middle; }
          tr:last-child td { border-bottom: 0; }
          tr:hover td { background: #F7F2E9; }
          a { color: var(--ink); text-decoration: none; border-bottom: 1px solid var(--accent); }
          a:hover { color: var(--accent); }
          .num { color: var(--ink-soft); font-variant-numeric: tabular-nums; width: 36px; }
          .meta { color: var(--ink-soft); font-size: 13px; white-space: nowrap;
                  font-variant-numeric: tabular-nums; }
          .langs { font-size: 11.5px; color: var(--ink-soft); letter-spacing: 0.04em; }
          footer { margin-top: 20px; font-size: 12px; color: var(--ink-soft); }
          @media (max-width: 720px) {
            body { padding: 28px 14px; }
            .hide-sm { display: none; }
          }
        </style>
      </head>
      <body>
        <div class="wrap">
          <h1>Site haritası<span class="count"><xsl:value-of select="count(s:urlset/s:url)"/></span></h1>
          <p class="sub">mapboast.com — dokuz dilde rota animasyonu</p>
          <p class="note">
            Bu dosya arama motorları için üretilir. Aşağıdaki görünüm yalnızca
            tarayıcıda okunabilir olsun diye eklenmiş bir şablondur; Google ham
            XML'i okur ve bu tasarımı görmez.
          </p>
          <table>
            <tr>
              <th class="num">#</th>
              <th>Adres</th>
              <th class="hide-sm">Alternatif diller</th>
              <th>Güncellenme</th>
              <th class="hide-sm">Sıklık</th>
              <th>Öncelik</th>
            </tr>
            <xsl:for-each select="s:urlset/s:url">
              <tr>
                <td class="num"><xsl:value-of select="position()"/></td>
                <td>
                  <a href="{s:loc}"><xsl:value-of select="s:loc"/></a>
                </td>
                <td class="hide-sm langs">
                  <xsl:for-each select="xhtml:link[@hreflang != 'x-default']">
                    <xsl:value-of select="@hreflang"/>
                    <xsl:if test="position() != last()"> · </xsl:if>
                  </xsl:for-each>
                </td>
                <td class="meta"><xsl:value-of select="s:lastmod"/></td>
                <td class="meta hide-sm"><xsl:value-of select="s:changefreq"/></td>
                <td class="meta"><xsl:value-of select="s:priority"/></td>
              </tr>
            </xsl:for-each>
          </table>
          <footer>
            sitemaps.org 0.9 şeması · hreflang ek şemasıyla
          </footer>
        </div>
      </body>
    </html>
  </xsl:template>
</xsl:stylesheet>
