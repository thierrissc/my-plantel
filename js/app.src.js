const USER_CACHE_KEY = "plantel_user";
const TOKEN_CACHE_KEY = "plantel_token";

function getAuthHeaders() {
  const token = localStorage.getItem(TOKEN_CACHE_KEY);
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function getCachedUser() {
  try {
    const raw = localStorage.getItem(USER_CACHE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}
function setCachedUser(u) {
  try {
    if (u) localStorage.setItem(USER_CACHE_KEY, JSON.stringify(u));
    else localStorage.removeItem(USER_CACHE_KEY);
  } catch {}
}

function formatPlantelId(id) {
  if (!id) return "Não definido";
  let clean = String(id).trim().replace(/^(usr_|user_)/i, "");
  return "User_" + clean.slice(0, 8).toUpperCase();
}

function parsePeso(str) {
  if (!str) return { valor: "", unidade: "kg" };
  const s = String(str).trim();
  const match = s.match(/^([0-9.,]+)\s*(kg|g)?$/i);
  if (match) {
    return {
      valor: match[1].replace(",", "."),
      unidade: (match[2] || "kg").toLowerCase() === "g" ? "g" : "kg",
    };
  }
  const isG = s.toLowerCase().includes("g") && !s.toLowerCase().includes("kg");
  return {
    valor: s.replace(/[^0-9.,]/g, "").replace(",", "."),
    unidade: isG ? "g" : "kg",
  };
}

let currentUser = getCachedUser();
let _cloudSyncTimer = null;

function abrirLoginModal(viewId = "lp-login") {
  const modal = document.getElementById("login-screen");
  if (modal) modal.style.display = "block";
  lpShowView(viewId);
}

function fecharLoginModal() {
  const modal = document.getElementById("login-screen");
  if (modal) modal.style.display = "none";
}

function fecharLoginModalExterno(e) {
  if (e.target.id === "login-screen") {
    fecharLoginModal();
  }
}

function updateAuthUI() {
  const authActions = document.getElementById("header-auth-actions");
  const umWrap = document.getElementById("um-wrap");
  const modal = document.getElementById("login-screen");

  if (modal) modal.style.display = "none";

  if (currentUser) {
    if (authActions) authActions.style.display = "none";
    if (umWrap) umWrap.style.display = "flex";
    initProfile();
    startRealtimeSync();
  } else {
    if (authActions) authActions.style.display = "flex";
    if (umWrap) umWrap.style.display = "none";
    stopRealtimeSync();
  }
}

function lpShowView(id) {
  document
    .querySelectorAll(".lp-view")
    .forEach((v) => v.classList.remove("active"));
  const v = document.getElementById(id);
  if (!v) return;
  v.classList.add("active");
  v.style.animation = "none";
  v.offsetHeight;
  v.style.animation = "";
}

function lpAlert(id, msg, type = "err") {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = msg;
  el.className = "lp-alert " + type + " show";
}

function lpClear(id) {
  const el = document.getElementById(id);
  if (el) el.classList.remove("show");
}

function lpToggleSenha(iid, sid) {
  const inp = document.getElementById(iid);
  const ico = document.getElementById(sid);
  if (!inp || !ico) return;
  if (inp.type === "password") {
    inp.type = "text";
    ico.innerHTML =
      '<path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><line x1="1" y1="1" x2="23" y2="23" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>';
  } else {
    inp.type = "password";
    ico.innerHTML =
      '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><circle cx="12" cy="12" r="3" stroke="currentColor" stroke-width="1.8"/>';
  }
}

function lpForca() {
  const v = document.getElementById("lp-reg-senha")?.value || "";
  const fill = document.getElementById("lp-strength");
  if (!fill) return;
  let s = 0;
  if (v.length >= 6) s++;
  if (v.length >= 10) s++;
  if (/[A-Z]/.test(v)) s++;
  if (/[0-9]/.test(v)) s++;
  if (/[^A-Za-z0-9]/.test(v)) s++;
  fill.style.width = (s / 5) * 100 + "%";
  fill.style.background = s <= 1 ? "#e8743a" : s <= 3 ? "#f5c842" : "#16a393";
}

async function lpLogin() {
  lpClear("lp-login-err");
  const email = document.getElementById("lp-email")?.value.trim().toLowerCase();
  const senha = document.getElementById("lp-senha")?.value;
  const btn = document.getElementById("lp-btn-entrar");
  if (!email || !senha) {
    lpAlert("lp-login-err", "Preencha o e-mail e a senha.");
    if (!email) document.getElementById("lp-email")?.focus();
    else document.getElementById("lp-senha")?.focus();
    return;
  }
  if (btn) {
    btn.textContent = "Entrando…";
    btn.classList.add("loading");
  }

  try {
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, senha }),
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      lpAlert("lp-login-err", data.error || "E-mail ou senha incorretos.");
      if (btn) {
        btn.textContent = "Entrar";
        btn.classList.remove("loading");
      }
      return;
    }

    if (data.token) {
      localStorage.setItem(TOKEN_CACHE_KEY, data.token);
    }
    currentUser = data.user;
    setCachedUser(currentUser);
    updateAuthUI();
    animais = carregarAnimais();
    selecionado = null;
    editando = false;
    renderSidebar();
    renderFicha();
    await syncFromCloud();
    fecharLoginModal();
  } catch (err) {
    lpAlert("lp-login-err", "Falha na comunicação com o servidor.");
  } finally {
    if (btn) {
      btn.textContent = "Entrar";
      btn.classList.remove("loading");
    }
  }
}

async function lpRegistrar() {
  lpClear("lp-reg-err");
  lpClear("lp-reg-ok");
  const nome = document.getElementById("lp-reg-nome")?.value.trim();
  const email = document.getElementById("lp-reg-email")?.value.trim().toLowerCase();
  const senha = document.getElementById("lp-reg-senha")?.value;
  const confirm = document.getElementById("lp-reg-confirm")?.value;
  const btn = document.getElementById("lp-btn-reg");

  if (!nome || nome.length < 2) {
    lpAlert("lp-reg-err", "Informe seu nome ou nome do plantel (mínimo 2 caracteres).");
    document.getElementById("lp-reg-nome")?.focus();
    return;
  }
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  if (!email || !emailRegex.test(email)) {
    lpAlert("lp-reg-err", "Informe um e-mail válido (ex: seu@email.com).");
    document.getElementById("lp-reg-email")?.focus();
    return;
  }
  if (!senha || senha.length < 6) {
    lpAlert("lp-reg-err", "A senha deve ter pelo menos 6 caracteres.");
    document.getElementById("lp-reg-senha")?.focus();
    return;
  }
  if (senha !== confirm) {
    lpAlert("lp-reg-err", "As senhas não coincidem. Verifique a confirmação.");
    document.getElementById("lp-reg-confirm")?.focus();
    return;
  }

  if (btn) {
    btn.textContent = "Criando conta…";
    btn.classList.add("loading");
  }

  try {
    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nome, email, senha }),
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      lpAlert("lp-reg-err", data.error || "Erro ao criar conta.");
      if (btn) {
        btn.textContent = "Criar Conta";
        btn.classList.remove("loading");
      }
      return;
    }

    lpAlert("lp-reg-ok", "Conta criada com sucesso! Entrando…", "ok");
    if (data.token) {
      localStorage.setItem(TOKEN_CACHE_KEY, data.token);
    }
    currentUser = data.user;
    setCachedUser(currentUser);
    animais = carregarAnimais();
    selecionado = null;
    editando = false;
    setTimeout(async () => {
      updateAuthUI();
      renderSidebar();
      renderFicha();
      await syncFromCloud();
      fecharLoginModal();
    }, 800);
  } catch (err) {
    lpAlert("lp-reg-err", "Falha ao conectar com o servidor.");
  } finally {
    if (btn) {
      btn.textContent = "Criar Conta";
      btn.classList.remove("loading");
    }
  }
}

function lpRecuperar() {
  lpClear("lp-rec-err");
  lpClear("lp-rec-ok");
  const email = document.getElementById("lp-rec-email")?.value.trim();
  if (!email) {
    lpAlert("lp-rec-err", "Informe o e-mail cadastrado.");
    return;
  }
  lpAlert(
    "lp-rec-ok",
    "Se este e-mail estiver cadastrado, você receberá as instruções em breve.",
    "ok"
  );
}

document.addEventListener("keydown", (e) => {
  if (e.key !== "Enter") return;
  const id = document.querySelector(".lp-view.active")?.id;
  if (id === "lp-login") lpLogin();
  if (id === "lp-registro") lpRegistrar();
  if (id === "lp-recuperar") lpRecuperar();
});

function showLogin() {
  abrirLoginModal("lp-login");
}

function showApp() {
  const app = document.getElementById("app-screen");
  if (app) app.style.display = "flex";
  updateAuthUI();
  if (typeof initAppExtras === "function") initAppExtras();
  if (typeof renderSidebar === "function") renderSidebar();
  if (typeof renderFicha === "function") renderFicha();
}

async function checkSession() {
  try {
    const res = await fetch("/api/auth/me", {
      headers: getAuthHeaders(),
    });
    if (res.ok) {
      const data = await res.json();
      if (data.authenticated && data.user) {
        currentUser = data.user;
        setCachedUser(currentUser);
        updateAuthUI();
        await syncFromCloud();
        return;
      }
    } else if (res.status === 401) {
      currentUser = null;
      setCachedUser(null);
      localStorage.removeItem(TOKEN_CACHE_KEY);
      updateAuthUI();
      animais = SEED_ANIMAIS.map((a) => ({ ...a }));
      localStorage.setItem(STORAGE_KEY, JSON.stringify(animais));
      localStorage.removeItem(STORAGE_INIT_KEY);
      selecionado = null;
      renderSidebar();
      renderFicha();
      showApp();
      return;
    }
  } catch (e) {
    return;
  }
}

function toggleUserMenu(e) {
  e.stopPropagation();
  document.getElementById("um-wrap")?.classList.toggle("open");
}
function fecharUserMenu() {
  document.getElementById("um-wrap")?.classList.remove("open");
}
document.addEventListener("click", () => fecharUserMenu());

function setTheme(t) {
  document.documentElement.setAttribute("data-theme", t);
  localStorage.setItem("plantel-theme", t);
  if (currentUser) {
    syncToCloud();
  }
}

const STORAGE_KEY = "plantel-animais";
const STORAGE_INIT_KEY = "plantel-iniciado";

const SEED_ANIMAIS = [
  {
    id: 1,
    nome: "Thor",
    especie: "Cão",
    raca: "Labrador Retriever",
    sexo: "Macho",
    nasc: "2020-03-15",
    pelagem: "Amarelo dourado",
    status: "Ativo",
    peso: "32 kg",
    microchip: "985112340001",
    foto: null,
    paiId: null,
    paiNome: "Rex",
    paiRaca: "Labrador",
    maeId: null,
    maeNome: "Bella",
    maeRaca: "Labrador",
    avoPatNome: "Duke",
    avoPatRaca: "Labrador",
    avoMatNome: "Mel",
    avoMatRaca: "Golden Retriever",
    vacinas: [
      { nome: "V10 Polivalente", data: "2024-03-15", prox: "2025-03-15" },
      { nome: "Antirrábica", data: "2024-06-10", prox: "2025-06-10" },
      { nome: "Gripe Canina", data: "2023-09-01", prox: "2024-09-01" },
    ],
    obs: "Alérgico a frango. Escovação semanal e banho a cada 20 dias.\nComportamento dócil com crianças, pode ser reativo com outros cães.",
  },
  {
    id: 2,
    nome: "Lua",
    especie: "Gato",
    raca: "Persa",
    sexo: "Fêmea",
    nasc: "2021-07-22",
    pelagem: "Branca e cinza",
    status: "Em tratamento",
    peso: "4,2 kg",
    microchip: "985112340002",
    foto: null,
    paiId: null,
    paiNome: "Sultan",
    paiRaca: "Persa",
    maeId: null,
    maeNome: "Isis",
    maeRaca: "Persa",
    avoPatNome: "",
    avoPatRaca: "",
    avoMatNome: "",
    avoMatRaca: "",
    vacinas: [
      { nome: "V4 Felina", data: "2024-07-22", prox: "2025-07-22" },
      { nome: "Antirrábica", data: "2024-07-22", prox: "2025-07-22" },
    ],
    obs: "Em tratamento de otite externa. Aplicar gotas 2x ao dia por 10 dias.\nEvitar água nos ouvidos durante o banho.",
  },
];

let _realtimeTimer = null;

function startRealtimeSync() {
  if (_realtimeTimer) clearInterval(_realtimeTimer);
  _realtimeTimer = setInterval(() => {
    if (currentUser && document.visibilityState !== "hidden") {
      syncFromCloud();
    }
  }, 2500);
}

function stopRealtimeSync() {
  if (_realtimeTimer) {
    clearInterval(_realtimeTimer);
    _realtimeTimer = null;
  }
}

async function syncFromCloud() {
  if (!currentUser) return;
  try {
    const res = await fetch("/api/plantel/data", {
      headers: getAuthHeaders(),
    });
    if (res.ok) {
      const data = await res.json();
      let mudou = false;
      if (Array.isArray(data.animais)) {
        const strNovos = JSON.stringify(data.animais);
        const strAtuais = JSON.stringify(animais);
        if (strNovos !== strAtuais) {
          animais = data.animais;
          localStorage.setItem(STORAGE_INIT_KEY, "1");
          localStorage.setItem(getAnimaisStorageKey(), strNovos);
          localStorage.setItem(STORAGE_KEY, strNovos);
          mudou = true;
        }
      }
      if (Array.isArray(data.areas)) {
        const strNovasAreas = JSON.stringify(data.areas);
        const strAtuaisAreas = localStorage.getItem("plantel-areas");
        if (strNovasAreas !== strAtuaisAreas) {
          localStorage.setItem("plantel-areas", strNovasAreas);
          mudou = true;
        }
      }
      if (data.theme) {
        const temaAtual = document.documentElement.getAttribute("data-theme");
        if (data.theme !== temaAtual) {
          document.documentElement.setAttribute("data-theme", data.theme);
          localStorage.setItem("plantel-theme", data.theme);
        }
      }
      if (mudou) {
        if (selecionado && !animais.find((x) => x.id === selecionado)) {
          selecionado = null;
        }
        if (typeof renderSidebar === "function") renderSidebar();
        if (typeof renderFicha === "function") renderFicha();
        if (typeof renderAreaBar === "function") renderAreaBar();
        if (typeof popularSelectAreas === "function") popularSelectAreas();
      }
    }
  } catch (e) {}
}

document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible" && currentUser) {
    syncFromCloud();
  }
});
window.addEventListener("focus", () => {
  if (currentUser) {
    syncFromCloud();
  }
});

async function syncToCloud() {
  if (!currentUser) return;
  try {
    const areas = getAreas();
    const theme = document.documentElement.getAttribute("data-theme") || "light";
    await fetch("/api/plantel/data", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...getAuthHeaders() },
      body: JSON.stringify({ animais, areas, theme }),
    });
  } catch (e) {}
}

function getAnimaisStorageKey() {
  if (currentUser && currentUser.id) {
    return `plantel-animais-${currentUser.id}`;
  }
  return STORAGE_KEY;
}

function carregarAnimais() {
  try {
    if (currentUser && currentUser.id) {
      const userKey = `plantel-animais-${currentUser.id}`;
      const rawUser = localStorage.getItem(userKey);
      if (rawUser) {
        const parsed = JSON.parse(rawUser);
        if (Array.isArray(parsed)) return parsed;
      }
      const rawFallback = localStorage.getItem(STORAGE_KEY);
      if (rawFallback) {
        const parsed = JSON.parse(rawFallback);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
      return [];
    }

    const jaIniciou = localStorage.getItem(STORAGE_INIT_KEY);
    const raw = localStorage.getItem(STORAGE_KEY);
    if (jaIniciou) {
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed;
      }
      return [];
    }
  } catch (e) {}
  return SEED_ANIMAIS.map((a) => ({ ...a }));
}

function salvarAnimais() {
  try {
    localStorage.setItem(STORAGE_INIT_KEY, "1");
    const serialized = JSON.stringify(animais);
    localStorage.setItem(getAnimaisStorageKey(), serialized);
    localStorage.setItem(STORAGE_KEY, serialized);
  } catch (e) {}
  if (currentUser) {
    syncToCloud();
  }
}

let animais = carregarAnimais();

const EMOJIS = {
  Cão: `<span class="noto-emoji">🐕</span>`,
  Gato: `<span class="noto-emoji">🐈</span>`,
  Cavalo: `<span class="noto-emoji">🐴</span>`,
  Bovino: `<span class="noto-emoji">🐄</span>`,
  Suíno: `<span class="noto-emoji">🐷</span>`,
  Ave: `<span class="noto-emoji">🐦</span>`,
  Caprino: `<span class="noto-emoji">🐐</span>`,
  Ovino: `<span class="noto-emoji">🐑</span>`,
  Roedor: `<span class="noto-emoji">🐹</span>`,
  Outro: `<span class="noto-emoji">🐾</span>`,
};

let selecionado = null;
let editando = false;
let filtro = localStorage.getItem("plantel-filtro-especie") || "Todos";
let abaAtiva = "ficha";
let fotoTemp = null;
let viewMode = "lista";

function setViewMode(modo) {
  viewMode = modo;
  document
    .getElementById("btn-view-lista")
    .classList.toggle("active", modo === "lista");
  document
    .getElementById("btn-view-grade")
    .classList.toggle("active", modo === "grade");
  renderSidebar();
}

function toggleTheme() {
  const html = document.documentElement;
  const atual = html.getAttribute("data-theme");
  const novo = atual === "light" ? "dark" : "light";
  setTheme(novo);
}
(function initTheme() {
  const saved = localStorage.getItem("plantel-theme");
  if (saved) document.documentElement.setAttribute("data-theme", saved);
})();

function abrirSidebar() {
  document.getElementById("sidebar").classList.add("open");
  document.getElementById("sidebar-overlay").classList.add("visible");
}
function fecharSidebar() {
  document.getElementById("sidebar").classList.remove("open");
  document.getElementById("sidebar-overlay").classList.remove("visible");
}
function toggleSidebar() {
  const sidebar = document.getElementById("sidebar");
  if (sidebar.classList.contains("open")) {
    fecharSidebar();
  } else {
    abrirSidebar();
  }
}

function calcIdade(nasc) {
  if (!nasc) return "Não informada";
  const d = new Date(nasc + "T12:00:00"),
    hoje = new Date();
  const diffMs = hoje - d;
  const diffDias = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDias < 0) return "Não informada";
  if (diffDias < 30) {
    return diffDias === 0
      ? "Hoje"
      : diffDias + (diffDias === 1 ? " dia" : " dias");
  }
  let anos = hoje.getFullYear() - d.getFullYear();
  const m = hoje.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && hoje.getDate() < d.getDate())) anos--;
  if (anos < 1) {
    const meses =
      (hoje.getFullYear() - d.getFullYear()) * 12 +
      hoje.getMonth() -
      d.getMonth();
    return meses <= 0
      ? diffDias + " dias"
      : meses + (meses === 1 ? " mês" : " meses");
  }
  return anos + (anos === 1 ? " ano" : " anos");
}
function fmtDate(s) {
  if (!s) return "Não informada";
  const [a, m, d] = s.split("-");
  return `${d}/${m}/${a}`;
}
function vacStatus(prox) {
  if (!prox) return "ok";
  const diff = (new Date(prox + "T12:00:00") - new Date()) / 86400000;
  return diff < 0 ? "exp" : diff < 60 ? "vence" : "ok";
}
function pipClass(s) {
  return s === "Ativo"
    ? "pip-ativo"
    : s === "Em tratamento"
      ? "pip-trat"
      : "pip-inativo";
}
function badgeClass(s) {
  return s === "Ativo"
    ? "badge-ativo"
    : s === "Em tratamento"
      ? "badge-trat"
      : "badge-inativo";
}
function pillClass(s) {
  return s === "ok" ? "pill-ok" : s === "vence" ? "pill-vence" : "pill-exp";
}
function pillLabel(s) {
  return s === "ok" ? "Em dia" : s === "vence" ? "Vencendo" : "Expirado";
}
function getEspecies() {
  return ["Todos", ...new Set(animais.map((a) => a.especie))];
}

function renderSidebar() {
  const busca = (
    document.getElementById("search-input")?.value || ""
  ).toLowerCase();

  document.getElementById("filter-tabs").innerHTML = getEspecies()
    .map(
      (e) =>
        `<span class="ftab${filtro === e ? " active" : ""}" onclick="setFiltro('${e}')">${e}</span>`,
    )
    .join("");

  const lista = animais.filter((a) => {
    const okF = filtro === "Todos" || a.especie === filtro;
    const okB =
      !busca ||
      a.nome.toLowerCase().includes(busca) ||
      (a.raca || "").toLowerCase().includes(busca);
    return okF && okB;
  });

  document.getElementById("animal-count").textContent = lista.length;

  document.getElementById("animal-list").innerHTML = lista.length
    ? lista
        .map(
          (a, i) => `
        <div class="animal-item${selecionado === a.id ? " active" : ""}"
             style="animation-delay:${i * 0.04}s"
             onclick="selecionar(${a.id})">
          <div class="animal-thumb">
            ${a.foto ? `<img src="${a.foto}" alt="${a.nome}" />` : EMOJIS[a.especie] || `<span class="noto-emoji">🐾</span>`}
          </div>
          <div class="animal-info">
            <div class="animal-item-name">${a.nome}</div>
            <div class="animal-item-meta">${a.especie}${a.raca ? " · " + a.raca : ""}</div>
          </div>
          <div class="status-pip ${pipClass(a.status)}"></div>
        </div>`,
        )
        .join("")
    : `<div class="animal-empty-state">Nenhum animal encontrado</div>`;

  const ativos = animais.filter((a) => a.status === "Ativo").length;
  const trat = animais.filter((a) => a.status === "Em tratamento").length;
  document.getElementById("stats-bar").innerHTML = `
    <div class="stat-item"><div class="stat-n">${animais.length}</div><div class="stat-l">Total</div></div>
    <div class="stat-item"><div class="stat-n" style="color:var(--c-accent)">${ativos}</div><div class="stat-l">Ativos</div></div>
    <div class="stat-item"><div class="stat-n" style="color:var(--c-amber)">${trat}</div><div class="stat-l">Tratamento</div></div>
  `;
}

