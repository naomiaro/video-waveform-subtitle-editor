const srtParser = require('subtitles-parser');

require('bootstrap/dist/css/bootstrap.min.css');
require('font-awesome/css/font-awesome.min.css');
require('waveform-playlist/styles/playlist.scss');
require('./app.scss');

var WaveformPlaylist = require('waveform-playlist');

var actions = [
  {
    class: 'fa.fa-minus',
    title: 'Reduce annotation end by 0.010s',
    action: (annotation, i, annotations, opts) => {
      var next;
      var delta = 0.010;
      annotation.end -= delta;

      if (opts.linkEndpoints) {
        next = annotations[i + 1];
        next && (next.start -= delta);
      }
    }
  },
  {
    class: 'fa.fa-plus',
    title: 'Increase annotation end by 0.010s',
    action: (annotation, i, annotations, opts) => {
      var next;
      var delta = 0.010;
      annotation.end += delta;

      if (opts.linkEndpoints) {
        next = annotations[i + 1];
        next && (next.start += delta);
      }
    }
  },
  {
    class: 'fa.fa-scissors',
    title: 'Split annotation in half',
    action: (annotation, i, annotations) => {
      const halfDuration = (annotation.end - annotation.start) / 2;

      annotations.splice(i + 1, 0, {
        id: 'test',
        start: annotation.end - halfDuration,
        end: annotation.end,
        lines: ['----'],
        lang: 'en',
      });

      annotation.end = annotation.start + halfDuration;
    }
  },
  {
    class: 'fa.fa-trash',
    title: 'Delete annotation',
    action: (annotation, i, annotations) => {
      annotations.splice(i, 1);
    }
  }
];


fetch('/Mogensen.srt')
  .then((response) => {
    return response.text();
  })
  .then((srt) => {
    const subtitleData = srtParser.fromSrt(srt, true);
    const annotations = subtitleData.map((subtitle) => {
      return {
        id: subtitle.id,
        begin: subtitle.startTime / 1000,
        end: subtitle.endTime / 1000,
        lines: subtitle.text.split('\n')
      };
    });

    var playlist = WaveformPlaylist.init({
      container: document.getElementById("playlist"),
      timescale: true,
      state: 'select',
      samplesPerPixel: 1500,
      zoomLevels: [1500],
      colors: {
        waveOutlineColor: '#E0EFF1',
        timeColor: 'grey',
        fadeColor: 'black'
      },
      annotationList: {
        annotations: annotations,
        controls: actions,
        editable: true,
        isContinuousPlay: false,
        linkEndpoints: false
      }
    });

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

    var video = document.getElementById('video');

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
      ee.emit("annotationsrequest");
    });

    $container.on("click", ".btn-play", function() {
      const start = playlist.pausedAt || playlist.cursor;
      video.currentTime = start;
      video.play();
      playlist.play();
    });

    $container.on("click", ".btn-pause", function() {
      ee.emit("pause");
      video.pause();
    });

    $container.on("click", ".btn-stop", function() {
      ee.emit("stop");
      video.pause();
    });

    $container.on("click", ".btn-rewind", function() {
      isLooping = false;
      ee.emit("rewind");
    });

    $container.on("click", ".btn-fast-forward", function() {
      isLooping = false;
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

    function displayLoadingData(data) {
      var info = $("<div/>").append(data);
      $(".loading-data").append(info);
    }

    /*
    * Code below receives updates from the playlist.
    */

    // needed for annotation clicks
    ee.on("play", (start, end) => {
      video.currentTime = start || 0;
      video.play();
      stopVideoAt = end;
    });

    ee.on("select", updateSelect);

    ee.on("timeupdate", updateTime);

    ee.on("audiosourcesrendered", function() {
      displayLoadingData("Tracks have been rendered");
    });
});



// https://developer.mozilla.org/en-US/docs/Web/Guide/Events/Media_events


// ytdl https://www.youtube.com/watch?v=q9ANdC7ZFAI --quality 248 --output video.webm
// ytdl https://www.youtube.com/watch?v=q9ANdC7ZFAI --quality 251 --output audio.webm
// ffmpeg -i audio.webm -vn -acodec copy ./dist/251.ogg