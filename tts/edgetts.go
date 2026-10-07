package tts

import (
	"crypto/rand"
	"crypto/sha256"
	"encoding/binary"
	"encoding/hex"
	"fmt"
	"net/http"
	"net/url"
	"strings"
	"sync"
	"time"

	"github.com/google/uuid"
	"github.com/gorilla/websocket"
)

const (
	trustedClientToken   = "6A5AA1D4EAFF4E9FB37E23D68491D6F4"
	chromiumFullVersion  = "143.0.3650.75"
	chromiumMajorVersion = "143"
	secMsGecVersion      = "1-" + chromiumFullVersion
	outputFormat         = "audio-24khz-48kbitrate-mono-mp3"
	winEpochSeconds      = 11644473600
)

// Synthesizer communicates with Microsoft Edge Read Aloud service to produce neural speech
type Synthesizer struct {
	mu sync.Mutex
}

// NewSynthesizer creates a new Edge-TTS speech synthesizer
func NewSynthesizer() *Synthesizer {
	return &Synthesizer{}
}

// generateSecMsGec calculates the time-based token required by Edge TTS
func generateSecMsGec(skewSeconds float64) string {
	// Current unix timestamp with skew
	unixNow := float64(time.Now().UTC().Unix()) + skewSeconds

	// Switch to Windows file time epoch (1601-01-01)
	ticks := unixNow + winEpochSeconds

	// Round down to nearest 5 minutes (300 seconds)
	ticks -= float64(int64(ticks) % 300)

	// Convert seconds to 100-nanosecond ticks (1s = 10,000,000 ticks)
	fileTicks := int64(ticks * 10000000)

	raw := fmt.Sprintf("%d%s", fileTicks, trustedClientToken)
	hash := sha256.Sum256([]byte(raw))
	return strings.ToUpper(hex.EncodeToString(hash[:]))
}

// generateMUID generates a random 32-character hex string for the cookie
func generateMUID() string {
	bytes := make([]byte, 16)
	if _, err := rand.Read(bytes); err != nil {
		return strings.ToUpper(strings.ReplaceAll(uuid.New().String(), "-", ""))
	}
	return strings.ToUpper(hex.EncodeToString(bytes))
}

// dateToString returns a JS-style UTC date string required by Edge protocol
func dateToString() string {
	return time.Now().UTC().Format("Mon Jan 02 2006 15:04:05 GMT+0000 (Coordinated Universal Time)")
}

// escapeXML escapes standard XML special characters in SSML text
func escapeXML(s string) string {
	s = strings.ReplaceAll(s, "&", "&amp;")
	s = strings.ReplaceAll(s, "<", "&lt;")
	s = strings.ReplaceAll(s, ">", "&gt;")
	s = strings.ReplaceAll(s, "\"", "&quot;")
	s = strings.ReplaceAll(s, "'", "&apos;")
	return s
}

// cleanText removes control characters that Edge TTS rejects
func cleanText(s string) string {
	return strings.Map(func(r rune) rune {
		if (r >= 0 && r <= 8) || (r >= 11 && r <= 12) || (r >= 14 && r <= 31) {
			return ' '
		}
		return r
	}, s)
}

// Synthesize generates an MP3 audio buffer from text using the specified neural voice
func (s *Synthesizer) Synthesize(text string, voiceName string) ([]byte, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	text = cleanText(strings.TrimSpace(text))
	if text == "" {
		return nil, fmt.Errorf("text cannot be empty")
	}

	if voiceName == "" {
		voiceName = "it-IT-DiegoNeural"
	}

	// Try without skew first, if 403 occurs with Date header, retry with skew
	audio, err := s.trySynthesize(text, voiceName, 0)
	if err != nil && strings.Contains(err.Error(), "403") {
		// Try with a small negative skew in case system clock is slightly ahead
		audio, err = s.trySynthesize(text, voiceName, -300)
	}

	return audio, err
}

