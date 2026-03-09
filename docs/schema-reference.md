# Project Config Schema Reference

The project configuration is a JSON file (`config.json`) stored at `data/projects/<id>/config.json`. It serves as the single source of truth for a project. The schema is validated with Zod (`packages/shared/src/schema.ts`).

This document describes every field so that an AI agent or external tool can generate a valid configuration programmatically.

## `ProjectConfig` (root object)

| Field        | Type                | Required | Description |
| ------------ | ------------------- | -------- | ----------- |
| `version`    | `"1.0"` (literal)   | yes      | Schema version. Must be exactly `"1.0"`. |
| `id`         | `string`            | yes      | Unique project identifier (UUID recommended). Also used as the directory name under `data/projects/`. |
| `name`       | `string`            | yes      | Human-readable project name. |
| `createdAt`  | `string` (ISO 8601) | yes      | Creation timestamp in ISO 8601 datetime format (e.g. `"2026-01-15T10:30:00.000Z"`). |
| `updatedAt`  | `string` (ISO 8601) | yes      | Last-modified timestamp in ISO 8601 datetime format. Updated on every save. |
| `resolution` | `object`            | yes      | Output video resolution. |
| `resolution.width`  | `integer > 0` | yes | Output width in pixels (e.g. `1920`). |
| `resolution.height` | `integer > 0` | yes | Output height in pixels (e.g. `1080`). |
| `fps`        | `number > 0`        | yes      | Output frame rate (e.g. `30`). |
| `sources`    | `SourceFile[]`      | yes      | Array of uploaded source files available for use on the timeline. Can be empty. |
| `timeline`   | `object`            | yes      | Timeline container. |
| `timeline.tracks` | `Track[]`      | yes      | Ordered array of tracks. Can be empty. Tracks are rendered top-to-bottom: text tracks first (overlays), then video, then audio. |

## `SourceFile`

Represents an uploaded media file. Metadata is populated by the server on upload via FFprobe.

| Field      | Type                              | Required | Default   | Description |
| ---------- | --------------------------------- | -------- | --------- | ----------- |
| `id`       | `string`                          | yes      |           | Unique source identifier (UUID). |
| `filename` | `string`                          | yes      |           | Original filename as uploaded (e.g. `"intro.mp4"`). |
| `path`     | `string`                          | yes      |           | Relative path to the file within the project directory (e.g. `"media/intro.mp4"`). Resolved relative to `data/projects/<id>/`. |
| `type`     | `"video" \| "image" \| "audio"`   | no       | `"video"` | Media type, determined by file extension on upload. |
| `duration` | `number >= 0`                     | yes      |           | Duration in seconds. `0` for images. |
| `width`    | `integer >= 0`                    | yes      |           | Width in pixels. `0` for audio files. |
| `height`   | `integer >= 0`                    | yes      |           | Height in pixels. `0` for audio files. |
| `fps`      | `number >= 0`                     | yes      |           | Frame rate. `0` for images and audio. |

## `Track`

A track holds an ordered list of clips. The project can contain multiple tracks of different types.

| Field       | Type                              | Required | Default   | Description |
| ----------- | --------------------------------- | -------- | --------- | ----------- |
| `id`        | `string`                          | yes      |           | Unique track identifier (UUID). |
| `name`      | `string`                          | yes      |           | Display name (e.g. `"Video"`, `"Audio"`, `"Text 1"`). |
| `type`      | `"video" \| "audio" \| "text"`    | no       | `"video"` | Track type. Determines which clip array is used and how clips are rendered. `"video"` tracks hold video/image clips; `"audio"` tracks hold audio clips; `"text"` tracks hold text overlays. |
| `clips`     | `Clip[]`                          | yes      |           | Array of media clips (used by `video` and `audio` tracks). Must be present even if empty. |
| `textClips` | `TextClip[]`                      | no       | `[]`      | Array of text overlay clips (used by `text` tracks). Defaults to empty array for backward compatibility. |

## `Clip`

A media clip placed on the timeline. References a source file and defines a time range within it.

