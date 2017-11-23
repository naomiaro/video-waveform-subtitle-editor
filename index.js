const srtParser = require('subtitles-parser');

require('bootstrap/dist/css/bootstrap.min.css');
require('font-awesome/css/font-awesome.min.css');
require('./app.scss');

const createElement = require('virtual-dom/create-element');
const EventEmitter = require('event-emitter');
const Playlist = require('waveform-playlist/lib/Playlist');

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
    action: (annotation, i, annotations, opts) => {
      var next;
      var delta = 0.010;
      annotation.end -= delta;

      // update text track cue
      const cue = cueList[i]
      captionTrack.removeCue(cue);
      const updatedCue = new VTTCue(annotation.start, annotation.end, annotation.lines.join('\n'));
      cueList[i] = updatedCue;
      captionTrack.addCue(updatedCue);
    }
  },
  {
    class: 'fa.fa-plus.anno-end-plus',
    title: 'Increase annotation end by 0.010s',
    action: (annotation, i, annotations, opts) => {
      var next;
      var delta = 0.010;
      annotation.end += delta;

      // update text track cue
      const cue = cueList[i]
      captionTrack.removeCue(cue);
      const updatedCue = new VTTCue(annotation.start, annotation.end, annotation.lines.join('\n'));
      cueList[i] = updatedCue;
      captionTrack.addCue(updatedCue);
    }
  },
  {
    class: 'fa.fa-scissors',
    title: 'Split annotation in half',
    action: (annotation, i, annotations) => {
      const halfDuration = (annotation.end - annotation.start) / 2;

      annotations.splice(i + 1, 0, {
        id: i + 2,
        start: annotation.end - halfDuration,
        end: annotation.end,
        lines: ['----'],
        lang: 'en',
      });

      annotation.end = annotation.start + halfDuration;

      // update text track cue
      captionTrack.removeCue(cueList[i]);
      const updatedCueOne = new VTTCue(annotation.start, annotation.end, annotation.lines.join('\n'));
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
    }
  },
  {
    class: 'fa.fa-trash',
    title: 'Delete annotation',
    action: (annotation, i, annotations) => {
      annotations.splice(i, 1);

      // update text track cue
      const removedCues = cueList.splice(i, 1);
      captionTrack.removeCue(removedCues[0]);

      // loop though and decrement ids
      for (let idIndex = i; idIndex < annotations.length; idIndex += 1) {
        let annotation = annotations[idIndex];
        annotation.id = `${idIndex + 1}`;
      }
    }
  }
];



fetch('Mogensen.srt')
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
        src: "251.ogg"
      }
    ]).then(function() {
      //can do stuff with the playlist.
    });

    // START EVENTS COPY

    /*
     * This script is provided to give an example how the playlist can be controlled using the event emitter.
     * This enables projects to create/control the useability of the project.
    */
    var ee = playlist.getEventEmitter();
    var $container = $("body");
    var $timeFormat = $container.find('.time-format');
    var $audioStart = $container.find('.audio-start');
    var $audioEnd = $container.find('.audio-end');
    var $time = $container.find('.audio-pos');

    var format = "hh:mm:ss.uuu";
    var startTime = 0;
    var endTime = 0;
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
      if (start < end) {
        $('.btn-trim-audio').removeClass('disabled');
        $('.btn-loop').removeClass('disabled');
      }
      else {
        $('.btn-trim-audio').addClass('disabled');
        $('.btn-loop').addClass('disabled');
      }

      $audioStart.val(cueFormatters(format)(start));
      $audioEnd.val(cueFormatters(format)(end));

      startTime = start;
      endTime = end;
      video.currentTime = start;
    }

    function updateTime(time) {
      $time.html(cueFormatters(format)(time));

      audioPos = time;
    }

    updateSelect(startTime, endTime);
    updateTime(audioPos);

    $container.on("click", ".btn-annotations-download", function() {
      const output = playlist.annotationList.annotations.map((annotation) => {
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
    });

    $container.on("click", ".btn-play", function() {
      ee.emit("play");
    });

    $container.on("click", ".btn-pause", function() {
      ee.emit("pause");
    });

    $container.on("click", ".btn-stop", function() {
      ee.emit("stop");
    });

    $container.on("click", ".btn-rewind", function() {
      ee.emit("rewind");
    });

    $container.on("click", ".btn-fast-forward", function() {
      ee.emit("fastforward");
    });

    //zoom buttons
    $container.on("click", ".btn-zoom-in", function() {
      ee.emit("zoomin");
    });

    $container.on("click", ".btn-zoom-out", function() {
      ee.emit("zoomout");
    });

    $container.on("change", ".time-format", function(e) {
      format = $timeFormat.val();
      ee.emit("durationformat", format);

      updateSelect(startTime, endTime);
      updateTime(audioPos);
    });

    $container.on("input change", ".master-gain", function(e){
      ee.emit("mastervolumechange", e.target.value);
    });

    $container.on("change", ".continuous-play", function(e){
      ee.emit("continuousplay", $(e.target).is(':checked'));
    });

    $container.on("change", ".link-endpoints", function(e){
      ee.emit("linkendpoints", $(e.target).is(':checked'));
    });

    $container.on("change", ".automatic-scroll", function(e){
      ee.emit("automaticscroll", $(e.target).is(':checked'));
    });

    /*
    * Code below receives updates from the playlist.
    */

    ee.on("select", updateSelect);

    ee.on("timeupdate", updateTime);

    ee.on("audiosourcesrendered", function() {
      const overlay = document.querySelector('.overlay-loading');
      overlay.remove();
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

    ee.on('zoomin', () => {
      const zoomIndex = Math.max(0, playlist.zoomIndex - 1);
      const zoom = playlist.zoomLevels[zoomIndex];

      if (zoom !== playlist.samplesPerPixel) {
        playlist.setZoom(zoom);
        playlist.drawRequest();
      }
    });

    ee.on('zoomout', () => {
      const zoomIndex = Math.min(playlist.zoomLevels.length - 1, playlist.zoomIndex + 1);
      const zoom = playlist.zoomLevels[zoomIndex];

      if (zoom !== playlist.samplesPerPixel) {
        playlist.setZoom(zoom);
        playlist.drawRequest();
      }
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