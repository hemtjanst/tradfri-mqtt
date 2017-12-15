FROM node:alpine
ADD . /app/

RUN cd /app && \
  mkdir /data && \
  npm update || (apk add --update python make g++ && rm -rf /var/cache/apk/* && npm update) && \
  chmod a+x tradfri-mqtt.js && \
  ln -s /app/tradfri-mqtt.js /usr/local/bin/tradfri-mqtt

VOLUME /data

ENV TRADFRI_GATEWAY ""
ENV TRADFRI_PSK ""
ENV TRADFRI_STORAGE "/data"
ENV MQTT_ADDRESS "tcp://127.0.0.1:1883"
ENV MQTT_TOPIC_PREFIX "tradfri-raw"
ENV MQTT_TOPIC_CMD "tradfri-cmd"

ENTRYPOINT ["tradfri-mqtt"]
