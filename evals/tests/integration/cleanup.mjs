// A stopped client/broker returns no receipt; the owned authority must verify shutdown.
export async function closeIntegrationResources({client,broker,environment}) {
  const errors=[];let authority=null;
  for(const [kind,resource] of [['client',client],['broker',broker],['authority',environment]]) {
    if (!resource) continue;
    try {
      const receipt=await resource.close();
      if (kind==='authority') {
        authority=receipt??null;
        if (receipt?.ok!==true) errors.push(`authority: ${receipt?.errors?.join('; ')||'shutdown receipt missing or incomplete'}`);
      } else if (receipt?.ok===false) errors.push(`${kind}: shutdown was not verified`);
    } catch(error) {errors.push(`${kind}: ${error.message}`);}
  }
  return {ok:errors.length===0,errors,authority};
}
