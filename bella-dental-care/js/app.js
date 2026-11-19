/* =============================================================
   Bella Dental Care - Ankawa, Erbil
   Interactive Simulators, Multi-Tooth Planner & Booking Engine
   ============================================================= */

const CLINIC_WHATSAPP_NUMBER = '9647500000000'; // Replace with official clinic WhatsApp number
const STORAGE_KEY = 'bella_dental_bookings_v1';

// App State
const state = {
    activeTab: 'implant',
    implantStep: 1,
    orthoProgress: 0,
    orthoMode: 'metal', // 'metal' | 'clear'
    whiteningVal: 20,
    fillingStage: 'decay', // 'decay' | 'cleaning' | 'cleaned' | 'curing' | 'filled'
    selectedToothNum: null,
    toothPlan: new Map() // toothNum -> { num, arch, name, treatment }
};

/* -------------------------------------------------------------
   Initialization
---------------------------------------------------------------- */
document.addEventListener('DOMContentLoaded', () => {
    const yearEl = document.getElementById('year');
    if (yearEl) yearEl.textContent = new Date().getFullYear();

    initMobileMenu();
    initDateInput();
    initClinicStatus();
    initTeethMap();
    initScrollSpy();
    initModalDismissals();
    updateBookingsBadge();

    // Render initial active canvas after layout settles
    requestAnimationFrame(() => {
        renderActiveCanvas();
    });
});

window.addEventListener('resize', () => {
    renderActiveCanvas();
});

/* -------------------------------------------------------------
   Helpers: HiDPI Canvas & Toast
---------------------------------------------------------------- */
function setupCanvas(canvasId) {
    const canvas = document.getElementById(canvasId);
    if (!canvas || !canvas.parentElement) return null;

    const rect = canvas.parentElement.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return null;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(rect.width * dpr);
    canvas.height = Math.round(rect.height * dpr);

    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { ctx, w: rect.width, h: rect.height };
}

let toastTimer = null;
function showToast(message, type = 'info') {
    const toast = document.getElementById('toast');
    const msgEl = document.getElementById('toast-message');
    const iconEl = document.getElementById('toast-icon');
    if (!toast || !msgEl) return;

    msgEl.textContent = message;
    if (type === 'warning') {
        iconEl.className = 'fas fa-exclamation-circle text-amber-400 text-lg';
    } else if (type === 'success') {
        iconEl.className = 'fas fa-check-circle text-emerald-400 text-lg';
    } else {
        iconEl.className = 'fas fa-info-circle text-brand-cyan text-lg';
    }

    toast.classList.remove('translate-y-24', 'opacity-0', 'pointer-events-none');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
        toast.classList.add('translate-y-24', 'opacity-0', 'pointer-events-none');
    }, 3200);
}

/* -------------------------------------------------------------
   Navigation, Scroll-Spy & Clinic Live Status
---------------------------------------------------------------- */
function initMobileMenu() {
    const mobileBtn = document.getElementById('mobile-menu-btn');
    const mobileMenu = document.getElementById('mobile-menu');
    if (!mobileBtn || !mobileMenu) return;

    mobileBtn.addEventListener('click', () => {
        const isHidden = mobileMenu.classList.toggle('hidden');
        mobileBtn.setAttribute('aria-expanded', String(!isHidden));
    });

    document.querySelectorAll('.mobile-nav-link').forEach((link) => {
        link.addEventListener('click', () => {
            mobileMenu.classList.add('hidden');
            mobileBtn.setAttribute('aria-expanded', 'false');
        });
    });
}

function initScrollSpy() {
    const sections = ['about', 'founders', 'services', 'tooth-map', 'faq', 'contact']
        .map((id) => document.getElementById(id))
        .filter(Boolean);
    const navLinks = document.querySelectorAll('.nav-link');

    if (!sections.length || !navLinks.length) return;

    const observer = new IntersectionObserver(
        (entries) => {
            entries.forEach((entry) => {
                if (entry.isIntersecting) {
                    const id = entry.target.getAttribute('id');
                    navLinks.forEach((link) => {
                        link.classList.toggle('active', link.getAttribute('href') === `#${id}`);
                    });
                }
            });
        },
        { rootMargin: '-35% 0px -55% 0px' }
    );

    sections.forEach((sec) => observer.observe(sec));
}

function initClinicStatus() {
    const dot = document.getElementById('clinic-status-dot');
    const text = document.getElementById('clinic-status-text');
    if (!dot || !text) return;

    const now = new Date();
    const day = now.getDay(); // 5 = Friday
    const hour = now.getHours();
    const isOpen = day !== 5 && hour >= 15 && hour < 21;

    if (isOpen) {
        dot.className = 'w-3 h-3 rounded-full bg-emerald-500 animate-pulse';
        text.textContent = 'العيادة مفتوحة الآن وتستقبل المراجعين (3:00 - 9:00 مساءً)';
    } else if (day === 5) {
        dot.className = 'w-3 h-3 rounded-full bg-amber-400';
        text.textContent = 'الجمعة عطلة أسبوعية — يمكنك الحجز الإلكتروني الآن';
    } else {
        dot.className = 'w-3 h-3 rounded-full bg-brand-cyan';
        text.textContent = 'أوقات الدوام يومياً 3:00 - 9:00 مساءً — احجز موعدك الآن';
    }
}

