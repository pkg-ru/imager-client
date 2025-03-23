<?php

namespace imagerClient;

abstract class ImagerFormat
{
	protected const FORMAT_JPG   = 1;
	protected const FORMAT_JPEG  = 2;
	protected const FORMAT_GIF   = 3;
	protected const FORMAT_PNG   = 4;
	protected const FORMAT_APNG  = 5;
	protected const FORMAT_JPE   = 6;
	protected const FORMAT_JIF   = 7;
	protected const FORMAT_JFIF  = 8;
	protected const FORMAT_JFI   = 9;
	protected const FORMAT_WEBP  = 10;
	protected const FORMAT_AVIF  = 11;
	protected const FORMAT_HEIF  = 12;
	protected const FORMAT_HEIC  = 13;

	public const FormatList = [
		self::FORMAT_JPG   => "jpg",
		self::FORMAT_JPEG  => "jpeg",
		self::FORMAT_GIF   => "gif",
		self::FORMAT_PNG   => "png",
		self::FORMAT_APNG  => "apng",
		self::FORMAT_JPE   => "jpe",
		self::FORMAT_JIF   => "jif",
		self::FORMAT_JFIF  => "jfif",
		self::FORMAT_JFI   => "jfi",
		self::FORMAT_WEBP  => "webp",
		self::FORMAT_AVIF  => "avif",
		self::FORMAT_HEIF  => "heif",
		self::FORMAT_HEIC  => "heic",
	];

	public function getFormat(string $format)
	{
		return array_search(strtolower($format), self::FormatList, true);
	}
}
