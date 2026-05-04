"use strict";(()=>{var e={};e.id=9836,e.ids=[9836],e.modules={27993:e=>{e.exports=require("mysql2")},62418:e=>{e.exports=require("mysql2/promise")},20399:e=>{e.exports=require("next/dist/compiled/next-server/app-page.runtime.prod.js")},30517:e=>{e.exports=require("next/dist/compiled/next-server/app-route.runtime.prod.js")},8678:e=>{e.exports=import("pg")},15673:e=>{e.exports=require("node:events")},567:(e,t,r)=>{r.a(e,async(e,a)=>{try{r.r(t),r.d(t,{originalPathname:()=>g,patchFetch:()=>c,requestAsyncStorage:()=>d,routeModule:()=>l,serverHooks:()=>y,staticGenerationAsyncStorage:()=>u});var i=r(49303),n=r(88716),s=r(60670),o=r(69983),p=e([o]);o=(p.then?(await p)():p)[0];let l=new i.AppRouteRouteModule({definition:{kind:n.x.APP_ROUTE,page:"/api/dictionary/route",pathname:"/api/dictionary",filename:"route",bundlePath:"app/api/dictionary/route"},resolvedPagePath:"D:\\OneDrive - PT Bank BTN\\BTN\\Front End Mobile Apps\\2025\\Project\\Dashboard\\dashboard-grafana\\src\\app\\api\\dictionary\\route.ts",nextConfigOutput:"standalone",userland:o}),{requestAsyncStorage:d,staticGenerationAsyncStorage:u,serverHooks:y}=l,g="/api/dictionary/route";function c(){return(0,s.patchFetch)({serverHooks:y,staticGenerationAsyncStorage:u})}a()}catch(e){a(e)}})},69983:(e,t,r)=>{r.a(e,async(e,a)=>{try{r.r(t),r.d(t,{GET:()=>o});var i=r(87070),n=r(75748),s=e([n]);async function o(e){try{let{searchParams:t}=new URL(e.url),r=t.get("search")||"",a=t.get("error_type")||"",s=t.get("app_id")||"",o=t.get("jenis_transaksi")||"",p=parseInt(t.get("page")||"1"),c=parseInt(t.get("limit")||"25"),l=!t.has("page")&&!t.has("limit"),d=a?a.split(",").filter(Boolean):[],u=s?s.split(",").filter(Boolean).map(e=>parseInt(e)):[],y=o?o.split(",").filter(Boolean):[],g=await n.d.getConnection();try{let e=`
        SELECT DISTINCT
          d.id,
          d.id_app_identifier,
          a.app_name,
          d.jenis_transaksi,
          d.rc,
          d.rc_description,
          d.error_type
        FROM response_code_dictionary d
        INNER JOIN app_identifier a ON d.id_app_identifier = a.id
        WHERE 1=1
      `,t=[];if(u.length>0){let r=u.map(()=>"?").join(",");e+=` AND d.id_app_identifier IN (${r})`,t.push(...u)}if(d.length>0){let r=d.filter(e=>["S","N","Sukses"].includes(e));if(r.length>0){let a=r.map(()=>"?").join(",");e+=` AND d.error_type IN (${a})`,t.push(...r)}}if(y.length>0){let r=y.map(()=>"?").join(",");e+=` AND d.jenis_transaksi IN (${r})`,t.push(...y)}if(r){e+=` AND (
          d.rc LIKE ? 
          OR d.jenis_transaksi LIKE ? 
          OR a.app_name LIKE ?
          OR (
            d.rc_description IS NOT NULL 
            AND d.rc_description LIKE ?
          )
        )`;let a=`%${r}%`;t.push(a,a,a,a)}let a=`
        SELECT COUNT(DISTINCT d.id) as total
        FROM response_code_dictionary d
        INNER JOIN app_identifier a ON d.id_app_identifier = a.id
        WHERE 1=1
      `,n=[];if(u.length>0){let e=u.map(()=>"?").join(",");a+=` AND d.id_app_identifier IN (${e})`,n.push(...u)}if(d.length>0){let e=d.filter(e=>["S","N","Sukses"].includes(e));if(e.length>0){let t=e.map(()=>"?").join(",");a+=` AND d.error_type IN (${t})`,n.push(...e)}}if(y.length>0){let e=y.map(()=>"?").join(",");a+=` AND d.jenis_transaksi IN (${e})`,n.push(...y)}if(r){a+=` AND (
          d.rc LIKE ? 
          OR d.jenis_transaksi LIKE ? 
          OR a.app_name LIKE ?
          OR (
            d.rc_description IS NOT NULL 
            AND d.rc_description LIKE ?
          )
        )`;let e=`%${r}%`;n.push(e,e,e,e)}let[s]=await g.execute(a,n),o=s[0]?.total||0;if(e+=" ORDER BY a.app_name, d.rc, d.jenis_transaksi",!l&&c>0){let t=(p-1)*c;e+=` LIMIT ${c} OFFSET ${t}`}let[h]=await g.execute(e,t);return i.NextResponse.json({success:!0,data:h,total:o,page:l?1:p,limit:l?o:c,totalPages:l?1:Math.ceil(o/c)})}finally{g.release()}}catch(e){return console.error("Error fetching dictionary:",e.message),i.NextResponse.json({success:!1,message:e.message},{status:500})}}n=(s.then?(await s)():s)[0],a()}catch(e){a(e)}})},75748:(e,t,r)=>{r.a(e,async(e,a)=>{try{r.d(t,{d:()=>u});var i=r(34149),n=r(90469),s=r(45162),o=e([n]);n=(o.then?(await o)():o)[0];let d="postgresql"===s.O.DB_TYPE||"postgres"===s.O.DB_TYPE;function p(e,t=[]){let r=e.split("?"),a=[];for(let e=0;e<r.length;e++)a.push(i.i6.raw(r[e])),e<t.length&&a.push((0,i.i6)`${t[e]}`);return i.i6.join(a,i.i6.raw(""))}function c(e){return d?[e.rows??[],e]:Array.isArray(e)?[Array.isArray(e[0])?e[0]:e,e]:[e?.rows??[],e]}function l(e){let t=1;return e.replace(/\?/g,()=>`$${t++}`)}let u={async execute(e,t){let r=p(e,t),a=await n.db.execute(r);return c(a)},async query(e,t){let r=p(e,t),a=await n.db.execute(r);return c(a)},async getConnection(){let e=n.db.$client;if(d){let t=await e.connect();return{release:()=>t.release(),execute:async(e,r)=>{let a=await t.query(l(e),r);return[a.rows,a]},query:async(e,r)=>{let a=await t.query(l(e),r);return[a.rows,a]},beginTransaction:()=>t.query("BEGIN"),commit:()=>t.query("COMMIT"),rollback:()=>t.query("ROLLBACK")}}let t=await e.getConnection();return{release:()=>t.release(),execute:async(e,r)=>t.execute(e,r),query:async(e,r)=>t.query(e,r),beginTransaction:()=>t.beginTransaction(),commit:()=>t.commit(),rollback:()=>t.rollback()}}};a()}catch(e){a(e)}})}};var t=require("../../../webpack-runtime.js");t.C(e);var r=e=>t(t.s=e),a=t.X(0,[8948,789,7070,469],()=>r(567));module.exports=a})();