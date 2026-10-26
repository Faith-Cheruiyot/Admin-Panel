import test from 'node:test';
import assert from 'node:assert/strict';
import { validateMedia, pagination, imageFormat } from '../lib/validation.mjs';
const user='17fc14d9-e6d2-4237-98ec-6e7c4727316c';
test('media writes discard client-supplied ownership, votes and privilege fields',()=>{
  assert.deepEqual(validateMedia({kind:'caption',caption:'A joke',prompt:'A funny prompt',model:'gemini',created_by:'attacker',upvotes:100,is_superadmin:true},user,true),{caption:'A joke',prompt:'A funny prompt',model:'gemini',created_by:user});
});
test('photo creation rejects foreign image paths and invalid dimensions',()=>{
  const imageId='72e690cc-8412-4687-9e1f-383641d446a7';
  const input={kind:'photo',caption:'A joke',prompt:'',model:'gemini',image_path:`${user}/${imageId}.jpg`,width:128,height:128};
  assert.equal(validateMedia(input,user,true).id,imageId);
  assert.equal(validateMedia(input,user,true).width,128);
  assert.throws(()=>validateMedia({...input,image_path:'another-user/abc.jpg'},user,true));
  assert.throws(()=>validateMedia({...input,width:127},user,true));
  assert.throws(()=>validateMedia({...input,width:6000,height:6000},user,true));
});
test('edits cannot change stored image or author',()=>{
  const result=validateMedia({kind:'photo',caption:'Edited',prompt:'',model:'gemini',image_path:'attacker',created_by:'attacker'},user);
  assert.deepEqual(result,{caption:'Edited',context:'',model:'gemini'});
});
test('validation respects database constraints and bounds pagination',()=>{
  assert.throws(()=>validateMedia({kind:'caption',caption:'x',prompt:'x',model:'x'},user));
  assert.throws(()=>validateMedia({kind:'photo',caption:'x'.repeat(181),model:'x'},user));
  assert.throws(()=>pagination(new URLSearchParams('page=-1'),12));
  assert.throws(()=>pagination(new URLSearchParams('page=1.5'),12));
  assert.equal(pagination(new URLSearchParams('page=2'),12).start,12);
});
test('upload format is detected from bytes, not filename',()=>{
  assert.deepEqual(imageFormat(new Uint8Array([255,216,255])),{ext:'jpg',mime:'image/jpeg'});
  assert.equal(imageFormat(new TextEncoder().encode('<svg onload=alert(1)>')),null);
});
