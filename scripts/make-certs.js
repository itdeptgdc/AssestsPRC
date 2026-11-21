/**
 * Creates certificate FILES for HTTPS on the local network (no system stores are touched):
 *   runtime/certs/ca.crt / ca.cer   → install on phones / PCs to trust AssetQR (optional)
 *   runtime/certs/server.key/.crt   → used by the HTTPS gateway (scripts/gateway.js)
 *   runtime/certs/ca.key            → keep private; only needed to issue a new server certificate
 *
 * The CA is NAME-CONSTRAINED: it can only vouch for this server's IP(s), "localhost" and the
 * computer name — it can never be used to impersonate any other website.
 *
 * Usage:  node scripts/make-certs.js [ip1,ip2,...]
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const forge = require('node-forge');

const { pki, asn1 } = forge;
const OUT = path.join(__dirname, '..', 'runtime', 'certs');
const host = os.hostname();
const ips = (process.argv[2] ? process.argv[2].split(',') : Object.values(os.networkInterfaces()).flat()
  .filter((n) => n && n.family === 'IPv4' && !n.internal && !n.address.startsWith('169.254.')).map((n) => n.address));
const allIps = [...new Set([...ips, '127.0.0.1'])];
const dns = ['localhost', host];

const ipBytes = (ip) => ip.split('.').map((n) => String.fromCharCode(Number(n))).join('');
const serial = () => '01' + forge.util.bytesToHex(forge.random.getBytesSync(15));

// NameConstraints ::= SEQUENCE { permittedSubtrees [0] GeneralSubtrees }
function nameConstraints() {
  const subtree = (tag, value) => asn1.create(asn1.Class.UNIVERSAL, asn1.Type.SEQUENCE, true, [
    asn1.create(asn1.Class.CONTEXT_SPECIFIC, tag, false, value),
  ]);
  const permitted = [
    ...dns.map((d) => subtree(2, d)),                                       // dNSName
    ...allIps.map((ip) => subtree(7, ipBytes(ip) + ipBytes('255.255.255.255'))), // iPAddress + mask
  ];
  return asn1.create(asn1.Class.UNIVERSAL, asn1.Type.SEQUENCE, true, [
    asn1.create(asn1.Class.CONTEXT_SPECIFIC, 0, true, permitted),
  ]);
}

// Names are UTF8String: forge defaults to PrintableString, which cannot contain "&" —
// Chrome then rejects the certificate with ERR_SSL_SERVER_CERT_BAD_FORMAT.
const UTF8 = { valueTagClass: asn1.Type.UTF8 };
const subject = (cn) => [
  { name: 'commonName', value: cn, ...UTF8 },
  { name: 'organizationName', value: 'Poipet Resort & Casino', ...UTF8 },
  { name: 'organizationalUnitName', value: 'IT - AssetQR', ...UTF8 },
  { name: 'countryName', value: 'KH' }, // PrintableString (required for country codes)
];

console.log(`Creating certificates for: ${[...allIps, ...dns].join(', ')}`);

// --- CA (10 years) ---
const caKeys = pki.rsa.generateKeyPair(2048);
const ca = pki.createCertificate();
ca.publicKey = caKeys.publicKey;
ca.serialNumber = serial();
ca.validity.notBefore = new Date(Date.now() - 60 * 1000);
ca.validity.notAfter = new Date(Date.now() + 10 * 365 * 24 * 3600 * 1000);
ca.setSubject(subject('AssetQR Local CA'));
ca.setIssuer(subject('AssetQR Local CA'));
ca.setExtensions([
  { name: 'basicConstraints', cA: true, pathLenConstraint: 0, critical: true },
  { name: 'keyUsage', keyCertSign: true, cRLSign: true, digitalSignature: true, critical: true },
  { name: 'subjectKeyIdentifier' },
  { id: '2.5.29.30', critical: true, value: nameConstraints() },
]);
ca.sign(caKeys.privateKey, forge.md.sha256.create());

// --- server certificate (820 days: accepted by Android, iOS and desktop browsers) ---
const srvKeys = pki.rsa.generateKeyPair(2048);
const srv = pki.createCertificate();
srv.publicKey = srvKeys.publicKey;
srv.serialNumber = serial();
srv.validity.notBefore = new Date(Date.now() - 60 * 1000);
srv.validity.notAfter = new Date(Date.now() + 820 * 24 * 3600 * 1000);
srv.setSubject(subject(ips[0] || 'localhost'));
srv.setIssuer(ca.subject.attributes);
srv.setExtensions([
  { name: 'basicConstraints', cA: false, critical: true },
  { name: 'keyUsage', digitalSignature: true, keyEncipherment: true, critical: true },
  { name: 'extKeyUsage', serverAuth: true },
  { name: 'subjectAltName', altNames: [...dns.map((value) => ({ type: 2, value })), ...allIps.map((ip) => ({ type: 7, ip }))] },
  { name: 'subjectKeyIdentifier' },
  { name: 'authorityKeyIdentifier', keyIdentifier: ca.generateSubjectKeyIdentifier().getBytes() },
]);
srv.sign(caKeys.privateKey, forge.md.sha256.create());

// sanity check: chain verifies
if (!ca.verify(srv)) throw new Error('certificate chain verification failed');

fs.mkdirSync(OUT, { recursive: true });
const caPem = pki.certificateToPem(ca);
fs.writeFileSync(path.join(OUT, 'ca.crt'), caPem);
fs.writeFileSync(path.join(OUT, 'ca.cer'), Buffer.from(asn1.toDer(pki.certificateToAsn1(ca)).getBytes(), 'binary'));
fs.writeFileSync(path.join(OUT, 'ca.key'), pki.privateKeyToPem(caKeys.privateKey), { mode: 0o600 });
fs.writeFileSync(path.join(OUT, 'server.key'), pki.privateKeyToPem(srvKeys.privateKey), { mode: 0o600 });
fs.writeFileSync(path.join(OUT, 'server.crt'), pki.certificateToPem(srv) + caPem); // full chain

const fp = forge.md.sha256.create().update(asn1.toDer(pki.certificateToAsn1(ca)).getBytes()).digest().toHex().toUpperCase().match(/.{2}/g).join(':');
console.log(`Done → ${OUT}`);
console.log(`  server certificate valid until ${srv.validity.notAfter.toISOString().slice(0, 10)}`);
console.log(`  CA SHA-256 fingerprint: ${fp}`);
