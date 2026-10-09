import React, { useState, useRef, type ChangeEvent, type DragEvent } from 'react';

interface PdfMagicLinkGeneratorProps {
  onOpenViewer?: (token: string) => void;
  getToken?: () => Promise<string | null>;
  isOpen?: boolean;
  onClose?: () => void;
}

interface GeneratedLinkInfo {
  token: string;
  url: string;
  link: string;
  title: string;
  fileName: string;
  fileSize: number;
  totalChunks: number;
  chunkSize: number;
  encryption: string;
  expiresAt: string;
}

export function PdfMagicLinkGenerator({ onOpenViewer, getToken, isOpen, onClose }: PdfMagicLinkGeneratorProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [customTitle, setCustomTitle] = useState<string>('');
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [uploadStatus, setUploadStatus] = useState<string>('');
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);
  const [generatedInfo, setGeneratedInfo] = useState<GeneratedLinkInfo | null>(null);
  const [copied, setCopied] = useState<boolean>(false);
  const [isDragOver, setIsDragOver] = useState<boolean>(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const apiBase = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3001';

  const handleFileSelect = (file: File) => {
    if (!file.name.toLowerCase().endsWith('.pdf') && file.type !== 'application/pdf') {
      setError('Please select a valid PDF file (.pdf).');
      return;
    }
    if (file.size > 30 * 1024 * 1024) {
      setError('File is too large. Maximum size is 30 MB.');
      return;
    }
    setError(null);
    setSelectedFile(file);
    if (!customTitle) {
      setCustomTitle(file.name.replace(/\.[^/.]+$/, ''));
    }
  };

  const handleInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFileSelect(e.target.files[0]);
    }
  };

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelect(e.dataTransfer.files[0]);
    }
  };

  const handleGenerateMagicLink = async () => {
    if (!selectedFile) {
      setError('Please choose a PDF document first.');
      return;
    }

    try {
      setIsUploading(true);
      setError(null);
      setUploadProgress(10);
      setUploadStatus('Reading PDF file buffer...');

      const arrayBuffer = await selectedFile.arrayBuffer();
      setUploadProgress(35);
      setUploadStatus('Encoding for secure chunk transmission...');

      // Convert ArrayBuffer to base64
      let binary = '';
      const bytes = new Uint8Array(arrayBuffer);
      const len = bytes.byteLength;
      for (let i = 0; i < len; i++) {
        binary += String.fromCharCode(bytes[i]);
      }
      const fileBase64 = window.btoa(binary);

      setUploadProgress(60);
      setUploadStatus('Transmitting to server for AES-256 chunking & PostgreSQL storage...');

      let authToken = '';
      if (getToken) {
        authToken = (await getToken()) ?? '';
      }

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (authToken) {
        headers['Authorization'] = `Bearer ${authToken}`;
      }

      const response = await fetch(`${apiBase}/api/magic-link/pdf`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          title: customTitle.trim() || selectedFile.name,
          fileName: selectedFile.name,
          fileBase64,
          expiresInHours: 1, // User required: alive only for 1 hour
        }),
      });

      setUploadProgress(90);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `Server returned status ${response.status}`);
      }

      const result = (await response.json()) as GeneratedLinkInfo;
      setUploadProgress(100);
      setUploadStatus('Encryption complete!');
      setGeneratedInfo(result);
    } catch (err) {
      console.error('Failed to generate PDF magic link:', err);
      setError(err instanceof Error ? err.message : 'Upload and encryption failed.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleCopy = async () => {
    if (!generatedInfo) return;
    try {
      await navigator.clipboard.writeText(generatedInfo.url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Fallback
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  const estimatedChunks = selectedFile ? Math.ceil(selectedFile.size / (64 * 1024)) : 0;

  const content = (
    <div className="pdf-magic-card bg-card text-card-foreground border rounded-xl shadow-sm p-6 max-w-2xl mx-auto w-full relative">
      {onClose && (
        <button onClick={onClose} className="absolute top-4 right-4 p-2 text-muted-foreground hover:bg-muted rounded-full">
          ✕
        </button>
      )}
      <div className="pdf-magic-header">
        <div className="pdf-magic-title-row">
          <span className="pdf-magic-icon">🔒</span>
          <h3 className="pdf-magic-heading">Secure PDF Magic Link Generator</h3>
          <span className="magic-pill-1hr">1-Hour Ephemeral</span>
        </div>
      </div>

      {/* Upload Drop Zone */}
      <div
        className={`pdf-dropzone ${isDragOver ? 'drag-over' : ''} ${selectedFile ? 'has-file' : ''}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="application/pdf"
          style={{ display: 'none' }}
          onChange={handleInputChange}
        />

        {selectedFile ? (
          <div className="dropzone-file-info">
            <div className="file-avatar">📄</div>
            <div className="file-details">
              <strong>{selectedFile.name}</strong>
              <span>
                {formatFileSize(selectedFile.size)} • approx. {estimatedChunks} AES-256 chunks
              </span>
            </div>
            <button
              type="button"
              className="change-file-btn"
              onClick={(e) => {
                e.stopPropagation();
                fileInputRef.current?.click();
              }}
            >
              Change PDF
            </button>
          </div>
        ) : (
          <div className="dropzone-prompt">
            <div className="dropzone-icon">📤</div>
            <p className="dropzone-text">
              <strong>Click to browse</strong> or drag & drop your PDF file here
            </p>
            <span className="dropzone-hint">PDF up to 30MB • Auto-chunked & encrypted on upload</span>
          </div>
        )}
      </div>

      {/* Form Controls */}
      {selectedFile ? (
        <div className="pdf-magic-inputs">
          <label className="input-field-label">
            Document Title (Optional)
            <input
              type="text"
              value={customTitle}
              onChange={(e) => setCustomTitle(e.target.value)}
              placeholder="e.g. Student Academic Evaluation & Shortlist"
              className="magic-title-input"
            />
          </label>

          <button
            type="button"
            className="primary-button magic-gen-btn"
            disabled={isUploading}
            onClick={() => void handleGenerateMagicLink()}
          >
            {isUploading ? 'Chunking & Encrypting...' : '⚡ Generate 1-Hour Protected Magic Link'}
          </button>
        </div>
      ) : null}

      {/* Upload Progress */}
      {isUploading ? (
        <div className="upload-progress-card">
          <div className="progress-info-row">
            <span>{uploadStatus}</span>
            <span>{uploadProgress}%</span>
          </div>
          <div className="progress-bar-bg">
            <div className="progress-bar-fill" style={{ width: `${uploadProgress}%` }} />
          </div>
        </div>
      ) : null}

      {/* Error Message */}
      {error ? (
        <div className="pdf-magic-error" role="alert">
          <span>⚠️ {error}</span>
        </div>
      ) : null}

      {/* Generated Result Card */}
      {generatedInfo ? (
        <div className="pdf-generated-card">
          <div className="generated-top">
            <div className="generated-badge-row">
              <span className="status-badge success">Active for 1 Hour</span>
              <span className="status-badge info">AES-256-GCM</span>
              <span className="status-badge neutral">{generatedInfo.totalChunks} Chunks in Postgres</span>
            </div>
            <h4>Magic Link Ready</h4>
          </div>

          <div className="magic-link-box-row">
            <input
              type="text"
              readOnly
              value={generatedInfo.url}
              className="magic-url-input"
              onClick={(e) => (e.target as HTMLInputElement).select()}
            />
            <button type="button" className="secondary-button copy-btn" onClick={() => void handleCopy()}>
              {copied ? '✓ Copied!' : 'Copy Link'}
            </button>
            {onOpenViewer ? (
              <button
                type="button"
                className="primary-button view-btn"
                onClick={() => onOpenViewer(generatedInfo.token)}
              >
                👁️ Open Live View
              </button>
            ) : (
              <a
                href={generatedInfo.url}
                target="_blank"
                rel="noreferrer"
                className="primary-button view-btn"
              >
                👁️ Open Live View
              </a>
            )}
          </div>

          <div className="generated-meta-grid">
            <div className="meta-item">
              <span className="meta-lbl">Document</span>
              <span className="meta-val">{generatedInfo.fileName}</span>
            </div>
            <div className="meta-item">
              <span className="meta-lbl">Size & Chunks</span>
              <span className="meta-val">
                {formatFileSize(generatedInfo.fileSize)} ({generatedInfo.totalChunks} × 64KB)
              </span>
            </div>
            <div className="meta-item">
              <span className="meta-lbl">Security</span>
              <span className="meta-val">AES-256-GCM + Postgres BYTEA</span>
            </div>
            <div className="meta-item">
              <span className="meta-lbl">Link Expiration</span>
              <span className="meta-val">
                {new Date(generatedInfo.expiresAt).toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit',
                })}{' '}
                (in 60 min)
              </span>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );

  if (isOpen !== undefined) {
    if (!isOpen) return null;
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
        {content}
      </div>
    );
  }

  return content;
}

