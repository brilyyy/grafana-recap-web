"use strict";(()=>{var e={};e.id=2956,e.ids=[2956],e.modules={27993:e=>{e.exports=require("mysql2")},62418:e=>{e.exports=require("mysql2/promise")},20399:e=>{e.exports=require("next/dist/compiled/next-server/app-page.runtime.prod.js")},30517:e=>{e.exports=require("next/dist/compiled/next-server/app-route.runtime.prod.js")},8678:e=>{e.exports=import("pg")},15673:e=>{e.exports=require("node:events")},21353:(e,a,t)=>{t.a(e,async(e,r)=>{try{t.r(a),t.d(a,{originalPathname:()=>_,patchFetch:()=>p,requestAsyncStorage:()=>l,routeModule:()=>u,serverHooks:()=>y,staticGenerationAsyncStorage:()=>d});var n=t(49303),i=t(88716),s=t(60670),o=t(23726),c=e([o]);o=(c.then?(await c)():c)[0];let u=new n.AppRouteRouteModule({definition:{kind:i.x.APP_ROUTE,page:"/api/no-rc-transaction/route",pathname:"/api/no-rc-transaction",filename:"route",bundlePath:"app/api/no-rc-transaction/route"},resolvedPagePath:"D:\\OneDrive - PT Bank BTN\\BTN\\Front End Mobile Apps\\2025\\Project\\Dashboard\\dashboard-grafana\\src\\app\\api\\no-rc-transaction\\route.ts",nextConfigOutput:"standalone",userland:o}),{requestAsyncStorage:l,staticGenerationAsyncStorage:d,serverHooks:y}=u,_="/api/no-rc-transaction/route";function p(){return(0,s.patchFetch)({serverHooks:y,staticGenerationAsyncStorage:d})}r()}catch(e){r(e)}})},23726:(e,a,t)=>{t.a(e,async(e,r)=>{try{t.r(a),t.d(a,{GET:()=>o});var n=t(87070),i=t(75748),s=e([i]);async function o(e){try{let a=e.nextUrl.searchParams,t=a.get("appId"),r=parseInt(a.get("page")||"1"),s=parseInt(a.get("limit")||"25"),o=(r-1)*s,c=await i.d.getConnection();try{let e=`
        SELECT 
          a.id,
          a.id_app_identifier,
          app.app_name,
          a.tanggal_transaksi,
          a.bulan,
          a.tahun,
          a.jenis_transaksi,
          a.rc,
          a.rc_description,
          a.total_transaksi,
          a.total_nominal,
          a.total_biaya_admin,
          a.status_transaksi,
          a.error_type,
          a.created_at,
          a.updated_at
        FROM app_success_rate a
        LEFT JOIN app_identifier app ON a.id_app_identifier = app.id
        WHERE a.rc IS NULL
          AND a.error_type IS NULL
      `,a=[],i=[];t&&(e+=" AND a.id_app_identifier = ?",a.push(parseInt(t)),i.push(parseInt(t)));let p=`
        SELECT COUNT(*) as total
        FROM app_success_rate a
        LEFT JOIN app_identifier app ON a.id_app_identifier = app.id
        WHERE a.rc IS NULL
          AND a.error_type IS NULL
      `;t&&(p+=" AND a.id_app_identifier = ?");let[u]=await c.execute(p,i),l=u[0].total;e+=` ORDER BY a.created_at DESC LIMIT ${s} OFFSET ${o}`;let[d]=await c.execute(e,a);return n.NextResponse.json({success:!0,data:d,pagination:{page:r,limit:s,total:l,totalPages:Math.ceil(l/s)}})}finally{c.release()}}catch(e){return console.error("Error fetching no RC transactions:",e),n.NextResponse.json({success:!1,message:"Error fetching no RC transactions: "+e.message},{status:500})}}i=(s.then?(await s)():s)[0],r()}catch(e){r(e)}})},75748:(e,a,t)=>{t.a(e,async(e,r)=>{try{t.d(a,{d:()=>d});var n=t(34149),i=t(90469),s=t(45162),o=e([i]);i=(o.then?(await o)():o)[0];let l="postgresql"===s.O.DB_TYPE||"postgres"===s.O.DB_TYPE;function c(e,a=[]){let t=e.split("?"),r=[];for(let e=0;e<t.length;e++)r.push(n.i6.raw(t[e])),e<a.length&&r.push((0,n.i6)`${a[e]}`);return n.i6.join(r,n.i6.raw(""))}function p(e){return l?[e.rows??[],e]:Array.isArray(e)?[Array.isArray(e[0])?e[0]:e,e]:[e?.rows??[],e]}function u(e){let a=1;return e.replace(/\?/g,()=>`$${a++}`)}let d={async execute(e,a){let t=c(e,a),r=await i.db.execute(t);return p(r)},async query(e,a){let t=c(e,a),r=await i.db.execute(t);return p(r)},async getConnection(){let e=i.db.$client;if(l){let a=await e.connect();return{release:()=>a.release(),execute:async(e,t)=>{let r=await a.query(u(e),t);return[r.rows,r]},query:async(e,t)=>{let r=await a.query(u(e),t);return[r.rows,r]},beginTransaction:()=>a.query("BEGIN"),commit:()=>a.query("COMMIT"),rollback:()=>a.query("ROLLBACK")}}let a=await e.getConnection();return{release:()=>a.release(),execute:async(e,t)=>a.execute(e,t),query:async(e,t)=>a.query(e,t),beginTransaction:()=>a.beginTransaction(),commit:()=>a.commit(),rollback:()=>a.rollback()}}};r()}catch(e){r(e)}})}};var a=require("../../../webpack-runtime.js");a.C(e);var t=e=>a(a.s=e),r=a.X(0,[8948,789,7070,469],()=>t(21353));module.exports=r})();