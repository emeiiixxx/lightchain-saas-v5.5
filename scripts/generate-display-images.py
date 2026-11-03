"""Build small display-only WebP variants; originals remain available for export/editing.
Run with Python + Pillow after adding tracked demo photographs.
"""
import hashlib
import json
import subprocess
from pathlib import Path
from PIL import Image, ImageOps

root = Path(__file__).resolve().parents[1]
out = root / 'public/assets/display'
out.mkdir(exist_ok=True)
manifest = {}
keep = set()
files = subprocess.check_output(['git', 'ls-files', '-z', 'public/assets'], cwd=root).decode().split('\0')
for name in files:
    path = root / name
    if not path.is_file() or '/display/' in name or path.suffix.lower() not in ('.png', '.jpg', '.jpeg', '.webp'):
        continue
    if path.stat().st_size < 100_000:
        continue
    key = '/' + name.removeprefix('public/')
    digest = hashlib.sha256(path.read_bytes()).hexdigest()[:16]
    variants = []
    with Image.open(path) as source:
        original = ImageOps.exif_transpose(source).convert('RGBA')
        for size in (240, 960):
            image = original.copy()
            image.thumbnail((size, size), Image.Resampling.LANCZOS)
            filename = f'{digest}-{size}.webp'
            destination = out / filename
            if not destination.exists():
                image.save(destination, 'WEBP', quality=85, method=6)
            keep.add(filename)
            variants.append({'src': '/assets/display/' + filename, 'width': image.width})
    manifest[key] = variants
# Small chrome artwork should never request a multi-megabyte photograph.
for name, size in (('imgImageFill', 96), ('img', 60)):
    with Image.open(root / f'public/assets/{name}.png') as source:
        image = ImageOps.exif_transpose(source).convert('RGBA')
        image.thumbnail((size, size), Image.Resampling.LANCZOS)
        filename = name + '.webp'
        image.save(out / filename, 'WEBP', quality=90, method=6)
        keep.add(filename)
for path in out.glob('*.webp'):
    if path.name not in keep:
        path.unlink()
(root / 'src/display-images.json').write_text(json.dumps(manifest, ensure_ascii=False, separators=(',', ':')) + '\n')
print(f'{len(manifest)} source images, {len(keep)} display files, {sum(p.stat().st_size for p in out.glob("*.webp")) / 1024 / 1024:.2f} MiB')
