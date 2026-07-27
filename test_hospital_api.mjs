import fetch from 'node-fetch';

async function test() {
  try {
    console.log('Testing hospital API on port 5412...\n');
    
    const url = 'http://localhost:5412/api/hospitals/filter?state=Maharashtra&city=Mumbai';
    console.log('URL:', url);
    
    const response = await fetch(url);
    console.log('Status:', response.status);
    console.log('Status Text:', response.statusText);
    
    const text = await response.text();
    console.log('\nResponse:');
    console.log(text.substring(0, 500));
    
    if (response.status === 500) {
      console.log('\n❌ Server returned 500 error');
      try {
        const json = JSON.parse(text);
        console.log('Error details:', json);
      } catch (e) {
        console.log('Could not parse error as JSON');
      }
    }
  } catch (error) {
    console.error('Error:', error.message);
  }
}

test();
