"""Generate original flat-illustration interior scenes used as clearly-labeled demo photos.
Run: python3 scripts/generate-demo-art.py  (writes public/demo/*.svg)"""
import os

OUT = os.path.join(os.path.dirname(__file__), '..', 'public', 'demo')

SCENES = [
    # name, wall, floor, sky, accent(sofa/bed), rug, kind
    ('living-sunny', '#F1E4D3', '#C9A27E', '#BFD9EA', '#5E7B6A', '#D98E6B', 'sofa'),
    ('balcony-view', '#E8E1D6', '#B98D66', '#A9C8E2', '#33546B', '#E2C089', 'balcony'),
    ('highrise', '#E4E6E6', '#8E7A68', '#9EC3E6', '#2F3A46', '#B65B3A', 'tower'),
    ('garden-level', '#EFE6D8', '#A98462', '#CFE0C9', '#8A5A44', '#7D9A6B', 'plants'),
    ('walkup-bedroom', '#F3E9E1', '#C39A75', '#F2D9B8', '#7E6C9C', '#E7C5A5', 'bed'),
    ('doorman-kitchen', '#ECEAE5', '#9C8471', '#C5DAE8', '#3F5E58', '#D7B48A', 'kitchen'),
    ('loft-flex', '#E9DFD2', '#7F6450', '#D6E4EE', '#B4532A', '#3E4A4F', 'loft'),
    ('rowhouse', '#F0E2CF', '#B48A62', '#E6D3B5', '#556B5D', '#C77D5B', 'fireplace'),
]

def window(x, y, w, h, sky, extra=''):
    return f'''<rect x="{x}" y="{y}" width="{w}" height="{h}" fill="{sky}"/>{extra}
<rect x="{x}" y="{y}" width="{w}" height="{h}" fill="none" stroke="#FFFFFF" stroke-width="10"/>
<line x1="{x+w/2}" y1="{y}" x2="{x+w/2}" y2="{y+h}" stroke="#FFFFFF" stroke-width="7"/>
<line x1="{x}" y1="{y+h/2}" x2="{x+w}" y2="{y+h/2}" stroke="#FFFFFF" stroke-width="7"/>'''

def plant(x, y, s=1.0, pot='#B4532A'):
    return f'''<g transform="translate({x} {y}) scale({s})">
<ellipse cx="0" cy="-70" rx="28" ry="44" fill="#4F7A58"/><ellipse cx="-26" cy="-50" rx="20" ry="34" fill="#5F8E67" transform="rotate(-25 -26 -50)"/>
<ellipse cx="26" cy="-50" rx="20" ry="34" fill="#3F6A4A" transform="rotate(25 26 -50)"/>
<path d="M-24 -18 h48 l-7 40 h-34z" fill="{pot}"/></g>'''

