/**
 * Resonance SDK - Modular Document Ingestion Engine
 * Zero-Bloat Ingestion Pipeline: Text and CSV are native (0 KB external dependency).
 * Heavy parsers (PDF, XLSX) are dynamically imported only on-demand when called.
 * 
 * @license Commercial
 * @author Turkish Resonance AI Core Team
 */

export class IngestionEngine {
  constructor(options = {}) {
    this.maxChunkSize = options.maxChunkSize || 1000;
    this.overlap = options.overlap || 100;
    this._pdfModule = null;
    this._xlsxModule = null;
  }

  /**
   * Universal ingest method
   * @param {Object} input
   * @param {string|Buffer|ArrayBuffer} input.data - File content, text, or buffer
   * @param {'text'|'pdf'|'csv'|'url'} [input.type='text']
   * @param {string} [input.title='Untitled']
   * @param {Object} [input.metadata={}]
   * @returns {Promise<{ success: boolean, records: Array<{ query: string, content: string, confidence: number }>, stats: Object }>}
   */
  async ingest(input) {
    if (!input) {
      throw new Error('Ingest input requires a valid document or string');
    }

    const payloadData = typeof input === 'string' ? input : (input.data || input.content || input.text);
    if (!payloadData) {
      throw new Error('Ingest input requires a valid "data", "content", or "text" field');
    }

    const type = (typeof input === 'object' && input.type ? input.type : this._detectType({ data: payloadData })).toLowerCase();
    const title = (typeof input === 'object' && input.title) ? input.title : 'Belge';
    const metadata = (typeof input === 'object' && input.metadata) ? input.metadata : {};

    switch (type) {
      case 'pdf':
        return await this.ingestPdf(payloadData, title, metadata);
      case 'csv':
      case 'tsv':
        return this.ingestCsv(payloadData, title, metadata);
      case 'url':
        return await this.ingestUrl(payloadData, title, metadata);
      case 'text':
      default:
        return this.ingestText(payloadData, title, metadata);
    }
  }

  /**
   * Native lightweight plain text / markdown ingestion
   */
  ingestText(data, title, metadata = {}) {
    const rawText = typeof data === 'string' ? data : data.toString('utf8');
    
    // Split by double newlines OR numbered articles like "Madde 1:", "1. ", etc.
    let paragraphs = [];
    if (/Madde\s+\d+[:.]/i.test(rawText)) {
      paragraphs = rawText.split(/(?=\bMadde\s+\d+[:.])/i).map(p => p.trim()).filter(p => p.length > 10);
    } else {
      paragraphs = rawText
        .split(/\n{2,}|\r\n\r\n/)
        .map(p => p.trim())
        .filter(p => p.length > 15);
    }

    const records = [];
    if (paragraphs.length <= 1) {
      const content = `${title} — ${rawText.trim()}`;
      records.push({
        query: `${title} ${rawText.slice(0, 300)}`,
        content,
        confidence: 0.90,
        metadata: { ...metadata, section: 1 }
      });
    } else {
      paragraphs.forEach((para, idx) => {
        const content = `${title} — Bölüm ${idx + 1} — ${para}`;
        records.push({
          query: `${title} ${para.slice(0, 300)}`,
          content,
          confidence: 0.90,
          metadata: { ...metadata, section: idx + 1 }
        });
      });
    }

    return {
      success: true,
      records,
      stats: { type: 'text', totalRecords: records.length, characters: rawText.length }
    };
  }

