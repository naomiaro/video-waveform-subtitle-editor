# video-waveform-subtitle-editor
edit / add subtitles to YouTube videos with an audio waveform preview as well.

Port 80

What I do on my cloud instances is I redirect port 80 to port 3000 with this command:

sudo iptables -t nat -A PREROUTING -i eth0 -p tcp --dport 80 -j REDIRECT --to-port 3000
Then I launch my Node.js on port 3000. Requests to port 80 will get mapped to port 3000.

You should also edit your /etc/rc.local file and add that line minus the sudo. That will add the redirect when the machine boots up. You don't need sudo in /etc/rc.local because the commands there are run as root when the system boots.

Logs

Use the forever module to launch your Node.js with. It will make sure that it restarts if it ever crashes and it will redirect console logs to a file.

Launch on Boot

Add your Node.js start script to the file you edited for port redirection, /etc/rc.local. That will run your Node.js launch script when the system starts.

Digital Ocean & other VPS

This not only applies to Linode, but Digital Ocean, AWS EC2 and other VPS providers as well. However, on RedHat based systems /etc/rc.local is /ect/rc.d/local.
