const PIVDENNA_PROFILE_URL =
  "assets/geojson/pivdenna_hromada/pivdenna_strategic_profile.json";
const PIVDENNA_FACTS_URL =
  "assets/geojson/pivdenna_hromada/pivdenna_gis_facts.json";
const PIVDENNA_LAYERS_INDEX_URL =
  "assets/geojson/pivdenna_hromada/layers_index.json";

const DEMO_COMMUNITIES = [
  {
    community_name: "Чугуївська",
    region: "Харківська область",
    community_type: "міська",
    population: 45000,
    area_km2: 820.5,
    development_index: 0.837,
    security_index: 0.69,
    spatial_index: 0.692,
    territorial_stability_index: 0.739,
    stability_class: "Operational",
    rank: 1,
  },
  {
    community_name: "Дергачівська",
    region: "Харківська область",
    community_type: "міська",
    population: 52000,
    area_km2: 894.2,
    development_index: 0.708,
    security_index: 0.62,
    spatial_index: 0.7,
    territorial_stability_index: 0.676,
    stability_class: "Operational",
    rank: 2,
  },
  {
    community_name: "Зміївська",
    region: "Харківська область",
    community_type: "міська",
    population: 41000,
    area_km2: 712.4,
    development_index: 0.663,
    security_index: 0.63,
    spatial_index: 0.653,
    territorial_stability_index: 0.649,
    stability_class: "Operational",
    rank: 3,
  },
  {
    community_name: "Мереф'янська",
    region: "Харківська область",
    community_type: "міська",
    population: 38000,
    area_km2: 612.7,
    development_index: 0.431,
    security_index: 0.53,
    spatial_index: 0.497,
    territorial_stability_index: 0.486,
    stability_class: "Vulnerable",
    rank: 4,
  },
  {
    community_name: "Південна",
    region: "Харківська область",
    community_type: "міська",
    population: 29000,
    area_km2: 455.1,
    development_index: 0.22,
    security_index: 0.43,
    spatial_index: 0.363,
    territorial_stability_index: 0.338,
    stability_class: "Critical",
    rank: 5,
  },
];

const PROFILE_PLACEHOLDER =
  "Оберіть громаду, щоб переглянути її демонстраційні індекси, клас уваги та короткий аналітичний коментар.";
const ANALYSIS_PLACEHOLDER =
  "Після вибору громади тут буде показано пілотну інтерпретацію результатів.";
const STRATEGIC_PLACEHOLDER =
  "Поглиблений демонстраційний профіль доступний для Південної громади.";

const MAP_FALLBACK_VIEW = {
  center: [49.68, 36.2],
  zoom: 10,
};

const PIVDENNA_LAYERS = [
  {
    key: "boundaries",
    label: "Межі громади",
    defaultVisible: true,
    style: {
      color: "#0f766e",
      weight: 4,
      opacity: 1,
      fillColor: "#0f766e",
      fillOpacity: 0.03,
      dashArray: null,
    },
  },
  {
    key: "settlements",
    label: "Населені пункти",
    defaultVisible: true,
    style: {
      color: "#7a6a31",
      weight: 0.7,
      opacity: 0.55,
      fillColor: "#d2b75f",
      fillOpacity: 0.12,
    },
    pointStyle: {
      radius: 3.8,
      color: "#6f6428",
      weight: 1,
      fillColor: "#d8c16a",
      fillOpacity: 0.58,
    },
  },
  {
    key: "transport",
    label: "Транспортна мережа",
    defaultVisible: true,
    style: {
      color: "#334155",
      weight: 1.3,
      opacity: 0.7,
      fillOpacity: 0,
    },
  },
  {
    key: "land_use",
    label: "Землекористування",
    defaultVisible: false,
    style: {
      color: "#64748b",
      weight: 0.6,
      opacity: 0.35,
      fillColor: "#94a3b8",
      fillOpacity: 0.06,
    },
  },
];

const PIVDENNA_LAYER_DRAW_ORDER = [
  "land_use",
  "transport",
  "settlements",
  "boundaries",
];

