import React, { useRef, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  Bot,
  CheckCircle2,
  Download,
  FileCheck2,
  Printer,
  RefreshCw,
  Sparkles,
  X,
} from 'lucide-react';
import type { AgenticPdfLoopReport, NewspaperEdition } from '../shared/types.ts';
import { useToast } from './ToastNotification.tsx';

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

  // Trigger in-context blob download
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
  const { addToast } = useToast();
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
    addToast({
      type: 'success',
      title: 'PDF Saved',
      message: `Downloaded ${payload.filename} to local device.`,
    });
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
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="bg-slate-900 border border-slate-700 max-w-5xl w-full max-h-[92vh] flex flex-col rounded-2xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Bar */}
        <div className="bg-slate-950 text-white px-5 py-3.5 flex flex-wrap items-center justify-between gap-3 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <FileCheck2 className="w-5 h-5 text-emerald-400 shrink-0" />
            <div>
              <div className="text-sm font-bold flex flex-wrap items-center gap-2">
                <span>ప్రజా వాణి Agentic PDF Release Studio</span>
                {payload && (
                  <span className="px-2 py-0.5 bg-emerald-950 text-emerald-300 border border-emerald-800 font-mono-tabular text-[11px] font-bold rounded-md">
                    %PDF-1.4 · {(payload.sizeBytes / 1024).toFixed(1)} KB
                  </span>
                )}
                {agentReport?.ready_for_user && (
                  <span className="px-2 py-0.5 bg-amber-400 text-slate-950 font-mono-tabular text-[11px] font-extrabold rounded-md shadow-sm">
                    READY FOR USER ({agentReport.final_quality_score}/100)
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-400">
                దినపత్రిక ముద్రణా నాణ్యత పరిశీలన (Print Quality Inspection)
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {onReverifyAgentLoop && (
              <button
                type="button"
                disabled={isReverifying}
                onClick={onReverifyAgentLoop}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-amber-300 text-xs font-bold rounded-xl flex items-center gap-1.5 cursor-pointer disabled:opacity-50 transition-all"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isReverifying ? 'animate-spin' : ''}`} />
                {isReverifying ? 'తనిఖీ జరుగుతోంది...' : 'నాణ్యత పునఃపరిశీలన (Re-verify)'}
              </button>
            )}
            {payload && (
              <>
                <button
                  type="button"
                  onClick={handleSaveBlobAgain}
                  className="px-3.5 py-1.5 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 text-xs font-bold rounded-xl shadow-md flex items-center gap-1.5 cursor-pointer transition-all active:scale-95"
                >
                  <Download className="w-3.5 h-3.5 fill-current" />
                  {downloadedAgain ? 'Saved to Device!' : `Download PDF`}
                </button>
                <button
                  type="button"
                  onClick={handleSystemPrint}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold rounded-xl flex items-center gap-1.5 cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5 text-cyan-400" />
                  System Print
                </button>
              </>
            )}
            <button
              type="button"
              onClick={onClose}
              aria-label="Close PDF Studio"
              className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {error ? (
          <div className="p-6 bg-rose-950/80 text-rose-200 flex items-center gap-3">
            <AlertTriangle className="w-6 h-6 text-rose-400 shrink-0" />
            <div className="text-sm">
              <div className="font-bold">PDF Export Warning</div>
              <div>{error}</div>
            </div>
          </div>
        ) : (
          payload && (
            <div className="p-4 space-y-3 overflow-y-auto flex-1">
              <div className="bg-emerald-950/40 border border-emerald-500/40 px-4 py-2.5 rounded-xl flex flex-wrap items-center justify-between gap-2 text-xs text-emerald-200 shadow-sm">
                <div className="flex items-center gap-2 font-semibold">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>
                    Verified &amp; Ready for User: <strong className="text-white">{payload.filename}</strong> ({payload.pageCount} pages,{' '}
                    {(payload.sizeBytes / 1024).toFixed(1)} KB).
                  </span>
                </div>
                <span className="font-telugu-sans font-bold text-emerald-300 flex items-center gap-1">
                  <Sparkles className="w-3.5 h-3.5 text-amber-400" /> వృత్తం, గోపుర ఆర్చ్, పంచభుజి, నక్షత్ర ఆకృతులతో ముద్రణకు సిద్ధం
                </span>
              </div>

              {/* Multi-Agent PDF Inspection & Architectural Rewrite Trace */}
              {agentReport && (
                <div className="bg-slate-950 border border-slate-800 rounded-xl p-3.5 space-y-2.5">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-2">
                    <div className="flex items-center gap-2 text-xs font-bold text-white uppercase tracking-wider">
                      <Bot className="w-4 h-4 text-cyan-400" />
                      <span>
                        Agentic PDF Loop Trace: {agentReport.inspector_model_id} ⇄ {agentReport.architect_model_id}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 font-mono-tabular text-[11px]">
                      <span className="px-2 py-0.5 bg-slate-800 border border-slate-700 text-slate-300 rounded font-semibold">
                        Rounds: {agentReport.total_agent_rounds}
                      </span>
                      <span className="px-2 py-0.5 bg-emerald-900 border border-emerald-700 text-emerald-300 rounded font-bold">
                        Verdict: {agentReport.final_verdict} ({agentReport.final_quality_score}/100)
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                    {agentReport.rounds.map((r) => (
                      <div
                        key={r.round_number}
                        className={`p-3 rounded-xl border text-xs space-y-1.5 ${
                          r.inspection_3_1.approved_to_slide
                            ? 'bg-emerald-950/30 border-emerald-500/40 text-emerald-200'
                            : 'bg-amber-950/30 border-amber-500/40 text-amber-200'
                        }`}
                      >
                        <div className="flex items-center justify-between font-mono-tabular font-bold text-[11px]">
                          <span className="text-white">
                            ROUND {r.round_number} · Plan v{r.plan_version} PDF (
                            {r.pdf_size_bytes >= 1024
                              ? `${(r.pdf_size_bytes / 1024).toFixed(0)} KB`
                              : 'Draft Pass'}
                            )
                          </span>
                          <span
                            className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                              r.inspection_3_1.approved_to_slide
                                ? 'bg-emerald-900 text-emerald-300 border border-emerald-700'
                                : 'bg-amber-900 text-amber-300 border border-amber-700'
                            }`}
                          >
                            3.1: {r.inspection_3_1.verdict}
                          </span>
                        </div>

                        <p className="text-[11px] text-slate-300 leading-snug">
                          <strong>{r.inspection_3_1.inspector_model_id}:</strong>{' '}
                          {r.inspection_3_1.inspector_summary}
                        </p>

                        {r.rewrite_3_5 && (
                          <div className="mt-1.5 pt-1.5 border-t border-slate-800 space-y-1 bg-slate-900/80 p-2 rounded-lg">
                            <div className="flex items-center gap-1 font-mono-tabular font-bold text-[10.5px] text-amber-400">
                              <ArrowRight className="w-3 h-3" />
                              <span>
                                {r.rewrite_3_5.architect_model_id} Rewrite (v
                                {r.rewrite_3_5.from_plan_version} → v{r.rewrite_3_5.to_plan_version})
                              </span>
                            </div>
                            <p className="text-[11px] text-slate-300 leading-snug">
                              {r.rewrite_3_5.agent_reasoning}
                            </p>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Embedded Print Preview Frame */}
              <div className="border border-slate-800 bg-slate-950 rounded-xl p-3 shadow-inner">
                <div className="text-xs font-mono-tabular font-semibold text-slate-400 mb-2 flex items-center justify-between">
                  <span>
                    LIVE PRINT SHEET PREVIEW ({payload.pageCount} PAGES · 330mm × 520mm BROADSHEET)
                  </span>
                  <span className="text-amber-400">
                    Use &ldquo;Download PDF&rdquo; to save file
                  </span>
                </div>
                {payload.printHtml ? (
                  <iframe
                    ref={printIframeRef}
                    title="Print-Ready Telugu Newspaper Preview"
                    srcDoc={payload.printHtml}
                    className="w-full h-[54vh] bg-white rounded-lg border border-slate-800 shadow-md"
                  />
                ) : (
                  <iframe
                    title="PDF Binary Preview"
                    src={payload.blobUrl}
                    className="w-full h-[54vh] bg-white rounded-lg border border-slate-800"
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
