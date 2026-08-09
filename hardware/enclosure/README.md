# Rev A enclosure — 3D-printable

Parametric CadQuery model (`enclosure.py`) for the smart filter monitor
case. Two printed parts (`base.stl`, `lid.stl`) + `enclosure.step` for any
CAD tool. Exterior: **136.8 × 60.8 × 31.4 mm** assembled.

## Print settings (Bambu Studio)

| Setting | Value |
|---|---|
| Material | **PETG** (handles furnace-room temps better than PLA) |
| Layer height | 0.2 mm |
| Walls | 3 |
| Infill | 15 % gyroid |
| Supports | **None needed** |
| Orientation | base: cavity up (as imported) · lid: top face down (as imported) |
| Plate | textured PEI, no brim needed |

Import both STLs into one plate — combined print is roughly 3–4 h on a P1/X1.

## What goes where

- **Battery bay** (large fence, left): flat 3×AA holder (~58×48×16 mm),
  drops in; dab of hot glue or foam tape to stop rattle
- **ESP32 bay** (long fence, front-right): 30-pin dev board drops in flat
- **Sensor bay** (small fence, back-right): SDP810 sits inside; the kit's
  two tubes pass through the **two grommeted holes in the right end wall**
  (Ø7.6 — fits a standard 8 mm rubber grommet with tube through it)
- **Power** (Ø8.2 hole, front wall): adapter cable enters over the ESP32
  bay; knot the cable inside as a strain relief
- **Magnets**: 4 × Ø12×3 mm neodymium discs glue into the pockets on the
  **outside bottom** (CA or E6000, flush = full grip on the furnace cabinet;
  adhesive pad is the backup for non-steel cabinets)
- **Lid**: 12 mm panel-mount momentary button + 5 mm LED press into the two
  lid holes; skirt drops into the cavity; 4 × #4 × ½″ self-tapping screws
  into the corner posts

## Tweaking the fit

Everything is a named parameter at the top of `enclosure.py` (bay sizes,
hole diameters, wall thickness, magnet size…). Change a number, rerun:

```bash
pip install cadquery
python hardware/enclosure/enclosure.py
```

First-print checklist: verify your battery holder and dev-board footprints
against `BAT_L/BAT_W` and `ESP_L/ESP_W` before slicing — clone boards vary
by a millimeter or two.
