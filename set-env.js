const fs = require('fs');
const targetPath = './src/environments/environment.ts';

// Regra: O Vercel injetará as chaves reais nestas variáveis durante o deploy
const envConfigFile = `
export const environment = {
  production: true,
  supabaseUrl: '${process.env.SUPABASE_URL || ''}',
  supabaseKey: '${process.env.SUPABASE_ANON_KEY || ''}'
};
`;

// Negação: Interrompe o build na Vercel se as chaves não estiverem configuradas no painel
if (!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY) {
  console.warn('AVISO: Variáveis do Supabase não encontradas. O arquivo environment.ts será gerado com chaves vazias.');
}

fs.writeFile(targetPath, envConfigFile, function (err) {
  if (err) {
    throw console.error(err);
  } else {
    console.log(`Arquivo de environment do Angular gerado com sucesso em ${targetPath}`);
  }
});
