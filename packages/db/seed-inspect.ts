import { createClient } from '@libsql/client';
const db = createClient({ url: 'file:/home/user/work/wingmic/apps/app/local.db' });
const q = async (sql, args = []) => (await db.execute({ sql, args })).rows;
console.log('users:', (await q('SELECT id, email FROM user')).map(r => r.email).join(' | '));
console.log('entity owners:', (await q('SELECT DISTINCT owner_user_id, kind, name FROM entity')).map(r => r.kind + ':' + r.name).join(', '));
console.log('acts:', (await q('SELECT kind, status FROM act')).map(r => r.kind + '/' + r.status).join(', '));
