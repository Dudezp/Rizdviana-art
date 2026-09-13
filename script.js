const INSTAGRAM_USERNAME = "rizdviana.art";
const TELEGRAM_USERNAME = "tatianata91";

const SUPABASE_URL = "https://jvckjrzcvfonucagpecu.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_Gp7u0i4jGzMUJuhiZ6_j_Q_HV3ndPXK";

const DEFAULT_PAGE_TITLE = "RIZDVIANA.ART — Традиційні та сучасні прикраси з бісеру";

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Допоміжні функції захисту від XSS та безпечного виведення
function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function escapeAttr(str) {
    if (str === null || str === undefined) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

// Автоматична оптимізація розміру обкладинки для каталогу через Supabase Image Render API
function getOptimizedImageUrl(url, width = 600, quality = 85) {
    if (!url || typeof url !== 'string') return url;
    if (url.includes('.supabase.co/storage/v1/object/public/')) {
        return url.replace('/storage/v1/object/public/', '/storage/v1/render/image/public/') + `?width=${width}&resize=contain&quality=${quality}`;
    }
    return url;
}

let allProducts = [];
let currentStockFilter = 'all';
let currentProductMedia = [];
let activeMediaIndex = 0;
let activeModalProduct = null;

// Змінні масштабування та панорамування (Zoom & Pan)
let isZoomed = false;
const zoomScale = 2.6;
let panX = 0;
let panY = 0;
let startX = 0;
let startY = 0;
let isDragging = false;
let hasDragged = false;
let wasJustDragging = false;
let mousedownTargetOnBackdrop = false;

// --- ЗАВАНТАЖЕННЯ КАТАЛОГУ ---
async function loadCatalog() {
    const grid = document.getElementById('products-grid');

    // Скелетони замість текстового рядка, щоб уникнути різкого зсуву висоти сторінки (CLS)
    const skeletonCards = Array(12).fill(0).map(() => `
        <div class="bg-white rounded-2xl overflow-hidden border border-craft flex flex-col animate-pulse">
            <div class="aspect-square bg-craft/50"></div>
            <div class="p-5 flex flex-col justify-between gap-4">
                <div class="space-y-2.5">
                    <div class="h-5 bg-craft/70 rounded w-3/4"></div>
                    <div class="h-3 bg-craft/40 rounded w-full"></div>
                    <div class="h-3 bg-craft/40 rounded w-2/3"></div>
                </div>
                <div class="pt-2">
                    <div class="grid grid-cols-2 gap-2 mb-2">
                        <div class="h-9 bg-craft/60 rounded-xl"></div>
                        <div class="h-9 bg-craft/60 rounded-xl"></div>
                    </div>
                    <div class="h-8 bg-craft/40 rounded-xl"></div>
                </div>
            </div>
        </div>
    `).join('');
    
    grid.innerHTML = skeletonCards;

    try {
        const { data, error } = await supabaseClient
            .from('products')
            .select(`
                *,
                media:product_media(url, media_type, display_order)
            `)
            .neq('status', 'archived')
            .order('status', { ascending: true })
            .order('created_at', { ascending: false });

        if (error) throw error;

        allProducts = data || [];
        applyFilters();

        // Автоматичне відкриття прикраси за прямим посиланням у URL (?item=ID або ?item=slug)
        const urlParams = new URLSearchParams(window.location.search);
        const sharedItemId = urlParams.get('item');
        if (sharedItemId) {
            const targetProduct = allProducts.find(p => p.id === sharedItemId || p.slug === sharedItemId);
            if (targetProduct) {
                openModal(targetProduct.id);
            }
        }
    } catch (err) {
        grid.innerHTML = `<div class="col-span-full py-12 text-center text-red-600 text-sm">
            Помилка завантаження каталогу: ${escapeHtml(err.message)}
        </div>`;
    }
}

function setStockFilter(mode) {
    currentStockFilter = mode;
    updatePillPosition(mode);
    applyFilters();
}

function updatePillPosition(mode = currentStockFilter) {
    // Мобільний ковзний тумблер
    const mobPill = document.getElementById('stock-pill-mobile');
    const mobAll = document.getElementById('filter-all-mobile');
    const mobStock = document.getElementById('filter-stock-mobile');

    if (mobPill && mobAll && mobStock) {
        const activeBtn = mode === 'all' ? mobAll : mobStock;
        const inactiveBtn = mode === 'all' ? mobStock : mobAll;

        activeBtn.classList.add('active');
        inactiveBtn.classList.remove('active');

        mobPill.style.width = `${activeBtn.offsetWidth}px`;
        mobPill.style.transform = `translateX(${activeBtn.offsetLeft}px)`;
    }

    // Десктопний ковзний тумблер
    const deskPill = document.getElementById('stock-pill-desktop');
    const deskAll = document.getElementById('filter-all');
    const deskStock = document.getElementById('filter-stock');

    if (deskPill && deskAll && deskStock) {
        const activeBtn = mode === 'all' ? deskAll : deskStock;
        const inactiveBtn = mode === 'all' ? deskStock : deskAll;

        activeBtn.classList.add('active');
        inactiveBtn.classList.remove('active');

        deskPill.style.width = `${activeBtn.offsetWidth}px`;
        deskPill.style.transform = `translateX(${activeBtn.offsetLeft}px)`;
    }
}

function syncFilterAndApply(field, val) {
    const desktopEl = document.getElementById(`select-${field}`);
    const mobileEl = document.getElementById(`mobile-select-${field}`);
    if (desktopEl && desktopEl.value !== val) desktopEl.value = val;
    if (mobileEl && mobileEl.value !== val) mobileEl.value = val;
    applyFilters();
}

function syncSortAndApply(val) {
    const desktopSort = document.getElementById('select-sort');
    const mobileSort = document.getElementById('select-sort-mobile');
    if (desktopSort && desktopSort.value !== val) desktopSort.value = val;
    if (mobileSort && mobileSort.value !== val) mobileSort.value = val;
    applyFilters();
}

function openMobileFilters() {
    const drawer = document.getElementById('mobile-filters-drawer');
    const backdrop = document.getElementById('mobile-filters-backdrop');
    const panel = document.getElementById('mobile-filters-panel');
    if (!drawer) return;

    drawer.classList.remove('hidden');
    document.body.style.overflow = 'hidden';

    requestAnimationFrame(() => {
        if (backdrop) backdrop.classList.remove('opacity-0');
        if (panel) panel.classList.remove('translate-y-full');
    });
}

function closeMobileFilters() {
    const drawer = document.getElementById('mobile-filters-drawer');
    const backdrop = document.getElementById('mobile-filters-backdrop');
    const panel = document.getElementById('mobile-filters-panel');
    if (!drawer) return;

    if (backdrop) backdrop.classList.add('opacity-0');
    if (panel) panel.classList.add('translate-y-full');

    setTimeout(() => {
        drawer.classList.add('hidden');
        document.body.style.overflow = '';
    }, 300);
}

function applyFilters() {
    const type = document.getElementById('select-type')?.value || document.getElementById('mobile-select-type')?.value || '';
    const ornament = document.getElementById('select-ornament')?.value || document.getElementById('mobile-select-ornament')?.value || '';
    const shape = document.getElementById('select-shape')?.value || document.getElementById('mobile-select-shape')?.value || '';
    const width = document.getElementById('select-width')?.value || document.getElementById('mobile-select-width')?.value || '';
    const color = document.getElementById('select-color')?.value || document.getElementById('mobile-select-color')?.value || '';
    const sortBy = document.getElementById('select-sort')?.value || document.getElementById('select-sort-mobile')?.value || 'newest';

    const cleanColor = color ? color.trim().toLowerCase() : '';
    const cleanType = type ? type.trim().toLowerCase() : '';
    const cleanOrnament = ornament ? ornament.trim().toLowerCase() : '';
    const cleanShape = shape ? shape.trim().toLowerCase() : '';
    const cleanWidth = width ? width.trim().toLowerCase() : '';

    let activeFilterCount = 0;
    if (cleanType) activeFilterCount++;
    if (cleanOrnament) activeFilterCount++;
    if (cleanShape) activeFilterCount++;
    if (cleanWidth) activeFilterCount++;
    if (cleanColor) activeFilterCount++;

    const badge = document.getElementById('mobile-filter-badge');
    const trigger = document.getElementById('mobile-filter-trigger');
    if (badge && trigger) {
        if (activeFilterCount > 0) {
            badge.innerText = activeFilterCount;
            badge.classList.remove('hidden');
            badge.classList.add('inline-flex');
            trigger.classList.add('border-stoneDark', 'bg-craft/40');
        } else {
            badge.classList.add('hidden');
            badge.classList.remove('inline-flex');
            trigger.classList.remove('border-stoneDark', 'bg-craft/40');
        }
    }

    const drawerCount = document.getElementById('mobile-drawer-count');
    if (drawerCount) {
        drawerCount.innerText = activeFilterCount > 0 ? `(${activeFilterCount} акт.)` : '';
    }

    let filtered = allProducts.filter(item => {
        if (currentStockFilter === 'in_stock' && item.status !== 'in_stock') return false;
        if (cleanType && (!item.product_type || item.product_type.trim().toLowerCase() !== cleanType)) return false;
        if (cleanOrnament && (!item.ornament || item.ornament.trim().toLowerCase() !== cleanOrnament)) return false;
        if (cleanShape && (!item.shape || item.shape.trim().toLowerCase() !== cleanShape)) return false;
        if (cleanWidth && (!item.width_size || item.width_size.trim().toLowerCase() !== cleanWidth)) return false;
        if (cleanColor) {
            if (!item.colors || !Array.isArray(item.colors)) return false;
            const hasColor = item.colors.some(c => String(c).trim().toLowerCase() === cleanColor);
            if (!hasColor) return false;
        }
        return true;
    });

    filtered.sort((a, b) => {
        if (sortBy === 'price_asc') return (Number(a.price) || 0) - (Number(b.price) || 0);
        if (sortBy === 'price_desc') return (Number(b.price) || 0) - (Number(a.price) || 0);
        if (sortBy === 'title_asc') return (a.title || '').localeCompare(b.title || '', 'uk');
        if (sortBy === 'oldest') return new Date(a.created_at) - new Date(b.created_at);
        return new Date(b.created_at) - new Date(a.created_at);
    });

    const applyBtn = document.getElementById('mobile-apply-btn');
    if (applyBtn) {
        applyBtn.innerText = `Показати вироби (${filtered.length})`;
    }

    const countMob = document.getElementById('items-count-mobile');
    if (countMob) {
        countMob.innerText = `Знайдено робіт: ${filtered.length}`;
    }

    renderProducts(filtered);
}

function resetFilters() {
    ['type', 'ornament', 'shape', 'width', 'color'].forEach(field => {
        const d = document.getElementById(`select-${field}`);
        const m = document.getElementById(`mobile-select-${field}`);
        if (d) d.value = '';
        if (m) m.value = '';
    });
    setStockFilter('all');
}

function renderProducts(items) {
    const grid = document.getElementById('products-grid');
    const countEl = document.getElementById('items-count');
    countEl.innerText = `Знайдено робіт: ${items.length}`;

    if (items.length === 0) {
        grid.innerHTML = `
            <div class="col-span-full py-16 text-center">
                <p class="text-stone-400 text-sm mb-3">Виробів за обраними критеріями не знайдено</p>
                <button onclick="resetFilters()" class="inline-flex items-center gap-1.5 px-4 py-2 bg-stoneDark text-white text-xs font-semibold rounded-xl hover:bg-stone-800 transition shadow-sm">
                    🔄 Скинути фільтри
                </button>
            </div>
        `;
        return;
    }

    grid.innerHTML = items.map((product, index) => {
        const isInStock = product.status === 'in_stock';
        const sortedMedia = product.media ? [...product.media].sort((a, b) => a.display_order - b.display_order) : [];
        
        // Знаходимо перше фото для обкладинки
        const firstImage = sortedMedia.find(m => m.media_type === 'image' && !m.url.endsWith('.mp4'));
        const coverMedia = firstImage 
            ? firstImage.url 
            : (sortedMedia[0]?.url || 'https://images.unsplash.com/photo-1535632066927-ab7c9ab60908?auto=format&fit=crop&w=800&q=80');

        const messageText = isInStock 
            ? `Вітаю! Хочу придбати виріб "${product.title}" (${product.price} грн, в наявності).`
            : `Вітаю! Мене зацікавив виріб "${product.title}" під замовлення. Хочу дізнатися деталі виготовлення.`;

        const directUrl = `https://ig.me/m/${INSTAGRAM_USERNAME}?text=${encodeURIComponent(messageText)}`;
        const telegramUrl = `https://t.me/${TELEGRAM_USERNAME}?text=${encodeURIComponent(messageText)}`;

        const itemType = product.product_type ? product.product_type.toLowerCase() : 'прикраса';
        const seoAlt = `${product.title} — авторська ${itemType} з бісеру ручної роботи, бренд RIZDVIANA.ART`;

        const safeId = escapeAttr(product.id);
        const safeTitle = escapeHtml(product.title);
        const safePrice = escapeHtml(product.price);
        const safeDesc = escapeHtml(product.description || '');
        const safeDimensions = escapeHtml(product.dimensions || '—');
        const safeAlt = escapeAttr(seoAlt);
        const safeTitleAttr = escapeAttr(`${product.title} — RIZDVIANA.ART`);

        // Оптимізація розміру обкладинки для вітрини (швидкий рендер)
        const optimizedCover = getOptimizedImageUrl(coverMedia, 600, 85);
        const safeCoverMedia = escapeAttr(optimizedCover);

        // LCP оптимізація: перші 3 картки першого екрана вантажаться миттєво
        const isAboveFold = index < 3;
        const loadingAttr = isAboveFold ? 'loading="eager"' : 'loading="lazy"';
        const priorityAttr = isAboveFold ? 'fetchpriority="high"' : 'fetchpriority="auto"';

        return `
            <div class="product-card group bg-white rounded-2xl overflow-hidden border border-craft flex flex-col transition hover:shadow-lg">
                <div role="button" tabindex="0" onclick="openModal('${safeId}')" onkeydown="if(event.key==='Enter'||event.key===' ')openModal('${safeId}')" class="relative aspect-square overflow-hidden bg-craft/20 flex items-center justify-center p-1.5 cursor-pointer focus:outline-none">
                    <img 
                        src="${safeCoverMedia}" 
                        alt="${safeAlt}" 
                        title="${safeTitleAttr}"
                        ${loadingAttr}
                        ${priorityAttr}
                        decoding="async"
                        width="400"
                        height="400"
                        class="w-full h-full object-contain transition duration-500 group-hover:scale-105" 
                    />
                    
                    <span class="absolute top-3 left-3 text-[10px] font-semibold uppercase tracking-wider px-2.5 py-1 rounded-full ${
                        isInStock 
                            ? 'bg-emerald-900/80 backdrop-blur text-emerald-100' 
                            : 'bg-stone-800/80 backdrop-blur text-stone-300'
                    }">
                        ${isInStock ? 'В наявності' : 'Під замовлення'}
                    </span>

                    ${sortedMedia.length > 1 ? `
                        <div class="absolute bottom-3 right-3 bg-stone-900/70 backdrop-blur px-2 py-0.5 rounded-full text-[10px] text-white">
                            +${sortedMedia.length - 1} фото/відео
                        </div>
                    ` : ''}
                </div>

                <div class="p-5 flex flex-col flex-grow justify-between gap-4">
                    <div role="button" tabindex="0" onclick="openModal('${safeId}')" onkeydown="if(event.key==='Enter'||event.key===' ')openModal('${safeId}')" class="cursor-pointer focus:outline-none">
                        <div class="flex items-baseline justify-between gap-2 mb-1">
                            <h3 class="font-serif font-bold text-lg text-stoneDark group-hover:text-stone-600 transition">${safeTitle}</h3>
                            <span class="font-semibold text-base whitespace-nowrap text-stoneDark">${safePrice} ₴</span>
                        </div>
                        <p class="text-xs text-stone-500 line-clamp-2 mb-3">${safeDesc}</p>
                        <div class="text-[11px] text-stone-400 space-y-1 border-t border-craft pt-3">
                            <div><strong class="text-stone-600">Розміри:</strong> ${safeDimensions}</div>
                        </div>
                    </div>

                    <div class="flex flex-col gap-2 pt-2">
                        <div class="grid grid-cols-2 gap-2">
                            <a href="${directUrl}" target="_blank" class="text-center py-2.5 px-3 rounded-xl text-xs font-semibold uppercase tracking-wider bg-stoneDark text-white hover:bg-stone-800 transition">
                                Instagram
                            </a>
                            <a href="${telegramUrl}" target="_blank" class="text-center py-2.5 px-3 rounded-xl text-xs font-semibold uppercase tracking-wider bg-craft text-stoneDark hover:bg-stone-200 transition">
                                Telegram
                            </a>
                        </div>
                        <button onclick="openModalWithOrder('${safeId}')" class="w-full text-center py-2 px-3 rounded-xl text-xs font-medium text-stone-600 hover:text-stoneDark hover:bg-craft/50 border border-craft transition flex items-center justify-center gap-1.5">
                            <span>📞</span> Швидке замовлення
                        </button>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

// --- КАРТКА ТОВАРУ ТА ШВИДКЕ ЗАМОВЛЕННЯ ---
function openModal(productId) {
    const product = allProducts.find(p => p.id === productId || p.slug === productId);
    if (!product) return;

    // В адресному рядку показуємо slug (якщо є) або id
    const itemIdentifier = product.slug || product.id;
    const currentParam = new URLSearchParams(window.location.search).get('item');
    if (currentParam !== itemIdentifier) {
        window.history.pushState({ productId: product.id }, '', `?item=${itemIdentifier}`);
    }

    // Динамічна зміна назви вкладки браузера
    document.title = `${product.title} — RIZDVIANA.ART`;

    activeModalProduct = product;
    const isInStock = product.status === 'in_stock';
    
    document.getElementById('modal-title').innerText = product.title;
    document.getElementById('modal-price').innerText = `${product.price} ₴`;
    document.getElementById('modal-description').innerText = product.description || 'Опис відсутній.';
    document.getElementById('modal-materials').innerText = product.materials || '—';
    document.getElementById('modal-dimensions').innerText = product.dimensions || '—';
    document.getElementById('modal-shape-type').innerText = `${product.product_type || ''} (${product.shape || 'Стандартна'}, ширина: ${product.width_size || '—'})`;

    const statusBadge = document.getElementById('modal-status-badge');
    if (isInStock) {
        statusBadge.className = 'text-[10px] font-semibold uppercase tracking-wider px-2.5 py-1 rounded-full bg-emerald-900/80 text-emerald-100';
        statusBadge.innerText = 'В наявності';
    } else {
        statusBadge.className = 'text-[10px] font-semibold uppercase tracking-wider px-2.5 py-1 rounded-full bg-stone-800/80 text-stone-300';
        statusBadge.innerText = 'Під замовлення';
    }

    const colorsBox = document.getElementById('modal-colors');
    if (product.colors && product.colors.length > 0) {
        colorsBox.innerHTML = product.colors.map(c => {
            const str = String(c).trim();
            const cap = str ? str.charAt(0).toUpperCase() + str.slice(1) : '';
            return `<span class="bg-craft px-2 py-0.5 rounded text-[10px] text-stone-700">${escapeHtml(cap)}</span>`;
        }).join('');
    } else {
        colorsBox.innerHTML = '<span class="text-stone-400">—</span>';
    }

    const messageText = isInStock 
        ? `Вітаю! Хочу придбати виріб "${product.title}" (${product.price} грн, в наявності).`
        : `Вітаю! Мене зацікавив виріб "${product.title}" під замовлення. Хочу дізнатися деталі виготовлення.`;

    document.getElementById('modal-btn-instagram').href = `https://ig.me/m/${INSTAGRAM_USERNAME}?text=${encodeURIComponent(messageText)}`;
    document.getElementById('modal-btn-telegram').href = `https://t.me/${TELEGRAM_USERNAME}?text=${encodeURIComponent(messageText)}`;

    hideQuickOrderForm();

    currentProductMedia = product.media && product.media.length > 0 
        ? [...product.media].sort((a, b) => a.display_order - b.display_order)
        : [{ url: 'https://images.unsplash.com/photo-1535632066927-ab7c9ab60908?auto=format&fit=crop&w=800&q=80', media_type: 'image' }];

    activeMediaIndex = 0;
    renderModalCardMedia();

    document.getElementById('product-modal').classList.remove('hidden');
    document.body.style.overflow = 'hidden';
}

function openModalWithOrder(productId) {
    openModal(productId);
    showQuickOrderForm();
}

function showQuickOrderForm() {
    document.getElementById('modal-action-buttons').classList.add('hidden');
    document.getElementById('modal-quick-order').classList.remove('hidden');
    const alertBox = document.getElementById('order-form-alert');
    alertBox.className = 'hidden text-xs py-1.5 px-2 rounded';
    alertBox.innerText = '';
}

function hideQuickOrderForm() {
    document.getElementById('modal-action-buttons').classList.remove('hidden');
    document.getElementById('modal-quick-order').classList.add('hidden');
}

async function submitQuickOrder() {
    if (!activeModalProduct) return;

    const hpInput = document.getElementById('order-cust-hp');
    const nameInput = document.getElementById('order-cust-name');
    const phoneInput = document.getElementById('order-cust-phone');
    const commInput = document.getElementById('order-cust-comment');
    const alertBox = document.getElementById('order-form-alert');
    const submitBtn = document.getElementById('btn-submit-order');

    // Антиспам-пастка: якщо бот заповнив приховане поле, імітуємо успіх без запису в базу
    if (hpInput && hpInput.value.trim() !== '') {
        alertBox.className = 'text-xs py-2 px-2.5 rounded bg-emerald-100 text-emerald-800 block';
        alertBox.innerText = "✅ Дякуємо! Замовлення прийнято. Майстриня зв'яжеться з вами найближчим часом.";
        nameInput.value = '';
        phoneInput.value = '';
        commInput.value = '';
        setTimeout(() => {
            closeModal();
        }, 1500);
        return;
    }

    const name = nameInput.value.trim();
    const phone = phoneInput.value.trim();
    const comment = commInput.value.trim();

    if (!name) {
        alertBox.className = 'text-xs py-1.5 px-2.5 rounded bg-red-100 text-red-700 block';
        alertBox.innerText = "Будь ласка, вкажіть ваше ім'я.";
        return;
    }

    // Надійна валідація номера (Україна або міжнародний)
    const digits = phone.replace(/\D/g, '');
    const isUaValid = digits.startsWith('380') && digits.length === 12;
    const isIntlValid = !digits.startsWith('380') && digits.length >= 10 && digits.length <= 15;

    if (!isUaValid && !isIntlValid) {
        alertBox.className = 'text-xs py-1.5 px-2.5 rounded bg-red-100 text-red-700 block';
        alertBox.innerText = "Введіть коректний номер: +380 (XX) XXX-XX-XX або міжнародний (+48...)";
        return;
    }

    submitBtn.disabled = true;
    submitBtn.innerText = "Відправляємо...";

    try {
        const { error } = await supabaseClient
            .from('orders')
            .insert({
                product_id: activeModalProduct.id,
                product_title: activeModalProduct.title,
                product_price: activeModalProduct.price,
                customer_name: name,
                customer_phone: phone,
                customer_comment: comment || null
            });

        if (error) throw error;

        alertBox.className = 'text-xs py-2 px-2.5 rounded bg-emerald-100 text-emerald-800 block';
        alertBox.innerText = "✅ Дякуємо! Замовлення прийнято. Майстриня зв'яжеться з вами найближчим часом.";
        
        nameInput.value = '';
        phoneInput.value = '';
        commInput.value = '';
        submitBtn.classList.add('hidden');

        setTimeout(() => {
            closeModal();
            submitBtn.disabled = false;
            submitBtn.innerText = "Підтвердити замовлення";
            submitBtn.classList.remove('hidden');
        }, 3500);

    } catch (err) {
        alertBox.className = 'text-xs py-1.5 px-2.5 rounded bg-red-100 text-red-700 block';
        alertBox.innerText = `Помилка: ${err.message}`;
        submitBtn.disabled = false;
        submitBtn.innerText = "Підтвердити замовлення";
    }
}

function renderModalCardMedia() {
    const mainContainer = document.getElementById('modal-main-media');
    const thumbsContainer = document.getElementById('modal-thumbnails');
    const counterEl = document.getElementById('modal-media-counter');
    
    const total = currentProductMedia.length;
    const activeItem = currentProductMedia[activeMediaIndex];

    counterEl.innerText = `${activeMediaIndex + 1} / ${total}`;

    const itemTitle = activeModalProduct ? activeModalProduct.title : 'Прикраса з бісеру';
    const itemType = activeModalProduct?.product_type ? activeModalProduct.product_type.toLowerCase() : 'прикраса';
    const safeItemAlt = escapeAttr(`${itemTitle} — ${itemType} ручної роботи RIZDVIANA.ART`);
    const safeUrl = escapeAttr(activeItem.url);

    if (activeItem.media_type === 'video' || activeItem.url.endsWith('.mp4')) {
        mainContainer.innerHTML = `
            <video src="${safeUrl}" controls autoplay loop muted playsinline class="w-full h-full object-contain"></video>
        `;
    } else {
        mainContainer.innerHTML = `
            <img 
                src="${safeUrl}" 
                class="w-full h-full object-contain" 
                alt="${safeItemAlt}" 
                decoding="async"
            />
        `;
    }

    if (total > 1) {
        thumbsContainer.classList.remove('hidden');
        thumbsContainer.innerHTML = currentProductMedia.map((m, idx) => `
            <button onclick="event.stopPropagation(); setActiveMedia(${idx})" class="w-12 h-12 rounded-lg overflow-hidden border-2 flex-shrink-0 relative transition ${
                idx === activeMediaIndex ? 'border-stoneDark ring-1 ring-stoneDark opacity-100' : 'border-transparent opacity-60 hover:opacity-100'
            }">
                ${m.media_type === 'video' || m.url.endsWith('.mp4')
                    ? `<div class="w-full h-full bg-stone-800 text-white flex items-center justify-center text-[9px]">▶</div>`
                    : `<img src="${escapeAttr(m.url)}" class="w-full h-full object-cover" alt="Ракурс ${idx + 1}" loading="lazy" decoding="async" />`
                }
            </button>
        `).join('');
    } else {
        thumbsContainer.classList.add('hidden');
    }
}

function setActiveMedia(index) {
    activeMediaIndex = index;
    renderModalCardMedia();
}

function closeModal() {
    document.getElementById('product-modal').classList.add('hidden');
    document.body.style.overflow = '';
    const videoEl = document.querySelector('#modal-main-media video');
    if (videoEl) videoEl.pause();
    activeModalProduct = null;

    // Відновлюємо оригінальний заголовок вкладки
    document.title = DEFAULT_PAGE_TITLE;

    if (new URLSearchParams(window.location.search).has('item')) {
        window.history.pushState({}, '', window.location.pathname);
    }
}

function handleBackdropClick(e) {
    if (e.target.id === 'product-modal') closeModal();
}

// --- ФУНКЦІЯ «ПОДІЛИТИСЯ ПРИКРАСОЮ» ---
function shareCurrentProduct() {
    if (!activeModalProduct) return;

    const itemIdentifier = activeModalProduct.slug || activeModalProduct.id;
    const shareUrl = `${window.location.origin}${window.location.pathname}?item=${itemIdentifier}`;
    const shareTitle = `${activeModalProduct.title} — RIZDVIANA.ART`;
    const shareText = `Авторська прикраса з бісеру «${activeModalProduct.title}» від RIZDVIANA.ART`;

    if (navigator.share) {
        navigator.share({
            title: shareTitle,
            text: shareText,
            url: shareUrl
        }).catch((err) => {
            if (err.name !== 'AbortError') copyLinkFallback(shareUrl);
        });
    } else {
        copyLinkFallback(shareUrl);
    }
}

function copyLinkFallback(url) {
    navigator.clipboard.writeText(url).then(() => {
        const btnText = document.getElementById('share-btn-text');
        if (btnText) {
            const oldText = btnText.innerText;
            btnText.innerText = "✅ Посилання скопійовано!";
            setTimeout(() => {
                btnText.innerText = oldText;
            }, 2500);
        }
    }).catch(() => {
        prompt("Скопіюйте посилання на виріб:", url);
    });
}

window.addEventListener('popstate', (e) => {
    if (e.state && e.state.productId) {
        openModal(e.state.productId);
    } else {
        const itemParam = new URLSearchParams(window.location.search).get('item');
        if (itemParam) {
            openModal(itemParam);
        } else {
            const productModal = document.getElementById('product-modal');
            if (productModal && !productModal.classList.contains('hidden')) {
                closeModal();
            }
        }
    }
});

// --- ПОКРАЩЕНА ГАЛЕРЕЯ ТА ЗУМ (ВИКОРИСТОВУЄ ОРИГІНАЛЬНУ ЯКІСТЬ) ---
function openZoom(index = 0) {
    activeMediaIndex = index;
    renderZoomGallery();

    const zoomLightbox = document.getElementById('zoom-lightbox');
    zoomLightbox.style.display = 'flex';
    setTimeout(() => zoomLightbox.classList.add('active'), 10);
}

function renderZoomGallery() {
    const container = document.getElementById('zoom-container');
    const thumbs = document.getElementById('zoom-thumbnails');
    const prevBtn = document.getElementById('zoom-arrow-prev');
    const nextBtn = document.getElementById('zoom-arrow-next');

    resetZoomState();

    const total = currentProductMedia.length;
    const activeItem = currentProductMedia[activeMediaIndex];
    const itemTitle = activeModalProduct ? activeModalProduct.title : 'Виріб';

    prevBtn.style.display = total > 1 ? 'flex' : 'none';
    nextBtn.style.display = total > 1 ? 'flex' : 'none';

    const safeZoomTitle = escapeAttr(activeModalProduct ? activeModalProduct.title : 'Виріб');
    const safeZoomUrl = escapeAttr(activeItem.url);

    if (activeItem.media_type === 'video' || activeItem.url.endsWith('.mp4')) {
        container.innerHTML = `
            <video src="${safeZoomUrl}" controls autoplay playsinline class="zoom-video" onclick="event.stopPropagation()"></video>
        `;
    } else {
        container.innerHTML = `
            <img src="${safeZoomUrl}" id="activeZoomImg" class="zoom-img" alt="${safeZoomTitle} — детальне макро-фото бісерного плетіння" draggable="false">
        `;
        const img = document.getElementById('activeZoomImg');
        setupZoomAndPan(img);
    }

    if (total > 1) {
        thumbs.style.display = 'flex';
        thumbs.innerHTML = currentProductMedia.map((m, idx) => `
            <button onclick="setZoomMedia(${idx})" class="zoom-thumb-btn ${idx === activeMediaIndex ? 'active' : ''}">
                ${m.media_type === 'video' || m.url.endsWith('.mp4')
                    ? `<div class="w-full h-full bg-stone-900 text-white flex items-center justify-center text-[10px]">▶</div>`
                    : `<img src="${escapeAttr(m.url)}" draggable="false" alt="Мініатюра деталізації ${idx + 1}" />`
                }
            </button>
        `).join('');
    } else {
        thumbs.style.display = 'none';
    }

    renderModalCardMedia();
}

function setupZoomAndPan(img) {
    img.addEventListener('click', (e) => {
        e.stopPropagation();
        if (hasDragged || wasJustDragging) return;

        if (isZoomed) {
            resetZoomImg(img);
        } else {
            zoomInImg(e, img);
        }
    });

    img.addEventListener('mousedown', (e) => {
        if (!isZoomed) return;
        e.preventDefault();
        isDragging = true;
        hasDragged = false;
        startX = e.clientX - panX;
        startY = e.clientY - panY;
        img.style.transition = 'none';
    });

    img.addEventListener('touchstart', (e) => {
        if (!isZoomed || e.touches.length !== 1) return;
        isDragging = true;
        hasDragged = false;
        startX = e.touches[0].clientX - panX;
        startY = e.touches[0].clientY - panY;
        img.style.transition = 'none';
    }, { passive: true });
}

function zoomInImg(e, img) {
    isZoomed = true;
    img.classList.add('magnified');

    const rect = img.getBoundingClientRect();
    const clickX = e.clientX - rect.left - rect.width / 2;
    const clickY = e.clientY - rect.top - rect.height / 2;

    panX = -clickX * (zoomScale - 1);
    panY = -clickY * (zoomScale - 1);

    applyPanBounds(img);

    img.style.transition = 'transform 0.3s cubic-bezier(0.2, 0, 0.2, 1)';
    img.style.transform = `translate(${panX}px, ${panY}px) scale(${zoomScale})`;

    const hint = document.getElementById('zoom-hint');
    if (hint) hint.innerText = 'Перетягуйте мишкою або пальцем, щоб оглянути плетіння • Клік для виходу з зуму';
}

function resetZoomImg(img) {
    if (!img) return;
    isZoomed = false;
    panX = 0;
    panY = 0;
    img.classList.remove('magnified');
    img.style.transition = 'transform 0.3s cubic-bezier(0.2, 0, 0.2, 1)';
    img.style.transform = 'translate(0px, 0px) scale(1)';

    const hint = document.getElementById('zoom-hint');
    if (hint) hint.innerText = 'Клікніть по фото для наближення деталей • Клік по фону для виходу';
}

function resetZoomState() {
    isZoomed = false;
    panX = 0;
    panY = 0;
    isDragging = false;
    hasDragged = false;
    wasJustDragging = false;
}

function applyPanBounds(img) {
    if (!img) return;
    const rect = img.getBoundingClientRect();
    const limitX = Math.max(120, (rect.width * (zoomScale - 1)) / 1.5);
    const limitY = Math.max(120, (rect.height * (zoomScale - 1)) / 1.5);

    panX = Math.max(-limitX, Math.min(limitX, panX));
    panY = Math.max(-limitY, Math.min(limitY, panY));
}

const zoomLightboxEl = document.getElementById('zoom-lightbox');
if (zoomLightboxEl) {
    zoomLightboxEl.addEventListener('mousedown', (e) => {
        mousedownTargetOnBackdrop = (e.target.id === 'zoom-lightbox' || e.target.id === 'zoom-container');
    });
}

window.addEventListener('mousemove', (e) => {
    if (!isDragging || !isZoomed) return;
    const img = document.getElementById('activeZoomImg');
    if (!img) return;

    const currentPanX = e.clientX - startX;
    const currentPanY = e.clientY - startY;

    if (Math.hypot(currentPanX - panX, currentPanY - panY) > 4) {
        hasDragged = true;
    }

    panX = currentPanX;
    panY = currentPanY;
    applyPanBounds(img);

    img.style.transform = `translate(${panX}px, ${panY}px) scale(${zoomScale})`;
});

window.addEventListener('mouseup', () => {
    if (isDragging) {
        isDragging = false;
        if (hasDragged) {
            wasJustDragging = true;
            setTimeout(() => {
                wasJustDragging = false;
                hasDragged = false;
            }, 120);
        }
        const img = document.getElementById('activeZoomImg');
        if (img) img.style.transition = 'transform 0.2s ease-out';
    }
});

window.addEventListener('touchmove', (e) => {
    if (!isDragging || !isZoomed || e.touches.length !== 1) return;
    const img = document.getElementById('activeZoomImg');
    if (!img) return;

    const currentPanX = e.touches[0].clientX - startX;
    const currentPanY = e.touches[0].clientY - startY;

    if (Math.hypot(currentPanX - panX, currentPanY - panY) > 4) {
        hasDragged = true;
    }

    panX = currentPanX;
    panY = currentPanY;
    applyPanBounds(img);

    img.style.transform = `translate(${panX}px, ${panY}px) scale(${zoomScale})`;
}, { passive: true });

window.addEventListener('touchend', () => {
    if (isDragging) {
        isDragging = false;
        if (hasDragged) {
            wasJustDragging = true;
            setTimeout(() => {
                wasJustDragging = false;
                hasDragged = false;
            }, 120);
        }
    }
});

function handleZoomOverlayClick(e) {
    if (wasJustDragging || hasDragged) return;
    if (mousedownTargetOnBackdrop && (e.target.id === 'zoom-lightbox' || e.target.id === 'zoom-container')) {
        closeZoom(e);
    }
}

function setZoomMedia(index) {
    activeMediaIndex = index;
    renderZoomGallery();
}

function prevZoomMedia(e) {
    if (e) e.stopPropagation();
    const total = currentProductMedia.length;
    activeMediaIndex = (activeMediaIndex - 1 + total) % total;
    renderZoomGallery();
}

function nextZoomMedia(e) {
    if (e) e.stopPropagation();
    const total = currentProductMedia.length;
    activeMediaIndex = (activeMediaIndex + 1) % total;
    renderZoomGallery();
}

function closeZoom(e) {
    if (e) e.stopPropagation();
    const zoomLightbox = document.getElementById('zoom-lightbox');
    const video = document.querySelector('#zoom-container video');
    if (video) video.pause();

    resetZoomState();
    zoomLightbox.classList.remove('active');
    setTimeout(() => {
        zoomLightbox.style.display = 'none';
        document.getElementById('zoom-container').innerHTML = '';
    }, 200);
}

// Керування клавіатурою
window.addEventListener('keydown', (e) => {
    const zoomLightbox = document.getElementById('zoom-lightbox');
    const isZoomOpen = zoomLightbox && zoomLightbox.classList.contains('active');

    if (isZoomOpen) {
        if (e.key === 'ArrowLeft') prevZoomMedia();
        if (e.key === 'ArrowRight') nextZoomMedia();
        if (e.key === 'Escape') {
            if (isZoomed) {
                resetZoomImg(document.getElementById('activeZoomImg'));
            } else {
                closeZoom();
            }
        }
        return;
    }

    const productModal = document.getElementById('product-modal');
    if (productModal && !productModal.classList.contains('hidden')) {
        if (e.key === 'Escape') closeModal();
    }
});

// СКРОЛ ШАПКИ
const stickyHeader = document.getElementById('sticky-header');
const btnScrollTop = document.getElementById('btn-scroll-top');

let currentStage = 0;
let scrollTicking = false;

window.addEventListener('scroll', () => {
    if (!scrollTicking) {
        window.requestAnimationFrame(() => {
            const scrollY = window.scrollY;

            if (stickyHeader) {
                if (currentStage === 0) {
                    if (scrollY > 60) {
                        currentStage = 1;
                        stickyHeader.classList.add('step-1');
                        stickyHeader.classList.remove('step-2');
                    }
                } else if (currentStage === 1) {
                    if (scrollY > 150) {
                        currentStage = 2;
                        stickyHeader.classList.remove('step-1');
                        stickyHeader.classList.add('step-2');
                    } else if (scrollY < 25) {
                        currentStage = 0;
                        stickyHeader.classList.remove('step-1', 'step-2');
                    }
                } else if (currentStage === 2) {
                    if (scrollY < 110) {
                        currentStage = 1;
                        stickyHeader.classList.add('step-1');
                        stickyHeader.classList.remove('step-2');
                    }
                }
            }

            if (btnScrollTop) {
                if (scrollY > 400) {
                    btnScrollTop.classList.add('visible');
                } else {
                    btnScrollTop.classList.remove('visible');
                }
            }

            scrollTicking = false;
        });
        scrollTicking = true;
    }
}, { passive: true });

function scrollToTop() {
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// --- РОЗУМНА МАСКА НОМЕРА ТЕЛЕФОНУ (УКРАЇНА ТА МІЖНАРОДНИЙ ФОРМАТ) ---
function initPhoneMask() {
    const phoneInput = document.getElementById('order-cust-phone');
    if (!phoneInput) return;

    phoneInput.addEventListener('input', function(e) {
        let val = e.target.value;

        // Якщо користувач вводить або вставляє міжнародний номер з "+", що не є кодом України
        // (наприклад +48, +1, +49), дозволяємо вільний міжнародний ввід без примусу до +380
        if (val.startsWith('+') && !val.startsWith('+380') && !val.startsWith('+38') && !val.startsWith('+3')) {
            e.target.value = '+' + val.replace(/[^\d\s-]/g, '').substring(1, 18);
            return;
        }

        let digits = val.replace(/\D/g, '');

        if (digits.startsWith('0')) {
            digits = '38' + digits;
        } else if (!digits.startsWith('380') && digits.length > 0) {
            if (!digits.startsWith('38') && !digits.startsWith('3')) {
                digits = '380' + digits;
            }
        }

        digits = digits.substring(0, 12);

        let formatted = '';
        if (digits.length > 0) formatted = '+' + digits.substring(0, 3);
        if (digits.length > 3) formatted += ' (' + digits.substring(3, 5);
        if (digits.length >= 5) formatted += ') ' + digits.substring(5, 8);
        if (digits.length >= 8) formatted += '-' + digits.substring(8, 10);
        if (digits.length >= 10) formatted += '-' + digits.substring(10, 12);

        e.target.value = formatted;
    });

    phoneInput.addEventListener('focus', function(e) {
        if (!e.target.value.trim()) {
            e.target.value = '+380 (';
        }
    });

    phoneInput.addEventListener('blur', function(e) {
        const val = e.target.value.trim();
        const digits = val.replace(/\D/g, '');
        if (digits === '380' || digits === '38' || digits === '3' || digits === '' || val === '+') {
            e.target.value = '';
        }
    });
}

// --- СМАРТ-ПІДКАЗКА ВСТАНОВЛЕННЯ ДЛЯ IOS SAFARI (PWA) ---
function showIosBanner(immediate = false) {
    const banner = document.getElementById('pwa-ios-banner');
    if (!banner) return;
    if (immediate) {
        banner.style.transition = 'none';
    }
    banner.classList.remove('translate-y-32', 'opacity-0', 'pointer-events-none');
    banner.classList.add('translate-y-0', 'opacity-100', 'pointer-events-auto');
}

function dismissIosBanner(forever = true) {
    const banner = document.getElementById('pwa-ios-banner');
    if (!banner) return;
    banner.style.transition = '';
    banner.classList.remove('translate-y-0', 'opacity-100', 'pointer-events-auto');
    banner.classList.add('translate-y-32', 'opacity-0', 'pointer-events-none');
    if (forever) {
        localStorage.setItem('rizdviana_ios_pwa_dismissed', 'true');
    }
}

function initIosInstallPrompt() {
    const banner = document.getElementById('pwa-ios-banner');
    if (!banner) return;

    // Перевірка пристрою Apple (iPhone, iPad, iPod)
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || 
                  (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

    // Чи сайт уже запущено як встановлений додаток (Standalone)
    const isStandalone = window.navigator.standalone === true || 
                         window.matchMedia('(display-mode: standalone)').matches;

    // Чи користувач закривав підказку раніше
    const isDismissed = localStorage.getItem('rizdviana_ios_pwa_dismissed') === 'true';

    // Тестовий режим через URL (?pwa_test=1), щоб можна було протестувати банер у будь-якому браузері
    const urlParams = new URLSearchParams(window.location.search);
    const isTestMode = urlParams.has('pwa_test');

    if (isTestMode) {
        showIosBanner(true);
        return;
    }

    // Показуємо тільки для відвідувачів на iOS Safari, якщо додаток ще не встановлено
    if (isIOS && !isStandalone && !isDismissed) {
        setTimeout(showIosBanner, 3500);
    }
}

window.showIosInstallPrompt = showIosBanner;

// Ініціалізація після завантаження сторінки
function onPageInit() {
    initPhoneMask();
    initIosInstallPrompt();
    updatePillPosition('all');
    if (document.fonts && document.fonts.ready) {
        document.fonts.ready.then(() => updatePillPosition());
    }
}

window.addEventListener('resize', () => updatePillPosition(), { passive: true });

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', onPageInit);
} else {
    onPageInit();
}

loadCatalog();
