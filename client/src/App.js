import React, { useState, useEffect } from 'react';
import * as pdfjsLib from 'pdfjs-dist/build/pdf';
pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

function App() {
  const [ticketId, setTicketId] = useState('');
  const [confluence, setConfluence] = useState('');
  const [xmlFile, setXmlFile] = useState(null);
  const [xmlText, setXmlText] = useState('');
  const [scenarios, setScenarios] = useState([]);
  const [jiraDetails, setJiraDetails] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [saveStatus, setSaveStatus] = useState('');
  const [docs, setDocs] = useState([]);
  const [selectedDocs, setSelectedDocs] = useState([]);
  const [savedScenarios, setSavedScenarios] = useState([]);
  const [showSaved, setShowSaved] = useState(false);
  const [testUrl, setTestUrl] = useState('');
  const [showTestModal, setShowTestModal] = useState(false);
  const [testInstructions, setTestInstructions] = useState('');
  const [aiSteps, setAiSteps] = useState('');
  const [showTooltip, setShowTooltip] = useState(false);
  const [showImprovements, setShowImprovements] = useState(false);

  const handleSaveScenarios = async () => {
    if (!jiraDetails || !scenarios.length) return;
    setSaveStatus('Salvando...');
    try {
      const res = await fetch('http://localhost:4000/api/scenarios', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jiraId: jiraDetails.id,
          summary: jiraDetails.summary,
          description: jiraDetails.description,
          cenarios: scenarios,
        }),
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || 'Erro ao salvar cenários');
      }
      setSaveStatus('Cenários salvos com sucesso!');
    } catch (err) {
      setSaveStatus('Erro ao salvar: ' + err.message);
    }
  };

  const handleGenerate = async () => {
    setLoading(true);
    setError('');
    setScenarios([]);
    setJiraDetails(null);
    try {
      let res, data;
      if (xmlText.trim()) {
        // Prioridade máxima: texto colado
        let confluenceText = confluence;
        if (selectedDocs.length > 0) {
          const selected = docs.filter(doc => selectedDocs.includes(doc.id));
          confluenceText += '\n\n' + selected.map(doc => `---\n${doc.name}\n\n${doc.text}`).join('\n\n');
        }
        res = await fetch('http://localhost:4000/api/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ xmlText, confluence: confluenceText })
        });
      } else if (xmlFile) {
        // Upload de ficheiro
        const formData = new FormData();
        formData.append('xmlFile', xmlFile);
        formData.append('confluence', confluence);
        res = await fetch('http://localhost:4000/api/generate', {
          method: 'POST',
          body: formData
        });
      } else {
        // Busca por ticketId
        let confluenceText = confluence;
        if (selectedDocs.length > 0) {
          const selected = docs.filter(doc => selectedDocs.includes(doc.id));
          confluenceText += '\n\n' + selected.map(doc => `---\n${doc.name}\n\n${doc.text}`).join('\n\n');
        }
        res = await fetch('http://localhost:4000/api/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ticketId, confluence: confluenceText })
        });
      }
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || 'Failed to generate scenarios');
      }
      data = await res.json();
      setScenarios(data.scenarios);
      setJiraDetails(data.jiraDetails || null);
    } catch (err) {
      setError(err.message);
      setJiraDetails(null);
    }
    setLoading(false);
  };

  const handleDocsUpload = async (e) => {
    const files = Array.from(e.target.files);
    const formData = new FormData();
    files.forEach(f => formData.append('docs', f));
    const res = await fetch('http://localhost:4000/api/docs', {
      method: 'POST',
      body: formData
    });
    const data = await res.json();
    setDocs(data.docs);
  };

  useEffect(() => {
    fetch('http://localhost:4000/api/docs')
      .then(res => res.json())
      .then(setDocs);
  }, []);

  useEffect(() => {
    if (showSaved) {
      fetch('http://localhost:4000/api/scenarios')
        .then(res => res.json())
        .then(setSavedScenarios);
    }
  }, [showSaved]);

  return (
    <div style={{ maxWidth: 600, margin: '40px auto', fontFamily: 'sans-serif' }}>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 8 }}>
        <h1 style={{ margin: 0 }}>QA Scenario Generator PoC</h1>
        <span
          style={{ marginLeft: 12, cursor: 'pointer', fontSize: 22, color: '#0077cc' }}
          onMouseEnter={() => setShowTooltip(true)}
          onMouseLeave={() => setShowTooltip(false)}
        >&#9432;</span>
        <span
          style={{ marginLeft: 18, cursor: 'pointer', fontSize: 22, color: '#ff9800' }}
          onMouseEnter={() => setShowImprovements(true)}
          onMouseLeave={() => setShowImprovements(false)}
        >&#9881;</span>
      </div>
      {showTooltip && (
        <div style={{
          position: 'absolute', top: 55, left: 40, zIndex: 1000, background: '#fff', color: '#222', border: '1px solid #b3d1ff', borderRadius: 8, padding: 18, boxShadow: '0 2px 12px #0002', maxWidth: 500, fontSize: 15
        }}>
          <b>Funcionalidades principais:</b>
          <ul style={{ marginLeft: 18, marginBottom: 8 }}>
            <li>Geração inteligente de cenários de QA via IA, usando contexto completo do ticket e documentação.</li>
            <li>Busca automática de detalhes do Jira por ID, upload/colagem de XML exportado do Jira.</li>
            <li>Upload/indexação de documentação (PDF, Markdown, TXT, HTML) e seleção de múltiplos arquivos para enriquecer o contexto da IA.</li>
            <li>Visualização e organização dos documentos e cenários salvos, agrupados por ticket.</li>
            <li>Campo para URL do ambiente de teste, com popup para descrever o que testar e integração IA para sugerir passos de automação/validação.</li>
            <li>API pronta para importar/enriquecer scripts de automação (Cypress, Selenium, Playwright, etc) com sugestões inteligentes da IA.</li>
            <li>Estrutura modular, pronta para integração com plugins externos de gravação de passos.</li>
            <li>Persistência local de cenários, documentação e scripts para reuso incremental.</li>
          </ul>
          <span style={{ color: '#888', fontSize: 13 }}>Pronto para evoluir: sumarização automática, detecção de gaps, exportação para frameworks de automação e muito mais!</span>
        </div>
      )}
      {showImprovements && (
        <div style={{
          position: 'absolute', top: 55, left: 320, zIndex: 1000, background: '#fff', color: '#222', border: '1px solid #ffd699', borderRadius: 8, padding: 18, boxShadow: '0 2px 12px #0002', maxWidth: 520, fontSize: 15
        }}>
          <b>Melhorias Futuras e Ideias:</b>
          <ul style={{ marginLeft: 18, marginBottom: 8 }}>
            <li>Painel de release/test run: seleção de múltiplos tickets e execução guiada de cenários.</li>
            <li>Execução manual guiada com logs, evidências e geração automática de relatórios.</li>
            <li>Geração automática de scripts de automação (Cypress, Playwright, Selenium) via IA.</li>
            <li>Importação/exportação de scripts gravados por plugins/extensões (Selenium IDE, Cypress Recorder, etc).</li>
            <li>Enriquecimento inteligente de scripts: asserts, refatoração, documentação, tradução entre frameworks.</li>
            <li>Execução automática remota de scripts e integração com CI/CD (Jenkins, GitHub Actions, etc).</li>
            <li>Sumarização IA da cobertura, detecção de gaps, sugestões de cenários adicionais.</li>
            <li>Dashboard de cobertura e qualidade de QA por release.</li>
          </ul>
          <span style={{ color: '#888', fontSize: 13 }}>Essas ideias podem ser implementadas incrementalmente conforme a evolução do projeto!</span>
        </div>
      )}
      <div style={{ marginBottom: 16 }}>
        <label>Jira Ticket ID<br/>
          <input type="text" value={ticketId} onChange={e => setTicketId(e.target.value)} style={{ width: '100%' }} placeholder="e.g. PROJ-123" disabled={!!xmlFile} />
        </label>
      </div>
      <div style={{ marginBottom: 16 }}>
        <label>Ou cole o conteúdo do XML exportado do Jira<br/>
          <textarea value={xmlText} onChange={e => setXmlText(e.target.value)} rows={6} style={{ width: '100%' }} placeholder="Cole aqui o XML inteiro do Jira" />
        </label>
      </div>
      <div style={{ marginBottom: 16 }}>
        <label>Ou envie o ficheiro XML exportado do Jira<br/>
          <input type="file" accept=".xml" onChange={e => setXmlFile(e.target.files[0])} disabled={!!xmlText.trim()} />
          {xmlFile && <span style={{ marginLeft: 8 }}>{xmlFile.name} <button onClick={() => setXmlFile(null)} style={{ color: 'red', border: 'none', background: 'none', cursor: 'pointer' }}>x</button></span>}
        </label>
      </div>
      <div style={{ marginBottom: 16 }}>
        <label>Importar documentação (PDF, .md, .txt, .html):<br/>
          <input type="file" multiple accept=".pdf,.md,.txt,.html" onChange={handleDocsUpload} />
        </label>
        <div style={{ marginTop: 8 }}>
          <b>Documentos importados:</b>
          <ul>
            {docs.map(doc => (
              <li key={doc.id}>
                <label>
                  <input
                    type="checkbox"
                    checked={selectedDocs.includes(doc.id)}
                    onChange={e => {
                      setSelectedDocs(e.target.checked
                        ? [...selectedDocs, doc.id]
                        : selectedDocs.filter(id => id !== doc.id));
                    }}
                  />
                  {doc.name}
                </label>
              </li>
            ))}
          </ul>
        </div>
      </div>
      <div style={{ marginBottom: 16 }}>
        <label>Confluence Documentation<br/>
          <textarea value={confluence} onChange={e => setConfluence(e.target.value)} rows={3} style={{ width: '100%' }} />
        </label>
      </div>
      <div style={{ marginBottom: 16 }}>
        <label>
          URL do ambiente para testar:<br/>
          <input
            type="text"
            value={testUrl}
            onChange={e => setTestUrl(e.target.value)}
            style={{ width: '80%' }}
            placeholder="https://ambiente-teste.suaempresa.com"
          />
          <button
            style={{ marginLeft: 8, padding: '6px 12px' }}
            onClick={() => {
              if (testUrl) {
                window.open(testUrl, '_blank');
                setShowTestModal(true);
              }
            }}
            disabled={!testUrl}
          >
            Abrir e Testar
          </button>
        </label>
      </div>
      <button onClick={handleGenerate} disabled={loading} style={{ padding: '8px 16px' }}>
        {loading ? 'Generating...' : 'Generate QA Scenarios'}
      </button>
      {error && <div style={{ color: 'red', marginTop: 16 }}>{error}</div>}
      {jiraDetails && (
        <div style={{ marginTop: 32, background: '#eef6fa', padding: 16, borderRadius: 8 }}>
          <h2>Jira Ticket Details</h2>
          <div><b>ID:</b> {jiraDetails.id}</div>
          <div><b>Summary:</b> {jiraDetails.summary}</div>
          <div><b>Description:</b> <span dangerouslySetInnerHTML={{ __html: jiraDetails.description }} /></div>
          <div><b>Status:</b> {jiraDetails.status}</div>
          <div><b>Assignee:</b> {jiraDetails.assignee}</div>
        </div>
      )}
      <div style={{ marginTop: 32 }}>
        <h2>Generated Scenarios</h2>
        {scenarios.length === 0 && <div>No scenarios yet.</div>}
        <ul>
          {scenarios.map((s, idx) => (
            <li key={idx} style={{ marginBottom: 12, background: '#f8f8f8', padding: 12, borderRadius: 6 }}>
              {s}
            </li>
          ))}
        </ul>
        {scenarios.length > 0 && jiraDetails && (
          <div style={{ marginTop: 16 }}>
            <button onClick={handleSaveScenarios} style={{ padding: '8px 16px' }}>
              Salvar Cenários
            </button>
            {saveStatus && <div style={{ marginTop: 8 }}>{saveStatus}</div>}
          </div>
        )}
      </div>
      <button
        onClick={() => setShowSaved(s => !s)}
        style={{ marginBottom: 24, padding: '8px 16px', background: showSaved ? '#eef6fa' : '#f8f8f8' }}
      >
        {showSaved ? 'Ocultar Cenários Salvos' : 'Ver Cenários Salvos'}
      </button>
      {showSaved && (
        <div style={{ marginBottom: 32, background: '#f3f7fa', borderRadius: 8, padding: 16, maxHeight: 400, overflow: 'auto' }}>
          <h2>Cenários Salvos</h2>
          {savedScenarios.length === 0 && <div>Nenhum cenário salvo ainda.</div>}
          {savedScenarios.map(scenario => (
            <div key={scenario.id} style={{ marginBottom: 24, padding: 12, background: '#fff', borderRadius: 6, boxShadow: '0 1px 2px #eee' }}>
              <div><b>Ticket:</b> {scenario.jiraId} - <b>{scenario.summary}</b></div>
              <div style={{ fontSize: 13, color: '#888', marginBottom: 8 }}>
                Criado em: {new Date(scenario.dataCriacao).toLocaleString()}
              </div>
              <div><b>Descrição:</b> <span dangerouslySetInnerHTML={{ __html: scenario.description || '<i>Sem descrição</i>' }} /></div>
              <div style={{ marginTop: 8 }}>
                <b>Cenários:</b>
                <ul>
                  {scenario.cenarios.map((c, idx) => (
                    <li key={idx} style={{ marginBottom: 6, background: '#eef6fa', padding: 8, borderRadius: 4, fontSize: 15 }}>
                      {c}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ))}
        </div>
      )}
      {showTestModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh',
          background: 'rgba(0,0,0,0.45)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>
          <div style={{ background: '#fff', borderRadius: 8, padding: 32, minWidth: 350, boxShadow: '0 2px 16px #0002' }}>
            <h2>O que precisa ser testado?</h2>
            <textarea
              value={testInstructions}
              onChange={e => setTestInstructions(e.target.value)}
              rows={4}
              style={{ width: '100%', marginBottom: 16 }}
              placeholder="Descreva o que deseja validar ou automatizar neste ambiente..."
            />
            <div>
              <button
                style={{ marginRight: 12, padding: '6px 16px' }}
                onClick={async () => {
                  const res = await fetch('http://localhost:4000/api/ai-steps', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ url: testUrl, instructions: testInstructions })
                  });
                  const data = await res.json();
                  setAiSteps(data.steps || 'Nenhum passo sugerido pela IA.');
                }}
                disabled={!testInstructions}
              >Sugerir passos IA</button>
              <button
                style={{ padding: '6px 16px' }}
                onClick={() => {
                  setShowTestModal(false);
                  setTestInstructions('');
                  setAiSteps('');
                }}
              >Fechar</button>
            </div>
            {aiSteps && (
              <div style={{ marginTop: 18, background: '#eef6fa', borderRadius: 6, padding: 12 }}>
                <b>Passos sugeridos pela IA:</b>
                <pre style={{ whiteSpace: 'pre-wrap', fontSize: 15 }}>{aiSteps}</pre>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
