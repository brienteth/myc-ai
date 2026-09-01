import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  ReactFlow, 
  Controls, 
  MiniMap, 
  Background, 
  useNodesState, 
  useEdgesState, 
  addEdge,
  useReactFlow,
  ReactFlowProvider
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import { 
  Play, Save, Check, UploadCloud, Square, X, Download, FileText, 
  CheckCircle2, Cpu, Search, Globe, Folder, Image, Settings, Terminal, Sparkles, FileSpreadsheet, RotateCcw,
  Bot
} from 'lucide-react';
import WorkflowInspector from './WorkflowInspector';
import WorkflowDebugger from './WorkflowDebugger';
import WorkflowAIAssist from './WorkflowAIAssist';
import SystemNode from './SystemNode';
import SkillNode from './SkillNode';
import { queryAI } from '../../services/aiService.js';
import './WorkflowStudio.css';

const nodeTypes = {
  system: SystemNode,
  skill: SkillNode,
};

const SKILL_CATEGORIES = [
  { 
    name: 'Browser & Web', 
    icon: Globe, 
    skills: [
      { id: 'browser.search', title: 'Browser Search', desc: 'Search the web using Myca Browser', latency: '400ms', offline: false, permission: 'network.out' },
      { id: 'browser.goto', title: 'Open URL', desc: 'Navigate to a specific URL', latency: '200ms', offline: false, permission: 'network.out' },
      { id: 'web.scrape', title: 'Web Scraper & HTML Reader', desc: 'Scrape page content & tables from URLs', latency: '350ms', offline: false, permission: 'network.out' },
      { id: 'github.repo_read', title: 'GitHub Repo Inspector', desc: 'Fetch code, issues, and READMEs from GitHub repos', latency: '500ms', offline: false, permission: 'network.out' },
      { id: 'rss.read', title: 'RSS Feed News Reader', desc: 'Read news feeds & tech updates from RSS sources', latency: '250ms', offline: false, permission: 'network.out' }
    ] 
  },
  { 
    name: 'Filesystem & Library', 
    icon: Folder, 
    skills: [
      { id: 'filesystem.search', title: 'Search Directory', desc: 'Search files by pattern in folder', latency: '2ms', offline: true, permission: 'fs.read' },
      { id: 'document.read', title: 'Read File / Document', desc: 'Extract content from PDF, CSV, TXT, DOCX', latency: '5ms', offline: true, permission: 'fs.read' },
      { id: 'table.write', title: 'Write Output File', desc: 'Synthesize PDF, CSV, JSON, TXT report', latency: '10ms', offline: true, permission: 'fs.write' },
      { id: 'fs.read', title: 'Raw File Read', desc: 'Read raw text/binary file from local storage', latency: '1ms', offline: true, permission: 'fs.read' },
      { id: 'fs.write', title: 'Raw File Write', desc: 'Write raw bytes/text directly to disk', latency: '2ms', offline: true, permission: 'fs.write' },
      { id: 'library.index', title: 'Index Local Library', desc: 'Index local files for RAG semantic search', latency: '300ms', offline: true, permission: 'fs.read' },
      { id: 'library.search', title: 'Semantic Library Search', desc: 'Query indexed knowledge base with AI embeddings', latency: '80ms', offline: true, permission: 'ai.local' }
    ] 
  },
  { 
    name: 'AI & Autonomous Agents', 
    icon: Terminal, 
    skills: [
      { id: 'core.chat', title: 'AI Assistant Reasoning (0G Compute)', desc: 'Process prompt with 0G Compute local AI', latency: '800ms', offline: true, permission: 'ai.local' },
      { id: 'document.extract', title: 'Data Extraction', desc: 'Extract structured tables & insights from text', latency: '600ms', offline: true, permission: 'ai.local' },
      { id: 'ai.summary', title: 'Document Summarizer', desc: 'Generate concise summaries for long documents', latency: '700ms', offline: true, permission: 'ai.local' },
      { id: 'core.verify', title: 'Fact Verification Engine', desc: 'Verify accuracy and hallucinations in AI responses', latency: '500ms', offline: true, permission: 'ai.local' },
      { id: 'anthropic_agent.run', title: 'Autonomous Agent Sub-Engine', desc: 'Run multi-step autonomous task planning agent', latency: '1500ms', offline: true, permission: 'ai.local' }
    ] 
  },
  { 
    name: 'Enterprise & KOBİ', 
    icon: Settings, 
    skills: [
      { id: 'crm.lead_extract', title: 'CRM Lead Extractor', desc: 'Extract customer contacts, emails, phone numbers for SMEs', latency: '500ms', offline: true, permission: 'ai.local' },
      { id: 'finance.invoice_parse', title: 'Invoice & Financial Parser', desc: 'Parse PDF/Image invoices into CSV/JSON tables', latency: '700ms', offline: true, permission: 'fs.read' },
      { id: 'opacus.mpc', title: 'Opacus Privacy & MPC Computation', desc: 'Execute secure multi-party zero-knowledge computation', latency: '1100ms', offline: true, permission: 'ai.local' }
    ] 
  },
  { 
    name: 'Marketing & Influencer', 
    icon: Sparkles, 
    skills: [
      { id: 'marketing.social_post', title: 'Social Media Post Generator', desc: 'Generate Instagram, LinkedIn, and X posts with hashtags', latency: '600ms', offline: true, permission: 'ai.local' },
      { id: 'influencer.content_plan', title: 'Influencer 30-Day Content Plan', desc: 'Generate Reels/TikTok video scripts and content calendars', latency: '900ms', offline: true, permission: 'ai.local' },
      { id: 'x.post', title: 'Post to X (Twitter)', desc: 'Publish tweet to X/Twitter account', latency: '400ms', offline: false, permission: 'network.out' },
      { id: 'instagram.post', title: 'Post to Instagram Reels', desc: 'Publish short video/image to Instagram', latency: '800ms', offline: false, permission: 'network.out' },
      { id: 'youtube.upload', title: 'Upload to YouTube Shorts', desc: 'Upload MP4 video to YouTube channel', latency: '2000ms', offline: false, permission: 'network.out' },
      { id: 'video.generate', title: 'AI Short Video Generator', desc: 'Generate AI short video clips from text script', latency: '3000ms', offline: true, permission: 'ai.vision' },
      { id: 'youtube.transcribe', title: 'YouTube Video Transcriber', desc: 'Extract subtitles & transcripts from YouTube videos', latency: '600ms', offline: false, permission: 'network.out' },
      { id: 'twitter.search', title: 'Twitter / X Keyword Search', desc: 'Search viral tweets and trends by keyword', latency: '450ms', offline: false, permission: 'network.out' }
    ] 
  },
  { 
    name: 'Vision & Media', 
    icon: Image, 
    skills: [
      { id: 'vision.analyze', title: 'Analyze Image', desc: 'Describe visual contents of an image', latency: '1200ms', offline: true, permission: 'ai.vision' },
      { id: 'image.ocr', title: 'Optical Character Recognition (OCR)', desc: 'Extract text from scanned images and screenshots', latency: '400ms', offline: true, permission: 'fs.read' }
    ] 
  },
  { 
    name: 'Communication & P2P Mesh', 
    icon: Settings, 
    skills: [
      { id: 'communication.send', title: 'Universal Communication Send', desc: 'Send message via Email, Telegram, Webhook, or Slack', latency: '300ms', offline: false, permission: 'network.out' },
      { id: 'telegram.send', title: 'Direct Telegram Dispatcher', desc: 'Send instant notification to Telegram channels/groups', latency: '250ms', offline: false, permission: 'network.out' },
      { id: 'email.send', title: 'SMTP Email Sender', desc: 'Send automated emails with attachments', latency: '500ms', offline: false, permission: 'network.out' },
      { id: 'p2p.agent_reach', title: 'P2P Colony Agent Mesh Reach', desc: 'Dispatch tasks to surrounding P2P nodes in Myca Colony', latency: '150ms', offline: true, permission: 'network.mesh' }
    ] 
  }
];

