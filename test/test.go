package main

import (
	"fmt"
	"os"
	"sync"
)

func main() {
	tests := map[string]*TestStruct{}

	var wg sync.WaitGroup
	wg.Add(4)

	go func() {
		tests["GO"] = GetTests()
		wg.Done()
	}()
	go func() {
		tests["PHP"] = Command("php", "test/test.php")
		wg.Done()
	}()
	go func() {
		tests["PY"] = Command("python3", "test/test.py")
		wg.Done()
	}()
	go func() {
		tests["TS"] = Command("npx", "ts-node", "test/test.ts")
		wg.Done()
	}()

	wg.Wait()

	isError := false
	for name1, test1 := range tests {
		fmt.Print(name1 + ":")
		localErr := []string{}
		for name2, test2 := range tests {
			if name1 != name2 {
				myErr := false
				if len(test1.Flags) != len(test2.Flags) {
					myErr = true
					localErr = append(localErr, fmt.Sprintf(" - Flags %s = %d / %s = %d", name1, len(test1.Flags), name2, len(test2.Flags)))
				}
				for k, v := range test1.Flags {
					if test2.Flags[k] != v {
						myErr = true
						localErr = append(localErr, fmt.Sprintf(" - Flags['%s'] %s = %d / %s = %d", k, name1, v, name2, test2.Flags[k]))
					}
				}
				if len(test1.Formats) != len(test2.Formats) {
					myErr = true
					localErr = append(localErr, fmt.Sprintf(" - Formats %s = %d / %s = %d", name1, len(test1.Formats), name2, len(test2.Formats)))
				}
				for k, v := range test1.Formats {
					if test2.Formats[k] != v {
						myErr = true
						localErr = append(localErr, fmt.Sprintf(" - Formats[%d] %s = %s / %s = %s", k, name1, v, name2, test2.Formats[k]))
					}
				}
				for k, v := range test1.FlagsSorted {
					if k <= (len(test2.FlagsSorted)-1) && test2.FlagsSorted[k] != v {
						myErr = true
						localErr = append(localErr, fmt.Sprintf(" - FlagsSorted[%d] %s = %s / %s = %s", k, name1, v, name2, test2.FlagsSorted[k]))
					}
				}
				if !myErr {
					for k, v := range test1.Tests {
						if test2.Tests[k] != v {
							localErr = append(localErr, fmt.Sprintf(" - Tests[%s] %s = %s / %s = %s", k, name1, v, name2, test2.Tests[k]))
						}
					}
				}
			}
		}
		if len(localErr) == 0 {
			fmt.Println(" OK")
		} else {
			isError = true
			fmt.Println("", len(localErr), "ERRORS")
			for _, err := range localErr {
				fmt.Fprintln(os.Stderr, err)
			}
		}
	}

	if isError {
		os.Exit(1)
	}
}
