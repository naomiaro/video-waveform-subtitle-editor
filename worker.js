const fs = require('fs');
const ytdl = require('ytdl-core');
const Queue = require('bee-queue');
const ffmpeg = require('ffmpeg');
const queue = new Queue('ytdl', {
  removeOnSuccess: true,
  removeOnFailure: true,
});

queue.on('ready', function () {
  queue.process(function (job, done) {
    console.log('processing job ' + job.id);

    const videoPath = __dirname + '/dist/script_video.webm';
    const audioPath = __dirname + '/dist/script_audio.webm';

    const stream = ytdl(`http://www.youtube.com/watch?v=${job.id}`, {
      quality: job.videoQuality
    }).pipe(fs.createWriteStream(videoPath));

    stream.on('finish', () => {
      console.log('ytdl finished streaming.');

      try {
        const ytdlVideo = new ffmpeg(videoPath, function (err, video) {
          if (!err) {
            console.log('The video is ready to be processed');

            video
              .addCommand('-acodec', 'copy')
              .addCommand('-vn')
              .save(audioPath, function (err, file) {
                if (err) {
                  done(err);
                } else {
                  console.log('Video file: ' + file);
                  done(null, {videoPath, audioPath});
                }

              });
          } else {
            console.log('Error: ' + err);
            done(err);
          }
        });

        // ytdlVideo.then(function (video) {
        //   console.log('The video is ready to be processed');

        //   video
        //     .addCommand('-acodec', 'copy')
        //     .addCommand('-vn')
        //     .save(audioPath, function (err, file) {
        //       if (err) {
        //         done(err);
        //       } else {
        //         console.log('Video file: ' + file);
        //         done(null, {videoPath, audioPath});
        //       }

        //     });
        // }, function (err) {
        //   console.log('Error: ' + err);
        //   done(err);
        // });
      } catch (e) {
        console.log(e.code);
        console.log(e.msg);
        done(e);
      }
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