function renderFicha() {
  const a = animais.find((x) => x.id === selecionado);
  const empty = document.getElementById("empty-state");
  const topbar = document.getElementById("topbar");
  const topbarTabs = document.querySelector(".topbar-tabs");
  const tabF = document.getElementById("tab-ficha");
  const tabG = document.getElementById("tab-genealogia");
  const tabR = document.getElementById("tab-reproducao");

  const navAnimais = document.getElementById("nav-btn-animais");
  const navRep = document.getElementById("nav-btn-reproducao");
  if (navAnimais && navRep) {
    if (abaAtiva === "reproducao") {
      navAnimais.classList.remove("active");
      navRep.classList.add("active");
    } else {
      navAnimais.classList.add("active");
      navRep.classList.remove("active");
    }
  }

  if (abaAtiva === "reproducao") {
    if (empty) empty.style.display = "none";
    if (topbar) topbar.style.display = "flex";
    if (topbarTabs) {
      topbarTabs.style.visibility = "visible";
      topbarTabs.querySelectorAll(".tab-btn").forEach((b) => {
        if (b.dataset.tab === "reproducao") {
          b.classList.add("active");
          b.style.opacity = "1";
          b.style.pointerEvents = "auto";
        } else {
          b.classList.remove("active");
          b.style.opacity = a ? "1" : "0.45";
          b.style.pointerEvents = a ? "auto" : "none";
        }
      });
    }
    if (tabF) tabF.style.display = "none";
    if (tabG) tabG.style.display = "none";
    if (tabR) tabR.style.display = "block";
    atualizarMobileBottombar(Boolean(a));
    renderReproducao();
    return;
  }

  if (tabR) tabR.style.display = "none";

  if (!a) {
    if (empty) empty.style.display = "flex";
    if (topbar) topbar.style.display = "flex";
    if (topbarTabs) {
      topbarTabs.style.visibility = "visible";
      topbarTabs.querySelectorAll(".tab-btn").forEach((btn) => {
        if (btn.dataset.tab === "reproducao") {
          btn.style.opacity = "1";
          btn.style.pointerEvents = "auto";
        } else {
          btn.style.opacity = "0.45";
          btn.style.pointerEvents = "none";
        }
      });
    }
    if (tabF) tabF.style.display = "none";
    if (tabG) tabG.style.display = "none";
    atualizarMobileBottombar(false);
    return;
  }

  if (empty) empty.style.display = "none";
  if (topbar) topbar.style.display = "flex";
  if (topbarTabs) {
    topbarTabs.style.visibility = "visible";
    topbarTabs.querySelectorAll(".tab-btn").forEach((btn) => {
      btn.style.opacity = "1";
      btn.style.pointerEvents = "auto";
    });
  }
  if (tabF) tabF.style.display = abaAtiva === "ficha" ? "block" : "none";
  if (tabG) tabG.style.display = abaAtiva === "genealogia" ? "block" : "none";

  atualizarMobileBottombar(true);

  if (abaAtiva === "ficha") renderFichaContent(a);
  if (abaAtiva === "genealogia") renderGenealogia(a);
}

function atualizarMobileBottombar(temAnimal) {
  const btns = document.querySelectorAll(".mobile-tab-btn");
  btns.forEach((btn) => {
    if (btn.dataset.tab === "reproducao") {
      btn.disabled = false;
      btn.style.opacity = "1";
    } else {
      btn.disabled = !temAnimal;
      btn.style.opacity = temAnimal ? "1" : "0.4";
    }
  });
}

function renderFichaContent(a) {
  const ed = editando;

  const field = (label, val, id, type = "text", opts = null) => {
    let displayVal = val || "";
    if (id === "nasc" && val) {
      displayVal = fmtDate(val);
    }
    if (id === "peso") {
      if (ed) {
        const parsed = parsePeso(val);
        return `<div class="form-field">
          <label>${label}</label>
          <div class="peso-input-wrap">
            <input type="number" step="0.01" min="0" id="f-peso-val" value="${parsed.valor}" placeholder="0.00" />
            <select id="f-peso-unit">
              <option value="kg"${parsed.unidade === "kg" ? " selected" : ""}>kg</option>
              <option value="g"${parsed.unidade === "g" ? " selected" : ""}>g</option>
            </select>
          </div>
        </div>`;
      }
      return `<div class="form-field">
        <label>${label}</label>
        <div class="field-value">${displayVal || "&nbsp;"}</div>
      </div>`;
    }
    if (id === "area") {
      if (ed) {
        const optsArea = opts || [];
        return `<div class="form-field">
          <label>${label}</label>
          <select id="f-area">
            <option value=""${!val ? " selected" : ""}>Sem área definida</option>
            ${optsArea.filter(Boolean).map((o) => `<option value="${o}"${val === o ? " selected" : ""}>${o}</option>`).join("")}
          </select>
        </div>`;
      }
      return `<div class="form-field">
        <label>${label}</label>
        <div class="field-value">${displayVal || "&nbsp;"}</div>
      </div>`;
    }
    if (ed) {
      if (opts)
        return `<div class="form-field">
        <label>${label}</label>
        <select id="f-${id}">${opts.map((o) => `<option${val === o ? " selected" : ""}>${o}</option>`).join("")}</select>
      </div>`;
      return `<div class="form-field">
        <label>${label}</label>
        <input type="${type}" id="f-${id}" value="${val || ""}" />
      </div>`;
    }
    return `<div class="form-field">
      <label>${label}</label>
      <div class="field-value">${displayVal || "&nbsp;"}</div>
    </div>`;
  };

  const areasDisponiveis = ["", ...getAreas().filter((x) => x !== "Todos")];
  const temVacinas = Boolean((a.vacinas && a.vacinas.length > 0) || a.exibirVacinacao);
  const emTratamento = a.status === "Em tratamento";
  let tratHtml = "";

  if (emTratamento) {
    const trat = a.tratamento || { motivo: "", inicio: "", fim: "", obs: "", remedios: [] };
    const remedios = trat.remedios || [];

    const remediosListHtml = remedios.length
      ? remedios
          .map((rem, idx) => {
            const info = calcularInfoDose(rem);
            return `
            <div class="remedio-card ${info.pendente ? "dose-pendente" : "dose-ok"}">
              <div class="remedio-card-main">
                <div class="remedio-header">
                  <div class="remedio-nome-wrap">
                    <span class="remedio-icon">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:18px;height:18px"><rect x="3" y="8" width="18" height="8" rx="4"/><path d="M12 8v8"/></svg>
                    </span>
                    <div>
                      <strong class="remedio-nome">${rem.nome}</strong>
                      <span class="remedio-dose-tag">${rem.dose || "Dose padrão"}</span>
                    </div>
                  </div>
                  <div class="remedio-header-actions">
                    <span class="remedio-intervalo-badge">A cada ${info.intervaloHoras}h</span>
                    <button type="button" class="btn-action-icon btn-danger" onclick="removerRemedioTratamento(${a.id}, ${idx})" title="Remover medicamento">
                      <svg width="13" height="13" viewBox="0 0 20 20" fill="none"><path d="M4 6h12M8 6V4h4v2M6 6v10h8V6" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>
                    </button>
                  </div>
                </div>

                <div class="remedio-stats-bar">
                  <div class="remedio-count-pill" title="Doses administradas hoje">
                    <span class="count-num">${info.dosesHoje}</span>
                    <span class="count-lbl">hoje</span>
                  </div>
                  <div class="remedio-count-pill" title="Doses administradas nos últimos 7 dias">
                    <span class="count-num">${info.dosesSemana}</span>
                    <span class="count-lbl">na semana</span>
                  </div>
                  <div class="remedio-timing-info">
                    ${
                      info.pendente
                        ? `<span class="timing-badge timing-pendente">
                            <span class="pulse-dot"></span>
                            ${rem.ultimaDose ? "Hora de tomar novamente" : "Primeira dose pendente"}
                           </span>`
                        : `<span class="timing-badge timing-ok">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                            Próxima dose em ${info.tempoRestanteTexto} (às ${info.horaProxima})
                           </span>`
                    }
                  </div>
                </div>
              </div>

              <div class="remedio-card-action">
                ${
                  info.pendente
                    ? `<button type="button" class="btn-dose-registrar" onclick="marcarDoseRemedio(${a.id}, ${idx})" title="Registrar dose como administrada agora">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                        Dar Remédio
                       </button>`
                    : `<div class="dose-tomada-wrap">
                        <span class="dose-tomada-badge">
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                          Dose Tomada
                        </span>
                        <button type="button" class="btn-desfazer-dose" onclick="desfazerDoseRemedio(${a.id}, ${idx})" title="Desfazer última dose">
                          Desfazer
                        </button>
                       </div>`
                }
              </div>
            </div>`;
          })
          .join("")
      : `<div class="vac-empty-state">Nenhum remédio cadastrado para este tratamento</div>`;

    const progressoTexto = calcularProgressoTratamento(trat.inicio, trat.fim);

    tratHtml = `
      <div class="section-card tratamento-card">
        <div class="section-header">
          <div class="section-icon trat-icon-bg">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="3" y="8" width="18" height="8" rx="4"/>
              <path d="M12 8v8"/>
            </svg>
          </div>
          <span class="section-title">Tratamento & Medicamentos</span>
          <div style="margin-left:auto;display:flex;align-items:center;gap:8px">
            <span class="trat-badge-status">Em andamento</span>
            <button type="button" class="btn-action-icon btn-danger" onclick="limparTratamentoAnimal(${a.id})" title="Limpar / Excluir dados do tratamento">
              <svg width="13" height="13" viewBox="0 0 20 20" fill="none"><path d="M4 6h12M8 6V4h4v2M6 6v10h8V6" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>
            </button>
          </div>
        </div>

        <div class="trat-overview-grid">
          ${
            ed
              ? `
              <div class="trat-info-box trat-box-full">
                <span class="trat-lbl">Motivo / Diagnóstico do Tratamento *</span>
                <input id="tr-motivo" type="text" class="trat-input-field" placeholder="Ex: Coccidiose, Infecção respiratória, Vermifugação..." value="${trat.motivo || ""}" />
              </div>
              <div class="trat-info-box">
                <span class="trat-lbl">Data de Início</span>
                <input id="tr-inicio" type="date" class="trat-input-field" value="${trat.inicio || ""}" />
              </div>
              <div class="trat-info-box">
                <span class="trat-lbl">Previsão de Término</span>
                <input id="tr-fim" type="date" class="trat-input-field" value="${trat.fim || ""}" />
              </div>
              <div class="trat-info-box trat-box-full">
                <span class="trat-lbl">Observações e Recomendações</span>
                <input id="tr-obs" type="text" class="trat-input-field" placeholder="Ex: Manter água fresca, evitar correntes de ar..." value="${trat.obs || ""}" />
              </div>`
              : `
              <div class="trat-info-box">
                <span class="trat-lbl">Motivo / Diagnóstico</span>
                <span class="trat-val">${trat.motivo || "Tratamento em andamento"}</span>
              </div>
              <div class="trat-info-box">
                <span class="trat-lbl">Período e Duração</span>
                <div class="trat-val-dates">
                  ${trat.inicio ? fmtDate(trat.inicio) : "Início não definido"}
                  ${trat.fim ? `<span>até</span> ${fmtDate(trat.fim)}` : ""}
                  ${progressoTexto ? `<span class="trat-dias-tag">${progressoTexto}</span>` : ""}
                </div>
              </div>
              ${
                trat.obs
                  ? `
                  <div class="trat-info-box trat-box-full">
                    <span class="trat-lbl">Observações</span>
                    <span class="trat-val-obs">${trat.obs}</span>
                  </div>`
                  : ""
              }`
          }
        </div>

        <div class="trat-remedios-section">
          <div class="trat-sub-header">
            <span class="trat-sub-title">Medicamentos Prescritos</span>
          </div>

          <div class="remedios-list-container">
            ${remediosListHtml}
          </div>

          <div class="add-remedio-box">
            <div class="add-remedio-title">+ Prescrever Medicamento</div>
            <div class="add-remedio-form">
              <div class="form-field">
                <label>Nome do Medicamento *</label>
                <input id="nv-rem-nome" type="text" placeholder="Ex: Baytril, Nalyt, Dipirona..." />
              </div>
              <div class="form-field">
                <label>Dose (Ex: 0.5ml, 2 gotas, 1 comp)</label>
                <input id="nv-rem-dose" type="text" placeholder="Ex: 2 gotas no bebedouro" />
              </div>
              <div class="form-field">
                <label>Intervalo / Frequência *</label>
                <select id="nv-rem-intervalo">
                  <option value="4">A cada 4 horas (6x ao dia)</option>
                  <option value="6">A cada 6 horas (4x ao dia)</option>
                  <option value="8" selected>A cada 8 horas (3x ao dia)</option>
                  <option value="12">A cada 12 horas (2x ao dia)</option>
                  <option value="24">A cada 24 horas (1x ao dia)</option>
                  <option value="48">A cada 48 horas (Dia sim, dia não)</option>
                </select>
              </div>
              <button type="button" class="btn-add-remedio" onclick="adicionarRemedioTratamento(${a.id})">
                + Adicionar Remédio
              </button>
            </div>
          </div>
        </div>
      </div>
    `;
  }


  const vacRows = (a.vacinas || [])
    .map((v, i) => {
      const st = vacStatus(v.prox);
      return `<tr>
      <td>${v.nome}</td>
      <td>${fmtDate(v.data)}</td>
      <td>${fmtDate(v.prox)}</td>
      <td><span class="pill ${pillClass(st)}">${pillLabel(st)}</span></td>
      ${ed ? `<td><span class="vac-remove" onclick="removerVacina(${i})">remover</span></td>` : ""}
    </tr>`;
    })
    .join("");

  const addVacForm = ed
    ? `
    <div class="add-vac-form">
      <div class="form-field"><label>Vacina</label><input id="nv-nome" type="text" placeholder="Nome da vacina" /></div>
      <div class="form-field"><label>Aplicação</label><input id="nv-data" type="date" /></div>
      <div class="form-field"><label>Próxima dose</label><input id="nv-prox" type="date" /></div>
      <button class="btn-add-vac" onclick="adicionarVacina()">+ Adicionar Vacinas</button>
    </div>`
    : "";

  document.getElementById("ficha-content").innerHTML = `
    <div class="ficha-hero">
      ${ed ? `<input type="file" id="foto-input" accept="image/*" style="display:none" onchange="carregarFoto(event)" />` : ""}
      <div class="foto-frame" style="${ed ? "cursor:pointer" : "cursor:default"}" ${ed ? `onclick="abrirFilePicker()"` : ""}> 
          ${
            a.foto
              ? `<img src="${a.foto}" alt="${a.nome}" style="width:100%;height:100%;object-fit:cover;" />`
              : `<span class="foto-emoji">${EMOJIS[a.especie] || `<span class="noto-emoji">🐾</span>`}</span><span class="foto-hint">Sem foto</span>`
          }
          ${
            ed
              ? `<div class="foto-overlay">
            <svg viewBox="0 0 24 24" fill="none"><path d="M12 16a4 4 0 100-8 4 4 0 000 8z" stroke="currentColor" stroke-width="1.5"/><path d="M3 9a2 2 0 012-2h1l2-2h8l2 2h1a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" stroke="currentColor" stroke-width="1.5"/></svg>
            <span>${a.foto ? "Trocar foto" : "Adicionar foto"}</span>
          </div>`
              : ""
          }
        </div>

      <div class="ficha-info">
        ${
          ed
            ? `<input class="nome-edit-input" id="f-nome" value="${a.nome}" />`
            : `<h1 class="ficha-nome">${a.nome}</h1>`
        }
        <div class="ficha-sub">${a.especie}${(() => {
          const i = a.nasc ? calcIdade(a.nasc) : "";
          return i && i !== "Não informada" ? " · " + i : "";
        })()}</div>
        <div class="badge-row">
          <span class="badge ${badgeClass(a.status)}"><span class="badge-dot"></span>${a.status}</span>
        </div>
        <div class="tag-row">
          ${a.sexo ? `<span class="tag-chip">${a.sexo}</span>` : ""}
          ${a.raca ? `<span class="tag-chip">${a.raca}</span>` : ""}
        </div>
        <div class="ficha-actions">
          ${
            ed
              ? `<button class="btn-save" onclick="salvarEdicao()">Salvar alterações</button>
               <button class="btn-cancel" onclick="cancelarEdicao()">Cancelar</button>`
              : `<button class="btn-edit" onclick="iniciarEdicao()">Editar ficha</button>
                 <button class="btn-cert" onclick="abrirModalCertificado(${a.id})" title="Imprimir Certificado para o cliente">
                   <svg viewBox="0 0 20 20" fill="none" style="width:16px;height:16px;vertical-align:-2px"><path d="M5 3h10a2 2 0 012 2v10a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2z" stroke="currentColor" stroke-width="1.6"/><path d="M8 7h4M8 10h4M8 13h2" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>
                   Certificado
                 </button>`
          }
          <button class="btn-delete" onclick="confirmarExclusao(${a.id})">Excluir</button>
        </div>
      </div>
    </div>

    <div class="section-card">
      <div class="section-header">
        <div class="section-icon"><svg viewBox="0 0 24 24" fill="none"><rect x="3" y="4" width="18" height="16" rx="2" stroke="currentColor" stroke-width="1.5"/><path d="M8 2v4M16 2v4M3 10h18" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg></div>
        <span class="section-title">Dados Gerais</span>
      </div>
      <div class="grid-3">
        ${field("Espécie", a.especie, "especie", "text", ["Cão", "Gato", "Cavalo", "Bovino", "Suíno", "Ave", "Caprino", "Ovino", "Roedor", "Outro"])}
        ${field("Raça", a.raca, "raca")}
        ${field("Sexo", a.sexo, "sexo", "text", ["", "Macho", "Fêmea"])}
      </div>
      <div class="grid-3 mt">
        ${field("Nascimento", a.nasc, "nasc", "date")}
        ${field("Peso", a.peso, "peso")}
        ${field("Pelagem / Cor", a.pelagem, "pelagem")}
      </div>
      <div class="grid-3 mt">
        ${field("Microchip / ID", a.microchip, "microchip")}
        ${field("Status", a.status, "status", "text", ["Ativo", "Em tratamento", "Inativo"])}
        ${field("Área / Local", a.area || "", "area", "select", areasDisponiveis)}
      </div>
    </div>
    ${tratHtml}
    ${
      temVacinas
        ? `<div class="section-card">
            <div class="section-header">
              <div class="section-icon"><svg viewBox="0 0 24 24" fill="none"><path d="M9 3l-4 4 8 8 4-4-8-8z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/><path d="M15 7l2 2M5 13l-2 4 4-2M19 5l1-1" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg></div>
              <span class="section-title">Vacinação</span>
              ${ed ? `<button type="button" class="btn-vac-toggle-off" onclick="desativarVacinacaoAnimal(${a.id})" title="Ocultar cartão de vacinas">Ocultar</button>` : ""}
            </div>
            ${
              (a.vacinas || []).length > 0
                ? `<div class="vac-table-wrap">
                    <table class="vac-table">
                      <thead><tr>
                        <th>Vacina</th><th>Aplicação</th><th>Próxima dose</th><th>Situação</th>
                        ${ed ? "<th></th>" : ""}
                      </tr></thead>
                      <tbody>${vacRows}</tbody>
                    </table>
                  </div>`
                : `<div class="vac-empty-state">Nenhuma vacina registrada</div>`
            }
            ${addVacForm}
          </div>`
        : `<div class="vac-optional-trigger">
            <button type="button" class="btn-cta-vac" onclick="ativarVacinacaoAnimal(${a.id})">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg>
              Adicionar Vacinas
            </button>
          </div>`
    }

    <div class="section-card">
      <div class="section-header">
        <div class="section-icon"><svg viewBox="0 0 24 24" fill="none"><path d="M4 6h16M4 10h16M4 14h10" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg></div>
        <span class="section-title">Observações</span>
      </div>
      ${
        ed
          ? `<div class="form-field"><textarea id="f-obs" placeholder="Alergias, comportamento, cuidados especiais...">${a.obs || ""}</textarea></div>`
          : `<div class="obs-text">${a.obs || "Nenhuma observação registrada."}</div>`
      }
    </div>
  `;
}

let _exibirBisavos = localStorage.getItem("plantel-gene-bisavos") === "true";

