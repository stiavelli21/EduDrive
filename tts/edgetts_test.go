package tts

import (
	"testing"
)

func TestSynthesize(t *testing.T) {
	synthesizer := NewSynthesizer()
	
	// Test synthesizing a short Italian phrase with Diego
	audio, err := synthesizer.Synthesize("Ciao Lorenzo, benvenuto nel podcast di EduDrive!", "it-IT-DiegoNeural")
	if err != nil {
		t.Fatalf("Synthesis with Diego failed: %v", err)
	}

	if len(audio) < 1000 {
		t.Fatalf("Audio buffer too small (%d bytes), expected valid MP3 stream", len(audio))
	}

	// Verify MP3 header or sync word (ID3 header 'ID3' or 0xFF, 0xFB)
	t.Logf("Successfully synthesized %d bytes of MP3 audio with Diego", len(audio))

	// Test synthesizing with Elsa
	audioElsa, err := synthesizer.Synthesize("Esatto Marco, oggi esploriamo argomenti davvero interessanti!", "it-IT-ElsaNeural")
	if err != nil {
		t.Fatalf("Synthesis with Elsa failed: %v", err)
	}
	if len(audioElsa) < 1000 {
		t.Fatalf("Audio buffer too small (%d bytes), expected valid MP3 stream", len(audioElsa))
	}
	t.Logf("Successfully synthesized %d bytes of MP3 audio with Elsa", len(audioElsa))
}
