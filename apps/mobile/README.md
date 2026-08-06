# NutriHub — Mobile (paciente)

App do paciente, feito em Expo/React Native. Não entra no `docker-compose.yml` — Expo roda no host (Metro bundler + simulador/dispositivo), containerizar não traz benefício em dev.

```bash
npm install
npx expo start
```

## Publicação nas lojas

Build gerenciado via [EAS Build](https://docs.expo.dev/build/introduction/):

```bash
npx eas build --platform ios
npx eas build --platform android
npx eas submit
```

Atualizações de JS sem passar por novo review de loja: [EAS Update](https://docs.expo.dev/eas-update/introduction/).
