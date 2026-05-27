document.addEventListener('DOMContentLoaded', () => {
    // --- Global Error Logging ---
    window.addEventListener('error', (event) => {
        if (window.electronAPI && window.electronAPI.logError) {
            window.electronAPI.logError(`Error: ${event.message} at ${event.filename}:${event.lineno}`);
        } else if (window.pywebview && window.pywebview.api && window.pywebview.api.log_error) {
            window.pywebview.api.log_error(`Error: ${event.message} at ${event.filename}:${event.lineno}`);
        }
    });
    window.addEventListener('unhandledrejection', (event) => {
        if (window.electronAPI && window.electronAPI.logError) {
            window.electronAPI.logError(`Unhandled Promise Rejection: ${event.reason}`);
        } else if (window.pywebview && window.pywebview.api && window.pywebview.api.log_error) {
            window.pywebview.api.log_error(`Unhandled Promise Rejection: ${event.reason}`);
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
    
    let currentPage = 1;
    let currentSearchQuery = '';
    let hasMorePages = true;

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

    themeSelect.addEventListener('change', (e) => {
        if (tempSettings) tempSettings.theme = e.target.value;
        applyTheme(e.target.value, false);
    });
    fontsizeSelect.addEventListener('change', (e) => {
        if (tempSettings) tempSettings.fontsize = e.target.value;
        applyFontSize(e.target.value, false);
    });

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
        btnHome.setAttribute('aria-current', 'page');
        btnFavorites.classList.remove('active');
        btnFavorites.removeAttribute('aria-current');
    });

    btnFavorites.addEventListener('click', () => {
        viewSearch.classList.add('hidden');
        viewFavorites.classList.remove('hidden');
        btnHome.classList.remove('active');
        btnHome.removeAttribute('aria-current');
        btnFavorites.classList.add('active');
        btnFavorites.setAttribute('aria-current', 'page');
        renderFavorites();
    });

    let tempSettings = null;
    const btnSaveSettings = document.getElementById('btn-save-settings');

    btnSettings.addEventListener('click', () => {
        tempSettings = JSON.parse(JSON.stringify(appSettings));
        themeSelect.value = tempSettings.theme;
        fontsizeSelect.value = tempSettings.fontsize;
        const notifToggle = document.getElementById('notif-toggle');
        const notifInterval = document.getElementById('notif-interval');
        const notifCategory = document.getElementById('notif-category');
        if (notifToggle) notifToggle.value = tempSettings.notif.enabled ? 'on' : 'off';
        if (notifInterval) notifInterval.value = tempSettings.notif.interval;
        if (notifCategory) notifCategory.value = tempSettings.notif.category;
        
        settingsModal.classList.remove('hidden');
        settingsModal.setAttribute('aria-hidden', 'false');
        // Set focus to the first focusable element or the close button
        setTimeout(() => btnCloseSettings.focus(), 50);
    });
    
    function closeSettingsWithPrompt() {
        if (!tempSettings) return;
        
        // Update tempSettings from notif inputs just in case they were changed
        const notifToggle = document.getElementById('notif-toggle');
        const notifInterval = document.getElementById('notif-interval');
        const notifCategory = document.getElementById('notif-category');
        if (notifToggle && notifInterval && notifCategory) {
            tempSettings.notif.enabled = notifToggle.value === 'on';
            tempSettings.notif.interval = parseInt(notifInterval.value);
            tempSettings.notif.category = notifCategory.value;
        }

        if (JSON.stringify(tempSettings) !== JSON.stringify(appSettings)) {
            if (confirm("يوجد تغييرات غير محفوظة، هل تريد حفظ الإعدادات قبل الخروج؟")) {
                if (btnSaveSettings) btnSaveSettings.click();
                return;
            } else {
                applyTheme(appSettings.theme, false);
                applyFontSize(appSettings.fontsize, false);
            }
        }
        settingsModal.classList.add('hidden');
        settingsModal.setAttribute('aria-hidden', 'true');
        btnSettings.focus();
    }
    
    if (btnSaveSettings) {
        btnSaveSettings.addEventListener('click', () => {
            if (!tempSettings) return;
            const notifToggle = document.getElementById('notif-toggle');
            const notifInterval = document.getElementById('notif-interval');
            const notifCategory = document.getElementById('notif-category');
            if (notifToggle && notifInterval && notifCategory) {
                tempSettings.notif.enabled = notifToggle.value === 'on';
                tempSettings.notif.interval = parseInt(notifInterval.value);
                tempSettings.notif.category = notifCategory.value;
            }
            
            appSettings = JSON.parse(JSON.stringify(tempSettings));
            saveAllSettings();
            showToast('تم حفظ الإعدادات بنجاح');
            
            settingsModal.classList.add('hidden');
            settingsModal.setAttribute('aria-hidden', 'true');
            btnSettings.focus();
        });
    }

    btnCloseSettings.addEventListener('click', closeSettingsWithPrompt);

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
            if (!settingsModal.classList.contains('hidden')) {
                closeSettingsWithPrompt();
            }
            searchHistoryContainer.classList.add('hidden');
        }
        
        // --- Roving TabIndex Navigation for Cards ---
        if (e.target.classList.contains('hadith-card')) {
            const updateRovingFocus = (oldCard, newCard) => {
                if (!newCard) return;
                oldCard.setAttribute('tabindex', '-1');
                oldCard.querySelectorAll('button, [contenteditable]').forEach(el => el.setAttribute('tabindex', '-1'));
                newCard.setAttribute('tabindex', '0');
                newCard.querySelectorAll('button, [contenteditable]').forEach(el => el.setAttribute('tabindex', '0'));
                newCard.focus();
            };

            if (e.key === 'ArrowDown') {
                e.preventDefault();
                updateRovingFocus(e.target, e.target.nextElementSibling);
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                const prev = e.target.previousElementSibling;
                if (prev && prev.classList.contains('hadith-card')) {
                    updateRovingFocus(e.target, prev);
                } else if (!prev) {
                    document.getElementById('search-input').focus();
                }
            } else if (e.key === 'Home') {
                e.preventDefault();
                updateRovingFocus(e.target, document.getElementById('results-container').firstElementChild);
            } else if (e.key === 'End') {
                e.preventDefault();
                updateRovingFocus(e.target, document.getElementById('results-container').lastElementChild);
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

    searchInput.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowDown' && !searchHistoryContainer.classList.contains('hidden')) {
            e.preventDefault();
            const firstItem = searchHistoryContainer.querySelector('.history-item');
            if (firstItem) firstItem.focus();
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
            div.setAttribute('tabindex', '0');
            div.setAttribute('role', 'button');
            div.setAttribute('aria-label', `ابحث عن ${query} مجدداً`);
            div.innerHTML = `<svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg> <span>${query}</span>`;
            
            const executeHistorySearch = () => {
                searchInput.value = query;
                searchHistoryContainer.classList.add('hidden');
                searchForm.dispatchEvent(new Event('submit'));
            };

            div.addEventListener('click', executeHistorySearch);
            div.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    executeHistorySearch();
                } else if (e.key === 'ArrowDown') {
                    e.preventDefault();
                    const next = div.nextElementSibling;
                    if (next) next.focus();
                } else if (e.key === 'ArrowUp') {
                    e.preventDefault();
                    const prev = div.previousElementSibling;
                    if (prev) prev.focus();
                    else searchInput.focus();
                }
            });
            searchHistoryContainer.appendChild(div);
        });
    }

    // --- Filtering ---
    filterBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            filterBtns.forEach(b => {
                b.classList.remove('active');
                b.setAttribute('aria-pressed', 'false');
            });
            e.target.classList.add('active');
            e.target.setAttribute('aria-pressed', 'true');
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
        const textHadith = document.createElement('div'); 
        textHadith.innerHTML = hadithHtml.replace(/<br\s*[\/]?>/gi, '\n');
        
        const textInfo = document.createElement('div'); 
        textInfo.innerHTML = (infoHtml || '').replace(/<br\s*[\/]?>/gi, '\n');
        
        let plainText = textHadith.textContent.trim() + '\n\n';
        let infoStr = textInfo.textContent.trim();
        // Insert new lines before keywords to make it readable
        infoStr = infoStr.replace(/([^\n])(الراوي:|المحدث:|المصدر:|الصفحة أو الرقم:|خلاصة حكم المحدث:|التخريج:)/g, '$1\n$2');
        plainText += infoStr;

        // Check favorite status
        const isFav = favorites.some(f => f.hadithHtml === hadithHtml);

        const header = document.createElement('div');
        header.className = 'hadith-card-header';

        // Favorite Btn
        const btnFav = document.createElement('button');
        btnFav.className = `card-action-btn ${isFav ? 'favorite-active' : ''}`;
        btnFav.innerHTML = `<svg width="18" height="18" fill="${isFav ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>`;
        btnFav.title = "المفضلة";
        btnFav.addEventListener('click', () => {
            if (btnFav.classList.contains('favorite-active')) {
                favorites = favorites.filter(f => f.hadithHtml !== hadithHtml);
                appSettings.favorites = favorites;
                saveAllSettings();
                btnFav.classList.remove('favorite-active');
                btnFav.querySelector('svg').setAttribute('fill', 'none');
                showToast("تم الإزالة من المفضلة");
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
        
        // Process visual HTML (Badges)
        const contentId = `hadith-content-${Date.now()}-${index}`;
        
const contentWrapper = document.createElement('div');
        contentWrapper.id = contentId;
        contentWrapper.className = 'hadith-text-box';
        contentWrapper.setAttribute('contenteditable', 'true');
        contentWrapper.setAttribute('role', 'textbox');
        contentWrapper.setAttribute('aria-readonly', 'true');
        contentWrapper.setAttribute('aria-roledescription', 'مربع نص للقراءة فقط');
        contentWrapper.setAttribute('aria-multiline', 'true');
        contentWrapper.setAttribute('aria-label', 'نص الحديث');
        contentWrapper.setAttribute('tabindex', index === 0 ? '0' : '-1');
        
        // Prevent editing but allow screen reader navigation
        contentWrapper.addEventListener('keydown', (e) => {
            const allowedKeys = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab', 'Home', 'End', 'PageUp', 'PageDown', 'Shift', 'Control', 'Alt', 'c', 'a', 'C', 'A'];
            if (!allowedKeys.includes(e.key) && !e.ctrlKey && !e.altKey && !e.metaKey) {
                e.preventDefault();
            } else if (e.key.length === 1 && !e.ctrlKey && !e.altKey && !e.metaKey) {
                e.preventDefault();
            }
        });
        contentWrapper.addEventListener('paste', e => e.preventDefault());
        contentWrapper.addEventListener('cut', e => e.preventDefault());
        
        let enhancedInfoHtml = infoHtml || '';
        contentWrapper.innerHTML = hadithHtml + enhancedInfoHtml;
        card.appendChild(contentWrapper);
        
        // Set tabindices for buttons
        const tabIndexVal = index === 0 ? '0' : '-1';
        btnFav.setAttribute('tabindex', tabIndexVal);
        btnCopy.setAttribute('tabindex', tabIndexVal);
        btnShare.setAttribute('tabindex', tabIndexVal);
        
        // Append action buttons at the bottom
        card.appendChild(header);
        
        card.setAttribute('aria-label', `نتيجة رقم ${index + 1}`);
        card.setAttribute('role', 'option');

        return card;
    }

    let isFetching = false;

    
    // Infinite Scroll Implementation
    const scrollObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting && btnLoadMore && !btnLoadMore.classList.contains('hidden') && !btnLoadMore.disabled && !isFetching && hasMorePages) {
                btnLoadMore.click();
            }
        });
    }, { rootMargin: '200px' });
    if (btnLoadMore) scrollObserver.observe(btnLoadMore);

    btnLoadMore.addEventListener('click', async () => {
        // If we still have rendered results to show, just render them
        let filtered = currentResults;
        if (currentFilter === 'authentic') {
            filtered = currentResults.filter(item => {
                const info = (item.infoHtml || '');
                return info.includes('صحيح') && !info.includes('غير صحيح') && !info.includes('ليس بصحيح');
            });
        } else if (currentFilter === 'hasan') {
            filtered = currentResults.filter(item => {
                const info = (item.infoHtml || '');
                return info.includes('حسن') && !info.includes('ليس بحسن');
            });
        } else if (currentFilter === 'weak') {
            filtered = currentResults.filter(item => {
                const info = (item.infoHtml || '');
                return info.includes('ضعيف') || info.includes('منكر') || info.includes('موضوع') || info.includes('باطل');
            });
        }
        
        if (displayedCount < filtered.length) {
            renderResults(currentResults, resultsContainer, true);
        } else if (hasMorePages && !isFetching && currentSearchQuery && document.querySelector('input[name="searchSource"]:checked').value !== 'local_9books') {
            isFetching = true;
            const originalText = btnLoadMore.textContent;
            btnLoadMore.textContent = 'جاري التحميل...';
            btnLoadMore.disabled = true;
            
            currentPage++;
            await performFetch(currentSearchQuery, currentPage, true);
            
            btnLoadMore.textContent = originalText;
            btnLoadMore.disabled = false;
            isFetching = false;
        }
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
                const info = (item.infoHtml || '');
                return info.includes('صحيح') && !info.includes('غير صحيح') && !info.includes('ليس بصحيح');
            });
        } else if (currentFilter === 'hasan') {
            filtered = items.filter(item => {
                const info = (item.infoHtml || '');
                return info.includes('حسن') && !info.includes('ليس بحسن');
            });
        } else if (currentFilter === 'weak') {
            filtered = items.filter(item => {
                const info = (item.infoHtml || '');
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
            } else if (hasMorePages && document.querySelector('input[name="searchSource"]:checked').value !== 'local_9books') {
                btnLoadMore.classList.remove('hidden'); // Show button to trigger next page fetch
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
                        if (node.nodeType === 3 && node.textContent.trim() === '') return;
                        currentItem.appendChild(node.cloneNode(true));
                    } else {
                        newInfoDiv.appendChild(node.cloneNode(true));
                    }
                });
                processedInfo = newInfoDiv.outerHTML;
            }

            let walker = document.createTreeWalker(hadithElements[i], NodeFilter.SHOW_TEXT, null, false);
            let firstTextNode = walker.nextNode();
            while(firstTextNode) {
                if (firstTextNode.nodeValue.trim() !== '') {
                    firstTextNode.nodeValue = firstTextNode.nodeValue.replace(/^\s*\d+\s*-\s*/, '');
                    break;
                }
                firstTextNode = walker.nextNode();
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
    async function performFetch(query, page, append = false) {
        const searchSource = document.querySelector('input[name="searchSource"]:checked').value;

        if (!append) {
            loadingIndicator.classList.remove('hidden');
            resultsContainer.innerHTML = '';
            resultsSection.setAttribute('aria-busy', 'true');
        }

        try {
            let newResults = [];
            
                        if (searchSource === 'local_9books') {
                if (window.electronAPI && window.electronAPI.searchLocalDb) {
                    const localDataStr = await window.electronAPI.searchLocalDb(query, page);
                    const localData = JSON.parse(localDataStr);
                    newResults = localData.map(item => ({
                        hadithHtml: `<div class="hadith">${item.text}</div>`,
                        infoHtml: `<div class="hadith-info">
                            <span class="info-item"><span class="info-subtitle">المصدر:</span> <span class="info-value">${item.book}</span></span>
                            <span class="info-item"><span class="info-subtitle">خلاصة الحكم:</span> <span class="info-value">${item.authenticity}</span></span>
                        </div>`,
                        originalHtml: ""
                    }));
                } else if (window.pywebview && window.pywebview.api && window.pywebview.api.search_local_hadith) {
                    const localDataStr = await window.pywebview.api.search_local_hadith(query, page);
                    const localData = JSON.parse(localDataStr);
                    newResults = localData.map(item => ({
                        hadithHtml: `<div class="hadith">${item.text_ar}</div>`,
                        infoHtml: `<div class="hadith-info">
                            <span class="info-item"><span class="info-subtitle">المصدر:</span> <span class="info-value">${item.book}</span></span>
                            <span class="info-item"><span class="info-subtitle">خلاصة الحكم:</span> <span class="info-value">${item.authenticity}</span></span>
                        </div>`,
                        originalHtml: ""
                    }));
                }
                if (newResults.length < 20) hasMorePages = false;
                else hasMorePages = true;
            } else {
                let dorarData = null;

                // 1. Try to load from Local Cache ONLY for page 1
                if (page === 1 && window.pywebview && window.pywebview.api && window.pywebview.api.get_from_cache) {
                    try {
                        const cachedData = await window.pywebview.api.get_from_cache(query);
                        if (cachedData) {
                            dorarData = JSON.parse(cachedData);
                        }
                    } catch (e) { console.error("Cache error:", e); }
                }

                // 2. Fetch from internet if no cache or requesting page > 1
                if (!dorarData) {
                    if (!navigator.onLine) {
                        if (!append) {
                            loadingIndicator.classList.add('hidden');
                            resultsContainer.innerHTML = `<div class="error-message" role="alert">أنت غير متصل بالإنترنت ولم يتم العثور على نتيجة في الذاكرة المحلية.</div>`;
                        } else {
                            showToast("لا يمكن جلب المزيد بدون إنترنت.");
                        }
                        return;
                    }
                    
                    // Try Electron API first
                    if (window.electronAPI && window.electronAPI.fetchDorar) {
                        try {
                            const rawResponse = await window.electronAPI.fetchDorar(`https://dorar.net/dorar_api.json?skey=${encodeURIComponent(query)}&page=${page}`);
                            dorarData = JSON.parse(rawResponse);
                        } catch (e) { console.error("Electron API search failed", e); }
                    } else if (window.pywebview && window.pywebview.api && window.pywebview.api.search) {
                        try {
                            const rawResponse = await window.pywebview.api.search(query, page);
                            if (rawResponse) dorarData = JSON.parse(rawResponse);
                        } catch (e) { console.error("Pywebview API search failed", e); }
                    } 

                    // Fallback to Capacitor HTTP
                    if (!dorarData && window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.CapacitorHttp) {
                        try {
                            const options = {
                                url: `https://dorar.net/dorar_api.json`,
                                params: { skey: query, page: page.toString() },
                                headers: { 'User-Agent': 'DorarHadithApp Mobile' }
                            };
                            const response = await window.Capacitor.Plugins.CapacitorHttp.get(options);
                            dorarData = typeof response.data === 'string' ? JSON.parse(response.data) : response.data;
                        } catch (e) {
                            try {
                                const proxyUrl = `https://corsproxy.io/?${encodeURIComponent(`https://dorar.net/dorar_api.json?skey=${encodeURIComponent(query)}&page=${page}`)}`;
                                const proxyResponse = await window.Capacitor.Plugins.CapacitorHttp.get({ url: proxyUrl });
                                dorarData = typeof proxyResponse.data === 'string' ? JSON.parse(proxyResponse.data) : proxyResponse.data;
                            } catch (proxyError) { }
                        }
                    }
                    
                    if (!dorarData) {
                        try {
                            const proxyUrl = `https://corsproxy.io/?${encodeURIComponent(`https://dorar.net/dorar_api.json?skey=${encodeURIComponent(query)}&page=${page}`)}`;
                            const response = await fetch(proxyUrl);
                            dorarData = await response.json();
                        } catch (e) {
                            // If corsproxy fails, try JSONP as last resort
                            dorarData = await fetchDorarJSONP(query, page);
                        }
                    }

                    // 3. Save page 1 to Local Cache
                    if (page === 1 && dorarData && window.pywebview && window.pywebview.api && window.pywebview.api.save_to_cache) {
                        try {
                            window.pywebview.api.save_to_cache(query, JSON.stringify(dorarData));
                        } catch (e) {}
                    }
                }

                if (!dorarData || !dorarData.ahadith || !dorarData.ahadith.result) {
                    newResults = [];
                    hasMorePages = false;
                } else {
                    newResults = processDorarHTML(dorarData.ahadith.result);
                    
                    // Dorar API endpoint currently ignores pagination and returns identical results for page > 1.
                    // Prevent appending duplicate results if we receive the exact same first item.
                    if (append && newResults.length > 0 && currentResults.length > 0) {
                        if (newResults[0].hadithHtml === currentResults[0].hadithHtml) {
                            newResults = [];
                            showToast("لا توفر واجهة الدرر السنية نتائج إضافية لهذا البحث.", 4000);
                        }
                    }

                    if (newResults.length === 0) hasMorePages = false;
                    else hasMorePages = true;
                }
            }

            if (append) {
                if (newResults.length > 0) {
                    currentResults = currentResults.concat(newResults);
                    renderResults(currentResults, resultsContainer, true);
                } else {
                    btnLoadMore.classList.add('hidden'); // Hide load more if no new results
                }
            } else {
                currentResults = newResults;
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
            }
        } catch (err) {
            if (!append) {
                resultsContainer.innerHTML = `<div class="error-message" role="alert">عذراً، حدث خطأ أثناء جلب البيانات. تأكد من الاتصال بالإنترنت.</div>`;
            } else {
                showToast("حدث خطأ أثناء تحميل المزيد.");
                currentPage--; // Revert page number on failure
            }
            announce("حدث خطأ أثناء البحث. يرجى التحقق من اتصالك بالإنترنت.");
            
            if (window.electronAPI && window.electronAPI.logError) {
                window.electronAPI.logError(err.toString() + " | Stack: " + (err.stack || "No stack"));
            } else if (window.pywebview && window.pywebview.api && window.pywebview.api.log_error) {
                window.pywebview.api.log_error(err.toString() + " | Stack: " + (err.stack || "No stack"));
            }
        } finally {
            if (!append) loadingIndicator.classList.add('hidden');
        }
    }

    searchForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        searchHistoryContainer.classList.add('hidden');
        
        const query = searchInput.value.trim();
        if (!query) return;

        saveToHistory(query);
        
        currentPage = 1;
        currentSearchQuery = query;
        hasMorePages = true;
        
        await performFetch(query, currentPage, false);
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
    function fetchDorarJSONP(keyword, page = 1) {
        return new Promise((resolve, reject) => {
            const callbackName = 'dorar_cb_' + Math.round(100000 * Math.random());
            window[callbackName] = function(data) {
                delete window[callbackName];
                if (script.parentNode) document.body.removeChild(script);
                resolve(data);
            };
            
            const script = document.createElement('script');
            const targetUrl = `https://dorar.net/dorar_api.json?skey=${encodeURIComponent(keyword)}&page=${page}&callback=${callbackName}`;
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

        const cat = force ? categorySelectNotif.value : (settings ? settings.category : 'عشوائي');
        let keyword = '';
        if (cat === 'عشوائي') {
            const allKeys = Object.keys(categoryKeywords);
            const randomCat = allKeys[Math.floor(Math.random() * allKeys.length)];
            const words = categoryKeywords[randomCat];
            keyword = words[Math.floor(Math.random() * words.length)];
        } else {
            const words = categoryKeywords[cat] || ['صلاة'];
            keyword = words[Math.floor(Math.random() * words.length)];
        }

        try {
            let localDataStr = null;
            if (window.electronAPI && window.electronAPI.searchLocalDb) {
                localDataStr = await window.electronAPI.searchLocalDb(keyword, 1);
            } else if (window.pywebview && window.pywebview.api && window.pywebview.api.search_local_hadith) {
                localDataStr = await window.pywebview.api.search_local_hadith(keyword, 1);
            }

            if (localDataStr) {
                const ahadith = JSON.parse(localDataStr);
                if (ahadith && ahadith.length > 0) {
                    const randomHadith = ahadith[Math.floor(Math.random() * ahadith.length)];
                    const title = "إشعار الموسوعة الحديثية - " + (cat === 'عشوائي' ? 'حديث عشوائي' : cat);
                    const textContent = randomHadith.text_ar || randomHadith.text;
                    const body = `${textContent}

المصدر: ${randomHadith.book}
الحكم: ${randomHadith.authenticity}`;
                    
                    showInAppNotification(title, body);

                    if (window.electronAPI && window.electronAPI.showNotification) {
                        window.electronAPI.showNotification({ title: title, body: body });
                    } else if (window.pywebview && window.pywebview.api && window.pywebview.api.show_notification) {
                        window.pywebview.api.show_notification(title, body);
                    } else {
                        new Notification(title, { body: body });
                    }
                } else if (force) {
                    showInAppNotification("لم يتم العثور على نتائج", "لم نجد حديثاً مناسباً لهذا التصنيف في قاعدة البيانات.");
                }
            } else if (force) {
                showInAppNotification("خطأ", "لم نتمكن من الوصول لقاعدة البيانات المحلية.");
            }
        } catch (err) {
            if (force) {
                showInAppNotification("خطأ", "حدث خطأ أثناء محاولة جلب الإشعار.");
            }
        }
    }
    
        // Start by loading settings
    let initialized = false;
    
      function initApp() {
          if (window.Capacitor && window.Capacitor.isNativePlatform()) {
              const localRadio = document.querySelector('input[value="local_9books"]');
              if (localRadio) {
                  localRadio.parentElement.style.display = 'none';
                  document.querySelector('input[value="dorar"]').checked = true;
              }
          }

        if (initialized) return;
        initialized = true;
        loadAllSettings().then(() => {
            applyTheme(appSettings.theme, false);
            applyFontSize(appSettings.fontsize, false);
            renderFavorites();
            if (typeof updateHistoryDropdown === 'function') updateHistoryDropdown();
        });
    }

    if (window.electronAPI) {
        initApp();
    } else {
        window.addEventListener('pywebviewready', initApp);
        // Fallback for normal browser
        setTimeout(initApp, 800);
    }
});
