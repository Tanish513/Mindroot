import re
import urllib.request

with open('growmore_page.html', encoding='utf-8') as f:
    html = f.read()

imgs = re.findall(r'<img[^>]+src=["\']([^"\']+\.(?:jpg|jpeg|png|webp))["\']', html, re.I)
print(f"Found {len(imgs)} images:")
for img in imgs:
    print(img)

# Try downloading campus / building photo
for img_url in imgs:
    if 'campus' in img_url.lower() or 'banner' in img_url.lower() or 'slider' in img_url.lower() or 'bca' in img_url.lower() or 'about' in img_url.lower() or 'college' in img_url.lower():
        full_url = img_url if img_url.startswith('http') else f"https://growmore.ac.in/{img_url.lstrip('/')}"
        print(f"Trying {full_url}")
        try:
            req = urllib.request.Request(full_url, headers={'User-Agent': 'Mozilla/5.0'})
            with urllib.request.urlopen(req, timeout=8) as r:
                data = r.read()
                if len(data) > 5000:
                    with open('growmore_building.jpg', 'wb') as out_f:
                        out_f.write(data)
                    print(f"Successfully saved growmore_building.jpg from {full_url} ({len(data)} bytes)")
                    break
        except Exception as e:
            print(f"Failed: {e}")