function initDateInput() {
    const dateInput = document.getElementById('bookingDate');
    if (!dateInput) return;

    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    const todayStr = `${yyyy}-${mm}-${dd}`;
    dateInput.min = todayStr;
    dateInput.value = todayStr;

    dateInput.addEventListener('change', () => {
        const picked = new Date(`${dateInput.value}T12:00:00`);
        if (picked.getDay() === 5) {
            showToast('تنبيه: يوم الجمعة عطلة العيادة، يُفضل اختيار يوم آخر.', 'warning');
        }
    });
}

/* -------------------------------------------------------------
   Department Tabs
---------------------------------------------------------------- */
function switchTab(tabId) {
    state.activeTab = tabId;

    document.querySelectorAll('.tab-content').forEach((el) => el.classList.add('hidden'));
    document.querySelectorAll('.dept-tab').forEach((btn) => {
        btn.setAttribute('aria-selected', 'false');
        btn.classList.remove('active', 'bg-brand-cyan', 'bg-brand-pink', 'text-white', 'border-brand-cyan', 'border-brand-pink', 'shadow-md');
        btn.classList.add('bg-white', 'text-slate-700', 'border-slate-200', 'shadow-sm');
    });

    const activePanel = document.getElementById(`content-${tabId}`);
    const activeBtn = document.getElementById(`tab-${tabId}`);

    if (activePanel && activeBtn) {
        activePanel.classList.remove('hidden');
        activeBtn.setAttribute('aria-selected', 'true');
        activeBtn.classList.remove('bg-white', 'text-slate-700', 'border-slate-200', 'shadow-sm');
        activeBtn.classList.add('active', 'text-white', 'shadow-md');

        if (tabId === 'ortho' || tabId === 'filling') {
            activeBtn.classList.add('bg-brand-pink', 'border-brand-pink');
        } else {
            activeBtn.classList.add('bg-brand-cyan', 'border-brand-cyan');
        }
    }

    requestAnimationFrame(() => {
        renderActiveCanvas();
    });
}

function renderActiveCanvas() {
    if (state.activeTab === 'implant') renderImplantCanvas();
    if (state.activeTab === 'ortho') renderOrthoCanvas();
    if (state.activeTab === 'whitening') renderWhiteningCanvas();
    if (state.activeTab === 'filling') renderFillingCanvas();
}

/* -------------------------------------------------------------
   1. IMPLANT CANVAS SIMULATOR
---------------------------------------------------------------- */
function setImplantStep(step) {
    state.implantStep = step;
    const label = document.getElementById('implant-step-label');
    if (step === 1) label.textContent = 'الخطوة 1: الغرسة السويسرية';
    if (step === 2) label.textContent = 'الخطوة 2: الدعامة الرابطة';
    if (step === 3) label.textContent = 'الخطوة 3: التاج الزيركوني النهائي';

    [1, 2, 3].forEach((n) => {
        const btn = document.getElementById(`implant-btn-${n}`);
        if (btn) btn.classList.toggle('active', n === step);
    });

    renderImplantCanvas();
}

function renderImplantCanvas() {
    const setup = setupCanvas('implantCanvas');
    if (!setup) return;
    const { ctx, w, h } = setup;

    ctx.clearRect(0, 0, w, h);

    // Subtle background glow
    const bgGrad = ctx.createRadialGradient(w / 2, h / 2, 10, w / 2, h / 2, 140);
    bgGrad.addColorStop(0, 'rgba(0, 174, 239, 0.14)');
    bgGrad.addColorStop(1, 'rgba(15, 23, 42, 0)');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, w, h);

    // Jaw Bone Area
    ctx.fillStyle = '#1E293B';
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(w / 2 - 115, h - 78, 230, 68, 14);
    ctx.fill();
    ctx.stroke();

    // Gum Tissue Layer
    ctx.fillStyle = '#BE185D';
    ctx.beginPath();
    ctx.roundRect(w / 2 - 115, h - 94, 230, 22, [12, 12, 4, 4]);
    ctx.fill();

    // Neighboring healthy teeth silhouettes for realism
    ctx.fillStyle = 'rgba(241, 245, 249, 0.22)';
    [-76, 76].forEach((dx) => {
        ctx.beginPath();
        ctx.roundRect(w / 2 + dx - 22, h - 146, 44, 56, [14, 14, 6, 6]);
        ctx.fill();
    });

    // Label in Jaw Bone
    ctx.fillStyle = '#38BDF8';
    ctx.font = '600 12px Cairo, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('عظم الفك السليم + اللثة', w / 2, h - 22);

    // Step 1: Titanium Screw / Implant
    const screwGrad = ctx.createLinearGradient(w / 2 - 14, 0, w / 2 + 14, 0);
    screwGrad.addColorStop(0, '#64748B');
    screwGrad.addColorStop(0.5, '#E2E8F0');
    screwGrad.addColorStop(1, '#475569');

    ctx.fillStyle = screwGrad;
    ctx.beginPath();
    ctx.roundRect(w / 2 - 12, h - 96, 24, 54, [3, 3, 8, 8]);
    ctx.fill();

    // Screw Threads
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 2.5;
    for (let y = h - 88; y <= h - 50; y += 7) {
        ctx.beginPath();
        ctx.moveTo(w / 2 - 15, y);
        ctx.lineTo(w / 2 + 15, y - 2);
        ctx.stroke();
    }

    // Step 2: Abutment
    if (state.implantStep >= 2) {
        const abGrad = ctx.createLinearGradient(w / 2 - 12, 0, w / 2 + 12, 0);
        abGrad.addColorStop(0, '#94A3B8');
        abGrad.addColorStop(0.5, '#F8FAFC');
        abGrad.addColorStop(1, '#64748B');
        ctx.fillStyle = abGrad;
        ctx.beginPath();
        ctx.moveTo(w / 2 - 12, h - 95);
        ctx.lineTo(w / 2 + 12, h - 95);
        ctx.lineTo(w / 2 + 9, h - 124);
        ctx.lineTo(w / 2 - 9, h - 124);
        ctx.closePath();
        ctx.fill();
    }

    // Step 3: Zirconia Crown
    if (state.implantStep >= 3) {
        ctx.save();
        ctx.shadowColor = '#00AEEF';
        ctx.shadowBlur = 18;
        const crownGrad = ctx.createLinearGradient(w / 2, h - 178, w / 2, h - 96);
        crownGrad.addColorStop(0, '#FFFFFF');
        crownGrad.addColorStop(1, '#E0F2FE');
        ctx.fillStyle = crownGrad;

        ctx.beginPath();
        ctx.moveTo(w / 2 - 22, h - 96);
        ctx.bezierCurveTo(w / 2 - 30, h - 135, w / 2 - 26, h - 175, w / 2 - 8, h - 172);
        ctx.quadraticCurveTo(w / 2, h - 166, w / 2 + 8, h - 172);
        ctx.bezierCurveTo(w / 2 + 26, h - 175, w / 2 + 30, h - 135, w / 2 + 22, h - 96);
        ctx.closePath();
        ctx.fill();

        // Highlight shine on crown
        ctx.shadowBlur = 0;
        ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
        ctx.beginPath();
        ctx.ellipse(w / 2 - 9, h - 146, 5, 14, -0.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }
}

