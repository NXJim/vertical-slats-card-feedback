/* Vertical Slats Card – ESPHome Integrated Edition (Combined)
 *
 * Single-file custom Lovelace card: editor + card.
 * Reads position directly from a cover.* entity (ESPHome or otherwise).
 * No input_number helper required — shows real-time stepper feedback.
 *
 * Required:
 *   entity: cover.*   (must have has_position: true)
 *
 * Optional:
 *   visual_entity:     input_number.* (overrides cover position for display only)
 *   open_script:       script.* (overrides cover.open_cover)
 *   close_script:      script.* (overrides cover.close_cover)
 *   stop_script:       script.* (overrides cover.stop_cover)
 *   invert:            boolean (flip open/closed visual direction)
 *   show_meter:        boolean (show position slider)
 *   show_buttons:      boolean (show open/stop/close buttons)
 *   slats:             number  (3–25, default 11)
 *   slat_color:        CSS color (hex recommended for auto-tint)
 *   slat_shine_color:  CSS color override for shine effect
 *   fabric_mode:       boolean (softer fabric look, default true)
 *
 * Glow (light behind slats):
 *   glow_mode:            "off" | "static" | "sun" (default "sun")
 *   sun_entity:           string (default "sun.sun")
 *   glow_color:           hex color for static mode (default "#fffbe6")
 *   glow_intensity:       0–100, max brightness cap (default 70)
 *   night_glow:           boolean, show moonlight at night (default true)
 *   night_glow_color:     hex color for night (default "#a8c4e0")
 *   night_glow_intensity: 0–100, moonlight brightness (default 20)
 *
 * Auto-tint (lux):
 *   auto_tint:     "lux" | "off" (default "off")
 *   light_entity:  sensor.* (illuminance sensor)
 *   lux_min:       number (default 0)
 *   lux_max:       number (default 60000)
 *
 * Debug:
 *   window.VSC_DEBUG = true/false   (browser console)
 *   window.VSC_LOG                  (last 500 entries)
 */

/* ============================================================================
 * DEBUG SYSTEM
 * ========================================================================= */
window.VSC_DEBUG = window.VSC_DEBUG || false;
window.VSC_LOG = window.VSC_LOG || [];

/**
 * _vscDebug - Centralized debug logger
 * @param {string} id        - Identifier of the function/block/variable
 * @param {*}      contents  - Current value or relevant data
 * @param {string} desc      - What this log entry is about
 * @param {string} result    - Outcome (e.g., "OK", "SKIPPED", "ERROR: ...")
 */
function _vscDebug(id, contents, desc, result) {
  if (!window.VSC_DEBUG) return;
  const ts = new Date().toISOString();
  const entry = { ts, id, contents, desc, result };
  const contentsStr = typeof contents === "object" ? JSON.stringify(contents) : String(contents);
  console.log(`[VSC] ${ts} | id=${id} | val=${contentsStr} | desc=${desc} | result=${result}`);
  window.VSC_LOG.push(entry);
  if (window.VSC_LOG.length > 500) window.VSC_LOG.shift();
}

/* ============================================================================
 * LIT ELEMENT BOOTSTRAP
 * ========================================================================= */
const LitElement = Object.getPrototypeOf(customElements.get("ha-panel-lovelace"));
const html = LitElement.prototype.html;
const css = LitElement.prototype.css;


/* ============================================================================
 * EDITOR CLASS
 * Must be defined and registered BEFORE the card class.
 * ========================================================================= */
class VerticalSlatsCardEditor extends LitElement {
  static get properties() {
    return {
      hass: {},
      _config: { state: true },
    };
  }

  setConfig(config) {
    this._config = { ...config };
  }

  _valueChanged(ev) {
    if (!this._config || !this.hass) return;
    if (!ev.detail || !ev.detail.value) return;

    const newConfig = { ...this._config, ...ev.detail.value };

    // Remove empty string values (optional fields left blank)
    for (const k of Object.keys(newConfig)) {
      if (typeof newConfig[k] === "string" && newConfig[k].trim() === "") {
        delete newConfig[k];
      }
    }

    this._config = newConfig;
    this.dispatchEvent(new CustomEvent("config-changed", {
      detail: { config: newConfig },
      bubbles: true,
      composed: true,
    }));
  }

