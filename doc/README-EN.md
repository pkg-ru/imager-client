# Imager Client

A component for generating thumbnail image links in the **Imager** microservice.

> To use this, you need to set up and run the [Imager microservice](https://github.com/pkg-ru/imager).

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

## Build

```bash
docker exec -it imager-client bash -c "go run test/*.go && npm run build && python3 -m build"
```

## Documentation: [RU](../README.md) / **EN**

- [Golang](./GO-EN.md)
- [PHP](./PHP-EN.md)
- [JavaScript (TS)](./TS-EN.md)
- [Python3](./PY-EN.md)

---

### General Information

<details><summary>Component Initialization

`Imager` (_thumb_)</summary>

> ##### _thumb_ - the name of the server settings (default: `default`).
>
> You can pass an array of settings, except in the Go implementation.

</details>

<details><summary>Image Processing Settings on the Server

`thumb` (_thumb_)</summary>

> ##### _thumb_ - the name of the server settings (default: `default`).

</details>

<details><summary>Image Width

`width` (_width_)</summary>

> ##### _width_ - the width.
>
> If set to `0`, the width remains unchanged and retains its proportions relative to the height.

</details>

<details><summary>Image Height

`height` (_height_)</summary>

> ##### _height_ - the height.
>
> If set to `0`, the height remains unchanged and retains its proportions relative to the width.

</details>

<details><summary>Setting Image Width and Height

`size` (_width_, _height_)</summary>

> ##### _width_ - the width.
>
> If set to `0`, the width remains unchanged and retains its proportions relative to the height.

> ##### _height_ - the height.
>
> If set to `0`, the height remains unchanged and retains its proportions relative to the width.

</details>

<details><summary>Crop Image to Fit Size

`crop` (_crop_)</summary>

> ##### _crop_ - crop the image (default: `false`).
>
> - If `true`, when setting width and height, this parameter scales and crops the image to the specified size.
> - If `false`, when setting width and height, this parameter scales the image to fit within the specified size.  
>   Any extra space created during scaling will be filled with the specified color or remain transparent (if possible).

</details>

<details><summary>Animation Loop

`loop` (_loop_)</summary>

> ##### _loop_ - animation loop (default: `true`).
>
> - If `true`, the animation loops indefinitely.
> - If `false`, the animation plays only once.

</details>

<details><summary>Background Fill Color

`color` (_r_, _g_, _b_)</summary>

> ##### _r_ - Red.
>
> ##### _g_ - Green.
>
> ##### _b_ - Blue.
>
> Sets the background fill color in RGB format.

</details>

<details><summary>Trim Image Edges

`trim` (_active_, _rate_, _colors_)</summary>

> ##### _active_ - filter activation.
>
> ##### _rate_ - color comparison sensitivity (lower values result in more precise matching).
>
> ##### _colors_ - list of colors in RGB format: `[[255, 255, 255], [0, 0, 0]]`.
>
> This filter trims the image based on transparent pixels, black/white, or any other specified edge colors (top/bottom/left/right).

</details>

<details><summary>Enable Edge Trimming

`trimActive` (_active_)</summary>

> ##### _active_ - edge trimming activation.
>
> - If `true`, trimming is enabled.
> - If `false`, trimming is disabled.

</details>

<details><summary>Color Matching Sensitivity for Edge Trimming

`trimRate` (_rate_)</summary>

> ##### _rate_ - color matching sensitivity.
>
> The lower the value, the more precise the color matching.

</details>

<details><summary>Colors to Trim from the Edges

`trimColors` (_colors_)</summary>

> ##### _colors_ - list of colors.
>
> The list is in RGB format: `[[255, 255, 255], [0, 0, 0]]`.

</details>

<details><summary>Image Quality

`quality` (_quality_)</summary>

> ##### _quality_ - output quality.
>
> Lower values result in lower quality and smaller file sizes (not applicable to gif/png output files).

</details>

<details><summary>Settings (except for Go)

`setting` (_setting_)</summary>

> ##### _setting_ - list/array of settings (except for Go).
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
> # background color
> 'color': [255, 255, 255],
> # edge trimming
> 'trimActive': true,
> # color matching sensitivity for edge trimming
> 'trimRate': 20,
> # list of colors for edge trimming
> 'trimColor': [[255, 255, 255], [0, 0, 0]],
> }
> ```

</details>

<details><summary>Copying to Prevent Changes in the Shared Instance

`copy` () / `clone` ()</summary>

> Can be used to group assets by type/settings.

</details>

<details><summary>Generating a Link Without Changing the Image Format

`get` (_file_, _setting_)</summary>

> ##### _file_ - path to the original file (relative to web).
>
> ##### _setting_ - list/array of settings (except for Go).
>
> Generates a link to the image asset based on the specified parameters, without changing the file extension.

</details>

<details><summary>Generating a Link with Format Conversion

`convert` (_file_, _format_, _setting_)</summary>

> ##### _file_ - path to the original file (relative to web).
>
> ##### _format_ - output file format.
>
> ##### _setting_ - list/array of settings (except for Go).
>
> Generates a link to the image asset based on the specified parameters and converts it to the specified output format.

</details>