/* -------------------------------------------------------------
   2. ORTHO CANVAS SIMULATOR (Metal & Clear Aligners)
---------------------------------------------------------------- */
function setOrthoMode(mode) {
    state.orthoMode = mode;
    const metalBtn = document.getElementById('ortho-mode-metal');
    const clearBtn = document.getElementById('ortho-mode-clear');
    if (metalBtn && clearBtn) {
        if (mode === 'metal') {
            metalBtn.className = 'px-2.5 py-1 rounded-md bg-brand-pink text-white font-bold transition-all';
            clearBtn.className = 'px-2.5 py-1 rounded-md text-slate-300 hover:text-white font-bold transition-all';
        } else {
            clearBtn.className = 'px-2.5 py-1 rounded-md bg-brand-cyan text-slate-950 font-bold transition-all';
            metalBtn.className = 'px-2.5 py-1 rounded-md text-slate-300 hover:text-white font-bold transition-all';
        }
    }
    renderOrthoCanvas();
}

function updateOrthoSim(val) {
    state.orthoProgress = parseInt(val, 10);
    const status = document.getElementById('ortho-status-text');
    const percentLabel = document.getElementById('ortho-percent-label');
    if (percentLabel) percentLabel.textContent = `${state.orthoProgress}%`;

    if (status) {
        if (state.orthoProgress < 30) status.textContent = 'أسنان متباعدة وغير منتظمة';
        else if (state.orthoProgress < 75) status.textContent = 'تعديل تدريجي تحت تأثير التقويم';
        else status.textContent = 'محاذاة تامة وابتسامة مثالية';
    }
    renderOrthoCanvas();
}

function renderOrthoCanvas() {
    const setup = setupCanvas('orthoCanvas');
    if (!setup) return;
    const { ctx, w, h } = setup;

    ctx.clearRect(0, 0, w, h);

    const toothCount = 6;
    const spacing = Math.min(44, (w - 60) / toothCount);
    const totalWidth = (toothCount - 1) * spacing;
    const startX = w / 2 - totalWidth / 2;
    const factor = (100 - state.orthoProgress) / 100;

    // Upper Gum Arch
    ctx.fillStyle = '#9D174D';
    ctx.beginPath();
    ctx.roundRect(startX - 28, h / 2 - 58, totalWidth + 56, 36, [24, 24, 8, 8]);
    ctx.fill();

    const crookedOffsetsY = [-14, 10, -8, 12, -10, 8];
    const crookedRots = [-0.22, 0.18, -0.14, 0.2, -0.18, 0.16];
    const bracketPoints = [];

    for (let i = 0; i < toothCount; i++) {
        const cx = startX + i * spacing;
        const cy = h / 2 + crookedOffsetsY[i] * factor;
        const rot = crookedRots[i] * factor;
        const isFront = i === 2 || i === 3;
        const tw = isFront ? 32 : 28;
        const th = isFront ? 54 : 48;

        bracketPoints.push({ x: cx, y: cy });

        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(rot);

        // Tooth Body
        const tGrad = ctx.createLinearGradient(0, -th / 2, 0, th / 2);
        tGrad.addColorStop(0, '#FFFFFF');
        tGrad.addColorStop(1, '#E2E8F0');
        ctx.fillStyle = tGrad;
        ctx.strokeStyle = '#CBD5E1';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.roundRect(-tw / 2, -th / 2, tw, th, [8, 8, 12, 12]);
        ctx.fill();
        ctx.stroke();

        // Metal Bracket or Clear Aligner Attachment
        if (state.orthoMode === 'metal') {
            ctx.fillStyle = '#94A3B8';
            ctx.beginPath();
            ctx.roundRect(-6, -5, 12, 10, 2);
            ctx.fill();
            ctx.fillStyle = '#E5007E';
            ctx.beginPath();
            ctx.arc(0, 0, 2.5, 0, Math.PI * 2);
            ctx.fill();
        } else {
            // Clear aligner overlay sheen
            ctx.fillStyle = 'rgba(0, 174, 239, 0.16)';
            ctx.strokeStyle = 'rgba(56, 189, 248, 0.55)';
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.roundRect(-tw / 2 - 2, -th / 2 - 2, tw + 4, th + 4, [10, 10, 14, 14]);
            ctx.fill();
            ctx.stroke();
        }

        ctx.restore();
    }

    // Draw Ortho Arch Wire for Metal Braces
    if (state.orthoMode === 'metal' && bracketPoints.length) {
        ctx.strokeStyle = '#E5007E';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(bracketPoints[0].x - 16, bracketPoints[0].y);
        for (let i = 0; i < bracketPoints.length; i++) {
            ctx.lineTo(bracketPoints[i].x, bracketPoints[i].y);
        }
        ctx.lineTo(bracketPoints[bracketPoints.length - 1].x + 16, bracketPoints[bracketPoints.length - 1].y);
        ctx.stroke();
    }
}