  /* ------------------------------------------------------------------
   * _schema - Builds the ha-form schema array
   * Conditionally shows glow sub-fields and lux sub-fields
   * ---------------------------------------------------------------- */
  _schema() {
    const c = this._config || {};
    const glowMode = c.glow_mode || "sun";
    const isLux = (c.auto_tint || "off") === "lux";
    const isSunGlow = glowMode === "sun";
    const isStaticGlow = glowMode === "static";
    const isGlowOn = isSunGlow || isStaticGlow;

    const schema = [
      // --- Core ---
      { name: "name",           selector: { text: {} } },
      { name: "entity",         selector: { entity: { domain: "cover" } } },
      { name: "visual_entity",  selector: { entity: { domain: "input_number" } } },

      // --- Script overrides ---
      { name: "open_script",    selector: { entity: { domain: "script" } } },
      { name: "close_script",   selector: { entity: { domain: "script" } } },
      { name: "stop_script",    selector: { entity: { domain: "script" } } },

      // --- Behavior ---
      { name: "invert",         selector: { boolean: {} } },
      { name: "show_buttons",   selector: { boolean: {} } },
      { name: "show_meter",     selector: { boolean: {} } },

      { name: "show_name",     selector: { boolean: {} } },
      { name: "show_status",   selector: { boolean: {} } },

      // --- Appearance ---
      { name: "slats",          selector: { number: { min: 3, max: 25, step: 1, mode: "slider" } } },
      { name: "slat_radius",    selector: { number: { min: 0, max: 20, step: 1, mode: "slider" } } },
      { name: "slat_gap",       selector: { number: { min: 0, max: 20, step: 1, mode: "slider" } } },
      { name: "slat_color",     selector: { text: {} } },
      { name: "slat_shine_color", selector: { text: {} } },
      { name: "fabric_mode",    selector: { boolean: {} } },

      // --- Glow mode selector ---
      {
        name: "glow_mode",
        selector: {
          select: {
            mode: "dropdown",
            options: [
              { label: "Off",                value: "off" },
              { label: "Static (fixed)",     value: "static" },
              { label: "Sun-linked (auto)",  value: "sun" },
            ],
          },
        },
      },
    ];

    // --- Sun glow sub-fields ---
    if (isSunGlow) {
      schema.push(
        { name: "sun_entity",           selector: { entity: { domain: "sun" } } },
        { name: "glow_intensity",       selector: { number: { min: 0, max: 100, step: 5, mode: "slider" } } },
        { name: "night_glow",           selector: { boolean: {} } },
        { name: "night_glow_color",     selector: { text: {} } },
        { name: "night_glow_intensity", selector: { number: { min: 0, max: 100, step: 5, mode: "slider" } } },
      );
    }

    // --- Static glow sub-fields ---
    if (isStaticGlow) {
      schema.push(
        { name: "glow_color",     selector: { text: {} } },
        { name: "glow_intensity", selector: { number: { min: 0, max: 100, step: 5, mode: "slider" } } },
      );
    }

    // --- Auto-tint ---
    schema.push({
      name: "auto_tint",
      selector: {
        select: {
          mode: "dropdown",
          options: [
            { label: "Off",        value: "off" },
            { label: "Lux sensor", value: "lux" },
          ],
        },
      },
    });

    if (isLux) {
      schema.push(
        { name: "light_entity", selector: { entity: { domain: "sensor" } } },
        { name: "lux_min",      selector: { number: { min: 0, max: 200000, step: 1 } } },
        { name: "lux_max",      selector: { number: { min: 0, max: 200000, step: 1 } } },
      );
    }

    return schema;
  }

  _labelFor(name) {
    const labels = {
      name:                "Card name",
      entity:              "Cover entity (required)",
      visual_entity:       "Visual override (input_number, optional)",
      open_script:         "Open script (optional)",
      close_script:        "Close script (optional)",
      stop_script:         "Stop script (optional)",
      invert:              "Invert animation direction",
      show_buttons:        "Show Open / Stop / Close buttons",
      show_meter:          "Show position slider",
      show_name:           "Show card name",
      show_status:         "Show status & percentage",
      slats:               "Number of slats",
      slat_radius:         "Slat corner radius (px)",
      slat_gap:            "Gap between slats (px)",
      slat_color:          "Slat color (hex recommended)",
      slat_shine_color:    "Shine color override (optional)",
      fabric_mode:         "Fabric mode (softer look)",
      glow_mode:           "Glow behind slats",
      sun_entity:          "Sun entity (default: sun.sun)",
      glow_color:          "Glow color (hex)",
      glow_intensity:      "Glow max intensity (0–100)",
      night_glow:          "Show moonlight glow at night",
      night_glow_color:    "Night glow color (hex, default cool blue)",
      night_glow_intensity: "Night glow intensity (0–100)",
      auto_tint:           "Auto-tint mode",
      light_entity:        "Lux sensor entity",
      lux_min:             "Lux minimum",
      lux_max:             "Lux maximum",
    };
    return labels[name] || name;
  }

  render() {
    if (!this.hass) return html``;
    return html`
      <ha-form
        .hass=${this.hass}
        .data=${this._config}
        .schema=${this._schema()}
        .computeLabel=${(s) => this._labelFor(s.name)}
        @value-changed=${this._valueChanged}
      ></ha-form>
    `;
  }
}

