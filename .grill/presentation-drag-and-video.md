# Grill: Move slide blocks, and play one local video
Date: 2026-10-19

## Intent

On a slide, a text box, the title, a picture, and a video are blocks. You can drag a block to a new place and drag its rim to resize it. A video is a local mp4 that plays, with sound, on the slide while you edit. Save stores that video inside the pptx.

## Constraints

- Files stay on this machine. No upload, no online video, no transcoding.
- There is no size number in the UI. A very large file may stutter.
- Save either embeds the whole mp4 or stops and says it did not. A failed save leaves the pptx already on disk untouched.
- One video per slide. A second add is refused. Delete the current video to choose a different file. Other slides can each have one.
- New on-screen copy does not use the word PowerPoint. The warning says other presentation programs may not play the file.
- The playhead is remembered only while the file is open. Save does not write it. Reopening starts at the beginning, paused.

## Key decisions

- Decision: drag the inside of a selected block to move it; drag the rim to resize. Reason: the border is easy to miss, and the rim is how the box changes shape. Alternative considered: moving only from the dashed border, or typing a width and height.
- Decision: the first click selects a text box, a drag inside moves it, and a second click inside types. Reason: typing and moving share the same box. Alternative considered: the inside always types.
- Decision: the box may be any shape. Pictures and video stay in proportion inside it. Text reflows. A block cannot shrink below a grabbable size. No rotation. Reason: stretching the meter photo was rejected. Alternative considered: stretch the media, or lock the box shape.
- Decision: stacking stays in the order blocks were added. Selecting a block does not jump it forward, even while it is selected. Reason: what you see is what Save writes. Alternative considered: bring forward / send back, or keeping the selected block in front.
- Decision: one undo slot for the last move or resize, from Ctrl+Z and an Undo control. No redo. Typing, formatting, adding, deleting, or moving another block replaces the slot. Delete is not undone. Reason: a bad drag should be reversible without a full history. Alternative considered: no undo, or a stack of every move.
- Decision: one local mp4, with sound, embedded in the pptx. Click selects the video and does not start it. Play, pause, and seek stay on the block even when another block is selected. Sound keeps going while you edit that same slide. It pauses when you change slides, delete the video, or press pause. Coming back does not start it. Reason: playback and dragging were fighting, and the video should keep playing while the title is edited. Alternative considered: click-to-play, silent playback, a still frame, or a full-screen show.
- Decision: Folio also plays an mp4 that was already in a pptx. The first mp4 on the slide is kept. Further videos, and videos that are not mp4, are reported and dropped on the next successful save. Audio that is not inside a video is reported and dropped the same way. Reason: Save rewrites the file from the slide. Alternative considered: blocking Save, or keeping hidden videos in the package.
- Decision: an mp4 the browser can play is added even when it does not look like H.264, with a warning that other presentation programs may not play it. A file that is not an mp4, or that the browser cannot play, is refused. No conversion. Reason: playback here is the promise, and other programs are picky about codecs. Alternative considered: refusing anything that is not H.264, or warning on every video.
- Decision: playback is in the editor only. Reason: another program presents the saved file. Alternative considered: a full-screen show in Folio.

## Surfaced assumptions

- The title is a text block, not a separate kind of object.
- Empty bands around a picture or video show the slide behind them.
- The smallest block is 48 pixels on the canvas, converted to a percentage of that canvas.
- The warning the user asked to aim at PowerPoint is shown as "other presentation programs" so new UI copy stays inside the product rule.
- Drafts still store the video inside the presentation, the same way pictures are stored. There is no second copy on each keystroke beyond the draft write that already exists.
- A non-mp4 that sits before an mp4 on the same slide is skipped, and the first mp4 is the one kept.
- Undo restores position and size only. It does not restore the playhead, a deleted block, or an added video.

## Out of scope

- Snap, dropping a file from Explorer, moving several blocks at once, rotation, redo, and a full-screen show.
- Slide animation, transition sound, and online video.
- A volume slider, loop, and a size cap shown in the UI.
- LibreOffice playback as a promise.
- Undo for text edits, delete, or add.
