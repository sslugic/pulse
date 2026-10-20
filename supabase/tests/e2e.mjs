const API='http://127.0.0.1:54321', ANON=process.env.ANON, SR=process.env.SR;
let pass=0, fail=0; const ok=(c,m)=>{ c?pass++:fail++; console.log(c?'PASS':'FAIL', m); };
const j = (r) => r.json().catch(()=>null);
// create a user via admin API and sign in with password (stands in for Sign in with Apple)
const email=`t${Date.now()}@pulse.test`, password='Passw0rd!x';
let r = await fetch(`${API}/auth/v1/admin/users`, {method:'POST', headers:{apikey:SR, Authorization:`Bearer ${SR}`,'Content-Type':'application/json'}, body:JSON.stringify({email,password,email_confirm:true})});
const u = await j(r); ok(r.ok && u.id, 'create user');
r = await fetch(`${API}/auth/v1/token?grant_type=password`, {method:'POST', headers:{apikey:ANON,'Content-Type':'application/json'}, body:JSON.stringify({email,password})});
const tok=(await j(r)).access_token; ok(!!tok,'sign in');
const rpc = async (fn, args={}, key=tok) => j(await fetch(`${API}/rest/v1/rpc/${fn}`, {method:'POST', headers:{apikey:ANON, Authorization:`Bearer ${key}`,'Content-Type':'application/json'}, body:JSON.stringify(args)}));
ok(await rpc('my_balance')===50, 'signup bonus = 50');
const ai = (body, t=tok) => fetch(`${API}/functions/v1/ai`, {method:'POST', headers:{Authorization:`Bearer ${t}`,'Content-Type':'application/json'}, body:JSON.stringify(body)});
const payload={contents:[{role:'user',parts:[{text:'hi'}]}]};
r = await ai({feature:'coach', model:'gemini-3.8-flash', method:'generateContent', requestId:'r1', payload});
const body = await j(r); ok(r.status===200 && body.candidates[0].content.parts[0].text.includes('key=test-server-key'), 'proxy forwards with server key');
ok(r.headers.get('x-credits-balance')==='49' && r.headers.get('x-credits-cost')==='1', 'charged 1 credit, header balance 49');
r = await ai({feature:'coach', model:'gemini-3.8-flash', method:'generateContent', requestId:'r1', payload}); ok(r.status===200 && await rpc('my_balance')===49, 'retry with same requestId not charged twice');
r = await ai({feature:'meal_plan', model:'gemini-3.8-flash', method:'streamGenerateContent', requestId:'r2', payload});
const sse = await r.text(); ok(r.status===200 && sse.includes('"Hel"') && sse.includes('"lo"'), 'streaming passes through');
ok(await rpc('my_balance')===48, 'meal_plan (one day) costs 1 -> 48');
await new Promise((res) => setTimeout(res, 1500));
const usage = await j(await fetch(`${API}/rest/v1/ai_usage?user_id=eq.${u.id}&select=*&order=id`, {headers:{apikey:SR, Authorization:`Bearer ${SR}`}}));
ok(Array.isArray(usage) && usage.length===3 && usage[0].prompt_tokens===1000 && usage[0].cached_tokens===600 && usage[0].output_tokens===200 && usage[0].thoughts_tokens===50 && Number(usage[0].cost_usd)>0 && usage[0].credits===1, 'token usage logged (non-streamed)');
ok(usage[1]?.request_id==='r1' && usage[1].credits===0, 'a retried request is logged with 0 credits');
ok(usage[2]?.feature==='meal_plan' && usage[2].prompt_tokens===300 && usage[2].output_tokens===50 && usage[2].credits===1, 'token usage logged from the last streamed chunk');
const mine = await j(await fetch(`${API}/rest/v1/ai_usage?select=id`, {headers:{apikey:ANON, Authorization:`Bearer ${tok}`}}));
ok(Array.isArray(mine) && mine.length===0, 'users cannot read ai_usage');
r = await ai({feature:'coach', model:'gemini-broken', method:'generateContent', requestId:'r3', payload}); ok(r.status===500 && await rpc('my_balance')===48, 'upstream error refunds');
r = await ai({feature:'insight', model:'gemini-3.8-flash', method:'generateContent', requestId:'r4', payload}); ok(r.status===200 && await rpc('my_balance')===48, 'free feature costs 0');
r = await ai({feature:'nope', model:'gemini-3.8-flash', method:'generateContent', requestId:'r5', payload}); ok(r.status===400, 'unknown feature rejected');
r = await ai({feature:'coach', model:'gemini-3.8-flash; rm -rf', method:'generateContent', requestId:'r6', payload}); ok(r.status===400, 'bad model rejected');
r = await ai({feature:'coach', model:'gemini-3.8-flash', method:'generateContent', requestId:'r7', payload}, 'garbage'); ok(r.status===401, 'no/invalid token rejected');
// drain to zero then expect 402
for (let i=0;i<12;i++) await ai({feature:'workout_plan_7d', model:'gemini-3.5-flash-lite', method:'generateContent', requestId:'d'+i, payload});
const bal = await rpc('my_balance'); r = await ai({feature:'workout_plan_7d', model:'gemini-3.5-flash-lite', method:'generateContent', requestId:'x1', payload});
const e402 = await j(r); ok(bal===0 && r.status===402 && e402.error==='insufficient_credits' && e402.balance===0, `7-day plan costs 4; 402 when broke (balance ${bal})`);
// client cannot grant itself credits
const g = await rpc('grant_credits', {uid:u.id, amount:1000, why:'admin', ref_key:'hack'}); ok(await rpc('my_balance')===0, 'client cannot call grant_credits');
// RLS: cannot read another user's ledger
const hook = (event, auth='Bearer test-webhook-secret') => fetch(`${API}/functions/v1/revenuecat-webhook`, {method:'POST', headers:{Authorization:auth,'Content-Type':'application/json'}, body:JSON.stringify({event})});
r = await hook({id:'ev1', type:'NON_RENEWING_PURCHASE', app_user_id:u.id, product_id:'pulse_credits_500', environment:'SANDBOX'}); ok(r.ok && await rpc('my_balance')===500, 'pack purchase +500');
r = await hook({id:'ev1', type:'NON_RENEWING_PURCHASE', app_user_id:u.id, product_id:'pulse_credits_500', environment:'SANDBOX'}); ok(r.ok && await rpc('my_balance')===500, 'replayed event ignored');
r = await hook({id:'ev2', type:'INITIAL_PURCHASE', app_user_id:'$RCAnonymousID:abc', aliases:[u.id], product_id:'pulse_pro_monthly', environment:'SANDBOX', expiration_at_ms: Date.now()+30*864e5}); ok(r.ok && await rpc('my_balance')===1100, 'subscription +600 via alias');
const sub = await j(await fetch(`${API}/rest/v1/subscriptions?select=*`, {headers:{apikey:ANON, Authorization:`Bearer ${tok}`}})); ok(sub.length===1 && sub[0].active===true, 'subscription row active, readable by owner');
r = await hook({id:'ev3', type:'CANCELLATION', cancel_reason:'CUSTOMER_SUPPORT', app_user_id:u.id, product_id:'pulse_credits_500', environment:'SANDBOX'}); ok(r.ok && await rpc('my_balance')===600, 'refund revokes 500');
r = await hook({id:'ev4', type:'INITIAL_PURCHASE', app_user_id:u.id, product_id:'pulse_credits_500'}, 'Bearer wrong'); ok(r.status===401, 'webhook rejects bad secret');
// backup
r = await fetch(`${API}/rest/v1/user_state`, {method:'POST', headers:{apikey:ANON, Authorization:`Bearer ${tok}`,'Content-Type':'application/json', Prefer:'resolution=merge-duplicates'}, body:JSON.stringify({user_id:u.id, data:{hello:1}})}); ok(r.ok, 'save own backup');
r = await fetch(`${API}/rest/v1/user_state`, {method:'POST', headers:{apikey:ANON, Authorization:`Bearer ${tok}`,'Content-Type':'application/json'}, body:JSON.stringify({user_id:'00000000-0000-0000-0000-000000000000', data:{}})}); ok(!r.ok, 'cannot write someone else backup');
// delete account
r = await fetch(`${API}/functions/v1/delete-account`, {method:'POST', headers:{Authorization:`Bearer ${tok}`}}); ok(r.ok, 'delete account');
const left = await j(await fetch(`${API}/rest/v1/credit_ledger?user_id=eq.${u.id}&select=id`, {headers:{apikey:SR, Authorization:`Bearer ${SR}`}})); ok(Array.isArray(left) && left.length===0, 'ledger rows removed with account');
console.log(`\n${pass} passed, ${fail} failed`);