customElements.define("vertical-slats-card-editor", VerticalSlatsCardEditor);


/* ============================================================================
 * MAIN CARD CLASS
 * ========================================================================= */
class VerticalSlatsCard extends LitElement {
  static get properties() {
    return { hass: {}, config: {} };
  }

  /* ------------------------------------------------------------------
   * Lovelace editor hooks
   * ---------------------------------------------------------------- */
  static getConfigElement() {
    return document.createElement("vertical-slats-card-editor");
  }

  static getStubConfig() {
    return {
      type: "custom:vertical-slats-card",
      name: "Vertical Blinds",
      entity: "",
      visual_entity: "",
      show_buttons: true,
      show_meter: true,
      show_name: true,
      show_status: true,
      invert: false,
      slats: 11,
      slat_radius: 10,
      slat_gap: 6,
      fabric_mode: true,
      glow_mode: "sun",
      sun_entity: "sun.sun",
      glow_color: "#fffbe6",
      glow_intensity: 70,
      night_glow: true,
      night_glow_color: "#a8c4e0",
      night_glow_intensity: 20,
      auto_tint: "off",
      light_entity: "",
      lux_min: 0,
      lux_max: 60000,
      slat_color: "#e7e1d6",
      slat_shine_color: "",
      open_script: "",
      close_script: "",
      stop_script: "",
    };
  }

  /* ------------------------------------------------------------------
   * setConfig
   * ---------------------------------------------------------------- */
  setConfig(config) {
    if (!config.entity) throw new Error("Missing 'entity' (cover.*).");

    this.config = {
      name: "Vertical Blinds",
      slats: 11,
      slat_radius: 10,
      slat_gap: 6,
      show_buttons: true,
      show_meter: true,
      show_name: true,
      show_status: true,
      invert: false,

      slat_color: null,
      slat_shine_color: null,
      fabric_mode: true,

      // Glow defaults
      glow_mode: "sun",
      sun_entity: "sun.sun",
      glow_color: "#fffbe6",
      glow_intensity: 70,
      night_glow: true,
      night_glow_color: "#a8c4e0",
      night_glow_intensity: 20,

      // Auto-tint defaults
      auto_tint: "off",
      light_entity: null,
      lux_min: 0,
      lux_max: 60000,

      // Script overrides
      open_script: null,
      close_script: null,
      stop_script: null,

      // Optional visual override
      visual_entity: null,

      ...config,
    };

    _vscDebug("setConfig", this.config, "Config merged with defaults", "OK");
  }

  getCardSize() {
    let size = 2;
    if (this.config.show_buttons) size += 1;
    if (this.config.show_meter) size += 1;
    return size;
  }

  /* ------------------------------------------------------------------
   * Utility: clamping
   * ---------------------------------------------------------------- */
  _clamp(v) {
    v = Number(v);
    if (!Number.isFinite(v)) return 0;
    return Math.max(0, Math.min(100, v));
  }

  _clamp01(v) {
    v = Number(v);
    if (!Number.isFinite(v)) return 0;
    return Math.max(0, Math.min(1, v));
  }

  /* ------------------------------------------------------------------
   * _getPosition - Gets current blinds position (0–100)
   *
   * Priority:
   *   1. visual_entity (input_number) if configured and available
   *   2. cover entity's current_position attribute
   *   3. Fallback: derive from cover state (open=100, closed=0)
   * ---------------------------------------------------------------- */
  _getPosition() {
    if (this.config.visual_entity) {
      const vst = this.hass?.states?.[this.config.visual_entity];
      if (vst && vst.state !== "unavailable" && vst.state !== "unknown") {
        const val = this._clamp(vst.state);
        _vscDebug("_getPosition", val, "Read from visual_entity", "OK");
        return val;
      }
      _vscDebug("_getPosition", this.config.visual_entity, "visual_entity unavailable, falling back", "FALLBACK");
    }

    const coverSt = this.hass?.states?.[this.config.entity];
    if (!coverSt) {
      _vscDebug("_getPosition", this.config.entity, "Cover entity not found", "ERROR");
      return 0;
    }

    const pos = coverSt.attributes?.current_position;
    if (pos !== undefined && pos !== null) {
      const val = this._clamp(pos);
      _vscDebug("_getPosition", val, "Read from cover current_position", "OK");
      return val;
    }

    const stateMap = { open: 100, closed: 0, opening: 50, closing: 50 };
    const fallback = stateMap[coverSt.state] ?? 0;
    _vscDebug("_getPosition", { state: coverSt.state, derived: fallback }, "Derived from state", "FALLBACK");
    return fallback;
  }

