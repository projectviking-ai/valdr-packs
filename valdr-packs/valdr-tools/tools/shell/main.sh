#!/bin/sh
# jq owns JSON parsing and encoding; no request text is evaluated as shell code.
if result=$(jq -cs '
  if length == 1 and (.[0] | type) == "object" then .[0] else error("request") end
  | if .protocolVersion == 1 and .toolId == "valdr-tools.user.shell"
      and .toolRevision == "1.0.3" and .action == "summarize"
      and (.operationId | type) == "string" and (.attemptId | type) == "string"
      and (.input | type) == "object" and (.input | keys) == ["text"]
      and (.input.text | type) == "string"
    then .input.text else error("request") end
  | {ok: true, data: {
      characters: length,
      words: (split("[ \t\r\n\f\u000b]+"; "") | map(select(length > 0)) | length),
      lines: (if length == 0 then 0 else split("\n") | length end)
    }}
' 2>/dev/null); then
  printf '%s\n' "$result"
else
  printf '%s\n' '{"ok":false,"error":{"code":"invalid_request","message":"Expected a version 1 summarize request with input {text: string}."}}'
fi
