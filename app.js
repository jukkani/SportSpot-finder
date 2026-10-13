const CONFIG = window.APP_CONFIG;

const state = {
  map: null,
  routeLayer: null,
  routeController: null,
  routeRequestId: 0,
  itineraries: [],
  userMarker: null,
  userLocation: null,
  cityCode: null,
  cityName: null,
  locationRequestId: 0,
  geocodeController: null,
  catalogueController: null,
  lastGeocodeAt: 0,
  places: [],
  markers: new Map(),
  nextPage: 1,
  totalPages: 1,
  loading: false,
};

const elements = {
  locateButton: document.querySelector("#locate-button"),
  locationStatus: document.querySelector("#location-status"),
  radiusSelect: document.querySelector("#radius-select"),
  routePanel: document.querySelector("#route-panel"),
  routeStatus: document.querySelector("#route-status"),
  routeOptions: document.querySelector("#route-options"),
  resultCount: document.querySelector("#result-count"),
  placeList: document.querySelector("#place-list"),
  loadMore: document.querySelector("#load-more"),
  catalogueStatus: document.querySelector("#catalogue-status"),
  mapTitle: document.querySelector("#map-title"),
  mapCount: document.querySelector("#map-count"),
  notice: document.querySelector("#notice"),
};

const typeIcons = new Map();

function registerTypeIcons(iconClass, typeCodes) {
  typeCodes.forEach((typeCode) => typeIcons.set(typeCode, iconClass));
}

registerTypeIcons("fa-tree", [101, 103, 106, 107, 111, 112]);
registerTypeIcons("fa-person-hiking", [109, 110, 4403, 4404, 4405, 4406, 4510]);
registerTypeIcons("fa-fish", [113, 201]);
registerTypeIcons("fa-ship", [203, 5110, 5130, 5140]);
registerTypeIcons("fa-binoculars", [204, 207]);
registerTypeIcons("fa-fire", [206]);
registerTypeIcons("fa-tent", [202, 301, 302, 304]);
registerTypeIcons("fa-person-running", [1110, 1120, 1140, 1210, 1220, 2110, 2140, 2150, 2210, 2220, 2225, 2230, 2240, 2250, 2260, 2270, 2280, 2290, 2295, 2310, 2320, 2330, 2340, 2350, 2380, 2610, 2620, 6210, 6220]);
registerTypeIcons("fa-dumbbell", [1130, 2120, 2130]);
registerTypeIcons("fa-person-skating", [1150, 1380, 1510, 1520, 1530, 1540, 1550, 1560, 2240, 2510, 2520, 2530]);
registerTypeIcons("fa-bicycle", [1160, 1170, 4411, 4412]);
registerTypeIcons("fa-bullseye", [1180, 2360, 4810, 4820, 4830, 4840]);
registerTypeIcons("fa-person-skiing", [1190, 4110, 4220, 4230, 4240, 4320, 4402, 4407, 4421, 4422, 4440, 4441, 4610, 4620, 4630, 4640, 5370]);
registerTypeIcons("fa-basketball", [1310]);
registerTypeIcons("fa-volleyball", [1320, 1330]);
registerTypeIcons("fa-futbol", [1340, 1350, 2230, 4401]);
registerTypeIcons("fa-baseball", [1360]);
registerTypeIcons("fa-table-tennis-paddle-ball", [1370, 1390, 1395, 2260, 2270, 2280, 2295, 2330]);
registerTypeIcons("fa-person-swimming", [3110, 3120, 3130, 3210, 3220, 3230, 3240, 3250, 4451, 4452]);
registerTypeIcons("fa-golf-ball-tee", [1610, 1630, 1640, 1650]);
registerTypeIcons("fa-bowling-ball", [2610]);
registerTypeIcons("fa-snowflake", [4210]);
registerTypeIcons("fa-mountain", [2370, 4710, 4720]);
registerTypeIcons("fa-sailboat", [5120, 5150, 5160]);
registerTypeIcons("fa-person-skiing", [5140]);
registerTypeIcons("fa-plane", [5210]);
registerTypeIcons("fa-car", [5310, 5330, 5340, 5350, 5360]);
registerTypeIcons("fa-person-biking", [5320]);
registerTypeIcons("fa-horse", [4430, 6110, 6120, 6130, 6140, 6150]);
registerTypeIcons("fa-house", [7000]);