const state = {
  communities: DEMO_COMMUNITIES,
  communityMap: new Map(),
  selectedCommunityName: "",
  map: null,
  pivdennaLayers: new Map(),
  pivdennaProfile: null,
  pivdennaFacts: null,
  pivdennaLayerIndex: null,
};

async function initDashboard() {
  bindEvents();

  state.communityMap = new Map(
    state.communities.map((community) => [
      normalizeName(community.community_name),
      community,
    ])
  );

  const [profile, facts, layerIndex] = await Promise.all([
    fetchOptionalJson(PIVDENNA_PROFILE_URL),
    fetchOptionalJson(PIVDENNA_FACTS_URL),
    fetchOptionalJson(PIVDENNA_LAYERS_INDEX_URL),
  ]);

  state.pivdennaProfile = profile;
  state.pivdennaFacts = facts;
  state.pivdennaLayerIndex = layerIndex;

  populateSelect();
  renderTable();
  initializeMap();
  clearProfile();
  clearAnalysis();
  clearStrategicProfile();
  renderPivdennaLayerList(false);
}

function bindEvents() {
  document.getElementById("community-select").addEventListener("change", (event) => {
    if (!event.target.value) {
      clearSelection();
      return;
    }

    setSelectedCommunity(event.target.value);
  });
}

async function fetchOptionalJson(url) {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      return null;
    }
    return response.json();
  } catch {
    return null;
  }
}

function populateSelect() {
  const select = document.getElementById("community-select");
  const options = [...state.communities]
    .sort((a, b) => a.community_name.localeCompare(b.community_name, "uk"))
    .map(
      (community) =>
        `<option value="${escapeHtml(community.community_name)}">${escapeHtml(
          community.community_name
        )}</option>`
    )
    .join("");

  select.innerHTML = `<option value="">Оберіть громаду</option>${options}`;
}

function renderTable() {
  const tbody = document.querySelector("#table tbody");

  tbody.innerHTML = state.communities
    .sort((a, b) => a.rank - b.rank)
    .map(
      (community) => `
        <tr data-community="${escapeHtml(community.community_name)}">
          <td>${community.rank}</td>
          <td><span class="community-name">${escapeHtml(community.community_name)}</span></td>
          <td>${renderStatusPill(community.stability_class)}</td>
          <td>${formatNumber(community.territorial_stability_index)}</td>
        </tr>
      `
    )
    .join("");

  tbody.querySelectorAll("tr").forEach((row) => {
    row.addEventListener("click", () => setSelectedCommunity(row.dataset.community));
  });
}

function setSelectedCommunity(communityName) {
  const community = getCommunityByName(communityName);
  if (!community) {
    clearSelection();
    return;
  }

  state.selectedCommunityName = community.community_name;
  document.getElementById("community-select").value = community.community_name;

  renderProfile(community);
  renderAnalysis(community);
  renderStrategicProfile(community);
  updateActiveRow();

  if (isPivdennaCommunity(community.community_name)) {
    updatePivdennaMapLayers();
    return;
  }

  clearPivdennaMapLayers();
  renderPivdennaLayerList(false);
  setPivdennaMapNoteVisible(false);
  focusDefaultMapView();
}

function clearSelection() {
  state.selectedCommunityName = "";
  document.getElementById("community-select").value = "";
  clearProfile();
  clearAnalysis();
  clearStrategicProfile();
  clearPivdennaMapLayers();
  renderPivdennaLayerList(false);
  setPivdennaMapNoteVisible(false);
  updateActiveRow();
  focusDefaultMapView();
}

function updateActiveRow() {
  document.querySelectorAll("#table tbody tr").forEach((row) => {
    row.classList.toggle(
      "active-row",
      normalizeName(row.dataset.community) === normalizeName(state.selectedCommunityName)
    );
  });
}