  _getCoverState() {
    const st = this.hass?.states?.[this.config.entity];
    if (!st) return "unavailable";
    return st.state || "unavailable";
  }

  _isMoving() {
    const state = this._getCoverState();
    return state === "opening" || state === "closing";
  }

  /* ------------------------------------------------------------------
   * Cover control actions
   * ---------------------------------------------------------------- */
  async _open() {
    _vscDebug("_open", { entity: this.config.entity, script: this.config.open_script }, "Open triggered", "STARTED");
    try {
      if (this.config.open_script) {
        await this.hass.callService("script", "turn_on", { entity_id: this.config.open_script });
      } else {
        await this.hass.callService("cover", "open_cover", { entity_id: this.config.entity });
      }
      _vscDebug("_open", this.config.entity, "Open complete", "OK");
    } catch (err) {
      _vscDebug("_open", err.message, "Open failed", "ERROR");
    }
  }

  async _close() {
    _vscDebug("_close", { entity: this.config.entity, script: this.config.close_script }, "Close triggered", "STARTED");
    try {
      if (this.config.close_script) {
        await this.hass.callService("script", "turn_on", { entity_id: this.config.close_script });
      } else {
        await this.hass.callService("cover", "close_cover", { entity_id: this.config.entity });
      }
      _vscDebug("_close", this.config.entity, "Close complete", "OK");
    } catch (err) {
      _vscDebug("_close", err.message, "Close failed", "ERROR");
    }
  }

  async _stop() {
    _vscDebug("_stop", { entity: this.config.entity, script: this.config.stop_script }, "Stop triggered", "STARTED");
    try {
      if (this.config.stop_script) {
        await this.hass.callService("script", "turn_on", { entity_id: this.config.stop_script });
      } else {
        await this.hass.callService("cover", "stop_cover", { entity_id: this.config.entity });
      }
      _vscDebug("_stop", this.config.entity, "Stop complete", "OK");
    } catch (err) {
      _vscDebug("_stop", err.message, "Stop failed", "ERROR");
    }
  }

  async _setPosition(pct) {
    const clamped = this._clamp(pct);
    _vscDebug("_setPosition", clamped, "Setting position", "STARTED");
    try {
      await this.hass.callService("cover", "set_cover_position", {
        entity_id: this.config.entity,
        position: clamped,
      });
      _vscDebug("_setPosition", clamped, "Position set", "OK");
    } catch (err) {
      _vscDebug("_setPosition", err.message, "Set position failed", "ERROR");
    }
  }

  async _toggle() {
    const pos = this._getPosition();
    _vscDebug("_toggle", pos, "Toggle", pos >= 50 ? "CLOSING" : "OPENING");
    return pos >= 50 ? this._close() : this._open();
  }

  _onSliderChange(ev) {
    const val = Number(ev.target.value);
    _vscDebug("_onSliderChange", val, "Slider changed", "OK");
    this._setPosition(val);
  }

  /* ====================================================================
   * COLOR HELPERS (shared by auto-tint and glow)
   * ==================================================================== */

  _parseHexColor(input) {
    if (typeof input !== "string") return null;
    const hex = input.trim().replace("#", "");
    if (![3, 6].includes(hex.length)) return null;
    const full = hex.length === 3
      ? hex.split("").map((c) => c + c).join("")
      : hex;
    const n = Number.parseInt(full, 16);
    if (!Number.isFinite(n)) return null;
    return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
  }

  _rgbToHex({ r, g, b }) {
    const to2 = (x) => x.toString(16).padStart(2, "0");
    return `#${to2(r)}${to2(g)}${to2(b)}`;
  }

  _rgbToString({ r, g, b }) {
    return `${r}, ${g}, ${b}`;
  }

  _mix(a, b, t) {
    return Math.round(a + (b - a) * t);
  }

  _mixColor(c1, c2, t) {
    return {
      r: this._mix(c1.r, c2.r, t),
      g: this._mix(c1.g, c2.g, t),
      b: this._mix(c1.b, c2.b, t),
    };
  }

  /* ====================================================================
   * AUTO-TINT (lux) helpers
   * ==================================================================== */

  _getLuxFactorSafe() {
    if (this.config.auto_tint !== "lux") return null;
    if (!this.config.light_entity) return null;
    const st = this.hass?.states?.[this.config.light_entity];
    if (!st || st.state === "unknown" || st.state === "unavailable") return null;
    const lux = Number(st.state);
    if (!Number.isFinite(lux)) return null;
    const min = Number(this.config.lux_min);
    const max = Number(this.config.lux_max);
    if (!Number.isFinite(min) || !Number.isFinite(max) || max <= min) return null;
    return this._clamp01((lux - min) / (max - min));
  }

