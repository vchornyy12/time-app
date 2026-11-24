import { execFileSync } from 'node:child_process'
import { createHash, randomBytes } from 'node:crypto'
import { chmodSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const credentialsFile = path.join(root, 'credentials.json')
const pinFile = path.join(root, 'release-signing.json')
const javaHome = process.env.JAVA_HOME || '/Library/Java/JavaVirtualMachines/temurin-17.jdk/Contents/Home'
const keytool = path.join(javaHome, 'bin/keytool')
const sdk = process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT || path.join(homedir(), 'Library/Android/sdk')
const run = (command, args, options = {}) => execFileSync(command, args, { cwd: root, stdio: ['ignore', 'pipe', 'pipe'], ...options })
const json = file => JSON.parse(readFileSync(file, 'utf8'))

try {
  if (process.argv.includes('--init')) {
    if (existsSync(credentialsFile) || existsSync(pinFile) || existsSync(path.join(root, '.signing/time24-release.jks'))) {
      throw new Error('Release credentials already exist. They will never be overwritten.')
    }
    mkdirSync(path.join(root, '.signing'), { recursive: true, mode: 0o700 })
    chmodSync(path.join(root, '.signing'), 0o700)
    const password = randomBytes(32).toString('base64url')
    const keystore = { keystorePath: '.signing/time24-release.jks', keystorePassword: password, keyAlias: 'time24-release', keyPassword: password }
    run(keytool, ['-genkeypair', '-keystore', path.join(root, keystore.keystorePath), '-storetype', 'JKS', '-alias', keystore.keyAlias,
      '-keyalg', 'RSA', '-keysize', '4096', '-validity', '10000', '-dname', 'CN=Time24 Android Release',
      '-storepass:env', 'TIME24_SIGNING_PASSWORD', '-keypass:env', 'TIME24_SIGNING_PASSWORD', '-noprompt'],
    { env: { ...process.env, TIME24_SIGNING_PASSWORD: password } })
    chmodSync(path.join(root, keystore.keystorePath), 0o600)
    writeFileSync(credentialsFile, JSON.stringify({ android: { keystore } }, null, 2) + '\n', { mode: 0o600, flag: 'wx' })
    console.log('Created private release keystore and credentials.json (excluded from Git).')
  }
  if (!existsSync(credentialsFile)) throw new Error('Run npm run signing:init first, or restore your existing credentials.json and keystore.')
  const keystore = json(credentialsFile).android.keystore
  const env = { ...process.env, JAVA_HOME: javaHome, ANDROID_HOME: sdk,
    TIME24_KEYSTORE_PASSWORD: keystore.keystorePassword, TIME24_KEY_PASSWORD: keystore.keyPassword }
  const certificate = run(keytool, ['-exportcert', '-keystore', path.resolve(root, keystore.keystorePath), '-alias', keystore.keyAlias,
    '-storepass:env', 'TIME24_KEYSTORE_PASSWORD'], { env })
  const fingerprint = createHash('sha256').update(certificate).digest('hex')
  if (!existsSync(pinFile)) {
    if (!process.argv.includes('--init')) throw new Error('Missing public certificate pin. Restore release-signing.json.')
    writeFileSync(pinFile, JSON.stringify({ certificateSha256: fingerprint, keyAlias: keystore.keyAlias }, null, 2) + '\n', { flag: 'wx' })
  }
  if (json(pinFile).certificateSha256 !== fingerprint) throw new Error('Keystore certificate does not match the pinned release identity.')
  console.log(`Release certificate SHA-256: ${fingerprint}`)
  if (process.argv.includes('--init')) process.exit(0)

  // Keep signing secrets out of Metro/Gradle and use them only in signing subprocesses.
  const buildEnv = { ...process.env, JAVA_HOME: javaHome, ANDROID_HOME: sdk }
  run(process.execPath, ['node_modules/expo/bin/cli', 'prebuild', '--platform', 'android', '--no-install'], { env: buildEnv, stdio: 'inherit' })
  run(path.join(root, 'android/gradlew'), [':app:assembleRelease', '--console=plain'], { cwd: path.join(root, 'android'), env: buildEnv, stdio: 'inherit' })
  const versions = readdirSync(path.join(sdk, 'build-tools')).sort((a, b) => b.localeCompare(a, undefined, { numeric: true }))
  const tools = path.join(sdk, 'build-tools', versions[0])
  const version = json(path.join(root, 'app.json')).expo.version
  const output = path.join(root, `dist/time24-${version}-release.apk`)
  mkdirSync(path.dirname(output), { recursive: true })
  run(path.join(tools, 'apksigner'), ['sign', '--ks', path.resolve(root, keystore.keystorePath), '--ks-key-alias', keystore.keyAlias,
    '--ks-pass', 'env:TIME24_KEYSTORE_PASSWORD', '--key-pass', 'env:TIME24_KEY_PASSWORD', '--out', output,
    path.join(root, 'android/app/build/outputs/apk/release/app-release-unsigned.apk')], { env })
  run(path.join(tools, 'zipalign'), ['-c', '-P', '16', '4', output])
  const report = JSON.parse(run(process.execPath, [path.join(root, '../scripts/check-android-apk.mjs'), output], { env: buildEnv }).toString())
  if (report.certificateSha256 !== fingerprint) throw new Error('APK signature differs from the pinned release certificate.')
  writeFileSync(output + '.json', JSON.stringify(report, null, 2) + '\n')
  console.log(JSON.stringify(report, null, 2))
} catch (error) {
  // Never print child-process error objects: they can contain signing environment variables.
  console.error(error instanceof SyntaxError ? 'Invalid configuration JSON. No credential contents printed.' : error.status === undefined ? error.message : `Release subprocess failed (exit ${error.status}). No credentials printed.`)
  process.exitCode = 1
}
