const LP_USERS = "plantel-users";
const LP_SESSION = "plantel-session";

function lpGetUsers() {
  try {
    return JSON.parse(localStorage.getItem(LP_USERS) || "[]");
  } catch {
    return [];
  }
}

function lpShowView(id) {
  document
    .querySelectorAll(".lp-view")
    .forEach((v) => v.classList.remove("active"));
  const v = document.getElementById(id);
  v.classList.add("active");
  v.style.animation = "none";
  v.offsetHeight;
  v.style.animation = "";
}

function lpAlert(id, msg, type = "err") {
  const el = document.getElementById(id);
  el.textContent = msg;
  el.className = "lp-alert " + type + " show";
}
function lpClear(id) {
  document.getElementById(id).classList.remove("show");
}

function lpSaveSession(u) {
  localStorage.setItem(
    LP_SESSION,
    JSON.stringify({
      email: u.email,
      nome: u.nome,
      id: u.id,
      avatar: u.avatar || null,
      loggedAt: Date.now(),
    }),
  );
  showApp();
}

function lpToggleSenha(iid, sid) {
  const inp = document.getElementById(iid),
    ico = document.getElementById(sid);
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
  const v = document.getElementById("lp-reg-senha").value,
    fill = document.getElementById("lp-strength");
  let s = 0;
  if (v.length >= 6) s++;
  if (v.length >= 10) s++;
  if (/[A-Z]/.test(v)) s++;
  if (/[0-9]/.test(v)) s++;
  if (/[^A-Za-z0-9]/.test(v)) s++;
  fill.style.width = (s / 5) * 100 + "%";
  fill.style.background = s <= 1 ? "#e8743a" : s <= 3 ? "#f5c842" : "#16a393";
}

function lpLogin() {
  lpClear("lp-login-err");
  const email = document.getElementById("lp-email").value.trim();
  const senha = document.getElementById("lp-senha").value;
  const btn = document.getElementById("lp-btn-entrar");
  if (!email || !senha) {
    lpAlert("lp-login-err", "Preencha o e-mail e a senha.");
    return;
  }
  btn.textContent = "Entrando…";
  btn.classList.add("loading");
  setTimeout(() => {
    const u = lpGetUsers().find(
      (u) => u.email === email && u.senha === btoa(senha),
    );
    if (u) {
      lpSaveSession(u);
    } else {
      lpAlert("lp-login-err", "E-mail ou senha incorretos.");
      btn.textContent = "Entrar";
      btn.classList.remove("loading");
    }
  }, 500);
}

function lpDemo() {
  lpSaveSession({ email: "demo@plantel.app", nome: "Demo", id: "DEMO-0001" });
}

function lpRegistrar() {
  lpClear("lp-reg-err");
  lpClear("lp-reg-ok");
  const nome = document.getElementById("lp-reg-nome").value.trim();
  const email = document.getElementById("lp-reg-email").value.trim();
  const senha = document.getElementById("lp-reg-senha").value;
  const confirm = document.getElementById("lp-reg-confirm").value;
  const btn = document.getElementById("lp-btn-reg");
  if (!nome) {
    lpAlert("lp-reg-err", "Informe seu nome ou nome do plantel.");
    return;
  }
  if (!email || !/\S+@\S+\.\S+/.test(email)) {
    lpAlert("lp-reg-err", "Informe um e-mail válido.");
    return;
  }
  if (senha.length < 6) {
    lpAlert("lp-reg-err", "A senha deve ter pelo menos 6 caracteres.");
    return;
  }
  if (senha !== confirm) {
    lpAlert("lp-reg-err", "As senhas não coincidem.");
    return;
  }
  const users = lpGetUsers();
  if (users.find((u) => u.email === email)) {
    lpAlert(
      "lp-reg-err",
      "Este e-mail já está cadastrado. Faça login normalmente.",
    );
    return;
  }
  btn.textContent = "Criando conta…";
  btn.classList.add("loading");
  setTimeout(() => {
    const id = "PLT-" + Math.random().toString(36).substr(2, 6).toUpperCase();
    const novo = { email, senha: btoa(senha), nome, id, avatar: null };
    users.push(novo);
    localStorage.setItem(LP_USERS, JSON.stringify(users));
    lpAlert("lp-reg-ok", "Conta criada com sucesso! Entrando…", "ok");
    setTimeout(() => lpSaveSession(novo), 900);
  }, 600);
}

