"""Country silhouette from the included IBGE meshes; no sales data."""
import json
from pathlib import Path
from PIL import Image, ImageDraw

image = Image.new('RGBA', (820, 800))
draw = ImageDraw.Draw(image)
for file in Path('public/maps').glob('??.json'):
    for feature in json.loads(file.read_text(encoding='utf-8'))['features']:
        geometry = feature['geometry']
        polygons = [geometry['coordinates']] if geometry['type'] == 'Polygon' else geometry['coordinates']
        for polygon in polygons:
            draw.polygon([((x + 74) * 20, (6 - y) * 20) for x, y in polygon[0]], fill='white')
image.save('public/maps/brasil-context.png', optimize=True)
print(f"Fundo geográfico: {Path('public/maps/brasil-context.png').stat().st_size} bytes")
