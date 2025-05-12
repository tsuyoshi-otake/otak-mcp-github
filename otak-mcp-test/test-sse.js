import fetch from 'node-fetch';

const url = 'http://127.0.0.1:8787/sse';

try {
    const response = await fetch(url);
    const text = await response.text();
    console.log('Received:', text);

    // 受信したデータを解析
    const lines = text.split('\n\n');
    for (const line of lines) {
        if (line.startsWith('data: ')) {
            const data = JSON.parse(line.slice(6));
            console.log('Parsed data:', JSON.stringify(data, null, 2));
        }
    }
} catch (error) {
    console.error('Error:', error);
}