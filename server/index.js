const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const axios = require('axios');
const multer = require('multer');
const xml2js = require('xml2js');
require('dotenv').config();
const { OpenAI } = require('openai');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const SCENARIOS_PATH = path.join(__dirname, 'scenarios.json');
const DOCS_DIR = path.join(__dirname, 'docs');
const DOCS_INDEX = path.join(__dirname, 'docs_index.json');
const pdfParse = require('pdf-parse');

const app = express();
app.use(cors());
app.use(bodyParser.json());
const upload = multer(); // para upload em memória
const docsUpload = multer({ dest: DOCS_DIR });

if (!fs.existsSync(DOCS_DIR)) fs.mkdirSync(DOCS_DIR);

// Busca real do ticket no Jira
async function fetchJiraTicket(ticketId) {
  if (!ticketId) return null;
  const { JIRA_BASE_URL, JIRA_USER, JIRA_TOKEN } = process.env;
  if (!JIRA_BASE_URL || !JIRA_USER || !JIRA_TOKEN) {
    throw new Error('Jira credentials/config missing in .env');
  }
  const url = `${JIRA_BASE_URL}/rest/api/3/issue/${ticketId}`;
  try {
    const response = await axios.get(url, {
      auth: {
        username: JIRA_USER,
        password: JIRA_TOKEN
      },
      headers: {
        'Accept': 'application/json'
      }
    });
    const issue = response.data;
    return {
      id: issue.key,
      summary: issue.fields.summary,
      description: issue.fields.description?.content?.map(block => block.content?.map(txt => txt.text).join(' ')).join('\n') || '',
      status: issue.fields.status?.name,
      assignee: issue.fields.assignee?.displayName || 'Unassigned',
      raw: issue // Para debug, pode remover depois
    };
  } catch (error) {
    if (error.response && error.response.status === 404) {
      throw new Error('Ticket not found in Jira');
    } else if (error.response && error.response.status === 401) {
      throw new Error('Unauthorized: check Jira credentials');
    } else {
      throw new Error('Error fetching Jira ticket: ' + error.message);
    }
  }
}

