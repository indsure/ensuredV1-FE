
import fetch from 'node-fetch';

async function test() {
    console.log('--- STARTING CALCULATOR API TEST ---');
    try {
        const payload = {
            inputs: { exactAge: 35, familyStructure: 'Couple', cityTier: 'Metro' },
            result_data: { baseCover: '25 Lakhs', premiumEstimate: 12000 }
        };
        
        console.log('1. Testing POST /api/calculator/save-report...');
        const res = await fetch('http://localhost:5000/api/calculator/save-report', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        
        if (!res.ok) {
            const errText = await res.text();
            console.error('SAVE FAILED:', res.status, errText);
            return;
        }
        
        const { uuid } = await res.json();
        console.log('SAVE SUCCESS. UUID:', uuid);

        console.log('2. Testing GET /api/calculator/report/' + uuid);
        const getRes = await fetch('http://localhost:5000/api/calculator/report/' + uuid);
        if (!getRes.ok) {
            console.error('GET FAILED:', getRes.status);
            return;
        }
        
        const storedData = await getRes.json();
        console.log('GET SUCCESS. Stored Created At:', storedData.created_at);
        console.log('Stored Inputs:', JSON.stringify(storedData.inputs).substring(0, 50) + '...');
        
        console.log('--- TEST PASSED SUCCESSFULLY ---');
        process.exit(0);
    } catch (e) {
        console.error('--- TEST FAILED ERROR ---');
        console.error(e);
        process.exit(1);
    }
}

test();