function iconForType(typeCode) {
  return typeIcons.get(Number(typeCode)) || "fa-bullseye";
}

function initMap() {
  state.map = L.map("map", {
    scrollWheelZoom: true,
    zoomControl: false,
  }).setView(CONFIG.defaultMapCenter, CONFIG.defaultMapZoom);

  L.tileLayer(CONFIG.mapTileUrl, {
    maxZoom: CONFIG.mapMaxZoom,
    attribution: CONFIG.mapAttribution,
  }).addTo(state.map);

  L.control.zoom({ position: "bottomright" }).addTo(state.map);
  state.routeLayer = L.layerGroup().addTo(state.map);
  state.map.on("click", (event) => {
    setLocation(event.latlng.lat, event.latlng.lng, "manual");
  });
}

function setNotice(message, isError = false) {
  elements.notice.hidden = !message;
  elements.notice.textContent = message;
  elements.notice.style.background = isError ? "#fff0ed" : "";
  elements.notice.style.borderColor = isError ? "#f1d4cd" : "";
  elements.notice.style.color = isError ? "#8b3929" : "";
}

function setLoading(loading) {
  state.loading = loading;
  elements.locateButton.disabled = loading;
  elements.loadMore.disabled = loading;
  elements.loadMore.textContent = loading ? "Loading places…" : "Load more places ↓";
}

function representativePoint(geometry) {
  if (!geometry || !geometry.coordinates) return null;

  let points;
  if (geometry.type === "Point") {
    return isValidCoordinate(geometry.coordinates) ? geometry.coordinates : null;
  }
  if (geometry.type === "LineString" || geometry.type === "MultiPoint") {
    points = geometry.coordinates;
  } else if (geometry.type === "Polygon") {
    points = geometry.coordinates[0];
  } else if (geometry.type === "MultiLineString") {
    points = geometry.coordinates.flat();
  } else if (geometry.type === "MultiPolygon") {
    points = geometry.coordinates.flat(2);
  } else {
    return null;
  }

  const validPoints = points.filter(isValidCoordinate);
  if (!validPoints.length) return null;
  return [
    validPoints.reduce((sum, point) => sum + point[0], 0) / validPoints.length,
    validPoints.reduce((sum, point) => sum + point[1], 0) / validPoints.length,
  ];
}

function isValidCoordinate(value) {
  return (
    Array.isArray(value) &&
    value.length >= 2 &&
    Number.isFinite(value[0]) &&
    Number.isFinite(value[1]) &&
    Math.abs(value[0]) <= 180 &&
    Math.abs(value[1]) <= 90
  );
}

function toPlace(record) {
  const geometries = record.location?.geometries?.features ?? [];
  for (const feature of geometries) {
    const point = representativePoint(feature.geometry);
    if (!point) continue;

    return {
      id: record["lipas-id"],
      name: record.name || "Unnamed sports place",
      typeCode: record.type?.["type-code"],
      iconClass: iconForType(record.type?.["type-code"]),
      address: record.location?.address || "",
      lat: point[1],
      lon: point[0],
      www: record.www,
    };
  }
  return null;
}

function distanceKm(from, to) {
  const radians = (degrees) => (degrees * Math.PI) / 180;
  const lat1 = radians(from.lat);
  const lat2 = radians(to.lat);
  const deltaLat = radians(to.lat - from.lat);
  const deltaLon = radians(to.lon - from.lon);
  const value =
    Math.sin(deltaLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLon / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value));
}

function formatDistance(distance) {
  if (distance < 1) return `${Math.round(distance * 1000)} m`;
  return `${distance.toFixed(distance < 10 ? 1 : 0)} km`;
}

function getVisiblePlaces() {
  if (!state.userLocation) return [];
  const radius = Number(elements.radiusSelect.value);
  return state.places
    .map((place) => ({
      ...place,
      distance: distanceKm(state.userLocation, place),
    }))
    .filter((place) => place.distance <= radius)
    .sort((a, b) => a.distance - b.distance);
}

