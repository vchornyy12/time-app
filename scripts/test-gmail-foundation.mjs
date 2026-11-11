// Permission/lifecycle test with a Vault stub; does not test encryption.
import { readFile } from 'node:fs/promises'
import assert from 'node:assert/strict'
const { PGlite } = await import(process.argv[2] ?? '@electric-sql/pglite')
const db = new PGlite()
const alice = '11111111-1111-4111-8111-111111111111'
const bob = '22222222-2222-4222-8222-222222222222'
try {
  await db.exec(`
    CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;
    CREATE SCHEMA auth; CREATE TABLE auth.users(id uuid PRIMARY KEY);
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
      SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    GRANT USAGE ON SCHEMA public,auth TO anon,authenticated,service_role;
    CREATE SCHEMA vault;
    CREATE TABLE vault.secrets(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),secret text);
    CREATE VIEW vault.decrypted_secrets AS SELECT id,secret AS decrypted_secret FROM vault.secrets;
    CREATE FUNCTION vault.create_secret(value text) RETURNS uuid LANGUAGE plpgsql AS $$
      DECLARE new_id uuid; BEGIN INSERT INTO vault.secrets(secret) VALUES(value) RETURNING id INTO new_id;
      RETURN new_id; END $$;
    CREATE FUNCTION vault.update_secret(secret_id uuid,value text) RETURNS void LANGUAGE sql AS $$
      UPDATE vault.secrets SET secret=value WHERE id=secret_id $$;
    INSERT INTO auth.users VALUES('${alice}'),('${bob}');
  `)
  await db.exec(await readFile('supabase/migrations/20261106000000_gmail_inbox_foundation.sql', 'utf8'))
  await db.exec(`SET ROLE service_role;
    SELECT public.set_gmail_integration_secret('${alice}','ALICE@example.test','synthetic-a');
    SELECT public.set_gmail_integration_secret('${bob}','bob@example.test','synthetic-b');
    RESET ROLE;`)
  const initial = (await db.query(`SELECT * FROM gmail_integrations WHERE user_id='${alice}'`)).rows[0]
  assert.equal(initial.account_email, 'alice@example.test')
  assert.equal(initial.label_name, 'AI Inbox')
  assert.equal(initial.connected, true)
  for (const role of ['anon', 'authenticated']) {
    await db.exec(`SET ROLE ${role}; SET request.jwt.claim.sub='${alice}';`)
    await assert.rejects(db.query('SELECT token_secret_id FROM gmail_integrations'), /permission denied/)
    await assert.rejects(db.query(`SELECT public.get_gmail_integration_secret('${alice}')`), /permission denied/)
    await assert.rejects(db.query(`SELECT public.set_gmail_integration_secret('${alice}','hijack@test','bad')`), /permission denied/)
    await assert.rejects(db.query(`SELECT public.clear_gmail_integration_secret('${alice}')`), /permission denied/)
    await assert.rejects(db.exec(`INSERT INTO gmail_processed_messages(user_id,account_email,message_id) VALUES('${alice}','alice@example.test','forged')`), /permission denied/)
    if (role === 'anon') await assert.rejects(db.query('SELECT connected FROM gmail_integrations'), /permission denied/)
    else {
      assert.equal((await db.query('SELECT account_email FROM gmail_integrations')).rows.length, 1)
      await assert.rejects(db.exec('UPDATE gmail_integrations SET connected=false'), /permission denied/)
      await assert.rejects(db.exec('UPDATE gmail_integrations SET start_at=now()'), /permission denied/)
      await db.exec("UPDATE gmail_integrations SET label_name='Actions'")
      await assert.rejects(db.exec("UPDATE gmail_integrations SET label_name=' '"), /check constraint/)
      assert.equal((await db.query(`UPDATE gmail_integrations SET label_name='hijack' WHERE user_id='${bob}' RETURNING user_id`)).rows.length, 0)
    }
    await db.exec('RESET ROLE')
  }
  console.log('PASS owner isolation, safe column grants, validation and service-only credential access')

  await db.exec(`SET ROLE service_role;
    INSERT INTO gmail_processed_messages(user_id,account_email,message_id,status,processed_at)
      VALUES('${alice}','alice@example.test','message-1','processed',now());`)
  await assert.rejects(db.exec(`INSERT INTO gmail_processed_messages(user_id,account_email,message_id)
    VALUES('${alice}','alice@example.test','message-1')`), /duplicate key/)
  await db.exec(`INSERT INTO gmail_processed_messages(user_id,account_email,message_id)
    VALUES('${bob}','bob@example.test','message-1');`)
  await db.exec(`SELECT public.set_gmail_integration_secret('${alice}','alice@example.test','rotated');`)
  assert.equal((await db.query(`SELECT public.get_gmail_integration_secret('${alice}') AS token`)).rows[0].token, 'rotated')
  await db.exec('RESET ROLE')
  assert.equal((await db.query(`SELECT * FROM gmail_integrations WHERE user_id='${alice}'`)).rows[0].start_at.getTime(), initial.start_at.getTime())
  assert.equal((await db.query('SELECT count(*)::int AS n FROM vault.secrets')).rows[0].n, 2)
  await db.exec(`SET ROLE authenticated; SET request.jwt.claim.sub='${alice}';`)
  assert.equal((await db.query('SELECT * FROM gmail_processed_messages')).rows.length, 1)
  await assert.rejects(db.exec("UPDATE gmail_processed_messages SET status='failed'"), /permission denied/)
  await db.exec(`RESET ROLE; SET ROLE service_role;
    SELECT public.clear_gmail_integration_secret('${alice}'); RESET ROLE;`)
  assert.equal((await db.query('SELECT count(*)::int AS n FROM vault.secrets')).rows[0].n, 1)
  assert.equal((await db.query(`SELECT count(*)::int AS n FROM gmail_processed_messages WHERE user_id='${alice}'`)).rows[0].n, 1)
  await db.exec(`SET ROLE service_role; SELECT public.set_gmail_integration_secret('${alice}','alice@example.test','reconnected'); RESET ROLE;`)
  assert.equal((await db.query(`SELECT * FROM gmail_integrations WHERE user_id='${alice}'`)).rows[0].start_at.getTime(), initial.start_at.getTime())
  await db.exec(`DELETE FROM auth.users;`)
  assert.equal((await db.query('SELECT count(*)::int AS n FROM vault.secrets')).rows[0].n, 0)
  assert.equal((await db.query('SELECT count(*)::int AS n FROM gmail_processed_messages')).rows[0].n, 0)
  console.log('PASS message deduplication, rotation, reconnect preservation, disconnect and account deletion cleanup')
} finally {
  await db.close()
}