  _computeFabricColors() {
    const baseHex = this.config.slat_color;
    const baseRgb = this._parseHexColor(baseHex);

    if (!baseRgb) {
      return {
        slatColor: baseHex || "var(--primary-text-color)",
        shineColor: this.config.slat_shine_color || "rgba(255,255,255,0.22)",
        baseOpacity: this.config.fabric_mode ? 0.75 : 0.85,
        shineOpacity: this.config.fabric_mode ? 0.35 : 0.55,
      };
    }

    const k = this._getLuxFactorSafe();
    if (k === null) {
      return {
        slatColor: baseHex,
        shineColor: this.config.slat_shine_color || "rgba(255,255,255,0.25)",
        baseOpacity: 0.78,
        shineOpacity: 0.32,
      };
    }

    const warmWhite = { r: 250, g: 248, b: 244 };
    const softDeep  = { r: 60,  g: 60,  b: 62 };
    const brighten = 0.10 + 0.18 * k;
    const deepen   = 0.08 * (1 - k);
    const brightened = this._mixColor(baseRgb, warmWhite, brighten);
    const finalRgb   = this._mixColor(brightened, softDeep, deepen);

    return {
      slatColor: this._rgbToHex(finalRgb),
      shineColor: this.config.slat_shine_color || "rgba(255,255,255,0.25)",
      baseOpacity: 0.78,
      shineOpacity: 0.32,
    };
  }

  /* ====================================================================
   * GLOW SYSTEM
   *
   * Computes glow color and opacity based on:
   *   - Sun mode: solar elevation → color temp + intensity
   *   - Static mode: fixed user color + intensity
   *   - Off: no glow
   *
   * Returns: { color: "r,g,b", opacity: 0–1, isNight: bool, nightPulse: bool }
   *
   * Solar elevation mapping:
   *   < -12°  : deep night  → moonlight (cool blue, subtle)
   *   -12–-6° : twilight    → blend moonlight → amber
   *   -6°–0°  : civil dawn  → warm amber, rising
   *   0°–15°  : golden hour → amber → warm white
   *   15°+    : full day    → bright warm white
   * ==================================================================== */
  _computeGlow(positionT) {
    const mode = this.config.glow_mode || "sun";

    // --- Off ---
    if (mode === "off") {
      _vscDebug("_computeGlow", "off", "Glow disabled", "OK");
      return { color: "255,251,230", opacity: 0, isNight: false, nightPulse: false };
    }

    // Intensity cap from config (0–100 → 0.0–1.0)
    const maxIntensity = this._clamp01((this.config.glow_intensity ?? 70) / 100);

    // --- Static mode ---
    if (mode === "static") {
      const rgb = this._parseHexColor(this.config.glow_color) || { r: 255, g: 251, b: 230 };
      // Glow opacity scales with blind position: more open = more glow
      const opacity = positionT * maxIntensity;
      _vscDebug("_computeGlow", { mode, opacity }, "Static glow", "OK");
      return {
        color: this._rgbToString(rgb),
        opacity: opacity,
        isNight: false,
        nightPulse: false,
      };
    }

    // --- Sun mode ---
    const sunEntity = this.config.sun_entity || "sun.sun";
    const sunState = this.hass?.states?.[sunEntity];

    // Fallback if sun entity unavailable: use static warm white
    if (!sunState || sunState.state === "unavailable" || sunState.state === "unknown") {
      _vscDebug("_computeGlow", sunEntity, "Sun entity unavailable, using static fallback", "FALLBACK");
      const rgb = this._parseHexColor(this.config.glow_color) || { r: 255, g: 251, b: 230 };
      return {
        color: this._rgbToString(rgb),
        opacity: positionT * maxIntensity,
        isNight: false,
        nightPulse: false,
      };
    }

    const elevation = Number(sunState.attributes?.elevation ?? 0);

    // Color stops for solar phases
    const moonlight   = this._parseHexColor(this.config.night_glow_color) || { r: 168, g: 196, b: 224 }; // #a8c4e0
    const warmAmber    = { r: 255, g: 183, b: 77 };   // #ffb74d - dawn/dusk
    const warmWhite    = { r: 255, g: 251, b: 230 };   // #fffbe6 - full day

    // Night glow settings
    const nightEnabled = this.config.night_glow !== false;
    const nightMax = this._clamp01((this.config.night_glow_intensity ?? 20) / 100);

    let glowColor;
    let solarIntensity; // 0–1 base intensity before position scaling
    let isNight = false;
    let nightPulse = false;

    if (elevation < -12) {
      /* ---- Deep night ---- */
      glowColor = moonlight;
      solarIntensity = nightEnabled ? nightMax : 0;
      isNight = true;
      nightPulse = nightEnabled;
      _vscDebug("_computeGlow", { elevation, phase: "deep_night" }, "Deep night", "OK");

    } else if (elevation < -6) {
      /* ---- Twilight: moonlight → amber ---- */
      // t: 0 at -12°, 1 at -6°
      const t = (elevation + 12) / 6;
      glowColor = this._mixColor(moonlight, warmAmber, t);
      // Intensity rises from night level toward low-day
      const dayFloor = 0.15;
      solarIntensity = nightEnabled
        ? nightMax + (dayFloor - nightMax) * t
        : dayFloor * t;
      isNight = t < 0.5;
      nightPulse = nightEnabled && t < 0.3;
      _vscDebug("_computeGlow", { elevation, t, phase: "twilight" }, "Twilight", "OK");

    } else if (elevation < 0) {
      /* ---- Civil dawn/dusk: amber, rising ---- */
      // t: 0 at -6°, 1 at 0°
      const t = (elevation + 6) / 6;
      glowColor = warmAmber;
      solarIntensity = 0.15 + 0.25 * t; // 0.15 → 0.40
      _vscDebug("_computeGlow", { elevation, t, phase: "civil_dawn" }, "Civil dawn/dusk", "OK");

    } else if (elevation < 15) {
      /* ---- Golden hour: amber → warm white ---- */
      // t: 0 at 0°, 1 at 15°
      const t = elevation / 15;
      glowColor = this._mixColor(warmAmber, warmWhite, t);
      solarIntensity = 0.40 + 0.60 * t; // 0.40 → 1.0
      _vscDebug("_computeGlow", { elevation, t, phase: "golden_hour" }, "Golden hour", "OK");

    } else {
      /* ---- Full day ---- */
      glowColor = warmWhite;
      solarIntensity = 1.0;
      _vscDebug("_computeGlow", { elevation, phase: "full_day" }, "Full day", "OK");
    }

    // Final opacity: solar intensity × position openness × user max cap
    // Night glow is less affected by position (moonlight bleeds through even when mostly closed)
    const positionFactor = isNight
      ? 0.3 + 0.7 * positionT  // Night: 30% base even when closed, scales to 100%
      : positionT;               // Day: fully scales with position

    const opacity = solarIntensity * positionFactor * maxIntensity;

    return {
      color: this._rgbToString(glowColor),
      opacity: Math.min(opacity, 1),
      isNight,
      nightPulse,
    };
  }

