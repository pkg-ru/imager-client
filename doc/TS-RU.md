# Imager Client - JavaScript (TS)

**RU** / [EN](./TS-EN.md) / [Общие сведения](../README.md)

```bash
npm i imager-client
```

### Пример

```js
import { Imager } from "imager-client";

// в img - общие настройки
var img = new Imager();
img.quality(75);

// в group - настройки группы, они не переопределят настройки в img
// главное не забывать клонировать экземпляр
var group = img.clone().size(150, 150).trim(true, 10);

console.log(group.convert("my_path_image.png", "webp")); // напечатает: my_path_image/DqcECgCWSwoAlg.webp
console.log(group.convert("my_path_image2.jpg", "webp")); // напечатает: my_path_image2/DqcBCgCWSwoAlg.webp
console.log(group.convert("my_path_image3.gif", "webp")); // напечатает: my_path_image3/DqcDCgCWSwoAlg.webp
console.log(group.convert("my_path_image3.png", "gif")); // напечатает: my_path_image3/DqcEAwCWSwoAlg.gif
```
