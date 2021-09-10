FROM python:3.6
RUN pip3 install gevent Flask python-engineio==3.13.2 python-socketio==4.6.0 Flask-SocketIO==4.3.1 Flask-Session Flask-Cors requests uwsgi
COPY . .
CMD uwsgi --http 0.0.0.0:80 --http-websockets --processes 10 --gevent 100 -b 32768 -w wsgi:app
