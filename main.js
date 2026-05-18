// JavaScript for the dropdown menus and campus map
const userDropdown = document.getElementById('userDropdown');
const dropdownMenu = document.getElementById('dropdownMenu');

let hoverTimeout;

if (userDropdown && dropdownMenu) {
    userDropdown.addEventListener('mouseenter', () => {
        clearTimeout(hoverTimeout);
        dropdownMenu.classList.add('show');
    });

    userDropdown.addEventListener('mouseleave', () => {
        hoverTimeout = setTimeout(() => {
            dropdownMenu.classList.remove('show');
        }, 300);
    });
}

const toolDropdown = document.getElementById('toolDropdown');
const toolMenu = document.getElementById('toolDropdownMenu');

let toolTimeout;

if (toolDropdown && toolMenu) {
    toolDropdown.addEventListener('mouseenter', () => {
        clearTimeout(toolTimeout);
        toolMenu.classList.add('show');
    });

    toolDropdown.addEventListener('mouseleave', () => {
        toolTimeout = setTimeout(() => {
            toolMenu.classList.remove('show');
        }, 300);
    });
}

const campusMap = document.getElementById("campusMap");

const campusLocations = {
    main: "14.1120879,121.5614933",
    lucena: "13.9486066,121.6295241",
    gumaca: "13.9228116,122.1012285",
    alabat: "14.0991669,122.0129519",
    catanauan: "13.568023,122.3430143",
    polillo: "14.7216832,121.9383093",
    infanta: "14.7136875,121.6207669",
    tagkawayan: "13.9571693,122.5436085",
    tiaong: "13.9470652,121.3695996"
};

// ===========================
// SHARED INFO WINDOW
// ===========================

/**
 * One InfoWindow instance reused across all feature clicks.
 * Initialized lazily once Google Maps is ready.
 */
window.sharedInfoWindow = null;

function getSharedInfoWindow() {
    if (!window.sharedInfoWindow && typeof google !== "undefined") {
        window.sharedInfoWindow = new google.maps.InfoWindow();
    }
    return window.sharedInfoWindow;
}

/**
 * Build the HTML content shown inside the InfoWindow.
 *
 * Priority fields checked for the building/feature name:
 *   name → bldg_name → building_name → campus_nam → (Unnamed Feature)
 *
 * All remaining non-null properties are listed below the title so you
 * always see whatever metadata lives in your GeoJSON.
 */
