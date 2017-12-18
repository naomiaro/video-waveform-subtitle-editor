const express = require('express');
const path = require('path');
const Queue = require('bee-queue');
const ytdl = require('ytdl-core');
const crypto = require('crypto');

const router = express.Router();
const queue = new Queue('ytdl', {
  redis: {
    host: 'redis',
    port: 6379
  }
});

const VIDEO_ITAG = 43;
const MEDIA_DIR = path.join(__dirname, '..', '..', 'media');

/**
 * Calculates the MD5 hash of a string.
 *
 * @param  {String} string - The string (or buffer).
 * @return {String}        - The MD5 hash.
 */
function md5(string) {
  return crypto.createHash('md5').update(string).digest('hex');
}

router.post('/', function(req, res, next) {
  const ytUri = req.body.ytUri;
  const srtFile = req.files.srt;
  let job;
  let mediaFilename;
  let filePromise = Promise.resolve();

  if (ytdl.validateURL(ytUri)) {
    mediaFilename = ytdl.getURLVideoID(ytUri);
    job = queue.createJob({
      videoItag: VIDEO_ITAG
    }).setId(mediaFilename);
  } else {
    const videoFile = req.files.video;
    mediaFilename = md5(req.files.video.data);
    job = queue.createJob({}).setId(mediaFilename);
    filePromise = filePromise.then(videoFile.mv(path.join(MEDIA_DIR, `${mediaFilename}.webm`)));
  }

  filePromise
    .then(srtFile.mv(path.join(MEDIA_DIR, `${mediaFilename}.srt`)))
    .then(job.save())
    .catch((err) => {
      console.log(`${err.message}`);
    });

  job.on('succeeded', function (result) {
    console.log('completed job ' + job.id);
    res.redirect(`/${mediaFilename}`);
  });

  job.on('retrying', (err) => {
    console.log(`Job ${job.id} failed with error ${err.message} but is being retried!`);
  });

  job.on('progress', (progress) => {
    console.log(`Job ${job.id} reported progress: ${progress}%`);
  });

  job.on('failed', (err) => {
    console.log(`Job ${job.id} failed with error ${err.message}`);
  });
});

module.exports = router;