function renderPlaces() {
  const places = getVisiblePlaces();
  elements.resultCount.textContent = String(places.length);
  elements.mapCount.textContent = `${places.length} ${places.length === 1 ? "place" : "places"}`;
  elements.loadMore.hidden = state.nextPage > state.totalPages;
  elements.loadMore.disabled = state.loading;

  if (!places.length) {
    elements.placeList.innerHTML = `
      <div class="empty-state">
        <span class="empty-icon" aria-hidden="true">⌖</span>
        <strong>No places found in this radius yet</strong>
        <span>Try a wider search or load more of the LIPAS catalogue.</span>
      </div>`;
  } else {
    const fragment = document.createDocumentFragment();
    places.forEach((place) => {
      const card = document.createElement("button");
      card.type = "button";
      card.className = "place-card";
      card.dataset.placeId = String(place.id);
      card.setAttribute("aria-label", `${place.name}, ${formatDistance(place.distance)} away`);

      const icon = document.createElement("span");
      icon.className = "place-icon";
      icon.setAttribute("aria-hidden", "true");
      const iconGlyph = document.createElement("i");
      iconGlyph.className = `fa-solid ${place.iconClass}`;
      icon.append(iconGlyph);

      const main = document.createElement("span");
      main.className = "place-main";
      const titleRow = document.createElement("span");
      titleRow.className = "place-title-row";
      const name = document.createElement("span");
      name.className = "place-name";
      name.textContent = place.name;
      const distance = document.createElement("span");
      distance.className = "place-distance";
      distance.textContent = formatDistance(place.distance);
      titleRow.append(name, distance);

      const meta = document.createElement("span");
      meta.className = "place-meta";
      meta.textContent = place.typeCode ? `LIPAS place · Type ${place.typeCode}` : "LIPAS sports place";
      main.append(titleRow, meta);
      if (place.address) {
        const address = document.createElement("span");
        address.className = "place-address";
        address.textContent = place.address;
        main.append(address);
      }
      card.append(icon, main);
      card.addEventListener("click", () => focusPlace(place));
      fragment.append(card);

      updateMarker(place);
    });
    elements.placeList.replaceChildren(fragment);
  }

  updateCatalogueStatus();
  removeStaleMarkers(places);
}

function updateMarker(place) {
  if (!state.map) return;
  const markerHtml = `<div class="facility-marker"><i class="fa-solid ${place.iconClass}" aria-hidden="true"></i></div>`;
  const icon = L.divIcon({
    className: "",
    html: markerHtml,
    iconSize: [27, 27],
    iconAnchor: [13, 27],
    popupAnchor: [0, -25],
  });
  const popup = document.createElement("div");
  const title = document.createElement("div");
  title.className = "popup-title";
  title.textContent = place.name;
  const detail = document.createElement("div");
  detail.className = "popup-detail";
  detail.textContent = `${formatDistance(place.distance)} away · LIPAS`;
  popup.append(title, detail);
  const safeWebsite = safeWebsiteUrl(place.www);
  if (safeWebsite) {
    const websiteLink = document.createElement("a");
    websiteLink.className = "popup-link";
    websiteLink.href = safeWebsite;
    websiteLink.target = "_blank";
    websiteLink.rel = "noopener noreferrer";
    websiteLink.textContent = "Visit website ↗";
    popup.append(websiteLink);
  }
  const routeButton = document.createElement("button");
  routeButton.type = "button";
  routeButton.className = "popup-route-button";
  routeButton.textContent = "Show route";
  routeButton.addEventListener("click", (event) => {
    event.stopPropagation();
    requestRoute(place);
  });
  popup.append(routeButton);
  let marker = state.markers.get(place.id);
  if (marker) {
    marker.setIcon(icon).setPopupContent(popup);
  } else {
    marker = L.marker([place.lat, place.lon], { icon }).bindPopup(popup);
    marker.addTo(state.map);
    state.markers.set(place.id, marker);
  }
}

function removeStaleMarkers(places) {
  const visibleIds = new Set(places.map((place) => place.id));
  for (const [id, marker] of state.markers) {
    if (!visibleIds.has(id)) {
      marker.remove();
      state.markers.delete(id);
    }
  }
}

function safeWebsiteUrl(value) {
  if (typeof value !== "string" || !value.trim()) return null;
  try {
    const url = new URL(value.trim());
    return url.protocol === "http:" || url.protocol === "https:" ? url.href : null;
  } catch {
    return null;
  }
}

