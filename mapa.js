// =============================================================
//  mapa.js — Mapa interativo com Leaflet
//  - Pins dispersos ao redor do centro da cidade (jitter)
//  - Filtro automático pelo viewport (zoom/pan)
// =============================================================

let mapaIniciado = false;
let leafletMap   = null;
let clusterGroup = null;

// fmtBRL definido em app.js

// ── Normaliza nome de cidade para buscar em CIDADES_COORDS ──────────────────
function normalizarCidade(str) {
  return (str || "")
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .trim().replace(/\s+/g, " ")
    .split(" ").map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(" ");
}

// ── Hash simples para gerar jitter estável por imóvel ───────────────────────
function hashStr(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  }
  return h;
}

// ── Normaliza endereço para chave (igual ao geocodificar_enderecos.py) ───────
function normEnd(s) {
  return (s || "")
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .toLowerCase().replace(/\s+/g, " ").trim();
}

function chaveEndereco(im) {
  const end = (im.endereco || "").trim();
  if (!end || end.length < 5) return null;
  const partes = end.split(",");
  const ruaNum = partes.slice(0, 2).join(", ").trim();
  return normEnd(ruaNum) + "|" + normEnd(im.cidade || "");
}

// ── Coordenadas do imóvel ────────────────────────────────────────────────────
// Retorna { lat, lng, exato: true/false }
// exato=true  → endereço geocodificado (pin colorido por tipo)
// exato=false → centro da cidade com jitter (pin cinza/transparente)
function coordsImovel(im) {
  const endCoords = (typeof ENDERECOS_COORDS !== "undefined") ? ENDERECOS_COORDS : {};
  const cidCoords = (typeof CIDADES_COORDS   !== "undefined") ? CIDADES_COORDS   : {};

  // 1. Tenta por endereço exato
  const chaveEnd = chaveEndereco(im);
  if (chaveEnd && endCoords[chaveEnd]) {
    return { ...endCoords[chaveEnd], exato: true };
  }

  // 2. Fallback: cidade com jitter
  const base = cidCoords[normalizarCidade(im.cidade)];
  if (!base) return null;

  const seed = hashStr((im.titulo || "") + (im.cidade || "") + String(im.lanceMinimo || ""));
  const r1 = ((seed & 0xFFFF) / 0xFFFF) - 0.5;
  const r2 = (((seed >> 16) & 0xFFFF) / 0xFFFF) - 0.5;
  return { lat: base.lat + r1 * 0.02, lng: base.lng + r2 * 0.02, exato: false };
}

// ── Ícone colorido por tipo ──────────────────────────────────────────────────
const CORES_TIPO = {
  "Apartamento": "#38bdf8",
  "Casa":        "#22c55e",
  "Terreno":     "#f59e0b",
  "Comercial":   "#a78bfa",
  "Rural":       "#86efac",
  "Imovel":      "#94a3b8",
};

function icone(tipo, exato = true) {
  if (!exato) {
    // Pin cinza com borda tracejada = localização aproximada (centro da cidade)
    return L.divIcon({
      className: "",
      html: `<div style="
        width:10px;height:10px;border-radius:50%;
        background:rgba(148,163,184,.4);
        border:2px dashed rgba(148,163,184,.8);
        box-shadow:none"></div>`,
      iconSize: [10, 10],
      iconAnchor: [5, 5],
      popupAnchor: [0, -7],
    });
  }
  const cor = CORES_TIPO[tipo] || CORES_TIPO["Imovel"];
  return L.divIcon({
    className: "",
    html: `<div style="
      width:12px;height:12px;border-radius:50%;
      background:${cor};border:2px solid rgba(255,255,255,.85);
      box-shadow:0 1px 4px rgba(0,0,0,.5)"></div>`,
    iconSize: [12, 12],
    iconAnchor: [6, 6],
    popupAnchor: [0, -8],
  });
}

// ── Popup de um imóvel ───────────────────────────────────────────────────────
function popupHtml(im, exato = true) {
  const desc = im.valorAvaliacao > im.lanceMinimo
    ? Math.round((1 - im.lanceMinimo / im.valorAvaliacao) * 100) : 0;
  const data = im.dataLeilao
    ? im.dataLeilao.split("-").reverse().join("/") : "";
  return `<div class="map-popup">
    <strong>${im.titulo}</strong>
    <div class="mp-desc">📍 ${im.bairro ? im.bairro + ", " : ""}${im.cidade} · ${im.tipo}</div>
    <div class="mp-preco">${fmtBRL(im.lanceMinimo)}${desc > 0 ? ` <span style="color:#22c55e;font-size:11px">-${desc}%</span>` : ""}</div>
    ${data ? `<div class="mp-desc">📅 ${data}</div>` : ""}
    <div class="mp-desc" style="font-size:11px">${im.leiloeiro}</div>
    ${!exato ? `<div class="mp-desc" style="color:#f59e0b;font-size:11px">⚠️ Localização aproximada (centro da cidade)</div>` : ""}
    <a href="${im.link}" target="_blank" rel="noopener">Ver oferta →</a>
  </div>`;
}

