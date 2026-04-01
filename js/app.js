/* =============================================
   PLANTEL — app.js
   ============================================= */

// ── STORAGE ──────────────────────────────────
const STORAGE_KEY = "plantel-animais";

const SEED_ANIMAIS = [
  {
    id: 1, nome: "Thor", especie: "Cão", raca: "Labrador Retriever",
    sexo: "Macho", nasc: "2020-03-15", pelagem: "Amarelo dourado",
    status: "Ativo", peso: "32 kg", microchip: "985112340001", foto: null,
    paiId: null, paiNome: "Rex", paiRaca: "Labrador",
    maeId: null, maeNome: "Bella", maeRaca: "Labrador",
    avoPatNome: "Duke", avoPatRaca: "Labrador",
    avoMatNome: "Mel",  avoMatRaca: "Golden Retriever",
    vacinas: [
      { nome: "V10 Polivalente", data: "2024-03-15", prox: "2025-03-15" },
      { nome: "Antirrábica",     data: "2024-06-10", prox: "2025-06-10" },
      { nome: "Gripe Canina",    data: "2023-09-01", prox: "2024-09-01" }
    ],
    obs: "Alérgico a frango. Escovação semanal e banho a cada 20 dias.\nComportamento dócil com crianças, pode ser reativo com outros cães."
  },
  {
    id: 2, nome: "Luna", especie: "Gato", raca: "Persa",
    sexo: "Fêmea", nasc: "2021-07-22", pelagem: "Branca e cinza",
    status: "Em tratamento", peso: "4,2 kg", microchip: "985112340002", foto: null,
    paiId: null, paiNome: "Sultan", paiRaca: "Persa",
    maeId: null, maeNome: "Isis",   maeRaca: "Persa",
    avoPatNome: "", avoPatRaca: "", avoMatNome: "", avoMatRaca: "",
    vacinas: [
      { nome: "V4 Felina",   data: "2024-07-22", prox: "2025-07-22" },
      { nome: "Antirrábica", data: "2024-07-22", prox: "2025-07-22" }
    ],
    obs: "Em tratamento de otite externa. Aplicar gotas 2x ao dia por 10 dias.\nEvitar água nos ouvidos durante o banho."
  },
  {
    id: 3, nome: "Trovão", especie: "Cavalo", raca: "Quarto de Milha",
    sexo: "Macho", nasc: "2018-11-05", pelagem: "Castanho escuro",
    status: "Ativo", peso: "480 kg", microchip: "BRZ000000001", foto: null,
    paiId: null, paiNome: "Relâmpago", paiRaca: "Quarto de Milha",
    maeId: null, maeNome: "Estrela",   maeRaca: "Quarto de Milha",
    avoPatNome: "Ventania", avoPatRaca: "Quarto de Milha",
    avoMatNome: "Brisa",    avoMatRaca: "Mangalarga",
    vacinas: [
      { nome: "Influenza Equina", data: "2024-05-01", prox: "2025-05-01" },
      { nome: "Tétano",           data: "2023-05-01", prox: "2025-05-01" },
      { nome: "Encefalomielite",  data: "2024-05-01", prox: "2025-05-01" }
    ],
    obs: "Treinado para vaquejada. Ferrageamento a cada 45 dias.\nNão expor à chuva forte por 24h após vacinação."
  }
];

function carregarAnimais() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch (e) { /* ignora erro de parse */ }
  return SEED_ANIMAIS.map(a => ({ ...a }));
}

function salvarAnimais() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(animais));
  } catch (e) { /* ignora erro de storage cheio */ }
}

// ── DADOS ────────────────────────────────────
let animais = carregarAnimais();

const EMOJIS = {
  "Cão": "🐕", "Gato": "🐈", "Cavalo": "🐴", "Bovino": "🐄",
  "Suíno": "🐷", "Ave": "🐔", "Caprino": "🐐", "Ovino": "🐑", "Outro": "🐾"
};

let selecionado = null;
let editando    = false;
let filtro      = "Todos";
let abaAtiva    = "ficha";
let fotoTemp    = null;

// ── TEMA ─────────────────────────────────────
function toggleTheme() {
  const html  = document.documentElement;
  const atual = html.getAttribute("data-theme");
  html.setAttribute("data-theme", atual === "light" ? "dark" : "light");
  localStorage.setItem("plantel-theme", html.getAttribute("data-theme"));
}
(function initTheme() {
  const saved = localStorage.getItem("plantel-theme");
  if (saved) document.documentElement.setAttribute("data-theme", saved);
})();

