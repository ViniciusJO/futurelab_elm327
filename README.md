# Sistema de coleta

Persistencia e visualizacao de dados de Acelerometro e OBD2

## Dependencias

A depender da estrategia de deploy

- [docker](https://www.docker.com/)
- [docker-compose](https://docs.docker.com/compose/)

ou

- [nodejs (> v20)](https://nodejs.org/)
- [mosquitto (MQTT broker)](https://mosquitto.org/)

## Como rodar:

### Docker Compose

```sh
docker-compose up -d
```

para rodar attached e ver os log remova a flag `-d`:

```sh
docker-compose up
```

### Manual

Instalacao:

```sh
git clone https://github.com/ViniciusJO/futurelab_elm327.git

cd futurelab_elm327/client
npm install

cd ../server
npm install

npm run build-client
npm run build
```

Inicializacao:

```sh
npm run start
```
