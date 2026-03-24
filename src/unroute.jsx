import { useState, useEffect, useRef, useCallback, useMemo } from "react";

// ─── NO HARDCODED DISCOVERIES — real data only ───

// ─── VIBE ROUTE DEFINITIONS ───
const VIBE_ROUTES = {
  any: { label: "Surprise Me", icon: "🎲", color: "#4ECDC4", desc: "A bit of everything" },
  industrial: { label: "Industrial Decay", icon: "🏚️", color: "#8B8682", desc: "Warehouses, brutalism, rust" },
  green: { label: "Green Lungs", icon: "🌿", color: "#6BCB77", desc: "Gardens, overgrown alleys, trees" },
  neon: { label: "Neon Path", icon: "💡", color: "#FF6EC7", desc: "Indie shops, lit signs, nightlife" },
};

const ROUTE_NAMES = {
  any: ["The Long Way Round", "The Scenic Detour", "The Wanderer's Path", "The Serendipity Line", "The Discovery Arc"],
  industrial: ["The Rust Belt", "The Concrete Drift", "The Machine Walk", "The Foundry Line", "The Grey Mile"],
  green: ["The Breathing Route", "The Overgrown Way", "The Chlorophyll Trail", "The Quiet Green", "The Root Path"],
  neon: ["The Glow Circuit", "The Neon Crawl", "The Shopfront Shuffle", "The Pixel Walk", "The Late Night Line"],
};

const VIBE_COLORS = { industrial: "#8B8682", green: "#6BCB77", neon: "#FF6EC7", any: "#4ECDC4", weird: "#FF6B35", hidden: "#4ECDC4", quiet: "#7B68EE", art: "#FF1493", secret: "#FFD700" };

function seededShuffle(arr, seed) {
  const a = [...arr];
  let s = seed;
  for (let i = a.length - 1; i > 0; i--) {
    s = (s * 16807 + 0) % 2147483647;
    const j = s % (i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ─── OVERPASS API: REAL PLACE DISCOVERY ───

// Map OSM amenity/leisure/shop tags to our vibe categories
const OSM_VIBE_MAP = {
  industrial: {
    tags: ['industrial', 'warehouse', 'works', 'factory', 'railway', 'abandoned', 'ruins', 'bunker', 'water_tower', 'silo', 'chimney', 'gasometer', 'crane', 'bridge'],
    icon: "🏚️",
    challenges: [
      "Photo the most textured wall you can find.",
      "Capture any rust, peeling paint, or weathered signage.",
      "Photograph a detail nobody would normally notice.",
      "Find something geometric — pipes, girders, brickwork — and frame it.",
    ],
  },
  green: {
    tags: ['park', 'garden', 'nature_reserve', 'allotments', 'community_garden', 'grass', 'meadow', 'forest', 'tree', 'pond', 'lake', 'cemetery', 'flower_bed', 'dog_park'],
    icon: "🌿",
    challenges: [
      "Photo the oldest-looking tree you can see.",
      "Find something growing where it shouldn't and capture it.",
      "Sit still for 60 seconds. Photo whatever catches your eye.",
      "Photograph the most peaceful view you can find here.",
    ],
  },
  neon: {
    tags: ['cafe', 'bar', 'pub', 'nightclub', 'restaurant', 'shop', 'bookshop', 'music', 'vinyl', 'tattoo', 'art_gallery', 'gallery', 'theatre', 'cinema', 'bakery', 'deli', 'charity_shop', 'antiques', 'vintage', 'second_hand', 'florist', 'hairdresser', 'barber'],
    icon: "💡",
    challenges: [
      "Photo the shopfront or signage from across the street.",
      "Find the quirkiest detail in the window display.",
      "Capture what makes this place different from a chain.",
      "Photo the menu, the specials board, or whatever's in the window.",
    ],
  },
};

// Build Overpass QL query for a bounding box
function buildOverpassQuery(south, west, north, east, vibeKey) {
  const bbox = `${south},${west},${north},${east}`;
  let filters = [];

  if (vibeKey === "industrial" || vibeKey === "any") {
    filters.push(
      `node["man_made"~"works|warehouse|chimney|water_tower|silo|gasometer|crane"](${bbox});`,
      `node["building"~"industrial|warehouse"](${bbox});`,
      `node["abandoned"](${bbox});`,
      `way["building"~"industrial|warehouse"](${bbox});`,
      `node["railway"="abandoned"](${bbox});`,
    );
  }
  if (vibeKey === "green" || vibeKey === "any") {
    filters.push(
      `node["leisure"~"park|garden|nature_reserve|dog_park"](${bbox});`,
      `node["landuse"~"allotments|meadow|forest|cemetery"](${bbox});`,
      `way["leisure"~"park|garden|nature_reserve"](${bbox});`,
      `node["natural"~"tree|water|pond"](${bbox});`,
    );
  }
  if (vibeKey === "neon" || vibeKey === "any") {
    filters.push(
      `node["amenity"~"cafe|bar|pub|nightclub|restaurant|theatre|cinema|arts_centre"](${bbox});`,
      `node["shop"~"books|music|tattoo|vintage|charity|antiques|second_hand|florist|bakery|deli"](${bbox});`,
      `node["tourism"="gallery"](${bbox});`,
      `node["craft"~"brewery|distillery"](${bbox});`,
    );
  }

  return `[out:json][timeout:10];(${filters.join("")});out center 80;`;
}

// Categorise an OSM element into a vibe
function classifyElement(el) {
  const tags = el.tags || {};
  const allVals = Object.values(tags).join(" ").toLowerCase();
  const allKeys = Object.keys(tags).join(" ").toLowerCase();

  for (const [vibe, config] of Object.entries(OSM_VIBE_MAP)) {
    if (config.tags.some(t => allVals.includes(t) || allKeys.includes(t))) return vibe;
  }
  // Fallback heuristics
  if (tags.amenity === "cafe" || tags.amenity === "restaurant" || tags.amenity === "bar" || tags.shop) return "neon";
  if (tags.leisure || tags.natural || tags.landuse === "grass") return "green";
  if (tags.building === "industrial" || tags.man_made) return "industrial";
  return "neon"; // default
}

// Pick a nice icon based on tags
function pickIcon(tags) {
  const t = tags || {};
  if (t.amenity === "cafe" || t.cuisine === "coffee") return "☕";
  if (t.amenity === "bar" || t.amenity === "pub") return "🍺";
  if (t.amenity === "restaurant") return "🍽️";
  if (t.amenity === "theatre" || t.amenity === "cinema") return "🎭";
  if (t.amenity === "arts_centre" || t.tourism === "gallery") return "🎨";
  if (t.shop === "books") return "📚";
  if (t.shop === "music" || t.shop === "vinyl") return "📀";
  if (t.shop === "florist") return "💐";
  if (t.shop === "bakery") return "🥐";
  if (t.shop === "tattoo") return "✒️";
  if (t.shop === "vintage" || t.shop === "second_hand" || t.shop === "charity") return "🛍️";
  if (t.shop) return "🪴";
  if (t.leisure === "park" || t.leisure === "garden") return "🌳";
  if (t.leisure === "nature_reserve") return "🌲";
  if (t.leisure === "dog_park") return "🐕";
  if (t.landuse === "allotments") return "🌻";
  if (t.landuse === "cemetery") return "🪦";
  if (t.natural === "water" || t.natural === "pond") return "🦆";
  if (t.natural === "tree") return "🌲";
  if (t.man_made || t.building === "industrial") return "🏚️";
  if (t.railway) return "🚂";
  if (t["abandoned"]) return "🏗️";
  return "📍";
}

// Build a discovery object from an OSM element
function osmToDiscovery(el) {
  const tags = el.tags || {};
  const vibe = classifyElement(el);
  const config = OSM_VIBE_MAP[vibe];
  const lat = el.lat || el.center?.lat;
  const lon = el.lon || el.center?.lon;

  // Build a name
  const name = tags.name || tags["name:en"] || tags.brand || `Unnamed ${tags.amenity || tags.shop || tags.leisure || tags.man_made || "spot"}`;

  // Build a description from available tags
  const parts = [];
  if (tags.amenity) parts.push(tags.amenity.replace(/_/g, " "));
  if (tags.cuisine) parts.push(tags.cuisine.replace(/;/g, ", "));
  if (tags.shop) parts.push(tags.shop.replace(/_/g, " ") + " shop");
  if (tags.leisure) parts.push(tags.leisure.replace(/_/g, " "));
  if (tags.man_made) parts.push(tags.man_made.replace(/_/g, " "));
  if (tags.building && tags.building !== "yes") parts.push(tags.building.replace(/_/g, " ") + " building");
  if (tags["addr:street"]) parts.push(`on ${tags["addr:street"]}`);
  if (tags.opening_hours) parts.push(`hours: ${tags.opening_hours.slice(0, 30)}`);

  const desc = parts.length > 0 ? parts.join(" · ") : "A real place worth discovering.";

  // Estimate time detour based on nothing scientific
  const timeMin = Math.floor(Math.random() * 6) + 2;

  return {
    type: tags.amenity || tags.shop || tags.leisure || tags.man_made || "place",
    icon: pickIcon(tags),
    name: name.length > 35 ? name.slice(0, 33) + "…" : name,
    desc: desc.charAt(0).toUpperCase() + desc.slice(1),
    vibe,
    time: `+${timeMin} min`,
    challenge: config.challenges[Math.floor(Math.random() * config.challenges.length)],
    lat,
    lon,
    osmTags: tags,
  };
}

// Known chains to filter out (the Anti-Algorithm rejects the optimised)
const CHAIN_NAMES = [
  "starbucks", "costa", "pret", "mcdonald", "burger king", "kfc", "subway",
  "greggs", "nando", "pizza hut", "domino", "papa john", "tesco", "sainsbury",
  "asda", "lidl", "aldi", "waitrose", "co-op", "spar", "one stop",
  "boots", "superdrug", "wh smith", "poundland", "primark", "h&m",
  "zara", "uniqlo", "nike", "adidas", "five guys", "wagamama", "itsu",
  "leon", "eat", "caffe nero", "tim horton", "dunkin",
];

function isChain(name) {
  const lower = (name || "").toLowerCase();
  return CHAIN_NAMES.some(c => lower.includes(c));
}

// Fetch real discoveries from Overpass API
async function fetchRealDiscoveries(startCoords, endCoords, vibeKey, count) {
  // Build bounding box with padding
  const pad = 0.005; // ~500m padding
  const south = Math.min(startCoords.lat, endCoords.lat) - pad;
  const north = Math.max(startCoords.lat, endCoords.lat) + pad;
  const west = Math.min(startCoords.lng, endCoords.lng) - pad;
  const east = Math.max(startCoords.lng, endCoords.lng) + pad;

  const query = buildOverpassQuery(south, west, north, east, vibeKey);

  const res = await fetch("https://overpass-api.de/api/interpreter", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `data=${encodeURIComponent(query)}`,
  });

  if (!res.ok) throw new Error(`Overpass returned ${res.status}`);
  const data = await res.json();

  if (!data.elements || data.elements.length === 0) return null;

  // Convert to discoveries, filter chains, prefer named places
  let discoveries = data.elements
    .filter(el => (el.lat || el.center?.lat))
    .map(osmToDiscovery)
    .filter(d => !isChain(d.name)); // ← Chain filter

  // Prefer named places, then unnamed
  const named = discoveries.filter(d => !d.name.startsWith("Unnamed"));
  const unnamed = discoveries.filter(d => d.name.startsWith("Unnamed"));

  // Filter by vibe if not "any"
  let pool = vibeKey === "any"
    ? [...named, ...unnamed]
    : [...named.filter(d => d.vibe === vibeKey), ...unnamed.filter(d => d.vibe === vibeKey), ...named, ...unnamed];

  // Deduplicate by name
  const seen = new Set();
  pool = pool.filter(d => {
    if (seen.has(d.name)) return false;
    seen.add(d.name);
    return true;
  });

  // Shuffle and take what we need
  const seed = Date.now() % 10000;
  return seededShuffle(pool, seed).slice(0, count);
}

// ─── AI VIBE ENGINE (Claude via Anthropic API) ───
async function enhanceWithAI(discoveries) {
  const toEnhance = discoveries.filter(d => d.name && !d.name.startsWith("Unnamed"));
  if (toEnhance.length === 0) return discoveries;

  const prompt = toEnhance.map((d, i) =>
    `${i + 1}. "${d.name}" — Type: ${d.type}. Tags: ${d.desc}. Vibe: ${d.vibe}.`
  ).join("\n");

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1000,
        system: `You write for Unroute, an app that helps people get beautifully lost in cities. You sound like a friend who knows every hidden corner — witty, specific, never generic.

Return ONLY a JSON array. No markdown, no backticks, no preamble. Each element: {"desc": "1 quirky sentence describing the place", "challenge": "1 sentence photo challenge requiring physical presence"}

Rules:
- Be specific to the place name and type. Reference what makes it unique.
- Never say "capture the essence", "hidden gem", "explore", or "discover".
- Challenges must require being physically present (photo a specific feature, not just "take a photo").
- Keep it under 15 words each.`,
        messages: [{ role: "user", content: `Write for these ${toEnhance.length} real places:\n${prompt}` }],
      }),
    });

    const data = await res.json();
    const text = data.content?.map(c => c.text || "").join("") || "";
    const clean = text.replace(/```json|```/g, "").trim();
    const enhanced = JSON.parse(clean);

    return discoveries.map(d => {
      const idx = toEnhance.findIndex(t => t.name === d.name);
      if (idx >= 0 && enhanced[idx]) {
        return { ...d, desc: enhanced[idx].desc || d.desc, challenge: enhanced[idx].challenge || d.challenge, aiEnhanced: true };
      }
      return d;
    });
  } catch (err) {
    console.warn("AI enhancement failed, using raw OSM data:", err.message);
    return discoveries;
  }
}