/* -------------------------------------------------------------
   3. WHITENING CANVAS SIMULATOR (Smile Preview + VITA Shades)
---------------------------------------------------------------- */
function updateWhiteningSim(val) {
    state.whiteningVal = parseInt(val, 10);
    const txt = document.getElementById('shade-level-text');
    const badge = document.getElementById('shade-code-badge');

    let shadeCode = 'A3.5';
    let shadeDesc = 'درجة A3.5 — اصفرار وتصبغات';
    if (state.whiteningVal >= 85) {
        shadeCode = 'BL1';
        shadeDesc = 'درجة BL1 — بياض هوليودي ناصع';
    } else if (state.whiteningVal >= 60) {
        shadeCode = 'B1';
        shadeDesc = 'درجة B1 — تبييض طبيعي مشرق';
    } else if (state.whiteningVal >= 35) {
        shadeCode = 'A2';
        shadeDesc = 'درجة A2 — تفتيح متوسط واضح';
    } else if (state.whiteningVal >= 15) {
        shadeCode = 'A3';
        shadeDesc = 'درجة A3 — طبيعية مائلة للاصفرار';
    }

    if (txt) txt.textContent = shadeDesc;
    if (badge) badge.textContent = `Shade ${shadeCode}`;
    renderWhiteningCanvas();
}

function renderWhiteningCanvas() {
    const setup = setupCanvas('whiteningCanvas');
    if (!setup) return;
    const { ctx, w, h } = setup;

    ctx.clearRect(0, 0, w, h);

    const t = state.whiteningVal / 100;
    // Interpolate from stained yellow (#E6D39A) to radiant white (#FFFFFF)
    const r = Math.round(230 + (255 - 230) * t);
    const g = Math.round(211 + (255 - 211) * t);
    const b = Math.round(154 + (255 - 154) * t);

    // Gum Arch
    ctx.fillStyle = '#BE185D';
    ctx.beginPath();
    ctx.roundRect(w / 2 - 125, h / 2 - 64, 250, 40, [40, 40, 12, 12]);
    ctx.fill();

    // Draw 6 Teeth Smile
    const widths = [28, 32, 38, 38, 32, 28];
    const heights = [48, 54, 62, 62, 54, 48];
    const totalW = widths.reduce((a, c) => a + c, 0) + 15;
    let curX = w / 2 - totalW / 2;

    ctx.save();
    ctx.shadowColor = `rgba(0, 174, 239, ${0.15 + t * 0.55})`;
    ctx.shadowBlur = 8 + t * 18;

    for (let i = 0; i < widths.length; i++) {
        const tw = widths[i];
        const th = heights[i];
        const topY = h / 2 - 36;

        const grad = ctx.createLinearGradient(curX, topY, curX, topY + th);
        grad.addColorStop(0, `rgb(${Math.max(0, r - 8)}, ${Math.max(0, g - 8)}, ${Math.max(0, b - 12)})`);
        grad.addColorStop(0.5, `rgb(${r}, ${g}, ${b})`);
        grad.addColorStop(1, `rgb(${Math.min(255, r + 4)}, ${Math.min(255, g + 4)}, ${Math.min(255, b + 8)})`);

        ctx.fillStyle = grad;
        ctx.strokeStyle = 'rgba(148, 163, 184, 0.35)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.roundRect(curX, topY, tw, th, [8, 8, 12, 12]);
        ctx.fill();
        ctx.stroke();

        // Subtle gloss reflection
        ctx.fillStyle = `rgba(255, 255, 255, ${0.2 + t * 0.45})`;
        ctx.beginPath();
        ctx.roundRect(curX + 5, topY + 8, 6, th * 0.45, 4);
        ctx.fill();

        curX += tw + 3;
    }
    ctx.restore();

    // Sparkles when bright
    if (state.whiteningVal >= 65) {
        const sparkleAlpha = (state.whiteningVal - 65) / 35;
        drawSparkle(ctx, w / 2 - 68, h / 2 - 22, 10, sparkleAlpha, '#38BDF8');
        drawSparkle(ctx, w / 2 + 58, h / 2 + 8, 12, sparkleAlpha, '#FFFFFF');
        drawSparkle(ctx, w / 2 + 12, h / 2 - 30, 8, sparkleAlpha, '#FDE047');
    }
}

function drawSparkle(ctx, x, y, size, alpha, color) {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(x, y - size);
    ctx.quadraticCurveTo(x, y, x + size, y);
    ctx.quadraticCurveTo(x, y, x, y + size);
    ctx.quadraticCurveTo(x, y, x - size, y);
    ctx.quadraticCurveTo(x, y, x, y - size);
    ctx.fill();
    ctx.restore();
}

