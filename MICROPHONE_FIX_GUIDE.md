# 🎤 Microphone Not Turning On - Fix Guide

## Quick Test: Does Your Microphone Work?

### Test 1: Browser Microphone Access Test

1. Open Chrome
2. Press **F12** (open console)
3. Paste this code and press Enter:

```javascript
navigator.mediaDevices.getUserMedia({ audio: true })
  .then(stream => {
    console.log('✅ Microphone works!');
    stream.getTracks().forEach(track => track.stop());
  })
  .catch(error => {
    console.error('❌ Microphone error:', error.message);
  });
```

**What happens?**

✅ **"Microphone works!"** → Your mic is fine, issue is in the app
❌ **"Permission denied"** → Browser blocked microphone
❌ **"Not found"** → No microphone detected
❌ **"Not allowed"** → You clicked "Block" before

---

## Solution 1: Grant Microphone Permission

### For Chrome/Edge:

1. Click the **lock icon** 🔒 in the address bar (left of URL)
2. Look for **"Microphone"**
3. Change to **"Allow"**
4. **Refresh the page** (F5)

### Alternative: Clear All Permissions

1. Click lock icon 🔒
2. Click **"Site settings"**
3. Under **Permissions**, find **Microphone**
4. Set to **"Allow"**
5. Refresh page

---

## Solution 2: Check Windows Microphone Settings

### Enable Microphone in Windows:

1. Press **Windows + I** (Settings)
2. Go to **Privacy & Security** → **Microphone**
3. Turn ON:
   - ✅ **"Microphone access"**
   - ✅ **"Let apps access your microphone"**
   - ✅ **"Let desktop apps access your microphone"**
4. Scroll down, find **Chrome** or **Edge** → Turn ON

---

## Solution 3: Test Your Microphone Device

### Check if Windows detects your mic:

1. Right-click speaker icon 🔊 in taskbar
2. Click **"Sound settings"**
3. Under **Input**, select your microphone
4. Speak and watch the **volume bar** - should move
5. If no movement → mic not working/connected

---

## Solution 4: Use HTTPS (for production)

Microphones only work on:
- ✅ `http://localhost` (development)
- ✅ `https://` (production)
- ❌ `http://192.168.x.x` (blocked for security)

**For localhost, this should work fine!**

---

## Solution 5: Check Browser Console for Errors

1. Open page: `http://localhost:3000`
2. Go to Super Assistant
3. Open console (F12)
4. Click "Speak" button
5. Look for red errors

**Common errors:**

### Error: "NotAllowedError: Permission denied"
**Fix:** Grant microphone permission (Solution 1)

### Error: "NotFoundError: Requested device not found"
**Fix:**
- Plug in a microphone
- Or use built-in laptop mic
- Check Windows Sound Settings

### Error: "NotReadableError: Could not start audio source"
**Fix:**
- Another app is using your mic (close Zoom, Teams, etc.)
- Restart browser
- Restart computer

---

## Test Inside Super Assistant

### Expected Flow:

1. Go to `http://localhost:3000/super-assistant`
2. Look for microphone icon or "Voice Mode" button
3. Click it → Voice chat UI appears
4. Click **"Speak"** button
5. Browser shows permission popup:
   ```
   localhost wants to:
   ☑️ Use your microphone
   [Block] [Allow]
   ```
6. Click **Allow**
7. Microphone icon should turn RED (recording)
8. Start speaking → see real-time transcript

---

## Debugging: Check What's Blocking

### Run this in Console (F12):

```javascript
// Check microphone permissions
navigator.permissions.query({ name: 'microphone' })
  .then(result => {
    console.log('Microphone permission:', result.state);
    // "granted" = allowed
    // "denied" = blocked
    // "prompt" = will ask when needed
  });
```

**Result:**
- ✅ **"granted"** → Permission already allowed
- ❌ **"denied"** → You blocked it, need to reset (Solution 1)
- ⚠️ **"prompt"** → Will ask when you click Speak

---

## Still Not Working?

### Try Different Browser:

- ✅ **Chrome** (best support)
- ✅ **Edge** (Chromium version)
- ✅ **Safari** (Mac)
- ❌ **Firefox** (Web Speech API not supported)

### Try Incognito Mode:

1. Open Chrome Incognito: **Ctrl+Shift+N**
2. Go to `http://localhost:3000`
3. Allow microphone when asked
4. Test voice

If it works in Incognito → Clear browser cache/cookies

---

## Force Reset Permissions

### Chrome:

1. Go to: `chrome://settings/content/microphone`
2. Find `http://localhost:3000` in "Not allowed" list
3. Click trash icon 🗑️ to remove
4. Refresh page
5. Try again (will ask for permission)

---

## Complete Fresh Start

```bash
# 1. Close browser completely
# 2. Kill any Chrome processes
taskkill /F /IM chrome.exe /T

# 3. Restart backend
cd D:\BAP\BAP-Backend
npm run dev

# 4. Restart frontend
cd D:\BAP\bap-workspace\bap-frontend
npm run dev

# 5. Open fresh Chrome window
# 6. Go to http://localhost:3000
# 7. Log in
# 8. Go to Super Assistant
# 9. Click Voice Mode
# 10. Click Speak
# 11. ALLOW microphone
# 12. Speak clearly
```

---

## Verify Microphone is Working

### Quick browser test:

1. Open: https://www.onlinemictest.com/
2. Click "Allow" for microphone
3. Speak → should see sound waves
4. If this works, your mic is fine
5. Issue is in the app code

---

## Manual Test Code

If you want to test the exact code path, run this in console:

```javascript
// Test microphone + Web Speech API together
async function testVoice() {
  try {
    // 1. Test microphone access
    console.log('🎤 Requesting microphone...');
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    console.log('✅ Microphone granted!');

    // 2. Test Web Speech API
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      console.error('❌ Web Speech API not supported');
      return;
    }

    console.log('✅ Web Speech API supported!');
    const recognition = new SpeechRecognition();

    recognition.onstart = () => {
      console.log('🎤 LISTENING - Speak now!');
    };

    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      console.log('📝 You said:', transcript);
      recognition.stop();
    };

    recognition.onerror = (event) => {
      console.error('❌ Error:', event.error);
    };

    recognition.start();

  } catch (error) {
    console.error('❌ Failed:', error.message);
  }
}

// Run test
testVoice();
```

**Run this in browser console, speak when you see "LISTENING"**

---

## Expected Behavior When Working

1. Click "Speak" button
2. Browser popup appears (if first time): **Allow microphone**
3. Microphone icon turns RED or shows animation
4. Transcript appears in real-time as you speak
5. Backend console shows your words with 🎤 emoji

---

## Contact Checklist

If still not working, provide:

- [ ] Browser name and version
- [ ] Operating System (Windows 10/11)
- [ ] Microphone type (built-in/USB/Bluetooth)
- [ ] Error message from console
- [ ] Result of permission test (granted/denied/prompt)
- [ ] Does mic work on onlinemictest.com?

---

**Most common fix: Just click "Allow" when browser asks for microphone!** 🎤
