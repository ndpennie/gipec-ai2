/* Shared migration v2. No network calls; never delete source data. */
(function(root){
  'use strict';
  const enc=new TextEncoder(), dec=new TextDecoder();
  const b64=bytes=>{let s='';for(const b of bytes)s+=String.fromCharCode(b);return btoa(s)};
  const un64=s=>Uint8Array.from(atob(s),c=>c.charCodeAt(0));
  function validate(p){
    if(!p||p.version!==2||!p.storage||Array.isArray(p.storage))throw Error('Invalid backup');
    const entries=Object.entries(p.storage);
    if(!entries.length||entries.some(([k,v])=>!/^spear_[a-z0-9_]+$/.test(k)||typeof v!=='string'))throw Error('Invalid saved settings');
    const items=JSON.parse(p.storage.spear_items||'[]');
    if(!Array.isArray(items)||items.some(i=>!i||typeof i!=='object'||Array.isArray(i)))throw Error('Invalid saved cases; export stopped without changing data');
    if(items.length!==p.caseCount)throw Error('Case count mismatch');
    return p;
  }
  function snapshot(s){
    const storage={};
    for(let i=0;i<s.length;i++){const k=s.key(i);if(/^spear_[a-z0-9_]+$/.test(k))storage[k]=s.getItem(k)}
    const items=JSON.parse(storage.spear_items||'[]');
    return validate({version:2,createdAt:new Date().toISOString(),caseCount:items.length,storage});
  }
  async function digest(p){
    return b64(new Uint8Array(await crypto.subtle.digest('SHA-256',enc.encode(JSON.stringify(p)))));
  }
  async function key(password,salt){
    const base=await crypto.subtle.importKey('raw',enc.encode(password),'PBKDF2',false,['deriveKey']);
    return crypto.subtle.deriveKey({name:'PBKDF2',salt,iterations:600000,hash:'SHA-256'},base,{name:'AES-GCM',length:256},false,['encrypt','decrypt']);
  }
  async function encrypt(p,password){
    validate(p);
    if(password.length<16)throw Error('Use a passphrase of at least 16 characters');
    const salt=crypto.getRandomValues(new Uint8Array(16)),iv=crypto.getRandomValues(new Uint8Array(12));
    const data=await crypto.subtle.encrypt({name:'AES-GCM',iv},await key(password,salt),enc.encode(JSON.stringify(p)));
    return {format:'spear-encrypted-v2',salt:b64(salt),iv:b64(iv),data:b64(new Uint8Array(data))};
  }
  async function decrypt(file,password){
    if(file.format!=='spear-encrypted-v2')throw Error('Unsupported backup format');
    const salt=un64(file.salt),iv=un64(file.iv);
    if(salt.length!==16||iv.length!==12)throw Error('Invalid backup');
    const plain=await crypto.subtle.decrypt({name:'AES-GCM',iv},await key(password,salt),un64(file.data));
    return validate(JSON.parse(dec.decode(plain)));
  }
  function restore(s,p){
    validate(p);
    const entries=Object.entries(p.storage),before=new Map();
    // Refuse ambiguous merges and credential replacement; identical retries are safe.
    for(const [k,v] of entries){
      const old=s.getItem(k);before.set(k,old);
      if(old!==null&&old!==v)throw Error('Destination contains different saved data. Use a separate empty browser profile or resolve the conflict before importing.');
    }
    try{
      for(const [k,v] of entries)s.setItem(k,v);
      for(const [k,v] of entries)if(s.getItem(k)!==v)throw Error('Saved data verification failed');
    }catch(e){
      let failed=false;
      for(const [k,v] of before)try{v===null?s.removeItem(k):s.setItem(k,v)}catch(_){failed=true}
      throw Error(failed?'Import failed; rollback incomplete. Keep the encrypted backup and source device.':'Import failed; previous destination values restored. Keep the backup and source device.');
    }
    return p.caseCount;
  }
  root.SpearMigration={validate,snapshot,digest,encrypt,decrypt,restore};
})(globalThis);
