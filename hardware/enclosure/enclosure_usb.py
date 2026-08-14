"""
MySmartFilter Rev A enclosure — compact USB-powered variant.

Same construction as enclosure.py minus the battery bay: the ESP32 dev
board's own USB port faces a wall opening, so the customer plugs the cable
straight into the board. Tubes enter the opposite end. Roughly half the
footprint of the battery variant.

Regenerate:  python hardware/enclosure/enclosure_usb.py
Outputs:     base-usb.stl, lid-usb.stl, enclosure-usb.step
Print (Bambu, PETG): 0.2 mm layer, 3 walls, 15 % infill, no supports.
"""
import cadquery as cq

# ── Parameters (mm) ─────────────────────────────────────────────────────────
WALL = 2.4
FLOOR = 4.0          # thick floor hides the magnet pockets
INT_L = 112.0
INT_W = 42.0
INT_H = 22.0
CORNER_R = 5.0

EXT_L = INT_L + 2 * WALL
EXT_W = INT_W + 2 * WALL
BASE_H = FLOOR + INT_H

LID_T = 2.4
SKIRT_H = 5.0
SKIRT_T = 1.5
SKIRT_CLR = 0.25

FENCE_T, FENCE_H = 1.6, 8.0

# ESP32 dev board (30-pin DevKit ~52 x 28.5) — USB end faces the left wall
ESP_L, ESP_W = 54.0, 30.3
ESP_X0 = -INT_L / 2 + 2.0          # fence outer starts 2 mm off the wall

# USB plug-through opening in the left end wall
USB_W, USB_H = 16.0, 10.0          # generous: fits micro-USB or USB-C plugs
USB_Z0 = FLOOR + 0.5

# SDP810 sensor bay near the tube holes (right end)
SEN_L, SEN_W = 30.6, 20.6
SEN_X0 = 22.0                      # fence outer starts here

# Corner screw posts (#4 self-tapping)
POST_D, PILOT_D, PILOT_DEPTH = 7.0, 2.4, 12.0
SCREW_CLR_D, CBORE_D, CBORE_DEPTH = 3.2, 6.2, 1.2
POSTS = [(x, y) for x in (-INT_L / 2 + POST_D / 2, INT_L / 2 - POST_D / 2)
         for y in (-INT_W / 2 + POST_D / 2, INT_W / 2 - POST_D / 2)]

# Magnets: 12 x 3 mm discs, pockets open through the outside bottom
MAG_D, MAG_H = 12.4, 3.2
MAGNETS = [(-38, -13), (-38, 13), (38, -13), (38, 13)]

# Two grommeted tube holes, right end wall
TUBE_D, TUBE_SPACING, TUBE_Z = 7.6, 12.0, FLOOR + 11.0

# Lid features (open floor zone between the two bays)
# Glow window: a thinned disc in the lid diffuses the RGB status LED into
# an ambient glow (print the lid in white/natural PETG). No button — the
# monitor pairs itself when WiFi is unreachable and detects new filters
# automatically from the pressure drop.
GLOW_D = 30.0          # window diameter
GLOW_MEMBRANE = 0.8    # remaining wall = 4 layers at 0.2 mm, glows nicely
GLOW_POS = (12.0, 0.0)
TEXT, TEXT_DEPTH = "MySmartFilter", 0.6


def rounded_box(length, width, height, radius):
    return (
        cq.Workplane("XY")
        .box(length, width, height, centered=(True, True, False))
        .edges("|Z")
        .fillet(radius)
    )


def fence(inner_l, inner_w, cx, cy):
    outer = (
        cq.Workplane("XY").center(cx, cy)
        .box(inner_l + 2 * FENCE_T, inner_w + 2 * FENCE_T, FENCE_H,
             centered=(True, True, False))
        .translate((0, 0, FLOOR))
    )
    inner = (
        cq.Workplane("XY").center(cx, cy)
        .box(inner_l, inner_w, FENCE_H + 1, centered=(True, True, False))
        .translate((0, 0, FLOOR))
    )
    return outer.cut(inner)


# ── Base ────────────────────────────────────────────────────────────────────
base = rounded_box(EXT_L, EXT_W, BASE_H, CORNER_R)
base = base.cut(
    rounded_box(INT_L, INT_W, INT_H + 1, CORNER_R - WALL).translate((0, 0, FLOOR))
)