// ── MOBILE SIDEBAR ────────────────────────────
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

// ── UTILS ─────────────────────────────────────
function calcIdade(nasc) {
  if (!nasc) return "—";
  const d = new Date(nasc + "T12:00:00"), hoje = new Date();
  let anos = hoje.getFullYear() - d.getFullYear();
  const m  = hoje.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && hoje.getDate() < d.getDate())) anos--;
  if (anos < 1) {
    const meses = (hoje.getFullYear() - d.getFullYear()) * 12 + hoje.getMonth() - d.getMonth();
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
  return s === "Ativo" ? "pip-ativo" : s === "Em tratamento" ? "pip-trat" : "pip-inativo";
}
function badgeClass(s) {
  return s === "Ativo" ? "badge-ativo" : s === "Em tratamento" ? "badge-trat" : "badge-inativo";
}
function pillClass(s) {
  return s === "ok" ? "pill-ok" : s === "vence" ? "pill-vence" : "pill-exp";
}
function pillLabel(s) {
  return s === "ok" ? "Em dia" : s === "vence" ? "Vencendo" : "Expirado";
}
function getEspecies() {
  return ["Todos", ...new Set(animais.map(a => a.especie))];
}

// ── SIDEBAR ───────────────────────────────────
function renderSidebar() {
  const busca = (document.getElementById("search-input")?.value || "").toLowerCase();

  document.getElementById("filter-tabs").innerHTML = getEspecies().map(e =>
    `<span class="ftab${filtro === e ? " active" : ""}" onclick="setFiltro('${e}')">${e}</span>`
  ).join("");

  const lista = animais.filter(a => {
    const okF = filtro === "Todos" || a.especie === filtro;
    const okB = !busca || a.nome.toLowerCase().includes(busca) || (a.raca || "").toLowerCase().includes(busca);
    return okF && okB;
  });

  document.getElementById("animal-count").textContent = lista.length;

  document.getElementById("animal-list").innerHTML = lista.length
    ? lista.map((a, i) => `
        <div class="animal-item${selecionado === a.id ? " active" : ""}"
             style="animation-delay:${i * 0.04}s"
             onclick="selecionar(${a.id})">
          <div class="animal-thumb">
            ${a.foto ? `<img src="${a.foto}" alt="${a.nome}" />` : (EMOJIS[a.especie] || "🐾")}
          </div>
          <div class="animal-info">
            <div class="animal-item-name">${a.nome}</div>
            <div class="animal-item-meta">${a.especie}${a.raca ? " · " + a.raca : ""}</div>
          </div>
          <div class="status-pip ${pipClass(a.status)}"></div>
        </div>`).join("")
    : `<div style="padding:20px 16px;font-size:12px;color:var(--c-text-3);text-align:center">Nenhum animal encontrado</div>`;

  const ativos = animais.filter(a => a.status === "Ativo").length;
  const trat   = animais.filter(a => a.status === "Em tratamento").length;
  document.getElementById("stats-bar").innerHTML = `
    <div class="stat-item"><div class="stat-n">${animais.length}</div><div class="stat-l">Total</div></div>
    <div class="stat-item"><div class="stat-n" style="color:var(--c-accent)">${ativos}</div><div class="stat-l">Ativos</div></div>
    <div class="stat-item"><div class="stat-n" style="color:var(--c-amber)">${trat}</div><div class="stat-l">Tratamento</div></div>
  `;
}

// ── FICHA ─────────────────────────────────────
function renderFicha() {
  const a = animais.find(x => x.id === selecionado);
  const empty   = document.getElementById("empty-state");
  const topbar  = document.getElementById("topbar");
  const tabF    = document.getElementById("tab-ficha");
  const tabG    = document.getElementById("tab-genealogia");

  if (!a) {
    empty.style.display = "flex";
    topbar.style.display = "none";
    tabF.style.display = tabG.style.display = "none";
    // atualiza mobile bottombar
    atualizarMobileBottombar(false);
    return;
  }
  empty.style.display = "none";
  topbar.style.display = "block";
  tabF.style.display   = abaAtiva === "ficha"      ? "block" : "none";
  tabG.style.display   = abaAtiva === "genealogia" ? "block" : "none";

  // atualiza mobile bottombar
  atualizarMobileBottombar(true);

  if (abaAtiva === "ficha")      renderFichaContent(a);
  if (abaAtiva === "genealogia") renderGenealogia(a);
}