function toggleBisavos() {
  _exibirBisavos = !_exibirBisavos;
  localStorage.setItem("plantel-gene-bisavos", _exibirBisavos ? "true" : "false");
  const a = animais.find((x) => x.id === selecionado);
  if (a) renderGenealogia(a);
}

function setGeneGeracoes(g) {
  _exibirBisavos = String(g) === "4";
  localStorage.setItem("plantel-gene-bisavos", _exibirBisavos ? "true" : "false");
  const a = animais.find((x) => x.id === selecionado);
  if (a) renderGenealogia(a);
}

function renderGenealogia(a) {
  const emoji = EMOJIS[a.especie] || `<span class="noto-emoji">🐾</span>`;

  const nodeHtml = (nome, raca, role, roleLabel, sexo, extraClass = "") => {
    const hasName = nome && nome.trim();
    const linkedAnimal = hasName
      ? animais.find((x) => x.nome.trim().toLowerCase() === nome.trim().toLowerCase())
      : null;
    const photoSrc = (linkedAnimal && linkedAnimal.foto) || null;
    const thumbContent = photoSrc
      ? `<img src="${photoSrc}" alt="${nome}" />`
      : hasName
        ? emoji
        : "+";
    const inPlantel = linkedAnimal
      ? `<div class="gene-inplantel">no plantel</div>`
      : "";
    const clickAttr =
      role !== "focal" ? `onclick="abrirGeneModal('${role}',${a.id})"` : "";
    const genderClass = sexo === "Macho" ? "macho" : sexo === "Fêmea" ? "femea" : "";
    return `
      <div class="gene-node ${genderClass} ${extraClass}${!hasName ? " unknown" : ""}${role === "focal" ? " focal" : ""}" ${clickAttr} title="${hasName ? nome : 'Clique para adicionar ' + roleLabel}">
        <div class="gene-thumb">${thumbContent}</div>
        <div class="gene-node-role">${roleLabel}</div>
        <div class="gene-node-name">${hasName ? nome : "&nbsp;"}</div>
        <div class="gene-node-info">${raca || (hasName ? "" : "Clique para editar")}</div>
        ${inPlantel}
      </div>`;
  };

  const paiNome = a.paiNome || "";
  const paiRaca = a.paiRaca || "";
  const maeNome = a.maeNome || "";
  const maeRaca = a.maeRaca || "";

  const avoPatNome = a.avoPatNome || "";
  const avoPatRaca = a.avoPatRaca || "";
  const avPatMaeNome = a.avPatMaeNome || "";
  const avPatMaeRaca = a.avPatMaeRaca || "";
  const avMatPaiNome = a.avMatPaiNome || "";
  const avMatPaiRaca = a.avMatPaiRaca || "";
  const avoMatNome = a.avoMatNome || "";
  const avoMatRaca = a.avoMatRaca || "";

  const b_pp_m_n = a.bis_pp_m_nome || "";
  const b_pp_m_r = a.bis_pp_m_raca || "";
  const b_pp_f_n = a.bis_pp_f_nome || "";
  const b_pp_f_r = a.bis_pp_f_raca || "";
  const b_pm_m_n = a.bis_pm_m_nome || "";
  const b_pm_m_r = a.bis_pm_m_raca || "";
  const b_pm_f_n = a.bis_pm_f_nome || "";
  const b_pm_f_r = a.bis_pm_f_raca || "";

  const b_mp_m_n = a.bis_mp_m_nome || "";
  const b_mp_m_r = a.bis_mp_m_raca || "";
  const b_mp_f_n = a.bis_mp_f_nome || "";
  const b_mp_f_r = a.bis_mp_f_raca || "";
  const b_mm_m_n = a.bis_mm_m_nome || "";
  const b_mm_m_r = a.bis_mm_m_raca || "";
  const b_mm_f_n = a.bis_mm_f_nome || "";
  const b_mm_f_r = a.bis_mm_f_raca || "";

  const hasBisavos = Boolean(
    b_pp_m_n || b_pp_f_n || b_pm_m_n || b_pm_f_n ||
    b_mp_m_n || b_mp_f_n || b_mm_m_n || b_mm_f_n
  );
  const showBisavos = _exibirBisavos || hasBisavos;

  document.getElementById("genealogia-content").innerHTML = `
    <div class="gene-header">
      <div class="gene-header-top">
        <div class="gene-header-info">
          <h2 class="gene-title">
            Árvore Genealógica
            <span class="gene-animal-badge">${emoji} ${a.nome}</span>
          </h2>
          <p class="gene-sub">
            <span>${a.especie}</span>
            ${a.raca ? `<span class="gene-sub-dot"></span><span>${a.raca}</span>` : ""}
            ${(() => {
              const i = a.nasc ? calcIdade(a.nasc) : "";
              return i && i !== "Não informada"
                ? `<span class="gene-sub-dot"></span><span>${i}</span>`
                : "";
            })()}
            ${a.sexo ? `<span class="gene-sub-dot"></span><span>${a.sexo}</span>` : ""}
          </p>
        </div>
        <div class="gene-header-actions">
          <button type="button" class="gene-btn-action ${showBisavos ? 'active' : ''}" onclick="toggleBisavos()">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
              ${showBisavos
                ? '<path d="M18 6L6 18M6 6l12 12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>'
                : '<path d="M12 5v14M5 12h14" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>'
              }
            </svg>
            ${showBisavos ? "Ocultar Bisavós" : "Adicionar Bisavós"}
          </button>
        </div>
      </div>
      <div class="gene-header-hint">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" style="opacity:0.7">
          <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="1.8"/>
          <path d="M12 16v-4M12 8h.01" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
        </svg>
        <span>Clique em qualquer cartão para visualizar ou cadastrar parentes.</span>
      </div>
    </div>

    <div class="gene-viewport">
      <div class="gene-tree">
        <!-- Branches Row: Paterno e Materno -->
        <div class="gene-branches-row">

          <!-- Ramo Paterno -->
          <div class="gene-branch" style="width: ${showBisavos ? '504px' : '352px'};">
            ${showBisavos ? `
              <div class="gene-branches-row" style="gap: 8px; margin-bottom: 6px;">
                <div class="gene-branch" style="width: 248px;">
                  <div class="gene-pair gene-pair-bis">
                    ${nodeHtml(b_pp_m_n, b_pp_m_r, "bis_pp_m", "Bisavô (Pat.)", "Macho", "gene-bis")}
                    ${nodeHtml(b_pp_f_n, b_pp_f_r, "bis_pp_f", "Bisavó (Pat.)", "Fêmea", "gene-bis")}
                  </div>
                  <div class="gene-pair-connector-box" style="height: 24px;">
                    <div class="gene-pair-line bis-line"></div>
                  </div>
                </div>
                <div class="gene-branch" style="width: 248px;">
                  <div class="gene-pair gene-pair-bis">
                    ${nodeHtml(b_pm_m_n, b_pm_m_r, "bis_pm_m", "Bisavô (Pat.)", "Macho", "gene-bis")}
                    ${nodeHtml(b_pm_f_n, b_pm_f_r, "bis_pm_f", "Bisavó (Pat.)", "Fêmea", "gene-bis")}
                  </div>
                  <div class="gene-pair-connector-box" style="height: 24px;">
                    <div class="gene-pair-line bis-line"></div>
                  </div>
                </div>
              </div>
            ` : ""}

            <div class="gene-pair">
              ${nodeHtml(avoPatNome, avoPatRaca, "avo", "Avô paterno", "Macho")}
              ${nodeHtml(avPatMaeNome, avPatMaeRaca, "avopat_f", "Avó paterna", "Fêmea")}
            </div>
            <div class="gene-pair-connector-box">
              <div class="gene-pair-line"></div>
            </div>
            <div style="display: flex; justify-content: center; width: 100%;">
              ${nodeHtml(paiNome, paiRaca, "pai", "Pai", "Macho")}
            </div>
          </div>

          <!-- Ramo Materno -->
          <div class="gene-branch" style="width: ${showBisavos ? '504px' : '352px'};">
            ${showBisavos ? `
              <div class="gene-branches-row" style="gap: 8px; margin-bottom: 6px;">
                <div class="gene-branch" style="width: 248px;">
                  <div class="gene-pair gene-pair-bis">
                    ${nodeHtml(b_mp_m_n, b_mp_m_r, "bis_mp_m", "Bisavô (Mat.)", "Macho", "gene-bis")}
                    ${nodeHtml(b_mp_f_n, b_mp_f_r, "bis_mp_f", "Bisavó (Mat.)", "Fêmea", "gene-bis")}
                  </div>
                  <div class="gene-pair-connector-box" style="height: 24px;">
                    <div class="gene-pair-line bis-line"></div>
                  </div>
                </div>
                <div class="gene-branch" style="width: 248px;">
                  <div class="gene-pair gene-pair-bis">
                    ${nodeHtml(b_mm_m_n, b_mm_m_r, "bis_mm_m", "Bisavô (Mat.)", "Macho", "gene-bis")}
                    ${nodeHtml(b_mm_f_n, b_mm_f_r, "bis_mm_f", "Bisavó (Mat.)", "Fêmea", "gene-bis")}
                  </div>
                  <div class="gene-pair-connector-box" style="height: 24px;">
                    <div class="gene-pair-line bis-line"></div>
                  </div>
                </div>
              </div>
            ` : ""}

            <div class="gene-pair">
              ${nodeHtml(avMatPaiNome, avMatPaiRaca, "avomat_m", "Avô materno", "Macho")}
              ${nodeHtml(avoMatNome, avoMatRaca, "avomat", "Avó materna", "Fêmea")}
            </div>
            <div class="gene-pair-connector-box">
              <div class="gene-pair-line"></div>
            </div>
            <div style="display: flex; justify-content: center; width: 100%;">
              ${nodeHtml(maeNome, maeRaca, "mae", "Mãe", "Fêmea")}
            </div>
          </div>

        </div>

        <!-- Conector Pai + Mãe -> Animal Focal -->
        <div class="gene-pair-connector-box" style="width: ${showBisavos ? '1044px' : '740px'}; max-width: 100%;">
          <div class="gene-pair-line" style="width: ${showBisavos ? 'calc(100% - 504px)' : 'calc(100% - 352px)'};"></div>
        </div>

        <!-- Animal Focal -->
        <div style="display: flex; justify-content: center; width: 100%; margin-top: 0;">
          ${nodeHtml(a.nome, a.raca, "focal", "Animal", a.sexo)}
        </div>
      </div>
    </div>
  `;
}

const GENE_ROLES = {
  pai: {
    label: "Pai",
    sexo: "Macho",
    field: { nome: "paiNome", raca: "paiRaca", idade: "paiIdade" },
  },
  mae: {
    label: "Mãe",
    sexo: "Fêmea",
    field: { nome: "maeNome", raca: "maeRaca", idade: "maeIdade" },
  },
  avo: {
    label: "Avô Paterno",
    sexo: "Macho",
    field: { nome: "avoPatNome", raca: "avoPatRaca", idade: "avoPatIdade" },
  },
  avopat_f: {
    label: "Avó Paterna",
    sexo: "Fêmea",
    field: { nome: "avPatMaeNome", raca: "avPatMaeRaca", idade: "avPatMaeIdade" },
  },
  avomat_m: {
    label: "Avô Materno",
    sexo: "Macho",
    field: { nome: "avMatPaiNome", raca: "avMatPaiRaca", idade: "avMatPaiIdade" },
  },
  avomat: {
    label: "Avó Materna",
    sexo: "Fêmea",
    field: { nome: "avoMatNome", raca: "avoMatRaca", idade: "avoMatIdade" },
  },
  bis_pp_m: {
    label: "Bisavô (Pai do Avô Paterno)",
    sexo: "Macho",
    field: { nome: "bis_pp_m_nome", raca: "bis_pp_m_raca", idade: "bis_pp_m_idade" },
  },
  bis_pp_f: {
    label: "Bisavó (Mãe do Avô Paterno)",
    sexo: "Fêmea",
    field: { nome: "bis_pp_f_nome", raca: "bis_pp_f_raca", idade: "bis_pp_f_idade" },
  },
  bis_pm_m: {
    label: "Bisavô (Pai da Avó Paterna)",
    sexo: "Macho",
    field: { nome: "bis_pm_m_nome", raca: "bis_pm_m_raca", idade: "bis_pm_m_idade" },
  },
  bis_pm_f: {
    label: "Bisavó (Mãe da Avó Paterna)",
    sexo: "Fêmea",
    field: { nome: "bis_pm_f_nome", raca: "bis_pm_f_raca", idade: "bis_pm_f_idade" },
  },
  bis_mp_m: {
    label: "Bisavô (Pai do Avô Materno)",
    sexo: "Macho",
    field: { nome: "bis_mp_m_nome", raca: "bis_mp_m_raca", idade: "bis_mp_m_idade" },
  },
  bis_mp_f: {
    label: "Bisavó (Mãe do Avô Materno)",
    sexo: "Fêmea",
    field: { nome: "bis_mp_f_nome", raca: "bis_mp_f_raca", idade: "bis_mp_f_idade" },
  },
  bis_mm_m: {
    label: "Bisavô (Pai da Avó Materna)",
    sexo: "Macho",
    field: { nome: "bis_mm_m_nome", raca: "bis_mm_m_raca", idade: "bis_mm_m_idade" },
  },
  bis_mm_f: {
    label: "Bisavó (Mãe da Avó Materna)",
    sexo: "Fêmea",
    field: { nome: "bis_mm_f_nome", raca: "bis_mm_f_raca", idade: "bis_mm_f_idade" },
  },
};

let geneModalRole = null;
let geneModalAnimalId = null;
let geneModalSelectedId = null;

function abrirGeneModal(role, animalId) {
  geneModalRole = role;
  geneModalAnimalId = animalId;
  geneModalSelectedId = null;

  const cfg = GENE_ROLES[role];
  const a = animais.find((x) => x.id === animalId);
  if (!a || !cfg) return;

  const compatíveis = animais.filter(
    (x) => x.id !== animalId && x.especie === a.especie && x.sexo === cfg.sexo,
  );

  const nomeAtual = a[cfg.field.nome] || "";
  const racaExemplo =
    {
      Cão: "Ex: Labrador Retriever",
      Gato: "Ex: Persa",
      Ave: "Ex: Calopsita",
      Bovino: "Ex: Nelore",
      Equino: "Ex: Quarto de Milha",
      Suíno: "Ex: Landrace",
      Caprino: "Ex: Saanen",
      Ovino: "Ex: Santa Inês",
    }[a.especie] || "Ex: raça do animal";

  const racaAtual = a[cfg.field.raca] || "";

  const currentLinked = nomeAtual
    ? animais.find(
        (x) => x.nome.trim() === nomeAtual.trim() && x.id !== animalId,
      )
    : null;
  if (currentLinked) geneModalSelectedId = currentLinked.id;

  const roleBadgeClass =
    {
      pai: "role-pai",
      mae: "role-mae",
      avo: "role-avo",
      avomat: "role-avomat",
    }[role] || "role-pai";

  const plantelItems = compatíveis.length
    ? compatíveis
        .map((x) => {
          const thumbContent = x.foto
            ? `<img src="${x.foto}" />`
            : EMOJIS[x.especie] || `<span class="noto-emoji">🐾</span>`;
          const isSelected = geneModalSelectedId === x.id;
          return `<div class="gene-plantel-item${isSelected ? " selected" : ""}"
                     onclick="selecionarGeneAnimal(${x.id})"
                     data-gene-id="${x.id}">
          <div class="gene-plantel-thumb">${thumbContent}</div>
          <div class="gene-plantel-info">
            <div class="gene-plantel-name">${x.nome}</div>
            <div class="gene-plantel-meta">${x.raca || x.especie}${x.nasc ? " · " + calcIdade(x.nasc) : ""}</div>
          </div>
        </div>`;
        })
        .join("")
    : "";

  const idadeAtual = a[cfg.field.nome] ? a[cfg.field.idade] || "" : "";

  const html = `
    <div class="gene-modal-overlay" id="gene-modal-overlay" onclick="fecharGeneModalExterno(event)">
      <div class="gene-modal-box">
        <div class="gene-modal-header">
          <div class="gene-modal-title">
            <span class="gene-modal-role-badge ${roleBadgeClass}">${cfg.label}</span>
            de ${a.nome}
          </div>
          <button class="modal-close" onclick="fecharGeneModal()">
            <svg viewBox="0 0 20 20" fill="none">
              <path d="M5 5l10 10M15 5L5 15" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
            </svg>
          </button>
        </div>
        <div class="gene-modal-body">
          ${
            compatíveis.length
              ? `
            <div style="font-size:11px;font-weight:600;color:var(--c-text-3);text-transform:uppercase;letter-spacing:.07em;margin-bottom:10px">Do plantel · ${cfg.sexo === "Macho" ? "machos" : "fêmeas"} de ${a.especie}</div>
            <div class="gene-plantel-list" id="gene-plantel-list">${plantelItems}</div>
            <div class="gene-or-divider">ou preencha manualmente</div>
          `
              : ""
          }
          <div class="form-field" style="margin-bottom:12px">
            <label>Nome</label>
            <input id="gene-modal-nome" type="text" placeholder="Nome do ${cfg.label.toLowerCase()}"
                   value="${nomeAtual}" oninput="deselecionarGeneAnimal()" />
          </div>
          <div class="form-field" style="margin-bottom:12px">
            <label>Raça <span style="font-weight:400;font-size:10px;text-transform:none;letter-spacing:0;opacity:.65">(opcional)</span></label>
            <input id="gene-modal-raca" type="text" placeholder="${racaExemplo}"
                   value="${racaAtual}" />
          </div>
          <div class="form-field" style="margin-bottom:4px">
            <label>Idade <span style="font-weight:400;font-size:10px;text-transform:none;letter-spacing:0;opacity:.65">(opcional)</span></label>
            <input id="gene-modal-idade" type="text" placeholder="Ex: 3 anos"
                   value="${idadeAtual}" />
          </div>
        </div>
        <div class="gene-modal-footer">
          <button class="btn-ghost" onclick="limparGeneModal()">Remover</button>
          <button class="btn-primary" onclick="salvarGeneModal()">Salvar</button>
        </div>
      </div>
    </div>`;

  const existing = document.getElementById("gene-modal-overlay");
  if (existing) existing.remove();

  document.body.insertAdjacentHTML("beforeend", html);

  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      const overlay = document.getElementById("gene-modal-overlay");
      if (overlay) overlay.classList.add("visible");
    });
  });
}

function selecionarGeneAnimal(id) {
  geneModalSelectedId = id;
  const animal = animais.find((x) => x.id === id);
  if (!animal) return;

  document.querySelectorAll(".gene-plantel-item").forEach((el) => {
    el.classList.toggle("selected", parseInt(el.dataset.geneId) === id);
  });

  const nomeInput = document.getElementById("gene-modal-nome");
  const racaInput = document.getElementById("gene-modal-raca");
  if (nomeInput) nomeInput.value = animal.nome;
  if (racaInput) racaInput.value = animal.raca || "";
}

function deselecionarGeneAnimal() {
  geneModalSelectedId = null;
  document.querySelectorAll(".gene-plantel-item").forEach((el) => {
    el.classList.remove("selected");
  });
}

function fecharGeneModal() {
  const overlay = document.getElementById("gene-modal-overlay");
  if (!overlay) return;
  overlay.classList.remove("visible");
  setTimeout(() => {
    overlay.remove();
  }, 220);
}

function fecharGeneModalExterno(e) {
  if (e.target === document.getElementById("gene-modal-overlay"))
    fecharGeneModal();
}

function salvarGeneModal() {
  const a = animais.find((x) => x.id === geneModalAnimalId);
  const cfg = GENE_ROLES[geneModalRole];
  if (!a || !cfg) return;

  const nome = (document.getElementById("gene-modal-nome")?.value || "").trim();
  const raca = (document.getElementById("gene-modal-raca")?.value || "").trim();
  const idade = (
    document.getElementById("gene-modal-idade")?.value || ""
  ).trim();

  a[cfg.field.nome] = nome;
  a[cfg.field.raca] = raca;
  a[cfg.field.idade] = idade;
  salvarAnimais();
  fecharGeneModal();
  renderGenealogia(a);
}

function limparGeneModal() {
  const a = animais.find((x) => x.id === geneModalAnimalId);
  const cfg = GENE_ROLES[geneModalRole];
  if (!a || !cfg) return;
  a[cfg.field.nome] = "";
  a[cfg.field.raca] = "";
  a[cfg.field.idade] = "";
  salvarAnimais();
  fecharGeneModal();
  renderGenealogia(a);
}

function selecionar(id) {
  if (abaAtiva === "reproducao") {
    abaAtiva = "ficha";
    document.querySelectorAll(".tab-btn, .mobile-tab-btn").forEach((b) => {
      if (b.dataset.tab === "ficha") b.classList.add("active");
      else b.classList.remove("active");
    });
    const navAnimais = document.getElementById("nav-btn-animais");
    const navRep = document.getElementById("nav-btn-reproducao");
    if (navAnimais && navRep) {
      navAnimais.classList.add("active");
      navRep.classList.remove("active");
    }
  }
  if (selecionado === id) {
    selecionado = null;
    editando = false;
    fotoTemp = null;
    renderSidebar();
    renderFicha();
    return;
  }
  selecionado = id;
  editando = false;
  fotoTemp = null;
  renderSidebar();
  renderFicha();
  fecharSidebar();
}
function setFiltro(f) {
  filtro = f;
  localStorage.setItem("plantel-filtro-especie", f);
  renderSidebar();
}
function filtrarAnimais() {
  renderSidebar();
}

