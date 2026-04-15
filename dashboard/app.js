const SCORES_URL = "../results/community_scores.json";
const GEOJSON_URL = "../data/communities.geojson";

const PROFILE_PLACEHOLDER =
  "Оберіть громаду, щоб переглянути її індекси, клас стабільності та короткий аналітичний висновок.";
const ANALYSIS_PLACEHOLDER =
  "Після вибору громади тут буде показано інтерпретацію результатів, ключову сильну сторону, основний ризик і коротку рекомендацію.";

const MAP_FALLBACK_VIEW = {
  center: [49.95, 36.25],
  zoom: 9,
};

const state = {
  communities: [],
  communityMap: new Map(),
  selectedCommunityName: "",
  map: null,
  geoJsonLayer: null,
  featureLayerMap: new Map(),
  defaultBounds: null,
};

async function initDashboard() {
  bindEvents();

  try {
    const [scores, geojson] = await Promise.all([
      fetchJson(SCORES_URL),
      fetchJson(GEOJSON_URL),
    ]);

    state.communities = [...scores].sort((a, b) => {
      const rankA = Number(a.rank ?? Number.POSITIVE_INFINITY);
      const rankB = Number(b.rank ?? Number.POSITIVE_INFINITY);

      if (rankA !== rankB) {
        return rankA - rankB;
      }

      return (
        Number(b.territorial_stability_index) -
        Number(a.territorial_stability_index)
      );
    });

    state.communityMap = new Map(
      state.communities.map((community) => [
        normalizeName(community.community_name),
        community,
      ])
    );

    populateSelect();
    renderTable();
    initializeMap(geojson);
    clearProfile();
    clearAnalysis();
  } catch (error) {
    console.error("Не вдалося завантажити дані панелі:", error);
    renderError(error);
  }
}

function bindEvents() {
  const select = document.getElementById("community-select");

  select.addEventListener("change", (event) => {
    const selectedName = event.target.value;

    if (!selectedName) {
      clearSelection();
      return;
    }

    setSelectedCommunity(selectedName);
  });
}

