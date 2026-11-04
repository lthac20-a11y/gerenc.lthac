import zlib
import struct
import math
import os

def create_png(width, height, get_pixel_func):
    raw_data = bytearray()
    for y in range(height):
        raw_data.append(0)  # filter type 0 (None)
        for x in range(width):
            r, g, b, a = get_pixel_func(x, y, width, height)
            raw_data.extend([int(r), int(g), int(b), int(a)])

    def chunk(tag, data):
        return struct.pack('>I', len(data)) + tag + data + struct.pack('>I', zlib.crc32(tag + data) & 0xffffffff)

    ihdr_data = struct.pack('>IIBBBBB', width, height, 8, 6, 0, 0, 0)
    idat_data = zlib.compress(bytes(raw_data), 9)

    png_data = b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', ihdr_data) + chunk(b'IDAT', idat_data) + chunk(b'IEND', b'')
    return png_data

def dist_to_segment(px, py, x1, y1, x2, y2):
    dx = x2 - x1
    dy = y2 - y1
    l2 = dx*dx + dy*dy
    if l2 == 0:
        return math.hypot(px - x1, py - y1)
    t = max(0.0, min(1.0, ((px - x1)*dx + (py - y1)*dy) / l2))
    proj_x = x1 + t * dx
    proj_y = y1 + t * dy
    return math.hypot(px - proj_x, py - proj_y)

def generate_icon(size, is_maskable=False):
    # Normalized ECG coordinates
    points_norm = [
        (0.12, 0.50),
        (0.28, 0.50),
        (0.36, 0.35),
        (0.44, 0.65),
        (0.53, 0.23),
        (0.62, 0.75),
        (0.70, 0.44),
        (0.76, 0.50),
        (0.88, 0.50),
    ]

    stroke_width = max(3.0, size * 0.055)
    half_stroke = stroke_width / 2.0
    corner_radius = size * 0.22

    pts = [(p[0] * size, p[1] * size) for p in points_norm]

    # Pre-calculate segments
    segments = []
    for i in range(len(pts) - 1):
        segments.append((pts[i][0], pts[i][1], pts[i+1][0], pts[i+1][1]))

    end_dot = pts[-1]

    def pixel_color(x, y, w, h):
        # Background determination
        # Dark base #0b0f19
        bg_r, bg_g, bg_b = 11, 15, 25

        if not is_maskable:
            # Check rounded rectangle
            dx = max(0.0, abs(x - w / 2.0) - (w / 2.0 - corner_radius))
            dy = max(0.0, abs(y - h / 2.0) - (h / 2.0 - corner_radius))
            corner_dist = math.hypot(dx, dy)
            if corner_dist > corner_radius:
                # Outside rounded corner
                aa = max(0.0, min(1.0, corner_radius + 1.0 - corner_dist))
                if aa <= 0.0:
                    return (0, 0, 0, 0)
                bg_a = aa
            else:
                bg_a = 1.0
        else:
            bg_a = 1.0

        # Subtle inner dark gradient
        factor = 1.0 - 0.25 * math.hypot((x - w/2) / w, (y - h/2) / h)
        cur_r = bg_r * factor
        cur_g = bg_g * factor
        cur_b = bg_b * factor

        # Compute distance to closest segment
        min_d = min(dist_to_segment(x, y, s[0], s[1], s[2], s[3]) for s in segments)
        dot_d = math.hypot(x - end_dot[0], y - end_dot[1])

        # Pulse color (emerald gradient from left to right: #34d399 -> #10b981)
        t_x = x / float(w)
        pulse_r = 52 * (1 - t_x) + 16 * t_x
        pulse_g = 211 * (1 - t_x) + 185 * t_x
        pulse_b = 153 * (1 - t_x) + 129 * t_x

        # Stroke AA
        stroke_alpha = 0.0
        if min_d <= half_stroke + 1.2:
            stroke_alpha = max(0.0, min(1.0, (half_stroke + 1.2 - min_d) / 1.5))
        
        # End dot
        dot_radius = half_stroke * 0.95
        if dot_d <= dot_radius + 1.2:
            d_alpha = max(0.0, min(1.0, (dot_radius + 1.2 - dot_d) / 1.5))
            stroke_alpha = max(stroke_alpha, d_alpha)

        # Glow
        glow_radius = half_stroke * 3.5
        glow_alpha = 0.0
        if min_d < glow_radius:
            glow_alpha = (1.0 - min_d / glow_radius) * 0.35

        # Blend glow into background
        cur_r = cur_r * (1.0 - glow_alpha) + pulse_r * glow_alpha
        cur_g = cur_g * (1.0 - glow_alpha) + pulse_g * glow_alpha
        cur_b = cur_b * (1.0 - glow_alpha) + pulse_b * glow_alpha

        # Blend stroke over background
        final_r = cur_r * (1.0 - stroke_alpha) + pulse_r * stroke_alpha
        final_g = cur_g * (1.0 - stroke_alpha) + pulse_g * stroke_alpha
        final_b = cur_b * (1.0 - stroke_alpha) + pulse_b * stroke_alpha
        final_a = 255 * bg_a

        return (min(255, max(0, int(final_r))),
                min(255, max(0, int(final_g))),
                min(255, max(0, int(final_b))),
                min(255, max(0, int(final_a))))

    return create_png(size, size, pixel_color)

os.makedirs('public', exist_ok=True)

print("Generating pwa-192x192.png...")
with open('public/pwa-192x192.png', 'wb') as f:
    f.write(generate_icon(192, is_maskable=False))

print("Generating apple-touch-icon.png...")
with open('public/apple-touch-icon.png', 'wb') as f:
    f.write(generate_icon(180, is_maskable=True)) # iOS Safari fills full canvas

print("Generating pwa-512x512.png...")
with open('public/pwa-512x512.png', 'wb') as f:
    f.write(generate_icon(512, is_maskable=False))

print("Generating pwa-maskable-512x512.png...")
with open('public/pwa-maskable-512x512.png', 'wb') as f:
    f.write(generate_icon(512, is_maskable=True))

print("Generating favicon.png...")
with open('public/favicon.png', 'wb') as f:
    f.write(generate_icon(64, is_maskable=False))

print("All icons successfully generated!")
