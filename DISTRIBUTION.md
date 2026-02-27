# Percolator Mobile — APK Distribution

## Download

**Latest Release:** [GitHub Releases](https://github.com/dcccrypto/percolator-mobile/releases/latest)

Download `percolator-v1.0.0.apk` and install it on any Android device (Android 7.0+).

### Installation Steps

1. Download the APK from the link above
2. On your Android device, go to **Settings → Security → Install unknown apps**
3. Allow your browser or file manager to install apps
4. Open the downloaded APK and tap **Install**
5. Launch **Percolator** from your app drawer

---

## Building from Source

### Prerequisites

- **Node.js** ≥ 18
- **Java** (OpenJDK 21 recommended)
- **Android SDK** with build-tools 36+
- **npm** or **pnpm**

### Environment Setup

```bash
export JAVA_HOME=/path/to/openjdk-21
export ANDROID_HOME=$HOME/Library/Android/sdk   # macOS
# export ANDROID_HOME=$HOME/Android/Sdk         # Linux
```

### Build Steps

```bash
# 1. Clone the repo
git clone https://github.com/dcccrypto/percolator-mobile.git
cd percolator-mobile

# 2. Install dependencies
npm install

# 3. Generate a release keystore (first time only)
keytool -genkeypair -v -storetype PKCS12 \
  -keystore android/app/percolator-release.keystore \
  -alias percolator-release \
  -keyalg RSA -keysize 2048 -validity 10000 \
  -storepass YOUR_PASSWORD -keypass YOUR_PASSWORD \
  -dname "CN=YourName, OU=Mobile, O=YourOrg, L=City, ST=State, C=US"

# 4. Build the release APK
cd android
./gradlew assembleRelease --no-daemon
```

The APK will be at: `android/app/build/outputs/apk/release/app-release.apk`

### Custom Keystore Passwords

Set environment variables to override the default passwords:

```bash
export PERCOLATOR_KEYSTORE_PASSWORD=your_store_password
export PERCOLATOR_KEY_PASSWORD=your_key_password
```

### Verify the APK Signature

```bash
$ANDROID_HOME/build-tools/36.0.0/apksigner verify --verbose app-release.apk
```

---

## Creating a New Release

```bash
# Tag and push
git tag v1.0.0
git push origin v1.0.0

# Create GitHub Release with APK attached
gh release create v1.0.0 percolator-v1.0.0.apk \
  --repo dcccrypto/percolator-mobile \
  --title "Percolator v1.0.0" \
  --notes "Initial Android release"
```

## Technical Details

- **Package:** `com.percolator.seeker`
- **Min SDK:** 24 (Android 7.0 Nougat)
- **Target SDK:** 34 (Android 14)
- **Architecture:** Universal (arm64-v8a, armeabi-v7a, x86, x86_64)
- **Signing:** APK Signature Scheme v2
- **Engine:** Hermes (React Native 0.81.5 / Expo 54)