function atualizarMobileBottombar(temAnimal) {
  const btns = document.querySelectorAll(".mobile-tab-btn");
  btns.forEach(btn => {
    btn.disabled = !temAnimal;
    btn.style.opacity = temAnimal ? "1" : "0.4";
  });
}

function renderFichaContent(a) {
  const ed = editando;

  const field = (label, val, id, type = "text", opts = null) => {
    if (ed) {
      if (opts) return `<div class="form-field">
        <label>${label}</label>
        <select id="f-${id}">${opts.map(o => `<option${val===o?" selected":""}>${o}</option>`).join("")}</select>
      </div>`;
      return `<div class="form-field">
        <label>${label}</label>
        <input type="${type}" id="f-${id}" value="${val||""}" />
      </div>`;
    }
    return `<div class="form-field">
      <label>${label}</label>
      <div class="field-value">${val||"—"}</div>
    </div>`;
  };

  const vacRows = (a.vacinas||[]).map((v,i) => {
    const st = vacStatus(v.prox);
    return `<tr>
      <td>${v.nome}</td>
      <td>${fmtDate(v.data)}</td>
      <td>${fmtDate(v.prox)}</td>
      <td><span class="pill ${pillClass(st)}">${pillLabel(st)}</span></td>
      ${ed ? `<td><span class="vac-remove" onclick="removerVacina(${i})">remover</span></td>` : ""}
    </tr>`;
  }).join("");

  const addVacForm = ed ? `
    <div class="add-vac-form">
      <div class="form-field"><label>Vacina</label><input id="nv-nome" type="text" placeholder="Nome da vacina" /></div>
      <div class="form-field"><label>Aplicação</label><input id="nv-data" type="date" /></div>
      <div class="form-field"><label>Próxima dose</label><input id="nv-prox" type="date" /></div>
      <button class="btn-add-vac" onclick="adicionarVacina()">+ Adicionar</button>
    </div>` : "";

  document.getElementById("ficha-content").innerHTML = `
    <div class="ficha-hero">
      <label for="foto-input" ${ed?"":"style='cursor:default'"}>
        <div class="foto-frame" ${ed?"":"style='cursor:default'"}>
          ${a.foto
            ? `<img src="${a.foto}" alt="${a.nome}" />`
            : `<span class="foto-emoji">${EMOJIS[a.especie]||"🐾"}</span><span class="foto-hint">Sem foto</span>`
          }
          ${ed ? `<div class="foto-overlay">
            <svg viewBox="0 0 24 24" fill="none"><path d="M12 16a4 4 0 100-8 4 4 0 000 8z" stroke="currentColor" stroke-width="1.5"/><path d="M3 9a2 2 0 012-2h1l2-2h8l2 2h1a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" stroke="currentColor" stroke-width="1.5"/></svg>
            <span>${a.foto?"Trocar foto":"Adicionar foto"}</span>
          </div>` : ""}
        </div>
      </label>

      <div class="ficha-info">
        ${ed
          ? `<input class="nome-edit-input" id="f-nome" value="${a.nome}" />`
          : `<h1 class="ficha-nome">${a.nome}</h1>`
        }
        <div class="ficha-sub">${a.especie}${a.raca?" · "+a.raca:""}${a.nasc?" · "+calcIdade(a.nasc):""}</div>
        <div class="badge-row">
          <span class="badge ${badgeClass(a.status)}"><span class="badge-dot"></span>${a.status}</span>
        </div>
        <div class="tag-row">
          ${a.sexo    ?`<span class="tag-chip">${a.sexo}</span>`:""}
          ${a.pelagem ?`<span class="tag-chip">${a.pelagem}</span>`:""}
          ${a.peso    ?`<span class="tag-chip">⚖ ${a.peso}</span>`:""}
          ${a.microchip?`<span class="tag-chip">🔖 ${a.microchip}</span>`:""}
        </div>
        <div class="ficha-actions">
          ${ed
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
        ${field("Espécie", a.especie, "especie","text",["Cão","Gato","Cavalo","Bovino","Suíno","Ave","Caprino","Ovino","Outro"])}
        ${field("Raça", a.raca, "raca")}
        ${field("Sexo", a.sexo, "sexo","text",["","Macho","Fêmea"])}
      </div>
      <div class="grid-3 mt">
        ${field("Nascimento", a.nasc, "nasc","date")}
        ${field("Peso", a.peso, "peso")}
        ${field("Pelagem / Cor", a.pelagem, "pelagem")}
      </div>
      <div class="grid-2 mt">
        ${field("Microchip / ID", a.microchip, "microchip")}
        ${field("Status", a.status, "status","text",["Ativo","Em tratamento","Inativo"])}
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
            ${ed?"<th></th>":""}
          </tr></thead>
          <tbody>${vacRows || `<tr><td colspan="${ed?5:4}" style="color:var(--c-text-3);font-style:italic;text-align:center;padding:16px">Nenhuma vacina registrada</td></tr>`}</tbody>
        </table>
      </div>
      ${addVacForm}
    </div>

    <div class="section-card">
      <div class="section-header">
        <div class="section-icon"><svg viewBox="0 0 24 24" fill="none"><path d="M4 6h16M4 10h16M4 14h10" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg></div>
        <span class="section-title">Observações</span>
      </div>
      ${ed
        ? `<div class="form-field"><textarea id="f-obs" placeholder="Alergias, comportamento, cuidados especiais...">${a.obs||""}</textarea></div>`
        : `<div class="obs-text">${a.obs||"—"}</div>`
      }
    </div>
  `;
}