function focusPlace(place) {
  state.map.setView([place.lat, place.lon], CONFIG.placeFocusZoom);
  const marker = state.markers.get(place.id);
  if (marker) marker.openPopup();
  document.querySelectorAll(".place-card").forEach((card) => {
    card.classList.toggle("is-selected", card.dataset.placeId === String(place.id));
  });
}

function clearRoute() {
  state.routeRequestId += 1;
  state.routeController?.abort();
  state.routeController = null;
  state.itineraries = [];
  state.routeLayer.clearLayers();
  elements.routePanel.hidden = true;
  elements.routeStatus.textContent = "";
  elements.routeOptions.replaceChildren();
}

function decodePolyline(encoded) {
  const points = [];
  let index = 0;
  let latitude = 0;
  let longitude = 0;

  while (index < encoded.length) {
    const deltas = [];
    for (let coordinate = 0; coordinate < 2; coordinate += 1) {
      let result = 0;
      let shift = 0;
      let chunk;
      do {
        if (index >= encoded.length) throw new Error("Route geometry is incomplete.");
        chunk = encoded.charCodeAt(index) - 63;
        if (chunk < 0 || chunk > 63) throw new Error("Route geometry contains an invalid character.");
        index += 1;
        result |= (chunk & 0x1f) << shift;
        shift += 5;
      } while (chunk >= 0x20);
      deltas.push(result & 1 ? ~(result >> 1) : result >> 1);
    }
    latitude += deltas[0];
    longitude += deltas[1];
    points.push([latitude / 1e5, longitude / 1e5]);
  }

  return points;
}

function formatDuration(seconds) {
  const minutes = Math.max(1, Math.round(seconds / 60));
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return remainingMinutes ? `${hours} h ${remainingMinutes} min` : `${hours} h`;
}

function formatRouteMode(mode) {
  const labels = {
    WALK: "Walk",
    BUS: "Bus",
    RAIL: "Train",
    SUBWAY: "Metro",
    TRAM: "Tram",
    FERRY: "Ferry",
  };
  return labels[mode] || mode.toLowerCase().replaceAll("_", " ");
}

function renderRoutePanel() {
  elements.routePanel.hidden = false;
  elements.routeOptions.replaceChildren();
  if (!state.itineraries.length) return;

  state.itineraries.forEach((itinerary, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "route-option";
    button.setAttribute("aria-pressed", String(index === 0));
    const modes = [...new Set(itinerary.legs.map((leg) => formatRouteMode(leg.mode)))];
    button.textContent = `${index + 1}. ${formatDuration(itinerary.duration)} · ${modes.join(" + ")}`;
    button.addEventListener("click", () => drawItinerary(index));
    elements.routeOptions.append(button);
  });
}

function drawItinerary(index) {
  const itinerary = state.itineraries[index];
  if (!itinerary) return;
  state.routeLayer.clearLayers();
  const allPoints = [];

  for (const leg of itinerary.legs) {
    if (!leg.points.length) continue;
    if (leg.points.length < 2) continue;
    const line = L.polyline(leg.points, {
      color: leg.mode === "WALK" ? "#547d67" : "#2576c5",
      weight: leg.mode === "WALK" ? 4 : 5,
      opacity: 0.9,
      dashArray: leg.mode === "WALK" ? "7 7" : null,
    });
    state.routeLayer.addLayer(line);
    allPoints.push(...leg.points);
  }

  if (!allPoints.length) {
    throw new Error("Digitransit returned an itinerary without drawable route geometry.");
  }

  elements.routeOptions.querySelectorAll(".route-option").forEach((button, buttonIndex) => {
    button.setAttribute("aria-pressed", String(buttonIndex === index));
  });
  state.map.fitBounds(L.latLngBounds(allPoints).pad(0.12), { maxZoom: CONFIG.placeFocusZoom });
}