  /* ====================================================================
   * RENDER
   * ==================================================================== */
  render() {
    if (!this.hass || !this.config) return html``;

    // --- Entity check ---
    const coverState = this.hass.states?.[this.config.entity];
    if (!coverState) {
      return html`
        <ha-card>
          <div class="wrap">
            <div class="error">Entity not found: ${this.config.entity}</div>
          </div>
        </ha-card>
      `;
    }

    // --- Position & state ---
    const position = this._getPosition();
    const state = this._getCoverState();
    const moving = this._isMoving();
    const t0 = position / 100;
    const t = this.config.invert ? (1 - t0) : t0;
    const sx = 0.10 + 0.90 * t;

    // --- Slats ---
    const slatCount = Math.max(3, Math.min(25, Number(this.config.slats)));
    const slats = Array.from({ length: slatCount }, (_, i) => i);

    // --- Colors ---
    const colors = this._computeFabricColors();

    // --- Glow ---
    const glow = this._computeGlow(t);

    // --- State label ---
    const stateLabels = {
      open: "Open",
      closed: "Closed",
      opening: "Opening\u2026",
      closing: "Closing\u2026",
      unavailable: "Unavailable",
    };
    const stateText = stateLabels[state] || state;

    // --- Rail color: slightly darker than slat color ---
    const railColor = this.config.slat_color || "var(--secondary-text-color)";

    _vscDebug("render", { position, state, sx, glow: { color: glow.color, opacity: glow.opacity.toFixed(3), isNight: glow.isNight } }, "Rendering card", "OK");

    return html`
      <ha-card>
        <div class="wrap">

          <!-- HEADER: conditionally shows name and/or status -->
          ${this.config.show_name || this.config.show_status ? html`
            <div class="header">
              ${this.config.show_name ? html`
                <div class="title">${this.config.name}</div>
              ` : html`<div></div>`}
              ${this.config.show_status ? html`
                <div class="state-info">
                  <span class="state-text ${moving ? "moving" : ""}">${stateText}</span>
                  <span class="pos-pct">${Math.round(position)}%</span>
                </div>
              ` : ""}
            </div>
          ` : ""}

          <!-- VISUALIZATION -->
          <div
            class="viz ${moving ? "viz-moving" : ""}"
            @click=${this._toggle}
            role="button"
            tabindex="0"
            title="Click to toggle"
          >
            <!-- GLOW LAYER: sits behind everything -->
            <div
              class="glow-layer ${glow.nightPulse ? "glow-night-pulse" : ""}"
              style="
                --glow-color: ${glow.color};
                --glow-opacity: ${glow.opacity};
              "
            ></div>

            <!-- TOP RAIL -->
            <div class="rail" style="--rail-color: ${railColor};"></div>

            <!-- CLIP STEMS + SLATS -->
            <div
              class="blinds-assembly"
              style="
                --sx:${sx};
                --slat-color:${colors.slatColor};
                --shine-color:${colors.shineColor};
                --slat-base-opacity:${colors.baseOpacity};
                --slat-shine-opacity:${colors.shineOpacity};
                --slat-gap:${Number.isFinite(Number(this.config.slat_gap)) ? Number(this.config.slat_gap) : 6}px;
                --slat-radius:${Number.isFinite(Number(this.config.slat_radius)) ? Number(this.config.slat_radius) : 10}px;
              "
            >
              ${slats.map((i) => {
                const wave = Math.sin((i / Math.max(1, slatCount - 1)) * Math.PI) * 0.08;
                const local = Math.max(0.08, sx * (1 - wave));
                return html`
                  <div class="slat-unit">
                    <div class="clip-stem" style="--rail-color: ${railColor};"></div>
                    <div class="slat" style="--lsx:${local};">
                      <div class="slatBase"></div>
                      <div class="slatShine"></div>
                    </div>
                  </div>
                `;
              })}
            </div>
          </div>

          <!-- METER -->
          ${this.config.show_meter ? html`
            <div class="meter">
              <span class="meter-label">Position</span>
              <input
                type="range"
                min="0"
                max="100"
                step="1"
                .value=${String(Math.round(position))}
                @change=${this._onSliderChange}
                class="pos-slider"
              />
              <span class="meter-value">${Math.round(position)}%</span>
            </div>
          ` : ""}

          <!-- BUTTONS -->
          ${this.config.show_buttons ? html`
            <div class="buttons">
              <button class="btn btn-open" @click=${this._open} title="Open">
                <ha-icon icon="mdi:arrow-expand-horizontal"></ha-icon>
                <span>Open</span>
              </button>
              <button class="btn btn-stop" @click=${this._stop} title="Stop">
                <ha-icon icon="mdi:stop"></ha-icon>
                <span>Stop</span>
              </button>
              <button class="btn btn-close" @click=${this._close} title="Close">
                <ha-icon icon="mdi:arrow-collapse-horizontal"></ha-icon>
                <span>Close</span>
              </button>
            </div>
          ` : ""}

        </div>
      </ha-card>
    `;
  }

