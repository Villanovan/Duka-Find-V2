/* Full owner workspace. Uses existing Supabase tables and the owner's authenticated session. */
let catalogueItems = [];
let catalogueLoaded = false;
let catalogueError = false;
let catalogueLoading = false;
let editingProductId = null;
let selectedProductImage = null;
let selectedProductPreview = null;
let workspaceConversations = [];
let conversationLoadFailed = false;
let shopCoverUrl = '';
let signupStep = 0;
const ui = selector => document.querySelector(selector);
const iconMarkup = name => { const paths={box:'m3 7 9-4 9 4-9 4ZM3 7v10l9 4 9-4V7M12 11v10',check:'m5 12 4 4L19 6',arrow:'M5 12h14m-6-6 6 6-6 6',shop:'M3 9h18M4 9v11h16V9M3 9l2-6h14l2 6M9 20v-6h6v6',image:'M3 3h18v18H3ZM3 17l6-6 5 5 3-3 4 4M16 7h1'};return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${paths[name]||paths.box}"/></svg>`; };
const safe = value => escapeHtml(String(value ?? ''));
const priceLabel = value => `UGX ${new Intl.NumberFormat('en-UG',{maximumFractionDigits:2}).format(Number(value)||0)}`;
const safeImageUrl = value => {if(!value || !String(value).trim())return '';try {const url=new URL(value,location.href);return ['https:','http:','blob:'].includes(url.protocol)?url.href:'';}catch{return '';}};
const imageMarkup = (url,alt='') => safeImageUrl(url)?`<img src="${safe(safeImageUrl(url))}" alt="${safe(alt)}" loading="lazy">`:`<div class="product-placeholder">${iconMarkup('image')}</div>`;
const blankState = (title,copy,button='') => `<div class="empty-state"><div class="es-icon">${iconMarkup('box')}</div><h3>${safe(title)}</h3><p>${safe(copy)}</p>${button}</div>`;
function activateScreen(root){setRoot(root);ui('.view.root.active')?.scrollTo({top:0});}
function bindDynamicNavigation(parent){parent.querySelectorAll('[data-go]').forEach(button=>button.addEventListener('click',()=>{activateScreen(button.dataset.go);if(button.dataset.profileTab)selectProfileTab(button.dataset.profileTab);}));}
function selectProfileTab(tab){document.querySelectorAll('[data-profile-tab][role=tab]').forEach(button=>{const active=button.dataset.profileTab===tab;button.classList.toggle('active',active);button.setAttribute('aria-selected',String(active));button.tabIndex=active?0:-1;});document.querySelectorAll('#view-profile [role=tabpanel]').forEach(panel=>panel.hidden=panel.id!=='profile-'+tab);}
function refreshWorkspace(){
 if(!currentShop)return;
 const name=currentUser?.user_metadata?.full_name || currentUser?.email?.split('@')[0] || 'Owner';
 ui('#workspaceShopName').textContent=currentShop.business_name||'Your shop';
 ui('#workspaceStatus').textContent=currentShop.verified?'Verified shop':'Pending business verification';
 ui('#ownerDisplayName').textContent=name;ui('#ownerAvatar').textContent=name.charAt(0).toUpperCase();
 ui('#summaryShopName').textContent=currentShop.business_name||'Your shop';ui('#summaryLocation').textContent=currentShop.location||'Add your shop location';
 ui('#summaryDelivery').textContent=currentShop.delivery_policy||'Your local community is waiting to find you.';
 ui('#summaryStatus').textContent=currentShop.verified?'Verified shop':'Pending review';ui('#summaryStatus').className='verified-badge '+(currentShop.verified?'ok':'pending');
 ui('#summaryKeywords').innerHTML=(currentShop.keywords||'').split(',').map(s=>s.trim()).filter(Boolean).slice(0,8).map(s=>`<span>${safe(s)}</span>`).join('');
 const pinned=Number.isFinite(Number(currentShop.latitude))&&currentShop.latitude!==null&&currentShop.latitude!==undefined&&Number.isFinite(Number(currentShop.longitude))&&currentShop.longitude!==null&&currentShop.longitude!==undefined;
 ui('#viewPinnedLocation').hidden=!pinned;if(pinned)ui('#viewPinnedLocation').href=`https://www.openstreetmap.org/?mlat=${encodeURIComponent(currentShop.latitude)}&mlon=${encodeURIComponent(currentShop.longitude)}#map=16/${encodeURIComponent(currentShop.latitude)}/${encodeURIComponent(currentShop.longitude)}`;
 ui('#profileSaveHint').textContent='Your shop, kept up to date.';
 refreshVerification();refreshSettings();refreshOverview();
}
async function loadCatalogue(){
 if(!currentShop||catalogueLoading)return;
 catalogueLoading=true;catalogueError=false;ui('#productList').innerHTML='<div class="panel" aria-label="Loading products"><div class="loading-line"></div><div class="loading-line"></div><div class="loading-line"></div></div>';
 try{const {data,error}=await sb.from('products').select('*').eq('shop_id',currentShop.id).order('created_at',{ascending:false});if(error)throw error;catalogueItems=data||[];catalogueLoaded=true;paintCatalogue();refreshOverview();}
 catch(error){catalogueError=true;ui('#catalogueCount').textContent='Products unavailable';ui('#productList').innerHTML=blankState('Couldn’t load your products','Check your connection, then try again.','<button class="btn btn-secondary" id="retryCatalogue">Try again</button>');ui('#retryCatalogue').onclick=loadCatalogue;console.error(error);}
 finally{catalogueLoading=false;}
}
function paintCatalogue(){
 const search=ui('#productSearch').value.trim().toLocaleLowerCase();const filter=ui('#productFilter').value;
 const rows=catalogueItems.filter(p=>(`${p.name||''} ${p.description||''}`).toLocaleLowerCase().includes(search)&&(filter==='all'||filter==='negotiable'&&p.negotiable||filter==='fixed'&&!p.negotiable));
 ui('#catalogueCount').textContent=`${catalogueItems.length} product${catalogueItems.length===1?'':'s'} in your catalogue`;
 const host=ui('#productList');
 if(!catalogueItems.length){host.innerHTML=blankState('Your shelves are ready.','Add your first product and give customers something to discover.','<button class="btn btn-primary" id="emptyAddProduct">+ Add your first product</button>');ui('#emptyAddProduct').onclick=()=>openProductEditor();return;}
 if(!rows.length){host.innerHTML=blankState('No matching products','Try a different name or change your filter.');return;}
 host.innerHTML=`<div class="table-scroll"><table class="product-table"><thead><tr><th scope="col">Product</th><th scope="col">Price</th><th scope="col">Pricing</th><th scope="col">Actions</th></tr></thead><tbody>${rows.map(product=>`<tr><td><div class="product-cell">${imageMarkup(product.image_url,product.name)}<div><strong>${safe(product.name)}</strong><small>${safe(product.description||'No description yet')}</small></div></div></td><td class="product-price">${priceLabel(product.price)}</td><td><span class="price-type ${product.negotiable?'negotiable':''}">${product.negotiable?'Negotiable':'Fixed price'}</span></td><td><div class="table-actions"><button class="btn btn-secondary" data-edit="${safe(product.id)}" aria-label="Edit ${safe(product.name)}">Edit</button><button class="delete-product" data-delete="${safe(product.id)}" aria-label="Delete ${safe(product.name)}">Delete</button></div></td></tr>`).join('')}</tbody></table></div>`;
 host.querySelectorAll('[data-edit]').forEach(button=>button.onclick=()=>openProductEditor(catalogueItems.find(p=>String(p.id)===button.dataset.edit)));
 host.querySelectorAll('[data-delete]').forEach(button=>button.onclick=()=>deleteProduct(catalogueItems.find(p=>String(p.id)===button.dataset.delete)));
}
function closeProductEditor(){
 ui('#catalogueScreen').hidden=false;ui('#productEditor').hidden=true;editingProductId=null;selectedProductImage=null;if(selectedProductPreview)URL.revokeObjectURL(selectedProductPreview);selectedProductPreview=null;ui('#prodImage').value='';
}
function openProductEditor(product=null){
 editingProductId=product?.id||null;selectedProductImage=null;if(selectedProductPreview)URL.revokeObjectURL(selectedProductPreview);selectedProductPreview=null;
 ui('#catalogueScreen').hidden=true;ui('#productEditor').hidden=false;ui('#productEditor h1').textContent=product?'Give it a little update.':'Add a new product.';
 ui('#prodName').value=product?.name||'';ui('#prodPrice').value=product?.price??'';ui('#prodDesc').value=product?.description||'';ui('#prodNegotiable').checked=!!product?.negotiable;ui('#prodImage').value='';ui('#prodThumb').innerHTML='';ui('#productFormStatus').textContent='';
 prodImageUrl=product?.image_url||'';paintProductHero(prodImageUrl);activateScreen('products');if(matchMedia('(min-width:720px)').matches)ui('#prodName').focus({preventScroll:true});
}
function paintProductHero(url){ui('#productHero').innerHTML=safeImageUrl(url)?imageMarkup(url,'Product photo'):iconMarkup('image')+'<span>Your product photo</span>';}
async function saveCatalogueProduct(){
 if(!(await DukaSafety.ensureAccepted()))return;
 if(!currentShop||!currentUser)return;
 const name=ui('#prodName'),price=ui('#prodPrice');if(!name.value.trim()){name.reportValidity();name.focus();return;}if(price.value===''||!price.reportValidity())return;
 const amount=Number(price.value);if(!Number.isFinite(amount)||amount<0){toast('Enter a valid price.');return;}
 const button=ui('#addProduct');button.disabled=true;ui('#productFormStatus').textContent=selectedProductImage?'Uploading your photo…':'Saving your product…';
 try{
 let url=prodImageUrl;if(selectedProductImage)url=await uploadImage(selectedProductImage,'product-images');
 const values={name:name.value.trim(),price:amount,description:ui('#prodDesc').value.trim(),image_url:url||null,negotiable:ui('#prodNegotiable').checked};
 const query=editingProductId?sb.from('products').update(values).eq('id',editingProductId).eq('shop_id',currentShop.id):sb.from('products').insert({...values,shop_id:currentShop.id});
 const {error}=await query;if(error)throw error;toast(editingProductId?'Product updated':'Product added');closeProductEditor();await loadCatalogue();
 }catch(error){ui('#productFormStatus').textContent='Could not save this product. Your details are still here—please try again.';console.error(error);}
 finally{button.disabled=false;}
}
async function deleteProduct(product){
 if(!product)return;const dialog=ui('#deleteDialog');ui('#deleteDescription').textContent=`“${product.name}” will be removed from your shop. This can’t be undone here.`;dialog.returnValue='';dialog.showModal();
 const answer=await new Promise(resolve=>dialog.addEventListener('close',()=>resolve(dialog.returnValue),{once:true}));if(answer!=='confirm')return;
 try{const {error}=await sb.from('products').delete().eq('id',product.id).eq('shop_id',currentShop.id);if(error)throw error;toast('Product deleted');await loadCatalogue();}catch(error){toast('Could not delete the product. Please try again.');console.error(error);}
}
function refreshOverview(){
 if(!currentShop)return;
 ui('#statProducts').textContent=catalogueError?'—':catalogueLoaded?catalogueItems.length:'…';
 const complete=!!currentShop.verified;
 ui('#overviewVerification').classList.toggle('verified',complete);
 ui('#overviewVerificationTitle').textContent=complete?'Your shop is verified. Welcome to the neighbourhood.':'Your shop is pending review';
 ui('#overviewVerificationText').textContent=complete?'Keep your details fresh and your catalogue ready for customers.':'You can keep building your catalogue while your business is reviewed.';
 const checklist=[{name:'Add your business details',done:!!currentShop.business_name&&!!currentShop.category,root:'profile',tab:'details'},{name:'Pin your shop location',done:currentShop.latitude!=null&&currentShop.longitude!=null,root:'profile',tab:'location'},{name:'Add your first product',done:catalogueItems.length>0,root:'products'},{name:'Get your business verified',done:complete,root:'verification'}];
 const done=checklist.filter(c=>c.done).length;ui('#completionLabel').textContent=`${done} of 4 complete`;ui('#completionBar').style.width=done*25+'%';
 ui('#setupChecklist').innerHTML=checklist.map((c,i)=>`<button class="checklist-row ${c.done?'complete':''}" data-go="${c.root}" ${c.tab?`data-profile-tab="${c.tab}"`:''}><span class="check-circle">${c.done?iconMarkup('check'):i+1}</span><span>${c.name}</span><span class="row-arrow">→</span></button>`).join('');bindDynamicNavigation(ui('#setupChecklist'));
 const latest=catalogueItems.slice(0,4);ui('#recentProducts').innerHTML=latest.length?latest.map(p=>`<button class="recent-product" data-recent-product="${safe(p.id)}">${imageMarkup(p.image_url,p.name)}<strong>${safe(p.name)}</strong><span>${priceLabel(p.price)}</span></button>`).join(''):`<div class="empty-inline"><strong>${catalogueError?'Products unavailable':'Your first product belongs here.'}</strong>${catalogueError?'Open Products to retry.':'Add something lovely to your catalogue.'}</div>`;
 ui('#recentProducts').querySelectorAll('[data-recent-product]').forEach(button=>button.onclick=()=>openProductEditor(catalogueItems.find(p=>String(p.id)===button.dataset.recentProduct)));
}
async function loadOverviewConversations(){
 if(!currentShop)return;
 try{const {data,error}=await sb.from('conversations').select('id, customer_id, owner_last_read_at, profiles(full_name), messages(sender_role, body, image_url, created_at)').eq('shop_id',currentShop.id).order('created_at',{ascending:false});if(error)throw error;workspaceConversations=data||[];conversationLoadFailed=false;paintOverviewConversations();}
 catch(error){conversationLoadFailed=true;ui('#statConversations').textContent='—';ui('#statUnread').textContent='—';ui('#recentConversations').innerHTML='<div class="empty-inline">Conversations are unavailable. Open Messages to try again.</div>';console.error(error);}
}
function paintOverviewConversations(){
 const rows=workspaceConversations.map(c=>{const msgs=[...(c.messages||[])].sort((a,b)=>new Date(a.created_at)-new Date(b.created_at));const last=msgs.at(-1);const unread=last?.sender_role==='customer'&&(!c.owner_last_read_at||new Date(last.created_at)>new Date(c.owner_last_read_at));return {...c,last,unread};}).sort((a,b)=>new Date(b.last?.created_at||0)-new Date(a.last?.created_at||0));
 ui('#statConversations').textContent=rows.length;ui('#statUnread').textContent=rows.filter(c=>c.unread).length;
 ui('#recentConversations').innerHTML=rows.length?rows.slice(0,3).map(c=>{const name=c.profiles?.full_name||'Customer';return `<button class="mini-conversation" data-recent-chat="${safe(c.id)}"><span class="avatar">${safe(name.charAt(0).toUpperCase())}</span><div><strong>${safe(name)}</strong><p>${safe(c.last?.body||(c.last?.image_url?'Photo attached':'Start a conversation'))}</p></div><small>${c.unread?'● New':c.last?new Date(c.last.created_at).toLocaleDateString([],{month:'short',day:'numeric'}):''}</small></button>`;}).join(''):'<div class="empty-inline"><strong>Your next conversation starts here.</strong>When a customer writes, their message will appear here.</div>';
 ui('#recentConversations').querySelectorAll('[data-recent-chat]').forEach(button=>button.onclick=()=>{const c=rows.find(c=>String(c.id)===button.dataset.recentChat);activateScreen('messages');openChat(c.id,c.profiles?.full_name||'Customer');});
}
function refreshVerification(){
 if(!currentShop)return;const verified=!!currentShop.verified;
 ui('#verificationBadge').textContent=verified?'Verified':'Pending review';ui('#reviewTimeline').className=verified?'complete':'current';ui('#verifiedTimeline').className=verified?'complete':'';
 ui('#reviewTimelineText').textContent=verified?'Your business review is complete.':'Your business details are waiting to be verified.';
 const entries=[['Business name',currentShop.business_name],['Username','@'+(currentShop.username||'')],['Category',currentShop.category],['TIN',currentShop.tin_number],['Location',currentShop.location]];
 ui('#verificationDetails').innerHTML=entries.map(([name,value])=>`<div><dt>${name}</dt><dd>${safe(value||'Not added')}</dd></div>`).join('');
}
function refreshSettings(){
 if(!currentUser)return;const name=currentUser.user_metadata?.full_name||currentUser.email?.split('@')[0]||'Owner';ui('#settingsName').textContent=name;ui('#settingsAvatar').textContent=name.charAt(0).toUpperCase();ui('#settingsEmail').textContent=currentUser.email||'';if(document.activeElement!==ui('#settingsFullName'))ui('#settingsFullName').value=currentUser.user_metadata?.full_name||'';ui('#settingsEmailStatus').textContent=currentUser.email_confirmed_at?'Your sign-in email is confirmed.':'Email confirmation is not recorded for this account.';
}
async function loadShopCover(){if(!currentShop)return;try{const {data,error}=await sb.from('shop_images').select('*').eq('shop_id',currentShop.id).order('sort_order');if(error)return;shopCoverUrl=data?.[0]?.url||'';if(shopCoverUrl)ui('#shopCover').innerHTML=imageMarkup(shopCoverUrl,'Your shop premises');}catch{}}
function updateSignupReview(){const rows=[['Your name',ui('#suName').value],['Email',ui('#suEmail').value],['Business name',ui('#suBusiness').value],['Username','@'+ui('#suUsername').value],['Category',ui('#suCategory').selectedOptions[0]?.textContent],['TIN',ui('#suTin').value],['Location',ui('#suLocation').value]];ui('#signupReview').innerHTML=rows.map(([k,v])=>`<div><span>${k}</span><strong>${safe(v)}</strong></div>`).join('');}
function drawSignup(){document.querySelectorAll('.signup-step').forEach((panel,i)=>panel.hidden=i!==signupStep);document.querySelectorAll('.signup-progress li').forEach((li,i)=>{li.className=i===signupStep?'current':i<signupStep?'done':'';if(i===signupStep)li.setAttribute('aria-current','step');else li.removeAttribute('aria-current');});ui('#signupBack').hidden=signupStep===0;ui('#signupNext').hidden=signupStep===3;ui('#signupSubmit').hidden=signupStep!==3;if(signupStep===3)updateSignupReview();}
async function sendResetEmail(email,feedback){
 if(!sb){feedback('Could not connect to the sign-in service. Please reload.');return;}
 feedback('Sending your password reset link…');
 try{const {error}=await sb.auth.resetPasswordForEmail(email,{redirectTo:location.origin+location.pathname});if(error)throw error;feedback('If an account exists for that email, a reset link will arrive shortly.');}catch(error){feedback(error.message||'Could not send the reset email.');}
}
// Screen interactions.
ui('#view-overview .screen-heading [data-root="products"]').addEventListener('click',()=>openProductEditor());
ui('#newProduct').onclick=()=>openProductEditor();ui('#backToCatalogue').onclick=ui('#cancelProduct').onclick=closeProductEditor;ui('#refreshProducts').onclick=loadCatalogue;ui('#productSearch').oninput=paintCatalogue;ui('#productFilter').onchange=paintCatalogue;ui('#addProduct').onclick=saveCatalogueProduct;
function handleProductPhotoSelection(event){const file=event.target.files[0];if(!file)return;event.target.value='';if(!file.type.startsWith('image/')){toast('Choose an image file.');return;}if(file.size>10*1024*1024){toast('Choose a photo smaller than 10 MB.');return;}selectedProductImage=file;if(selectedProductPreview)URL.revokeObjectURL(selectedProductPreview);selectedProductPreview=URL.createObjectURL(file);paintProductHero(selectedProductPreview);ui('#prodThumb').innerHTML='';}
ui('#prodImage').addEventListener('change',handleProductPhotoSelection);
ui('#productCameraInput').addEventListener('change',handleProductPhotoSelection);
document.querySelectorAll('[data-profile-tab][role=tab]').forEach((button,index,buttons)=>{button.onclick=()=>selectProfileTab(button.dataset.profileTab);button.onkeydown=event=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;event.preventDefault();const target=event.key==='Home'?0:event.key==='End'?buttons.length-1:(index+(event.key==='ArrowRight'?1:buttons.length-1))%buttons.length;buttons[target].click();buttons[target].focus();};});selectProfileTab('details');
document.querySelectorAll('#view-profile input:not([type=file]),#view-profile select').forEach(input=>input.addEventListener('input',()=>ui('#profileSaveHint').textContent='You have unsaved changes.'));

