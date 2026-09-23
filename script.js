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

// --- УНІВЕРСАЛЬНИЙ TOAST ДЛЯ СПОВІЩЕНЬ ---
let toastTimeout = null;
function showToast(message, icon = '✨') {
    const toast = document.getElementById('toast-notification');
    const toastMsg = document.getElementById('toast-message');
    const toastIcon = document.getElementById('toast-icon');
    if (!toast) return;

    if (toastIcon) toastIcon.innerText = icon;
    if (toastMsg) toastMsg.innerText = message;

    toast.classList.add('show');
    if (toastTimeout) clearTimeout(toastTimeout);
    toastTimeout = setTimeout(() => {
        toast.classList.remove('show');
    }, 2800);
}

// --- КРОСПЛАТФОРМЕНЕ КОПІЮВАННЯ (З ПІДТРИМКОЮ ЛОКАЛЬНИХ HTTP-МЕРЕЖ) ---
function copyToClipboard(text) {
    if (navigator.clipboard && window.isSecureContext) {
        return navigator.clipboard.writeText(text);
    }
    return new Promise((resolve, reject) => {
        const textArea = document.createElement('textarea');
        textArea.value = text;
        textArea.style.position = 'fixed';
        textArea.style.left = '-9999px';
        textArea.style.top = '0';
        textArea.setAttribute('readonly', '');
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        try {
            const successful = document.execCommand('copy');
            document.body.removeChild(textArea);
            if (successful) resolve();
            else reject(new Error('execCommand failed'));
        } catch (err) {
            document.body.removeChild(textArea);
            reject(err);
        }
    });
}

let allProducts = [];
let currentFilteredProducts = [];
const PRODUCTS_PER_PAGE = 12;
let currentVisibleCount = PRODUCTS_PER_PAGE;
let currentStockFilter = 'all';
let currentProductMedia = [];
let activeMediaIndex = 0;
let activeModalProduct = null;

// --- СИСТЕМА ОБРАНОГО (WISHLIST) ---
function getStoredFavorites() {
    try {
        const stored = localStorage.getItem('rizdviana_favorites');
        return stored ? JSON.parse(stored) : [];
    } catch {
        return [];
    }
}

function saveStoredFavorites(favs) {
    try {
        localStorage.setItem('rizdviana_favorites', JSON.stringify(Array.from(favs)));
    } catch (e) {
        console.warn('LocalStorage error:', e);
    }
}

const favoriteIds = new Set(getStoredFavorites());

function updateFavoritesBadges() {
    const count = favoriteIds.size;
    const deskBadge = document.getElementById('fav-count-badge-desktop');
    const mobBadge = document.getElementById('fav-count-badge-mobile');
    
    if (deskBadge) {
        deskBadge.innerText = count;
        deskBadge.classList.toggle('hidden', count === 0);
    }
    if (mobBadge) {
        mobBadge.innerText = count;
        mobBadge.className = count > 0 ? 'text-[9px] font-bold text-red-600' : 'text-[9px] font-bold text-stone-500';
    }
}

function toggleFavorite(productId, event) {
    if (event) {
        event.stopPropagation();
        const targetBtn = event.currentTarget;
        if (targetBtn) {
            targetBtn.classList.add('heart-animate');
            setTimeout(() => targetBtn.classList.remove('heart-animate'), 400);
        }
    }

    if (favoriteIds.has(productId)) {
        favoriteIds.delete(productId);
    } else {
        favoriteIds.add(productId);
    }
    saveStoredFavorites(favoriteIds);
    updateFavoritesBadges();

    if (currentStockFilter === 'favorites') {
        applyFilters();
    } else {
        const cardBtns = document.querySelectorAll(`button[data-fav-id="${productId}"]`);
        const isFav = favoriteIds.has(productId);
        cardBtns.forEach(btn => {
            const svg = btn.querySelector('svg');
            if (isFav) {
                btn.classList.add('active');
                btn.setAttribute('aria-label', 'Видалити з обраного');
                btn.setAttribute('title', 'В обраному');
                if (svg) {
                    svg.classList.add('text-red-500', 'fill-red-500');
                    svg.setAttribute('fill', 'currentColor');
                }
            } else {
                btn.classList.remove('active');
                btn.setAttribute('aria-label', 'Додати в обране');
                btn.setAttribute('title', 'Додати в обране');
                if (svg) {
                    svg.classList.remove('text-red-500', 'fill-red-500');
                    svg.setAttribute('fill', 'none');
                }
            }
        });
    }

    if (activeModalProduct && activeModalProduct.id === productId) {
        updateModalFavoriteState(productId);
    }
}

function updateModalFavoriteState(productId) {
    const btn = document.getElementById('modal-btn-favorite');
    const icon = document.getElementById('modal-fav-icon');
    const text = document.getElementById('modal-fav-text');
    if (!btn || !icon || !text) return;

    const isFav = favoriteIds.has(productId);
    if (isFav) {
        btn.classList.add('border-red-300', 'bg-red-50/50');
        icon.classList.remove('text-stone-400');
        icon.classList.add('text-red-500', 'fill-red-500');
        icon.setAttribute('fill', 'currentColor');
        text.innerText = 'В обраному';
    } else {
        btn.classList.remove('border-red-300', 'bg-red-50/50');
        icon.classList.add('text-stone-400');
        icon.classList.remove('text-red-500', 'fill-red-500');
        icon.setAttribute('fill', 'none');
        text.innerText = 'В обране';
    }
}

function toggleModalFavorite() {
    if (!activeModalProduct) return;
    toggleFavorite(activeModalProduct.id);
}

// --- НЕЩОДАВНО ПЕРЕГЛЯНУТІ ПРИКРАСИ (RECENTLY VIEWED) ---
function getRecentlyViewedIds() {
    try {
        const stored = localStorage.getItem('rizdviana_recent');
        return stored ? JSON.parse(stored) : [];
    } catch {
        return [];
    }
}

function saveRecentlyViewedId(id) {
    if (!id) return;
    try {
        let list = getRecentlyViewedIds().filter(itemId => itemId !== id);
        list.unshift(id);
        list = list.slice(0, 6);
        localStorage.setItem('rizdviana_recent', JSON.stringify(list));
        renderRecentlyViewed();
    } catch (e) {
        console.warn('Recently viewed error:', e);
    }
}