  /* ====================================================================
   * STYLES
   * ==================================================================== */
  static get styles() {
    return css`
      ha-card {
        overflow: hidden;
      }
      .wrap {
        padding: 14px;
        display: grid;
        gap: 12px;
      }

      /* --- Error --- */
      .error {
        color: var(--error-color, #db4437);
        font-size: 0.9rem;
        padding: 12px;
      }

      /* --- Header --- */
      .header {
        display: flex;
        justify-content: space-between;
        align-items: center;
      }
      .title {
        font-size: 1.05rem;
        font-weight: 650;
      }
      .state-info {
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 0.85rem;
        color: var(--secondary-text-color);
      }
      .state-text.moving {
        color: var(--primary-color);
        animation: pulse-text 1.2s ease-in-out infinite;
      }
      .pos-pct {
        font-weight: 600;
        font-variant-numeric: tabular-nums;
        min-width: 2.5em;
        text-align: right;
      }

      /* --- Visualization container --- */
      .viz {
        position: relative;
        border-radius: 14px;
        padding: 10px;
        background: rgba(0,0,0,0.06);
        cursor: pointer;
        transition: box-shadow 0.3s ease;
        overflow: hidden;
      }
      .viz:hover {
        box-shadow: 0 0 0 2px var(--primary-color);
      }
      .viz-moving {
        box-shadow: 0 0 0 2px var(--primary-color);
        animation: pulse-border 1.5s ease-in-out infinite;
      }

      /* --- Glow layer: radial gradient behind slats --- */
      .glow-layer {
        position: absolute;
        inset: 0;
        border-radius: 14px;
        background: radial-gradient(
          ellipse 80% 90% at 50% 60%,
          rgba(var(--glow-color), var(--glow-opacity)) 0%,
          rgba(var(--glow-color), calc(var(--glow-opacity) * 0.4)) 50%,
          transparent 100%
        );
        transition: opacity 600ms ease;
        pointer-events: none;
        z-index: 0;
      }
      /* Subtle moonlight pulse at night */
      .glow-night-pulse {
        animation: moonlight-pulse 4s ease-in-out infinite;
      }

      /* --- Top rail --- */
      .rail {
        position: relative;
        z-index: 2;
        height: 8px;
        border-radius: 4px;
        background: var(--rail-color, #b0aaa0);
        opacity: 0.85;
        /* Subtle 3D ridge */
        box-shadow:
          inset 0 1px 0 rgba(255,255,255,0.3),
          inset 0 -1px 0 rgba(0,0,0,0.15),
          0 1px 2px rgba(0,0,0,0.1);
      }

      /* --- Blinds assembly (clips + slats grid) --- */
      .blinds-assembly {
        position: relative;
        z-index: 1;
        display: grid;
        grid-auto-flow: column;
        grid-auto-columns: 1fr;
        gap: var(--slat-gap, 6px);
        height: 92px;
      }

      /* --- Individual slat unit: clip stem + slat body --- */
      .slat-unit {
        display: flex;
        flex-direction: column;
        align-items: center;
      }

      /* Clip stem connecting rail to slat */
      .clip-stem {
        width: 3px;
        height: 6px;
        background: var(--rail-color, #b0aaa0);
        opacity: 0.65;
        border-radius: 0 0 1px 1px;
        flex-shrink: 0;
      }

      /* --- Slat body --- */
      .slat {
        position: relative;
        flex: 1;
        width: 100%;
        border-radius: var(--slat-radius, 10px);
        overflow: hidden;
      }
      .slatBase, .slatShine {
        position: absolute;
        inset: 0;
        transform-origin: 50% 50%;
        transform: scaleX(var(--lsx, var(--sx)));
        transition: transform 320ms ease;
        border-radius: var(--slat-radius, 10px);
      }
      .slatBase {
        background: var(--slat-color);
        opacity: var(--slat-base-opacity);
      }
      .slatShine {
        background: linear-gradient(90deg, transparent, var(--shine-color), transparent);
        opacity: var(--slat-shine-opacity);
        mix-blend-mode: overlay;
      }

      /* --- Meter --- */
      .meter {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 0 4px;
      }
      .meter-label {
        font-size: 0.8rem;
        color: var(--secondary-text-color);
        min-width: 50px;
      }
      .meter-value {
        font-size: 0.8rem;
        font-weight: 600;
        font-variant-numeric: tabular-nums;
        color: var(--primary-text-color);
        min-width: 2.5em;
        text-align: right;
      }
      .pos-slider {
        flex: 1;
        -webkit-appearance: none;
        appearance: none;
        height: 6px;
        border-radius: 3px;
        background: var(--disabled-text-color, #ccc);
        outline: none;
        cursor: pointer;
      }
      .pos-slider::-webkit-slider-thumb {
        -webkit-appearance: none;
        appearance: none;
        width: 18px;
        height: 18px;
        border-radius: 50%;
        background: var(--primary-color);
        cursor: pointer;
        border: 2px solid var(--card-background-color, #fff);
        box-shadow: 0 1px 3px rgba(0,0,0,0.3);
      }
      .pos-slider::-moz-range-thumb {
        width: 18px;
        height: 18px;
        border-radius: 50%;
        background: var(--primary-color);
        cursor: pointer;
        border: 2px solid var(--card-background-color, #fff);
        box-shadow: 0 1px 3px rgba(0,0,0,0.3);
      }

      /* --- Buttons --- */
      .buttons {
        display: grid;
        grid-template-columns: 1fr 1fr 1fr;
        gap: 8px;
      }
      .btn {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 4px;
        padding: 8px 4px;
        border: none;
        border-radius: 10px;
        background: rgba(0,0,0,0.06);
        color: var(--primary-text-color);
        font-size: 0.8rem;
        font-weight: 500;
        cursor: pointer;
        transition: background 0.2s ease;
      }
      .btn:hover {
        background: rgba(0,0,0,0.12);
      }
      .btn:active {
        background: rgba(0,0,0,0.18);
      }
      .btn ha-icon {
        --mdc-icon-size: 18px;
      }
      .btn-stop {
        color: var(--error-color, #db4437);
      }

      /* --- Animations --- */
      @keyframes pulse-border {
        0%, 100% { box-shadow: 0 0 0 2px var(--primary-color); }
        50% { box-shadow: 0 0 0 3px var(--primary-color); }
      }
      @keyframes pulse-text {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.5; }
      }
      @keyframes moonlight-pulse {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.7; }
      }
    `;
  }
}

/* ============================================================================
 * REGISTER
 * ========================================================================= */
customElements.define("vertical-slats-card", VerticalSlatsCard);

window.customCards = window.customCards || [];
window.customCards.push({
  type: "vertical-slats-card",
  name: "Vertical Slats Card",
  description: "Animated vertical blinds with rail, sun-linked glow, and ESPHome integration.",
});