function lpRecuperar() {
  lpClear("lp-rec-err");
  lpClear("lp-rec-ok");
  const email = document.getElementById("lp-rec-email").value.trim();
  if (!email) {
    lpAlert("lp-rec-err", "Informe o e-mail cadastrado.");
    return;
  }
  if (!lpGetUsers().find((u) => u.email === email)) {
    lpAlert("lp-rec-err", "E-mail não encontrado em nossa base.");
    return;
  }
  lpAlert(
    "lp-rec-ok",
    "Se este e-mail estiver cadastrado, você receberá as instruções em breve.",
    "ok",
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
  document.getElementById("login-screen").style.display = "block";
  document.getElementById("app-screen").style.display = "none";
}

function showApp() {
  document.getElementById("login-screen").style.display = "none";
  document.getElementById("app-screen").style.display = "flex";
  if (typeof initAppExtras === "function") initAppExtras();
  if (typeof renderSidebar === "function") renderSidebar();
  if (typeof renderFicha === "function") renderFicha();
}

(function checkSession() {
  try {
    const s = JSON.parse(localStorage.getItem(LP_SESSION) || "null");
    if (s && Date.now() - s.loggedAt < 7 * 24 * 60 * 60 * 1000) {
      showApp();
    } else {
      showLogin();
    }
  } catch {
    showLogin();
  }
})();

function toggleUserMenu(e) {
  e.stopPropagation();
  document.getElementById("um-wrap").classList.toggle("open");
}
function fecharUserMenu() {
  document.getElementById("um-wrap").classList.remove("open");
}
document.addEventListener("click", () => fecharUserMenu());

function setTheme(t) {
  document.documentElement.setAttribute("data-theme", t);
  localStorage.setItem("plantel-theme", t);
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
    nome: "Luna",
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
  {
    id: 3,
    nome: "Trovão",
    especie: "Cavalo",
    raca: "Quarto de Milha",
    sexo: "Macho",
    nasc: "2018-11-05",
    pelagem: "Castanho escuro",
    status: "Ativo",
    peso: "480 kg",
    microchip: "BRZ000000001",
    foto: null,
    paiId: null,
    paiNome: "Relâmpago",
    paiRaca: "Quarto de Milha",
    maeId: null,
    maeNome: "Estrela",
    maeRaca: "Quarto de Milha",
    avoPatNome: "Ventania",
    avoPatRaca: "Quarto de Milha",
    avoMatNome: "Brisa",
    avoMatRaca: "Mangalarga",
    vacinas: [
      { nome: "Influenza Equina", data: "2024-05-01", prox: "2025-05-01" },
      { nome: "Tétano", data: "2023-05-01", prox: "2025-05-01" },
      { nome: "Encefalomielite", data: "2024-05-01", prox: "2025-05-01" },
    ],
    obs: "Treinado para vaquejada. Ferrageamento a cada 45 dias.\nNão expor à chuva forte por 24h após vacinação.",
  },
];

function carregarAnimais() {
  try {
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
    localStorage.setItem(STORAGE_KEY, JSON.stringify(animais));
  } catch (e) {}
}

let animais = carregarAnimais();

const EMOJIS = {
  Cão: "🐕",
  Gato: "🐈",
  Cavalo: "🐴",
  Bovino: "🐄",
  Suíno: "🐷",
  Ave: "🐔",
  Caprino: "🐐",
  Ovino: "🐑",
  Outro: "🐾",
};

let selecionado = null;
let editando = false;
let filtro = "Todos";
let abaAtiva = "ficha";
let fotoTemp = null;

function toggleTheme() {
  const html = document.documentElement;
  const atual = html.getAttribute("data-theme");
  html.setAttribute("data-theme", atual === "light" ? "dark" : "light");
  localStorage.setItem("plantel-theme", html.getAttribute("data-theme"));
}
function setTheme(t) {
  document.documentElement.setAttribute("data-theme", t);
  localStorage.setItem("plantel-theme", t);
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
  if (!nasc) return "—";
  const d = new Date(nasc + "T12:00:00"),
    hoje = new Date();
  let anos = hoje.getFullYear() - d.getFullYear();
  const m = hoje.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && hoje.getDate() < d.getDate())) anos--;
  if (anos < 1) {
    const meses =
      (hoje.getFullYear() - d.getFullYear()) * 12 +
      hoje.getMonth() -
      d.getMonth();
    return meses <= 0 ? "< 1 mês" : meses + (meses === 1 ? " mês" : " meses");
  }
  return anos + (anos === 1 ? " ano" : " anos");
}
function fmtDate(s) {
  if (!s) return "—";
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
            ${a.foto ? `<img src="${a.foto}" alt="${a.nome}" />` : EMOJIS[a.especie] || "🐾"}
          </div>
          <div class="animal-info">
            <div class="animal-item-name">${a.nome}</div>
            <div class="animal-item-meta">${a.especie}${a.raca ? " · " + a.raca : ""}</div>
          </div>
          <div class="status-pip ${pipClass(a.status)}"></div>
        </div>`,
        )
        .join("")
    : `<div style="padding:20px 16px;font-size:12px;color:var(--c-text-3);text-align:center">Nenhum animal encontrado</div>`;

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
  const tabF = document.getElementById("tab-ficha");
  const tabG = document.getElementById("tab-genealogia");

  if (!a) {
    empty.style.display = "flex";
    topbar.style.display = "none";
    tabF.style.display = tabG.style.display = "none";
    atualizarMobileBottombar(false);
    return;
  }
  empty.style.display = "none";
  topbar.style.display = "block";
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
      <div class="field-value">${val || "—"}</div>
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
              : `<span class="foto-emoji">${EMOJIS[a.especie] || "🐾"}</span><span class="foto-hint">Sem foto</span>`
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
        <div class="ficha-sub">${a.especie}${a.raca ? " · " + a.raca : ""}${a.nasc ? " · " + calcIdade(a.nasc) : ""}</div>
        <div class="badge-row">
          <span class="badge ${badgeClass(a.status)}"><span class="badge-dot"></span>${a.status}</span>
        </div>
        <div class="tag-row">
          ${a.sexo ? `<span class="tag-chip">${a.sexo}</span>` : ""}
          ${a.pelagem ? `<span class="tag-chip">${a.pelagem}</span>` : ""}
          ${a.peso ? `<span class="tag-chip">⚖ ${a.peso}</span>` : ""}
          ${a.microchip ? `<span class="tag-chip">🔖 ${a.microchip}</span>` : ""}
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
        ${field("Espécie", a.especie, "especie", "text", ["Cão", "Gato", "Cavalo", "Bovino", "Suíno", "Ave", "Caprino", "Ovino", "Outro"])}
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
      <div class="vac-table-wrap">
        <table class="vac-table">
          <thead><tr>
            <th>Vacina</th><th>Aplicação</th><th>Próxima dose</th><th>Situação</th>
            ${ed ? "<th></th>" : ""}
          </tr></thead>
          <tbody>${vacRows || `<tr><td colspan="${ed ? 5 : 4}" style="color:var(--c-text-3);font-style:italic;text-align:center;padding:16px">Nenhuma vacina registrada</td></tr>`}</tbody>
        </table>
      </div>
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
          : `<div class="obs-text">${a.obs || "—"}</div>`
      }
    </div>
  `;
}