/* -------------------------------------------------------------
   4. FILLING & LASER CAVITY SIMULATOR
---------------------------------------------------------------- */
function cleanCavity() {
    if (state.fillingStage === 'filled') {
        showToast('تم ترميم السن بالفعل! اضغط "إعادة" للتجربة مجدداً.', 'info');
        return;
    }
    state.fillingStage = 'cleaning';
    document.getElementById('filling-status').textContent = 'جارٍ تنظيف التسوس بالليزر...';
    renderFillingCanvas();

    setTimeout(() => {
        if (state.fillingStage === 'cleaning') {
            state.fillingStage = 'cleaned';
            document.getElementById('filling-status').textContent = 'تم إزالة التسوس بالكامل (جاهز للحشو)';
            renderFillingCanvas();
        }
    }, 650);
}

function applyFilling() {
    if (state.fillingStage === 'decay') {
        showToast('يرجى تنظيف التسوس بالليزر أولاً قبل وضع الحشوة!', 'warning');
        return;
    }
    state.fillingStage = 'curing';
    document.getElementById('filling-status').textContent = 'تثبيت الحشوة التجميلية بالضوء الأزرق...';
    renderFillingCanvas();

    setTimeout(() => {
        if (state.fillingStage === 'curing') {
            state.fillingStage = 'filled';
            document.getElementById('filling-status').textContent = 'تم تطبيق الحشوة التجميلية الضوئية بنجاح ✓';
            renderFillingCanvas();
        }
    }, 700);
}

function resetFillingSim() {
    state.fillingStage = 'decay';
    document.getElementById('filling-status').textContent = 'يوجد تسوس سطحي';
    renderFillingCanvas();
}

