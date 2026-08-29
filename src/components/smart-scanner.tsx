'use client';

import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { OcrResult, InvoiceType } from '@/lib/types';
import { toast } from 'sonner';
import { Camera, Upload, X, ScanLine, CheckCircle2, AlertCircle } from 'lucide-react';

interface SmartScannerProps {
  onResult: (result: OcrResult, fileUrl?: string) => void;
  onFileSelected?: (file: File) => void;
}

type ScanState = 'idle' | 'selected' | 'scanning' | 'done' | 'error';

export function SmartScanner({ onResult, onFileSelected }: SmartScannerProps) {
  const [scanState, setScanState] = useState<ScanState>('idle');
  const [preview, setPreview] = useState<string | null>(null);
  const [fileName, setFileName] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File) => {
    if (!file.type.startsWith('image/') && file.type !== 'application/pdf') {
      toast.error('Please upload an image or PDF file');
      return;
    }

    setFileName(file.name);
    if (file.type.startsWith('image/')) {
      const url = URL.createObjectURL(file);
      setPreview(url);
    } else {
      setPreview(null);
    }

    setScanState('selected');
    onFileSelected?.(file);

    // Auto-scan after a short delay for UX
    await new Promise((r) => setTimeout(r, 300));
    await scanFile(file);
  };

  const scanFile = async (file: File) => {
    setScanState('scanning');
    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch('/api/ocr', { method: 'POST', body: formData });
      if (!res.ok) throw new Error('Scan failed');

      const data: OcrResult = await res.json();
      setScanState('done');
      onResult(data);
      toast.success('Invoice scanned successfully!');
    } catch (err) {
      setScanState('error');
      toast.error('Could not read the invoice. Please fill in manually.');
    }
  };

  const reset = () => {
    setScanState('idle');
    setPreview(null);
    setFileName('');
    if (fileRef.current) fileRef.current.value = '';
    if (cameraRef.current) cameraRef.current.value = '';
  };

  return (
    <div className="space-y-3">
      {scanState === 'idle' && (
        <div
          className="border-2 border-dashed border-border/60 rounded-2xl p-6 text-center hover:border-primary/50 hover:bg-accent/20 transition-all cursor-pointer group"
          onClick={() => fileRef.current?.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            const file = e.dataTransfer.files[0];
            if (file) handleFile(file);
          }}
        >
          <input
            ref={fileRef}
            type="file"
            accept="image/*,application/pdf"
            className="hidden"
            onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
          />
          <input
            ref={cameraRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
          />
          <div className="flex flex-col items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
              <Upload className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">Drop invoice here or click to upload</p>
              <p className="text-xs text-muted-foreground mt-1">AI will auto-fill the form · Images, PDFs</p>
            </div>
          </div>
        </div>
      )}

      {/* Camera button (mobile-first) */}
      {scanState === 'idle' && (
        <Button
          type="button"
          variant="outline"
          className="w-full gap-2 h-10"
          onClick={() => cameraRef.current?.click()}
        >
          <Camera className="w-4 h-4" />
          Take a photo
        </Button>
      )}

      {/* Scanning state */}
      {(scanState === 'selected' || scanState === 'scanning') && (
        <div className="rounded-2xl border border-border/60 overflow-hidden">
          {preview && (
            <div className="relative">
              <img src={preview} alt="Invoice preview" className="w-full h-36 object-cover" />
              {scanState === 'scanning' && (
                <div className="absolute inset-0 bg-background/80 backdrop-blur-sm flex flex-col items-center justify-center gap-2">
                  <div className="scan-pulse w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                    <ScanLine className="w-5 h-5 text-primary animate-pulse" />
                  </div>
                  <span className="text-xs font-medium text-foreground">Analyzing with AI…</span>
                </div>
              )}
            </div>
          )}
          {!preview && scanState === 'scanning' && (
            <div className="p-4 flex items-center gap-3">
              <div className="scan-pulse w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                <ScanLine className="w-4 h-4 text-primary animate-pulse" />
              </div>
              <div className="flex-1 space-y-2">
                <Skeleton className="h-3 w-3/4 shimmer" />
                <Skeleton className="h-3 w-1/2 shimmer" />
              </div>
            </div>
          )}
          <div className="p-3 flex items-center justify-between bg-muted/40">
            <span className="text-xs text-muted-foreground truncate max-w-[200px]">{fileName}</span>
            <Button type="button" variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={reset}>
              <X className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
      )}

      {scanState === 'done' && (
        <div className="flex items-center gap-3 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
          <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />
          <span className="text-sm text-emerald-600 dark:text-emerald-400 flex-1">Invoice scanned — fields auto-filled</span>
          <Button type="button" variant="ghost" size="sm" className="h-7 text-xs text-muted-foreground" onClick={reset}>
            Rescan
          </Button>
        </div>
      )}

      {scanState === 'error' && (
        <div className="flex items-center gap-3 p-3 rounded-xl bg-destructive/10 border border-destructive/20">
          <AlertCircle className="w-4 h-4 text-destructive flex-shrink-0" />
          <span className="text-sm text-destructive flex-1">Scan failed — fill in manually</span>
          <Button type="button" variant="ghost" size="sm" className="h-7 text-xs text-muted-foreground" onClick={reset}>
            Retry
          </Button>
        </div>
      )}
    </div>
  );
}