function renderProfile(community) {
  const profile = document.getElementById("profile");
  profile.className = "profile-content";
  profile.innerHTML = `
    <div class="profile-topline">
      <div>
        <h3 class="profile-title">${escapeHtml(community.community_name)}</h3>
        <p class="profile-meta">
          ${escapeHtml(community.region)} · ${escapeHtml(
            capitalizeText(community.community_type)
          )} громада · Населення: ${formatInteger(community.population)}
        </p>
      </div>
      <div class="profile-score">
        <span class="profile-score-label">Демонстраційний індекс стабільності</span>
        <strong>${formatNumber(community.territorial_stability_index)}</strong>
      </div>
    </div>

    <div class="profile-status-row">
      ${renderStatusPill(community.stability_class)}
      <span class="profile-rank">Місце в демо-рейтингу: ${community.rank}</span>
    </div>

    <div class="profile-grid">
      ${renderProfileItem("Просторовий індекс", formatNumber(community.spatial_index))}
      ${renderProfileItem("Розвитковий індекс", formatNumber(community.development_index))}
      ${renderProfileItem("Безпековий індекс", formatNumber(community.security_index))}
      ${renderProfileItem("Довідкова площа громади", formatArea(community.area_km2))}
    </div>
  `;
}

function renderProfileItem(label, value) {
  return `
    <article class="profile-item">
      <span class="profile-label">${escapeHtml(label)}</span>
      <span class="profile-value">${escapeHtml(value)}</span>
    </article>
  `;
}

function clearProfile() {
  const profile = document.getElementById("profile");
  profile.className = "profile-empty";
  profile.textContent = PROFILE_PLACEHOLDER;
}

function renderAnalysis(community) {
  const empty = document.getElementById("analysis-empty");
  const content = document.getElementById("analysis-content");
  const dimensions = getDimensions(community);
  const strongest = dimensions.reduce((best, current) =>
    current.value > best.value ? current : best
  );
  const weakest = dimensions.reduce((lowest, current) =>
    current.value < lowest.value ? current : lowest
  );

  empty.style.display = "none";
  content.hidden = false;

  document.getElementById("analysis-status-text").textContent =
    buildStatusText(community.territorial_stability_index);
  document.getElementById("analysis-strongest").textContent =
    `${strongest.label} (${formatNumber(strongest.value)}) має найвищу оцінку в демонстраційній моделі.`;
  document.getElementById("analysis-weakest").textContent =
    `${weakest.label} (${formatNumber(weakest.value)}) потребує додаткової уваги в межах пілотної оцінки.`;
  document.getElementById("analysis-recommendation").textContent =
    buildRecommendationText(weakest.key);
}

function clearAnalysis() {
  const empty = document.getElementById("analysis-empty");
  const content = document.getElementById("analysis-content");
  empty.style.display = "block";
  empty.textContent = ANALYSIS_PLACEHOLDER;
  content.hidden = true;
}

function renderStrategicProfile(community) {
  if (!isPivdennaCommunity(community.community_name)) {
    clearStrategicProfile(STRATEGIC_PLACEHOLDER);
    return;
  }

  const facts = state.pivdennaFacts ?? {};
  const profile = state.pivdennaProfile ?? {};
  const sections = profile.sections ?? {};
  const indicators = profile.indicators ?? {};
  const verification = profile["джерела_даних_та_рівень_верифікації"] ?? {};
  const container = document.getElementById("strategic-profile");

  container.className = "strategic-grid";
  container.innerHTML = `
    <div class="strategic-status">
      Ця версія є публічною демонстрацією інтерфейсу та базової логіки ISTD.
      Дані, індекси та стратегічні висновки подані у пілотному форматі та не є
      офіційним висновком щодо громади.
    </div>
    ${renderFactualProfileSection(facts, indicators, verification)}
    <div class="strategic-divider">Пілотні стратегічні висновки</div>
    ${[
      "поточний стан",
      "ключові просторові характеристики",
      "сильні сторони",
      "слабкі сторони",
      "ризики",
      "потенціал розвитку",
      "рекомендовані стратегічні пріоритети",
      "можливі проєктні напрями",
      "KPI для моніторингу",
    ]
      .map((key) => renderStrategicSection(key, sections[key]))
      .join("")}
  `;
}

