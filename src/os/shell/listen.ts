// src/os/shell/listen.ts
//
// Real speech-to-text via the browser's Web Speech API. Adapted from the
// uploaded reference zip's io/speech/sttListener.ts -- that file was
// genuinely real (unlike the browser-automation fragments from the same
// upload), so this is a faithful port, not a rewrite. No backend or API
// key required; entirely client-side. Throws real, specific errors
// (permission denied, unsupported browser) rather than failing silently.

interface SpeechRecognitionLike {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((event: { results: { [i: number]: { [j: number]: { transcript: string } } } }) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
}

export async function listen(): Promise<string> {
  const w = window as unknown as { SpeechRecognition?: new () => SpeechRecognitionLike; webkitSpeechRecognition?: new () => SpeechRecognitionLike };
  const SpeechRecognition = w.SpeechRecognition ?? w.webkitSpeechRecognition;

  if (!SpeechRecognition) {
    throw new Error('Speech recognition is not supported in this browser. Use Chrome, Edge, or Safari.');
  }

  return new Promise((resolve, reject) => {
    const recognition = new SpeechRecognition();
    recognition.lang = 'en-US';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    let handled = false;

    recognition.onresult = (event) => {
      handled = true;
      resolve(event.results?.[0]?.[0]?.transcript ?? '');
    };
    recognition.onerror = (event) => {
      handled = true;
      if (event.error === 'no-speech' || event.error === 'aborted') { resolve(''); return; }
      if (event.error === 'not-allowed') { reject(new Error('Microphone permission denied.')); return; }
      reject(new Error(event.error || 'Speech recognition error.'));
    };
    recognition.onend = () => { if (!handled) resolve(''); };

    try {
      recognition.start();
    } catch (e) {
      reject(e instanceof Error ? e : new Error(String(e)));
    }
  });
}