// ─── Per-Skill Manifest: Required Inputs, Credentials & Descriptions ───
const SKILL_MANIFESTS = {
  // Browser & Web
  'browser.search': {
    required_inputs: [
      { name: 'query', type: 'text', description: 'Arama sorgusu (örn: "BTC son haberler")' },
      { name: 'max_results', type: 'text', description: 'Maks sonuç sayısı (varsayılan: 10)' }
    ],
    optional_inputs: [{ name: 'language', type: 'text', description: 'Sonuç dili (tr/en)' }],
    required_credentials: [],
    runtime: 'network'
  },
  'browser.goto': {
    required_inputs: [
      { name: 'url', type: 'text', description: 'Hedef URL (örn: https://example.com)' }
    ],
    optional_inputs: [{ name: 'wait_selector', type: 'text', description: 'CSS seçici (sayfa yüklenene kadar bekle)' }],
    required_credentials: [],
    runtime: 'network'
  },
  'web.scrape': {
    required_inputs: [
      { name: 'url', type: 'text', description: 'Kazınacak sayfa URL\'si' },
      { name: 'selector', type: 'text', description: 'CSS seçici (örn: article, .content, table)' }
    ],
    optional_inputs: [{ name: 'output_format', type: 'text', description: 'Çıktı formatı: text/html/json' }],
    required_credentials: [],
    runtime: 'network'
  },
  'github.repo_read': {
    required_inputs: [
      { name: 'repo', type: 'text', description: 'Repo adresi (örn: brienteth/myc-ai)' }
    ],
    optional_inputs: [{ name: 'branch', type: 'text', description: 'Dal adı (varsayılan: main)' }],
    required_credentials: ['GITHUB_TOKEN'],
    runtime: 'network'
  },
  'rss.read': {
    required_inputs: [
      { name: 'feed_url', type: 'text', description: 'RSS feed URL\'si' },
      { name: 'max_items', type: 'text', description: 'Maks haber sayısı (varsayılan: 20)' }
    ],
    optional_inputs: [],
    required_credentials: [],
    runtime: 'network'
  },

  // Filesystem & Library
  'filesystem.search': {
    required_inputs: [
      { name: 'path', type: 'text', description: 'Aranacak klasör yolu (örn: ~/Documents)' },
      { name: 'pattern', type: 'text', description: 'Dosya deseni (örn: *.pdf, rapor*)' }
    ],
    optional_inputs: [],
    required_credentials: [],
    runtime: 'local'
  },
  'document.read': {
    required_inputs: [
      { name: 'path', type: 'text', description: 'Okunacak dosya yolu (PDF, CSV, TXT, DOCX)' }
    ],
    optional_inputs: [{ name: 'pages', type: 'text', description: 'Sayfa aralığı (örn: 1-5)' }],
    required_credentials: [],
    runtime: 'local'
  },
  'table.write': {
    required_inputs: [
      { name: 'path', type: 'text', description: 'Çıktı dosya yolu (örn: ~/Desktop/rapor.csv)' },
      { name: 'content', type: 'textarea', description: 'Yazılacak içerik veya {{önceki_adım_çıktısı}}' },
      { name: 'format', type: 'text', description: 'Dosya formatı: csv/json/txt/pdf' }
    ],
    optional_inputs: [],
    required_credentials: [],
    runtime: 'local'
  },
  'fs.read': {
    required_inputs: [
      { name: 'path', type: 'text', description: 'Okunacak ham dosya yolu' }
    ],
    optional_inputs: [],
    required_credentials: [],
    runtime: 'local'
  },
  'fs.write': {
    required_inputs: [
      { name: 'path', type: 'text', description: 'Yazılacak dosya yolu' },
      { name: 'content', type: 'textarea', description: 'Yazılacak içerik' }
    ],
    optional_inputs: [],
    required_credentials: [],
    runtime: 'local'
  },
  'library.index': {
    required_inputs: [
      { name: 'directory', type: 'text', description: 'İndekslenecek klasör yolu' }
    ],
    optional_inputs: [{ name: 'file_types', type: 'text', description: 'Dosya türleri (örn: pdf,txt,md)' }],
    required_credentials: [],
    runtime: 'local'
  },
  'library.search': {
    required_inputs: [
      { name: 'query', type: 'text', description: 'Semantik arama sorgusu' }
    ],
    optional_inputs: [{ name: 'top_k', type: 'text', description: 'Maks sonuç sayısı (varsayılan: 5)' }],
    required_credentials: [],
    runtime: 'local'
  },

  // AI & Autonomous Agents
  'core.chat': {
    required_inputs: [
      { name: 'prompt', type: 'textarea', description: 'AI modeline gönderilecek mesaj/komut' }
    ],
    optional_inputs: [
      { name: 'model', type: 'text', description: 'Model adı (varsayılan: gpt-5.6-sol)' },
      { name: 'max_tokens', type: 'text', description: 'Maks token sayısı (varsayılan: 2500)' }
    ],
    required_credentials: [],
    runtime: 'local'
  },
  'document.extract': {
    required_inputs: [
      { name: 'content', type: 'textarea', description: 'Analiz edilecek metin veya {{önceki_adım_çıktısı}}' },
      { name: 'extract_type', type: 'text', description: 'Çıkarım türü: tables/entities/summary/keywords' }
    ],
    optional_inputs: [],
    required_credentials: [],
    runtime: 'local'
  },
  'ai.summary': {
    required_inputs: [
      { name: 'content', type: 'textarea', description: 'Özetlenecek uzun metin veya dosya içeriği' }
    ],
    optional_inputs: [{ name: 'max_length', type: 'text', description: 'Maks özet kelime sayısı' }],
    required_credentials: [],
    runtime: 'local'
  },
  'core.verify': {
    required_inputs: [
      { name: 'claim', type: 'textarea', description: 'Doğrulanacak ifade veya AI yanıtı' }
    ],
    optional_inputs: [],
    required_credentials: [],
    runtime: 'local'
  },
  'anthropic_agent.run': {
    required_inputs: [
      { name: 'task', type: 'textarea', description: 'Otonom ajanın yürüteceği çok adımlı görev açıklaması' }
    ],
    optional_inputs: [{ name: 'max_steps', type: 'text', description: 'Maks adım sayısı (varsayılan: 10)' }],
    required_credentials: [],
    runtime: 'local'
  },

  // Enterprise & KOBİ
  'crm.lead_extract': {
    required_inputs: [
      { name: 'source', type: 'textarea', description: 'Müşteri verisi kaynağı (metin, URL veya dosya yolu)' }
    ],
    optional_inputs: [{ name: 'fields', type: 'text', description: 'Çıkarılacak alanlar: name,email,phone,company' }],
    required_credentials: [],
    runtime: 'local'
  },
  'finance.invoice_parse': {
    required_inputs: [
      { name: 'file_path', type: 'text', description: 'Fatura dosya yolu (PDF/Görsel)' }
    ],
    optional_inputs: [{ name: 'output_format', type: 'text', description: 'Çıktı formatı: csv/json' }],
    required_credentials: [],
    runtime: 'local'
  },
  'opacus.mpc': {
    required_inputs: [
      { name: 'computation', type: 'textarea', description: 'Güvenli hesaplama açıklaması' },
      { name: 'parties', type: 'text', description: 'Katılımcı sayısı (varsayılan: 2)' }
    ],
    optional_inputs: [],
    required_credentials: [],
    runtime: 'local'
  },

  // Marketing & Influencer
  'marketing.social_post': {
    required_inputs: [
      { name: 'topic', type: 'text', description: 'Paylaşım konusu (örn: "Yapay zeka haberleri")' },
      { name: 'platform', type: 'text', description: 'Hedef platform: instagram/linkedin/x/all' }
    ],
    optional_inputs: [{ name: 'tone', type: 'text', description: 'Ton: professional/casual/humorous' }],
    required_credentials: [],
    runtime: 'local'
  },
  'influencer.content_plan': {
    required_inputs: [
      { name: 'niche', type: 'text', description: 'İçerik niş alanı (örn: teknoloji, fitness)' },
      { name: 'days', type: 'text', description: 'Plan gün sayısı (varsayılan: 30)' }
    ],
    optional_inputs: [],
    required_credentials: [],
    runtime: 'local'
  },
  'x.post': {
    required_inputs: [
      { name: 'tweet_text', type: 'textarea', description: 'Yayınlanacak tweet metni (maks 280 karakter)' }
    ],
    optional_inputs: [{ name: 'media_path', type: 'text', description: 'Eklenecek medya dosyası yolu' }],
    required_credentials: ['X_API_KEY', 'X_API_SECRET', 'X_ACCESS_TOKEN', 'X_ACCESS_SECRET'],
    runtime: 'network'
  },
  'instagram.post': {
    required_inputs: [
      { name: 'media_path', type: 'text', description: 'Yayınlanacak görsel/video dosya yolu' },
      { name: 'caption', type: 'textarea', description: 'Paylaşım açıklaması ve hashtagler' }
    ],
    optional_inputs: [],
    required_credentials: ['INSTAGRAM_ACCESS_TOKEN'],
    runtime: 'network'
  },
  'youtube.upload': {
    required_inputs: [
      { name: 'video_path', type: 'text', description: 'Yüklenecek MP4 video dosya yolu' },
      { name: 'title', type: 'text', description: 'Video başlığı' },
      { name: 'description', type: 'textarea', description: 'Video açıklaması' }
    ],
    optional_inputs: [{ name: 'tags', type: 'text', description: 'Etiketler (virgülle ayırın)' }],
    required_credentials: ['YOUTUBE_API_KEY'],
    runtime: 'network'
  },
  'video.generate': {
    required_inputs: [
      { name: 'script', type: 'textarea', description: 'Video senaryosu / metin açıklaması' },
      { name: 'duration', type: 'text', description: 'Video süresi saniye (varsayılan: 30)' }
    ],
    optional_inputs: [],
    required_credentials: [],
    runtime: 'local'
  },
  'youtube.transcribe': {
    required_inputs: [
      { name: 'video_url', type: 'text', description: 'YouTube video URL\'si' }
    ],
    optional_inputs: [{ name: 'language', type: 'text', description: 'Altyazı dili (tr/en/auto)' }],
    required_credentials: [],
    runtime: 'network'
  },
  'twitter.search': {
    required_inputs: [
      { name: 'keyword', type: 'text', description: 'Aranacak anahtar kelime veya hashtag' },
      { name: 'max_results', type: 'text', description: 'Maks tweet sayısı (varsayılan: 50)' }
    ],
    optional_inputs: [],
    required_credentials: ['X_BEARER_TOKEN'],
    runtime: 'network'
  },

  // Vision & Media
  'vision.analyze': {
    required_inputs: [
      { name: 'image_path', type: 'text', description: 'Analiz edilecek görsel dosya yolu' }
    ],
    optional_inputs: [{ name: 'question', type: 'text', description: 'Görsel hakkında soru (opsiyonel)' }],
    required_credentials: [],
    runtime: 'local'
  },
  'image.ocr': {
    required_inputs: [
      { name: 'image_path', type: 'text', description: 'OCR uygulanacak görsel dosya yolu' }
    ],
    optional_inputs: [{ name: 'language', type: 'text', description: 'OCR dili (tr/en/auto)' }],
    required_credentials: [],
    runtime: 'local'
  },

  // Communication & P2P Mesh
  'communication.send': {
    required_inputs: [
      { name: 'channel', type: 'text', description: 'Kanal: telegram/email/webhook/slack' },
      { name: 'message', type: 'textarea', description: 'Gönderilecek mesaj içeriği' }
    ],
    optional_inputs: [{ name: 'recipient', type: 'text', description: 'Alıcı adresi/ID (kanal tipine göre)' }],
    required_credentials: ['TELEGRAM_BOT_TOKEN'],
    runtime: 'network'
  },
  'telegram.send': {
    required_inputs: [
      { name: 'chat_id', type: 'text', description: 'Telegram Chat/Kanal ID (örn: @mychannel veya -1001234)' },
      { name: 'message', type: 'textarea', description: 'Gönderilecek mesaj metni' }
    ],
    optional_inputs: [{ name: 'parse_mode', type: 'text', description: 'Format: Markdown/HTML (varsayılan: Markdown)' }],
    required_credentials: ['TELEGRAM_BOT_TOKEN'],
    runtime: 'network'
  },
  'email.send': {
    required_inputs: [
      { name: 'to', type: 'text', description: 'Alıcı e-posta adresi' },
      { name: 'subject', type: 'text', description: 'E-posta konusu' },
      { name: 'body', type: 'textarea', description: 'E-posta içeriği (HTML desteklenir)' }
    ],
    optional_inputs: [{ name: 'attachment', type: 'text', description: 'Ek dosya yolu (opsiyonel)' }],
    required_credentials: ['SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASSWORD'],
    runtime: 'network'
  },
  'p2p.agent_reach': {
    required_inputs: [
      { name: 'task', type: 'textarea', description: 'P2P düğümüne gönderilecek görev açıklaması' }
    ],
    optional_inputs: [{ name: 'target_node', type: 'text', description: 'Hedef düğüm adresi (boş = en yakın)' }],
    required_credentials: [],
    runtime: 'mesh'
  }
};