ui('#signupNext').onclick=()=>{const current=document.querySelectorAll('.signup-step')[signupStep];for(const control of current.querySelectorAll('input,select')){if(!control.reportValidity())return;}signupStep=Math.min(3,signupStep+1);drawSignup();};ui('#signupBack').onclick=()=>{signupStep=Math.max(0,signupStep-1);drawSignup();};ui('#signupForm').addEventListener('keydown',event=>{if(event.key==='Enter'&&signupStep<3&&event.target.tagName!=='BUTTON'){event.preventDefault();ui('#signupNext').click();}});ui('#signupForm').addEventListener('invalid',event=>{const panels=[...document.querySelectorAll('.signup-step')];const index=panels.findIndex(p=>p.contains(event.target));if(index>=0){signupStep=index;drawSignup();}},true);ui('#suCategory').required=true;drawSignup();
ui('#switchToSignup').onclick=()=>ui('[data-tab=signup]').click();
['loginPassword','suPassword','newPassword'].forEach(id=>{const input=ui('#'+id);const control=document.createElement('div');control.className='password-control';input.before(control);const toggle=document.createElement('button');toggle.type='button';toggle.textContent='Show';toggle.setAttribute('aria-label','Show password');toggle.onclick=()=>{const shown=input.type==='password';input.type=shown?'text':'password';toggle.textContent=shown?'Hide':'Show';toggle.setAttribute('aria-label',shown?'Hide password':'Show password');};control.append(input,toggle);});
ui('#forgotPassword').onclick=()=>{const input=ui('#loginEmail');if(!input.value||!input.reportValidity()){showAuthMsg('Enter your email address above, then choose Forgot password.','error');input.focus();return;}sendResetEmail(input.value.trim(),message=>showAuthMsg(message,'success'));};
ui('#settingsResetPassword').onclick=async()=>{const button=ui('#settingsResetPassword');button.disabled=true;await sendResetEmail(currentUser.email,toast);button.disabled=false;};
ui('#saveAccountName').onclick=async()=>{const name=ui('#settingsFullName').value.trim();if(!name){toast('Enter your full name first.');return;}const button=ui('#saveAccountName');button.disabled=true;try{const {data,error}=await sb.auth.updateUser({data:{full_name:name}});if(error)throw error;currentUser=data.user;const result=await sb.from('profiles').update({full_name:name}).eq('id',currentUser.id);refreshWorkspace();toast(result.error?'Account name saved; the customer-facing profile could not be updated.':'Your name is updated');}catch(error){toast(error.message||'Could not update your name.');}finally{button.disabled=false;}};
ui('#settingsSignOut').onclick=()=>ui('#logoutBtn')?.click();
function applyPreferences(){let compact=false,tips=true;try{compact=localStorage.getItem('duka_compact_products')==='true';tips=localStorage.getItem('duka_setup_tips')!=='false';}catch{}ui('#compactProducts').checked=compact;ui('#showSetupTips').checked=tips;document.body.classList.toggle('compact-list',compact);ui('#setupChecklist').closest('.panel').hidden=!tips;}
ui('#compactProducts').onchange=()=>{try{localStorage.setItem('duka_compact_products',String(ui('#compactProducts').checked));}catch{}applyPreferences();};ui('#showSetupTips').onchange=()=>{try{localStorage.setItem('duka_setup_tips',String(ui('#showSetupTips').checked));}catch{}applyPreferences();};applyPreferences();
ui('#updatePassword').onclick=async()=>{const input=ui('#newPassword');if(!input.reportValidity())return;const button=ui('#updatePassword');button.disabled=true;try{const {error}=await sb.auth.updateUser({password:input.value});if(error)throw error;input.value='';ui('#passwordDialog').close();toast('Password updated.');}catch(error){ui('#passwordUpdateStatus').textContent=error.message||'Could not update your password.';}finally{button.disabled=false;}};
if(sb?.auth?.onAuthStateChange)sb.auth.onAuthStateChange(event=>{if(event==='PASSWORD_RECOVERY')setTimeout(()=>{if(!ui('#passwordDialog').open)ui('#passwordDialog').showModal();},0);});
// Do not start an authenticated workspace until all screen functions are loaded.
(async()=>{
 try{if(sb){const {data:{session},error}=await sb.auth.getSession();if(error)throw error;if(session){await bootDashboard();if(currentShop){await Promise.allSettled([loadOverviewConversations(),loadShopCover()]);refreshWorkspace();}}}}
 catch(error){showAuthMsg('Could not load your account. Check your connection and try again.','error');console.error(error);}
 finally{ui('#splashScreen').classList.add('hide');}
})();

