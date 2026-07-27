import fs from 'fs';
import path from 'path';

const AGENT_ID = '2b0da6f7-8f87-4fa2-a9dd-c5e10ccbcff5';
const API_BASE = 'http://localhost:5000/api/agent';
const TEST_DIR = path.join(process.cwd(), '../test_policies');

import http from 'http';

async function wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function runTest() {
    // Start local server for PDFs
    const server = http.createServer((req, res) => {
        const filePath = path.join(TEST_DIR, req.url.split('?')[0]);
        if (fs.existsSync(filePath)) {
            res.writeHead(200, { 'Content-Type': 'application/pdf' });
            fs.createReadStream(filePath).pipe(res);
        } else {
            res.writeHead(404);
            res.end();
        }
    }).listen(8080);
    
    try {
        console.log("1. Starting E2E test for Agent Pipeline using local PDF server...");
        const files = fs.readdirSync(TEST_DIR).filter(f => f.endsWith('.pdf'));
        console.log(`Found ${files.length} test PDFs`);

        // Create Batch
        const batchRes = await fetch(`${API_BASE}/create-batch`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ agent_id: AGENT_ID, total_count: files.length })
        });
        const batch = await batchRes.json();
        console.log("2. Batch created: ", batch.id);

        for (const filename of files) {
            const pdfUrl = `http://localhost:8080/${filename}`;
            console.log(`   Adding client with pdf_url: ${pdfUrl}`);

            const clientRes = await fetch(`${API_BASE}/add-client`, {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({
                    agent_id: AGENT_ID,
                    batch_id: batch.id,
                    policy_name: filename,
                    pdf_url: pdfUrl
                })
            });
            const client = await clientRes.json();
            console.log(`   Client row created: ${client.id}`);
        }

        console.log("3. Triggering batch processing...");
        await fetch(`${API_BASE}/trigger-batch-process`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ batchId: batch.id })
        });

        console.log("4. Polling DB for completion (checking every 5 seconds for max 90s)...");
        let allDone = false;
        
        // Connect to PG directly to poll status
        import('pg').then(async pkg => {
            const pool = new pkg.default.Pool({
                host: 'aws-1-ap-south-1.pooler.supabase.com', port: 6543,
                database: 'postgres', user: 'postgres.khxbabotbvnyjwvqtumt',
                password: 'zQqau#PVNTZG,m6', ssl: { rejectUnauthorized: false }
            });
            
            for (let i=0; i<18; i++) {
                await wait(5000);
                const res = await pool.query("SELECT id, status, score, report_data, error_message FROM clients WHERE batch_id = $1", [batch.id]);
                console.log(`\nPoll ${i+1}:`);
                res.rows.forEach(r => {
                    console.log(` - Client ${r.id} | Status: ${r.status} | Score: ${r.score} | Error: ${r.error_message}`);
                });

                if (res.rows.every(r => r.status === 'done' || r.status === 'error')) {
                    allDone = true;
                    console.log("\nBatch complete! Checking outputs...");
                    const doneRows = res.rows.filter(r => r.status === 'done');
                    console.log(`Successfully processed: ${doneRows.length}/${files.length}`);
                    if (doneRows.length > 0) {
                        console.log("\nSample JSON Report Data:");
                        console.log(JSON.stringify(doneRows[0].report_data, null, 2).substring(0, 500) + "...\n");
                    }
                    break;
                }
            }
            if (!allDone) console.log("Timed out waiting for batch.");
            await pool.end();
            process.exit(allDone ? 0 : 1);
        });

    } catch(err) {
        console.error("E2E Simulation failed:", err);
        process.exit(1);
    }
}
runTest();
