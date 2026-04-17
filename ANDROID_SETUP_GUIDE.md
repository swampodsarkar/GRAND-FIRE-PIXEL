# 🔥 FIRESTRIKEx - Android APK Setup Guide

## 📋 Prerequisites

Before starting, make sure you have:
- ✅ Node.js installed (v22+)
- ✅ Android Studio installed
- ✅ Java JDK installed

---

## 🚀 Step-by-Step Instructions

### **Step 1: Fix PowerShell Policy (Windows)**

Open PowerShell as **Administrator** and run:
```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

---

### **Step 2: Install Capacitor**

Open terminal in your project folder (`d:\New folder`) and run:

```bash
npm install @capacitor/core @capacitor/cli
```

---

### **Step 3: Initialize Capacitor**

```bash
npx cap init
```

When prompted:
- **App name**: `FIRESTRIKEx`
- **App Package ID**: `com.firestrikex.game`
- **Web asset directory**: `dist`

This creates `capacitor.config.json`

---

### **Step 4: Build the React App**

```bash
npm run build
```

This creates the `dist` folder with your optimized app.

---

### **Step 5: Add Android Platform**

```bash
npx cap add android
```

This creates the `android` folder with native Android project.

---

### **Step 6: Configure Android Settings**

Open `capacitor.config.json` and update:

```json
{
  "appId": "com.firestrikex.game",
  "appName": "FIRESTRIKEx",
  "webDir": "dist",
  "server": {
    "androidScheme": "https",
    "cleartext": true
  },
  "plugins": {
    "SplashScreen": {
      "launchShowDuration": 2000,
      "backgroundColor": "#D4AF37",
      "showSpinner": false
    },
    "StatusBar": {
      "style": "LightContent",
      "backgroundColor": "#0A0A0B"
    }
  }
}
```

---

### **Step 7: Sync App to Android**

```bash
npx cap sync android
```

This copies your web app to the Android project.

---

### **Step 8: Open in Android Studio**

```bash
npx cap open android
```

This opens Android Studio with your project.

---

### **Step 9: Build APK in Android Studio**

1. **Wait for Gradle sync** to complete
2. Go to **Build → Build Bundle(s) / APK(s) → Build APK(s)**
3. Wait for build to finish
4. Click **locate** when done to find your APK

Your APK will be at:
```
android/app/build/outputs/apk/debug/app-debug.apk
```

---

## 🎮 Alternative: Build APK via Command Line

If you have Android SDK installed:

```bash
cd android
./gradlew assembleDebug
```

APK location:
```
android/app/build/outputs/apk/debug/app-debug.apk
```

---

## 📱 Install APK on Phone

### Method 1: USB Cable
1. Enable **USB Debugging** on phone
2. Connect phone to PC
3. Run: `adb install android/app/build/outputs/apk/debug/app-debug.apk`

### Method 2: Transfer File
1. Copy APK to phone
2. Tap on APK file
3. Allow installation from unknown sources
4. Install

---

## 🔧 Important Android Permissions

The app needs these permissions (already configured):
- ✅ Internet (for Firebase)
- ✅ Vibration (for game feedback)
- ✅ Wake Lock (keep screen on)
- ✅ Full Screen (immersive mode)

---

## 🎯 Build Release APK (For Publishing)

### Step 1: Generate Keystore

```bash
keytool -genkey -v -keystore firestrikex-release-key.jks -keyalg RSA -keysize 2048 -validity 10000 -alias firestrikex
```

### Step 2: Configure in Android Studio

1. **Build → Generate Signed Bundle / APK**
2. Select **APK**
3. Choose your keystore file
4. Build **Release** variant

### Step 3: Optimize with zipalign

```bash
zipalign -v -p 4 app-release-unsigned.apk firestrikex.apk
```

---

## 🐛 Common Issues & Fixes

### Issue 1: "npm not recognized"
**Fix:** Add Node.js to PATH or use full path:
```
"C:\Program Files\nodejs\npm.cmd" install @capacitor/core
```

### Issue 2: Gradle sync failed
**Fix:** 
1. Open Android Studio
2. File → Invalidate Caches → Restart
3. Wait for Gradle to download dependencies

### Issue 3: App crashes on phone
**Fix:**
1. Check Firebase config in `src/firebase.ts`
2. Make sure `.env` variables are set
3. Run `npm run build` before `npx cap sync`

### Issue 4: Screen rotation issues
**Fix:** Add to `AndroidManifest.xml`:
```xml
android:screenOrientation="portrait"
```

---

## 📊 App Size Optimization

Add to `vite.config.ts`:

```typescript
export default defineConfig({
  build: {
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true,
        drop_debugger: true
      }
    },
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
          firebase: ['firebase/app', 'firebase/database'],
          ui: ['lucide-react', 'motion/react']
        }
      }
    }
  }
})
```

---

## ✅ Testing Checklist

Before publishing:
- [ ] Login works
- [ ] Lobby loads correctly
- [ ] Matchmaking works
- [ ] Game runs smoothly
- [ ] Touch controls work
- [ ] Firebase connection works
- [ ] Sound effects play
- [ ] No crashes
- [ ] Orientation locked to portrait
- [ ] App icon displays
- [ ] Splash screen shows

---

## 🎨 Add App Icon

1. Create icon (1024x1024 PNG)
2. Replace: `android/app/src/main/res/mipmap-*/ic_launcher.png`
3. Or use Android Studio → Image Asset Studio

---

## 🚀 Quick Commands Reference

```bash
# Install dependencies
npm install

# Build React app
npm run build

# Sync to Android
npx cap sync android

# Open Android Studio
npx cap open android

# Live reload (development)
npx cap run android --livereload --external

# Update after code changes
npm run build && npx cap sync android
```

---

## 📱 Expected APK Size

- **Debug APK**: ~15-25 MB
- **Release APK**: ~8-15 MB (after optimization)

---

## 🎮 Next Steps

After building APK:
1. Test on multiple devices
2. Fix any bugs
3. Build release APK
4. Sign APK
5. Publish to Play Store (optional)

---

## 💡 Pro Tips

1. **Always run `npm run build`** before syncing
2. **Test on real device**, not just emulator
3. **Use Chrome DevTools** for debugging: `chrome://inspect`
4. **Keep Firebase rules** secure
5. **Optimize images** to reduce APK size

---

## 🆘 Need Help?

If you face issues:
1. Check Android Studio logs (Logcat)
2. Run: `adb logcat` for device logs
3. Check Firebase console for errors
4. Verify all dependencies installed

---

**Good luck with your Android app! 🎮🔥**