// Async route generation: Overpass → Chain filter → AI enhance → Pioneer Mode
async function generateRouteAsync(level, vibeKey, sCoords, dCoords) {
  const count = Math.max(2, Math.min(level, 8));
  const names = ROUTE_NAMES[vibeKey] || ROUTE_NAMES.any;
  const name = names[Math.floor(Math.random() * names.length)];

  let picks = null;
  let isReal = false;
  let isPioneer = false;

  if (sCoords && dCoords) {
    try {
      picks = await fetchRealDiscoveries(sCoords, dCoords, vibeKey, count);
      if (picks && picks.length >= 2) {
        isReal = true;
        // AI Vibe Engine: enhance descriptions and challenges
        picks = await enhanceWithAI(picks);
      } else {
        // Pioneer Mode: area has no mapped gems
        isPioneer = true;
        picks = [];
      }
    } catch (err) {
      console.warn("Overpass failed:", err.message);
      isPioneer = true;
      picks = [];
    }
  } else {
    // No coordinates available — can't search
    isPioneer = true;
    picks = [];
  }

  const extraMin = picks.length > 0 ? picks.reduce((s, d) => s + parseInt(d.time), 0) : 0;

  let baseDist, routeDist;
  if (sCoords && dCoords) {
    const R = 6371;
    const dLat = (dCoords.lat - sCoords.lat) * Math.PI / 180;
    const dLon = (dCoords.lng - sCoords.lng) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(sCoords.lat * Math.PI / 180) * Math.cos(dCoords.lat * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
    const straight = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    baseDist = Math.max(0.3, straight * 1.3).toFixed(1);
    routeDist = picks.length > 0 ? (parseFloat(baseDist) * (1 + level * 0.12)).toFixed(1) : baseDist;
  } else {
    baseDist = "?";
    routeDist = "?";
  }

  return { picks, extraMin, baseDist, routeDist, name, vibeKey, isReal, isPioneer };
}

// ─── GEOLOCATION HOOK ───
function useGeolocation() {
  const [location, setLocation] = useState({ status: "idle", coords: null, address: null, error: null });
  useEffect(() => {
    if (!navigator.geolocation) {
      setLocation(prev => ({ ...prev, status: "unsupported", error: "Geolocation not supported" }));
      return;
    }
    setLocation(prev => ({ ...prev, status: "requesting" }));
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setLocation(prev => ({ ...prev, status: "located", coords }));
        try {
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?lat=${coords.lat}&lon=${coords.lng}&format=json&zoom=16&addressdetails=1`,
            { headers: { "Accept-Language": "en" } }
          );
          const data = await res.json();
          const addr = data.address || {};
          const short = addr.road
            ? `${addr.road}${addr.suburb ? ", " + addr.suburb : ""}${addr.city || addr.town ? ", " + (addr.city || addr.town) : ""}`
            : data.display_name?.split(",").slice(0, 3).join(",") || "Your location";
          setLocation(prev => ({ ...prev, address: short }));
        } catch {
          setLocation(prev => ({ ...prev, address: `${coords.lat.toFixed(4)}, ${coords.lng.toFixed(4)}` }));
        }
      },
      (err) => setLocation(prev => ({ ...prev, status: "denied", error: err.message })),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    );
  }, []);
  return location;
}

// ─── ANTI-CLOUD STORAGE (device-only, in-memory for artifact sandbox) ───
const antiCloud = {
  _store: {},
  save(key, val) { this._store[key] = JSON.stringify(val); },
  load(key) { try { return JSON.parse(this._store[key]); } catch { return null; } },
  clear() { this._store = {}; },
  get routeCount() { return this.load("routes_completed") || 0; },
  get totalDiscoveries() { return this.load("total_discoveries") || 0; },
  get proofCount() { return this.load("proofs_submitted") || 0; },
  get completedRoutes() { return this.load("completed_routes") || []; },
  logRoute(route) {
    this.save("routes_completed", this.routeCount + 1);
    this.save("total_discoveries", this.totalDiscoveries + route.picks.length);
    const completed = this.completedRoutes;
    completed.push({ name: route.name, vibe: route.vibeKey, discoveries: route.picks.length, date: new Date().toLocaleDateString() });
    this.save("completed_routes", completed.slice(-20)); // keep last 20
  },
  logProof() { this.save("proofs_submitted", this.proofCount + 1); },
};

// ─── PLACE AUTOCOMPLETE (Nominatim forward geocoding + postcode support) ───
function PlaceAutocomplete({ value, onChange, onSelect, placeholder, accentColor, fontFamily, resolvedPlace }) {
  const [suggestions, setSuggestions] = useState([]);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef(null);
  const wrapperRef = useRef(null);
  const color = accentColor || "#4ECDC4";
  const font = fontFamily || "'DM Mono', monospace";

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) setIsOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Detect if input looks like a UK postcode
  const isPostcode = (q) => /^[A-Za-z]{1,2}\d[A-Za-z\d]?\s*\d?[A-Za-z]{0,2}$/i.test(q.trim());

  const search = useCallback((q) => {
    if (!q || q.length < 2) { setSuggestions([]); setIsOpen(false); return; }

    // Lower the threshold for postcodes (they can be short like "E1" or "SE1")
    if (!isPostcode(q) && q.length < 3) { setSuggestions([]); setIsOpen(false); return; }

    setLoading(true);

    // Add countrycodes=gb for postcodes to get better UK results
    const params = isPostcode(q)
      ? `postalcode=${encodeURIComponent(q.trim())}&countrycodes=gb&format=json&addressdetails=1&limit=5`
      : `q=${encodeURIComponent(q)}&format=json&addressdetails=1&limit=5`;

    fetch(`https://nominatim.openstreetmap.org/search?${params}`, {
      headers: { "Accept-Language": "en" }
    })
      .then(r => r.json())
      .then(data => {
        const results = data.map(d => {
          const addr = d.address || {};
          const parts = [
            addr.road,
            addr.suburb || addr.neighbourhood || addr.hamlet,
            addr.city || addr.town || addr.village,
            addr.county,
            addr.postcode,
          ].filter(Boolean);
          return {
            display: parts.length > 0 ? parts.join(", ") : d.display_name.split(",").slice(0, 3).join(",").trim(),
            full: d.display_name,
            lat: parseFloat(d.lat),
            lng: parseFloat(d.lon),
            type: d.type,
            postcode: addr.postcode || null,
          };
        });
        setSuggestions(results);
        setIsOpen(results.length > 0);
        setLoading(false);
      })
      .catch(() => { setLoading(false); });
  }, []);

  const handleChange = (e) => {
    const v = e.target.value;
    onChange(v);
    // Clear resolved state when user edits
    if (resolvedPlace) onSelect(null);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => search(v), 350);
  };

  const handleSelect = (s) => {
    onChange(s.display);
    onSelect(s);
    setIsOpen(false);
    setSuggestions([]);
  };

  return (
    <div ref={wrapperRef} style={{ position: "relative", width: "100%" }}>
      <div style={{ position: "relative" }}>
        <input
          type="text" value={value} onChange={handleChange}
          placeholder={placeholder}
          onFocus={() => { if (suggestions.length > 0) setIsOpen(true); }}
          style={{
            width: "100%", padding: "12px 16px", paddingRight: 36, fontSize: 14,
            background: "rgba(255,255,255,0.04)",
            border: `1px solid ${resolvedPlace ? `${color}50` : `${color}30`}`,
            borderRadius: isOpen ? "12px 12px 0 0" : 12, color: "#fff", outline: "none",
            fontFamily: font, transition: "border-color 0.3s, border-radius 0.2s",
          }}
        />
        <span style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", fontSize: 12, color: "rgba(255,255,255,0.3)" }}>
          {loading ? <span style={{ animation: "pulse 1s ease-in-out infinite" }}>⏳</span>
            : resolvedPlace ? <span style={{ color }}>✓</span>
            : null}
        </span>
      </div>

      {/* Confirmation badge — shows when a location is resolved */}
      {resolvedPlace && !isOpen && (
        <div style={{
          marginTop: 6, padding: "6px 10px", borderRadius: 8,
          background: `${color}08`, border: `1px solid ${color}18`,
          display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap",
          animation: "fadeSlideIn 0.3s ease",
        }}>
          <span style={{ fontSize: 11, color }}>✓ Resolved</span>
          <span style={{ fontSize: 10, fontFamily: "'DM Mono', monospace", color: "rgba(255,255,255,0.5)", flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {resolvedPlace.full || resolvedPlace.display}
          </span>
          <span style={{ fontSize: 9, fontFamily: "'DM Mono', monospace", color: "rgba(255,255,255,0.25)", flexShrink: 0 }}>
            {resolvedPlace.lat.toFixed(5)}, {resolvedPlace.lng.toFixed(5)}
          </span>
        </div>
      )}

      {/* Dropdown suggestions */}
      {isOpen && suggestions.length > 0 && (
        <div style={{
          position: "absolute", top: "100%", left: 0, right: 0, zIndex: 50,
          background: "#12121f", border: `1px solid ${color}30`, borderTop: "none",
          borderRadius: "0 0 12px 12px", overflow: "hidden",
          boxShadow: "0 12px 32px rgba(0,0,0,0.5)",
        }}>
          {suggestions.map((s, i) => (
            <button key={i} onClick={() => handleSelect(s)} style={{
              display: "flex", alignItems: "flex-start", gap: 8, width: "100%", padding: "10px 14px",
              background: "transparent", border: "none", borderTop: i > 0 ? "1px solid rgba(255,255,255,0.04)" : "none",
              cursor: "pointer", textAlign: "left", transition: "background 0.15s",
              color: "#fff",
            }}
              onMouseEnter={e => e.currentTarget.style.background = `${color}10`}
              onMouseLeave={e => e.currentTarget.style.background = "transparent"}
            >
              <span style={{ fontSize: 13, color: `${color}88`, flexShrink: 0, marginTop: 1 }}>📍</span>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontSize: 13, fontFamily: "'Space Grotesk', sans-serif", fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {s.display}
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8, marginTop: 2 }}>
                  {s.full !== s.display && (
                    <div style={{ fontSize: 10, fontFamily: font, color: "rgba(255,255,255,0.2)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>
                      {s.full}
                    </div>
                  )}
                  <div style={{ fontSize: 9, fontFamily: "'DM Mono', monospace", color: "rgba(255,255,255,0.15)", flexShrink: 0 }}>
                    {s.lat.toFixed(4)}, {s.lng.toFixed(4)}
                  </div>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── COMPONENTS ───

function LocationBadge({ geo }) {
  const styles = {
    base: {
      display: "inline-flex", alignItems: "center", gap: 6, padding: "5px 10px",
      borderRadius: 20, fontSize: 11, fontFamily: "'DM Mono', monospace",
    }
  };
  if (geo.status === "idle" || geo.status === "requesting") {
    return (
      <div style={{ ...styles.base, background: "rgba(78,205,196,0.06)", border: "1px solid rgba(78,205,196,0.15)", color: "rgba(255,255,255,0.4)" }}>
        <span style={{ display: "inline-block", width: 6, height: 6, borderRadius: "50%", background: "#4ECDC4", animation: "pulse 1.2s ease-in-out infinite" }} />
        Locating you…
      </div>
    );
  }
  if (geo.status === "located") {
    return (
      <div style={{ ...styles.base, background: "rgba(78,205,196,0.06)", border: "1px solid rgba(78,205,196,0.15)", color: "rgba(255,255,255,0.5)", animation: "fadeSlideIn 0.4s ease" }}>
        <span style={{ display: "inline-block", width: 6, height: 6, borderRadius: "50%", background: "#4ECDC4" }} />
        {geo.address || "Located"}
      </div>
    );
  }
  return (
    <div style={{ ...styles.base, background: "rgba(255,107,53,0.06)", border: "1px solid rgba(255,107,53,0.15)", color: "rgba(255,255,255,0.4)" }}>
      <span style={{ display: "inline-block", width: 6, height: 6, borderRadius: "50%", background: "#FF6B35" }} />
      Location unavailable
    </div>
  );
}

function VibeSelector({ selected, onChange }) {
  return (
    <div>
      <label style={{ display: "block", fontSize: 11, fontFamily: "'DM Mono', monospace", color: "rgba(255,255,255,0.4)", letterSpacing: 1.5, marginBottom: 10 }}>
        FLAVOUR OF LOST
      </label>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        {Object.entries(VIBE_ROUTES).map(([key, v]) => {
          const isActive = selected === key;
          return (
            <button key={key} onClick={() => onChange(key)} style={{
              padding: "12px 14px", borderRadius: 12, border: `1px solid ${isActive ? v.color : "rgba(255,255,255,0.06)"}`,
              background: isActive ? `${v.color}12` : "rgba(255,255,255,0.02)",
              cursor: "pointer", textAlign: "left", transition: "all 0.25s ease",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                <span style={{ fontSize: 18 }}>{v.icon}</span>
                <span style={{ fontSize: 13, fontWeight: 600, color: isActive ? v.color : "rgba(255,255,255,0.7)", fontFamily: "'Space Grotesk', sans-serif" }}>
                  {v.label}
                </span>
              </div>
              <p style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", fontFamily: "'DM Mono', monospace", margin: 0, lineHeight: 1.3 }}>
                {v.desc}
              </p>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function DiscoverySlider({ value, onChange }) {
  const labels = ["", "Slight detour", "A little lost", "Curious", "Wandering", "Exploring", "Adventurous", "Deep drift", "Off the grid", "Into the unknown", "Maximum serendipity"];
  return (
    <div style={{ width: "100%" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 8 }}>
        <span style={{ fontSize: 13, color: "rgba(255,255,255,0.5)", fontFamily: "'DM Mono', monospace", letterSpacing: 1 }}>DISCOVERY LEVEL</span>
        <span style={{ fontSize: 32, fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, color: value <= 3 ? "#4ECDC4" : value <= 6 ? "#FFD700" : "#FF6B35", lineHeight: 1 }}>{value}</span>
      </div>
      <input type="range" min="1" max="10" value={value} onChange={e => onChange(parseInt(e.target.value))}
        style={{ width: "100%", height: 6, appearance: "none", background: "linear-gradient(90deg, #4ECDC4, #FFD700, #FF6B35)", borderRadius: 3, outline: "none", cursor: "pointer" }} />
      <div style={{ marginTop: 6, fontSize: 12, color: "rgba(255,255,255,0.35)", fontFamily: "'DM Mono', monospace", textAlign: "center" }}>{labels[value]}</div>
    </div>
  );
}

function ProofOfPresence({ discovery, onVerified, proofImage }) {
  const fileRef = useRef(null);
  const [preview, setPreview] = useState(proofImage || null);
  const [verified, setVerified] = useState(!!proofImage);

  const handleCapture = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      setPreview(ev.target.result);
      setVerified(true);
      antiCloud.logProof();
      onVerified(ev.target.result);
    };
    reader.readAsDataURL(file);
  };

  if (verified && preview) {
    return (
      <div style={{ marginTop: 10, padding: 10, background: "rgba(78,205,196,0.06)", borderRadius: 10, border: "1px solid rgba(78,205,196,0.15)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
          <span style={{ fontSize: 14 }}>✅</span>
          <span style={{ fontSize: 11, fontFamily: "'DM Mono', monospace", color: "#4ECDC4", fontWeight: 500 }}>PRESENCE VERIFIED</span>
        </div>
        <img src={preview} alt="Proof" style={{ width: "100%", maxHeight: 160, objectFit: "cover", borderRadius: 8, opacity: 0.85 }} />
      </div>
    );
  }

  return (
    <div style={{ marginTop: 10, padding: 12, background: "rgba(255,215,0,0.04)", borderRadius: 10, border: "1px dashed rgba(255,215,0,0.25)" }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
        <span style={{ fontSize: 16 }}>📸</span>
        <div style={{ flex: 1 }}>
          <p style={{ fontSize: 11, fontFamily: "'DM Mono', monospace", color: "#FFD700", margin: "0 0 8px", lineHeight: 1.4 }}>
            {discovery.challenge}
          </p>
          <input ref={fileRef} type="file" accept="image/*" capture="environment" onChange={handleCapture} style={{ display: "none" }} />
          <button onClick={() => fileRef.current?.click()} style={{
            padding: "8px 14px", fontSize: 11, fontWeight: 600, fontFamily: "'DM Mono', monospace",
            background: "rgba(255,215,0,0.1)", color: "#FFD700", border: "1px solid rgba(255,215,0,0.25)",
            borderRadius: 8, cursor: "pointer", transition: "all 0.2s",
          }}>
            📷 Take Photo to Unlock
          </button>
        </div>
      </div>
    </div>
  );
}

function DiscoveryCard({ discovery, index, isActive, onClick, isLocked, isUnlocked, proofImage, onProofVerified }) {
  const color = VIBE_COLORS[discovery.vibe] || "#4ECDC4";

  if (isLocked) {
    return (
      <div style={{
        padding: "14px 16px", background: "rgba(255,255,255,0.01)", border: "1px solid rgba(255,255,255,0.04)",
        borderRadius: 12, animation: `fadeSlideIn 0.4s ease ${index * 0.08}s both`,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontSize: 24, opacity: 0.2 }}>🔒</span>
          <div>
            <span style={{ fontSize: 14, fontWeight: 600, color: "rgba(255,255,255,0.15)", fontFamily: "'Space Grotesk', sans-serif" }}>
              Discovery #{index + 1}
            </span>
            <p style={{ margin: "2px 0 0", fontSize: 11, color: "rgba(255,255,255,0.1)", fontFamily: "'DM Mono', monospace" }}>
              Complete the previous challenge to reveal
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{
      padding: "14px 16px",
      background: isActive ? `${color}12` : "rgba(255,255,255,0.02)",
      border: `1px solid ${isActive ? color : "rgba(255,255,255,0.06)"}`,
      borderRadius: 12, transition: "all 0.3s ease",
      animation: `fadeSlideIn 0.4s ease ${index * 0.08}s both`,
    }}>
      <div onClick={onClick} style={{ cursor: "pointer" }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
          <span style={{ fontSize: 24, lineHeight: 1 }}>{discovery.icon}</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 14, fontWeight: 600, color: "#fff", fontFamily: "'Space Grotesk', sans-serif" }}>{discovery.name}</span>
              <span style={{ fontSize: 10, fontFamily: "'DM Mono', monospace", color, whiteSpace: "nowrap", padding: "2px 6px", background: `${color}15`, borderRadius: 4 }}>{discovery.time}</span>
            </div>
            <p style={{ margin: "4px 0 0", fontSize: 12.5, color: "rgba(255,255,255,0.5)", lineHeight: 1.4, fontFamily: "'DM Mono', monospace" }}>{discovery.desc}</p>
          </div>
        </div>
      </div>
      {isActive && (
        <ProofOfPresence discovery={discovery} proofImage={proofImage} onVerified={onProofVerified} />
      )}
    </div>
  );
}

function RouteMap({ discoveries, active, startLabel, vibeColor, unlockedCount }) {
  const points = discoveries.map((_, i) => {
    const t = i / Math.max(discoveries.length - 1, 1);
    const x = 40 + t * 620;
    const baseY = 200;
    const wave = Math.sin(t * Math.PI * 2.5 + i) * 60;
    const jitter = ((i * 137) % 50) - 25;
    return { x, y: baseY + wave + jitter };
  });

  const start = { x: 20, y: 200 };
  const end = { x: 690, y: 200 };
  const allPts = [start, ...points, end];

  let pathD = `M ${allPts[0].x} ${allPts[0].y}`;
  for (let i = 1; i < allPts.length; i++) {
    const prev = allPts[i - 1];
    const curr = allPts[i];
    const cpx1 = prev.x + (curr.x - prev.x) * 0.5;
    const cpx2 = prev.x + (curr.x - prev.x) * 0.5;
    pathD += ` C ${cpx1} ${prev.y}, ${cpx2} ${curr.y}, ${curr.x} ${curr.y}`;
  }

  const shortStart = startLabel && startLabel.length > 22 ? startLabel.slice(0, 20) + "…" : startLabel;
  const mainColor = vibeColor || "#4ECDC4";

  return (
    <svg viewBox="0 0 710 400" style={{ width: "100%", height: "auto", display: "block" }}>
      <defs>
        <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
          <path d="M 20 0 L 0 0 0 20" fill="none" stroke="rgba(255,255,255,0.03)" strokeWidth="0.5" />
        </pattern>
        <filter id="glow"><feGaussianBlur stdDeviation="3" result="blur" /><feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
        <filter id="locGlow"><feGaussianBlur stdDeviation="5" result="blur" /><feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
      </defs>
      <rect width="710" height="400" fill="url(#grid)" />
      {[80, 160, 240, 320].map(y => <line key={`h${y}`} x1="0" y1={y} x2="710" y2={y} stroke="rgba(255,255,255,0.02)" strokeWidth="1" />)}
      {[100, 200, 350, 500, 600].map(x => <line key={`v${x}`} x1={x} y1="0" x2={x} y2="400" stroke="rgba(255,255,255,0.02)" strokeWidth="1" />)}
      {/* Boring route */}
      <line x1="20" y1="200" x2="690" y2="200" stroke="rgba(255,255,255,0.08)" strokeWidth="2" strokeDasharray="8 6" />
      <text x="355" y="190" textAnchor="middle" fill="rgba(255,255,255,0.12)" fontSize="10" fontFamily="monospace">EFFICIENT ROUTE (BORING)</text>
      {/* Discovery route */}
      <path d={pathD} fill="none" stroke={`${mainColor}25`} strokeWidth="12" strokeLinecap="round" />
      <path d={pathD} fill="none" stroke={mainColor} strokeWidth="2.5" strokeLinecap="round" strokeDasharray="1200" strokeDashoffset="0" filter="url(#glow)" style={{ animation: "drawPath 2s ease-out forwards" }} />
      {/* Start — pulsing you-are-here */}
      <circle cx={start.x} cy={start.y} r="20" fill={`${mainColor}15`} filter="url(#locGlow)">
        <animate attributeName="r" values="16;24;16" dur="2.5s" repeatCount="indefinite" />
      </circle>
      <circle cx={start.x} cy={start.y} r="10" fill="#0e1a2a" stroke={mainColor} strokeWidth="2.5" />
      <circle cx={start.x} cy={start.y} r="4" fill={mainColor} />
      {shortStart && <text x={start.x + 2} y={start.y + 24} textAnchor="middle" fill={`${mainColor}88`} fontSize="7.5" fontFamily="monospace">{shortStart}</text>}
      {/* End */}
      <circle cx={end.x} cy={end.y} r="8" fill="#1a1a2e" stroke="#FF6B35" strokeWidth="2" />
      <text x={end.x} y={end.y + 4} textAnchor="middle" fill="#FF6B35" fontSize="10">B</text>
      {/* Discovery markers */}
      {points.map((p, i) => {
        const d = discoveries[i];
        const color = VIBE_COLORS[d.vibe] || mainColor;
        const isActive = active === i;
        const isLocked = i > unlockedCount;
        return (
          <g key={i} opacity={isLocked ? 0.2 : 1}>
            {isActive && !isLocked && <circle cx={p.x} cy={p.y} r="18" fill={color} opacity="0.15"><animate attributeName="r" values="18;24;18" dur="1.5s" repeatCount="indefinite" /></circle>}
            <circle cx={p.x} cy={p.y} r="12" fill="#1a1a2e" stroke={isLocked ? "rgba(255,255,255,0.1)" : color} strokeWidth={isActive ? 2.5 : 1.5} />
            <text x={p.x} y={p.y + 5} textAnchor="middle" fontSize="13">{isLocked ? "🔒" : d.icon}</text>
          </g>
        );
      })}
      <style>{`@keyframes drawPath { from { stroke-dashoffset: 1200; } to { stroke-dashoffset: 0; } }`}</style>
    </svg>
  );
}

function TreasureMap() {
  const routes = antiCloud.routeCount;
  const discoveries = antiCloud.totalDiscoveries;
  const proofs = antiCloud.proofCount;
  const history = antiCloud.completedRoutes;

  if (routes === 0) return null;

  return (
    <div style={{
      padding: "16px 20px", background: "rgba(255,255,255,0.02)", borderRadius: 14,
      border: "1px solid rgba(255,255,255,0.06)", marginBottom: 24,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
        <span style={{ fontSize: 16 }}>🗺️</span>
        <span style={{ fontSize: 12, fontFamily: "'DM Mono', monospace", color: "rgba(255,255,255,0.4)", letterSpacing: 1 }}>YOUR TREASURE MAP</span>
        <span style={{ fontSize: 9, fontFamily: "'DM Mono', monospace", color: "rgba(255,107,53,0.5)", marginLeft: "auto" }}>DEVICE-ONLY • EPHEMERAL</span>
      </div>
      <div style={{ display: "flex", gap: 20, marginBottom: history.length ? 12 : 0 }}>
        {[
          { n: routes, label: "Routes", color: "#4ECDC4" },
          { n: discoveries, label: "Discoveries", color: "#FFD700" },
          { n: proofs, label: "Proofs", color: "#FF6B35" },
        ].map(s => (
          <div key={s.label}>
            <div style={{ fontSize: 24, fontWeight: 700, color: s.color, fontFamily: "'Space Grotesk', sans-serif", lineHeight: 1 }}>{s.n}</div>
            <div style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", fontFamily: "'DM Mono', monospace" }}>{s.label}</div>
          </div>
        ))}
      </div>
      {history.length > 0 && (
        <div style={{ borderTop: "1px solid rgba(255,255,255,0.04)", paddingTop: 10 }}>
          {history.slice(-3).reverse().map((r, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, padding: "4px 0" }}>
              <span style={{ fontSize: 12 }}>{VIBE_ROUTES[r.vibe]?.icon || "🧭"}</span>
              <span style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", fontFamily: "'DM Mono', monospace", flex: 1 }}>{r.name}</span>
              <span style={{ fontSize: 10, color: "rgba(255,255,255,0.2)", fontFamily: "'DM Mono', monospace" }}>{r.discoveries} finds • {r.date}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── MAIN APP ───
export default function Unroute() {
  const [destination, setDestination] = useState("");
  const [level, setLevel] = useState(5);
  const [vibeKey, setVibeKey] = useState("any");
  const [route, setRoute] = useState(null);
  const [phase, setPhase] = useState("input");
  const [activeDisc, setActiveDisc] = useState(null);
  const [loadingText, setLoadingText] = useState("");
  const [proofs, setProofs] = useState({}); // index -> dataURL
  const [useManual, setUseManual] = useState(false);
  const [manualStart, setManualStart] = useState("");
  const [startCoords, setStartCoords] = useState(null); // { lat, lng } from autocomplete
  const [destCoords, setDestCoords] = useState(null); // { lat, lng } from autocomplete
  const [resolvedStart, setResolvedStart] = useState(null); // full place object from autocomplete
  const [resolvedDest, setResolvedDest] = useState(null); // full place object from autocomplete
  const geo = useGeolocation();

  // Auto-switch to manual input if GPS is denied or unsupported
  useEffect(() => {
    if (geo.status === "denied" || geo.status === "unsupported") setUseManual(true);
  }, [geo.status]);

  // Progressive unlock: first is always visible; each subsequent unlocks when previous has a proof
  const unlockedCount = useMemo(() => {
    if (!route) return 0;
    let count = 0;
    for (let i = 0; i < route.picks.length; i++) {
      if (i === 0 || proofs[i - 1]) count = i + 1;
      else break;
    }
    return count;
  }, [route, proofs]);

  const loadingMessages = [
    "Pinpointing your location…",
    "Avoiding the fastest route…",
    "Querying OpenStreetMap…",
    "Finding real places you've ignored…",
    "Scanning for hidden gems nearby…",
    "Calculating serendipity index…",
    "Asking a local cat for directions…",
    "Optimising for wonder…",
  ];

  // Resolve the effective start coords
  const getStartCoords = () => {
    if (useManual && startCoords) return startCoords;
    if (!useManual && geo.coords) return { lat: geo.coords.lat, lng: geo.coords.lng };
    return null;
  };

  const handleGenerate = async () => {
    if (!destination.trim()) return;
    setPhase("loading");
    setProofs({});
    let i = 0;

    // ── FALLBACK GEOCODING: if user typed but didn't select from dropdown ──
    let finalDestCoords = destCoords;
    let finalStartCoords = getStartCoords();

    if (!finalDestCoords) {
      setLoadingText("Resolving your destination…");
      try {
        const res = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(destination)}&format=json&limit=1`);
        const data = await res.json();
        if (data && data.length > 0) {
          finalDestCoords = { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
          setDestCoords(finalDestCoords);
        }
      } catch { /* proceed without coords */ }
    }

    if (useManual && manualStart.trim() && !finalStartCoords) {
      setLoadingText("Resolving your starting point…");
      try {
        const res = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(manualStart)}&format=json&limit=1`);
        const data = await res.json();
        if (data && data.length > 0) {
          finalStartCoords = { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
          setStartCoords(finalStartCoords);
        }
      } catch { /* proceed without coords */ }
    }

    const hasCoords = finalStartCoords && finalDestCoords;
    const msgs = hasCoords
      ? [...loadingMessages.filter(m => m !== "Pinpointing your location…"), "Generating AI descriptions…"]
      : loadingMessages;
    setLoadingText(msgs[0]);

    // Start async fetch in parallel with loading animation
    const routePromise = generateRouteAsync(level, vibeKey, finalStartCoords, finalDestCoords);

    const interval = setInterval(() => {
      i++;
      if (i < msgs.length) {
        setLoadingText(msgs[i]);
      }
    }, 650);

    // Wait for both minimum loading time and actual data
    const minWait = new Promise(res => setTimeout(res, Math.min(msgs.length, 6) * 650));
    Promise.all([routePromise, minWait]).then(([r]) => {
      clearInterval(interval);
      setRoute(r);
      setPhase("result");
    }).catch(() => {
      clearInterval(interval);
      // Complete failure — go to Pioneer Mode
      const names = ROUTE_NAMES[vibeKey] || ROUTE_NAMES.any;
      setRoute({ picks: [], extraMin: 0, baseDist: "?", routeDist: "?", name: names[0], vibeKey, isReal: false, isPioneer: true });
      setPhase("result");
    });
  };

  const handleReset = () => {
    if (route) antiCloud.logRoute(route);
    setPhase("input");
    setRoute(null);
    setActiveDisc(null);
    setProofs({});
  };

  const handleReshuffle = async () => {
    setActiveDisc(null);
    setProofs({});
    try {
      const r = await generateRouteAsync(level, vibeKey, getStartCoords(), destCoords);
      setRoute(r);
    } catch {
      const names = ROUTE_NAMES[vibeKey] || ROUTE_NAMES.any;
      setRoute({ picks: [], extraMin: 0, baseDist: "?", routeDist: "?", name: names[0], vibeKey, isReal: false, isPioneer: true });
    }
  };

  const startLabel = useManual
    ? (manualStart.trim() || "Custom start")
    : geo.address ? geo.address.split(",")[0].trim() : geo.coords ? `${geo.coords.lat.toFixed(3)}, ${geo.coords.lng.toFixed(3)}` : "You";
  const vibeColor = VIBE_ROUTES[vibeKey]?.color || "#4ECDC4";

  return (
    <div style={{ minHeight: "100vh", background: "#0a0a14", fontFamily: "'Space Grotesk', -apple-system, sans-serif", color: "#fff", position: "relative", overflow: "hidden" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@300;400;500;600;700&family=DM+Mono:wght@300;400;500&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        input[type="range"]::-webkit-slider-thumb { appearance: none; width: 22px; height: 22px; border-radius: 50%; background: #fff; border: 3px solid #0a0a14; cursor: pointer; box-shadow: 0 0 12px rgba(78,205,196,0.5); }
        input[type="range"]::-moz-range-thumb { width: 22px; height: 22px; border-radius: 50%; background: #fff; border: 3px solid #0a0a14; cursor: pointer; }
        @keyframes fadeSlideIn { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes pulse { 0%, 100% { opacity: 0.4; } 50% { opacity: 1; } }
        @keyframes float { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-6px); } }
        ::selection { background: #4ECDC4; color: #0a0a14; }
      `}</style>

      {/* Ambient glow */}
      <div style={{ position: "fixed", top: "-30%", right: "-20%", width: "60vw", height: "60vw", borderRadius: "50%", background: `radial-gradient(circle, ${vibeColor}08 0%, transparent 70%)`, pointerEvents: "none", transition: "background 0.5s" }} />
      <div style={{ position: "fixed", bottom: "-20%", left: "-10%", width: "50vw", height: "50vw", borderRadius: "50%", background: "radial-gradient(circle, rgba(255,107,53,0.03) 0%, transparent 70%)", pointerEvents: "none" }} />

      <div style={{ maxWidth: 680, margin: "0 auto", padding: "40px 20px 60px" }}>
        {/* Header */}
        <div style={{ marginBottom: 28, animation: "fadeSlideIn 0.6s ease" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
            <span style={{ fontSize: 28 }}>🧭</span>
            <h1 style={{ fontSize: 28, fontWeight: 700, letterSpacing: -1, background: `linear-gradient(135deg, ${vibeColor}, #FF6B35)`, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", transition: "background 0.5s" }}>
              Unroute
            </h1>
            <span style={{ fontSize: 10, fontFamily: "'DM Mono', monospace", color: "rgba(255,255,255,0.2)", padding: "2px 6px", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 4, marginLeft: 4 }}>V3</span>
          </div>
          <p style={{ fontSize: 13.5, color: "rgba(255,255,255,0.35)", fontFamily: "'DM Mono', monospace", maxWidth: 420, lineHeight: 1.5, marginBottom: 10 }}>
            Get lost on purpose. Prove you were there. Keep no cloud receipts.
          </p>
          <LocationBadge geo={geo} />
        </div>

        {/* Treasure Map Stats */}
        <TreasureMap />

        {/* ── INPUT PHASE ── */}
        {phase === "input" && (
          <div style={{ animation: "fadeSlideIn 0.5s ease" }}>
            {/* Starting from */}
            <div style={{ marginBottom: 20 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                <label style={{ fontSize: 11, fontFamily: "'DM Mono', monospace", color: "rgba(255,255,255,0.4)", letterSpacing: 1.5 }}>STARTING FROM</label>
                <button onClick={() => setUseManual(!useManual)} style={{
                  fontSize: 10, fontFamily: "'DM Mono', monospace", padding: "3px 8px",
                  background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)",
                  borderRadius: 6, color: "rgba(255,255,255,0.4)", cursor: "pointer", transition: "all 0.2s",
                }}>
                  {useManual ? "📡 Use GPS" : "✏️ Type manually"}
                </button>
              </div>

              {useManual ? (
                <PlaceAutocomplete
                  value={manualStart}
                  onChange={(v) => { setManualStart(v); }}
                  onSelect={(s) => {
                    if (!s) { setStartCoords(null); setResolvedStart(null); return; }
                    setManualStart(s.display); setStartCoords({ lat: s.lat, lng: s.lng }); setResolvedStart(s);
                  }}
                  placeholder="e.g. King's Cross, SE1 9SG, Hackney Wick…"
                  accentColor={vibeColor}
                  resolvedPlace={resolvedStart}
                />
              ) : (
                <div style={{ padding: "12px 16px", fontSize: 14, background: `${vibeColor}08`, border: `1px solid ${vibeColor}20`, borderRadius: 12, color: "rgba(255,255,255,0.6)", fontFamily: "'DM Mono', monospace", display: "flex", alignItems: "center", gap: 8 }}>
                  {geo.status === "located" ? (
                    <>
                      <span style={{ color: vibeColor, fontSize: 14 }}>📍</span>
                      <span style={{ color: "#fff", fontWeight: 500, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{geo.address || "Your location"}</span>
                      {geo.coords && <span style={{ fontSize: 10, color: "rgba(255,255,255,0.2)", flexShrink: 0 }}>{geo.coords.lat.toFixed(4)}, {geo.coords.lng.toFixed(4)}</span>}
                    </>
                  ) : geo.status === "requesting" || geo.status === "idle" ? (
                    <><span style={{ animation: "pulse 1.2s ease-in-out infinite" }}>📡</span><span>Getting your location…</span></>
                  ) : (
                    <><span>⚠️</span><span>Location unavailable — type manually instead</span></>
                  )}
                </div>
              )}
            </div>

            {/* Destination */}
            <div style={{ marginBottom: 20 }}>
              <label style={{ display: "block", fontSize: 11, fontFamily: "'DM Mono', monospace", color: "rgba(255,255,255,0.4)", letterSpacing: 1.5, marginBottom: 8 }}>WHERE ARE YOU TRYING TO GO?</label>
              <PlaceAutocomplete
                value={destination}
                onChange={(v) => { setDestination(v); }}
                onSelect={(s) => {
                  if (!s) { setDestCoords(null); setResolvedDest(null); return; }
                  setDestination(s.display); setDestCoords({ lat: s.lat, lng: s.lng }); setResolvedDest(s);
                }}
                placeholder="e.g. Bermondsey Station, E1 6AN, London Bridge…"
                accentColor={vibeColor}
                fontFamily="'Space Grotesk', sans-serif"
                resolvedPlace={resolvedDest}
              />
            </div>

            {/* Vibe Selector */}
            <div style={{ marginBottom: 24 }}>
              <VibeSelector selected={vibeKey} onChange={setVibeKey} />
            </div>

            {/* Discovery Level */}
            <div style={{ marginBottom: 32 }}>
              <DiscoverySlider value={level} onChange={setLevel} />
            </div>

            <button onClick={handleGenerate} disabled={!destination.trim()} style={{
              width: "100%", padding: "16px 24px", fontSize: 15, fontWeight: 600, fontFamily: "'Space Grotesk', sans-serif",
              background: destination.trim() ? `linear-gradient(135deg, ${vibeColor}, ${vibeColor}CC)` : "rgba(255,255,255,0.05)",
              color: destination.trim() ? "#0a0a14" : "rgba(255,255,255,0.2)",
              border: "none", borderRadius: 12, cursor: destination.trim() ? "pointer" : "default", transition: "all 0.3s ease", letterSpacing: 0.5,
            }}>
              Get Beautifully Lost →
            </button>

            <div style={{ marginTop: 20, padding: 14, background: "rgba(255,255,255,0.02)", borderRadius: 10, border: "1px solid rgba(255,255,255,0.04)" }}>
              <p style={{ fontSize: 11, color: "rgba(255,255,255,0.2)", fontFamily: "'DM Mono', monospace", lineHeight: 1.6 }}>
                📸 Routes unlock step-by-step — prove you found each discovery to reveal the next. · ✨ AI writes bespoke descriptions for real places. · 🏴‍☠️ No results? Pioneer Mode kicks in. · 🗺️ Your routes live only on this device.
              </p>
            </div>
          </div>
        )}

        {/* ── LOADING ── */}
        {phase === "loading" && (
          <div style={{ textAlign: "center", padding: "80px 20px", animation: "fadeSlideIn 0.4s ease" }}>
            <div style={{ fontSize: 48, marginBottom: 24, animation: "float 2s ease-in-out infinite" }}>{VIBE_ROUTES[vibeKey]?.icon || "🧭"}</div>
            <p style={{ fontSize: 14, fontFamily: "'DM Mono', monospace", color: vibeColor, animation: "pulse 1.2s ease-in-out infinite" }}>{loadingText}</p>
          </div>
        )}

        {/* ── RESULT ── */}
        {phase === "result" && route && (
          <div style={{ animation: "fadeSlideIn 0.5s ease" }}>
            {/* Route header */}
            <div style={{ padding: "20px 24px", marginBottom: 20, background: "rgba(255,255,255,0.02)", borderRadius: 14, border: "1px solid rgba(255,255,255,0.06)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12 }}>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4, flexWrap: "wrap" }}>
                    <span style={{ fontSize: 11, fontFamily: "'DM Mono', monospace", color: "rgba(255,255,255,0.35)", letterSpacing: 1 }}>YOUR ROUTE</span>
                    <span style={{ fontSize: 10, padding: "2px 8px", background: `${vibeColor}15`, color: vibeColor, borderRadius: 10, fontFamily: "'DM Mono', monospace" }}>
                      {VIBE_ROUTES[vibeKey]?.icon} {VIBE_ROUTES[vibeKey]?.label}
                    </span>
                    <span style={{ fontSize: 9, padding: "2px 6px", borderRadius: 8, fontFamily: "'DM Mono', monospace",
                      background: route.isReal ? "rgba(78,205,196,0.1)" : route.isPioneer ? "rgba(255,215,0,0.1)" : "rgba(255,255,255,0.04)",
                      color: route.isReal ? "#4ECDC4" : route.isPioneer ? "#FFD700" : "rgba(255,255,255,0.25)",
                      border: `1px solid ${route.isReal ? "rgba(78,205,196,0.2)" : route.isPioneer ? "rgba(255,215,0,0.2)" : "rgba(255,255,255,0.06)"}`,
                    }}>
                      {route.isReal ? "🟢 REAL PLACES" : route.isPioneer ? "🟡 PIONEER MODE" : "⚪ SIMULATED"}
                    </span>
                    {route.isReal && route.picks?.some(p => p.aiEnhanced) && (
                      <span style={{ fontSize: 9, padding: "2px 6px", borderRadius: 8, fontFamily: "'DM Mono', monospace",
                        background: "rgba(123,104,238,0.1)", color: "#7B68EE", border: "1px solid rgba(123,104,238,0.2)",
                      }}>
                        ✨ AI-ENHANCED
                      </span>
                    )}
                  </div>
                  <h2 style={{ fontSize: 22, fontWeight: 600, color: "#fff", letterSpacing: -0.5 }}>{route.name}</h2>
                  <p style={{ fontSize: 12, color: "rgba(255,255,255,0.35)", fontFamily: "'DM Mono', monospace", marginTop: 4 }}>
                    <span style={{ color: `${vibeColor}99` }}>📍 {startLabel}</span>
                    <span style={{ margin: "0 6px", color: "rgba(255,255,255,0.15)" }}>→</span>
                    <span style={{ color: vibeColor }}>{destination}</span>
                  </p>
                  {(startCoords || destCoords) && (
                    <p style={{ fontSize: 9, color: "rgba(255,255,255,0.15)", fontFamily: "'DM Mono', monospace", marginTop: 3 }}>
                      {useManual && startCoords ? `${startCoords.lat.toFixed(4)}, ${startCoords.lng.toFixed(4)}` : geo.coords ? `${geo.coords.lat.toFixed(4)}, ${geo.coords.lng.toFixed(4)}` : "—"}
                      {" → "}
                      {destCoords ? `${destCoords.lat.toFixed(4)}, ${destCoords.lng.toFixed(4)}` : "—"}
                    </p>
                  )}
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ display: "flex", gap: 16, justifyContent: "flex-end" }}>
                    <div>
                      <p style={{ fontSize: 10, fontFamily: "'DM Mono', monospace", color: "rgba(255,255,255,0.3)" }}>EFFICIENT</p>
                      <p style={{ fontSize: 14, color: "rgba(255,255,255,0.15)", fontFamily: "'DM Mono', monospace", textDecoration: "line-through" }}>{route.baseDist} km</p>
                    </div>
                    <div>
                      <p style={{ fontSize: 10, fontFamily: "'DM Mono', monospace", color: vibeColor }}>ADVENTURE</p>
                      <p style={{ fontSize: 14, color: "#fff", fontWeight: 600, fontFamily: "'DM Mono', monospace" }}>{route.routeDist} km</p>
                    </div>
                  </div>
                  <p style={{ fontSize: 11, color: "#FF6B35", fontFamily: "'DM Mono', monospace", marginTop: 6 }}>+{route.extraMin} min of wonder</p>
                </div>
              </div>
              {route.picks.length > 0 && (
                <>
                  <div style={{ marginTop: 14, height: 4, background: "rgba(255,255,255,0.04)", borderRadius: 2, overflow: "hidden" }}>
                    <div style={{
                      height: "100%", borderRadius: 2, transition: "width 0.5s ease",
                      background: `linear-gradient(90deg, ${vibeColor}, #FF6B35)`,
                      width: `${(Object.keys(proofs).length / route.picks.length) * 100}%`,
                    }} />
                  </div>
                  <p style={{ fontSize: 10, fontFamily: "'DM Mono', monospace", color: "rgba(255,255,255,0.2)", marginTop: 6 }}>
                    {Object.keys(proofs).length}/{route.picks.length} discoveries verified
                  </p>
                </>
              )}
            </div>

            {/* Map — only show with real discoveries */}
            {route.picks.length > 0 && (
              <div style={{ marginBottom: 20, borderRadius: 14, overflow: "hidden", border: "1px solid rgba(255,255,255,0.06)", background: "#0d0d1a" }}>
                <RouteMap discoveries={route.picks} active={activeDisc} startLabel={startLabel} vibeColor={vibeColor} unlockedCount={unlockedCount} />
              </div>
            )}

            {/* Pioneer Mode Banner — when no real places found */}
            {route.isPioneer && (
              <div style={{
                padding: "24px", marginBottom: 16, borderRadius: 14,
                background: "rgba(255,215,0,0.04)", border: "1px dashed rgba(255,215,0,0.25)",
                animation: "fadeSlideIn 0.5s ease",
              }}>
                <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                  <span style={{ fontSize: 32 }}>🏴‍☠️</span>
                  <div>
                    <h3 style={{ fontSize: 18, fontWeight: 600, color: "#FFD700", fontFamily: "'Space Grotesk', sans-serif", marginBottom: 8 }}>
                      Pioneer Mode
                    </h3>
                    <p style={{ fontSize: 13, color: "rgba(255,255,255,0.5)", fontFamily: "'DM Mono', monospace", lineHeight: 1.6, marginBottom: 12 }}>
                      {!getStartCoords() || !destCoords
                        ? "We need real coordinates to find real places. Select locations from the autocomplete dropdown so we can search OpenStreetMap."
                        : "OpenStreetMap has no mapped gems between these two points. This area is uncharted territory."
                      }
                    </p>
                    <p style={{ fontSize: 13, color: "#FFD700", fontFamily: "'DM Mono', monospace", lineHeight: 1.6, marginBottom: 16 }}>
                      {!getStartCoords() || !destCoords
                        ? "Go back and pick your start and destination from the suggestions."
                        : "Your challenge: Walk 15 minutes in any direction. Find something interesting. Take a photo. You're the cartographer now."
                      }
                    </p>
                    {(!getStartCoords() || !destCoords) && (
                      <button onClick={handleReset} style={{
                        padding: "10px 18px", fontSize: 12, fontWeight: 600, fontFamily: "'DM Mono', monospace",
                        background: "rgba(255,215,0,0.1)", color: "#FFD700", border: "1px solid rgba(255,215,0,0.25)",
                        borderRadius: 8, cursor: "pointer",
                      }}>
                        ← Go Back & Select Locations
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Discoveries — only when we have real data */}
            {route.picks.length > 0 && (
              <div style={{ marginBottom: 8 }}>
                <p style={{ fontSize: 11, fontFamily: "'DM Mono', monospace", color: "rgba(255,255,255,0.35)", letterSpacing: 1, marginBottom: 12 }}>
                  {route.picks.length} REAL DISCOVERIES • TAP TO EXPAND • 📸 TO UNLOCK NEXT
                </p>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {route.picks.map((d, i) => (
                    <DiscoveryCard
                      key={i} discovery={d} index={i}
                      isActive={activeDisc === i}
                      isLocked={i >= unlockedCount}
                      isUnlocked={i < unlockedCount}
                      proofImage={proofs[i]}
                      onClick={() => i < unlockedCount && setActiveDisc(activeDisc === i ? null : i)}
                      onProofVerified={(img) => setProofs(prev => ({ ...prev, [i]: img }))}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Actions */}
            <div style={{ display: "flex", gap: 10, marginTop: 24 }}>
              <button onClick={handleReshuffle} style={{ flex: 1, padding: "14px 20px", fontSize: 13, fontWeight: 600, fontFamily: "'Space Grotesk', sans-serif", background: `${vibeColor}15`, color: vibeColor, border: `1px solid ${vibeColor}33`, borderRadius: 10, cursor: "pointer", transition: "all 0.3s" }}>
                🎲 Reshuffle
              </button>
              <button onClick={handleReset} style={{ flex: 1, padding: "14px 20px", fontSize: 13, fontWeight: 600, fontFamily: "'Space Grotesk', sans-serif", background: "rgba(255,255,255,0.04)", color: "rgba(255,255,255,0.5)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 10, cursor: "pointer", transition: "all 0.3s" }}>
                ← Finish Route
              </button>
            </div>

            {/* Anti-cloud notice */}
            <div style={{ marginTop: 28, padding: "14px 18px", background: "rgba(255,107,53,0.04)", borderRadius: 10, border: "1px solid rgba(255,107,53,0.1)" }}>
              <p style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", fontFamily: "'DM Mono', monospace", lineHeight: 1.6 }}>
                🗺️ <span style={{ color: "#FF6B35" }}>Anti-Cloud:</span> This route exists only on your device. No server. No backup. If you clear this page, it's gone — like a real memory.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
