const INSTAGRAM_USERNAME = "rizdviana.art";
const TELEGRAM_USERNAME = "tatianata91";

const SUPABASE_URL = "https://jvckjrzcvfonucagpecu.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_Gp7u0i4jGzMUJuhiZ6_j_Q_HV3ndPXK";

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

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
    const skeletonCards = Array(6).fill(0).map(() => `
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
            Помилка завантаження каталогу: ${err.message}
        </div>`;
    }
}

function setStockFilter(mode) {
    currentStockFilter = mode;
    const btnAll = document.getElementById('filter-all');
    const btnStock = document.getElementById('filter-stock');

    if (mode === 'all') {
        btnAll.className = "filter-stock-btn px-3.5 py-1.5 rounded-full text-[11px] uppercase tracking-wider font-semibold transition bg-stoneDark text-white";
        btnStock.className = "filter-stock-btn px-3.5 py-1.5 rounded-full text-[11px] uppercase tracking-wider font-semibold transition bg-white text-stone-700 hover:bg-stone-100";
    } else {
        btnStock.className = "filter-stock-btn px-3.5 py-1.5 rounded-full text-[11px] uppercase tracking-wider font-semibold transition bg-stoneDark text-white";
        btnAll.className = "filter-stock-btn px-3.5 py-1.5 rounded-full text-[11px] uppercase tracking-wider font-semibold transition bg-white text-stone-700 hover:bg-stone-100";
    }
    applyFilters();
}

function applyFilters() {
    const type = document.getElementById('select-type').value;
    const ornament = document.getElementById('select-ornament').value;
    const shape = document.getElementById('select-shape').value;
    const width = document.getElementById('select-width').value;
    const color = document.getElementById('select-color').value;
    const sortBy = document.getElementById('select-sort')?.value || 'newest';

    let filtered = allProducts.filter(item => {
        if (currentStockFilter === 'in_stock' && item.status !== 'in_stock') return false;
        if (type && item.product_type !== type) return false;
        if (ornament && item.ornament !== ornament) return false;
        if (shape && item.shape !== shape) return false;
        if (width && item.width_size !== width) return false;
        if (color && (!item.colors || !item.colors.includes(color))) return false;
        return true;
    });

    filtered.sort((a, b) => {
        if (sortBy === 'price_asc') return (Number(a.price) || 0) - (Number(b.price) || 0);
        if (sortBy === 'price_desc') return (Number(b.price) || 0) - (Number(a.price) || 0);
        if (sortBy === 'title_asc') return (a.title || '').localeCompare(b.title || '', 'uk');
        if (sortBy === 'oldest') return new Date(a.created_at) - new Date(b.created_at);
        return new Date(b.created_at) - new Date(a.created_at);
    });

    renderProducts(filtered);
}

