let allData = [];
let map;
let geoJsonLayer;
let selectedCommunityName = "";

async function loadData() {
  try {
    const response = await fetch("../results/community_scores.json");

    if (!response.ok) {
      throw new Error(`HTTP error: ${response.status}`);
    }

    allData = await response.json();

    populateSelect();
    renderTable();
    initMap();
  } catch (error) {
    console.error("Помилка завантаження даних:", error);
    renderError(error);
  }
}

function populateSelect() {
  const select = document.getElementById("community-select");
  select.innerHTML = `<option value="">-- Оберіть громаду --</option>`;

  const sorted = [...allData].sort((a, b) =>
    String(a.community_name).localeCompare(String(b.community_name), "uk")
  );

  sorted.forEach((item) => {
    const option = document.createElement("option");
    option.value = item.community_name;
    option.textContent = item.community_name;
    select.appendChild(option);
  });

  select.addEventListener("change", (event) => {
    const selectedName = event.target.value;
    if (!selectedName) {
      selectedCommunityName = "";
      clearProfile();
      updateActiveRow();
      resetMapStyles();
      return;
    }

    const community = allData.find(
      (item) => normalizeName(item.community_name) === normalizeName(selectedName)
    );

    if (community) {
      selectedCommunityName = community.community_name;
      renderProfile(community);
      updateActiveRow();
      highlightCommunityOnMap(community.community_name);
    }
  });
}

function renderTable() {
  const tbody = document.querySelector("#table tbody");
  tbody.innerHTML = "";

  const sortedData = [...allData].sort(
    (a, b) => Number(b.territorial_stability_index) - Number(a.territorial_stability_index)
  );

  sortedData.forEach((row, index) => {
    const tr = document.createElement("tr");
    tr.dataset.community = row.community_name;

    tr.innerHTML = `
      <td>${index + 1}</td>
      <td>${row.community_name}</td>
      <td>${formatNumber(row.territorial_stability_index)}</td>
    `;

    tr.addEventListener("click", () => {
      selectedCommunityName = row.community_name;
      document.getElementById("community-select").value = row.community_name;
      renderProfile(row);
      updateActiveRow();
      highlightCommunityOnMap(row.community_name);
    });

    tbody.appendChild(tr);
  });
}

function updateActiveRow() {
  const rows = document.querySelectorAll("#table tbody tr");

  rows.forEach((row) => {
    const rowName = row.dataset.community;
    if (normalizeName(rowName) === normalizeName(selectedCommunityName)) {
      row.classList.add("active-row");
    } else {
      row.classList.remove("active-row");
    }
  });
}

function renderProfile(data) {
  const profile = document.getElementById("profile");

  profile.innerHTML = `
    <h3 class="profile-title">${data.community_name}</h3>
    <div class="profile-meta">
      ${data.region ?? "—"} · ${data.community_type ?? "—"} · Населення: ${formatInteger(data.population)}
    </div>

    <div class="profile-grid">
      <div class="profile-item">
        <span class="profile-label">Spatial Index</span>
        <span class="profile-value">${formatNumber(data.spatial_index)}</span>
      </div>

      <div class="profile-item">
        <span class="profile-label">Development Index</span>
        <span class="profile-value">${formatNumber(data.development_index)}</span>
      </div>

      <div class="profile-item">
        <span class="profile-label">Security Index</span>
        <span class="profile-value">${formatNumber(data.security_index)}</span>
      </div>

      <div class="profile-item">
        <span class="profile-label">Total Stability Index</span>
        <span class="profile-value">${formatNumber(data.territorial_stability_index)}</span>
      </div>

      <div class="profile-item">
        <span class="profile-label">Клас стабільності</span>
        <span class="profile-value">${renderBadge(data.stability_class)}</span>
      </div>

      <div class="profile-item">
        <span class="profile-label">Місце в рейтингу</span>
        <span class="profile-value">#${data.rank ?? "—"}</span>
      </div>
    </div>
  `;
}

function clearProfile() {
  document.getElementById("profile").innerHTML = "Оберіть громаду";
}

function renderBadge(status) {
  const normalized = String(status || "").toLowerCase();

  if (normalized === "high") {
    return `<span class="badge badge-high">High</span>`;
  }
  if (normalized === "operational") {
    return `<span class="badge badge-operational">Operational</span>`;
  }
  if (normalized === "vulnerable") {
    return `<span class="badge badge-vulnerable">Vulnerable</span>`;
  }
  return `<span class="badge badge-critical">Critical</span>`;
}