function irParaAba(tab) {
  if (tab === "animais") tab = "ficha";
  switchTab(tab);
}

function switchTab(tab, el) {
  abaAtiva = tab;
  document.querySelectorAll(".tab-btn, .mobile-tab-btn").forEach((b) => {
    if (b.dataset.tab === tab) b.classList.add("active");
    else b.classList.remove("active");
  });

  const navAnimais = document.getElementById("nav-btn-animais");
  const navRep = document.getElementById("nav-btn-reproducao");
  if (navAnimais && navRep) {
    if (tab === "reproducao") {
      navAnimais.classList.remove("active");
      navRep.classList.add("active");
    } else {
      navAnimais.classList.add("active");
      navRep.classList.remove("active");
    }
  }

  renderFicha();
}

function iniciarEdicao() {
  editando = true;
  renderFicha();
}
function cancelarEdicao() {
  editando = false;
  fotoTemp = null;
  renderFicha();
}

function salvarEdicao() {
  const a = animais.find((x) => x.id === selecionado);
  if (!a) return;
  const g = (id) => document.getElementById(id)?.value ?? "";
  a.nome = g("f-nome") || a.nome;
  a.especie = g("f-especie") || a.especie;
  a.raca = g("f-raca");
  a.sexo = g("f-sexo");
  a.nasc = g("f-nasc");
  const pVal = document.getElementById("f-peso-val")?.value?.trim();
  const pUnit = document.getElementById("f-peso-unit")?.value || "kg";
  a.peso = pVal ? `${pVal.replace(",", ".")} ${pUnit}` : (g("f-peso") || "");
  a.pelagem = g("f-pelagem");
  a.microchip = g("f-microchip");
  a.status = g("f-status") || a.status;
  a.area = g("f-area");
  a.obs = g("f-obs");
  if (fotoTemp) {
    a.foto = fotoTemp;
    fotoTemp = null;
  }
  if (a.status === "Em tratamento" && !a.tratamento) {
    a.tratamento = { motivo: "", inicio: new Date().toISOString().slice(0, 10), fim: "", obs: "", remedios: [] };
  }
  if (document.getElementById("tr-motivo")) {
    if (!a.tratamento) a.tratamento = { motivo: "", inicio: "", fim: "", obs: "", remedios: [] };
    a.tratamento.motivo = g("tr-motivo");
    a.tratamento.inicio = g("tr-inicio");
    a.tratamento.fim = g("tr-fim");
    a.tratamento.obs = g("tr-obs");
  }
  editando = false;
  salvarAnimais();
  renderSidebar();
  renderFicha();
}

function ativarVacinacaoAnimal(id) {
  const a = animais.find((x) => x.id === id);
  if (!a) return;
  a.exibirVacinacao = true;
  if (!a.vacinas) a.vacinas = [];
  editando = true;
  salvarAnimais();
  renderFicha();
}

function desativarVacinacaoAnimal(id) {
  const a = animais.find((x) => x.id === id);
  if (!a) return;
  if (a.vacinas && a.vacinas.length > 0) {
    if (!confirm("Deseja ocultar a vacinação e remover as vacinas registradas deste animal?")) return;
    a.vacinas = [];
  }
  a.exibirVacinacao = false;
  salvarAnimais();
  renderFicha();
}

function adicionarVacina() {
  const a = animais.find((x) => x.id === selecionado);
  const nome = document.getElementById("nv-nome")?.value?.trim();
  if (!nome) return;
  a.vacinas.push({
    nome,
    data: document.getElementById("nv-data")?.value || "",
    prox: document.getElementById("nv-prox")?.value || "",
  });
  salvarAnimais();
  renderFicha();
}

function removerVacina(i) {
  const a = animais.find((x) => x.id === selecionado);
  if (!a) return;
  mostrarConfirm(
    `Remover a vacina "${a.vacinas[i].nome}"?`,
    "Esta ação não pode ser desfeita.",
    () => {
      a.vacinas.splice(i, 1);
      salvarAnimais();
      renderFicha();
    },
  );
}

function limparTratamentoAnimal(id) {
  mostrarConfirm("Excluir Tratamento", "Deseja excluir os dados e histórico deste tratamento?", () => {
    const a = animais.find((x) => x.id === id);
    if (!a) return;
    a.tratamento = null;
    salvarAnimais();
    renderFicha();
  });
}

function calcularProgressoTratamento(inicio, fim) {
  if (!inicio && !fim) return "";
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);

  if (inicio && fim) {
    const dIni = new Date(inicio + "T00:00:00");
    const dFim = new Date(fim + "T00:00:00");
    const totalDias = Math.max(1, Math.round((dFim - dIni) / (86400 * 1000)) + 1);
    const diasPassados = Math.max(1, Math.round((hoje - dIni) / (86400 * 1000)) + 1);

    if (hoje > dFim) {
      return `Período concluído (${totalDias} dias)`;
    } else if (hoje < dIni) {
      const faltam = Math.round((dIni - hoje) / (86400 * 1000));
      return `Inicia em ${faltam} dias (${totalDias} dias de duração)`;
    } else {
      const restantes = Math.max(0, Math.round((dFim - hoje) / (86400 * 1000)));
      return `Dia ${diasPassados} de ${totalDias} · ${restantes} dias restantes`;
    }
  } else if (inicio) {
    const dIni = new Date(inicio + "T00:00:00");
    const dias = Math.max(1, Math.round((hoje - dIni) / (86400 * 1000)) + 1);
    return `${dias}º dia de tratamento`;
  } else if (fim) {
    const dFim = new Date(fim + "T00:00:00");
    const restantes = Math.round((dFim - hoje) / (86400 * 1000));
    return restantes >= 0 ? `${restantes} dias restantes` : "Previsão ultrapassada";
  }
  return "";
}

function calcularInfoDose(rem) {
  const agora = Date.now();
  const hist = rem.historicoDoses || [];

  const hojeStr = new Date().toDateString();
  const dosesHoje = hist.filter((ts) => new Date(ts).toDateString() === hojeStr).length;

  const seteDiasAtras = agora - 7 * 24 * 3600 * 1000;
  const dosesSemana = hist.filter((ts) => ts >= seteDiasAtras).length;

  const intervaloHoras = parseFloat(rem.intervaloHoras) || 8;
  const intervaloMs = intervaloHoras * 3600 * 1000;

  let pendente = true;
  let tempoRestanteMs = 0;
  let proximaDoseTs = null;

  if (rem.ultimaDose) {
    proximaDoseTs = rem.ultimaDose + intervaloMs;
    tempoRestanteMs = proximaDoseTs - agora;
    if (tempoRestanteMs > 0) {
      pendente = false;
    }
  }

  let tempoRestanteTexto = "";
  if (!pendente && tempoRestanteMs > 0) {
    const minsTotal = Math.floor(tempoRestanteMs / 60000);
    const horas = Math.floor(minsTotal / 60);
    const mins = minsTotal % 60;
    if (horas > 0) {
      tempoRestanteTexto = `${horas}h ${mins}min`;
    } else {
      tempoRestanteTexto = `${mins}min`;
    }
  }

  const horaProxima = proximaDoseTs
    ? new Date(proximaDoseTs).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    : "";
  const horaUltima = rem.ultimaDose
    ? new Date(rem.ultimaDose).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    : "";

  return {
    dosesHoje,
    dosesSemana,
    pendente,
    tempoRestanteTexto,
    horaProxima,
    horaUltima,
    intervaloHoras
  };
}

function adicionarRemedioTratamento(animalId) {
  const a = animais.find((x) => x.id === animalId);
  if (!a) return;
  const nome = document.getElementById("nv-rem-nome")?.value?.trim();
  const dose = document.getElementById("nv-rem-dose")?.value?.trim();
  const intervaloHoras = parseFloat(document.getElementById("nv-rem-intervalo")?.value) || 8;

  if (!nome) {
    mostrarDialog({ title: "Campo Obrigatório", desc: "Por favor, informe o nome do medicamento." });
    return;
  }

  if (!a.tratamento) {
    a.tratamento = { motivo: "", inicio: new Date().toISOString().slice(0, 10), fim: "", obs: "", remedios: [] };
  }
  if (!a.tratamento.remedios) a.tratamento.remedios = [];

  a.tratamento.remedios.push({
    id: Date.now(),
    nome,
    dose: dose || "1 dose",
    intervaloHoras,
    ultimaDose: null,
    historicoDoses: []
  });

  salvarAnimais();
  renderFicha();
}

function removerRemedioTratamento(animalId, idx) {
  mostrarConfirm("Remover Medicamento", "Deseja remover este medicamento do tratamento?", () => {
    const a = animais.find((x) => x.id === animalId);
    if (!a || !a.tratamento || !a.tratamento.remedios) return;
    a.tratamento.remedios.splice(idx, 1);
    salvarAnimais();
    renderFicha();
  });
}

function marcarDoseRemedio(animalId, idx) {
  const a = animais.find((x) => x.id === animalId);
  if (!a || !a.tratamento || !a.tratamento.remedios) return;
  const rem = a.tratamento.remedios[idx];
  if (!rem) return;

  const agora = Date.now();
  if (!rem.historicoDoses) rem.historicoDoses = [];
  rem.historicoDoses.push(agora);
  rem.ultimaDose = agora;

  salvarAnimais();
  renderFicha();
}

function desfazerDoseRemedio(animalId, idx) {
  const a = animais.find((x) => x.id === animalId);
  if (!a || !a.tratamento || !a.tratamento.remedios) return;
  const rem = a.tratamento.remedios[idx];
  if (!rem || !rem.historicoDoses || rem.historicoDoses.length === 0) return;

  rem.historicoDoses.pop();
  rem.ultimaDose = rem.historicoDoses.length ? rem.historicoDoses[rem.historicoDoses.length - 1] : null;

  salvarAnimais();
  renderFicha();
}

if (!window._tratamentoTimer) {
  window._tratamentoTimer = setInterval(() => {
    if (abaAtiva === "ficha" && selecionado && !editando) {
      const a = animais.find((x) => x.id === selecionado);
      if (a && a.status === "Em tratamento") {
        renderFicha();
      }
    }
  }, 20000);
}

function carregarFoto(event) {
  if (!editando) return;
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    abrirCropModal(e.target.result);
  };
  reader.readAsDataURL(file);
  event.target.value = "";
}

let cropState = {
  img: null,
  scale: 1,
  offsetX: 0,
  offsetY: 0,
  dragging: false,
  startX: 0,
  startY: 0,
  lastX: 0,
  lastY: 0,
};

function abrirCropModal(src, target) {
  const old = document.getElementById("crop-modal");
  if (old) old.remove();

  const modal = document.createElement("div");
  modal.id = "crop-modal";
  modal.style.cssText = `
    position:fixed;inset:0;z-index:9999;
    background:rgba(0,0,0,0.85);
    display:flex;align-items:center;justify-content:center;
    backdrop-filter:blur(6px);
    animation:fadeIn 0.2s ease;
  `;
  modal.innerHTML = `
    <div id="crop-box" style="
      background:var(--c-card);
      border-radius:16px;
      padding:24px;
      width:min(420px,95vw);
      box-shadow:0 24px 80px rgba(0,0,0,0.5);
      animation:slideUp 0.25s ease;
    ">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
        <span style="font-weight:600;font-size:15px;color:var(--c-text-1)">Ajustar foto</span>
        <button onclick="fecharCropModal()" style="background:none;border:none;color:var(--c-text-3);cursor:pointer;font-size:20px;line-height:1;padding:2px 6px">×</button>
      </div>

      <div id="crop-viewport" style="
        width:100%;height:320px;
        border-radius:12px;
        background:#111;
        overflow:hidden;
        position:relative;
        cursor:grab;
        user-select:none;
        touch-action:none;
      ">
        <img id="crop-img" src="${src}" style="
          position:absolute;
          transform-origin:center center;
          pointer-events:none;
          max-width:none;
        " draggable="false" />
        <div style="
          position:absolute;inset:0;
          pointer-events:none;
          box-shadow:inset 0 0 0 3px rgba(255,255,255,0.4);
          border-radius:12px;
        "></div>
        <svg style="position:absolute;inset:0;width:100%;height:100%;pointer-events:none;opacity:0.2" viewBox="0 0 3 3" preserveAspectRatio="none">
          <line x1="1" y1="0" x2="1" y2="3" stroke="white" stroke-width="0.03"/>
          <line x1="2" y1="0" x2="2" y2="3" stroke="white" stroke-width="0.03"/>
          <line x1="0" y1="1" x2="3" y2="1" stroke="white" stroke-width="0.03"/>
          <line x1="0" y1="2" x2="3" y2="2" stroke="white" stroke-width="0.03"/>
        </svg>
      </div>

      <div style="margin-top:14px;display:flex;align-items:center;gap:10px">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" style="flex-shrink:0;color:var(--c-text-3)">
          <circle cx="11" cy="11" r="8" stroke="currentColor" stroke-width="1.8"/>
          <path d="M21 21l-2-2M11 8v6M8 11h6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
        </svg>
        <input type="range" id="crop-zoom" min="10" max="300" value="100" style="flex:1;accent-color:var(--c-accent);cursor:pointer" oninput="aplicarZoom(this.value)" />
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" style="flex-shrink:0;color:var(--c-text-3)">
          <circle cx="11" cy="11" r="8" stroke="currentColor" stroke-width="1.8"/>
          <path d="M21 21l-2-2M11 8v6M8 11h6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
        </svg>
      </div>
      <p style="text-align:center;font-size:11px;color:var(--c-text-3);margin-top:6px">Arraste para reposicionar · Use o controle para zoom</p>

      <div style="display:flex;gap:10px;margin-top:20px">
        <button onclick="fecharCropModal()" style="
          flex:1;padding:10px;border:1.5px solid var(--c-border);
          background:none;border-radius:8px;color:var(--c-text-2);
          font-family:inherit;font-size:13.5px;cursor:pointer;
          transition:background 0.15s;
        " onmouseover="this.style.background='var(--c-raised)'" onmouseout="this.style.background='none'">Cancelar</button>
        <button onclick="confirmarCrop()" style="
          flex:1;padding:10px;border:none;
          background:var(--c-accent);border-radius:8px;color:#fff;
          font-family:inherit;font-size:13.5px;font-weight:600;cursor:pointer;
          transition:opacity 0.15s;
        " onmouseover="this.style.opacity='0.85'" onmouseout="this.style.opacity='1'">Aplicar foto</button>
      </div>
    </div>`;
  document.body.appendChild(modal);

  const img = document.getElementById("crop-img");
  const viewport = document.getElementById("crop-viewport");
  cropState = {
    scale: 1,
    offsetX: 0,
    offsetY: 0,
    dragging: false,
    startX: 0,
    startY: 0,
    lastX: 0,
    lastY: 0,
    src,
    target: target || "animal",
  };

  img.onload = () => {
    const vw = viewport.clientWidth,
      vh = viewport.clientHeight;
    const ratio = Math.max(vw / img.naturalWidth, vh / img.naturalHeight);
    cropState.scale = ratio;
    cropState.offsetX = (vw - img.naturalWidth * ratio) / 2;
    cropState.offsetY = (vh - img.naturalHeight * ratio) / 2;
    document.getElementById("crop-zoom").value = Math.round(ratio * 100);
    applyTransform();
  };

  viewport.addEventListener("mousedown", startDrag);
  viewport.addEventListener("mousemove", doDrag);
  viewport.addEventListener("mouseup", endDrag);
  viewport.addEventListener("mouseleave", endDrag);
  viewport.addEventListener(
    "touchstart",
    (e) => {
      e.preventDefault();
      startDrag(e.touches[0]);
    },
    { passive: false },
  );
  viewport.addEventListener(
    "touchmove",
    (e) => {
      e.preventDefault();
      doDrag(e.touches[0]);
    },
    { passive: false },
  );
  viewport.addEventListener("touchend", endDrag);
  viewport.addEventListener(
    "wheel",
    (e) => {
      e.preventDefault();
      const delta = e.deltaY > 0 ? -5 : 5;
      const newVal = Math.min(
        300,
        Math.max(
          10,
          parseInt(document.getElementById("crop-zoom").value) + delta,
        ),
      );
      document.getElementById("crop-zoom").value = newVal;
      aplicarZoom(newVal);
    },
    { passive: false },
  );
}

function startDrag(e) {
  cropState.dragging = true;
  cropState.startX = e.clientX - cropState.offsetX;
  cropState.startY = e.clientY - cropState.offsetY;
  document.getElementById("crop-viewport").style.cursor = "grabbing";
}
function doDrag(e) {
  if (!cropState.dragging) return;
  cropState.offsetX = e.clientX - cropState.startX;
  cropState.offsetY = e.clientY - cropState.startY;
  applyTransform();
}
function endDrag() {
  cropState.dragging = false;
  const vp = document.getElementById("crop-viewport");
  if (vp) vp.style.cursor = "grab";
}
function aplicarZoom(val) {
  const img = document.getElementById("crop-img");
  if (!img) return;
  const vp = document.getElementById("crop-viewport");
  const vw = vp.clientWidth,
    vh = vp.clientHeight;
  const oldScale = cropState.scale;
  cropState.scale = val / 100;

  cropState.offsetX =
    vw / 2 - (vw / 2 - cropState.offsetX) * (cropState.scale / oldScale);
  cropState.offsetY =
    vh / 2 - (vh / 2 - cropState.offsetY) * (cropState.scale / oldScale);
  applyTransform();
}
function applyTransform() {
  const img = document.getElementById("crop-img");
  if (!img) return;
  img.style.transform = `translate(${cropState.offsetX}px, ${cropState.offsetY}px) scale(${cropState.scale})`;
  img.style.left = "0px";
  img.style.top = "0px";
  img.style.transformOrigin = "0 0";
}

function confirmarCrop() {
  const img = document.getElementById("crop-img");
  const viewport = document.getElementById("crop-viewport");
  if (!img || !viewport) return;

  const vw = viewport.clientWidth,
    vh = viewport.clientHeight;
  const canvas = document.createElement("canvas");
  const size = Math.min(vw, vh);
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");

  const sx = -cropState.offsetX / cropState.scale;
  const sy = -cropState.offsetY / cropState.scale;
  const sw = size / cropState.scale;
  const sh = size / cropState.scale;

  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, size, size);
  const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
  fecharCropModal();

  if (cropState.target === "perfil") {
    _perfilAvatarPending = dataUrl;
    const avatarEl = document.getElementById("perfil-avatar-large");
    if (avatarEl) avatarEl.src = dataUrl;
  } else {
    fotoTemp = dataUrl;
    const frame = document.querySelector(".foto-frame");
    if (frame) {
      frame.innerHTML = `
        <img src="${fotoTemp}" alt="foto" style="width:100%;height:100%;object-fit:cover;" />
        <div class="foto-overlay">
          <svg viewBox="0 0 24 24" fill="none" style="width:20px;height:20px;color:white"><path d="M12 16a4 4 0 100-8 4 4 0 000 8z" stroke="currentColor" stroke-width="1.5"/><path d="M3 9a2 2 0 012-2h1l2-2h8l2 2h1a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" stroke="currentColor" stroke-width="1.5"/></svg>
          <span>Trocar foto</span>
        </div>`;
      frame.onclick = () => document.getElementById("foto-input")?.click();
    }
  }
}

function fecharCropModal() {
  const modal = document.getElementById("crop-modal");
  if (modal) modal.remove();
}

function abrirModal() {
  document.getElementById("modal").style.display = "flex";
}
function fecharModal() {
  document.getElementById("modal").style.display = "none";
  ["m-nome", "m-raca", "m-id", "m-pelagem", "m-nasc", "m-peso-val"].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.value = "";
  });
  const pesoUnit = document.getElementById("m-peso-unit");
  if (pesoUnit) pesoUnit.value = "kg";

  const especieLbl = document.getElementById("especie-modal-label");
  if (especieLbl) especieLbl.textContent = "Selecione";
  const especieHid = document.getElementById("m-especie");
  if (especieHid) especieHid.value = "";
  document.getElementById("especie-modal-dropdown")?.classList.remove("open");

  const sexoHid = document.getElementById("m-sexo");
  if (sexoHid) sexoHid.value = "";
  const sexoLbl = document.getElementById("sexo-modal-label");
  if (sexoLbl) sexoLbl.textContent = "Não definido";

  const statusHid = document.getElementById("m-status");
  if (statusHid) statusHid.value = "Ativo";
  const statusLbl = document.getElementById("status-modal-label");
  if (statusLbl) statusLbl.textContent = "Ativo";

  const areaHid = document.getElementById("m-area");
  if (areaHid) areaHid.value = "";
  const areaLbl = document.getElementById("area-modal-label");
  if (areaLbl) areaLbl.textContent = "Sem área definida";

  closeAllModalCombos();
}
function fecharModalExterno(e) {
  if (e.target === document.getElementById("modal")) fecharModal();
}

