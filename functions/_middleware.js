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

function getPinterestCategoryInfo(pType) {
  const pLower = (pType || 'прикраса').toLowerCase();
  if (pLower.includes('силянк')) {
    return {
      enType: 'Sylyanka beaded necklace',
      enTitleType: 'Ukrainian Sylyanka Beaded Necklace',
      tags: '#силянка #силянказбісеру #українськіприкраси #до_вишиванки #beadedjewelry #sylyanka #ukrainianjewelry #seedbeadnecklace #rizdviana'
    };
  } else if (pLower.includes('гердан')) {
    return {
      enType: 'Ukrainian beaded gerdan',
      enTitleType: 'Traditional Ukrainian Beaded Gerdan Necklace',
      tags: '#гердан #герданзбісеру #українськіприкраси #до_вишиванки #beadedjewelry #gerdan #ukrainianjewelry #seedbeadnecklace #rizdviana'
    };
  } else if (pLower.includes('чокер')) {
    return {
      enType: 'Seed bead choker necklace',
      enTitleType: 'Handmade Seed Bead Choker Necklace',
      tags: '#чокер #чокерзбісеру #прикрасизбісеру #beadedchoker #seedbeadjewelry #handmadechoker #rizdviana'
    };
  } else if (pLower.includes('браслет')) {
    return {
      enType: 'Beaded bracelet',
      enTitleType: 'Handmade Beaded Bracelet',
      tags: '#браслет #браслетзбісеру #прикрасизбісеру #beadedbracelet #handmadejewelry #rizdviana'
    };
  }
  return {
    enType: 'Ukrainian beaded jewelry',
    enTitleType: 'Ukrainian Beaded Folk Jewelry',
    tags: '#прикрасизбісеру #українськіприкраси #до_вишиванки #beadedjewelry #ukrainianjewelry #folkjewelry #rizdviana'
  };
}

function buildPinterestFeedDescription(p) {
  const cat = getPinterestCategoryInfo(p.product_type);
  const title = (p.title || 'Прикраса з бісеру').trim();
  const price = p.price ? `Ціна: ${p.price} ₴.` : '';
  const materials = (p.materials || 'Якісний чеський та японський бісер').trim();

  const enPart = `✨ Handmade ${cat.enType} by RIZDVIANA.ART. Worldwide shipping.`;
  const suffix = `\n\n${enPart}\n\n${cat.tags}`;
  const maxUaLen = 500 - suffix.length;

  let uaPart = (p.description || '').trim();
  if (uaPart) {
    if (price) uaPart = `${uaPart}\n${price}`;
  } else {
    uaPart = `Авторська прикраса «${title}» ручної роботи від майстерні RIZDVIANA.ART. ${materials}. ${price}`.trim();
  }

  if (uaPart.length > maxUaLen) {
    let truncated = uaPart.slice(0, maxUaLen - 3).trim();
    const lastSpace = truncated.lastIndexOf(' ');
    if (lastSpace > Math.floor(maxUaLen / 2)) {
      truncated = truncated.slice(0, lastSpace);
    }
    uaPart = truncated + '...';
  }

  return `${uaPart}${suffix}`;
}

