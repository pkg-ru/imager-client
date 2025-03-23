<?php

namespace imagerClient;

trait ImagerData
{
	public $trimColor;
	public $format;
	public $thumb;
	public $color;
	public $width;
	public $height;
	public $formatTo;
	public $formatFrom;
	public $quality;
	public $trimRate;
	public $loop = true;
	public $trimActive;
	public $crop;

	public $Flags = [
		"width"           => 1 << 0,
		"height"          => 1 << 1,
		"quality"         => 1 << 2,
		"format"          => 1 << 3,
		"color"           => 1 << 4,
		"loop"            => 1 << 5,
		"thumb"           => 1 << 6,
		"trimActive"      => 1 << 7,
		"trimColor"       => 1 << 8,
		"trimRate"        => 1 << 9,
		"formatTo"        => 1 << 10,
		"formatFrom"      => 1 << 11,
		"crop"            => 1 << 12,
	];

	private $_flagsSorted;

	/**
	 * Отсортированные ключи
	 *
	 * @return string[]
	 */
	public function flagsSorted(): array
	{
		if (!$this->_flagsSorted) {
			$this->_flagsSorted = array_keys($this->Flags);
			sort($this->_flagsSorted);
		}
		return $this->_flagsSorted;
	}
}
