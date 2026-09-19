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
  Ave: `<span class="noto-emoji">🐔</span>`,
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

  if (!a) {
    empty.style.display = "flex";
    if (topbar) topbar.style.display = "flex";
    if (topbarTabs) topbarTabs.style.visibility = "hidden";
    tabF.style.display = tabG.style.display = "none";
    atualizarMobileBottombar(false);
    return;
  }
  empty.style.display = "none";
  if (topbar) topbar.style.display = "flex";
  if (topbarTabs) topbarTabs.style.visibility = "visible";
  tabF.style.display = abaAtiva === "ficha" ? "block" : "none";
  tabG.style.display = abaAtiva === "genealogia" ? "block" : "none";

  atualizarMobileBottombar(true);

  if (abaAtiva === "ficha") renderFichaContent(a);
  if (abaAtiva === "genealogia") renderGenealogia(a);
}

function atualizarMobileBottombar(temAnimal) {
  const btns = document.querySelectorAll(".mobile-tab-btn");
  btns.forEach((btn) => {
    btn.disabled = !temAnimal;
    btn.style.opacity = temAnimal ? "1" : "0.4";
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
      <button class="btn-add-vac" onclick="adicionarVacina()">+ Adicionar</button>
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
        <div class="ficha-sub">${a.especie}${a.raca ? " · " + a.raca : ""}${(() => {
          const i = a.nasc ? calcIdade(a.nasc) : "";
          return i && i !== "Não informada" ? " · " + i : "";
        })()}</div>
        <div class="badge-row">
          <span class="badge ${badgeClass(a.status)}"><span class="badge-dot"></span>${a.status}</span>
        </div>
        <div class="tag-row">
          ${a.sexo ? `<span class="tag-chip">${a.sexo}</span>` : ""}
          ${a.pelagem ? `<span class="tag-chip">${a.pelagem}</span>` : ""}
          ${a.peso ? `<span class="tag-chip"><span class="noto-emoji noto-emoji-inline">⚖</span> ${a.peso}</span>` : ""}
          ${a.microchip ? `<span class="tag-chip"><span class="noto-emoji noto-emoji-inline">🔖</span> ${a.microchip}</span>` : ""}
        </div>
        <div class="ficha-actions">
          ${
            ed
              ? `<button class="btn-save" onclick="salvarEdicao()">Salvar alterações</button>
               <button class="btn-cancel" onclick="cancelarEdicao()">Cancelar</button>`
              : `<button class="btn-edit" onclick="iniciarEdicao()">Editar ficha</button>`
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
      <div class="grid-2 mt">
        ${field("Microchip / ID", a.microchip, "microchip")}
        ${field("Status", a.status, "status", "text", ["Ativo", "Em tratamento", "Inativo"])}
      </div>
    </div>

    <div class="section-card">
      <div class="section-header">
        <div class="section-icon"><svg viewBox="0 0 24 24" fill="none"><path d="M9 3l-4 4 8 8 4-4-8-8z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/><path d="M15 7l2 2M5 13l-2 4 4-2M19 5l1-1" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg></div>
        <span class="section-title">Vacinação</span>
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
    </div>

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

function switchTab(tab, el) {
  abaAtiva = tab;
  document.querySelectorAll(".tab-btn, .mobile-tab-btn").forEach((b) => {
    if (b.dataset.tab === tab) b.classList.add("active");
    else b.classList.remove("active");
  });
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
  a.obs = g("f-obs");
  if (fotoTemp) {
    a.foto = fotoTemp;
    fotoTemp = null;
  }
  editando = false;
  salvarAnimais();
  renderSidebar();
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
    const nome = currentUser?.name || "";
    const email = currentUser?.email || "";
    const rawId = currentUser?.id;
    const id = rawId ? formatPlantelId(rawId) : "Não definido";
    const avatar = currentUser?.avatar || null;

    document.getElementById("perfil-nome").value = nome;
    document.getElementById("perfil-email").value = email;
    document.getElementById("perfil-plantel-id").value = id;
    const largeEl = document.getElementById("perfil-avatar-large");
    if (largeEl && avatar) largeEl.src = avatar;
    else if (largeEl) largeEl.src = "img/favicon.png";
  } catch {}
  document.getElementById("modal-perfil").style.display = "flex";
}

function fecharModalPerfil() {
  _perfilAvatarPending = null;
  const avatar = currentUser?.avatar || null;
  const largeEl = document.getElementById("perfil-avatar-large");
  if (largeEl && avatar) largeEl.src = avatar;
  else if (largeEl) largeEl.src = "img/favicon.png";
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
  selecionado = null;
  editando = false;
  showApp();
  checkSession();
});
