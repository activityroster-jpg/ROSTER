#!/usr/bin/env bash
# Puts Conor's recorded voice on the how-to videos (see lib/videos/voiceover.ts).
# Run by .github/workflows/voiceovers.yml; also runs locally against the local
# storage for testing (R2_WHERE=--local).
#
# For each video with a recording newer than the last one applied:
#   take the ORIGINAL video (never an already-voiced one), keep its audio only
#   before the first line and after the last (logo sting, outro music), mute
#   the old narration in between, lay the recording over it (trimmed by the
#   moment the video started, cleaned and levelled), copy the picture as is.
#
# Env: BUCKET (activityroster-docs), R2_WHERE (--remote | --local),
#      R2_JURISDICTION (eu for staging, or empty), ONLY (comma-separated video
#      file names; blank = every video with a new recording), WRANGLER (command).
set -euo pipefail

BUCKET="${BUCKET:-activityroster-docs}"
R2_WHERE="${R2_WHERE:---remote}"
WRANGLER="${WRANGLER:-npx wrangler}"
JUR=()
if [ -n "${R2_JURISDICTION:-}" ]; then JUR=(--jurisdiction "$R2_JURISDICTION"); fi
here="$(cd "$(dirname "$0")" && pwd)"

r2get() { $WRANGLER r2 object get "$BUCKET/$1" --file "$2" "$R2_WHERE" "${JUR[@]}" > /dev/null 2>&1; }
r2put() { $WRANGLER r2 object put "$BUCKET/$1" --file "$2" --content-type "$3" "$R2_WHERE" "${JUR[@]}" > /dev/null; }
json() { node -e 'const o=JSON.parse(require("fs").readFileSync(process.argv[1],"utf8"));const v=o[process.argv[2]];process.stdout.write(v==null?"":String(v))' "$1" "$2"; }
secs() { awk -F'[:.,]' '{ if (NF==4) print $1*3600+$2*60+$3+$4/1000; else print $1*60+$2+$3/1000 }' <<<"$1"; }

# The video list, from the same source the website uses.
mapfile -t FILES < <(grep -oE 'file: "[0-9]{2}-[a-z0-9-]+"' "$here/../lib/learn/videos.ts" | sed -E 's/file: "(.*)"/\1/')
if [ -n "${ONLY:-}" ]; then IFS=',' read -r -a FILES <<<"${ONLY// /}"; fi

done_n=0; skipped=0; failed=0
for f in "${FILES[@]}"; do
  if ! [[ "$f" =~ ^[0-9]{2}-[a-z0-9-]+$ ]]; then echo "::warning::Not a video name: $f"; continue; fi
  tmp="$(mktemp -d)"
  if ! r2get "platform/voiceovers/$f/take.json" "$tmp/take.json"; then rm -rf "$tmp"; continue; fi
  recorded="$(json "$tmp/take.json" recordedAt)"
  offset_ms="$(json "$tmp/take.json" offsetMs)"
  if [ -z "${ONLY:-}" ] && r2get "platform/voiceovers/$f/applied.json" "$tmp/applied.json" && [ "$(json "$tmp/applied.json" recordedAt)" = "$recorded" ]; then
    echo "$f: already has this recording"; skipped=$((skipped + 1)); rm -rf "$tmp"; continue
  fi
  if ! r2get "platform/voiceovers/$f/take" "$tmp/take" || ! r2get "public/videos/$f.mp4" "$tmp/original.mp4"; then
    echo "::error::$f: the recording or the original video could not be fetched"; failed=$((failed + 1)); rm -rf "$tmp"; continue
  fi

  # Keep the original sound outside the narration: up to the first line, after the last.
  mute="volume=0"
  if r2get "public/videos/$f.vtt" "$tmp/captions.vtt"; then
    first="$(grep -m1 -- '-->' "$tmp/captions.vtt" | awk '{print $1}')"
    last="$(grep -- '-->' "$tmp/captions.vtt" | tail -1 | awk '{print $3}')"
    if [ -n "$first" ] && [ -n "$last" ]; then
      a="$(awk -v x="$(secs "$first")" 'BEGIN{printf "%.3f", (x>0.25?x-0.25:0)}')"
      b="$(awk -v x="$(secs "$last")" 'BEGIN{printf "%.3f", x+0.4}')"
      mute="volume=0:enable='between(t,$a,$b)'"
    fi
  fi
  # The recording started offsetMs before the video: trim that off (or pad if the video led).
  off="$(awk -v ms="${offset_ms:-0}" 'BEGIN{printf "%.3f", ms/1000}')"
  if awk -v o="$off" 'BEGIN{exit !(o<0)}'; then
    lead="$(awk -v o="$off" 'BEGIN{printf "%d", -o*1000}')"; trim="adelay=${lead}:all=1"
  else
    trim="atrim=start=${off},asetpts=PTS-STARTPTS"
  fi
  if ffmpeg -nostdin -loglevel error -y -i "$tmp/original.mp4" -i "$tmp/take" \
      -filter_complex "[0:a]${mute},aresample=48000[bg];[1:a]${trim},highpass=f=80,loudnorm=I=-16:TP=-1.5:LRA=11,aresample=48000[v];[bg][v]amix=inputs=2:duration=first:dropout_transition=0:normalize=0[a]" \
      -map 0:v -map "[a]" -c:v copy -c:a aac -b:a 160k -movflags +faststart "$tmp/voiced.mp4"; then
    r2put "public/videos/voiced/$f.mp4" "$tmp/voiced.mp4" video/mp4
    printf '{"recordedAt":"%s","appliedAt":"%s"}\n' "$recorded" "$(date -u +%Y-%m-%dT%H:%M:%SZ)" > "$tmp/applied.json"
    r2put "platform/voiceovers/$f/applied.json" "$tmp/applied.json" application/json
    echo "$f: voice added"; done_n=$((done_n + 1))
  else
    echo "::error::$f: ffmpeg could not combine the recording with the video"; failed=$((failed + 1))
  fi
  rm -rf "$tmp"
done

echo "Voice added to $done_n video(s); $skipped already up to date; $failed failed."
if [ -n "${GITHUB_STEP_SUMMARY:-}" ]; then echo "Voice added to **$done_n** video(s); $skipped already up to date; $failed failed." >> "$GITHUB_STEP_SUMMARY"; fi
[ "$failed" -eq 0 ]
