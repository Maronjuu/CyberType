# CyberType

**Give your code a cinematic sound.**

CyberType is a Visual Studio Code extension that transforms coding into a cinematic audio experience inspired by futuristic computer systems and sci-fi interfaces, featuring beep boop sounds and Ben 10's original Omnitrix sounds.

## ✨ Features

- **Typing Sounds:** sound effects when typing letters and numbers.
- **Punctuation Sounds:** randomized sound effects for punctuation, with variations to prevent consecutive repetitions.
- **Enter Sound:** dedicated sound effects when pressing Enter.
- **Spacebar Sound:** sound effect when inserting a space.
- **Delete Sound:** sound effect when deleting text.
- **Idle Ambience:** ambient audio loop while CyberType is active.
- **Startup Sound:** startup effect when the audio engine is activated.
- **Terminal Open Sound:** sound effect when you open a new terminal in VSCode.
- **Master Volume:** adjust all sound effects directly from the CyberType console.
- **Webview Interface:** a dedicated interface inside the Visual Studio Code Explorer, featuring a visual system status indicator.

## 📋 Requirements

To use CyberType, you need:

- [Visual Studio Code](https://code.visualstudio.com/) installed.
- An operating system supported by Visual Studio Code.
- A working audio output device, such as speakers or headphones.

No additional audio libraries are required. CyberType uses the audio APIs built into the Visual Studio Code Webview environment.

## 📦 Installation

### Installing from a VSIX file

1. Download the `cybertype-x.x.x.vsix` file.
2. Open Visual Studio Code.
3. Navigate to the **Extensions** view (`Ctrl + Shift + X`).
4. Open the three-dot menu in the upper-right corner.
5. Select **Install from VSIX...**.
6. Choose the downloaded VSIX file.
7. Wait for the installation to complete.

Once installed, CyberType will be available in Visual Studio Code.

## 🚀 How to Use CyberType

### 1. Enable CyberType

Open the Command Palette:

`Ctrl + Shift + P`

Search for and execute:

`CyberType: Enable`

CyberType will be enabled, and its console will appear in the **Explorer** sidebar.

### 2. Start the Audio Engine

Inside the CyberType console:

1. Click **PLAY AUDIO**.
2. Listen to the startup sound.
3. The ambient audio loop will start automatically.
4. Start typing in your editor.

The status indicator displays the current system state:

- 🔴 **SYSTEM OFFLINE:** audio engine is stopped.
- 🟡 **INITIALIZING AUDIO:** audio engine is loading and initializing.
- 🟢 **SYSTEM ONLINE:** audio engine is running.

### 3. Adjust the Volume

Use the slider in the CyberType console to adjust the master volume of all sound effects and ambient audio.

This setting only affects CyberType and does not change your operating system's master volume.

### 4. Stop the Audio Engine

Click **STOP AUDIO** in the CyberType console to stop all sounds.

### 5. Disable CyberType

To completely disable CyberType, open the Command Palette and execute:

`CyberType: Disable`

The extension will stop the audio engine and hide the CyberType console.

## 🔊 Additional Notes

CyberType uses Visual Studio Code document change events to detect text modifications.

This means sound detection is based on document changes rather than direct interception of every physical keystroke. As a result, some automatic editor modifications may also trigger sound effects.

To hear the sound effects, the audio engine must be activated using the **PLAY AUDIO** button.

## 🛠️ Development

CyberType is developed as a Visual Studio Code extension.

Technologies used:

- TypeScript / JavaScript
- Visual Studio Code Extension API
- Webview API
- Web Audio API
- HTML5
- CSS3