// Each user gesture opens only the chosen native picker. Camera capture remains separate from library upload.
document.querySelectorAll('[data-photo-input]').forEach(button=>button.addEventListener('click',()=>{
 const chooser=ui('#photoSourceDialog');
 if(chooser.open)chooser.close();
 ui('#'+button.dataset.photoInput).click();
}));
ui('#closePhotoSource').onclick=ui('#cancelPhotoSource').onclick=()=>ui('#photoSourceDialog').close();
ui('#photoSourceDialog').addEventListener('click',event=>{if(event.target!==event.currentTarget)return;const rect=event.currentTarget.getBoundingClientRect();if(event.clientX<rect.left||event.clientX>rect.right||event.clientY<rect.top||event.clientY>rect.bottom)event.currentTarget.close();});

// Foreground delivery: refresh this owner's inbox for authorised database events.
let ownerInboxChannel=null,ownerInboxShop=null,ownerInboxTimer=null;
function watchOwnerInbox(){
 if(!currentShop||!currentUser||!sb)return;
 if(ownerInboxChannel&&ownerInboxShop===String(currentShop.id))return;
 if(ownerInboxChannel)sb.removeChannel(ownerInboxChannel);
 ownerInboxShop=String(currentShop.id);
 const refresh=()=>{clearTimeout(ownerInboxTimer);ownerInboxTimer=setTimeout(()=>{if(currentShop&&String(currentShop.id)===ownerInboxShop){renderConvList();loadOverviewConversations();}},180);};
 ownerInboxChannel=sb.channel('owner-inbox-'+currentShop.id)
  .on('postgres_changes',{event:'*',schema:'public',table:'conversations',filter:'shop_id=eq.'+currentShop.id},refresh)
  .on('postgres_changes',{event:'INSERT',schema:'public',table:'messages'},refresh)
  .subscribe();
}
