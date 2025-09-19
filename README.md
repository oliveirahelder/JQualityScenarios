# QA Scenario Generator

Uma aplicação web para gerar cenários de QA automaticamente a partir de tickets do Jira e documentação do Confluence, usando IA generativa.

---

## Funcionalidades
- Busca detalhes de tickets diretamente da API do Jira (via número do ticket)
- Permite colar ou fazer upload do XML exportado do Jira
- Integração com OpenAI para geração de cenários de teste inteligentes
- Suporte a documentação adicional (Confluence)
- Interface simples e rápida para equipas de QA

---

## Instalação e Setup

### 1. Backend
```sh
cd server
npm install
```

#### Configuração do .env
Crie o arquivo `.env` dentro da pasta `server` com:
```
JIRA_BASE_URL=https://seusite.atlassian.net
JIRA_USER=seu-email@empresa.com
JIRA_TOKEN=seu_token_api
OPENAI_API_KEY=sua-chave-openai
```

### 2. Frontend
```sh
cd client
npm install
```

### 3. Rodando
- Inicie o backend:
  ```sh
  cd server
  npm start
  ```
- Inicie o frontend:
  ```sh
  cd client
  npm start
  ```
- Acesse [http://localhost:3000](http://localhost:3000)

---

## Como usar

### 1. Buscar ticket Jira automaticamente
- Digite o número do ticket no campo "Jira Ticket ID" (ex: PROJ-123)
- Clique em "Generate QA Scenarios"
- Os detalhes do ticket e os cenários gerados pela IA aparecerão na tela

### 2. Colar conteúdo XML do Jira
- Cole o conteúdo do XML exportado do Jira no campo apropriado
- Clique em "Generate QA Scenarios"
- Os detalhes do ticket (extraídos do XML) e os cenários gerados pela IA aparecerão na tela

### 3. Upload de ficheiro XML do Jira
- Faça upload do arquivo XML exportado do Jira
- Clique em "Generate QA Scenarios"
- O fluxo é o mesmo acima

### 4. Upload e seleção de documentação adicional (PDF, Markdown, TXT, HTML)
- Faça upload de um ou mais arquivos de documentação (exportados do Confluence, PDFs, Markdown, TXT, HTML)
- Os arquivos são indexados localmente e ficam disponíveis para seleção
- Marque quais documentos devem ser usados ao gerar os cenários
- O conteúdo dos documentos selecionados será incluído no contexto enviado para a IA

### 5. Adicionar detalhes manuais do Confluence
- Preencha o campo de documentação (opcional)
- A IA irá considerar esse conteúdo ao gerar os cenários

---

## Fluxos suportados
- **TicketId preenchido:** busca detalhes do Jira via API
- **XML colado:** extrai detalhes do XML colado (prioridade máxima)
- **Upload de XML:** extrai detalhes do arquivo enviado
- **Upload de documentação:** indexa e permite seleção de múltiplos arquivos (PDF, Markdown, TXT, HTML)
- **Confluence:** sempre pode ser usado junto

---

## Exemplo de uso

1. Cole um XML exportado do Jira:
```
<rss><channel><item>
  <key>PROJ-123</key>
  <summary>Login não funciona</summary>
  <description>Usuário não consegue logar...</description>
  <status>To Do</status>
  <assignee>Maria QA</assignee>
</item></channel></rss>
```

2. Clique em "Generate QA Scenarios" e veja os cenários sugeridos pela IA!

---

## Observações técnicas
- A IA utilizada é o modelo GPT-3.5-turbo da OpenAI
- O backend aceita tanto JSON (para xmlText, ticketId) quanto multipart/form-data (para upload de ficheiro)
- O parser XML é compatível com exportações padrão do Jira
- O sistema pode ser facilmente adaptado para outros formatos ou integrações

---

## Segurança
- Nunca compartilhe seu token da OpenAI ou Jira publicamente
- O arquivo `.env` já está gitignored por padrão

---

## Dúvidas ou melhorias?
Abra um issue ou entre em contato com o desenvolvedor!
