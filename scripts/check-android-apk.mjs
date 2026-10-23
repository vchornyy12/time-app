import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { homedir } from 'node:os'
import path from 'node:path'

// Usage: node scripts/check-android-apk.mjs path.apk [--allow-debug-signature]
// The explicit override is for internal testing; the default rejects debug signing.
const apk = process.argv.slice(2).find(argument => !argument.startsWith('--'))
if (!apk) throw new Error('Pass an APK path. Set ANDROID_HOME if the SDK is outside its standard location.')
const sdk = process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT || path.join(homedir(), 'Library/Android/sdk')
const versions = readdirSync(path.join(sdk, 'build-tools')).sort((a, b) => b.localeCompare(a, undefined, { numeric: true }))
const tools = versions.map(version => path.join(sdk, 'build-tools', version)).find(directory => existsSync(path.join(directory, 'aapt')) && existsSync(path.join(directory, 'apksigner')))
if (!tools) throw new Error('Android build-tools with aapt and apksigner are required.')
const run = (command, args) => execFileSync(command, args, { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'] })
const badging = run(path.join(tools, 'aapt'), ['dump', 'badging', apk])
const manifest = run(path.join(tools, 'aapt'), ['dump', 'xmltree', apk, 'AndroidManifest.xml'])
const certificate = run(path.join(tools, 'apksigner'), ['verify', '--print-certs', apk])
const bundle = run('unzip', ['-p', apk, 'assets/index.android.bundle'])
const permissions = [...badging.matchAll(/^uses-permission: name='([^']+)'/gm)].map(match => match[1])
const debugSigning = /certificate DN:.*CN=Android Debug/.test(certificate)
const falseAttribute = name => new RegExp(`android:${name}\\([^\\n]+\\)=\\(type 0x12\\)0x0(?:\\s|$)`).test(manifest)
const trueAttribute = name => new RegExp(`android:${name}\\([^\\n]+\\)=\\(type 0x12\\)0xffffffff`).test(manifest)
const privilegedJwt = [...bundle.matchAll(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]{20,}/g)].some(([token]) => {
  try { return JSON.parse(Buffer.from(token.split('.')[1], 'base64url')).role === 'service_role' } catch { return false }
})
const checks = {
  expectedPackage: /package: name='com\.gtdcompanion\.app'/.test(badging),
  notDebuggable: !trueAttribute('debuggable'),
  backupDisabled: falseAttribute('allowBackup'),
  cleartextDisabled: falseAttribute('usesCleartextTraffic'),
  minimalPermissions: permissions.every(permission => ['android.permission.INTERNET', 'android.permission.VIBRATE', 'com.gtdcompanion.app.DYNAMIC_RECEIVER_NOT_EXPORTED_PERMISSION'].includes(permission)),
  encryptedSessionAdapter: bundle.includes('secure-index'),
  noRecognizedPrivateCredentials: !privilegedJwt && !/GOCSPX-[\w-]{20,}|sb_secret_[\w-]{20,}/.test(bundle),
  releaseCertificate: !debugSigning || process.argv.includes('--allow-debug-signature'),
}
const report = {
  apk: path.resolve(apk), bytes: statSync(apk).size,
  sha256: createHash('sha256').update(readFileSync(apk)).digest('hex'),
  version: badging.match(/versionName='([^']+)'/)?.[1],
  versionCode: Number(badging.match(/versionCode='([^']+)'/)?.[1]),
  certificateSha256: certificate.match(/certificate SHA-256 digest: (\w+)/)?.[1],
  debugSigning, permissions, checks, passed: Object.values(checks).every(Boolean),
}
console.log(JSON.stringify(report, null, 2))
if (!report.passed) process.exitCode = 1