function buildInfoWindowContent(feature) {
    // --- resolve a display name ---
    const nameFields = ['name', 'bldg_name', 'building_name', 'campus_nam', 'BLDG_NAME', 'NAME'];
    let title = 'Unnamed Feature';
    for (const field of nameFields) {
        const val = feature.getProperty(field);
        if (val) { title = val; break; }
    }

    // --- collect extra properties ---
    const skipFields = new Set(nameFields);
    const rows = [];
    feature.forEachProperty((value, key) => {
        if (!skipFields.has(key) && value !== null && value !== undefined && value !== '') {
            // Prettify the key: replace underscores/hyphens with spaces, title-case
            const label = key.replace(/[_-]/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
            rows.push(`
                <tr>
                    <td style="font-weight:600;padding:3px 8px 3px 0;white-space:nowrap;color:#4a4a4a;">${label}</td>
                    <td style="padding:3px 0;color:#222;">${value}</td>
                </tr>`);
        }
    });

    const tableHTML = rows.length
        ? `<table style="border-collapse:collapse;font-size:12px;margin-top:6px;width:100%;">${rows.join('')}</table>`
        : '';

    return `
        <div style="
            font-family: 'Segoe UI', Arial, sans-serif;
            min-width: 180px;
            max-width: 280px;
        ">
            <div style="
                background: #2f6b2f;
                color: #fff;
                font-size: 14px;
                font-weight: 700;
                padding: 8px 12px;
                border-radius: 4px 4px 0 0;
                margin: -8px -12px 8px -12px;
                letter-spacing: 0.3px;
            ">${title}</div>
            ${tableHTML}
        </div>`;
}

// ===========================
// CAMPUS POLYGON HELPERS
// ===========================
window.campusLayer = null;

window.CAMPUS_NAME_FIELD = "campus_nam";

window.CAMPUS_KEY_TO_NAME = {
    main: "SLSU Lucban",
    lucena: "SLSU Lucena",
    gumaca: "SLSU Gumaca",
    alabat: "SLSU Alabat",
    catanauan: "SLSU Catanauan",
    polillo: "SLSU Polillo",
    infanta: "SLSU Infanta",
    tagkawayan: "SLSU Tagkawayan",
    tiaong: "SLSU Tiaong"
};

window.loadCampusLayer = function () {
    if (typeof google === "undefined" || typeof gMap === "undefined" || !gMap) return;
    if (window.campusLayer) return;

    window.campusLayer = new google.maps.Data();
    window.campusLayer.setMap(gMap);

    fetch('/data/geojson/slsu_campus.geojson')
        .then(res => {
            if (!res.ok) throw new Error('slsu_campus.geojson not found');
            return res.json();
        })
        .then(data => {
            window.campusLayer.addGeoJson(data);

            window.campusLayer.setStyle({
                fillColor: '#6b8e23',
                fillOpacity: 0.20,
                strokeColor: '#2f4f2f',
                strokeWeight: 2,
                cursor: 'pointer'
            });

            // ── Click: show campus info window ──────────────────────────
            window.campusLayer.addListener('click', function (event) {
                const infoWindow = getSharedInfoWindow();
                if (!infoWindow) return;

                infoWindow.setContent(buildInfoWindowContent(event.feature));
                infoWindow.setPosition(event.latLng);
                infoWindow.open(gMap);
            });

            // ── Hover highlight ──────────────────────────────────────────
            window.campusLayer.addListener('mouseover', function (event) {
                window.campusLayer.overrideStyle(event.feature, {
                    fillOpacity: 0.35,
                    strokeWeight: 3
                });
            });

            window.campusLayer.addListener('mouseout', function (event) {
                window.campusLayer.revertStyle(event.feature);
            });
        })
        .catch(err => console.error('Campus layer loading error:', err));
};

window.zoomToCampusPolygon = function (campusKey) {
    if (!window.campusLayer || typeof google === "undefined" || typeof gMap === "undefined" || !gMap) return;

    const targetName = window.CAMPUS_KEY_TO_NAME[campusKey];
    if (!targetName) return;

    const bounds = new google.maps.LatLngBounds();
    let found = false;

    window.campusLayer.forEach(feature => {
        if (feature.getProperty(window.CAMPUS_NAME_FIELD) === targetName) {
            found = true;
            feature.getGeometry().forEachLatLng(latlng => {
                bounds.extend(latlng);
            });
        }
    });

    if (found) {
        gMap.fitBounds(bounds);

        window.campusLayer.setStyle(feature => {
            const isSelected = feature.getProperty(window.CAMPUS_NAME_FIELD) === targetName;
            return {
                fillColor: isSelected ? '#2e8b57' : '#6b8e23',
                fillOpacity: isSelected ? 0.40 : 0.20,
                strokeColor: isSelected ? '#145a32' : '#2f4f2f',
                strokeWeight: isSelected ? 3 : 2,
                cursor: 'pointer'
            };
        });
    }
};

// ===========================
// BUILDINGS LAYER
// ===========================

/**
 * Loads individual building polygons from a separate GeoJSON file and
 * attaches the same click-to-identify behaviour.
 *
 * Call this from your map initialisation (index.html) after the map is ready:
 *   window.loadBuildingsLayer();
 *
 * Expects a GeoJSON file at:  /data/geojson/slsu_buildings.geojson
 * Each feature should have at least a "name" or "bldg_name" property.
 */
window.buildingsLayer = null;

window.loadBuildingsLayer = function () {
    if (typeof google === "undefined" || typeof gMap === "undefined" || !gMap) return;
    if (window.buildingsLayer) return;

    window.buildingsLayer = new google.maps.Data();
    window.buildingsLayer.setMap(gMap);

    fetch('/data/geojson/slsu_buildings.geojson')
        .then(res => {
            if (!res.ok) throw new Error('slsu_buildings.geojson not found');
            return res.json();
        })
        .then(data => {
            window.buildingsLayer.addGeoJson(data);

            window.buildingsLayer.setStyle({
                fillColor: '#c8a95e',
                fillOpacity: 0.55,
                strokeColor: '#7a5c1e',
                strokeWeight: 1.5,
                cursor: 'pointer'
            });

            // ── Click: identify building ─────────────────────────────────
            window.buildingsLayer.addListener('click', function (event) {
                const infoWindow = getSharedInfoWindow();
                if (!infoWindow) return;

                infoWindow.setContent(buildInfoWindowContent(event.feature));
                infoWindow.setPosition(event.latLng);
                infoWindow.open(gMap);
            });

            // ── Hover highlight ──────────────────────────────────────────
            window.buildingsLayer.addListener('mouseover', function (event) {
                window.buildingsLayer.overrideStyle(event.feature, {
                    fillColor: '#e8c97e',
                    fillOpacity: 0.85,
                    strokeWeight: 2.5
                });
            });

            window.buildingsLayer.addListener('mouseout', function (event) {
                window.buildingsLayer.revertStyle(event.feature);
            });
        })
        .catch(err => console.warn('Buildings layer not loaded (optional):', err));
};

// handled by Google Maps JS API in index.html
function goToCampus(campus) {
    if (typeof window.goToCampus === "function") {
        window.goToCampus(campus);
    }
}

const toggleButton = document.getElementById('conditionsToggle');
const content = document.getElementById('conditionsContent');
const arrowIcon = document.getElementById('arrowIcon');

if (toggleButton && content && arrowIcon) {
    toggleButton.addEventListener('click', () => {
        content.classList.toggle('show');
        arrowIcon.classList.toggle('rotate');
    });
}

// Menu Toggle Button (replaces hamburger)
const menuToggleBtn = document.getElementById('menuToggleBtn');
const menuCheckbox = document.getElementById('menuToggle');
const slideMenu = document.querySelector('.slide');

if (menuToggleBtn && menuCheckbox && slideMenu) {
    menuToggleBtn.addEventListener('click', () => {
        menuCheckbox.checked = !menuCheckbox.checked;

        if (menuCheckbox.checked) {
            const slideWidth = slideMenu.offsetWidth;
            menuToggleBtn.style.left = slideWidth + 'px';
            menuToggleBtn.textContent = 'Close Menu';
        } else {
            menuToggleBtn.style.left = '0px';
            menuToggleBtn.textContent = 'Open Menu';
        }
    });
}

// Side Panel Toggle functionality with Icon Movement
const btn = document.getElementById('toggleSidePanelBtn');
const panel = document.querySelector('.side-panel');
const mapContainer = document.querySelector('.map-container');

if (btn && panel && mapContainer) {
    btn.addEventListener('click', () => {
        panel.classList.toggle('closed');

        if (userDropdown) userDropdown.classList.toggle('panel-closed');
        if (toolDropdown) toolDropdown.classList.toggle('panel-closed');

        if (panel.classList.contains('closed')) {
            btn.style.right = '10px';
            btn.textContent = 'Open Panel';
            mapContainer.style.width = '100%';
            mapContainer.style.right = '0';
        } else {
            const panelWidth = panel.offsetWidth;
            btn.style.right = panelWidth + 'px';
            btn.textContent = 'Close Panel';
            mapContainer.style.width = `calc(100% - ${panelWidth}px)`;
            mapContainer.style.right = panelWidth + 'px';
        }

        setTimeout(() => {
            if (typeof google !== 'undefined' && typeof gMap !== 'undefined') {
                google.maps.event.trigger(gMap, 'resize');
            }
        }, 300);
    });
}

// ===========================
// CHECKLIST LAYER TOGGLES
// ===========================
document.addEventListener('DOMContentLoaded', function () {
    const layerCheckboxes = document.querySelectorAll('.layer-checkbox');

    layerCheckboxes.forEach(function (checkbox) {
        checkbox.addEventListener('change', function () {
            const layer = this.getAttribute('data-layer');
            const isChecked = this.checked;
            console.log('Layer "' + layer + '" is now ' + (isChecked ? 'ON' : 'OFF'));
        });
    });
});

// ===========================
// NEWSLETTER SUBSCRIBE
// ===========================
function submitNewsletter(event) {
    event.preventDefault();

    const emailInput = document.getElementById('nl-email');
    const btn        = document.getElementById('nl-btn');
    const success    = document.getElementById('nl-success');

    if (!emailInput || !btn || !success) return;

    const email = emailInput.value.trim();
    if (!email) return;

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        emailInput.style.borderColor = '#e74c3c';
        emailInput.focus();
        return;
    }
    emailInput.style.borderColor = '';

    btn.disabled = true;
    btn.textContent = 'Subscribing…';

    // Prevent duplicates
    db.collection('newsletter_subscribers')
        .where('email', '==', email)
        .get()
        .then(snapshot => {
            if (!snapshot.empty) {
                // Already subscribed — show success silently
                success.style.display = 'block';
                emailInput.value = '';
                btn.disabled = false;
                btn.innerHTML = `Subscribe <svg viewBox="0 0 24 24"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>`;
                return Promise.resolve();
            }
            // Save — field names match what admin.html reads (email + subscribedAt)
            return db.collection('newsletter_subscribers').add({
                email:        email,
                subscribedAt: firebase.firestore.FieldValue.serverTimestamp()
            });
        })
        .then(() => {
            success.style.display = 'block';
            emailInput.value = '';
            btn.disabled = false;
            btn.innerHTML = `Subscribe <svg viewBox="0 0 24 24"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>`;
        })
        .catch(err => {
            console.error('Newsletter subscribe error:', err);
            btn.disabled = false;
            btn.textContent = 'Try Again';
        });
}

