/* Shared account, age/terms, report and blocking controls. No server secret belongs here. */
(() => {
 const $=s=>document.querySelector(s), cfg=window.DukaPublicConfig;
 let standalone=null;
 function client(){if(typeof sb!=='undefined'&&sb)return sb;if(!standalone){if(!window.supabase)throw Error('Could not connect. Reload the page.');standalone=window.supabase.createClient(cfg.url,cfg.publicKey);}return standalone;}
 function tell(text){const box=$('#dukaStatus');box.textContent=text;box.hidden=false;clearTimeout(tell.timer);tell.timer=setTimeout(()=>box.hidden=true,9000);}
 async function rpc(name,args={}){const {data,error}=await client().rpc(name,args);if(error){const missing=/schema cache|does not exist|could not find|PGRST202/i.test(error.message||'');throw Error(missing?'Account safety controls have not been activated yet. Please contact support.':error.message||'Please try again.');}return data;}
 async function session(){const {data,error}=await client().auth.getSession();if(error)throw error;return data.session;}
 document.body.insertAdjacentHTML('beforeend',`<div id="dukaStatus" role="status" hidden></div>
 <dialog class="duka-dialog" id="dukaTerms"><form><p class="duka-eyebrow">YOUR ACCOUNT</p><h2>Before you continue</h2><p>Accounts are for adults aged 18 or over. Please review how Duka Find works and how your information is handled.</p><div class="duka-legal-links"><a href="terms.html" target="_blank" rel="noopener">Terms and Conditions ↗</a><a href="privacy.html" target="_blank" rel="noopener">Privacy Policy ↗</a></div><label class="duka-check"><input type="checkbox" id="dukaAdult" required><span>I am 18 or older.</span></label><label class="duka-check"><input type="checkbox" id="dukaTermsCheck" required><span>I agree to the Duka Find Terms and Conditions.</span></label><p class="duka-small">Your declaration, the terms version and acceptance time will be recorded for your account. Google sign-in does not verify your age.</p><p class="duka-error" id="dukaTermsError" role="status"></p><div class="duka-actions"><button type="button" class="duka-secondary" id="dukaCancelTerms">Cancel</button><button class="duka-primary" type="submit" id="dukaAccept">Agree and continue</button></div></form></dialog>
 <dialog class="duka-dialog" id="dukaReport"><form><p class="duka-eyebrow">HELP KEEP DUKA SAFE</p><h2>Report a concern</h2><p id="dukaReportTarget"></p><label for="dukaReportReason">Reason</label><select id="dukaReportReason" required><option value="" selected disabled>Choose a reason</option><option value="scam">Scam or fraud</option><option value="illegal_goods">Illegal or restricted goods</option><option value="harassment">Harassment or threats</option><option value="hate">Hateful or discriminatory content</option><option value="sexual_content">Sexual or abusive content</option><option value="child_safety">Child safety concern</option><option value="privacy">Privacy or personal information</option><option value="misleading">Misleading information</option><option value="other">Other concern</option></select><label for="dukaReportDetails">What happened? (optional)</label><textarea id="dukaReportDetails" maxlength="2000" rows="4" placeholder="Give useful context. Do not include passwords or verification codes."></textarea><p class="duka-small">The Duka Find team reviews reports. Reporting does not automatically remove content. For urgent danger, contact local emergency services.</p><p class="duka-error" id="dukaReportError" role="status"></p><div class="duka-actions"><button type="button" class="duka-secondary" id="dukaCancelReport">Cancel</button><button type="submit" class="duka-primary">Send report</button></div></form></dialog>
 <dialog class="duka-dialog" id="dukaBlock"><h2>Conversation controls</h2><p id="dukaBlockDescription">Block this person to stop messages in both directions.</p><p class="duka-small">Existing messages may remain visible. You can still report a concern and contact support.</p><p class="duka-error" id="dukaBlockError" role="status"></p><div class="duka-actions"><button type="button" class="duka-secondary" id="dukaCancelBlock">Cancel</button><button type="button" class="duka-primary" id="dukaConfirmBlock">Block person</button></div></dialog>
 <dialog class="duka-dialog" id="dukaBlockedList"><h2>Blocked people</h2><div id="dukaBlockedRows"></div><div class="duka-actions"><button class="duka-secondary" type="button" id="dukaCloseBlocked">Close</button></div></dialog>`);
 async function legalPrompt(state,save){
  const dialog=$('#dukaTerms');if(dialog.open)return false;
  $('#dukaAdult').checked=false;$('#dukaTermsCheck').checked=false;$('#dukaTermsError').textContent='';
  return new Promise(resolve=>{
   let result=false;const form=dialog.querySelector('form');
   const close=()=>{form.onsubmit=null;resolve(result);};dialog.addEventListener('close',close,{once:true});
   $('#dukaCancelTerms').onclick=()=>dialog.close();
   form.onsubmit=async event=>{event.preventDefault();if(!form.reportValidity())return;const button=$('#dukaAccept');button.disabled=true;
    try{if(save)await rpc('duka_accept_terms',{p_version:state.version,p_adult:true});else{try{sessionStorage.setItem('duka_pre_auth_terms',JSON.stringify({version:state.version,time:Date.now()}));}catch{}}
    result=true;dialog.close();}catch(error){$('#dukaTermsError').textContent=error.message;}finally{button.disabled=false;}
   };dialog.showModal();
  });
 }
 async function legalState(){const state=await rpc('duka_legal_status');if(!state?.enabled)throw Error('Account registration and content changes are waiting for the approved policies to be activated. You can still browse or contact support.');return state;}
 async function beforeAuth(){try{return await legalPrompt(await legalState(),false);}catch(error){tell(error.message);return false;}}
 async function ensureAccepted(){
  try{const active=await session();if(!active){tell('Sign in first to use this account feature.');return false;}const state=await legalState();if(state.accepted)return true;
   let pending;try{pending=JSON.parse(sessionStorage.getItem('duka_pre_auth_terms')||'null');}catch{}
   if(pending?.version===state.version&&Date.now()-pending.time<30*60*1000){await rpc('duka_accept_terms',{p_version:state.version,p_adult:true});sessionStorage.removeItem('duka_pre_auth_terms');return true;}
   return await legalPrompt(state,true);
  }catch(error){tell(error.message);return false;}
 }
 async function report(type,id,label){
  try{if(!(await session())){tell('Sign in to submit an in-app report, or email dukafind@gmail.com.');return;}}
  catch(error){tell(error.message);return;}
  const dialog=$('#dukaReport');if(dialog.open)return;const form=dialog.querySelector('form');form.reset();$('#dukaReportError').textContent='';$('#dukaReportTarget').textContent=label||'Tell us about this content.';
  $('#dukaCancelReport').onclick=()=>dialog.close();
  form.onsubmit=async event=>{event.preventDefault();if(!form.reportValidity())return;const button=form.querySelector('[type=submit]');button.disabled=true;try{const ref=await rpc('duka_submit_report',{p_type:type,p_target:String(id),p_reason:$('#dukaReportReason').value,p_details:$('#dukaReportDetails').value.trim()});dialog.close();tell('Report received. Reference: '+ref);}catch(error){$('#dukaReportError').textContent=error.message;}finally{button.disabled=false;}};dialog.showModal();
 }
 async function refreshConversation(id){
  try{const state=await rpc('duka_conversation_controls',{p_conversation:String(id)});const button=$('#dukaChatBlock');if(button)button.textContent=state.blocked_by_me?'Unblock':'Block';const note=$('#dukaChatNote');if(note){note.hidden=!state.cannot_message;note.textContent='Messaging is blocked for this conversation. You can still report a concern.';}for(const selector of ['#sendReply','#chatSend','#replyText','#chatInput','#attachImageBtn']){const control=$(selector);if(control)control.disabled=!!state.cannot_message;}return state;}
  catch(error){const note=$('#dukaChatNote');if(note){note.hidden=false;note.textContent=error.message;}return null;}
 }
 async function blockConversation(id){
  const state=await refreshConversation(id);if(!state)return;const dialog=$('#dukaBlock');$('#dukaBlockError').textContent='';$('#dukaBlockDescription').textContent=state.blocked_by_me?'Unblock this person? Messaging resumes only if neither person has blocked the other.':'Block this person to stop messages in both directions.';$('#dukaConfirmBlock').textContent=state.blocked_by_me?'Unblock person':'Block person';$('#dukaCancelBlock').onclick=()=>dialog.close();$('#dukaConfirmBlock').onclick=async()=>{const button=$('#dukaConfirmBlock');button.disabled=true;try{await rpc('duka_set_block',{p_conversation:String(id),p_blocked:!state.blocked_by_me});dialog.close();await refreshConversation(id);tell(state.blocked_by_me?'Person unblocked.':'Person blocked.');}catch(error){$('#dukaBlockError').textContent=error.message;}finally{button.disabled=false;}};dialog.showModal();
 }
 async function blockedList(){
  try{const people=await rpc('duka_blocked_people');const host=$('#dukaBlockedRows');host.replaceChildren();if(!people?.length)host.textContent='You have not blocked anyone.';
   for(const person of people||[]){const row=document.createElement('div');row.className='duka-blocked-row';const name=document.createElement('span');name.textContent=person.display_name||'User';const button=document.createElement('button');button.type='button';button.className='duka-secondary';button.textContent='Unblock';button.onclick=async()=>{button.disabled=true;try{await rpc('duka_unblock_person',{p_user:person.user_id});row.remove();}catch(error){tell(error.message);button.disabled=false;}};row.append(name,button);host.append(row);}
   $('#dukaCloseBlocked').onclick=()=>$('#dukaBlockedList').close();$('#dukaBlockedList').showModal();
  }catch(error){tell(error.message);}
 }
 function attachControls(){
  const head=$('#view-chat .chat-head');if(head&&!$('#dukaChatTools')){const bar=document.createElement('div');bar.id='dukaChatTools';bar.innerHTML='<button type="button" id="dukaChatReport">Report person</button><button type="button" id="dukaChatBlock">Block</button>';head.after(bar);bar.insertAdjacentHTML('afterend','<p id="dukaChatNote" hidden role="status"></p>');$('#dukaChatReport').onclick=async()=>{try{const state=await rpc('duka_conversation_controls',{p_conversation:String(openConversationId)});report('user',state.other_id,'Report this conversation participant');}catch(error){tell(error.message);}};$('#dukaChatBlock').onclick=()=>blockConversation(openConversationId);}
  const chat=$('#chatScroll');if(chat)new MutationObserver(()=>{chat.querySelectorAll('[data-message-id]').forEach(row=>{if(row.querySelector('.duka-report-message'))return;const button=document.createElement('button');button.type='button';button.className='duka-report-message';button.textContent='Report';button.setAttribute('aria-label','Report this message');button.onclick=()=>report('message',row.dataset.messageId,'Report this message');row.append(button);});}).observe(chat,{childList:true});
  document.querySelectorAll('[data-duka-blocked]').forEach(button=>button.onclick=blockedList);
 }
 async function beforeLocation(){
  try{if(await session())return await ensureAccepted();let pending;try{pending=JSON.parse(sessionStorage.getItem('duka_pre_auth_terms')||'null');}catch{}const state=await legalState();if(pending?.version===state.version&&Date.now()-pending.time<30*60*1000)return true;return await legalPrompt(state,false);}catch(error){tell(error.message);return false;}
 }
 window.DukaSafety={client,rpc,tell,beforeAuth,beforeLocation,ensureAccepted,report,refreshConversation,blockedList};attachControls();
})();

(()=>{const attach=()=>{document.querySelectorAll('[data-duka-product]').forEach(card=>{if(card.querySelector('.duka-content-report'))return;const button=document.createElement('button');button.type='button';button.className='duka-content-report';button.textContent='Report product';button.onclick=event=>{event.stopPropagation();DukaSafety.report('product',card.dataset.dukaProduct,'Report this product');};card.append(button);});};const host=document.querySelector('#detailBody');if(host)new MutationObserver(attach).observe(host,{childList:true,subtree:true});})();

window.dispatchEvent(new Event('duka-controls-ready'));
