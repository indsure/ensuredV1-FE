import { useState } from 'react';
import { InsurerSelector } from './InsurerSelector';
import { usePolicySession } from '../hooks/usePolicySession';

const STATUS_MESSAGES: Record<string, string> = {
  IDLE: '',
  NAVIGATING: '🌐 Opening insurer portal...',
  AWAITING_LOGIN: '🔐 Please log in on the insurer window that just opened...',
  LOGIN_SUCCESS: '✅ Login detected! Navigating to your policy...',
  TRIGGERING_DOWNLOAD: '📄 Downloading your policy PDF...',
  DOWNLOAD_COMPLETE: '🎉 Policy downloaded! You can now upload it below.',
  LOGIN_TIMEOUT: '⏱ Login timed out. Please try again.',
  ERROR: '❌ Something went wrong. Please try again.',
};

export function FindMyPolicy({ onFileReady }: { onFileReady: (file: File) => void }) {
  const [step, setStep] = useState<'select' | 'session'>('select');
  const { status, filename, startSession, downloadFile } = usePolicySession();

  const handleInsurerSelect = async (key: string) => {
    setStep('session');
    await startSession(key);
  };

  return (
    <div className="max-w-md mx-auto bg-white rounded-2xl shadow-lg overflow-hidden">
      <div className="p-5 border-b">
        <h2 className="text-lg font-semibold">Find My Policy</h2>
        <p className="text-sm text-gray-500 mt-1">
          Select your health insurer to fetch your policy document
        </p>
      </div>

      {step === 'select' && <InsurerSelector onSelect={handleInsurerSelect} />}

      {step === 'session' && (
        <div className="p-6 flex flex-col items-center gap-4 text-center">
          {status === 'AWAITING_LOGIN' && (
            <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
          )}
          <p className="text-sm font-medium text-gray-700">
            {STATUS_MESSAGES[status]}
          </p>

          {status === 'DOWNLOAD_COMPLETE' && (
            <>
              <button
                onClick={downloadFile}
                className="w-full bg-blue-600 text-white rounded-xl py-3 font-semibold hover:bg-blue-700 transition"
              >
                ⬇️ Save {filename ?? 'Policy PDF'}
              </button>
              <p className="text-xs text-gray-400">
                After saving, upload it below to analyze your coverage
              </p>
            </>
          )}

          {(status === 'ERROR' || status === 'LOGIN_TIMEOUT') && (
            <button
              onClick={() => setStep('select')}
              className="text-sm text-blue-500 underline"
            >
              Try again
            </button>
          )}
        </div>
      )}
    </div>
  );
}

