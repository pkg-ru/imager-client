package imager

import (
	imagergo "github.com/pkg-ru/imager-client/src/imager-go"
)

// инициализация
//
// thumb - настройки находятся в файле "setting.yaml" секция `thumb`
func Imager(thumb ...string) *imagergo.ImagerStruct {
	return imagergo.Imager(thumb...)
}
