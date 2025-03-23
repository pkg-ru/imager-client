package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"os"
	"os/exec"
	"path"
	"runtime"
	"strconv"

	"github.com/pkg-ru/imager-client"
	imagergo "github.com/pkg-ru/imager-client/src/imager-go"
)

type FixtureSetting struct {
	Width      *uint16    `json:"width"`
	Height     *uint16    `json:"height"`
	Quality    *uint8     `json:"quality"`
	Crop       *bool      `json:"crop"`
	Thumb      *string    `json:"thumb"`
	Loop       *bool      `json:"loop"`
	Color      []uint8    `json:"color"`
	TrimActive *bool      `json:"trimActive"`
	TrimRate   *uint8     `json:"trimRate"`
	TrimColor  [][3]uint8 `json:"trimColor"`
}

type Fixture struct {
	Id       int            `json:"id"`
	File     string         `json:"file"`
	FormatTo string         `json:"formatTo"`
	Setting  FixtureSetting `json:"setting"`
}

type TestStruct struct {
	Flags       map[string]uint16 `json:"flags"`
	FlagsSorted []string          `json:"flagsSorted"`
	Formats     map[uint8]string  `json:"formats"`
	Tests       map[string]string `json:"tests"`
}

func Command(name string, arg ...string) *TestStruct {
	cmd := exec.Command(name, arg...)
	out, err := cmd.CombinedOutput()
	if err != nil {
		Error(name+": ", err.Error())
	}

	test := &TestStruct{}
	err = json.Unmarshal(bytes.Trim(out, "\r\n\t "), test)
	if err != nil {
		Error("parsing cpmmand "+name, err.Error())
	}

	return test
}

func GetTests() *TestStruct {
	img_glob := imager.Imager()
	img_group := img_glob.Clone()

	tests := map[string]string{}
	fixture := getFixture()
	for _, item := range fixture {
		if len(item.Setting.Color) == 3 {
			img_glob.Color(item.Setting.Color[0], item.Setting.Color[1], item.Setting.Color[2])
		}
		if item.Setting.TrimActive != nil {
			img_glob.TrimActive(*item.Setting.TrimActive)
		}
		if item.Setting.TrimRate != nil {
			img_glob.TrimRate(*item.Setting.TrimRate)
		}
		if len(item.Setting.TrimColor) > 0 {
			img_glob.TrimColors(item.Setting.TrimColor)
		}
		if item.Setting.Width != nil {
			img_glob.Width(*item.Setting.Width)
		}
		if item.Setting.Height != nil {
			img_glob.Height(*item.Setting.Height)
		}
		if item.Setting.Quality != nil {
			img_glob.Quality(*item.Setting.Quality)
		}
		if item.Setting.Thumb != nil {
			img_glob.Thumb(*item.Setting.Thumb)
		}
		if item.Setting.Crop != nil {
			img_glob.Crop(*item.Setting.Crop)
		}
		if item.Setting.Loop != nil {
			img_glob.Loop(*item.Setting.Loop)
		}
		tests["clone_"+strconv.Itoa(int(item.Id))] = img_glob.Convert(item.File, item.FormatTo)

		group := img_group.Clone()
		if len(item.Setting.Color) == 3 {
			group.Color(item.Setting.Color[0], item.Setting.Color[1], item.Setting.Color[2])
		}
		if item.Setting.TrimActive != nil {
			group.TrimActive(*item.Setting.TrimActive)
		}
		if item.Setting.TrimRate != nil {
			group.TrimRate(*item.Setting.TrimRate)
		}
		if len(item.Setting.TrimColor) > 0 {
			group.TrimColors(item.Setting.TrimColor)
		}
		if item.Setting.Width != nil {
			group.Width(*item.Setting.Width)
		}
		if item.Setting.Height != nil {
			group.Height(*item.Setting.Height)
		}
		if item.Setting.Quality != nil {
			group.Quality(*item.Setting.Quality)
		}
		if item.Setting.Thumb != nil {
			group.Thumb(*item.Setting.Thumb)
		}
		if item.Setting.Crop != nil {
			group.Crop(*item.Setting.Crop)
		}
		if item.Setting.Loop != nil {
			group.Loop(*item.Setting.Loop)
		}
		tests["group_"+strconv.Itoa(int(item.Id))] = group.Convert(item.File, item.FormatTo)
	}

	res := &TestStruct{
		Tests:       tests,
		Flags:       imagergo.Flags,
		FlagsSorted: imagergo.FlagsSorted,
		Formats:     map[uint8]string{},
	}

	for k, v := range imagergo.Formats {
		res.Formats[uint8(k)] = v
	}

	return res
}

func getFixture() []Fixture {
	_, fn, _, _ := runtime.Caller(0)

	configFile, err := os.Open(path.Dir(fn) + "/fixture.json")
	if err != nil {
		Error("opening config file", err.Error())
	}

	fixture := []Fixture{}
	jsonParser := json.NewDecoder(configFile)
	if err = jsonParser.Decode(&fixture); err != nil {
		Error("parsing config file", err.Error())
	}

	return fixture
}

func Error(a ...any) {
	fmt.Fprintln(os.Stderr, a...)
	os.Exit(1)
}
