// Supabase's per-request row limit must never silently truncate season standings.
export async function readAllNflRows<T>(page: (from:number,to:number)=>PromiseLike<{data:T[]|null;error:{message:string}|null}>) {
  const data:T[]=[];
  for(let from=0;from<100_000;from+=500){
    const result=await page(from,from+499);
    if(result.error) throw new Error(result.error.message);
    data.push(...result.data || []);
    if((result.data?.length || 0)<500) return {data,error:null};
  }
  throw new Error('NFL result set exceeds the safe refresh limit; no partial standings should be published.');
}
