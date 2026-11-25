// Netlify Functions 移植版转发代理(源:functions/api/proxy.js,Netlify Functions 2.0 同为 Web 标准 Request/Response)。
// 差异:实例 IP 头用 x-nf-client-connection-ip;无 Cloudflare caches.default(内存限流兜底,cacheCount 已自带 try/catch)。
const OFFICIAL=[/^api\.x\.ai$/,/^api\.openai\.com$/,/^generativelanguage\.googleapis\.com$/,/^ark\.[a-z0-9-]+\.volces\.com$/,/^ark\.[a-z0-9-]+\.bytepluses\.com$/];
const IMG_HOSTS=[/^oaidalleapiprodscus\.blob\.core\.windows\.net$/,/(^|\.)volces\.com$/,/(^|\.)bytepluses\.com$/,/(^|\.)googleusercontent\.com$/,/(^|\.)seedance\.nz$/];
const FORWARD = ['accept', 'content-type', 'authorization', 'x-goog-api-key'];
// 每个 isolate 的内存限流(尽力而为)
const RL=new Map(),WIN=60e3,MAX_API=20,MAX_IMG=40;
function limited(ip,kind){const now=Date.now(),k=kind+'|'+ip;let e=RL.get(k);if(!e||now-e.t>WIN){e={t:now,n:0};RL.set(k,e)}e.n++;
  if(RL.size>5000)for(const[x,v]of RL)if(now-v.t>WIN)RL.delete(x);return e.n>(kind==='img'?MAX_IMG:MAX_API)}
function over(ip,kind){return limited(ip,kind)}
function sameSite(req){const self=new URL(req.url).origin;for(const h of['origin','referer']){const v=req.headers.get(h);if(v){try{return new URL(v).origin===self}catch(e){return false}}}return false}
function clientIp(req){return req.headers.get('x-nf-client-connection-ip')||req.headers.get('cf-connecting-ip')||'0'}
export default async function onRequest(request){
  if(request.method==='OPTIONS')return new Response(null,{status:204});
  if(!['GET','POST'].includes(request.method))return j(405,'只支持 GET / POST');
  if(!sameSite(request))return j(403,'只接受本站页面发起的请求');
  let t;try{t=new URL(request.headers.get('x-target-url')||'')}catch(e){return j(400,'缺少或无效的 x-target-url')}
  if(t.username||t.password)return j(400,'目标地址不能带账号密码');
  const official0=OFFICIAL.some(r=>r.test(t.hostname));
  if(official0?(t.protocol!=='https:'||(t.port&&t.port!=='443')):!/^https?:$/.test(t.protocol))return j(400,official0?'官方接口地址必须是标准 https 地址':'目标地址必须是 http/https 地址');
  const ip=clientIp(request);
  const img=request.headers.get('x-proxy-kind')==='image';
  if(img){if(request.method!=='GET')return j(405,'图片下载只支持 GET');
    if(t.port||!(IMG_HOSTS.some(r=>r.test(t.hostname))||request.headers.get('x-proxy-custom')==='1'))return j(403,'该图片地址不在允许范围内');
    if(over(ip,'img'))return j(429,'请求过于频繁，请稍后再试');
    const r=await fetch(t.toString(),{redirect:'manual'}).catch(()=>null);const ct=r&&r.headers.get('content-type')||'';
    if(!r||!r.ok||!/^image\//.test(ct))return j(502,'结果图片下载失败');return new Response(r.body,{headers:{'content-type':ct,'cache-control':'no-store','x-content-type-options':'nosniff'}})}
  const official=OFFICIAL.some(r=>r.test(t.hostname)),custom=request.headers.get('x-proxy-custom')==='1';
  if(!official&&!custom)return j(403,'该地址不是官方接口；自定义中转需在设置中选择「自定义」');
  const path=t.pathname.replace(/\/+$/,'');
  if(official?!API_PATH.test(path):!/\/(images\/(edits|generations)|image\/generations(\/[^/]+)?|files\/upload|usage\/wallet|openapi\/v\d+\/(run\/ai-app\/\d+|query|media\/upload\/binary)|models(\/[^/]+(:generateContent)?)?)$/.test(path))return j(403,'该路径不允许通过代理转发');
  if(custom&&/^(localhost|127\.|10\.|192\.168\.|169\.254\.|\[)/.test(t.hostname))return j(403,'不能转发到内网地址');
  if(over(ip,'api'))return j(429,'请求过于频繁，请稍后再试');
  const h=new Headers();for(const name of FORWARD)if(request.headers.has(name))h.set(name,request.headers.get(name));
  try{const r=await fetch(t.toString(),{method:request.method,headers:h,...(request.method==='POST'?{body:request.body,duplex:'half'}:{}),redirect:'manual'});
    const oh=new Headers();['content-type'].forEach(k=>r.headers.get(k)&&oh.set(k,r.headers.get(k)));oh.set('cache-control','no-store');
    return new Response(r.body,{status:r.status,headers:oh})}
  catch(e){return j(502,'代理无法连接目标服务')}
}
const API_PATH=/^\/(api\/v3|v\d+(beta|alpha)?)\/(images\/(edits|generations)|models(\/[^/]+(:generateContent)?)?)$/;
const j=(s,m)=>new Response(JSON.stringify({error:{message:m}}),{status:s,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}});
