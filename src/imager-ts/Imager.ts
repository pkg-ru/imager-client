import { ImagerData, ImagerDataInterface } from "./ImagerData";
import { ImagerFormat } from "./ImagerFormat";
import { ImagerEncode } from "./ImagerEncode";


/**
 * Imager
 * 
 * Горячее создание миниатюр для картинок
 * 
 * @see https://github.com/pkg-ru/imager
 */
export class Imager {
    private _: ImagerDataInterface;


    /**
     * Инициализация настроек
     *
     * @param {ImagerDataInterface} thumb
     */
    constructor(thumb?: ImagerDataInterface | string) {
        this._ = ImagerData();
        if (thumb) {
            if (typeof thumb == 'object') {
                this.setting(thumb as ImagerDataInterface)
            } else {
                this._.thumb = thumb;
            }
        }
    }

    /**
     * Настройки
     *
     * @param {ImagerDataInterface} setting
     *
     * @returns {this}
     */
    public setting(setting: ImagerDataInterface): this {
        for (var k in setting) {
            (this._ as any)[k] = (setting as any)[k];
        }
        return this;
    }


    /**
     * Клонируем, чтобы не вносить изменения в общий экземпляр
     *
     * @returns {Imager}
     */
    public clone(): Imager {
        return new Imager(this._);
    }

    /**
     * Клонируем, чтобы не вносить изменения в общий экземпляр (псевдоним)
     *
     * @returns {Imager}
     */
    public copy(): Imager {
        return this.clone();
    }


    /**
     * Изменяем размер
     *
     * @param {number} width
     * @param {number} height
     *
     * @returns {this}
     */
    public size(width: number, height: number): this {
        this.width(width);
        this.height(height);
        return this;
    }


    /**
     * Ширина
     *
     * @param {number} width
     *
     * @returns {this}
     */
    public width(width: number): this {
        this._.width = width;
        return this;
    }

    /**
     * Высота
     *
     * @param {number} height
     *
     * @returns {this}
     */
    public height(height: number): this {
        this._.height = height;
        return this;
    }

    /**
     * Качество
     *
     * @param {number} quality
     *
     * @returns {this}
     */
    public quality(quality: number): this {
        this._.quality = quality;
        return this;
    }


    /**
     * Кроп
     *
     * @param {boolean} crop
     *
     * @returns {this}
     */
    public crop(crop: boolean): this {
        this._.crop = crop;
        return this;
    }


    /**
     * Цвет фона
     *
     * @param {number} r
     * @param {number} g
     * @param {number} b
     *
     * @returns {this}
     */
    public color(r: number, g: number, b: number): this {
        this._.color = [r, g, b];
        return this;
    }


    /**
     * Зацикливание анимации
     *
     * @param {boolean} loop false - проиграть 1 раз, true - зациклить (по умолчанию)
     *
     * @returns {this}
     */
    public loop(loop: boolean): this {
        this._.loop = loop;
        return this;
    }


    /**
     * Шаблон настроек на сервере Imager
     *
     * @param {string} thumb
     *
     * @returns {this}
     */
    public thumb(thumb: string): this {
        this._.thumb = thumb;
        return this;
    }


    /**
     * Обрезать по краям прозрачные пиксели/рамку/и т.д.
     *
     * @param {boolean} active
     * @param {number} rate степень сравнения цветов
     * @param {number[][]} color список цветов rgb
     * ```
     * color = [[255,255,255], [200,200,200]];
     * ```
     *
     * @returns {this}
     */
    public trim(active: boolean, rate: number, color: number[][] = []): this {
        this.trimActive(active);
        this.trimRate(rate);
        this.trimColors(color);
        return this;
    }


    /**
     * активность фильтра: Обрезать по краям прозрачные пиксели/рамку/и т.д.
     *
     * @param {boolean} active
     *
     * @returns {this}
     */
    public trimActive(active: boolean): this {
        this._.trimActive = active;
        return this;
    }


    /**
     * погрешность при сравнении цветов: Обрезать по краям прозрачные пиксели/рамку/и т.д.
     *
     * @param {number} rate степень сравнения цветов
     *
     * @returns {this}
     */
    public trimRate(rate: number): this {
        this._.trimRate = rate;
        return this;
    }

    /**
     * список цветов: Обрезать по краям прозрачные пиксели/рамку/и т.д.
     *
     * @param {number[][]} color список цветов rgb
     * ```
     * color = [[255,255,255], [200,200,200]];
     * ```
     *
     * @returns {this}
     */
    public trimColors(color: number[][]): this {
        if (color && color.length > 0) {
            var newColors: number[][] = [];
            for (var i = 0; color.length > i; ++i) {
                if (color[i] && color[i].length == 3) {
                    newColors.push(color[i]);
                } else {
                    break;
                }
            }
            this._.trimColor = newColors;
        }
        return this;
    }

    /**
     * Получаем ассет на миниатюру в указаном формате
     *
     * @param {string} file
     * @param {string} format
     * @param {ImagerDataInterface|null} setting 
     * 
     * @returns {string}
     */

    public convert(file: string, format: string, setting: ImagerDataInterface | null = null): string {
        var instance: ImagerDataInterface
        if (setting) {
            instance = this.clone().setting(setting)._
        } else {
            instance = this._
        }

        var file_arr = file.split('.');
        var lastIndex = file_arr.length - 1;
        instance.format = file_arr[lastIndex];
        if (ImagerFormat(instance.format) === false) {
            return file;
        }

        if (format == "") {
            format = instance.format.toLowerCase();
        }

        var nf = ImagerFormat(format);
        if (nf === false) {
            return file;
        }

        instance.formatTo = nf;
        if (instance.format == format) {
            // если запрашиваемый формат совпадает с текущим то не пишем в данные
            instance.format = "";
        }

        if (instance.format != "" && instance.format == instance.format.toLowerCase()) {
            //если формат файла в нижнем регистре, пишем в данные только 1 байт
            nf = ImagerFormat(instance.format);
            if (nf !== false) {
                instance.formatFrom = nf;
                instance.format = "";
            }
        }

        if (!instance.trimActive) {
            instance.trimColor = [];
            instance.trimRate = 0;
        }

        var code = ImagerEncode(instance);
        if (!code || code == "") {
            return file;
        }

        file_arr.splice(lastIndex, 1);
        return file_arr.join('.') + "/" + code + "." + format;
    }


    /**
     * Получаем ассет на миниатюру в формате исходного файла
     *
     * @param {string} file
     * @param {ImagerDataInterface|null} setting
     *
     * @returns {string}
     */
    public get(file: string, setting: ImagerDataInterface | null = null): string {
        return this.convert(file, "", setting);
    }
}

export default Imager