function renderFactualProfileSection(facts, indicators = {}, verification = {}) {
  const boundary = facts.boundary_summary ?? {};
  const settlements = facts.settlements_summary ?? {};
  const transport = facts.transport_summary ?? {};
  const landUse = facts.land_use_summary ?? {};
  const availableLayers = indicators.available_gis_layers ?? [];
  const landUseCategories = Object.keys(landUse.approx_area_by_category_km2 ?? {});

  return `
    <section class="strategic-facts">
      <div class="strategic-facts-header">
        <h3>Фактична основа профілю</h3>
        <p>На основі підготовлених GIS-шарів. Показники мають демонстраційний характер.</p>
      </div>

      <div class="facts-grid">
        ${renderFactItem(
          "Площа за обробленим GIS-контуром",
          formatFactValue(boundary.approx_area_km2, " км²")
        )}
        ${renderFactItem("Населені пункти", formatFactValue(settlements.feature_count, " об'єкт(ів)"))}
        ${renderFactItem("Транспортна мережа", formatFactValue(transport.approx_total_length_km, " км"))}
        ${renderFactItem("Доступні GIS-шари", formatFactValue(indicators.available_gis_layers_count, " категорії"))}
      </div>

      <article class="strategic-section strategic-section-wide">
        <h3>Основні типи просторових даних</h3>
        <p>${escapeHtml(availableLayers.length ? availableLayers.join(", ") : "Потребує уточнення")}</p>
        <p class="muted-line">Категорії землекористування: ${escapeHtml(
          landUseCategories.length ? landUseCategories.slice(0, 8).join(", ") : "потребує уточнення"
        )}</p>
      </article>

      <article class="strategic-section strategic-section-wide">
        <h3>Що потребує уточнення</h3>
        <p>
          Показник площі за GIS-контуром є демонстраційним і потребує уточнення
          після перевірки повноти шару меж громади та системи координат.
          Окремі GIS-шари потребують додаткової технічної верифікації.
        </p>
      </article>

      ${renderVerificationList("Розраховані показники", verification["розраховані_показники"])}
      ${renderVerificationList("Потребує верифікації", verification["потребує_верифікації"])}
    </section>
  `;
}

function renderStrategicSection(title, items) {
  const values = Array.isArray(items) ? items : [items].filter(Boolean);
  if (!values.length) {
    return "";
  }

  return `
    <article class="strategic-section">
      <h3>${escapeHtml(title)}</h3>
      <ul>${values.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>
    </article>
  `;
}

function renderFactItem(label, value) {
  return `
    <article class="fact-item">
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(value)}</strong>
    </article>
  `;
}

function renderVerificationList(title, items) {
  if (!Array.isArray(items) || !items.length) {
    return "";
  }

  return `
    <article class="strategic-section">
      <h3>${escapeHtml(title)}</h3>
      <ul>${items.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>
    </article>
  `;
}

function clearStrategicProfile(message = "Оберіть громаду, щоб переглянути стратегічний профіль.") {
  const container = document.getElementById("strategic-profile");
  container.className = "strategic-empty";
  container.textContent = message;
}

function initializeMap() {
  if (state.map) {
    state.map.remove();
  }

  state.map = L.map("map", {
    zoomControl: true,
    minZoom: 8,
  });

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: "&copy; OpenStreetMap contributors",
  }).addTo(state.map);

  focusDefaultMapView();
}

async function updatePivdennaMapLayers() {
  await loadPivdennaMapLayers();
  showPivdennaMapLayersInOrder();
  fitPivdennaBoundaryBounds();
  renderPivdennaLayerList(true);
  setPivdennaMapNoteVisible(true);
}

async function loadPivdennaMapLayers() {
  if (!state.map || state.pivdennaLayers.size) {
    return;
  }

  const configs = getPivdennaLayerConfigs();
  const results = await Promise.all(
    configs.map(async (config) => {
      const geojson = await fetchOptionalJson(config.url);
      if (!geojson) {
        return { ...config, layer: null, featureCount: 0, available: false, visible: false };
      }

      const displayGeojson =
        config.key === "boundaries" ? buildSelectedBoundaryGeoJson(geojson) : geojson;
      const layer = L.geoJSON(displayGeojson, {
        style: () => config.style,
        pointToLayer: (_feature, latlng) => L.circleMarker(latlng, config.pointStyle ?? {}),
        onEachFeature: (feature, leafletLayer) => {
          const label = config.key === "boundaries" ? "Межа Південної громади" : getLayerFeatureLabel(feature);
          if (label) {
            leafletLayer.bindTooltip(label, { sticky: true, direction: "top" });
          }
          if (config.key === "boundaries") {
            leafletLayer.bindPopup("Межа Південної громади");
          }
        },
      });

      return {
        ...config,
        layer,
        featureCount: displayGeojson.features?.length ?? 0,
        visible: false,
        available: true,
      };
    })
  );

  results.forEach((result) => state.pivdennaLayers.set(result.key, result));
}