// 2. ДИНАМІЧНИЙ FEED.XML ДЛЯ PINTEREST RSS
async function generateDynamicFeed() {
  try {
    const url = `${SUPABASE_REST_URL}/products?select=id,slug,title,description,price,product_type,materials,created_at,media:product_media(url,media_type,display_order)&status=neq.archived&order=created_at.desc`;
    const res = await fetch(url, { headers: { 'apikey': SUPABASE_API_KEY } });
    if (!res.ok) throw new Error(`Supabase error: ${res.status}`);
    const products = await res.json();

    let itemsXml = '';
    for (const p of products) {
      const slug = p.slug || p.id;
      const link = `https://rizdviana.art/?item=${slug}`;
      const title = escapeXml(p.title || 'Прикраса RIZDVIANA.ART');
      const desc = escapeXml(buildPinterestFeedDescription(p));
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

// 3. ЗАХИЩЕНА АНАЛІТИКА (DASHBOARD API)
const CF_ACCOUNT_ID = 'd5c50adce336f113924b6c843f45c076';
const CF_SITE_TAG = 'a168503423bb4fd59fb1d8d9bf15803e';
// CF_ANALYTICS_TOKEN передається через Cloudflare Pages Secrets / context.env
const SESSION_SECRET = 'rizdviana-analytics-session-secret-salt-2026';
const DEFAULT_ADMIN_USER = 'admin';
const DEFAULT_ADMIN_PASS = 'RizdvianaArt#2026';

async function generateSessionToken(username) {
  const period = Math.floor(Date.now() / (1000 * 60 * 60 * 24 * 30));
  const data = new TextEncoder().encode(`${username}:${period}:${SESSION_SECRET}`);
  const hash = await crypto.subtle.digest('SHA-256', data);
  const hashHex = Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
  return `${username}.${period}.${hashHex}`;
}

async function verifySessionToken(token) {
  if (!token || typeof token !== 'string') return false;
  const parts = token.split('.');
  if (parts.length !== 3) return false;
  const [username, periodStr] = parts;
  const period = parseInt(periodStr, 10);
  const currentPeriod = Math.floor(Date.now() / (1000 * 60 * 60 * 24 * 30));
  if (Math.abs(currentPeriod - period) > 1) return false;
  const expected = await generateSessionToken(username);
  return token === expected;
}

function getCookie(request, name) {
  const cookieStr = request.headers.get('Cookie') || '';
  const match = cookieStr.match(new RegExp('(?:^|; )' + name.replace(/([.$?*|{}()\[\]\\\/\+^])/g, '\\$1') + '=([^;]*)'));
  return match ? decodeURIComponent(match[1]) : null;
}

async function handleAnalyticsApi(context, url) {
  const path = url.pathname;
  const req = context.request;

  // А. Вхід (Login)
  if (path === '/api/analytics/auth' && req.method === 'POST') {
    try {
      const body = await req.json();
      const expectedUser = (context.env?.ANALYTICS_USER || DEFAULT_ADMIN_USER).trim().toLowerCase();
      const expectedPass = (context.env?.ANALYTICS_PASSWORD || DEFAULT_ADMIN_PASS).trim();

      const user = (body.username || '').trim().toLowerCase();
      const pass = (body.password || '').trim();

      if (user === expectedUser && pass === expectedPass) {
        const token = await generateSessionToken(user);
        return new Response(JSON.stringify({ success: true }), {
          headers: {
            'Content-Type': 'application/json',
            'Set-Cookie': `rizdviana_auth=${token}; Path=/; Max-Age=2592000; SameSite=Lax; Secure; HttpOnly`
          }
        });
      } else {
        return new Response(JSON.stringify({ success: false, error: 'Невірний логін або пароль' }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    } catch {
      return new Response(JSON.stringify({ success: false, error: 'Помилка запиту' }), { status: 400 });
    }
  }

  // Б. Вихід (Logout)
  if (path === '/api/analytics/logout' && req.method === 'POST') {
    return new Response(JSON.stringify({ success: true }), {
      headers: {
        'Content-Type': 'application/json',
        'Set-Cookie': 'rizdviana_auth=; Path=/; Max-Age=0; SameSite=Lax; Secure; HttpOnly'
      }
    });
  }

  // В. Перевірка статусу сесії
  if (path === '/api/analytics/check-auth') {
    const token = getCookie(req, 'rizdviana_auth');
    const isAuth = await verifySessionToken(token);
    return new Response(JSON.stringify({ authenticated: isAuth }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }

  // Г. Отримання агрегованих даних аналітики
  if (path === '/api/analytics/data') {
    const token = getCookie(req, 'rizdviana_auth');
    const isAuth = await verifySessionToken(token);
    if (!isAuth) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    try {
      const period = url.searchParams.get('period') || '7d';
      const now = new Date();
      let sinceDate = new Date(now.getTime() - 7 * 24 * 3600 * 1000);
      if (period === '24h') {
        sinceDate = new Date(now.getTime() - 24 * 3600 * 1000);
      } else if (period === '30d') {
        sinceDate = new Date(now.getTime() - 30 * 24 * 3600 * 1000);
      }

      const sinceIso = sinceDate.toISOString();
      const untilIso = now.toISOString();
      const cfToken = (context.env?.CF_ANALYTICS_TOKEN || '').trim().replace(/[\r\n"']/g, '');

      const queryRum = `
      query GetRum($accountTag: string!, $siteTag: string!, $since: string!, $until: string!) {
        viewer {
          accounts(filter: {accountTag: $accountTag}) {
            rumPageloadEventsAdaptiveGroups(
              limit: 500,
              filter: {siteTag: $siteTag, datetime_geq: $since, datetime_leq: $until},
              orderBy: [count_DESC]
            ) {
              count
              sum { visits }
              dimensions {
                refererHost
                countryName
                requestPath
              }
            }
          }
        }
      }
      `;

      const queryTrend = `
      query GetRumTrend($accountTag: string!, $siteTag: string!, $since: string!, $until: string!) {
        viewer {
          accounts(filter: {accountTag: $accountTag}) {
            rumPageloadEventsAdaptiveGroups(
              limit: 500,
              filter: {siteTag: $siteTag, datetime_geq: $since, datetime_leq: $until},
              orderBy: [count_DESC]
            ) {
              count
              sum { visits }
              dimensions {
                datetimeHour
              }
            }
          }
        }
      }
      `;

      const [rumRes, trendRes, productsRes, favStatsRes, favEventsRes] = await Promise.all([
        fetch('https://api.cloudflare.com/client/v4/graphql', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${cfToken}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ query: queryRum, variables: { accountTag: CF_ACCOUNT_ID, siteTag: CF_SITE_TAG, since: sinceIso, until: untilIso } })
        }).then(r => r.json()).catch(() => ({})),

        fetch('https://api.cloudflare.com/client/v4/graphql', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${cfToken}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ query: queryTrend, variables: { accountTag: CF_ACCOUNT_ID, siteTag: CF_SITE_TAG, since: sinceIso, until: untilIso } })
        }).then(r => r.json()).catch(() => ({})),

        fetch(`${SUPABASE_REST_URL}/products?select=id,title,price,status,product_type,media:product_media(url,media_type,display_order)&status=neq.archived`, {
          headers: { 'apikey': SUPABASE_API_KEY }
        }).then(r => r.json()).catch(() => []),

        fetch(`${SUPABASE_REST_URL}/product_favorites_stats?select=product_id,title,price,product_type,active_favorites_count,total_adds_count,last_added_at&order=active_favorites_count.desc,total_adds_count.desc&limit=15`, {
          headers: { 'apikey': SUPABASE_API_KEY }
        }).then(r => r.json()).catch(() => []),

        fetch(`${SUPABASE_REST_URL}/product_favorites?select=id,action,created_at,product:products(title,price)&order=created_at.desc&limit=15`, {
          headers: { 'apikey': SUPABASE_API_KEY }
        }).then(r => r.json()).catch(() => [])
      ]);

      const rumGroups = rumRes?.data?.viewer?.accounts?.[0]?.rumPageloadEventsAdaptiveGroups || [];
      const trendGroups = trendRes?.data?.viewer?.accounts?.[0]?.rumPageloadEventsAdaptiveGroups || [];
      if (rumRes?.errors) console.error('Cloudflare RUM GraphQL error:', JSON.stringify(rumRes.errors));

      let totalVisits = 0;
      let totalViews = 0;
      const refMap = {};
      const countryMap = {};

      for (const g of rumGroups) {
        const count = g.count || 0;
        const visits = g.sum?.visits || 0;
        const dims = g.dimensions || {};
        const ref = (dims.refererHost || '').trim();
        const country = dims.countryName || 'Невідомо';

        totalViews += count;
        totalVisits += visits;

        const refKey = ref || 'Direct';
        if (!refMap[refKey]) refMap[refKey] = { visits: 0, views: 0 };
        refMap[refKey].visits += visits;
        refMap[refKey].views += count;

        if (!countryMap[country]) countryMap[country] = { visits: 0, views: 0 };
        countryMap[country].visits += visits;
        countryMap[country].views += count;
      }

      const socialSummary = {
        'Threads': 0,
        'Instagram': 0,
        'Facebook': 0,
        'Pinterest': 0,
        'Direct': 0,
        'Other': 0
      };

      for (const [r, stat] of Object.entries(refMap)) {
        const rLow = r.toLowerCase();
        if (rLow.includes('threads')) socialSummary['Threads'] += stat.visits;
        else if (rLow.includes('instagram')) socialSummary['Instagram'] += stat.visits;
        else if (rLow.includes('facebook')) socialSummary['Facebook'] += stat.visits;
        else if (rLow.includes('pinterest')) socialSummary['Pinterest'] += stat.visits;
        else if (r === 'Direct' || !r) socialSummary['Direct'] += stat.visits;
        else if (!rLow.includes('rizdviana.art')) socialSummary['Other'] += stat.visits;
      }

      const sourcesList = [
        { name: 'Threads', visits: socialSummary['Threads'], icon: 'threads', color: '#101010' },
        { name: 'Instagram', visits: socialSummary['Instagram'], icon: 'instagram', color: '#E1306C' },
        { name: 'Facebook', visits: socialSummary['Facebook'], icon: 'facebook', color: '#1877F2' },
        { name: 'Pinterest', visits: socialSummary['Pinterest'], icon: 'pinterest', color: '#E60023' },
        { name: 'Прямий / Месенджери', visits: socialSummary['Direct'], icon: 'direct', color: '#78716C' }
      ];
      if (socialSummary['Other'] > 0) {
        sourcesList.push({ name: 'Інші сайти', visits: socialSummary['Other'], icon: 'web', color: '#A8A29E' });
      }
      sourcesList.sort((a, b) => b.visits - a.visits);

      const countryNames = {
        'UA': { name: 'Україна', flag: '🇺🇦' },
        'US': { name: 'США', flag: '🇺🇸' },
        'GB': { name: 'Велика Британія', flag: '🇬🇧' },
        'PL': { name: 'Польща', flag: '🇵🇱' },
        'CA': { name: 'Канада', flag: '🇨🇦' },
        'DE': { name: 'Німеччина', flag: '🇩🇪' },
        'NO': { name: 'Норвегія', flag: '🇳🇴' },
        'IE': { name: 'Ірландія', flag: '🇮🇪' },
        'PH': { name: 'Філіппіни', flag: '🇵🇭' },
        'SE': { name: 'Швеція', flag: '🇸🇪' },
        'IT': { name: 'Італія', flag: '🇮🇹' },
        'FR': { name: 'Франція', flag: '🇫🇷' },
        'CZ': { name: 'Чехія', flag: '🇨🇿' },
        'NL': { name: 'Нідерланди', flag: '🇳🇱' },
        'ES': { name: 'Іспанія', flag: '🇪🇸' },
        'KR': { name: 'Південна Корея', flag: '🇰🇷' },
        'HR': { name: 'Хорватія', flag: '🇭🇷' },
        'TR': { name: 'Туреччина', flag: '🇹🇷' },
        'MD': { name: 'Молдова', flag: '🇲🇩' },
        'AT': { name: 'Австрія', flag: '🇦🇹' },
        'CH': { name: 'Швейцарія', flag: '🇨🇭' },
        'LT': { name: 'Литва', flag: '🇱🇹' },
        'LV': { name: 'Латвія', flag: '🇱🇻' },
        'EE': { name: 'Естонія', flag: '🇪🇪' },
        'IL': { name: 'Ізраїль', flag: '🇮🇱' },
        'AU': { name: 'Австралія', flag: '🇦🇺' }
      };

      const countriesList = Object.entries(countryMap)
        .map(([code, stat]) => {
          const info = countryNames[code] || { name: code, flag: '🌍' };
          return {
            code,
            name: info.name,
            flag: info.flag,
            visits: stat.visits,
            views: stat.views,
            percent: totalVisits > 0 ? Math.round((stat.visits / totalVisits) * 100) : 0
          };
        })
        .sort((a, b) => b.visits - a.visits);

      const dayTrendMap = {};
      for (const tg of trendGroups) {
        const h = tg.dimensions?.datetimeHour;
        const day = h ? h.slice(0, 10) : '';
        if (day) {
          if (!dayTrendMap[day]) dayTrendMap[day] = { visits: 0, views: 0 };
          dayTrendMap[day].visits += (tg.sum?.visits || 0);
          dayTrendMap[day].views += (tg.count || 0);
        }
      }
      const timeline = Object.entries(dayTrendMap)
        .map(([date, d]) => ({ date, visits: d.visits, views: d.views }))
        .sort((a, b) => a.date.localeCompare(b.date));

      const prods = Array.isArray(productsRes) ? productsRes : [];
      const prodImagesMap = {};
      const catCount = {};
      let inStockCount = 0;
      let totalValue = 0;

      for (const p of prods) {
        if (p.status === 'in_stock') inStockCount++;
        const pType = p.product_type || 'Прикраса';
        catCount[pType] = (catCount[pType] || 0) + 1;
        totalValue += (p.price || 0);

        const media = p.media || [];
        media.sort((a, b) => (a.display_order || 0) - (b.display_order || 0));
        const firstImg = media.find(m => m.media_type === 'image' && !m.url.endsWith('.mp4'));
        if (firstImg) prodImagesMap[p.id] = firstImg.url;
      }

      const favStats = Array.isArray(favStatsRes) ? favStatsRes : [];
      let totalActiveFavs = 0;
      let totalLifetimeAdds = 0;

      const topFavorites = favStats.map(f => {
        totalActiveFavs += (f.active_favorites_count || 0);
        totalLifetimeAdds += (f.total_adds_count || 0);
        return {
          id: f.product_id,
          title: f.title,
          price: f.price,
          product_type: f.product_type,
          active_count: f.active_favorites_count,
          total_adds: f.total_adds_count,
          last_added_at: f.last_added_at,
          image_url: prodImagesMap[f.product_id] || ''
        };
      }).filter(f => f.total_adds > 0 || f.active_count > 0);

      const recentFavs = (Array.isArray(favEventsRes) ? favEventsRes : []).map(ev => ({
        id: ev.id,
        action: ev.action,
        created_at: ev.created_at,
        title: ev.product?.title || 'Прикраса',
        price: ev.product?.price || ''
      }));

      const categoriesList = Object.entries(catCount)
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count);

      return new Response(JSON.stringify({
        period,
        totals: {
          visits: totalVisits,
          views: totalViews,
          total_products: prods.length,
          in_stock: inStockCount,
          made_to_order: prods.length - inStockCount,
          active_favorites: totalActiveFavs,
          total_favorites_clicks: totalLifetimeAdds,
          catalog_avg_price: prods.length > 0 ? Math.round(totalValue / prods.length) : 0
        },
        sources: sourcesList,
        countries: countriesList,
        timeline,
        top_favorites: topFavorites,
        recent_favorites: recentFavs,
        categories: categoriesList,
        last_updated: new Date().toISOString()
      }), {
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-store'
        }
      });
    } catch (err) {
      return new Response(JSON.stringify({ error: err.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }

  return new Response('Not found', { status: 404 });
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

  // 3. Захищене API аналітики
  if (url.pathname.startsWith('/api/analytics')) {
    return handleAnalyticsApi(context, url);
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
    const supabaseUrl = `${SUPABASE_REST_URL}/products?${filter}&select=id,title,description,price,product_type,materials,media:product_media(url,media_type,display_order)&limit=1`;
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

    const cat = getPinterestCategoryInfo(product.product_type);
    const title = `${product.title} — ${cat.enTitleType} | RIZDVIANA.ART`;
    const fullDesc = buildPinterestFeedDescription(product);
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