async function fetchJson(url) {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Помилка завантаження ${url}: ${response.status}`);
  }

  return response.json();
}

function populateSelect() {
  const select = document.getElementById("community-select");
  const placeholderOption = `<option value="">Оберіть громаду</option>`;

  const options = [...state.communities]
    .sort((a, b) => a.community_name.localeCompare(b.community_name, "uk"))
    .map(
      (community) =>
        `<option value="${community.community_name}">${community.community_name}</option>`
    )
    .join("");

  select.innerHTML = `${placeholderOption}${options}`;
}

function renderTable() {
  const tbody = document.querySelector("#table tbody");

  tbody.innerHTML = state.communities
    .map((community, index) => {
      const isActive =
        normalizeName(community.community_name) ===
        normalizeName(state.selectedCommunityName);

      return `
        <tr data-community="${community.community_name}" class="${isActive ? "active-row" : ""}">
          <td>${community.rank ?? index + 1}</td>
          <td><span class="community-name">${community.community_name}</span></td>
          <td>${renderStatusPill(community.stability_class)}</td>
          <td>${formatNumber(community.territorial_stability_index)}</td>
        </tr>
      `;
    })
    .join("");

  tbody.querySelectorAll("tr").forEach((row) => {
    row.addEventListener("click", () => {
      const communityName = row.dataset.community;
      setSelectedCommunity(communityName);
    });
  });
}

function setSelectedCommunity(communityName) {
  const community = getCommunityByName(communityName);

  if (!community) {
    clearSelection();
    return;
  }

  state.selectedCommunityName = community.community_name;

  const select = document.getElementById("community-select");
  select.value = community.community_name;

  renderProfile(community);
  renderAnalysis(community);
  updateActiveRow();
  highlightCommunityOnMap(community.community_name);
}

function clearSelection() {
  state.selectedCommunityName = "";
  document.getElementById("community-select").value = "";
  clearProfile();
  clearAnalysis();
  updateActiveRow();
  resetMapStyles();
  focusDefaultMapBounds();
}

function updateActiveRow() {
  const rows = document.querySelectorAll("#table tbody tr");

  rows.forEach((row) => {
    const isActive =
      normalizeName(row.dataset.community) ===
      normalizeName(state.selectedCommunityName);

    row.classList.toggle("active-row", isActive);
  });
}

function renderProfile(community) {
  const profile = document.getElementById("profile");

  profile.className = "profile-content";
  profile.innerHTML = `
    <div class="profile-topline">
      <div>
        <h3 class="profile-title">${community.community_name}</h3>
        <p class="profile-meta">
          ${community.region ?? "—"} · ${capitalizeText(community.community_type)} громада ·
          Населення: ${formatInteger(community.population)}
        </p>
      </div>

      <div class="profile-score">
        <span class="profile-score-label">Загальний індекс</span>
        <strong>${formatNumber(community.territorial_stability_index)}</strong>
      </div>
    </div>

    <div class="profile-status-row">
      ${renderStatusPill(community.stability_class)}
      <span class="profile-rank">Місце в рейтингу: ${community.rank ?? "—"}</span>
    </div>

    <div class="profile-grid">
      <article class="profile-item">
        <span class="profile-label">Просторовий індекс</span>
        <span class="profile-value">${formatNumber(community.spatial_index)}</span>
      </article>

      <article class="profile-item">
        <span class="profile-label">Розвитковий індекс</span>
        <span class="profile-value">${formatNumber(community.development_index)}</span>
      </article>

      <article class="profile-item">
        <span class="profile-label">Безпековий індекс</span>
        <span class="profile-value">${formatNumber(community.security_index)}</span>
      </article>

      <article class="profile-item">
        <span class="profile-label">Площа громади</span>
        <span class="profile-value">${formatArea(community.area_km2)}</span>
      </article>
    </div>
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
    `${strongest.label} (${formatNumber(strongest.value)}) підтримує найкращу частину поточного профілю громади.`;
  document.getElementById("analysis-weakest").textContent =
    `${weakest.label} (${formatNumber(weakest.value)}) найбільше стримує загальний індекс і потребує першочергової уваги.`;
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

function getDimensions(community) {
  return [
    {
      key: "spatial",
      label: "Просторовий контур",
      value: Number(community.spatial_index),
    },
    {
      key: "development",
      label: "Розвитковий контур",
      value: Number(community.development_index),
    },
    {
      key: "security",
      label: "Безпековий контур",
      value: Number(community.security_index),
    },
  ];
}

function buildStatusText(value) {
  const total = Number(value);

  if (total >= 0.72) {
    return `Громада демонструє збалансований і достатньо стійкий профіль; загальний індекс ${formatNumber(total)} свідчить про добру керованість ризиків.`;
  }

  if (total >= 0.55) {
    return `Стан громади загалом є керованим, однак окремі напрями вже впливають на загальну стійкість; поточний індекс становить ${formatNumber(total)}.`;
  }

  if (total >= 0.4) {
    return `Профіль громади є вразливим: індекс ${formatNumber(total)} показує нестійкий баланс і потребу у цільових управлінських діях.`;
  }

  return `Громада перебуває в напруженому стані: індекс ${formatNumber(total)} сигналізує про низьку стійкість і потребу в пріоритетному посиленні слабких напрямів.`;
}

function buildRecommendationText(weakestKey) {
  if (weakestKey === "spatial") {
    return "Сфокусувати короткий план дій на просторовій спроможності: доступності, базовій інфраструктурі, логістиці та просторовому плануванні.";
  }

  if (weakestKey === "development") {
    return "Посилити розвитковий контур через підтримку місцевої економіки, сервісів для мешканців та проєктів, що підвищують спроможність громади.";
  }

  return "Першочергово посилити безпековий контур: готовність служб, стійкість критичної інфраструктури та координацію реагування на ризики.";
}

function initializeMap(geojson) {
  state.featureLayerMap = new Map();

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

  state.geoJsonLayer = L.geoJSON(geojson, {
    style: (feature) => getDefaultStyle(feature),
    onEachFeature: (feature, layer) => {
      const featureName = getFeatureName(feature);

      if (featureName) {
        state.featureLayerMap.set(normalizeName(featureName), layer);
        layer.bindTooltip(featureName, {
          sticky: true,
          direction: "top",
        });
      }

      layer.on({
        click: () => {
          if (featureName) {
            setSelectedCommunity(featureName);
          }
        },
        mouseover: () => handleLayerMouseOver(layer),
        mouseout: () => handleLayerMouseOut(layer),
      });
    },
  }).addTo(state.map);

  const bounds = state.geoJsonLayer.getBounds();

  if (bounds.isValid()) {
    state.defaultBounds = bounds;
    state.map.fitBounds(bounds, { padding: [24, 24] });
  } else {
    state.map.setView(MAP_FALLBACK_VIEW.center, MAP_FALLBACK_VIEW.zoom);
  }
}

function getDefaultStyle(feature) {
  const community = getCommunityByName(getFeatureName(feature));

  return {
    fillColor: getScoreColor(community?.territorial_stability_index),
    color: "#ffffff",
    weight: 1.8,
    opacity: 1,
    fillOpacity: 0.74,
  };
}

function getHoverStyle(feature) {
  const baseStyle = getDefaultStyle(feature);

  return {
    ...baseStyle,
    color: "#486b8a",
    weight: 2.4,
    fillOpacity: 0.84,
  };
}

function getSelectedStyle(feature) {
  const baseStyle = getDefaultStyle(feature);

  return {
    ...baseStyle,
    color: "#16324f",
    weight: 3.2,
    fillOpacity: 0.92,
  };
}

function resetMapStyles() {
  if (!state.geoJsonLayer) {
    return;
  }

  state.geoJsonLayer.eachLayer((layer) => {
    layer.setStyle(getDefaultStyle(layer.feature));
  });
}

function highlightCommunityOnMap(communityName) {
  if (!state.geoJsonLayer || !state.map) {
    return;
  }

  resetMapStyles();

  const targetLayer = state.featureLayerMap.get(normalizeName(communityName));

  if (!targetLayer) {
    focusDefaultMapBounds();
    return;
  }

  targetLayer.setStyle(getSelectedStyle(targetLayer.feature));

  if (typeof targetLayer.bringToFront === "function") {
    targetLayer.bringToFront();
  }

  const bounds = targetLayer.getBounds();

  if (bounds.isValid()) {
    state.map.fitBounds(bounds.pad(0.35), {
      padding: [32, 32],
      maxZoom: 11,
    });
  }
}

function handleLayerMouseOver(layer) {
  const featureName = getFeatureName(layer.feature);

  if (normalizeName(featureName) === normalizeName(state.selectedCommunityName)) {
    layer.setStyle(getSelectedStyle(layer.feature));
    return;
  }

  layer.setStyle(getHoverStyle(layer.feature));
}

function handleLayerMouseOut(layer) {
  const featureName = getFeatureName(layer.feature);

  if (normalizeName(featureName) === normalizeName(state.selectedCommunityName)) {
    layer.setStyle(getSelectedStyle(layer.feature));
    return;
  }

  layer.setStyle(getDefaultStyle(layer.feature));
}

function focusDefaultMapBounds() {
  if (!state.map) {
    return;
  }

  if (state.defaultBounds && state.defaultBounds.isValid()) {
    state.map.fitBounds(state.defaultBounds, { padding: [24, 24] });
    return;
  }

  state.map.setView(MAP_FALLBACK_VIEW.center, MAP_FALLBACK_VIEW.zoom);
}

function getFeatureName(feature) {
  const properties = feature?.properties ?? {};

  return (
    properties.name ||
    properties.community_name ||
    properties.community ||
    properties.hromada ||
    ""
  );
}

function getCommunityByName(name) {
  return state.communityMap.get(normalizeName(name)) ?? null;
}

function getScoreColor(value) {
  const score = Number(value);

  if (score >= 0.72) {
    return "#5f8a67";
  }

  if (score >= 0.55) {
    return "#6f94ba";
  }

  if (score >= 0.4) {
    return "#c59a52";
  }

  return "#c46d6d";
}

function renderStatusPill(status) {
  const meta = getStabilityMeta(status);
  return `<span class="status-pill status-${meta.className}">${meta.label}</span>`;
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
    return { className: "vulnerable", label: "Вразлива" };
  }

  return { className: "critical", label: "Критична" };
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

  if (!text) {
    return "—";
  }

  return text.charAt(0).toUpperCase() + text.slice(1);
}

function formatNumber(value) {
  const number = Number(value);

  if (Number.isNaN(number)) {
    return "—";
  }

  return number.toFixed(3);
}

function formatInteger(value) {
  const number = Number(value);

  if (Number.isNaN(number)) {
    return "—";
  }

  return new Intl.NumberFormat("uk-UA").format(number);
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

function renderError(error) {
  const tbody = document.querySelector("#table tbody");
  const message = `Не вдалося завантажити дані: ${error.message}`;
  const profile = document.getElementById("profile");
  const analysisEmpty = document.getElementById("analysis-empty");
  const analysisContent = document.getElementById("analysis-content");

  tbody.innerHTML = `<tr><td colspan="4" class="table-message">${message}</td></tr>`;
  profile.className = "profile-empty profile-error";
  profile.textContent = message;
  analysisEmpty.style.display = "block";
  analysisEmpty.textContent = message;
  analysisContent.hidden = true;
}

initDashboard();
