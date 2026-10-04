const readline = require('node:readline');
const mode = process.argv[2] || 'normal';
const input = readline.createInterface({ input: process.stdin });
input.on('line', line => {
  const request = JSON.parse(line);
  if (mode === 'crash') process.exit(7);
  if (mode === 'timeout') return;
  if (mode === 'invalid') { process.stdout.write('khong-phai-json\n'); return; }
  process.stderr.write(`mock log ${request.requestId}\n`);
  process.stdout.write(JSON.stringify({ requestId: request.requestId, success: true, data: request.operation === 'ping' ? { status: 'ok', protocolVersion: 1 } : { operation: request.operation }, error: null }) + '\n');
});
