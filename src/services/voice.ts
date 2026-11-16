/**
 * Voice output for AstraHealth (first command: the login welcome).
 *
 * Uses the browser's built-in speech (Web Speech API): free, instant, works offline,
 * no AI key. Browsers only allow speech after the user has clicked something on the
 * page, so call speak() from a flow that starts with a click (e.g. the Log in button).
 */

/** Abbreviated titles and how they are said aloud. */
const TITLES: Record<string, string> = {
  cmdr: 'Commander',
  cdr: 'Commander',
  dr: 'Doctor',
  spc: 'Specialist',
  capt: 'Captain',
  cpt: 'Captain',
  lt: 'Lieutenant',
  maj: 'Major',
  col: 'Colonel',
  sgt: 'Sergeant',
  prof: 'Professor',
  mr: 'Mister',
  mrs: 'Missus',
  ms: 'Ms',
}

/**
 * How the welcome addresses someone: title + surname ("Cmdr. Maya Okafor" →
 * "Commander Okafor"). Names without a title are used as written ("Mission Control").
 */
export function welcomeName(displayName: string): string {
  const words = displayName.trim().split(/\s+/).filter(Boolean)
  if (!words.length) return ''
  const title = TITLES[words[0].replace(/\.$/, '').toLowerCase()]
  if (title && words.length > 1) return `${title} ${words[words.length - 1]}`
  return words.join(' ')
}

/** The welcome line shown on screen and spoken. */
export function welcomeText(displayName: string): string {
  const name = welcomeName(displayName)
  return name ? `Welcome, ${name}` : 'Welcome aboard'
}

export function canSpeak(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window && typeof SpeechSynthesisUtterance !== 'undefined'
}

/** Voices load asynchronously in some browsers; wait briefly for them. */
function loadVoices(timeoutMs = 800): Promise<SpeechSynthesisVoice[]> {
  const now = window.speechSynthesis.getVoices()
  if (now.length) return Promise.resolve(now)
  return new Promise((resolve) => {
    const done = () => {
      window.speechSynthesis.removeEventListener('voiceschanged', done)
      resolve(window.speechSynthesis.getVoices())
    }
    window.speechSynthesis.addEventListener('voiceschanged', done)
    setTimeout(done, timeoutMs)
  })
}

/** An English voice, preferring the device's own language and on-device voices. */
function pickVoice(voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice | undefined {
  const lang = (navigator.language || 'en-US').toLowerCase()
  const english = voices.filter((v) => v.lang.toLowerCase().startsWith('en'))
  return (
    english.find((v) => v.lang.toLowerCase() === lang && v.localService) ??
    english.find((v) => v.lang.toLowerCase() === lang) ??
    english.find((v) => v.localService) ??
    english[0]
  )
}

let last = { text: '', at: 0 }

/**
 * Speak a short line. Resolves when it finishes, fails or speech is unavailable
 * (never rejects), so the UI never waits on the voice.
 */
export async function speak(text: string): Promise<void> {
  if (!canSpeak() || !text) return
  // The same line asked for twice in a row (e.g. React re-running an effect) is said once.
  const now = Date.now()
  if (last.text === text && now - last.at < 2000) return
  last = { text, at: now }
  try {
    const synth = window.speechSynthesis
    synth.cancel() // never queue behind an older line
    const voice = pickVoice(await loadVoices())
    await new Promise<void>((resolve) => {
      const u = new SpeechSynthesisUtterance(text)
      if (voice) {
        u.voice = voice
        u.lang = voice.lang
      } else u.lang = 'en-US'
      u.rate = 1
      u.pitch = 1
      u.onend = () => resolve()
      u.onerror = () => resolve()
      synth.speak(u)
      setTimeout(resolve, 6000) // safety: some browsers never fire onend
    })
  } catch {
    // Speech is a nice-to-have; the on-screen welcome is the source of truth.
  }
}
