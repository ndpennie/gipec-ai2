const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const html=fs.readFileSync(require('node:path').join(__dirname,'../index.html'),'utf8');
for(const [fn,next,key,variable,records] of [
  ['itemsSave','itemsLoad','ITEMS_KEY','items',Array.from({length:1001},(_,id)=>({id,thumb:'saved',media:['saved']}))],
  ['libSave','libLoad','LIB_KEY','LIBRARY',[{ts:'mine',image:'saved',text:'x'.repeat(400001)}]],
  ['refImgSave',null,'REFIMG_KEY','REFIMAGES',Array.from({length:501},(_,id)=>({id,image:'saved'}))]
]){
  const start=html.indexOf('function '+fn+'(){');
  const end=next?html.indexOf('function '+next+'()',start):html.indexOf('\n',start);
  const code=html.slice(start,end);
  test(fn+' preserves all records and attachments, and retains prior values on quota error',()=>{
    let saved='previous',fail=false;
    const ctx={[key]:'synthetic',[variable]:records,toast:()=>{},localStorage:{setItem:(k,v)=>{if(fail)throw Error('quota');saved=v}}};
    vm.runInNewContext(code,ctx);ctx[fn]();
    assert.deepEqual(JSON.parse(saved),records);
    const before=saved;fail=true;assert.throws(()=>ctx[fn]());assert.equal(saved,before);
  });
}
