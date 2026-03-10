SELECT TRXMDT,TRRSPC,RSSHTD as desc,count(TRRSPC) as totaltrx FROM  
"ASID160448_ztrans0p", "ASID160448_zrspcd0p" where TRRSPC=RSRSPC                       
and TRTRTY = '21'                       
and HSPROD='POS'                              
and TRXMDT BETWEEN $1::timestamp AND $2::timestamp                     
group by TRRSPC,RSSHTD order by totaltrx desc