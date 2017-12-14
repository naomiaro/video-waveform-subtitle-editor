const fs = require('fs');
const ytdl = require('ytdl-core');
const path = require('path');
const Queue = require('bee-queue');
const ffmpeg = require('fluent-ffmpeg');

const queue = new Queue('ytdl', {
  redis: {
    host: 'redis',
    port: 6379
  },
  removeOnSuccess: true,
  removeOnFailure: true,
});

const MEDIA_DIR = path.join(__dirname, '..', 'media');

queue.on('ready', function () {
  queue.process(function (job, done) {
    console.log(`processing job ${job.id} with itag ${job.data.videoItag}`);

    const videoPath = path.join(MEDIA_DIR, `${job.id}.webm`);
    const audioPath = path.join(MEDIA_DIR, `${job.id}.ogg`);

    const stream = ytdl(`https://www.youtube.com/watch?v=${job.id}`, {
      quality: job.data.videoItag
    }).pipe(fs.createWriteStream(videoPath));

    stream.on('finish', () => {
      console.log('ytdl finished streaming.');

      ffmpeg(videoPath)
        .outputOptions([
          '-vn',
          '-acodec copy'
        ])
        .on('error', function(err) {
          console.log('An error occurred: ' + err.message);
          console.log(err);
          done(err);
        })
        .on('end', function() {
          console.log('Processing finished !');
          done(null, {videoPath, audioPath});
        })
        .save(audioPath);
    });

    stream.on('error', (err) => {
      console.log(err);
      done(err);
    });
  });

  console.log('processing jobs...');
});

queue.on('error', (err) => {
  console.log(`A queue error happened: ${err.message}`);
});

queue.on('retrying', (job, err) => {
  console.log(`Job ${job.id} failed with error ${err.message} but is being retried!`);
});

queue.on('failed', (job, err) => {
  console.log(`Job ${job.id} failed with error ${err.message}`);
});

queue.on('succeeded', (job, result) => {
  console.log(`Job ${job.id} succeeded with result: ${result}`);
});


// ytdl https://www.youtube.com/watch?v=q9ANdC7ZFAI --quality 248 --output video.webm
// ytdl https://www.youtube.com/watch?v=q9ANdC7ZFAI --quality 251 --output audio.webm
// ffmpeg -i audio.webm -vn -acodec copy ./dist/251.ogg