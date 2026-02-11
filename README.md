# Vertical Slats Card – ESPHome Edition

Forked from [nfmsh/vertical-slats-card](https://github.com/nfmsh/vertical-slats-card).

A Home Assistant Lovelace card that visually represents **vertical blinds** with animated fabric-style slats — rewritten for **real-time integration with ESPHome cover entities**.

The original card was designed for motors that only support open/close, using an `input_number` helper to fake visual state. This fork reads position directly from the cover entity, so what you see is what your blinds are actually doing.

---

## Hardware

This fork is built around an **ESP32** dev board driving a **stepper motor** through an **A4988 stepper driver**. The stepper used here is the [17HS08-1004S by StepperOnline](https://www.omc-stepperonline.com/nema-17-bipolar-1-8deg-16ncm-22-6oz-in-1a-3-8v-42x42x20mm-4-wires-17hs08-1004s) — a compact NEMA 17 that fits well in a blinds housing — but any bipolar stepper with compatible ratings should work.

### GPIO assignments

| GPIO | Label | Purpose |
|---:|---|---|
| 2 | `motor_led` | Activity LED — on during movement, off at idle |
| 21 | `a4988_enable_pin` | A4988 ENABLE (active-low) — LOW enables motor outputs, HIGH disables |
| 23 | `a4988_ms3` | Microstep select bit 3 — sets microstepping resolution with MS1/MS2 |
| 25 | `dir_pin` | A4988 DIRECTION — sets rotation direction |
| 26 | `step_pin` | A4988 STEP — pulse line that advances the motor one step |
| 27 | `a4988_sleep_pin` | A4988 SLEEP + RESET (tied together) — HIGH = awake, LOW = sleep |
| 32 | `a4988_ms2` | Microstep select bit 2 |
| 33 | `a4988_ms1` | Microstep select bit 1 |

**Microstep truth table (A4988):**

| Mode | MS1 | MS2 | MS3 |
|---|---|---|---|
| Full step | LOW | LOW | LOW |
| 1/2 step | HIGH | LOW | LOW |
| 1/4 step | LOW | HIGH | LOW |
| 1/8 step | HIGH | HIGH | LOW |
| 1/16 step | HIGH | HIGH | HIGH |

### No two-way communication

This setup has **no position feedback from the motor to the ESP32**. The stepper is open-loop — the firmware tracks position by counting steps, but it has no way to verify the physical position of the blinds. If the motor skips steps (e.g., obstruction, binding, or excessive speed), the tracked position will drift from reality.

A **limit switch** can be wired to a GPIO and used to establish definite open and/or closed positions. On trigger, the firmware can reset its step counter to a known reference point, correcting any accumulated drift. This is not implemented in the current ESPHome config but is a straightforward addition.

---

## What changed from the original

- **No `input_number` helper required.** Position is read from `cover.*.attributes.current_position`, which ESPHome publishes natively.
- **Real-time feedback.** The card reflects actual stepper position as it moves, not a last-commanded guess.
- **Movement state indication.** "Opening…" / "Closing…" with a pulsing visual border while the cover is in motion.
- **Open / Stop / Close buttons** actually render now (they were config options in the original but never implemented).
- **Position slider** actually renders now — drag to set any position via `cover.set_cover_position`.
- **Stop support.** New `stop_script` option, or calls `cover.stop_cover` by default.
- **Single file.** Editor and card are combined into one JS file. One resource entry.
- **`visual_entity` is optional.** Still works as a display override if you want it, but it's no longer required.
- **Debug system.** `window.VSC_DEBUG = true` in browser console enables timestamped logging. History available in `window.VSC_LOG`.

Everything else — fabric mode, lux auto-tint, slat colors, wave animation — is unchanged.

---

## Demo / Screenshots

*Coming soon.*

---

## Installation (manual)

Not available through HACS.

1. Copy `vertical-slats-card.js` to your Home Assistant config:

```
/config/www/vertical-blinds-card/
  └─ vertical-blinds-card.js
```

2. Add as a resource:

**Settings → Dashboards → Resources → Add Resource**

| Field | Value |
|---|---|
| URL | `/local/vertical-blinds-card/vertical-blinds-card.js` |
| Type | JavaScript Module |

3. Hard refresh your browser (Ctrl+F5).

---

## Required setup

### A cover entity with position support

Your ESPHome cover must have `has_position: true`. Example from ESPHome:

```yaml
cover:
  - platform: template
    id: blind_cover
    device_class: blind
    name: "Master Bedroom Blinds"
    has_position: true
    # ... open_action, close_action, position_action, stop_action
```

That's it. The card reads `current_position` and `state` directly from this entity.

---

## Usage

### Minimal config

```yaml
type: custom:vertical-slats-card
name: Master Bedroom Blinds
entity: cover.master_bedroom_blinds
```

### Typical config

```yaml
type: custom:vertical-slats-card
name: Master Bedroom Blinds
entity: cover.master_bedroom_blinds
show_buttons: true
show_meter: true
slats: 11
slat_color: "#e7e1d6"
```

### With script overrides

If your setup needs scripts instead of direct cover services:

```yaml
type: custom:vertical-slats-card
name: Master Bedroom Blinds
entity: cover.master_bedroom_blinds
open_script: script.bedroom_blinds_open
close_script: script.bedroom_blinds_close
stop_script: script.bedroom_blinds_stop
```

### With lux auto-tint

```yaml
type: custom:vertical-slats-card
name: Master Bedroom Blinds
entity: cover.master_bedroom_blinds
auto_tint: lux
light_entity: sensor.porch_illuminance
lux_min: 0
lux_max: 60000
slat_color: "#3f4f45"
```

---

## Configuration options

| Option | Type | Default | Notes |
|---|---|---:|---|
| `entity` | string | **required** | Cover entity (`cover.*`) |
| `name` | string | `"Vertical Blinds"` | Card title |
| `visual_entity` | string | `null` | Optional `input_number` override for display |
| `open_script` | string | `null` | Overrides `cover.open_cover` |
| `close_script` | string | `null` | Overrides `cover.close_cover` |
| `stop_script` | string | `null` | Overrides `cover.stop_cover` |
| `invert` | boolean | `false` | Reverse animation direction |
| `show_buttons` | boolean | `true` | Show Open / Stop / Close buttons |
| `show_meter` | boolean | `true` | Show position slider |
| `slats` | number | `11` | Slat count (3–25) |
| `slat_color` | string | theme-based | Hex recommended if auto-tint enabled |
| `slat_shine_color` | string | auto | Optional shine color override |
| `fabric_mode` | boolean | `true` | Softer highlight/opacity |
| `auto_tint` | `"off"` \| `"lux"` | `"off"` | Lux-based color tinting |
| `light_entity` | string | `null` | Illuminance sensor for auto-tint |
| `lux_min` | number | `0` | Lux value at minimum tint |
| `lux_max` | number | `60000` | Lux value at maximum tint |

---

## Debugging

Open your browser console and run:

```js
window.VSC_DEBUG = true;
```

Every card action (render, open, close, stop, slider change, position read) logs a structured entry with timestamp, function ID, current values, description, and result.

View log history:

```js
console.table(window.VSC_LOG);
```

Disable:

```js
window.VSC_DEBUG = false;
```

Log is capped at 500 entries.

---

## How position feedback works

The card reads from the cover entity in this priority order:

1. **`visual_entity`** — if configured and available, used for display (backward compat with original card)
2. **`cover.*.attributes.current_position`** — the real position published by ESPHome's `cover.template.publish`
3. **Cover state fallback** — if no `current_position` attribute exists, derives from state: `open` → 100%, `closed` → 0%

For ESPHome covers with `has_position: true`, option 2 is what you'll get. The position updates in real time as the stepper moves, driven by whatever publish interval your firmware uses.

---

## Troubleshooting

### Card doesn't show up
- Verify the resource URL matches your file path exactly.
- Hard refresh (Ctrl+F5) or try incognito.
- Check browser console for loading errors.

### Position doesn't update
- Confirm your cover entity has `current_position` in its attributes (Developer Tools → States).
- If using ESPHome, verify your `publish_cover_position` script is running.

### Buttons don't work
- Check browser console for service call errors.
- If using script overrides, verify the script entity IDs are correct.

### Auto-tint doesn't work
- `auto_tint` must be `lux` and `light_entity` must point to a valid sensor.
- `slat_color` must be a hex value (e.g. `#3f4f45`) — named CSS colors can't be tinted.

---

## Differences from original

| Feature | Original | This fork |
|---|---|---|
| Position source | `input_number` (required) | Cover entity (automatic) |
| Real-time feedback | No | Yes |
| Movement indication | No | Yes (state text + pulsing border) |
| Stop button | No | Yes |
| Position slider | Config option, not rendered | Functional |
| Open/Close buttons | Config option, not rendered | Functional |
| File count | 2 (card + editor) | 1 (combined) |
| HACS | Yes | No |
| Debug logging | No | Yes (`window.VSC_DEBUG`) |

---

## License

MIT — see [LICENSE](LICENSE).

Original card by [nfmsh](https://github.com/nfmsh/vertical-slats-card).
