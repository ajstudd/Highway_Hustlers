// Mechanical migration of the checked-in hero catalogue; no invented members.
import { readFile } from 'node:fs/promises';
import ts from 'typescript';
const source = await readFile(new URL('../src/data/site.ts', import.meta.url), 'utf8');
const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022 } }).outputText;
const { RIDERS, frameSrc } = await import(`data:text/javascript;base64,${Buffer.from(js).toString('base64')}`);
const members = [...new Map(RIDERS.map(r => [r.name, { id: r.name.toLowerCase().replace(/[^a-z0-9]+/g, '-'), name: r.name, active: true, role: r.role || '', line: r.line || '' }])).values()];
const garage = { members, bikes: RIDERS.map(r => ({ id: r.id, brand: r.brand, model: r.model, cc: r.cc, character: r.character, colorName: r.colorName, glow: r.glow, dir: r.dir, facing: r.facing, status: 'published', frames: Array.from({ length: r.frames }, (_, i) => ({ source: 'local', path: frameSrc(r.id, i), width: 1200, height: 720 })) })), lineup: RIDERS.map(r => ({ id: r.id, memberId: members.find(m => m.name === r.name).id, bikeId: r.id, visible: true })) };
// Print an apply_patch payload, keeping this migration reviewable like any edit.
process.stdout.write('*** Begin Patch\n*** Add File: src/data/garage-seed.json\n' + JSON.stringify(garage, null, 2).split('\n').map(l => '+' + l).join('\n') + '\n*** End Patch\n');
