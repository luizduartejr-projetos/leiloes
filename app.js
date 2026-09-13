// =============================================================
//  Lógica do portal: filtros, ordenação e renderização
// =============================================================

const fmtBRL = (v) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

const normCidade = (s) =>
  (s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

const BAIRROS_NOBRES_SP = [
  "Saúde","Vila Clementino","Vila Mariana","Ibirapuera","Moema","Paraíso",
  "Aclimação","Planalto Paulista","Itaim Bibi","Vila Olímpia","Brooklin",
  "Campo Belo","Santo Amaro","Morumbi","Vila Andrade","Granja Julieta",
  "Jardim Europa","Jardim América","Jardim Paulista","Jardim Paulistano",
  "Ipiranga","Mooca","Água Rasa","Vila Prudente","Tatuapé","Anália Franco",
  "Belenzinho",
].map(b => b.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase());

let filtroBairrosNobres = false;

const fmtData = (iso) => {
  if (!iso) return "–";
  const [a, m, d] = iso.split("-");
  return `${d}/${m}/${a}`;
};

const desconto = (im) =>
  im.valorAvaliacao > 0
    ? Math.round((1 - im.lanceMinimo / im.valorAvaliacao) * 100)
    : 0;

const diasAteLeilao = (iso) => {
  if (!iso) return null;
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const [a, m, d] = iso.split("-").map(Number);
  const leilao = new Date(a, m - 1, d);
  return Math.round((leilao - hoje) / 86400000);
};

// ---- Preenche as opções dos selects a partir dos dados ----
function popularSelect(id, valores, normalizar = false) {
  const sel = document.getElementById(id);
  if (normalizar) {
    // Deduplica variantes acentuadas/sem acento, usa a versão sem acento como value
    const mapa = new Map();
    valores.filter(Boolean).forEach((v) => {
      const k = normCidade(v);
      if (!mapa.has(k)) mapa.set(k, v);
    });
    [...mapa.entries()].sort((a, b) => a[0].localeCompare(b[0])).forEach(([k, label]) => {
      const opt = document.createElement("option");
      opt.value = k;
      opt.textContent = label;
      sel.appendChild(opt);
    });
  } else {
    [...new Set(valores)].filter(Boolean).sort().forEach((v) => {
      const opt = document.createElement("option");
      opt.value = v;
      opt.textContent = v;
      sel.appendChild(opt);
    });
  }
}

function popularFiltros(dados) {
  popularSelect("estado", dados.map((i) => i.estado));
  popularSelect("cidade", dados.map((i) => i.cidade), true);
  popularSelect("tipo", dados.map((i) => i.tipo));
  popularSelect("modalidade", dados.map((i) => i.modalidade));
  popularSelect("leiloeiro", dados.map((i) => i.leiloeiro));
  popularSelect("origem", dados.map((i) => i.origem));
  popularSelect("situacao", dados.map((i) => i.situacao));
}

// ---- Lê o estado atual dos filtros ----
function lerFiltros() {
  return {
    busca: document.getElementById("busca").value.trim().toLowerCase(),
    bairrosNobres: filtroBairrosNobres,
    estado: document.getElementById("estado").value,
    cidade: document.getElementById("cidade").value,
    tipo: document.getElementById("tipo").value,
    modalidade: document.getElementById("modalidade").value,
    leiloeiro: document.getElementById("leiloeiro").value,
    origem: document.getElementById("origem").value,
    situacao: document.getElementById("situacao").value,
    valorMin: parseFloat(document.getElementById("valorMin").value) || null,
    valorMax: parseFloat(document.getElementById("valorMax").value) || null,
    descontoMin: parseFloat(document.getElementById("descontoMin").value) || null,
    prazo: parseInt(document.getElementById("prazo").value) || null,
  };
}

// ---- Aplica os filtros ----
function aplicarFiltros(dados, f) {
  return dados.filter((im) => {
    if (f.estado && im.estado !== f.estado) return false;
    if (f.cidade && normCidade(im.cidade) !== f.cidade) return false;
    if (f.bairrosNobres) {
      const bNorm = (im.bairro || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
      if (!BAIRROS_NOBRES_SP.some(b => bNorm.includes(b) || b.includes(bNorm) && bNorm.length > 3)) return false;
    }
    if (f.tipo && im.tipo !== f.tipo) return false;
    if (f.modalidade && im.modalidade !== f.modalidade) return false;
    if (f.leiloeiro && im.leiloeiro !== f.leiloeiro) return false;
    if (f.origem && im.origem !== f.origem) return false;
    if (f.situacao && im.situacao !== f.situacao) return false;
    if (f.valorMin !== null && im.lanceMinimo < f.valorMin) return false;
    if (f.valorMax !== null && im.lanceMinimo > f.valorMax) return false;
    if (f.descontoMin !== null && desconto(im) < f.descontoMin) return false;
    if (f.prazo !== null) {
      const d = diasAteLeilao(im.dataLeilao);
      if (d < 0 || d > f.prazo) return false;
    }
    if (f.busca) {
      const texto = [im.titulo, im.cidade, im.bairro, im.estado, im.obs, im.leiloeiro]
        .join(" ").toLowerCase();
      if (!texto.includes(f.busca)) return false;
    }
    return true;
  });
}

// ---- Ordenação ----
function ordenar(dados, criterio) {
  const arr = [...dados];
  switch (criterio) {
    case "valor-asc": return arr.sort((a, b) => a.lanceMinimo - b.lanceMinimo);
    case "valor-desc": return arr.sort((a, b) => b.lanceMinimo - a.lanceMinimo);
    case "desconto-desc": return arr.sort((a, b) => desconto(b) - desconto(a));
    case "data-asc":
    default: return arr.sort((a, b) => a.dataLeilao.localeCompare(b.dataLeilao));
  }
}

// ---- Renderiza um card ----
function montarCard(im) {
  const desc = desconto(im);
  const dias = diasAteLeilao(im.dataLeilao);
  const prazoTxt = dias === null ? "" :
    dias < 0 ? "Encerrado" :
    dias === 0 ? "É hoje!" :
    dias === 1 ? "Amanhã" : `Em ${dias} dias`;

  return `
    <article class="card">
      <div class="card-top">
        <h3>${im.titulo}</h3>
        <span class="badge-tipo">${im.tipo}</span>
      </div>
      <div class="card-loc">📍 ${im.bairro}, ${im.cidade} - ${im.estado}</div>
      <div class="precos">
        <span class="preco-min">${fmtBRL(im.lanceMinimo)}</span>
        ${im.valorAvaliacao > 0
          ? desc < 0
            ? `<span class="desconto" style="background:#ef4444;color:#fff">+${Math.abs(desc)}% acima</span>`
            : `<span class="desconto">-${desc}%</span>`
          : ""}
        <div class="preco-aval">Avaliação: ${fmtBRL(im.valorAvaliacao)}</div>
      </div>
      <div class="tags">
        <span class="tag">${im.modalidade}</span>
        <span class="tag">${im.origem}</span>
        <span class="tag">${im.situacao}</span>
      </div>
      ${im.dataLeilao ? `<div class="card-data">📅 <strong>${fmtData(im.dataLeilao)}</strong>${prazoTxt ? ` · ${prazoTxt}` : ""}</div>` : ""}
      ${im.obs ? `<div class="card-obs">${im.obs}</div>` : `<div class="card-obs"></div>`}
      <div class="card-foot">
        <span class="leiloeiro">${im.leiloeiro}</span>
        <a class="btn-link" href="${im.link}" target="_blank" rel="noopener">Ver oferta →</a>
      </div>
    </article>`;
}

// ---- Expõe imóveis filtrados (para o mapa) ----
function obterImoveisFiltrados() {
  const f = lerFiltros();
  let filtrados = aplicarFiltros(IMOVEIS, f);
  // Aplica filtro de região do mapa se ativo
  if (typeof filtrarPorRegiao === "function") {
    filtrados = filtrarPorRegiao(filtrados);
  }
  return filtrados;
}

// ---- Renderiza a lista completa ----
function renderizar() {
  const f = lerFiltros();
  let filtrados = aplicarFiltros(IMOVEIS, f);

  // Aplica filtro de região do mapa se ativo
  if (typeof filtrarPorRegiao === "function") {
    filtrados = filtrarPorRegiao(filtrados);
  }

  // Atualiza marcadores no mapa se ele estiver aberto
  if (typeof atualizarMarcadores === "function" && !document.getElementById("mapa-container").hidden) {
    atualizarMarcadores(filtrados);
  }

  const ordenados = ordenar(filtrados, document.getElementById("ordenar").value);
  const lista = document.getElementById("lista");
  const vazio = document.getElementById("vazio");
  const contador = document.getElementById("contador");

  contador.textContent =
    `${ordenados.length} ${ordenados.length === 1 ? "imóvel" : "imóveis"}`;

  if (ordenados.length === 0) {
    lista.innerHTML = "";
    vazio.hidden = false;
  } else {
    vazio.hidden = true;
    lista.innerHTML = ordenados.map(montarCard).join("");
  }
}

// ---- Inicialização ----
function init() {
  popularFiltros(IMOVEIS);

  // Cidade depende do estado escolhido
  const selEstado = document.getElementById("estado");
  selEstado.addEventListener("change", () => {
    const selCidade = document.getElementById("cidade");
    const estado = selEstado.value;
    const cidades = IMOVEIS
      .filter((i) => !estado || i.estado === estado)
      .map((i) => i.cidade);
    selCidade.innerHTML = '<option value="">Todas</option>';
    popularSelect("cidade", cidades);
  });

  // Qualquer mudança re-renderiza
  document.querySelectorAll("input, select").forEach((el) => {
    el.addEventListener("input", renderizar);
    el.addEventListener("change", renderizar);
  });

  document.getElementById("limpar").addEventListener("click", () => {
    document.querySelectorAll(".filters input").forEach((el) => (el.value = ""));
    document.querySelectorAll(".filters select").forEach((el) => (el.value = ""));
    document.querySelectorAll(".btn-quick").forEach((b) => b.classList.remove("active"));
    filtroBairrosNobres = false;
    document.getElementById("btn-bairros-nobres")?.classList.remove("active");
    renderizar();
  });

  // Botões de acesso rápido por cidade
  document.querySelectorAll(".btn-quick").forEach((btn) => {
    btn.addEventListener("click", () => {
      const cidade = btn.dataset.cidade;
      const selCidade = document.getElementById("cidade");

      // Marca botao ativo
      document.querySelectorAll(".btn-quick").forEach((b) => b.classList.remove("active"));
      if (cidade) btn.classList.add("active");

      // Garante que o estado SP está selecionado (cidades estão em SP)
      if (cidade) {
        document.getElementById("estado").value = "SP";
        // Repopula cidades filtradas por SP (normalizado)
        selCidade.innerHTML = '<option value="">Todas</option>';
        popularSelect("cidade", IMOVEIS.filter((i) => i.estado === "SP").map((i) => i.cidade), true);
      }

      // Garante que a opção existe (mesmo que a cidade tenha 0 imóveis)
      const cidadeNorm = normCidade(cidade);
      if (cidade && ![...selCidade.options].some((o) => o.value === cidadeNorm)) {
        const opt = document.createElement("option");
        opt.value = cidadeNorm;
        opt.textContent = cidade;
        selCidade.appendChild(opt);
      }
      selCidade.value = cidadeNorm;
      filtroBairrosNobres = false;
      renderizar();
    });
  });

  // Botão SP - Bairros Nobres
  const btnBairros = document.getElementById("btn-bairros-nobres");
  if (btnBairros) {
    btnBairros.addEventListener("click", () => {
      const ativo = filtroBairrosNobres;
      // Limpa outros botões quick
      document.querySelectorAll(".btn-quick").forEach((b) => b.classList.remove("active"));
      filtroBairrosNobres = !ativo;
      if (filtroBairrosNobres) {
        btnBairros.classList.add("active");
        // Força cidade = São Paulo
        document.getElementById("estado").value = "SP";
        const selCidade = document.getElementById("cidade");
        selCidade.innerHTML = '<option value="">Todas</option>';
        popularSelect("cidade", IMOVEIS.filter((i) => i.estado === "SP").map((i) => i.cidade), true);
        const spNorm = normCidade("São Paulo");
        if (![...selCidade.options].some((o) => o.value === spNorm)) {
          const opt = document.createElement("option");
          opt.value = spNorm; opt.textContent = "São Paulo";
          selCidade.appendChild(opt);
        }
        selCidade.value = spNorm;
      } else {
        btnBairros.classList.remove("active");
      }
      renderizar();
    });
  }

  renderizar();
}

document.addEventListener("DOMContentLoaded", init);

// ── Última atualização ────────────────────────────────────────────────────────
(function mostrarUltimaAtualizacao() {
  const el = document.getElementById("ultima-atualizacao");
  if (!el) return;
  const iso = (typeof DATA_UPDATED !== "undefined") ? DATA_UPDATED : null;
  if (!iso) {
    el.textContent = "Última atualização: desconhecida";
    return;
  }
  const d = new Date(iso);
  const fmt = d.toLocaleString("pt-BR", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
  el.textContent = `Última atualização: ${fmt}`;
})();

// ── Botão Atualizar ───────────────────────────────────────────────────────────
function atualizar() {
  const btn = document.getElementById("btn-atualizar");
  const lbl = document.getElementById("ultima-atualizacao");

  btn.disabled = true;
  btn.textContent = "⟳ Atualizando...";
  btn.classList.add("rodando");
  lbl.textContent = "Buscando dados... (pode levar alguns minutos)";

  fetch("/atualizar", { method: "POST" })
    .then(r => r.json())
    .then(res => {
      if (!res.ok) {
        btn.disabled = false;
        btn.textContent = "⟳ Atualizar";
        btn.classList.remove("rodando");
        lbl.textContent = "Erro: " + res.msg;
        return;
      }
      // Fica monitorando /status até terminar
      const poll = setInterval(() => {
        fetch("/status")
          .then(r => r.json())
          .then(st => {
            if (!st.rodando) {
              clearInterval(poll);
              if (st.erro) {
                btn.disabled = false;
                btn.textContent = "⟳ Atualizar";
                btn.classList.remove("rodando");
                lbl.textContent = "Erro na atualização.";
              } else {
                lbl.textContent = "Concluído! Recarregando...";
                setTimeout(() => location.reload(true), 800);
              }
            }
          })
          .catch(() => clearInterval(poll));
      }, 3000);
    })
    .catch(() => {
      btn.disabled = false;
      btn.textContent = "⟳ Atualizar";
      btn.classList.remove("rodando");
      lbl.textContent = "Servidor local não encontrado.";
    });
}
