import json
import bridge

messages=[{'role':'system','content':'Be brief.'},{'role':'user','content':'What unit is missing?'}]

def test_openai_request():
    url, headers, body=bridge.build_request('openai','gpt-test',messages,'test-key','https://api.openai.com/v1')
    assert url=='https://api.openai.com/v1/chat/completions'
    assert headers['Authorization']=='Bearer test-key'
    assert json.loads(body)['messages'][0]['role']=='system'

def test_anthropic_request():
    url, headers, body=bridge.build_request('anthropic','claude-test',messages,'test-key','https://api.anthropic.com/v1')
    payload=json.loads(body)
    assert url=='https://api.anthropic.com/v1/messages'
    assert headers['x-api-key']=='test-key'
    assert payload['system']=='Be brief.'
    assert payload['messages']==[{'role':'user','content':'What unit is missing?'}]
    assert 'Authorization' not in headers

def test_google_request():
    url, headers, body=bridge.build_request('google','gemini-test',messages,'test-key','https://generativelanguage.googleapis.com')
    payload=json.loads(body)
    assert url=='https://generativelanguage.googleapis.com/v1beta/models/gemini-test:generateContent'
    assert headers['x-goog-api-key']=='test-key'
    assert payload['systemInstruction']['parts'][0]['text']=='Be brief.'
    assert payload['contents'][0]['role']=='user'

def test_unknown_provider():
    try:
        bridge.adapter_for('fireflies')
    except ValueError as error:
        assert 'dedicated adapter' in str(error)
    else:
        raise AssertionError('Fireflies must not be treated as a chat model')

def test_answer_readers():
    assert bridge.read_answer('openai', {'choices':[{'message':{'content':'ok'}}]})=='ok'
    assert bridge.read_answer('anthropic', {'content':[{'type':'text','text':'ok'}]})=='ok'
    assert bridge.read_answer('google', {'candidates':[{'content':{'parts':[{'text':'ok'}]}}]})=='ok'

if __name__=='__main__':
    test_openai_request()
    test_anthropic_request()
    test_google_request()
    test_unknown_provider()
    test_answer_readers()
    print('bridge routing checks passed')
