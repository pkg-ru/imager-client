import { Imager } from "../src/imager-ts/Imager"
import { FormatList } from "../src/imager-ts/ImagerFormat"
import { Flags, FlagsSorted } from "../src/imager-ts/ImagerData"
import fixture from "./fixture.json"


var img_glob = new Imager()
var img_group = img_glob.clone()

var tests = {}
for (var key in fixture) {
    var item = fixture[key]
    tests["clone_" + item.id] = img_glob.setting(item.setting || null).convert(item["file"], item.formatTo || "")
    tests["group_" + item.id] = (
        img_group.clone()
            .setting(item.setting)
            .convert(item.file, item.formatTo || "")
    )
}


console.log(JSON.stringify({
    "flags": Flags,
    "flagsSorted": FlagsSorted(),
    "formats": FormatList,
    "tests": tests,
}));