function getColor(value) {
  if (value > 0.8) return "#16a34a";
  if (value > 0.6) return "#0ea5e9";
  if (value > 0.4) return "#f59e0b";
  return "#ef4444";
}

function normalizeName(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/’/g, "'")
    .replace(/`/g, "'")
    .replace(/"/g, "");
}

function getDefaultStyle(feature) {
  const featureName =
    feature?.properties?.name ||
    feature?.properties?.community_name ||
    feature?.properties?.name_uk ||
    "";

  const community = allData.find(
    (c) => normalizeName(c.community_name) === normalizeName(featureName)
  );

  if (!community) {
    return {
      fillColor: "#cbd5e1",
      weight: 1,
      opacity: 1,
      color: "#475569",
      fillOpacity: 0.45,
    };
  }

  return {
    fillColor: getColor(Number(community.territorial_stability_index)),
    weight: 1,
    opacity: 1,
    color: "#1e293b",
    fillOpacity: 0.7,
  };
}

async function initMap() {
  if (map) {
    map.remove();
  }

  map = L.map("map").setView([49.95, 36.25], 9);

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: "© OpenStreetMap contributors",
  }).addTo(map);

  try {
    const geoResponse = await fetch("../data/communities.geojson");

    if (!geoResponse.ok) {
      throw new Error(`GeoJSON HTTP error: ${geoResponse.status}`);
    }

    const geojson = await geoResponse.json();

    geoJsonLayer = L.geoJSON(geojson, {
      style: (feature) => getDefaultStyle(feature),
      onEachFeature: (feature, layer) => {
        const featureName =
          feature?.properties?.name ||
          feature?.properties?.community_name ||
          feature?.properties?.name_uk ||
          "";

        const community = allData.find(
          (c) => normalizeName(c.community_name) === normalizeName(featureName)
        );

        const popupContent = community
          ? `
            <strong>${community.community_name}</strong><br>
            Total Index: ${formatNumber(community.territorial_stability_index)}<br>
            Class: ${community.stability_class ?? "—"}
          `
          : `<strong>${featureName || "Невідома громада"}</strong><br>Немає даних`;

        layer.bindPopup(popupContent);

        layer.on("click", () => {
          if (community) {
            selectedCommunityName = community.community_name;
            document.getElementById("community-select").value = community.community_name;
            renderProfile(community);
            updateActiveRow();
            highlightCommunityOnMap(community.community_name);
          }
        });
      },
    }).addTo(map);

    if (geoJsonLayer.getLayers().length > 0) {
      map.fitBounds(geoJsonLayer.getBounds(), { padding: [20, 20] });
    }
  } catch (error) {
    console.error("Помилка завантаження GeoJSON:", error);
  }
}

function resetMapStyles() {
  if (!geoJsonLayer) return;

  geoJsonLayer.eachLayer((layer) => {
    layer.setStyle(getDefaultStyle(layer.feature));
  });
}

function highlightCommunityOnMap(communityName) {
  if (!geoJsonLayer) return;

  geoJsonLayer.eachLayer((layer) => {
    const featureName =
      layer.feature?.properties?.name ||
      layer.feature?.properties?.community_name ||
      layer.feature?.properties?.name_uk ||
      "";

    const isTarget =
      normalizeName(featureName) === normalizeName(communityName);

    if (isTarget) {
      layer.setStyle({
        fillColor: getDefaultStyle(layer.feature).fillColor,
        weight: 3,
        opacity: 1,
        color: "#ffffff",
        fillOpacity: 0.9,
      });

      if (layer.getBounds) {
        map.fitBounds(layer.getBounds(), { padding: [30, 30] });
      }

      layer.openPopup();
    } else {
      layer.setStyle(getDefaultStyle(layer.feature));
    }
  });
}

function formatNumber(value) {
  const num = Number(value);
  if (Number.isNaN(num)) return "—";
  return num.toFixed(3);
}

function formatInteger(value) {
  const num = Number(value);
  if (Number.isNaN(num)) return "—";
  return new Intl.NumberFormat("uk-UA").format(num);
}

function renderError(error) {
  const tbody = document.querySelector("#table tbody");
  tbody.innerHTML = `
    <tr>
      <td colspan="3">Помилка завантаження даних: ${error.message}</td>
    </tr>
  `;

  document.getElementById("profile").innerHTML =
    "Не вдалося завантажити результати розрахунку.";
}

loadData();