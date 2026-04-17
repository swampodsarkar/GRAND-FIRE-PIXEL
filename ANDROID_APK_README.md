# 🔥 FIRESTRIKEx - Android APK

## 📱 Convert to Android APK - EASY GUIDE

Your FIRESTRIKEx game is now configured to become an Android app!

---

## ⚡ QUICKEST WAY (Double-Click Method)

### **Just run this file:**
```
setup-android.bat
```

**Double-click it** and it will:
1. ✅ Install all dependencies
2. ✅ Build the React app
3. ✅ Add Android platform
4. ✅ Sync everything
5. ✅ Open Android Studio

Then build APK from Android Studio!

---

## 📋 Manual Method (Command Line)

Open **PowerShell as Administrator**:

```powershell
# Navigate to project
cd "d:\New folder"

# Install dependencies
npm install

# Build app
npm run build

# Add Android
npx cap add android

# Sync
npx cap sync android

# Open Android Studio
npx cap open android
```

---

## 🎯 Build APK in Android Studio

1. **Wait** for Gradle sync to finish
2. Click **Build → Build Bundle(s) / APK(s) → Build APK(s)**
3. **Wait** for build to complete
4. Click **locate** when done

**APK Location:**
```
d:\New folder\android\app\build\outputs\apk\debug\app-debug.apk
```

---

## 📲 Install on Phone

### Option 1: USB Cable
```powershell
adb install android/app/build/outputs/apk/debug/app-debug.apk
```

### Option 2: Transfer File
1. Copy `app-debug.apk` to phone
2. Tap the file
3. Allow installation
4. Play! 🎮

---

## 🎮 Your Game Features

✅ Full Battle Royale gameplay  
✅ Touch controls (dual joysticks)  
✅ Login & Lobby system  
✅ Classic Mode (no requirements)  
✅ Rank Mode (Level 8+ required)  
✅ 20 players per match  
✅ 5 weapons  
✅ Character skills  
✅ Firebase real-time  
✅ Kill feed  
✅ Safe zone  
✅ Respawn system  

---

## 📊 Rank System

### Rank Mode (Level 8+ Required):
- **Win:** +50 points + (kills × 15)
- **Loss:** -20 points + (kills × 5)

### Classic Mode:
- No level requirement
- Earn EXP & Gold only

---

## 🔄 After Code Changes

Every time you change code:

```powershell
npm run build
npx cap sync android
```

Then rebuild APK in Android Studio.

---

## 📚 Documentation

- **`QUICK_START.md`** - 5-minute setup
- **`ANDROID_SETUP_GUIDE.md`** - Complete guide
- **`ANDROID_CONVERSION_SUMMARY.md`** - Full summary

---

## 🐛 Troubleshooting

**npm not working?**
→ Run PowerShell as Administrator

**Gradle sync failed?**
→ Wait, it downloads files

**App crashes?**
→ Check Firebase config

---

## 🎯 Commands Reference

```powershell
# Install dependencies
npm install

# Build React app
npm run build

# Sync to Android
npx cap sync android

# Open Android Studio
npx cap open android

# Live reload (testing)
npm run cap:run
```

---

## ✅ Checklist

- [ ] Run `setup-android.bat` OR follow manual steps
- [ ] Android Studio opens
- [ ] Gradle sync completes
- [ ] Build APK
- [ ] Install on phone
- [ ] Test game
- [ ] Enjoy! 🎮

---

**Your FIRESTRIKEx Android game is ready! 🔥**

**Just run `setup-android.bat` and follow the steps!**

Good luck! ✨