function clearRecentlyViewed() {
    try {
        localStorage.removeItem('rizdviana_recent');
    } catch (e) {}
    renderRecentlyViewed();
    showToast("Історію перегляду очищено", "🧹");
}

function renderRecentlyViewed() {
    const section = document.getElementById('recently-viewed-section');
    const grid = document.getElementById('recently-viewed-grid');
    if (!section || !grid || !allProducts || allProducts.length === 0) return;

    const ids = getRecentlyViewedIds();
    if (ids.length === 0) {
        section.classList.add('hidden');
        grid.innerHTML = '';
        return;
    }

    const recentProducts = ids
        .map(id => allProducts.find(p => p.id === id || p.slug === id))
        .filter(Boolean);

    if (recentProducts.length === 0) {
        section.classList.add('hidden');
        grid.innerHTML = '';
        return;
    }

    section.classList.remove('hidden');
    grid.innerHTML = recentProducts.map(p => {
        const coverUrl = (p.media && p.media.length > 0) ? p.media[0].url : '';
        const optCover = getOptimizedImageUrl(coverUrl, 300, 80);
        return `
            <div role="button" tabindex="0" onclick="openModal('${p.id}')" onkeydown="if(event.key==='Enter'||event.key===' ')openModal('${p.id}')" class="recent-card bg-white rounded-xl overflow-hidden border border-craft p-2 cursor-pointer flex flex-col justify-between group focus:outline-none">
                <div class="aspect-square bg-stone-100 rounded-lg overflow-hidden mb-2">
                    <img src="${escapeAttr(optCover)}" alt="${escapeAttr(p.title)}" loading="lazy" class="w-full h-full object-cover group-hover:scale-105 transition duration-300">
                </div>
                <div class="px-1 pb-0.5">
                    <h4 class="font-serif font-semibold text-xs text-stoneDark group-hover:text-stone-600 transition truncate">${escapeHtml(p.title)}</h4>
                    <span class="text-xs font-semibold text-stone-700 mt-0.5 block">${p.price} ₴</span>
                </div>
            </div>
        `;
    }).join('');
}

// --- ЖИВИЙ ПОШУК (LIVE SEARCH) ---
let searchQuery = '';

function syncSearchAndApply(val) {
    searchQuery = (val || '').trim();
    const deskInput = document.getElementById('search-input-desktop');
    const mobInput = document.getElementById('search-input-mobile');
    const deskClear = document.getElementById('search-clear-desktop');
    const mobClear = document.getElementById('search-clear-mobile');

    if (deskInput && deskInput.value !== val) deskInput.value = val;
    if (mobInput && mobInput.value !== val) mobInput.value = val;

    if (deskClear) deskClear.classList.toggle('hidden', !searchQuery);
    if (mobClear) mobClear.classList.toggle('hidden', !searchQuery);

    applyFilters();
}

function clearSearch() {
    syncSearchAndApply('');
}

// --- МІЖНАРОДНА БІБЛІОТЕКА ТЕЛЕФОНІВ (intl-tel-input) ---
let itiInstance = null;

function initPhoneInput() {
    const phoneInput = document.getElementById('order-cust-phone');
    if (!phoneInput || !window.intlTelInput || itiInstance) return;

    try {
        itiInstance = window.intlTelInput(phoneInput, {
            initialCountry: "ua",
            countryOrder: ["ua", "pl", "de", "us", "gb", "cz", "it", "es", "fr", "ca"],
            separateDialCode: true,
            autoPlaceholder: "aggressive",
            strictMode: true,
            i18n: {
                searchPlaceholder: "Пошук країни або коду..."
            },
            loadUtils: () => import("https://cdn.jsdelivr.net/npm/intl-tel-input@25.3.0/build/js/utils.js")
        });

        // Очищення дублювання коду при вставці або автозаповненні
        phoneInput.addEventListener('input', () => {
            if (!itiInstance) return;
            const countryData = itiInstance.getSelectedCountryData();
            if (!countryData || !countryData.dialCode) return;

            const dialCode = countryData.dialCode;
            let val = phoneInput.value;

            // Якщо номер починається з плюса (наприклад автозаповнення вставило повний номер +380...)
            if (val.trim().startsWith('+')) {
                itiInstance.setNumber(val.trim());
                return;
            }

            // Якщо користувач вводить з кодом країни або з 0 для України:
            if (val.startsWith(dialCode) && val.length > dialCode.length + 2) {
                phoneInput.value = val.slice(dialCode.length).trimStart();
            } else if (dialCode === '380' && val.startsWith('0') && val.length > 1) {
                phoneInput.value = val.slice(1).trimStart();
            }
        });

        phoneInput.addEventListener('paste', (e) => {
            const text = (e.clipboardData || window.clipboardData)?.getData('text') || '';
            if (text.trim().startsWith('+') && itiInstance) {
                e.preventDefault();
                itiInstance.setNumber(text.trim());
            }
        });
    } catch (err) {
        console.warn("Помилка ініціалізації intl-tel-input:", err);
    }
}

// --- СЕНСОРНІ СВАЙПИ У МОДАЛЬНОМУ ВІКНІ ---
let touchStartX = 0;
let touchStartY = 0;
let suppressModalZoom = false;