// ===========================
// INQUIRY CATEGORY TABS
// ===========================
document.addEventListener('DOMContentLoaded', function () {
    const catBtns = document.querySelectorAll('.cat-btn');
    catBtns.forEach(function (btn) {
        btn.addEventListener('click', function () {
            catBtns.forEach(b => b.classList.remove('active'));
            this.classList.add('active');
        });
    });
});

// ===========================
// INQUIRY FORM SUBMIT
// ===========================
document.addEventListener('DOMContentLoaded', function () {
    const submitBtn = document.getElementById('iq-submit');
    if (!submitBtn) return;

    submitBtn.addEventListener('click', function () {
        const firstName = (document.getElementById('iq-firstname')?.value || '').trim();
        const lastName  = (document.getElementById('iq-lastname')?.value  || '').trim();
        const email     = (document.getElementById('iq-email')?.value     || '').trim();
        const phone     = (document.getElementById('iq-phone')?.value     || '').trim();
        const relation  = (document.getElementById('iq-relation')?.value  || '').trim();
        const gradeLevel = (document.getElementById('iq-level')?.value    || '').trim();
        const subject   = (document.getElementById('iq-subject')?.value   || '').trim();
        const message   = (document.getElementById('iq-message')?.value   || '').trim();

        // Get active category tab
        const activeCat = document.querySelector('.cat-btn.active');
        const category  = activeCat ? activeCat.textContent.trim() : 'Other';

        // Validation
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!firstName || !lastName || !email || !subject || !message) {
            alert('Please fill in all required fields (marked with *).');
            return;
        }
        if (!emailRegex.test(email)) {
            alert('Please enter a valid email address.');
            return;
        }

        submitBtn.disabled = true;
        submitBtn.textContent = 'Submitting…';

        // ⚠️ Field names MUST match what admin.html reads from Firestore:
        //    d.firstName, d.lastName, d.email, d.phone, d.category,
        //    d.relation, d.gradeLevel, d.subject, d.message, d.createdAt
        db.collection('inquiries').add({
            firstName:   firstName,
            lastName:    lastName,
            email:       email,
            phone:       phone,
            relation:    relation,
            gradeLevel:  gradeLevel,
            category:    category,
            subject:     subject,
            message:     message,
            read:        false,
            archived:    false,
            createdAt:   firebase.firestore.FieldValue.serverTimestamp()
        })
        .then(() => {
            submitBtn.disabled = false;
            submitBtn.innerHTML = `<svg viewBox="0 0 24 24"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg> Submit Inquiry`;
            ['iq-firstname','iq-lastname','iq-email','iq-phone','iq-subject','iq-message'].forEach(id => {
                const el = document.getElementById(id);
                if (el) el.value = '';
            });
            const selects = ['iq-relation','iq-level'];
            selects.forEach(id => {
                const el = document.getElementById(id);
                if (el) el.selectedIndex = 0;
            });
            alert('✅ Inquiry submitted! We will respond within 1–2 business days.');
        })
        .catch(err => {
            console.error('Inquiry submit error:', err);
            submitBtn.disabled = false;
            submitBtn.innerHTML = `<svg viewBox="0 0 24 24"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg> Submit Inquiry`;
            alert('Something went wrong. Please try again.');
        });
    });
});

