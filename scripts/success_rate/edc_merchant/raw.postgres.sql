SELECT "TRXMDT" as "Tanggal Transaksi","TRRSPC" as "RC","RSSHTD" as "RC Description",count("TRRSPC") as "Total Transaksi" FROM  
"ASID160448_ztrans0p", "ASID160448_zrspcd0p" where "TRRSPC"="RSRSPC"                       
and "TRTRTY" = '21'                       
and "TRPROD" = 'POS'                              
and "TRXMDT" = $1
group by "Tanggal Transaksi","RC","RC Description" order by "Total Transaksi" desc