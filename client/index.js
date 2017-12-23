require('bootstrap/dist/css/bootstrap.min.css');
require('font-awesome/css/font-awesome.min.css');
require('./app.scss');

const srtParser = require('subtitles-parser');
const createElement = require('virtual-dom/create-element');
const EventEmitter = require('event-emitter');
const Playlist = require('waveform-playlist/lib/Playlist');

const YTID = window.location.pathname.substring(1);
window.OfflineAudioContext = window.OfflineAudioContext || window.webkitOfflineAudioContext;
window.AudioContext = window.AudioContext || window.webkitAudioContext;
const audioContext = new window.AudioContext();

const video = document.getElementById('video');
const captionTrack = video.addTextTrack("captions", "English", "en");
captionTrack.mode = "showing";
const cueList = [];

var actions = [
  {
    class: 'fa.fa-minus.anno-end-minus',
    title: 'Reduce annotation end by 0.010s',
    action: function (annotation, i, annotations, opts) {
      var next;
      var delta = 0.010;
      annotations[i] = this.updateAnnotation(
        annotation.id,
        annotation.start,
        annotation.end - delta,
        annotation.lines,
        annotation.lang
      );

      // update text track cue
      const cue = cueList[i]
      captionTrack.removeCue(cue);
      const updatedCue = new VTTCue(annotation.start, annotation.end, annotation.lines.join('\n'));
      cueList[i] = updatedCue;
      captionTrack.addCue(updatedCue);

      return annotations;
    }
  },
  {
    class: 'fa.fa-plus.anno-end-plus',
    title: 'Increase annotation end by 0.010s',
    action: function (annotation, i, annotations, opts) {
      var next;
      var delta = 0.010;
      annotations[i] = this.updateAnnotation(
        annotation.id,
        annotation.start,
        annotation.end + delta,
        annotation.lines,
        annotation.lang
      );

      // update text track cue
      const cue = cueList[i]
      captionTrack.removeCue(cue);
      const updatedCue = new VTTCue(annotation.start, annotation.end, annotation.lines.join('\n'));
      cueList[i] = updatedCue;
      captionTrack.addCue(updatedCue);

      return annotations;
    }
  },
  {
    class: 'fa.fa-scissors',
    title: 'Split annotation in half',
    action: function (annotation, i, annotations) {
      const halfDuration = (annotation.end - annotation.start) / 2;
      const newAnnotation = this.updateAnnotation(
        i + 2,
        annotation.end - halfDuration,
        annotation.end,
        ['----'],
        annotation.lang
      );

      annotations[i] = this.updateAnnotation(
        annotation.id,
        annotation.start,
        annotation.start + halfDuration,
        annotation.lines,
        annotation.lang
      );
      annotations.splice(i + 1, 0, newAnnotation);

      // update text track cue
      captionTrack.removeCue(cueList[i]);
      const annotationOne = annotations[i];
      const updatedCueOne = new VTTCue(annotationOne.start, annotationOne.end, annotationOne.lines.join('\n'));
      const annotationTwo = annotations[i + 1];
      const updatedCueTwo = new VTTCue(annotationTwo.start, annotationTwo.end, annotationTwo.lines.join('\n'));
      captionTrack.addCue(updatedCueOne);
      captionTrack.addCue(updatedCueTwo);

      cueList[i] = updatedCueOne;
      cueList.splice(i + 1, 0, updatedCueTwo);

      // loop though and increment ids
      for (let idIndex = i + 2; idIndex < annotations.length; idIndex += 1) {
        let annotation = annotations[idIndex];
        annotation.id = `${idIndex + 1}`;
      }

      return annotations;
    }
  },
  {
    class: 'fa.fa-trash',
    title: 'Delete annotation',
    action: function (annotation, i, annotations) {
      annotations.splice(i, 1);

      // update text track cue
      const removedCues = cueList.splice(i, 1);
      captionTrack.removeCue(removedCues[0]);

      // loop though and decrement ids
      for (let idIndex = i; idIndex < annotations.length; idIndex += 1) {
        let annotation = annotations[idIndex];
        annotation.id = `${idIndex + 1}`;
      }

      return annotations;
    }
  }
];

