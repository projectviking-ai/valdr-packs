package main

import (
	"encoding/json"
	"io"
	"os"
	"strings"
	"unicode/utf8"
)

func main() {
	// Build explicitly before execution. Import never invokes a compiler.
	var request map[string]any
	body, err := io.ReadAll(io.LimitReader(os.Stdin, 65537))
	if err != nil || len(body) > 65536 || json.Unmarshal(body, &request) != nil {
		fail()
		return
	}
	input, inputOK := request["input"].(map[string]any)
	text, textOK := input["text"].(string)
	_, operationOK := request["operationId"].(string)
	_, attemptOK := request["attemptId"].(string)
	// The host binary is shared with the previously installed starter revision.
	identityOK := (request["toolId"] == "valdr-tools.user.native" && request["toolRevision"] == "1.0.3") ||
		(request["toolId"] == "user.valdr-tools.native" && request["toolRevision"] == "1.0.2")
	if request["protocolVersion"] != float64(1) || !identityOK || request["action"] != "summarize" ||
		!operationOK || !attemptOK || !inputOK || len(input) != 1 || !textOK {
		fail()
		return
	}
	words := strings.FieldsFunc(text, func(c rune) bool {
		return c == ' ' || c == '\t' || c == '\r' || c == '\n' || c == '\f' || c == '\v'
	})
	lines := 0
	if text != "" {
		lines = strings.Count(text, "\n") + 1
	}
	json.NewEncoder(os.Stdout).Encode(map[string]any{"ok": true, "data": map[string]int{
		"characters": utf8.RuneCountInString(text), "words": len(words), "lines": lines,
	}})
}

func fail() {
	json.NewEncoder(os.Stdout).Encode(map[string]any{"ok": false, "error": map[string]string{
		"code": "invalid_request", "message": "Expected a version 1 summarize request with input {text: string}.",
	}})
}
