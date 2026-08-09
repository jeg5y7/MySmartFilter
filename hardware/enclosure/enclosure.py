"""
MySmartFilter Rev A enclosure — parametric CadQuery model.

Two printed parts:
  * base — mounts to the furnace (magnet pockets open to the outside),
    holds the 3xAA battery holder, ESP32 dev board, and SDP810 sensor
    in drop-in fenced bays
  * lid  — friction skirt + 4 corner screws, panel button + LED holes,
    engraved wordmark

Regenerate:  python hardware/enclosure/enclosure.py
Outputs:     base.stl, lid.stl (print these), enclosure.step (CAD exchange)

Print (Bambu, PETG): 0.2 mm layer, 3 walls, 15 % infill, no supports.
Base prints cavity-up, lid prints top-face-down.
"""
import cadquery as cq

# ── Parameters (mm) ─────────────────────────────────────────────────────────
WALL = 2.4          # perimeter wall thickness
FLOOR = 4.0         # thick floor so magnet pockets can hide inside it
INT_L = 132.0       # interior length  (x)
INT_W = 56.0        # interior width   (y)
INT_H = 25.0        # interior depth   (z)
CORNER_R = 5.0      # outer corner radius

EXT_L = INT_L + 2 * WALL
EXT_W = INT_W + 2 * WALL
BASE_H = FLOOR + INT_H

LID_T = 2.4         # lid plate thickness
SKIRT_H = 5.0       # lid skirt drops into the cavity
SKIRT_T = 1.5
SKIRT_CLR = 0.25    # per-side clearance so the lid actually fits

# Battery holder: standard flat 3xAA side-by-side (~57.5 x 47.5 x 16)
BAT_L, BAT_W = 58.5, 48.5
FENCE_T, FENCE_H = 1.6, 8.0

# ESP32 dev board (30-pin DevKit, ~52 x 28.5) — drop-in fenced bay
ESP_L, ESP_W = 54.0, 30.3

# SDP810 sensor (~29 x 18 body) — drop-in fenced bay near the tube holes
SEN_L, SEN_W = 30.6, 20.6

# Corner screw posts (#4 / 2.9 mm self-tapping)
POST_D, PILOT_D, PILOT_DEPTH = 7.0, 2.4, 12.0
SCREW_CLR_D, CBORE_D, CBORE_DEPTH = 3.2, 6.2, 1.2
POSTS = [(x, y) for x in (-INT_L / 2 + POST_D / 2, INT_L / 2 - POST_D / 2)
         for y in (-INT_W / 2 + POST_D / 2, INT_W / 2 - POST_D / 2)]

# Magnets: 12 x 3 mm discs, pockets open to the OUTSIDE bottom face
MAG_D, MAG_H = 12.4, 3.2
MAGNETS = [(-52, -20), (-52, 20), (52, -20), (52, 20)]

# Wall penetrations
TUBE_D = 7.6                    # two grommeted tube holes, right end wall
TUBE_Y, TUBE_SPACING = 17.0, 12.0
TUBE_Z = FLOOR + 12.0
CABLE_D = 8.2                   # power-cable grommet, front long wall
CABLE_X, CABLE_Z = 30.0, FLOOR + 12.0

# Lid features
BUTTON_D = 12.4                 # 12 mm panel-mount momentary
BUTTON_POS = (12.0, 12.0)
LED_D = 5.2                     # 5 mm LED
LED_POS = (12.0, -6.0)
TEXT = "MySmartFilter"
TEXT_DEPTH = 0.6


def rounded_box(length, width, height, radius):
    return (
        cq.Workplane("XY")
        .box(length, width, height, centered=(True, True, False))
        .edges("|Z")
        .fillet(radius)
    )


def fence(inner_l, inner_w, cx, cy):
    """Open rectangular fence a component drops into."""
    outer = (
        cq.Workplane("XY")
        .center(cx, cy)
        .box(inner_l + 2 * FENCE_T, inner_w + 2 * FENCE_T, FENCE_H,
             centered=(True, True, False))
        .translate((0, 0, FLOOR))
    )
    inner = (
        cq.Workplane("XY")
        .center(cx, cy)
        .box(inner_l, inner_w, FENCE_H + 1, centered=(True, True, False))
        .translate((0, 0, FLOOR))
    )
    return outer.cut(inner)


# ── Base ────────────────────────────────────────────────────────────────────
base = rounded_box(EXT_L, EXT_W, BASE_H, CORNER_R)
cavity = rounded_box(INT_L, INT_W, INT_H + 1, CORNER_R - WALL).translate(
    (0, 0, FLOOR)
)
base = base.cut(cavity)

