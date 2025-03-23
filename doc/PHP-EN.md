# Imager Client - PHP

[RU](./PHP-RU.md) / **EN** / [General Information](./README-EN.md)

```bash
php composer.phar require pkg-ru/imager-client
```

### Example

```php
<?php
use imagerClient\Imager;

// $img contains general settings
$img = new Imager;
$img->quality(75);

// $group contains group settings, they will not override the settings in $img
// just remember to clone the instance
$group = $imager->clone()->size(150, 150)->trim(true, 10);

echo $group->convert("my_path_image.png", "webp"), "\n";  // will print: my_path_image/DqcECgCWSwoAlg.webp
echo $group->convert("my_path_image2.jpg", "webp"), "\n"; // will print: my_path_image2/DqcBCgCWSwoAlg.webp
echo $group->convert("my_path_image3.gif", "webp"), "\n"; // will print: my_path_image3/DqcDCgCWSwoAlg.webp
echo $group->convert("my_path_image3.png", "gif"), "\n";  // will print: my_path_image3/DqcEAwCWSwoAlg.gif
```