function salvarNovoAnimal() {
  const nome = document.getElementById("m-nome")?.value?.trim();
  const especie = document.getElementById("m-especie")?.value;
  if (!nome || !especie) {
    mostrarAlerta("Preencha pelo menos o nome e a espécie.");
    return;
  }
  const pVal = document.getElementById("m-peso-val")?.value?.trim();
  const pUnit = document.getElementById("m-peso-unit")?.value || "kg";
  const peso = pVal ? `${pVal.replace(",", ".")} ${pUnit}` : "";

  const novo = {
    id: Date.now(),
    nome,
    especie,
    raca: document.getElementById("m-raca")?.value || "",
    sexo: document.getElementById("m-sexo")?.value || "",
    nasc: document.getElementById("m-nasc")?.value || "",
    pelagem: document.getElementById("m-pelagem")?.value || "",
    status: document.getElementById("m-status")?.value || "Ativo",
    peso: peso,
    microchip: document.getElementById("m-id")?.value || "",
    foto: null,
    paiNome: "",
    paiRaca: "",
    maeNome: "",
    maeRaca: "",
    avoPatNome: "",
    avoPatRaca: "",
    avoMatNome: "",
    avoMatRaca: "",
    vacinas: [],
    obs: "",
  };
  animais.push(novo);
  salvarAnimais();
  fecharModal();
  selecionado = novo.id;
  editando = false;
  renderSidebar();
  renderFicha();
}

function confirmarExclusao(id) {
  const a = animais.find((x) => x.id === id);
  if (!a) return;
  mostrarConfirm(
    `Excluir a ficha de "${a.nome}"?`,
    "Esta ação não pode ser desfeita.",
    () => {
      animais = animais.filter((x) => x.id !== id);
      selecionado = null;
      editando = false;
      salvarAnimais();
      renderSidebar();
      renderFicha();
    },
  );
}

function mostrarAlerta(mensagem) {
  const overlay = document.getElementById("dialog-overlay");
  document.getElementById("dialog-title").textContent = mensagem;
  document.getElementById("dialog-desc").textContent = "";
  document.getElementById("dialog-cancel").style.display = "none";
  document.getElementById("dialog-confirm").textContent = "OK";
  document.getElementById("dialog-confirm").onclick = () => fecharDialog();
  overlay.style.display = "flex";
  requestAnimationFrame(() => overlay.classList.add("visible"));
}

function mostrarConfirm(titulo, desc, onConfirm) {
  const overlay = document.getElementById("dialog-overlay");
  document.getElementById("dialog-title").textContent = titulo;
  document.getElementById("dialog-desc").textContent = desc || "";
  document.getElementById("dialog-cancel").style.display = "";
  document.getElementById("dialog-confirm").textContent = "Confirmar";
  document.getElementById("dialog-confirm").onclick = () => {
    fecharDialog();
    onConfirm();
  };
  overlay.style.display = "flex";
  requestAnimationFrame(() => overlay.classList.add("visible"));
}

function fecharDialogExterno(e) {
  if (e.target === document.getElementById("dialog-overlay")) fecharDialog();
}

function fecharDialog() {
  const overlay = document.getElementById("dialog-overlay");
  overlay.classList.remove("visible");
  overlay.addEventListener(
    "transitionend",
    () => {
      overlay.style.display = "none";
    },
    { once: true },
  );
}

function mostrarDialog(opts) {
  if (typeof opts === "string") {
    mostrarAlerta(opts);
    return;
  }
  if (opts.onConfirm) {
    mostrarConfirm(opts.title || "Confirmação", opts.desc || "", opts.onConfirm);
  } else {
    mostrarAlerta(opts.title || opts.desc || "");
  }
}

function abrirFilePicker() {
  if (!editando) return;
  const inp = document.getElementById("foto-input");
  if (inp) inp.click();
}

async function logout() {
  try {
    await fetch("/api/auth/logout", {
      method: "POST",
      headers: getAuthHeaders(),
    });
  } catch (e) {}
  currentUser = null;
  setCachedUser(null);
  localStorage.removeItem(TOKEN_CACHE_KEY);
  fecharUserMenu();
  updateAuthUI();

  animais = SEED_ANIMAIS.map((a) => ({ ...a }));
  localStorage.setItem(STORAGE_KEY, JSON.stringify(animais));
  localStorage.removeItem(STORAGE_INIT_KEY);
  salvarAreas(["Todos"]);

  areaFiltro = "Todos";
  filtro = "Todos";
  localStorage.setItem("plantel-filtro-especie", "Todos");
  const sInp = document.getElementById("search-input");
  if (sInp) sInp.value = "";
  popularSelectAreas();
  renderAreaBar();

  selecionado = null;
  editando = false;
  fotoTemp = null;
  casais = SEED_CASAIS.map((c) => ({ ...c }));
  localStorage.setItem(getCasaisStorageKey(), JSON.stringify(casais));

  renderSidebar();
  renderFicha();
  showApp();
}

const AREAS_KEY = "plantel-areas";
const PROFILE_KEY = "plantel-profile";

const RACAS_PRESET = {
  Cão: [
    "Labrador Retriever",
    "Golden Retriever",
    "Bulldog",
    "Poodle",
    "Beagle",
    "Border Collie",
    "Pastor Alemão",
    "Shih Tzu",
    "Rottweiler",
    "Dachshund",
    "Boxer",
    "Dobermann",
    "Husky Siberiano",
    "Maltês",
    "Pinscher",
  ],
  Gato: [
    "Persa",
    "Siamês",
    "Maine Coon",
    "Ragdoll",
    "Bengal",
    "Angorá",
    "Scottish Fold",
    "British Shorthair",
    "Sphynx",
    "Abissínio",
    "Burmês",
    "Birmanês",
    "Norueguês da Floresta",
  ],
  Cavalo: [
    "Quarto de Milha",
    "Mangalarga Marchador",
    "Mangalarga Paulista",
    "Campolina",
    "Árabe",
    "Puro Sangue Inglês",
    "Appaloosa",
    "Lusitano",
    "Crioulo",
    "Paint Horse",
    "Tennessee Walking",
    "Andaluz",
  ],
  Bovino: [
    "Nelore",
    "Angus",
    "Hereford",
    "Brahman",
    "Girolando",
    "Gir",
    "Simental",
    "Limousin",
    "Charolês",
    "Brangus",
    "Indubrasil",
    "Tabapuã",
    "Canchim",
  ],
  Suíno: [
    "Landrace",
    "Large White",
    "Duroc",
    "Pietrain",
    "Hampshire",
    "Berkshire",
    "Wessex Saddleback",
  ],
  Ave: [
    "Calopsita",
    "Agapornis",
    "Canário",
    "Periquito Australiano",
    "Papagaio Verdadeiro",
    "Cacatua",
    "Diamante de Gould",
    "Arara Canindé",
    "Fringilo",
    "Coleiro",
    "Bicudo",
    "Pintassilgo",
  ],
  Caprino: [
    "Saanen",
    "Boer",
    "Alpina",
    "Toggenburg",
    "Anglo-Nubiana",
    "Parda Alpina",
    "Moxotó",
    "Canindé",
  ],
  Ovino: [
    "Santa Inês",
    "Dorper",
    "Suffolk",
    "Ile de France",
    "Merino",
    "Bergamácia",
    "Texel",
    "Hampshire Down",
  ],
  Roedor: [
    "Porquinho da Índia",
    "Hamster Sírio",
    "Hamster Anão",
    "Gerbil",
    "Rato Doméstico",
    "Camundongo",
    "Chinchila",
    "Ouriço",
    "Degus",
    "Esquilo",
  ],
};

function getAreas() {
  try {
    return JSON.parse(localStorage.getItem(AREAS_KEY) || '["Todos"]');
  } catch {
    return ["Todos"];
  }
}
function salvarAreas(areas) {
  localStorage.setItem(AREAS_KEY, JSON.stringify(areas));
  if (currentUser) {
    syncToCloud();
  }
}

let areaFiltro = "Todos";

let _sortKey = localStorage.getItem("plantel-sort-key") || "nome";

const SORT_OPTIONS = [
  { value: "nome", label: "Nome" },
  { value: "especie", label: "Espécie" },
  { value: "raca", label: "Raça" },
  { value: "idade", label: "Idade" },
  { value: "sexo", label: "Sexo" },
  { value: "id", label: "ID" },
];

let _openComboId = null;
const _comboItemsCache = {};

function _getOrCreateDropdown(id) {
  let dd = document.getElementById(id + "-dropdown");
  if (!dd) {
    dd = document.createElement("div");
    dd.id = id + "-dropdown";
    dd.className = "ctrl-combo-dropdown";
    document.body.appendChild(dd);
  }
  return dd;
}

function _populateDropdown(id, items, selectedValue) {
  const dd = _getOrCreateDropdown(id);
  dd.innerHTML = items
    .map(
      (item) =>
        `<div class="ctrl-combo-item${item.value === selectedValue ? " active" : ""}"
          onclick="selectCtrlCombo('${id}','${item.value.replace(/\\/g, "\\\\").replace(/'/g, "\\'")}')"
        >${item.label}</div>`,
    )
    .join("");
}

function renderCtrlCombo(id, items, selectedValue) {
  _comboItemsCache[id] = { items, selectedValue };
  const label = document.getElementById(id + "-label");
  if (label) {
    const sel = items.find((i) => i.value === selectedValue) || items[0];
    label.textContent = sel ? sel.label : "";
  }

  if (_openComboId === id) {
    _populateDropdown(id, items, selectedValue);
  }
}

function _openCombo(id) {
  closeAllCtrlDropdowns();
  const wrap = document.getElementById(id + "-wrap");
  if (!wrap) return;

  const cached = _comboItemsCache[id];
  if (!cached) return;

  const dd = _getOrCreateDropdown(id);
  _populateDropdown(id, cached.items, cached.selectedValue);

  const rect = wrap.getBoundingClientRect();
  dd.style.top = rect.bottom + 4 + "px";
  dd.style.left = rect.left + "px";
  dd.style.width = rect.width + "px";
  dd.classList.add("open");
  wrap.classList.add("open");
  _openComboId = id;
}

function toggleCtrlDropdown(id, e) {
  e.stopPropagation();
  if (_openComboId === id) {
    closeAllCtrlDropdowns();
  } else {
    _openCombo(id);
  }
}

function selectCtrlCombo(id, value) {
  closeAllCtrlDropdowns();
  if (id === "area-combo") {
    areaFiltro = value;
    const especiesNaArea =
      areaFiltro === "Todos"
        ? animais.map((a) => a.especie)
        : animais
            .filter((a) => (a.area || "") === areaFiltro)
            .map((a) => a.especie);
    if (filtro !== "Todos" && !especiesNaArea.includes(filtro))
      filtro = "Todos";
    localStorage.setItem("plantel-filtro-especie", filtro);
    renderSidebar();
  } else if (id === "especie-combo") {
    filtro = value;
    localStorage.setItem("plantel-filtro-especie", filtro);
    renderSidebar();
  } else if (id === "sort-combo") {
    _sortKey = value;
    localStorage.setItem("plantel-sort-key", _sortKey);
    renderSidebar();
  }
}

function closeAllCtrlDropdowns() {
  document
    .querySelectorAll(".ctrl-combo-dropdown.open")
    .forEach((el) => el.classList.remove("open"));
  document
    .querySelectorAll(".ctrl-combo-wrap.open")
    .forEach((el) => el.classList.remove("open"));
  _openComboId = null;
}

document.addEventListener("click", (e) => {
  if (
    !e.target.closest(".ctrl-combo-wrap") &&
    !e.target.closest(".ctrl-combo-dropdown")
  ) {
    closeAllCtrlDropdowns();
  }
});

const ESPECIES_MODAL = [
  "Cão",
  "Gato",
  "Cavalo",
  "Bovino",
  "Suíno",
  "Ave",
  "Caprino",
  "Ovino",
  "Roedor",
  "Outro",
];

function renderEspecieDropdown() {
  const dd = document.getElementById("especie-modal-dropdown");
  if (!dd) return;
  const cur = document.getElementById("m-especie")?.value;
  dd.innerHTML = ESPECIES_MODAL.map(
    (e) =>
      `<div class="raca-dropdown-item${e === cur ? " active" : ""}" onmousedown="selecionarEspecie('${e}',event)">${e}</div>`,
  ).join("");
}

function toggleEspecieDropdown(e) {
  e.preventDefault();
  e.stopPropagation();
  if (e.target.closest(".raca-dropdown-item")) return;
  const dd = document.getElementById("especie-modal-dropdown");
  const wrap = document.getElementById("especie-modal-wrap");
  if (!dd) return;
  if (dd.classList.contains("open")) {
    dd.classList.remove("open");
    wrap?.classList.remove("raca-combo-open");
  } else {
    renderEspecieDropdown();
    dd.classList.add("open");
    wrap?.classList.add("raca-combo-open");
  }
}

function selecionarEspecie(esp, e) {
  if (e) e.preventDefault();
  const hidden = document.getElementById("m-especie");
  const label = document.getElementById("especie-modal-label");
  if (hidden) hidden.value = esp;
  if (label) label.textContent = esp;
  document.getElementById("especie-modal-dropdown")?.classList.remove("open");
  document
    .getElementById("especie-modal-wrap")
    ?.classList.remove("raca-combo-open");
  atualizarRacasModal();
}

document.addEventListener("click", (e) => {
  if (!e.target.closest("#especie-modal-wrap")) {
    document.getElementById("especie-modal-dropdown")?.classList.remove("open");
    document
      .getElementById("especie-modal-wrap")
      ?.classList.remove("raca-combo-open");
  }
});

function renderAreaBar() {
  const areas = getAreas();
  const items = areas.map((a) => ({
    value: a,
    label: a === "Todos" ? "Todas as áreas" : a,
  }));
  renderCtrlCombo("area-combo", items, areaFiltro, null);
}

function setAreaFiltroSelect() {
  renderSidebar();
}

function setFiltroSelect() {
  renderSidebar();
}

function setAreaFiltro(area) {
  areaFiltro = area;
  const especiesNaArea =
    areaFiltro === "Todos"
      ? animais.map((a) => a.especie)
      : animais
          .filter((a) => (a.area || "") === areaFiltro)
          .map((a) => a.especie);
  if (filtro !== "Todos" && !especiesNaArea.includes(filtro)) {
    filtro = "Todos";
    localStorage.setItem("plantel-filtro-especie", filtro);
  }
  renderSidebar();
}

const _origRenderSidebar = renderSidebar;
renderSidebar = function () {
  const busca = (
    document.getElementById("search-input")?.value || ""
  ).toLowerCase();

  const _especiesNaArea =
    areaFiltro === "Todos"
      ? animais.map((a) => a.especie)
      : animais
          .filter((a) => (a.area || "") === areaFiltro)
          .map((a) => a.especie);
  const _especiesTabs = ["Todos", ...new Set(_especiesNaArea)];

  const especieItems = _especiesTabs.map((e) => ({
    value: e,
    label: e === "Todos" ? "Espécies" : e,
  }));
  renderCtrlCombo("especie-combo", especieItems, filtro, null);
  renderCtrlCombo("sort-combo", SORT_OPTIONS, _sortKey, null);
  renderAreaBar();

  const filterTabsEl = document.getElementById("filter-tabs");
  if (filterTabsEl) filterTabsEl.innerHTML = "";

  let lista = animais.filter((a) => {
    const okF = filtro === "Todos" || a.especie === filtro;
    const okA = areaFiltro === "Todos" || (a.area || "") === areaFiltro;
    const okB =
      !busca ||
      a.nome.toLowerCase().includes(busca) ||
      (a.raca || "").toLowerCase().includes(busca);
    return okF && okA && okB;
  });

  lista.sort((a, b) => {
    if (_sortKey === "nome") return (a.nome || "").localeCompare(b.nome || "");
    if (_sortKey === "especie") {
      const cmpEsp = (a.especie || "").localeCompare(b.especie || "");
      if (cmpEsp !== 0) return cmpEsp;
      return (a.raca || "").localeCompare(b.raca || "");
    }
    if (_sortKey === "raca") {
      const cmpRaca = (a.raca || "").localeCompare(b.raca || "");
      if (cmpRaca !== 0) return cmpRaca;
      return (a.especie || "").localeCompare(b.especie || "");
    }
    if (_sortKey === "sexo") return (a.sexo || "").localeCompare(b.sexo || "");
    if (_sortKey === "id") {
      const na = typeof a.id === "number" ? a.id : parseInt(a.id) || 0;
      const nb = typeof b.id === "number" ? b.id : parseInt(b.id) || 0;
      return na - nb;
    }
    if (_sortKey === "idade") {
      const da = a.nasc ? new Date(a.nasc) : new Date(0);
      const db = b.nasc ? new Date(b.nasc) : new Date(0);
      return db - da;
    }
    return 0;
  });

  document.getElementById("animal-count").textContent = lista.length;

  const animalListEl = document.getElementById("animal-list");
  animalListEl.className =
    viewMode === "grade" ? "animal-list animal-grade" : "animal-list";

  if (!lista.length) {
    animalListEl.innerHTML = `<div class="animal-empty-state">Nenhum animal encontrado</div>`;
  } else if (viewMode === "grade") {
    animalListEl.innerHTML = lista
      .map(
        (a, i) => `
      <div class="animal-grade-item${selecionado === a.id ? " active" : ""}"
           style="animation-delay:${i * 0.04}s"
           onclick="selecionar(${a.id})"
           title="${a.nome}">
        <div class="animal-grade-thumb">
          ${a.foto ? `<img src="${a.foto}" alt="${a.nome}" />` : EMOJIS[a.especie] || `<span class="noto-emoji" style="font-size:28px">🐾</span>`}
        </div>
        <div class="grade-pip-wrap"><div class="status-pip ${pipClass(a.status)}"></div></div>
      </div>`,
      )
      .join("");
  } else {
    animalListEl.innerHTML = lista
      .map(
        (a, i) => `
      <div class="animal-item${selecionado === a.id ? " active" : ""}"
           style="animation-delay:${i * 0.04}s"
           onclick="selecionar(${a.id})">
        <div class="animal-thumb">
          ${a.foto ? `<img src="${a.foto}" alt="${a.nome}" />` : EMOJIS[a.especie] || `<span class="noto-emoji">🐾</span>`}
        </div>
        <div class="animal-info">
          <div class="animal-item-name">${a.nome}</div>
          <div class="animal-item-meta">${a.especie}${a.raca ? " · " + a.raca : ""}</div>
          ${a.area ? `<span class="animal-area-chip">${a.area}</span>` : ""}
        </div>
        <div class="status-pip ${pipClass(a.status)}"></div>
      </div>`,
      )
      .join("");
  }

  const ativos = animais.filter((a) => a.status === "Ativo").length;
  const trat = animais.filter((a) => a.status === "Em tratamento").length;
  document.getElementById("stats-bar").innerHTML = `
    <div class="stat-item"><div class="stat-n">${animais.length}</div><div class="stat-l">Total</div></div>
    <div class="stat-item"><div class="stat-n" style="color:var(--c-accent)">${ativos}</div><div class="stat-l">Ativos</div></div>
    <div class="stat-item"><div class="stat-n" style="color:var(--c-amber)">${trat}</div><div class="stat-l">Tratamento</div></div>`;
};

function abrirGerenciarAreas() {
  renderAreasList();
  document.getElementById("modal-areas").style.display = "flex";
}
function fecharModalAreas() {
  document.getElementById("modal-areas").style.display = "none";
  renderSidebar();
}
function fecharModalAreasExterno(e) {
  if (e.target === document.getElementById("modal-areas")) fecharModalAreas();
}

function renderAreasList() {
  const areas = getAreas().filter((a) => a !== "Todos");
  const el = document.getElementById("areas-list");
  el.innerHTML = areas.length
    ? areas
        .map(
          (a, i) => `
      <div class="area-manage-item">
        <span>${a}</span>
        <button class="area-remove-btn" onclick="removerArea(${i})">Remover</button>
      </div>`,
        )
        .join("")
    : `<div style="font-size:12px;color:var(--c-text-3);text-align:center;padding:10px">Nenhuma área criada ainda.</div>`;
}

function adicionarArea() {
  const inp = document.getElementById("area-nome-input");
  const nome = inp.value.trim();
  if (!nome) return;
  const areas = getAreas();
  if (!areas.includes(nome)) {
    areas.push(nome);
    salvarAreas(areas);
  }
  inp.value = "";
  renderAreasList();
  popularSelectAreas();
}

function removerArea(idx) {
  const areas = getAreas();
  const nome = areas.filter((a) => a !== "Todos")[idx];
  const real = areas.indexOf(nome);
  areas.splice(real, 1);
  salvarAreas(areas);
  if (areaFiltro === nome) areaFiltro = "Todos";

  animais.forEach((a) => {
    if (a.area === nome) a.area = "";
  });
  salvarAnimais();
  renderAreasList();
  popularSelectAreas();
}

const _MODAL_COMBO_OPTIONS = {
  sexo: [
    { value: "", label: "Não definido" },
    { value: "Macho", label: "Macho" },
    { value: "Fêmea", label: "Fêmea" },
  ],
  status: [
    { value: "Ativo", label: "Ativo" },
    { value: "Em tratamento", label: "Em tratamento" },
    { value: "Inativo", label: "Inativo" },
  ],
  area: [],
};

let _openModalComboId = null;

function _getOrCreateModalDropdown(id) {
  let dd = document.getElementById("modal-combo-dd-" + id);
  if (!dd) {
    dd = document.createElement("div");
    dd.id = "modal-combo-dd-" + id;
    dd.className = "raca-dropdown modal-combo-dropdown";
    document.body.appendChild(dd);
  }
  return dd;
}

