import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsPolicy, jsonResponse } from "../_shared/cors.ts";
const loginEmail=(id:string)=>id.toUpperCase()+"@login.nkkams.invalid";
const strong=(v:string)=>v.length>=12&&/[A-Z]/.test(v)&&/[a-z]/.test(v)&&/[0-9]/.test(v)&&/[^A-Za-z0-9]/.test(v);
const validId=(v:string)=>/^[A-Z0-9]{2,30}$/.test(v);
const slug=(v:string)=>v.toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"").slice(0,60);
Deno.serve(async(req:Request)=>{
 const cors=corsPolicy(req); if(req.method==="OPTIONS")return new Response(null,{status:cors.accepted?204:403,headers:cors.headers});
 const json=(v:unknown,s=200)=>jsonResponse(req,v,s); if(!cors.accepted)return json({error:"Origin is not allowed."},403);
 if(req.method!=="POST")return json({error:"Method not allowed."},405);
 let body:any;try{body=await req.json()}catch{return json({error:"Invalid JSON."},400)}
 const db=createClient(Deno.env.get("SUPABASE_URL")!,Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
 const action=String(body.action||""),employeeId=String(body.employee_id||"").trim().toUpperCase();
 if(action==="bootstrap_status"){const {count,error}=await db.from("profiles").select("id",{count:"exact",head:true});if(error)return json({error:"Could not check setup."},503);return json({bootstrap_available:(count||0)===0})}
 if(action==="public_admin_contacts"){const {data,error}=await db.from("admin_contacts").select("name,whatsapp,email").eq("is_active",true).order("name");if(error)return json({error:"Could not load contacts."},503);return json({contacts:data||[]})}
 if(action==="create_organization_request"){
  const name=String(body.organization_name||"").trim(),contact=String(body.contact_name||"").trim(),phone=String(body.phone||"").trim(),email=String(body.email||"").trim(),message=String(body.message||"").trim().slice(0,500);
  if(!name||name.length>100||!contact||(!phone&&!email))return json({error:"Enter organisation name, contact name and phone or email."},400);
  const {error}=await db.from("organization_requests").insert({organization_name:name,slug:slug(name),contact_name:contact,phone:phone||null,email:email||null,message:message||null});
  if(error)return json({error:"Could not submit request. The organisation may already be registered or requested."},400);return json({ok:true},201);
 }
 if(action==="submit_reset_request"){
  if(!validId(employeeId))return json({error:"Enter a valid Employee ID."},400);
  const {data:person}=await db.from("profiles").select("id,employee_id").eq("employee_id",employeeId).maybeSingle();
  if(person){const {error}=await db.from("password_reset_requests").insert({requester_user_id:person.id,employee_id:person.employee_id,message:String(body.message||"").slice(0,500)});if(error&&!/duplicate|unique/i.test(error.message))return json({error:"Could not submit request."},503)}
  return json({ok:true,message:"If this Employee ID is registered, an administrator has received the request."},202);
 }
 const token=(req.headers.get("Authorization")||"").replace(/^Bearer\s+/i,"");
 const {data:{user},error:authError}=await db.auth.getUser(token);if(authError||!user)return json({error:"Sign in to continue."},401);
 const {data:me,error:meError}=await db.from("profiles").select("id,employee_id,name,role,is_active,organization_id").eq("id",user.id).single();
 if(meError||!me?.is_active)return json({error:"Active account required."},403);
 const role=String(me.role),global=role==="super_admin"||role==="platform_admin",superAdmin=role==="super_admin",head=role==="organization_head",orgAdmin=role==="admin";
 const targetById=(id:string)=>db.from("profiles").select("id,employee_id,name,role,is_active,organization_id,email,phone").eq("employee_id",id).maybeSingle();
 if(action==="bootstrap_super_admin"){
  const {count,error}=await db.from("profiles").select("id",{count:"exact",head:true});if(error)return json({error:"Could not verify setup."},503);if((count||0)>0)return json({error:"Initial setup is already complete."},409);
  const name=String(body.name||"").trim(),password=String(body.password||"");if(!validId(employeeId)||!name||!strong(password))return json({error:"Enter a valid ID, name and strong password."},400);
  const {data:created,error:ce}=await db.auth.admin.createUser({email:loginEmail(employeeId),password,email_confirm:true});if(ce)return json({error:"Could not create account. Employee ID may already exist."},400);
  const {error:pe}=await db.from("profiles").insert({id:created.user.id,employee_id:employeeId,name,role:"super_admin",is_active:true});if(pe){await db.auth.admin.deleteUser(created.user.id);return json({error:"Could not save profile."},500)}return json({ok:true},201);
 }
 if(action==="list_organizations"){if(!global)return json({error:"Not authorized."},403);const {data,error}=await db.rpc("nkkams_list_organizations");if(error)return json({error:"Could not load organisations."},503);return json({organizations:data||[]})}
 if(action==="list_organization_requests"){if(!global)return json({error:"Not authorized."},403);const {data,error}=await db.rpc("nkkams_list_org_requests");if(error)return json({error:"Could not load requests."},503);return json({requests:data||[]})}
 if(action==="list_head_transfer_requests"){if(!["super_admin","platform_admin","organization_head","admin"].includes(role))return json({error:"Not authorized."},403);const {data,error}=await db.rpc("nkkams_list_transfers");if(error)return json({error:"Could not load transfers."},503);return json({requests:data||[]})}
 if(action==="request_head_transfer"){if(!head)return json({error:"Only the current organisation head can request a transfer."},403);const {error}=await db.rpc("nkkams_create_transfer",{p_employee_id:String(body.proposed_employee_id||employeeId).trim().toUpperCase()});if(error)return json({error:error.message},400);return json({ok:true})}
 if(action==="accept_head_transfer"){if(!orgAdmin)return json({error:"Only an organisation admin can accept."},403);const {error}=await db.rpc("nkkams_accept_head_transfer",{p_request_id:String(body.request_id||""),p_user_id:user.id});if(error)return json({error:error.message},400);return json({ok:true})}
 if(action==="set_organization_head"){if(!global)return json({error:"Not authorized."},403);const {error}=await db.rpc("nkkams_set_organization_head",{p_organization_id:String(body.organization_id||""),p_employee_id:employeeId});if(error)return json({error:error.message},400);return json({ok:true})}
 if(action==="set_organization_status"){if(!global)return json({error:"Not authorized."},403);const {error}=await db.rpc("nkkams_set_org_status",{p_org_id:String(body.organization_id||""),p_status:String(body.status||""),p_actor_id:user.id});if(error)return json({error:error.message},400);return json({ok:true})}
 if(action==="review_organization_request"){if(!global)return json({error:"Not authorized."},403);const {error}=await db.rpc("nkkams_review_org_request",{p_request_id:String(body.request_id||""),p_status:String(body.status||""),p_actor_id:user.id});if(error)return json({error:error.message},400);return json({ok:true})}
 if(action==="review_head_transfer"){if(!global)return json({error:"Only website administrators can review transfers."},403);const {error}=await db.rpc("nkkams_review_head_transfer",{p_request_id:String(body.request_id||""),p_status:String(body.status||""),p_actor_id:user.id});if(error)return json({error:error.message},400);return json({ok:true})}
 if(action==="list_users"){
  if(!["super_admin","platform_admin","organization_head","admin"].includes(role))return json({error:"Not authorized."},403);
  let q=db.from("profiles").select("employee_id,name,role,is_active,email,phone,created_at,organization_id").order("created_at");
  if(orgAdmin)q=q.eq("organization_id",me.organization_id).eq("role","teacher");else if(head)q=q.eq("organization_id",me.organization_id).in("role",["admin","teacher"]);else if(role==="platform_admin")q=q.neq("role","super_admin");
  const {data,error}=await q;if(error)return json({error:"Could not load accounts."},503);return json({users:data||[]});
 }
 if(action==="list_batches"){
  if(!["super_admin","platform_admin","organization_head","admin","teacher"].includes(role))return json({error:"Not authorized."},403);
  const orgId=global?String(body.organization_id||""):me.organization_id;if(!orgId)return json({error:"Organisation is required."},400);
  const {data,error}=await db.from("batches").select("id,name,organization_id").eq("organization_id",orgId).order("name");if(error)return json({error:"Could not load batches."},503);return json({batches:data||[]});
 }
 if(action==="create_batch"){
  if(!["super_admin","platform_admin","organization_head","admin"].includes(role))return json({error:"Not authorized."},403);
  const orgId=global?String(body.organization_id||""):me.organization_id,name=String(body.name||"").trim();if(!orgId||!name||name.length>80)return json({error:"Enter batch name and organisation."},400);
  const {data,error}=await db.from("batches").insert({organization_id:orgId,name,created_by:user.id}).select("id,name").single();if(error)return json({error:"Could not create batch. It may already exist."},400);return json({batch:data},201);
 }
 if(action==="list_reset_requests"){
  if(!["super_admin","platform_admin","organization_head","admin"].includes(role))return json({error:"Not authorized."},403);
  let q=db.from("password_reset_requests").select("id,employee_id,message,status,created_at,requester_user_id").order("created_at",{ascending:false});
  if(head||orgAdmin){const {data:members}=await db.from("profiles").select("id").eq("organization_id",me.organization_id);q=q.in("requester_user_id",(members||[]).map(x=>x.id))}
  const {data,error}=await q;if(error)return json({error:"Could not load reset requests."},503);return json({requests:data||[]});
 }
 if(action==="update_reset_request"){
  if(!["super_admin","platform_admin","organization_head","admin"].includes(role))return json({error:"Not authorized."},403);
  const rid=String(body.request_id||"");if(!/^[0-9a-f-]{36}$/i.test(rid))return json({error:"Invalid request."},400);
  const {data:r}=await db.from("password_reset_requests").select("requester_user_id").eq("id",rid).maybeSingle();if(!r)return json({error:"Request not found."},404);
  if((head||orgAdmin)){const {data:t}=await db.from("profiles").select("organization_id").eq("id",r.requester_user_id).maybeSingle();if(t?.organization_id!==me.organization_id)return json({error:"Request is outside your organisation."},403)}
  const status=String(body.status||"");if(!["pending","reviewed","resolved","rejected"].includes(status))return json({error:"Invalid status."},400);
  const {error}=await db.from("password_reset_requests").update({status,reviewed_by:user.id,reviewed_at:new Date().toISOString()}).eq("id",rid);if(error)return json({error:"Could not update request."},400);return json({ok:true});
 }
 if(action==="create_user"){
  if(!["super_admin","platform_admin","organization_head","admin"].includes(role))return json({error:"Not authorized."},403);
  const newRole=String(body.role||""),name=String(body.name||"").trim(),password=String(body.password||""),email=String(body.email||"").trim(),phone=String(body.phone||"").trim();
  if(!validId(employeeId)||!name||name.length>100||!strong(password))return json({error:"Enter valid details and a strong password (12+ characters, uppercase, lowercase, number and symbol)."},400);
  if(!["admin","teacher","platform_admin"].includes(newRole))return json({error:"Choose a valid role."},400);
  if(newRole==="platform_admin"&&!superAdmin)return json({error:"Only Super Admin can create Website Admin accounts."},403);
  if(orgAdmin&&newRole!=="teacher")return json({error:"Organisation Admin can create Teachers only."},403);
  if(head&&!["admin","teacher"].includes(newRole))return json({error:"Organisation Head can create Organisation Admins and Teachers only."},403);
  if(newRole==="admin"&&(!email&&!phone))return json({error:"Provide at least one contact method for the Organisation Admin."},400);
  if(email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))return json({error:"Enter a valid email."},400);
  if(phone&&!/^[+0-9().\-\s]{7,25}$/.test(phone))return json({error:"Enter a valid phone number."},400);
  const orgId=newRole==="platform_admin"?null:(global?String(body.organization_id||""):me.organization_id);
  if(newRole!=="platform_admin"&&!orgId)return json({error:"Choose an organisation."},400);
  if(!global&&orgId!==me.organization_id)return json({error:"You cannot create accounts outside your organisation."},403);
  const {data:exists}=await targetById(employeeId);if(exists)return json({error:"Employee ID already exists."},409);
  const {data:created,error:ce}=await db.auth.admin.createUser({email:loginEmail(employeeId),password,email_confirm:true});if(ce)return json({error:"Could not create account. Employee ID may already exist."},400);
  const {error:pe}=await db.from("profiles").insert({id:created.user.id,employee_id:employeeId,name,email:newRole==="admin"?(email||null):null,phone:newRole==="admin"?(phone||null):null,role:newRole,organization_id:orgId,created_by:user.id});
  if(pe){await db.auth.admin.deleteUser(created.user.id);return json({error:"Could not save account profile."},400)}
  if(newRole==="admin"){const {error:ae}=await db.from("admin_contacts").insert({employee_id:employeeId,name,whatsapp:phone||null,email:email||null,organization_id:orgId,created_by:user.id});if(ae){await db.from("profiles").delete().eq("id",created.user.id);await db.auth.admin.deleteUser(created.user.id);return json({error:"Could not save admin contact."},400)}}
  return json({ok:true},201);
 }
 if(action==="set_active"||action==="update_profile"||action==="reset_user_password"){
  if(!["super_admin","platform_admin","organization_head","admin"].includes(role))return json({error:"Not authorized."},403);
  const {data:target,error}=await targetById(employeeId);if(error||!target)return json({error:"User not found."},404);
  if(target.role==="super_admin")return json({error:"Super Admin account is protected."},403);
  if(!global&&target.organization_id!==me.organization_id)return json({error:"Account is outside your organisation."},403);
  if(orgAdmin&&target.role!=="teacher")return json({error:"Organisation Admin can manage Teachers only."},403);
  if(head&&!["admin","teacher"].includes(target.role))return json({error:"Organisation Head can manage admins and teachers only."},403);
  if(action==="set_active"){
   const {error:se}=await db.rpc("nkkams_set_user_active",{p_employee_id:employeeId,p_active:!!body.active,p_actor_id:user.id});if(se)return json({error:se.message},400);
   const {error:ae}=await db.auth.admin.updateUserById(target.id,{ban_duration:body.active?"none":"876000h"});if(ae)return json({error:"Profile updated but sign-in status update failed."},500);return json({ok:true});
  }
  if(action==="reset_user_password"){
   const password=String(body.password||"");if(!strong(password))return json({error:"Password must be at least 12 characters and include uppercase, lowercase, number and symbol."},400);
   const {error:pe}=await db.auth.admin.updateUserById(target.id,{password,ban_duration:"none"});if(pe)return json({error:"Could not reset password."},400);return json({ok:true});
  }
  const name=String(body.name||"").trim(),email=String(body.email||"").trim(),phone=String(body.phone||"").trim();if(!name||name.length>100)return json({error:"Enter a valid name."},400);
  const {error:ue}=await db.from("profiles").update({name,email:email||null,phone:phone||null,updated_by:user.id,updated_at:new Date().toISOString()}).eq("id",target.id);if(ue)return json({error:"Could not update profile."},400);return json({ok:true});
 }
 return json({error:"Unknown action."},400);
});