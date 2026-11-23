import { domainToASCII } from 'node:url';
const types = new Set(['A','AAAA','MX','NS','TXT','CNAME','SOA']);
export default async function handler(req,res) {
  res.setHeader('Cache-Control','no-store');
  if(req.method!=='GET') return res.status(405).json({error:'GET required'});
  const raw=String(req.query.name||'').trim();
  const name=domainToASCII(raw).toLowerCase().replace(/\.$/,'');
  const type=String(req.query.type||'A').toUpperCase();
  if(!types.has(type)||!name||name.length>253||!name.includes('.')||!name.split('.').every(x=>/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(x))) return res.status(400).json({error:'Valid domain and supported record type required'});
  const url=new URL('https://cloudflare-dns.com/dns-query');
  url.searchParams.set('name',name);url.searchParams.set('type',type);
  try {
    const upstream=await fetch(url,{headers:{accept:'application/dns-json'},signal:AbortSignal.timeout(10000)});
    if(!upstream.ok) return res.status(upstream.status===429?429:502).json({error:'Provider HTTP '+upstream.status});
    const data=await upstream.json();
    if(typeof data.Status!=='number') throw new Error('Invalid provider response');
    return res.status(200).json({input:name,queryType:type,provider:'Cloudflare DNS over HTTPS',requestUrl:url.href,retrievedAt:new Date().toISOString(),dnsStatus:data.Status,answers:data.Answer||[],authority:data.Authority||[],authenticatedData:!!data.AD});
  } catch(error) {return res.status(502).json({error:error.name==='TimeoutError'?'Provider timeout':'Provider request failed'});}
}
