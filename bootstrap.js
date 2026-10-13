const CONFIG_KEYS = [
  "LIPAS_API_URL",
  "DIGITRANSIT_API_URL",
  "GEOCODING_API_URL",
  "MAP_TILE_URL",
  "MAP_ATTRIBUTION",
  "LIPAS_PAGE_SIZE",
  "LIPAS_PAGE_BATCH_SIZE",
  "LIPAS_ADMINS",
  "DEFAULT_MAP_LAT",
  "DEFAULT_MAP_LON",
  "DEFAULT_MAP_ZOOM",
  "MAP_MAX_ZOOM",
  "MAP_FIT_MAX_ZOOM",
  "LOCATION_ZOOM",
  "PLACE_FOCUS_ZOOM",
  "SEARCH_RADIUS_OPTIONS_KM",
  "DEFAULT_SEARCH_RADIUS_KM",
  "GEOCODING_ZOOM",
  "GEOCODING_MIN_INTERVAL_MS",
  "GEOLOCATION_TIMEOUT_MS",
  "GEOLOCATION_MAX_AGE_MS",
  "ROUTE_OPTIONS_COUNT",
];

function readNumber(values, key, { integer = false, minimum = -Infinity, maximum = Infinity } = {}) {
  const value = Number(values[key]);
  if (
    !Number.isFinite(value) ||
    (integer && !Number.isInteger(value)) ||
    value < minimum ||
    value > maximum
  ) {
    throw new Error(`Invalid ${key} value in config.js.`);
  }
  return value;
}

function requireHttpsUrl(value, key, allowTemplate = false) {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`${key} must be a URL in config.js.`);
  }
  const candidate = allowTemplate ? value.replace(/\{[^}]+\}/g, "0") : value;
  let url;
  try {
    url = new URL(candidate);
  } catch {
    throw new Error(`Invalid ${key} URL in config.js.`);
  }
  if (url.protocol !== "https:") throw new Error(`${key} must use HTTPS.`);
  return value;
}

