import json
import re
import sys

try:
    request = json.load(sys.stdin)
    if (not isinstance(request, dict) or type(request.get('protocolVersion')) is not int
            or request['protocolVersion'] != 1 or request.get('toolId') != 'valdr-tools.user.python'
            or request.get('toolRevision') != '1.0.3' or request.get('action') != 'summarize'
            or not isinstance(request.get('operationId'), str) or not isinstance(request.get('attemptId'), str)
            or not isinstance(request.get('input'), dict) or set(request['input']) != {'text'}
            or not isinstance(request['input']['text'], str)):
        raise ValueError('Invalid request')
    text = request['input']['text']
    result = {'ok': True, 'data': {
        'characters': len(text),
        'words': len([word for word in re.split(r'[ \t\r\n\f\v]+', text) if word]),
        'lines': 0 if text == '' else text.count('\n') + 1,
    }}
except (ValueError, TypeError):
    result = {'ok': False, 'error': {'code': 'invalid_request', 'message': 'Expected a version 1 summarize request with input {text: string}.'}}
print(json.dumps(result))
