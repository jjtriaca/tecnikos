const https = require('https');

function request(method, url, data, headers) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const opts = { hostname: u.hostname, path: u.pathname + (u.search || ''), method, headers: { 'Content-Type': 'application/json', ...headers } };
    const req = https.request(opts, (res) => {
      let body = '';
      res.on('data', c => body += c);
      res.on('end', () => resolve({ status: res.statusCode, body }));
    });
    req.on('error', reject);
    if (data) req.write(JSON.stringify(data));
    req.end();
  });
}

async function main() {
  const loginRes = await request('POST', 'https://tecnikos.com.br/api/auth/login', {
    email: 'jjtriaca@gmail.com',
    password: 'Tecnikos2026!'
  }, {});
  console.log('Login status:', loginRes.status);
  const parsed = JSON.parse(loginRes.body);
  if (!parsed.access_token) { console.log('Login failed:', loginRes.body); return; }
  const token = parsed.access_token;
  console.log('Token OK');

  const rates = [
    {brand:'Visa',type:'CREDITO',installmentFrom:1,installmentTo:1,feePercent:2.29,receivingDays:30},
    {brand:'Visa',type:'CREDITO',installmentFrom:2,installmentTo:4,feePercent:2.77,receivingDays:30},
    {brand:'Visa',type:'DEBITO',installmentFrom:1,installmentTo:1,feePercent:1.55,receivingDays:1},
    {brand:'Mastercard',type:'CREDITO',installmentFrom:1,installmentTo:1,feePercent:2.29,receivingDays:30},
    {brand:'Mastercard',type:'CREDITO',installmentFrom:2,installmentTo:6,feePercent:2.77,receivingDays:30},
    {brand:'Mastercard',type:'DEBITO',installmentFrom:1,installmentTo:1,feePercent:1.55,receivingDays:1},
    {brand:'Elo',type:'CREDITO',installmentFrom:1,installmentTo:1,feePercent:2.80,receivingDays:30},
    {brand:'Elo',type:'CREDITO',installmentFrom:2,installmentTo:4,feePercent:3.30,receivingDays:30},
    {brand:'Elo',type:'CREDITO',installmentFrom:10,installmentTo:10,feePercent:3.54,receivingDays:30},
    {brand:'Elo',type:'DEBITO',installmentFrom:1,installmentTo:1,feePercent:2.05,receivingDays:1},
    {brand:'Hipercard',type:'CREDITO',installmentFrom:1,installmentTo:3,feePercent:3.17,receivingDays:30},
    {brand:'Hipercard',type:'DEBITO',installmentFrom:1,installmentTo:1,feePercent:3.49,receivingDays:1},
    {brand:'American Express',type:'CREDITO',installmentFrom:1,installmentTo:1,feePercent:3.49,receivingDays:30},
    {brand:'American Express',type:'CREDITO',installmentFrom:2,installmentTo:3,feePercent:3.92,receivingDays:30},
  ];

  let ok = 0, fail = 0;
  for (const r of rates) {
    const res = await request('POST', 'https://tecnikos.com.br/api/finance/card-fee-rates', r, {
      Authorization: 'Bearer ' + token
    });
    if (res.status === 201 || res.status === 200) {
      console.log('OK:', r.brand, r.type, r.installmentFrom + '-' + r.installmentTo + 'x', '=', r.feePercent + '%', r.receivingDays + 'd');
      ok++;
    } else {
      console.log('FAIL:', r.brand, r.type, r.installmentFrom + '-' + r.installmentTo + 'x', '->', res.status, res.body.substring(0,150));
      fail++;
    }
  }
  console.log('\nTotal:', ok, 'criadas,', fail, 'erros');
}

main().catch(console.error);