// ===========================
// SCROLL REVEAL ANIMATION
// ===========================
document.addEventListener('DOMContentLoaded', function () {
    const revealObserver = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
            if (entry.isIntersecting) {
                entry.target.classList.add('visible');
                revealObserver.unobserve(entry.target); // animate once only
            }
        });
    }, {
        threshold: 0.12,
        rootMargin: '0px 0px -40px 0px'
    });

    document.querySelectorAll('.reveal').forEach(function (el) {
        revealObserver.observe(el);
    });
});

// ===========================
// EVENTS SLIDESHOW
// ===========================
(function () {
  const slideshow = document.querySelector('.events-slideshow');
  const track = document.getElementById('events-track');
  const dotsEl = document.getElementById('eslide-dots');
  const counter = document.getElementById('eslide-counter');
  if (!track || !dotsEl || !counter || !slideshow) return;

  const total = track.children.length;
  let cur = 0, timer;

  // Set each slide to the exact pixel width of the container — no CSS % guesswork
  function setWidths() {
    const w = slideshow.offsetWidth;
    Array.from(track.children).forEach(s => s.style.width = w + 'px');
  }
  setWidths();
  window.addEventListener('resize', () => { setWidths(); go(cur); });

  const dots = Array.from({ length: total }, (_, i) => {
    const d = document.createElement('button');
    d.className = 'eslide-dot' + (i === 0 ? ' active' : '');
    d.setAttribute('aria-label', 'Go to slide ' + (i + 1));
    d.addEventListener('click', () => go(i));
    dotsEl.appendChild(d);
    return d;
  });

  function go(n) {
    cur = (n + total) % total;
    track.style.transform = 'translateX(-' + (cur * slideshow.offsetWidth) + 'px)';
    dots.forEach((d, i) => d.classList.toggle('active', i === cur));
    counter.textContent = (cur + 1) + ' / ' + total;
    resetTimer();
  }

  function resetTimer() {
    clearInterval(timer);
    timer = setInterval(() => go(cur + 1), 5000);
  }

  document.getElementById('eslide-prev').addEventListener('click', () => go(cur - 1));
  document.getElementById('eslide-next').addEventListener('click', () => go(cur + 1));
  track.addEventListener('mouseenter', () => clearInterval(timer));
  track.addEventListener('mouseleave', resetTimer);

  resetTimer();
})();
