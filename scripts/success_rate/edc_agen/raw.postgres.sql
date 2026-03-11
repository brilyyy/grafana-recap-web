SELECT "TRXMDT" as "Tanggal Transaksi","TRRSPC" as "RC", "RSSHTD" as "RC Description",count("TRRSPC") as "Total Transaksi" FROM  
"ASID160448_ZTRANS0P", "ASID160448_ZRSPCD0P" where "TRRSPC"="RSRSPC"                       
and "TRTRTY" not in ('21', '6A', '6B', 'C1', 'C2')                       
and "TRPROD" = 'POS'                              
and "TRXMDT" = $1                   
group by "Tanggal Transaksi","RC","RC Description" order by "Total Transaksi" desc