const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
function page(opener){
  const html=fs.readFileSync(require('node:path').join(__dirname,'../export.html'),'utf8');
  const code=[...html.matchAll(/<script>([\s\S]*?)<\/script>/g)][0][1];
  const elements=new Map(),events={},messages=[],timers=new Map();let seq=0;
  const peer=opener?{postMessage:(d,origin)=>messages.push({d,origin})}:null;
  const ctx={
    SpearMigration:{snapshot:()=>({caseCount:301}),digest:async()=> 'synthetic-hash'},
    document:{getElementById:id=>{if(!elements.has(id))elements.set(id,{});return elements.get(id)}},
    localStorage:{},crypto:{randomUUID:()=> 'synthetic-id'},
    window:{opener:peer,addEventListener:(type,fn)=>events[type]=fn},
    setTimeout:fn=>{timers.set(++seq,fn);return seq},clearTimeout:id=>timers.delete(id)
  };
  vm.runInNewContext(code,ctx);
  return {elements,events,messages,timers,peer};
}
test('blocked popup does not navigate or emit data',async()=>{
  const p=page(false);await p.elements.get('send').onclick();
  assert.equal(p.messages.length,0);assert.match(p.elements.get('status').textContent,/encrypted file/);
});
test('only exact origin, window, transfer id, digest and count can acknowledge',async()=>{
  const p=page(true);await p.elements.get('send').onclick();
  assert.equal(p.messages[0].origin,'https://gipec-ai2.github.io');
  const data={type:'spear-move-v2-ack',id:'synthetic-id',hash:'synthetic-hash',caseCount:301};
  for(const event of [
    {origin:'https://evil.invalid',source:p.peer,data},
    {origin:'https://gipec-ai2.github.io',source:{},data},
    {origin:'https://gipec-ai2.github.io',source:p.peer,data:{...data,id:'stale'}},
    {origin:'https://gipec-ai2.github.io',source:p.peer,data:{...data,caseCount:300}}
  ]){p.events.message(event);assert.match(p.elements.get('status').textContent,/Waiting/)}
  p.events.message({origin:'https://gipec-ai2.github.io',source:p.peer,data});
  assert.match(p.elements.get('status').textContent,/verified/);assert.equal(p.timers.size,0);
});
test('missing acknowledgment is not success',async()=>{
  const p=page(true);await p.elements.get('send').onclick();[...p.timers.values()][0]();
  assert.match(p.elements.get('status').textContent,/do not assume completion/);
});