async function requestRoute(place) {
  if (!state.userLocation) {
    setNotice("Choose your location on the map or use your device location before requesting a route.", true);
    return;
  }
  if (!CONFIG.digitransitKey) {
    setNotice("Add a Digitransit subscription key to config.js before requesting routes.", true);
    return;
  }

  clearRoute();
  const requestId = state.routeRequestId;
  const controller = new AbortController();
  state.routeController = controller;
  elements.routePanel.hidden = false;
  elements.routeStatus.textContent = "Finding route…";

  const origin = state.userLocation;
  const query = `
    query NearbyFacilityRoute {
      planConnection(
        origin: { location: { coordinate: { latitude: ${origin.lat}, longitude: ${origin.lon} } } }
        destination: { location: { coordinate: { latitude: ${place.lat}, longitude: ${place.lon} } } }
        first: ${CONFIG.routeOptionsCount}
        modes: { direct: WALK }
      ) {
        edges {
          node {
            duration
            legs {
              mode
              legGeometry { points }
            }
          }
        }
      }
    }`;

  try {
    const response = await fetch(CONFIG.digitransitApiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "digitransit-subscription-key": CONFIG.digitransitKey,
      },
      body: JSON.stringify({ query }),
      signal: controller.signal,
    });
    if (!response.ok) {
      throw new Error(`Digitransit returned ${response.status} ${response.statusText}`.trim());
    }

    const result = await response.json();
    if (requestId !== state.routeRequestId) return;
    if (result.errors?.length) {
      throw new Error(result.errors.map((error) => error.message).join("; "));
    }
    const edges = result.data?.planConnection?.edges;
    if (!Array.isArray(edges)) throw new Error("Digitransit returned an unexpected itinerary response.");

    state.itineraries = edges
      .map(({ node }) => ({
        duration: node.duration,
        legs: node.legs.map((leg) => ({
          mode: leg.mode,
          points: leg.legGeometry?.points ? decodePolyline(leg.legGeometry.points) : [],
        })),
      }))
      .filter((itinerary) => Number.isFinite(itinerary.duration) && itinerary.legs.length);
    if (!state.itineraries.length) {
      elements.routeStatus.textContent = "No walking route was found for this destination.";
      return;
    }

    elements.routeStatus.textContent =
      `${state.itineraries.length} walking route${state.itineraries.length === 1 ? "" : "s"} found.`;
    renderRoutePanel();
    drawItinerary(0);
  } catch (error) {
    if (requestId !== state.routeRequestId || error.name === "AbortError") return;
    console.error("Unable to find route with Digitransit:", error);
    elements.routeStatus.textContent = "Couldn’t load a route.";
    setNotice(`Couldn’t load a route. ${error.message}`, true);
  } finally {
    if (requestId === state.routeRequestId) state.routeController = null;
  }
}

function updateCatalogueStatus() {
  if (!state.places.length) {
    elements.catalogueStatus.textContent = "";
    return;
  }
  const loadedPages = state.nextPage - 1;
  const pageLabel = state.totalPages === 1 ? "page" : "pages";
  const scope = state.cityCode === null
    ? ""
    : ` in ${state.cityName || `municipality ${state.cityCode}`}`;
  elements.catalogueStatus.textContent =
    `Nearest matches${scope} from ${state.places.length.toLocaleString()} mapped places loaded across ${loadedPages} of ${state.totalPages.toLocaleString()} catalogue pages.`;
  elements.loadMore.hidden = state.nextPage > state.totalPages;
  if (state.nextPage > state.totalPages) {
    elements.catalogueStatus.textContent =
      `All ${state.places.length.toLocaleString()} mapped places${scope} on ${loadedPages} ${pageLabel} loaded.`;
  }
}

