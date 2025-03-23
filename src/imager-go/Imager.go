package imagergo

import (
	"slices"
	"strings"
)

// инициализация
//
// thumb - настройки находятся в файле "setting.yaml" секция `thumb`
func Imager(thumb ...string) *ImagerStruct {
	res := &ImagerStruct{
		loop: true,
	}
	if len(thumb) >= 1 {
		res.Thumb(thumb[0])
	}
	return res
}

// Клонируем, чтобы не вносить изменения в общий экземпляр
func (i *ImagerStruct) Clone() *ImagerStruct {
	s := *i
	return &(s)
}

// Клонируем, чтобы не вносить изменения в общий экземпляр
func (i *ImagerStruct) Copy() *ImagerStruct {
	return i.Clone()
}

// задаем ширину и высоту
// если один из размеров 0 - картинка масштабируется пропорционально по указанному размеру
func (i *ImagerStruct) Size(width, height uint16) (this *ImagerStruct) {
	i.Width(width)
	i.Height(height)
	return i
}

// ширина
func (i *ImagerStruct) Width(width uint16) (this *ImagerStruct) {
	i.width = width
	return i
}

// высота
func (i *ImagerStruct) Height(height uint16) (this *ImagerStruct) {
	i.height = height
	return i
}

// качество сжатия
func (i *ImagerStruct) Quality(quality uint8) (this *ImagerStruct) {
	i.quality = quality
	return i
}

// Crop
func (i *ImagerStruct) Crop(crop bool) (this *ImagerStruct) {
	i.crop = crop
	return i
}

// цвет фона (при конвертации картинок с прозрачностью в формат без прозрачности)
func (i *ImagerStruct) Color(r, g, b uint8) (this *ImagerStruct) {
	i.color = [3]uint8{r, g, b}
	i._color = true
	return i
}

// повтор анимации
func (i *ImagerStruct) Loop(loop bool) (this *ImagerStruct) {
	i.loop = loop
	return i
}

// подключение настроек обработки картинок на сервере
//
// настройки находятся в файле "setting.yaml" секция `thumb`
func (i *ImagerStruct) Thumb(thumb string) (this *ImagerStruct) {
	i.thumb = thumb
	return i
}

// обрезать поля картинки по прозрачным пикселям, или по указанным цветам
//
// active - активность фильтра
//
// rate - погрешность при сравнении цветов
//
// colors - список цветов
func (i *ImagerStruct) Trim(active bool, rate uint8, colors [][3]uint8) (this *ImagerStruct) {
	i.TrimActive(active)
	i.TrimRate(rate)
	i.TrimColors(colors)
	return i
}

// активность фильтра: обрезать поля картинки по прозрачным пикселям, или по указанным цветам
func (i *ImagerStruct) TrimActive(active bool) (this *ImagerStruct) {
	i.trimActive = active
	return i
}

// погрешность при сравнении цветов: обрезать поля картинки по прозрачным пикселям, или по указанным цветам
func (i *ImagerStruct) TrimRate(rate uint8) (this *ImagerStruct) {
	// i.trimActive = rate > 0
	i.trimRate = rate
	return i
}

// список цветов: обрезать поля картинки по прозрачным пикселям, или по указанным цветам
func (i *ImagerStruct) TrimColors(colors [][3]uint8) (this *ImagerStruct) {
	// i.trimActive = len(colors) > 0
	i.trimColor = colors
	return i
}

// получаем ссылку без изменения формата картинки
func (i *ImagerStruct) Get(file string) string {
	return i.Convert(file, "")
}

// получаем ссылку с конвертацией в новый формат
func (i *ImagerStruct) Convert(file, format string) string {
	lastIndex := strings.LastIndex(file, ".")
	i.format = file[lastIndex+1:]
	if !slices.Contains(FormatsList(), strings.ToLower(i.format)) {
		return file
	}

	if format == "" {
		format = strings.ToLower(i.format)
	}

	nf, is := GetFormat(format)
	if is {
		i.formatTo = nf
		if i.format == format {
			// если запрашиваемый формат совпадает с текущим то не пишем в данные
			i.format = ""
		}
	} else {
		return file
	}

	if i.format != "" && i.format == strings.ToLower(i.format) {
		//если формат файла в нижнем регистре, пишем в данные только 1 байт
		nf, is := GetFormat(i.format)
		if is {
			i.formatFrom = nf
			i.format = ""
		}
	}

	if !i.trimActive {
		i.trimColor = nil
		i.trimRate = 0
	}

	code := encode(i)
	if code == "" {
		return file
	}

	return file[0:lastIndex] + "/" + code + "." + format
}