function setupModalSwipe() {
    const container = document.getElementById('modal-main-media');
    if (!container || container.dataset.swipeInitialized) return;
    container.dataset.swipeInitialized = 'true';

    container.addEventListener('touchstart', (e) => {
        if (e.touches.length === 1) {
            touchStartX = e.touches[0].clientX;
            touchStartY = e.touches[0].clientY;
        }
    }, { passive: true });

    container.addEventListener('touchend', (e) => {
        if (!currentProductMedia || currentProductMedia.length <= 1) return;
        if (e.changedTouches.length === 1) {
            const diffX = e.changedTouches[0].clientX - touchStartX;
            const diffY = e.changedTouches[0].clientY - touchStartY;
            if (Math.abs(diffX) > 35 && Math.abs(diffX) > Math.abs(diffY)) {
                suppressModalZoom = true;
                setTimeout(() => { suppressModalZoom = false; }, 300);

                if (diffX < 0) {
                    const nextIndex = (activeMediaIndex + 1) % currentProductMedia.length;
                    setActiveMedia(nextIndex);
                } else {
                    const prevIndex = (activeMediaIndex - 1 + currentProductMedia.length) % currentProductMedia.length;
                    setActiveMedia(prevIndex);
                }
            }
        }
    }, { passive: true });
}

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
    const skeletonCards = Array(PRODUCTS_PER_PAGE).fill(0).map(() => `
        <div class="bg-white rounded-2xl overflow-hidden border border-craft flex flex-col animate-pulse">
            <div class="aspect-square bg-craft/50"></div>
            <div class="p-2.5 sm:p-4 flex flex-col justify-between gap-2">
                <div class="space-y-1.5">
                    <div class="h-3.5 sm:h-4 bg-craft/70 rounded w-3/4"></div>
                    <div class="h-3 sm:h-3.5 bg-craft/40 rounded w-1/2"></div>
                </div>
                <div class="h-3.5 sm:h-4 bg-craft/60 rounded w-1/3 mt-2"></div>
            </div>
        </div>
    `).join('');
    
    grid.innerHTML = skeletonCards;
    const loadMoreBox = document.getElementById('load-more-container');
    if (loadMoreBox) loadMoreBox.classList.add('hidden');

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
        updateFavoritesBadges();
        applyFilters();
        renderRecentlyViewed();

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
    scrollToCatalogTop(true);
}

function updatePillPosition(mode = currentStockFilter) {
    // Мобільний ковзний тумблер
    const mobButtons = {
        all: document.getElementById('filter-all-mobile'),
        in_stock: document.getElementById('filter-stock-mobile'),
        favorites: document.getElementById('filter-favorites-mobile')
    };
    const mobPill = document.getElementById('stock-pill-mobile');
    const targetMob = mobButtons[mode];

    if (mobPill && targetMob) {
        Object.values(mobButtons).forEach(btn => btn?.classList.remove('active'));
        targetMob.classList.add('active');
        mobPill.style.width = `${targetMob.offsetWidth}px`;
        mobPill.style.transform = `translateX(${targetMob.offsetLeft}px)`;
    }

    // Десктопний ковзний тумблер
    const deskButtons = {
        all: document.getElementById('filter-all'),
        in_stock: document.getElementById('filter-stock'),
        favorites: document.getElementById('filter-favorites')
    };
    const deskPill = document.getElementById('stock-pill-desktop');
    const targetDesk = deskButtons[mode];

    if (deskPill && targetDesk) {
        Object.values(deskButtons).forEach(btn => btn?.classList.remove('active'));
        targetDesk.classList.add('active');
        deskPill.style.width = `${targetDesk.offsetWidth}px`;
        deskPill.style.transform = `translateX(${targetDesk.offsetLeft}px)`;
    }
}

// Плавне переміщення на початок каталогу після зміни фільтрів
function scrollToCatalogTop(smooth = true) {
    const catalogEl = document.getElementById('catalog');
    if (!catalogEl) return;

    const stickyHeader = document.getElementById('sticky-header');
    const headerHeight = stickyHeader ? stickyHeader.offsetHeight : 54;
    const catalogTop = catalogEl.getBoundingClientRect().top + window.pageYOffset;
    const targetScrollY = Math.max(0, Math.round(catalogTop - headerHeight - 10));

    if (Math.abs(window.pageYOffset - targetScrollY) > 30) {
        window.scrollTo({
            top: targetScrollY,
            behavior: smooth ? 'smooth' : 'auto'
        });
    }
}

function syncFilterAndApply(field, val) {
    const desktopEl = document.getElementById(`select-${field}`);
    const mobileEl = document.getElementById(`mobile-select-${field}`);
    if (desktopEl && desktopEl.value !== val) desktopEl.value = val;
    if (mobileEl && mobileEl.value !== val) mobileEl.value = val;
    applyFilters();
    scrollToCatalogTop(true);
}

function syncSortAndApply(val) {
    const desktopSort = document.getElementById('select-sort');
    const mobileSort = document.getElementById('select-sort-mobile');
    if (desktopSort && desktopSort.value !== val) desktopSort.value = val;
    if (mobileSort && mobileSort.value !== val) mobileSort.value = val;
    applyFilters();
    scrollToCatalogTop(true);
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
        scrollToCatalogTop(true);
    }, 300);
}