// Função para sanitizar & não escapados em XML (exceto entidades válidas)
function sanitizeXml(rawXml) {
  // Substitui & por &amp; apenas se não for entidade conhecida
  return rawXml.replace(/&(?!(amp;|lt;|gt;|quot;|apos;|#\d+;|#x[a-fA-F0-9]+;))/g, '&amp;');
}

// Função robusta para extrair HTML do campo <description>
function extractDescription(desc) {
  if (!desc) return '';
  if (typeof desc === 'string') return desc;
  if (Array.isArray(desc)) return desc.map(extractDescription).join(' ');
  if (typeof desc === 'object') {
    let html = '';
    for (const [tag, value] of Object.entries(desc)) {
      if (tag === '_') return value;
      html += `<${tag}>${extractDescription(value)}</${tag}>`;
    }
    return html;
  }
  return '';
}

// Extrai comentários do XML Jira (array de strings)
function extractComments(issue) {
  if (!issue.comments || !issue.comments.comment) return '';
  const commentsArr = Array.isArray(issue.comments.comment)
    ? issue.comments.comment
    : [issue.comments.comment];
  return commentsArr.map(c => {
    // c._ pode ser o texto, ou pode ser HTML
    if (typeof c === 'string') return c;
    if (typeof c === 'object') {
      // Pode ter ._ ou .p (parágrafo) ou ser HTML
      if (c._) return c._;
      if (c.p) return Array.isArray(c.p) ? c.p.join(' ') : c.p;
      if (c['#text']) return c['#text'];
      // Monta HTML se for objeto HTML
      return Object.values(c).map(v => (typeof v === 'string' ? v : JSON.stringify(v))).join(' ');
    }
    return '';
  }).join('\n\n');
}

// Extrai tickets relacionados do XML Jira
function extractRelatedTickets(issue, parsed) {
  // Os links estão em parsed.rss.channel.issuelinks ou issue.issuelinks
  const issuelinks = parsed?.rss?.channel?.issuelinks || issue.issuelinks;
  if (!issuelinks) return '';
  let links = [];
  if (issuelinks.issuelinktype) {
    const types = Array.isArray(issuelinks.issuelinktype)
      ? issuelinks.issuelinktype
      : [issuelinks.issuelinktype];
    types.forEach(type => {
      const outward = type.outwardlinks?.issuelink;
      if (outward) {
        const arr = Array.isArray(outward) ? outward : [outward];
        arr.forEach(link => {
          links.push(`${type.name}: ${link.issuekey || ''}`);
        });
      }
      const inward = type.inwardlinks?.issuelink;
      if (inward) {
        const arr = Array.isArray(inward) ? inward : [inward];
        arr.forEach(link => {
          links.push(`${type.name}: ${link.issuekey || ''}`);
        });
      }
    });
  }
  return links.join('\n');
}

function getXmlValue(field) {
  if (typeof field === 'string') return field;
  if (Array.isArray(field)) return field.map(getXmlValue).join(' ');
  if (field && typeof field._ === 'string') return field._;
  return '';
}

// Funções utilitárias para leitura e escrita do arquivo de cenários
function readScenarios() {
  if (!fs.existsSync(SCENARIOS_PATH)) return [];
  return JSON.parse(fs.readFileSync(SCENARIOS_PATH, 'utf-8'));
}
function writeScenarios(data) {
  fs.writeFileSync(SCENARIOS_PATH, JSON.stringify(data, null, 2), 'utf-8');
}

// Rota para salvar um novo cenário
app.post('/api/scenarios', (req, res) => {
  const { jiraId, summary, description, cenarios } = req.body;
  if (!jiraId || !summary || !cenarios || !Array.isArray(cenarios)) {
    return res.status(400).json({ error: 'Campos obrigatórios: jiraId, summary, cenarios (array)' });
  }
  const all = readScenarios();
  const now = new Date().toISOString();
  const scenario = {
    id: uuidv4(),
    jiraId,
    summary,
    description: description || '',
    cenarios,
    dataCriacao: now,
    dataAtualizacao: now
  };
  all.push(scenario);
  writeScenarios(all);
  res.json({ ok: true, scenario });
});

// Rota para listar todos os cenários salvos
app.get('/api/scenarios', (req, res) => {
  res.json(readScenarios());
});

async function generateScenariosWithAI({ jiraDetails, confluence }) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OPENAI_API_KEY missing in .env');
  const openai = new OpenAI({ apiKey });
  // Montar prompt
  let prompt = 'Você é um engenheiro de QA. Gere cenários de teste detalhados para o seguinte ticket Jira.';
  if (jiraDetails) {
    prompt += `\n\nID: ${jiraDetails.id || ''}`;
    prompt += `\nResumo: ${jiraDetails.summary || ''}`;
    prompt += `\nDescrição: ${jiraDetails.description || ''}`;
    prompt += `\nStatus: ${jiraDetails.status || ''}`;
    prompt += `\nResponsável: ${jiraDetails.assignee || ''}`;
    if (jiraDetails.comments) {
      prompt += `\n\nComentários do ticket:\n${jiraDetails.comments}`;
    }
    if (jiraDetails.relatedTickets) {
      prompt += `\n\nTickets relacionados:\n${jiraDetails.relatedTickets}`;
    }
  }
  if (confluence) {
    prompt += `\n\nDocumentação Confluence relevante:\n${confluence}`;
  }
  prompt += '\n\nListe os cenários de teste de QA mais relevantes para garantir uma boa cobertura.';

  const completion = await openai.chat.completions.create({
    model: 'gpt-3.5-turbo',
    messages: [{ role: 'user', content: prompt }],
    max_tokens: 512,
    temperature: 0.7
  });
  // Extrai os cenários do texto gerado
  const text = completion.choices[0].message.content;
  // Tenta dividir em lista
  const scenarios = text.split(/\n\d+[\)\.] |\n- |\n\*/).map(s => s.trim()).filter(s => s.length > 0);
  return scenarios.length > 1 ? scenarios : [text];
}

app.post('/api/generate', upload.single('xmlFile'), async (req, res) => {
  let jiraDetails = null;
  let confluence = req.body.confluence || '';
  try {
    if (req.body.xmlText) {
      // Parse XML colado
      let xml = req.body.xmlText;
      xml = sanitizeXml(xml);
      try {
        const parsed = await xml2js.parseStringPromise(xml, { explicitArray: false, trim: true });
        // Log do XML parseado
        console.log('XML parseado:', JSON.stringify(parsed, null, 2));
        const issue = parsed?.rss?.channel?.item;
        if (!issue) throw new Error('Não foi possível encontrar o elemento <item> no XML. Certifique-se de exportar apenas 1 ticket do Jira.');
        jiraDetails = {
          id: getXmlValue(issue.key) || getXmlValue(issue['customfield:id']) || 'N/A',
          summary: getXmlValue(issue.summary) || '',
          description: extractDescription(issue.description) || '',
          status: getXmlValue(issue.status) || '',
          assignee: getXmlValue(issue.assignee) || '',
          comments: extractComments(issue),
          relatedTickets: extractRelatedTickets(issue, parsed),
          raw: issue
        };
      } catch (parseErr) {
        // Log detalhado do erro de parsing
        console.error('Erro ao fazer parsing do XML:', parseErr);
        return res.status(400).json({ error: 'Erro ao processar o XML colado. Verifique se o conteúdo está completo e é um XML exportado do Jira (exporte apenas 1 ticket por vez). Detalhes: ' + parseErr.message });
      }
    } else if (req.file) {
      // Parse XML do Jira (upload)
      let xml = req.file.buffer.toString();
      xml = sanitizeXml(xml);
      try {
        const parsed = await xml2js.parseStringPromise(xml, { explicitArray: false, trim: true });
        // Log do XML parseado
        console.log('XML parseado (upload):', JSON.stringify(parsed, null, 2));
        const issue = parsed?.rss?.channel?.item;
        if (!issue) throw new Error('Não foi possível encontrar o elemento <item> no XML. Certifique-se de exportar apenas 1 ticket do Jira.');
        jiraDetails = {
          id: getXmlValue(issue.key) || getXmlValue(issue['customfield:id']) || 'N/A',
          summary: getXmlValue(issue.summary) || '',
          description: extractDescription(issue.description) || '',
          status: getXmlValue(issue.status) || '',
          assignee: getXmlValue(issue.assignee) || '',
          comments: extractComments(issue),
          relatedTickets: extractRelatedTickets(issue, parsed),
          raw: issue
        };
      } catch (parseErr) {
        // Log detalhado do erro de parsing
        console.error('Erro ao fazer parsing do XML (upload):', parseErr);
        return res.status(400).json({ error: 'Erro ao processar o arquivo XML enviado. Verifique se é um XML exportado do Jira (exporte apenas 1 ticket por vez). Detalhes: ' + parseErr.message });
      }
    } else if (req.body.ticketId) {
      jiraDetails = await fetchJiraTicket(req.body.ticketId);
    }
    // Gera cenários com IA
    if (!jiraDetails || !jiraDetails.summary) {
      throw new Error('Ticket Jira inválido ou faltando informações para gerar cenários. Certifique-se de que o XML contém <summary>.');
    }
    const scenarios = await generateScenariosWithAI({ jiraDetails, confluence });
    res.json({ scenarios, jiraDetails });
  } catch (err) {
    // Log detalhado do erro geral
    console.error('Erro no endpoint /api/generate:', err);
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/ai-steps', async (req, res) => {
  const { url, instructions } = req.body;
  const prompt = `Você é um engenheiro de QA. Gere uma sequência de passos detalhados para testar a seguinte funcionalidade no ambiente:\n\nURL: ${url}\nO que testar: ${instructions}\n\nListe os passos de automação ou validação manual necessários.`;
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const completion = await openai.chat.completions.create({
    model: 'gpt-3.5-turbo',
    messages: [{ role: 'user', content: prompt }],
    max_tokens: 256,
    temperature: 0.6
  });
  res.json({ steps: completion.choices[0].message.content });
});

function readDocsIndex() {
  if (!fs.existsSync(DOCS_INDEX)) return [];
  return JSON.parse(fs.readFileSync(DOCS_INDEX, 'utf-8'));
}
function writeDocsIndex(data) {
  fs.writeFileSync(DOCS_INDEX, JSON.stringify(data, null, 2), 'utf-8');
}

app.post('/api/docs', docsUpload.array('docs'), async (req, res) => {
  let docsIndex = readDocsIndex();
  for (const file of req.files) {
    let text = '';
    if (file.mimetype === 'application/pdf') {
      const dataBuffer = fs.readFileSync(file.path);
      const pdfData = await pdfParse(dataBuffer);
      text = pdfData.text;
    } else {
      text = fs.readFileSync(file.path, 'utf-8');
    }
    docsIndex.push({
      id: file.filename,
      name: file.originalname,
      mimetype: file.mimetype,
      text,
      uploadedAt: new Date().toISOString()
    });
  }
  writeDocsIndex(docsIndex);
  res.json({ ok: true, docs: docsIndex });
});

app.get('/api/docs', (req, res) => {
  res.json(readDocsIndex());
});

const PORT = 4000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