function toggleModalCombo(id, e) {
  e.stopPropagation();
  if (_openModalComboId === id) {
    closeAllModalCombos();
    return;
  }
  closeAllModalCombos();
  const wrap = document.getElementById(id + "-modal-wrap");
  if (!wrap) return;

  const opts = _MODAL_COMBO_OPTIONS[id] || [];
  const currentVal = document.getElementById("m-" + id)?.value || "";

  const dd = _getOrCreateModalDropdown(id);
  dd.innerHTML = opts
    .map(
      (o) =>
        `<div class="raca-dropdown-item${o.value === currentVal ? " active" : ""}"
      onclick="selectModalCombo('${id}','${o.value.replace(/'/g, "\\'")}','${o.label.replace(/'/g, "\\'")}')"
    >${o.label}</div>`,
    )
    .join("");

  const rect = wrap.getBoundingClientRect();
  dd.style.position = "fixed";
  dd.style.top = rect.bottom + 4 + "px";
  dd.style.left = rect.left + "px";
  dd.style.width = rect.width + "px";
  dd.style.zIndex = "9999";
  dd.classList.add("open");
  wrap.classList.add("raca-combo-open");
  _openModalComboId = id;
}

function selectModalCombo(id, value, label) {
  const hidden = document.getElementById("m-" + id);
  const lbl = document.getElementById(id + "-modal-label");
  if (hidden) hidden.value = value;
  if (lbl) lbl.textContent = label;
  closeAllModalCombos();
}

function closeAllModalCombos() {
  document
    .querySelectorAll(".modal-combo-dropdown.open")
    .forEach((el) => el.classList.remove("open"));
  document
    .querySelectorAll(".raca-combo-wrap.raca-combo-open")
    .forEach((el) => el.classList.remove("raca-combo-open"));
  _openModalComboId = null;
}

document.addEventListener("click", (e) => {
  if (
    !e.target.closest(".raca-combo-wrap") &&
    !e.target.closest(".modal-combo-dropdown")
  ) {
    closeAllModalCombos();
  }
});

function popularSelectAreas() {
  const areas = getAreas().filter((a) => a !== "Todos");
  _MODAL_COMBO_OPTIONS.area = [
    { value: "", label: "Sem área definida" },
    ...areas.map((a) => ({ value: a, label: a })),
  ];
  const currentArea = document.getElementById("m-area")?.value || "";
  if (currentArea && !areas.includes(currentArea)) {
    const hidden = document.getElementById("m-area");
    const lbl = document.getElementById("area-modal-label");
    if (hidden) hidden.value = "";
    if (lbl) lbl.textContent = "Sem área definida";
  }
}

const RACA_PLACEHOLDERS = {
  Cão: "Ex: Labrador Retriever",
  Gato: "Ex: Persa",
  Cavalo: "Ex: Quarto de Milha",
  Bovino: "Ex: Nelore",
  Suíno: "Ex: Landrace",
  Ave: "Ex: Calopsita",
  Caprino: "Ex: Saanen",
  Ovino: "Ex: Santa Inês",
  Roedor: "Ex: Porquinho da Índia",
  Outro: "Ex: raça do animal",
};

function atualizarRacasModal() {
  const esp = document.getElementById("m-especie")?.value;
  const racas = RACAS_PRESET[esp] || [];
  const inp = document.getElementById("m-raca");
  if (inp) {
    inp.placeholder = RACA_PLACEHOLDERS[esp] || "Ex: raça do animal";
    inp.value = "";
  }
  window._racasAtual = racas;
  renderRacaDropdown(racas);
}

let _racaDropdownOpen = false;

function renderRacaDropdown(racas) {
  const dd = document.getElementById("raca-dropdown");
  if (!dd) return;
  const val = (document.getElementById("m-raca")?.value || "").toLowerCase();
  const filtered = val
    ? racas.filter((r) => r.toLowerCase().includes(val))
    : racas;
  if (!filtered.length) {
    dd.innerHTML = "";
    dd.classList.remove("open");
    return;
  }
  dd.innerHTML = filtered
    .map(
      (r) =>
        `<div class="raca-dropdown-item" onmousedown="selecionarRaca('${r.replace(/'/g, "\\'")}',event)">${r}</div>`,
    )
    .join("");
}

function filtrarRacaDropdown() {
  const racas = window._racasAtual || [];
  renderRacaDropdown(racas);
  document.getElementById("raca-dropdown")?.classList.add("open");
}

function abrirRacaDropdown() {
  const racas = window._racasAtual || [];
  renderRacaDropdown(racas);
  if (racas.length > 0)
    document.getElementById("raca-dropdown")?.classList.add("open");
}

function fecharRacaDropdownDelay() {
  setTimeout(
    () => document.getElementById("raca-dropdown")?.classList.remove("open"),
    150,
  );
}

function toggleRacaDropdown(e) {
  e.preventDefault();
  const dd = document.getElementById("raca-dropdown");
  if (!dd) return;
  if (dd.classList.contains("open")) {
    dd.classList.remove("open");
  } else {
    const racas = window._racasAtual || [];
    renderRacaDropdown(racas);
    if (racas.length) dd.classList.add("open");
  }
}

function selecionarRaca(r, e) {
  if (e) e.preventDefault();
  const inp = document.getElementById("m-raca");
  if (inp) inp.value = r;
  document.getElementById("raca-dropdown")?.classList.remove("open");
}

const _origSalvarNovoAnimal = salvarNovoAnimal;
salvarNovoAnimal = function () {
  const nome = document.getElementById("m-nome")?.value?.trim();
  const especie = document.getElementById("m-especie")?.value;
  if (!nome || !especie) {
    mostrarAlerta("Preencha pelo menos o nome e a espécie.");
    return;
  }
  const pVal = document.getElementById("m-peso-val")?.value?.trim();
  const pUnit = document.getElementById("m-peso-unit")?.value || "kg";
  const peso = pVal ? `${pVal.replace(",", ".")} ${pUnit}` : "";

  const novo = {
    id: Date.now(),
    nome,
    especie,
    raca: document.getElementById("m-raca")?.value || "",
    sexo: document.getElementById("m-sexo")?.value || "",
    nasc: document.getElementById("m-nasc")?.value || "",
    pelagem: document.getElementById("m-pelagem")?.value || "",
    status: document.getElementById("m-status")?.value || "Ativo",
    area: document.getElementById("m-area")?.value || "",
    peso: peso,
    microchip: document.getElementById("m-id")?.value || "",
    foto: null,
    paiNome: "",
    paiRaca: "",
    maeNome: "",
    maeRaca: "",
    avoPatNome: "",
    avoPatRaca: "",
    avoMatNome: "",
    avoMatRaca: "",
    vacinas: [],
    obs: "",
  };
  animais.push(novo);
  salvarAnimais();
  fecharModal();
  selecionado = novo.id;
  editando = false;
  renderSidebar();
  renderFicha();
};

function getProfile() {
  try {
    return JSON.parse(localStorage.getItem(PROFILE_KEY) || "null");
  } catch {
    return null;
  }
}
function salvarProfileStorage(p) {
  localStorage.setItem(PROFILE_KEY, JSON.stringify(p));
}

function initProfile() {
  try {
    const nome = currentUser?.name || "Usuário";
    const rawId = currentUser?.id;
    const id = rawId ? formatPlantelId(rawId) : "Não definido";
    const avatar = currentUser?.avatar || null;

    const nameEl = document.getElementById("um-name");
    const headerName = document.getElementById("um-header-name");
    const headerID = document.getElementById("um-header-id");
    const imgEl = document.getElementById("um-avatar-img");

    if (nameEl) nameEl.textContent = nome;
    if (headerName) headerName.textContent = nome;
    if (headerID) headerID.textContent = "ID: " + id;
    if (imgEl && avatar) imgEl.src = avatar;
    else if (imgEl) imgEl.src = "img/favicon.png";
  } catch {}
}

function abrirPerfil() {
  try {
    const p = getProfile();
    const nome = currentUser?.name || p?.nome || localStorage.getItem("plantel_criatorio_nome") || "";
    const email = currentUser?.email || "";
    const rawId = currentUser?.id;
    const id = rawId ? formatPlantelId(rawId) : "Não definido";
    const avatar = currentUser?.avatar || p?.avatar || localStorage.getItem("plantel_criatorio_logo") || null;

    document.getElementById("perfil-nome").value = nome;
    document.getElementById("perfil-email").value = email;
    document.getElementById("perfil-plantel-id").value = id;
    const largeEl = document.getElementById("perfil-avatar-large");
    if (largeEl && avatar) largeEl.src = avatar;
    else if (largeEl) largeEl.src = "img/loginicon.png";
  } catch {}
  document.getElementById("modal-perfil").style.display = "flex";
}

function fecharModalPerfil() {
  _perfilAvatarPending = null;
  const p = getProfile();
  const avatar = currentUser?.avatar || p?.avatar || localStorage.getItem("plantel_criatorio_logo") || null;
  const largeEl = document.getElementById("perfil-avatar-large");
  if (largeEl && avatar) largeEl.src = avatar;
  else if (largeEl) largeEl.src = "img/loginicon.png";
  document.getElementById("modal-perfil").style.display = "none";
}
function fecharModalPerfilExterno(e) {
  if (e.target === document.getElementById("modal-perfil")) fecharModalPerfil();
}

let _perfilAvatarPending = null;

function carregarFotoPerfil(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = function (e) {
    abrirCropModal(e.target.result, "perfil");
  };
  reader.readAsDataURL(file);
  event.target.value = "";
}

async function salvarPerfil() {
  const nome = document.getElementById("perfil-nome").value.trim();
  if (!nome) return;
  let avatarToSend = undefined;
  if (_perfilAvatarPending) {
    avatarToSend = _perfilAvatarPending;
    const umAvatar = document.getElementById("um-avatar-img");
    if (umAvatar) umAvatar.src = _perfilAvatarPending;
    _perfilAvatarPending = null;
  }

  const umName = document.getElementById("um-name");
  const umHeaderName = document.getElementById("um-header-name");
  if (umName) umName.textContent = nome;
  if (umHeaderName) umHeaderName.textContent = nome;

  localStorage.setItem("plantel_criatorio_nome", nome);
  if (avatarToSend) {
    localStorage.setItem("plantel_criatorio_logo", avatarToSend);
  }
  salvarProfileStorage({
    nome: nome,
    avatar: avatarToSend || currentUser?.avatar || localStorage.getItem("plantel_criatorio_logo") || null
  });

  if (currentUser) {
    currentUser.name = nome;
    if (avatarToSend) currentUser.avatar = avatarToSend;
    try {
      await fetch("/api/plantel/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify({ name: nome, avatar: avatarToSend }),
      });
    } catch (e) {}
  }
  
  if (typeof atualizarPreviewCertificado === "function" && animalCertId) {
    atualizarPreviewCertificado();
  }
  fecharModalPerfil();
}

function initAppExtras() {
  initProfile();
  renderAreaBar();
  popularSelectAreas();
}

const _baseAbrirModal = abrirModal;
abrirModal = function () {
  _baseAbrirModal();
  popularSelectAreas();
  atualizarRacasModal();
};

window.addEventListener("focus", () => {
  if (currentUser) syncFromCloud();
});

setInterval(() => {
  if (currentUser && document.visibilityState === "visible") {
    syncFromCloud();
  }
}, 20000);

document.addEventListener("DOMContentLoaded", () => {
  animais = carregarAnimais();
  casais = carregarCasais();
  selecionado = null;
  editando = false;
  showApp();
  checkSession();
});


const SEED_CASAIS = [
  {
    id: 101,
    nome: "Casal 01 - Curiós Ouro",
    especie: "Ave",
    machoId: null,
    femeaId: null,
    machoNomeManual: "Imperador",
    machoAnilhaManual: "BR-CR-2024-001",
    femeaNomeManual: "Princesa",
    femeaAnilhaManual: "BR-CR-2024-002",
    local: "Gaiola Criadeira 01",
    status: "Com filhotes",
    inicio: "2026-08-10",
    obs: "Casal de excelente genética e alta fertilidade.",
    ninhadas: [
      {
        id: 1,
        dataInicio: "2026-08-12",
        dataPostura: "2026-08-16",
        dataUltimoOvo: "2026-08-20",
        dataChoco: "2026-08-20",
        previsao: "2026-08-30",
        dataEclosao: "2026-08-30",
        ovosTotal: 4,
        ovosFerteis: 4,
        ovosGoros: 0,
        ovosMortos: 0,
        filhotesQtd: 4,
        anilhas: "BR-2026-01, BR-2026-02, BR-2026-03, BR-2026-04",
        status: "Com filhotes",
        obs: "Todos os 4 ovos eclodiram com saúde perfeita."
      }
    ]
  },
  {
    id: 102,
    nome: "Casal 02 - Canários da Terra",
    especie: "Ave",
    machoId: null,
    femeaId: null,
    machoNomeManual: "Soberano",
    machoAnilhaManual: "CT-2025-108",
    femeaNomeManual: "Dourada",
    femeaAnilhaManual: "CT-2025-109",
    local: "Viveiro Reprodução B",
    status: "Chocando",
    inicio: "2026-09-02",
    obs: "Postura em andamento na caixa ninho 2.",
    ninhadas: [
      {
        id: 1,
        dataInicio: "2026-09-05",
        dataPostura: "2026-09-08",
        dataUltimoOvo: "2026-09-12",
        dataChoco: "2026-09-12",
        previsao: "2026-09-26",
        dataEclosao: "",
        ovosTotal: 5,
        ovosFerteis: 4,
        ovosGoros: 1,
        ovosMortos: 0,
        filhotesQtd: 0,
        anilhas: "",
        status: "Chocando",
        obs: "Choco firme, previsão para final do mês."
      }
    ]
  }
];

let casais = [];
let casalEmEdicaoId = null;

function getCasaisStorageKey() {
  const uid = currentUser?.id || "demo";
  return `plantel-casais-${uid}`;
}

function carregarCasais() {
  try {
    const raw = localStorage.getItem(getCasaisStorageKey());
    if (raw) return JSON.parse(raw);
  } catch (e) {}
  return SEED_CASAIS.map((c) => ({ ...c }));
}

function salvarCasais(lista) {
  casais = lista;
  try {
    localStorage.setItem(getCasaisStorageKey(), JSON.stringify(lista));
  } catch (e) {}
}

let repStatsVisivel = false;

function toggleRepStats() {
  repStatsVisivel = !repStatsVisivel;
  const wrap = document.getElementById("rep-stats-wrapper");
  const btn = document.getElementById("btn-rep-stats-toggle");
  if (wrap) wrap.style.display = repStatsVisivel ? "block" : "none";
  if (btn) {
    btn.innerHTML = repStatsVisivel
      ? `<svg viewBox="0 0 20 20" fill="none" style="width:14px;height:14px"><path d="M5 12l5-5 5 5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg> <span>Ocultar Resumo</span>`
      : `<svg viewBox="0 0 20 20" fill="none" style="width:14px;height:14px"><path d="M2 10h3M7 6h3M12 3h3M17 8h3" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg> <span>Estatísticas Gerais</span>`;
  }
}

function isAve(especie) {
  if (!especie) return true;
  return /ave|p[aá]ssaro|passaro|can[aá]rio|curi[oó]|trinca|calopsita|periquito|papagaio|galinha|galo|calafate|manon|diamante/i.test(especie);
}

let repFiltroStatus = "todos";

function toggleRepFiltro(e) {
  if (e) e.stopPropagation();
  const drop = document.getElementById("rep-filter-dropdown");
  if (!drop) return;
  const isShown = drop.style.display === "block";
  drop.style.display = isShown ? "none" : "block";
}

function filtrarCasaisStatus(st) {
  repFiltroStatus = st;
  const drop = document.getElementById("rep-filter-dropdown");
  if (drop) drop.style.display = "none";
  renderReproducao();
}

if (typeof document !== "undefined") {
  document.addEventListener("click", (e) => {
    const wrap = document.getElementById("rep-filter-wrap");
    const drop = document.getElementById("rep-filter-dropdown");
    if (drop && wrap && !wrap.contains(e.target)) {
      drop.style.display = "none";
    }
  });
}

