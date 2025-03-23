# Imager Client - Python3

**RU** / [EN](./PY-EN.md) / [Общие сведения](../README.md)

```bash
pip install imager-client
```

### Пример

```py
from imager import Imager

# в img - общие настройки
img = Imager()
img.quality(75)

# в group - настройки группы, они не переопределят настройки в img
# главное не забывать клонировать экземпляр
group = img.clone().size(150, 150).trim(true, 10)

print(group.convert("my_path_image.png", "webp")) # напечатает: my_path_image/DqcECgCWSwoAlg.webp
print(group.convert("my_path_image2.jpg", "webp")) # напечатает: my_path_image2/DqcBCgCWSwoAlg.webp
print(group.convert("my_path_image3.gif", "webp")) # напечатает: my_path_image3/DqcDCgCWSwoAlg.webp
print(group.convert("my_path_image3.png", "gif")) # напечатает: my_path_image3/DqcEAwCWSwoAlg.gif
```
