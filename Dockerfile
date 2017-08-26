FROM node:alpine
ADD . /app/
RUN cd /app && \
  npm update && \
  chmod a+x tradfri-mqtt.js && \
  ln -s /app/tradfri-mqtt.js /usr/local/bin/tradfri-mqtt


ENV TRADFRI_GATEWAY ""
ENV TRADFRI_PSK ""
ENV MQTT_ADDRESS "tcp://127.0.0.1:1883"

ENTRYPOINT ["tradfri-mqtt"]
