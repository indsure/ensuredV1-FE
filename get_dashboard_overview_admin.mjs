import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars');
const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function getOverview() {
  const { data: agents, error: agentsErr } = await supabaseAdmin.from('agents').select('*');
  if (agentsErr) { console.error("Error fetching agents:", agentsErr); return; }
  
  const { data: clients, error: clientsErr } = await supabaseAdmin.from('clients').select('*');
  if (clientsErr) { console.error("Error fetching clients:", clientsErr); return; }
  
  console.log("=== INDSURE AGENT DASHBOARD OVERVIEW ===\n");
  console.log(`Total Agents: ${agents ? agents.length : 0}`);
  
  if (!agents || agents.length === 0) {
    console.log("No agents found.");
    return;
  }
  
  for (const agent of agents) {
    console.log(`\n--- Agent: ${agent.full_name} (${agent.email}) ---`);
    console.log(`Experience: ${agent.experience_years} years | City: ${agent.city}`);
    
    const agentClients = (clients || []).filter(c => c.agent_id === agent.id);
    console.log(`Tasks (Policies Analyzed) Total: ${agentClients.length}`);
    
    const pending = agentClients.filter(c => c.status === 'pending');
    const processing = agentClients.filter(c => c.status === 'processing');
    const done = agentClients.filter(c => c.status === 'done');
    const errs = agentClients.filter(c => c.status === 'error');
    
    console.log(`Pending: ${pending.length} | Processing: ${processing.length} | Done: ${done.length} | Errors: ${errs.length}`);
    
    const running = [...pending, ...processing];
    if (running.length > 0) {
      console.log('Currently Running Tasks:');
      running.forEach(c => {
         console.log(`  - ${c.policyholder_name || 'Unnamed Client'} (Status: ${c.status})`);
      });
    }
    
    if (errs.length > 0) {
      console.log('Pending Actions / Errors:');
      errs.forEach(c => {
         console.log(`  - ${c.policyholder_name || 'Unnamed Client'}: Error processing policy. ${c.flaws ? '(Has some flaw info)' : ''}`);
      });
    }
    
    if (done.length > 0) {
      console.log('Outputs Produced:');
      done.forEach(c => {
         let flawsCount = 0;
         try {
           if (typeof c.flaws === 'string') {
             const parsed = JSON.parse(c.flaws);
             flawsCount = Array.isArray(parsed) ? parsed.length : 0;
           } else if (Array.isArray(c.flaws)) {
             flawsCount = c.flaws.length;
           }
         } catch(e) {}
         console.log(`  - ${c.policyholder_name || 'Unnamed Client'} (Insurer: ${c.insurer}, Score: ${c.score}, Flaws: ${flawsCount})`);
      });
    }
  }
}

getOverview();
