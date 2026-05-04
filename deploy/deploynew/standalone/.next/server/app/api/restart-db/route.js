"use strict";(()=>{var e={};e.id=9070,e.ids=[9070],e.modules={27993:e=>{e.exports=require("mysql2")},62418:e=>{e.exports=require("mysql2/promise")},20399:e=>{e.exports=require("next/dist/compiled/next-server/app-page.runtime.prod.js")},30517:e=>{e.exports=require("next/dist/compiled/next-server/app-route.runtime.prod.js")},8678:e=>{e.exports=import("pg")},15673:e=>{e.exports=require("node:events")},23675:(e,t,a)=>{a.a(e,async(e,r)=>{try{a.r(t),a.d(t,{originalPathname:()=>A,patchFetch:()=>o,requestAsyncStorage:()=>u,routeModule:()=>p,serverHooks:()=>d,staticGenerationAsyncStorage:()=>T});var i=a(49303),s=a(88716),n=a(60670),E=a(17351),c=e([E]);E=(c.then?(await c)():c)[0];let p=new i.AppRouteRouteModule({definition:{kind:s.x.APP_ROUTE,page:"/api/restart-db/route",pathname:"/api/restart-db",filename:"route",bundlePath:"app/api/restart-db/route"},resolvedPagePath:"D:\\OneDrive - PT Bank BTN\\BTN\\Front End Mobile Apps\\2025\\Project\\Dashboard\\dashboard-grafana\\src\\app\\api\\restart-db\\route.ts",nextConfigOutput:"standalone",userland:E}),{requestAsyncStorage:u,staticGenerationAsyncStorage:T,serverHooks:d}=p,A="/api/restart-db/route";function o(){return(0,n.patchFetch)({serverHooks:d,staticGenerationAsyncStorage:T})}r()}catch(e){r(e)}})},17351:(e,t,a)=>{a.a(e,async(e,r)=>{try{a.r(t),a.d(t,{POST:()=>E});var i=a(87070),s=a(75748),n=e([s]);async function E(){try{let e=await s.d.getConnection();try{await e.query("SET FOREIGN_KEY_CHECKS = 0");let[t]=await e.query("SHOW TABLES");for(let a of t){let t=Object.values(a)[0];await e.query(`DROP TABLE IF EXISTS \`${t}\``)}return await e.query("SET FOREIGN_KEY_CHECKS = 1"),await e.execute(`
        CREATE TABLE app_identifier (
          id INT AUTO_INCREMENT PRIMARY KEY,
          app_name VARCHAR(255) NOT NULL UNIQUE,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        )
      `),await e.execute(`
        INSERT INTO app_identifier(app_name)
        VALUES
          ('Bale'),
          ('CMS'),
          ('SMS Notif'),
          ('QRIS'),
          ('EDC Merchant'),
          ('EDC Agen'),
          ('Bale Korpora')
      `),await e.execute(`
        CREATE TABLE app_success_rate (
          id INT AUTO_INCREMENT PRIMARY KEY,
          id_app_identifier INT NOT NULL,
          tanggal_transaksi DATE NOT NULL,
          bulan VARCHAR(20) NOT NULL,
          tahun INT NOT NULL,
          jenis_transaksi VARCHAR(255) NOT NULL,
          rc VARCHAR(255) NULL,
          rc_description VARCHAR(500) NULL,
          total_transaksi INT NULL,
          total_nominal DECIMAL(20, 2) NULL,
          total_biaya_admin DECIMAL(20, 2) NULL,
          status_transaksi VARCHAR(255) NULL,
          error_type ENUM('S', 'N', 'Sukses') NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          FOREIGN KEY (id_app_identifier) REFERENCES app_identifier(id) ON DELETE CASCADE
        )
      `),await e.execute(`
        CREATE TABLE response_code_dictionary (
          id INT AUTO_INCREMENT PRIMARY KEY,
          id_app_identifier INT NOT NULL,
          jenis_transaksi VARCHAR(255),
          rc VARCHAR(255),
          rc_description VARCHAR(500),
          error_type ENUM('S', 'N', 'Sukses') NOT NULL,
          FOREIGN KEY (id_app_identifier) REFERENCES app_identifier(id) ON DELETE CASCADE,
          UNIQUE KEY unique_dictionary_entry (id_app_identifier, jenis_transaksi, rc)
        )
      `),await e.execute(`
        CREATE TABLE unmapped_rc (
          id INT AUTO_INCREMENT PRIMARY KEY,
          id_app_identifier INT NOT NULL,
          jenis_transaksi VARCHAR(255),
          rc VARCHAR(255),
          rc_description VARCHAR(500),
          status_transaksi VARCHAR(255) NULL,
          error_type ENUM('S', 'N', 'Sukses'),
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (id_app_identifier) REFERENCES app_identifier(id) ON DELETE CASCADE,
          UNIQUE KEY unique_unmapped_entry (id_app_identifier, jenis_transaksi, rc)
        )
      `),console.log("✅ Database schema restarted successfully!"),i.NextResponse.json({success:!0,message:"Database schema restarted successfully. Tables created: app_identifier, app_success_rate, response_code_dictionary, unmapped_rc"})}finally{e.release()}}catch(e){return console.error("Error restarting database:",e.message),i.NextResponse.json({success:!1,message:e.message},{status:500})}}s=(n.then?(await n)():n)[0],r()}catch(e){r(e)}})},75748:(e,t,a)=>{a.a(e,async(e,r)=>{try{a.d(t,{d:()=>T});var i=a(34149),s=a(90469),n=a(45162),E=e([s]);s=(E.then?(await E)():E)[0];let u="postgresql"===n.O.DB_TYPE||"postgres"===n.O.DB_TYPE;function c(e,t=[]){let a=e.split("?"),r=[];for(let e=0;e<a.length;e++)r.push(i.i6.raw(a[e])),e<t.length&&r.push((0,i.i6)`${t[e]}`);return i.i6.join(r,i.i6.raw(""))}function o(e){return u?[e.rows??[],e]:Array.isArray(e)?[Array.isArray(e[0])?e[0]:e,e]:[e?.rows??[],e]}function p(e){let t=1;return e.replace(/\?/g,()=>`$${t++}`)}let T={async execute(e,t){let a=c(e,t),r=await s.db.execute(a);return o(r)},async query(e,t){let a=c(e,t),r=await s.db.execute(a);return o(r)},async getConnection(){let e=s.db.$client;if(u){let t=await e.connect();return{release:()=>t.release(),execute:async(e,a)=>{let r=await t.query(p(e),a);return[r.rows,r]},query:async(e,a)=>{let r=await t.query(p(e),a);return[r.rows,r]},beginTransaction:()=>t.query("BEGIN"),commit:()=>t.query("COMMIT"),rollback:()=>t.query("ROLLBACK")}}let t=await e.getConnection();return{release:()=>t.release(),execute:async(e,a)=>t.execute(e,a),query:async(e,a)=>t.query(e,a),beginTransaction:()=>t.beginTransaction(),commit:()=>t.commit(),rollback:()=>t.rollback()}}};r()}catch(e){r(e)}})}};var t=require("../../../webpack-runtime.js");t.C(e);var a=e=>t(t.s=e),r=t.X(0,[8948,789,7070,469],()=>a(23675));module.exports=r})();