async function loadPage() {
  if (state.loading || state.cityCode === null || state.nextPage > state.totalPages) return;
  const requestId = state.locationRequestId;
  setLoading(true);
  setNotice("");
  const controller = new AbortController();
  state.catalogueController = controller;

  try {
    while (state.nextPage <= state.totalPages) {
      const firstPage = state.nextPage;
      const lastPage = Math.min(firstPage + CONFIG.pageBatchSize - 1, state.totalPages);
      elements.catalogueStatus.textContent =
        `Loading LIPAS catalogue pages ${firstPage.toLocaleString()}–${lastPage.toLocaleString()} of ${state.totalPages.toLocaleString()}…`;

      const pages = Array.from(
        { length: lastPage - firstPage + 1 },
        (_, index) => firstPage + index,
      );
      const results = await Promise.all(pages.map(async (page) => {
        const params = new URLSearchParams({
          page: String(page),
          "page-size": String(CONFIG.pageSize),
          "city-codes": String(state.cityCode),
        });
        CONFIG.admins.forEach((admin) => params.append("admins", admin));
        const response = await fetch(`${CONFIG.lipasApiUrl}?${params}`, {
          headers: { Accept: "application/json" },
          signal: controller.signal,
        });
        if (!response.ok) {
          throw new Error(`LIPAS returned ${response.status} ${response.statusText}`.trim());
        }
        const data = await response.json();
        if (!Array.isArray(data.items) || !data.pagination) {
          throw new Error("LIPAS returned an unexpected response.");
        }
        return { page, data };
      }));
      if (requestId !== state.locationRequestId) return;

      const seen = new Set(state.places.map((place) => place.id));
      for (const { data } of results) {
        for (const record of data.items) {
          const place = toPlace(record);
          if (place && !seen.has(place.id)) {
            state.places.push(place);
            seen.add(place.id);
          }
        }
      }
      state.totalPages = Math.max(
        state.totalPages,
        ...results.map(({ data }) => Number(data.pagination["total-pages"]) || 1),
      );
      state.nextPage = lastPage + 1;
      renderPlaces();
    }
    if (requestId === state.locationRequestId) fitVisiblePlaces();
  } catch (error) {
    if (requestId !== state.locationRequestId || error.name === "AbortError") return;
    console.error("Unable to load sports places from LIPAS:", error);
    setNotice(
      `We couldn't load sports places from LIPAS. ${error.message} Please check your connection and try again.`,
      true,
    );
    elements.catalogueStatus.textContent = "The catalogue could not be loaded.";
  } finally {
    if (requestId === state.locationRequestId) {
      state.catalogueController = null;
      setLoading(false);
      elements.loadMore.hidden = state.nextPage > state.totalPages;
    }
  }
}

function fitVisiblePlaces() {
  if (!state.userLocation) return;
  const places = getVisiblePlaces();
  if (!places.length) {
    state.map.setView(
      [state.userLocation.lat, state.userLocation.lon],
      radiusZoom(Number(elements.radiusSelect.value)),
    );
    return;
  }

  const bounds = L.latLngBounds([
    [state.userLocation.lat, state.userLocation.lon],
    ...places.map((place) => [place.lat, place.lon]),
  ]);
  state.map.fitBounds(bounds.pad(0.1), { maxZoom: CONFIG.mapFitMaxZoom });
}

function setLocation(lat, lon, source) {
  clearRoute();
  state.locationRequestId += 1;
  const requestId = state.locationRequestId;
  state.geocodeController?.abort();
  state.catalogueController?.abort();
  state.userLocation = { lat, lon };
  state.cityCode = null;
  state.cityName = null;
  state.places = [];
  state.nextPage = 1;
  state.totalPages = 0;
  for (const marker of state.markers.values()) marker.remove();
  state.markers.clear();
  if (!state.userMarker) {
    const icon = L.divIcon({
      className: "",
      html: '<div class="user-marker"></div>',
      iconSize: [16, 16],
      iconAnchor: [8, 8],
    });
    state.userMarker = L.marker([lat, lon], { icon, zIndexOffset: 1000 }).addTo(state.map);
  } else {
    state.userMarker.setLatLng([lat, lon]);
  }
  state.userMarker.setPopupContent(source === "manual" ? "Selected search location" : "You are here");
  state.map.setView([lat, lon], CONFIG.locationZoom);
  elements.mapTitle.textContent = "Around your location";
  setNotice("");
  renderPlaces();
  elements.locationStatus.textContent = "Finding your municipality…";
  setLoading(true);
  resolveMunicipality(lat, lon, requestId);
}