function renderFillingCanvas() {
    const setup = setupCanvas('fillingCanvas');
    if (!setup) return;
    const { ctx, w, h } = setup;

    ctx.clearRect(0, 0, w, h);

    // Draw Molar Tooth Cross-section
    const cx = w / 2;
    const cy = h / 2 + 12;

    const toothGrad = ctx.createLinearGradient(cx, cy - 65, cx, cy + 65);
    toothGrad.addColorStop(0, '#FFFFFF');
    toothGrad.addColorStop(1, '#E2E8F0');
    ctx.fillStyle = toothGrad;
    ctx.strokeStyle = '#CBD5E1';
    ctx.lineWidth = 2;

    ctx.beginPath();
    ctx.moveTo(cx - 56, cy - 42);
    ctx.quadraticCurveTo(cx - 32, cy - 66, cx, cy - 48);
    ctx.quadraticCurveTo(cx + 32, cy - 66, cx + 56, cy - 42);
    ctx.quadraticCurveTo(cx + 68, cy + 10, cx + 44, cy + 56);
    ctx.quadraticCurveTo(cx + 22, cy + 64, cx, cy + 36);
    ctx.quadraticCurveTo(cx - 22, cy + 64, cx - 44, cy + 56);
    ctx.quadraticCurveTo(cx - 68, cy + 10, cx - 56, cy - 42);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Cavity / Filling Region
    if (state.fillingStage === 'decay' || state.fillingStage === 'cleaning') {
        ctx.fillStyle = '#451A03';
        ctx.beginPath();
        ctx.ellipse(cx, cy - 28, 22, 16, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#78350F';
        ctx.beginPath();
        ctx.ellipse(cx - 4, cy - 30, 12, 8, 0, 0, Math.PI * 2);
        ctx.fill();
    } else if (state.fillingStage === 'cleaned' || state.fillingStage === 'curing') {
        ctx.fillStyle = '#CBD5E1';
        ctx.strokeStyle = '#94A3B8';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.ellipse(cx, cy - 28, 22, 16, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
    } else if (state.fillingStage === 'filled') {
        ctx.fillStyle = '#F0F9FF';
        ctx.strokeStyle = '#00AEEF';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.ellipse(cx, cy - 28, 22, 15, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        drawSparkle(ctx, cx + 18, cy - 38, 8, 0.9, '#00AEEF');
    }

    // Laser beam effect during cleaning
    if (state.fillingStage === 'cleaning') {
        ctx.save();
        ctx.strokeStyle = '#F43F5E';
        ctx.shadowColor = '#F43F5E';
        ctx.shadowBlur = 16;
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(cx + 50, 8);
        ctx.lineTo(cx, cy - 28);
        ctx.stroke();
        ctx.restore();
    }

    // UV Blue Light cone during curing
    if (state.fillingStage === 'curing') {
        ctx.save();
        const uvGrad = ctx.createLinearGradient(cx, 12, cx, cy - 20);
        uvGrad.addColorStop(0, 'rgba(56, 189, 248, 0.85)');
        uvGrad.addColorStop(1, 'rgba(56, 189, 248, 0.15)');
        ctx.fillStyle = uvGrad;
        ctx.beginPath();
        ctx.moveTo(cx - 8, 12);
        ctx.lineTo(cx + 8, 12);
        ctx.lineTo(cx + 34, cy - 16);
        ctx.lineTo(cx - 34, cy - 16);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
    }
}

/* -------------------------------------------------------------
   Interactive Multi-Tooth Map & Planner
---------------------------------------------------------------- */
function getToothAnatomicalName(num) {
    // Universal Numbering System 1-16 (Upper R->L), 17-32 (Lower L->R)
    const upperNames = [
        'ضرس العقل العلوي الأيمن', 'الضرس الثاني العلوي الأيمن', 'الضرس الأول العلوي الأيمن',
        'الضاحك الثاني العلوي الأيمن', 'الضاحك الأول العلوي الأيمن', 'الناب العلوي الأيمن',
        'الرباعية العلوية اليمنى', 'الثنية الأمامية العلوية اليمنى', 'الثنية الأمامية العلوية اليسرى',
        'الرباعية العلوية اليسرى', 'الناب العلوي الأيسر', 'الضاحك الأول العلوي الأيسر',
        'الضاحك الثاني العلوي الأيسر', 'الضرس الأول العلوي الأيسر', 'الضرس الثاني العلوي الأيسر',
        'ضرس العقل العلوي الأيسر'
    ];
    const lowerNames = [
        'ضرس العقل السفلي الأيسر', 'الضرس الثاني السفلي الأيسر', 'الضرس الأول السفلي الأيسر',
        'الضاحك الثاني السفلي الأيسر', 'الضاحك الأول السفلي الأيسر', 'الناب السفلي الأيسر',
        'الرباعية السفلية اليسرى', 'الثنية الأمامية السفلية اليسرى', 'الثنية الأمامية السفلية اليمنى',
        'الرباعية السفلية اليمنى', 'الناب السفلي الأيمن', 'الضاحك الأول السفلي الأيمن',
        'الضاحك الثاني السفلي الأيمن', 'الضرس الأول السفلي الأيمن', 'الضرس الثاني السفلي الأيمن',
        'ضرس العقل السفلي الأيمن'
    ];
    return num <= 16 ? upperNames[num - 1] : lowerNames[num - 17];
}

function initTeethMap() {
    const upperJaw = document.getElementById('upper-jaw');
    const lowerJaw = document.getElementById('lower-jaw');
    if (!upperJaw || !lowerJaw) return;

    upperJaw.innerHTML = '';
    lowerJaw.innerHTML = '';

    for (let i = 1; i <= 16; i++) {
        upperJaw.appendChild(createToothBtn(i, 'علوي'));
    }
    for (let i = 17; i <= 32; i++) {
        lowerJaw.appendChild(createToothBtn(i, 'سفلي'));
    }
}

function createToothBtn(num, arch) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.id = `tooth-btn-${num}`;
    btn.title = `${getToothAnatomicalName(num)} (#${num})`;
    btn.setAttribute('aria-label', `السن رقم ${num} - ${getToothAnatomicalName(num)}`);
    btn.className = 'tooth-btn w-full sm:w-10 h-11 sm:h-14 rounded-xl bg-white border-2 border-slate-200 text-slate-700 font-bold text-xs flex flex-col items-center justify-center hover:border-brand-pink shadow-sm';
    btn.innerHTML = `<i class="fas fa-tooth text-slate-400 text-xs sm:text-sm pointer-events-none"></i><span class="pointer-events-none">${num}</span>`;
    btn.addEventListener('click', () => selectTooth(num, arch));
    return btn;
}

function selectTooth(num, arch) {
    state.selectedToothNum = num;

    document.querySelectorAll('.tooth-btn').forEach((b) => b.classList.remove('selected'));
    const activeBtn = document.getElementById(`tooth-btn-${num}`);
    if (activeBtn) activeBtn.classList.add('selected');

    document.getElementById('selected-tooth-title').textContent = `السن رقم ${num} (${arch})`;
    document.getElementById('selected-tooth-subtitle').textContent = getToothAnatomicalName(num);
    document.getElementById('tooth-actions').classList.remove('hidden');
    document.getElementById('tooth-placeholder').classList.add('hidden');

    // Highlight active treatment for this tooth if already planned
    const existing = state.toothPlan.get(num);
    document.querySelectorAll('.treatment-btn').forEach((btn) => {
        btn.classList.toggle('active', existing ? btn.dataset.treatment === existing.treatment : false);
    });
}

function selectTreatment(treatmentName) {
    if (!state.selectedToothNum) return;

    const num = state.selectedToothNum;
    const arch = num <= 16 ? 'علوي' : 'سفلي';
    state.toothPlan.set(num, {
        num,
        arch,
        name: getToothAnatomicalName(num),
        treatment: treatmentName
    });

    const btn = document.getElementById(`tooth-btn-${num}`);
    if (btn) btn.classList.add('planned');

    document.querySelectorAll('.treatment-btn').forEach((b) => {
        b.classList.toggle('active', b.dataset.treatment === treatmentName);
    });

    renderToothPlan();
    showToast(`تمت إضافة السن #${num} (${treatmentName}) إلى خطتك`, 'success');
}

function removeToothFromPlan(num) {
    state.toothPlan.delete(num);
    const btn = document.getElementById(`tooth-btn-${num}`);
    if (btn) btn.classList.remove('planned');

    if (state.selectedToothNum === num) {
        document.querySelectorAll('.treatment-btn').forEach((b) => b.classList.remove('active'));
    }
    renderToothPlan();
}

function clearToothPlan() {
    state.toothPlan.clear();
    document.querySelectorAll('.tooth-btn').forEach((b) => b.classList.remove('planned'));
    document.querySelectorAll('.treatment-btn').forEach((b) => b.classList.remove('active'));
    renderToothPlan();
}

function renderToothPlan() {
    const summaryBox = document.getElementById('plan-summary-box');
    const listEl = document.getElementById('plan-items-list');
    const countEl = document.getElementById('plan-count');
    const confirmBtn = document.getElementById('confirm-tooth-btn');

    const items = Array.from(state.toothPlan.values()).sort((a, b) => a.num - b.num);
    countEl.textContent = String(items.length);

    if (items.length === 0) {
        summaryBox.classList.add('hidden');
        confirmBtn.disabled = true;
        confirmBtn.className = 'w-full mt-6 py-4 rounded-xl font-bold bg-slate-800 text-slate-500 cursor-not-allowed transition-all text-sm flex items-center justify-center gap-2';
        return;
    }

    summaryBox.classList.remove('hidden');
    listEl.innerHTML = items
        .map(
            (item) => `
            <li class="flex items-center justify-between gap-2 bg-slate-900/70 px-3 py-2 rounded-lg border border-slate-700/70">
                <div>
                    <span class="font-bold text-white">السن #${item.num}</span>
                    <span class="text-slate-400">(${item.arch})</span>
                    <span class="text-brand-cyan font-semibold block">${item.treatment}</span>
                </div>
                <button type="button" onclick="removeToothFromPlan(${item.num})" class="text-slate-400 hover:text-rose-400 p-1" aria-label="إزالة السن ${item.num}">
                    <i class="fas fa-trash-can"></i>
                </button>
            </li>
        `
        )
        .join('');

    confirmBtn.disabled = false;
    confirmBtn.className = 'w-full mt-6 py-4 rounded-xl font-bold gradient-bg text-white shadow-glow-pink hover:opacity-95 transition-all text-sm flex items-center justify-center gap-2';
}

function bookWithToothInfo() {
    const items = Array.from(state.toothPlan.values()).sort((a, b) => a.num - b.num);
    if (!items.length) return;

    const details = items
        .map((it) => `السن #${it.num} (${it.arch}): ${it.treatment}`)
        .join(' | ');

    // Auto-match primary service from first selected treatment
    const firstTreatment = items[0].treatment;
    let service = 'استشارة عامة وفحص';
    if (firstTreatment.includes('زراعة')) service = 'زراعة الأسنان';
    else if (firstTreatment.includes('تقويم')) service = 'تقويم الأسنان';
    else if (firstTreatment.includes('تبييض')) service = 'تبييض وتنظيف الأسنان';
    else if (firstTreatment.includes('عصب')) service = 'علاج الجذور والعصب';
    else if (firstTreatment.includes('حشوة') || firstTreatment.includes('فينير')) service = 'الحشوات والتجميل';

    openBookingModal({ service, toothDetails: details });
}

/* -------------------------------------------------------------
   FAQ Accordion
---------------------------------------------------------------- */
function toggleFaq(btn) {
    const item = btn.closest('.faq-item');
    if (!item) return;
    const isOpen = item.classList.contains('open');
    document.querySelectorAll('.faq-item').forEach((el) => el.classList.remove('open'));
    if (!isOpen) item.classList.add('open');
}

/* -------------------------------------------------------------
   Booking Modal, LocalStorage & WhatsApp Integration
---------------------------------------------------------------- */
function openBookingModal(options = {}) {
    const modal = document.getElementById('bookingModal');
    if (!modal) return;

    resetBookingModalView();

    const serviceSelect = document.getElementById('serviceSelect');
    const doctorSelect = document.getElementById('doctorSelect');
    const toothInput = document.getElementById('toothInfoInput');

    if (options.service && serviceSelect) {
        const match = Array.from(serviceSelect.options).some((opt) => opt.value === options.service);
        if (match) serviceSelect.value = options.service;
    }

    if (options.doctor && doctorSelect) {
        const match = Array.from(doctorSelect.options).some((opt) => opt.value === options.doctor);
        if (match) doctorSelect.value = options.doctor;
    }

    if (options.toothDetails && toothInput) {
        toothInput.value = options.toothDetails;
    }

    modal.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
}

function closeBookingModal() {
    const modal = document.getElementById('bookingModal');
    if (!modal) return;
    modal.classList.add('hidden');
    document.body.style.overflow = '';
}

function resetBookingModalView() {
    document.getElementById('appointmentForm').classList.remove('hidden');
    document.getElementById('bookingConfirmation').classList.add('hidden');
}

function initModalDismissals() {
    const bookingModal = document.getElementById('bookingModal');
    const myBookingsModal = document.getElementById('myBookingsModal');

    [bookingModal, myBookingsModal].forEach((modal) => {
        if (!modal) return;
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.classList.add('hidden');
                document.body.style.overflow = '';
            }
        });
    });

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            closeBookingModal();
            closeMyBookingsModal();
        }
    });
}