function getPivdennaLayerConfigs() {
  return PIVDENNA_LAYERS.map((config) => {
    const file = state.pivdennaLayerIndex?.categories?.[config.key]?.file;
    return {
      ...config,
      url: `assets/geojson/pivdenna_hromada/${file ?? `${config.key}.geojson`}`,
    };
  });
}

function buildSelectedBoundaryGeoJson(geojson) {
  const features = geojson?.features ?? [];
  if (!features.length) {
    return geojson;
  }

  const preferred = normalizeName(
    state.pivdennaLayerIndex?.categories?.boundaries?.preferred_source_layer ?? ""
  );
  const selected =
    features.find((feature) =>
      normalizeName(feature.properties?.istd_source_layer ?? "").includes(preferred)
    ) ?? features[0];

  return { ...geojson, features: [selected] };
}

function showPivdennaMapLayersInOrder() {
  PIVDENNA_LAYER_DRAW_ORDER.forEach((key) => {
    const entry = state.pivdennaLayers.get(key);
    if (!entry?.layer || !entry.featureCount) {
      return;
    }

    if (entry.defaultVisible !== false && !state.map.hasLayer(entry.layer)) {
      entry.layer.addTo(state.map);
      entry.visible = true;
    }

    if (key === "boundaries") {
      entry.layer.bringToFront();
    }
  });
}

function fitPivdennaBoundaryBounds() {
  const boundaryLayer = state.pivdennaLayers.get("boundaries")?.layer;
  if (!boundaryLayer) {
    return;
  }

  const bounds = boundaryLayer.getBounds();
  if (bounds.isValid()) {
    state.map.fitBounds(bounds.pad(0.12), {
      padding: [28, 28],
      maxZoom: 13,
    });
  }
}

function clearPivdennaMapLayers() {
  state.pivdennaLayers.forEach((entry) => {
    if (entry.layer && state.map?.hasLayer(entry.layer)) {
      state.map.removeLayer(entry.layer);
    }
    entry.visible = false;
  });
}

function renderPivdennaLayerList(isActive) {
  const container = document.getElementById("pivdenna-layer-list");
  if (!isActive) {
    container.className = "layer-list layer-list-empty";
    container.textContent = "Оберіть Південну громаду, щоб переглянути доступні шари.";
    return;
  }

  const entries = PIVDENNA_LAYERS.map((config) => state.pivdennaLayers.get(config.key) ?? config);
  container.className = "layer-list";
  container.innerHTML = entries
    .map((entry) => {
      const disabled = !entry.available || entry.featureCount === 0;
      const status = disabled
        ? "потребує уточнення"
        : entry.defaultVisible === false
          ? "вимкнено за замовчуванням"
          : "увімкнено за замовчуванням";

      return `
        <label class="layer-toggle ${disabled ? "layer-disabled" : ""}">
          <input
            type="checkbox"
            data-layer-key="${entry.key}"
            ${entry.visible ? "checked" : ""}
            ${disabled ? "disabled" : ""}
          />
          <span>
            <strong>${escapeHtml(entry.label)}</strong>
            <small>${escapeHtml(status)}</small>
          </span>
        </label>
      `;
    })
    .join("");

  container.querySelectorAll("input[type='checkbox']").forEach((checkbox) => {
    checkbox.addEventListener("change", () => {
      togglePivdennaLayer(checkbox.dataset.layerKey, checkbox.checked);
    });
  });
}

function togglePivdennaLayer(key, shouldShow) {
  const entry = state.pivdennaLayers.get(key);
  if (!entry?.layer) {
    return;
  }

  if (shouldShow) {
    entry.layer.addTo(state.map);
  } else {
    state.map.removeLayer(entry.layer);
  }

  entry.visible = shouldShow;
  const boundary = state.pivdennaLayers.get("boundaries");
  if (boundary?.layer && state.map.hasLayer(boundary.layer)) {
    boundary.layer.bringToFront();
  }
}

