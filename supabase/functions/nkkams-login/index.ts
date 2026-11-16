import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsPolicy, jsonResponse } from "../_shared/cors.ts";
Deno.serve(async (req: Request) => {
 const cors=corsPolicy(req);
 if(req.method==="OPTIONS") return new Response(null,{status:cors.accepted?204:403,headers:cors.headers});
 if(!cors.accepted) return jsonResponse(req,{error:"Origin is not allowed."},403);
 if(req.method!=="POST") return jsonResponse(req,{error:"Method not allowed."},405);
 try {
  const body=await req.json();
  const employeeId=String(body.employee_id||"").trim().toUpperCase();
  const password=String(body.password||"");
  if(!/^[A-Z0-9]{2,30}$/.test(employeeId)||!password) return jsonResponse(req,{error:"Enter your Employee ID and password."},400);
  const client=createClient(Deno.env.get("SUPABASE_URL")!,Deno.env.get("SUPABASE_ANON_KEY")!);
  const {data,error}=await client.auth.signInWithPassword({email:employeeId.toLowerCase()+"@login.nkkams.invalid",password});
  if(error||!data.user||!data.session) return jsonResponse(req,{error:"Incorrect Employee ID or password."},401);
  const {data:profile,error:profileError}=await client.from("profiles").select("id,name,role,is_active,organization_id").eq("id",data.user.id).single();
  if(profileError||!profile?.is_active){await client.auth.signOut();return jsonResponse(req,{error:"This account is inactive. Contact your administrator."},403);}
  if(profile.organization_id){
   const {data:org,error:orgError}=await client.from("organizations").select("status").eq("id",profile.organization_id).maybeSingle();
   if(orgError||!org||org.status!=="active"){await client.auth.signOut();return jsonResponse(req,{error:"Your organisation is currently suspended. Contact a Website Admin or Super Admin."},403);}
  }
  return jsonResponse(req,{access_token:data.session.access_token,refresh_token:data.session.refresh_token,user:{id:data.user.id,name:profile.name,role:profile.role}},200);
 } catch(e) {
  return jsonResponse(req,{error:e instanceof Error?e.message:"Sign in failed."},400);
 }
});