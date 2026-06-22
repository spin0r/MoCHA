# Subtitle Support Guide

## Overview

Your video player now supports subtitle uploads with automatic format conversion!

## Supported Formats

- **SRT** (.srt) - SubRip subtitle format (most common)
- **WebVTT** (.vtt) - Web Video Text Tracks format
- **ASS/SSA** (.ass, .ssa) - Advanced SubStation Alpha (limited support)

## How to Use

### 1. Load a Video

- Choose a local video file OR paste a video URL

### 2. Add Subtitles (Optional)

- Click the "Subtitle (Optional)" button
- Select your SRT, VTT, or ASS subtitle file
- The subtitle will be automatically converted to WebVTT format if needed

### 3. Play

- Click "Load" button
- Your video will play with subtitles!

## Features

### Automatic Conversion

- **SRT → WebVTT**: Automatically converts SRT files to WebVTT format
- **Format Detection**: Automatically detects subtitle format
- **Error Handling**: Shows clear error messages if conversion fails

### Subtitle Controls

- **Toggle**: Use DPlayer's built-in subtitle toggle button
- **Styling**: Subtitles use default styling (white text, 20px, 40px from bottom)
- **Positioning**: Subtitles appear at the bottom of the video

## Technical Details

### SRT Format Example

```srt
1
00:00:01,000 --> 00:00:04,000
Hello, this is a subtitle

2
00:00:04,500 --> 00:00:08,000
This is the second subtitle
```

### WebVTT Format Example

```vtt
WEBVTT

00:00:01.000 --> 00:00:04.000
Hello, this is a subtitle

00:00:04.500 --> 00:00:08.000
This is the second subtitle
```

### Conversion Process

1. File is read as UTF-8 text
2. Format is detected (SRT, WebVTT, or ASS)
3. If SRT: timestamps are converted (comma → period)
4. Subtitle numbers are removed (optional in WebVTT)
5. WebVTT header is added
6. Blob URL is created for the player

## Troubleshooting

### Subtitle Not Showing

- Check if subtitle file is in SRT or VTT format
- Ensure subtitle file encoding is UTF-8
- Verify subtitle timestamps match video duration
- Try toggling subtitles on/off in player controls

### Conversion Errors

- **"Unknown subtitle format"**: File may be corrupted or in unsupported format
- **"ASS format not fully supported"**: Convert ASS to SRT using online tools
- **"Failed to read subtitle file"**: Check file permissions and encoding

### Timing Issues

- Subtitles may be out of sync if:
  - Wrong subtitle file for the video
  - Subtitle file has incorrect timestamps
  - Video has been edited/trimmed

## Tips

1. **File Naming**: Name subtitle files same as video for easy identification
2. **Encoding**: Always use UTF-8 encoding for subtitle files
3. **Testing**: Test subtitles with a short video first
4. **Backup**: Keep original subtitle files before conversion
5. **Multiple Languages**: Load one subtitle at a time (switch by reloading)

## Keyboard Shortcuts

- **C**: Toggle subtitles on/off (DPlayer default)
- Use player controls for subtitle settings

## Browser Compatibility

- ✅ Chrome/Edge: Full support
- ✅ Firefox: Full support
- ✅ Safari: Full support
- ✅ Mobile browsers: Full support

## Future Enhancements

- Multiple subtitle track support
- Subtitle styling customization
- Subtitle delay adjustment
- Subtitle search/download integration
- ASS format full support with styling

---

**Note**: Subtitles are processed client-side. Your subtitle files are never uploaded to any server.
