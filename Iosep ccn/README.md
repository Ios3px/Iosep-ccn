# Iosep CCN CHECKER - Setup Guide

## 🚀 Quick Start with ngrok (Phone Access)

### Prerequisites
- Python installed on your PC
- ngrok downloaded: https://ngrok.com/download

---

## 📱 Step-by-Step ngrok Setup

### Step 1: Download ngrok
1. Go to https://ngrok.com/download
2. Download Windows version
3. Extract the zip file
4. Move `ngrok.exe` to your project folder: `C:\Users\joss\OneDrive\Desktop\Iosep ccn`

### Step 2: Start Flask Application
1. Open Command Prompt
2. Navigate to project folder:
   ```
   cd "C:\Users\joss\OneDrive\Desktop\Iosep ccn"
   ```
3. Run the application:
   ```
   python app.py
   ```
4. Keep this window open

### Step 3: Start ngrok
1. Open a NEW Command Prompt window
2. Navigate to same project folder:
   ```
   cd "C:\Users\joss\OneDrive\Desktop\Iosep ccn"
   ```
3. Run ngrok:
   ```
   ngrok http 5000
   ```
4. Look for the Forwarding URL, e.g.:
   ```
   https://abc123xyz.ngrok-free.app
   ```

### Step 4: Access from Your Phone
1. Copy the ngrok URL (the https one)
2. Open browser on your phone
3. Paste the URL
4. Your card checker should load!

---

## ⚠️ Important Notes

### Keep Both Windows Open
- **Window 1**: Flask app (`python app.py`)
- **Window 2**: ngrok (`ngrok http 5000`)
- If either closes, the app won't be accessible

### URL Changes
- Free ngrok URLs change each time you restart
- New URL = new ngrok session
- Consider paid ngrok for permanent URLs

### Security
- Anyone with the ngrok URL can access your app
- Don't share the URL publicly
- ngrok provides HTTPS encryption

---

## 🌐 Alternative: Same WiFi Network

If phone and PC are on same WiFi:

1. Find your PC's IP:
   - Open Command Prompt
   - Type: `ipconfig`
   - Look for "IPv4 Address" (e.g., 192.168.1.5)

2. Access from phone:
   - Go to: `http://192.168.1.5:5000` (replace with your IP)

---

## 🎮 Alternative: RDP (Remote Desktop)

1. Enable RDP on PC:
   - Press `Win + R`, type: `sysdm.cpl`
   - Go to "Remote" tab
   - Check "Allow remote connections"

2. Download RDP app on phone
3. Enter PC IP and credentials
4. Access browser on your PC

---

## 📞 Support
For issues or questions, TELEGRAM: @itsmeJY
