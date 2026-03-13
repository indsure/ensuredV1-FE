import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, UploadCloud, FileText, Trash2, Mail, AlertTriangle, Loader2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { v4 as uuidv4 } from 'uuid';

interface UploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  agentId: string;
}

export default function UploadModal({ isOpen, onClose, agentId }: UploadModalProps) {
  const [files, setFiles] = useState<File[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newFiles = Array.from(e.target.files).filter(f => f.type === 'application/pdf');
      setFiles(prev => [...prev, ...newFiles]);
    }
  };

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleUpload = async () => {
    if (files.length === 0 || !agentId) return;
    setIsUploading(true);
    setError(null);

    try {
      // 1. Create Batch Upload Row via backend (bypasses RLS + schema cache)
      const batchRes = await fetch('/api/agent/create-batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agent_id: agentId, total_count: files.length }),
      });

      if (!batchRes.ok) {
        const batchErr = await batchRes.json();
        throw new Error(batchErr.error || 'Failed to create batch upload record');
      }

      const batch = await batchRes.json();

      // 2. Upload Files and Create Client Rows
      const uploadPromises = files.map(async (file) => {
        const fileId = uuidv4();
        const filePath = `${agentId}/${fileId}.pdf`;

        // Upload to Storage
        const { error: storageError } = await supabase.storage
          .from('policy-pdfs')
          .upload(filePath, file);

        if (storageError) throw storageError;

        // Generate a 24-hour signed URL securely from the authenticated frontend
        const { data: signedData, error: signError } = await supabase.storage
          .from('policy-pdfs')
          .createSignedUrl(filePath, 60 * 60 * 24);

        if (signError) throw signError;

        // Create Client Row via backend (bypasses RLS on clients table)
        const clientRes = await fetch('/api/agent/add-client', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            agent_id: agentId,
            batch_id: batch.id,
            policy_name: file.name,
            pdf_url: signedData.signedUrl,
          }),
        });

        if (!clientRes.ok) {
          const clientErr = await clientRes.json();
          throw new Error(clientErr.error || 'Failed to create client record');
        }

      });

      await Promise.all(uploadPromises);

      // 3. Trigger Async Processing (Backend should ideally handle this via Function or Hook, 
      // but we'll simulate the trigger here or rely on a backend worker)
      // For now, we follow the requirement: "A background async function then processes each PDF one by one"
      // We trigger the backend process
      fetch('/api/agent/trigger-batch-process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ batchId: batch.id })
      }).catch(err => console.error('Failed to trigger background processing:', err));

      onClose();
      // Reset state
      setFiles([]);
    } catch (err: any) {
      console.error('Upload Error:', err);
      setError(err.message || 'Failed to upload policies. Please try again.');
    } finally {
      setIsUploading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
          onClick={onClose}
        />

        {/* Modal Container */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="relative w-full max-w-2xl bg-white/80 backdrop-blur-md rounded-3xl border border-[#E2E8F0] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        >
          {/* Header */}
          <div className="px-8 py-6 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h2 className="font-['Playfair_Display'] text-2xl font-bold text-[#0F172A]">Analyze Policies</h2>
              <p className="text-slate-500 text-sm mt-1">Upload PDF policies for automated bulk analysis.</p>
            </div>
            <button 
              onClick={onClose}
              className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
            >
              <X size={20} />
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto px-8 py-8 space-y-6">
            {/* Dropzone */}
            <div 
              onClick={() => fileInputRef.current?.click()}
              className="border-dashed border-2 border-[#0D9488]/30 hover:border-[#0D9488] bg-[#0D9488]/5 rounded-2xl p-10 flex flex-col items-center justify-center cursor-pointer transition-colors group"
            >
              <div className="w-16 h-16 bg-[#0D9488]/10 text-[#0D9488] rounded-full flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <UploadCloud size={32} />
              </div>
              <p className="font-semibold text-[#0F172A]">Drop up to 10 PDF policies here</p>
              <p className="text-slate-500 text-sm mt-1 mb-4">or click to browse from your computer</p>
              <button className="px-6 py-2 bg-white border border-slate-200 rounded-lg text-sm font-semibold text-slate-700 hover:bg-slate-50 shadow-sm transition-colors">
                Browse Files
              </button>
              <input 
                type="file" 
                multiple 
                accept=".pdf" 
                className="hidden" 
                ref={fileInputRef}
                onChange={handleFileChange}
              />
            </div>

            {/* Warning for > 10 files */}
            {files.length > 10 && (
              <div className="bg-[#B45309]/5 border border-[#B45309]/20 rounded-xl p-4 flex gap-3 text-[#B45309]">
                <AlertTriangle className="shrink-0" size={20} />
                <div className="text-sm">
                  <p className="font-bold">Need to analyze more than 10 at once?</p>
                  <p className="mt-1">
                    Large volume batches are available for premium accounts.{' '}
                    <a href="mailto:support@indsure.com" className="underline font-semibold">Reach out to us</a>
                  </p>
                </div>
              </div>
            )}

            {/* File List */}
            {files.length > 0 && (
              <div className="space-y-3">
                <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider px-1">Selected Files ({files.length})</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {files.map((file, idx) => (
                    <motion.div 
                      key={`${file.name}-${idx}`}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      className="bg-white border border-slate-100 rounded-xl p-3 flex items-center gap-3 shadow-sm group"
                    >
                      <div className="w-10 h-10 bg-slate-50 text-[#0D9488] rounded-lg flex items-center justify-center shrink-0">
                        <FileText size={20} />
                      </div>
                      <div className="flex-1 min-w-0 pr-2">
                        <p className="text-sm font-medium text-[#0F172A] truncate">{file.name}</p>
                        <p className="text-[10px] text-slate-400 uppercase font-bold">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                      </div>
                      <button 
                        onClick={() => removeFile(idx)}
                        className="w-8 h-8 flex items-center justify-center text-slate-300 hover:text-red-500 transition-colors"
                      >
                        <Trash2 size={16} />
                      </button>
                    </motion.div>
                  ))}
                </div>
              </div>
            )}
            
            {error && (
              <p className="text-red-500 text-sm text-center font-medium bg-red-50 py-2 rounded-lg">{error}</p>
            )}
          </div>

          {/* Footer */}
          <div className="px-8 py-6 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
            <p className="text-xs text-slate-400">Supported format: PDF only. Max 50MB per file.</p>
            <div className="flex gap-3">
              <button 
                onClick={onClose}
                className="px-6 py-2.5 text-sm font-semibold text-slate-600 hover:text-slate-800 transition-colors"
              >
                Cancel
              </button>
              <button 
                disabled={files.length === 0 || files.length > 10 || isUploading}
                onClick={handleUpload}
                className="px-8 py-2.5 bg-[#0D9488] hover:bg-[#0f766e] disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-xl shadow-md shadow-[#0D9488]/20 transition-all hover:-translate-y-0.5 flex items-center gap-2"
              >
                {isUploading ? (
                  <>
                    <Loader2 size={18} className="animate-spin" />
                    Uploading...
                  </>
                ) : (
                  <>Analyze {files.length > 0 ? `(${files.length})` : ''} Policies</>
                )}
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
