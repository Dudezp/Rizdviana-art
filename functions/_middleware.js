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
    const supabaseUrl = `https://jvckjrzcvfonucagpecu.supabase.co/rest/v1/products?or=(slug.eq.${encodeURIComponent(item)},id.eq.${encodeURIComponent(item)})&select=id,title,description,price,product_type,media:product_media(url,media_type,display_order)&limit=1`;
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
    const title = `${product.title} — авторська ${itemType} з бісеру | RIZDVIANA.ART`;
    const desc = product.description || `Авторська ${itemType} «${product.title}» ручної роботи від майстерні RIZDVIANA.ART. Якісний бісер, автентичний орнамент. Ціна: ${product.price} ₴.`;
    const pageUrl = url.href;

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
          el.setAttribute('content', desc);
        }
      })
      .on('meta[property="og:url"]', {
        element(el) {
          el.setAttribute('content', pageUrl);
        }
      })
      .on('meta[name="description"]', {
        element(el) {
          el.setAttribute('content', desc);
        }
      })
      .on('meta[name="twitter:title"]', {
        element(el) {
          el.setAttribute('content', title);
        }
      })
      .on('meta[name="twitter:description"]', {
        element(el) {
          el.setAttribute('content', desc);
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
          }
        })
        .on('body', {
          element(el) {
            // Pinterest web picker explicitly looks for <img> tags in the HTML with portrait/square aspect ratio
            const imgTags = images.slice(0, 5).map((img, i) => 
              `<img src="${img.url}" alt="${product.title} фото ${i+1}" width="800" height="1200" style="position:absolute;left:-9999px;top:-9999px;width:800px;height:1200px;opacity:0.01;pointer-events:none;" />`
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