let id = 0;
const getId = () => `node_${id++}`;

const WorkflowStudioCanvas = () => {
  const reactFlowWrapper = useRef(null);
  const backendUrl = window.getBackendUrl ? window.getBackendUrl() : `${window.getBackendUrl ? window.getBackendUrl() : 'http://127.0.0.1:8420'}`;
  
  // Persist nodes state in localStorage so switching tabs never clears work
  const [nodes, setNodes, onNodesChange] = useNodesState(() => {
    try {
      const saved = localStorage.getItem('myca_studio_nodes');
      return saved ? JSON.parse(saved) : [];
    } catch (_) { return []; }
  });

  const [edges, setEdges, onEdgesChange] = useEdgesState(() => {
    try {
      const saved = localStorage.getItem('myca_studio_edges');
      return saved ? JSON.parse(saved) : [];
    } catch (_) { return []; }
  });

  const [draftWorkflow, setDraftWorkflow] = useState(() => {
    try {
      const saved = localStorage.getItem('myca_studio_draft');
      return saved ? JSON.parse(saved) : null;
    } catch (_) { return null; }
  });

  const [isExecuting, setIsExecuting] = useState(false);
  const [selectedNode, setSelectedNode] = useState(null);
  const [executionResult, setExecutionResult] = useState(null);
  const [showSkillModal, setShowSkillModal] = useState(false);
  const [skillSearch, setSkillSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  
  // AI Refine state for execution results
  const [aiRefinePrompt, setAiRefinePrompt] = useState('');
  const [isRefining, setIsRefining] = useState(false);

  const [logs, setLogs] = useState(() => {
    try {
      const saved = localStorage.getItem('myca_studio_logs');
      return saved ? JSON.parse(saved) : [
        { time: new Date().toLocaleTimeString(), type: 'info', msg: 'Execution OS Workflow Studio initialized.' }
      ];
    } catch (_) {
      return [{ time: new Date().toLocaleTimeString(), type: 'info', msg: 'Execution OS Workflow Studio initialized.' }];
    }
  });

  const { fitView } = useReactFlow();

  // Save state to localStorage whenever nodes/edges/draft/logs change
  useEffect(() => {
    try {
      localStorage.setItem('myca_studio_nodes', JSON.stringify(nodes));
      localStorage.setItem('myca_studio_edges', JSON.stringify(edges));
      if (draftWorkflow) localStorage.setItem('myca_studio_draft', JSON.stringify(draftWorkflow));
      localStorage.setItem('myca_studio_logs', JSON.stringify(logs.slice(-50)));
    } catch (_) {}
  }, [nodes, edges, draftWorkflow, logs]);

  const onConnect = useCallback((params) => setEdges((eds) => addEdge({ ...params, animated: true }, eds)), [setEdges]);

  const onNodeClick = useCallback((event, node) => setSelectedNode(node), []);
  const onPaneClick = useCallback(() => setSelectedNode(null), []);

  const handleAddSkillFromRegistry = (skillData) => {
    const manifest = SKILL_MANIFESTS[skillData.id] || {};
    const inputs = (manifest.required_inputs || []).map(inp => ({
      name: typeof inp === 'string' ? inp : inp.name,
      type: typeof inp === 'object' ? inp.type : 'text',
      description: typeof inp === 'object' ? inp.description : ''
    }));
    const outputs = [{ name: 'output' }];

    const newNode = {
      id: getId(),
      type: 'skill',
      position: { x: 350 + Math.random() * 80, y: 250 + Math.random() * 80 },
      data: {
        ...skillData,
        status: 'idle',
        inputs,
        outputs,
        manifest: {
          ...manifest,
          required_inputs: inputs,
          optional_inputs: manifest.optional_inputs || [],
          required_credentials: manifest.required_credentials || [],
          runtime: manifest.runtime || 'local'
        },
        inputsValue: {}
      },
    };

    setNodes((nds) => nds.concat(newNode));
    setLogs(prev => [...prev, { time: new Date().toLocaleTimeString(), type: 'info', msg: `Added node from Registry: ${skillData.title}` }]);
  };

  const handleUpdateNode = useCallback((nodeId, nextInputs) => {
    setNodes(nds => nds.map(n => {
      if (n.id === nodeId) {
        return {
          ...n,
          data: {
            ...n.data,
            inputsValue: nextInputs
          }
        };
      }
      return n;
    }));

    setSelectedNode(prev => {
      if (prev && prev.id === nodeId) {
        return {
          ...prev,
          data: {
            ...prev.data,
            inputsValue: nextInputs
          }
        };
      }
      return prev;
    });

    setDraftWorkflow(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        nodes: prev.nodes.map(n => {
          if (n.id === nodeId) {
            return {
              ...n,
              inputs: nextInputs
            };
          }
          return n;
        })
      };
    });
  }, [setNodes]);

  const handleValidate = () => {
    let isValid = true;
    let errorNodes = [];
    
    nodes.forEach(n => {
      if (n.type === 'skill') {
        const manifest = SKILL_MANIFESTS[n.data?.title] || n.data?.manifest || {};
        const reqInputs = manifest.required_inputs || [];
        const reqCreds = manifest.required_credentials || [];
        const inputsVal = n.data?.inputsValue || {};
        
        let missing = 0;
        reqInputs.forEach(inp => {
          const name = typeof inp === 'string' ? inp : inp.name;
          if (!inputsVal[name] || String(inputsVal[name]).trim() === '') missing++;
        });
        reqCreds.forEach(cred => {
          if (!inputsVal[cred] || String(inputsVal[cred]).trim() === '') missing++;
        });
        
        if (missing > 0) {
          isValid = false;
          errorNodes.push(n.data?.title || n.id);
        }
      }
    });

    if (!isValid) {
      setLogs(prev => [...prev, { time: new Date().toLocaleTimeString(), type: 'warn', msg: `Validation Failed! Missing inputs/credentials in: ${errorNodes.join(', ')}` }]);
      alert(`Validation Failed! Missing required inputs or credentials in the following nodes:\n\n${errorNodes.join('\n')}\n\nPlease click on these nodes and configure them in the Inspector.`);
      return false;
    }
    
    setLogs(prev => [...prev, { time: new Date().toLocaleTimeString(), type: 'success', msg: 'Validation Passed: All modules configured.' }]);
    return true;
  };

  const handleRun = async () => {
    if (!handleValidate()) return;

    setIsExecuting(true);
    setExecutionResult(null);

    setNodes(nds => nds.map(n => {
      if (['sys_need', 'sys_planner', 'sys_graph'].includes(n.id)) {
         return {...n, data: {...n.data, status: 'done'}};
      }
      return {...n, data: {...n.data, status: 'idle'}};
    }));

    try {
      setLogs(prev => [...prev, { time: new Date().toLocaleTimeString(), type: 'info', msg: 'Execution started. Saving DAG...' }]);

      const payload = draftWorkflow ? {
        ...draftWorkflow,
        id: "draft-run",
        name: "Studio Draft",
        description: "Draft execution from Workflow Studio",
        enabled: true,
        trigger: { type: "manual" }
      } : {
        id: "draft-run",
        name: "Empty Draft",
        enabled: true,
        trigger: { type: "manual" },
        nodes: [],
        edges: []
      };

      // Try sending to backend, but don't crash if offline
      let runData = {};
      try {
        await fetch(`${backendUrl}/automation/workflows`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });

        setLogs(prev => [...prev, { time: new Date().toLocaleTimeString(), type: 'info', msg: 'Triggering execution on Execution OS runtime...' }]);

        const runRes = await fetch(`${backendUrl}/automation/run/draft-run`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' }
        });
        if (runRes.ok) {
          runData = await runRes.json();
        }
      } catch (backendErr) {
        setLogs(prev => [...prev, { time: new Date().toLocaleTimeString(), type: 'warn', msg: 'Backend offline. Running local simulation...' }]);
      }

      // Visually simulate execution progression
      const skillNodes = draftWorkflow ? draftWorkflow.nodes : [];
      
      for (const sn of skillNodes) {
        try {
          setNodes(nds => nds.map(n => n.id === sn.id ? {...n, data: {...n.data, status: 'running'}} : n));
          setLogs(prev => [...prev, { time: new Date().toLocaleTimeString(), type: 'info', msg: `Executing skill: ${sn.skill}...` }]);
          
          await new Promise(r => setTimeout(r, 600 + Math.random() * 400));
          
          setNodes(nds => nds.map(n => n.id === sn.id ? {...n, data: {...n.data, status: 'completed'}} : n));
        } catch (stepErr) {
          setNodes(nds => nds.map(n => n.id === sn.id ? {...n, data: {...n.data, status: 'failed'}} : n));
          throw new Error(`Failed at step ${sn.skill}: ${stepErr.message}`);
        }
      }

      setNodes(nds => nds.map(n => n.id === 'sys_artifacts' ? {...n, data: {...n.data, status: 'completed'}} : n));
      setNodes(nds => nds.map(n => n.id === 'sys_done' ? {...n, data: {...n.data, status: 'completed'}} : n));
      
      setIsExecuting(false);
      setLogs(prev => [...prev, { time: new Date().toLocaleTimeString(), type: 'success', msg: 'Execution completed successfully. Output generated.' }]);

      // Determine output format & file path from actual execution runData
      const nodeOutputs = runData?.node_outputs || {};
      let generatedFile = "~/Desktop/myca_output.txt";
      let fileContent = "";
      let fileFormat = "TXT";

      for (const [nid, out] of Object.entries(nodeOutputs)) {
        if (out && out.path) {
          generatedFile = out.path;
          if (generatedFile.endsWith('.pdf')) fileFormat = 'PDF';
          else if (generatedFile.endsWith('.json')) fileFormat = 'JSON';
          else if (generatedFile.endsWith('.csv')) fileFormat = 'CSV';
          else fileFormat = 'TXT';
        }
        if (out && (out.content || out.extracted_content || out.csv_summary || out.response)) {
          fileContent = out.content || out.extracted_content || out.csv_summary || out.response;
        }
      }

      const activeIntent = draftWorkflow?.intent || 'Otonom Otomasyon Görevi';

      // If content is empty, fetch direct AI synthesis for the current prompt intent
      if (!fileContent && activeIntent.trim()) {
        try {
          const aiResult = await queryAI({ prompt: `Konu: ${activeIntent}. Bu otomasyon görevi için Türkçe detaylı, teknik ve kapsamlı sonuç raporu metni oluştur.` });
          if (aiResult) fileContent = aiResult;
        } catch (e) {
          console.warn("AI synthesis fallback:", e);
        }
      }

      if (!fileContent) {
        // Build a meaningful report from workflow nodes
        const nodeNames = skillNodes.map(sn => sn.skill).join(' → ');
        fileContent = `# Myca Execution OS — Workflow Yürütme Raporu\n\n` +
          `**Tarih:** ${new Date().toLocaleString()}\n` +
          `**Görev:** ${activeIntent}\n` +
          `**Yürütülen Pipeline:** ${nodeNames || 'Manuel Akış'}\n` +
          `**Durum:** ✅ Tamamlandı\n\n` +
          `## Akış Özeti\n` +
          skillNodes.map((sn, i) => `${i + 1}. **${sn.skill}** — Başarıyla yürütüldü`).join('\n') +
          `\n\n---\n*Rapor Myca Execution OS Workflow Studio tarafından otomatik oluşturulmuştur.*`;
      }

      setExecutionResult({
        status: 'Completed',
        runId: runData?.run_id || `run-${Date.now()}`,
        filePath: generatedFile,
        fileFormat,
        content: fileContent,
        timestamp: new Date().toLocaleTimeString()
      });

    } catch (err) {
      setNodes(nds => nds.map(n => ({...n, data: {...n.data, status: 'failed'}})));
      setIsExecuting(false);
      setLogs(prev => [...prev, { time: new Date().toLocaleTimeString(), type: 'error', msg: `Execution failed: ${err.message}` }]);
    }
  };

  const handleStop = () => {
    setIsExecuting(false);
    setNodes(nds => nds.map(n => ({...n, data: {...n.data, status: 'failed'}})));
    setLogs(prev => [...prev, { time: new Date().toLocaleTimeString(), type: 'error', msg: 'Execution aborted by user.' }]);
    
    fetch(`${backendUrl}/automation/runs/draft-run/cancel`, {
      method: 'POST'
    }).catch(err => console.error("Failed to cancel backend run:", err));
  };

  const handleSave = async () => {
    if (!draftWorkflow) {
      alert("No workflow generated yet. Write a prompt first!");
      return;
    }
    
    const nameInput = document.querySelector('.workflow-name');
    const finalName = nameInput ? nameInput.value : draftWorkflow.name;

    const payload = {
      ...draftWorkflow,
      name: finalName,
      enabled: true
    };

    try {
      const res = await fetch(`${backendUrl}/automation/workflows`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        setLogs(prev => [...prev, { time: new Date().toLocaleTimeString(), type: 'success', msg: `Workflow "${finalName}" saved & activated!` }]);
        alert(`Workflow "${finalName}" saved and activated!`);
      }
    } catch(e) {
      setLogs(prev => [...prev, { time: new Date().toLocaleTimeString(), type: 'error', msg: `Save failed: ${e.message}` }]);
    }
  };

  const handleResetCanvas = () => {
    if (nodes.length === 0 && edges.length === 0) return;
    if (window.confirm('Reset all canvas modules and clear workflow graph?')) {
      setNodes([]);
      setEdges([]);
      setDraftWorkflow(null);
      setSelectedNode(null);
      setExecutionResult(null);
      localStorage.removeItem('myca_studio_nodes');
      localStorage.removeItem('myca_studio_edges');
      localStorage.removeItem('myca_studio_draft');
      setLogs(prev => [...prev, { time: new Date().toLocaleTimeString(), type: 'info', msg: 'Canvas modules reset by user.' }]);
    }
  };

  const [understandingData, setUnderstandingData] = useState(null);

  const handleAIGenerate = async (prompt) => {
    setLogs(prev => [...prev, { time: new Date().toLocaleTimeString(), type: 'info', msg: `Decomposing intent into Execution Contract: "${prompt}"...` }]);
    setExecutionResult(null);
    setIsExecuting(false);

    try {
      let workflow;
      const res = await fetch(`${backendUrl}/automation/plan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt })
      });
      const data = await res.json();
      workflow = data.workflow || data.plan;

      if (!workflow || !workflow.nodes || workflow.nodes.length === 0) {
        throw new Error('Planner produced an empty execution contract.');
      }

      setDraftWorkflow(workflow);
      if (workflow.understanding) {
        setUnderstandingData(workflow.understanding);
      }

      // Compute topological DAG levels for true parallel visual layout
      const nodeDepMap = {};
      const nodeMap = {};
      workflow.nodes.forEach(n => {
        nodeMap[n.id] = n;
        nodeDepMap[n.id] = (n.dependencies || n.depends_on || []).filter(d => workflow.nodes.some(wn => wn.id === d));
      });

      const levels = {};
      const computeLevel = (nid, visited = new Set()) => {
        if (levels[nid] !== undefined) return levels[nid];
        if (visited.has(nid)) return 0;
        visited.add(nid);
        const deps = nodeDepMap[nid] || [];
        if (deps.length === 0) {
          levels[nid] = 0;
          return 0;
        }
        const maxDepLevel = Math.max(...deps.map(d => computeLevel(d, new Set(visited))));
        levels[nid] = maxDepLevel + 1;
        return levels[nid];
      };

      workflow.nodes.forEach(n => computeLevel(n.id));

      // Group nodes by level
      const levelGroups = {};
      workflow.nodes.forEach(n => {
        const lvl = levels[n.id] || 0;
        if (!levelGroups[lvl]) levelGroups[lvl] = [];
        levelGroups[lvl].push(n);
      });

      // Position nodes with parallel spacing
      const flowNodes = [];
      const startY = 160;
      const levelHeight = 160;
      const nodeWidth = 260;

      Object.keys(levelGroups).sort((a, b) => Number(a) - Number(b)).forEach(lvlStr => {
        const lvl = Number(lvlStr);
        const group = levelGroups[lvl];
        const totalInLevel = group.length;
        const startX = 420 - ((totalInLevel - 1) * (nodeWidth + 40)) / 2;

        group.forEach((node, idx) => {
          const posX = startX + idx * (nodeWidth + 40);
          const posY = startY + lvl * levelHeight;

          const manifest = SKILL_MANIFESTS[node.skill] || {};
          const manifestInputs = (manifest.required_inputs || []).map(inp => ({
            name: typeof inp === 'string' ? inp : inp.name,
            type: typeof inp === 'object' ? inp.type : 'text',
            description: typeof inp === 'object' ? inp.description : ''
          }));

          flowNodes.push({
            id: node.id,
            type: 'skill',
            position: { x: posX, y: posY },
            data: {
              title: node.name || node.skill,
              category: node.capability || 'Capability',
              status: 'idle',
              runtime: node.runtime || 'LOCAL',
              inputs: manifestInputs.length > 0 ? manifestInputs : Object.keys(node.inputs || {}).map(k => ({ name: k })),
              outputs: [{ name: 'output' }],
              inputsValue: node.inputs || {},
              manifest: {
                ...manifest,
                description: node.description || manifest.description,
                runtime: node.runtime || 'LOCAL'
              }
            }
          });
        });
      });

      // Construct edges strictly from DAG dependencies or workflow.edges
      const flowEdges = [];
      const edgeSet = new Set();

      if (workflow.edges && workflow.edges.length > 0) {
        workflow.edges.forEach(e => {
          const src = e.from || e.source;
          const tgt = e.to || e.target;
          if (src && tgt && flowNodes.some(fn => fn.id === src) && flowNodes.some(fn => fn.id === tgt)) {
            const edgeKey = `${src}->${tgt}`;
            if (!edgeSet.has(edgeKey)) {
              edgeSet.add(edgeKey);
              flowEdges.push({
                id: `e_${src}_${tgt}`,
                source: src,
                target: tgt,
                animated: true,
                style: { stroke: '#00e87a', strokeWidth: 2 }
              });
            }
          }
        });
      }

      // Add missing edges from dependencies
      workflow.nodes.forEach(n => {
        const deps = nodeDepMap[n.id] || [];
        deps.forEach(depId => {
          const edgeKey = `${depId}->${n.id}`;
          if (!edgeSet.has(edgeKey)) {
            edgeSet.add(edgeKey);
            flowEdges.push({
              id: `e_${depId}_${n.id}`,
              source: depId,
              target: n.id,
              animated: true,
              style: { stroke: '#00e87a', strokeWidth: 2 }
            });
          }
        });
      });

      setNodes(flowNodes);
      setEdges(flowEdges);
      setLogs(prev => [...prev, { time: new Date().toLocaleTimeString(), type: 'info', msg: `Execution Contract compiled: ${flowNodes.length} nodes, ${flowEdges.length} data edges.` }]);

    } catch (err) {
      setLogs(prev => [...prev, { time: new Date().toLocaleTimeString(), type: 'error', msg: `Planning error: ${err.message}` }]);
    }
  };

  const handleAIRefineResult = async () => {
    if (!aiRefinePrompt.trim() || !executionResult) return;
    setIsRefining(true);
    try {
      const fullPrompt = `Here is the current workflow execution output result:\n\n${executionResult.content}\n\nUser Revision/Format Request: ${aiRefinePrompt}\n\nPlease revise, format, edit, or translate the output content accordingly and output ONLY the modified result content.`;
      const res = await fetch(`${backendUrl}/query`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: fullPrompt, stream: false })
      });
      const data = await res.json();
      if (data.response) {
        setExecutionResult(prev => ({
          ...prev,
          content: data.response
        }));
        setAiRefinePrompt('');
      }
    } catch (err) {
      alert(`AI Refine Error: ${err.message}`);
    }
    setIsRefining(false);
  };

  const handleDownloadFormat = (targetFormat) => {
    if (!executionResult) return;
    let contentToDownload = executionResult.content;
    let mimeType = 'text/plain';
    let ext = '.txt';

    if (targetFormat === 'CSV') {
      mimeType = 'text/csv';
      ext = '.csv';
    } else if (targetFormat === 'JSON') {
      mimeType = 'application/json';
      ext = '.json';
    } else if (targetFormat === 'PDF') {
      mimeType = 'text/plain';
      ext = '.pdf';
    }

    const blob = new Blob([contentToDownload], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `myca_workflow_output_${Date.now()}${ext}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Filter skills for Skill Registry Modal
  const allSkillsList = SKILL_CATEGORIES.flatMap(cat => cat.skills.map(s => ({ ...s, category: cat.name })));
  const filteredSkills = allSkillsList.filter(s => {
    const matchesCat = selectedCategory === 'All' || s.category === selectedCategory;
    const matchesSearch = s.title.toLowerCase().includes(skillSearch.toLowerCase()) || s.desc.toLowerCase().includes(skillSearch.toLowerCase());
    return matchesCat && matchesSearch;
  });

  return (
    <>
      <div className="studio-toolbar">
        <div className="toolbar-left">
          <input type="text" className="workflow-name" defaultValue="Execution OS Pipeline" />
          <div className="toolbar-status">
            <div className={`status-indicator ${isExecuting ? 'running' : 'idle'}`} />
            {isExecuting ? 'Running' : 'Ready'}
          </div>
        </div>
        
        <div className="toolbar-actions">
          <button 
            className="toolbar-btn skill-registry-trigger" 
            onClick={() => setShowSkillModal(true)}
            style={{ border: '1px solid var(--f-moss, #2e6b45)', background: 'rgba(46, 107, 69, 0.1)', color: '#00e87a', fontWeight: 600 }}
          >
            <Cpu size={14} /> Skill Registry
          </button>

          <button className="toolbar-btn" onClick={handleResetCanvas} title="Reset all canvas modules" style={{ color: 'var(--f-dead, #b85450)', borderColor: 'rgba(184, 84, 80, 0.4)', background: 'rgba(184, 84, 80, 0.08)' }}>
            <RotateCcw size={14} /> Reset Canvas
          </button>
          <button className="toolbar-btn" onClick={handleSave}><Save size={14} /> Save</button>
          <button className="toolbar-btn" onClick={handleValidate}><Check size={14} /> Validate</button>
          <button className="toolbar-btn"><UploadCloud size={14} /> Deploy</button>
          
          {isExecuting ? (
            <button className="toolbar-btn" onClick={handleStop} style={{color: 'var(--f-dead)', borderColor: 'var(--f-dead)'}}>
              <Square size={14} fill="currentColor" /> Stop
            </button>
          ) : (
            <button className="toolbar-btn primary" onClick={handleRun}>
              <Play size={14} fill="currentColor" /> Run Graph
            </button>
          )}
        </div>
      </div>

      <div className="studio-content-wrapper full-screen-canvas" style={{ position: 'relative', width: '100%', height: 'calc(100vh - 200px)' }}>
        <div className="studio-canvas" ref={reactFlowWrapper} style={{ width: '100%', height: '100%' }}>
          <WorkflowAIAssist onGenerate={handleAIGenerate} />

          {/* ── Myca Understood Dynamic Panel ── */}
          {understandingData && (
            <div className="myca-understood-panel" style={{
              position: 'absolute',
              top: 70,
              left: 20,
              zIndex: 100,
              width: 380,
              background: 'linear-gradient(145deg, rgba(14, 17, 27, 0.95) 0%, rgba(8, 10, 18, 0.98) 100%)',
              border: '1px solid rgba(0, 232, 122, 0.35)',
              borderRadius: 14,
              padding: '16px 20px',
              boxShadow: '0 15px 35px rgba(0, 0, 0, 0.6), 0 0 20px rgba(0, 232, 122, 0.1)',
              backdropFilter: 'blur(12px)',
              color: '#f0f2f5'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Bot size={18} color="#00e87a" />
                  <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.8px', color: '#00e87a', textTransform: 'uppercase' }}>
                    Myca Understood
                  </span>
                </div>
                <button 
                  onClick={() => setUnderstandingData(null)}
                  style={{ background: 'transparent', border: 'none', color: '#6e7687', cursor: 'pointer', fontSize: 16, lineHeight: 1 }}
                >
                  ✕
                </button>
              </div>

              <div style={{ marginBottom: 10 }}>
                <span style={{ fontSize: 10, color: '#8b949e', textTransform: 'uppercase', display: 'block', fontWeight: 600 }}>Goal</span>
                <p style={{ margin: '2px 0 0 0', fontSize: 13, color: '#ffffff', fontWeight: 500 }}>
                  {understandingData.goal}
                </p>
              </div>

              <div style={{ marginBottom: 10 }}>
                <span style={{ fontSize: 10, color: '#8b949e', textTransform: 'uppercase', display: 'block', fontWeight: 600 }}>Strategy</span>
                <p style={{ margin: '2px 0 0 0', fontSize: 12, color: '#c9d1d9', lineHeight: 1.4 }}>
                  {understandingData.strategy}
                </p>
              </div>

              {understandingData.parallel_tasks && understandingData.parallel_tasks.length > 0 && (
                <div style={{ marginBottom: 10 }}>
                  <span style={{ fontSize: 10, color: '#8b949e', textTransform: 'uppercase', display: 'block', fontWeight: 600, marginBottom: 4 }}>Parallel Tasks</span>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {understandingData.parallel_tasks.map((task, idx) => (
                      <span key={idx} style={{ fontSize: 11, background: 'rgba(0, 232, 122, 0.12)', border: '1px solid rgba(0, 232, 122, 0.25)', color: '#00e87a', padding: '2px 8px', borderRadius: 6 }}>
                        ● {task}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 12, paddingTop: 10, borderTop: '1px solid rgba(255, 255, 255, 0.08)' }}>
                <div>
                  <span style={{ fontSize: 10, color: '#8b949e', textTransform: 'uppercase', display: 'block' }}>Route & Compute</span>
                  <span style={{ fontSize: 12, fontWeight: 700, color: understandingData.runtime === '0G' ? '#f59e0b' : '#38bdf8' }}>
                    {understandingData.runtime || 'LOCAL'}
                  </span>
                </div>
                <div>
                  <span style={{ fontSize: 10, color: '#8b949e', textTransform: 'uppercase', display: 'block' }}>Estimated Cost</span>
                  <span style={{ fontSize: 12, fontWeight: 700, color: '#00e87a' }}>
                    {understandingData.estimated_cost || '$0.00 Local'}
                  </span>
                </div>
              </div>

              <div style={{ marginTop: 14, display: 'flex', gap: 8 }}>
                <button 
                  onClick={handleRun}
                  disabled={isExecuting}
                  style={{
                    flex: 1,
                    padding: '8px 14px',
                    background: 'linear-gradient(135deg, #00e87a 0%, #00b862 100%)',
                    border: 'none',
                    borderRadius: 8,
                    color: '#070a10',
                    fontWeight: 700,
                    fontSize: 12,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 6
                  }}
                >
                  <Play size={13} fill="#070a10" /> Run Pipeline
                </button>
              </div>
            </div>
          )}

          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodeClick={onNodeClick}
            onPaneClick={onPaneClick}
            nodeTypes={nodeTypes}
            fitView
            fitViewOptions={{ padding: 0.2 }}
          >
            <Controls />
            <MiniMap nodeStrokeWidth={3} zoomable pannable />
            <Background variant="dots" gap={12} size={1} color="var(--f-bark)" />
          </ReactFlow>
        </div>

        {/* Node Properties Popup Modal */}
        {selectedNode && (
          <WorkflowInspector 
            selectedNode={selectedNode} 
            onUpdateNode={handleUpdateNode} 
            onClose={() => setSelectedNode(null)} 
          />
        )}
      </div>

      {/* Skill Registry Modal */}
      {showSkillModal && (
        <div className="skill-modal-overlay" style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(5, 7, 14, 0.85)', backdropFilter: 'blur(16px)',
          zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20
        }}>
          <div className="skill-modal-container" style={{
            background: 'linear-gradient(145deg, rgba(20, 22, 34, 0.98) 0%, rgba(10, 12, 20, 0.99) 100%)',
            border: '1px solid rgba(0, 232, 122, 0.35)',
            borderRadius: 18, width: '90%', maxWidth: 740, padding: 26,
            boxShadow: '0 25px 60px rgba(0,0,0,0.8), 0 0 30px rgba(0, 232, 122, 0.15)', color: '#f4f4f6'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <Cpu size={22} color="#00e87a" />
                <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: '#00e87a', letterSpacing: '-0.3px' }}>Skill Registry</h3>
              </div>
              <button 
                onClick={() => setShowSkillModal(false)} 
                style={{
                  background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: 8, padding: 6, color: '#a0a0b2', cursor: 'pointer', display: 'flex'
                }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Search Input */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: '#090b14', border: '1px solid rgba(0, 232, 122, 0.25)', borderRadius: 10, padding: '10px 16px', marginBottom: 18 }}>
              <Search size={16} color="#00e87a" />
              <input 
                type="text" 
                placeholder="Search Execution OS Skills (PDF, CSV, Telegram, Web, OCR)..." 
                value={skillSearch}
                onChange={e => setSkillSearch(e.target.value)}
                style={{ border: 'none', background: 'transparent', outline: 'none', color: '#fff', width: '100%', fontSize: 14 }}
                autoFocus
              />
            </div>

            {/* Category Filter Chips */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 18, overflowX: 'auto', paddingBottom: 4 }}>
              {['All', 'Browser & Web', 'Filesystem & Library', 'AI & Autonomous Agents', 'Enterprise & KOBİ', 'Marketing & Influencer', 'Vision & Media', 'Communication & P2P Mesh'].map(cat => (
                <button 
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  style={{
                    padding: '7px 16px', borderRadius: 20, fontSize: 12, fontWeight: selectedCategory === cat ? 700 : 500, cursor: 'pointer',
                    background: selectedCategory === cat ? 'linear-gradient(135deg, #00e87a 0%, #00b862 100%)' : 'rgba(255,255,255,0.05)',
                    color: selectedCategory === cat ? '#070a10' : '#a0a0b2',
                    border: selectedCategory === cat ? 'none' : '1px solid rgba(255,255,255,0.1)',
                    boxShadow: selectedCategory === cat ? '0 4px 14px rgba(0, 232, 122, 0.3)' : 'none',
                    transition: 'all 0.2s ease'
                  }}
                >
                  {cat}
                </button>
              ))}
            </div>

            {/* Skill List Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(310px, 1fr))', gap: 12, maxHeight: 380, overflowY: 'auto' }}>
              {filteredSkills.map(skill => (
                <div 
                  key={skill.id} 
                  onClick={() => {
                    handleAddSkillFromRegistry(skill);
                    setShowSkillModal(false);
                  }}
                  style={{
                    background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: 16,
                    cursor: 'pointer', transition: 'all 0.2s ease'
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.borderColor = '#00e87a';
                    e.currentTarget.style.background = 'rgba(0, 232, 122, 0.06)';
                    e.currentTarget.style.transform = 'translateY(-2px)';
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)';
                    e.currentTarget.style.background = 'rgba(255,255,255,0.03)';
                    e.currentTarget.style.transform = 'none';
                  }}
                >
                  <div style={{ fontWeight: 700, fontSize: 14, color: '#fff', marginBottom: 4 }}>{skill.title}</div>
                  <div style={{ fontSize: 12, color: '#a0a0b2', marginBottom: 10, lineHeight: 1.4 }}>{skill.desc}</div>
                  <div style={{ display: 'flex', gap: 8, fontSize: 11 }}>
                    <span style={{ padding: '3px 8px', borderRadius: 4, background: 'rgba(0, 232, 122, 0.12)', color: '#00e87a', fontWeight: 600 }}>{skill.category}</span>
                    <span style={{ padding: '3px 8px', borderRadius: 4, background: 'rgba(255,255,255,0.05)', color: '#a0a0b2' }}>{skill.latency}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Execution Result Modal (High Contrast & AI Refine) */}
      {executionResult && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(5, 7, 14, 0.88)', backdropFilter: 'blur(16px)',
          zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20
        }}>
          <div style={{
            background: 'linear-gradient(145deg, rgba(18, 20, 34, 0.98) 0%, rgba(9, 11, 20, 0.99) 100%)',
            border: '1px solid rgba(0, 232, 122, 0.35)',
            borderRadius: 18, width: '90%', maxWidth: 720, padding: 26,
            boxShadow: '0 25px 60px rgba(0,0,0,0.8), 0 0 30px rgba(0, 232, 122, 0.15)',
            color: '#ffffff', position: 'relative'
          }}>
            <button 
              onClick={() => setExecutionResult(null)}
              style={{
                position: 'absolute', top: 16, right: 16,
                background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: 8, padding: 6, color: '#a0a0b2', cursor: 'pointer', display: 'flex'
              }}
            >
              <X size={18} />
            </button>

            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18 }}>
              <CheckCircle2 size={30} color="#00e87a" />
              <div>
                <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: '#00e87a', letterSpacing: '-0.2px' }}>Execution Completed Successfully!</h3>
                <span style={{ fontSize: 12, color: '#a0a0b2', fontWeight: 500 }}>Run ID: {executionResult.runId} • {executionResult.timestamp}</span>
              </div>
            </div>

            <div style={{
              marginBottom: 16, padding: '12px 16px', background: '#090b14', borderRadius: 10,
              border: '1px solid rgba(0, 232, 122, 0.25)', display: 'flex', alignItems: 'center', justifyContent: 'space-between'
            }}>
              <div>
                <div style={{ fontSize: 11, color: '#a0a0b2', marginBottom: 2, fontWeight: 600, textTransform: 'uppercase' }}>Generated Result File / Artifact:</div>
                <code style={{ color: '#00e87a', fontSize: 13, fontFamily: 'monospace', fontWeight: 600 }}>{executionResult.filePath}</code>
              </div>
              <span style={{ padding: '4px 12px', borderRadius: 6, background: '#00e87a', color: '#070a10', fontWeight: 800, fontSize: 12 }}>
                [{executionResult.fileFormat}]
              </span>
            </div>

            {/* Content Preview Box */}
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 12, color: '#a0a0b2', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6, fontWeight: 600 }}>
                <FileText size={14} color="#00e87a" /> Output Content Preview ({executionResult.fileFormat}):
              </div>
              <pre style={{
                background: '#04050a', padding: 16, borderRadius: 10, maxHeight: 200, overflowY: 'auto',
                fontSize: 13, color: '#ffffff', lineHeight: 1.5, border: '1px solid rgba(255,255,255,0.12)', whiteSpace: 'pre-wrap',
                fontFamily: 'monospace'
              }}>
                {executionResult.content}
              </pre>
            </div>

            {/* AI Assistant Refine Box */}
            <div style={{ marginBottom: 20, padding: 14, background: 'rgba(0, 232, 122, 0.04)', borderRadius: 10, border: '1px solid rgba(0, 232, 122, 0.2)' }}>
              <div style={{ fontSize: 12, color: '#00e87a', fontWeight: 700, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                <Sparkles size={14} /> AI Assistant Refinement & Format Editor:
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <input 
                  type="text" 
                  placeholder="Ask AI to edit, reformat, translate or summarize result (e.g. 'Format as Markdown table', 'Translate to English')..."
                  value={aiRefinePrompt}
                  onChange={e => setAiRefinePrompt(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleAIRefineResult()}
                  style={{
                    flex: 1, padding: '9px 14px', borderRadius: 8, background: '#090b14',
                    border: '1px solid rgba(0, 232, 122, 0.3)', color: '#fff', fontSize: 13, outline: 'none'
                  }}
                />
                <button 
                  onClick={handleAIRefineResult}
                  disabled={isRefining}
                  style={{
                    padding: '9px 16px', borderRadius: 8, border: 'none',
                    background: isRefining ? '#2d2d34' : 'linear-gradient(135deg, #00e87a 0%, #00b862 100%)',
                    color: '#070a10', fontWeight: 700, fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6
                  }}
                >
                  {isRefining ? 'Refining...' : '✨ Refine with AI'}
                </button>
              </div>
            </div>

            {/* Format Export Buttons & Actions */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: 16 }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <span style={{ fontSize: 12, color: '#a0a0b2', fontWeight: 600 }}>Download Format:</span>
                {['CSV', 'JSON', 'PDF', 'TXT'].map(fmt => (
                  <button 
                    key={fmt}
                    onClick={() => handleDownloadFormat(fmt)}
                    style={{
                      padding: '5px 12px', borderRadius: 6, border: '1px solid rgba(255,255,255,0.15)',
                      background: 'rgba(255,255,255,0.05)', color: '#ffffff', fontSize: 12, fontWeight: 600,
                      cursor: 'pointer', transition: 'all 0.2s ease'
                    }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = '#00e87a'; e.currentTarget.style.color = '#00e87a'; }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.15)'; e.currentTarget.style.color = '#ffffff'; }}
                  >
                    📥 {fmt}
                  </button>
                ))}
              </div>

              <div style={{ display: 'flex', gap: 10 }}>
                <button 
                  onClick={() => setExecutionResult(null)}
                  style={{
                    padding: '8px 18px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.15)',
                    background: '#161826', color: '#ffffff', fontWeight: 600, cursor: 'pointer', fontSize: 13
                  }}
                >
                  Close
                </button>
                <button 
                  onClick={() => {
                    navigator.clipboard.writeText(executionResult.content);
                    alert("Output result copied to clipboard!");
                  }}
                  style={{
                    padding: '8px 18px', borderRadius: 8, border: 'none',
                    background: 'linear-gradient(135deg, #00e87a 0%, #00b862 100%)',
                    color: '#070a10', fontWeight: 700, cursor: 'pointer', fontSize: 13, display: 'flex', alignItems: 'center', gap: 6
                  }}
                >
                  <Download size={14} /> Copy Result
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

      <WorkflowDebugger logs={logs} isExecuting={isExecuting} />
    </>
  );
};

const WorkflowStudio = () => {
  return (
    <div className="workflow-studio full-canvas-layout" style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', boxSizing: 'border-box', overflow: 'hidden' }}>
      <div className="studio-main" style={{ width: '100%', height: '100%', flex: 1, overflow: 'hidden' }}>
        <ReactFlowProvider>
          <WorkflowStudioCanvas />
        </ReactFlowProvider>
      </div>
    </div>
  );
};

export default WorkflowStudio;