| Field           | Type             | Required | Default | Description |
| --------------- | ---------------- | -------- | ------- | ----------- |
| `id`            | `string`         | yes      |         | Unique clip identifier (UUID). |
| `sourceId`      | `string`         | yes      |         | References a `SourceFile.id` in the `sources` array. |
| `inPoint`       | `number >= 0`    | yes      |         | Start time within the source file in seconds. For images, always `0`. |
| `outPoint`      | `number >= 0`    | yes      |         | End time within the source file in seconds. `outPoint - inPoint` is the clip duration. For images, this is the desired display duration. |
| `timelineStart` | `number >= 0`    | yes      |         | Position on the timeline in seconds where this clip begins. Clips must not overlap within a track. |
| `volume`        | `number` (0-1.5) | no       | `1`     | Playback volume multiplier. `0` = silent, `1` = original volume, `1.5` = 150%. Applied to video clips with embedded audio and to audio track clips. |
| `fadeIn`        | `number >= 0`    | no       | `0`     | Fade-in duration in seconds. Audio volume interpolates from the previous adjacent clip's volume (or silence if no adjacent clip) to this clip's volume over this duration. |
| `fadeOut`       | `number >= 0`    | no       | `0`     | Fade-out duration in seconds. Audio volume interpolates from this clip's volume to the next adjacent clip's volume (or silence) over this duration at the end of the clip. |

**Clip duration** is derived: `outPoint - inPoint`. There is no explicit `duration` field.

**Timeline positioning**: Clips within a track are ordered by `timelineStart`. Gaps between clips produce black frames (video) or silence (audio). Clips must not overlap.

## `TextClip`

A text overlay clip placed on a text track. Rendered as styled text at a given position over the video.

| Field           | Type             | Required | Default                          | Description |
| --------------- | ---------------- | -------- | -------------------------------- | ----------- |
| `id`            | `string`         | yes      |                                  | Unique text clip identifier (UUID). |
| `content`       | `string` (min 1) | yes      |                                  | The text to display. Single-line. |
| `timelineStart` | `number >= 0`    | yes      |                                  | Position on the timeline in seconds where this text appears. |
| `duration`      | `number >= 0.1`  | yes      |                                  | How long the text is visible, in seconds. Minimum 0.1s. |
| `style`         | `TextStyle`      | yes      |                                  | Visual styling for the text. See below. |
| `position`      | `object`         | yes      |                                  | Position of the text center point within the video frame. |
| `position.x`    | `number` (0-100) | no       | `50`                             | Horizontal position as a percentage of the video width. `0` = left edge, `50` = center, `100` = right edge. |
| `position.y`    | `number` (0-100) | no       | `50`                             | Vertical position as a percentage of the video height. `0` = top edge, `50` = center, `100` = bottom edge. |
| `animationIn`   | `TextAnimation`  | no       | `{ type: "none", duration: 0 }`  | Entrance animation. The text animates in over the specified duration at the start of the clip. |
| `animationOut`  | `TextAnimation`  | no       | `{ type: "none", duration: 0 }`  | Exit animation. The text animates out over the specified duration at the end of the clip. Only `fade` and `slide` are supported for exit (not `typewriter`). |

## `TextStyle`

Styling properties for a text clip.

