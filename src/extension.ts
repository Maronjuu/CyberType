import * as vscode from 'vscode';
import * as fs from 'node:fs';
import * as path from 'node:path';

export async function activate(context: vscode.ExtensionContext) {
    console.log('[CyberType] EXTENSION ACTIVATED');

    let audioView: vscode.WebviewView | undefined;
    let webviewReady = false;
    let audioActive = false;
    let extensionEnabled = false;

    extensionEnabled = context.globalState.get<boolean>(
        'cybertype.enabled',
        false
    );

    function sendMessage(type: string, sound?: string) {
        if (!audioView || !webviewReady) {
            return;
        }

        audioView.webview.postMessage({ type, sound });
    }

    function playSound(sound: string) {
        if (!extensionEnabled || !audioActive) {
            return;
        }

        sendMessage('play', sound);
    }

    class CyberTypeViewProvider implements vscode.WebviewViewProvider {
        resolveWebviewView(webviewView: vscode.WebviewView) {
            audioView = webviewView;
            webviewReady = false;

            webviewView.webview.options = {
                enableScripts: true,
                localResourceRoots: [
                    vscode.Uri.joinPath(context.extensionUri, 'webview'),
                    vscode.Uri.joinPath(context.extensionUri, 'media')
                ]
            };

            const htmlPath = path.join(
                context.extensionPath,
                'webview',
                'audioEngine.html'
            );

            const scriptUri = webviewView.webview.asWebviewUri(
                vscode.Uri.joinPath(
                    context.extensionUri,
                    'webview',
                    'audioEngine.js'
                )
            );

            const styleUri = webviewView.webview.asWebviewUri(
                vscode.Uri.joinPath(
                    context.extensionUri,
                    'webview',
                    'audioEngine.css'
                )
            );

            const audioUri = webviewView.webview.asWebviewUri(
                vscode.Uri.joinPath(
                    context.extensionUri,
                    'media',
                    'audio'
                )
            );

            let html = fs.readFileSync(htmlPath, 'utf8');

            html = html
                .replaceAll('{{CSP_SOURCE}}', webviewView.webview.cspSource)
                .replaceAll('{{SCRIPT_URI}}', scriptUri.toString())
                .replaceAll('{{AUDIO_URI}}', audioUri.toString())
                .replaceAll('{{STYLE_URI}}', styleUri.toString());

            webviewView.webview.html = html;

            webviewView.webview.onDidReceiveMessage(message => {
                if (!message || typeof message.type !== 'string') {
                    return;
                }

                if (message.type === 'ready') {
                    webviewReady = true;
                }

                if (message.type === 'audioState') {
                    audioActive = message.enabled === true;
                }
            });
        }
    }

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

    // RESTORE PREVIOUS EXTENSION STATE
    // (keep the extension open if you close vscode with the extenstion enabled)
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

    const documentListener = vscode.workspace.onDidChangeTextDocument(
        event => {
            console.log('[CyberType] Document changed');

            console.log('[CyberType] Audio active:', audioActive);
            console.log('[CyberType] Extension enabled:', extensionEnabled);
            const detectedSounds: string[] = [];

            for (const change of event.contentChanges) {
                const insertedText = change.text;

                if (insertedText.length === 0 && change.rangeLength > 0) {
                    detectedSounds.push('delete');
                    continue;
                }

                for (const character of insertedText) {
                    if (character === '\n') {
                        detectedSounds.push('enter');
                    } else if (character === '\r' || character === '\t') {
                        continue;
                    } else if (character === ' ') {
                        detectedSounds.push('spacebar');
                    } else if (/[\p{L}\p{N}]/u.test(character)) {
                        detectedSounds.push('typechar');
                    } else if (".,;:!?\"'()[]{}<>/\\-_=+*%$#@&~^|".includes(character)) {
                        detectedSounds.push('punctuation');
                    }
                }
            }

            if (detectedSounds.length > 0) {
                playSound(detectedSounds[0]);
                console.log('[CyberType] Detected sound:', detectedSounds[0]);
            }
        }
    );

    // RILEVAMENTO NUOVI ERRORI NELL'EDITOR

    const previousErrors = new Map<string, Set<string>>();

    const diagnosticListener = vscode.languages.onDidChangeDiagnostics(event => {

        if (!audioActive) {
            return;
        }

        for (const uri of event.uris) {

            const diagnostics = vscode.languages.getDiagnostics(uri);

            const currentErrors = new Set(
                diagnostics
                    .filter(diagnostic =>
                        diagnostic.severity === vscode.DiagnosticSeverity.Error
                    )
                    .map(diagnostic =>
                        `${diagnostic.range.start.line}:${diagnostic.range.start.character}:${diagnostic.message}`
                    )
            );

            const previous = previousErrors.get(uri.toString()) ?? new Set();

            const hasNewError = [...currentErrors].some(
                error => !previous.has(error)
            );

            if (hasNewError) {
                audioView?.webview.postMessage({
                    type: 'play',
                    sound: 'error'
                });
            }

            previousErrors.set(uri.toString(), currentErrors);
        }
    });

    context.subscriptions.push(diagnosticListener);

    const enableCommand = vscode.commands.registerCommand(
        'cybertype.enable',
        async () => {
            extensionEnabled = true;
            await context.globalState.update('cybertype.enabled', true);

            await vscode.commands.executeCommand(
                'setContext',
                'cybertype.enabled',
                true
            );

            await vscode.commands.executeCommand('workbench.view.explorer');

            audioView?.show(true);

            vscode.window.showInformationMessage(
                'CyberType enabled. Press PLAY AUDIO in the CyberType console.'
            );
        }
    );

    const disableCommand = vscode.commands.registerCommand(
        'cybertype.disable',
        async () => {
            extensionEnabled = false;
            await context.globalState.update('cybertype.enabled', false);
            audioActive = false;

            sendMessage('stop');

            await vscode.commands.executeCommand(
                'setContext',
                'cybertype.enabled',
                false
            );

            vscode.window.showInformationMessage('CyberType disabled.');
        }
    );

    context.subscriptions.push(
        viewRegistration,
        documentListener,
        enableCommand,
        disableCommand
    );
}

export function deactivate() {
    // VS Code gestisce la chiusura della Webview.
}