function renderGenealogia(a) {
  const emoji = EMOJIS[a.especie] || "🐾";

  const nodeHtml = (nome, raca, role, roleLabel, foto, clickable) => {
    const hasName = nome && nome.trim();

    const linkedAnimal = hasName
      ? animais.find((x) => x.nome.trim() === nome.trim())
      : null;
    const photoSrc = foto || (linkedAnimal && linkedAnimal.foto) || null;
    const thumbContent = photoSrc
      ? `<img src="${photoSrc}" style="width:100%;height:100%;object-fit:cover;" />`
      : hasName
        ? emoji
        : "?";
    return `
      <div class="gene-node${!hasName ? " unknown" : ""}${role === "focal" ? " focal" : ""}">
        <div class="gene-thumb">${thumbContent}</div>
        <div class="gene-node-role role-${role}">${roleLabel}</div>
        <div class="gene-node-name">${hasName ? nome : "Desconhecido"}</div>
        <div class="gene-node-info">${raca || "—"}</div>
        ${linkedAnimal ? `<div style="font-size:10px;color:var(--c-accent);margin-top:2px">● no plantel</div>` : ""}
      </div>`;
  };

  const paiNome = a.paiNome || "";
  const paiRaca = a.paiRaca || "";
  const maeNome = a.maeNome || "";
  const maeRaca = a.maeRaca || "";
  const avoPatNome = a.avoPatNome || "";
  const avoPatRaca = a.avoPatRaca || "";
  const avoMatNome = a.avoMatNome || "";
  const avoMatRaca = a.avoMatRaca || "";

  const editSection = `
    <div class="gene-edit-section">
      <div class="gene-edit-title">Editar Ancestrais</div>
      <div class="grid-2">
        <div class="form-field"><label>Nome do Pai</label><input id="g-painome" type="text" value="${paiNome}" placeholder="Nome do pai" /></div>
        <div class="form-field"><label>Raça do Pai</label><input id="g-pairaça" type="text" value="${paiRaca}" placeholder="Raça do pai" /></div>
      </div>
      <div class="grid-2 mt">
        <div class="form-field"><label>Nome da Mãe</label><input id="g-maenome" type="text" value="${maeNome}" placeholder="Nome da mãe" /></div>
        <div class="form-field"><label>Raça da Mãe</label><input id="g-maeraca" type="text" value="${maeRaca}" placeholder="Raça da mãe" /></div>
      </div>
      <div class="grid-2 mt">
        <div class="form-field"><label>Avô Paterno</label><input id="g-avopatnome" type="text" value="${avoPatNome}" placeholder="Nome do avô paterno" /></div>
        <div class="form-field"><label>Raça do Avô Paterno</label><input id="g-avopatRaca" type="text" value="${avoPatRaca}" placeholder="Raça" /></div>
      </div>
      <div class="grid-2 mt">
        <div class="form-field"><label>Avó Materna</label><input id="g-avomatnome" type="text" value="${avoMatNome}" placeholder="Nome da avó materna" /></div>
        <div class="form-field"><label>Raça da Avó Materna</label><input id="g-avomatraca" type="text" value="${avoMatRaca}" placeholder="Raça" /></div>
      </div>
      <div style="margin-top:18px;display:flex;gap:10px">
        <button class="btn-save" onclick="salvarGenealogia()">Salvar Ancestrais</button>
      </div>
    </div>`;

  document.getElementById("genealogia-content").innerHTML = `
    <div class="gene-header">
      <h2 class="gene-title">Árvore Genealógica — ${a.nome}</h2>
      <p class="gene-sub">${a.especie}${a.raca ? " · " + a.raca : ""} · ${calcIdade(a.nasc)}</p>
    </div>

    <div class="gene-tree">
      <div class="gene-gen" style="gap:40px">
        ${nodeHtml(avoPatNome, avoPatRaca, "avo", "Avô paterno", null, false)}
        <div style="min-width:160px"></div>
        ${nodeHtml(avoMatNome, avoMatRaca, "avo", "Avó materna", null, false)}
      </div>

      <div style="width:100%;height:36px;position:relative">
        <svg viewBox="0 0 700 36" preserveAspectRatio="none" style="width:100%;height:100%;overflow:visible">
          <path d="M175 0 L175 18 L350 18 L350 36" stroke="var(--c-border)" stroke-width="1.5" fill="none"/>
          <path d="M525 0 L525 18 L350 18" stroke="var(--c-border)" stroke-width="1.5" fill="none"/>
        </svg>
      </div>

      <div class="gene-gen" style="gap:60px">
        ${nodeHtml(paiNome, paiRaca, "pai", "Pai", null, false)}
        ${nodeHtml(maeNome, maeRaca, "mae", "Mãe", null, false)}
      </div>

      <div style="width:100%;height:40px;position:relative">
        <svg viewBox="0 0 700 40" preserveAspectRatio="none" style="width:100%;height:100%;overflow:visible">
          <path d="M245 0 L245 20 L350 20 L350 40" stroke="var(--c-border)" stroke-width="1.5" fill="none"/>
          <path d="M455 0 L455 20 L350 20" stroke="var(--c-border)" stroke-width="1.5" fill="none"/>
        </svg>
      </div>

      <div class="gene-gen">
        ${nodeHtml(a.nome, a.raca, "focal", "Animal", a.foto, false)}
      </div>
    </div>

    ${editSection}
  `;
}

