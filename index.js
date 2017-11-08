require('bootstrap/dist/css/bootstrap.min.css');
require('font-awesome/css/font-awesome.min.css');

var WaveformPlaylist = require('waveform-playlist');


// ytdl https://www.youtube.com/watch?v=q9ANdC7ZFAI --quality 248 --output video.webm
// ytdl https://www.youtube.com/watch?v=q9ANdC7ZFAI --quality 251 --output audio.webm
// ffmpeg -i audio.webm -vn -acodec copy ./dist/251.ogg