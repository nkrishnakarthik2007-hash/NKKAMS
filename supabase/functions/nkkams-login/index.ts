import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
const cors = { "Access-Control-Allow-Origin":"*", "Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods":"POST, OPTIONS" };
Deno.serve(async (req) => {
 if(req.method==="OPTIONS") return new Response("ok",{headers:cors});
 try {
  const body=await req.json();
  const employeeId=String(body.employee_id||"").trim().toUpperCase();
  const password=String(body.password||"");
  if(!/^[A-Z0-9]{2,30}$/.test(employeeId)||!password) throw new Error("Enter your Employee ID and password.");
  const client=createClient(Deno.env.get("SUPABASE_URL")!,Deno.env.get("SUPABASE_ANON_KEY")!);
  const {data,error}=await client.auth.signInWithPassword({email:employeeId.toLowerCase()+"@login.nkkams.invalid",password});
  if(error) throw new Error("Incorrect Employee ID or password.");
  const {data:profile,error:profileError}=await client.from("profiles").select("id,name,role,is_active").eq("id",data.user.id).single();
  if(profileError||!profile?.is_active){await client.auth.signOut();throw new Error("This account is inactive. Contact your administrator.");}
  return new Response(JSON.stringify({access_token:data.session.access_token,refresh_token:data.session.refresh_token,user:{id:data.user.id,name:profile.name,role:profile.role}}),{status:200,headers:{...cors,"Content-Type":"application/json"}});
 } catch(e) { return new Response(JSON.stringify({error:e.message||"Sign in failed"}),{status:401,headers:{...cors,"Content-Type":"application/json"}});
 }
});