function renderReproducao() {
  const container = document.getElementById("reproducao-content");
  if (!container) return;

  const totalCasais = casais.length;
  const casaisAtivos = casais.filter((c) =>
    ["Em postura", "Chocando", "Com filhotes"].includes(c.status)
  ).length;

  let totalOvos = 0;
  let totalFilhotes = 0;
  let totalNinhadas = 0;
  casais.forEach((c) => {
    const nin = c.ninhadas || [];
    totalNinhadas += nin.length;
    nin.forEach((n) => {
      totalOvos += parseInt(n.ovosTotal) || 0;
      totalFilhotes += parseInt(n.filhotesQtd) || 0;
    });
  });

  const temAves = casais.length === 0 || casais.some((c) => isAve(c.especie));

  const casaisFiltrados = casais.filter((c) => {
    if (repFiltroStatus === "todos") return true;
    if (repFiltroStatus === "Com filhotes") return c.status === "Com filhotes" || c.status === "Gestação";
    return c.status === repFiltroStatus;
  });

  const casaisHtml = casaisFiltrados.length
    ? casaisFiltrados
        .map((c) => {
          const macho = c.machoId ? animais.find((x) => x.id === c.machoId) : null;
          const femea = c.femeaId ? animais.find((x) => x.id === c.femeaId) : null;

          const machoNome = macho ? macho.nome : c.machoNomeManual || "Macho não definido";
          const machoAnilha = macho ? (macho.microchip || "") : (c.machoAnilhaManual || "");
          const machoFoto = macho?.foto || null;
          const machoEmoji = macho ? (EMOJIS[macho.especie] || `<span class="noto-emoji">🐾</span>`) : `<span class="noto-emoji">♂</span>`;

          const femeaNome = femea ? femea.nome : c.femeaNomeManual || "Fêmea não definida";
          const femeaAnilha = femea ? (femea.microchip || "") : (c.femeaAnilhaManual || "");
          const femeaFoto = femea?.foto || null;
          const femeaEmoji = femea ? (EMOJIS[femea.especie] || `<span class="noto-emoji">🐾</span>`) : `<span class="noto-emoji">♀</span>`;

          const casalAve = isAve(c.especie);
          const ultimaNinhada = (c.ninhadas && c.ninhadas.length > 0) ? c.ninhadas[c.ninhadas.length - 1] : null;
          const ovosNum = ultimaNinhada ? (ultimaNinhada.ovosTotal || 0) : 0;
          const filhotesNum = ultimaNinhada ? (ultimaNinhada.filhotesQtd || 0) : 0;
          const eclosaoTxt = ultimaNinhada?.dataEclosao
            ? fmtDate(ultimaNinhada.dataEclosao)
            : (ultimaNinhada?.previsao ? fmtDate(ultimaNinhada.previsao) : "");
          const emPosturaOuChocando = c.status === "Em postura" || c.status === "Chocando" || c.status === "Gestação";

          let badgeClass = "badge-formado";
          if (c.status === "Em postura") badgeClass = "badge-postura";
          else if (c.status === "Chocando") badgeClass = "badge-chocando";
          else if (c.status === "Com filhotes") badgeClass = "badge-filhotes";
          else if (c.status === "Descanso") badgeClass = "badge-descanso";

          const ninhadasListHtml = (c.ninhadas || [])
            .map((n, idx) => {
              const anilhasArr = (n.anilhas || "")
                .split(",")
                .map((s) => s.trim())
                .filter(Boolean);

              const filhotesBadges = anilhasArr
                .map(
                  (an) => `
                <div class="filhote-card-row">
                  <div class="filhote-anilha-tag">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><circle cx="7" cy="7" r="1.5"/></svg>
                    <span>Anilha: <strong>${an}</strong></span>
                  </div>
                  <button class="btn-reg-filhote-pro" onclick="registrarFilhoteNoPlantel(${c.id}, ${idx}, '${an}')" title="Cadastrar filhote como animal no plantel">
                    <svg width="11" height="11" viewBox="0 0 20 20" fill="none"><path d="M10 4v12M4 10h12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
                    Cadastrar no Plantel
                  </button>
                </div>`
                )
                .join("");

              const datasItems = [];
              if (casalAve) {
                if (n.dataPostura) datasItems.push(`<div class="ninhada-timeline-item"><span class="tl-lbl">1º Ovo</span><span class="tl-val">${fmtDate(n.dataPostura)}</span></div>`);
                if (n.dataUltimoOvo) datasItems.push(`<div class="ninhada-timeline-item"><span class="tl-lbl">Fim Postura</span><span class="tl-val">${fmtDate(n.dataUltimoOvo)}</span></div>`);
                if (n.dataChoco) datasItems.push(`<div class="ninhada-timeline-item"><span class="tl-lbl">Início Choco</span><span class="tl-val">${fmtDate(n.dataChoco)}</span></div>`);
                if (n.dataEclosao) {
                  datasItems.push(`<div class="ninhada-timeline-item tl-destaque"><span class="tl-lbl">Eclosão Real</span><span class="tl-val">${fmtDate(n.dataEclosao)}</span></div>`);
                } else if ((n.status === "Em postura" || n.status === "Chocando") && n.previsao) {
                  datasItems.push(`<div class="ninhada-timeline-item tl-destaque"><span class="tl-lbl">Prev. Eclosão</span><span class="tl-val">${fmtDate(n.previsao)}</span></div>`);
                }
              } else {
                if (n.dataInicio) datasItems.push(`<div class="ninhada-timeline-item"><span class="tl-lbl">Cobertura</span><span class="tl-val">${fmtDate(n.dataInicio)}</span></div>`);
                if (n.dataEclosao) {
                  datasItems.push(`<div class="ninhada-timeline-item tl-destaque"><span class="tl-lbl">Parto Real</span><span class="tl-val">${fmtDate(n.dataEclosao)}</span></div>`);
                } else if (n.status === "Gestação" && n.previsao) {
                  datasItems.push(`<div class="ninhada-timeline-item tl-destaque"><span class="tl-lbl">Prev. Parto</span><span class="tl-val">${fmtDate(n.previsao)}</span></div>`);
                }
              }

              let badgeNinhada = "badge-descanso";
              if (n.status === "Em postura") badgeNinhada = "badge-postura";
              else if (n.status === "Chocando") badgeNinhada = "badge-chocando";
              else if (n.status === "Com filhotes" || n.status === "Gestação") badgeNinhada = "badge-filhotes";

              return `
              <div class="ninhada-card-box">
                <div class="ninhada-box-header">
                  <div class="ninhada-box-title">
                    <span class="ninhada-num-badge">Ninhada #${idx + 1}</span>
                    ${n.dataInicio ? `<span class="ninhada-data-sub">Início: <strong>${fmtDate(n.dataInicio)}</strong></span>` : ""}
                  </div>
                  <div class="ninhada-box-right">
                    <span class="casal-badge ${badgeNinhada}">${n.status || 'Em andamento'}</span>
                    <button class="btn-action-icon btn-danger" onclick="excluirNinhada(${c.id}, ${idx})" title="Excluir ninhada">
                      <svg width="13" height="13" viewBox="0 0 20 20" fill="none"><path d="M4 6h12M8 6V4h4v2M6 6v10h8V6" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>
                    </button>
                  </div>
                </div>

                <div class="ninhada-metrics-bar">
                  ${casalAve ? `
                    <div class="ninhada-m-col">
                      <span class="m-val">${n.ovosTotal || 0}</span>
                      <span class="m-lbl">Ovos</span>
                    </div>
                    <div class="ninhada-m-col m-ferteis">
                      <span class="m-val">${n.ovosFerteis || 0}</span>
                      <span class="m-lbl">Férteis</span>
                    </div>
                    <div class="ninhada-m-col m-goros">
                      <span class="m-val">${n.ovosGoros || 0}</span>
                      <span class="m-lbl">Goros</span>
                    </div>
                    ${(n.ovosMortos || 0) > 0 ? `
                    <div class="ninhada-m-col m-mortos">
                      <span class="m-val">${n.ovosMortos}</span>
                      <span class="m-lbl">Mortos</span>
                    </div>` : ""}
                  ` : ""}
                  <div class="ninhada-m-col m-filhotes">
                    <span class="m-val">${n.filhotesQtd || 0}</span>
                    <span class="m-lbl">Filhotes</span>
                  </div>
                </div>

                ${datasItems.length ? `<div class="ninhada-timeline-grid">${datasItems.join("")}</div>` : ""}
                ${filhotesBadges ? `<div class="filhotes-container">${filhotesBadges}</div>` : ""}
                ${n.obs ? `<div class="ninhada-obs-clean"><strong>Obs:</strong> "${n.obs}"</div>` : ""}
              </div>`;
            })
            .join("");

          return `
          <div class="casal-card">
            <div class="casal-header">
              <div class="casal-title-col">
                <div class="casal-top-row">
                  <h3 class="casal-nome" title="${c.nome}">${c.nome}</h3>
                  <span class="casal-badge ${badgeClass}">${c.status}</span>
                </div>
                <div class="casal-meta-row">
                  ${c.local ? `<span class="casal-meta-item"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg> ${c.local}</span>` : ""}
                  ${c.inicio ? `<span class="casal-meta-item"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg> Início: ${fmtDate(c.inicio)}</span>` : ""}
                </div>
              </div>
            </div>

            <div class="casal-pair-wrap">
              <div class="casal-partner partner-macho">
                <div class="casal-partner-thumb">
                  ${machoFoto ? `<img src="${machoFoto}" alt="${machoNome}" />` : machoEmoji}
                </div>
                <span class="casal-partner-role">Macho</span>
                <span class="casal-partner-nome" title="${machoNome}">${machoNome}</span>
                ${machoAnilha ? `<span class="casal-partner-anilha">Anilha: ${machoAnilha}</span>` : ""}
              </div>

              <div class="casal-heart-divider">
                <svg viewBox="0 0 24 24" fill="currentColor" style="width:16px;height:16px"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>
              </div>

              <div class="casal-partner partner-femea">
                <div class="casal-partner-thumb">
                  ${femeaFoto ? `<img src="${femeaFoto}" alt="${femeaNome}" />` : femeaEmoji}
                </div>
                <span class="casal-partner-role">Fêmea</span>
                <span class="casal-partner-nome" title="${femeaNome}">${femeaNome}</span>
                ${femeaAnilha ? `<span class="casal-partner-anilha">Anilha: ${femeaAnilha}</span>` : ""}
              </div>
            </div>

            <div class="casal-summary-bar">
              ${
                casalAve
                  ? `<div class="casal-sum-pill">
                      <span class="sum-icon">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px"><ellipse cx="12" cy="13" rx="7" ry="9"/></svg>
                      </span>
                      <div class="sum-data">
                        <span class="sum-val">${ovosNum}</span>
                        <span class="sum-lbl">Ovos</span>
                      </div>
                    </div>`
                  : `<div class="casal-sum-pill">
                      <span class="sum-icon">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
                      </span>
                      <div class="sum-data">
                        <span class="sum-val">${c.status || "Ativo"}</span>
                        <span class="sum-lbl">Reprodução</span>
                      </div>
                    </div>`
              }
              <div class="casal-sum-pill">
                <span class="sum-icon">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:16px;height:16px"><path d="M10 11V7a2 2 0 0 1 4 0v4"/><rect x="5" y="11" width="14" height="4" rx="2"/><circle cx="12" cy="18" r="3"/></svg>
                </span>
                <div class="sum-data">
                  <span class="sum-val">${filhotesNum}</span>
                  <span class="sum-lbl">Filhotes</span>
                </div>
              </div>
              ${
                emPosturaOuChocando && eclosaoTxt
                  ? `<div class="casal-sum-pill">
                      <span class="sum-icon">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                      </span>
                      <div class="sum-data">
                        <span class="sum-val ${eclosaoTxt && eclosaoTxt.includes('/') ? 'sum-val-date' : ''}">${eclosaoTxt}</span>
                        <span class="sum-lbl">${casalAve ? "Previsão" : "Prev. Parto"}</span>
                      </div>
                    </div>`
                  : ""
              }
            </div>

            <div class="casal-actions-bar">
              <button class="btn-ninhada-toggle" onclick="abrirModalGerenciarNinhadas(${c.id})">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                <span>Ninhadas (${(c.ninhadas || []).length})</span>
              </button>
              <div class="casal-actions-right">
                <button class="btn-action-icon" onclick="abrirModalCasal(${c.id})" title="Editar casal">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                </button>
                <button class="btn-action-icon btn-danger" onclick="confirmarExclusaoCasal(${c.id})" title="Excluir casal">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>
                </button>
              </div>
            </div>
          </div>`;
        })
        .join("")
    : "";

  let casaisConteudoHtml = "";
  if (casais.length === 0) {
    casaisConteudoHtml = `
      <div style="background:var(--c-card);border:1.5px dashed var(--c-border);border-radius:16px;padding:48px 20px;text-align:center;grid-column:1/-1">
        <div style="width:56px;height:56px;border-radius:50%;background:var(--c-accent-bg);color:var(--c-accent);display:flex;align-items:center;justify-content:center;margin:0 auto 16px">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" style="width:28px;height:28px">
            <path d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" stroke-linejoin="round"/>
          </svg>
        </div>
        <h3 style="font-size:18px;font-weight:700;color:var(--c-text-1);margin:0 0 6px">Nenhum casal formado</h3>
        <p style="font-size:13px;color:var(--c-text-2);margin:0 0 18px">Forme casais da mesma espécie para acompanhar reprodução, filhotes e ninhadas.</p>
        <button class="btn-novo-casal" onclick="abrirModalCasal()">+ Formar Primeiro Casal</button>
      </div>`;
  } else if (casaisFiltrados.length === 0) {
    casaisConteudoHtml = `
      <div style="background:var(--c-card);border:1.5px dashed var(--c-border);border-radius:16px;padding:42px 20px;text-align:center;grid-column:1/-1">
        <h3 style="font-size:16px;font-weight:700;color:var(--c-text-1);margin:0 0 6px">Nenhum casal com status "${repFiltroStatus}"</h3>
        <p style="font-size:13px;color:var(--c-text-2);margin:0 0 16px">Não há registros correspondentes a este filtro no momento.</p>
        <button class="btn-rep-stats-toggle" onclick="filtrarCasaisStatus('todos')">Mostrar Todos os Casais</button>
      </div>`;
  } else {
    casaisConteudoHtml = casaisHtml;
  }

  container.innerHTML = `
    <div class="rep-wrap">
      <div class="rep-header">
        <div class="rep-title-group">
          <h1>
            <svg viewBox="0 0 24 24" fill="none" style="width:24px;height:24px;color:var(--c-accent)">
              <path d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>
            </svg>
            Área de Reprodução
          </h1>
          <p>
            Gestão de casais, controle reprodutivo e registro de filhotes
          </p>
        </div>
        <div class="rep-header-actions">
          <button class="btn-rep-stats-toggle" id="btn-rep-stats-toggle" onclick="toggleRepStats()">
            ${repStatsVisivel
              ? `<svg viewBox="0 0 20 20" fill="none" style="width:14px;height:14px"><path d="M5 12l5-5 5 5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg> <span>Ocultar Resumo</span>`
              : `<svg viewBox="0 0 20 20" fill="none" style="width:14px;height:14px"><path d="M2 10h3M7 6h3M12 3h3M17 8h3" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg> <span>Estatísticas Gerais</span>`
            }
          </button>

          <div class="rep-filter-wrap" id="rep-filter-wrap">
            <button class="btn-rep-filter-toggle ${repFiltroStatus !== 'todos' ? 'active' : ''}" onclick="toggleRepFiltro(event)" title="Filtrar casais por status">
              <svg viewBox="0 0 20 20" fill="none" style="width:14px;height:14px">
                <path d="M3 5h14M6 10h8M9 15h2" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
              </svg>
              <span>${repFiltroStatus === 'todos' ? 'Filtrar' : repFiltroStatus}</span>
              ${repFiltroStatus !== 'todos' ? `<span class="rep-filter-active-dot"></span>` : ''}
              <svg width="10" height="6" viewBox="0 0 10 6" fill="none" style="margin-left:2px"><path d="M1 1l4 4 4-4" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>
            </button>
            <div class="rep-filter-dropdown" id="rep-filter-dropdown" style="display:none">
              <button class="rep-filter-opt ${repFiltroStatus === 'todos' ? 'selected' : ''}" onclick="filtrarCasaisStatus('todos')">
                <span>Todos os Casais</span>
                <span class="rep-filter-count">${casais.length}</span>
              </button>
              <button class="rep-filter-opt ${repFiltroStatus === 'Em postura' ? 'selected' : ''}" onclick="filtrarCasaisStatus('Em postura')">
                <span class="rep-filter-opt-left">
                  <span class="status-dot-sm" style="background:#ea580c"></span>
                  <span>Em postura</span>
                </span>
                <span class="rep-filter-count">${casais.filter(x => x.status === 'Em postura').length}</span>
              </button>
              <button class="rep-filter-opt ${repFiltroStatus === 'Chocando' ? 'selected' : ''}" onclick="filtrarCasaisStatus('Chocando')">
                <span class="rep-filter-opt-left">
                  <span class="status-dot-sm" style="background:#a21caf"></span>
                  <span>Chocando</span>
                </span>
                <span class="rep-filter-count">${casais.filter(x => x.status === 'Chocando').length}</span>
              </button>
              <button class="rep-filter-opt ${repFiltroStatus === 'Com filhotes' ? 'selected' : ''}" onclick="filtrarCasaisStatus('Com filhotes')">
                <span class="rep-filter-opt-left">
                  <span class="status-dot-sm" style="background:#16a34a"></span>
                  <span>Com filhotes</span>
                </span>
                <span class="rep-filter-count">${casais.filter(x => x.status === 'Com filhotes' || x.status === 'Gestação').length}</span>
              </button>
              <button class="rep-filter-opt ${repFiltroStatus === 'Formado' ? 'selected' : ''}" onclick="filtrarCasaisStatus('Formado')">
                <span class="rep-filter-opt-left">
                  <span class="status-dot-sm" style="background:#2563eb"></span>
                  <span>Formado</span>
                </span>
                <span class="rep-filter-count">${casais.filter(x => x.status === 'Formado').length}</span>
              </button>
              <button class="rep-filter-opt ${repFiltroStatus === 'Descanso' ? 'selected' : ''}" onclick="filtrarCasaisStatus('Descanso')">
                <span class="rep-filter-opt-left">
                  <span class="status-dot-sm" style="background:#64748b"></span>
                  <span>Descanso</span>
                </span>
                <span class="rep-filter-count">${casais.filter(x => x.status === 'Descanso').length}</span>
              </button>
            </div>
          </div>

          <button class="btn-novo-casal" onclick="abrirModalCasal()">
            <svg viewBox="0 0 20 20" fill="none" style="width:16px;height:16px"><path d="M10 4v12M4 10h12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
            Novo Casal
          </button>
        </div>
      </div>

      <div class="rep-stats-wrapper" id="rep-stats-wrapper" style="display: ${repStatsVisivel ? 'block' : 'none'};">
        <div class="rep-stats-grid">
          <div class="rep-stat-card">
            <div class="rep-stat-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:20px;height:20px">
                <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/>
                <circle cx="9" cy="7" r="4"/>
                <path d="M23 21v-2a4 4 0 00-3-3.87"/>
                <path d="M16 3.13a4 4 0 010 7.75"/>
              </svg>
            </div>
            <div>
              <div class="rep-stat-val">${totalCasais}</div>
              <div class="rep-stat-lbl">Casais Formados</div>
            </div>
          </div>
          <div class="rep-stat-card">
            <div class="rep-stat-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:20px;height:20px">
                <path d="M8.5 14.5A2.5 2.5 0 0011 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 11-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 002.5 3z"/>
              </svg>
            </div>
            <div>
              <div class="rep-stat-val">${casaisAtivos}</div>
              <div class="rep-stat-lbl">Casais em Reprodução</div>
            </div>
          </div>
          <div class="rep-stat-card">
            <div class="rep-stat-icon">
              ${
                temAves
                  ? `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:20px;height:20px">
                      <ellipse cx="12" cy="13" rx="7" ry="9"/>
                    </svg>`
                  : `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:20px;height:20px">
                      <path d="M3 12h18M3 12a9 9 0 0118 0M5 16h14M7 20h10"/>
                    </svg>`
              }
            </div>
            <div>
              <div class="rep-stat-val">${temAves ? totalOvos : totalNinhadas}</div>
              <div class="rep-stat-lbl">${temAves ? "Total de Ovos" : "Ninhadas Registradas"}</div>
            </div>
          </div>
          <div class="rep-stat-card">
            <div class="rep-stat-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:20px;height:20px"><path d="M10 11V7a2 2 0 0 1 4 0v4"/><rect x="5" y="11" width="14" height="4" rx="2"/><circle cx="12" cy="18" r="3"/></svg>
            </div>
            <div>
              <div class="rep-stat-val">${totalFilhotes}</div>
              <div class="rep-stat-lbl">Filhotes Nascidos</div>
            </div>
          </div>
        </div>
      </div>

      <div class="casais-grid">
        ${casaisConteudoHtml}
      </div>
    </div>`;
}

let casalGerenciarNinhadasId = null;

function abrirModalGerenciarNinhadas(casalId) {
  const c = casais.find((x) => x.id === casalId);
  if (!c) return;

  casalGerenciarNinhadasId = casalId;
  const modal = document.getElementById("modal-gerenciar-ninhadas");
  if (!modal) return;

  const casalAve = isAve(c.especie);
  const nomeEl = document.getElementById("mgn-casal-nome");
  const subEl = document.getElementById("mgn-casal-sub");
  const btnTxt = document.getElementById("mgn-nova-ninhada-txt");

  if (nomeEl) nomeEl.textContent = `Ninhadas · ${c.nome}`;
  if (subEl) subEl.textContent = `${c.especie} · ${c.local || "Sem acomodação informada"}`;
  if (btnTxt) btnTxt.textContent = casalAve ? "Nova Postura" : "Nova Ninhada";

  const totalNinhadas = (c.ninhadas || []).length;
  let totalOvos = 0;
  let totalFilhotes = 0;
  (c.ninhadas || []).forEach((n) => {
    totalOvos += parseInt(n.ovosTotal) || 0;
    totalFilhotes += parseInt(n.filhotesQtd) || 0;
  });

  const summaryEl = document.getElementById("mgn-stats-summary");
  if (summaryEl) {
    summaryEl.innerHTML = `
      <div class="mgn-stat-pill">
        <span>${casalAve ? "Posturas" : "Ninhadas"}:</span>
        <strong>${totalNinhadas}</strong>
      </div>
      ${
        casalAve
          ? `<div class="mgn-stat-pill">
               <span>Total de Ovos:</span>
               <strong>${totalOvos}</strong>
             </div>`
          : ""
      }
      <div class="mgn-stat-pill mgn-stat-accent">
        <span>Filhotes Nascidos:</span>
        <strong>${totalFilhotes}</strong>
      </div>
    `;
  }

  const listEl = document.getElementById("mgn-ninhadas-list");
  if (listEl) {
    if (!c.ninhadas || c.ninhadas.length === 0) {
      listEl.innerHTML = `
        <div class="mgn-empty">
          <div class="mgn-empty-icon">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg>
          </div>
          <h4>Nenhuma ${casalAve ? "postura" : "ninhada"} registrada</h4>
          <p>Clique em "${casalAve ? "Nova Postura" : "Nova Ninhada"}" para registrar e acompanhar o desenvolvimento.</p>
        </div>
      `;
    } else {
      listEl.innerHTML = c.ninhadas
        .map((n, idx) => {
          const datasItems = [];
          if (n.dataInicio) datasItems.push(`<div class="ninhada-timeline-item"><span class="tl-lbl">${casalAve ? "Acasalamento" : "Cruzamento"}</span><span class="tl-val">${fmtDate(n.dataInicio)}</span></div>`);
          if (casalAve && n.dataPostura) datasItems.push(`<div class="ninhada-timeline-item"><span class="tl-lbl">1º Ovo</span><span class="tl-val">${fmtDate(n.dataPostura)}</span></div>`);
          if (casalAve && n.dataUltimoOvo) datasItems.push(`<div class="ninhada-timeline-item"><span class="tl-lbl">Último Ovo</span><span class="tl-val">${fmtDate(n.dataUltimoOvo)}</span></div>`);
          if (casalAve && n.dataChoco) datasItems.push(`<div class="ninhada-timeline-item"><span class="tl-lbl">Início Choco</span><span class="tl-val">${fmtDate(n.dataChoco)}</span></div>`);
          if (n.previsao) datasItems.push(`<div class="ninhada-timeline-item tl-destaque"><span class="tl-lbl">${casalAve ? "Prev. Eclosão" : "Prev. Parto"}</span><span class="tl-val">${fmtDate(n.previsao)}</span></div>`);
          if (n.dataEclosao) datasItems.push(`<div class="ninhada-timeline-item tl-destaque"><span class="tl-lbl">${casalAve ? "Eclosão Real" : "Nasc. Real"}</span><span class="tl-val">${fmtDate(n.dataEclosao)}</span></div>`);

          const anilhasList = (n.anilhas || "")
            .split(/[,;\n]+/)
            .map((s) => s.trim())
            .filter(Boolean);

          const filhotesBadges = anilhasList.length
            ? anilhasList
                .map(
                  (anh) => `
                <div class="filhote-card-row">
                  <span class="filhote-anilha-tag">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 8v8M8 12h8"/></svg>
                    <span>${anh}</span>
                  </span>
                  <button type="button" class="btn-reg-filhote-pro" onclick="registrarFilhoteNoPlantel(${c.id}, ${idx}, '${anh}')" title="Cadastrar filhote automaticamente como animal no plantel">
                    + Adicionar ao Plantel
                  </button>
                </div>`
                )
                .join("")
            : "";

          return `
          <div class="ninhada-box mgn-card-item">
            <div class="ninhada-box-header">
              <div class="ninhada-box-title">
                <span class="ninhada-num-badge">#${idx + 1}</span>
                <strong style="font-size:13.5px;color:var(--c-text-1)">${casalAve ? "Postura" : "Ninhada"} ${idx + 1}</strong>
                <span class="pill pill-${(n.status || "").toLowerCase().replace(/\s+/g, "-")}">${n.status || "Ativa"}</span>
              </div>
              <div class="ninhada-box-right">
                <button class="btn-action-icon" onclick="editarNinhada(${c.id}, ${idx})" title="Editar dados desta ninhada">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                </button>
                <button class="btn-action-icon btn-danger" onclick="excluirNinhada(${c.id}, ${idx})" title="Excluir ninhada">
                  <svg width="13" height="13" viewBox="0 0 20 20" fill="none"><path d="M4 6h12M8 6V4h4v2M6 6v10h8V6" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>
                </button>
              </div>
            </div>

            <div class="ninhada-metrics-bar">
              ${
                casalAve
                  ? `
                <div class="ninhada-m-col m-ovos">
                  <span class="m-val">${n.ovosTotal || 0}</span>
                  <span class="m-lbl">Ovos</span>
                </div>
                <div class="ninhada-m-col m-ferteis">
                  <span class="m-val">${n.ovosFerteis || 0}</span>
                  <span class="m-lbl">Férteis</span>
                </div>
                <div class="ninhada-m-col m-goros">
                  <span class="m-val">${n.ovosGoros || 0}</span>
                  <span class="m-lbl">Goros</span>
                </div>
                ${
                  (n.ovosMortos || 0) > 0
                    ? `
                <div class="ninhada-m-col m-mortos">
                  <span class="m-val">${n.ovosMortos}</span>
                  <span class="m-lbl">Mortos</span>
                </div>`
                    : ""
                }
              `
                  : ""
              }
              <div class="ninhada-m-col m-filhotes">
                <span class="m-val">${n.filhotesQtd || 0}</span>
                <span class="m-lbl">Filhotes</span>
              </div>
            </div>

            ${datasItems.length ? `<div class="ninhada-timeline-grid">${datasItems.join("")}</div>` : ""}
            ${filhotesBadges ? `<div class="filhotes-container">${filhotesBadges}</div>` : ""}
            ${n.obs ? `<div class="ninhada-obs-clean"><strong>Obs:</strong> "${n.obs}"</div>` : ""}
          </div>`;
        })
        .join("");
    }
  }

  modal.style.display = "flex";
}

function fecharModalGerenciarNinhadas() {
  const modal = document.getElementById("modal-gerenciar-ninhadas");
  if (modal) modal.style.display = "none";
  casalGerenciarNinhadasId = null;
}

function fecharModalGerenciarNinhadasExterno(e) {
  if (e.target.id === "modal-gerenciar-ninhadas") fecharModalGerenciarNinhadas();
}

function abrirModalNovaNinhadaDoCasal() {
  if (casalGerenciarNinhadasId) {
    abrirModalNinhada(casalGerenciarNinhadasId);
  }
}


function abrirModalCasal(id = null) {
  casalEmEdicaoId = id;
  const modal = document.getElementById("modal-casal");
  const title = document.getElementById("modal-casal-title");
  if (!modal) return;

  if (id) {
    const c = casais.find((x) => x.id === id);
    if (!c) return;
    title.textContent = "Editar Casal";
    document.getElementById("casal-id").value = c.id;
    document.getElementById("casal-nome").value = c.nome;
    document.getElementById("casal-especie").value = c.especie;
    atualizarSelectsCasal(c.machoId, c.femeaId);
    document.getElementById("casal-local").value = c.local || "";
    document.getElementById("casal-status").value = c.status || "Formado";
    document.getElementById("casal-inicio").value = c.inicio || "";
    document.getElementById("casal-obs").value = c.obs || "";
  } else {
    title.textContent = "Novo Casal de Reprodução";
    document.getElementById("casal-id").value = "";
    document.getElementById("casal-nome").value = `Casal ${casais.length + 1}`;
    document.getElementById("casal-especie").value = "Ave";
    atualizarSelectsCasal();
    document.getElementById("casal-local").value = "";
    document.getElementById("casal-status").value = "Formado";
    document.getElementById("casal-inicio").value = new Date().toISOString().slice(0, 10);
    document.getElementById("casal-obs").value = "";
  }
  modal.style.display = "flex";
}

function fecharModalCasal() {
  const modal = document.getElementById("modal-casal");
  if (modal) modal.style.display = "none";
}

function fecharModalCasalExterno(e) {
  if (e.target.id === "modal-casal") fecharModalCasal();
}

function atualizarSelectsCasal(selMacho = null, selFemea = null) {
  const esp = document.getElementById("casal-especie")?.value || "Ave";
  const sMacho = document.getElementById("casal-macho");
  const sFemea = document.getElementById("casal-femea");
  if (!sMacho || !sFemea) return;

  const machos = animais.filter((a) => a.especie === esp && a.sexo === "Macho");
  const femeas = animais.filter((a) => a.especie === esp && a.sexo === "Fêmea");
  const outros = animais.filter((a) => a.especie === esp && a.sexo !== "Macho" && a.sexo !== "Fêmea");

  sMacho.innerHTML = `<option value="">-- Selecione o Macho --</option>` +
    machos.map((m) => `<option value="${m.id}"${selMacho === m.id ? " selected" : ""}>${m.nome} ${m.microchip ? `(${m.microchip})` : ""}</option>`).join("") +
    (outros.length ? `<optgroup label="Sem sexo definido">` + outros.map((o) => `<option value="${o.id}"${selMacho === o.id ? " selected" : ""}>${o.nome}</option>`).join("") + `</optgroup>` : "");

  sFemea.innerHTML = `<option value="">-- Selecione a Fêmea --</option>` +
    femeas.map((f) => `<option value="${f.id}"${selFemea === f.id ? " selected" : ""}>${f.nome} ${f.microchip ? `(${f.microchip})` : ""}</option>`).join("") +
    (outros.length ? `<optgroup label="Sem sexo definido">` + outros.map((o) => `<option value="${o.id}"${selFemea === o.id ? " selected" : ""}>${o.nome}</option>`).join("") + `</optgroup>` : "");
}

function salvarCasalForm() {
  const nome = document.getElementById("casal-nome")?.value?.trim();
  if (!nome) {
    mostrarDialog({ title: "Campo Obrigatório", desc: "Por favor, informe o nome ou código do casal." });
    return;
  }
  const idStr = document.getElementById("casal-id")?.value;
  const especie = document.getElementById("casal-especie")?.value || "Ave";
  const mVal = document.getElementById("casal-macho")?.value;
  const fVal = document.getElementById("casal-femea")?.value;
  const local = document.getElementById("casal-local")?.value || "";
  const status = document.getElementById("casal-status")?.value || "Formado";
  const inicio = document.getElementById("casal-inicio")?.value || "";
  const obs = document.getElementById("casal-obs")?.value || "";

  const machoId = mVal ? parseInt(mVal) : null;
  const femeaId = fVal ? parseInt(fVal) : null;

  if (idStr) {
    const cid = parseInt(idStr);
    const c = casais.find((x) => x.id === cid);
    if (c) {
      c.nome = nome;
      c.especie = especie;
      c.machoId = machoId;
      c.femeaId = femeaId;
      c.local = local;
      c.status = status;
      c.inicio = inicio;
      c.obs = obs;
    }
  } else {
    const novo = {
      id: Date.now(),
      nome,
      especie,
      machoId,
      femeaId,
      local,
      status,
      inicio,
      obs,
      ninhadas: []
    };
    casais.push(novo);
  }

  salvarCasais(casais);
  fecharModalCasal();
  renderReproducao();
}

function confirmarExclusaoCasal(id) {
  mostrarConfirm("Excluir Casal", "Tem certeza que deseja remover este casal e seu histórico de ninhadas?", () => {
    casais = casais.filter((x) => x.id !== id);
    salvarCasais(casais);
    renderReproducao();
  });
}


function abrirModalNinhada(casalId) {
  const c = casais.find((x) => x.id === casalId);
  if (!c) return;

  const modal = document.getElementById("modal-ninhada");
  if (!modal) return;

  const casalAve = isAve(c.especie);

  document.getElementById("ninhada-casal-id").value = casalId;
  document.getElementById("modal-ninhada-title").textContent = casalAve
    ? `Nova Postura · ${c.nome}`
    : `Nova Ninhada · ${c.nome}`;

  
  document.querySelectorAll(".nin-campo-ave").forEach((el) => {
    el.style.display = casalAve ? "" : "none";
  });
  const lblInicio = document.getElementById("nin-label-inicio");
  if (lblInicio) lblInicio.textContent = casalAve ? "Data de Acasalamento" : "Data de Cobertura / Cruzamento";
  const lblPrev = document.getElementById("nin-label-previsao");
  if (lblPrev) lblPrev.textContent = casalAve ? "Previsão de Eclosão" : "Previsão do Parto";
  const lblEclosao = document.getElementById("nin-label-eclosao");
  if (lblEclosao) lblEclosao.textContent = casalAve ? "Data Real da Eclosão" : "Data Real do Parto";

  
  const selectStatus = document.getElementById("nin-status");
  if (selectStatus) {
    if (casalAve) {
      selectStatus.innerHTML = `
        <option value="Em postura">Em postura</option>
        <option value="Chocando">Chocando / Incubação</option>
        <option value="Com filhotes">Com filhotes no ninho</option>
        <option value="Concluída">Concluída</option>
      `;
    } else {
      selectStatus.innerHTML = `
        <option value="Cobertura">Cobertura realizada</option>
        <option value="Gestação">Gestação confirmada</option>
        <option value="Com filhotes">Com filhotes / Lactação</option>
        <option value="Concluída">Concluída / Desmamados</option>
      `;
    }
  }

  if (document.getElementById("ninhada-idx")) document.getElementById("ninhada-idx").value = "";
  document.getElementById("nin-data-inicio").value = new Date().toISOString().slice(0, 10);
  document.getElementById("nin-data-postura").value = "";
  if (document.getElementById("nin-data-ultimo-ovo")) document.getElementById("nin-data-ultimo-ovo").value = "";
  if (document.getElementById("nin-data-choco")) document.getElementById("nin-data-choco").value = "";
  if (document.getElementById("nin-previsao")) document.getElementById("nin-previsao").value = "";
  if (document.getElementById("nin-data-eclosao")) document.getElementById("nin-data-eclosao").value = "";
  document.getElementById("nin-ovos-total").value = 0;
  document.getElementById("nin-ovos-ferteis").value = 0;
  document.getElementById("nin-ovos-goros").value = 0;
  if (document.getElementById("nin-ovos-mortos")) document.getElementById("nin-ovos-mortos").value = 0;
  document.getElementById("nin-filhotes-qtd").value = 0;
  document.getElementById("nin-anilhas").value = "";
  document.getElementById("nin-status").value = casalAve ? "Em postura" : "Gestação";
  document.getElementById("nin-obs").value = "";

  modal.style.display = "flex";
}

function editarNinhada(casalId, idx) {
  const c = casais.find((x) => x.id === casalId);
  if (!c || !c.ninhadas || !c.ninhadas[idx]) return;
  const n = c.ninhadas[idx];

  const modal = document.getElementById("modal-ninhada");
  if (!modal) return;

  const casalAve = isAve(c.especie);

  document.getElementById("ninhada-casal-id").value = casalId;
  document.getElementById("ninhada-idx").value = idx;
  document.getElementById("modal-ninhada-title").textContent = casalAve
    ? `Editar Postura #${idx + 1} · ${c.nome}`
    : `Editar Ninhada #${idx + 1} · ${c.nome}`;

  document.querySelectorAll(".nin-campo-ave").forEach((el) => {
    el.style.display = casalAve ? "" : "none";
  });
  const lblInicio = document.getElementById("nin-label-inicio");
  if (lblInicio) lblInicio.textContent = casalAve ? "Data de Acasalamento" : "Data de Cobertura / Cruzamento";
  const lblPrev = document.getElementById("nin-label-previsao");
  if (lblPrev) lblPrev.textContent = casalAve ? "Previsão de Eclosão" : "Previsão do Parto";
  const lblEclosao = document.getElementById("nin-label-eclosao");
  if (lblEclosao) lblEclosao.textContent = casalAve ? "Data Real da Eclosão" : "Data Real do Parto";

  const selectStatus = document.getElementById("nin-status");
  if (selectStatus) {
    if (casalAve) {
      selectStatus.innerHTML = `
        <option value="Em postura">Em postura</option>
        <option value="Chocando">Chocando / Incubação</option>
        <option value="Com filhotes">Com filhotes no ninho</option>
        <option value="Concluída">Concluída</option>
      `;
    } else {
      selectStatus.innerHTML = `
        <option value="Cobertura">Cobertura realizada</option>
        <option value="Gestação">Gestação confirmada</option>
        <option value="Com filhotes">Com filhotes / Lactação</option>
        <option value="Concluída">Concluída / Desmamados</option>
      `;
    }
  }

  document.getElementById("nin-data-inicio").value = n.dataInicio || "";
  document.getElementById("nin-data-postura").value = n.dataPostura || "";
  if (document.getElementById("nin-data-ultimo-ovo")) document.getElementById("nin-data-ultimo-ovo").value = n.dataUltimoOvo || "";
  if (document.getElementById("nin-data-choco")) document.getElementById("nin-data-choco").value = n.dataChoco || "";
  if (document.getElementById("nin-previsao")) document.getElementById("nin-previsao").value = n.previsao || "";
  if (document.getElementById("nin-data-eclosao")) document.getElementById("nin-data-eclosao").value = n.dataEclosao || "";
  document.getElementById("nin-ovos-total").value = n.ovosTotal || 0;
  document.getElementById("nin-ovos-ferteis").value = n.ovosFerteis || 0;
  document.getElementById("nin-ovos-goros").value = n.ovosGoros || 0;
  if (document.getElementById("nin-ovos-mortos")) document.getElementById("nin-ovos-mortos").value = n.ovosMortos || 0;
  document.getElementById("nin-filhotes-qtd").value = n.filhotesQtd || 0;
  document.getElementById("nin-anilhas").value = n.anilhas || "";
  document.getElementById("nin-status").value = n.status || (casalAve ? "Em postura" : "Gestação");
  document.getElementById("nin-obs").value = n.obs || "";

  modal.style.display = "flex";
}

