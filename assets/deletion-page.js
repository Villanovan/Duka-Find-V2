(() => {
 const $=s=>document.querySelector(s),client=DukaSafety.client(),status=$('#deletionStatus');
 async function paint(){try{const {data,error}=await client.auth.getSession();if(error)throw error;const user=data.session?.user;$('#deletionSignedOut').hidden=!!user;$('#deleteRequest').hidden=!user;$('#deleteIdentity').textContent=user?'Signed in as '+user.email:'';}catch(error){status.textContent=error.message;}}
 $('#deleteGoogle').onclick=async()=>{const {error}=await client.auth.signInWithOAuth({provider:'google',options:{redirectTo:location.origin+location.pathname}});if(error)status.textContent=error.message;};
 $('#deleteSignIn').onsubmit=async event=>{event.preventDefault();const button=event.target.querySelector('button');button.disabled=true;try{const {error}=await client.auth.signInWithPassword({email:$('#deleteEmail').value.trim(),password:$('#deletePassword').value});if(error)throw error;$('#deletePassword').value='';await paint();}catch(error){status.textContent=error.message;}finally{button.disabled=false;}};
 $('#deleteSignOut').onclick=async()=>{await client.auth.signOut();await paint();};
 $('#deleteRequest').onsubmit=async event=>{event.preventDefault();if(!event.target.reportValidity())return;const button=event.target.querySelector('[type=submit]');button.disabled=true;try{const reference=await DukaSafety.rpc('duka_request_deletion');status.textContent='Your deletion request was recorded. Reference: '+reference+'\nThe team will process it after verification. Your account has not yet been deleted. Contact dukafind@gmail.com for status.';}catch(error){status.textContent=error.message;button.disabled=false;}};
 client.auth.onAuthStateChange(()=>setTimeout(paint,0));paint();
})();
