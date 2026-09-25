const SUPABASE_API_KEY = 'sb_publishable_Gp7u0i4jGzMUJuhiZ6_j_Q_HV3ndPXK';
const SUPABASE_REST_URL = 'https://jvckjrzcvfonucagpecu.supabase.co/rest/v1';

function escapeXml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

// 1. ДИНАМІЧНИЙ SITEMAP.XML ДЛЯ GOOGLE
async function generateDynamicSitemap() {
  try {
    const url = `${SUPABASE_REST_URL}/products?select=id,slug,title,description,updated_at,created_at,is_top,media:product_media(url,media_type,display_order)&status=neq.archived&order=created_at.desc`;
    const res = await fetch(url, { headers: { 'apikey': SUPABASE_API_KEY } });
    if (!res.ok) throw new Error(`Supabase error: ${res.status}`);
    const products = await res.json();

    const today = new Date().toISOString().split('T')[0];
    let itemsXml = `  <url>\n    <loc>https://rizdviana.art/</loc>\n    <lastmod>${today}</lastmod>\n    <changefreq>daily</changefreq>\n    <priority>1.0</priority>\n  </url>\n`;

    for (const p of products) {
      const slug = p.slug || p.id;
      const link = `https://rizdviana.art/?item=${slug}`;
      const title = escapeXml(p.title || 'Прикраса RIZDVIANA.ART');
      const rawDesc = (p.description || '').replace(/\s+/g, ' ').trim().slice(0, 200);
      const desc = escapeXml(rawDesc);
      const lastmod = (p.updated_at || p.created_at || today).slice(0, 10);
      const priority = p.is_top ? '0.9' : '0.8';

      const media = p.media || [];
      media.sort((a, b) => (a.display_order || 0) - (b.display_order || 0));
      const images = media.filter(m => m.media_type === 'image' && !m.url.endsWith('.mp4')).slice(0, 3);

      let imgTags = '';
      for (const img of images) {
        imgTags += `\n      <image:image>\n        <image:loc>${escapeXml(img.url)}</image:loc>\n        <image:title>${title}</image:title>${desc ? `\n        <image:caption>${desc}</image:caption>` : ''}\n      </image:image>`;
      }

      itemsXml += `  <url>\n    <loc>${link}</loc>\n    <lastmod>${lastmod}</lastmod>\n    <changefreq>weekly</changefreq>\n    <priority>${priority}</priority>${imgTags}\n  </url>\n`;
    }

    const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"\n        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">\n${itemsXml}</urlset>`;

    return new Response(xml, {
      headers: {
        'Content-Type': 'application/xml; charset=utf-8',
        'Cache-Control': 'public, max-age=1800, s-maxage=1800',
        'CDN-Cache-Control': 'max-age=1800'
      }
    });
  } catch (err) {
    return new Response(`Error generating sitemap: ${err.message}`, { status: 500 });
  }
}

// 2. ДИНАМІЧНИЙ FEED.XML ДЛЯ PINTEREST RSS
async function generateDynamicFeed() {
  try {
    const url = `${SUPABASE_REST_URL}/products?select=id,slug,title,description,price,created_at,media:product_media(url,media_type,display_order)&status=neq.archived&order=created_at.desc`;
    const res = await fetch(url, { headers: { 'apikey': SUPABASE_API_KEY } });
    if (!res.ok) throw new Error(`Supabase error: ${res.status}`);
    const products = await res.json();

    let itemsXml = '';
    for (const p of products) {
      const slug = p.slug || p.id;
      const link = `https://rizdviana.art/?item=${slug}`;
      const title = escapeXml(p.title || 'Прикраса RIZDVIANA.ART');
      const desc = escapeXml(p.description || `Авторська прикраса з бісеру від майстерні RIZDVIANA.ART. Ціна: ${p.price || ''} ₴.`);
      const pubDate = p.created_at ? new Date(p.created_at).toUTCString() : new Date().toUTCString();

      const media = p.media || [];
      media.sort((a, b) => (a.display_order || 0) - (b.display_order || 0));
      const firstImg = media.find(m => m.media_type === 'image' && !m.url.endsWith('.mp4'));
      const imgUrl = firstImg ? firstImg.url : '';

      let enclosureTag = '';
      let mediaTag = '';
      if (imgUrl) {
        const escImg = escapeXml(imgUrl);
        enclosureTag = `\n      <enclosure url="${escImg}" type="image/jpeg" length="0" />`;
        mediaTag = `\n      <media:content url="${escImg}" medium="image" type="image/jpeg" />`;
      }

      itemsXml += `    <item>\n      <title>${title}</title>\n      <link>${link}</link>\n      <guid isPermaLink="false">${slug}</guid>\n      <pubDate>${pubDate}</pubDate>\n      <description>${desc}</description>${enclosureTag}${mediaTag}\n    </item>\n`;
    }

    const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:media="http://search.yahoo.com/mrss/">\n  <channel>\n    <title>RIZDVIANA.ART — Традиційні та сучасні прикраси з бісеру</title>\n    <link>https://rizdviana.art/</link>\n    <description>Авторські силянки, гердани та чокери ручної роботи з бісеру</description>\n    <language>uk</language>\n    <atom:link href="https://rizdviana.art/feed.xml" rel="self" type="application/rss+xml" />\n${itemsXml}  </channel>\n</rss>`;

    return new Response(xml, {
      headers: {
        'Content-Type': 'application/xml; charset=utf-8',
        'Cache-Control': 'public, max-age=1800, s-maxage=1800',
        'CDN-Cache-Control': 'max-age=1800'
      }
    });
  } catch (err) {
    return new Response(`Error generating RSS feed: ${err.message}`, { status: 500 });
  }
}

