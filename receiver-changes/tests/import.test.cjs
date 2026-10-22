const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const html=fs.readFileSync(require('node:path').join(__dirname,'../migrate.html'),'utf8');
const code=[...html.matchAll(/<script>([\s\S]*?)<\/script>/g)][0][1];
function page(fail=false){
  const elements=new Map(),events={},messages=[],order=[];
  const peer={postMessage:d=>messages.push(d)};
  const ctx={
    SpearMigration:{validate:()=>{},digest:async()=> 'hash',restore:()=>{order.push('restore');if(fail)throw Error('quota failure')}},
    document:{getElementById:id=>{if(!elements.has(id))elements.set(id,{});return elements.get(id)}},
    localStorage:{},window:{open:()=>peer,addEventListener:(n,f)=>events[n]=f},
    indexedDB:{open:()=>{
      const r={result:{close:()=>{},transaction:()=>{
        const t={objectStore:()=>({put:()=>{order.push('stage');queueMicrotask(()=>t.oncomplete())}})};return t;
      }}};
      queueMicrotask(()=>r.onsuccess());return r;
    }}
  };
  vm.runInNewContext(code,ctx);elements.get('open').onclick();
  return {elements,events,messages,order,peer};
}
test('import accepts only the opened old-origin popup and requires confirmation',async()=>{
  const p=page(),data={type:'spear-move-v2',id:'id',hash:'hash',payload:{caseCount:301}};
  await p.events.message({origin:'https://evil.invalid',source:p.peer,data});
  await p.events.message({origin:'https://ndpennie.github.io',source:{},data});
  assert.equal(p.elements.get('status').textContent,undefined);
  await p.events.message({origin:'https://ndpennie.github.io',source:p.peer,data});
  assert.match(p.elements.get('status').textContent,/301 saved cases ready/);
  assert.equal(p.messages.length,0);assert.equal(p.order.length,0);
  await p.elements.get('commit').onclick();
  assert.deepEqual(p.order,['stage','restore']);assert.equal(p.messages.length,1);
  assert.equal(p.messages[0].caseCount,301);
});
test('failed restore sends no success acknowledgment',async()=>{
  const p=page(true);
  await p.events.message({origin:'https://ndpennie.github.io',source:p.peer,data:{type:'spear-move-v2',id:'id',hash:'hash',payload:{caseCount:301}}});
  await p.elements.get('commit').onclick();
  assert.equal(p.messages.length,0);assert.match(p.elements.get('status').textContent,/quota failure/);
});