func (s *Synthesizer) trySynthesize(text string, voiceName string, skewSeconds float64) ([]byte, error) {
	connID := strings.ReplaceAll(uuid.New().String(), "-", "")
	secMsGec := generateSecMsGec(skewSeconds)

	wsURL := fmt.Sprintf(
		"wss://speech.platform.bing.com/consumer/speech/synthesize/readaloud/edge/v1?TrustedClientToken=%s&ConnectionId=%s&Sec-MS-GEC=%s&Sec-MS-GEC-Version=%s",
		trustedClientToken, connID, secMsGec, secMsGecVersion,
	)

	parsedURL, err := url.Parse(wsURL)
	if err != nil {
		return nil, err
	}

	header := http.Header{}
	header.Set("User-Agent", fmt.Sprintf("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/%s.0.0.0 Safari/537.36 Edg/%s.0.0.0", chromiumMajorVersion, chromiumMajorVersion))
	header.Set("Origin", "chrome-extension://jdiccldimpdaibmpdkjnbmckianbfold")
	header.Set("Pragma", "no-cache")
	header.Set("Cache-Control", "no-cache")
	header.Set("Accept-Encoding", "gzip, deflate, br, zstd")
	header.Set("Accept-Language", "it-IT,it;q=0.9,en;q=0.8")
	header.Set("Cookie", fmt.Sprintf("muid=%s;", generateMUID()))

	dialer := websocket.Dialer{
		HandshakeTimeout: 10 * time.Second,
	}

	ws, resp, err := dialer.Dial(parsedURL.String(), header)
	if err != nil {
		if resp != nil {
			return nil, fmt.Errorf("websocket dial failed (status %s): %w", resp.Status, err)
		}
		return nil, fmt.Errorf("websocket dial failed: %w", err)
	}
	defer ws.Close()

	timestamp := dateToString()

	// 1. Send speech.config
	speechConfigMsg := fmt.Sprintf(
		"X-Timestamp:%s\r\nContent-Type:application/json; charset=utf-8\r\nPath:speech.config\r\n\r\n"+
			`{"context":{"synthesis":{"audio":{"metadataoptions":{"sentenceBoundaryEnabled":"false","wordBoundaryEnabled":"true"},"outputFormat":"%s"}}}}`,
		timestamp, outputFormat,
	)
	if err := ws.WriteMessage(websocket.TextMessage, []byte(speechConfigMsg)); err != nil {
		return nil, fmt.Errorf("failed to send speech config: %w", err)
	}

	// 2. Send SSML request
	reqID := strings.ReplaceAll(uuid.New().String(), "-", "")
	escaped := escapeXML(text)
	ssml := fmt.Sprintf(
		"<speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xml:lang='it-IT'>"+
			"<voice name='%s'>"+
			"<prosody pitch='+0Hz' rate='+0%%' volume='+0%%'>%s</prosody>"+
			"</voice>"+
			"</speak>",
		voiceName, escaped,
	)

	ssmlMsg := fmt.Sprintf(
		"X-RequestId:%s\r\nContent-Type:application/ssml+xml\r\nX-Timestamp:%sZ\r\nPath:ssml\r\n\r\n%s",
		reqID, timestamp, ssml,
	)
	if err := ws.WriteMessage(websocket.TextMessage, []byte(ssmlMsg)); err != nil {
		return nil, fmt.Errorf("failed to send ssml message: %w", err)
	}

	// 3. Collect binary audio chunks until turn.end
	var audioBuffer []byte
	ws.SetReadDeadline(time.Now().Add(30 * time.Second))

	for {
		msgType, data, err := ws.ReadMessage()
		if err != nil {
			return nil, fmt.Errorf("read error: %w", err)
		}

		if msgType == websocket.BinaryMessage {
			if len(data) >= 2 {
				headerLen := binary.BigEndian.Uint16(data[0:2])
				if int(2+headerLen) <= len(data) {
					headerStr := string(data[2 : 2+headerLen])
					if strings.Contains(headerStr, "Path:audio") {
						payload := data[2+headerLen:]
						audioBuffer = append(audioBuffer, payload...)
					}
				}
			}
		} else if msgType == websocket.TextMessage {
			textMsg := string(data)
			if strings.Contains(textMsg, "Path:turn.end") {
				break
			}
		}
	}

	if len(audioBuffer) == 0 {
		return nil, fmt.Errorf("no audio received from speech service")
	}

	return audioBuffer, nil
}
