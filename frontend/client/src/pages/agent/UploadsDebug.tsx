// Temporary debug component to diagnose upload logout issue
import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAgent } from '@/context/AgentContext';

export default function UploadsDebug() {
  const { agent } = useAgent();
  const [logs, setLogs] = useState<string[]>([]);

  const addLog = (msg: string) => {
    console.log(msg);
    setLogs(prev => [...prev, `${new Date().toISOString()}: ${msg}`]);
  };

  const testUploadFlow = async () => {
    setLogs([]);
    addLog('Starting upload flow test...');

    try {
      // Test 1: Check session
      addLog('Test 1: Checking session...');
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError) {
        addLog(`❌ Session error: ${sessionError.message}`);
        return;
      }
      if (!session) {
        addLog('❌ No session found');
        return;
      }
      addLog(`✅ Session valid, user: ${session.user.email}`);

      // Test 2: Check agent context
      addLog('Test 2: Checking agent context...');
      if (!agent?.agentId) {
        addLog('❌ No agent ID in context');
        return;
      }
      addLog(`✅ Agent ID: ${agent.agentId}`);

      // Test 3: Try to insert into policies table
      addLog('Test 3: Testing policies table insert...');
      const testPolicyId = crypto.randomUUID();
      const policyRes = await supabase.from('policies').insert({
        id: testPolicyId,
        client_name: 'Test Policy',
        insurer_name: 'Test Insurer',
        product_name: 'Test Product',
        policy_number: `TEST-${Date.now()}`,
        status: 'processing',
        created_by_agent_id: agent.agentId,
        assigned_agent_id: agent.agentId,
      });

      if (policyRes.error) {
        addLog(`❌ Policies insert error: ${policyRes.error.message}`);
        addLog(`   Code: ${policyRes.error.code}`);
        addLog(`   Details: ${JSON.stringify(policyRes.error.details)}`);
        addLog(`   Hint: ${policyRes.error.hint}`);
      } else {
        addLog('✅ Policies insert successful');
        // Clean up test policy
        await supabase.from('policies').delete().eq('id', testPolicyId);
      }

      // Test 4: Check session after insert
      addLog('Test 4: Checking session after insert...');
      const { data: { session: session2 }, error: sessionError2 } = await supabase.auth.getSession();
      if (sessionError2 || !session2) {
        addLog('❌ Session lost after insert!');
      } else {
        addLog('✅ Session still valid after insert');
      }

      // Test 5: Try storage bucket access
      addLog('Test 5: Testing storage bucket access...');
      const testBlob = new Blob(['test'], { type: 'application/pdf' });
      const testFile = new File([testBlob], 'test.pdf', { type: 'application/pdf' });
      const testPath = `${agent.agentId}/${crypto.randomUUID()}/test.pdf`;
      
      const storageRes = await supabase.storage.from('policy-pdfs').upload(testPath, testFile);
      if (storageRes.error) {
        addLog(`❌ Storage upload error: ${storageRes.error.message}`);
      } else {
        addLog('✅ Storage upload successful');
        // Clean up test file
        await supabase.storage.from('policy-pdfs').remove([testPath]);
      }

      // Test 6: Final session check
      addLog('Test 6: Final session check...');
      const { data: { session: session3 }, error: sessionError3 } = await supabase.auth.getSession();
      if (sessionError3 || !session3) {
        addLog('❌ Session lost after storage upload!');
      } else {
        addLog('✅ Session still valid after all operations');
      }

    } catch (error: any) {
      addLog(`❌ Unexpected error: ${error.message}`);
      addLog(`   Stack: ${error.stack}`);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-8">
      <h1 className="text-2xl font-bold mb-4">Upload Flow Debug</h1>
      <button
        onClick={testUploadFlow}
        className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
      >
        Run Upload Flow Test
      </button>

      <div className="mt-6 bg-gray-900 text-green-400 p-4 rounded font-mono text-sm max-h-96 overflow-y-auto">
        {logs.length === 0 ? (
          <div className="text-gray-500">Click button to run tests...</div>
        ) : (
          logs.map((log, i) => (
            <div key={i} className="mb-1">{log}</div>
          ))
        )}
      </div>
    </div>
  );
}