// ── Carrega Leaflet dinamicamente ────────────────────────────────────────────
function carregarLeaflet(callback) {
  if (typeof L !== "undefined") { callback(); return; }

  const addCSS = (href) => {
    const l = document.createElement("link");
    l.rel = "stylesheet"; l.href = href;
    document.head.appendChild(l);
  };
  addCSS("https://unpkg.com/leaflet@1.9.4/dist/leaflet.css");
  addCSS("https://unpkg.com/leaflet.markercluster@1.5.3/dist/MarkerCluster.Default.css");

  const s1 = document.createElement("script");
  s1.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
  s1.onload = () => {
    const s2 = document.createElement("script");
    s2.src = "https://unpkg.com/leaflet.markercluster@1.5.3/dist/leaflet.markercluster.js";
    s2.onload = callback;
    document.head.appendChild(s2);
  };
  document.head.appendChild(s1);
}

// ── Inicializa o mapa (interno, após Leaflet carregar) ───────────────────────
function _iniciarMapaInterno() {
  if (mapaIniciado) return;
  mapaIniciado = true;
  document.getElementById("mapa").innerHTML = "";

  leafletMap = L.map("mapa", { zoomControl: true }).setView([-21.5, -48.5], 7);

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    maxZoom: 18,
  }).addTo(leafletMap);

  clusterGroup = L.markerClusterGroup({
    showCoverageOnHover: false,
    maxClusterRadius: 50,
    spiderfyOnMaxZoom: true,
    chunkedLoading: true,
  });
  leafletMap.addLayer(clusterGroup);

  // Filtro por viewport: ao mover/dar zoom, atualiza a lista
  leafletMap.on("moveend zoomend", () => {
    if (typeof renderizar === "function") renderizar();
  });
}

// ── Atualiza marcadores no mapa ──────────────────────────────────────────────
function atualizarMarcadores(imoveis) {
  if (!mapaIniciado || !clusterGroup) return;

  clusterGroup.clearLayers();

  const bounds = [];
  for (const im of imoveis) {
    const c = coordsImovel(im);
    if (!c) continue;
    const marker = L.marker([c.lat, c.lng], { icon: icone(im.tipo, c.exato) });
    marker.bindPopup(popupHtml(im, c.exato), { maxWidth: 260 });
    clusterGroup.addLayer(marker);
    bounds.push([c.lat, c.lng]);
  }

  // Centraliza apenas na primeira carga (sem viewport ativo)
  if (bounds.length > 0 && !leafletMap.getBounds().isValid()) {
    try { leafletMap.fitBounds(bounds, { padding: [40, 40], maxZoom: 11 }); } catch (_) {}
  }
}

// ── Filtro por viewport (chamado pelo app.js) ────────────────────────────────
function filtrarPorRegiao(imoveis) {
  // Só filtra se o mapa estiver aberto e com bounds válidos
  if (!mapaIniciado || !leafletMap) return imoveis;
  if (document.getElementById("mapa-container").hidden) return imoveis;

  const bounds = leafletMap.getBounds();
  if (!bounds || !bounds.isValid()) return imoveis;

  return imoveis.filter((im) => {
    const c = coordsImovel(im);
    if (!c) return false;
    return bounds.contains(L.latLng(c.lat, c.lng));
  });
}

// ── Toggle Lista ↔ Mapa ──────────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", () => {
  const btnLista = document.getElementById("btn-lista");
  const btnMapa  = document.getElementById("btn-mapa");
  const divLista = document.getElementById("lista");
  const divVazio = document.getElementById("vazio");
  const divMapa  = document.getElementById("mapa-container");

  btnLista.addEventListener("click", () => {
    btnLista.classList.add("active");
    btnMapa.classList.remove("active");
    divLista.hidden = false;
    divMapa.hidden = true;
    if (typeof renderizar === "function") renderizar();
  });

  btnMapa.addEventListener("click", () => {
    btnMapa.classList.add("active");
    btnLista.classList.remove("active");
    divLista.hidden = true;
    divVazio.hidden = true;
    divMapa.hidden = false;

    const carregarEPlottar = () => {
      _iniciarMapaInterno();
      // Plota todos os imóveis filtrados (sem filtro de viewport ainda)
      if (typeof obterImoveisFiltrados === "function") {
        const todos = obterImoveisFiltrados();
        atualizarMarcadores(todos);
        // Centraliza no SP se não há bounds válidos
        if (todos.length > 0) {
          setTimeout(() => {
            try {
              const pts = todos
                .map(im => coordsImovel(im))
                .filter(Boolean)
                .map(c => [c.lat, c.lng]);
              if (pts.length > 0)
                leafletMap.fitBounds(pts, { padding: [30, 30], maxZoom: 11 });
            } catch (_) {}
          }, 100);
        }
      }
    };

    if (typeof L !== "undefined") {
      carregarEPlottar();
    } else {
      document.getElementById("mapa").innerHTML =
        '<div style="display:flex;align-items:center;justify-content:center;height:100%;color:#94a3b8;font-size:14px">⏳ Carregando mapa...</div>';
      carregarLeaflet(carregarEPlottar);
    }
  });
});
