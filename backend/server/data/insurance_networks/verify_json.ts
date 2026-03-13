import { filterHospitalNetwork } from './filter_engine.ts';

async function verify() {
    console.log('--- Verifying JSON structure for Mumbai ---');
    const res = filterHospitalNetwork({ city: 'Mumbai' });
    
    console.log('Keys in result:', Object.keys(res));
    console.log('CityLevel length:', res.cityLevel.length);
    if (res.cityLevel.length > 0) {
        console.log('Sample city:', JSON.stringify(res.cityLevel[0], null, 2));
    }
    console.log('PincodeLevel length:', res.pincodeLevel.length);
    if (res.pincodeLevel.length > 0) {
        console.log('Sample pincode:', JSON.stringify(res.pincodeLevel[0], null, 2));
    }
}

verify().catch(console.error);
