<?php

use imagerClient\Imager;
use imagerClient\ImagerEncode;

include dirname(__DIR__) . '/src/imager-php/bootstrap.php';

$img_glob = new Imager();
$img_group = $img_glob->clone();

$tests = [];
$fixture = json_decode(file_get_contents(dirname(__FILE__) . '/fixture.json'), true);
foreach ($fixture as $item) {
    $tests['clone_' . $item['id']] = $img_glob->setting($item['setting'] ?? [])->convert($item['file'], $item['formatTo'] ?? '');
    $tests['group_' . $item['id']] = $img_group->clone()->setting($item['setting'] ?? [])->convert($item['file'], $item['formatTo'] ?? '');
}

$imager = new ImagerEncode();

echo json_encode([
    'flags' => $imager->Flags,
    'flagsSorted' => $imager->FlagsSorted(),
    'formats' => $imager::FormatList,
    'tests' => $tests,
]);