function setPivdennaMapNoteVisible(shouldShow) {
  const note = document.getElementById("pivdenna-map-note");
  if (note) {
    note.hidden = !shouldShow;
  }
}

function focusDefaultMapView() {
  if (state.map) {
    state.map.setView(MAP_FALLBACK_VIEW.center, MAP_FALLBACK_VIEW.zoom);
  }
}

function getDimensions(community) {
  return [
    { key: "spatial", label: "Просторовий контур", value: Number(community.spatial_index) },
    { key: "development", label: "Розвитковий контур", value: Number(community.development_index) },
    { key: "security", label: "Безпековий контур", value: Number(community.security_index) },
  ];
}

function buildStatusText(value) {
  const total = Number(value);
  if (total >= 0.72) {
    return `Пілотна оцінка демонструє відносно збалансований профіль; індекс становить ${formatNumber(total)}.`;
  }
  if (total >= 0.55) {
    return `Пілотна оцінка вказує на керований профіль з окремими напрямами для подальшого уточнення; індекс становить ${formatNumber(total)}.`;
  }
  if (total >= 0.4) {
    return `Пілотна оцінка вказує на потребу додаткової уваги до окремих напрямів розвитку та стійкості громади.`;
  }
  return "Пілотна оцінка вказує на потребу посиленої уваги до окремих напрямів розвитку та стійкості громади.";
}

function buildRecommendationText(weakestKey) {
  if (weakestKey === "spatial") {
    return "Попередній пілотний висновок: варто уточнити просторові дані, доступність та базову інфраструктуру після верифікації з громадою.";
  }
  if (weakestKey === "development") {
    return "Попередній пілотний висновок: може бути корисним деталізувати розвиткові показники та місцеві сервіси.";
  }
  return "Попередній пілотний висновок: доцільно уточнити безпекові та інфраструктурні показники після верифікації з громадою.";
}

function getLayerFeatureLabel(feature) {
  const properties = feature?.properties ?? {};
  return properties.name || properties.Name || properties.landuse || properties.istd_source_layer || "";
}

function getCommunityByName(name) {
  return state.communityMap.get(normalizeName(name)) ?? null;
}

function isPivdennaCommunity(name) {
  return normalizeName(name).includes("південн");
}

function getStabilityMeta(status) {
  const normalized = String(status ?? "").trim().toLowerCase();
  if (normalized === "high") {
    return { className: "high", label: "Висока" };
  }
  if (normalized === "operational") {
    return { className: "operational", label: "Функціональна" };
  }
  if (normalized === "vulnerable") {
    return { className: "vulnerable", label: "Потребує уваги" };
  }
  return { className: "critical", label: "Потребує пріоритетної уваги" };
}

function renderStatusPill(status) {
  const meta = getStabilityMeta(status);
  return `<span class="status-pill status-${meta.className}">${meta.label}</span>`;
}

function normalizeName(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFKC")
    .replace(/[’ʼ`´']/g, "")
    .replace(/["“”]/g, "")
    .replace(/[-–—]/g, "")
    .replace(/\s+/g, "");
}

function capitalizeText(value) {
  const text = String(value ?? "").trim();
  return text ? text.charAt(0).toUpperCase() + text.slice(1) : "—";
}

function formatNumber(value) {
  const number = Number(value);
  return Number.isNaN(number) ? "—" : number.toFixed(3);
}

function formatInteger(value) {
  const number = Number(value);
  return Number.isNaN(number) ? "—" : new Intl.NumberFormat("uk-UA").format(number);
}

function formatArea(value) {
  const number = Number(value);
  if (Number.isNaN(number)) {
    return "—";
  }
  return `${new Intl.NumberFormat("uk-UA", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(number)} км²`;
}

function formatFactValue(value, suffix) {
  const number = Number(value);
  if (value === null || value === undefined || Number.isNaN(number)) {
    return "Потребує уточнення";
  }
  return `${new Intl.NumberFormat("uk-UA", { maximumFractionDigits: 2 }).format(number)}${suffix}`;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

initDashboard();