  /**
   * Native lightweight CSV / TSV tabular ingestion (Zero-dependency)
   */
  ingestCsv(data, title, metadata = {}) {
    const rawStr = typeof data === 'string' ? data : data.toString('utf8');
    const lines = rawStr.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    if (lines.length === 0) return { success: false, records: [], stats: { totalRecords: 0 } };

    const delimiter = lines[0].includes('\t') ? '\t' : (lines[0].includes(';') ? ';' : ',');
    const headers = lines[0].split(delimiter).map(h => h.trim().replace(/^["']|["']$/g, '').toLowerCase());

    // Map common Turkish / English columns
    const titleIdx = headers.findIndex(h => /başlık|baslik|title|name|ad|proje|konu/i.test(h));
    const descIdx = headers.findIndex(h => /açıklama|aciklama|desc|özet|ozet|detay|summary|detail/i.test(h));

    const records = [];
    for (let i = 1; i < lines.length; i++) {
      const parts = lines[i].split(delimiter).map(p => p.trim().replace(/^["']|["']$/g, ''));
      if (parts.length < 2) continue;

      const itemTitle = titleIdx >= 0 && parts[titleIdx] ? parts[titleIdx] : `${title} #${i}`;
      let itemDesc = '';

      if (descIdx >= 0 && parts[descIdx]) {
        itemDesc = parts[descIdx];
      } else {
        itemDesc = headers.map((h, hIdx) => `${h}: ${parts[hIdx] || ''}`).join(', ');
      }

      const content = `${itemTitle} — ${itemDesc}`;
      records.push({
        query: `${title} ${itemTitle} ${itemDesc}`,
        content,
        confidence: 0.88,
        metadata: { ...metadata, row: i }
      });
    }

    return {
      success: true,
      records,
      stats: { type: 'csv', totalRecords: records.length, rows: lines.length - 1 }
    };
  }

  /**
   * On-Demand Dynamic PDF Ingestion (Keeps core SDK ultra-lightweight)
   */
  async ingestPdf(data, title, metadata = {}) {
    let pdfjs = null;

    // 1. Check browser global
    if (typeof window !== 'undefined' && window.pdfjsLib) {
      pdfjs = window.pdfjsLib;
    } else {
      // 2. Dynamic import in Node.js
      try {
        pdfjs = await import('pdfjs-dist/legacy/build/pdf.js');
      } catch (e) {
        throw new Error('PDF parsing requires "pdfjs-dist" package in Node.js or "pdf.min.js" in Browser. Install via: npm install pdfjs-dist');
      }
    }

    let rawBuffer = data;
    if (typeof data === 'string') {
      // Handle base64 string
      const binaryStr = atob(data);
      const bytes = new Uint8Array(binaryStr.length);
      for (let i = 0; i < binaryStr.length; i++) bytes[i] = binaryStr.charCodeAt(i);
      rawBuffer = bytes;
    } else if (Buffer.isBuffer(data)) {
      rawBuffer = new Uint8Array(data);
    }

    const doc = await pdfjs.getDocument({ data: rawBuffer }).promise;
    const records = [];
    const maxPages = Math.min(doc.numPages, 100);

    for (let p = 1; p <= maxPages; p++) {
      const page = await doc.getPage(p);
      const textContent = await page.getTextContent();
      const pageText = textContent.items.map(it => it.str).join(' ').trim();
      if (pageText.length > 20) {
        const content = `${title} — Sayfa ${p} — ${pageText}`;
        records.push({
          query: `${title} sayfa ${p} ${pageText.slice(0, 300)}`,
          content,
          confidence: 0.92,
          metadata: { ...metadata, page: p, totalPages: doc.numPages }
        });
      }
    }

    return {
      success: true,
      records,
      stats: { type: 'pdf', totalPages: doc.numPages, processedPages: records.length }
    };
  }

  /**
   * URL Ingestion (HTML clean text extraction)
   */
  async ingestUrl(url, title, metadata = {}) {
    if (typeof fetch === 'undefined') {
      throw new Error('URL ingestion requires global fetch API');
    }

    const resp = await fetch(url);
    if (!resp.ok) throw new Error(`Failed to fetch URL: HTTP ${resp.status}`);

    const contentType = resp.headers.get('content-type') || '';
    if (contentType.includes('pdf') || url.endsWith('.pdf')) {
      const arrayBuf = await resp.arrayBuffer();
      return await this.ingestPdf(new Uint8Array(arrayBuf), title, metadata);
    }

    const rawHtml = await resp.text();
    const cleanText = rawHtml
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, ' ')
      .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/\s{2,}/g, ' ')
      .trim();

    return this.ingestText(cleanText, title, { ...metadata, sourceUrl: url });
  }

  _detectType(input) {
    if (typeof input.data === 'string') {
      if (input.data.startsWith('http://') || input.data.startsWith('https://')) return 'url';
      if (input.data.includes(',') && input.data.includes('\n')) return 'csv';
      return 'text';
    }
    if (input.filename) {
      const ext = input.filename.split('.').pop().toLowerCase();
      if (ext === 'pdf') return 'pdf';
      if (ext === 'csv') return 'csv';
    }
    return 'text';
  }
}
