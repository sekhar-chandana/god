/* ====================================================
   SRI AMMAVARI UTSAVAM - CLIENT LOGIC & SERVER BINDINGS
   ==================================================== */

const API_BASE = 'https://god-4-cefe.onrender.com'; // Relative path, same host

const App = {
  // Session details
  token: localStorage.getItem('utsavam_token') || '',
  adminUser: null,
  activeAdminTab: 'donations-audit',
  activePage: 'home',

  // Countdown Date (Set to upcoming festival start date)
  festivalStartDate: new Date('2026-06-10T08:00:00+05:30').getTime(),

  async init() {
    this.bindEvents();
    this.initRouter();
    this.startCountdown();
    
    // Core feeds load
    await this.loadStats();
    await this.loadAnnouncements();
    await this.loadEvents();
    
    // Check session on load
    if (this.token) {
      await this.verifyAdminSession();
    }
  },

  // ----------------------------------------------------
  // ROUTING & SPA VIEW TOGGLES
  // ----------------------------------------------------
  initRouter() {
    const handleRoute = async () => {
      const hash = window.location.hash.replace('#', '') || 'home';
      this.activePage = hash;
      
      // Toggle active link
      document.querySelectorAll('.nav-link').forEach(link => {
        if (link.getAttribute('data-page') === hash) {
          link.classList.add('active');
        } else {
          link.classList.remove('active');
        }
      });

      // Toggle page visibility
      document.querySelectorAll('.app-page').forEach(page => {
        if (page.id === `page-${hash}`) {
          page.classList.add('active');
        } else {
          page.classList.remove('active');
        }
      });

      // Load target page content dynamically
      if (hash === 'donations') {
        await this.loadDonationsWall();
      } else if (hash === 'expenses') {
        await this.loadExpensesLedger();
      } else if (hash === 'events') {
        await this.loadEvents();
      } else if (hash === 'gallery') {
        await this.loadGallery();
      } else if (hash === 'admin') {
        this.renderAdminConsole();
      }
      
      // Smooth scroll to top of viewport
      window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    window.addEventListener('hashchange', handleRoute);
    handleRoute(); // Execute on initial load
  },

  bindEvents() {
    // Mobile navigation bar toggle
    const menuBtn = document.getElementById('mobile-menu-btn');
    const navBar = document.getElementById('app-nav');
    
    if (menuBtn && navBar) {
      menuBtn.addEventListener('click', () => {
        navBar.classList.toggle('active');
        menuBtn.classList.toggle('open');
      });
      
      // Close menu when clicking nav link
      navBar.querySelectorAll('.nav-link').forEach(link => {
        link.addEventListener('click', () => {
          navBar.classList.remove('active');
          menuBtn.classList.remove('open');
        });
      });
    }

    // Modal closures
    const closeBtns = ['close-scan-modal', 'close-blessings-modal', 'close-lightbox', 'blessings-close-btn'];
    closeBtns.forEach(id => {
      const btn = document.getElementById(id);
      if (btn) {
        btn.addEventListener('click', () => {
          document.querySelectorAll('.modal').forEach(m => m.classList.remove('active'));
        });
      }
    });

    // Close modal clicking outside
    document.querySelectorAll('.modal').forEach(m => {
      m.addEventListener('click', (e) => {
        if (e.target === m) {
          m.classList.remove('active');
        }
      });
    });

    // Scan offerings trigger modals
    const heroDonateBtn = document.getElementById('hero-donate-btn');
    const qrTriggerBtn = document.getElementById('trigger-scan-modal-btn');
    
    [heroDonateBtn, qrTriggerBtn].forEach(btn => {
      if (btn) {
        btn.addEventListener('click', () => this.openScanModal());
      }
    });

    // QR offering tabs switching
    const qrTabBtns = document.querySelectorAll('.qr-tab-btn');
    qrTabBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        qrTabBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        
        const target = btn.getAttribute('data-target');
        document.querySelectorAll('.qr-item').forEach(item => {
          if (item.id === target) {
            item.classList.add('active');
          } else {
            item.classList.remove('active');
          }
        });
      });
    });

    // Public donation submission form
    const pubDonationForm = document.getElementById('public-donation-form');
    if (pubDonationForm) {
      pubDonationForm.addEventListener('submit', (e) => this.handleDonationSubmit(e));
    }

    // Admin login form submit
    const adminLoginForm = document.getElementById('admin-login-form');
    if (adminLoginForm) {
      adminLoginForm.addEventListener('submit', (e) => this.handleAdminLogin(e));
    }

    // Admin tab navigation clicking
    document.querySelectorAll('.admin-menu-link').forEach(link => {
      link.addEventListener('click', (e) => {
        const tab = e.target.getAttribute('data-tab');
        this.switchAdminTab(tab);
      });
    });

    // Admin update payment codes details
    const adminQrForm = document.getElementById('admin-qr-form');
    if (adminQrForm) {
      adminQrForm.addEventListener('submit', (e) => this.handleQrConfigSubmit(e));
    }

    // Admin record expenses form submit
    const adminExpForm = document.getElementById('admin-expense-form');
    if (adminExpForm) {
      adminExpForm.addEventListener('submit', (e) => this.handleExpenseSubmit(e));
    }

    // Admin ritual schedule event submit
    const adminEvtForm = document.getElementById('admin-event-form');
    if (adminEvtForm) {
      adminEvtForm.addEventListener('submit', (e) => this.handleEventSubmit(e));
    }

    // Admin announce bulletin submit
    const adminAnnForm = document.getElementById('admin-announcement-form');
    if (adminAnnForm) {
      adminAnnForm.addEventListener('submit', (e) => this.handleAnnouncementSubmit(e));
    }

    // Admin gallery photo media submit
    const adminGalForm = document.getElementById('admin-gallery-form');
    if (adminGalForm) {
      adminGalForm.addEventListener('submit', (e) => this.handleGallerySubmit(e));
    }

    // Admin security profile submit
    const adminProfForm = document.getElementById('admin-profile-form');
    if (adminProfForm) {
      adminProfForm.addEventListener('submit', (e) => this.handleProfileSubmit(e));
    }

    // Admin logoff button click
    const logoutBtn = document.getElementById('admin-logout-btn');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', () => this.handleLogout());
    }
  },

  // ----------------------------------------------------
  // PUBLIC VIEW DATA API RETRIEVAL
  // ----------------------------------------------------

  // Real-time financial summary metrics updates
  async loadStats() {
    try {
      const res = await fetch(`${API_BASE}/api/stats`);
      const data = await res.json();
      
      const coll = data.totalCollected || 0;
      const spent = data.totalSpent || 0;
      const bal = data.remainingBalance || 0;
      const goal = data.goalAmount || 200000;
      const count = data.donationsCount || 0;

      // Update public view values
      const setVal = (id, str) => {
        const el = document.getElementById(id);
        if (el) el.textContent = str;
      };

      setVal('quick-total-donations', `₹${coll.toLocaleString('en-IN')}`);
      setVal('quick-total-expenses', `₹${spent.toLocaleString('en-IN')}`);
      setVal('quick-donors-count', count.toLocaleString('en-IN'));

      setVal('stats-collected', `₹${coll.toLocaleString('en-IN')}`);
      setVal('stats-goal', `₹${goal.toLocaleString('en-IN')}`);

      setVal('summary-collected', `₹${coll.toLocaleString('en-IN')}`);
      setVal('summary-spent', `₹${spent.toLocaleString('en-IN')}`);
      setVal('summary-balance', `₹${bal.toLocaleString('en-IN')}`);

      // Recompute Goal Progress Bar
      const percentage = Math.min(Math.round((coll / goal) * 100), 100);
      const bar = document.getElementById('goal-progress-bar');
      if (bar) bar.style.width = `${percentage}%`;
      
      setVal('goal-percentage-text', `${percentage}% of the Utsavam collection seva goal completed!`);

      return data;
    } catch (err) {
      console.error("Failed to load metrics statistics:", err);
    }
  },

  // Load latest announcements live marquee
  async loadAnnouncements() {
    try {
      const res = await fetch(`${API_BASE}/api/announcements`);
      const data = await res.json();
      
      const ticker = document.getElementById('announcement-text');
      if (ticker) {
        if (data.length > 0) {
          ticker.textContent = data.map(a => `🕉️ ${a.content}`).join('     |     ');
        } else {
          ticker.textContent = "Welcome to Sri Ammavari Utsavam Portal! Support our village grand festival seva offerings online.";
        }
      }
    } catch (err) {
      console.error("Failed to read announcements alerts:", err);
    }
  },

  // Load public wall of approved donations
  async loadDonationsWall() {
    const scroller = document.getElementById('donor-wall-scroller');
    if (!scroller) return;

    try {
      const res = await fetch(`${API_BASE}/api/donations`);
      const list = await res.json();

      if (list.length === 0) {
        scroller.innerHTML = `<div class="donor-slip"><div class="donor-info"><h4>Offering Sponsors Open</h4><p>Be the first to offer seva blessings.</p></div></div>`;
        return;
      }

      let html = '';
      list.forEach(d => {
        const timeAgo = this.formatTimeAgo(d.timestamp);
        html += `
          <div class="donor-slip">
            <div class="donor-info">
              <h4>${d.donorName}</h4>
              <p>${d.message ? `"${d.message}"` : 'Offering sincere festival prayers'}</p>
            </div>
            <div class="donor-slip-amount">
              <span class="amount-badge">₹${d.amount.toLocaleString('en-IN')}</span>
              <span class="time-ago">${timeAgo}</span>
            </div>
          </div>
        `;
      });

      // Double list contents for seamless loop infinite scroll
      if (list.length > 3) {
        scroller.innerHTML = html + html;
        scroller.style.animationPlayState = 'running';
      } else {
        scroller.innerHTML = html;
        scroller.style.animation = 'none'; // No need scrolling if elements fit
      }

      // Populate Top 5 Honor Ranks
      const stats = await this.loadStats();
      const topList = document.getElementById('top-donors-list');
      if (topList && stats && stats.topDonors) {
        if (stats.topDonors.length === 0) {
          topList.innerHTML = `<li class="text-center font-size-xs opacity-60">Sponsor rankings open.</li>`;
        } else {
          topList.innerHTML = stats.topDonors.map((td, index) => `
            <li class="top-donor-item">
              <div class="donor-rank-name">
                <span class="rank-number">${index + 1}</span>
                <span>${td.name}</span>
              </div>
              <span class="top-donor-sum">₹${td.totalAmount.toLocaleString('en-IN')}</span>
            </li>
          `).join('');
        }
      }

    } catch (err) {
      console.error("Failed to load wall of donors:", err);
      scroller.innerHTML = `<div class="empty-state text-center">Connection error fetching sponsor database.</div>`;
    }
  },

  // Load public budget expenditure transparency dashboards
  async loadExpensesLedger() {
    const tableBody = document.getElementById('expenses-table-body');
    if (!tableBody) return;

    try {
      const res = await fetch(`${API_BASE}/api/expenses`);
      const list = await res.json();
      
      const stats = await this.loadStats();

      // Populate itemized budget listings
      if (list.length === 0) {
        tableBody.innerHTML = `<tr><td colspan="5" class="text-center">No expenditure bills recorded yet. All funds transparently guarded in account.</td></tr>`;
      } else {
        tableBody.innerHTML = list.map(e => `
          <tr>
            <td><strong>${e.category}</strong></td>
            <td><span class="text-bold color-gold">₹${e.amount.toLocaleString('en-IN')}</span></td>
            <td>
              <strong>${e.title}</strong>
              <p style="font-size: 0.75rem; opacity: 0.8; margin-top: 2px;">${e.description || 'Standard procurement'}</p>
            </td>
            <td>${new Date(e.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</td>
            <td>
              ${e.receiptUrl ? `<button class="receipt-btn" onclick="App.openLightbox('${e.receiptUrl}', '${e.title}')">🔍 View Bill</button>` : `<span style="font-size: 0.7rem; opacity: 0.5;">No bill attached</span>`}
            </td>
          </tr>
        `).join('');
      }

      // Populate SVG Donut category breakdowns
      const legend = document.getElementById('chart-legend');
      const donutPercent = document.getElementById('chart-percent-spent');
      const donutSegment = document.getElementById('donut-segment-1');

      if (stats && legend) {
        const totalColl = stats.totalCollected || 1;
        const totalSpent = stats.totalSpent || 0;
        const percentSpent = Math.min(Math.round((totalSpent / totalColl) * 100), 100);
        
        if (donutPercent) donutPercent.textContent = `${percentSpent}%`;
        
        // Dynamic circular dash stroke computations
        if (donutSegment) {
          donutSegment.setAttribute('stroke-dasharray', `${percentSpent}, 100`);
        }

        // Group itemised categories sums
        const categories = {};
        list.forEach(e => {
          categories[e.category] = (categories[e.category] || 0) + e.amount;
        });

        const catColors = {
          'Annadanam': '#E67E22',
          'Decoration': '#F1C40F',
          'Cultural': '#9B59B6',
          'Procession': '#E74C3C',
          'Sound System': '#3498DB',
          'Other': '#95A5A6'
        };

        if (Object.keys(categories).length === 0) {
          legend.innerHTML = `<div class="text-center opacity-60">No itemized category weight calculations.</div>`;
        } else {
          legend.innerHTML = Object.keys(categories).map(cat => {
            const sum = categories[cat];
            const weight = Math.round((sum / (totalSpent || 1)) * 100);
            const color = catColors[cat] || '#D4AF37';
            return `
              <div class="legend-item">
                <div class="legend-color-label">
                  <span class="legend-dot" style="background-color: ${color}"></span>
                  <span>${cat}</span>
                </div>
                <span class="legend-val">₹${sum.toLocaleString('en-IN')} (${weight}%)</span>
              </div>
            `;
          }).join('');
        }
      }

    } catch (err) {
      console.error("Failed to load expenses transparency registry:", err);
      tableBody.innerHTML = `<tr><td colspan="5" class="text-center text-bold alert-error">Failed loading database files.</td></tr>`;
    }
  },

  // Load festival events ritual lists
  async loadEvents() {
    const timeline = document.getElementById('events-timeline');
    if (!timeline) return;

    try {
      const res = await fetch(`${API_BASE}/api/events`);
      const list = await res.json();

      if (list.length === 0) {
        timeline.innerHTML = `<div class="empty-state text-center glass">Ritual schedules are being finalized. Check back soon.</div>`;
        return;
      }

      // Check current calendar date and flag active node
      const todayStr = new Date().toISOString().split('T')[0];

      timeline.innerHTML = list.map(evt => {
        const isToday = evt.date === todayStr;
        const status = evt.status || 'upcoming';
        const displayStatus = isToday ? 'active' : status;
        
        let statusText = 'Upcoming';
        if (displayStatus === 'active') statusText = '⚡ Active Today';
        if (displayStatus === 'completed') statusText = '✓ Completed';

        const nodeClass = displayStatus === 'active' ? 'timeline-node active' : 'timeline-node';

        return `
          <div class="${nodeClass}">
            <div class="node-dot"></div>
            <div class="node-card">
              <div class="node-header">
                <h3>${evt.title}</h3>
                <span class="status-pill ${displayStatus}">${statusText}</span>
              </div>
              <span class="node-time-badge">🗓️ ${new Date(evt.date).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })} | ⏰ ${evt.time}</span>
              <p>${evt.description || 'Devotional rituals scheduled by temple priests.'}</p>
            </div>
          </div>
        `;
      }).join('');

    } catch (err) {
      console.error("Failed to retrieve schedule schedule:", err);
      timeline.innerHTML = `<div class="empty-state text-center alert-error">Database connection failed.</div>`;
    }
  },

  // Load masonry memory photo gallery
  async loadGallery() {
    const masonry = document.getElementById('gallery-masonry');
    if (!masonry) return;

    try {
      const res = await fetch(`${API_BASE}/api/gallery`);
      const list = await res.json();

      if (list.length === 0) {
        masonry.innerHTML = `<div class="empty-state text-center glass" style="grid-column: span 3">No memories uploaded yet. Past year highlights are coming.</div>`;
        return;
      }

      masonry.innerHTML = list.map(item => {
        if (item.type === 'video') {
          return `
            <div class="gallery-card" onclick="App.openLightbox('${item.mediaUrl}', '${item.title}')">
              <video src="${item.mediaUrl}" muted loop playsinline></video>
              <div class="video-play-indicator">🎬</div>
              <div class="gallery-card-overlay">
                <h4>${item.title}</h4>
                <span>🎥 Devotional Highlight Video</span>
              </div>
            </div>
          `;
        } else {
          return `
            <div class="gallery-card" onclick="App.openLightbox('${item.mediaUrl}', '${item.title}')">
              <img src="${item.mediaUrl}" alt="${item.title}" loading="lazy">
              <div class="gallery-card-overlay">
                <h4>${item.title}</h4>
                <span>📸 Holy Photo memory</span>
              </div>
            </div>
          `;
        }
      }).join('');

    } catch (err) {
      console.error("Failed to retrieve photos list:", err);
      masonry.innerHTML = `<div class="empty-state text-center alert-error" style="grid-column: span 3">Gallery files missing.</div>`;
    }
  },

  // ----------------------------------------------------
  // DYNAMIC RENDER POPUP DIALOGS
  // ----------------------------------------------------
  async openScanModal() {
    const modal = document.getElementById('scan-donate-modal');
    if (!modal) return;
    
    modal.classList.add('active');

    // Load active bank or UPI parameters dynamically
    try {
      const res = await fetch(`${API_BASE}/api/qr`);
      const codes = await res.json();

      const fillUpi = (prefix, data) => {
        const uVal = document.getElementById(`${prefix}-upi-val`);
        const pVal = document.getElementById(`${prefix}-phone-val`);
        const tabBtn = document.querySelector(`.qr-tab-btn[data-target="qr-${prefix}"]`);
        
        if (data && data.enabled) {
          if (uVal) uVal.textContent = data.upiId;
          if (pVal) pVal.textContent = data.phone;
          if (tabBtn) tabBtn.classList.remove('hidden');
        } else {
          if (tabBtn) tabBtn.classList.add('hidden');
        }
      };

      fillUpi('gpay', codes.gpay);
      fillUpi('phonepe', codes.phonepe);
      fillUpi('paytm', codes.paytm);

      // Fill bank
      const bank = codes.bank;
      const bTab = document.querySelector(`.qr-tab-btn[data-target="qr-bank"]`);
      if (bank && bank.enabled) {
        if (bTab) bTab.classList.remove('hidden');
        document.getElementById('bank-holder-val').textContent = bank.holderName;
        document.getElementById('bank-name-val').textContent = bank.name;
        document.getElementById('bank-account-val').textContent = bank.accountNumber;
        document.getElementById('bank-ifsc-val').textContent = bank.ifsc;
        document.getElementById('bank-branch-val').textContent = bank.branch;
      } else {
        if (bTab) bTab.classList.add('hidden');
      }

      // Default switch to first visible gateway tab
      const firstTab = document.querySelector('.qr-tab-btn:not(.hidden)');
      if (firstTab) firstTab.click();

    } catch (err) {
      console.error("Failed loading scanners:", err);
    }
  },

  openLightbox(filePath, captionText) {
    const lightbox = document.getElementById('receipt-lightbox');
    const img = document.getElementById('lightbox-img');
    const desc = document.getElementById('lightbox-desc');
    const title = document.getElementById('lightbox-title');

    if (!lightbox || !img) return;

    img.src = filePath;
    if (title) title.textContent = captionText || 'Temple Bill verification';
    if (desc) desc.textContent = `File path: ${filePath}`;
    
    lightbox.classList.add('active');
  },

  // ----------------------------------------------------
  // PUBLIC SPONSOR TRANSACTION SLIP SUBMIT Pipeline
  // ----------------------------------------------------
  async handleDonationSubmit(e) {
    e.preventDefault();
    const form = e.target;
    
    const name = document.getElementById('don-name').value;
    const phone = document.getElementById('don-phone').value;
    const amount = document.getElementById('don-amount').value;
    const msg = document.getElementById('don-msg').value;
    const screenshot = document.getElementById('don-screenshot').files[0];

    if (!name || !phone || !amount || !screenshot) {
      alert("Please fill in all details and upload your payment screenshot proof.");
      return;
    }

    const formData = new FormData();
    formData.append('donorName', name);
    formData.append('phone', phone);
    formData.append('amount', amount);
    formData.append('message', msg);
    formData.append('screenshot', screenshot);

    const submitBtn = form.querySelector('button[type="submit"]');
    const originalText = submitBtn.textContent;
    submitBtn.textContent = '🕊️ Transmitting divine slip...';
    submitBtn.disabled = true;

    try {
      const res = await fetch(`${API_BASE}/api/donations`, {
        method: 'POST',
        body: formData
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Submission failed");
      }

      // Success! Close Scan Offering Modal and Trigger Blessings Modal
      document.getElementById('scan-donate-modal').classList.remove('active');
      form.reset();
      
      const blessModal = document.getElementById('blessings-modal');
      if (blessModal) blessModal.classList.add('active');

      // Trigger spectacular Canvas Fireworks explosion inside client screen!
      if (window.AnimationEngine) {
        const midX = window.innerWidth / 2;
        const midY = window.innerHeight * 0.4;
        
        // Spawn multiple beautiful blasts
        window.AnimationEngine.triggerFirework(midX, midY);
        setTimeout(() => window.AnimationEngine.triggerFirework(midX - 150, midY - 60), 250);
        setTimeout(() => window.AnimationEngine.triggerFirework(midX + 150, midY - 60), 500);
        setTimeout(() => window.AnimationEngine.triggerFirework(midX, midY - 120), 800);
      }

      // Re-load statistics
      await this.loadStats();

    } catch (err) {
      alert(`Submission Error: ${err.message}`);
    } finally {
      submitBtn.textContent = originalText;
      submitBtn.disabled = false;
    }
  },

  // ----------------------------------------------------
  // ADMIN CONSOLE INTERFACE ENGINE (JWT CACHED SLIPS)
  // ----------------------------------------------------
  async verifyAdminSession() {
    try {
      const res = await fetch(`${API_BASE}/api/auth/verify`, {
        headers: { 'Authorization': `Bearer ${this.token}` }
      });
      const data = await res.json();

      if (res.ok && data.valid) {
        this.adminUser = data.user;
        const elName = document.getElementById('admin-display-name');
        if (elName) elName.textContent = data.user.name || 'Festival Administrator';
      } else {
        this.handleLogout(); // Cleans invalid tokens
      }
    } catch (err) {
      console.warn("Verify session connection failed, offline mode bypass.");
    }
  },

  renderAdminConsole() {
    const authCard = document.getElementById('admin-auth-card');
    const controlPanel = document.getElementById('admin-console-layout');

    if (!authCard || !controlPanel) return;

    if (this.token && this.adminUser) {
      authCard.classList.add('hidden');
      controlPanel.classList.remove('hidden');
      this.switchAdminTab(this.activeAdminTab);
    } else {
      authCard.classList.remove('hidden');
      controlPanel.classList.add('hidden');
    }
  },

  async handleAdminLogin(e) {
    e.preventDefault();
    const user = document.getElementById('username').value;
    const pass = document.getElementById('password').value;
    const errorBanner = document.getElementById('auth-error-banner');

    if (errorBanner) errorBanner.classList.add('hidden');

    try {
      const res = await fetch(`${API_BASE}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: user, password: pass })
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Credentials invalid.");
      }

      this.token = data.token;
      this.adminUser = data.user;
      localStorage.setItem('utsavam_token', this.token);
      
      const elName = document.getElementById('admin-display-name');
      if (elName) elName.textContent = data.user.name || 'Festival Administrator';

      this.renderAdminConsole();
    } catch (err) {
      if (errorBanner) {
        errorBanner.textContent = err.message;
        errorBanner.classList.remove('hidden');
      }
    }
  },

  handleLogout() {
    this.token = '';
    this.adminUser = null;
    localStorage.removeItem('utsavam_token');
    
    // Clear forms
    const loginForm = document.getElementById('admin-login-form');
    if (loginForm) loginForm.reset();

    this.renderAdminConsole();
  },

  switchAdminTab(tabName) {
    this.activeAdminTab = tabName;
    
    // Toggle sidebar link states
    document.querySelectorAll('.admin-menu-link').forEach(link => {
      if (link.getAttribute('data-tab') === tabName) {
        link.classList.add('active');
      } else {
        link.classList.remove('active');
      }
    });

    // Toggle Tab workspace panel visibility
    document.querySelectorAll('.admin-tab-content').forEach(tab => {
      if (tab.id === `tab-${tabName}`) {
        tab.classList.add('active');
      } else {
        tab.classList.remove('active');
      }
    });

    // Load active tab configurations
    if (tabName === 'donations-audit') {
      this.loadAuditDonations();
    } else if (tabName === 'qr-configs') {
      this.loadAuditQrSettings();
    } else if (tabName === 'expenses-audit') {
      this.loadAuditExpenses();
    } else if (tabName === 'events-audit') {
      this.loadAuditEvents();
    } else if (tabName === 'announcements-audit') {
      this.loadAuditAnnouncements();
    } else if (tabName === 'gallery-audit') {
      this.loadAuditGallery();
    }
  },

  // ----------------------------------------------------
  // ADMIN TAB FEED LOADERS & EVENT CONFIRMATIONS
  // ----------------------------------------------------

  // TAB A: Verify screenshots
  async loadAuditDonations() {
    const tableBody = document.getElementById('admin-donations-table-body');
    if (!tableBody) return;

    try {
      const res = await fetch(`${API_BASE}/api/admin/donations`, {
        headers: { 'Authorization': `Bearer ${this.token}` }
      });
      const data = await res.json();

      if (data.length === 0) {
        tableBody.innerHTML = `<tr><td colspan="7" class="text-center">No donation slips registered in database.</td></tr>`;
        return;
      }

      tableBody.innerHTML = data.map(d => {
        let statusBadge = `<span class="status-pill upcoming">Pending</span>`;
        if (d.status === 'approved') statusBadge = `<span class="status-pill completed">Approved</span>`;
        if (d.status === 'rejected') statusBadge = `<span class="status-pill danger" style="background: rgba(153,0,18,0.1); color:#ff6347; border: 1px solid #ff6347;">Rejected</span>`;

        let actionBtns = '';
        if (d.status === 'pending') {
          actionBtns = `
            <div class="admin-action-btn-group">
              <button class="btn btn-sm btn-success" onclick="App.auditDonationStatus('${d.id}', 'approved')">Approve</button>
              <button class="btn btn-sm btn-danger" onclick="App.auditDonationStatus('${d.id}', 'rejected')">Reject</button>
            </div>
          `;
        } else {
          // Allow rollback revert status
          actionBtns = `<button class="btn btn-sm btn-secondary" onclick="App.auditDonationStatus('${d.id}', 'pending')">Revert</button>`;
        }

        return `
          <tr>
            <td><strong>${d.donorName}</strong></td>
            <td>${d.phone}</td>
            <td><span class="amount-badge">₹${d.amount.toLocaleString('en-IN')}</span></td>
            <td><span style="font-size: 0.7rem; font-style: italic;">${d.message ? `"${d.message}"` : 'None'}</span></td>
            <td>
              ${d.screenshotUrl ? `<img class="admin-screenshot-thumb" src="${d.screenshotUrl}" onclick="App.openLightbox('${d.screenshotUrl}', '${d.donorName} Proof')" title="Inspect payment screenshot">` : '<span style="font-size:0.65rem; opacity:0.5;">No proof</span>'}
            </td>
            <td>${statusBadge}</td>
            <td>${actionBtns}</td>
          </tr>
        `;
      }).join('');

    } catch (err) {
      console.error(err);
      tableBody.innerHTML = `<tr><td colspan="7" class="text-center alert-error">Error fetching donations.</td></tr>`;
    }
  },

  async auditDonationStatus(id, newStatus) {
    try {
      const res = await fetch(`${API_BASE}/api/admin/donations/${id}/status`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.token}`
        },
        body: JSON.stringify({ status: newStatus })
      });
      const data = await res.json();

      if (!res.ok) throw new Error(data.error);

      // Trigger high fidelity screen explosions on donation approval to satisfy user delights!
      if (newStatus === 'approved' && window.AnimationEngine) {
        const x = window.innerWidth / 2;
        const y = window.innerHeight * 0.4;
        window.AnimationEngine.triggerFirework(x, y);
        setTimeout(() => window.AnimationEngine.triggerFirework(x - 120, y - 40), 200);
      }

      await this.loadAuditDonations();
      await this.loadStats();

    } catch (err) {
      alert(`Status verification failed: ${err.message}`);
    }
  },

  // TAB B: QR and banking setups
  async loadAuditQrSettings() {
    try {
      const res = await fetch(`${API_BASE}/api/qr`);
      const data = await res.json();

      document.getElementById('gpay-upi').value = data.gpay.upiId;
      document.getElementById('gpay-phone').value = data.gpay.phone;
      document.getElementById('gpay-enabled').checked = data.gpay.enabled;

      document.getElementById('phonepe-upi').value = data.phonepe.upiId;
      document.getElementById('phonepe-phone').value = data.phonepe.phone;
      document.getElementById('phonepe-enabled').checked = data.phonepe.enabled;

      document.getElementById('paytm-upi').value = data.paytm.upiId;
      document.getElementById('paytm-phone').value = data.paytm.phone;
      document.getElementById('paytm-enabled').checked = data.paytm.enabled;

      document.getElementById('bank-name').value = data.bank.name;
      document.getElementById('bank-holder').value = data.bank.holderName;
      document.getElementById('bank-account').value = data.bank.accountNumber;
      document.getElementById('bank-ifsc').value = data.bank.ifsc;
      document.getElementById('bank-enabled').checked = data.bank.enabled;

    } catch (err) {
      console.error(err);
    }
  },

  async handleQrConfigSubmit(e) {
    e.preventDefault();

    const payload = {
      gpay: {
        name: "Google Pay",
        upiId: document.getElementById('gpay-upi').value,
        phone: document.getElementById('gpay-phone').value,
        enabled: document.getElementById('gpay-enabled').checked
      },
      phonepe: {
        name: "PhonePe",
        upiId: document.getElementById('phonepe-upi').value,
        phone: document.getElementById('phonepe-phone').value,
        enabled: document.getElementById('phonepe-enabled').checked
      },
      paytm: {
        name: "Paytm",
        upiId: document.getElementById('paytm-upi').value,
        phone: document.getElementById('paytm-phone').value,
        enabled: document.getElementById('paytm-enabled').checked
      },
      bank: {
        name: document.getElementById('bank-name').value,
        holderName: document.getElementById('bank-holder').value,
        accountNumber: document.getElementById('bank-account').value,
        ifsc: document.getElementById('bank-ifsc').value,
        branch: "Grama Devatha Temple Branch",
        enabled: document.getElementById('bank-enabled').checked
      }
    };

    const submitBtn = e.target.querySelector('button[type="submit"]');
    submitBtn.disabled = true;

    try {
      const res = await fetch(`${API_BASE}/api/admin/qr`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.token}`
        },
        body: JSON.stringify(payload)
      });
      const data = await res.json();

      if (!res.ok) throw new Error(data.error);

      alert("QR Scan methods updated successfully!");
      await this.loadAuditQrSettings();
    } catch (err) {
      alert(`Save configurations failed: ${err.message}`);
    } finally {
      submitBtn.disabled = false;
    }
  },

  // TAB C: Add and edit transparent expenses records
  async loadAuditExpenses() {
    const listBody = document.getElementById('admin-expenses-list-body');
    if (!listBody) return;

    try {
      const res = await fetch(`${API_BASE}/api/expenses`);
      const list = await res.json();

      if (list.length === 0) {
        listBody.innerHTML = `<tr><td colspan="6" class="text-center">No bills registered.</td></tr>`;
        return;
      }

      listBody.innerHTML = list.map(e => `
        <tr>
          <td><strong>${e.title}</strong></td>
          <td>${e.category}</td>
          <td><span class="amount-badge">₹${e.amount.toLocaleString('en-IN')}</span></td>
          <td>${e.date}</td>
          <td>
            ${e.receiptUrl ? `<button class="receipt-btn" onclick="App.openLightbox('${e.receiptUrl}', '${e.title}')">Inspect Bill</button>` : 'None'}
          </td>
          <td>
            <button class="btn btn-sm btn-danger" onclick="App.deleteExpense('${e.id}')">Delete</button>
          </td>
        </tr>
      `).join('');

    } catch (err) {
      console.error(err);
    }
  },

  async handleExpenseSubmit(e) {
    e.preventDefault();
    const form = e.target;
    
    const title = document.getElementById('exp-title').value;
    const amount = document.getElementById('exp-amount').value;
    const cat = document.getElementById('exp-category').value;
    const date = document.getElementById('exp-date').value;
    const desc = document.getElementById('exp-desc').value;
    const file = document.getElementById('exp-receipt').files[0];

    const formData = new FormData();
    formData.append('title', title);
    formData.append('amount', amount);
    formData.append('category', cat);
    formData.append('date', date);
    formData.append('description', desc);
    if (file) formData.append('receipt', file);

    const submitBtn = form.querySelector('button[type="submit"]');
    submitBtn.disabled = true;

    try {
      const res = await fetch(`${API_BASE}/api/admin/expenses`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${this.token}` },
        body: formData
      });
      const data = await res.json();

      if (!res.ok) throw new Error(data.error);

      alert("Transparency Bill recorded successfully!");
      form.reset();
      await this.loadAuditExpenses();
      await this.loadStats();

    } catch (err) {
      alert(`Save failed: ${err.message}`);
    } finally {
      submitBtn.disabled = false;
    }
  },

  async deleteExpense(id) {
    if (!confirm("Are you sure you wish to delete this transparent expenditure receipt permanently? This recalculates all summaries.")) return;

    try {
      const res = await fetch(`${API_BASE}/api/admin/expenses/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${this.token}` }
      });
      const data = await res.json();

      if (!res.ok) throw new Error(data.error);

      await this.loadAuditExpenses();
      await this.loadStats();

    } catch (err) {
      alert(`Deletion failed: ${err.message}`);
    }
  },

  // TAB D: Ritual timelines schedule
  async loadAuditEvents() {
    const listBody = document.getElementById('admin-events-list-body');
    if (!listBody) return;

    try {
      const res = await fetch(`${API_BASE}/api/events`);
      const list = await res.json();

      if (list.length === 0) {
        listBody.innerHTML = `<tr><td colspan="4" class="text-center">No schedule events programmed.</td></tr>`;
        return;
      }

      listBody.innerHTML = list.map(evt => {
        let toggleBtn = `<button class="btn btn-sm btn-success" onclick="App.toggleEventStatus('${evt.id}', 'completed')">Set Done</button>`;
        if (evt.status === 'completed') {
          toggleBtn = `<button class="btn btn-sm btn-secondary" onclick="App.toggleEventStatus('${evt.id}', 'upcoming')">Set Upcoming</button>`;
        }

        return `
          <tr>
            <td>
              <strong>${evt.title}</strong>
              <p style="font-size:0.65rem; opacity:0.8;">${evt.description || 'Standard ritual'}</p>
            </td>
            <td>🗓️ ${evt.date} | ⏰ ${evt.time}</td>
            <td><span class="status-pill ${evt.status || 'upcoming'}">${evt.status || 'upcoming'}</span></td>
            <td>
              <div class="admin-action-btn-group">
                ${toggleBtn}
                <button class="btn btn-sm btn-danger" onclick="App.deleteEvent('${evt.id}')">Delete</button>
              </div>
            </td>
          </tr>
        `;
      }).join('');

    } catch (err) {
      console.error(err);
    }
  },

  async handleEventSubmit(e) {
    e.preventDefault();
    const form = e.target;
    
    const payload = {
      title: document.getElementById('evt-title').value,
      date: document.getElementById('evt-date').value,
      time: document.getElementById('evt-time').value,
      description: document.getElementById('evt-desc').value
    };

    const submitBtn = form.querySelector('button[type="submit"]');
    submitBtn.disabled = true;

    try {
      const res = await fetch(`${API_BASE}/api/admin/events`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.token}`
        },
        body: JSON.stringify(payload)
      });
      const data = await res.json();

      if (!res.ok) throw new Error(data.error);

      form.reset();
      await this.loadAuditEvents();

    } catch (err) {
      alert(`Event schedule save failed: ${err.message}`);
    } finally {
      submitBtn.disabled = false;
    }
  },

  async toggleEventStatus(id, statusStr) {
    try {
      const res = await fetch(`${API_BASE}/api/admin/events/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.token}`
        },
        body: JSON.stringify({ status: statusStr })
      });
      const data = await res.json();

      if (!res.ok) throw new Error(data.error);

      await this.loadAuditEvents();

    } catch (err) {
      alert(`Event status toggle failed: ${err.message}`);
    }
  },

  async deleteEvent(id) {
    if (!confirm("Remove this event from the timeline?")) return;

    try {
      const res = await fetch(`${API_BASE}/api/admin/events/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${this.token}` }
      });
      const data = await res.json();

      if (!res.ok) throw new Error(data.error);

      await this.loadAuditEvents();

    } catch (err) {
      alert(`Delete event schedule failed: ${err.message}`);
    }
  },

  // TAB E: Announcements broadsheets
  async loadAuditAnnouncements() {
    const listBody = document.getElementById('admin-announcements-list-body');
    if (!listBody) return;

    try {
      const res = await fetch(`${API_BASE}/api/announcements`);
      const list = await res.json();

      if (list.length === 0) {
        listBody.innerHTML = `<tr><td colspan="3" class="text-center">No announcements published. Ticker uses fallback guidelines.</td></tr>`;
        return;
      }

      listBody.innerHTML = list.map(a => `
        <tr>
          <td>${a.content}</td>
          <td>${new Date(a.timestamp).toLocaleString()}</td>
          <td>
            <button class="btn btn-sm btn-danger" onclick="App.deleteAnnouncement('${a.id}')">Delete</button>
          </td>
        </tr>
      `).join('');

    } catch (err) {
      console.error(err);
    }
  },

  async handleAnnouncementSubmit(e) {
    e.preventDefault();
    const form = e.target;
    
    const text = document.getElementById('ann-content').value;

    const submitBtn = form.querySelector('button[type="submit"]');
    submitBtn.disabled = true;

    try {
      const res = await fetch(`${API_BASE}/api/admin/announcements`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.token}`
        },
        body: JSON.stringify({ content: text })
      });
      const data = await res.json();

      if (!res.ok) throw new Error(data.error);

      form.reset();
      await this.loadAuditAnnouncements();
      await this.loadAnnouncements();

    } catch (err) {
      alert(`Broadcast failed: ${err.message}`);
    } finally {
      submitBtn.disabled = false;
    }
  },

  async deleteAnnouncement(id) {
    try {
      const res = await fetch(`${API_BASE}/api/admin/announcements/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${this.token}` }
      });
      const data = await res.json();

      if (!res.ok) throw new Error(data.error);

      await this.loadAuditAnnouncements();
      await this.loadAnnouncements();

    } catch (err) {
      alert(`Announcement deletion failed: ${err.message}`);
    }
  },

  // TAB F: Gallery photo files CRUD
  async loadAuditGallery() {
    const wrapper = document.getElementById('admin-gallery-list-body');
    if (!wrapper) return;

    try {
      const res = await fetch(`${API_BASE}/api/gallery`);
      const list = await res.json();

      if (list.length === 0) {
        wrapper.innerHTML = `<div class="text-center opacity-60 full-width-card">No gallery media files in index.</div>`;
        return;
      }

      wrapper.innerHTML = list.map(item => `
        <div class="form-card-glass" style="display: flex; gap:12px; align-items:center;">
          ${item.type === 'video' ? `<video src="${item.mediaUrl}" style="width:50px; height:50px; object-fit:cover;" muted></video>` : `<img src="${item.mediaUrl}" style="width:50px; height:50px; object-fit:cover; border-radius:4px;">`}
          <div style="flex:1; overflow:hidden;">
            <h5 style="white-space:nowrap; text-overflow:ellipsis; overflow:hidden; font-size:0.8rem; margin:0;">${item.title}</h5>
            <span style="font-size:0.6rem; color:var(--accent-saffron); text-transform:uppercase;">${item.type}</span>
          </div>
          <button class="btn btn-sm btn-danger" onclick="App.deleteGallery('${item.id}')">Delete</button>
        </div>
      `).join('');

    } catch (err) {
      console.error(err);
    }
  },

  async handleGallerySubmit(e) {
    e.preventDefault();
    const form = e.target;
    
    const title = document.getElementById('gal-title').value;
    const file = document.getElementById('gal-file').files[0];

    const formData = new FormData();
    formData.append('title', title);
    formData.append('media', file);

    const submitBtn = form.querySelector('button[type="submit"]');
    submitBtn.disabled = true;

    try {
      const res = await fetch(`${API_BASE}/api/admin/gallery`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${this.token}` },
        body: formData
      });
      const data = await res.json();

      if (!res.ok) throw new Error(data.error);

      form.reset();
      await this.loadAuditGallery();
      
      // Update gallery if currently on gallery page
      if (this.activePage === 'gallery') await this.loadGallery();

    } catch (err) {
      alert(`Gallery media upload failed: ${err.message}`);
    } finally {
      submitBtn.disabled = false;
    }
  },

  async deleteGallery(id) {
    if (!confirm("Permanently delete this photo memory from the public gallery?")) return;

    try {
      const res = await fetch(`${API_BASE}/api/admin/gallery/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${this.token}` }
      });
      const data = await res.json();

      if (!res.ok) throw new Error(data.error);

      await this.loadAuditGallery();
      
      // Refresh public view
      if (this.activePage === 'gallery') await this.loadGallery();

    } catch (err) {
      alert(`Remove media failed: ${err.message}`);
    }
  },

  // TAB G: Profile admin updates
  async handleProfileSubmit(e) {
    e.preventDefault();
    const form = e.target;
    
    const name = document.getElementById('prof-name').value;
    const pass = document.getElementById('prof-pass').value;

    const payload = {};
    if (name) payload.name = name;
    if (pass) payload.newPassword = pass;

    if (Object.keys(payload).length === 0) {
      alert("Please supply updates to update security profiles.");
      return;
    }

    const submitBtn = form.querySelector('button[type="submit"]');
    submitBtn.disabled = true;

    try {
      const res = await fetch(`${API_BASE}/api/admin/profile`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.token}`
        },
        body: JSON.stringify(payload)
      });
      const data = await res.json();

      if (!res.ok) throw new Error(data.error);

      alert("Admin credentials updated successfully!");
      form.reset();
      
      if (data.user) {
        this.adminUser = data.user;
        const elName = document.getElementById('admin-display-name');
        if (elName) elName.textContent = data.user.name || 'Festival Administrator';
      }
    } catch (err) {
      alert(`Profile modify failed: ${err.message}`);
    } finally {
      submitBtn.disabled = false;
    }
  },

  // ----------------------------------------------------
  // HELPER UTILITIES: TEMPLE CALENDARS COUNTDOWN & TIME
  // ----------------------------------------------------
  startCountdown() {
    const updateCountdown = () => {
      const now = new Date().getTime();
      const distance = this.festivalStartDate - now;

      const setVal = (id, val) => {
        const el = document.getElementById(id);
        if (el) el.textContent = val.toString().padStart(2, '0');
      };

      if (distance < 0) {
        setVal('days', 0);
        setVal('hours', 0);
        setVal('minutes', 0);
        setVal('seconds', 0);
        
        const countHeader = document.querySelector('.countdown-card h3');
        if (countHeader) countHeader.innerHTML = "✨ 🛕 The Holy Utsavam Festival has Begun! 🔱 ✨";
        return;
      }

      const days = Math.floor(distance / (1000 * 60 * 60 * 24));
      const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((distance % (1000 * 60)) / 1000);

      setVal('days', days);
      setVal('hours', hours);
      setVal('minutes', minutes);
      setVal('seconds', seconds);
    };

    updateCountdown();
    setInterval(updateCountdown, 1000);
  },

  formatTimeAgo(isoString) {
    const date = new Date(isoString);
    const seconds = Math.floor((new Date() - date) / 1000);
    
    let interval = Math.floor(seconds / 31536000);
    if (interval >= 1) return `${interval}y ago`;
    
    interval = Math.floor(seconds / 2592000);
    if (interval >= 1) return `${interval}mo ago`;
    
    interval = Math.floor(seconds / 86400);
    if (interval >= 1) return `${interval}d ago`;
    
    interval = Math.floor(seconds / 3600);
    if (interval >= 1) return `${interval}h ago`;
    
    interval = Math.floor(seconds / 60);
    if (interval >= 1) return `${interval}m ago`;
    
    return "just now";
  }
};

// Bind to window for global inline clicks calling
window.App = App;

// Bootstrap SPA
document.addEventListener('DOMContentLoaded', () => {
  App.init();
});
