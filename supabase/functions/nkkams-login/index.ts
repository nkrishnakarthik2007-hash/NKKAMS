import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
function corsPolicy(req:Request){
 const configured=(Deno.env.get("AMS_ALLOWED_ORIGINS")||"").split(",");
 const allowed=new Set([...configured,"https://nkrishnakarthik2007-hash.github.io","http://localhost:8000"].map(x=>x.trim()).filter(Boolean));
 const origin=req.headers.get("Origin"),accepted=!origin||allowed.has(origin);
 const headers=new Headers({"Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type","Access-Control-Allow-Methods":"POST, OPTIONS","Vary":"Origin"});
 if(origin&&accepted)headers.set("Access-Control-Allow-Origin",origin);
 return {accepted,headers};
}

async function applyLoginIpLimit(db:ReturnType<typeof createClient>,req:Request){
 const ip=req.headers.get("cf-connecting-ip")||req.headers.get("x-real-ip")||(req.headers.get("x-forwarded-for")||"").split(",")[0].trim();
 if(!ip)return null;
 const pepper=Deno.env.get("RATE_LIMIT_PEPPER")||Deno.env.get("SUPABASE_URL")||"nkkams";
 const digest=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(pepper+":"+ip));
 const hash=Array.from(new Uint8Array(digest)).map(x=>x.toString(16).padStart(2,"0")).join("");
 const {data,error}=await db.rpc("consume_public_rate_limit",{p_bucket_key:"login:"+hash,p_limit:30,p_window_seconds:600});
 if(error)throw new Error("Login security check is temporarily unavailable.");
 const result=Array.isArray(data)?data[0]:data;
 return result?.allowed===false?Number(result.retry_after_seconds||60):null;
}

const reply=(req:Request,body:unknown,status=200)=>{const policy=corsPolicy(req);policy.headers.set("Content-Type","application/json; charset=utf-8");return new Response(JSON.stringify(body),{status,headers:policy.headers});};
Deno.serve(async (req) => {
 const policy=corsPolicy(req);
 if(req.method==="OPTIONS") return new Response(null,{status:policy.accepted?204:403,headers:policy.headers});
 if(!policy.accepted)return reply(req,{error:"Origin is not allowed."},403);
 if(req.method!=="POST")return reply(req,{error:"Method not allowed."},405);
 try {
  const body=await req.json();
  const employeeId=String(body.employee_id||"").trim().toUpperCase();
  const password=String(body.password||"");
  if(!/^[A-Z0-9]{2,30}$/.test(employeeId)||!password)return reply(req,{error:"Enter your Employee ID and password."},400);
  const url=Deno.env.get("SUPABASE_URL")!, service=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const db=createClient(url,service);
  const ipRetry=await applyLoginIpLimit(db,req);
  if(ipRetry!==null)return reply(req,{error:"Too many sign-in attempts from this network. Please wait a few minutes and try again."},429);
  const {data:profile}=await db.from("profiles").select("id,name,role,is_active,organization_id").eq("employee_id",employeeId).maybeSingle();
  const {data:lock}=await db.from("login_security").select("failed_attempts,locked_until").eq("employee_id",employeeId).maybeSingle();
  if(lock?.locked_until&&new Date(lock.locked_until).getTime()>Date.now()){
    const mins=Math.max(1,Math.ceil((new Date(lock.locked_until).getTime()-Date.now())/60000));
    return reply(req,{error:"Your account is temporarily locked after 5 incorrect password attempts. Try again in about "+mins+" minutes, or contact your administrator."},423);
  }
  const client=createClient(url,Deno.env.get("SUPABASE_ANON_KEY")!);
  const {data,error}=await client.auth.signInWithPassword({email:employeeId.toLowerCase()+"@login.nkkams.invalid",password});
  if(error){
    const {data:failure}=await db.rpc("nkkams_record_login_failure",{p_employee_id:employeeId});
    const result=Array.isArray(failure)?failure[0]:failure;
    const attempts=Number(result?.failed_attempts||0);
    if(result?.newly_locked&&profile){
      let recipients:string[]=[];
      if(["organization_head","super_admin","platform_admin"].includes(profile.role)){
        const {data:websiteAdmins}=await db.from("profiles").select("id").in("role",["super_admin","platform_admin"]).eq("is_active",true);
        recipients=(websiteAdmins||[]).filter(x=>x.id!==profile.id).map(x=>x.id);
      }else if(profile.organization_id){
        const {data:heads}=await db.from("profiles").select("id").eq("organization_id",profile.organization_id).in("role",["organization_head","admin"]).eq("is_active",true);
        recipients=(heads||[]).map(x=>x.id);
      }
      if(recipients.length){
        await db.from("organization_notifications").insert(recipients.map(recipient_user_id=>({
          organization_id:profile.organization_id,
          recipient_user_id,
          notification_type:"security",
          title:"Account temporarily locked",
          message:profile.name+" (Employee ID "+employeeId+") entered an incorrect password 5 times. The account is locked for 30 minutes."
        })));
      }
    }
    if(result?.locked_until&&new Date(result.locked_until).getTime()>Date.now())
      return reply(req,{error:"Your account has been locked for 30 minutes after 5 incorrect password attempts. Contact your organisation head or administrator."},423);
    return reply(req,{error:"Incorrect Employee ID or password. "+Math.max(0,5-attempts)+" attempt(s) remaining before temporary lockout."},401);
  }
  if(profile?.role==="super_admin"&&!profile.is_active){await db.from("profiles").update({is_active:true}).eq("id",profile.id);profile.is_active=true;}
  if(!profile?.is_active){await client.auth.signOut();return reply(req,{error:"This account is inactive. Contact your organisation administrator."},403);}
  if(profile.organization_id){
    const {data:org,error:orgError}=await db.from("organizations").select("status").eq("id",profile.organization_id).maybeSingle();
    if(orgError||!org||org.status!=="active"){await client.auth.signOut();return reply(req,{error:"Your organisation is currently suspended. Contact a Website Admin or Super Admin."},403);}
  }
  await db.rpc("nkkams_clear_login_failures",{p_employee_id:employeeId});
  return reply(req,{access_token:data.session.access_token,refresh_token:data.session.refresh_token,user:{id:data.user.id,name:profile.name,role:profile.role,organization_id:profile.organization_id}});
 } catch(e) { return reply(req,{error:e instanceof Error?e.message:"Sign in failed."},500); }
});