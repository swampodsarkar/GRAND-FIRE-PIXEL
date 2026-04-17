# 🚀 FIRESTRIKEx - Quick Android Setup

## ⚡ FAST SETUP (5 Minutes)

### **Step 1: Install Dependencies**

Open PowerShell as **Administrator** and run:

```powershell
# Fix execution policy (only once)
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser

# Navigate to project
cd "d:\New folder"

# Install all dependencies
npm install
```

---

### **Step 2: Build & Add Android**

```powershell
# Build React app
npm run build

# Add Android platform
npx cap add android

# Sync app to Android
npx cap sync android
```

---

### **Step 3: Open in Android Studio**

```powershell
npx cap open android
```

Android Studio will open. Wait for Gradle sync to finish.

---

### **Step 4: Build APK**

In Android Studio:
1. **Build → Build Bundle(s) / APK(s) → Build APK(s)**
2. Wait for build
3. Click **locate** when done

**APK Location:**
```
d:\New folder\android\app\build\outputs\apk\debug\app-debug.apk
```

---

## 📱 Install on Phone

1. Copy `app-debug.apk` to your phone
2. Tap the file
3. Allow installation from unknown sources
4. Install and play! 🎮

---

## 🎯 Useful Commands

```powershell
# Development with live reload
npm run cap:run

# Build & sync (after code changes)
npm run android:build

# Open Android Studio
npm run cap:open

# Just build React app
npm run build
```

---

## ✅ Checklist

- [ ] Node.js installed
- [ ] Android Studio installed
- [ ] Run `npm install`
- [ ] Run `npm run build`
- [ ] Run `npx cap add android`
- [ ] Run `npx cap sync android`
- [ ] Open Android Studio
- [ ] Build APK
- [ ] Install on phone

---

## 🐛 Troubleshooting

**Problem:** npm not working
**Fix:** Run PowerShell as Administrator

**Problem:** Gradle sync failed
**Fix:** Wait, it downloads files. Check internet.

**Problem:** App crashes
**Fix:** Check Firebase config in `src/firebase.ts`

---

**Enjoy your Android game! 🔥🎮**
