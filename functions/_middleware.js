export async function onRequest(context) {
  const url = new URL(context.request.url);
  const item = url.searchParams.get('item');

  // If no item param or not GET or static asset, pass through directly
  if (!item || context.request.method !== 'GET' || (url.pathname !== '/' && url.pathname !== '/index.html')) {
    return context.next();
  }

  // Fetch the original response (the HTML)
  const response = await context.next();
  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('text/html')) {
    return response;
  }

  try {
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(item);
    const filter = isUuid ? `id=eq.${encodeURIComponent(item)}` : `slug=eq.${encodeURIComponent(item)}`;
    const supabaseUrl = `https://jvckjrzcvfonucagpecu.supabase.co/rest/v1/products?${filter}&select=id,title,description,price,product_type,media:product_media(url,media_type,display_order)&limit=1`;
    const res = await fetch(supabaseUrl, {
      headers: {
        'apikey': 'sb_publishable_Gp7u0i4jGzMUJuhiZ6_j_Q_HV3ndPXK'
      }
    });

    if (!res.ok) {
      return response;
    }

    const products = await res.json();
    if (!products || products.length === 0) {
      return response;
    }

    const product = products[0];
    const media = product.media || [];
    media.sort((a, b) => (a.display_order || 0) - (b.display_order || 0));
    const images = media.filter(m => m.media_type === 'image' && !m.url.endsWith('.mp4'));
    const primaryImage = images.length > 0 ? images[0].url : (media[0]?.url || '');

    const itemType = (product.product_type || 'прикраса').toLowerCase();
    
    // Визначаємо англійську категорію та цільові теги
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

    const escapeAttr = (str) => String(str).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const safeDesc = escapeAttr(fullDesc);
    const safeTitle = escapeAttr(title);

    let rewriter = new HTMLRewriter()
      .on('title', {
        element(el) {
          el.setInnerContent(title);
        }
      })
      .on('meta[property="og:title"]', {
        element(el) {
          el.setAttribute('content', title);
        }
      })
      .on('meta[property="og:description"]', {
        element(el) {
          el.setAttribute('content', fullDesc);
        }
      })
      .on('meta[property="og:url"]', {
        element(el) {
          el.setAttribute('content', pageUrl);
        }
      })
      .on('meta[name="description"]', {
        element(el) {
          el.setAttribute('content', fullDesc);
        }
      })
      .on('meta[name="twitter:title"]', {
        element(el) {
          el.setAttribute('content', title);
        }
      })
      .on('meta[name="twitter:description"]', {
        element(el) {
          el.setAttribute('content', fullDesc);
        }
      });

    if (primaryImage) {
      rewriter = rewriter
        .on('meta[property="og:image"]', {
          element(el) {
            el.setAttribute('content', primaryImage);
          }
        })
        .on('meta[name="twitter:image"]', {
          element(el) {
            el.setAttribute('content', primaryImage);
          }
        })
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
