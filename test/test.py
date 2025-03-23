import os, sys, json

project_directory = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
sys.path.append(project_directory)
import src.imager as imager


img_glob = imager.Imager()
img_group = img_glob.clone()

tests = {}
with open(project_directory + "/test/fixture.json") as json_file:
    fixture = json.load(json_file)
    for item in fixture:
        tests["clone_" + str(item["id"])] = img_glob.setting(item["setting"]).convert(
            item["file"], item.get("formatTo", "")
        )
        tests["group_" + str(item["id"])] = (
            img_group.clone()
            .setting(item["setting"])
            .convert(item["file"], item.get("formatTo", ""))
        )


print(
    json.dumps(
        {
            "flags": imager.Flags,
            "flagsSorted": imager.FlagsSorted(),
            "formats": imager.FormatList,
            "tests": tests,
        }
    )
)
