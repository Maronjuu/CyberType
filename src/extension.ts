import * as vscode from 'vscode';
import * as fs from 'node:fs';
import * as path from 'node:path';

export async function activate(context: vscode.ExtensionContext) {

    console.log('[CyberType] EXTENSION ACTIVATED');

    // ============================================================
    // CYBERTYPE STATE
    // ============================================================

    // Reference to the Webview that manages the audio engine.
    let audioView: vscode.WebviewView | undefined;

    // Indicates whether the Webview has finished loading.
    let webviewReady = false;

    // Indicates whether the user has pressed PLAY AUDIO.
    let audioActive = false;

    // Indicates whether the CyberType extension is enabled.
    let extensionEnabled = false;


    // ============================================================
    // RESTORE PREVIOUS EXTENSION STATE
    // ============================================================

    // Retrieve the extension state saved during the previous session.
    // If no value exists, CyberType starts in a disabled state.
    extensionEnabled = context.globalState.get<boolean>(
        'cybertype.enabled',
        false
    );


    // ============================================================
    // WEBVIEW COMMUNICATION
    // ============================================================

    // Send a message to the Webview only when it is ready.
    function sendMessage(type: string, sound?: string) {

        if (!audioView || !webviewReady) {
            return;
        }

        audioView.webview.postMessage({ type, sound });
    }


    // Play a sound only if:
    // 1. CyberType is enabled.
    // 2. Audio has been activated by the user.
    function playSound(sound: string) {

        if (!extensionEnabled || !audioActive) {
            return;
        }

        sendMessage('play', sound);
    }


    // ============================================================
    // WEBVIEW PROVIDER
    // ============================================================

    class CyberTypeViewProvider implements vscode.WebviewViewProvider {

        resolveWebviewView(webviewView: vscode.WebviewView) {

            audioView = webviewView;
            webviewReady = false;

            // Configure the resources that the Webview is allowed to access.
            webviewView.webview.options = {
                enableScripts: true,

                localResourceRoots: [
                    vscode.Uri.joinPath(context.extensionUri, 'webview'),
                    vscode.Uri.joinPath(context.extensionUri, 'media')
                ]
            };


            // Path to the main HTML file.
            const htmlPath = path.join(
                context.extensionPath,
                'webview',
                'audioEngine.html'
            );


            // Path to the Webview JavaScript file.
            const scriptUri = webviewView.webview.asWebviewUri(
                vscode.Uri.joinPath(
                    context.extensionUri,
                    'webview',
                    'audioEngine.js'
                )
            );


            // Path to the CSS stylesheet.
            const styleUri = webviewView.webview.asWebviewUri(
                vscode.Uri.joinPath(
                    context.extensionUri,
                    'webview',
                    'audioEngine.css'
                )
            );


            // Path to the folder containing the audio files.
            const audioUri = webviewView.webview.asWebviewUri(
                vscode.Uri.joinPath(
                    context.extensionUri,
                    'media',
                    'audio'
                )
            );


            // Read the contents of the HTML file.
            let html = fs.readFileSync(htmlPath, 'utf8');


            // Replace HTML placeholders with the actual resource paths.
            html = html
                .replaceAll('{{CSP_SOURCE}}', webviewView.webview.cspSource)
                .replaceAll('{{SCRIPT_URI}}', scriptUri.toString())
                .replaceAll('{{AUDIO_URI}}', audioUri.toString())
                .replaceAll('{{STYLE_URI}}', styleUri.toString());


            // Load the HTML page into the Webview.
            webviewView.webview.html = html;


            // Listen for messages sent by the Webview.
            webviewView.webview.onDidReceiveMessage(message => {

                if (!message || typeof message.type !== 'string') {
                    return;
                }

                // The Webview notifies the extension when loading is complete.
                if (message.type === 'ready') {
                    webviewReady = true;
                }

                // Update the audio state based on the Webview status.
                if (message.type === 'audioState') {
                    audioActive = message.enabled === true;
                }
            });
        }
    }


    // ============================================================
    // REGISTER WEBVIEW
    // ============================================================

    // Register the CyberType panel in the VS Code Explorer.
    const viewProvider = new CyberTypeViewProvider();

    const viewRegistration = vscode.window.registerWebviewViewProvider(
        'cybertype.audioView',
        viewProvider,
        {
            webviewOptions: {
                retainContextWhenHidden: true
            }
        }
    );


    // ============================================================
    // RESTORE PREVIOUS EXTENSION STATE
    // ============================================================

    // If CyberType was enabled before VS Code was closed,
    // restore its context and open the Explorer.
    // Audio is NOT activated automatically.
    if (extensionEnabled) {

        await vscode.commands.executeCommand(
            'setContext',
            'cybertype.enabled',
            true
        );

        await vscode.commands.executeCommand(
            'workbench.view.explorer'
        );
    }


    // ============================================================
    // TEXT DOCUMENT LISTENER
    // ============================================================

    // Detect changes made to documents in the editor.
    // Select the appropriate sound based on inserted or deleted characters.
    const documentListener = vscode.workspace.onDidChangeTextDocument(
        event => {

            console.log('[CyberType] Document changed');
            console.log('[CyberType] Audio active:', audioActive);
            console.log('[CyberType] Extension enabled:', extensionEnabled);

            const detectedSounds: string[] = [];


            // Analyze all changes made to the document.
            for (const change of event.contentChanges) {

                const insertedText = change.text;


                // Detect character deletion.
                if (insertedText.length === 0 && change.rangeLength > 0) {

                    detectedSounds.push('delete');
                    continue;
                }


                // Analyze inserted characters.
                for (const character of insertedText) {

                    // Enter / new line.
                    if (character === '\n') {

                        detectedSounds.push('enter');

                    // Ignore carriage returns and tab characters.
                    } else if (character === '\r' || character === '\t') {

                        continue;

                    // Spacebar.
                    } else if (character === ' ') {

                        detectedSounds.push('spacebar');

                    // Letters and numbers.
                    } else if (/[\p{L}\p{N}]/u.test(character)) {

                        detectedSounds.push('typechar');

                    // Punctuation marks and symbols.
                    } else if (".,;:!?\"'()[]{}<>/\\-_ =+*%$#@&~^|".includes(character)) {

                        detectedSounds.push('punctuation');
                    }
                }
            }


            // Play the first sound detected in the document change.
            if (detectedSounds.length > 0) {

                playSound(detectedSounds[0]);

                console.log(
                    '[CyberType] Detected sound:',
                    detectedSounds[0]
                );
            }
        }
    );


    // ============================================================
    // TERMINAL OPEN LISTENER
    // ============================================================

    // Detect when a new integrated terminal is created and opened.
    // If CyberType is enabled and audio is active,
    // play the terminalOpen sound.
    const terminalListener = vscode.window.onDidOpenTerminal(() => {

        console.log('[CyberType] Terminal opened');

        playSound('terminalOpen');
    });


    // ============================================================
    // ENABLE COMMAND
    // ============================================================

    // CyberType: Enable command.
    // Enables the extension and saves its state for future sessions.
    const enableCommand = vscode.commands.registerCommand(
        'cybertype.enable',
        async () => {

            extensionEnabled = true;

            await context.globalState.update(
                'cybertype.enabled',
                true
            );


            // Tell VS Code that CyberType is enabled.
            await vscode.commands.executeCommand(
                'setContext',
                'cybertype.enabled',
                true
            );


            // Open the Explorer and display the CyberType console.
            await vscode.commands.executeCommand(
                'workbench.view.explorer'
            );

            audioView?.show(true);


            vscode.window.showInformationMessage(
                'CyberType enabled. Press PLAY AUDIO in the CyberType console.'
            );
        }
    );


    // ============================================================
    // DISABLE COMMAND
    // ============================================================

    // CyberType: Disable command.
    // Disables the extension, stops audio, and saves its state.
    const disableCommand = vscode.commands.registerCommand(
        'cybertype.disable',
        async () => {

            extensionEnabled = false;

            await context.globalState.update(
                'cybertype.enabled',
                false
            );

            audioActive = false;


            // Send a message to the Webview to stop audio playback.
            sendMessage('stop');


            // Tell VS Code that CyberType is disabled.
            await vscode.commands.executeCommand(
                'setContext',
                'cybertype.enabled',
                false
            );


            vscode.window.showInformationMessage(
                'CyberType disabled.'
            );
        }
    );


    // ============================================================
    // REGISTER ALL LISTENERS AND COMMANDS
    // ============================================================

    // Register all resources in the VS Code subscriptions.
    // This allows VS Code to dispose of them when the extension is deactivated.
    context.subscriptions.push(
        viewRegistration,
        documentListener,
        terminalListener,
        enableCommand,
        disableCommand
    );
}


// ============================================================
// DEACTIVATE
// ============================================================

// VS Code handles Webview cleanup and disposes of the resources
// registered in the extension subscriptions.
export function deactivate() {
}
