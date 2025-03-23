from typing import Mapping, Any
from base64 import urlsafe_b64encode
import struct
from .ImagerData import Flags, FlagsSorted


def encode(instance: Mapping[str, Any]) -> str:
    if instance["thumb"] == "default":
        instance["thumb"] = ""

    myFlag = 0
    newData = b""

    for name in FlagsSorted():
        flag = Flags[name] | 0

        if name == "color" and len(list(instance[name])) > 0:
            # [3]uint8
            myFlag |= flag
            newData += struct.pack(
                ">BBB",
                instance["color"][0],
                instance["color"][1],
                instance["color"][2],
            )
        elif name == "trimColor" and len(instance[name]) > 0:
            # [][3]uint8
            myFlag |= flag
            newData += struct.pack(">B", len(instance["trimColor"]) * 3)
            for color in instance["trimColor"]:
                newData += struct.pack(
                    ">BBB", color[0], color[1], color[2]
                )
        elif name in ["loop", "trimActive", "crop"] and instance[name]:
            # bool
            myFlag |= flag
        elif (
            name in ["formatTo", "formatFrom", "quality", "trimRate"]
            and instance[name] > 0
        ):
            # uint8
            myFlag |= flag
            newData += struct.pack(">B", instance[name])
        elif name in ["width", "height"] and instance[name] > 0:
            # uint16
            myFlag |= flag
            newData += struct.pack(">H", instance[name])
        elif name in ["format", "thumb"] and instance[name] and instance[name] != "":
            # string
            myFlag |= flag
            newData += struct.pack(">B", len(str(instance[name])))
            newData += str(instance[name]).encode("utf-8")

    return (
        urlsafe_b64encode(struct.pack(">H", myFlag) + newData)
        .rstrip(b"=")
        .decode("ascii")
    )
