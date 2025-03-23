# Imager Client - Python3

[RU](./PY-RU.md) / **EN** / [General Information](./README-EN.md)

```bash
pip install imager_client
```

### Example

```py
from imager_client import Imager

# in img - general settings
img = Imager()
img.quality(75)

# in group - group settings, they won't override the settings in img
# just remember to clone the instance
group = img.clone().size(150, 150).trim(True, 10)

print(group.convert("my_path_image.png", "webp")) # prints: my_path_image/DqcECgCWSwoAlg.webp
print(group.convert("my_path_image2.jpg", "webp")) # prints: my_path_image2/DqcBCgCWSwoAlg.webp
print(group.convert("my_path_image3.gif", "webp")) # prints: my_path_image3/DqcDCgCWSwoAlg.webp
print(group.convert("my_path_image3.png", "gif")) # prints: my_path_image3/DqcEAwCWSwoAlg.gif
```
