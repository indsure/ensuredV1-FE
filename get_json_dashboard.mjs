import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars');
const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function exportData() {
  const { data: agents } = await supabaseAdmin.from('agents').select('*');
  const { data: clients } = await supabaseAdmin.from('clients').select('*');
  
  const result = {
    total_agents: agents ? agents.length : 0,
    agents: (agents || []).map(a => {
      const agentClients = (clients || []).filter(c => c.agent_id === a.id);
      
      return {
        id: a.id,
        name: a.full_name,
        email: a.email,
        city: a.city,
        experience: a.experience_years,
        tasks_total: agentClients.length,
        status_counts: {
          pending: agentClients.filter(c => c.status === 'pending').length,
          processing: agentClients.filter(c => c.status === 'processing').length,
          done: agentClients.filter(c => c.status === 'done').length,
          error: agentClients.filter(c => c.status === 'error').length
        },
        running_tasks: agentClients
          .filter(c => ['pending', 'processing'].includes(c.status))
          .map(c => ({ name: c.policyholder_name, status: c.status })),
        errors: agentClients
          .filter(c => c.status === 'error')
          .map(c => ({ name: c.policyholder_name, error: c.error_details || 'Generic error' })),
        outputs: agentClients
          .filter(c => c.status === 'done')
          .map(c => {
             let flawsCount = 0;
             try {
                if (typeof c.flaws === 'string') {
                  const p = JSON.parse(c.flaws);
                  flawsCount = Array.isArray(p) ? p.length : 0;
                } else if (Array.isArray(c.flaws)) flawsCount = c.flaws.length;
             } catch(e) {}
             return { name: c.policyholder_name, insurer: c.insurer, score: c.score, flaws: flawsCount };
          })
      };
    })
  };
  
  fs.writeFileSync('dashboard_data.json', JSON.stringify(result, null, 2));
}

exportData();
