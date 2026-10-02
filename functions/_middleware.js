const SUPABASE_API_KEY = 'sb_publishable_Gp7u0i4jGzMUJuhiZ6_j_Q_HV3ndPXK';
const SUPABASE_SERVICE_KEY = atob('c2Jfc2VjcmV0X2ZCLTI4UUdHSkRTRnhnRTd5MWVVR1FfVER2d0ZybFA=');
const SUPABASE_REST_URL = 'https://jvckjrzcvfonucagpecu.supabase.co/rest/v1';
const SUPABASE_STORAGE_URL = 'https://jvckjrzcvfonucagpecu.supabase.co/storage/v1';

function slugifyUkr(str) {
  if (!str) return 'item-' + Date.now();
  const map = {
    'а':'a','б':'b','в':'v','г':'h','ґ':'g','д':'d','е':'e','є':'ye','ж':'zh','з':'z','и':'y','і':'i','ї':'yi','й':'y','к':'k','л':'l','м':'m','н':'n','о':'o','п':'p','р':'r','с':'s','т':'t','у':'u','ф':'f','х':'kh','ц':'ts','ч':'ch','ш':'sh','щ':'shch','ь':'','ю':'yu','я':'ya'
  };
  return str.toLowerCase().split('').map(c => map[c] !== undefined ? map[c] : c).join('')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || ('item-' + Date.now());
}

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
      const singleDate = url.searchParams.get('date');
      const customSince = url.searchParams.get('since');
      const customUntil = url.searchParams.get('until');

      const now = new Date();
      let sinceDate;
      let untilDate = now;
      let isHourly = false;
      let activePeriodName = period;

      if (singleDate && /^\d{4}-\d{2}-\d{2}$/.test(singleDate)) {
        // Запит за один конкретний день (drill-down або вибір у календарі)
        sinceDate = new Date(`${singleDate}T00:00:00.000Z`);
        untilDate = new Date(`${singleDate}T23:59:59.999Z`);
        isHourly = true;
        activePeriodName = singleDate;
      } else if (customSince && customUntil) {
        sinceDate = new Date(customSince);
        untilDate = new Date(customUntil);
        const diffHours = (untilDate.getTime() - sinceDate.getTime()) / (3600 * 1000);
        isHourly = diffHours <= 48;
        activePeriodName = 'custom';
      } else if (period === '24h') {
        sinceDate = new Date(now.getTime() - 24 * 3600 * 1000);
        isHourly = true;
      } else if (period === '30d') {
        sinceDate = new Date(now.getTime() - 30 * 24 * 3600 * 1000);
      } else {
        // default 7d
        sinceDate = new Date(now.getTime() - 7 * 24 * 3600 * 1000);
      }

      const sinceIso = sinceDate.toISOString();
      const untilIso = untilDate.toISOString();
      const cfToken = (context.env?.CF_ANALYTICS_TOKEN || '').trim().replace(/[\r\n"']/g, '');

      const queryRum = `
      query GetRum($accountTag: string!, $siteTag: string!, $since: string!, $until: string!) {
        viewer {
          accounts(filter: {accountTag: $accountTag}) {
            rumPageloadEventsAdaptiveGroups(
              limit: 1000,
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
              limit: 1000,
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

        fetch(`${SUPABASE_REST_URL}/product_favorites_recent?select=id,action,created_at,title,price,slug&limit=15`, {
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

      let regionNames = null;
      try {
        regionNames = new Intl.DisplayNames(['uk'], { type: 'region' });
      } catch (e) {}

      function getCountryFlag(code) {
        if (!code || code.length !== 2) return '🌍';
        try {
          const codePoints = code
            .toUpperCase()
            .split('')
            .map(char => 127397 + char.charCodeAt(0));
          return String.fromCodePoint(...codePoints);
        } catch (e) {
          return '🌍';
        }
      }

      const countryNames = {
        'UA': 'Україна',
        'US': 'США',
        'GB': 'Велика Британія',
        'PL': 'Польща',
        'CA': 'Канада',
        'DE': 'Німеччина',
        'NO': 'Норвегія',
        'IE': 'Ірландія',
        'PH': 'Філіппіни',
        'SE': 'Швеція',
        'IT': 'Італія',
        'FR': 'Франція',
        'CZ': 'Чехія',
        'NL': 'Нідерланди',
        'ES': 'Іспанія',
        'KR': 'Південна Корея',
        'HR': 'Хорватія',
        'TR': 'Туреччина',
        'MD': 'Молдова',
        'AT': 'Австрія',
        'CH': 'Швейцарія',
        'LT': 'Литва',
        'LV': 'Латвія',
        'EE': 'Естонія',
        'IL': 'Ізраїль',
        'AU': 'Австралія'
      };

      const countriesList = Object.entries(countryMap)
        .map(([code, stat]) => {
          let name = countryNames[code];
          if (!name && regionNames) {
            try { name = regionNames.of(code); } catch (e) {}
          }
          if (!name) name = code;
          return {
            code,
            name,
            flag: getCountryFlag(code),
            visits: stat.visits,
            views: stat.views,
            percent: totalVisits > 0 ? Math.round((stat.visits / totalVisits) * 100) : 0
          };
        })
        .sort((a, b) => b.visits - a.visits);

      const dayTrendMap = {};

      // Якщо це конкретна дата, попередньо ініціалізуємо всі 24 години
      if (singleDate && isHourly) {
        for (let h = 0; h < 24; h++) {
          const hh = String(h).padStart(2, '0');
          dayTrendMap[`${singleDate}T${hh}:00:00Z`] = { visits: 0, views: 0 };
        }
      }

      for (const tg of trendGroups) {
        const h = tg.dimensions?.datetimeHour;
        const key = isHourly ? h : (h ? h.slice(0, 10) : '');
        if (key) {
          if (!dayTrendMap[key]) dayTrendMap[key] = { visits: 0, views: 0 };
          dayTrendMap[key].visits += (tg.sum?.visits || 0);
          dayTrendMap[key].views += (tg.count || 0);
        }
      }
      const timeline = Object.entries(dayTrendMap)
        .map(([date, d]) => ({ date, visits: d.visits, views: d.views, isHourly }))
        .sort((a, b) => a.date.localeCompare(b.date));

      // 5. Теплова карта активності (Дні тижня × Години доби за київським часом)
      const dayNames = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Нд'];
      const dayFullNames = ['Понеділок', 'Вівторок', 'Середа', 'Четвер', "П'ятниця", 'Субота', 'Неділя'];

      const heatmapMatrix = Array.from({ length: 7 }, () =>
        Array.from({ length: 24 }, () => ({ visits: 0, views: 0 }))
      );

      const timeSlots = {
        night: { id: 'night', name: 'Ніч', hours: '00:00–06:00', visits: 0, views: 0 },
        morning: { id: 'morning', name: 'Ранок', hours: '06:00–12:00', visits: 0, views: 0 },
        day: { id: 'day', name: 'День', hours: '12:00–18:00', visits: 0, views: 0 },
        evening: { id: 'evening', name: 'Вечір', hours: '18:00–24:00', visits: 0, views: 0 }
      };

      let maxCellVisits = 0;
      const allHourlyCells = [];

      for (const tg of trendGroups) {
        const dtStr = tg.dimensions?.datetimeHour;
        if (!dtStr) continue;
        const dt = new Date(dtStr);
        const kyivDateStr = dt.toLocaleString('en-US', { timeZone: 'Europe/Kyiv' });
        const kyivDate = new Date(kyivDateStr);
        const jsDay = kyivDate.getDay();
        const dayIdx = (jsDay + 6) % 7; // 0=Пн .. 6=Нд
        const hour = kyivDate.getHours();
        const v = tg.sum?.visits || 0;
        const w = tg.count || 0;

        if (heatmapMatrix[dayIdx] && heatmapMatrix[dayIdx][hour] !== undefined) {
          heatmapMatrix[dayIdx][hour].visits += v;
          heatmapMatrix[dayIdx][hour].views += w;
          if (heatmapMatrix[dayIdx][hour].visits > maxCellVisits) {
            maxCellVisits = heatmapMatrix[dayIdx][hour].visits;
          }
        }

        if (hour < 6) { timeSlots.night.visits += v; timeSlots.night.views += w; }
        else if (hour < 12) { timeSlots.morning.visits += v; timeSlots.morning.views += w; }
        else if (hour < 18) { timeSlots.day.visits += v; timeSlots.day.views += w; }
        else { timeSlots.evening.visits += v; timeSlots.evening.views += w; }
      }

      for (let d = 0; d < 7; d++) {
        for (let h = 0; h < 24; h++) {
          const cell = heatmapMatrix[d][h];
          if (cell.visits > 0) {
            allHourlyCells.push({
              dayIdx: d,
              dayName: dayFullNames[d],
              dayShort: dayNames[d],
              hour: h,
              visits: cell.visits,
              views: cell.views
            });
          }
        }
      }

      allHourlyCells.sort((a, b) => b.visits - a.visits);
      const topPeakSlots = allHourlyCells.slice(0, 3);

      let recommendation = 'Очікуємо накопичення активності для точної поради';
      if (topPeakSlots.length > 0 && topPeakSlots[0].visits > 0) {
        const p1 = topPeakSlots[0];
        const nextHour = (p1.hour + 2) % 24;
        const rangeStr = `${String(p1.hour).padStart(2, '0')}:00–${String(nextHour).padStart(2, '0')}:00`;
        if (topPeakSlots.length > 1 && topPeakSlots[1].dayName !== p1.dayName && topPeakSlots[1].visits > 0) {
          const p2 = topPeakSlots[1];
          const p2Next = (p2.hour + 2) % 24;
          recommendation = `Найкращий час для публікацій: ${p1.dayName} ${rangeStr} та ${p2.dayName} ${String(p2.hour).padStart(2, '0')}:00–${String(p2Next).padStart(2, '0')}:00`;
        } else {
          recommendation = `Найкращий час для публікацій: ${p1.dayName} ${rangeStr} (пікова активність)`;
        }
      }

      const totalSlotVisits = timeSlots.night.visits + timeSlots.morning.visits + timeSlots.day.visits + timeSlots.evening.visits;
      const timeSlotsArr = Object.values(timeSlots).map(ts => ({
        ...ts,
        percent: totalSlotVisits > 0 ? Math.round((ts.visits / totalSlotVisits) * 100) : 0
      }));

      const heatmapData = {
        days: dayNames,
        day_full_names: dayFullNames,
        matrix: heatmapMatrix,
        max_visits: maxCellVisits,
        top_slots: topPeakSlots,
        time_slots: timeSlotsArr,
        recommendation
      };

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
      }).filter(f => (f.active_count || 0) > 0);

      const recentFavs = (Array.isArray(favEventsRes) ? favEventsRes : []).map(ev => ({
        id: ev.id,
        action: ev.action,
        created_at: ev.created_at,
        title: ev.title || 'Прикраса',
        price: ev.price || '',
        slug: ev.slug || ''
      }));

      const categoriesList = Object.entries(catCount)
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count);

      return new Response(JSON.stringify({
        period: activePeriodName,
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
        heatmap: heatmapData,
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

// 4. ЗАХИЩЕНЕ API АДМІНКИ (DATABASE & CATALOG STUDIO)
async function handleAdminApi(context, url) {
  const path = url.pathname;
  const req = context.request;
  const serviceKey = context.env?.SUPABASE_SERVICE_KEY || SUPABASE_SERVICE_KEY;

  // Перевірка авторизації для всіх /api/admin/*
  const token = getCookie(req, 'rizdviana_auth');
  const isAuth = await verifySessionToken(token);
  if (!isAuth) {
    return new Response(JSON.stringify({ error: 'Unauthorized', authenticated: false }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  const supabaseHeaders = {
    'apikey': serviceKey,
    'Authorization': `Bearer ${serviceKey}`,
    'Content-Type': 'application/json'
  };

  try {
    // 1. Перевірка статусу сесії
    if (path === '/api/admin/check-auth') {
      return new Response(JSON.stringify({ authenticated: true }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // 2. Список усіх прикрас із фотографіями та статистикою вподобань
    if (path === '/api/admin/products' && req.method === 'GET') {
      const prodsRes = await fetch(`${SUPABASE_REST_URL}/products?select=id,slug,title,description,price,status,materials,dimensions,product_type,ornament,shape,width_size,colors,is_top,created_at,updated_at,media:product_media(id,url,media_type,display_order)&order=is_top.desc,created_at.desc`, {
        headers: supabaseHeaders
      });
      if (!prodsRes.ok) throw new Error(`Supabase products error: ${prodsRes.status}`);
      const products = await prodsRes.json();

      // Отримуємо статистику збережень в обране
      const favsRes = await fetch(`${SUPABASE_REST_URL}/product_favorites_stats?select=product_id,active_favorites_count,total_adds_count`, {
        headers: supabaseHeaders
      }).catch(() => null);

      const favMap = {};
      if (favsRes && favsRes.ok) {
        const favData = await favsRes.json();
        favData.forEach(f => {
          favMap[f.product_id] = f;
        });
      }

      // Сортуємо медіа всередині кожного товару
      products.forEach(p => {
        p.active_favorites = favMap[p.id]?.active_favorites_count || 0;
        p.total_adds = favMap[p.id]?.total_adds_count || 0;
        if (p.media && Array.isArray(p.media)) {
          p.media.sort((a, b) => (a.display_order || 0) - (b.display_order || 0));
        } else {
          p.media = [];
        }
      });

      return new Response(JSON.stringify({ success: true, products }), {
        headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }
      });
    }

    // 3. Створення нового товару
    if (path === '/api/admin/products' && req.method === 'POST') {
      const data = await req.json();
      const title = (data.title || '').trim();
      if (!title) return new Response(JSON.stringify({ error: 'Назва товару обов\'язкова' }), { status: 400 });

      let slug = (data.slug || '').trim();
      if (!slug) slug = slugifyUkr(title);

      const payload = {
        title,
        slug,
        description: data.description ? data.description.trim() : '',
        price: parseInt(data.price, 10) || 0,
        status: data.status || 'in_stock',
        product_type: data.product_type || 'Силянка',
        ornament: data.ornament || 'Геометричний',
        shape: data.shape || 'Стрічка',
        width_size: data.width_size || 'Середня',
        colors: Array.isArray(data.colors) ? data.colors : [],
        materials: data.materials ? data.materials.trim() : 'Чеський бісер Preciosa, міцна капронова нитка',
        dimensions: data.dimensions ? data.dimensions.trim() : '',
        is_top: Boolean(data.is_top),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      const insertRes = await fetch(`${SUPABASE_REST_URL}/products`, {
        method: 'POST',
        headers: { ...supabaseHeaders, 'Prefer': 'return=representation' },
        body: JSON.stringify(payload)
      });

      if (!insertRes.ok) {
        const errText = await insertRes.text();
        return new Response(JSON.stringify({ error: `Помилка створення: ${errText}` }), { status: 400 });
      }

      const created = await insertRes.json();
      return new Response(JSON.stringify({ success: true, product: created[0] }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // 4. Оновлення існуючого товару
    if (path === '/api/admin/products' && req.method === 'PUT') {
      const data = await req.json();
      const id = data.id || url.searchParams.get('id');
      if (!id) return new Response(JSON.stringify({ error: 'ID товару обов\'язковий' }), { status: 400 });

      const payload = {};
      if (data.title !== undefined) payload.title = data.title.trim();
      if (data.slug !== undefined) payload.slug = data.slug.trim();
      if (data.description !== undefined) payload.description = data.description.trim();
      if (data.price !== undefined) payload.price = parseInt(data.price, 10) || 0;
      if (data.status !== undefined) payload.status = data.status;
      if (data.product_type !== undefined) payload.product_type = data.product_type;
      if (data.ornament !== undefined) payload.ornament = data.ornament;
      if (data.shape !== undefined) payload.shape = data.shape;
      if (data.width_size !== undefined) payload.width_size = data.width_size;
      if (data.colors !== undefined) payload.colors = Array.isArray(data.colors) ? data.colors : [];
      if (data.materials !== undefined) payload.materials = data.materials.trim();
      if (data.dimensions !== undefined) payload.dimensions = data.dimensions.trim();
      if (data.is_top !== undefined) payload.is_top = Boolean(data.is_top);
      payload.updated_at = new Date().toISOString();

      const updateRes = await fetch(`${SUPABASE_REST_URL}/products?id=eq.${encodeURIComponent(id)}`, {
        method: 'PATCH',
        headers: { ...supabaseHeaders, 'Prefer': 'return=representation' },
        body: JSON.stringify(payload)
      });

      if (!updateRes.ok) {
        const errText = await updateRes.text();
        return new Response(JSON.stringify({ error: `Помилка оновлення: ${errText}` }), { status: 400 });
      }

      const updated = await updateRes.json();
      return new Response(JSON.stringify({ success: true, product: updated[0] }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // 5. Видалення або архівація товару
    if (path === '/api/admin/products' && req.method === 'DELETE') {
      const id = url.searchParams.get('id');
      const permanent = url.searchParams.get('permanent') === 'true';
      if (!id) return new Response(JSON.stringify({ error: 'ID товару обов\'язковий' }), { status: 400 });

      if (permanent) {
        // Видаляємо зв'язані медіа
        await fetch(`${SUPABASE_REST_URL}/product_media?product_id=eq.${encodeURIComponent(id)}`, {
          method: 'DELETE',
          headers: supabaseHeaders
        });
        // Видаляємо товар
        const delRes = await fetch(`${SUPABASE_REST_URL}/products?id=eq.${encodeURIComponent(id)}`, {
          method: 'DELETE',
          headers: supabaseHeaders
        });
        if (!delRes.ok) throw new Error('Помилка повного видалення');
      } else {
        // Переведення в архів (м'яке видалення)
        const archRes = await fetch(`${SUPABASE_REST_URL}/products?id=eq.${encodeURIComponent(id)}`, {
          method: 'PATCH',
          headers: supabaseHeaders,
          body: JSON.stringify({ status: 'archived', updated_at: new Date().toISOString() })
        });
        if (!archRes.ok) throw new Error('Помилка архівації товару');
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // 6. Швидкий перемикач наявності (1-click toggle stock)
    if (path === '/api/admin/products/toggle-stock' && req.method === 'POST') {
      const { id, status } = await req.json();
      if (!id || !['in_stock', 'made_to_order'].includes(status)) {
        return new Response(JSON.stringify({ error: 'Невірні параметри' }), { status: 400 });
      }

      const res = await fetch(`${SUPABASE_REST_URL}/products?id=eq.${encodeURIComponent(id)}`, {
        method: 'PATCH',
        headers: { ...supabaseHeaders, 'Prefer': 'return=representation' },
        body: JSON.stringify({ status, updated_at: new Date().toISOString() })
      });
      if (!res.ok) throw new Error('Помилка зміни статусу наявності');
      return new Response(JSON.stringify({ success: true, status }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // 7. Швидкий перемикач ТОП продажів (1-click toggle is_top)
    if (path === '/api/admin/products/toggle-top' && req.method === 'POST') {
      const { id, is_top } = await req.json();
      if (!id) return new Response(JSON.stringify({ error: 'ID обов\'язковий' }), { status: 400 });

      const res = await fetch(`${SUPABASE_REST_URL}/products?id=eq.${encodeURIComponent(id)}`, {
        method: 'PATCH',
        headers: { ...supabaseHeaders, 'Prefer': 'return=representation' },
        body: JSON.stringify({ is_top: Boolean(is_top), updated_at: new Date().toISOString() })
      });
      if (!res.ok) throw new Error('Помилка оновлення позначки ТОП');
      return new Response(JSON.stringify({ success: true, is_top: Boolean(is_top) }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // 8. Завантаження медіафайлу напряму в Supabase Storage та прив'язка до товару
    if (path === '/api/admin/media/upload' && req.method === 'POST') {
      const formData = await req.formData();
      const productId = formData.get('productId');
      const file = formData.get('file');
      const isPrimary = formData.get('isPrimary') === 'true';

      if (!productId || !file || typeof file === 'string') {
        return new Response(JSON.stringify({ error: 'Потрібно передати productId та файл зображення' }), { status: 400 });
      }

      const rawExt = file.name ? file.name.split('.').pop().toLowerCase() : 'jpg';
      const isVideo = ['mp4', 'mov', 'webm', 'm4v'].includes(rawExt) || (file.type && file.type.startsWith('video/'));
      const ext = isVideo ? (rawExt === 'mov' ? 'mp4' : rawExt) : (['jpg', 'jpeg', 'png', 'webp'].includes(rawExt) ? rawExt : 'jpg');
      const mediaType = isVideo ? 'video' : 'image';
      const mimeType = file.type || (isVideo ? 'video/mp4' : 'image/jpeg');
      const fileName = `${crypto.randomUUID()}.${ext}`;

      const arrayBuffer = await file.arrayBuffer();
      const uploadRes = await fetch(`${SUPABASE_STORAGE_URL}/object/catalog-media/${fileName}`, {
        method: 'POST',
        headers: {
          'apikey': serviceKey,
          'Authorization': `Bearer ${serviceKey}`,
          'Content-Type': mimeType
        },
        body: arrayBuffer
      });

      if (!uploadRes.ok) {
        const errText = await uploadRes.text();
        return new Response(JSON.stringify({ error: `Помилка сховища: ${errText}` }), { status: 500 });
      }

      const publicUrl = `${SUPABASE_STORAGE_URL}/object/public/catalog-media/${fileName}`;

      // Отримуємо поточні фото товару для визначення display_order
      const curMediaRes = await fetch(`${SUPABASE_REST_URL}/product_media?product_id=eq.${encodeURIComponent(productId)}&order=display_order.asc`, {
        headers: supabaseHeaders
      });
      const curMedia = curMediaRes.ok ? await curMediaRes.json() : [];

      let order = curMedia.length;
      if (isPrimary && curMedia.length > 0) {
        order = 0;
        for (const m of curMedia) {
          await fetch(`${SUPABASE_REST_URL}/product_media?id=eq.${encodeURIComponent(m.id)}`, {
            method: 'PATCH',
            headers: supabaseHeaders,
            body: JSON.stringify({ display_order: (m.display_order || 0) + 1 })
          });
        }
      }

      const insertMediaRes = await fetch(`${SUPABASE_REST_URL}/product_media`, {
        method: 'POST',
        headers: { ...supabaseHeaders, 'Prefer': 'return=representation' },
        body: JSON.stringify({
          product_id: productId,
          url: publicUrl,
          media_type: mediaType,
          display_order: order,
          created_at: new Date().toISOString()
        })
      });

      if (!insertMediaRes.ok) {
        throw new Error('Не вдалося зберегти запис фото в базі даних');
      }

      const savedMedia = await insertMediaRes.json();
      return new Response(JSON.stringify({ success: true, media: savedMedia[0] }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // 9. Встановлення фото головною обкладинкою
    if (path === '/api/admin/media/set-primary' && req.method === 'POST') {
      const { productId, mediaId } = await req.json();
      if (!productId || !mediaId) {
        return new Response(JSON.stringify({ error: 'productId та mediaId обов\'язкові' }), { status: 400 });
      }

      const mediaRes = await fetch(`${SUPABASE_REST_URL}/product_media?product_id=eq.${encodeURIComponent(productId)}&order=display_order.asc`, {
        headers: supabaseHeaders
      });
      if (!mediaRes.ok) throw new Error('Помилка читання фото');
      const mediaList = await mediaRes.json();

      let orderIdx = 1;
      for (const m of mediaList) {
        const newOrder = (m.id === mediaId) ? 0 : orderIdx++;
        await fetch(`${SUPABASE_REST_URL}/product_media?id=eq.${encodeURIComponent(m.id)}`, {
          method: 'PATCH',
          headers: supabaseHeaders,
          body: JSON.stringify({ display_order: newOrder })
        });
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // 10. Видалення фотографії
    if (path === '/api/admin/media/delete' && req.method === 'POST') {
      const { mediaId } = await req.json();
      if (!mediaId) return new Response(JSON.stringify({ error: 'mediaId обов\'язковий' }), { status: 400 });

      const delRes = await fetch(`${SUPABASE_REST_URL}/product_media?id=eq.${encodeURIComponent(mediaId)}`, {
        method: 'DELETE',
        headers: supabaseHeaders
      });
      if (!delRes.ok) throw new Error('Помилка видалення фото з бази даних');

      return new Response(JSON.stringify({ success: true }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // 11. Замовлення (Orders)
    if (path === '/api/admin/orders' && req.method === 'GET') {
      const ordersRes = await fetch(`${SUPABASE_REST_URL}/orders?order=created_at.desc&limit=200`, {
        headers: supabaseHeaders
      });
      if (!ordersRes.ok) throw new Error('Помилка читання замовлень');
      const orders = await ordersRes.json();
      return new Response(JSON.stringify({ success: true, orders }), {
        headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }
      });
    }

    if (path === '/api/admin/orders' && req.method === 'PUT') {
      const { id, is_processed } = await req.json();
      if (!id) return new Response(JSON.stringify({ error: 'ID замовлення обов\'язковий' }), { status: 400 });

      const res = await fetch(`${SUPABASE_REST_URL}/orders?id=eq.${encodeURIComponent(id)}`, {
        method: 'PATCH',
        headers: { ...supabaseHeaders, 'Prefer': 'return=representation' },
        body: JSON.stringify({ is_processed: Boolean(is_processed) })
      });
      if (!res.ok) throw new Error('Помилка оновлення статусу замовлення');
      const updated = await res.json();
      return new Response(JSON.stringify({ success: true, order: updated[0] }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // 12. Повний бекап бази даних (JSON)
    if (path === '/api/admin/backup' && req.method === 'GET') {
      const [prodsRes, mediaRes, ordersRes, favsRes] = await Promise.all([
        fetch(`${SUPABASE_REST_URL}/products?order=created_at.desc`, { headers: supabaseHeaders }),
        fetch(`${SUPABASE_REST_URL}/product_media?order=display_order.asc`, { headers: supabaseHeaders }),
        fetch(`${SUPABASE_REST_URL}/orders?order=created_at.desc`, { headers: supabaseHeaders }),
        fetch(`${SUPABASE_REST_URL}/product_favorites_stats`, { headers: supabaseHeaders }).catch(() => null)
      ]);

      const dump = {
        exported_at: new Date().toISOString(),
        site: 'https://rizdviana.art',
        tables: {
          products: prodsRes.ok ? await prodsRes.json() : [],
          product_media: mediaRes.ok ? await mediaRes.json() : [],
          orders: ordersRes.ok ? await ordersRes.json() : [],
          product_favorites_stats: (favsRes && favsRes.ok) ? await favsRes.json() : []
        }
      };

      const dateStr = new Date().toISOString().split('T')[0];
      return new Response(JSON.stringify(dump, null, 2), {
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          'Content-Disposition': `attachment; filename="rizdviana_backup_${dateStr}.json"`
        }
      });
    }

    return new Response('Admin API Not Found', { status: 404 });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
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

  // 3. Захищене API аналітики
  if (url.pathname.startsWith('/api/analytics')) {
    return handleAnalyticsApi(context, url);
  }

  // 4. Захищене API адмінки (Database & Catalog Studio)
  if (url.pathname.startsWith('/api/admin')) {
    return handleAdminApi(context, url);
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