function fecharModalNinhada() {
  const modal = document.getElementById("modal-ninhada");
  if (modal) modal.style.display = "none";
}

function fecharModalNinhadaExterno(e) {
  if (e.target.id === "modal-ninhada") fecharModalNinhada();
}

function salvarNinhadaForm() {
  const cid = parseInt(document.getElementById("ninhada-casal-id")?.value);
  const c = casais.find((x) => x.id === cid);
  if (!c) return;

  const idxStr = document.getElementById("ninhada-idx")?.value;
  const casalAve = isAve(c.especie);

  const nova = {
    dataInicio: document.getElementById("nin-data-inicio")?.value || "",
    dataPostura: casalAve ? (document.getElementById("nin-data-postura")?.value || "") : "",
    dataUltimoOvo: casalAve ? (document.getElementById("nin-data-ultimo-ovo")?.value || "") : "",
    dataChoco: casalAve ? (document.getElementById("nin-data-choco")?.value || "") : "",
    previsao: document.getElementById("nin-previsao")?.value || "",
    dataEclosao: document.getElementById("nin-data-eclosao")?.value || "",
    ovosTotal: casalAve ? (parseInt(document.getElementById("nin-ovos-total")?.value) || 0) : 0,
    ovosFerteis: casalAve ? (parseInt(document.getElementById("nin-ovos-ferteis")?.value) || 0) : 0,
    ovosGoros: casalAve ? (parseInt(document.getElementById("nin-ovos-goros")?.value) || 0) : 0,
    ovosMortos: casalAve ? (parseInt(document.getElementById("nin-ovos-mortos")?.value) || 0) : 0,
    filhotesQtd: parseInt(document.getElementById("nin-filhotes-qtd")?.value) || 0,
    anilhas: document.getElementById("nin-anilhas")?.value?.trim() || "",
    status: document.getElementById("nin-status")?.value || (casalAve ? "Em postura" : "Gestação"),
    obs: document.getElementById("nin-obs")?.value?.trim() || ""
  };

  if (!c.ninhadas) c.ninhadas = [];

  if (idxStr !== "" && idxStr !== null && idxStr !== undefined) {
    const idx = parseInt(idxStr);
    nova.id = c.ninhadas[idx]?.id || Date.now();
    c.ninhadas[idx] = nova;
  } else {
    nova.id = Date.now();
    c.ninhadas.push(nova);
  }

  if (nova.status === "Com filhotes") c.status = "Com filhotes";
  else if (nova.status === "Chocando") c.status = "Chocando";
  else if (nova.status === "Em postura") c.status = "Em postura";
  else if (nova.status === "Gestação") c.status = "Gestação";

  salvarCasais(casais);
  fecharModalNinhada();
  renderReproducao();

  const mgn = document.getElementById("modal-gerenciar-ninhadas");
  if (mgn && mgn.style.display === "flex") {
    abrirModalGerenciarNinhadas(cid);
  }
}

function excluirNinhada(casalId, idx) {
  mostrarConfirm("Excluir Ninhada", "Deseja realmente remover este registro de postura/ninhada?", () => {
    const c = casais.find((x) => x.id === casalId);
    if (c && c.ninhadas) {
      c.ninhadas.splice(idx, 1);
      salvarCasais(casais);
      renderReproducao();
      const mgn = document.getElementById("modal-gerenciar-ninhadas");
      if (mgn && mgn.style.display === "flex") {
        abrirModalGerenciarNinhadas(casalId);
      }
    }
  });
}

function registrarFilhoteNoPlantel(casalId, idx, anilha) {
  const c = casais.find((x) => x.id === casalId);
  if (!c) return;
  const n = c.ninhadas ? c.ninhadas[idx] : null;

  const macho = c.machoId ? animais.find((x) => x.id === c.machoId) : null;
  const femea = c.femeaId ? animais.find((x) => x.id === c.femeaId) : null;

  const paiNome = macho ? macho.nome : (c.machoNomeManual || "");
  const paiRaca = macho?.raca || "";
  const maeNome = femea ? femea.nome : (c.femeaNomeManual || "");
  const maeRaca = femea?.raca || "";

  abrirModal();

  const nomeInput = document.getElementById("m-nome");
  const espInput = document.getElementById("m-especie");
  const racaInput = document.getElementById("m-raca");
  const microInput = document.getElementById("m-microchip");
  const nascInput = document.getElementById("m-nasc");

  if (nomeInput) nomeInput.value = `Filhote ${anilha || ''}`.trim();
  if (espInput) {
    espInput.value = c.especie;
    atualizarRacasModal();
  }
  if (racaInput) racaInput.value = paiRaca || maeRaca || "";
  if (microInput) microInput.value = anilha || "";
  if (nascInput && n && n.dataPostura) nascInput.value = n.dataPostura;
  else if (nascInput) nascInput.value = new Date().toISOString().slice(0, 10);

  const pNome = document.getElementById("m-pai-nome");
  const pRaca = document.getElementById("m-pai-raca");
  const mNome = document.getElementById("m-mae-nome");
  const mRaca = document.getElementById("m-mae-raca");

  if (pNome) pNome.value = paiNome;
  if (pRaca) pRaca.value = paiRaca;
  if (mNome) mNome.value = maeNome;
  if (mRaca) mRaca.value = maeRaca;
}


let animalCertId = null;

function abrirModalCertificado(animalId) {
  animalCertId = animalId;
  const a = animais.find((x) => x.id === animalId);
  if (!a) return;

  const modal = document.getElementById("modal-certificado");
  if (!modal) return;

  atualizarPreviewCertificado();
  modal.style.display = "flex";
}

function fecharModalCertificado() {
  const modal = document.getElementById("modal-certificado");
  if (modal) modal.style.display = "none";
}

function fecharModalCertificadoExterno(e) {
  if (e.target.id === "modal-certificado") fecharModalCertificado();
}

function atualizarPreviewCertificado() {
  const a = animais.find((x) => x.id === animalCertId);
  if (!a) return;

  const p = getProfile();
  const cNome = p?.nome || currentUser?.name || localStorage.getItem("plantel_criatorio_nome") || "Criatório Plantel";
  const cLogo = p?.avatar || currentUser?.avatar || localStorage.getItem("plantel_criatorio_logo") || "img/loginicon.png";

  const nomeCriatEl = document.getElementById("cert-criatorio-nome");
  const logoCriatEl = document.getElementById("cert-criatorio-logo");

  if (nomeCriatEl) nomeCriatEl.textContent = cNome;
  if (logoCriatEl) logoCriatEl.src = cLogo;

  const setT = (id, val, fallbackLine = "____________________") => {
    const el = document.getElementById(id);
    if (el) el.textContent = (val && String(val).trim()) ? val : fallbackLine;
  };

  setT("c-nome", a.nome, "____________________");
  setT("c-anilha", a.microchip, "____________________");
  setT("c-especie", a.especie, "____________________");
  setT("c-raca", a.raca, "____________________");
  setT("c-sexo", a.sexo, "____________________");
  setT("c-nasc", a.nasc ? fmtDate(a.nasc) : "", "____ / ____ / ________");
  setT("c-pelagem", a.pelagem, "____________________");
  setT("c-status", a.status || "Ativo", "Ativo");

  const pai = a.paiNome ? animais.find((x) => x.nome.toLowerCase() === a.paiNome.toLowerCase()) : null;
  const mae = a.maeNome ? animais.find((x) => x.nome.toLowerCase() === a.maeNome.toLowerCase()) : null;

  setT("c-pai-nome", a.paiNome, "________________________________");
  setT("c-pai-anilha", pai?.microchip ? `Anilha: ${pai.microchip}` : "", "Anilha: ________________________");

  setT("c-mae-nome", a.maeNome, "________________________________");
  setT("c-mae-anilha", mae?.microchip ? `Anilha: ${mae.microchip}` : "", "Anilha: ________________________");

  setT("c-tutor-nome", "", "________________________________________________");
  setT("c-tutor-doc", "", "________________________________");
  setT("c-data-transf", "", "____ / ____ / ________");
  setT("c-ass-nome", cNome, "________________________________");
}

function imprimirCertificado() {
  window.print();
}

