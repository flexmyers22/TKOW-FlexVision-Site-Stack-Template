"""TKOW local Excel-backed model catalog and chat bridge.
Python 3.10+, standard library only. Keep behind an authenticated reverse proxy.
"""
import json, os, re, urllib.parse, urllib.request, urllib.error, zipfile, xml.etree.ElementTree as ET
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

BOOK=Path(os.environ.get('TKOW_WORKBOOK', Path(__file__).with_name('TKOW_Multi_LLM_Registry_API_Key_Vault.xlsx')))
TOKEN=os.environ.get('TKOW_BRIDGE_TOKEN','')
NS={'m':'http://schemas.openxmlformats.org/spreadsheetml/2006/main','r':'http://schemas.openxmlformats.org/officeDocument/2006/relationships'}
OPENAI_PROVIDERS={'openai','openrouter','xai','github','github_models'}

def sheet(name):
    with zipfile.ZipFile(BOOK) as z:
        w=ET.fromstring(z.read('xl/workbook.xml'))
        rel=ET.fromstring(z.read('xl/_rels/workbook.xml.rels'))
        relmap={r.attrib['Id']:r.attrib['Target'] for r in rel}
        found=next((s for s in w.find('m:sheets',NS) if s.attrib['name']==name),None)
        if found is None: raise ValueError('Missing sheet: '+name)
        target=relmap[found.attrib['{%s}id'%NS['r']]].lstrip('/')
        if not target.startswith('xl/'):target='xl/'+target
        shared=[]
        if 'xl/sharedStrings.xml' in z.namelist():
            shared=[''.join(t.text or '' for t in x.iter('{%s}t'%NS['m'])) for x in ET.fromstring(z.read('xl/sharedStrings.xml'))]
        root=ET.fromstring(z.read(target)); rows=[]
        for row in root.findall('.//m:sheetData/m:row',NS):
            cells={}
            for c in row.findall('m:c',NS):
                col=re.match('[A-Z]+',c.attrib['r']).group()
                v=c.find('m:v',NS); inline=c.find('m:is',NS)
                val=v.text if v is not None else ''.join(inline.itertext()) if inline is not None else ''
                if c.attrib.get('t')=='s' and val:val=shared[int(val)]
                cells[col]=val or ''
            rows.append(cells)
        if not rows:return []
        header=rows[0];return [{h:row.get(col,'') for col,h in header.items()} for row in rows[1:]]

def catalog():
    providers={p['Provider ID']:p for p in sheet('Providers')}
    result=[]
    for m in sheet('Model Catalog'):
        if not m.get('Display Name'):continue
        p=providers.get(m.get('Provider ID',''),{})
        verified=m.get('API ID Status','').lower() in ('verified','confirmed')
        enabled=m.get('Enabled','').lower() in ('yes','true','1')
        result.append({'label':m['Display Name'],'slug':m.get('Internal Slug',''), 'provider':m.get('Provider ID',''), 'api_model_id':m.get('Actual API Model ID',''), 'enabled':bool(enabled and verified and m.get('Actual API Model ID') and p),'route':m.get('Access Route','')})
    return result

def validate_messages(messages):
    if not isinstance(messages,list) or not messages or len(messages)>50:raise ValueError('Invalid messages')
    for msg in messages:
        if not isinstance(msg,dict) or msg.get('role') not in ('user','assistant','system') or not isinstance(msg.get('content'),str):raise ValueError('Only text messages are supported')
    return messages

def split_system(messages):
    system='\n\n'.join(msg['content'] for msg in messages if msg['role']=='system')
    dialog=[msg for msg in messages if msg['role']!='system']
    if not dialog:raise ValueError('A user message is required')
    return system, dialog

def adapter_for(provider):
    if provider in OPENAI_PROVIDERS:return 'openai'
    if provider=='anthropic':return 'anthropic'
    if provider=='google':return 'google'
    raise ValueError('Provider needs a dedicated adapter before chat is supported')