function salvarGenealogia() {
  const a = animais.find((x) => x.id === selecionado);
  if (!a) return;
  a.paiNome = document.getElementById("g-painome")?.value || "";
  a.paiRaca = document.getElementById("g-pairaça")?.value || "";
  a.maeNome = document.getElementById("g-maenome")?.value || "";
  a.maeRaca = document.getElementById("g-maeraca")?.value || "";
  a.avoPatNome = document.getElementById("g-avopatnome")?.value || "";
  a.avoPatRaca = document.getElementById("g-avopatRaca")?.value || "";
  a.avoMatNome = document.getElementById("g-avomatnome")?.value || "";
  a.avoMatRaca = document.getElementById("g-avomatraca")?.value || "";
  salvarAnimais();
  renderGenealogia(a);
  const btn = document.querySelector(".gene-edit-section .btn-save");
  if (btn) {
    btn.textContent = "Salvo!";
    setTimeout(() => {
      btn.textContent = "Salvar Ancestrais";
    }, 1500);
  }
}

function selecionar(id) {
  selecionado = id;
  editando = false;
  fotoTemp = null;
  renderSidebar();
  renderFicha();
  fecharSidebar();
}
function setFiltro(f) {
  filtro = f;
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
  a.peso = g("f-peso");
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
        <!-- Square guide overlay -->
        <div style="
          position:absolute;inset:0;
          pointer-events:none;
          box-shadow:inset 0 0 0 3px rgba(255,255,255,0.4);
          border-radius:12px;
        "></div>
        <!-- Rule of thirds grid -->
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
  ["m-nome", "m-raca", "m-id"].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.value = "";
  });
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
  const novo = {
    id: Date.now(),
    nome,
    especie,
    raca: document.getElementById("m-raca")?.value || "",
    sexo: document.getElementById("m-sexo")?.value || "",
    nasc: document.getElementById("m-nasc")?.value || "",
    pelagem: document.getElementById("m-pelagem")?.value || "",
    status: document.getElementById("m-status")?.value || "Ativo",
    peso: "",
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

function logout() {
  localStorage.removeItem("plantel-session");
  if (typeof showLogin === "function") {
    showLogin();
  } else {
    location.reload();
  }
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
}

let areaFiltro = "Todos";

function renderAreaBar() {
  const areas = getAreas();
  const tabs = document.getElementById("area-tabs");
  if (!tabs) return;
  tabs.innerHTML = areas
    .map(
      (a) =>
        `<button class="area-tab${areaFiltro === a ? " active" : ""}" onclick="setAreaFiltro('${a.replace(/'/g, "\\'")}')">${a}</button>`,
    )
    .join("");
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
  }
  renderAreaBar();
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
  document.getElementById("filter-tabs").innerHTML = _especiesTabs
    .map(
      (e) =>
        `<span class="ftab${filtro === e ? " active" : ""}" onclick="setFiltro('${e}')">${e}</span>`,
    )
    .join("");

  let lista = animais.filter((a) => {
    const okF = filtro === "Todos" || a.especie === filtro;
    const okA = areaFiltro === "Todos" || (a.area || "") === areaFiltro;
    const okB =
      !busca ||
      a.nome.toLowerCase().includes(busca) ||
      (a.raca || "").toLowerCase().includes(busca);
    return okF && okA && okB;
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
          ${a.foto ? `<img src="${a.foto}" alt="${a.nome}" />` : EMOJIS[a.especie] || "🐾"}
        </div>
        <div class="animal-info">
          <div class="animal-item-name">${a.nome}</div>
          <div class="animal-item-meta">${a.especie}${a.raca ? " · " + a.raca : ""}</div>
          ${a.area ? `<span class="animal-area-chip">${a.area}</span>` : ""}
        </div>
        <div class="status-pip ${pipClass(a.status)}"></div>
      </div>`,
        )
        .join("")
    : `<div style="padding:20px 16px;font-size:12px;color:var(--c-text-3);text-align:center">Nenhum animal encontrado</div>`;

  const ativos = animais.filter((a) => a.status === "Ativo").length;
  const trat = animais.filter((a) => a.status === "Em tratamento").length;
  document.getElementById("stats-bar").innerHTML = `
    <div class="stat-item"><div class="stat-n">${animais.length}</div><div class="stat-l">Total</div></div>
    <div class="stat-item"><div class="stat-n" style="color:var(--c-accent)">${ativos}</div><div class="stat-l">Ativos</div></div>
    <div class="stat-item"><div class="stat-n" style="color:var(--c-amber)">${trat}</div><div class="stat-l">Tratamento</div></div>`;

  renderAreaBar();
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

function popularSelectAreas() {
  const sel = document.getElementById("m-area");
  if (!sel) return;
  const areas = getAreas().filter((a) => a !== "Todos");
  sel.innerHTML =
    `<option value="">— Sem área —</option>` +
    areas.map((a) => `<option>${a}</option>`).join("");
}

function atualizarRacasModal() {
  const esp = document.getElementById("m-especie")?.value;
  const racas = RACAS_PRESET[esp] || [];

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
    peso: "",
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
    const s = JSON.parse(localStorage.getItem("plantel-session") || "null");
    const p = getProfile();
    const nome = p?.nome || s?.nome || "Usuário";
    const id = s?.id || p?.id || "—";
    const avatar = p?.avatar || s?.avatar || null;

    const nameEl = document.getElementById("um-name");
    const headerName = document.getElementById("um-header-name");
    const headerID = document.getElementById("um-header-id");
    const imgEl = document.getElementById("um-avatar-img");

    if (nameEl) nameEl.textContent = nome;
    if (headerName) headerName.textContent = nome;
    if (headerID) headerID.textContent = "ID: " + id;
    if (imgEl && avatar) imgEl.src = avatar;
  } catch {}
}

function abrirPerfil() {
  try {
    const s = JSON.parse(localStorage.getItem("plantel-session") || "null");
    const p = getProfile();
    document.getElementById("perfil-nome").value = p?.nome || s?.nome || "";
    document.getElementById("perfil-email").value = s?.email || "";
    document.getElementById("perfil-plantel-id").value = s?.id || p?.id || "—";
    const avatar = p?.avatar || s?.avatar || null;
    if (avatar) document.getElementById("perfil-avatar-large").src = avatar;
  } catch {}
  document.getElementById("modal-perfil").style.display = "flex";
}

function fecharModalPerfil() {
  _perfilAvatarPending = null;

  const p = getProfile();
  const s = JSON.parse(localStorage.getItem("plantel-session") || "{}");
  const savedAvatar = p?.avatar || s?.avatar || null;
  const largeEl = document.getElementById("perfil-avatar-large");
  if (largeEl && savedAvatar) largeEl.src = savedAvatar;
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

function salvarPerfil() {
  const nome = document.getElementById("perfil-nome").value.trim();
  if (!nome) return;
  const p = getProfile() || {};
  p.nome = nome;
  if (_perfilAvatarPending) {
    p.avatar = _perfilAvatarPending;
    const umAvatar = document.getElementById("um-avatar-img");
    if (umAvatar) umAvatar.src = _perfilAvatarPending;
    try {
      const s = JSON.parse(localStorage.getItem("plantel-session") || "{}");
      s.avatar = _perfilAvatarPending;
      localStorage.setItem("plantel-session", JSON.stringify(s));
    } catch {}
    _perfilAvatarPending = null;
  }
  salvarProfileStorage(p);
  try {
    const s = JSON.parse(localStorage.getItem("plantel-session") || "{}");
    s.nome = nome;
    localStorage.setItem("plantel-session", JSON.stringify(s));
  } catch {}
  const umName = document.getElementById("um-name");
  const umHeaderName = document.getElementById("um-header-name");
  if (umName) umName.textContent = nome;
  if (umHeaderName) umHeaderName.textContent = nome;
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
