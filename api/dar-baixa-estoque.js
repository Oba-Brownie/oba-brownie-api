// FORÇA O CARREGAMENTO DAS VARIÁVEIS DO ARQUIVO .env.local
require('dotenv').config({ path: '.env.local' });

const { createClient } = require('contentful-management');

// A função principal que será executada quando o front-end chamar
module.exports = async (req, res) => {
  // Lendo as variáveis após o dotenv já ter carregado
  const CONTENTFUL_SPACE_ID = process.env.CONTENTFUL_SPACE_ID;
  const CONTENTFUL_MANAGEMENT_TOKEN = process.env.CONTENTFUL_MANAGEMENT_TOKEN;
  const CONTENTFUL_ENVIRONMENT_ID = process.env.CONTENTFUL_ENVIRONMENT_ID || 'master';
  const FRONTEND_URL = process.env.FRONTEND_URL;

  // --- INÍCIO DO BLOCO CORS ---
  res.setHeader('Access-Control-Allow-Origin', FRONTEND_URL); 
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  // --- FIM DO BLOCO CORS ---

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  try {
    // Verificação inicial para garantir que o token foi carregado
    if (!CONTENTFUL_MANAGEMENT_TOKEN) {
      throw new Error('O token de gerenciamento do Contentful (CONTENTFUL_MANAGEMENT_TOKEN) não foi encontrado no ambiente.');
    }

    const client = createClient({
      accessToken: CONTENTFUL_MANAGEMENT_TOKEN,
    });

    const cart = req.body;

    if (!cart || cart.length === 0) {
      return res.status(400).json({ error: 'Carrinho vazio ou inválido.' });
    }

    const space = await client.getSpace(CONTENTFUL_SPACE_ID);
    const environment = await space.getEnvironment(CONTENTFUL_ENVIRONMENT_ID);

    for (const item of cart) {
      const { id, quantity } = item;
      const entry = await environment.getEntry(id);
      const estoqueAtual = entry.fields.estoque['en-US'];
      const novoEstoque = Math.max(0, estoqueAtual - quantity);
      entry.fields.estoque['en-US'] = novoEstoque;
      const updatedEntry = await entry.update();
      await updatedEntry.publish();
    }
    
    return res.status(200).json({ message: 'Estoque atualizado com sucesso!' });

  } catch (error) {
    console.error('ERRO DETALHADO:', error);
    return res.status(500).json({ error: 'Ocorreu um erro interno ao processar o pedido.' });
  }
};