| Field        | Type                | Required | Default      | Description |
| ------------ | ------------------- | -------- | ------------ | ----------- |
| `fontFamily` | `string`            | no       | `"Roboto"`   | Font family name. Must match one of the bundled fonts (see the Bundled Fonts section in [README.md](../README.md#bundled-fonts)). |
| `fontSize`   | `number` (8-500)    | no       | `48`         | Font size in pixels, relative to the output resolution. |
| `color`      | `string` (`#RRGGBB`)| no       | `"#FFFFFF"`  | Text color as a 6-digit hex string. |
| `bold`       | `boolean`           | no       | `false`      | Whether to use the bold variant of the font. |
| `italic`     | `boolean`           | no       | `false`      | Whether to use the italic variant of the font. |

## `TextAnimation`

Defines an entrance or exit animation for a text clip.

| Field       | Type                                           | Required | Default    | Description |
| ----------- | ---------------------------------------------- | -------- | ---------- | ----------- |
| `type`      | `"none" \| "fade" \| "slide" \| "typewriter"`  | no       | `"none"`   | Animation type. `"none"` = instant appear/disappear. `"fade"` = opacity transition. `"slide"` = text slides in/out from a screen edge. `"typewriter"` = characters appear one by one (entrance only). |
| `duration`  | `number` (0-30)                                | no       | `0`        | Animation duration in seconds. `0` = instant (same as `"none"`). |
| `direction` | `"left" \| "right" \| "top" \| "bottom"`       | no       |            | Slide direction. Only used when `type` is `"slide"`. Specifies which edge the text slides from (entrance) or towards (exit). |
| `alignment` | `"center" \| "left"`                           | no       |            | Typewriter text alignment. Only used when `type` is `"typewriter"`. `"center"` = text expands from the center point. `"left"` = text fills left-to-right from the position point. |

**Animation behavior**:
- **Fade in**: Opacity goes from 0 to 1 over `duration` seconds at the start of the clip. Fade out: opacity goes from 1 to 0 over `duration` seconds at the end. Both can be combined.
- **Slide in**: Text starts fully off-screen in the specified `direction` and moves to its target position over `duration` seconds. Slide out: text moves from its position to off-screen.
- **Typewriter**: Characters appear one at a time over `duration` seconds. Only valid as `animationIn` (not `animationOut`).

## Complete Example

```json
{
  "version": "1.0",
  "id": "abc123",
  "name": "My Video Project",
  "createdAt": "2026-01-15T10:00:00.000Z",
  "updatedAt": "2026-01-15T12:30:00.000Z",
  "resolution": { "width": 1920, "height": 1080 },
  "fps": 30,
  "sources": [
    {
      "id": "src-1",
      "filename": "intro.mp4",
      "path": "media/intro.mp4",
      "type": "video",
      "duration": 15.5,
      "width": 1920,
      "height": 1080,
      "fps": 30
    },
    {
      "id": "src-2",
      "filename": "background.mp3",
      "path": "media/background.mp3",
      "type": "audio",
      "duration": 120,
      "width": 0,
      "height": 0,
      "fps": 0
    },
    {
      "id": "src-3",
      "filename": "logo.png",
      "path": "media/logo.png",
      "type": "image",
      "duration": 0,
      "width": 800,
      "height": 600,
      "fps": 0
    }
  ],
  "timeline": {
    "tracks": [
      {
        "id": "track-text",
        "name": "Text 1",
        "type": "text",
        "clips": [],
        "textClips": [
          {
            "id": "tc-1",
            "content": "Welcome!",
            "timelineStart": 1,
            "duration": 4,
            "style": {
              "fontFamily": "Montserrat",
              "fontSize": 72,
              "color": "#FFCC00",
              "bold": true,
              "italic": false
            },
            "position": { "x": 50, "y": 30 },
            "animationIn": { "type": "fade", "duration": 0.5 },
            "animationOut": { "type": "slide", "duration": 0.8, "direction": "right" }
          },
          {
            "id": "tc-2",
            "content": "Presented by Studio X",
            "timelineStart": 5,
            "duration": 5,
            "style": {
              "fontFamily": "Source Code Pro",
              "fontSize": 36,
              "color": "#FFFFFF",
              "bold": false,
              "italic": false
            },
            "position": { "x": 20, "y": 80 },
            "animationIn": { "type": "typewriter", "duration": 2, "alignment": "left" }
          }
        ]
      },
      {
        "id": "track-video",
        "name": "Video",
        "type": "video",
        "clips": [
          {
            "id": "clip-1",
            "sourceId": "src-1",
            "inPoint": 0,
            "outPoint": 10,
            "timelineStart": 0,
            "volume": 0.8,
            "fadeIn": 0,
            "fadeOut": 1.5
          },
          {
            "id": "clip-2",
            "sourceId": "src-3",
            "inPoint": 0,
            "outPoint": 5,
            "timelineStart": 10,
            "volume": 1,
            "fadeIn": 0,
            "fadeOut": 0
          }
        ],
        "textClips": []
      },
      {
        "id": "track-audio",
        "name": "Audio",
        "type": "audio",
        "clips": [
          {
            "id": "clip-3",
            "sourceId": "src-2",
            "inPoint": 0,
            "outPoint": 15,
            "timelineStart": 0,
            "volume": 0.3,
            "fadeIn": 2,
            "fadeOut": 3
          }
        ],
        "textClips": []
      }
    ]
  }
}
```

This example produces a 15-second video:
- A video clip (10s) followed by a logo image (5s) on the video track
- Background music at 30% volume with 2s fade-in and 3s fade-out on the audio track
- A "Welcome!" title (fade in, slide out right) from 1-5s and a typewriter "Presented by Studio X" from 5-10s on the text track
