const RESOURCE_RE = /^(?:AS)?(\d{1,10})$|^((?:\d{1,3}\.){3}\d{1,3})$|^([0-9a-f:]+:[0-9a-f:]+)$/i;
export default async function handler(req,res) {
  res.setHeader('Cache-Control','no-store');
  if(req.method!=='GET') return res.status(405).json({error:'GET required'});
  const raw=String(req.query.resource||'').trim();
  const asn=raw.match(/^as(\d{1,10})$/i)?.[1];
  const resource=asn?`AS${asn}`:raw;
  if(!resource||resource.length>128||!RESOURCE_RE.test(resource)) return res.status(400).json({error:'Valid IPv4, IPv6, or ASN required'});
  const url=new URL('https://stat.ripe.net/data/asn-overview/data.json');
  url.searchParams.set('resource',resource);
  try {
    const upstream=await fetch(url,{headers:{accept:'application/json'},signal:AbortSignal.timeout(12000)});
    if(!upstream.ok) return res.status(upstream.status===429?429:502).json({error:'Provider HTTP '+upstream.status});
    const data=await upstream.json();
    if(!data||typeof data!=='object'||!data.data) throw new Error('Invalid provider response');
    return res.status(200).json({input:resource,provider:'RIPEstat',requestUrl:url.href,retrievedAt:new Date().toISOString(),data:data.data});
  } catch(error) {return res.status(502).json({error:error.name==='TimeoutError'?'Provider timeout':'Provider request failed'});}
}
