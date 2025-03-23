# [Imager](https://github.com/pkg-ru/imager) Client

A component for generating links to compressed image thumbnails in the **Imager** microservice.

> To use it, you need to set up and run the [Imager microservice](https://github.com/pkg-ru/imager).

## Documentation: [RU](../README-RU.md) / **EN**

- [Golang](./GO-EN.md)
- [PHP](./PHP-EN.md)
- [JavaScript (TS)](./TS-EN.md)
- [Python3](./PY-EN.md)

---

### General Information

<details><summary>Component Initialization

**Imager**(_thumb_)</summary>

> ##### _thumb_ - the name of the settings on the server (default: `default`).
>
> You can pass an array of settings, except for the Go implementation.

</details>

<details><summary>Image Processing Settings on the Server

**thumb**(_thumb_)</summary>

> ##### _thumb_ - the name of the settings on the server (default: `default`).

</details>

<details><summary>Image Width

**width**(_width_)</summary>

> ##### _width_ - width.
>
> If you pass `0`, the width remains unchanged and keeps its proportions relative to the height.

</details>

<details><summary>Image Height

**height**(_height_)</summary>

> ##### _height_ - height.
>
> If you pass `0`, the height remains unchanged and keeps its proportions relative to the width.

</details>

<details><summary>Setting Image Width and Height

**size**(_width_, _height_)</summary>

> ##### _width_ - width.
>
> If you pass `0`, the width remains unchanged and keeps its proportions relative to the height.

> ##### _height_ - height.
>
> If you pass `0`, the height remains unchanged and keeps its proportions relative to the width.

</details>

<details><summary>Image Cropping to Size

**crop**(_crop_)</summary>

> ##### _crop_ - image cropping (default `false`).
>
> If `true` — when setting width and height, this parameter scales and crops the image to the specified size.  
> If `false` — when setting width and height, the parameter scales the image to the specified size.  
> The fields that result from scaling are filled with the specified color or remain transparent (if possible).

</details>

<details><summary>Animation Loop

**loop**(_loop_)</summary>

> ##### _loop_ - animation loop (default `true`).
>
> If `true` — the animation loops.  
> If `false` — the animation plays once.

</details>

<details><summary>Background Color Fill

**color**(_r_, _g_, _b_)</summary>

> ##### _r_ - Red.
>
> ##### _g_ - Green.
>
> ##### _b_ - Blue.
>
> Sets the background fill color in RGB format.

</details>

<details><summary>Image Edge Cropping

**trim**(_active_, _rate_, _colors_)</summary>

> ##### _active_ - filter activity.
>
> ##### _rate_ - color matching degree (the lower, the more precise the color).
>
> ##### _colors_ - list of colors in RGB format: `[[255, 255, 255], [0, 0, 0]]`.
>
> This filter allows cropping the image by transparent pixels, black/white, or any other colors located at the edges (top/bottom/left/right) of the image.

</details>

<details><summary>Edge Cropping Activity

**trimActive**(_active_)</summary>

> ##### _active_ - edge cropping filter activity.
>
> If `true` — crop.  
> If `false` — do not crop.

</details>

<details><summary>Color Matching Degree for Edge Cropping

**trimRate**(_rate_)</summary>

> ##### _rate_ - color matching degree.
>
> The lower this value, the more accurately the color is matched.

</details>

<details><summary>Colors to Be Cropped from the Edges

**trimColors**(_colors_)</summary>

> ##### _colors_ - list of colors.
>
> A list in RGB format: `[[255, 255, 255], [0, 0, 0]]`.

</details>

<details><summary>Preview Image Quality

**quality**(_quality_)</summary>

> ##### _quality_ - output quality.
>
> The lower the value, the worse the quality and the smaller the file size (not for output files: gif/png).

</details>

<details><summary>Settings (except Go)

**setting**(_setting_)</summary>

> ##### _setting_ - list/array of settings (except Go).
>
> Example:
>
> ```js
> {
> # width
> 'width': 100,
> # height
> 'height': 100,
> # quality
> 'quality': 85,
> # crop to size
> 'crop': false,
> # animation loop
> 'loop': true,
> # fill color
> 'color': [255, 255, 255],
> # edge cropping
> 'trimActive': true,
> # color matching degree for edge cropping
> 'trimRate': 20,
> # list of colors for edge cropping
> 'trimColor': [[255, 255, 255], [0, 0, 0]],
> }
> ```

</details>

<details><summary>Copying to Avoid Modifying the Shared Instance

**copy**() / **clone**()</summary>

> Can be used for grouping by asset types/settings.

</details>

<details><summary>Getting a Link Without Changing the Image Format

**get**(_file_, _setting_)</summary>

> ##### _file_ - path to the original file (relative to web).
>
> ##### _setting_ - list/array of settings (except Go).
>
> Generates a link to the image asset with the specified parameters, without changing the file extension.

</details>

<details><summary>Getting a Link with Conversion to Another Format

**convert**(_file_, _format_, _setting_)</summary>

> ##### _file_ - path to the original file (relative to web).
>
> ##### _format_ - output file format.
>
> ##### _setting_ - list/array of settings (except Go).
>
> Generates a link to the image asset with the specified parameters and the set output file extension.

</details>

---

## Cloning the Repository

```bash
git clone https://github.com/pkg-ru/imager-client.git && cd imager-client
```

## Setting Up the Development Container

```bash
docker compose build && docker compose start
```

## Running Tests

```bash
docker exec -it imager-client bash -c "go run test/*.go"
```

## Building

```bash
docker exec -it imager-client bash -c "go run test/*.go && npm run build && python3 -m build"
```
