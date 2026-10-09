import React, { useEffect, useRef, useState } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.min.js?url';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;

interface MagicLinkMetadata {
  token: string;
  title: string;
  remainingSeconds: number;
  expiresAt: string;
  hasPdf: boolean;
  pdf?: {
    fileName: string;
    fileSize: number;
    totalChunks: number;
    chunkSize: number;
    encryption: string;
  } | null;
  profile?: Record<string, unknown>;
}

interface SecurePdfMagicViewerProps {
  token: string;
  onExit?: () => void;
}

export function SecurePdfMagicViewer({ token, onExit }: SecurePdfMagicViewerProps) {
  const [meta, setMeta] = useState<MagicLinkMetadata | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [loadingStatus, setLoadingStatus] = useState<string>('Validating 1-hour magic link...');
  const [error, setError] = useState<string | null>(null);
  const [isExpired, setIsExpired] = useState<boolean>(false);
  const [remainingSeconds, setRemainingSeconds] = useState<number>(3600);
  const [securityAlert, setSecurityAlert] = useState<string | null>(null);
  const [numPages, setNumPages] = useState<number>(0);
  const [scale, setScale] = useState<number>(1.25);
  const [renderedCount, setRenderedCount] = useState<number>(0);

  const pagesContainerRef = useRef<HTMLDivElement>(null);
  const pdfDocRef = useRef<pdfjsLib.PDFDocumentProxy | null>(null);
  const alertTimeoutRef = useRef<number | null>(null);

  const apiBase = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3001';

  const triggerSecurityNotice = (message: string) => {
    setSecurityAlert(message);
    if (alertTimeoutRef.current) {
      window.clearTimeout(alertTimeoutRef.current);
    }
    alertTimeoutRef.current = window.setTimeout(() => {
      setSecurityAlert(null);
    }, 2800);
  };

  // 1. Intercept canvas data extraction attacks (anti-inspect / anti-exfiltration)
  useEffect(() => {
    const originalToDataURL = HTMLCanvasElement.prototype.toDataURL;
    const originalToBlob = HTMLCanvasElement.prototype.toBlob;

    HTMLCanvasElement.prototype.toDataURL = function () {
      triggerSecurityNotice('Canvas export is blocked on protected documents.');
      return 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';
    };

    HTMLCanvasElement.prototype.toBlob = function (callback: BlobCallback) {
      triggerSecurityNotice('Canvas export is blocked on protected documents.');
      callback(new Blob([], { type: 'image/png' }));
    };

    return () => {
      HTMLCanvasElement.prototype.toDataURL = originalToDataURL;
      HTMLCanvasElement.prototype.toBlob = originalToBlob;
    };
  }, []);

  // 2. Global event listeners to prevent right-click, selection, print, and devtools shortcuts
  useEffect(() => {
    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      triggerSecurityNotice('Right-click context menu is disabled for protected documents.');
      return false;
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      const isCtrlOrCmd = e.ctrlKey || e.metaKey;
      const key = e.key.toLowerCase();

      // Block Save (Ctrl+S), Print (Ctrl+P), View Source (Ctrl+U), Copy (Ctrl+C), Select All (Ctrl+A)
      if (isCtrlOrCmd && ['s', 'p', 'u', 'c', 'a'].includes(key)) {
        e.preventDefault();
        e.stopPropagation();
        triggerSecurityNotice(`Action (Ctrl+${key.toUpperCase()}) is disabled on protected documents.`);
        return false;
      }

      // Block F12 and DevTools inspector shortcuts (Ctrl+Shift+I, Ctrl+Shift+J, Ctrl+Shift+C)
      if (
        e.key === 'F12' ||
        (isCtrlOrCmd && e.shiftKey && ['i', 'j', 'c'].includes(key))
      ) {
        e.preventDefault();
        e.stopPropagation();
        triggerSecurityNotice('Developer tools shortcuts are blocked on protected documents.');
        return false;
      }
    };

    const handleDragStart = (e: DragEvent) => {
      e.preventDefault();
      return false;
    };

    window.addEventListener('contextmenu', handleContextMenu, true);
    window.addEventListener('keydown', handleKeyDown, true);
    window.addEventListener('dragstart', handleDragStart, true);

    return () => {
      window.removeEventListener('contextmenu', handleContextMenu, true);
      window.removeEventListener('keydown', handleKeyDown, true);
      window.removeEventListener('dragstart', handleDragStart, true);
    };
  }, []);

  // 3. Live 1-hour expiration countdown timer
  useEffect(() => {
    if (isExpired) return;

    const interval = window.setInterval(() => {
      setRemainingSeconds((prev) => {
        if (prev <= 1) {
          setIsExpired(true);
          // Wipe canvases on expiration
          if (pagesContainerRef.current) {
            pagesContainerRef.current.innerHTML = '';
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => window.clearInterval(interval);
  }, [isExpired]);

  // 4. Fetch metadata and stream decrypted PDF into memory
  useEffect(() => {
    let isCancelled = false;

    async function loadSecurePdf() {
      try {
        setLoading(true);
        setLoadingStatus('Validating magic link token...');

        // Step 1: Check token validity and expiration
        const metaRes = await fetch(`${apiBase}/api/magic-link/${token}`);
        if (metaRes.status === 410) {
          setIsExpired(true);
          setLoading(false);
          return;
        }
        if (!metaRes.ok) {
          throw new Error(`Magic link could not be found or has expired (status ${metaRes.status}).`);
        }

        const metaData = (await metaRes.json()) as MagicLinkMetadata;
        if (isCancelled) return;
        setMeta(metaData);

        if (metaData.remainingSeconds <= 0) {
          setIsExpired(true);
          setLoading(false);
          return;
        }
        setRemainingSeconds(metaData.remainingSeconds);

        if (!metaData.hasPdf) {
          throw new Error('This magic link does not contain an encrypted PDF document.');
        }

        // Step 2: Fetch decrypted PDF stream (server decrypts AES-256 chunks and streams back)
        setLoadingStatus('Decrypting AES-256 chunks from PostgreSQL...');
        const pdfRes = await fetch(`${apiBase}/api/magic-link/${token}/pdf`);
        if (pdfRes.status === 410) {
          setIsExpired(true);
          setLoading(false);
          return;
        }
        if (!pdfRes.ok) {
          throw new Error(`Failed to decrypt PDF document from server (status ${pdfRes.status}).`);
        }

        setLoadingStatus('Rendering secure protected view...');
        const arrayBuffer = await pdfRes.arrayBuffer();
        if (isCancelled) return;

        // Step 3: Load into pdfjs in-memory
        const loadingTask = pdfjsLib.getDocument({
          data: arrayBuffer,
          isEvalSupported: false,
        });

        const doc = await loadingTask.promise;
        if (isCancelled) return;

        pdfDocRef.current = doc;
        setNumPages(doc.numPages);
        setLoading(false);
      } catch (err) {
        if (!isCancelled) {
          console.error('Failed to load secure magic link PDF:', err);
          setError(err instanceof Error ? err.message : 'Failed to load protected document.');
          setLoading(false);
        }
      }
    }

    void loadSecurePdf();

    return () => {
      isCancelled = true;
      if (pdfDocRef.current) {
        void pdfDocRef.current.destroy();
      }
    };
  }, [token, apiBase]);

  // 5. Render pages onto HTML5 canvas with watermark and overlay shields
  useEffect(() => {
    const doc = pdfDocRef.current;
    const container = pagesContainerRef.current;
    if (!doc || !container || isExpired) return;

    let isCancelled = false;
    container.innerHTML = '';
    setRenderedCount(0);

    async function renderAllPages() {
      if (!doc || !container) return;

      for (let pageNum = 1; pageNum <= doc.numPages; pageNum++) {
        if (isCancelled) break;

        const page = await doc.getPage(pageNum);
        if (isCancelled) break;

        const viewport = page.getViewport({ scale });
        const pixelRatio = window.devicePixelRatio || 1;

        // Wrapper for page + security shield
        const pageWrapper = document.createElement('div');
        pageWrapper.className = 'secure-page-wrapper';
        pageWrapper.style.position = 'relative';
        pageWrapper.style.width = `${viewport.width}px`;
        pageWrapper.style.height = `${viewport.height}px`;
        pageWrapper.style.margin = '0 auto 24px auto';
        pageWrapper.style.boxShadow = '0 8px 30px rgba(0,0,0,0.25)';
        pageWrapper.style.borderRadius = '0px';
        pageWrapper.style.overflow = 'hidden';
        pageWrapper.style.backgroundColor = '#ffffff';

        // Canvas for PDF raster
        const canvas = document.createElement('canvas');
        canvas.className = 'secure-pdf-canvas';
        canvas.width = viewport.width * pixelRatio;
        canvas.height = viewport.height * pixelRatio;
        canvas.style.width = `${viewport.width}px`;
        canvas.style.height = `${viewport.height}px`;
        canvas.style.display = 'block';

        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.scale(pixelRatio, pixelRatio);

          await page.render({
            canvasContext: ctx,
            viewport,
          }).promise;

          if (isCancelled) break;

          // Draw anti-exfiltration watermark directly into canvas pixels
          ctx.save();
          ctx.font = 'bold 15px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
          ctx.fillStyle = 'rgba(239, 68, 68, 0.12)';
          ctx.rotate((-25 * Math.PI) / 180);

          const watermarkText = `SECURE LIVE VIEW • EXPIRES IN 1 HR • GRADGUIDE PROTECTED`;
          for (let y = -400; y < viewport.height + 600; y += 140) {
            for (let x = -400; x < viewport.width + 600; x += 380) {
              ctx.fillText(watermarkText, x, y);
            }
          }
          ctx.restore();
        }

        pageWrapper.appendChild(canvas);

        // Security transparent shield layer above canvas
        const shield = document.createElement('div');
        shield.className = 'secure-shield-overlay';
        shield.style.position = 'absolute';
        shield.style.top = '0';
        shield.style.left = '0';
        shield.style.width = '100%';
        shield.style.height = '100%';
        shield.style.zIndex = '20';
        shield.style.userSelect = 'none';
        shield.style.pointerEvents = 'auto';
        shield.style.background = 'transparent';

        shield.addEventListener('contextmenu', (e) => {
          e.preventDefault();
          e.stopPropagation();
          triggerSecurityNotice('Right-click is disabled on protected live documents.');
          return false;
        });

        shield.addEventListener('mousedown', (e) => {
          if (e.button === 2) {
            e.preventDefault();
            triggerSecurityNotice('Right-click is disabled.');
          }
        });

        pageWrapper.appendChild(shield);
        container.appendChild(pageWrapper);

        setRenderedCount(pageNum);
      }
    }

    void renderAllPages();

    return () => {
      isCancelled = true;
    };
  }, [scale, numPages, isExpired]);

  const formatCountdown = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return '';
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  return (
    <div className="secure-viewer-root">
      {/* Top Security Bar */}
      <header className="secure-viewer-header">
        <div className="secure-header-left">
          <div className="secure-badge-pulse">
            <span className="live-dot" />
            <span className="badge-text">LIVE PROTECTED VIEW</span>
          </div>
          <div className="secure-doc-title">
            <strong>{meta?.title || meta?.pdf?.fileName || 'Encrypted Document'}</strong>
            {meta?.pdf?.fileSize ? (
              <span className="doc-meta-sub">
                ({formatFileSize(meta.pdf.fileSize)} • {meta.pdf.totalChunks} AES-256 chunks)
              </span>
            ) : null}
          </div>
        </div>

        <div className="secure-header-center">
          <div className={`countdown-chip ${remainingSeconds < 300 ? 'urgent' : ''}`}>
            <span className="countdown-icon">⏱️</span>
            <span className="countdown-label">Link valid for 1 hour:</span>
            <span className="countdown-timer">{formatCountdown(remainingSeconds)}</span>
          </div>
        </div>

        <div className="secure-header-right">
          <div className="zoom-controls">
            <button
              className="zoom-btn"
              onClick={() => setScale((s) => Math.max(0.75, s - 0.2))}
              title="Zoom out"
            >
              −
            </button>
            <span className="zoom-level">{Math.round(scale * 100)}%</span>
            <button
              className="zoom-btn"
              onClick={() => setScale((s) => Math.min(2.5, s + 0.2))}
              title="Zoom in"
            >
              +
            </button>
            <button className="zoom-btn reset" onClick={() => setScale(1.25)} title="Reset zoom">
              Fit
            </button>
          </div>

          {onExit ? (
            <button className="exit-btn" onClick={onExit}>
              Exit
            </button>
          ) : null}
        </div>
      </header>

      {/* Floating security banner notification */}
      {securityAlert ? (
        <div className="security-alert-toast" role="alert">
          <span className="alert-icon">🛡️</span>
          <span>{securityAlert}</span>
        </div>
      ) : null}

      {/* Main Body */}
      <main className="secure-viewer-body">
        {loading ? (
          <div className="secure-loading-state">
            <div className="secure-spinner" />
            <h3>Decrypting Protected Document</h3>
            <p>{loadingStatus}</p>
            <div className="secure-security-info">
              <span>🔐 AES-256-GCM Decryption</span>
              <span>•</span>
              <span>🧩 PostgreSQL Chunk Streaming</span>
              <span>•</span>
              <span>⏳ 1-Hour Ephemeral Lifetime</span>
            </div>
          </div>
        ) : isExpired ? (
          <div className="secure-expired-state">
            <div className="expired-icon">⌛</div>
            <h2>Magic Link Has Expired</h2>
            <p>
              This magic link was configured to expire after exactly <strong>1 hour</strong>. For
              security and privacy compliance, the document cannot be decrypted or accessed anymore.
            </p>
            <p className="expired-hint">Please ask the sender to generate a new magic link.</p>
            {onExit ? (
              <button className="primary-button" onClick={onExit}>
                Back to GradGuide
              </button>
            ) : null}
          </div>
        ) : error ? (
          <div className="secure-error-state">
            <div className="error-icon">⚠️</div>
            <h2>Unable to Open Document</h2>
            <p>{error}</p>
            {onExit ? (
              <button className="primary-button" onClick={onExit}>
                Back to GradGuide
              </button>
            ) : null}
          </div>
        ) : (
          <div className="secure-document-viewport">
            {/* Security Notice Watermark Header */}
            <div className="viewport-security-banner">
              <span className="shield-icon">🔒</span>
              <span>
                Protected Live View: Right-click, download, embedding, and element inspection are
                restricted. Link automatically self-destructs when 1 hour expires.
              </span>
            </div>

            {/* Container where HTML5 canvases are dynamically rendered */}
            <div
              ref={pagesContainerRef}
              className="secure-pages-container"
              onContextMenu={(e) => {
                e.preventDefault();
                triggerSecurityNotice('Right-click is disabled.');
              }}
            />

            {numPages > 0 ? (
              <div className="secure-page-counter">
                Page {renderedCount} of {numPages}
              </div>
            ) : null}
          </div>
        )}
      </main>
    </div>
  );
}