fetch(`${YTID}.srt`)
  .then((response) => {
    return response.text();
  })
  .then((srt) => {
    const subtitleData = srtParser.fromSrt(srt, true);
    const annotations = subtitleData.map((subtitle) => {
      const startSec = subtitle.startTime / 1000;
      const endSec = subtitle.endTime / 1000;
      const cue = new VTTCue(startSec, endSec, subtitle.text);
      cueList.push(cue);
      captionTrack.addCue(cue);

      return {
        id: subtitle.id,
        begin: startSec,
        end: endSec,
        lines: subtitle.text.split('\n')
      };
    });

    const playlist = new Playlist.default();
    playlist.setSampleRate(audioContext.sampleRate);
    playlist.setSamplesPerPixel(1500);
    playlist.setAudioContext(audioContext);
    playlist.setEventEmitter(EventEmitter());
    playlist.setTimeSelection(0, 0);
    playlist.setDurationFormat('hh:mm:ss.uu');
    playlist.setState('cursor');
    playlist.setControlOptions({
      show: false,
      width: 150,
    });
    playlist.setWaveHeight(96);
    playlist.setColors({
      waveOutlineColor: '#000',
      timeColor: 'grey',
      fadeColor: 'black'
    });
    playlist.setZoomLevels([1200, 1500, 1800]);
    playlist.setZoomIndex(1);
    playlist.setMono(true);
    playlist.setExclSolo(false);
    playlist.setShowTimeScale(true);
    playlist.setSeekStyle('line');
    playlist.setAnnotations({
      annotations: annotations,
      controls: actions,
      editable: true,
      isContinuousPlay: false,
      linkEndpoints: false
    });
    playlist.setIsAutomaticScroll(true);

    // take care of initial virtual dom rendering.
    const tree = playlist.render();
    const rootNode = createElement(tree);
    const container = document.getElementById("playlist");

    container.appendChild(rootNode);
    playlist.tree = tree;
    playlist.rootNode = rootNode;

    playlist.load([
      {
        src: `${YTID}.ogg`
      }
    ]).then(function() {
      //can do stuff with the playlist.
    });

    // SETUP EVENTS
    // TODO PUT IN VIRTUAL DOM AS WELL
    var ee = playlist.getEventEmitter();
    const currentDisplayTime = document.querySelector('.audio-pos');

    var format = "hh:mm:ss.uuu";
    var audioPos = 0;
    var playoutPromises;
    var stopVideoAt;

    video.addEventListener('timeupdate', () => {
      if (stopVideoAt && stopVideoAt < video.currentTime) {
        video.pause();
      }
    });

    function cueFormatters(format) {

      function clockFormat(seconds, decimals) {
        var hours,
            minutes,
            secs,
            result;

        hours = parseInt(seconds / 3600, 10) % 24;
        minutes = parseInt(seconds / 60, 10) % 60;
        secs = seconds % 60;
        secs = secs.toFixed(decimals);

        result = (hours < 10 ? "0" + hours : hours) + ":" + (minutes < 10 ? "0" + minutes : minutes) + ":" + (secs < 10 ? "0" + secs : secs);

        return result;
      }

      var formats = {
        "seconds": function (seconds) {
            return seconds.toFixed(0);
        },
        "thousandths": function (seconds) {
            return seconds.toFixed(3);
        },
        "hh:mm:ss": function (seconds) {
            return clockFormat(seconds, 0);   
        },
        "hh:mm:ss.u": function (seconds) {
            return clockFormat(seconds, 1);   
        },
        "hh:mm:ss.uu": function (seconds) {
            return clockFormat(seconds, 2);   
        },
        "hh:mm:ss.uuu": function (seconds) {
            return clockFormat(seconds, 3);   
        }
      };

      return formats[format];
    }

    function updateSelect(start, end) {
      video.currentTime = start;
    }

    function updateTime(time) {
      currentDisplayTime.innerHTML = cueFormatters(format)(time);
      audioPos = time;
    }

    updateTime(audioPos);

    const annotationsDownloadCtrl = document.querySelector('.btn-annotations-download');
    annotationsDownloadCtrl.onclick = () => {
      const output = playlist.annotations.map((annotation) => {
        return {
          id: annotation.id,
          startTime: annotation.start * 1000,
          endTime: annotation.end * 1000,
          text: annotation.lines.join('\n').trim()
        }
      });

      const srtData = srtParser.toSrt(output);
      const dataStr = `data:text/plain;charset=utf-8,${srtData}`;
      const a = document.createElement('a');
      const sec = Date.now();

      document.body.appendChild(a);
      a.href = dataStr;
      a.download = `Mogensen-${sec}.srt`;
      a.click();
      document.body.removeChild(a);
    };

    const playCtrl = document.querySelector('.btn-play');
    playCtrl.onclick = () => {
      ee.emit("play");
    };

    const pauseCtrl = document.querySelector('.btn-pause');
    pauseCtrl.onclick = () => {
      ee.emit("pause");
    };

    const stopCtrl = document.querySelector('.btn-stop');
    stopCtrl.onclick = () => {
      ee.emit("stop");
    };

    const rewindCtrl = document.querySelector('.btn-rewind');
    rewindCtrl.onclick = () => {
      ee.emit("rewind");
    };

    const fastForwardCtrl = document.querySelector('.btn-fast-forward');
    fastForwardCtrl.onclick = () => {
      ee.emit("fastforward");
    };

    const timeFormatCtrl = document.querySelector('.time-format');
    timeFormatCtrl.onchange = (e) => {
      const format = e.target.value;
      ee.emit("durationformat", format);

      updateSelect(startTime, endTime);
      updateTime(audioPos);
    };

    const continuousPlayCtrl = document.querySelector('.continuous-play');
    continuousPlayCtrl.onchange = (e) => {
      ee.emit("continuousplay", e.target.checked);
    };

    /*
    * Code below receives updates from the playlist.
    */

    ee.on("select", updateSelect);

    ee.on("timeupdate", updateTime);



    let overlay = document.querySelector('.overlay-loading');
    let progress = document.getElementById('progress');
    let decoded = document.getElementById('decoded');

    ee.on('loadprogress', (percent, src) => {
      var name = src;

      if (src instanceof File) {
        name = src.name;
      }

      progress.innerHTML = `Audio has loaded ${percent}%`;
    });

    ee.on('audiosourcesloaded', () => {
      decoded.innerHTML = 'Audio finished decoding.';
    });

    ee.on('audiosourcesrendered', () => {
      overlay.remove();
      overlay = null;
      progress = null;
      decoded = null;
    });

    ee.on('automaticscroll', (val) => {
      playlist.isAutomaticScroll = val;
    });

    ee.on('durationformat', (format) => {
      playlist.durationFormat = format;
      playlist.drawRequest();
    });

    ee.on('select', (start, end, track) => {
      if (playlist.isPlaying()) {
        playlist.lastSeeked = start;
        playlist.pausedAt = undefined;
        playlist.restartPlayFrom(start);
      } else {
        // reset if it was paused.
        playlist.seek(start, end, track);
        playlist.ee.emit('timeupdate', start);
        playlist.drawRequest();
      }
    });

    ee.on('play', (start, end) => {
      const startAt = start || playlist.pausedAt || playlist.cursor;
      stopVideoAt = end;

      const doneSeeking = () => {
        video.play();
        playlist.play(start, end);
        video.removeEventListener('seeked', doneSeeking);
      };

      video.addEventListener('seeked', doneSeeking);
      video.currentTime = startAt;
    });

    ee.on('pause', () => {
      playlist.pause();
      video.pause();
    });

    ee.on('stop', () => {
      playlist.stop();
      video.pause();
    });

    ee.on('rewind', () => {
      playlist.rewind();
    });

    ee.on('fastforward', () => {
      playlist.fastForward();
    });

    ee.on('mastervolumechange', (volume) => {
      playlist.masterGain = volume / 100;
      playlist.tracks.forEach((track) => {
        track.setMasterGainLevel(playlist.masterGain);
      });
    });

    ee.on('scroll', () => {
      playlist.isScrolling = true;
      playlist.drawRequest();
      clearTimeout(playlist.scrollTimer);
      playlist.scrollTimer = setTimeout(() => {
        playlist.isScrolling = false;
      }, 200);
    });

    ee.on('annotationchange', (annotation, i, annotations, opts) => {
      // update text track cue
      const cue = cueList[i]
      captionTrack.removeCue(cue);
      const updatedCue = new VTTCue(annotation.start, annotation.end, annotation.lines.join('\n'));
      cueList[i] = updatedCue;
      captionTrack.addCue(updatedCue);
    });
});



// https://developer.mozilla.org/en-US/docs/Web/Guide/Events/Media_events


// ytdl https://www.youtube.com/watch?v=q9ANdC7ZFAI --quality 248 --output video.webm
// ytdl https://www.youtube.com/watch?v=q9ANdC7ZFAI --quality 251 --output audio.webm
// ffmpeg -i audio.webm -vn -acodec copy ./dist/251.ogg