function applyFilters() {
    const budget = document.getElementById('select-budget')?.value || document.getElementById('mobile-select-budget')?.value || '';
    const type = document.getElementById('select-type')?.value || document.getElementById('mobile-select-type')?.value || '';
    const ornament = document.getElementById('select-ornament')?.value || document.getElementById('mobile-select-ornament')?.value || '';
    const shape = document.getElementById('select-shape')?.value || document.getElementById('mobile-select-shape')?.value || '';
    const width = document.getElementById('select-width')?.value || document.getElementById('mobile-select-width')?.value || '';
    const color = document.getElementById('select-color')?.value || document.getElementById('mobile-select-color')?.value || '';
    const sortBy = document.getElementById('select-sort')?.value || document.getElementById('select-sort-mobile')?.value || 'newest';

    const cleanBudget = budget ? budget.trim() : '';
    const cleanColor = color ? color.trim().toLowerCase() : '';
    const cleanType = type ? type.trim().toLowerCase() : '';
    const cleanOrnament = ornament ? ornament.trim().toLowerCase() : '';
    const cleanShape = shape ? shape.trim().toLowerCase() : '';
    const cleanWidth = width ? width.trim().toLowerCase() : '';

    let activeFilterCount = 0;
    if (cleanBudget) activeFilterCount++;
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
        } else {
            badge.classList.add('hidden');
            badge.classList.remove('inline-flex');
        }
    }

    const drawerCount = document.getElementById('mobile-drawer-count');
    if (drawerCount) {
        drawerCount.innerText = activeFilterCount > 0 ? `(${activeFilterCount} акт.)` : '';
    }

    const searchQuery = (document.getElementById('search-input-desktop')?.value || document.getElementById('search-input-mobile')?.value || '').trim();

    let filtered = allProducts.filter(item => {
        // Фільтр за наявністю / обраним
        if (currentStockFilter === 'in_stock' && item.status !== 'in_stock') return false;
        if (currentStockFilter === 'favorites' && !favoriteIds.has(item.id)) return false;

        // Фільтр за бюджетом
        const price = Number(item.price) || 0;
        if (cleanBudget === 'under1000' && price >= 1000) return false;
        if (cleanBudget === '1000-2000' && (price < 1000 || price > 2000)) return false;
        if (cleanBudget === 'above2000' && price <= 2000) return false;

        // Пошук за ключовими словами
        if (searchQuery) {
            const q = searchQuery.toLowerCase();
            const matchTitle = (item.title || '').toLowerCase().includes(q);
            const matchDesc = (item.description || '').toLowerCase().includes(q);
            const matchMaterials = (item.materials || '').toLowerCase().includes(q);
            const matchType = (item.product_type || '').toLowerCase().includes(q);
            const matchColors = Array.isArray(item.colors) && item.colors.some(c => String(c).toLowerCase().includes(q));
            if (!matchTitle && !matchDesc && !matchMaterials && !matchType && !matchColors) return false;
        }

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
        if (sortBy === 'newest') {
            const aStock = a.status === 'in_stock' ? 1 : 0;
            const bStock = b.status === 'in_stock' ? 1 : 0;
            if (aStock !== bStock) return bStock - aStock; // в наявності спочатку

            const aTop = a.is_top ? 1 : 0;
            const bTop = b.is_top ? 1 : 0;
            if (aTop !== bTop) return bTop - aTop; // Топ продажів першими

            return new Date(b.created_at) - new Date(a.created_at); // потім найновіші
        }
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

    currentFilteredProducts = filtered;
    currentVisibleCount = PRODUCTS_PER_PAGE;
    renderProducts(filtered);

    // Захист від втрати огляду/зсуву у футер: якщо користувач опинився нижче оновленого списку
    const catalogEl = document.getElementById('catalog');
    if (catalogEl && allProducts.length > 0) {
        const stickyHeader = document.getElementById('sticky-header');
        const headerHeight = stickyHeader ? stickyHeader.offsetHeight : 54;
        const targetScrollY = Math.max(0, Math.round(catalogEl.getBoundingClientRect().top + window.pageYOffset - headerHeight - 10));
        const catalogBottom = catalogEl.offsetTop + catalogEl.offsetHeight;

        if (window.pageYOffset > catalogBottom - 150) {
            window.scrollTo({
                top: targetScrollY,
                behavior: 'smooth'
            });
        }
    }
}

function resetFilters() {
    ['budget', 'type', 'ornament', 'shape', 'width', 'color'].forEach(field => {
        const d = document.getElementById(`select-${field}`);
        const m = document.getElementById(`mobile-select-${field}`);
        if (d) d.value = '';
        if (m) m.value = '';
    });
    const dSort = document.getElementById('select-sort');
    const mSort = document.getElementById('select-sort-mobile');
    if (dSort) dSort.value = 'newest';
    if (mSort) mSort.value = 'newest';
    clearSearch();
    currentVisibleCount = PRODUCTS_PER_PAGE;
    setStockFilter('all');
    scrollToCatalogTop(true);
}

function buildProductCardHtml(product, index) {
    const isInStock = product.status === 'in_stock';
    const isFav = favoriteIds.has(product.id);
    const sortedMedia = product.media ? [...product.media].sort((a, b) => a.display_order - b.display_order) : [];
    
    // Знаходимо перше фото для обкладинки
    const firstImage = sortedMedia.find(m => m.media_type === 'image' && !m.url.endsWith('.mp4'));
    const coverMedia = firstImage 
        ? firstImage.url 
        : (sortedMedia[0]?.url || 'https://images.unsplash.com/photo-1535632066927-ab7c9ab60908?auto=format&fit=crop&w=800&q=80');

    const itemType = product.product_type ? product.product_type.toLowerCase() : 'прикраса';
    const seoAlt = `${product.title} — авторська ${itemType} з бісеру ручної роботи, бренд RIZDVIANA.ART`;

    const safeId = escapeAttr(product.id);
    const safeTitle = escapeHtml(product.title);
    const safePrice = escapeHtml(product.price);
    const safeAlt = escapeAttr(seoAlt);
    const safeTitleAttr = escapeAttr(`${product.title} — RIZDVIANA.ART`);

    // Оптимізація розміру обкладинки для вітрини (швидкий рендер)
    const optimizedCover = getOptimizedImageUrl(coverMedia, 500, 85);
    const safeCoverMedia = escapeAttr(optimizedCover);

    // LCP оптимізація (modern-web-guidance): перші 2 картки — кандидати LCP (fetchpriority="high"), наступні — eager
    const isLcp = index < 2;
    const isAboveFold = index < 4;
    const loadingAttr = isAboveFold ? 'loading="eager"' : 'loading="lazy"';
    const priorityAttr = isLcp ? 'fetchpriority="high"' : '';

    return `
        <div class="product-card group bg-white rounded-2xl overflow-hidden border border-craft flex flex-col justify-between transition hover:shadow-md h-full w-full">
            <div role="button" tabindex="0" onclick="openModal('${safeId}')" onkeydown="if(event.key==='Enter'||event.key===' ')openModal('${safeId}')" class="relative aspect-square overflow-hidden bg-stone-100 flex items-center justify-center cursor-pointer focus:outline-none">
                <img 
                    src="${safeCoverMedia}" 
                    alt="${safeAlt}" 
                    title="${safeTitleAttr}"
                    ${loadingAttr}
                    ${priorityAttr}
                    decoding="async"
                    width="450"
                    height="450"
                    class="w-full h-full object-cover object-center transition duration-500 group-hover:scale-105" 
                />
                
                <div class="absolute top-2 left-2 sm:top-3 sm:left-3 flex flex-wrap items-center gap-1 sm:gap-1.5 z-10 pointer-events-none pr-9">
                    ${product.is_top ? `
                        <span class="inline-flex items-center gap-0.5 sm:gap-1 text-[9px] sm:text-xs font-bold tracking-wider px-1.5 py-0.5 sm:px-2.5 sm:py-1 rounded-full bg-gradient-to-r from-amber-600 to-rose-600 text-white shadow-xs backdrop-blur border border-amber-300/40">
                            <span class="text-[10px] sm:text-xs leading-none">🔥</span>
                            <span>Топ<span class="hidden sm:inline"> продажів</span></span>
                        </span>
                    ` : ''}
                    <span class="text-[9px] sm:text-xs font-semibold uppercase tracking-wider px-1.5 py-0.5 sm:px-2.5 sm:py-1 rounded-full ${
                        isInStock 
                            ? 'bg-emerald-900/85 backdrop-blur text-emerald-100 shadow-xs' 
                            : 'bg-stone-800/85 backdrop-blur text-stone-300 shadow-xs'
                    }">
                        ${isInStock ? 'В наявності' : 'Під замовлення'}
                    </span>
                </div>

                <button 
                    type="button" 
                    data-fav-id="${safeId}"
                    onclick="toggleFavorite('${safeId}', event)" 
                    class="btn-favorite absolute top-2 right-2 sm:top-3 sm:right-3 z-10 w-7 h-7 sm:w-9 sm:h-9 rounded-full bg-white/85 hover:bg-white backdrop-blur flex items-center justify-center shadow-xs hover:shadow-sm transition ${isFav ? 'active' : ''}" 
                    aria-label="${isFav ? 'Видалити з обраного' : 'Додати в обране'}"
                    title="${isFav ? 'В обраному' : 'Додати в обране'}"
                >
                    <svg class="w-3.5 h-3.5 sm:w-4.5 sm:h-4.5 transition ${isFav ? 'text-red-500 fill-red-500' : 'text-stone-400'}" fill="${isFav ? 'currentColor' : 'none'}" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"/>
                    </svg>
                </button>

                ${sortedMedia.length > 1 ? `
                    <div class="absolute bottom-2 right-2 sm:bottom-3 sm:right-3 bg-stone-900/75 backdrop-blur px-1.5 py-0.5 sm:px-2 rounded-full text-[9px] sm:text-xs text-white">
                        +${sortedMedia.length - 1}
                    </div>
                ` : ''}
            </div>

            <div role="button" tabindex="0" onclick="openModal('${safeId}')" onkeydown="if(event.key==='Enter'||event.key===' ')openModal('${safeId}')" class="p-2.5 sm:p-4 md:p-4.5 flex flex-col flex-grow justify-between cursor-pointer focus:outline-none">
                <div>
                    <h3 class="font-serif font-semibold text-xs sm:text-base md:text-lg text-stoneDark group-hover:text-stone-600 transition line-clamp-2 leading-snug mb-1">
                        ${safeTitle}
                    </h3>
                </div>
                <div class="mt-1 sm:mt-2 flex items-baseline justify-between pt-1 border-t border-craft/50">
                    <span class="font-bold text-xs sm:text-base text-stoneDark whitespace-nowrap">${safePrice} ₴</span>
                    <span class="text-[10px] sm:text-xs text-stone-400 group-hover:text-stone-600 transition hidden xs:inline">Детальніше →</span>
                </div>
            </div>
        </div>
    `;
}

function updateLoadMoreUI(totalCount) {
    const container = document.getElementById('load-more-container');
    const currentEl = document.getElementById('load-more-current');
    const totalEl = document.getElementById('load-more-total');
    const progressEl = document.getElementById('load-more-progress');
    const batchCountEl = document.getElementById('load-more-batch-count');
    if (!container) return;

    if (totalCount <= currentVisibleCount) {
        container.classList.add('hidden');
        return;
    }

    container.classList.remove('hidden');
    const visibleNow = Math.min(currentVisibleCount, totalCount);
    if (currentEl) currentEl.innerText = visibleNow;
    if (totalEl) totalEl.innerText = totalCount;

    const remaining = totalCount - visibleNow;
    const nextBatch = Math.min(PRODUCTS_PER_PAGE, remaining);
    if (batchCountEl) batchCountEl.innerText = `(+${nextBatch})`;

    if (progressEl) {
        const pct = Math.min(100, Math.round((visibleNow / totalCount) * 100));
        progressEl.style.width = `${pct}%`;
    }
}

function loadMoreProducts() {
    const grid = document.getElementById('products-grid');
    if (!grid || !currentFilteredProducts || currentFilteredProducts.length === 0) return;

    const prevCount = currentVisibleCount;
    currentVisibleCount += PRODUCTS_PER_PAGE;

    const nextBatch = currentFilteredProducts.slice(prevCount, currentVisibleCount);
    if (nextBatch.length > 0) {
        const nextBatchHtml = nextBatch.map((product, idx) => buildProductCardHtml(product, prevCount + idx)).join('');
        grid.insertAdjacentHTML('beforeend', nextBatchHtml);
    }

    updateLoadMoreUI(currentFilteredProducts.length);
}

function renderProducts(items) {
    const grid = document.getElementById('products-grid');
    const countEl = document.getElementById('items-count');
    const loadMoreContainer = document.getElementById('load-more-container');
    if (countEl) countEl.innerText = `Знайдено робіт: ${items.length}`;

    if (items.length === 0) {
        if (loadMoreContainer) loadMoreContainer.classList.add('hidden');

        if (currentStockFilter === 'favorites') {
            grid.innerHTML = `
                <div class="col-span-full py-16 text-center">
                    <div class="text-4xl mb-3">❤️</div>
                    <h3 class="font-serif font-bold text-lg text-stoneDark mb-2">У вас поки немає збережених прикрас</h3>
                    <p class="text-stone-500 text-xs mb-4 max-w-md mx-auto">Натисніть сердечко на будь-якій прикрасі, щоб зберегти її тут для швидкого перегляду.</p>
                    <button onclick="setStockFilter('all')" class="inline-flex items-center gap-1.5 px-4 py-2 bg-stoneDark text-white text-xs font-semibold rounded-xl hover:bg-stone-800 transition shadow-sm">
                        Переглянути каталог
                    </button>
                </div>
            `;
            return;
        }

        if (searchQuery) {
            grid.innerHTML = `
                <div class="col-span-full py-16 text-center">
                    <p class="text-stone-500 text-sm mb-3">За запитом «<strong>${escapeHtml(searchQuery)}</strong>» виробів не знайдено</p>
                    <button onclick="clearSearch()" class="inline-flex items-center gap-1.5 px-4 py-2 bg-stoneDark text-white text-xs font-semibold rounded-xl hover:bg-stone-800 transition shadow-sm">
                        ✕ Очистити пошук
                    </button>
                </div>
            `;
            return;
        }

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

    const initialBatch = items.slice(0, currentVisibleCount);
    grid.innerHTML = initialBatch.map((product, index) => buildProductCardHtml(product, index)).join('');
    updateLoadMoreUI(items.length);
}

// --- СИСТЕМА РЕКОМЕНДАЦІЙ («ІНШІ КОЛЬОРИ ТА СХОЖІ РОБОТИ») ---
function getCleanProductTitle(title) {
    return (title || '')
        .replace(/^(силянка|чокер|гердан|кутовий гердан|браслет)\s*/i, '')
        .replace(/["«»']/g, '')
        .trim();
}

function getProductBaseRoot(title) {
    const clean = getCleanProductTitle(title);
    return clean.split(/[:(]/)[0].trim();
}

function findProductRecommendations(target, all) {
    if (!target || !all || all.length <= 1) return [];

    const targetClean = getCleanProductTitle(target.title).toLowerCase();
    const targetRoot = getProductBaseRoot(target.title).toLowerCase();
    const rootWords = targetRoot.split(/\s+/).filter(w => w.length > 2);

    const scored = all
        .filter(p => p.id !== target.id && p.status !== 'archived')
        .map(p => {
            let score = 0;
            let hasSeriesMatch = false;
            const otherClean = getCleanProductTitle(p.title).toLowerCase();
            const otherRoot = getProductBaseRoot(p.title).toLowerCase();
            const otherWords = otherRoot.split(/\s+/).filter(w => w.length > 2);

            // 1. Точний збіг кореня назви / серії (напр. «Сердечний оберіг», «Геометрія сердець», «Троянди по білому»)
            if (targetRoot === otherRoot && targetRoot.length >= 4) {
                score += 120;
                hasSeriesMatch = true;
            } else if (targetClean.startsWith(otherClean) || otherClean.startsWith(targetClean)) {
                // Префіксний збіг (напр. «Дивоквіти» та «Дивоквіти рубінові», «Діамантовий» та «Діамантовий прозорий»)
                score += 110;
                hasSeriesMatch = true;
            } else if (rootWords.length >= 2 && otherWords.length >= 2 && rootWords[0] === otherWords[0] && rootWords[1] === otherWords[1]) {
                // Збіг перших двох слів (напр. «Класичні ромби блакитна» та «Класичні ромби малахітова»)
                score += 100;
                hasSeriesMatch = true;
            } else if (rootWords.length >= 1 && otherWords.length >= 1 && rootWords[0].length >= 5 && rootWords[0] === otherWords[0]) {
                // Збіг ключового першого слова від 5 літер (напр. «Баранці сріблясті» та «Баранці полум'яні», «Городенківська вишивка» та «Городенківська широка»)
                score += 90;
                hasSeriesMatch = true;
            }

            // 2. Вторинні параметри схожості (тип прикраси, орнамент, форма)
            if (target.product_type && target.product_type === p.product_type) score += 10;
            if (target.ornament && target.ornament === p.ornament) score += 8;
            if (target.shape && target.shape === p.shape) score += 6;
            if (p.status === 'in_stock') score += 2;

            return { product: p, score, hasSeriesMatch };
        })
        .sort((a, b) => b.score - a.score);

    return scored.slice(0, 3);
}

function renderModalRecommendations(product) {
    const section = document.getElementById('modal-related-section');
    const list = document.getElementById('modal-related-list');
    const titleText = document.getElementById('modal-related-title-text');
    const titleIcon = document.getElementById('modal-related-icon');
    if (!section || !list) return;

    const recs = findProductRecommendations(product, allProducts);
    if (!recs || recs.length === 0) {
        section.classList.add('hidden');
        list.innerHTML = '';
        return;
    }

    const hasSeriesMatch = recs.some(r => r.hasSeriesMatch);
    if (titleText) {
        titleText.innerText = hasSeriesMatch 
            ? 'Інші кольори цієї серії' 
            : 'Схожі авторські роботи';
    }
    if (titleIcon) {
        titleIcon.innerText = hasSeriesMatch ? '🎨' : '✨';
    }

    list.innerHTML = recs.map(({ product: p }) => {
        const isInStock = p.status === 'in_stock';
        const sortedMedia = p.media ? [...p.media].sort((a, b) => a.display_order - b.display_order) : [];
        const firstImage = sortedMedia.find(m => m.media_type === 'image' && !m.url.endsWith('.mp4'));
        const thumbUrl = firstImage ? firstImage.url : (sortedMedia[0]?.url || 'https://images.unsplash.com/photo-1535632066927-ab7c9ab60908?auto=format&fit=crop&w=800&q=80');
        const optimizedThumb = getOptimizedImageUrl(thumbUrl, 240, 80);

        const cleanTitle = p.title;

        return `
            <div onclick="openModal('${escapeAttr(p.id)}')" 
                 class="group cursor-pointer flex flex-col p-1.5 sm:p-2 rounded-xl border border-craft/80 bg-white/70 hover:bg-white hover:border-stone-400 hover:shadow-sm transition active:scale-95 text-left"
                 title="${escapeAttr(p.title)}">
                <div class="aspect-square bg-craft/30 rounded-lg overflow-hidden relative mb-1.5 border border-craft/50">
                    <img src="${escapeAttr(optimizedThumb)}" 
                         alt="${escapeAttr(p.title)}" 
                         class="w-full h-full object-cover group-hover:scale-105 transition duration-300" 
                         loading="lazy" />
                    ${p.is_top ? `
                        <span class="absolute top-1 left-1 px-1.5 py-0.5 rounded text-[8px] sm:text-[9px] font-bold leading-none bg-gradient-to-r from-amber-600 to-rose-600 text-white shadow-xs">
                            🔥 Топ
                        </span>
                    ` : ''}
                    <span class="absolute bottom-1 left-1 px-1.5 py-0.5 rounded text-[8px] sm:text-[9px] font-semibold leading-none ${isInStock ? 'bg-emerald-900/85 text-emerald-100' : 'bg-stone-900/75 text-stone-200'}">
                        ${isInStock ? 'В наявності' : 'На замовлення'}
                    </span>
                </div>
                <div class="text-[10px] sm:text-[11px] font-medium text-stoneDark line-clamp-2 leading-tight group-hover:text-stone-600 transition mb-1 flex-1">
                    ${escapeHtml(cleanTitle)}
                </div>
                <div class="text-[10px] sm:text-[11px] font-bold text-stone-800">
                    ${p.price} ₴
                </div>
            </div>
        `;
    }).join('');

    section.classList.remove('hidden');
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

    const topBadge = document.getElementById('modal-top-badge');
    if (topBadge) {
        if (product.is_top) {
            topBadge.classList.remove('hidden');
            topBadge.classList.add('inline-flex');
        } else {
            topBadge.classList.add('hidden');
            topBadge.classList.remove('inline-flex');
        }
    }

    const statusBadge = document.getElementById('modal-status-badge');
    if (isInStock) {
        statusBadge.className = 'text-[11px] sm:text-xs font-semibold uppercase tracking-wider px-3 py-1 rounded-full bg-emerald-900/85 text-emerald-100 shadow-xs';
        statusBadge.innerText = 'В наявності';
    } else {
        statusBadge.className = 'text-[11px] sm:text-xs font-semibold uppercase tracking-wider px-3 py-1 rounded-full bg-stone-800/85 text-stone-300 shadow-xs';
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
    updateModalFavoriteState(product.id);
    renderModalCardMedia();
    setupModalSwipe();
    saveRecentlyViewedId(product.id);
    renderModalRecommendations(product);

    // Скидаємо скрол модального вікна на самий верх при відкритті або перемиканні прикрас
    const modal = document.getElementById('product-modal');
    if (modal) modal.scrollTop = 0;
    const detailsCol = document.getElementById('modal-details-col');
    if (detailsCol) detailsCol.scrollTop = 0;

    const showModal = () => {
        document.getElementById('product-modal').classList.remove('hidden');
        document.body.style.overflow = 'hidden';
    };

    if (document.startViewTransition && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        document.startViewTransition(showModal);
    } else {
        showModal();
    }
}

function openModalWithOrder(productId) {
    openModal(productId);
    showQuickOrderForm();
}

function showQuickOrderForm() {
    document.getElementById('modal-action-buttons').classList.add('hidden');
    document.getElementById('modal-quick-order').classList.remove('hidden');
    
    // Скидаємо екран успіху назад на форму вводу
    const formFields = document.getElementById('order-form-fields');
    const successView = document.getElementById('order-success-view');
    if (formFields) formFields.classList.remove('hidden');
    if (successView) successView.classList.add('hidden');

    const submitBtn = document.getElementById('btn-submit-order');
    if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerText = "Підтвердити замовлення";
        submitBtn.classList.remove('hidden');
    }

    initPhoneInput();
    const alertBox = document.getElementById('order-form-alert');
    if (alertBox) {
        alertBox.className = 'hidden text-xs py-1.5 px-2 rounded';
        alertBox.innerText = '';
    }
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
        const formFields = document.getElementById('order-form-fields');
        const successView = document.getElementById('order-success-view');
        if (formFields && successView) {
            formFields.classList.add('hidden');
            successView.classList.remove('hidden');
        }
        nameInput.value = '';
        if (itiInstance) itiInstance.setNumber(''); else phoneInput.value = '';
        commInput.value = '';
        return;
    }

    const name = nameInput.value.trim();
    const comment = commInput.value.trim();

    if (!name) {
        alertBox.className = 'text-xs py-1.5 px-2.5 rounded bg-red-100 text-red-700 block';
        alertBox.innerText = "Будь ласка, вкажіть ваше ім'я.";
        return;
    }

    const rawVal = phoneInput.value.trim();
    if (!rawVal) {
        alertBox.className = 'text-xs py-1.5 px-2.5 rounded bg-red-100 text-red-700 block';
        alertBox.innerText = "Будь ласка, введіть номер телефону.";
        return;
    }

    let fullPhone = '';
    if (itiInstance) {
        // Перевіряємо валідність номера для обраної країни
        if (typeof itiInstance.isValidNumber === 'function' && itiInstance.isValidNumber() === false) {
            alertBox.className = 'text-xs py-1.5 px-2.5 rounded bg-red-100 text-red-700 block';
            alertBox.innerText = "Вкажіть коректний номер телефону для обраної країни.";
            return;
        }
        fullPhone = itiInstance.getNumber() || rawVal;
    } else {
        if (rawVal.replace(/\D/g, '').length < 7) {
            alertBox.className = 'text-xs py-1.5 px-2.5 rounded bg-red-100 text-red-700 block';
            alertBox.innerText = "Вкажіть коректний номер телефону.";
            return;
        }
        fullPhone = rawVal;
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
                customer_phone: fullPhone,
                customer_comment: comment || null
            });

        if (error) throw error;

        // Показуємо повноцінний преміальний екран успіху
        const formFields = document.getElementById('order-form-fields');
        const successView = document.getElementById('order-success-view');
        const successMsg = document.getElementById('order-success-msg');
        const successPhone = document.getElementById('order-success-phone');

        if (formFields && successView) {
            formFields.classList.add('hidden');
            successView.classList.remove('hidden');
            if (successMsg) {
                successMsg.innerHTML = `Дякуємо, <b>${escapeHtml(name)}</b>! Ваше замовлення на «<b>${escapeHtml(activeModalProduct.title)}</b>» успішно прийнято.`;
            }
            if (successPhone) {
                successPhone.innerHTML = `Майстриня Тетяна зв'яжеться з вами за номером <b>${escapeHtml(fullPhone)}</b> (дзвінок / Viber / Telegram) для узгодження деталей.`;
            }
        }
        
        nameInput.value = '';
        if (itiInstance) itiInstance.setNumber(''); else phoneInput.value = '';
        commInput.value = '';

        showToast("Замовлення успішно прийнято! 🎉", "✅");

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
            <button onclick="event.stopPropagation(); setActiveMedia(${idx})" class="w-12 h-12 rounded-xl overflow-hidden border-2 flex-shrink-0 relative transition ${
                idx === activeMediaIndex ? 'border-stoneDark shadow-sm opacity-100' : 'border-craft/80 opacity-60 hover:opacity-100'
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
    const videoEl = document.querySelector('#modal-main-media video');
    if (videoEl) videoEl.pause();
    activeModalProduct = null;

    // Відновлюємо оригінальний заголовок вкладки
    document.title = DEFAULT_PAGE_TITLE;

    if (new URLSearchParams(window.location.search).has('item')) {
        window.history.pushState({}, '', window.location.pathname);
    }

    const hideModal = () => {
        document.getElementById('product-modal').classList.add('hidden');
        document.body.style.overflow = '';
    };

    if (document.startViewTransition && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        document.startViewTransition(hideModal);
    } else {
        hideModal();
    }
}

function handleBackdropClick(e) {
    if (e.target.id === 'product-modal') closeModal();
}

let currentShareUrl = '';

// --- ФУНКЦІЯ «ПОДІЛИТИСЯ ПРИКРАСОЮ» ---
function shareCurrentProduct() {
    if (!activeModalProduct) return;

    const itemIdentifier = activeModalProduct.slug || activeModalProduct.id;
    const shareUrl = `${window.location.origin}${window.location.pathname}?item=${itemIdentifier}`;
    const shareTitle = `${activeModalProduct.title} — RIZDVIANA.ART`;
    const shareText = `Авторська прикраса з бісеру «${activeModalProduct.title}» від RIZDVIANA.ART`;

    const isMobileDevice = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

    // Якщо браузер підтримує нативний Web Share API (наприклад, на мобільному з HTTPS)
    if (isMobileDevice && typeof navigator.share === 'function' && window.isSecureContext) {
        navigator.share({
            title: shareTitle,
            text: shareText,
            url: shareUrl
        }).catch((err) => {
            if (err.name !== 'AbortError') {
                openShareDialog(shareUrl, shareTitle, shareText);
            }
        });
    } else {
        // Якщо Web Share недоступний (наприклад, локальне HTTP-тестування або ПК)
        openShareDialog(shareUrl, shareTitle, shareText);
    }
}

function openShareDialog(url, title, text) {
    const dialog = document.getElementById('share-dialog');
    const tgLink = document.getElementById('share-link-tg');
    const viberLink = document.getElementById('share-link-viber');
    const waLink = document.getElementById('share-link-wa');
    const copyText = document.getElementById('share-dialog-copy-text');

    currentShareUrl = url;

    const fullMessage = `${text} — ${url}`;
    const encUrl = encodeURIComponent(url);
    const encText = encodeURIComponent(fullMessage);

    if (tgLink) tgLink.href = `https://t.me/share/url?url=${encUrl}&text=${encodeURIComponent(title)}`;
    if (viberLink) viberLink.href = `viber://forward?text=${encText}`;
    if (waLink) waLink.href = `https://api.whatsapp.com/send?text=${encText}`;

    if (copyText) copyText.innerText = "📋 Скопіювати посилання";

    if (dialog) {
        dialog.classList.remove('hidden');
        dialog.classList.add('flex');
    }
}

function closeShareDialog() {
    const dialog = document.getElementById('share-dialog');
    if (dialog) {
        dialog.classList.add('hidden');
        dialog.classList.remove('flex');
    }
}

function copyShareUrlDirectly() {
    if (!currentShareUrl) return;
    copyToClipboard(currentShareUrl).then(() => {
        const copyText = document.getElementById('share-dialog-copy-text');
        if (copyText) {
            copyText.innerText = "✅ Скопійовано!";
            setTimeout(() => {
                copyText.innerText = "📋 Скопіювати посилання";
                closeShareDialog();
            }, 1000);
        }
        showToast("Посилання на прикрасу скопійовано!", "📋");
    }).catch(() => {
        prompt("Скопіюйте посилання на виріб:", currentShareUrl);
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
let lightboxSwipeStartX = 0;
let lightboxSwipeStartY = 0;
let isLightboxSwiping = false;
let suppressLightboxClick = false;

function setupLightboxSwipe() {
    const container = document.getElementById('zoom-container');
    if (!container || container.dataset.swipeInitialized) return;
    container.dataset.swipeInitialized = 'true';

    container.addEventListener('touchstart', (e) => {
        if (isZoomed) return;
        if (e.touches.length === 1) {
            lightboxSwipeStartX = e.touches[0].clientX;
            lightboxSwipeStartY = e.touches[0].clientY;
            isLightboxSwiping = true;
        }
    }, { passive: true });

    container.addEventListener('touchmove', (e) => {
        if (!isLightboxSwiping || isZoomed || e.touches.length !== 1) return;
        const currentX = e.touches[0].clientX;
        const currentY = e.touches[0].clientY;
        const diffX = currentX - lightboxSwipeStartX;
        const diffY = currentY - lightboxSwipeStartY;

        // Легке зміщення фото пальцем для відчуття відгуку інтерфейсу
        if (Math.abs(diffX) > Math.abs(diffY) && Math.abs(diffX) > 8) {
            const activeImg = document.getElementById('activeZoomImg');
            if (activeImg) {
                activeImg.style.transition = 'none';
                activeImg.style.transform = `translateX(${diffX * 0.4}px)`;
            }
        }
    }, { passive: true });

    container.addEventListener('touchend', (e) => {
        if (!isLightboxSwiping || isZoomed) return;
        isLightboxSwiping = false;

        const activeImg = document.getElementById('activeZoomImg');
        if (activeImg) {
            activeImg.style.transition = 'transform 0.25s cubic-bezier(0.2, 0, 0.2, 1)';
            activeImg.style.transform = 'translate(0px, 0px) scale(1)';
        }

        if (e.changedTouches.length === 1) {
            const diffX = e.changedTouches[0].clientX - lightboxSwipeStartX;
            const diffY = e.changedTouches[0].clientY - lightboxSwipeStartY;
            const total = currentProductMedia ? currentProductMedia.length : 0;

            if (Math.abs(diffX) > 35 && Math.abs(diffX) > Math.abs(diffY)) {
                suppressLightboxClick = true;
                setTimeout(() => { suppressLightboxClick = false; }, 300);

                if (total > 1) {
                    if (diffX < 0) {
                        nextZoomMedia();
                    } else {
                        prevZoomMedia();
                    }
                }
            }
        }
    }, { passive: true });
}

function openZoom(index = 0) {
    if (suppressModalZoom) return;
    activeMediaIndex = index;
    renderZoomGallery();
    setupLightboxSwipe();

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
        if (hasDragged || wasJustDragging || suppressLightboxClick) return;

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
    if (wasJustDragging || hasDragged || suppressLightboxClick) return;
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

// --- МІЖНАРОДНА БІБЛІОТЕКА ТЕЛЕФОНІВ (intl-tel-input) ІНІЦІАЛІЗАЦІЯ ---
function initPhoneMask() {
    initPhoneInput();
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