function buildWhatsAppUrl(booking) {
    const lines = [
        'مرحباً عيادة بيلا لطب الأسنان (Bella Dental Care - عنكاوا أربيل)',
        `رقم المرجع: ${booking.ref}`,
        'أود تأكيد حجز موعد جديد:',
        `• الاسم: ${booking.name}`,
        `• الهاتف: ${booking.phone}`,
        `• الخدمة: ${booking.service}`,
        `• الطبيب: ${booking.doctor}`,
        `• التاريخ: ${booking.date}`,
        `• الفترة: ${booking.time}`
    ];
    if (booking.details) {
        lines.push(`• تفاصيل الأسنان/الملاحظات: ${booking.details}`);
    }
    return `https://wa.me/${CLINIC_WHATSAPP_NUMBER}?text=${encodeURIComponent(lines.join('\n'))}`;
}

function handleFormSubmit(e) {
    e.preventDefault();

    const name = document.getElementById('patientName').value.trim();
    const phone = document.getElementById('patientPhone').value.trim();
    const service = document.getElementById('serviceSelect').value;
    const doctor = document.getElementById('doctorSelect').value;
    const date = document.getElementById('bookingDate').value;
    const time = document.getElementById('bookingTime').value;
    const details = document.getElementById('toothInfoInput').value.trim();

    if (!name || !phone || !date) {
        showToast('يرجى إكمال الحقول المطلوبة.', 'warning');
        return;
    }

    const ref = `BDC-${String(Date.now()).slice(-5)}`;
    const booking = {
        id: Date.now(),
        ref,
        name,
        phone,
        service,
        doctor,
        date,
        time,
        details,
        createdAt: new Date().toISOString()
    };

    saveBooking(booking);

    // Show confirmation UI
    document.getElementById('appointmentForm').classList.add('hidden');
    document.getElementById('bookingConfirmation').classList.remove('hidden');
    document.getElementById('confirmRefCode').textContent = ref;
    document.getElementById('confirmDetailsBox').innerHTML = `
        <p><span class="font-bold text-slate-900">الاسم:</span> ${escapeHtml(name)}</p>
        <p><span class="font-bold text-slate-900">الخدمة:</span> ${escapeHtml(service)}</p>
        <p><span class="font-bold text-slate-900">الطبيب:</span> ${escapeHtml(doctor)}</p>
        <p><span class="font-bold text-slate-900">الموعد:</span> ${escapeHtml(date)} (${escapeHtml(time)})</p>
        ${details ? `<p><span class="font-bold text-slate-900">التفاصيل:</span> ${escapeHtml(details)}</p>` : ''}
    `;

    const waBtn = document.getElementById('whatsappSendBtn');
    if (waBtn) waBtn.href = buildWhatsAppUrl(booking);

    document.getElementById('appointmentForm').reset();
    initDateInput();
    showToast('تم حفظ موعدك بنجاح! يمكنك الآن تأكيده عبر الواتساب.', 'success');
}

