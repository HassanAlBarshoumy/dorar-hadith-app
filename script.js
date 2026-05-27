document.addEventListener('DOMContentLoaded', () => {
    // --- Elements ---
    const searchForm = document.getElementById('search-form');
    const searchInput = document.getElementById('search-input');
    const resultsContainer = document.getElementById('results-container');
    const loadingIndicator = document.getElementById('loading-indicator');
    const resultsSection = document.getElementById('results-section');
    
    const searchHistoryContainer = document.getElementById('search-history');
    
    const viewSearch = document.getElementById('view-search');
    const viewFavorites = document.getElementById('view-favorites');
    const favoritesContainer = document.getElementById('favorites-container');
    
    const btnHome = document.getElementById('btn-home');
    const btnFavorites = document.getElementById('btn-favorites');
    const btnSettings = document.getElementById('btn-settings');
    const settingsModal = document.getElementById('settings-modal');
    const btnCloseSettings = document.getElementById('btn-close-settings');
    
    const themeSelect = document.getElementById('theme-select');
    const fontsizeSelect = document.getElementById('fontsize-select');
    
    const filterBtns = document.querySelectorAll('.filter-btn');

    // --- State ---
    let currentResults = []; // Store original fetched HTML strings
    let favorites = JSON.parse(localStorage.getItem('dorar_favorites')) || [];
    let searchHistory = JSON.parse(localStorage.getItem('dorar_history')) || [];
    let currentFilter = 'all';

    // --- Init Settings ---
    const savedTheme = localStorage.getItem('dorar_theme') || 'auto';
    const savedFontSize = localStorage.getItem('dorar_fontsize') || 'md';
    applyTheme(savedTheme);
    applyFontSize(savedFontSize);
    themeSelect.value = savedTheme;
    fontsizeSelect.value = savedFontSize;

    function applyTheme(theme) {
        document.body.classList.remove('theme-auto', 'theme-light', 'theme-dark');
        document.body.classList.add(`theme-${theme}`);
        localStorage.setItem('dorar_theme', theme);
    }

    function applyFontSize(size) {
        document.body.classList.remove('font-size-sm', 'font-size-md', 'font-size-lg', 'font-size-xl');
        document.body.classList.add(`font-size-${size}`);
        localStorage.setItem('dorar_fontsize', size);
    }

    themeSelect.addEventListener('change', (e) => applyTheme(e.target.value));
    fontsizeSelect.addEventListener('change', (e) => applyFontSize(e.target.value));

    // --- Navigation & Modals ---
    btnHome.addEventListener('click', () => {
        viewSearch.classList.remove('hidden');
        viewFavorites.classList.add('hidden');
        btnHome.classList.add('active');
        btnFavorites.classList.remove('active');
    });

    btnFavorites.addEventListener('click', () => {
        viewSearch.classList.add('hidden');
        viewFavorites.classList.remove('hidden');
        btnHome.classList.remove('active');
        btnFavorites.classList.add('active');
        renderFavorites();
    });

    btnSettings.addEventListener('click', () => settingsModal.classList.remove('hidden'));
    btnCloseSettings.addEventListener('click', () => settingsModal.classList.add('hidden'));

    // --- Keyboard Shortcuts ---
    document.addEventListener('keydown', (e) => {
        // Ctrl+F or / to focus search
        if ((e.ctrlKey && e.key === 'f') || (e.key === '/' && e.target.tagName !== 'INPUT')) {
            e.preventDefault();
            searchInput.focus();
            if (viewFavorites.classList.contains('hidden') === false) {
                btnHome.click();
            }
        }
        // Esc to close modals/dropdowns
        if (e.key === 'Escape') {
            settingsModal.classList.add('hidden');
            searchHistoryContainer.classList.add('hidden');
        }
    });

    // --- Search History ---
    searchInput.addEventListener('focus', () => {
        if (searchHistory.length > 0) {
            renderSearchHistory();
            searchHistoryContainer.classList.remove('hidden');
        }
    });

    // Hide history when clicking outside
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.search-form')) {
            searchHistoryContainer.classList.add('hidden');
        }
    });

    function saveToHistory(query) {
        searchHistory = searchHistory.filter(q => q !== query);
        searchHistory.unshift(query);
        if (searchHistory.length > 10) searchHistory.pop();
        localStorage.setItem('dorar_history', JSON.stringify(searchHistory));
    }

    function renderSearchHistory() {
        searchHistoryContainer.innerHTML = '';
        searchHistory.forEach(query => {
            const div = document.createElement('div');
            div.className = 'history-item';
            div.innerHTML = `<svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg> <span>${query}</span>`;
            div.addEventListener('click', () => {
                searchInput.value = query;
                searchHistoryContainer.classList.add('hidden');
                searchForm.dispatchEvent(new Event('submit'));
            });
            searchHistoryContainer.appendChild(div);
        });
    }

    // --- Filtering ---
    filterBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            filterBtns.forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
            currentFilter = e.target.dataset.filter;
            if (currentResults.length > 0) {
                renderResults(currentResults, resultsContainer);
            }
        });
    });

    // --- Rendering Cards ---
    function createCard(hadithHtml, infoHtml, originalHtml) {
        const card = document.createElement('article');
        card.className = 'hadith-card';
        card.setAttribute('tabindex', '0');

        // Text parsing for copy/share
        const tempDivText = document.createElement('div');
        tempDivText.innerHTML = hadithHtml + (infoHtml || '');
        const plainText = tempDivText.innerText;

        // Check favorite status
        const isFav = favorites.some(f => f.plainText === plainText);

        const header = document.createElement('div');
        header.className = 'hadith-card-header';

        // Favorite Btn
        const btnFav = document.createElement('button');
        btnFav.className = `card-action-btn ${isFav ? 'favorite-active' : ''}`;
        btnFav.innerHTML = `<svg width="18" height="18" fill="${isFav ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>`;
        btnFav.title = "المفضلة";
        btnFav.addEventListener('click', () => {
            if (btnFav.classList.contains('favorite-active')) {
                favorites = favorites.filter(f => f.plainText !== plainText);
                btnFav.classList.remove('favorite-active');
                btnFav.querySelector('svg').setAttribute('fill', 'none');
            } else {
                favorites.push({ hadithHtml, infoHtml, originalHtml, plainText });
                btnFav.classList.add('favorite-active');
                btnFav.querySelector('svg').setAttribute('fill', 'currentColor');
            }
            localStorage.setItem('dorar_favorites', JSON.stringify(favorites));
            if (!viewFavorites.classList.contains('hidden')) renderFavorites();
        });

        // Copy Btn
        const btnCopy = document.createElement('button');
        btnCopy.className = 'card-action-btn';
        btnCopy.innerHTML = `<svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>`;
        btnCopy.title = "نسخ";
        btnCopy.addEventListener('click', async () => {
            try {
                await navigator.clipboard.writeText(plainText);
                const ogHTML = btnCopy.innerHTML;
                btnCopy.innerHTML = `<svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"></polyline></svg>`;
                setTimeout(() => btnCopy.innerHTML = ogHTML, 2000);
            } catch (err) {}
        });

        // Share Btn (if supported)
        const btnShare = document.createElement('button');
        btnShare.className = 'card-action-btn';
        btnShare.innerHTML = `<svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><circle cx="18" cy="5" r="3"></circle><circle cx="6" cy="12" r="3"></circle><circle cx="18" cy="19" r="3"></circle><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line></svg>`;
        btnShare.title = "مشاركة";
        if (!navigator.share) btnShare.style.display = 'none';
        btnShare.addEventListener('click', async () => {
            try {
                await navigator.share({ title: 'حديث شريف', text: plainText });
            } catch (err) {}
        });

        header.appendChild(btnCopy);
        header.appendChild(btnShare);
        header.appendChild(btnFav);
        
        card.appendChild(header);

        const tempContainer = document.createElement('div');
        tempContainer.innerHTML = hadithHtml + (infoHtml || '');
        while(tempContainer.firstChild) card.appendChild(tempContainer.firstChild);

        return card;
    }

    function renderResults(items, container) {
        container.innerHTML = '';
        
        // Filtering
        let filtered = items;
        if (currentFilter === 'authentic') {
            filtered = items.filter(item => {
                const info = (item.infoHtml || '').toLowerCase();
                return !info.includes('ضعيف') && !info.includes('منكر') && !info.includes('موضوع') && !info.includes('باطل');
            });
        } else if (currentFilter === 'weak') {
            filtered = items.filter(item => {
                const info = (item.infoHtml || '').toLowerCase();
                return info.includes('ضعيف') || info.includes('منكر') || info.includes('موضوع') || info.includes('باطل');
            });
        }

        if (filtered.length === 0) {
            container.innerHTML = '<div class="empty-state" role="status">لا توجد نتائج مطابقة للتصفية الحالية.</div>';
            return;
        }

        const fragment = document.createDocumentFragment();
        filtered.forEach((item, index) => {
            const card = createCard(item.hadithHtml, item.infoHtml, item.originalHtml);
            card.setAttribute('aria-label', `نتيجة رقم ${index + 1}`);
            fragment.appendChild(card);
        });

        container.appendChild(fragment);
    }

    function renderFavorites() {
        if (favorites.length === 0) {
            favoritesContainer.innerHTML = '<div class="empty-state">لم تقم بإضافة أي أحاديث للمفضلة بعد.</div>';
            return;
        }
        renderResults(favorites, favoritesContainer);
    }

    function processDorarHTML(htmlString) {
        if (!htmlString || htmlString.trim() === '') return [];
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = htmlString;

        const hadithElements = tempDiv.querySelectorAll('.hadith');
        const infoElements = tempDiv.querySelectorAll('.hadith-info');
        
        const items = [];
        for (let i = 0; i < hadithElements.length; i++) {
            items.push({
                hadithHtml: hadithElements[i].outerHTML,
                infoHtml: infoElements[i] ? infoElements[i].outerHTML : '',
                originalHtml: htmlString
            });
        }
        return items;
    }

    // --- API Fetch ---
    searchForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        searchHistoryContainer.classList.add('hidden');
        
        const query = searchInput.value.trim();
        if (!query) return;

        saveToHistory(query);
        
        loadingIndicator.classList.remove('hidden');
        resultsContainer.innerHTML = '';
        resultsSection.setAttribute('aria-busy', 'true');

        try {
            let dorarData;

            if (window.pywebview && window.pywebview.api) {
                // Desktop Native (Python)
                const result = await window.pywebview.api.search(query);
                if (!result) throw new Error("Python API returned empty");
                dorarData = JSON.parse(result);
            } else if (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.CapacitorHttp) {
                // Mobile Native (Capacitor Http Plugin)
                const targetUrl = `https://dorar.net/dorar_api.json?skey=${encodeURIComponent(query)}`;
                const response = await window.Capacitor.Plugins.CapacitorHttp.get({ url: targetUrl });
                dorarData = JSON.parse(response.data);
            } else if (typeof process !== 'undefined' && process.versions && process.versions.electron) {
                // Desktop Native (Electron)
                const targetUrl = `https://dorar.net/dorar_api.json?skey=${encodeURIComponent(query)}`;
                const response = await fetch(targetUrl);
                if (!response.ok) throw new Error('Network response was not ok');
                const data = await response.text();
                // Electron might receive raw JSON, unlike allorigins which wraps it
                dorarData = JSON.parse(data);
            } else {
                // Web Fallback (CORS Proxy)
                const targetUrl = `https://dorar.net/dorar_api.json?skey=${encodeURIComponent(query)}`;
                const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(targetUrl)}`;
                const response = await fetch(proxyUrl);
                if (!response.ok) throw new Error('Network response was not ok');
                const data = await response.json();
                dorarData = JSON.parse(data.contents);
            }

            loadingIndicator.classList.add('hidden');
            resultsSection.setAttribute('aria-busy', 'false');

            if (dorarData && dorarData.ahadith && dorarData.ahadith.result) {
                currentResults = processDorarHTML(dorarData.ahadith.result);
                renderResults(currentResults, resultsContainer);
                
                setTimeout(() => {
                    const firstCard = resultsContainer.querySelector('.hadith-card');
                    if (firstCard) firstCard.focus();
                }, 100);
            } else {
                resultsContainer.innerHTML = '<div class="empty-state" role="status">لم يتم العثور على نتائج.</div>';
            }
        } catch (err) {
            loadingIndicator.classList.add('hidden');
            resultsContainer.innerHTML = `<div class="error-message" role="alert">عذراً، حدث خطأ أثناء جلب البيانات. تأكد من الاتصال بالإنترنت.</div>`;
        }
    });
});
