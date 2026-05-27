document.addEventListener('DOMContentLoaded', () => {
    // --- Global Error Logging ---
    window.addEventListener('error', (event) => {
        if (window.electronAPI && window.electronAPI.logError) {
            window.electronAPI.logError(`Error: ${event.message} at ${event.filename}:${event.lineno}`);
        }
    });
    window.addEventListener('unhandledrejection', (event) => {
        if (window.electronAPI && window.electronAPI.logError) {
            window.electronAPI.logError(`Unhandled Promise Rejection: ${event.reason}`);
        }
    });

    // --- Elements ---
    const searchForm = document.getElementById('search-form');
    const searchInput = document.getElementById('search-input');
    const searchButton = document.getElementById('search-button');
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
    
    const liveAnnouncer = document.getElementById('live-announcer');
    const btnBackToTop = document.getElementById('btn-back-to-top');
    const btnLoadMore = document.getElementById('btn-load-more');
    const offlineBanner = document.getElementById('offline-banner');

    // --- Offline Status ---
    function updateOfflineStatus() {
        if (navigator.onLine) {
            offlineBanner.classList.add('hidden');
            searchButton.disabled = false;
            searchInput.placeholder = "ابحث هنا (مثال: صلاة، صوم...)";
        } else {
            offlineBanner.classList.remove('hidden');
            searchButton.disabled = true;
            searchInput.placeholder = "البحث معطل (غير متصل بالإنترنت)";
        }
    }
    window.addEventListener('online', updateOfflineStatus);
    window.addEventListener('offline', updateOfflineStatus);
    updateOfflineStatus();

    // --- Screen Reader Announcer ---
    function announce(message) {
        if (liveAnnouncer) {
            liveAnnouncer.textContent = message;
            // Clear after a bit so the same message can be announced again if needed
            setTimeout(() => liveAnnouncer.textContent = '', 3000);
        }
    }

    // --- State ---
    let currentResults = []; // Store original fetched HTML strings
    let displayedCount = 0;
    const ITEMS_PER_PAGE = 20;
    let favorites = JSON.parse(localStorage.getItem('dorar_favorites')) || [];
    let searchHistory = JSON.parse(localStorage.getItem('dorar_history')) || [];
    let currentFilter = 'all';

    // --- Init Settings ---
    const savedTheme = localStorage.getItem('dorar_theme') || 'auto';
    const savedFontSize = localStorage.getItem('dorar_fontsize') || 'md';
    applyTheme(savedTheme, false);
    applyFontSize(savedFontSize, false);
    themeSelect.value = savedTheme;
    fontsizeSelect.value = savedFontSize;

    function applyTheme(theme, announceChange = true) {
        document.body.classList.remove('theme-auto', 'theme-light', 'theme-dark');
        document.body.classList.add(`theme-${theme}`);
        localStorage.setItem('dorar_theme', theme);
        if (announceChange) {
            const themeNames = { 'auto': 'تلقائي', 'light': 'فاتح', 'dark': 'داكن' };
            announce(`تم تغيير المظهر إلى الوضع ال${themeNames[theme]}`);
        }
    }

    function applyFontSize(size, announceChange = true) {
        document.body.classList.remove('font-size-sm', 'font-size-md', 'font-size-lg', 'font-size-xl');
        document.body.classList.add(`font-size-${size}`);
        localStorage.setItem('dorar_fontsize', size);
        if (announceChange) {
            const sizeNames = { 'sm': 'صغير', 'md': 'متوسط', 'lg': 'كبير', 'xl': 'كبير جداً' };
            announce(`تم تغيير حجم الخط إلى ${sizeNames[size]}`);
        }
    }

    themeSelect.addEventListener('change', (e) => applyTheme(e.target.value));
    fontsizeSelect.addEventListener('change', (e) => applyFontSize(e.target.value));

    // --- Back to Top Logic ---
    window.addEventListener('scroll', () => {
        if (window.scrollY > 300) {
            btnBackToTop.classList.add('visible');
            btnBackToTop.classList.remove('hidden');
        } else {
            btnBackToTop.classList.remove('visible');
            btnBackToTop.classList.add('hidden');
        }
    });

    btnBackToTop.addEventListener('click', () => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
        // Return focus to search bar for accessibility
        searchInput.focus();
    });

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
        
        // --- Arrow Navigation for Cards ---
        if (e.target.classList.contains('hadith-card')) {
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                const next = e.target.nextElementSibling;
                if (next && next.classList.contains('hadith-card')) {
                    e.target.setAttribute('tabindex', '-1');
                    next.setAttribute('tabindex', '0');
                    next.focus();
                }
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                const prev = e.target.previousElementSibling;
                if (prev && prev.classList.contains('hadith-card')) {
                    e.target.setAttribute('tabindex', '-1');
                    prev.setAttribute('tabindex', '0');
                    prev.focus();
                }
                else if (!prev) document.getElementById('search-input').focus();
            }
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

    // --- Toast Notification ---
    function showToast(message) {
        const toastContainer = document.getElementById('toast-container');
        if (!toastContainer) return;
        const toast = document.createElement('div');
        toast.className = 'toast';
        toast.innerHTML = `<svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"></polyline></svg> <span>${message}</span>`;
        toastContainer.appendChild(toast);
        // Remove after animation (3 seconds)
        setTimeout(() => {
            if (toastContainer.contains(toast)) toastContainer.removeChild(toast);
        }, 3000);
    }

    // --- Rendering Cards ---
    function createCard(hadithHtml, infoHtml, originalHtml, index = 0) {
        const card = document.createElement('li');
        card.className = 'hadith-card';
        card.setAttribute('tabindex', index === 0 ? '0' : '-1');
        
        // Add staggered animation delay
        card.style.animationDelay = `${index * 0.05}s`;

        // Text parsing for copy/share with beautiful formatting
        const textHadith = document.createElement('div'); textHadith.innerHTML = hadithHtml;
        const textInfo = document.createElement('div'); textInfo.innerHTML = (infoHtml || '');
        
        let plainText = textHadith.innerText.trim() + '\n\n';
        let infoStr = textInfo.innerText.trim();
        // Insert new lines before keywords to make it readable
        infoStr = infoStr.replace(/([^\n])(الراوي:|المحدث:|المصدر:|الصفحة أو الرقم:|خلاصة حكم المحدث:|التخريج:)/g, '$1\n$2');
        plainText += infoStr;

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
                showToast("تمت الإضافة للمفضلة");
            }
            localStorage.setItem('dorar_favorites', JSON.stringify(favorites));
            if (!viewFavorites.classList.contains('hidden')) renderFavorites();
        });

        // Copy Btn
        const btnCopy = document.createElement('button');
        btnCopy.className = 'card-action-btn';
        btnCopy.innerHTML = `<svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>`;
        btnCopy.title = "نسخ الحديث";
        btnCopy.addEventListener('click', async () => {
            try {
                await navigator.clipboard.writeText(plainText);
                showToast("تم نسخ الحديث بنجاح!");
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

        // Process visual HTML (Badges)
        const contentId = `hadith-content-${Date.now()}-${index}`;
        const contentWrapper = document.createElement('div');
        contentWrapper.id = contentId;
        
        let enhancedInfoHtml = infoHtml || '';
        contentWrapper.innerHTML = hadithHtml + enhancedInfoHtml;
        card.appendChild(contentWrapper);
        
        card.setAttribute('aria-labelledby', contentId);

        return card;
    }

    btnLoadMore.addEventListener('click', () => {
        renderResults(currentResults, resultsContainer, true);
    });

    function renderResults(items, container, append = false) {
        if (!append) {
            container.innerHTML = '';
            displayedCount = 0;
            if (btnLoadMore) btnLoadMore.classList.add('hidden');
        }
        
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

        if (filtered.length === 0 && !append) {
            container.innerHTML = '<div class="empty-state" role="status">لا توجد نتائج مطابقة للتصفية الحالية.</div>';
            announce("لا توجد نتائج مطابقة للتصفية الحالية.");
            return;
        }

        const fragment = document.createDocumentFragment();
        const nextBatch = filtered.slice(displayedCount, displayedCount + ITEMS_PER_PAGE);
        
        nextBatch.forEach((item, index) => {
            const card = createCard(item.hadithHtml, item.infoHtml, item.originalHtml, displayedCount + index);
            fragment.appendChild(card);
        });

        container.appendChild(fragment);
        displayedCount += nextBatch.length;

        if (btnLoadMore) {
            if (displayedCount < filtered.length) {
                btnLoadMore.classList.remove('hidden');
            } else {
                btnLoadMore.classList.add('hidden');
            }
        }
    }

    function renderFavorites() {
        if (favorites.length === 0) {
            favoritesContainer.innerHTML = '<div class="empty-state">لم تقم بإضافة أي أحاديث للمفضلة بعد.</div>';
            return;
        }
        renderResults(favorites, favoritesContainer);
    }

    // --- Data Parsing ---
    function processDorarHTML(htmlString) {
        if (!htmlString || htmlString.trim() === '') return [];
        const tempDiv = document.createElement('div');
        // Secure sanitization with DOMPurify if available
        tempDiv.innerHTML = window.DOMPurify ? window.DOMPurify.sanitize(htmlString) : htmlString;

        const hadithElements = tempDiv.querySelectorAll('.hadith');
        const infoElements = tempDiv.querySelectorAll('.hadith-info');
        
        const items = [];
        for (let i = 0; i < hadithElements.length; i++) {
            let processedInfo = '';
            if (infoElements[i]) {
                const clonedInfo = infoElements[i].cloneNode(true);
                const newInfoDiv = document.createElement('div');
                newInfoDiv.className = 'hadith-info';
                
                let currentItem = null;
                Array.from(clonedInfo.childNodes).forEach(node => {
                    if (node.nodeType === 1 && node.classList.contains('info-subtitle')) {
                        currentItem = document.createElement('div');
                        currentItem.className = 'info-item';
                        currentItem.appendChild(node.cloneNode(true));
                        newInfoDiv.appendChild(currentItem);
                    } else if (currentItem) {
                        // Avoid adding empty text nodes as value
                        if (node.nodeType === 3 && node.textContent.trim() === '') return;
                        currentItem.appendChild(node.cloneNode(true));
                    } else {
                        newInfoDiv.appendChild(node.cloneNode(true));
                    }
                });
                processedInfo = newInfoDiv.outerHTML;
            }

            items.push({
                hadithHtml: hadithElements[i].outerHTML,
                infoHtml: processedInfo,
                originalHtml: htmlString
            });
        }
        return items;
    }

    // --- API Fetch ---
    searchForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        if (!navigator.onLine) {
            announce("أنت حالياً غير متصل بالإنترنت. لا يمكن إجراء البحث.");
            return;
        }

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
            } else if (window.electronAPI) {
                // Desktop Native (Electron Secure IPC)
                const targetUrl = `https://dorar.net/dorar_api.json?skey=${encodeURIComponent(query)}`;
                const response = await window.electronAPI.fetchDorar(targetUrl);
                dorarData = JSON.parse(response);
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
                const results = processDorarHTML(dorarData.ahadith.result);
                if (results.length === 0) {
                    resultsContainer.innerHTML = '<div class="empty-state" role="status">لم يتم العثور على نتائج.</div>';
                    announce("لم يتم العثور على نتائج للبحث المطلوب.");
                } else {
                    currentResults = results;
                    renderResults(currentResults, resultsContainer);
                    announce(`تم العثور على ${results.length} نتيجة. يمكنك استخدام مفتاح Tab للذهاب للنتائج، ثم الأسهم للتنقل بين الأحاديث.`);
                    
                    setTimeout(() => {
                        const firstCard = resultsContainer.querySelector('.hadith-card');
                        if (firstCard) firstCard.focus();
                    }, 100);
                }
            } else {
                resultsContainer.innerHTML = '<div class="empty-state" role="status">لم يتم العثور على نتائج.</div>';
                announce("لم يتم العثور على نتائج للبحث المطلوب.");
            }
        } catch (err) {
            loadingIndicator.classList.add('hidden');
            resultsContainer.innerHTML = `<div class="error-message" role="alert">عذراً، حدث خطأ أثناء جلب البيانات. تأكد من الاتصال بالإنترنت.</div>`;
            announce("حدث خطأ أثناء البحث. يرجى التحقق من اتصالك بالإنترنت.");
        }
    });
});
