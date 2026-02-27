# Percolator Mobile — Build & Distribution

## Download

**Latest APK:** [percolator-v1.0.0.apk](https://github.com/dcccrypto/percolator-mobile/releases/tag/v1.0.0)

### Installation

1. Download `percolator-v1.0.0.apk` from the link above
2. On your Android device, enable **Install from unknown sources** (Settings → Security)
3. Open the downloaded APK to install
4. Launch Percolator and connect your Solana wallet

### Requirements

- Android 7.0+ (API 24)
- ~78 MB storage

---

## Building the APK Locally

### Prerequisites

- Node.js 18+
- Java 21 (OpenJDK)
- Android SDK (API 34, build-tools)
- npm or yarn

### Steps

```bash
# 1. Install dependencies
npm install

# 2. Set environment
export JAVA_HOME=/path/to/openjdk-21
export ANDROID_HOME=/path/to/Android/sdk

# 3. Create local.properties (if missing)
echo "sdk.dir=$ANDROID_HOME" > android/local.properties

# 4. Build release APK
cd android
./gradlew assembleRelease

# 5. APK output
ls app/build/outputs/apk/release/app-release.apk
```

### Signing

The default build uses the debug keystore. For production distribution, configure a release keystore in `android/app/build.gradle`:

```groovy
signingConfigs {
    release {
        storeFile file('release.keystore')
        storePassword System.getenv('KEYSTORE_PASSWORD')
        keyAlias 'percolator'
        keyPassword System.getenv('KEY_PASSWORD')
    }
}
```

## Publishing a New Release

```bash
# Tag and push
git tag v1.x.x
git push origin v1.x.x

# Upload to GitHub Releases
gh release create v1.x.x \
  android/app/build/outputs/apk/release/app-release.apk \
  --title "Percolator Mobile v1.x.x" \
  --notes "Release notes here" \
  -R dcccrypto/percolator-mobile
```