# Component bays (positions keep every fence clear of the corner posts)
base = base.union(fence(BAT_L, BAT_W, -58 + BAT_L / 2 + FENCE_T, 0))
base = base.union(fence(ESP_L, ESP_W, 4 + ESP_L / 2 + FENCE_T, -26 + ESP_W / 2 + FENCE_T))
base = base.union(fence(SEN_L, SEN_W, 24 + SEN_L / 2 + FENCE_T, 28 - SEN_W / 2 - FENCE_T))

# Corner screw posts with pilot holes
for (px, py) in POSTS:
    post = (
        cq.Workplane("XY")
        .center(px, py)
        .circle(POST_D / 2)
        .extrude(BASE_H)
    )
    base = base.union(post.translate((0, 0, 0)))
    pilot = (
        cq.Workplane("XY")
        .center(px, py)
        .circle(PILOT_D / 2)
        .extrude(PILOT_DEPTH)
        .translate((0, 0, BASE_H - PILOT_DEPTH))
    )
    base = base.cut(pilot)

# Magnet pockets, opening DOWN through the outside bottom face
for (mx, my) in MAGNETS:
    pocket = (
        cq.Workplane("XY")
        .center(mx, my)
        .circle(MAG_D / 2)
        .extrude(MAG_H)
    )
    base = base.cut(pocket)

# Two tube holes through the right end wall
for i in (0, 1):
    y = TUBE_Y - TUBE_SPACING / 2 + i * TUBE_SPACING
    hole = (
        cq.Workplane("YZ")
        .center(y, TUBE_Z)
        .circle(TUBE_D / 2)
        .extrude(WALL + 2)
        .translate((INT_L / 2 - 1, 0, 0))
    )
    base = base.cut(hole)

# Power-cable hole through the front long wall
cable = (
    cq.Workplane("XZ")
    .center(CABLE_X, CABLE_Z)
    .circle(CABLE_D / 2)
    .extrude(WALL + 2)
    .translate((0, -EXT_W / 2 - 1, 0))
)
base = base.cut(cable)

# ── Lid ─────────────────────────────────────────────────────────────────────
lid = rounded_box(EXT_L, EXT_W, LID_T, CORNER_R)

skirt_outer = rounded_box(
    INT_L - 2 * SKIRT_CLR, INT_W - 2 * SKIRT_CLR, SKIRT_H, CORNER_R - WALL
)
skirt_inner = rounded_box(
    INT_L - 2 * (SKIRT_CLR + SKIRT_T),
    INT_W - 2 * (SKIRT_CLR + SKIRT_T),
    SKIRT_H + 1,
    max(CORNER_R - WALL - SKIRT_T, 1.0),
)
skirt = skirt_outer.cut(skirt_inner).translate((0, 0, -SKIRT_H))

# Clear the skirt around each corner post
for (px, py) in POSTS:
    clr = (
        cq.Workplane("XY")
        .center(px, py)
        .circle(POST_D / 2 + 1.2)
        .extrude(SKIRT_H + 1)
        .translate((0, 0, -SKIRT_H))
    )
    skirt = skirt.cut(clr)

lid = lid.union(skirt)

# Screw through-holes + counterbores
for (px, py) in POSTS:
    lid = lid.cut(
        cq.Workplane("XY").center(px, py).circle(SCREW_CLR_D / 2)
        .extrude(LID_T + SKIRT_H + 2).translate((0, 0, -SKIRT_H - 1))
    )
    lid = lid.cut(
        cq.Workplane("XY").center(px, py).circle(CBORE_D / 2)
        .extrude(CBORE_DEPTH + 0.01).translate((0, 0, LID_T - CBORE_DEPTH))
    )

# Button + LED holes
lid = lid.cut(
    cq.Workplane("XY").center(*BUTTON_POS).circle(BUTTON_D / 2)
    .extrude(LID_T + SKIRT_H + 2).translate((0, 0, -SKIRT_H - 1))
)
lid = lid.cut(
    cq.Workplane("XY").center(*LED_POS).circle(LED_D / 2)
    .extrude(LID_T + SKIRT_H + 2).translate((0, 0, -SKIRT_H - 1))
)

# Engraved wordmark on the top face
text = (
    cq.Workplane("XY")
    .center(-30, 0)
    .text(TEXT, 9, -TEXT_DEPTH, font="DejaVu Sans", kind="bold")
    .translate((0, 0, LID_T))
)
lid = lid.cut(text)

# ── Export ──────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    import os

    out = os.path.dirname(os.path.abspath(__file__))
    cq.exporters.export(base, os.path.join(out, "base.stl"))
    cq.exporters.export(lid, os.path.join(out, "lid.stl"))

    assy = cq.Assembly()
    assy.add(base, name="base")
    assy.add(lid.translate((0, 0, BASE_H + SKIRT_H + 8)), name="lid")
    assy.export(os.path.join(out, "enclosure.step"))

    print(f"exterior: {EXT_L:.1f} x {EXT_W:.1f} x {BASE_H + LID_T:.1f} mm")
    print("wrote base.stl, lid.stl, enclosure.step")