/* -------------------------------------------------------------
   Saved Bookings Management (localStorage with memory fallback)
---------------------------------------------------------------- */
let memoryBookings = [];

function getSavedBookings() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        return raw ? JSON.parse(raw) : memoryBookings;
    } catch {
        return memoryBookings;
    }
}

function saveBooking(booking) {
    const list = getSavedBookings();
    list.unshift(booking);
    const trimmed = list.slice(0, 20);
    memoryBookings = trimmed;
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
    } catch {
        // Fallback already stored in memoryBookings
    }
    updateBookingsBadge();
}

function deleteBooking(id) {
    const list = getSavedBookings().filter((b) => b.id !== id);
    memoryBookings = list;
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
    } catch {
        // Fallback already updated in memoryBookings
    }
    updateBookingsBadge();
    renderMyBookingsList();
    showToast('تم حذف الموعد من السجل.', 'info');
}

function updateBookingsBadge() {
    const count = getSavedBookings().length;
    ['bookings-count-badge', 'bookings-count-badge-mobile'].forEach((id) => {
        const badge = document.getElementById(id);
        if (!badge) return;
        if (count > 0) {
            badge.textContent = String(count);
            badge.classList.remove('hidden');
        } else {
            badge.classList.add('hidden');
        }
    });
}

function openMyBookingsModal() {
    renderMyBookingsList();
    const modal = document.getElementById('myBookingsModal');
    if (modal) {
        modal.classList.remove('hidden');
        document.body.style.overflow = 'hidden';
    }
}

function closeMyBookingsModal() {
    const modal = document.getElementById('myBookingsModal');
    if (modal) {
        modal.classList.add('hidden');
        document.body.style.overflow = '';
    }
}

function renderMyBookingsList() {
    const container = document.getElementById('myBookingsList');
    if (!container) return;

    const list = getSavedBookings();
    if (!list.length) {
        container.innerHTML = `
            <div class="text-center py-10 text-slate-400 space-y-3">
                <i class="far fa-calendar-times text-4xl text-slate-300"></i>
                <p class="text-sm font-semibold">لا توجد مواعيد محفوظة بعد</p>
                <button type="button" onclick="closeMyBookingsModal(); openBookingModal();" class="gradient-bg text-white font-bold px-5 py-2.5 rounded-xl text-xs">
                    احجز موعدك الأول
                </button>
            </div>
        `;
        return;
    }

    container.innerHTML = list
        .map(
            (b) => `
            <div class="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2 text-xs">
                <div class="flex items-center justify-between">
                    <span class="font-extrabold text-brand-pink">${escapeHtml(b.ref)}</span>
                    <span class="text-slate-500 font-semibold">${escapeHtml(b.date)} • ${escapeHtml(b.time)}</span>
                </div>
                <p class="font-bold text-slate-900 text-sm">${escapeHtml(b.service)}</p>
                <p class="text-slate-600">${escapeHtml(b.doctor)}</p>
                ${b.details ? `<p class="text-slate-500 bg-white p-2 rounded-lg border border-slate-100">${escapeHtml(b.details)}</p>` : ''}
                <div class="flex items-center justify-between pt-2 border-t border-slate-200/70">
                    <a href="${buildWhatsAppUrl(b)}" target="_blank" rel="noopener noreferrer" class="text-emerald-600 hover:underline font-bold flex items-center gap-1">
                        <i class="fab fa-whatsapp"></i> إرسال للواتساب
                    </a>
                    <button type="button" onclick="deleteBooking(${b.id})" class="text-rose-500 hover:text-rose-700 font-semibold">
                        <i class="fas fa-trash-can ml-1"></i>حذف
                    </button>
                </div>
            </div>
        `
        )
        .join('');
}

function escapeHtml(str) {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}
