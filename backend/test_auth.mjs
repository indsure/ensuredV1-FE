import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const API_BASE = 'http://localhost:5000';

async function testC1() {
  console.log('\n=== C1: Unauthenticated agent upload blocked ===');
  
  try {
    const FormData = (await import('form-data')).default;
    const fetch = (await import('node-fetch')).default;
    
    const form = new FormData();
    const pdfPath = path.join(__dirname, '..', 'test_policies', 'Star_Health_Real_Policy.pdf');
    form.append('file', fs.createReadStream(pdfPath));
    
    const response = await fetch(`${API_BASE}/api/agent/analyze`, {
      method: 'POST',
      body: form,
      headers: form.getHeaders()
    });
    
    console.log(`Status: ${response.status}`);
    const contentType = response.headers.get('content-type');
    console.log(`Content-Type: ${contentType}`);
    
    let data;
    if (contentType && contentType.includes('application/json')) {
      data = await response.json();
      console.log('Response:', JSON.stringify(data, null, 2));
    } else {
      const text = await response.text();
      console.log('Response (first 200 chars):', text.substring(0, 200));
    }
    
    if (response.status === 401) {
      console.log('✅ PASS - Correctly rejected with 401');
      return true;
    } else {
      console.log('❌ FAIL - Expected 401, got', response.status);
      return false;
    }
  } catch (error) {
    console.error('Error:', error.message);
    return false;
  }
}

async function testC2() {
  console.log('\n=== C2: Invalid token rejected ===');
  
  try {
    const FormData = (await import('form-data')).default;
    const fetch = (await import('node-fetch')).default;
    
    const form = new FormData();
    const pdfPath = path.join(__dirname, '..', 'test_policies', 'Star_Health_Real_Policy.pdf');
    form.append('file', fs.createReadStream(pdfPath));
    
    const response = await fetch(`${API_BASE}/api/agent/analyze`, {
      method: 'POST',
      body: form,
      headers: {
        ...form.getHeaders(),
        'Authorization': 'Bearer invalid_token_xyz'
      }
    });
    
    console.log(`Status: ${response.status}`);
    const data = await response.json();
    console.log('Response:', JSON.stringify(data, null, 2));
    
    if (response.status === 401) {
      console.log('✅ PASS - Correctly rejected with 401');
      return true;
    } else {
      console.log('❌ FAIL - Expected 401, got', response.status);
      return false;
    }
  } catch (error) {
    console.error('Error:', error.message);
    return false;
  }
}

async function runTests() {
  const results = [];
  results.push(await testC1());
  results.push(await testC2());
  
  console.log('\n=== Summary ===');
  console.log(`Passed: ${results.filter(r => r).length}/${results.length}`);
}

runTests();
