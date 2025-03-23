# Imager Client - Golang

[RU](./GO-RU.md) / **EN** / [General Information](./README-EN.md)

```bash
go get github.com/pkg-ru/imager-client
```

### Example

```go
package main

import (
	"fmt"
	"github.com/pkg-ru/imager-client"
)

func main() {
    // in img - general settings
	img := imager.Imager().Quality(75);

    // in group - group settings, they will not override settings in img
    // just remember to clone the instance
    group := img.Clone().Size(150, 150).Trim(true, 10, nil)

	fmt.Println(group.Convert("my_path_image.png", "webp"))  // will print: my_path_image/DqcECgCWSwoAlg.webp
	fmt.Println(group.Convert("my_path_image2.jpg", "webp")) // will print: my_path_image2/DqcBCgCWSwoAlg.webp
	fmt.Println(group.Convert("my_path_image3.gif", "webp")) // will print: my_path_image3/DqcDCgCWSwoAlg.webp
	fmt.Println(group.Convert("my_path_image3.png", "gif"))  // will print: my_path_image3/DqcEAwCWSwoAlg.gif
}
```
