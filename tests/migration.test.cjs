const {test}=require('node:test');
const assert=require('node:assert/strict');
require('../migration.js');
const M=globalThis.SpearMigration;
class Storage{
  constructor(entries={},fail=null){this.data=new Map(Object.entries(entries));this.fail=fail}
  get length(){return this.data.size} key(i){return [...this.data.keys()][i]}
  getItem(k){return this.data.get(k)??null}
  setItem(k,v){if(this.fail===k)throw Error('quota');this.data.set(k,v)}
  removeItem(k){this.data.delete(k)}
}
const fixture=n=>new Storage({
  spear_key:'SYNTHETIC-NOT-A-CREDENTIAL',
  spear_items:JSON.stringify(Array.from({length:n},(_,i)=>({id:i,name:'同じ 🧪',url:'',captured:'',media:[{data:'data:text/plain;base64,dGVzdA=='}],thumb:'synthetic-thumbnail'}))),
  spear_refimgs:'[{"image":"synthetic-reference"}]',
  spear_gemini:'SYNTHETIC-OPTIONAL-KEY',unrelated:'do not export'
});
for(const count of [0,300,301,600,1001])test('preserves all fields and '+count+' cases',()=>{
  const source=fixture(count),p=M.snapshot(source),dest=new Storage();
  assert.equal(M.restore(dest,p),count);
  assert.equal(dest.getItem('spear_items'),source.getItem('spear_items'));
  assert.equal(dest.getItem('spear_refimgs'),source.getItem('spear_refimgs'));
  assert.equal(dest.getItem('spear_gemini'),source.getItem('spear_gemini'));
  assert.equal(dest.getItem('unrelated'),null);
  assert.equal(M.restore(dest,p),count); // retry is idempotent
});
test('missing setup key does not prevent case recovery',()=>{
  const s=fixture(2);s.removeItem('spear_key');assert.equal(M.snapshot(s).caseCount,2);
});
test('malformed cases fail without substituting an empty list',()=>{
  const s=fixture(1);s.setItem('spear_items','broken');assert.throws(()=>M.snapshot(s));
  s.setItem('spear_items','{}');assert.throws(()=>M.snapshot(s));
});
test('conflicts do not overwrite destination or partially write credentials',()=>{
  const s=new Storage({spear_items:'[]'}),before=[...s.data];
  assert.throws(()=>M.restore(s,M.snapshot(fixture(2))),/different saved data/);
  assert.deepEqual([...s.data],before);
});
test('quota failure rolls back prior writes',()=>{
  const s=new Storage({unrelated:'keep'},'spear_items');
  assert.throws(()=>M.restore(s,M.snapshot(fixture(301))),/previous destination values restored/);
  assert.deepEqual([...s.data],[['unrelated','keep']]);
});
test('rejects inconsistent counts and foreign storage keys',()=>{
  const p=M.snapshot(fixture(2));p.caseCount=1;assert.throws(()=>M.validate(p));
  p.caseCount=2;p.storage.other='bad';assert.throws(()=>M.validate(p));
});
test('encrypted round trip; wrong password and tampering rejected',async()=>{
  const p=M.snapshot(fixture(301)),password='synthetic-only-test-passphrase';
  const file=await M.encrypt(p,password),serialized=JSON.stringify(file);
  assert(!serialized.includes('SYNTHETIC-NOT-A-CREDENTIAL'));
  assert.deepEqual(await M.decrypt(file,password),p);
  await assert.rejects(M.decrypt(file,'wrong-password'));
  const bytes=Buffer.from(file.data,'base64');bytes[0]^=1;
  await assert.rejects(M.decrypt({...file,data:bytes.toString('base64')},password));
  await assert.rejects(M.encrypt(p,'short'));
});
