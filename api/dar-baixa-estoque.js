// FORÇA O CARREGAMENTO DAS VARIÁVEIS DO ARQUIVO .env.local
require('dotenv').config({ path: '.env.local' });

const { createClient } = require('contentful-management');

module.exports = async (req, res) => {
  const CONTENTFUL_SPACE_ID = process.env.CONTENTFUL_SPACE_ID;
  const CONTENTFUL_MANAGEMENT_TOKEN = process.env.CONTENTFUL_MANAGEMENT_TOKEN;
  const CONTENTFUL_ENVIRONMENT_ID = process.env.CONTENTFUL_ENVIRONMENT_ID || 'master';

  // --- INÍCIO DO BLOCO CORS ATUALIZADO ---
  const allowedOrigins = [
      'https://oba-brownie.github.io', // Seu site em produção
      'http://127.0.0.1:5500',        // Seu ambiente de desenvolvimento (localhost)
      'http://192.168.1.83:5500'       // Outro endereço local que você usa
  ];
  const origin = req.headers.origin;
  if (allowedOrigins.includes(origin)) {
      res.setHeader('Access-Control-Allow-Origin', origin);
  }
  
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

    // ===================================================================
    // ETAPA 1: LOOP DE VALIDAÇÃO DE ESTOQUE
    // ===================================================================
    for (const item of cart) {
      const entry = await environment.getEntry(item.id);
      const estoqueReal = entry.fields.estoque['en-US'];

      if (item.quantity > estoqueReal) {
        return res.status(400).json({ 
          error: `Estoque insuficiente para o produto: "${item.name}". Disponível: ${estoqueReal}, Pedido: ${item.quantity}.` 
        });
      }
    }

    // ===================================================================
    // ETAPA 2: LOOP DE ATUALIZAÇÃO DE ESTOQUE
    // ===================================================================
    for (const item of cart) {
      const entry = await environment.getEntry(item.id);
      const estoqueAtual = entry.fields.estoque['en-US'];
      const novoEstoque = estoqueAtual - item.quantity;
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
