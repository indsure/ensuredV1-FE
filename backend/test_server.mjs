import http from 'http';
import fs from 'fs';
import path from 'path';

const PORT = 8080;
const DIR = path.join(process.cwd(), '../test_policies');

http.createServer((req, res) => {
    const filePath = path.join(DIR, req.url.split('?')[0]);
    if (fs.existsSync(filePath)) {
        res.writeHead(200, { 'Content-Type': 'application/pdf' });
        fs.createReadStream(filePath).pipe(res);
    } else {
        res.writeHead(404);
        res.end();
    }
}).listen(PORT, () => console.log(`Static server running on port ${PORT}`));