async function resolveMunicipality(lat, lon, requestId) {
  const controller = new AbortController();
  state.geocodeController = controller;
  try {
    const delay = Math.max(0, CONFIG.geocodingMinIntervalMs - (Date.now() - state.lastGeocodeAt));
    if (delay) await new Promise((resolve) => setTimeout(resolve, delay));
    if (controller.signal.aborted || requestId !== state.locationRequestId) return;

    const params = new URLSearchParams({
      format: "jsonv2",
      lat: String(lat),
      lon: String(lon),
      zoom: String(CONFIG.geocodingZoom),
      addressdetails: "1",
      namedetails: "1",
    });
    state.lastGeocodeAt = Date.now();
    const response = await fetch(`${CONFIG.geocodingApiUrl}?${params}`, {
      headers: { Accept: "application/json" },
      signal: controller.signal,
    });
    if (!response.ok) {
      throw new Error(`OpenStreetMap geocoding returned ${response.status} ${response.statusText}`.trim());
    }
    const result = await response.json();
    if (requestId !== state.locationRequestId) return;

    const codeText = result.namedetails?.ref || result.extratags?.["ref:kunta"];
    const parsedCode = /^\d{1,3}$/.test(String(codeText ?? "")) ? Number(codeText) : null;
    const isFinland = result.address?.country_code === "fi";
    if (isFinland && parsedCode !== null) {
      state.cityCode = parsedCode;
      state.cityName =
        result.address.city ||
        result.address.town ||
        result.address.municipality ||
        result.address.village ||
        result.name ||
        "";
      elements.locationStatus.textContent =
        `${state.cityName ? `${state.cityName} · ` : ""}Searching LIPAS places in municipality ${parsedCode}.`;
    } else {
      const message = isFinland
        ? "Couldn’t identify this municipality’s LIPAS code. No places were requested from LIPAS."
        : "This location is outside Finland. No places were requested from LIPAS.";
      elements.locationStatus.textContent = message;
      setNotice(message);
    }
  } catch (error) {
    if (requestId !== state.locationRequestId || error.name === "AbortError") return;
    console.error("Unable to identify municipality from location:", error);
    const message = "Couldn’t identify the municipality. No places were requested from LIPAS.";
    elements.locationStatus.textContent = message;
    setNotice(message, true);
  } finally {
    if (requestId === state.locationRequestId) {
      state.geocodeController = null;
      if (state.cityCode !== null) {
        state.totalPages = 1;
      } else {
        renderPlaces();
        elements.catalogueStatus.textContent =
          "LIPAS was not queried because the municipality could not be identified.";
        elements.loadMore.hidden = true;
      }
      setLoading(false);
      if (state.cityCode !== null) loadPage();
    }
  }
}

function locateUser() {
  if (!navigator.geolocation) {
    const message = "Location is not supported by this browser. Click the map to choose a location instead.";
    elements.locationStatus.textContent = message;
    setNotice(message, true);
    return;
  }

  setNotice("");
  elements.locationStatus.textContent = "Finding your location…";
  elements.locateButton.disabled = true;
  const requestId = state.locationRequestId;
  navigator.geolocation.getCurrentPosition(
    (position) => {
      if (requestId !== state.locationRequestId) return;
      elements.locateButton.disabled = false;
      setLocation(position.coords.latitude, position.coords.longitude, "device");
    },
    (error) => {
      if (requestId !== state.locationRequestId) return;
      elements.locateButton.disabled = false;
      const messages = {
        [error.PERMISSION_DENIED]: "Location access was denied. Allow location access in your browser and try again.",
        [error.POSITION_UNAVAILABLE]: "Your location is unavailable right now. Please try again.",
        [error.TIMEOUT]: "Finding your location took too long. Please try again.",
      };
      const message = `${messages[error.code] || "We couldn’t find your location."} Click the map to choose a location instead.`;
      elements.locationStatus.textContent = message;
      setNotice(message, true);
    },
    {
      enableHighAccuracy: false,
      timeout: CONFIG.geolocationTimeoutMs,
      maximumAge: CONFIG.geolocationMaxAgeMs,
    },
  );
}

elements.locateButton.addEventListener("click", locateUser);
elements.loadMore.addEventListener("click", loadPage);
elements.radiusSelect.replaceChildren(
  ...CONFIG.radiusOptions.map((radius) => {
    const option = document.createElement("option");
    option.value = String(radius);
    option.textContent = `${radius} km`;
    return option;
  }),
);
elements.radiusSelect.value = String(CONFIG.defaultRadius);
elements.radiusSelect.addEventListener("change", () => {
  renderPlaces();
  fitVisiblePlaces();
});

function radiusZoom(radius) {
  if (radius <= 2) return 14;
  if (radius <= 5) return 13;
  if (radius <= 10) return 12;
  return 12;
}

initMap();
