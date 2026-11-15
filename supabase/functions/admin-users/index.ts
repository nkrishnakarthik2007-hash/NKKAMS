// Privileged user management. The service-role key stays in Supabase secrets.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

function corsPolicy(request: Request, methods = "POST, OPTIONS") {
  const configured = (Deno.env.get("AMS_ALLOWED_ORIGINS") || "").split(",");
  const allowed = new Set([...configured, "https://nkrishnakarthik2007-hash.github.io", "http://localhost:8000"].map(origin => origin.trim()).filter(Boolean));
  const origin = request.headers.get("Origin");
  const accepted = !origin || allowed.has(origin);
  const headers = new Headers({"Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type","Access-Control-Allow-Methods":methods,"Vary":"Origin"});
  if (origin && accepted) headers.set("Access-Control-Allow-Origin", origin);
  return {accepted, headers};
}
function jsonResponse(request: Request, body: unknown, status = 200, methods = "POST, OPTIONS") {
  const {accepted, headers} = corsPolicy(request, methods);
  headers.set("Content-Type","application/json; charset=utf-8");
  if (!accepted) return new Response(JSON.stringify({error:"Origin is not allowed."}),{status:403,headers});
  return new Response(JSON.stringify(body),{status,headers});
}


const loginEmail=(employeeId:string)=>`${employeeId.toUpperCase()}@login.nkkams.invalid`;
const passwordIsStrong=(value:string)=>value.length>=8&&/[A-Z]/.test(value)&&/[a-z]/.test(value)&&/\d/.test(value)&&/[^A-Za-z0-9]/.test(value);
const duplicateIdMessage="An account already uses this Employee ID. Enter a unique Employee ID.";

