# Imager Client - Golang

**RU** / [EN](./GO-EN.md) / [Общие сведения](../README.md)

```bash
go get github.com/pkg-ru/imager-client
```

### Пример

```go
package main

import (
	"fmt"
	imager "github.com/pkg-ru/imager-client"
)

func main() {
    // в img - общие настройки
	img := imager.Imager().Quality(75);

    // в group - настройки группы, они не переопределят настройки в img
    // главное не забывать клонировать экземпляр
    group := img.Clone().Size(150, 150).Trim(true, 10, nil)

	fmt.Println(group.Convert("my_path_image.png", "webp"))  // напечатает: my_path_image/DqcECgCWSwoAlg.webp
	fmt.Println(group.Convert("my_path_image2.jpg", "webp")) // напечатает: my_path_image2/DqcBCgCWSwoAlg.webp
	fmt.Println(group.Convert("my_path_image3.gif", "webp")) // напечатает: my_path_image3/DqcDCgCWSwoAlg.webp
	fmt.Println(group.Convert("my_path_image3.png", "gif"))  // напечатает: my_path_image3/DqcEAwCWSwoAlg.gif
}
```