// ── GENEALOGIA ────────────────────────────────
function renderGenealogia(a) {
  const emoji = EMOJIS[a.especie] || "🐾";

  const nodeHtml = (nome, raca, role, roleLabel, foto, clickable) => {
    const hasName = nome && nome.trim();
    return `
      <div class="gene-node${!hasName?" unknown":""}${role==="focal"?" focal":""}">
        <div class="gene-thumb">${foto?`<img src="${foto}" />`:(hasName?emoji:"?")}</div>
        <div class="gene-node-role role-${role}">${roleLabel}</div>
        <div class="gene-node-name">${hasName?nome:"Desconhecido"}</div>
        <div class="gene-node-info">${raca||"—"}</div>
        ${clickable?`<button class="gene-link-btn" onclick="editarGenealogiaAnimal('${role}')">↗ editar</button>`:""}
      </div>`;
  };

  const paiNome    = a.paiNome    || "";
  const paiRaca    = a.paiRaca    || "";
  const maeNome    = a.maeNome    || "";
  const maeRaca    = a.maeRaca    || "";
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
      <p class="gene-sub">${a.especie}${a.raca?" · "+a.raca:""} · ${calcIdade(a.nasc)}</p>
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
  const a = animais.find(x => x.id === selecionado);
  if (!a) return;
  a.paiNome    = document.getElementById("g-painome")?.value    || "";
  a.paiRaca    = document.getElementById("g-pairaça")?.value    || "";
  a.maeNome    = document.getElementById("g-maenome")?.value    || "";
  a.maeRaca    = document.getElementById("g-maeraca")?.value    || "";
  a.avoPatNome = document.getElementById("g-avopatnome")?.value || "";
  a.avoPatRaca = document.getElementById("g-avopatRaca")?.value || "";
  a.avoMatNome = document.getElementById("g-avomatnome")?.value || "";
  a.avoMatRaca = document.getElementById("g-avomatraca")?.value || "";
  salvarAnimais();
  renderGenealogia(a);
  const btn = document.querySelector(".gene-edit-section .btn-save");
  if (btn) { btn.textContent = "Salvo!"; setTimeout(() => { btn.textContent = "Salvar Ancestrais"; }, 1500); }
}

// ── ACTIONS ───────────────────────────────────
function selecionar(id) {
  selecionado = id; editando = false; fotoTemp = null;
  renderSidebar(); renderFicha();
  // no mobile fecha o drawer ao selecionar
  fecharSidebar();
}
function setFiltro(f) { filtro = f; renderSidebar(); }
function filtrarAnimais() { renderSidebar(); }

function switchTab(tab, el) {
  abaAtiva = tab;
  document.querySelectorAll(".tab-btn, .mobile-tab-btn").forEach(b => {
    if (b.dataset.tab === tab) b.classList.add("active");
    else b.classList.remove("active");
  });
  renderFicha();
}