def build_request(provider, model_id, messages, key, base):
    kind=adapter_for(provider)
    if not base.startswith('https://'):raise ValueError('Invalid provider endpoint')
    base=base.rstrip('/')
    if kind=='openai':
        body=json.dumps({'model':model_id,'messages':messages,'stream':False}).encode()
        return base+'/chat/completions', {'Authorization':'Bearer '+key,'Content-Type':'application/json'}, body
    system, dialog=split_system(messages)
    if kind=='anthropic':
        payload={'model':model_id,'max_tokens':2048,'messages':[{'role':msg['role'],'content':msg['content']} for msg in dialog]}
        if system:payload['system']=system
        headers={'x-api-key':key,'anthropic-version':'2023-06-01','Content-Type':'application/json'}
        return base+'/messages', headers, json.dumps(payload).encode()
    contents=[{'role':'user' if msg['role']=='user' else 'model','parts':[{'text':msg['content']}]} for msg in dialog]
    payload={'contents':contents}
    if system:payload['systemInstruction']={'parts':[{'text':system}]}
    root=base if base.endswith('/v1beta') else base+'/v1beta'
    headers={'x-goog-api-key':key,'Content-Type':'application/json'}
    return root+'/models/'+urllib.parse.quote(model_id, safe='')+':generateContent', headers, json.dumps(payload).encode()

def read_answer(provider, payload):
    kind=adapter_for(provider)
    if kind=='openai':
        text=payload['choices'][0]['message']['content']
    elif kind=='anthropic':
        text=''.join(block.get('text','') for block in payload.get('content',[]) if isinstance(block,dict))
    else:
        parts=payload['candidates'][0]['content']['parts']
        text=''.join(part.get('text','') for part in parts)
    if not isinstance(text,str) or not text.strip():raise ValueError('The provider returned an empty answer')
    return text

def chat(payload, opener=urllib.request.urlopen):
    slug=payload.get('model',''); models={m['slug']:m for m in catalog()}
    m=models.get(slug)
    if not m or not m['enabled']:raise ValueError('Model is not enabled, verified, or recognized')
    providers={p['Provider ID']:p for p in sheet('Providers')}
    p=providers[m['provider']]
    adapter_for(m['provider'])
    env=p.get('Secret Env Name','')
    key=os.environ.get(env,'')
    if not key:raise ValueError('Server-side API credential is not configured')
    messages=validate_messages(payload.get('messages',[]))
    url, headers, body=build_request(m['provider'], m['api_model_id'], messages, key, p.get('API Base URL',''))
    req=urllib.request.Request(url,data=body,headers=headers,method='POST')
    try:
        with opener(req,timeout=90) as resp:raw=json.load(resp)
    except urllib.error.HTTPError as e:raise ValueError('Upstream provider error (HTTP %s)'%e.code)
    answer=read_answer(m['provider'], raw)
    return {'answer':answer,'provider':m['provider'],'model':m['api_model_id'],'slug':slug}

class Handler(BaseHTTPRequestHandler):
    def send(self,code,obj):
        data=json.dumps(obj).encode();self.send_response(code);self.send_header('Content-Type','application/json');self.send_header('Content-Length',str(len(data)));self.end_headers();self.wfile.write(data)
    def auth(self):
        if not TOKEN:self.send(503,{'error':'TKOW_BRIDGE_TOKEN must be set'});return False
        if self.headers.get('Authorization','')!='Bearer '+TOKEN:self.send(401,{'error':'Unauthorized'});return False
        return True
    def do_GET(self):
        if not self.auth():return
        if self.path=='/models':
            try:self.send(200,{'models':catalog()})
            except Exception:self.send(500,{'error':'Could not read model registry'})
        else:self.send(404,{'error':'Not found'})
    def do_POST(self):
        if not self.auth():return
        if self.path!='/chat':self.send(404,{'error':'Not found'});return
        try:
            n=int(self.headers.get('Content-Length','0'))
            if n<1 or n>100000:self.send(413,{'error':'Invalid payload size'});return
            self.send(200,chat(json.loads(self.rfile.read(n))))
        except (ValueError,json.JSONDecodeError,KeyError) as e:self.send(400,{'error':str(e)})
        except Exception:self.send(500,{'error':'Bridge request failed'})

if __name__=='__main__':
    ThreadingHTTPServer(('127.0.0.1',int(os.environ.get('TKOW_PORT','8787'))),Handler).serve_forever()