Deno.serve(async req=>{
  const policy=corsPolicy(req);
  if(req.method==="OPTIONS")return new Response(null,{status:policy.accepted?204:403,headers:policy.headers});
  const json=(value:unknown,status=200)=>jsonResponse(req,value,status);
  if(!policy.accepted)return json({error:"Origin is not allowed."},403);
  if(req.method!=="POST")return json({error:"Method not allowed"},405);
  let body:{action?:string;role?:string;employee_id?:string;name?:string;email?:string;phone?:string;password?:string;active?:boolean;message?:string;request_id?:string;status?:string};
  try{body=await req.json()}catch{return json({error:"Request body must be valid JSON."},400)}
  const employeeId=String(body.employee_id||"").trim().toUpperCase();
  const db=createClient(Deno.env.get("SUPABASE_URL")!,Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  if(body.action==="bootstrap_status"){
    const {count,error}=await db.from("profiles").select("id",{count:"exact",head:true});
    if(error)return json({error:"Could not check setup status."},503);
    return json({bootstrap_available:(count||0)===0});
  }
  if(body.action==="public_admin_contacts"){
    const {data,error}=await db.from("admin_contacts").select("name,whatsapp,email").eq("is_active",true).order("name");
    if(error)return json({error:"Could not load administrator contacts."},503);
    return json({contacts:data||[]});
  }
  if(body.action==="submit_reset_request"){
    const id=String(body.employee_id||"").trim().toUpperCase();
    const message=String(body.message||"").trim().slice(0,500);
    if(!/^[A-Z0-9]{2,30}$/.test(id))return json({error:"Enter a valid Employee ID."},400);
    const {data:person}=await db.from("profiles").select("id,employee_id").eq("employee_id",id).maybeSingle();
    if(person){
      const {error}=await db.from("password_reset_requests").insert({requester_user_id:person.id,employee_id:person.employee_id,message});
      if(error && !/duplicate|unique/i.test(error.message))return json({error:"Could not submit the request. Please contact an administrator."},503);
    }
    return json({ok:true,message:"If the Employee ID is registered, the administrator has received your request."},202);
  }
  // One-time bootstrap: allowed only while the new project has no profiles.
  if(body.action==="bootstrap_super_admin"){
    const {count,error:countError}=await db.from("profiles").select("id",{count:"exact",head:true});
    if(countError)return json({error:"Could not verify first-time setup status."},503);
    if((count||0)>0)return json({error:"Initial administrator setup has already been completed. Sign in instead."},409);
    const name=String(body.name||"").trim(),password=String(body.password||"");
    if(!/^[A-Z0-9]{2,30}$/.test(employeeId))return json({error:"Employee ID must contain 2 to 30 letters or numbers."},400);
    if(!name||name.length>100)return json({error:"Enter a valid administrator name."},400);
    if(password.length<12||!/[A-Z]/.test(password)||!/[a-z]/.test(password)||!/[0-9]/.test(password)||!/[^A-Za-z0-9]/.test(password))return json({error:"Password must be at least 12 characters and include uppercase, lowercase, number, and special character."},400);
    const {data:created,error:createError}=await db.auth.admin.createUser({email:loginEmail(employeeId),password,email_confirm:true,user_metadata:{employee_id:employeeId,name}});
    if(createError)return json({error:/already registered|already exists|duplicate/i.test(createError.message)?"This Employee ID already has a login. Contact support.":"Could not create the administrator account. Try again."},400);
    const {error:profileInsertError}=await db.from("profiles").insert({id:created.user.id,employee_id:employeeId,name,role:"super_admin",is_active:true});
    if(profileInsertError){await db.auth.admin.deleteUser(created.user.id);return json({error:"Could not save administrator profile. No account was retained."},500);}
    return json({ok:true},201);
  }

  const token=(req.headers.get("Authorization")||"").replace(/^Bearer\s+/i,"");
  const{data:{user},error:authError}=await db.auth.getUser(token);
  if(authError||!user)return json({error:"Sign in to continue."},401);
  const{data:me,error:profileError}=await db.from("profiles").select("role,is_active").eq("id",user.id).single();
  if(profileError||!me?.is_active||!["admin","super_admin"].includes(me.role))return json({error:"You do not have permission to manage accounts."},403);
  const isSuper=me.role==="super_admin";
  if(body.action==="list_users"){
    const {data,error}=await db.from("profiles").select("employee_id,name,role,is_active,email,phone,created_at").order("created_at");
    if(error)return json({error:"Could not load user accounts."},503);
    return json({users:data||[]});
  }
  if(body.action==="list_reset_requests"){
    const {data,error}=await db.from("password_reset_requests").select("id,employee_id,message,status,created_at").order("created_at",{ascending:false});
    if(error)return json({error:"Could not load reset requests."},503);
    return json({requests:data||[]});
  }
  if(body.action==="update_reset_request"){
    const requestId=String(body.request_id||"");
    const status=String(body.status||"");
    if(!/^[0-9a-f-]{36}$/i.test(requestId)||!["pending","reviewed","resolved","rejected"].includes(status))return json({error:"Invalid reset request update."},400);
    const {error}=await db.from("password_reset_requests").update({status,reviewed_by:user.id,reviewed_at:new Date().toISOString()}).eq("id",requestId);
    if(error)return json({error:"Could not update the request."},400);
    return json({ok:true});
  }
  if(body.action==="reset_user_password"){
    const targetId=String(body.employee_id||"").trim().toUpperCase();
    const password=String(body.password||"");
    if(password.length<12||!/[A-Z]/.test(password)||!/[a-z]/.test(password)||!/[0-9]/.test(password)||!/[^A-Za-z0-9]/.test(password))return json({error:"Password must be at least 12 characters and include uppercase, lowercase, number and symbol."},400);
    const {data:target,error}=await db.from("profiles").select("id,role").eq("employee_id",targetId).maybeSingle();
    if(error||!target)return json({error:"User not found."},404);
    if(!isSuper&&target.role!=="teacher")return json({error:"Admins can reset Teacher accounts only."},403);
    if(target.role==="super_admin")return json({error:"The Super Admin password cannot be reset from this screen."},403);
    const {error:updateError}=await db.auth.admin.updateUserById(target.id,{password,ban_duration:"none"});
    if(updateError)return json({error:"Could not reset the account password."},400);
    return json({ok:true});
  }
  if(body.action==="create_user"){
    const role=body.role;
    if(!["admin","teacher"].includes(role||""))return json({error:"Choose Teacher or Admin."},400);
    if(role==="admin"&&!isSuper)return json({error:"Only a Super Admin can create Admin accounts."},403);
    const name=String(body.name||"").trim(),password=String(body.password||"");
    if(!/^[A-Z0-9]{1,30}$/.test(employeeId))return json({error:"Employee ID must contain 1 to 30 letters or numbers."},400);
    if(!name||name.length>100)return json({error:"Enter a name of 1 to 100 characters."},400);
    if(!passwordIsStrong(password))return json({error:"Password must be at least 8 characters and include uppercase, lowercase, number, and special character."},400);
    const email=String(body.email||"").trim(),phone=String(body.phone||"").trim();
    if(role==="admin"){
      if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||email.length>254)return json({error:"Enter a valid Admin contact email."},400);
      if(!/^[+0-9().\-\s]{7,25}$/.test(phone))return json({error:"Enter a valid Admin phone or WhatsApp number."},400);
    }

    const{data:existing,error:lookupError}=await db.from("profiles").select("id").ilike("employee_id",employeeId).limit(1).maybeSingle();
    if(lookupError)return json({error:"Could not verify whether this Employee ID is already in use."},503);
    if(existing)return json({error:duplicateIdMessage},409);

    const{data:created,error:createError}=await db.auth.admin.createUser({email:loginEmail(employeeId),password,email_confirm:true});
    if(createError){
      if(/already registered|already exists|duplicate/i.test(createError.message))return json({error:duplicateIdMessage},409);
      return json({error:"The account could not be created. Check the details and try again."},400);
    }
    const authUserId=created.user.id;
    const{error:insertError}=await db.from("profiles").insert({id:authUserId,employee_id:employeeId,name,email:role==="admin"?email:null,phone:role==="admin"?phone:null,role,created_by:user.id});
    if(insertError){
      await db.auth.admin.deleteUser(authUserId);
      if(/duplicate|unique/i.test(insertError.message))return json({error:duplicateIdMessage},409);
      return json({error:"The account profile could not be saved. No account was retained."},400);
    }
    if(role==="admin"){
      const{error:contactError}=await db.from("admin_contacts").insert({employee_id:employeeId,name,whatsapp:phone,email,created_by:user.id});
      if(contactError){
        await db.from("profiles").delete().eq("id",authUserId);
        await db.auth.admin.deleteUser(authUserId);
        return json({error:"Administrator contact details could not be saved. No account was retained."},400);
      }
    }
    return json({ok:true},201);
  }

  const{data:target,error:targetError}=await db.from("profiles").select("id,role").eq("employee_id",employeeId).single();
  if(targetError||!target)return json({error:"User not found."},404);
  if(!isSuper&&target.role!=="teacher")return json({error:"Admins can only manage Teacher accounts."},403);
  if(body.action==="update_profile"){
    const name=String(body.name||"").trim(),email=String(body.email||"").trim(),phone=String(body.phone||"").trim();
    if(!name||name.length>100)return json({error:"Enter a name of 1 to 100 characters."},400);
    if(email&&(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||email.length>254))return json({error:"Enter a valid contact email or leave it blank."},400);
    if(phone&&!/^[+0-9().\-\s]{7,25}$/.test(phone))return json({error:"Enter a valid contact phone or leave it blank."},400);
    const{error:updateError}=await db.rpc("update_managed_profile",{p_actor_id:user.id,p_employee_id:employeeId,p_name:name,p_email:email||null,p_phone:phone||null});
    if(updateError)return json({error:"Account details could not be saved. Check the details and try again."},400);
    return json({ok:true});
  }
  if(body.action==="set_active"){
    if(target.role==="super_admin")return json({error:"The Super Admin account cannot be deactivated."},403);
    const active=!!body.active;
    const{error:updateError}=await db.from("profiles").update({is_active:active,updated_by:user.id}).eq("id",target.id);
    if(updateError)return json({error:"Account status could not be updated."},400);
    const{error:contactError}=await db.from("admin_contacts").update({is_active:active,updated_by:user.id}).eq("employee_id",employeeId);
    const{error:authUpdateError}=await db.auth.admin.updateUserById(target.id,{ban_duration:active?"none":"876000h"});
    if(contactError||authUpdateError)return json({error:"The account status changed, but a related contact or sign-in update failed. Ask a Super Admin to review it."},500);
    return json({ok:true});
  }
  return json({error:"Unknown action."},400);
});
