# How to Run the Extension

## 🎯 Quick Start (Easiest Way)

### Step 1: Run the startup script
```bash
./start-dev.sh
```

This will:
- Build the extension
- Start watch mode
- Show you what to do next

### Step 2: Launch the Extension
**In Cursor/VSCode:**
1. Look at the left sidebar for the **Run and Debug** icon (▶️🐛)
2. Click it (or press `Cmd+Shift+D` on Mac, `Ctrl+Shift+D` on Windows/Linux)
3. At the top of that panel, you'll see a dropdown that says "Run Extension"
4. Click the **green play button** next to it (or just press `F5`)

### Step 3: See Your Extension
A new window called "Extension Development Host" will open.

In that new window:
1. Look at the **left sidebar** (Activity Bar)
2. Find the **CodeFree-O icon** (looks like a square/box)
3. **Click the icon**
4. The sidebar opens with the CodeFree-O chat interface 🎉

---

## 📋 Detailed Manual Steps

If the script doesn't work or you prefer manual control:

### 1. Build Everything
```bash
pnpm build
```

### 2. Start Watch Mode
Open a terminal and run:
```bash
pnpm watch
```
**Keep this terminal open!** It will automatically rebuild when you make changes.

### 3. Launch Extension
- Open the Run and Debug panel (`Cmd+Shift+D` / `Ctrl+Shift+D`)
- Select "Run Extension" from dropdown
- Press F5 or click the green play button

### 4. Find Your Extension
In the Extension Development Host window:
- Look for CodeFree-O icon in the Activity Bar (left side)
- Click it to open the sidebar panel

---

## 🔍 Troubleshooting

### I pressed F5 but nothing happened
1. Check if the terminal shows "Starting incremental compilation..." - if not, `pnpm watch` isn't running
2. Try the manual steps above instead

### The Extension Development Host opened but I don't see the CodeFree-O icon
1. Check the Debug Console: View > Debug Console
2. Look for "CodeFree-O extension is now active!" message
3. If not there, check that `dist/extension.js` exists
4. Try: Developer: Reload Window (in Command Palette)

### I see the icon but the sidebar is blank
1. Open Developer Tools: Command Palette > "Developer: Toggle Developer Tools"
2. Check Console for errors
3. Verify `out/main.js` and `out/main.css` exist
4. Try rebuilding: `pnpm build`

### Hot reload isn't working
**For extension code changes:**
- Save your file
- In Extension Development Host, press `Cmd+R` (Mac) or `Ctrl+R` (Windows/Linux)
- Or: Command Palette > "Developer: Reload Window"

**For webview (SolidJS) changes:**
- Should reload automatically
- If not, check that watch mode is running
- Check terminal for Vite errors

---

## 🎨 What You Should See

When everything works:

1. **Main VSCode/Cursor window**:
   - Terminal shows watch mode running
   - Debug Console shows compilation messages

2. **Extension Development Host window**:
   - CodeFree-O icon in Activity Bar (left side)
   - Click icon → Sidebar opens
   - Shows the CodeFree-O chat interface

3. **Debug Console** (in Extension Development Host):
   ```
   CodeFree-O extension is now active!
   CodeFree-O webview provider registered
   ```

---

## 💡 Tips

- **First time?** Run `./start-dev.sh` - it does everything for you
- **Developing?** Keep watch mode running, just press `Cmd+R` in Extension Development Host when you change extension code
- **SolidJS changes?** Just save - they hot reload automatically!
- **Stuck?** See TROUBLESHOOTING.md for detailed help

---

## 📚 Files to Edit

- `src/extension.ts` - Extension entry point
- `src/CodeFreeOViewProvider.ts` - Webview provider logic  
- `src/webview/App.tsx` - SolidJS UI
- `src/webview/App.css` - Styles

After editing extension code, press `Cmd+R` in Extension Development Host.
After editing webview code, changes auto-reload!