function iniciarEdicao() { editando = true; renderFicha(); }
function cancelarEdicao() { editando = false; fotoTemp = null; renderFicha(); }

function salvarEdicao() {
  const a = animais.find(x => x.id === selecionado);
  if (!a) return;
  const g = id => document.getElementById(id)?.value ?? "";
  a.nome      = g("f-nome")      || a.nome;
  a.especie   = g("f-especie")   || a.especie;
  a.raca      = g("f-raca");
  a.sexo      = g("f-sexo");
  a.nasc      = g("f-nasc");
  a.peso      = g("f-peso");
  a.pelagem   = g("f-pelagem");
  a.microchip = g("f-microchip");
  a.status    = g("f-status")    || a.status;
  a.obs       = g("f-obs");
  if (fotoTemp) { a.foto = fotoTemp; fotoTemp = null; }
  editando = false;
  salvarAnimais();
  renderSidebar(); renderFicha();
}

function adicionarVacina() {
  const a    = animais.find(x => x.id === selecionado);
  const nome = document.getElementById("nv-nome")?.value?.trim();
  if (!nome) return;
  a.vacinas.push({
    nome,
    data: document.getElementById("nv-data")?.value || "",
    prox: document.getElementById("nv-prox")?.value || ""
  });
  salvarAnimais();
  renderFicha();
}

function removerVacina(i) {
  const a = animais.find(x => x.id === selecionado);
  if (confirm(`Remover "${a.vacinas[i].nome}"?`)) {
    a.vacinas.splice(i, 1);
    salvarAnimais();
    renderFicha();
  }
}

function carregarFoto(event) {
  if (!editando) return;
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    fotoTemp = e.target.result;
    const frame = document.querySelector(".foto-frame");
    if (frame) frame.innerHTML = `
      <img src="${fotoTemp}" alt="foto" />
      <div class="foto-overlay">
        <svg viewBox="0 0 24 24" fill="none" style="width:20px;height:20px;color:white"><path d="M12 16a4 4 0 100-8 4 4 0 000 8z" stroke="currentColor" stroke-width="1.5"/><path d="M3 9a2 2 0 012-2h1l2-2h8l2 2h1a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" stroke="currentColor" stroke-width="1.5"/></svg>
        <span>Trocar foto</span>
      </div>`;
  };
  reader.readAsDataURL(file);
  event.target.value = "";
}

// ── MODAL ─────────────────────────────────────
function abrirModal() { document.getElementById("modal").style.display = "flex"; }
function fecharModal() {
  document.getElementById("modal").style.display = "none";
  ["m-nome","m-raca","m-id"].forEach(id => { const el = document.getElementById(id); if(el) el.value=""; });
}
function fecharModalExterno(e) { if (e.target === document.getElementById("modal")) fecharModal(); }

function salvarNovoAnimal() {
  const nome    = document.getElementById("m-nome")?.value?.trim();
  const especie = document.getElementById("m-especie")?.value;
  if (!nome || !especie) { alert("Preencha pelo menos o nome e a espécie."); return; }
  const novo = {
    id: Date.now(), nome, especie,
    raca:      document.getElementById("m-raca")?.value    || "",
    sexo:      document.getElementById("m-sexo")?.value    || "",
    nasc:      document.getElementById("m-nasc")?.value    || "",
    pelagem:   document.getElementById("m-pelagem")?.value || "",
    status:    document.getElementById("m-status")?.value  || "Ativo",
    peso: "", microchip: document.getElementById("m-id")?.value || "",
    foto: null,
    paiNome:"", paiRaca:"", maeNome:"", maeRaca:"",
    avoPatNome:"", avoPatRaca:"", avoMatNome:"", avoMatRaca:"",
    vacinas: [], obs: ""
  };
  animais.push(novo);
  salvarAnimais();
  fecharModal();
  selecionado = novo.id; editando = false;
  renderSidebar(); renderFicha();
}

function confirmarExclusao(id) {
  const a = animais.find(x => x.id === id);
  if (!a) return;
  if (confirm(`Excluir a ficha de "${a.nome}"?\n\nEsta ação não pode ser desfeita.`)) {
    animais = animais.filter(x => x.id !== id);
    selecionado = null; editando = false;
    salvarAnimais();
    renderSidebar(); renderFicha();
  }
}

// ── INIT ──────────────────────────────────────
renderSidebar();
renderFicha();
