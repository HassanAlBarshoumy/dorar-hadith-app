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

    // --- In-App Toast Notifications ---
    function showInAppNotification(title, body) {
        const container = document.getElementById('toast-container');
        if (!container) return;
        
        const toast = document.createElement('div');
        toast.className = 'toast-notification';
        toast.innerHTML = `<strong>${title}</strong><p style="margin: 0.5rem 0 0; font-size: 0.9em; white-space: pre-wrap;">${body}</p>`;
        
        container.appendChild(toast);
        announce(`${title}: ${body}`);
        
        setTimeout(() => toast.classList.add('show'), 10);
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 300);
        }, 8000);
    }

    // --- State ---
    let currentResults = []; // Store original fetched HTML strings
    let displayedCount = 0;
    const ITEMS_PER_PAGE = 20;
    let favorites = [];
    let searchHistory = [];
    let currentFilter = 'all';

    // Settings State
    let appSettings = {
        theme: 'auto',
        fontsize: 'md',
        favorites: [],
        history: [],
        notif: { enabled: false, interval: 60, category: 'عشوائي' }
    };

    // --- Persistent Storage Logic ---
    async function loadAllSettings() {
        try {
            let settingsStr = null;
            if (window.electronAPI && window.electronAPI.getSettings) {
                settingsStr = await window.electronAPI.getSettings();
            } else if (window.pywebview && window.pywebview.api && window.pywebview.api.get_settings) {
                settingsStr = await window.pywebview.api.get_settings();
            }
            
            if (settingsStr) {
                appSettings = { ...appSettings, ...JSON.parse(settingsStr) };
            } else {
                loadFromLocalStorage(); // Fallback if file doesn't exist
            }
        } catch (e) {
            loadFromLocalStorage();
        }
        
        favorites = appSettings.favorites || [];
        searchHistory = appSettings.history || [];
        
        applyTheme(appSettings.theme, false);
        applyFontSize(appSettings.fontsize, false);
        themeSelect.value = appSettings.theme;
        fontsizeSelect.value = appSettings.fontsize;

        setupNotifications(); // Initialize notifications after load
    }

    function loadFromLocalStorage() {
        appSettings.theme = localStorage.getItem('dorar_theme') || 'auto';
        appSettings.fontsize = localStorage.getItem('dorar_fontsize') || 'md';
        appSettings.favorites = JSON.parse(localStorage.getItem('dorar_favorites')) || [];
        appSettings.history = JSON.parse(localStorage.getItem('dorar_history')) || [];
        appSettings.notif = JSON.parse(localStorage.getItem('dorar_notif_settings')) || appSettings.notif;
    }

    async function saveAllSettings() {
        // Always save to localStorage as a fallback
        localStorage.setItem('dorar_theme', appSettings.theme);
        localStorage.setItem('dorar_fontsize', appSettings.fontsize);
        localStorage.setItem('dorar_favorites', JSON.stringify(appSettings.favorites));
        localStorage.setItem('dorar_history', JSON.stringify(appSettings.history));
        localStorage.setItem('dorar_notif_settings', JSON.stringify(appSettings.notif));
        
        if (window.electronAPI && window.electronAPI.saveSettings) {
            window.electronAPI.saveSettings(JSON.stringify(appSettings));
        } else if (window.pywebview && window.pywebview.api && window.pywebview.api.save_settings) {
            window.pywebview.api.save_settings(JSON.stringify(appSettings));
        }
    }

    function applyTheme(theme, announceChange = true) {
        document.body.classList.remove('theme-auto', 'theme-light', 'theme-dark');
        document.body.classList.add(`theme-${theme}`);
        appSettings.theme = theme;
        saveAllSettings();
        if (announceChange) {
            const themeNames = { 'auto': 'تلقائي', 'light': 'فاتح', 'dark': 'داكن' };
            announce(`تم تغيير المظهر إلى الوضع ال${themeNames[theme]}`);
        }
    }

    function applyFontSize(size, announceChange = true) {
        document.body.classList.remove('font-size-sm', 'font-size-md', 'font-size-lg', 'font-size-xl');
        document.body.classList.add(`font-size-${size}`);
        appSettings.fontsize = size;
        saveAllSettings();
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
            if (!searchHistory.includes(query)) {
                searchHistory.unshift(query);
                if (searchHistory.length > 5) searchHistory.pop();
                appSettings.history = searchHistory;
                saveAllSettings();
                renderSearchHistory();
            }
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
                appSettings.favorites = favorites;
                saveAllSettings();
                btnFav.classList.add('favorite-active');
                btnFav.querySelector('svg').setAttribute('fill', 'currentColor');
                showToast("تمت الإضافة للمفضلة");
            }
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
        
        searchHistoryContainer.classList.add('hidden');
        
        const query = searchInput.value.trim();
        if (!query) return;

        saveToHistory(query);
        
        const searchSource = document.querySelector('input[name="searchSource"]:checked').value;

        loadingIndicator.classList.remove('hidden');
        resultsContainer.innerHTML = '';
        resultsSection.setAttribute('aria-busy', 'true');

        try {
            if (searchSource === 'local_9books') {
                if (window.pywebview && window.pywebview.api && window.pywebview.api.search_local_hadith) {
                    const localDataStr = await window.pywebview.api.search_local_hadith(query);
                    const localData = JSON.parse(localDataStr);
                    
                    currentResults = localData.map(item => ({
                        hadithHtml: `<div class="hadith">${item.text}</div>`,
                        infoHtml: `<div class="hadith-info">
                            <span class="info-item"><span class="info-label">المصدر:</span> ${item.book}</span>
                            <span class="info-item"><span class="info-label">خلاصة الحكم:</span> ${item.authenticity}</span>
                        </div>`,
                        originalHtml: ""
                    }));
                } else {
                    currentResults = [];
                }
            } else {
                let dorarData = null;

                // 1. Try to load from Local Cache (Offline Database) First
                if (window.pywebview && window.pywebview.api && window.pywebview.api.get_from_cache) {
                    try {
                        const cachedData = await window.pywebview.api.get_from_cache(query);
                        if (cachedData) {
                            dorarData = JSON.parse(cachedData);
                        }
                    } catch (e) { console.error("Cache error:", e); }
                }

                // 2. If not found in cache, fetch from internet
                if (!dorarData) {
                    if (!navigator.onLine) {
                        loadingIndicator.classList.add('hidden');
                        resultsContainer.innerHTML = `<div class="error-message" role="alert">أنت غير متصل بالإنترنت ولم يتم العثور على نتيجة في الذاكرة المحلية.</div>`;
                        return;
                    }
                    if (!dorarData && window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.CapacitorHttp) {
                        try {
                            const options = {
                                url: `https://dorar.net/dorar_api.json`,
                                params: { skey: query },
                                headers: { 'User-Agent': 'DorarHadithApp Mobile' }
                            };
                            const response = await window.Capacitor.Plugins.CapacitorHttp.get(options);
                            dorarData = JSON.parse(response.data);
                        } catch (e) {
                            console.error("Capacitor HTTP failed", e);
                        }
                    }
                    
                    if (!dorarData) {
                        dorarData = await fetchDorarJSONP(query);
                    }

                    // 3. Save the new fetched data to Local Cache
                    if (dorarData && window.pywebview && window.pywebview.api && window.pywebview.api.save_to_cache) {
                        try {
                            window.pywebview.api.save_to_cache(query, JSON.stringify(dorarData));
                        } catch (e) {}
                    }
                }

                if (!dorarData || !dorarData.ahadith || !dorarData.ahadith.result) {
                    currentResults = [];
                } else {
                    currentResults = processDorarHTML(dorarData.ahadith.result);
                }
            }

            displayedCount = 0;
            resultsContainer.innerHTML = '';
            
            containerNotif.style.display = 'block';

            if (currentResults.length === 0) {
                    resultsContainer.innerHTML = '<div class="empty-state">لا توجد أحاديث مطابقة لبحثك.</div>';
                } else {
                    renderResults(currentResults, resultsContainer);
                    
                    setTimeout(() => {
                        const firstCard = resultsContainer.querySelector('.hadith-card');
                        if (firstCard) firstCard.focus();
                    }, 100);
                }
        } catch (err) {
            loadingIndicator.classList.add('hidden');
            resultsContainer.innerHTML = `<div class="error-message" role="alert">عذراً، حدث خطأ أثناء جلب البيانات. تأكد من الاتصال بالإنترنت.</div>`;
            announce("حدث خطأ أثناء البحث. يرجى التحقق من اتصالك بالإنترنت.");
        }
    });

    // --- Smart Notifications ---
    const categoryKeywords = {
        'عقيدة': ['توحيد', 'إيمان', 'شرك', 'ملائكة', 'قدر', 'عقيدة', 'رسل', 'يوم القيامة'],
        'صلاة': ['صلاة', 'سجود', 'ركوع', 'مساجد', 'وضوء', 'أذان', 'إمامة', 'خشوع'],
        'صيام': ['صيام', 'رمضان', 'فطر', 'سحور', 'تراويح', 'اعتكاف', 'ليلة القدر'],
        'زكاة': ['زكاة', 'صدقة', 'نصاب', 'فقراء', 'مساكين', 'إنفاق'],
        'حج': ['حج', 'عمرة', 'طواف', 'سعي', 'إحرام', 'مكة', 'عرفة', 'مزدلفة'],
        'أخلاق': ['صدق', 'أمانة', 'بر', 'صلة', 'حياء', 'تواضع', 'صبر', 'إحسان'],
        'أذكار': ['ذكر', 'دعاء', 'استغفار', 'تسبيح', 'تحميد', 'تكبير', 'تهليل']
    };
    
    let notifTimer = null;
    const toggleNotif = document.getElementById('notif-toggle');
    const intervalSelectNotif = document.getElementById('notif-interval');
    const categorySelectNotif = document.getElementById('notif-category');
    const containerNotif = document.getElementById('notif-settings-container');

    function setupNotifications() {
        if (!toggleNotif) return;
        const notifSettings = appSettings.notif;

        toggleNotif.value = notifSettings.enabled ? 'on' : 'off';
        intervalSelectNotif.value = notifSettings.interval;
        categorySelectNotif.value = notifSettings.category;
        containerNotif.style.display = notifSettings.enabled ? 'block' : 'none';

        if (notifSettings.enabled && Notification.permission !== 'granted' && Notification.permission !== 'denied') {
            Notification.requestPermission();
        }

        toggleNotif.addEventListener('change', () => {
            const enabled = toggleNotif.value === 'on';
            containerNotif.style.display = enabled ? 'block' : 'none';
            if (enabled && Notification.permission !== 'granted') {
                Notification.requestPermission();
            }
            saveNotifSettings();
        });

        intervalSelectNotif.addEventListener('change', saveNotifSettings);
        categorySelectNotif.addEventListener('change', saveNotifSettings);
        
        const btnTestNotif = document.getElementById('btn-test-notif');
        if (btnTestNotif) {
            // Remove existing listeners to avoid duplicates if setup is called multiple times
            const newBtn = btnTestNotif.cloneNode(true);
            btnTestNotif.parentNode.replaceChild(newBtn, btnTestNotif);
            newBtn.addEventListener('click', (e) => {
                e.preventDefault();
                newBtn.textContent = 'جاري جلب الفائدة...';
                newBtn.disabled = true;
                triggerNotification(true).finally(() => {
                    newBtn.textContent = 'جرب الإشعار الآن';
                    newBtn.disabled = false;
                });
            });
        }
        
        startNotificationTimer();
    }

    function saveNotifSettings() {
        appSettings.notif = {
            enabled: toggleNotif.value === 'on',
            interval: parseInt(intervalSelectNotif.value),
            category: categorySelectNotif.value
        };
        saveAllSettings();
        startNotificationTimer();
    }

    function startNotificationTimer() {
        if (notifTimer) clearInterval(notifTimer);
        const settings = appSettings.notif;
        if (!settings || !settings.enabled) return;
        notifTimer = setInterval(triggerNotification, settings.interval * 60 * 1000);
    }

    // --- API Fetch via JSONP ---
    function fetchDorarJSONP(keyword) {
        return new Promise((resolve, reject) => {
            const callbackName = 'dorar_cb_' + Math.round(100000 * Math.random());
            window[callbackName] = function(data) {
                delete window[callbackName];
                if (script.parentNode) document.body.removeChild(script);
                resolve(data);
            };
            
            const script = document.createElement('script');
            const targetUrl = `https://dorar.net/dorar_api.json?skey=${encodeURIComponent(keyword)}&callback=${callbackName}`;
            script.src = targetUrl;
            
            script.onerror = () => {
                delete window[callbackName];
                if (script.parentNode) document.body.removeChild(script);
                reject(new Error("JSONP Request failed"));
            };
            
            document.body.appendChild(script);

            // Timeout after 15 seconds
            setTimeout(() => {
                if (window[callbackName]) {
                    delete window[callbackName];
                    if (script.parentNode) document.body.removeChild(script);
                    reject(new Error("JSONP Request Timeout"));
                }
            }, 15000);
        });
    }

    async function triggerNotification(force = false) {
        if (!force && Notification.permission !== 'granted') return;
        
        const settings = appSettings.notif;
        if (!force && (!settings || !settings.enabled)) return;

        // Use the current select values if forcing (testing), otherwise from settings
        const cat = force ? categorySelectNotif.value : (settings ? settings.category : 'عشوائي');
        let keyword = '';
        if (cat === 'عشوائي') {
            const allKeys = Object.keys(categoryKeywords);
            const randomCat = allKeys[Math.floor(Math.random() * allKeys.length)];
            const words = categoryKeywords[randomCat];
            keyword = words[Math.floor(Math.random() * words.length)];
        } else {
            const words = categoryKeywords[cat] || ['الله'];
            keyword = words[Math.floor(Math.random() * words.length)];
        }

        try {
            let data = null;
            // 1. Try Cache First
            if (window.pywebview && window.pywebview.api && window.pywebview.api.get_from_cache) {
                try {
                    const cachedData = await window.pywebview.api.get_from_cache(keyword);
                    if (cachedData) data = JSON.parse(cachedData);
                } catch (e) {}
            }

            // 2. Fallback to Internet
            if (!data) {
                data = await fetchDorarJSONP(keyword);
                
                // 3. Save to Cache
                if (data && window.pywebview && window.pywebview.api && window.pywebview.api.save_to_cache) {
                    try {
                        window.pywebview.api.save_to_cache(keyword, JSON.stringify(data));
                    } catch (e) {}
                }
            }

            if (data && data.ahadith && data.ahadith.result) {
                const results = processDorarHTML(data.ahadith.result);
                const authentic = results.filter(r => r.degree.includes('صحيح') || r.degree.includes('حسن') || r.degree.includes('إسناده'));
                if (authentic.length > 0) {
                    const randomHadith = authentic[Math.floor(Math.random() * authentic.length)];
                    const title = "الموسوعة الحديثية - " + (cat === 'عشوائي' ? 'فائدة عشوائية' : cat);
                    const body = `${randomHadith.text}\n\nالراوي: ${randomHadith.rawi}\nالمحدث: ${randomHadith.muhaddith}\nخلاصة: ${randomHadith.degree}`;
                    
                    // Show in-app toast
                    showInAppNotification(title, body);

                    // Show native notification
                    if (window.electronAPI && window.electronAPI.showNotification) {
                        window.electronAPI.showNotification({ title: title, body: body });
                    } else {
                        new Notification(title, { body: body });
                    }
                } else if (force) {
                    showInAppNotification("تجربة الإشعار", "لم يتم العثور على حديث صحيح لهذه الفئة في هذه المحاولة.");
                }
            } else if (force) {
                showInAppNotification("خطأ", "لم نتمكن من جلب البيانات من الخادم.");
            }
        } catch (err) {
            if (window.electronAPI && window.electronAPI.logError) {
                window.electronAPI.logError(`Notification error: ${err}`);
            }
            if (force) {
                showInAppNotification("خطأ", "حدث خطأ أثناء الاتصال بالإنترنت أو الخادم.");
            }
        }
    }
    
    // Start by loading settings
    loadAllSettings();
});