// ГОЛОВНИЙ MIDDLEWARE
export async function onRequest(context) {
  const url = new URL(context.request.url);

  // 1. Динамічний sitemap.xml
  if (url.pathname === '/sitemap.xml') {
    return generateDynamicSitemap();
  }

  // 2. Динамічний feed.xml
  if (url.pathname === '/feed.xml') {
    return generateDynamicFeed();
  }

  // 3. Динамічні SSR теги для товару (?item=...)
  const item = url.searchParams.get('item');
  if (!item || context.request.method !== 'GET' || (url.pathname !== '/' && url.pathname !== '/index.html')) {
    return context.next();
  }

  const response = await context.next();
  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('text/html')) {
    return response;
  }

  try {
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(item);
    const filter = isUuid ? `id=eq.${encodeURIComponent(item)}` : `slug=eq.${encodeURIComponent(item)}`;
    const supabaseUrl = `${SUPABASE_REST_URL}/products?${filter}&select=id,title,description,price,product_type,media:product_media(url,media_type,display_order)&limit=1`;
    const res = await fetch(supabaseUrl, {
      headers: { 'apikey': SUPABASE_API_KEY }
    });

    if (!res.ok) return response;

    const products = await res.json();
    if (!products || products.length === 0) return response;

    const product = products[0];
    const media = product.media || [];
    media.sort((a, b) => (a.display_order || 0) - (b.display_order || 0));
    const images = media.filter(m => m.media_type === 'image' && !m.url.endsWith('.mp4'));
    const primaryImage = images.length > 0 ? images[0].url : (media[0]?.url || '');

    const itemType = (product.product_type || 'прикраса').toLowerCase();
    
    let enType = "Ukrainian Beaded Folk Jewelry";
    let tags = "#прикрасизбісеру #українськіприкраси #до_вишиванки #beadedjewelry #ukrainianjewelry #folkjewelry #rizdviana";
    
    if (itemType.includes("силянк")) {
      enType = "Ukrainian Sylyanka Beaded Necklace";
      tags = "#силянка #силянказбісеру #українськіприкраси #до_вишиванки #beadedjewelry #sylyanka #ukrainianjewelry #seedbeadnecklace #folkjewelry #rizdviana";
    } else if (itemType.includes("гердан")) {
      enType = "Traditional Ukrainian Beaded Gerdan Necklace";
      tags = "#гердан #герданзбісеру #українськіприкраси #до_вишиванки #beadedjewelry #gerdan #ukrainianjewelry #folkjewelry #rizdviana";
    } else if (itemType.includes("чокер")) {
      enType = "Handmade Seed Bead Choker Necklace";
      tags = "#чокер #чокерзбісеру #прикрасизбісеру #beadedchoker #seedbeadjewelry #handmadechoker #rizdviana";
    } else if (itemType.includes("браслет")) {
      enType = "Handmade Beaded Bracelet";
      tags = "#браслет #браслетзбісеру #прикрасизбісеру #beadedbracelet #handmadejewelry #rizdviana";
    }

    const title = `${product.title} — ${enType} | RIZDVIANA.ART`;
    
    const rawDesc = (product.description || '').trim();
    const priceText = product.price ? `Ціна: ${product.price} ₴.` : '';
    const uaPart = rawDesc 
      ? `${rawDesc} ${priceText}`.trim()
      : `Авторська ${itemType} «${product.title}» ручної роботи від майстерні RIZDVIANA.ART. Якісний чеський та японський бісер, автентичний орнамент. ${priceText}`.trim();
      
    const enPart = `Handmade ${enType} by RIZDVIANA.ART. High-quality seed beads, authentic Ukrainian folk design. Worldwide shipping. Order directly on rizdviana.art.`;

    const fullDesc = `${uaPart}\n\n✨ ${enPart}\n\n${tags}`;
    const pageUrl = url.href;

    const safeDesc = escapeXml(fullDesc);
    const safeTitle = escapeXml(title);

    let rewriter = new HTMLRewriter()
      .on('title', { element(el) { el.setInnerContent(title); } })
      .on('meta[property="og:title"]', { element(el) { el.setAttribute('content', title); } })
      .on('meta[property="og:description"]', { element(el) { el.setAttribute('content', fullDesc); } })
      .on('meta[property="og:url"]', { element(el) { el.setAttribute('content', pageUrl); } })
      .on('meta[name="description"]', { element(el) { el.setAttribute('content', fullDesc); } })
      .on('meta[name="twitter:title"]', { element(el) { el.setAttribute('content', title); } })
      .on('meta[name="twitter:description"]', { element(el) { el.setAttribute('content', fullDesc); } });

    if (primaryImage) {
      rewriter = rewriter
        .on('meta[property="og:image"]', { element(el) { el.setAttribute('content', primaryImage); } })
        .on('meta[name="twitter:image"]', { element(el) { el.setAttribute('content', primaryImage); } })
        .on('head', {
          element(el) {
            el.append(`<meta property="og:image:secure_url" content="${primaryImage}" />`, { html: true });
            el.append(`<meta property="og:image:width" content="1000" />`, { html: true });
            el.append(`<meta property="og:image:height" content="1500" />`, { html: true });
            el.append(`<meta name="pinterest:image" content="${primaryImage}" />`, { html: true });
            el.append(`<meta name="pinterest:description" content="${safeDesc}" />`, { html: true });
          }
        })
        .on('body', {
          element(el) {
            const imgTags = images.slice(0, 5).map((img, i) => 
              `<img src="${img.url}" alt="${safeTitle} photo ${i+1}" data-pin-description="${safeDesc}" data-pin-title="${safeTitle}" data-pin-url="${pageUrl}" data-pin-media="${img.url}" width="800" height="1200" style="position:absolute;left:-9999px;top:-9999px;width:800px;height:1200px;opacity:0.01;pointer-events:none;" />`
            ).join('');
            el.prepend(imgTags, { html: true });
          }
        });
    }

    return rewriter.transform(response);
  } catch (err) {
    return response;
  }
}