def scene(name, wall, floor, sky, accent, rug, kind):
    parts = [f'<rect width="800" height="600" fill="{wall}"/>',
             f'<rect y="430" width="800" height="170" fill="{floor}"/>',
             f'<rect y="426" width="800" height="8" fill="#FFFFFF" opacity=".55"/>']
    if kind == 'tower':
        city = ''.join(f'<rect x="{110+i*48}" y="{150+(i*37)%90}" width="36" height="{230-(i*37)%90}" fill="#7C93A8" opacity=".55"/>' for i in range(10))
        parts.append(window(80, 70, 640, 300, sky, city))
    elif kind == 'balcony':
        rail = ''.join(f'<line x1="{250+i*28}" y1="300" x2="{250+i*28}" y2="400" stroke="#2F3A46" stroke-width="4"/>' for i in range(11))
        parts.append(f'<rect x="230" y="60" width="320" height="370" fill="{sky}"/><rect x="230" y="296" width="320" height="8" fill="#2F3A46"/>{rail}<rect x="230" y="60" width="320" height="370" fill="none" stroke="#FFFFFF" stroke-width="12"/>')
    else:
        parts.append(window(470, 80, 220, 250, sky))
    parts.append(f'<ellipse cx="400" cy="520" rx="290" ry="50" fill="{rug}" opacity=".85"/>')
    if kind in ('sofa', 'balcony', 'tower', 'loft'):
        x = 120 if kind != 'balcony' else 70
        parts.append(f'''<rect x="{x}" y="330" width="300" height="110" rx="18" fill="{accent}"/>
<rect x="{x}" y="300" width="300" height="70" rx="18" fill="{accent}" opacity=".85"/>
<rect x="{x-18}" y="330" width="40" height="110" rx="14" fill="{accent}"/><rect x="{x+278}" y="330" width="40" height="110" rx="14" fill="{accent}"/>
<rect x="{x+30}" y="318" width="70" height="44" rx="10" fill="#F4E7D3"/>''')
        parts.append(f'<rect x="{x+90}" y="455" width="130" height="18" rx="4" fill="#5B463A"/>')
    if kind == 'bed':
        parts.append(f'''<rect x="130" y="250" width="22" height="200" fill="#6B5446"/>
<rect x="150" y="340" width="380" height="100" rx="12" fill="#FFFFFF"/><rect x="150" y="370" width="380" height="70" rx="12" fill="{accent}"/>
<rect x="165" y="320" width="90" height="40" rx="12" fill="#F4E7D3"/><rect x="265" y="320" width="90" height="40" rx="12" fill="#F4E7D3"/>
<rect x="560" y="370" width="70" height="70" rx="6" fill="#8A6B55"/><path d="M580 370 l15 -45 l15 45z" fill="#F2D9B8"/>''')
    if kind == 'kitchen':
        parts.append(f'''<rect x="60" y="300" width="380" height="140" fill="{accent}"/><rect x="50" y="290" width="400" height="16" fill="#E9E4DC"/>
<rect x="60" y="120" width="380" height="90" fill="{accent}" opacity=".9"/>
{''.join(f'<rect x="{80+i*95}" y="320" width="80" height="100" rx="4" fill="none" stroke="#FFFFFF" stroke-opacity=".35" stroke-width="3"/>' for i in range(4))}
<rect x="540" y="350" width="160" height="16" fill="#5B463A"/><rect x="560" y="366" width="10" height="70" fill="#5B463A"/><rect x="670" y="366" width="10" height="70" fill="#5B463A"/>
<circle cx="600" cy="330" r="16" fill="#D7B48A"/>''')
    if kind == 'plants':
        parts += [plant(130, 430, 1.4), plant(250, 430, 1.0, '#8A5A44'), plant(720, 430, 1.2, '#D98E6B')]
        parts.append(f'<rect x="330" y="350" width="120" height="90" rx="10" fill="{accent}"/><rect x="330" y="300" width="120" height="60" rx="10" fill="{accent}" opacity=".8"/>')
    if kind == 'loft':
        parts.append('<rect x="560" y="360" width="150" height="12" fill="#2F2A26"/><rect x="570" y="372" width="8" height="66" fill="#2F2A26"/><rect x="692" y="372" width="8" height="66" fill="#2F2A26"/><rect x="600" y="320" width="70" height="40" rx="3" fill="#3E4A4F"/>')
        parts.append('<path d="M0 60 L800 60" stroke="#6B5446" stroke-width="14"/><path d="M0 120 L800 120" stroke="#6B5446" stroke-width="6" opacity=".5"/>')
    if kind == 'fireplace':
        parts.append(f'''<rect x="90" y="250" width="260" height="180" fill="#E6D8C3"/><rect x="80" y="240" width="280" height="18" fill="#FFFFFF"/>
<rect x="150" y="320" width="140" height="110" fill="#3B302A"/><path d="M200 420 q20 -60 20 -20 q15 -35 25 20z" fill="#E59A4C"/>
<rect x="140" y="140" width="160" height="90" fill="{accent}"/><rect x="152" y="152" width="136" height="66" fill="#E6D3B5"/>''')
    if kind in ('sofa', 'tower', 'balcony', 'kitchen', 'bed'):
        parts.append(plant(740 if kind != 'balcony' else 640, 440, 0.9))
    if kind in ('sofa', 'tower'):
        parts.append(f'<rect x="170" y="140" width="110" height="130" fill="#FFFFFF"/><rect x="180" y="150" width="90" height="110" fill="{rug}" opacity=".7"/>')
    body = '\n'.join(parts)
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 600" width="800" height="600" role="img" aria-label="Illustration of an apartment interior (demo)">\n{body}\n</svg>\n'

os.makedirs(OUT, exist_ok=True)
for s in SCENES:
    with open(os.path.join(OUT, s[0] + '.svg'), 'w') as f:
        f.write(scene(*s))
print('wrote', len(SCENES), 'scenes')
