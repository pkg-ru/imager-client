# Imager Client - PHP

**RU** / [EN](./PHP-EN.md) / [Общие сведения](../README.md)

```bash
php composer.phar require pkg-ru/imager-client
```

### Пример

```php
<?php
use imagerClient\Imager;

// в $img - общие настройки
$img = new Imager;
$img->quality(75);

// в $group - настройки группы, они не переопределят настройки в $img
// главное не забывать клонировать экземпляр
$group = $imager->clone()->size(150, 150)->trim(true, 10);

echo $group->convert("my_path_image.png", "webp"), "\n";  // напечатает: my_path_image/DqcECgCWSwoAlg.webp
echo $group->convert("my_path_image2.jpg", "webp"), "\n"; // напечатает: my_path_image2/DqcBCgCWSwoAlg.webp
echo $group->convert("my_path_image3.gif", "webp"), "\n"; // напечатает: my_path_image3/DqcDCgCWSwoAlg.webp
echo $group->convert("my_path_image3.png", "gif"), "\n";  // напечатает: my_path_image3/DqcEAwCWSwoAlg.gif
```
