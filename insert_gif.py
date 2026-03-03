import re

readme_path = "README.md"
with open(readme_path, "r") as f:
    content = f.read()

gif_html = """
<p align="center">
  <img src=".github/gifs/extensions_demo.gif" alt="Extensions Demo Animation" width="600" style="border-radius: 12px; box-shadow: 0 4px 8px rgba(0,0,0,0.1);">
</p>
"""

new_content = content.replace("## ✨ Extensions\n", f"## ✨ Extensions\n{gif_html}\n")
with open(readme_path, "w") as f:
    f.write(new_content)
print("Successfully added GIF to README")
