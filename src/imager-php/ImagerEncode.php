<?php

namespace imagerClient;

class ImagerEncode extends ImagerFormat
{
	use ImagerData;

	public function encode(): string
	{
		$myFlag = 0;
		if ($this->thumb == "default") {
			$this->thumb = "";
		}

		$newData = '';
		foreach ($this->flagsSorted() as $name) {
			$flag = $this->Flags[$name] ?? 0;

			if ($name == "color" && $this->$name) {
				// [3]uint8
				$myFlag |= $flag;
				$newData .= pack('CCC', $this->color[0] ?? 255, $this->color[1] ?? 255, $this->color[2] ?? 255);
			} else if ($name == "trimColor" && $this->$name) {
				// [][3]uint8
				$myFlag |= $flag;
				$newData .= pack('C', count($this->trimColor) * 3);
				foreach ($this->trimColor as $color) {
					$newData .= pack('CCC', $color[0] ?? 255, $color[1] ?? 255, $color[2] ?? 255);
				}
			} else if (in_array($name, ["loop", "trimActive", "crop"]) && $this->$name) {
				// bool
				$myFlag |= $flag;
			} else if (in_array($name, ["formatTo", "formatFrom", "quality", "trimRate"]) && $this->$name) {
				// uint8
				$myFlag |= $flag;
				$newData .= pack('C', $this->$name);
			} else if (in_array($name, ["width", "height"]) && $this->$name) {
				// uint16
				$myFlag |= $flag;
				$newData .= pack('n', $this->$name);
			} else if (in_array($name, ["format", "thumb"]) && $this->$name) {
				// string
				$myFlag |= $flag;
				$newData .= pack('C', strlen($this->$name)) . $this->$name;
			}
		}


		return rtrim(strtr(base64_encode(pack('n', $myFlag) . $newData), '+/', '-_'), '=');
	}
}
