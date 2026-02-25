#!/usr/bin/env node
/**
 * Incrementa a versao no formato X.XX.XX
 * O ultimo bloco (patch) incrementa a cada build.
 * Ao chegar em 99, zera e incrementa o bloco do meio (minor).
 * Ao chegar em 99.99, zera e incrementa o primeiro bloco (major).
 *
 * Uso: node scripts/bump-build.js
 *
 * Exemplos:
 *   1.00.01 -> 1.00.02
 *   1.00.99 -> 1.01.01
 *   1.99.99 -> 2.00.01
 */
const fs = require('fs');
const path = require('path');

const versionFile = path.join(__dirname, '..', 'version.json');
const data = JSON.parse(fs.readFileSync(versionFile, 'utf-8'));

// Parse current version X.XX.XX
const parts = data.version.split('.');
let major = parseInt(parts[0], 10) || 1;
let minor = parseInt(parts[1], 10) || 0;
let patch = parseInt(parts[2], 10) || 0;

// Increment patch
patch++;

// Cascade: patch > 99 -> bump minor
if (patch > 99) {
  patch = 1;
  minor++;
}

// Cascade: minor > 99 -> bump major
if (minor > 99) {
  minor = 0;
  patch = 1;
  major++;
}

// Format with zero-padding: X.XX.XX
const newVersion = `${major}.${String(minor).padStart(2, '0')}.${String(patch).padStart(2, '0')}`;

data.version = newVersion;
// Salva data e hora completa (dd/mm/yyyy HH:mm no JSON como ISO)
data.releasedAt = new Date().toISOString();

// Remove old 'build' field if it exists
delete data.build;

fs.writeFileSync(versionFile, JSON.stringify(data, null, 2) + '\n');

console.log(`Build ${data.version} - ${data.codename} - ${data.releasedAt}`);