function renderProducts(items) {
    const grid = document.getElementById('products-grid');
    const countEl = document.getElementById('items-count');
    countEl.innerText = `Знайдено робіт: ${items.length}`;

    if (items.length === 0) {
        grid.innerHTML = '<div class="col-span-full py-16 text-center text-stone-400">Виробів за обраними критеріями не знайдено</div>';
        return;
    }

    grid.innerHTML = items.map(product => {
        const isInStock = product.status === 'in_stock';
        const sortedMedia = product.media ? [...product.media].sort((a, b) => a.display_order - b.display_order) : [];
        
        // Знаходимо перше фото для обкладинки (якщо першим у базі було відео, обкладинка не зламається)
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

        return `
            <div class="group bg-white rounded-2xl overflow-hidden border border-craft flex flex-col transition hover:shadow-lg">
                <div onclick="openModal('${product.id}')" class="relative aspect-square overflow-hidden bg-craft/30 cursor-pointer">
                    <img 
                        src="${coverMedia}" 
                        alt="${seoAlt}" 
                        title="${product.title} — RIZDVIANA.ART"
                        loading="lazy" 
                        decoding="async"
                        width="400"
                        height="400"
                        class="w-full h-full object-cover transition duration-500 group-hover:scale-105" 
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
                    <div onclick="openModal('${product.id}')" class="cursor-pointer">
                        <div class="flex items-baseline justify-between gap-2 mb-1">
                            <h3 class="font-serif font-bold text-lg text-stoneDark group-hover:text-stone-600 transition">${product.title}</h3>
                            <span class="font-semibold text-base whitespace-nowrap text-stoneDark">${product.price} ₴</span>
                        </div>
                        <p class="text-xs text-stone-500 line-clamp-2 mb-3">${product.description || ''}</p>
                        <div class="text-[11px] text-stone-400 space-y-1 border-t border-craft pt-3">
                            <div><strong class="text-stone-600">Розміри:</strong> ${product.dimensions || '—'}</div>
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
                        <button onclick="openModalWithOrder('${product.id}')" class="w-full text-center py-2 px-3 rounded-xl text-xs font-medium text-stone-600 hover:text-stoneDark hover:bg-craft/50 border border-craft transition flex items-center justify-center gap-1.5">
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
    // Шукаємо за ID або за красивим Slug
    const product = allProducts.find(p => p.id === productId || p.slug === productId);
    if (!product) return;

    // В адресному рядку показуємо slug (якщо є) або id
    const itemIdentifier = product.slug || product.id;
    const currentParam = new URLSearchParams(window.location.search).get('item');
    if (currentParam !== itemIdentifier) {
        window.history.pushState({ productId: product.id }, '', `?item=${itemIdentifier}`);
    }

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
        colorsBox.innerHTML = product.colors.map(c => `
            <span class="bg-craft px-2 py-0.5 rounded text-[10px] text-stone-700">${c}</span>
        `).join('');
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

    const nameInput = document.getElementById('order-cust-name');
    const phoneInput = document.getElementById('order-cust-phone');
    const commInput = document.getElementById('order-cust-comment');
    const alertBox = document.getElementById('order-form-alert');
    const submitBtn = document.getElementById('btn-submit-order');

    const name = nameInput.value.trim();
    const phone = phoneInput.value.trim();
    const comment = commInput.value.trim();

    if (!name) {
        alertBox.className = 'text-xs py-1.5 px-2.5 rounded bg-red-100 text-red-700 block';
        alertBox.innerText = "Будь ласка, вкажіть ваше ім'я.";
        return;
    }

    // Надійна валідація номера: український (12 цифр, 380...) або міжнародний (10-15 цифр)
    const digits = phone.replace(/\D/g, '');
    const isUaValid = digits.startsWith('380') && digits.length === 12;
    const isIntlValid = !digits.startsWith('380') && digits.length >= 10 && digits.length <= 15;

    if (!isUaValid && !isIntlValid) {
        alertBox.className = 'text-xs py-1.5 px-2.5 rounded bg-red-100 text-red-700 block';
        alertBox.innerText = "Введіть повний номер: +380 (XX) XXX-XX-XX";
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

    if (activeItem.media_type === 'video' || activeItem.url.endsWith('.mp4')) {
        mainContainer.innerHTML = `
            <video src="${activeItem.url}" controls autoplay loop muted playsinline class="w-full h-full object-contain"></video>
        `;
    } else {
        mainContainer.innerHTML = `
            <img 
                src="${activeItem.url}" 
                class="w-full h-full object-contain" 
                alt="${itemTitle} — ${itemType} ручної роботи RIZDVIANA.ART" 
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
                    : `<img src="${m.url}" class="w-full h-full object-cover" alt="Ракурс ${idx + 1}" loading="lazy" decoding="async" />`
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
    document.body.style.overflow = 'auto';
    const videoEl = document.querySelector('#modal-main-media video');
    if (videoEl) videoEl.pause();
    activeModalProduct = null;

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

    // Формуємо красиве посилання зі слагом (якщо є) або ID
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

    if (activeItem.media_type === 'video' || activeItem.url.endsWith('.mp4')) {
        container.innerHTML = `
            <video src="${activeItem.url}" controls autoplay playsinline class="zoom-video" onclick="event.stopPropagation()"></video>
        `;
    } else {
        container.innerHTML = `
            <img src="${activeItem.url}" id="activeZoomImg" class="zoom-img" alt="${itemTitle} — детальне макро-фото бісерного плетіння" draggable="false">
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
                    : `<img src="${m.url}" draggable="false" alt="Мініатюра деталізації ${idx + 1}" />`
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

    img.style.transition = 'transform 0.3s cubic-bezier(0.2, 0,
