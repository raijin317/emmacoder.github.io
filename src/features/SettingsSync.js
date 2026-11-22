import { useEffect } from "react";
import { api } from "@/lib/client/api.js";
import { configureSpeech, loadVoices } from "@/lib/client/speech.js";
import { setSoundOn } from "@/lib/client/sfx.js";
import { loadModel, naturalVoiceAllowed, warmVoices } from "@/lib/client/tts.js";
export function applySettings(s) {
    configureSpeech({ engine: s.ttsEngine, voice: s.ttsVoice, voiceName: s.voiceName, childRate: s.childRate });
    setSoundOn(s.soundOn);
}
/** Applies the family's voice/sound settings in the browser. */
export function SettingsSync() {
    useEffect(() => {
        void loadVoices();
        api("/api/settings")
            .then(({ settings }) => {
            applySettings(settings);
            // Natural voice on (and downloaded with the parent's OK): start the engine now so the first tap is quick,
            // then quietly make the voice for every lesson that isn't ready yet.
            if (settings.ttsEngine === "natural" && naturalVoiceAllowed()) {
                loadModel().catch(() => { });
                warmVoices(10_000);
            }
        })
            .catch(() => { });
    }, []);
    return null;
}