# ESP32 bay — USB end open toward the wall (that fence side is removed)
esp_cx = ESP_X0 + FENCE_T + ESP_L / 2
esp = fence(ESP_L, ESP_W, esp_cx, 0)
usb_side_gap = (
    cq.Workplane("XY").center(ESP_X0 + FENCE_T / 2, 0)
    .box(FENCE_T + 0.2, ESP_W, FENCE_H + 1, centered=(True, True, False))
    .translate((0, 0, FLOOR))
)
base = base.union(esp.cut(usb_side_gap))

# Sensor bay
base = base.union(fence(SEN_L, SEN_W, SEN_X0 + FENCE_T + SEN_L / 2, 0))

# Corner screw posts + pilot holes
for (px, py) in POSTS:
    base = base.union(
        cq.Workplane("XY").center(px, py).circle(POST_D / 2).extrude(BASE_H)
    )
    base = base.cut(
        cq.Workplane("XY").center(px, py).circle(PILOT_D / 2)
        .extrude(PILOT_DEPTH).translate((0, 0, BASE_H - PILOT_DEPTH))
    )

# Magnet pockets through the outside bottom
for (mx, my) in MAGNETS:
    base = base.cut(
        cq.Workplane("XY").center(mx, my).circle(MAG_D / 2).extrude(MAG_H)
    )

# USB plug-through opening, left end wall
usb = (
    cq.Workplane("XY")
    .box(WALL + 6, USB_W, USB_H, centered=(True, True, False))
    .translate((-EXT_L / 2 + WALL / 2, 0, USB_Z0))
)
base = base.cut(usb)

# Two tube holes, right end wall
for sign in (-1, 1):
    base = base.cut(
        cq.Workplane("YZ").center(sign * TUBE_SPACING / 2, TUBE_Z)
        .circle(TUBE_D / 2).extrude(WALL + 2)
        .translate((INT_L / 2 - 1, 0, 0))
    )

# ── Lid ─────────────────────────────────────────────────────────────────────
lid = rounded_box(EXT_L, EXT_W, LID_T, CORNER_R)

skirt_outer = rounded_box(
    INT_L - 2 * SKIRT_CLR, INT_W - 2 * SKIRT_CLR, SKIRT_H, CORNER_R - WALL
)
skirt_inner = rounded_box(
    INT_L - 2 * (SKIRT_CLR + SKIRT_T), INT_W - 2 * (SKIRT_CLR + SKIRT_T),
    SKIRT_H + 1, max(CORNER_R - WALL - SKIRT_T, 1.0),
)
skirt = skirt_outer.cut(skirt_inner).translate((0, 0, -SKIRT_H))
for (px, py) in POSTS:
    skirt = skirt.cut(
        cq.Workplane("XY").center(px, py).circle(POST_D / 2 + 1.2)
        .extrude(SKIRT_H + 1).translate((0, 0, -SKIRT_H))
    )
lid = lid.union(skirt)

for (px, py) in POSTS:
    lid = lid.cut(
        cq.Workplane("XY").center(px, py).circle(SCREW_CLR_D / 2)
        .extrude(LID_T + SKIRT_H + 2).translate((0, 0, -SKIRT_H - 1))
    )
    lid = lid.cut(
        cq.Workplane("XY").center(px, py).circle(CBORE_D / 2)
        .extrude(CBORE_DEPTH + 0.01).translate((0, 0, LID_T - CBORE_DEPTH))
    )

# Glow window: pocket cut from the underside, leaving a thin diffusing
# membrane at the top surface (prints bridge-free with the lid face-down)
lid = lid.cut(
    cq.Workplane("XY").center(*GLOW_POS).circle(GLOW_D / 2)
    .extrude(LID_T - GLOW_MEMBRANE)
)

lid = lid.cut(
    cq.Workplane("XY").center(-31, 0)
    .text(TEXT, 6, -TEXT_DEPTH, font="DejaVu Sans", kind="bold")
    .translate((0, 0, LID_T))
)

# ── Export ──────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    import os

    out = os.path.dirname(os.path.abspath(__file__))
    cq.exporters.export(base, os.path.join(out, "base-usb.stl"))
    cq.exporters.export(lid, os.path.join(out, "lid-usb.stl"))

    assy = cq.Assembly()
    assy.add(base, name="base")
    assy.add(lid.translate((0, 0, BASE_H + SKIRT_H + 8)), name="lid")
    assy.export(os.path.join(out, "enclosure-usb.step"))

    print(f"exterior: {EXT_L:.1f} x {EXT_W:.1f} x {BASE_H + LID_T:.1f} mm")
    print("wrote base-usb.stl, lid-usb.stl, enclosure-usb.step")
