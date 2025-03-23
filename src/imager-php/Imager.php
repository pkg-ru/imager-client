<?php

namespace imagerClient;

/**
 * Imager
 * 
 * Горячее создание миниатюр для картинок
 * 
 * @see https://github.com/pkg-ru/imager
 */
class Imager
{
    /** @var ImagerEncode */
    private $instance;

    /**
     * Инициализация настроек
     *
     * @param string|array|object $config
     */
    public function __construct($thumb = "")
    {
        $this->instance = new ImagerEncode;
        if (is_string($thumb)) {
            $this->thumb($thumb);
        } else {
            $this->setting($thumb);
        }
    }

    /**
     * Настройки
     *
     * @param array|object $setting
     *
     * @return self
     */
    public function setting($setting): self
    {
        foreach ($setting as $key => $value) {
            if (property_exists($this->instance, $key)) {
                $this->instance->$key = $value;
            }
        }
        return $this;
    }

    /**
     * Клонируем, чтобы не вносить изменения в общий экземпляр
     *
     * @return self
     */
    public function clone(): self
    {
        $self = new self;
        $self->instance = clone $this->instance;
        return $self;
    }

    /**
     * Клонируем, чтобы не вносить изменения в общий экземпляр
     *
     * @return self
     */
    public function copy(): self
    {
        return $this->clone();
    }

    /**
     * Изменяем размер
     *
     * @param int $width
     * @param int $height
     *
     * @return self
     */
    public function size(int $width = 0, int $height = 0): self
    {
        $this->width($width);
        return $this->height($height);
    }

    /**
     * Ширина
     *
     * @param int $width
     *
     * @return self
     */
    public function width(int $width = 0): self
    {
        $this->instance->width = $width;
        return $this;
    }

    /**
     * Высота
     *
     * @param int $height
     *
     * @return self
     */
    public function height(int $height = 0): self
    {
        $this->instance->height = $height;
        return $this;
    }

    /**
     * Качество
     *
     * @param int $quality
     *
     * @return self
     */
    public function quality(int $quality): self
    {
        $this->instance->quality = $quality;
        return $this;
    }

    /**
     * Кроп
     *
     * @param bool $crop
     *
     * @return self
     */
    public function crop(bool $crop): self
    {
        $this->instance->crop = $crop;
        return $this;
    }

    /**
     * Цвет фона
     *
     * @param int $r
     * @param int $g
     * @param int $b
     *
     * @return self
     */
    public function color(int $r, int $g, int $b): self
    {
        $this->instance->color = [$r, $g, $b];
        return $this;
    }

    /**
     * Зацикливание анимации
     *
     * @param bool $loop false - проиграть 1 раз, true - зациклить (по умолчанию)
     *
     * @return self
     */
    public function loop(bool $loop): self
    {
        $this->instance->loop = $loop;
        return $this;
    }

    /**
     * Шаблон настроек на сервере Imager
     *
     * @param string $thumb
     *
     * @return self
     */
    public function thumb(string $thumb): self
    {
        $this->instance->thumb = $thumb;
        return $this;
    }

    /**
     * Обрезать по краям прозрачные пиксели/рамку/и т.д.
     *
     * @param bool $active
     * @param int $rate степень сравнения цветов
     * @param array $color список цветов rgb
     * ```
     * $color = [[255,255,255], [200,200,200]];
     * ```
     *
     * @return self
     */
    public function trim(bool $active, int $rate = 0, array $color = []): self
    {
        $this->trimActive($active);
        $this->trimRate($rate);
        return $this->trimColors($color);
    }

    /**
     * активность фильтра: Обрезать по краям прозрачные пиксели/рамку/и т.д.
     *
     * @param bool $active
     *
     * @return self
     */
    public function trimActive(bool $active): self
    {
        $this->instance->trimActive = $active;
        return $this;
    }

    /**
     * погрешность при сравнении цветов: Обрезать по краям прозрачные пиксели/рамку/и т.д.
     *
     * @param int $rate степень сравнения цветов
     *
     * @return self
     */
    public function trimRate(int $rate = 0): self
    {
        $this->instance->trimRate = $rate;
        return $this;
    }

    /**
     * список цветов: Обрезать по краям прозрачные пиксели/рамку/и т.д.
     *
     * @param array $color список цветов rgb
     * ```
     * $color = [[255,255,255], [200,200,200]];
     * ```
     *
     * @return self
     */
    public function trimColors(array $color): self
    {
        if ($color) {
            $newColors = [];
            foreach ($color as $item) {
                if (is_array($item) && count($item) == 3) {
                    $newColors[] = array_filter($item, 'is_numeric');
                } else {
                    break;
                }
            }
            if (!$newColors) {
                $newColors[] = array_filter($color, 'is_numeric');
            }
            $this->instance->trimColor = $newColors;
        }
        return $this;
    }

    /**
     * Получаем ассет на миниатюру в указаном формате
     *
     * @param string $file
     * @param string $format
     * @param array|object|null $setting
     *
     * @return string
     */
    public function convert(string $file, string $format = "", $setting = null): string
    {
        if ($setting) {
            $instance = $this->clone()->setting($setting)->instance;
        } else {
            $instance = $this->instance;
        }

        $file_arr = explode('.', $file);
        $lastIndex = count($file_arr) - 1;
        $instance->format = $file_arr[$lastIndex];
        if (!in_array(strtolower($instance->format), ImagerEncode::FormatList)) {
            return $file;
        }


        if ($format == "") {
            $format = strtolower($instance->format);
        }

        $nf = $instance->getFormat($format);
        if ($nf === false) {
            return $file;
        }

        $instance->formatTo = $nf;
        if ($instance->format == $format) {
            // если запрашиваемый формат совпадает с текущим то не пишем в данные
            $instance->format = "";
        }

        if ($instance->format != "" && $instance->format == strtolower($instance->format)) {
            //если формат файла в нижнем регистре, пишем в данные только 1 байт
            $nf = $instance->getFormat($instance->format);
            if ($nf !== false) {
                $instance->formatFrom = $nf;
                $instance->format = "";
            }
        }

        if (!$instance->trimActive) {
            $instance->trimColor = [];
            $instance->trimRate = 0;
        }

        $code = $instance->encode();
        if (!$code) {
            return $file;
        }

        unset($file_arr[$lastIndex]);
        return implode('.', $file_arr) . "/" . $code . "." . $format;
    }

    /**
     * Получаем ассет на миниатюру в формате исходного файла
     *
     * @param string $file
     * @param array|object|null $setting
     *
     * @return string
     */
    public function get(string $file, $setting = null): string
    {
        return $this->convert($file, "", $setting);
    }
}
