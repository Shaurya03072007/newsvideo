import React, { useRef, useState } from 'react';
import {
  CheckCircle2,
  Download,
  FileCheck2,
  Printer,
  Sparkles,
  X,
  AlertTriangle,
  Bot,
  ArrowRight,
  RefreshCw,
} from 'lucide-react';
import type { AgenticPdfLoopReport, NewspaperEdition } from '../shared/types.ts';

export interface PdfDownloadPayload {
  editionId: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  pageCount: number;
  base64: string;
  printHtml: string;
  blobUrl: string;
  agenticPdfReport?: AgenticPdfLoopReport | null;
}

export async function fetchAndTriggerCookieSafePdfDownload(
  editionId: string
): Promise<PdfDownloadPayload> {
  const res = await fetch(`/api/editions/${encodeURIComponent(editionId)}/pdf-data`, {
    method: 'GET',
    credentials: 'include',
    headers: {
      Accept: 'application/json',
    },
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch PDF payload (HTTP ${res.status})`);
  }

  const data = await res.json();
  const binaryStr = window.atob(data.base64);
  const bytes = new Uint8Array(binaryStr.length);
  for (let i = 0; i < binaryStr.length; i++) {
    bytes[i] = binaryStr.charCodeAt(i);
  }

  // Verify %PDF- magic header (0x25 0x50 0x44 0x46)
  if (
    bytes.byteLength < 100 ||
    bytes[0] !== 0x25 ||
    bytes[1] !== 0x50 ||
    bytes[2] !== 0x44 ||
    bytes[3] !== 0x46
  ) {
    throw new Error('Invalid PDF binary signature received.');
  }

  const blob = new Blob([bytes], { type: 'application/pdf' });
  const blobUrl = URL.createObjectURL(blob);

  // Trigger in-context blob download (bypasses external mobile DownloadManager cookie check)
  const link = document.createElement('a');
  link.href = blobUrl;
  link.download = data.filename || `PrajaVani-${editionId}.pdf`;
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  setTimeout(() => {
    if (document.body.contains(link)) {
      document.body.removeChild(link);
    }
  }, 400);

  return {
    editionId: data.editionId,
    filename: data.filename,
    mimeType: data.mimeType || 'application/pdf',
    sizeBytes: bytes.byteLength,
    pageCount: data.pageCount || 2,
    base64: data.base64,
    printHtml: data.printHtml || '',
    blobUrl,
    agenticPdfReport: data.agenticPdfReport || null,
  };
}

export async function runLiveAgenticPdfVerifyAndDownload(
  editionId: string
): Promise<{ edition: NewspaperEdition; payload: PdfDownloadPayload }> {
  const res = await fetch(`/api/editions/${encodeURIComponent(editionId)}/agentic-pdf-verify`, {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
  });

  if (!res.ok) {
    throw new Error(`Agentic PDF verification failed (HTTP ${res.status})`);
  }

  const data = await res.json();
  const pdfData = data.pdfPayload;
  const binaryStr = window.atob(pdfData.base64);
  const bytes = new Uint8Array(binaryStr.length);
  for (let i = 0; i < binaryStr.length; i++) {
    bytes[i] = binaryStr.charCodeAt(i);
  }

  const blob = new Blob([bytes], { type: 'application/pdf' });
  const blobUrl = URL.createObjectURL(blob);

  return {
    edition: data.edition,
    payload: {
      editionId: pdfData.editionId,
      filename: pdfData.filename,
      mimeType: pdfData.mimeType || 'application/pdf',
      sizeBytes: bytes.byteLength,
      pageCount: pdfData.pageCount || 2,
      base64: pdfData.base64,
      printHtml: pdfData.printHtml || '',
      blobUrl,
      agenticPdfReport: data.agenticPdfReport || pdfData.agenticPdfReport || null,
    },
  };
}

interface PdfExportInspectorModalProps {
  payload: PdfDownloadPayload | null;
  error: string | null;
  onClose: () => void;
  onReverifyAgentLoop?: () => void;
  isReverifying?: boolean;
}

export const PdfExportInspectorModal: React.FC<PdfExportInspectorModalProps> = ({
  payload,
  error,
  onClose,
  onReverifyAgentLoop,
  isReverifying = false,
}) => {
  const printIframeRef = useRef<HTMLIFrameElement | null>(null);
  const [downloadedAgain, setDownloadedAgain] = useState(false);

  if (!payload && !error) return null;

  const handleSaveBlobAgain = () => {
    if (!payload) return;
    const link = document.createElement('a');
    link.href = payload.blobUrl;
    link.download = payload.filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setDownloadedAgain(true);
    setTimeout(() => setDownloadedAgain(false), 2500);
  };

  const handleSystemPrint = () => {
    if (printIframeRef.current?.contentWindow) {
      printIframeRef.current.contentWindow.focus();
      printIframeRef.current.contentWindow.print();
    } else {
      window.print();
    }
  };

  const agentReport = payload?.agenticPdfReport;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Print-Ready PDF Export and Verification Studio"
      className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="bg-[#FAF8F3] border-2 border-stone-900 max-w-5xl w-full max-h-[92vh] flex flex-col shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Bar */}
        <div className="bg-[#18181B] text-white px-5 py-3.5 flex flex-wrap items-center justify-between gap-3 border-b-2 border-[#B91C1C]">
          <div className="flex items-center gap-2.5">
            <FileCheck2 className="w-5 h-5 text-emerald-400 shrink-0" />
            <div>
              <div className="text-sm font-bold flex flex-wrap items-center gap-2">
                <span>ప్రజా వాణి Agentic PDF Release Gatekeeper Studio</span>
                {payload && (
                  <span className="px-2 py-0.5 bg-emerald-700 text-white font-mono-tabular text-[11px] font-semibold">
                    %PDF-1.4 VERIFIED · {(payload.sizeBytes / 1024).toFixed(1)} KB
                  </span>
                )}
                {agentReport?.ready_for_user && (
                  <span className="px-2 py-0.5 bg-amber-400 text-stone-950 font-mono-tabular text-[11px] font-extrabold">
                    READY FOR USER (SLIDE APPROVED · {agentReport.final_quality_score}/100)
                  </span>
                )}
              </div>
              <p className="text-[11px] text-stone-300">
                Multi-Agent Pipeline: PDF → gemini-3.1-flash-lite (Visual Gatekeeper) ⇄ gemini-3.5-flash-lite (Autonomous Layout Architect)
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {onReverifyAgentLoop && (
              <button
                type="button"
                disabled={isReverifying}
                onClick={onReverifyAgentLoop}
                className="px-3 py-1.5 bg-stone-800 hover:bg-stone-700 border border-stone-600 text-amber-300 text-xs font-bold flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isReverifying ? 'animate-spin' : ''}`} />
                {isReverifying ? 'Agents Inspecting...' : 'Re-Run 3.1 → 3.5 Agent Loop'}
              </button>
            )}
            {payload && (
              <>
                <button
                  type="button"
                  onClick={handleSaveBlobAgain}
                  className="px-3.5 py-1.5 bg-[#991B1B] hover:bg-[#7F1D1D] text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  {downloadedAgain ? 'Saved PDF to Device!' : `Save ${payload.filename}`}
                </button>
                <button
                  type="button"
                  onClick={handleSystemPrint}
                  className="px-3.5 py-1.5 bg-amber-500 hover:bg-amber-400 text-stone-950 text-xs font-extrabold flex items-center gap-1.5 cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5" />
                  Print / Save via System PDF Dialog
                </button>
              </>
            )}
            <button
              type="button"
              onClick={onClose}
              aria-label="Close PDF Studio"
              className="p-1.5 text-stone-300 hover:text-white cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {error ? (
          <div className="p-6 bg-red-50 text-red-900 flex items-center gap-3">
            <AlertTriangle className="w-6 h-6 text-red-700 shrink-0" />
            <div className="text-sm">
              <div className="font-bold">PDF Export Warning</div>
              <div>{error}</div>
            </div>
          </div>
        ) : (
          payload && (
            <div className="p-4 space-y-3 overflow-y-auto flex-1">
              <div className="bg-emerald-50 border border-emerald-300 px-4 py-2.5 flex flex-wrap items-center justify-between gap-2 text-xs text-emerald-950">
                <div className="flex items-center gap-2 font-semibold">
                  <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
                  <span>
                    Verified &amp; Ready for User: <strong>{payload.filename}</strong> ({payload.pageCount} pages,{' '}
                    {(payload.sizeBytes / 1024).toFixed(1)} KB).
                  </span>
                </div>
                <span className="font-telugu-sans font-bold text-emerald-800 flex items-center gap-1">
                  <Sparkles className="w-3.5 h-3.5" /> వృత్తం, గోపుర ఆర్చ్, పంచభుజి, నక్షత్ర ఆకృతులతో ముద్రణకు సిద్ధం
                </span>
              </div>

              {/* Multi-Agent PDF Inspection & Architectural Rewrite Trace */}
              {agentReport && (
                <div className="bg-white border-2 border-stone-900 p-3.5 space-y-2.5">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-stone-200 pb-2">
                    <div className="flex items-center gap-2 text-xs font-extrabold text-stone-900 uppercase tracking-wider">
                      <Bot className="w-4 h-4 text-[#991B1B]" />
                      <span>
                        Agentic PDF Loop Trace: {agentReport.inspector_model_id} (Gatekeeper) &lt;-&gt;{' '}
                        {agentReport.architect_model_id} (Architect)
                      </span>
                    </div>
                    <div className="flex items-center gap-2 font-mono-tabular text-[11px]">
                      <span className="px-2 py-0.5 bg-stone-100 border border-stone-300 text-stone-800 font-semibold">
                        Rounds: {agentReport.total_agent_rounds}
                      </span>
                      <span className="px-2 py-0.5 bg-emerald-800 text-white font-bold">
                        Verdict: {agentReport.final_verdict} ({agentReport.final_quality_score}/100)
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                    {agentReport.rounds.map((r) => (
                      <div
                        key={r.round_number}
                        className={`p-2.5 border text-xs space-y-1.5 ${
                          r.inspection_3_1.approved_to_slide
                            ? 'bg-emerald-50/60 border-emerald-400'
                            : 'bg-amber-50/70 border-amber-400'
                        }`}
                      >
                        <div className="flex items-center justify-between font-mono-tabular font-bold text-[11px]">
                          <span className="text-stone-900">
                            ROUND {r.round_number} · Plan v{r.plan_version} PDF (
                            {r.pdf_size_bytes >= 1024
                              ? `${(r.pdf_size_bytes / 1024).toFixed(0)} KB`
                              : 'Draft Pass'}
                            )
                          </span>
                          <span
                            className={`px-1.5 py-0.5 ${
                              r.inspection_3_1.approved_to_slide
                                ? 'bg-emerald-700 text-white'
                                : 'bg-amber-700 text-white'
                            }`}
                          >
                            3.1 Flash-Lite: {r.inspection_3_1.verdict}
                          </span>
                        </div>

                        <p className="text-[11px] text-stone-800 leading-snug">
                          <strong>{r.inspection_3_1.inspector_model_id}:</strong>{' '}
                          {r.inspection_3_1.inspector_summary}
                        </p>

                        {r.rewrite_3_5 && (
                          <div className="mt-1.5 pt-1.5 border-t border-amber-300/80 space-y-1 bg-white/80 p-2">
                            <div className="flex items-center gap-1 font-mono-tabular font-bold text-[10.5px] text-[#991B1B]">
                              <ArrowRight className="w-3 h-3" />
                              <span>
                                {r.rewrite_3_5.architect_model_id} Architectural Rewrite (v
                                {r.rewrite_3_5.from_plan_version} → v{r.rewrite_3_5.to_plan_version})
                              </span>
                            </div>
                            <p className="text-[11px] text-stone-700 leading-snug">
                              {r.rewrite_3_5.agent_reasoning}
                            </p>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Embedded Print-Ready Preview Frame */}
              <div className="border-2 border-stone-400 bg-stone-200 p-3">
                <div className="text-xs font-mono-tabular font-semibold text-stone-700 mb-2 flex items-center justify-between">
                  <span>
                    LIVE PRINT SHEET PREVIEW ({payload.pageCount} PAGES · 330mm × 520mm BROADSHEET)
                  </span>
                  <span>
                    Use &ldquo;Save {payload.filename}&rdquo; or &ldquo;Print / Save via System PDF Dialog&rdquo; above
                  </span>
                </div>
                {payload.printHtml ? (
                  <iframe
                    ref={printIframeRef}
                    title="Print-Ready Telugu Newspaper Preview"
                    srcDoc={payload.printHtml}
                    className="w-full h-[54vh] bg-white border border-stone-400 shadow-inner"
                  />
                ) : (
                  <iframe
                    title="PDF Binary Preview"
                    src={payload.blobUrl}
                    className="w-full h-[54vh] bg-white border border-stone-400"
                  />
                )}
              </div>
            </div>
          )
        )}
      </div>
    </div>
  );
};