function buildConfig(values) {
  const missing = CONFIG_KEYS.filter((key) =>
    !Object.hasOwn(values, key) ||
    values[key] === undefined ||
    values[key] === null ||
    values[key] === "",
  );
  if (missing.length) throw new Error(`Missing config.js settings: ${missing.join(", ")}.`);
  if (values.DIGITRANSIT_KEY !== undefined && typeof values.DIGITRANSIT_KEY !== "string") {
    throw new Error("DIGITRANSIT_KEY must be a string in config.js.");
  }
  if (typeof values.MAP_ATTRIBUTION !== "string" || !values.MAP_ATTRIBUTION.trim()) {
    throw new Error("MAP_ATTRIBUTION must be a non-empty string in config.js.");
  }

  if (!Array.isArray(values.LIPAS_ADMINS) || values.LIPAS_ADMINS.some((value) => typeof value !== "string" || !value.trim())) {
    throw new Error("LIPAS_ADMINS must be an array of administrator values in config.js.");
  }
  const admins = values.LIPAS_ADMINS.map((value) => value.trim());
  if (!admins.length) throw new Error("LIPAS_ADMINS must contain at least one administrator.");

  const radiusOptions = values.SEARCH_RADIUS_OPTIONS_KM;
  if (
    !Array.isArray(radiusOptions) ||
    !radiusOptions.length ||
    radiusOptions.some((value) => !Number.isFinite(value) || value <= 0) ||
    new Set(radiusOptions).size !== radiusOptions.length
  ) {
    throw new Error("SEARCH_RADIUS_OPTIONS_KM must contain unique positive numbers in config.js.");
  }

  const defaultRadius = readNumber(values, "DEFAULT_SEARCH_RADIUS_KM", { minimum: Number.MIN_VALUE });
  if (!radiusOptions.includes(defaultRadius)) {
    throw new Error("DEFAULT_SEARCH_RADIUS_KM must match an option in SEARCH_RADIUS_OPTIONS_KM.");
  }

  return Object.freeze({
    lipasApiUrl: requireHttpsUrl(values.LIPAS_API_URL, "LIPAS_API_URL"),
    digitransitApiUrl: requireHttpsUrl(values.DIGITRANSIT_API_URL, "DIGITRANSIT_API_URL"),
    digitransitKey: values.DIGITRANSIT_KEY?.trim() || "",
    geocodingApiUrl: requireHttpsUrl(values.GEOCODING_API_URL, "GEOCODING_API_URL"),
    mapTileUrl: requireHttpsUrl(values.MAP_TILE_URL, "MAP_TILE_URL", true),
    mapAttribution: values.MAP_ATTRIBUTION,
    pageSize: readNumber(values, "LIPAS_PAGE_SIZE", { integer: true, minimum: 1, maximum: 100 }),
    pageBatchSize: readNumber(values, "LIPAS_PAGE_BATCH_SIZE", { integer: true, minimum: 1, maximum: 10 }),
    admins: Object.freeze(admins),
    defaultMapCenter: Object.freeze([
      readNumber(values, "DEFAULT_MAP_LAT", { minimum: -90, maximum: 90 }),
      readNumber(values, "DEFAULT_MAP_LON", { minimum: -180, maximum: 180 }),
    ]),
    defaultMapZoom: readNumber(values, "DEFAULT_MAP_ZOOM", { integer: true, minimum: 0, maximum: 19 }),
    mapMaxZoom: readNumber(values, "MAP_MAX_ZOOM", { integer: true, minimum: 0, maximum: 22 }),
    mapFitMaxZoom: readNumber(values, "MAP_FIT_MAX_ZOOM", { integer: true, minimum: 0, maximum: 22 }),
    locationZoom: readNumber(values, "LOCATION_ZOOM", { integer: true, minimum: 0, maximum: 22 }),
    placeFocusZoom: readNumber(values, "PLACE_FOCUS_ZOOM", { integer: true, minimum: 0, maximum: 22 }),
    radiusOptions: Object.freeze(radiusOptions),
    defaultRadius,
    geocodingZoom: readNumber(values, "GEOCODING_ZOOM", { integer: true, minimum: 0, maximum: 18 }),
    geocodingMinIntervalMs: readNumber(values, "GEOCODING_MIN_INTERVAL_MS", { integer: true, minimum: 0 }),
    geolocationTimeoutMs: readNumber(values, "GEOLOCATION_TIMEOUT_MS", { integer: true, minimum: 1 }),
    geolocationMaxAgeMs: readNumber(values, "GEOLOCATION_MAX_AGE_MS", { integer: true, minimum: 0 }),
    routeOptionsCount: readNumber(values, "ROUTE_OPTIONS_COUNT", { integer: true, minimum: 1, maximum: 5 }),
  });
}

function showBootstrapError(error) {
  console.error("Unable to initialize Lähiliike SportSpot finder:", error);
  const status = document.querySelector("#location-status");
  const notice = document.querySelector("#notice");
  const message = `App configuration could not be loaded. ${error.message} Check that config.js is available next to index.html.`;
  if (status) status.textContent = message;
  if (notice) {
    notice.textContent = message;
    notice.hidden = false;
    notice.style.background = "#fff0ed";
    notice.style.borderColor = "#f1d4cd";
    notice.style.color = "#8b3929";
  }
}

function startApp() {
  if (
    !window.APP_CONFIG_VALUES ||
    typeof window.APP_CONFIG_VALUES !== "object" ||
    Array.isArray(window.APP_CONFIG_VALUES)
  ) {
    throw new Error("config.js did not define a valid APP_CONFIG_VALUES object.");
  }
  const config = buildConfig(window.APP_CONFIG_VALUES);
  window.APP_CONFIG = config;

  const script = document.createElement("script");
  script.src = "./app.js";
  script.onerror = () => showBootstrapError(new Error("The application script could not be loaded."));
  document.head.append(script);
}

try {
  startApp();
} catch (error) {
  showBootstrapError(error);
}
