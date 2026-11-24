// Expo config plugins load through CommonJS.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { withAppBuildGradle } = require('expo/config-plugins')

function removeDebugReleaseSigning(source) {
    const pattern = /(\brelease\s*\{[\s\S]*?)signingConfig signingConfigs\.debug/
    if (pattern.test(source)) {
      return source.replace(pattern, '$1// Signed by the release script or EAS; never use the debug key.\n            signingConfig null')
    } else if (!/\brelease\s*\{[\s\S]*?signingConfig (?:null|signingConfigs\.release)/.test(source)) {
      throw new Error('Unrecognized Android release signing configuration')
    }
    return source
}

module.exports = function withReleaseSigning(config) {
  return withAppBuildGradle(config, config => {
    config.modResults.contents = removeDebugReleaseSigning(config.modResults.contents)
    return config
  })
}
module.exports.removeDebugReleaseSigning = removeDebugReleaseSigning
