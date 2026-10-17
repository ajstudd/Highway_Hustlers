import { emitKeypressEvents } from 'node:readline';
import { hashPassword } from '../server/security.mjs';
if (!process.stdin.isTTY) { console.error('Run this in an interactive terminal. Passwords are never accepted as command arguments.'); process.exit(1); }
emitKeypressEvents(process.stdin);
async function ask(label) {
  process.stdout.write(label); process.stdin.setRawMode(true); process.stdin.resume();
  return new Promise(resolve => {
    let password = '';
    const keypress = (text, key) => {
      if (key?.ctrl && key.name === 'c') { process.stdin.setRawMode(false); process.stdout.write('\n'); process.exit(1); }
      if (key?.name === 'return') { process.stdin.removeListener('keypress', keypress); process.stdin.setRawMode(false); process.stdin.pause(); process.stdout.write('\n'); resolve(password); }
      else if (key?.name === 'backspace') { if(password.length){ password = password.slice(0,-1); process.stdout.write('\b \b'); } }
      else if (text && !key?.ctrl && !key?.meta && !/[\x00-\x1f\x7f]/.test(text) && password.length < 1024) { password += text; process.stdout.write('*'.repeat(text.length)); }
    };
    process.stdin.on('keypress', keypress);
  });
}
try {
  const password = await ask('New admin password (14+ characters): ');
  if (await ask('Confirm password: ') !== password) throw new Error('Passwords did not match.');
  console.log('\nSet ADMIN_PASSWORD_HASH in Vercel to this entire value (without quotes):\n');
  console.log(await hashPassword(password));
  console.log('\nKeep this hash private. Do not use a VITE_ prefix. Redeploy after setting it.');
} catch (error) { console.error(error.message); process.exitCode = 1; }
