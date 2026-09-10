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

        // Автоматичне відкриття прикраси за прямим посиланням у URL (?item=ID)
        const urlParams = new URLSearchParams(window.location.search);
        const sharedItemId = urlParams.get('item');
        if (sharedItemId && allProducts.some(p => p.id === sharedItemId)) {
            openModal(sharedItemId);
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
        const coverMedia = sortedMedia.length > 0
            ? sortedMedia[0].url
            : 'https://images.unsplash.com/photo-1535632066927-ab7c9ab60908?auto=format&fit=crop&w=800&q=80';

        const messageText = isInStock 
            ? `Вітаю! Хочу придбати виріб "${product.title}" (${product.price} грн, в наявності).`
            : `Вітаю! Мене зацікавив виріб "${product.title}" під замовлення. Хочу дізнатися деталі виготовлення.`;

        const directUrl = `https://ig.me/m/${INSTAGRAM_USERNAME}?text=${encodeURIComponent(messageText)}`;
        const telegramUrl = `https://t.me/${TELEGRAM_USERNAME}?text=${encodeURIComponent(messageText)}`;

        const itemType = product.product_type ? product.product_type.
