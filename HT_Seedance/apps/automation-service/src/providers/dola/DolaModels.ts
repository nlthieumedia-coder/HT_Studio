export const DolaModelAliases:Record<string,string[]>={seedance_2_5:['Seedance 2.5','Seedance 2.5 Pro']}; export const resolveDolaModel=(alias:string)=>DolaModelAliases[alias]??[alias];
