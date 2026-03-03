import os
import glob
try:
    from PIL import Image
    png_files = sorted(glob.glob(".github/screenshots/*_screenshot.png"))
    if not png_files:
        print("No PNGs found")
        exit(1)
        
    images = []
    for f in png_files:
        img = Image.open(f)
        # Ensure uniform size for the GIF
        img = img.resize((400, 600))
        images.append(img)
        
    out_path = ".github/gifs/extensions_demo.gif"
    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    images[0].save(out_path, save_all=True, append_images=images[1:], optimize=False, duration=1500, loop=0)
    print(f"Successfully created GIF at {out_path}")
except ImportError:
    print("Pillow not installed, skipping GIF generation.")
except Exception as e:
    print(f"Error: {e}")
