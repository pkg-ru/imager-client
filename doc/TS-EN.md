# Imager Client - JavaScript (TS)

[RU](./TS-RU.md) / **EN** / [General Information](./README-EN.md)

```bash
npm i @pkg-ru/imager-client
```

### Example

```js
import { Imager } from "imager-client";

// in img - general settings
var img = new Imager();
img.quality(75);

// in group - group settings, they will not override settings in img
// just remember to clone the instance
var group = img.clone().size(150, 150).trim(true, 10);

console.log(group.convert("my_path_image.png", "webp")); // will print: my_path_image/DqcECgCWSwoAlg.webp
console.log(group.convert("my_path_image2.jpg", "webp")); // will print: my_path_image2/DqcBCgCWSwoAlg.webp
console.log(group.convert("my_path_image3.gif", "webp")); // will print: my_path_image3/DqcDCgCWSwoAlg.webp
console.log(group.convert("my_path_image3.png", "gif")); // will print: my_path_image3/DqcEAwCWSwoAlg.gif
```
