const { net } = require('electron');
const fetch = require('node-fetch'); // or global fetch if node > 18

async function testFetch() {
    try {
        console.log("Fetching...");
        const url = "https://dorar.net/dorar_api.json?skey=" + encodeURIComponent("توحيد");
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);
        
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            },
            signal: controller.signal
        });
        clearTimeout(timeoutId);
        
        console.log("Status:", response.status);
        const text = await response.text();
        console.log("Length:", text.length);
        console.log("Preview:", text.substring(0, 100));
    } catch (err) {
        console.error("Error:", err);
    }
}

testFetch();
